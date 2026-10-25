import {warriorColor} from './display.mjs?v=22ede45f08e7cbab';
export class HistoryChart {
 constructor(canvas,title){this.canvas=canvas;this.title=title;this.samples=[];}
 clear(){this.samples=[];this.draw();}
 add(x,values){
  this.samples.push({x,values});
  if(this.samples.length>300)this.samples.shift();
  this.draw();
 }
 draw(){
  const c=this.canvas,ctx=c.getContext('2d'),ratio=devicePixelRatio||1;
  const width=Math.max(280,c.clientWidth),height=160;c.width=width*ratio;c.height=height*ratio;ctx.scale(ratio,ratio);
  ctx.fillStyle='#101d29';ctx.fillRect(0,0,width,height);ctx.font='11px system-ui';ctx.fillStyle='#b4c6d4';
  ctx.fillText(this.title,8,14);
  if(!this.samples.length){ctx.fillText('Waiting for samples',8,80);return;}
  let minY=0,maxY=1;
  for(const p of this.samples)for(const value of p.values){minY=Math.min(minY,value);maxY=Math.max(maxY,value);}
  const first=this.samples[0].x,last=this.samples.at(-1).x,dx=Math.max(1,last-first),dy=Math.max(1,maxY-minY);
  ctx.fillText(String(maxY),8,30);ctx.fillText(String(minY),8,135);
  ctx.fillText(String(first),35,154);ctx.fillText(String(last),Math.max(40,width-65),154);
  ctx.strokeStyle='#395165';ctx.beginPath();ctx.moveTo(35,24);ctx.lineTo(35,137);ctx.lineTo(width-8,137);ctx.stroke();
  for(let i=0;i<this.samples.at(-1).values.length;i++){
   ctx.strokeStyle=warriorColor(i);ctx.beginPath();
   this.samples.forEach((p,j)=>{const x=35+(width-48)*(p.x-first)/dx,y=136-108*(p.values[i]-minY)/dy;j?ctx.lineTo(x,y):ctx.moveTo(x,y);});
   ctx.stroke();
  }
 }
}
