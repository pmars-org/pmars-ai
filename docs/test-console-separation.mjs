// SPDX-License-Identifier: GPL-2.0-or-later
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {loadTestWarriors} from './test-fixtures.mjs';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright');
const browser=await chromium.launch({headless:true,...(process.env.BROWSER_CHANNEL ? {channel:process.env.BROWSER_CHANNEL} : {})}),page=await browser.newPage(),errors=[];
page.on('pageerror',e=>errors.push(e.message));
const ready=()=>page.waitForFunction(()=>document.querySelector('#status').textContent.startsWith('Paused before'));
try{
 await page.goto(process.env.PMARS_URL || 'http://127.0.0.1:8765/docs/');await loadTestWarriors(page);await page.locator('#reset').click();await ready();
 assert.deepEqual(await page.locator('.console-toolbar select').evaluateAll(nodes=>nodes.map(n=>n.value)),['cdb','all']);
 await page.locator('#command').fill('calc 42');await page.locator('#command').press('Enter');await page.waitForFunction(()=>document.querySelector('#commandOutput').textContent==='Ready.');
 const output=await page.locator('#instruction').textContent();assert(output.includes('42'));
 await page.locator('#step').click();assert.equal(await page.locator('#instruction').textContent(),output);assert(await page.locator('.output-console').nth(1).locator('.instruction-row').count()>0);
 await page.locator('#run').click();await page.waitForTimeout(150);await page.locator('#run').click();assert.equal(await page.locator('#instruction').textContent(),output);
 await page.locator('#toggleEditors').click();await page.locator('#first').fill(';redcode\n;name Doomed\n;assert 1\ndat 0,0\n');await page.locator('#reset').click();await ready();
 const marker=page.locator('[data-eliminated="0"]'),before=await marker.boundingBox();assert.equal(await marker.textContent(),'');
 await page.locator('#step').click();assert.equal(await marker.textContent(),'×');assert.equal(await marker.getAttribute('aria-label'),'Doomed eliminated');assert.equal((await marker.boundingBox()).width,before.width);
 assert.equal(await marker.evaluate(el=>el.parentElement.className),'warrior-swatch');
 assert(await marker.evaluate(el=>el.getBoundingClientRect().width>el.parentElement.getBoundingClientRect().width));
 assert.equal(await page.locator('[data-eliminated="1"]').textContent(),'');
 await page.locator('#reset').click();await ready();assert.equal(await marker.textContent(),'');
 assert.deepEqual(errors,[]);console.log('PASS: cdb output survives toolbar Step/Run, default consoles, eliminated marker, reserved width and reset.');
}finally{await browser.close();}
