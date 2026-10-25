// SPDX-License-Identifier: GPL-2.0-or-later
// Give existing battle tests their two-warrior fixture through the editor UI.
export async function loadTestWarriors(page) {
 await page.waitForFunction(() => typeof document.querySelector('#newWarrior')?.onclick === 'function'
   && document.querySelector('#status').textContent.startsWith('No warriors loaded.'));
 const sources = [";redcode-94\n;name Imp\n;author A. K. Dewdney\n;assert 1\nmov.i 0, 1\nend\n", ";redcode-94\n;name Dwarf\n;author A. K. Dewdney\n;assert 1\nadd.ab #4, bomb\nmov.i bomb, @bomb\njmp -2\nbomb dat.f #0, #0\nend\n"];
 for (const [i,source] of sources.entries()) {
  await page.locator('#newWarrior').click();
  await page.locator(i===0?'#first':'#second').fill(source);
 }
 await page.locator('#toggleEditors').click();
}
