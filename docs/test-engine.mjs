// SPDX-License-Identifier: GPL-2.0-or-later
// node web/test-engine.mjs [path/to/native-pmars]
import assert from 'node:assert/strict';
import {readFile, mkdir, writeFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';
import {Engine, settings} from './engine.mjs';
const native = process.argv[2] && resolve(process.argv[2]);
const folder = new URL('./test-output/', import.meta.url);
await mkdir(folder, {recursive:true});
let checks = 0;
const red = body => ';redcode-94\n;assert 1\n' + body + '\n';
const imp = red(';name Imp\nmov.i 0,1');
const dwarf = red(';name Dwarf\nadd.ab #4, bomb\nmov.i bomb,@bomb\njmp -2\nbomb dat 0,0');
const pin = red(';name Shared\npin 42\nldp.ab #1, 1\nstp.ab #7, #1\nspl 1\njmp -1');
async function run(sources, config, budget, visual, trace = false, imported = false) {
  const logs = [];
  let engine = await Engine.create(config, {visual, log: line => logs.push(line)});
  const banks = engine.compile(sources);
  if (imported) {
    engine = await Engine.create(config, {visual});
    engine.import(banks);
  }
  engine.setTrace(trace);
  let update = engine.start(), executed = 0, calls = 0, events = [], instructions = [];
  if (trace) events.push(...update.events);
  while (!update.done) {
    update = engine.advance(budget, 4);
    assert(update.executed <= budget);
    assert(update.cycle >= 0 && update.cycle <= config.cycles, "Cycle must stay within round limit");
    assert(update.events.length <= 8192 * 4);
    executed += update.executed;
    instructions.push(...update.trace);
    if (trace) events.push(...update.events);
    assert(++calls < 1000000, 'Simulator must make progress');
  }
  return {engine, update, executed, events, instructions, logs};
}
const cases = [
  [[imp], {rounds: 3, cycles: 51}],
  [[red('dat 0,0')], {rounds: 3, cycles: 51}],
  [[imp, red('dat 0,0'), imp], {rounds: 3, cycles: 113}],
  [[pin, pin, dwarf, imp], {rounds: 4, cycles: 150, tasks: 16}],
  [Array(36).fill(imp), {rounds: 2, cycles: 3}],
  [[imp, dwarf], {coreSize: 800, rounds: 2, cycles: 31}],
  [[imp, dwarf], {coreSize: 65536, rounds: 2, cycles: 31}],
  [[imp, dwarf], {rounds: 7, cycles: 2000}],
  [[imp, imp], {rounds: 3, cycles: 31}],
  [[red('dat 0,0'), imp], {rounds: 3, cycles: 10}],
  [[pin, pin], {rounds: 4, cycles: 73, tasks: 16}],
  [[red('org -1\ndat 0,0\nmov.i 0,1'), dwarf], {rounds: 3, cycles: 80}],
];
for (const name of ['excalibur', 'forgottenloreii', 'sonofvain', 'sunset', 'artofcorewar', 'validate']) {
  cases.push([[await readFile(new URL('../warriors/'+name+'.red', import.meta.url), 'utf8'), dwarf],
    {rounds: 3, cycles: 2000}]);
}
for (const [sources, options] of cases) {
  const config = settings({fixedSeries:true,...options, warriors:sources.length});
  const small = await run(sources, config, 1, true, true);
  const large = await run(sources, config, 100000, true, true, true);
  const headless = await run(sources, config, 100000, false);
  assert.deepEqual(large.update.warriors, small.update.warriors);
  assert.deepEqual(headless.update.warriors, small.update.warriors);
  assert.equal(large.update.cycle, small.update.cycle);
  assert.equal(headless.update.cycle, small.update.cycle);
  assert.equal(large.executed, small.executed);
  assert.equal(headless.executed, small.executed);
  assert.deepEqual(large.instructions, small.instructions, 'Pre-execution trace must not depend on slice size');
  assert.equal(small.instructions.length, small.executed);
  assert.equal(small.update.completed, config.rounds);
  assert.deepEqual(large.events, small.events, 'Event order must not depend on slice size');
  assert.equal(headless.update.events.length, 0);
  for (let i = 0; i < config.coreSize; ++i)
    assert.equal(large.engine.inspect(i), small.engine.inspect(i), 'Final core differs at '+i);
  if (native) {
    const paths = sources.map((_,i) => new URL('warrior-'+i+'.red',folder));
    await Promise.all(paths.map((p,i) => writeFile(p,sources[i])));
    const {fileURLToPath} = await import('node:url');
    const result = spawnSync(native, ['-b','-k','-f','-s',String(config.coreSize),
      '-r',String(config.rounds),'-c',String(config.cycles),'-p',String(config.tasks),
      ...paths.map(fileURLToPath)], {encoding:'utf8'});
    assert.equal(result.status,0,result.stderr);
    const scores = result.stdout.trim().split(/\s+/).map(Number);
    assert.deepEqual(scores, small.update.warriors.flatMap(w => config.warriors === 2
      ? [w.wins,w.ties] : [w.score,...w.outcomes,config.warriors === 1 ? 0 : w.losses]));
  }
  checks++;
}
const self = await Engine.create({warriors:1}, {log:()=>{}});
self.compile([red('add.ab #1,0')]);
self.setTrace(true);
self.start();
const snapshot = self.advance(1);
assert.match(snapshot.trace[0].instruction, /ADD.AB\s+#\s*1,\s*\$\s*0/);
assert.match(self.inspect(0), /ADD.AB\s+#\s*1,\s*\$\s*1/);
const solo = await run([red('dat 0,0')],settings({warriors:1,rounds:1}),1,true);
assert.equal(solo.update.warriors[0].wins,0);
assert.equal(solo.update.warriors[0].losses,1);
assert.throws(() => settings({warriors:37}));
assert.throws(() => settings({coreSize:800,warriors:9}));
assert.throws(() => settings({coreSize: 0}));
assert.throws(() => settings({rounds: Infinity}));
const bad = await Engine.create({}, {log:()=>{}});
assert.throws(() => bad.compile([red('not_an_opcode 1,2'), imp]));
const fresh = await Engine.create({}, {log:()=>{}});
assert.throws(() => fresh.advance(1));
console.log(`PASS: ${checks} fixtures, native score parity=${!!native}; full ordered event and final-core parity; compiled-bank transfer; P-space; malformed input.`);
