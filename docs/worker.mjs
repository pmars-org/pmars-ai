// SPDX-License-Identifier: GPL-2.0-or-later
import {Engine} from './engine.mjs?v=22ede45f08e7cbab';
let busy = false, paused = false, wake = null;
self.onmessage = async ({data}) => {
  if(data.type==='pause'){paused=true;return;}
  if(data.type==='resume'){paused=false;if(wake){wake();wake=null;}return;}
  if (busy) return;
  busy = true;
  // Buffer native output so verbose assembly cannot flood the main thread.
  // Keep a bounded tail, and flush before progress/results so final scores survive.
  let logBytes = 0, pendingLogs = [], currentIndex = null;
  const log = (line,channel='stdout') => {
    const text = String(line).slice(-65536);
    const last = pendingLogs.at(-1);
    if (last?.channel === channel && last.index === currentIndex) last.text += '\n' + text;
    else pendingLogs.push({type:'log',text,channel,index:currentIndex});
    logBytes += text.length + 1;
    while (logBytes > 65536 && pendingLogs.length) {
      const first=pendingLogs[0], excess=logBytes-65536;
      if(first.text.length+1<=excess){logBytes-=first.text.length+1;pendingLogs.shift();}
      else {first.text=first.text.slice(excess);logBytes-=excess;}
    }
  };
  const flush = () => {
    for(const message of pendingLogs) self.postMessage(message);
    pendingLogs=[];logBytes=0;
  };
  try {
    const engine = await Engine.create(data.settings, {visual: false, log});
    const banks = engine.compile(data.sources, index=>{
      flush(); self.postMessage({type:'assembly',index,ok:true});
    },data.type==='check'?data.index:null,index=>{flush();currentIndex=index;});
    flush();
    if (data.type === 'compile' || data.type === 'check') {
      self.postMessage({type: 'compiled', banks, rounds:engine.config.rounds}, banks.map(b => b.code.buffer));
    } else if (data.type === 'series') {
      let update = engine.start(), last = performance.now();
      while (!update.done) {
        if(paused){
          self.postMessage({type:'paused',update});
          await new Promise(resolve=>{wake=resolve;});
        }
        update = engine.advance(100000, 8);
        if (performance.now() - last >= 100 || update.done) {
          flush();
          self.postMessage({type: 'progress', update});
          last = performance.now();
          await new Promise(resolve => setTimeout(resolve, 0));
        }
      }
      flush();
      self.postMessage({type: 'done', update});
    } else throw new Error('Unknown worker command.');
  } catch (error) {
    flush();
    self.postMessage({type: 'error', message: error.message || String(error), index:error.warriorIndex});
  } finally {
    self.close();
  }
};
