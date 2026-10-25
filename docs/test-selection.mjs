import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright');
const browser=await chromium.launch({headless:true,...(process.env.BROWSER_CHANNEL ? {channel:process.env.BROWSER_CHANNEL} : {})});
const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
const source=(name,code='jmp 0')=>({name:name+'.red',mimeType:'text/plain',buffer:Buffer.from(';redcode\n;name '+name+'\n;assert 1\n'+code+'\n')});
try {
 await page.goto(process.env.PMARS_URL || 'http://127.0.0.1:8765/docs/');
 await page.locator('#warriorFiles').setInputFiles([source('Broken','invalid opcode'),source('Bravo'),source('Charlie')]);
 const checks=page.locator('.include-warrior');await checks.first().waitFor();
 await checks.nth(0).uncheck();await checks.nth(2).uncheck();
 await page.locator('#reset').click();await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('Paused before'));
 assert.match(await page.locator('#activeSettings').textContent(),/1 warriors/);
 assert.match(await page.locator('#legendNames').textContent(),/Bravo/);
 assert.equal(await page.locator('#editors .cm-content').count(),3);
 await page.locator('#step').click();await page.waitForFunction(()=>document.querySelector('#timing').dataset.instructions==='1');
 await checks.nth(2).check();assert.match(await page.locator('#activeSettings').textContent(),/1 warriors/);
 await page.locator('#reset').click();await page.waitForFunction(()=>document.querySelector('#activeSettings').textContent.includes('2 warriors'));
 await checks.nth(1).uncheck();await checks.nth(2).uncheck();
 assert(await page.locator('#reset').isDisabled());assert(await page.locator('#run').isDisabled());
 await page.locator('.remove-warrior').first().click();assert.equal(await checks.nth(0).isChecked(),false);
 await checks.nth(1).check();await page.locator('#reset').click();await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('Paused before'));
 assert.match(await page.locator('#legendNames').textContent(),/Charlie/);
 assert.match(await page.locator('#activeSettings').textContent(),/1 warriors/);
 assert.deepEqual(errors,[]);
 console.log('PASS: selection, excluded invalid source, solo stepping, reset, zero selection, and removal preserve roster mapping.');
} finally {await browser.close();}
