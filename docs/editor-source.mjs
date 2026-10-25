// SPDX-License-Identifier: GPL-2.0-or-later
// Reusable editor adapter; Redcode support is optional for future document types.
import {EditorState,Compartment} from '@codemirror/state';
import {EditorView,keymap,lineNumbers,highlightActiveLine,highlightActiveLineGutter,drawSelection} from '@codemirror/view';
import {history,historyKeymap,defaultKeymap,insertTab,indentLess} from '@codemirror/commands';
import {StreamLanguage,syntaxHighlighting,HighlightStyle,bracketMatching,indentUnit} from '@codemirror/language';
import {searchKeymap,highlightSelectionMatches} from '@codemirror/search';
import {setDiagnostics,lintGutter} from '@codemirror/lint';
import {tags} from '@lezer/highlight';
const redcode=StreamLanguage.define({
 token(stream){
  if(stream.eatSpace())return null;
  if(stream.match(/^;(?:redcode[^\s]*|name|author|assert|strategy|date|version|debug|break|trace)\b/i)){stream.skipToEnd();return 'meta';}
  if(stream.eat(';')){stream.skipToEnd();return 'comment';}
  if(stream.match(/^(?:dat|mov|add|sub|mul|div|mod|jmp|jmz|jmn|djn|spl|cmp|seq|sne|slt|nop|ldp|stp)\b/i))return 'keyword';
  if(stream.match(/^(?:org|end|equ|for|rof|pin)\b/i))return 'definitionKeyword';
  if(stream.match(/^\.(?:ab|ba|a|b|f|x|i)\b/i))return 'typeName';
  if(stream.match(/^\d+/))return 'number';
  if(stream.match(/^[#$@<>*{}]/))return 'operator';
  if(stream.match(/^[a-z_][\w]*/i))return 'variableName';
  stream.next();return null;
 },languageData:{commentTokens:{line:';'}}
});
const palettes={
 dark:{bg:'#101d29',fg:'#dae9f3',gutter:'#0c1721',muted:'#829aab',active:'#ffffff08',selection:'#31526a',tokens:['#65d9ee','#dab2ff','#ffbb79','#f1c96b','#f4a1c8','#8a9caa','#96cba7']},
 light:{bg:'#fafafa',fg:'#20252b',gutter:'#eef0f3',muted:'#59636e',active:'#00000008',selection:'#b9d7f5',tokens:['#005b87','#743baa','#9c4210','#725000','#a42669','#606873','#25683b']},
 contrast:{bg:'#000000',fg:'#ffffff',gutter:'#101010',muted:'#cccccc',active:'#ffffff18',selection:'#374b72',tokens:['#72e5ff','#e4b9ff','#ffd6a1','#ffff80','#ffaedb','#c0c0c0','#9fffac']}
};
function editorTheme(name,syntax='ocean'){
 const p=palettes[name]||palettes.dark;
 const tokens=syntax==='mono'?Array(7).fill(p.fg):syntax==='warm'
  ?(name==='light'?['#934400','#7f298d','#00665e','#864800','#943452','#66615a','#3b652a']:['#ffbf80','#e5b0ff','#80ddd0','#ffd080','#ff9eb8','#b5aaa0','#b9d98e'])
  :p.tokens;
 return [EditorView.theme({
  '&':{backgroundColor:p.bg,color:p.fg,fontSize:'13px'},
  '.cm-scroller':{fontFamily:'Consolas, monospace',overflow:'auto',minHeight:'180px',maxHeight:'360px'},
  '.cm-content':{padding:'8px 0'},'.cm-gutters':{backgroundColor:p.gutter,color:p.muted,border:'none'},
  '.cm-activeLine,.cm-activeLineGutter':{backgroundColor:p.active},
  '.cm-cursor':{borderLeftColor:p.fg},'&.cm-focused .cm-selectionBackground, .cm-selectionBackground':{backgroundColor:p.selection},
  '.cm-panels,.cm-tooltip':{backgroundColor:p.gutter,color:p.fg},
  '.cm-search input,.cm-search button':{backgroundColor:p.bg,color:p.fg}
 },{dark:name!=='light'}),syntaxHighlighting(HighlightStyle.define([
  ...[tags.keyword,tags.definitionKeyword,tags.typeName,tags.number,tags.operator,tags.comment,tags.meta].map((tag,i)=>({tag,color:tokens[i]})),
  {tag:tags.variableName,color:p.fg}
 ]))];
}
export function createEditor(parent,{value='',label='Source',id,language='redcode',theme='dark',syntax='ocean',onChange=()=>{}}={}){
 const themeSlot=new Compartment();
 const view=new EditorView({parent,state:EditorState.create({doc:value,extensions:[
  indentUnit.of('\t'),lineNumbers(),history(),drawSelection(),highlightActiveLine(),highlightActiveLineGutter(),bracketMatching(),highlightSelectionMatches(),lintGutter(),
  keymap.of([{key:'Tab',run:insertTab,shift:indentLess},...defaultKeymap,...historyKeymap,...searchKeymap]),themeSlot.of(editorTheme(theme,syntax)),
  ...(language==='redcode'?[redcode]:[]),EditorView.contentAttributes.of({'aria-label':label,...(id?{id}:{})}),
  EditorView.updateListener.of(update=>{if(update.docChanged)onChange(update.state.doc.toString());})
 ]})});
 return {view,setTheme:(name,syntax)=>view.dispatch({effects:themeSlot.reconfigure(editorTheme(name,syntax))}),focus:()=>view.focus(),destroy:()=>view.destroy(),
  diagnostics(items){view.dispatch(setDiagnostics(view.state,items.map(item=>{const line=view.state.doc.line(Math.max(1,Math.min(item.line,view.state.doc.lines)));return {from:line.from,to:line.to,severity:item.severity,message:item.message};})));},
  jump(line){const target=view.state.doc.line(Math.max(1,Math.min(line,view.state.doc.lines)));view.dispatch({selection:{anchor:target.from,head:target.to},effects:EditorView.scrollIntoView(target.from,{y:'center'})});view.focus();}
 };
}
