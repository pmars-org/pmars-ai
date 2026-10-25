import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {loadTestWarriors} from './test-fixtures.mjs';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright');
const browser=await chromium.launch({headless:true,...(process.env.BROWSER_CHANNEL ? {channel:process.env.BROWSER_CHANNEL} : {})}),page=await browser.newPage(),errors=[];
page.on('pageerror',e=>errors.push(e.message));
const finished=()=>page.waitForFunction(()=>document.querySelector('#run').textContent.includes('Done'));
try{
 await page.goto(process.env.PMARS_URL || 'http://127.0.0.1:8765/docs/');assert.equal(await page.locator('#debugStart').count(),0);assert(await page.locator('#battleResults').isHidden());
 await loadTestWarriors(page);await page.locator('#toggleEditors').click();
 await page.locator('#first').fill(';redcode\n;name Dead\n;assert 1\ndat 0,0\n');await page.locator('#second').fill(';redcode\n;name Live\n;assert 1\njmp 0\n');
 await page.locator('#fast').click();await finished();assert(await page.locator('#battleResults').isVisible());
 let text=await page.locator('#scores').textContent();assert(text.includes('Dead · Lost'));assert(text.includes('Live · Won'));assert(text.includes('score'));
 assert(await page.evaluate(()=>document.querySelector('#battleResults').compareDocumentPosition(document.querySelector('.debugger')) & Node.DOCUMENT_POSITION_FOLLOWING));
 await page.locator('#first').fill(';redcode\n;name Loop\n;assert 1\njmp 0\n');await page.locator('#editSettings').click();await page.locator('#cycles').fill('10');
 await page.locator('#reset').click();await page.waitForFunction(()=>document.querySelector('#status').textContent.startsWith('Paused before'));assert(await page.locator('#battleResults').isHidden());
 await page.locator('#fast').click();await finished();text=await page.locator('#scores').textContent();assert(text.includes('Loop · Tied'));assert(text.includes('Live · Tied'));
 await page.locator('#rounds').fill('3');await page.locator('#reset').click();await page.waitForFunction(()=>document.querySelector('#status').textContent.startsWith('Paused before'));
 await page.locator('#fast').click();await finished();assert((await page.locator('#battleTotals').textContent()).includes('3 battles'));text=await page.locator('#scores').textContent();assert(text.includes('3 ties'));assert(text.includes('Tied for first'));
 assert.deepEqual(errors,[]);console.log('PASS: winner/loser, tie, series totals and rankings, results placement and reset, no Start paused.');
}finally{await browser.close();}
