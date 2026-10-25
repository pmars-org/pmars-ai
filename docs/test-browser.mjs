import {loadTestWarriors} from './test-fixtures.mjs';
// SPDX-License-Identifier: GPL-2.0-or-later
// Serve repository root; install Playwright or set PLAYWRIGHT_MODULE to its index.mjs.
// BROWSER_CHANNEL=msedge node web/test-browser.mjs
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const {chromium} = await import(process.env.PLAYWRIGHT_MODULE
  ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright');
await mkdir(new URL('./test-output/', import.meta.url), {recursive: true});
const browser = await chromium.launch({headless: true,
  ...(process.env.BROWSER_CHANNEL ? {channel: process.env.BROWSER_CHANNEL} : {})});
const page = await browser.newPage({viewport: {width: 1280, height: 1100}});
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const ready = text => page.waitForFunction(text =>
  document.querySelector('#status').textContent.includes(text), text);
const count = async () => Number(await page.locator('#timing').getAttribute('data-instructions'));
try {
  await page.goto(process.env.PMARS_URL || 'http://127.0.0.1:8765/docs/');
 await loadTestWarriors(page);
 await page.locator('#toggleEditors').click();
  await page.locator('#step').click();
  await ready('Paused after');
  assert.equal(await count(), 1);
  await page.locator('#step').click();
  assert.equal(await count(), 2);
  await page.locator('#run').click();
  await ready('Battle running');
  await page.waitForFunction(() => Number(document.querySelector('#timing').dataset.instructions) > 50);
  await page.locator('#run').click();
  const paused = await count();
  await page.waitForTimeout(150);
  assert.equal(await count(), paused, 'Paused simulator must not advance');
  await page.locator('#reset').click(); await ready('Paused before');
  assert((await page.locator('#run').textContent()).includes('Run'));

  // Sustained maximum-speed visualization while measuring page heartbeat.
  const imp = ';redcode-94\n;assert 1\nmov.i 0,1\n';
  await page.locator('#first').fill(imp);
  await page.locator('#second').fill(imp);
  await page.locator('#editSettings').click();
  await page.locator('#cycles').fill('10000000');
  await page.locator('#speed').fill('5');
  await page.locator('#run').click();
  await ready('Battle running');
  const pulse = await page.evaluate(() => new Promise(resolve => {
    const deltas = [];
    let previous = performance.now();
    const interval = setInterval(() => {
      const now = performance.now();
      deltas.push(now - previous);
      previous = now;
      if (deltas.length >= 100) { clearInterval(interval); resolve(deltas); }
    }, 10);
  }));
  await page.locator('#run').click();
  assert(Math.max(...pulse) < 250, 'Visual simulation blocked page heartbeat');
  const timing = await page.locator('#timing').textContent();
  await page.screenshot({path: new URL('./test-output/browser-desktop.png', import.meta.url).pathname.replace(/^\/(\w:)/, '$1'), fullPage:true});
  await page.locator('#reset').click(); await ready('Paused before');

  // 100 headless matches with visible progress and scores.
  await page.locator('#cycles').fill('1000');
  await page.locator('#rounds').fill('100');
  await page.locator('#fast').click();
  await ready('Battle complete');
  assert((await page.locator('#scores').textContent()).includes('100 ties'));

  await page.locator('#reset').click(); await ready('Paused before');
  // Malformed assembly must recover; long compilation remains cancellable.
  await page.locator('#first').fill(';redcode-94\n;assert 1\ninvalid 0,0\n');
  await page.locator('#run').click();
  await ready('error');
  assert((await page.locator('#log').textContent()).length > 0);
  await page.locator('#first').fill(imp);
  await page.locator('#step').click();
  await ready('Paused after');
  assert.equal(await count(),1);
  await page.locator('#run').click();
  await page.locator('#reset').click(); await ready('Paused before');
  await ready('Paused before');
  await page.waitForTimeout(150);
  assert((await page.locator('#status').textContent()).includes('Paused before'));
  await page.locator('#step').click();
  await ready('Paused after');

  await page.setViewportSize({width:390,height:844});
  await page.waitForTimeout(100);
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Mobile horizontal overflow');
  await page.screenshot({path: new URL('./test-output/browser-mobile.png', import.meta.url).pathname.replace(/^\/(\w:)/, '$1'), fullPage:true});
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({result:'PASS', maxHeartbeatGapMs:Math.max(...pulse), timing,
    checks:['single step','pause/resume','stop','high-speed responsiveness','100-round Fast match',
      'assembly errors','restart','mobile layout','no page errors']},null,2));
} finally { await browser.close(); }
