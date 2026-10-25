// SPDX-License-Identifier: GPL-2.0-or-later
// Exercise the public entry point from another origin and a local Worker bootstrap.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {resolve, sep} from 'node:path';
const {chromium} = await import(process.env.PLAYWRIGHT_MODULE
  ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright');
const root = fileURLToPath(new URL('.', import.meta.url));
const modules = createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const pathname = new URL(req.url, 'http://localhost').pathname;
  if (pathname === '/integration-test.html') {
    res.setHeader('Content-Type', 'text/html'); res.end('<!doctype html><title>Integration test</title>'); return;
  }
  const path = resolve(root, '.' + pathname);
  if (!path.startsWith(root.endsWith(sep) ? root : root + sep)) { res.writeHead(403).end(); return; }
  try {
    res.setHeader('Content-Type', path.endsWith('.wasm') ? 'application/wasm' : 'text/javascript');
    res.end(await readFile(path));
  } catch { res.writeHead(404).end(); }
});
const listen = server => new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(`http://127.0.0.1:${server.address().port}`)));
const base = await listen(modules);
const app = createServer((req, res) => {
  if (req.url === '/bootstrap.mjs') {
    res.setHeader('Content-Type', 'text/javascript');
    res.end(`import ${JSON.stringify(base + '/worker.mjs')};`);
  } else {
    res.setHeader('Content-Type', 'text/html');res.end('<!doctype html><title>Consumer app</title>');
  }
});
let browser;
try {
  const origin = await listen(app);
  browser = await chromium.launch({headless: true, ...(process.env.BROWSER_CHANNEL ? {channel: process.env.BROWSER_CHANNEL} : {})});
  const page = await browser.newPage(), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  for (const url of [base + '/integration-test.html', origin]) {
    await page.goto(url);
    const result = await page.evaluate(async base => {
      const {Engine, settings, workerURL} = await import(base + '/pmars.mjs');
      const source = ';redcode\n;assert 1\nmov 0,1\n';
      const engine = await Engine.create({warriors:1,rounds:0}, {visual:false});
      const [bank] = engine.compile([source]);
      const worker = new Worker(location.origin === base ? workerURL : '/bootstrap.mjs', {type:'module'});
      const update = await new Promise((resolve, reject) => {
        const timer = setTimeout(() => { worker.terminate(); reject(new Error('Worker timeout')); }, 15000);
        const finish = (callback, value) => { clearTimeout(timer); worker.terminate(); callback(value); };
        worker.onerror = event => finish(reject, new Error(event.message));
        worker.onmessage = ({data}) => {
          if (data.type === 'error') finish(reject, new Error(data.message));
          if (data.type === 'done') finish(resolve, data.update);
        };
        worker.postMessage({type:'series', settings:{warriors:2,rounds:3,cycles:20}, sources:[source,source]});
      });
      return {length:bank.length, core:settings().coreSize, origin:workerURL.origin, rounds:update.completed, ties:update.warriors[0].ties};
    }, base);
    assert.deepEqual(result, {length:1,core:8000,origin:base,rounds:3,ties:3});
  }
  assert.deepEqual(errors, []);
  console.log('PASS: public API and Worker series work when self-hosted or imported across origins.');
} finally {
  if (browser) await browser.close();
  await Promise.all([modules, app].map(server => new Promise(resolve => server.close(resolve))));
}
