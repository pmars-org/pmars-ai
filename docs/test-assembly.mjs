// SPDX-License-Identifier: GPL-2.0-or-later
// Exercise the shipped WASM assembler, including the historical Numb regression.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Engine} from './engine.mjs';
const source = await readFile(new URL('../security/fixtures/numb.red', import.meta.url), 'utf8');
const expected = await readFile(new URL('../security/fixtures/numb.expected.txt', import.meta.url), 'utf8');
const output = [];
const engine = await Engine.create({warriors: 1, rounds: 0}, {
  visual: false, log: (line, channel) => { if (channel === 'stdout') output.push(line); }
});
const [bank] = engine.compile([source]);
assert.equal(bank.name, 'Numb');
assert.equal(bank.length, 100);
const normalize = text => text.replaceAll('\r', '').trimEnd().split('\n').map(line => line.trimEnd());
assert.deepEqual(normalize(output.join('\n')), normalize(expected));
const invalid = await Engine.create({warriors: 1, rounds: 0});
assert.throws(() => invalid.compile([';redcode\n;assert 1\nX equ X\ndat X,0\n']));
console.log('PASS: WASM Numb listing matches upstream fixture; recursive EQU is rejected.');
