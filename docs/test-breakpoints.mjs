// SPDX-License-Identifier: GPL-2.0-or-later
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {Engine} from './engine.mjs';
import {loadTestWarriors} from './test-fixtures.mjs';
const source=';redcode\n;assert 1\njmp 0\n';
const e=await Engine.create({warriors:1,cycles:10});e.compile([source]);e.start();
e.setBreakpoint(0,true);e.setDebug(true);let u=e.advance(100,4);assert.equal(u.executed,0);assert.equal(u.debugHit,0);
u=e.advance(100,4);assert.equal(u.executed,1);assert.equal(u.debugHit,0);
e.setBreakpoint(0,false);assert.equal(e.breakpoint(0),false);u=e.advance(100,4);assert(u.done);
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE?pathToFileURL(process.env.PLAYWRIGHT_MODULE).href:'playwright');
const browser=await chromium.launch({headless:true,...(process.env.BROWSER_CHANNEL ? {channel:process.env.BROWSER_CHANNEL} : {})}),page=await browser.newPage(),errors=[];
page.on('pageerror',e=>errors.push(e.message));
const command=async text=>{await page.locator('#command').fill(text);await page.locator('#command').press('Enter');await page.waitForFunction(()=>document.querySelector('#commandOutput').textContent==='Ready.');};
try{
 await page.goto(process.env.PMARS_URL || 'http://127.0.0.1:8765/docs/');await loadTestWarriors(page);await page.locator('#toggleEditors').click();
 await page.locator('#first').fill(source.replace(';assert',';name One\n;assert'));await page.locator('#second').fill(source.replace(';assert',';name Two\n;assert'));
 await page.locator('#reset').click();
 await page.waitForFunction(()=>document.querySelector('#status').textContent.startsWith('Paused before'));
 await page.locator('#step').click();await page.locator('#step').click();await page.waitForFunction(()=>document.querySelector('#timing').dataset.instructions==='2');
 assert.equal(await page.locator('#coreViewTitle').textContent(),'Native pMARS debugger');
 assert.equal(await page.locator('.output-console').nth(1).locator('.instruction-row').count(),2);
 const colors=await page.locator('.output-console').nth(1).locator('.instruction-row').evaluateAll(es=>es.map(e=>e.style.color));assert.notEqual(colors[0],colors[1]);
 assert(!(await page.locator('#execution').textContent()).includes('#1'));
 const address=await page.locator('.output-console').nth(1).locator('.instruction-row').first().getAttribute('data-address');
 await page.locator('.output-console').nth(1).locator('.instruction-row').first().click();assert(await page.locator('#debugEnabled').isChecked());
 assert.equal(await page.locator('.output-console').nth(1).locator('.instruction-row').first().getAttribute('aria-pressed'),'true');
 await page.locator('#run').click();await page.waitForFunction(()=>document.querySelector('#status').textContent.startsWith('Debug marker:'));
 assert.equal(await page.locator('#timing').getAttribute('data-instructions'),'2');assert.equal(await page.locator('#coreViewTitle').textContent(),'Native pMARS debugger');
 await page.locator('.output-console').nth(1).locator('[data-address="'+address+'"]').first().click();assert.equal(await page.locator('.output-console').nth(1).locator('[data-address="'+address+'"]').first().getAttribute('aria-pressed'),'false');
 await page.locator('#run').click();await page.waitForFunction(()=>Number(document.querySelector('#timing').dataset.instructions)>10);
 await command('list 0,4');assert.equal(await page.locator('#coreViewTitle').textContent(),'Native pMARS debugger');assert.equal(await page.locator('#instruction .listing-line').count(),5);
 await page.locator('#step').click();assert.equal(await page.locator('#coreViewTitle').textContent(),'Native pMARS debugger');
 await page.locator('.output-console').nth(1).locator('.instruction-row').first().click();assert.equal(await page.locator('.output-console').nth(1).locator('.instruction-row').first().getAttribute('aria-pressed'),'true');
 await page.locator('#reset').click();await page.waitForFunction(()=>document.querySelector('#timing').dataset.instructions==='0');assert.equal(await page.locator('#instruction [aria-pressed=true]').count(),0);
 assert.deepEqual(errors,[]);console.log('PASS: execution colors and no numbering; clickable breakpoints in both views; stop before execution, removal, step/live/list transitions, reset; native address breakpoint API.');
}finally{await browser.close();}
