// SPDX-License-Identifier: GPL-2.0-or-later
import assert from 'node:assert/strict';import {pathToFileURL} from 'node:url';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE?pathToFileURL(process.env.PLAYWRIGHT_MODULE).href:'playwright');
const browser=await chromium.launch({headless:true,...(process.env.BROWSER_CHANNEL ? {channel:process.env.BROWSER_CHANNEL} : {})}),page=await browser.newPage(),errors=[];
page.on('pageerror',e=>errors.push(e.message));
const send=async text=>{await page.locator('#command').fill(text);await page.locator('#command').press('Enter');};
const idle=()=>page.waitForFunction(()=>document.querySelector('#commandOutput').textContent==='Ready.');
try{
 await page.goto(process.env.PMARS_URL || 'http://127.0.0.1:8765/docs/');await page.locator('#newWarrior').click();
 await page.locator('#first').fill(';redcode\n;assert 1\njmp 0\n');await page.locator('#reset').click();await page.waitForFunction(()=>document.querySelector('#status').textContent.startsWith('Paused before'));
 await send('calc 6*7');await idle();assert((await page.locator('#instruction').textContent()).includes('42'));
 await send('fill 10,12');await page.waitForFunction(()=>document.querySelector('#commandOutput').textContent.includes('instruction or expression'));
 await send('mov.i 0,1');await idle();await send('list 10,12');await idle();assert.equal(await page.locator('#instruction .listing-line').count(),3);assert((await page.locator('#instruction').textContent()).includes('MOV.I'));
 const earlierOutput=await page.locator('#instruction').textContent();
 await send('macro f5');await idle();assert.equal(await page.locator('#timing').getAttribute('data-instructions'),'2');
 assert((await page.locator('#instruction').textContent()).startsWith(earlierOutput.trimEnd()),'Macro cls must preserve earlier command output');
 assert.equal(await page.locator('#commandHistory button').last().textContent(),'macro f5');
 await send('step~!3');await idle();assert.equal(await page.locator('#timing').getAttribute('data-instructions'),'5');
 await send('');await idle();assert.equal(await page.locator('#timing').getAttribute('data-instructions'),'8');
 await send('trace 0~go~calc 99');await page.waitForFunction(()=>document.querySelector('#instruction').textContent.includes('\n99\n'));await idle();assert((await page.locator('#instruction').textContent()).includes('99'));
 await send('untrace 0');await idle();
 await page.evaluate(()=>{window.pulses=0;window.pulse=setInterval(()=>pulses++,10);});
 await send('calc 1~!');await page.waitForTimeout(180);assert((await page.locator('#run').textContent()).includes('Cancel'));assert(await page.evaluate(()=>pulses)>5);
 await page.locator('#run').click();await page.waitForFunction(()=>document.querySelector('#commandOutput').textContent.includes('cancelled'));
 await send('edit 15');await page.waitForFunction(()=>document.querySelector('#commandOutput').textContent.includes('instruction or expression'));
 await page.locator('#run').click();await page.waitForFunction(()=>document.querySelector('#commandOutput').textContent.includes('cancelled'));
 await send('calc 1+2');await idle();assert((await page.locator('#instruction').textContent()).includes('3'));
 await send('help');await page.waitForFunction(()=>document.querySelector('#commandOutput').textContent.includes('RET'));await send('a');await idle();
 await send('cls');await idle();await send('step');await idle();
 const firstStep=await page.locator('#instruction').textContent();
 await send('');await idle();assert((await page.locator('#instruction').textContent()).startsWith(firstStep.trimEnd()));
 assert.equal(await page.locator('#instruction .listing-line').count(),2,'Repeated steps retain prior instructions');
 await send('step~!80');await idle();assert.equal(await page.locator('#instruction .listing-line').count(),82);
 assert(await page.locator('#instruction').evaluate(el=>el.scrollHeight>el.clientHeight && Math.abs(el.scrollHeight-el.clientHeight-el.scrollTop)<2),'History scrolls to the latest instruction');
 await send('cls');await idle();assert.equal(await page.locator('#instruction .listing-line').count(),0);
 assert.deepEqual(errors,[]);console.log('PASS: native UI expressions, interactive fill, real f5, repeat loops/Enter, go-chain breakpoint continuation, responsive infinite loop cancellation, prompt cancellation, and paged help.');
}finally{await browser.close();}
