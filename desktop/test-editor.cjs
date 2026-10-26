'use strict';
// Lightweight regression checks for the installed editor. These tests validate
// browser-script syntax and invariants even when Electron cannot run headless.
const fs=require('node:fs');
const assert=require('node:assert/strict');
const vm=require('node:vm');

const html=fs.readFileSync('index.html','utf8');
const main=fs.readFileSync('desktop/main.cjs','utf8');
const preload=fs.readFileSync('desktop/preload.cjs','utf8');
let scriptCount=0;
for(const match of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script\s*>/gi)){
  const code=match[1].trim();
  if(!code)continue;
  new vm.Script(code,{filename:`index.html:inline-${++scriptCount}`});
}
assert.ok(scriptCount>=2,'Expected the PSD and editor browser scripts');

const invariants=[
  [/canvas:makeCanvas\(sourceW,sourceH\)/,'Placed images retain source-sized canvases'],
  [/layer\.canvas\.getContext\('2d'\)\.drawImage\(img,0,0\)/,'Placement does not resample source pixels'],
  [/const scale=Math\.min\(1,state\.width\/sourceW,state\.height\/sourceH\)/,'Images fit proportionally without 96% inset'],
  [/layer\.bounds=\{x:0,y:0,w:sourceW,h:sourceH\}/,'Imported images retain full-sized bounds'],
  [/layer\.canvas=makeCanvas\(imageW,imageH\)/,'Saved projects restore original pixel dimensions'],
  [/embedded:!!l\.embedded/,'Project save retains embedded metadata'],
  [/l\.scaleX\*=sx;l\.scaleY\*=sy/,'Image resizing preserves layer pixel sources'],
  [/l\.x\+=dx;l\.y\+=dy/,'Canvas resize does not flatten layers'],
  [/currentAdjustmentPreviewLayerId===layer\.id/,'Adjustment previews are bound to the correct layer'],
  [/currentAdjustmentPreviewDocumentId===activeDocumentTabId/,'Adjustment previews are bound to the current document'],
  [/onExternalFiles\(files=>/,'Windows file launches are handled by the editor']
];
for(const [pattern,message] of invariants)assert.match(html,pattern,message);
assert.match(main,/function flushExternalFileOpens\(/);
assert.match(main,/function readNativeFile\(/);
assert.match(preload,/pixelforge:open-path-files/);
const packageJson=JSON.parse(fs.readFileSync('package.json','utf8'));
assert.ok(packageJson.build.fileAssociations.some(a=>a.ext==='pforge'));
console.log('PixelForge editor checks passed: '+scriptCount+' inline scripts and '+invariants.length+' editor invariants.');
