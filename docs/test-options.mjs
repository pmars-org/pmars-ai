// SPDX-License-Identifier: GPL-2.0-or-later
import assert from 'node:assert/strict';
import {Engine} from './engine.mjs';
import {settings,argumentsFor} from './settings.mjs';
import {spawnSync} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
const binary=resolve(process.argv[2]);
const folder=new URL('./test-output/',import.meta.url);await mkdir(folder,{recursive:true});
const red=s=>';redcode\n;assert 1\n'+s+'\n';
const loop=red(';name Loop\nmov 0,1');
const dead=red(';name Dead\ndat #0,#0');
const cases=[
 {name:'standard listing and result',options:{rounds:3,cycles:30},sources:[loop,dead]},
 {name:'brief KotH',options:{brief:true,koth:true,rounds:4,cycles:20},sources:[loop,dead]},
 {name:'88',options:{rules88:true,cycles:20},sources:[loop,dead]},
 {name:'nano + distance + P-space',options:{coreSize:80,maxLength:5,distance:5,pspace:5,tasks:80,cycles:800,rounds:4},sources:[loop,dead]},
 {name:'fixed position',options:{fixedSeries:false,fixedPosition:'1234',cycles:20},sources:[loop,dead]},
 {name:'string seed',options:{fixedSeries:false,fixedPosition:'my-seed',cycles:20},sources:[loop,dead]},
 {name:'permutate',options:{coreSize:80,maxLength:5,distance:5,pspace:5,tasks:80,cycles:40,rounds:30,permutate:true},sources:[loop,dead]},
 {name:'custom sorted score',options:{rounds:4,cycles:30,formula:'10/S+W',sort:true},sources:[loop,dead,loop]},
 {name:'assemble only',options:{assembleOnly:true},sources:[loop,dead]},
 {name:'zero rounds',options:{rounds:0},sources:[loop,dead]},
 {name:'verbose assembly',options:{verbose:true,assembleOnly:true},sources:[loop,dead]},
 {name:'large length',options:{maxLength:200,distance:200,rounds:0},sources:[red('for 150\ndat 0,0\nrof'),dead]}
];
for(const fixture of cases){
 const config=settings({fixedSeries:true,...fixture.options,warriors:fixture.sources.length});
 const output=[];const engine=await Engine.create(config,{visual:false,log:(s,c)=>{if(c==='stdout')output.push(s);}});
 try { engine.compile(fixture.sources); } catch (e) { throw new Error(fixture.name+": "+e.message); }let u=engine.start(),calls=0;
 while(!u.done){u=engine.advance(100000,8);assert(++calls<100000);}
 const paths=fixture.sources.map((_,i)=>new URL('opt-'+i+'.red',folder));
 await Promise.all(paths.map((p,i)=>writeFile(p,fixture.sources[i])));
 const result=spawnSync(binary,[...argumentsFor(config),...paths.map(fileURLToPath)],{encoding:'utf8'});
 assert.equal(result.status,0,fixture.name+': '+result.stderr);
 assert.equal(output.join('\n').trimEnd(),result.stdout.replaceAll('\r','').trimEnd(),fixture.name);
}
assert.equal(settings({rounds:100000}).rounds,100000);
assert.equal(settings().fixedSeries,false);
assert(!argumentsFor(settings()).includes("-f"));
const nop=await Engine.create({noPspace:true},{log:()=>{}});
assert.throws(()=>nop.compile([red('ldp #0,0'),loop]),/forbids/);
const old=await Engine.create({rules88:true},{log:()=>{}});
assert.throws(()=>old.compile([red('nop 0,0'),loop]));
assert.throws(()=>settings({fixedSeries:true,fixedPosition:'100'}));
console.log('PASS: all requested native flags; exact native assembly/results output for 12 fixtures; 100000-round configuration; 88 and no-P-space rejection.');
