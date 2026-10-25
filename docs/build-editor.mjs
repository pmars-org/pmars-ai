// SPDX-License-Identifier: GPL-2.0-or-later
import {build} from 'esbuild';
import {readFile,writeFile,readdir} from 'node:fs/promises';
await build({entryPoints:['docs/editor-source.mjs'],outfile:'docs/dist/editor.mjs',bundle:true,format:'esm',minify:true,target:'es2022',legalComments:'eof'});
const lock=JSON.parse(await readFile('package-lock.json','utf8'));let notices='Code editor third-party notices\n';
for(const [path,info] of Object.entries(lock.packages)){
 if(!path || info.dev)continue;
 for(const file of await readdir(path))if(/^licen[sc]e(?:\.|$)/i.test(file))notices+='\n'+path+' '+info.version+'\n'+await readFile(path+'/'+file,'utf8')+'\n';
}
await writeFile('docs/dist/editor-LICENSES.txt',notices.trimEnd()+'\n');
