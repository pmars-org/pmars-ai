import {loadTestWarriors} from './test-fixtures.mjs';
// SPDX-License-Identifier: GPL-2.0-or-later
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE?pathToFileURL(process.env.PLAYWRIGHT_MODULE).href:'playwright');
const b=await chromium.launch({headless:true,...(process.env.BROWSER_CHANNEL?{channel:process.env.BROWSER_CHANNEL}:{})});
const page=await b.newPage({viewport:{width:1280,height:1100}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
const ready=t=>page.waitForFunction(t=>document.querySelector('#status').textContent.includes(t),t);
const code=name=>';redcode\n;name '+name+'\n;assert 1\njmp 0\n';
try{
 await page.goto(process.env.PMARS_URL||'http://127.0.0.1:8765/docs/');
 await loadTestWarriors(page);
 assert(await page.locator('#first').isHidden());assert(await page.locator('#second').isHidden());
 await page.getByRole('button',{name:'Edit or collapse warrior 1',exact:true}).click();
 assert(await page.locator('#first').isVisible());assert(await page.locator('#second').isHidden());
 await page.locator('#toggleEditors').click();await page.locator('#toggleEditors').click();assert(await page.locator('#second').isVisible());
 await page.locator('#core').evaluate(c=>{
  const r=c.getBoundingClientRect();
  c.dispatchEvent(new PointerEvent('pointermove',{clientX:r.left+20,clientY:r.top+28}));
 });
 assert.equal(await page.locator('#hoverAddress').textContent(),'Cell: '+String(3*Number(await page.locator('#core').getAttribute('data-columns'))+2).padStart(4,'0'));
 await page.locator('#core').dispatchEvent('pointerleave');
 assert.equal(await page.locator('#hoverAddress').textContent(),'Cell: —');
 const layout=await page.evaluate(()=>{
  const editors=document.querySelector('#editors').getBoundingClientRect(),drop=document.querySelector('#dropZone').getBoundingClientRect(),button=document.querySelector('#newWarrior').getBoundingClientRect();
  const h=document.querySelector('header h1').getBoundingClientRect(),p=document.querySelector('header p').getBoundingClientRect();
  return {below:drop.top>=editors.bottom,sameRow:button.left>=drop.right,inline:p.left>=h.right};
 });
 assert.deepEqual(layout,{below:true,sameRow:true,inline:true});
 assert(await page.locator('#fast').isVisible());
 assert(await page.locator('#rounds').isVisible());
 assert(await page.locator('#settingsSummary').isVisible());
 assert(await page.locator('#settingsFields').isHidden());
 await page.locator('#newWarrior').click();
 assert(await page.locator('#warrior-2').isVisible(),'New warriors open for editing');
 await page.getByRole('button',{name:'Remove warrior 3',exact:true}).click();
 const compact=await page.evaluate(()=>{
  const row=document.querySelector('.editor-title').getBoundingClientRect();
  const actions=[...document.querySelectorAll('.editor-title:first-child button')].slice(0,4).map(e=>e.getBoundingClientRect());
  const toolbar=document.querySelector('.page-layout').getBoundingClientRect(),theme=document.querySelector('.arena-theme').getBoundingClientRect();
  const summary=document.querySelector('#consoleWindow summary').getBoundingClientRect(),clear=document.querySelector('#clearConsole').getBoundingClientRect();
  return {oneRow:actions.every(r=>r.top>=row.top && r.bottom<=row.bottom+1),themeRight:Math.abs(theme.right-toolbar.right)<2,clearInline:clear.top>=summary.top && clear.bottom<=summary.bottom+1};
 });
 assert.deepEqual(compact,{oneRow:true,themeRight:true,clearInline:true});
 await page.locator('#warriorFiles').setInputFiles(['Uploaded A','Uploaded B'].map(n=>({name:n+'.red',mimeType:'text/plain',buffer:Buffer.from(code(n))})));
 await page.waitForFunction(()=>document.querySelectorAll('#editors .cm-content').length===4);
 assert((await page.locator('#editors').textContent()).includes('Uploaded A'));
 const dt=await page.evaluateHandle(text=>{const d=new DataTransfer();d.items.add(new File([text],'Dropped.red',{type:'text/plain'}));return d;},code('Dropped'));
 await page.locator('#dropZone').dispatchEvent('drop',{dataTransfer:dt});
 await page.waitForFunction(()=>document.querySelectorAll('#editors .cm-content').length===5);
 const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Download warrior 5',exact:true}).click();
 const download=await downloadPromise,stream=await download.createReadStream(),chunks=[];
 for await(const chunk of stream)chunks.push(chunk);
 assert.equal(Buffer.concat(chunks).toString(),code('Dropped'));
 assert.equal(download.suggestedFilename(),'Dropped.red');
 for(let i=5;i>2;i--)await page.getByRole('button',{name:'Remove warrior '+i,exact:true}).click();
 await page.locator('#first').fill(code('One'));await page.locator('#second').fill(code('Two'));
 await page.locator('#preset').selectOption('nano');
 await page.locator('#editSettings').click();
 assert.equal(await page.locator('#coreSize').inputValue(),'80');
 assert.equal(await page.locator('#maxLength').inputValue(),'5');
 await page.locator('#rounds').fill('1001');await page.locator('#cycles').fill('2');
 // The UI yields at each round boundary; 1001 rounds span over 2000 frames.
 await page.locator('#fast').click();
 await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('Battle complete'),null,{timeout:90000});
 assert((await page.locator('#battleTotals').textContent()).includes('1,001'));
 assert((await page.locator('#diagnosticsTitle').textContent()).includes('1,001'));
 await page.locator('#consoleWindow summary').click();
 await page.waitForFunction(()=>document.querySelector('#consoleOutput').textContent.includes('scores'));
 assert((await page.locator('#consoleOutput').textContent()).includes('Program "One"'));

 await page.locator('#rounds').fill('1');await page.locator('#cycles').fill('1000');
 await page.locator('#reset').click();await ready('Paused before');
 const processImage=await page.locator('#processChart').evaluate(c=>c.toDataURL());
 await page.locator('#pauseProcesses').check();
 await page.locator('#step').click();await ready('Paused after');
 assert.equal(await page.locator('#processChart').evaluate(c=>c.toDataURL()),processImage);
 await page.locator('#pauseViews').check();
 const oldTrace=await page.locator('#execution').textContent();
 await page.locator('#step').click();await ready('Paused after');
 assert.equal(await page.locator('#execution').textContent(),oldTrace);
 await page.locator('#pauseViews').uncheck();
 await page.getByRole('button',{name:'Pause console 2',exact:true}).click();
 const firstTrace=await page.locator('#execution pre').nth(1).textContent();
 await page.locator('#step').click();await ready('Paused after');
 assert.equal(await page.locator('#execution pre').nth(1).textContent(),firstTrace);
 await page.locator('#command').fill('l0,3');await page.locator('#command').press('Enter');
 await page.waitForFunction(()=>document.querySelector('#commandOutput').textContent==='Ready.');
 assert.equal(await page.locator('#instruction .listing-line').count(),4);
 await page.locator('#theme').selectOption('accessible');
 assert.equal(await page.locator('body').getAttribute('data-theme'),'accessible');
 await page.locator('#theme').selectOption('classic');
 assert.equal(await page.locator('body').getAttribute('data-theme'),'classic');
 // Verify native per-quadrant event semantics retain the other owner's marks.
 const cells=await page.evaluate(async()=>{
  const {CoreDisplay}=await import('./display.mjs');const c=document.createElement('canvas');document.body.append(c);
  const d=new CoreDisplay(c);d.configure(80);d.apply(new Uint32Array([2,0,0,0,4,0,1,0]));
  const result=Array.from(d.cells.slice(0,4));d.observer.disconnect();c.remove();return result;
 });
 assert.deepEqual(cells,[1,2,2,1]);

 await page.locator('#assembleOnly').check();await page.locator('#reset').click();await ready('Assembly complete');
 assert((await page.locator('#status').textContent()).includes('No battles'));
 await page.setViewportSize({width:390,height:844});
 await page.waitForTimeout(100);
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Mobile overflow');
 await page.screenshot({path:'docs/test-output/features-mobile.png',fullPage:true});
 await page.setViewportSize({width:1280,height:1100});
 await page.locator('#theme').selectOption('modern');
 await page.screenshot({path:'docs/test-output/features-desktop.png',fullPage:true});
 assert.deepEqual(errors,[]);
 console.log('PASS: multi-file upload, drop, save, presets, 1001-round worker series, battle totals, native console, independent/global pause, debugger feedback, themes, quadrant retention, assemble-only, mobile.');
}catch(error){console.error('STATE',await page.locator('#status').textContent(),await page.locator('#consoleOutput').textContent());throw error;}finally{await b.close();}
