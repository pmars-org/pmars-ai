// SPDX-License-Identifier: GPL-2.0-or-later
// Expected simulation parameters transcribed from the supplied koth.org table.
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE?pathToFileURL(process.env.PLAYWRIGHT_MODULE).href:'playwright');
const browser=await chromium.launch({headless:true,...(process.env.BROWSER_CHANNEL ? {channel:process.env.BROWSER_CHANNEL} : {})}),page=await browser.newPage();
const cases={
 '88':[8000,80000,8000,100,100,true,false],
 '94':[8000,80000,8000,100,100,false,false],
 '94nop':[8000,80000,8000,100,100,false,true],
 '94x':[55440,500000,10000,200,200,false,false],
 '94m':[8000,80000,8000,100,100,false,false],
 'icws':[8192,100000,8000,300,300,true,false]
};
try{
 await page.goto(process.env.PMARS_URL || 'http://127.0.0.1:8765/docs/');await page.locator('#editSettings').click();
 for(const [id,expected] of Object.entries(cases)){
  await page.locator('#fixedSeries').check();
  await page.locator('#preset').selectOption(id);
  const values=await page.evaluate(()=>['coreSize','cycles','tasks','maxLength','distance','rules88','noPspace'].map(id=>{const e=document.getElementById(id);return e.type==='checkbox'?e.checked:Number(e.value);}));
  assert.deepEqual(values,expected,id);assert.equal(await page.locator('#fixedSeries').isChecked(),false);
 }
 // Explicit hill distance must survive a later edit to maximum warrior length.
 await page.locator('#preset').selectOption('94nop');await page.locator('#maxLength').fill('50');
 assert.equal(await page.locator('#distance').inputValue(),'100');
 console.log('PASS: all seven KotH hills (six distinct presets) match supplied table, -f stays off, explicit distance survives length edits.');
}finally{await browser.close();}
