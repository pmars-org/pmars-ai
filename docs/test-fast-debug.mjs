import {loadTestWarriors} from './test-fixtures.mjs';
// SPDX-License-Identifier: GPL-2.0-or-later
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {Engine} from './engine.mjs';
const marked=';redcode\n;name Marked\n;assert 1\n;debug\nnop 0,0\n;break\njmp 0\n';
for(const budget of [1,100000]) {
 const compiler=await Engine.create({warriors:1,cycles:20,brief:true});
 const banks=compiler.compile([marked]);
 const e=await Engine.create({warriors:1,cycles:20,brief:true});
 e.import(banks);e.start();e.setDebug(true);
 let steps=0,u;
 do {u=e.advance(budget,4);steps+=u.executed;}while(u.debugHit<0&&!u.done);
 assert.equal(steps,1);assert.equal(u.debugHit,0);assert.equal(u.warriors[0].pc,1);
 do {u=e.advance(budget,4);steps+=u.executed;}while(u.debugHit<0&&!u.done);
 assert.equal(steps,2);
}
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright');
const browser=await chromium.launch({headless:true,...(process.env.BROWSER_CHANNEL ? {channel:process.env.BROWSER_CHANNEL} : {})});
const page=await browser.newPage({viewport:{width:1400,height:1000}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
const ready=t=>page.waitForFunction(t=>document.querySelector('#status').textContent.includes(t),t);
const count=()=>page.locator('#timing').evaluate(e=>Number(e.dataset.instructions));
try {
 await page.goto(process.env.PMARS_URL || 'http://127.0.0.1:8765/docs/');
 await loadTestWarriors(page);
 assert.equal(await page.locator('#diagnostics').evaluate(e=>e.open),false);
 assert.equal(await page.locator('#series,#stop').count(),0);
 await page.locator('#toggleEditors').click();
 await page.locator('#first').fill(marked);
 await page.locator('#second').fill(';redcode\n;assert 1\njmp 0\n');
 await page.locator('#debugRun').click();await ready('Debug marker:');
 assert(await page.locator('#debugEnabled').isChecked());assert.equal(await count(),2);
 await page.locator('#step').click();assert.equal(await count(),3);
 await page.locator('#debugEnabled').uncheck();
 const imp=';redcode\n;assert 1\nmov.i 0,1\n';
 await page.locator('#first').fill(imp);await page.locator('#second').fill(imp);
 await page.locator('#editSettings').click();await page.locator('#cycles').fill('10000000');
 await page.locator('#rounds').fill('10000000');
 await page.locator('#reset').click();await ready('Paused before');
 await page.locator('#speed').fill('0');
 const snapshot=()=>page.evaluate(()=>[document.querySelector('#core').toDataURL(),document.querySelector('#execution').textContent,document.querySelector('#legendNames').textContent]);
 const before=await snapshot();
 await page.evaluate(()=>{window.pulses=[];let prev=performance.now();window.pulse=setInterval(()=>{const now=performance.now();pulses.push(now-prev);prev=now;},20);});
 await page.locator('#fast').click();await page.waitForTimeout(400);
 assert(await count()>100);assert.deepEqual(await snapshot(),before);
 await page.locator('#run').click();await ready('Paused.');
 const paused=await count();await page.waitForTimeout(100);assert.equal(await count(),paused);
 assert.equal(await page.locator('#fast').getAttribute('aria-pressed'),'false');
 const pulse=await page.evaluate(()=>{clearInterval(window.pulse);return Math.max(...pulses);});assert(pulse<250);
 // Check the single-row default configuration; large cycle counters may wrap.
 await page.locator('#cycles').fill('80000');await page.locator('#rounds').fill('1');
 await page.locator('#reset').click();await ready('Paused before');
 for(const width of [1400,390]) {
  await page.setViewportSize({width,height:1000});
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  const rects=await page.evaluate(()=>Object.fromEntries(['run','rounds','timing','speed','hoverAddress'].map(id=>{const r=document.getElementById(id).getBoundingClientRect();return [id,{x:r.x,y:r.y,bottom:r.bottom,right:r.right}];})));
  if(width===1400)assert(Math.max(...Object.values(rects).map(r=>r.y))<Math.min(...Object.values(rects).map(r=>r.bottom)),'Controls should share one line: '+JSON.stringify(rects));
  assert(Object.values(rects).every(r=>r.right<=width),'Toolbar should fit viewport');
  await page.screenshot({path:'docs/test-output/toolbar-'+width+'.png',fullPage:true});
 }
 assert.deepEqual(errors,[]);
 console.log('PASS: native debug markers, Fast suppresses views and remains responsive, pause, desktop single-line toolbar and mobile wrapping; heartbeat '+pulse.toFixed(1)+' ms');
}finally{await browser.close();}
