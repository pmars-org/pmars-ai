import {loadTestWarriors} from './test-fixtures.mjs';
// SPDX-License-Identifier: GPL-2.0-or-later
// Ensure a release never requests unversioned runtime assets, even from workers.
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright');
const browser=await chromium.launch({headless:true,...(process.env.BROWSER_CHANNEL?{channel:process.env.BROWSER_CHANNEL}:{})});
const context=await browser.newContext(),page=await context.newPage(),requests=[],errors=[];
context.on('request',r=>{if(/\.(mjs|wasm|css)$/.test(new URL(r.url()).pathname))requests.push(r.url());});
page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto(process.env.PMARS_URL||'http://127.0.0.1:8765/docs/');
 await loadTestWarriors(page);
 const version=await page.locator('script[type=module]').evaluate(e=>new URL(e.src).searchParams.get('v'));
 assert.match(version,/^[a-f0-9]{16}$/);
 await page.locator('#run').click();
 await page.waitForFunction(()=>document.querySelector('#status').textContent.startsWith('Battle running'));
 await page.waitForFunction(()=>Number(document.querySelector('#timing').dataset.instructions)>10);
 await page.locator('#run').click();
 assert(requests.some(u=>new URL(u).pathname.endsWith('/worker.mjs')));
 assert(requests.some(u=>new URL(u).pathname.endsWith('/pmars.wasm')));
 assert(requests.every(u=>new URL(u).searchParams.get('v')===version),JSON.stringify(requests,null,2));
 assert.deepEqual(errors,[]);
 console.log('PASS: Run works; main-thread modules, worker modules, stylesheet, and Wasm all request release '+version);
}finally{await browser.close();}
