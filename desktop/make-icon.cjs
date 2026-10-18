'use strict';
// Build a multi-size Windows icon from the exact purple P-and-sparkle logo used in PixelForge's header.
const fs=require('node:fs');
const path=require('node:path');
const sharp=require('sharp');
async function buildIcon(){
  const svg=fs.readFileSync(path.join(__dirname,'icon.svg'));
  const sizes=[16,24,32,48,64,128,256];
  const pngs=await Promise.all(sizes.map(size=>sharp(svg,{density:240}).resize(size,size).png().toBuffer()));
  const header=Buffer.alloc(6+sizes.length*16);
  header.writeUInt16LE(0,0);
  header.writeUInt16LE(1,2);
  header.writeUInt16LE(sizes.length,4);
  let offset=header.length;
  for(let i=0;i<sizes.length;i++){
    const at=6+16*i,size=sizes[i],png=pngs[i];
    header.writeUInt8(size===256?0:size,at);
    header.writeUInt8(size===256?0:size,at+1);
    header.writeUInt8(0,at+2);
    header.writeUInt8(0,at+3);
    header.writeUInt16LE(1,at+4);
    header.writeUInt16LE(32,at+6);
    header.writeUInt32LE(png.length,at+8);
    header.writeUInt32LE(offset,at+12);
    offset+=png.length;
  }
  fs.writeFileSync(path.join(__dirname,'icon.ico'),Buffer.concat([header,...pngs]));
  console.log('Generated PixelForge P Windows icon.');
}
buildIcon().catch(error=>{console.error(error);process.exitCode=1;});
