// Documented historical hill parameters; applying a preset does not submit to a hill.
const kothSource = 'https://www.koth.org/koth.html';
// Explicit table values keep hill constraints independent of simulator defaults.
const koth94 = {coreSize:8000,cycles:80000,tasks:8000,maxLength:100,distance:100,rounds:100};
const kothBig = {coreSize:55440,cycles:500000,tasks:10000,maxLength:200,distance:200,pspace:3465,rounds:100};
export const presets = [
 {id:'standard',name:"pMARS standard ’94",values:{}},
 {id:'94nop',name:"KotH ’94 no P-space",values:{...koth94,noPspace:true},sourceUrl:kothSource},
 {id:'88',name:"KotH Standard (’88)",values:{...koth94,rules88:true},sourceUrl:kothSource},
 {id:'94',name:"KotH ’94",values:{...koth94},sourceUrl:kothSource},
 {id:'94m',name:"KotH ’94 Multiwarrior",values:{...koth94},sourceUrl:kothSource},
 {id:'icws',name:'KotH ICWS Tournament',values:{coreSize:8192,cycles:100000,tasks:8000,maxLength:300,distance:300,rules88:true,rounds:100},sourceUrl:kothSource},
 {id:'nano',name:'SAL Nano',values:{coreSize:80,tasks:80,cycles:800,maxLength:5,distance:5,pspace:5,rounds:100},source:'nano'},
 {id:'tiny',name:'SAL Tiny',values:{coreSize:800,tasks:800,cycles:8000,maxLength:20,distance:20,pspace:50,rounds:100},source:'tiny'},
 {id:'tinylp',name:'SAL Tiny LP',values:{coreSize:800,tasks:8,cycles:8000,maxLength:50,distance:50,pspace:50,rounds:100},source:'tinylp'},
 {id:'94x',name:'KotH ’94 Experimental / Multiwarrior X',values:{...kothBig},sourceUrl:kothSource}
];
