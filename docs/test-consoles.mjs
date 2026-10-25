// SPDX-License-Identifier: GPL-2.0-or-later
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {loadTestWarriors} from './test-fixtures.mjs';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright');
const browser=await chromium.launch({headless:true,...(process.env.BROWSER_CHANNEL ? {channel:process.env.BROWSER_CHANNEL} : {})}),page=await browser.newPage({viewport:{width:1280,height:1000}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
const idle=()=>page.waitForFunction(()=>document.querySelector('#commandOutput').textContent==='Ready.');
const send=async text=>{await page.locator('#command').fill(text);await page.locator('#command').press('Enter');await idle();};
try{
 await page.goto(process.env.PMARS_URL || 'http://127.0.0.1:8765/docs/');await loadTestWarriors(page);
 await page.locator('#reset').click();await page.waitForFunction(()=>document.querySelector('#status').textContent.startsWith('Paused before'));
 assert.equal(await page.locator('.output-console').count(),2);
 await send('step');await send('');
 assert.deepEqual(await page.locator('#commandHistory button').allTextContents(),['step','step']);
 assert(!(await page.locator('#instruction').textContent()).includes('(cdb)'));
 await page.locator('#commandHistory button').first().click();await idle();assert.equal(await page.locator('#timing').getAttribute('data-instructions'),'3');
 await send('calc 6*7');await send(' calc 2+3');await send('');
 assert.equal(await page.locator('#commandHistory button').last().textContent(),'calc 6*7','Native leading-space recall semantics preserved');
 await page.locator('#addConsole').click();assert.equal(await page.locator('.output-console').count(),3);
 const panels=page.locator('.output-console');
 await panels.nth(1).locator('select').selectOption('warrior:0');await panels.nth(2).locator('select').selectOption('warrior:1');
 assert.equal(await panels.nth(1).locator('select option:checked').textContent(),'Imp');
 await page.locator('#step').click();
 assert(await panels.nth(1).locator('.instruction-row').count()>0);assert(await panels.nth(2).locator('.instruction-row').count()>0);
 await panels.nth(1).getByRole('button',{name:'Pause console 2',exact:true}).click();
 const snapshot=await panels.nth(1).locator('pre').textContent();await send('step~!4');assert.equal(await panels.nth(1).locator('pre').textContent(),snapshot);
 await panels.nth(1).getByRole('button',{name:'Pause console 2',exact:true}).click();
 await panels.nth(2).locator('select').selectOption('cdb');assert.equal(await panels.nth(2).locator('pre').textContent(),await page.locator('#instruction').textContent());
 await page.screenshot({path:'docs/test-output/consoles-desktop.png',fullPage:true});
 await panels.nth(0).getByRole('button',{name:'Remove console 1',exact:true}).click();
 await panels.nth(1).getByRole('button',{name:'Remove console 3',exact:true}).click();
 await send('list 0,2');assert.equal(await panels.count(),2,'A debugger command restores a missing cdb console');
 await page.setViewportSize({width:390,height:900});
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No mobile page overflow');
 await page.screenshot({path:'docs/test-output/consoles-mobile.png',fullPage:true});
 assert.deepEqual(errors,[]);console.log('PASS: command recall/replay, native leading-space semantics, configurable duplicate consoles, individual pause, console removal/recovery, and mobile layout.');
}finally{await browser.close();}
