import {defaults,settings} from './settings.mjs?v=22ede45f08e7cbab';
import {presets} from './presets.mjs?v=22ede45f08e7cbab';
const $ = id=>document.getElementById(id);
const numbers = [['coreSize','-s Core size',80,65536],['cycles','-c Cycles per warrior',1,10000000],
 ['tasks','-p Processes',1,65536],['maxLength','-l Maximum length',1,1000],
 ['distance','-d Minimum distance (0 = length)',0,65536],['pspace','-S P-space (0 = automatic)',0,65536]];
const flags = [['brief','-b Brief'],['verbose','-V Verbose assembly'],['koth','-k KotH output'],
 ['rules88',"-8 ICWS ’88"],['fixedSeries','-f Fixed series'],['sort','-o Sort results'],
 ['permutate','-P Permutate positions'],['assembleOnly','-A Assemble only'],
 ['noPspace','No P-space instructions (94nop hill)']];
const keys = [...numbers.map(x=>x[0]),'rounds',...flags.map(x=>x[0]),'fixedPosition','formula'];
export function readSettings(extra={}) {
 const result={...extra};
 for(const key of keys) {
  const el=$(key);
  result[key]=el.type==='checkbox'?el.checked:el.type==='number'?Number(el.value):el.value;
 }
 return settings(result);
}
export function refreshSummary() {
 $('settingsSummary').textContent = `Core ${$('coreSize').value} · cycles ${$('cycles').value} · processes ${$('tasks').value} · length ${$('maxLength').value} · ${$('rules88').checked?'ICWS ’88':'ICWS ’94'}`;
}
export function setupSettings(changed) {
 const form=$('settingsFields');
 for(const [id,title,min,max] of numbers) {
  const label=document.createElement('label');label.textContent=title+' ';
  const input=document.createElement('input'); Object.assign(input,{id,type:'number',min,max,value:defaults[id]});
  label.append(input);form.append(label);
 }
 for(const [id,title] of flags) {
  const label=document.createElement('label'),input=document.createElement('input');
  Object.assign(input,{id,type:'checkbox',checked:!!defaults[id]});label.append(input,' '+title);form.append(label);
 }
 for(const [id,title] of [['fixedPosition','-F Warrior #2 position / seed'],['formula','-= Score formula']]) {
  const label=document.createElement('label');label.textContent=title+' ';
  const input=document.createElement('input');Object.assign(input,{id,type:'text',value:defaults[id]});input.maxLength=256;
  label.append(input);form.append(label);
 }
 $('preset').replaceChildren(new Option('Custom settings','custom'),...presets.map(p=>new Option(p.name,p.id)));
 for(const key of keys) $(key).addEventListener('input',()=>{$('preset').value='custom';refreshSummary();changed();});
 $('fixedPosition').addEventListener('input',()=>{if($('fixedPosition').value)$('fixedSeries').checked=false;});
 $('preset').onchange=()=>{
  const preset=presets.find(p=>p.id===$('preset').value);if(!preset)return;
  const values={...defaults,noPspace:false,fixedSeries:false,...preset.values};
  for(const key of keys) {if($(key).type==='checkbox')$(key).checked=!!values[key];else $(key).value=values[key];}
  $('presetSource').replaceChildren();
  if(preset.sourceUrl || preset.source) {
   const a=document.createElement('a');a.href=preset.sourceUrl || 'https://www.corewar.info/hills/'+preset.source+'.htm';a.target='_blank';a.rel='noopener';a.textContent='Published hill specification';
   $('presetSource').append(a,' · historical parameters; round count is editable.');
  }
  refreshSummary();changed();
 };
 $('editSettings').onclick=()=>{
  const panel=$('settingsDetails');panel.hidden=!panel.hidden;
  $('editSettings').setAttribute('aria-expanded',String(!panel.hidden));
  $('editSettings').setAttribute('aria-label',(panel.hidden?'Expand':'Collapse')+' match settings');
  $('settingsArrow').textContent=panel.hidden?'▸':'▾';
 };

 refreshSummary();
}
