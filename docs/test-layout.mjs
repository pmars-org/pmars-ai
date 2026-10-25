import {loadTestWarriors} from './test-fixtures.mjs';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright');
const browser=await chromium.launch({headless:true,...(process.env.BROWSER_CHANNEL ? {channel:process.env.BROWSER_CHANNEL} : {})});
try {
 for(const scale of [1,2]){
  const page=await browser.newPage({viewport:{width:1280,height:900},deviceScaleFactor:scale});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(process.env.PMARS_URL || 'http://127.0.0.1:8765/docs/');
 await loadTestWarriors(page);
  for(const width of [1280,390]){
   await page.setViewportSize({width,height:900});
   for(const layout of ['vertical','horizontal','fill','fill-horizontal']){
    await page.locator('#arenaLayout').selectOption(layout);
    for(const size of ['24','4','0','16','6','12','8']){
     await page.locator('#cellSize').selectOption(size);
     await page.waitForTimeout(60);
     const dims=await page.evaluate(()=>{
      const v=document.querySelector('.arena-viewport'),c=document.querySelector('#core');
      return {w:v.clientWidth,sw:v.scrollWidth,h:v.clientHeight,sh:v.scrollHeight,cell:Number(c.dataset.cellSize),columns:Number(c.dataset.columns),available:Math.min(v.clientWidth,v.parentElement.clientWidth),layoutOutside:!document.querySelector('.arena').contains(document.querySelector('#arenaLayout')),pageWidth:document.documentElement.scrollWidth,windowWidth:innerWidth};
     });
     assert.equal(dims.cell%2,0);
     assert(dims.layoutOutside);
     if(layout!=='fill-horizontal')assert(dims.pageWidth<=dims.windowWidth,'Page horizontal overflow');
     if(layout==='horizontal'||layout==='fill-horizontal')assert(dims.columns*dims.cell>=Math.floor(dims.available/dims.cell)*dims.cell,'Use the available width even when core fits');
     if(layout==='horizontal'||layout==='fill-horizontal')assert(dims.sh<=dims.h+1,'Horizontal panel must not scroll vertically');
     else assert(dims.sw<=dims.w+1,'Vertical modes must not scroll horizontally');
     if(layout==='fill')assert(dims.sh<=dims.h+1,'Fill must not scroll inside panel');
    }
   }
  }
  await page.evaluate(async()=>{
   const {CoreDisplay}=await import('./display.mjs');
   const host=document.createElement('div');Object.assign(host.style,{width:'300px',height:'400px',overflowX:'hidden',overflowY:'auto'});
   const canvas=document.createElement('canvas');host.append(canvas);document.body.append(host);
   const display=new CoreDisplay(canvas);display.configure(65536);display.setCellSize(24);
   display.apply(new Uint32Array([1,65535,0,0]));host.scrollTop=host.scrollHeight;
   window.largeArena={host,canvas,display};
  });
  await page.waitForTimeout(150);
  const large=await page.evaluate(()=>{
   const {host,canvas,display:d}=window.largeArena;
   const x=(65535%d.columns)*d.cellSize-d.offsetX+6,y=Math.floor(65535/d.columns)*d.cellSize-d.offsetY+6,r=canvas.getBoundingClientRect();
   return {offset:d.offsetY,address:d.addressAt({clientX:r.left+x,clientY:r.top+y}),width:canvas.width,height:canvas.height,overflow:host.scrollWidth>host.clientWidth,owner:d.cells[65535*4]};
  });
  assert(large.offset>0);assert.equal(large.address,65535);assert.equal(large.owner,1);
  assert(!large.overflow);assert(large.width<=4096 && large.height<=4096);
  assert.deepEqual(errors,[]);
  await page.close();
 }
 console.log('PASS: all 7 cell sizes × 4 layouts × desktop/mobile × 1x/2x displays; no unintended scroll axis; large-core windowed rendering and address mapping.');
} finally {await browser.close();}
