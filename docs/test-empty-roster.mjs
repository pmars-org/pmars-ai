// SPDX-License-Identifier: GPL-2.0-or-later
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright');
const browser=await chromium.launch({headless:true,...(process.env.BROWSER_CHANNEL?{channel:process.env.BROWSER_CHANNEL}:{})});
const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
const empty=async()=>{while(await page.locator('.remove-warrior').count())await page.locator('.remove-warrior').last().click();};
try{
 await page.goto(process.env.PMARS_URL || 'http://127.0.0.1:8765/docs/');
 assert.equal(await page.locator('#editors .cm-content').count(),0);
 assert(await page.locator('#demo').isVisible());
 assert(await page.locator('#run').isDisabled());
 await page.locator('#demo').click();await page.waitForFunction(()=>Number(document.querySelector('#timing').dataset.instructions)>5);
 await empty();
 assert.equal(await page.locator('#warriorCount').textContent(),'0 warriors');
 assert(await page.locator('#demo').isVisible());assert(await page.locator('#toggleEditors').isHidden());
 for(const id of ['run','step','reset','fast','debugRun'])assert(await page.locator('#'+id).isDisabled());
 await page.waitForTimeout(150);assert.equal(await page.locator('#timing').getAttribute('data-instructions'),'0');
 await page.locator('#newWarrior').click();assert(await page.locator('#first').isVisible());assert(await page.locator('#demo').isHidden());
 await page.locator('#step').click();await page.waitForFunction(()=>document.querySelector('#timing').dataset.instructions==='1');
 await empty();
 await page.locator('#warriorFiles').setInputFiles({name:'solo.red',mimeType:'text/plain',buffer:Buffer.from(';redcode\n;name Uploaded\n;assert 1\njmp 0\n')});
 await page.waitForFunction(()=>document.querySelector('#warriorCount').textContent==='1 warrior');assert(await page.locator('#run').isEnabled());
 await empty();await page.setViewportSize({width:390,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.locator('#demo').click();await page.waitForFunction(()=>Number(document.querySelector('#timing').dataset.instructions)>5);
 assert.equal(await page.locator('#editors .cm-content').count(),2);
 assert((await page.locator('#editors').textContent()).includes('Imp'));assert((await page.locator('#editors').textContent()).includes('Dwarf'));
 assert(await page.locator('#demo').isHidden());
 const pool=['The Art of CoreWar','Excalibur','Forgotten Lore II','Son of Vain','Sunset'];
 await empty();assert(await page.getByRole('heading',{name:'Try a demo:'}).isVisible());
 await page.locator('#randomDemo').click();await page.waitForFunction(()=>Number(document.querySelector('#timing').dataset.instructions)>5);
 let names=await page.locator('#editors label.warrior').allTextContents();names=names.map(n=>n.split(' / ')[1]);
 assert.equal(names.length,2);assert.equal(new Set(names).size,2);assert(names.every(n=>pool.includes(n)));
 await empty();await page.locator('#multiDemo').click();await page.waitForFunction(()=>Number(document.querySelector('#timing').dataset.instructions)>5);
 names=await page.locator('#editors label.warrior').allTextContents();assert.deepEqual(names.map(n=>n.split(' / ')[1]).sort(),pool.sort());
 assert(await page.locator('#demos').isHidden());assert.deepEqual(errors,[]);
 console.log('PASS: deleting all warriors stops battle; empty controls, New, solo stepping, upload, mobile, and auto-starting Demo.');
}finally{await browser.close();}
