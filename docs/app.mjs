import {bundledWarriors} from './demo-warriors.mjs?v=22ede45f08e7cbab';
import {createEditor} from './dist/editor.mjs?v=22ede45f08e7cbab';
// SPDX-License-Identifier: GPL-2.0-or-later
import {Engine, settings} from './engine.mjs?v=22ede45f08e7cbab';
import {CoreDisplay, warriorColor, setTheme} from './display.mjs?v=22ede45f08e7cbab';
import {readSettings,setupSettings} from './settings-ui.mjs?v=22ede45f08e7cbab';
import {HistoryChart} from './charts.mjs?v=22ede45f08e7cbab';
const $ = id => document.getElementById(id);
const display = new CoreDisplay($('core'));
let engine = null, worker = null, workerTimer = null, generation = 0;
let state = 'idle', animation = 0, previous = 0, credit = 0, total = 0;
let fastMode = false;
let coreView = 'native', inspectionAddress = 0;
const consoles=[];let consoleSerial=0;const commandHistory=[];
let nativeBusy=false,nativeResume=false,nativeOutput='',nativeInput=null,nativeCancelled=false;
let maxSlice = 0, pendingReject = null, latest = null, history = [], combined = [];
let lastText = 0, dirty = false, stepping = false, stepEpoch = 0;
let collapsedEditors=[], wideEditors=[], scoreViewKey=null;
let sourceEditors=[], compileIssues=[];
const demoSources = [";redcode-94\n;name Imp\n;author A. K. Dewdney\n;assert 1\nmov.i 0, 1\nend\n", ";redcode-94\n;name Dwarf\n;author A. K. Dewdney\n;assert 1\nadd.ab #4, bomb\nmov.i bomb, @bomb\njmp -2\nbomb dat.f #0, #0\nend\n"];
let sources = [];
let excludedWarriors = [];
const selectedIndices = () => sources.map((_,i)=>i).filter(i=>!excludedWarriors[i]);
function rosterCount() {
 const selected=selectedIndices().length;
 $('warriorCount').textContent=`${sources.length} warrior${sources.length===1?'':'s'}`+(selected===sources.length?'':` · ${selected} selected`);
}
let consoleText='',sessionBattles=0,countedCompleted=0,lastScoreSample=-1;
let compileStates=[], compileWorker=null, compileTimer=null, revision=0, chartRound=0;
let validationTimer=null, validationQueue=[];
function cancelAutoValidation(){clearTimeout(validationTimer);validationQueue=[];}
function nextValidation(){
 const index=validationQueue.shift();
 if(index!==undefined)checkWarrior(index,true);
}
function scheduleValidation(){
 cancelAutoValidation();
 validationTimer=setTimeout(()=>{validationQueue=sources.map((_,i)=>i);nextValidation();},1000);
}
function showConsole() {
 $('consoleWindow').open=true;
 $('consoleOutput').textContent=consoleText || 'Validate a warrior or run a battle to see assembly output here.';
}
function refreshCompileButtons() {
 document.querySelectorAll('.compile-warrior').forEach((button,i)=>{
  const result=compileStates[i] || '';
  button.textContent='↻ '+(result==='busy'?'Validating…':result==='ok'?'Valid ✓':result==='failed'?'Invalid — retry':'Validate');
  button.dataset.result=result;button.disabled=result==='busy';
 });
}
function cancelCompileCheck() {
 if(compileWorker)compileWorker.terminate();
 compileWorker=null;clearTimeout(compileTimer);
 compileStates=compileStates.map(s=>s==='busy'?'':s);
 refreshCompileButtons();
}
function checkWarrior(index,automatic=false) {
 compileIssues=compileIssues.filter(issue=>issue.index!==index);refreshDiagnostics();
 if(!automatic)cancelAutoValidation();
 cancelCompileCheck();if(!automatic)showConsole();
 let config;
 try {config={...readSettings({warriors:sources.length}),brief:automatic,assembleOnly:true};}
 catch(error){compileStates[index]='failed';refreshCompileButtons();log(error.message);if(automatic)nextValidation();return;}
 const ticket=revision;
 if(!automatic)log('Compiling '+draftName(sources[index],index)+'…','stdout');
 compileStates[index]='busy';refreshCompileButtons();
 const w=compileWorker=new Worker(new URL('./worker.mjs?v=22ede45f08e7cbab',import.meta.url),{type:'module'});
 const finish=(ok,message)=>{
  if(compileWorker!==w)return;
  w.terminate();compileWorker=null;clearTimeout(compileTimer);
  if(ticket!==revision)return;
  compileStates[index]=ok?'ok':'failed';refreshCompileButtons();
  log(message,ok?'stdout':'stderr');if(!automatic)showConsole();
  if(automatic)nextValidation();
 };
 compileTimer=setTimeout(()=>finish(false,'Compilation timed out after 15 seconds.'),15000);
 w.onerror=e=>finish(false,e.message || 'Compiler worker failed.');
 w.onmessage=({data})=>{
  if(compileWorker!==w || ticket!==revision)return;
  if(data.type==='log')log(data.text,data.channel,data.index);
  else if(data.type==='error')finish(false,'Compilation failed: '+data.message);
  else if(data.type==='compiled')finish(true,'Compilation succeeded: '+draftName(sources[index],index));
 };
 w.postMessage({type:'check',index,settings:config,sources:[...sources]});
}
const processChart=new HistoryChart($('processChart'),'Processes / cycle in current round');
const scoreChart=new HistoryChart($('scoreChart'),'Cumulative score / completed battles');
const addressText = n => String(n).padStart(String((engine?.config.coreSize || 8000) - 1).length, '0');
function status(text) {
  $('status').textContent = text;
}
function log(text,channel='stderr',index=null) {
 if(Number.isInteger(index)){
  for(const match of text.matchAll(/(Error|Warning) in line (\d+):[^\n]*(?:\n[ \t]+[^\n]*)?/g))compileIssues.push({index,line:Number(match[2]),severity:match[1].toLowerCase(),message:match[0]});
  compileIssues=compileIssues.slice(-100);refreshDiagnostics();
 }
 if(nativeBusy)appendNativeOutput(text+'\n');
 consoleText=(consoleText+text+'\n').slice(-262144);
 if($('consoleWindow').open)$('consoleOutput').textContent=consoleText;
 if(channel==='stderr')$('log').textContent=($('log').textContent+text+'\n').slice(-65536);
}
function draftName(source, i) {
  return source.match(/^\s*;name\s+([^\r\n]*)/im)?.[1].trim() || `Warrior ${i + 1}`;
}
function markDirty() {
 compileIssues=[];refreshDiagnostics();
  revision++;cancelCompileCheck();compileStates=[];refreshCompileButtons();scheduleValidation();
  dirty = !!engine || state === 'loading';
  $('changed').textContent = dirty ? 'Sources, selection or settings changed. Run applies them before instruction 1; otherwise Reset applies them and Resume keeps the loaded battle.' : '';
}
function legend() {
  const names = engine && latest ? latest.warriors.map(w => w.name) : sources.map(draftName);
  $('legendNames').replaceChildren(...names.map((name,i) => {
    const span = document.createElement('span');
    span.style.color = warriorColor(i);
    const swatch=document.createElement('span');swatch.className='warrior-swatch';
    const eliminated=document.createElement('span');eliminated.className='eliminated-marker';eliminated.dataset.eliminated=i;
    swatch.append(eliminated);span.append(swatch,` ${name} `);
    const count=document.createElement('span');count.className='process-count';count.dataset.process=i;count.textContent=latest?.warriors[i]?.tasks.toLocaleString()??'—';count.title='Processes';count.setAttribute('aria-label','Processes for '+name);span.append(count);
    return span;
  }));
  if(latest)processIndicators(latest);
}
function editors() {
 sourceEditors.forEach(e=>e.destroy());sourceEditors=[];
  $('editors').replaceChildren(...sources.map((source, i) => {
    const box = document.createElement('div'), top = document.createElement('div');
    top.className = 'editor-title';
    const label = document.createElement('label');
    label.htmlFor = i === 0 ? 'first' : i === 1 ? 'second' : `warrior-${i}`;
    label.className = 'warrior'; label.style.color = warriorColor(i);
    label.textContent = `${String(i+1).padStart(2,'0')} / ${draftName(source,i)}`;
    const remove = document.createElement('button');
    remove.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7"/></svg>';remove.title='Remove warrior'; remove.className = 'remove-warrior';
    remove.setAttribute('aria-label', `Remove warrior ${i+1}`);
    remove.onclick = () => { if(nativeBusy)return; sources.splice(i,1);excludedWarriors.splice(i,1);collapsedEditors.splice(i,1);wideEditors.splice(i,1); markDirty(); if(!sources.length)clearBattle(); editors(); };
    const save=document.createElement('button');save.textContent='Download';save.className='save-warrior';save.setAttribute('aria-label','Download warrior '+(i+1));save.onclick=()=>saveWarrior(i);
    const compile=document.createElement('button');compile.className='compile-warrior';
    compile.title='Revalidate warrior and show assembly output';compile.setAttribute('aria-label','Validate warrior '+(i+1));compile.onclick=()=>checkWarrior(i);
    const edit=document.createElement('button');edit.className='edit-warrior';
    edit.setAttribute('aria-controls',label.htmlFor);edit.setAttribute('aria-label','Edit or collapse warrior '+(i+1));
    edit.onclick=()=>{collapsedEditors[i]=collapsedEditors[i]===false;editorVisibility();if(!collapsedEditors[i])sourceEditors[i].focus();};
    const pencil=document.createElement('button');pencil.className='edit-source';pencil.title='Edit warrior';pencil.setAttribute('aria-label','Edit warrior '+(i+1));
    pencil.innerHTML='<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m15 4 5 5M4 20l5-1L21 7a2 2 0 0 0-5-5L4 15z"/></svg>';
    pencil.onclick=edit.onclick;pencil.setAttribute('aria-controls',label.htmlFor);
    const nameGroup=document.createElement('div');nameGroup.className='warrior-name-group';nameGroup.append(label,pencil);
    const widen=document.createElement('button');widen.className='widen-editor';widen.textContent='↔';
    widen.onclick=()=>{wideEditors[i]=!wideEditors[i];editorVisibility();sourceEditors[i].view.requestMeasure();};
    const include=document.createElement('input');include.type='checkbox';include.className='include-warrior';
    include.checked=!excludedWarriors[i];include.title='Include in next run';include.setAttribute('aria-label','Include warrior '+(i+1)+' in next run');
    include.onchange=()=>{excludedWarriors[i]=!include.checked;markDirty();rosterCount();controls();};
    top.append(include,edit,nameGroup,widen,compile,save,remove);
    const area=document.createElement('div');area.className='source-editor';
    const editor=createEditor(area,{theme:$('editorTheme').value,syntax:$('editorSyntax').value,value:source,id:label.htmlFor,label:`Warrior ${i+1} source`,onChange:value=>{
      sources[i]=value;
      label.textContent=`${String(i+1).padStart(2,'0')} / ${draftName(value,i)}`;
      legend();markDirty();
    }});sourceEditors.push(editor);
    box.append(top,area); return box;
  }));
  editorVisibility();refreshCompileButtons();
  rosterCount();
  $('newWarrior').disabled = sources.length >= 36;
  $('demos').hidden = sources.length !== 0;
  $('toggleEditors').hidden = sources.length === 0;
  controls();
  legend();
}
function editorVisibility(){
 document.querySelectorAll('#editors .source-editor').forEach((area,i)=>{
  area.hidden=collapsedEditors[i]!==false;
  const button=document.querySelectorAll('.edit-warrior')[i];
  button.textContent=area.hidden?'▸':'▾';
  button.title=area.hidden?'Edit warrior':'Collapse editor';
  button.setAttribute('aria-expanded',String(!area.hidden));
  const pencil=area.parentElement.querySelector('.edit-source');pencil.title=button.title;pencil.setAttribute('aria-expanded',String(!area.hidden));
  const widen=area.parentElement.querySelector('.widen-editor');widen.hidden=area.hidden;
  widen.title=wideEditors[i]?'Restore editor width':'Widen editor';widen.setAttribute('aria-label',widen.title+' '+(i+1));widen.setAttribute('aria-pressed',String(!!wideEditors[i]));
  area.parentElement.classList.toggle('wide-editor',!!wideEditors[i]&&!area.hidden);
 });
 const allClosed=sources.every((_,i)=>collapsedEditors[i]!==false);
 $('toggleEditors').textContent=allClosed?'▸ Expand all':'▾ Collapse all';
 $('toggleEditors').setAttribute('aria-expanded',String(!allClosed));
}
$('toggleEditors').onclick=()=>{
 const collapse=!sources.every((_,i)=>collapsedEditors[i]!==false);
 collapsedEditors=sources.map(()=>collapse);editorVisibility();
};
function processIndicators(update){
 update.warriors.forEach((w,i)=>{
  const marker=$('legendNames').querySelector('[data-eliminated="'+i+'"]');
  const eliminated=!!engine?.started && w.tasks===0;
  if(marker && marker.dataset.state!==String(eliminated)){
   marker.dataset.state=String(eliminated);marker.textContent=eliminated?'×':'';
   marker.title=eliminated?'Eliminated (no processes)':'';
   marker.setAttribute('aria-label',eliminated?w.name+' eliminated':'');
  }
 });
 if(fastMode || $('pauseViews').checked || $('pauseProcesses').checked)return;
 update.warriors.forEach((w,i)=>{
  const counter=$('legendNames').querySelector('[data-process="'+i+'"]');
  if(counter){const text=w.tasks.toLocaleString();if(counter.textContent!==text)counter.textContent=text;counter.title=w.tasks+' processes';}
 });
}
function refreshDiagnostics(){
 sourceEditors.forEach((editor,index)=>editor.diagnostics(compileIssues.filter(issue=>issue.index===index)));
 $('sourceDiagnostics').replaceChildren(...compileIssues.map(issue=>{
  const button=document.createElement('button');button.type='button';button.className='source-diagnostic';
  button.textContent=draftName(sources[issue.index]||'',issue.index)+' · line '+issue.line+' · '+issue.message;
  button.onclick=()=>{collapsedEditors[issue.index]=false;editorVisibility();sourceEditors[issue.index]?.jump(issue.line);document.querySelectorAll('.source-editor')[issue.index]?.scrollIntoView({block:'center'});};return button;
 }));
}
function seriesActive() { return state.startsWith("series"); }
function controls() {
  const noSelection = selectedIndices().length === 0;
  const empty = noSelection && (!engine || (total===0 && dirty));
  const busy = nativeBusy || state === 'loading' || seriesActive() || stepping;
  $('run').disabled = !nativeBusy && (empty || (busy && !['series','series-paused'].includes(state)) || state==='done');
  const running=['running','series'].includes(state), done=state==='done';
  $('run').innerHTML='<span class="control-icon" aria-hidden="true">'+(nativeBusy?'■':running?'Ⅱ':done?'✓':'▶')+'</span> '+(nativeBusy?'Cancel':running?'Pause':done?'Done':'Run');
  $('debugRun').disabled=empty || busy || state==='done';
  $('fast').disabled=empty || busy || state==='done';
  $('step').disabled = empty || busy || state === 'running' || state === 'done';
  $('reset').disabled = nativeBusy || noSelection || state === 'loading';
  document.querySelectorAll('.remove-warrior,.include-warrior').forEach(b=>b.disabled=nativeBusy);
}
function stop() {
  nativeResume=false;nativeOutput='';engine?.setDebugEvents(false);
  setFast(false);
  cancelAutoValidation();cancelCompileCheck();
  generation++; stepEpoch++; stepping = false; cancelAnimationFrame(animation);
  if (worker) worker.terminate();
  worker = null; clearTimeout(workerTimer);
  if (pendingReject) pendingReject(new DOMException('Stopped', 'AbortError'));
  pendingReject = null; engine = null; latest = null;
  history = []; combined = []; coreView='native'; renderTrace(); countedCompleted=0;lastScoreSample=-1;
  processChart.clear();scoreChart.clear();
  state = 'idle'; $('battleResults').hidden=true; dirty = false; $('changed').textContent = ''; $('activeSettings').textContent = ''; legend();
  $('progress').hidden = true; status('Stopped. Ready for another battle.'); controls();
}
function clearBattle() {
  stop();display.configure(display.size);clearHover();
  $('timing').textContent='Cycle —';$('timing').dataset.instructions='0';
  $('scores').textContent='Add warriors or try the demo.';
  for(const panel of consoles)panel.output.textContent='Load a battle to inspect its core.';$('coreViewTitle').textContent='Core listing';


  $('battleTotals').textContent='Warriors · 0 battles this run';
  status('No warriors loaded. Add a warrior, upload files, or try Demo.');
}
function options() { return readSettings({warriors:selectedIndices().length}); }
function work(type, config) {
 const indices=selectedIndices();
 compileIssues=[];refreshDiagnostics();
  cancelAutoValidation();cancelCompileCheck();
  compileStates=sources.map(()=> '');refreshCompileButtons();
  const ticket=revision;
  const assemblyStatus=(index,ok)=>{
    if(ticket!==revision || !Number.isInteger(index))return;
    compileStates[indices[index]]=ok?'ok':'failed';refreshCompileButtons();
  };
  return new Promise((resolve, reject) => {
    pendingReject = reject;
    const w = worker = new Worker(new URL('./worker.mjs?v=22ede45f08e7cbab', import.meta.url), {type:'module'});
    const finish = (error, value) => {
      clearTimeout(workerTimer); w.terminate();
      if (worker === w) worker = null;
      pendingReject = null; error ? reject(error) : resolve(value);
    };
    workerTimer = setTimeout(() => finish(new Error('Assembly timed out after 15 seconds.')),15000);
    w.onerror = event => finish(new Error(event.message || 'Worker failed to load.'));
    w.onmessage = ({data}) => {
      if(worker!==w)return;
      if (data.type === 'log') log(data.text,data.channel,Number.isInteger(data.index)?indices[data.index]:null);
      else if (data.type === 'assembly') assemblyStatus(data.index,data.ok);
      else if (data.type === 'error') {assemblyStatus(data.index,false);showConsole();finish(new Error(data.message));}
      else if (data.type === 'compiled') finish(null,data.banks);
      else if (data.type === 'paused') {
        clearTimeout(workerTimer);state='series-paused';
        $('progress').value=data.update.completed;latest=data.update;scores(data.update);sampleScores(data.update);
        status('Series paused at '+data.update.completed+' completed rounds. Resume series to continue.');controls();
      } else if (data.type === 'progress') {
        clearTimeout(workerTimer);
        $('progress').value = data.update.completed;
        status(`Series: ${data.update.completed} / ${config.rounds} rounds completed.`);
        latest=data.update;scores(data.update); sampleScores(data.update);
      } else if (data.type === 'done') finish(null,data.update);
    };
    w.postMessage({type, settings:config, sources:indices.map(i=>sources[i])});
  });
}
function scores(update) {
  processIndicators(update);
  $('battleResults').hidden=update.completed===0;
  const best=Math.max(...update.warriors.map(w=>w.score));
  const shared=update.warriors.filter(w=>w.score===best).length>1;
  const order=update.warriors.map((w,i)=>({w,i}));
  if($('sort').checked)order.sort((a,b)=>b.w.score-a.w.score);
  const key=JSON.stringify([update.completed,update.done,order.map(({w,i})=>[w.name,w.wins,w.ties,w.losses,w.score,warriorColor(i)])]);
  if(key===scoreViewKey)return;
  scoreViewKey=key;
  $('scores').replaceChildren(...order.map(({w,i}) => {
    const row = document.createElement('div'); row.className = 'score'; row.style.color = warriorColor(i);
    const outcome = update.warriors.length === 1
      ? `${w.wins} survived / ${w.losses} terminated · score ${w.score}`
      : `${w.wins} wins / ${w.ties} ties / ${w.losses} losses · score ${w.score}`;
    const result=update.warriors.length===1 ? (update.completed===1?(w.losses?'Terminated':'Survived'):'')
      :update.completed===1 ? (w.wins?'Won':w.ties?'Tied':'Lost')
      :update.done ? (w.score===best?(shared?'Tied for first':'Won series'):'Lost series') : '';
    row.textContent = `${w.name}${result?' · '+result:''} · ${outcome}`;
    return row;
  }));
}
function wrap(n) { const size = engine?.config.coreSize || 8000; return ((n % size) + size) % size; }
function lineCount() { return 10; }
function instructionRow(address, instruction, owner = null, suffix = '', listing = false) {
  const row=document.createElement('button');row.type='button';
  row.className='instruction-row'+(listing?' listing-line':'');row.dataset.address=String(address);
  const active=engine?.breakpoint(address) || false;
  row.setAttribute('aria-pressed',String(active));
  row.title=(active?'Remove':'Set')+' breakpoint at '+addressText(address)+' (click pauses execution)';
  row.setAttribute('aria-label',row.title);
  if(owner!==null)row.style.color=warriorColor(owner);
  row.textContent=addressText(address)+'  '+instruction+suffix+'\n';
  row.onclick=()=>{
    if(nativeBusy || !engine?.started)return;
    const host=row.closest('.console-output');
    pause();
    const enabled=!engine.breakpoint(address);engine.setBreakpoint(address,enabled);
    if(enabled){$('debugEnabled').checked=true;engine.setDebug(true);}
    textViews();
    host?.querySelector('[data-address="'+address+'"]')?.focus({preventScroll:true});
  };
  return row;
}
function traceRow(entry) {
  return instructionRow(entry.address,entry.instruction,entry.warrior,'  · '+latest.warriors[entry.warrior].name);
}
function renderListing(host) {
  if(!host){for(const panel of consoles.filter(p=>p.select.value==='cdb'))renderListing(panel.output);return;}
  if (!engine) {host.textContent='Load a battle to inspect its core.';return;}
  const start = inspectionAddress;
  host.replaceChildren(...Array.from({length:lineCount()},(_,i) => {
    const addr=wrap(start+i),owners=latest.warriors.flatMap((w,j)=>w.pc===addr?[j]:[]);
    return instructionRow(addr,engine.inspect(addr),owners[0]??null,
      owners.length?'  ← next: '+owners.map(j=>latest.warriors[j].name).join(', '):'',true);
  }));
}
function inspect() {if(nativeBusy)return;ensureCdbConsole();coreView='inspect';$('coreViewTitle').textContent='Core listing';syncTrace();renderListing();}
function renderCoreView() {
  // Only explicit inspection or cdb commands change this console's contents.
  if(coreView==='native')renderNativeOutput();
}
function showAddress(n) { inspectionAddress=wrap(n); inspect();renderCoreView(); }
function consoleOptions(panel) {
  const selected=panel.select.value || 'cdb';
  const names=latest?.warriors.map(w=>w.name) || sources.map((source,i)=>draftName(source,i));
  panel.select.replaceChildren(new Option('cdb','cdb'),new Option('All warriors','all'),...names.map((name,i)=>new Option(name,'warrior:'+i)));
  panel.select.value=[...panel.select.options].some(o=>o.value===selected)?selected:'cdb';
}
function addConsole(kind='cdb') {
  const id=++consoleSerial,panel={paused:false};
  panel.element=document.createElement('section');panel.element.className='output-console';
  const header=document.createElement('div');header.className='console-toolbar';
  panel.select=document.createElement('select');panel.select.setAttribute('aria-label','Console '+id+' content');
  const pauseButton=document.createElement('button');pauseButton.textContent='Ⅱ';pauseButton.title='Pause console';pauseButton.setAttribute('aria-label','Pause console '+id);pauseButton.setAttribute('aria-pressed','false');
  pauseButton.onclick=()=>{panel.paused=!panel.paused;pauseButton.setAttribute('aria-pressed',String(panel.paused));syncTrace();renderCoreView();renderTrace();};
  const close=document.createElement('button');close.textContent='×';close.setAttribute('aria-label','Remove console '+id);
  close.onclick=()=>{consoles.splice(consoles.indexOf(panel),1);panel.element.remove();syncTrace();};
  panel.output=document.createElement('pre');panel.output.className='console-output';panel.output.setAttribute('aria-label','Console '+id+' output');
  if(id===1)panel.output.id='instruction';
  header.append(panel.select,pauseButton,close);panel.element.append(header,panel.output);consoles.push(panel);$('execution').insertBefore(panel.element,$('addConsole'));
  consoleOptions(panel);panel.select.value=kind;
  panel.select.onchange=()=>{syncTrace();renderCoreView();renderTrace();};
  syncTrace();renderCoreView();renderTrace();return panel;
}
function ensureCdbConsole(){if(!consoles.some(p=>p.select.value==='cdb'))addConsole('cdb');}
function renderTrace() {
  if(nativeBusy || fastMode || $('pauseViews').checked)return;
  for(const panel of consoles){
    if(panel.paused || panel.select.value==='cdb')continue;
    if(!latest){panel.output.textContent='Load a battle to watch executed instructions.';continue;}
    const index=Number(panel.select.value.split(':')[1]);
    const entries=panel.select.value==='all'?combined:(history[index]||[]);
    panel.output.replaceChildren(...entries.map(e=>panel.select.value==='all'?traceRow(e):instructionRow(e.address,e.instruction,e.warrior)));
    panel.output.scrollTop=panel.output.scrollHeight;
  }
}
function textViews() {
  if(nativeBusy){renderNativeOutput();return;}
  if(latest){scores(latest);renderCoreView();}
  renderTrace();lastText=performance.now();
}
function present(update) {
  latest = update; display.apply(update.events,!fastMode);
  $('activeSettings').textContent = 'Loaded cycle limit: ' + engine.config.cycles.toLocaleString() +
    ' per warrior per round · ' + engine.config.warriors + ' warriors';
  for (const entry of update.trace) {
    if($('pauseViews').checked)continue;
    (history[entry.warrior] ||= []).push(entry);
    if (history[entry.warrior].length > 100) history[entry.warrior].shift();
    combined.push(entry);
  }
  if (combined.length > 300) combined.splice(0,combined.length-300);
  total += update.executed;
  $('timing').dataset.instructions=String(total);

  if(!fastMode)sampleScores(update);
  $('timing').textContent = `Cycle ${update.cycle.toLocaleString()} / ${engine.config.cycles.toLocaleString()} · round ${update.round}`;
  if($('diagnostics').open && !fastMode)$('sliceTiming').textContent='Peak simulation slice: '+maxSlice.toFixed(1)+' ms';
  if(update.debugHit>=0){if(nativeResume){nativeResume=false;setTimeout(()=>nativeCommand(undefined).catch(e=>log(e.message)),0);}pause();status('Debug marker: '+update.warriors[update.debugHit].name+' at '+addressText(update.warriors[update.debugHit].pc)+'. Paused before execution.');}
  if(update.debugEvent && nativeResume){nativeResume=false;pause();setTimeout(()=>nativeCommand(undefined).catch(e=>log(e.message)),0);}
  if (update.done) { setFast(false);sampleScores(update);state = 'done'; status('Battle complete. Inspect the core; Reset starts again.'); controls(); }
  if (!fastMode && (state !== 'running' || performance.now()-lastText >= 100)) {
    if(!$('pauseViews').checked && !$('pauseProcesses').checked){
      if(chartRound!==update.round){processChart.clear();chartRound=update.round;}
      processChart.add(update.cycle,update.warriors.map(w=>w.tasks));
    }
    textViews();
  }
}
async function load() {
  if(!selectedIndices().length){status('Select at least one warrior for the next run.');return false;}
  stop(); const token = generation;
  state = 'loading'; controls(); $('log').textContent = ''; consoleText='';$('consoleOutput').textContent='';
  status('Assembling warriors in a background worker…');
  const config = options(), banks = await work('compile',config);
  if (token !== generation) return false;
  const next = await Engine.create(config,{log});
  if (token !== generation) return false;
  next.import(banks);
  // Reserve the widest counter for this match so digit changes cannot reflow the toolbar.
  $('timing').style.width = (('Cycle '+config.cycles.toLocaleString()+' / '+config.cycles.toLocaleString()+' · round '+next.config.rounds.toLocaleString()).length)+'ch';
  engine = next; total = 0; maxSlice = 0; credit = 0; history = []; combined = [];
  display.configure(config.coreSize);clearHover(); inspectionAddress=0;
  traceControls(banks.map(b=>b.name));engine.setDebug($('debugEnabled').checked);
  const initial=engine.start();present(initial);legend();
  if(initial.done){state='done';status('Assembly complete. No battles run.');controls();return false;}
  state = 'paused'; controls();
  status('Paused before instruction 1. Step or Run battle.');
  return true;
}
function pause() {
  if(nativeBusy){nativeCancelled=true;engine?.cancelDebugger();if(nativeInput){nativeInput(null);nativeInput=null;}return;}
  if(state==='series'){state='series-pausing';worker?.postMessage({type:'pause'});status('Pausing series…');controls();return;}
  if (state !== 'running') return;
  cancelAnimationFrame(animation);setFast(false); state = 'paused'; status('Paused. Step or Resume battle.'); controls(); textViews();
}
function frame(now) {
  if (state !== 'running') return;
  if (document.hidden) { previous = now; animation = requestAnimationFrame(frame); return; }
  const unthrottled = fastMode || Number($('speed').value) > 5;
  const rate = Math.round(10 ** Math.min(5,Number($('speed').value)));
  credit = Math.min(credit + Math.min(now-previous,50)*rate/1000,rate/20+1); previous = now;
  if (unthrottled || credit >= 1) {
    const before = performance.now();
    const update = engine.advance(unthrottled?100000:Math.min(100000,Math.floor(credit)),4);
    maxSlice = Math.max(maxSlice,performance.now()-before);
    if(!unthrottled)credit -= update.executed; present(update);
  }
  if (state === 'running') animation = requestAnimationFrame(frame);
}
function resume() {
  if (!engine || state === 'done') return;
  stepEpoch++; stepping = false;
  syncTrace();
  state = 'running'; previous = performance.now(); controls();
  status('Battle running. Click the core to pause and list instructions.');
  animation = requestAnimationFrame(frame);
}
function safe(action) {
  return async () => {
    try { await action(); }
    catch (error) {
      if (error.name === 'AbortError') return;
      stop(); state = 'error'; controls(); log(error.message); showConsole(); status(error.message);
    }
  };
}
async function step(n = 1) {
  if (stepping || state === 'loading' || seriesActive()) return;
  pause();
  if (!engine && !(await load())) return;
  if (state === 'done') return;
  const token = generation, ticket = ++stepEpoch;
  syncTrace();
  stepping = true;engine.setDebug(false);controls();
  try {
    while (n > 0 && state === 'paused' && token === generation && ticket === stepEpoch) {
      const update = engine.advance(Math.min(n,100000),4);
      n -= update.executed; present(update);
      if (n > 0) await new Promise(resolve => setTimeout(resolve,0));
    }
    if (state === 'paused' && token === generation && ticket === stepEpoch)
      status('Paused after stepping. Step or Resume battle.');
  } finally {
    if (ticket === stepEpoch) {engine?.setDebug($('debugEnabled').checked);stepping = false; controls(); }
  }
}
async function run() {
  if(nativeBusy){pause();return;}
  if(state==='running' || state==='series'){pause();return;}
  if(state==='series-paused'){state='series';worker?.postMessage({type:'resume'});status('Resuming series…');controls();return;}
  if (engine) {
    if (state === 'paused') {
      // Before instruction one, Run applies edits made since Reset/loading.
      // After execution begins, resuming preserves that match's settings.
      if (total === 0 && dirty && !(await load())) return;
      resume();
    }
    return;
  }
  if (await load()) resume();
}
function appendNativeOutput(text) {
  if(text==='(cdb) ')return;
  if(text.includes('\x1b['))text=text.replace(/\x1b\[[0-9;]*[A-Za-z]/g,'');
  nativeOutput=(nativeOutput+text).slice(-65536);
}
function renderNativeOutput(host) {
  if(!host){for(const panel of consoles.filter(p=>p.select.value==='cdb' && !p.paused))renderNativeOutput(panel.output);return;}
  $('coreViewTitle').textContent='Native pMARS debugger';
  if(nativeBusy)host.textContent=nativeOutput;
  else host.replaceChildren(...nativeOutput.split('\n').map(line=>{
    const match=line.match(/^(\d{5})\s+(.*)$/);
    if(match){
      const address=Number(match[1]);
      const owner=latest?.warriors.findIndex(w=>w.pc===address)??-1;
      return instructionRow(address,match[2],owner>=0?owner:null,'',true);
    }
    return document.createTextNode(line+'\n');
  }));
  host.scrollTop=host.scrollHeight;
}
async function nativeCommand(text) {
  if(nativeBusy){
    if(nativeInput){const resolve=nativeInput;nativeInput=null;resolve(text);return;}
    return 'Debugger busy. Use Cancel to interrupt the command.';
  }
  pause();nativeResume=false;
  if(!engine && !(await load()))return;
  const instance=engine;instance.setDebugEvents(false);
  if(typeof text==='string' && text.trim().toLowerCase()==='cls')nativeOutput='';
  if(nativeOutput && !nativeOutput.endsWith('\n'))appendNativeOutput('\n');
  ensureCdbConsole();
  nativeBusy=true;nativeCancelled=false;coreView='native';$('commandOutput').textContent='Working…';controls();
  const timer=setInterval(renderNativeOutput,100);
  const io={output:appendNativeOutput,command:recordCommand,input:prompt=>{
    if(nativeCancelled)return Promise.resolve(null);
    $('commandOutput').textContent=prompt || 'Enter the requested instruction or expression.';
    $('command').focus();renderNativeOutput();
    return new Promise(resolve=>{nativeInput=resolve;});
  }};
  try{
    let next=text;
    while(!nativeCancelled && engine===instance){
      const result=await instance.debuggerCommand(next,io);next=undefined;
      if(result.cancelled || nativeCancelled)break;
      if(state==='done' && result.action!==3){appendNativeOutput('Battle complete. Reset to execute again.\n');break;}
      if(result.action===2){
        let remaining=result.steps;instance.setDebug(false);
        while(remaining>0 && !nativeCancelled){
          const update=instance.advance(Math.min(100000,remaining),4);remaining-=update.executed;present(update);
          if(update.done){remaining=0;break;}
          await new Promise(resolve=>setTimeout(resolve,0));
        }
        instance.setDebug($('debugEnabled').checked);
        if(state==='done')break;
        continue;
      }
      if(result.action===0 || result.action===1){
        $('debugEnabled').checked=result.action===1;instance.setDebug(result.action===1);
        nativeResume=result.action===1;instance.setDebugEvents(nativeResume);
        nativeBusy=false;resume();return;
      }
      break;
    }
  }finally{
    clearInterval(timer);nativeBusy=false;nativeInput=null;
    for(const button of $('commandHistory').querySelectorAll('button'))button.disabled=false;
    if(engine===instance){
      instance.setDebug($('debugEnabled').checked);
      latest=instance.update(state==='done');latest.events=new Uint32Array();latest.trace=[];latest.executed=0;
      if(state!=='running')coreView='native';
      if(state!=='running')renderNativeOutput();renderTrace();controls();
      $('commandOutput').textContent=nativeCancelled?'Debugger command cancelled.':'Ready.';
    }
  }
}
async function command(text) {
  if(nativeBusy)return nativeCommand(text);
  const verb=text.trim().toLowerCase();
  if(verb==='pause'){pause();return;}
  if(verb==='reset battle'){await load();return;}
  if(/^(f[1-9]|f10|up|down|pgup|pgdn|alive|tproc|mousel|mousem|mouser)$/.test(verb))text='macro '+verb;
  return nativeCommand(text);
}
function setFast(enabled){
 const wasFast=fastMode;fastMode=enabled;$('fast').setAttribute('aria-pressed',String(enabled));
 $('speed').disabled=enabled;syncTrace();
 if(!enabled){display.redraw();if(latest){if(wasFast)sampleScores(latest);textViews();}}
}
$('fast').onclick=safe(async()=>{
 const enable=!fastMode;
 if((!engine || (total===0 && dirty)) && !(await load()))return;
 setFast(enable);
 if(enable && state==='paused')resume();
});
$('debugRun').onclick=safe(async()=>{
 $('debugEnabled').checked=true;
 pause();
 if((!engine || (total===0 && dirty)) && !(await load()))return;
 engine.setDebug(true);resume();
});
$('debugEnabled').onchange=()=>{if(!nativeBusy)engine?.setDebug($('debugEnabled').checked);};
$('diagnostics').ontoggle=()=>{if($('diagnostics').open)$('sliceTiming').textContent='Peak simulation slice: '+maxSlice.toFixed(1)+' ms';};
$('run').onclick = safe(run);
$('step').onclick = safe(() => step());
$('reset').onclick = safe(load);
$('speed').oninput = () => {
 const unlimited=Number($('speed').value)>5;
 const label=unlimited?'Unlimited':Math.round(10 ** Number($('speed').value)).toLocaleString();
 $('speedValue').textContent=label;
 $('speed').setAttribute('aria-valuetext',unlimited?'Unlimited, with graphics':label+' instructions per second');
 credit=0;
};
$('addConsole').onclick=()=>addConsole(latest?.warriors.length?'warrior:0':'cdb');
$('arenaLayout').onchange=()=>{
 const layout=$('arenaLayout').value,viewport=document.querySelector('.arena-viewport');
 viewport.dataset.layout=layout;
 viewport.scrollLeft=0;viewport.scrollTop=0;
 viewport.setAttribute('aria-label',{'vertical':'Core arena scrolling vertically','horizontal':'Core arena scrolling horizontally','fill':'Core arena filling vertically','fill-horizontal':'Core arena filling horizontally'}[layout]);
 clearHover();display.redraw();
};
function clearHover(){ $('hoverAddress').textContent='Cell: —'; }
$('cellSize').onchange = () => {clearHover();display.setCellSize(Number($('cellSize').value));};
$('core').onpointermove=event=>{
 const address=display.addressAt(event),text=address===null?'Cell: —':'Cell: '+String(address).padStart(String(display.size-1).length,'0');
 if($('hoverAddress').textContent!==text)$('hoverAddress').textContent=text;
};
$('core').onpointerleave=clearHover;
document.querySelector('.arena-viewport').addEventListener('scroll',clearHover);
$('core').onclick = event => { const address=display.addressAt(event);if(address===null)return;pause();showAddress(address); };
$('core').oncontextmenu = event => { event.preventDefault();const address=display.addressAt(event);if(address===null)return;pause();showAddress(address-lineCount()+1); };
$('commandForm').onsubmit = event => {
  event.preventDefault();const text=$('command').value;$('command').value='';
  command(text).catch(error=>{nativeBusy=false;controls();$('commandOutput').textContent=error.message;log(error.message);});
};

document.addEventListener('keydown',event => {
  if (event.target.closest('textarea,input,select,button,[contenteditable]') || event.ctrlKey || event.altKey || event.metaKey) return;
  const key = {F1:'help',F5:'f5',F7:'f7',F8:'f8',F9:'go',ArrowUp:'up',ArrowDown:'down',PageUp:'pgup',PageDown:'pgdn',Escape:'pause'}[event.key];
  if (key) { event.preventDefault(); command(key).catch(error=>log(error.message)); }
});
document.addEventListener('visibilitychange',() => { previous = performance.now(); credit = 0; });

function traceControls() {
 for(const panel of consoles)consoleOptions(panel);
 syncTrace();
}
function syncTrace(){
 if(nativeBusy)return;
 engine?.setTrace(!fastMode && !$('pauseViews').checked && consoles.some(p=>!p.paused && p.select.value!=='cdb'));
}
function recordCommand(text){
 if(!text)return;
 commandHistory.push(text);if(commandHistory.length>100)commandHistory.shift();
 $('commandHistory').replaceChildren(...commandHistory.map(cmd=>{
   const button=document.createElement('button');button.type='button';button.textContent=cmd;button.title='Execute again: '+cmd;
   button.disabled=nativeBusy && !nativeInput;
   button.onclick=()=>{if(nativeBusy)return;command(cmd).catch(e=>{$('commandOutput').textContent=e.message;});};
   return button;
 }));
 $('commandHistory').scrollTop=$('commandHistory').scrollHeight;
}
function battleCount(update){
 sessionBattles += Math.max(0,update.completed-countedCompleted);countedCompleted=update.completed;
 $('battleTotals').textContent='Results · '+update.completed.toLocaleString()+' battle'+(update.completed===1?'':'s')+(update.done?' · complete':' completed');
 $('diagnosticsTitle').textContent='Show diagnostics · '+sessionBattles.toLocaleString()+' battles this session';
}
function sampleScores(update){
 battleCount(update);
 if(!$('pauseViews').checked && !$('pauseScores').checked && update.completed!==lastScoreSample){
  scoreChart.add(update.completed,update.warriors.map(w=>w.score));lastScoreSample=update.completed;
 }
}
function saveWarrior(i){
 const a=document.createElement('a'),url=URL.createObjectURL(new Blob([sources[i]],{type:'text/plain;charset=utf-8'}));
 a.href=url;a.download=(draftName(sources[i],i).replace(/[^a-z0-9_.-]+/gi,'_')||'warrior')+'.red';
 document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
async function importFiles(files){
 const list=Array.from(files);
 if(!list.length)return;
 if(sources.length+list.length>36)throw new Error('At most 36 warriors can be loaded. Remove some before importing.');
 if(list.some(f=>f.size>65536))throw new Error('Warrior files must be at most 64 KiB each.');
 const texts=await Promise.all(list.map(f=>f.text()));
 if(sources.length+texts.length>36)throw new Error('Too many warriors after concurrent imports.');
 sources.push(...texts);markDirty();editors();
 status('Imported '+list.length+' warrior files. Edit them below or Reset to load them.');
}
$('newWarrior').onclick=()=>{
 if(sources.length>=36)return;
 collapsedEditors[sources.length]=false;
 sources.push(';redcode-94\n;name Warrior '+(sources.length+1)+'\n;assert 1\nmov.i 0, 1\nend\n');
 markDirty();editors();
};
async function startDemo(selected){
 if(sources.length)return;
 sources=[...selected];excludedWarriors=[];collapsedEditors=[];wideEditors=[];
 $('preset').value='standard';$('preset').onchange();
 $('rounds').value='1';$('debugEnabled').checked=false;
 $('speed').value='3';$('speed').oninput();
 markDirty();editors();
 if(await load())resume();
}
$('demo').onclick=safe(()=>startDemo(demoSources));
$('randomDemo').onclick=safe(()=>{
 const pool=[...bundledWarriors];
 for(let i=pool.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[pool[i],pool[j]]=[pool[j],pool[i]];}
 return startDemo(pool.slice(0,2).map(w=>w.source));
});
$('multiDemo').onclick=safe(()=>startDemo(bundledWarriors.map(w=>w.source)));
$('dropZone').onclick=()=>$('warriorFiles').click();
$('dropZone').onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();$('warriorFiles').click();}};
$('warriorFiles').onchange=()=>{importFiles($('warriorFiles').files).catch(e=>status(e.message));$('warriorFiles').value='';};
for(const id of ['dropZone']){
 const zone=$(id);
 zone.ondragover=e=>{e.preventDefault();zone.classList.add('dragging');};
 zone.ondragleave=()=>zone.classList.remove('dragging');
 zone.ondrop=e=>{e.preventDefault();zone.classList.remove('dragging');importFiles(e.dataTransfer.files).catch(err=>status(err.message));};
}
$('theme').onchange=()=>{
 setTheme($('theme').value);
 for(const selector of ['#editors .warrior']) document.querySelectorAll(selector).forEach((label,i)=>{label.style.color=warriorColor(i);});
 display.redraw();legend();textViews();processChart.draw();scoreChart.draw();
};
$('pauseProcesses').onchange=()=>{if(latest)processIndicators(latest);};
$('pauseViews').onchange=()=>{syncTrace();if(latest)processIndicators(latest);};
$('clearConsole').onclick=event=>{event.preventDefault();event.stopPropagation();consoleText='';$('consoleOutput').textContent='';compileIssues=[];refreshDiagnostics();};
$('consoleWindow').ontoggle=()=>{if($('consoleWindow').open)$('consoleOutput').textContent=consoleText;};
setupSettings(markDirty);
processChart.clear();scoreChart.clear();

try{const saved=localStorage.getItem('pmars-editor-theme');if(['dark','light','contrast'].includes(saved))$('editorTheme').value=saved;}catch{}
try{const saved=localStorage.getItem('pmars-editor-syntax');if(['ocean','warm','mono'].includes(saved))$('editorSyntax').value=saved;}catch{}
$('editorTheme').onchange=$('editorSyntax').onchange=()=>{
 const name=$('editorTheme').value,syntax=$('editorSyntax').value;
 sourceEditors.forEach(editor=>editor.setTheme(name,syntax));
 try{localStorage.setItem('pmars-editor-theme',name);localStorage.setItem('pmars-editor-syntax',syntax);}catch{}
};
editors(); clearBattle();

addConsole('cdb');addConsole('all');
