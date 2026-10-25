// SPDX-License-Identifier: GPL-2.0-or-later
export const defaults = Object.freeze({
  coreSize:8000, rounds:1, cycles:80000, tasks:8000, warriors:2,
  maxLength:100, distance:0, pspace:0, brief:false, verbose:false,
  koth:false, rules88:false, fixedSeries:false, fixedPosition:'', sort:false,
  permutate:false, assembleOnly:false, noPspace:false, formula:'(W*W-1)/S'
});
export function settings(input = {}) {
  const result = {...defaults,...input};
  for (const [key,min,max] of [
    ['coreSize',80,65536],['rounds',0,2147483647],['cycles',1,10000000],
    ['tasks',1,65536],['warriors',1,36],['maxLength',1,1000],
    ['distance',0,65536],['pspace',0,65536]
  ]) if (!Number.isInteger(result[key]) || result[key]<min || result[key]>max)
    throw new Error(`${key} must be an integer from ${min} to ${max}.`);
  if (result.coreSize < Math.max(2,result.warriors)*Math.max(result.maxLength,result.distance))
    throw new Error('Core is too small for the warrior count, length, or minimum distance.');
  if (result.pspace > result.coreSize) throw new Error('P-space cannot exceed core size.');
  for (const key of ['formula','fixedPosition']) {
    if (typeof result[key] !== 'string' || result[key].length>256 || /[\r\n\0]/.test(result[key]))
      throw new Error(`Invalid ${key}.`);
  }
  if (!result.formula.trim()) throw new Error('A score formula is required.');
  if (result.fixedPosition && result.fixedSeries) throw new Error('-f and -F are mutually exclusive; turn off fixed series to set a fixed position.');
  if (result.permutate && result.warriors!==2) throw new Error('Permutation requires exactly two warriors.');
  return result;
}
export function argumentsFor(c) {
  const args = [];
  for (const [flag,key] of [['r','rounds'],['s','coreSize'],['c','cycles'],['p','tasks'],
    ['l','maxLength'],['d','distance'],['S','pspace']]) {
    if ((key==='distance' || key==='pspace') && !c[key]) continue;
    args.push('-'+flag,String(c[key]));
  }
  for (const [flag,key] of [['b','brief'],['V','verbose'],['k','koth'],['8','rules88'],
    ['f','fixedSeries'],['o','sort'],['P','permutate'],['A','assembleOnly']])
    if (c[key]) args.push('-'+flag);
  if (c.fixedPosition) args.push('-F',c.fixedPosition);
  args.push('-=',c.formula);
  return args;
}
