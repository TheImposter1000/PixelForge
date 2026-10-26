'use strict';

// Regression test for the GIF encoder used by both the web and desktop editors.
// Sharp decodes the actual generated GIF, rather than only checking its header.
const fs=require('node:fs');
const path=require('node:path');
const sharp=require('sharp');
const assert=require('node:assert/strict');

const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const start=html.indexOf('function encodeStaticGif(');
const end=html.indexOf('function encodeBitmapBmp(',start);
assert(start>=0&&end>start,'GIF encoder missing from index.html');
const encode=(new Function('Blob',html.slice(start,end)+'\nreturn encodeStaticGif;'))(Blob);
const w=150,h=150,pixels=new Uint8ClampedArray(w*h*4);
function clamp(v){return Math.max(0,Math.min(255,Math.round(v)));}
for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const k=(y*w+x)*4;
  const inside=x>=18&&x<132&&y>=15&&y<142;
  pixels[k+3]=inside?255:0;
  if(!inside)continue;
  const hair=y<41;
  pixels[k]=clamp((hair?31:133)+x*.39+15*Math.sin(x/13)+7*Math.sin(y/17));
  pixels[k+1]=clamp((hair?25:87)+x*.25+12*Math.cos(y/23)+5*Math.sin((y+x)/14));
  pixels[k+2]=clamp((hair?22:65)+x*.17+10*Math.sin(y/19)+5*Math.cos((y-x)/11));
}
async function evaluate(dither){
  const result=encode({width:w,height:h,data:pixels},{colors:256,dither,alphaThreshold:128});
  const buffer=Buffer.from(await result.arrayBuffer());
  assert.equal(buffer.toString('ascii',0,6),'GIF89a','GIF header');
  const {data,info}=await sharp(buffer).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  assert.equal(info.width,w,'GIF width');assert.equal(info.height,h,'GIF height');
  let sum=0,count=0;const visibleColors=new Set();
  for(let j=0;j<w*h;j++){
    const p=j*4;
    if(pixels[p+3]===0){assert.equal(data[p+3],0,'transparent region retained');continue;}
    assert.equal(data[p+3],255,'opaque region retained');
    const r=data[p],g=data[p+1],b=data[p+2];
    visibleColors.add((r<<16)|(g<<8)|b);
    sum+=(pixels[p]-r)**2+(pixels[p+1]-g)**2+(pixels[p+2]-b)**2;
    count+=3;
  }
  const rmse=Math.sqrt(sum/count);
  assert(rmse<22,'Portrait color fidelity regressed: RMSE='+rmse.toFixed(2));
  assert(visibleColors.size>160,'Too few image-adaptive palette colors: '+visibleColors.size);
  console.log('GIF',dither?'Floyd-Steinberg':'no dithering',buffer.length+' bytes',visibleColors.size+' colors','RMSE',rmse.toFixed(2));
}
Promise.resolve().then(()=>evaluate(false)).then(()=>evaluate(true)).catch(error=>{console.error(error);process.exitCode=1;});
