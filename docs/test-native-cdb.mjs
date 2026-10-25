// SPDX-License-Identifier: GPL-2.0-or-later
import assert from 'node:assert/strict';
import {Engine} from './engine.mjs';
const e=await Engine.create({warriors:1,cycles:1000});
e.compile([';redcode\n;assert 1\njmp 0\n']);e.start();
let output='';const io={output:t=>output+=t};
async function cmd(text,input){output='';return e.debuggerCommand(text,{...io,...(input?{input}: {})});}
await cmd('calc x=7~calc x*6');assert(output.includes('42'));
await cmd('fill 10,12~mov.i 0,1');assert.match(e.inspect(10),/MOV.I/);assert.match(e.inspect(12),/MOV.I/);
await cmd('edit 13',()=>Promise.resolve('dat 7,9'));assert.match(e.inspect(13),/#?\s*7,/);
e.setBreakpoint(10,false);await cmd('trace 10');assert(e.breakpoint(10));await cmd('untrace 10');assert(!e.breakpoint(10));
await cmd('macro alive');assert(/1\n/.test(output));
await cmd('macro tproc');assert(/1\n/.test(output));assert(!output.includes('Bad argument'));
await cmd('calc x=0~!!~calc x=x+1~!5~calc x');assert(output.includes('5'));
let r=await cmd('macro f5');let executed=0;
while(r.action===2){e.setDebug(false);let left=r.steps;while(left>0){const u=e.advance(Math.min(left,100000),4);left-=u.executed;executed+=u.executed;}r=await e.debuggerCommand(undefined,io);}
assert.equal(executed,2,'Real f5 macro steps twice');
let lines=['custom=calc 123','.'];await cmd('macro , user',()=>Promise.resolve(lines.shift()??'a'));await cmd('macro custom');assert(output.includes('123'));
let pulses=0;const timer=setInterval(()=>{pulses++;if(pulses>=3)e.cancelDebugger();},10);
r=await cmd('calc 1~!');clearInterval(timer);assert(r.cancelled);assert(pulses>=3);
await cmd('calc 6*7');assert(output.includes('42'));
await cmd('shell');assert(output.includes('unavailable'));
r=await cmd('step 23');assert.equal(r.action,2);assert.equal(e.update(false).warriors[0].pc,23);
console.log('PASS: native expressions, variables, fill/edit input, trace/untrace integration, mw.mac, finite loops, real f5, user-defined macros, cancellable infinite loop and native step address semantics.');
