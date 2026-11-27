import { TAU, rng, lerp, clamp } from './math.js';

export const PATTERNS = {
  all: { name: '全部纹理', en: 'ALL SPECIMENS' },
  feather: { name: '羽状纹', en: 'FEATHER AGATE', note: '晶脉沿生长方向舒展，形成轻盈的羽状分岔。', index: '01' },
  dendrite: { name: '树枝纹', en: 'DENDRITIC AGATE', note: '锰质矿物沿微隙迁移，留下树枝般的天然印记。', index: '02' },
  concentric: { name: '同心纹', en: 'FORTIFICATION AGATE', note: '二氧化硅逐层沉积，记录周而复始的生长节律。', index: '03' },
};

const layout = [
  [119,228,1.02,.94,-.12,'feather',11,'AG–01'],
  [287,226,.87,.92,.11,'concentric',27,'AG–02'],
  [435,224,.94,1.04,-.09,'dendrite',38,'AG–03'],
  [588,230,.91,.91,.09,'feather',54,'AG–04'],
  [753,229,.79,.93,-.09,'concentric',76,'AG–05'],
  [116,378,.83,.97,.11,'concentric',85,'AG–06'],
  [276,378,1.02,.99,-.10,'dendrite',98,'AG–07'],
  [444,379,.91,.98,.06,'concentric',113,'AG–08'],
  [609,381,.91,.87,-.05,'dendrite',128,'AG–09'],
  [765,377,.72,.85,.10,'feather',147,'AG–10'],
  [131,539,.91,1.05,.08,'dendrite',166,'AG–11'],
  [314,535,1.15,1.08,-.10,'concentric',192,'AG–12'],
  [508,533,.95,.85,.11,'dendrite',212,'AG–13'],
  [704,529,1.00,1.05,-.08,'concentric',232,'AG–14'],
];

function makeSlice(x,y,sx,sy,rot,pattern,seed,id,index) {
  const rand = rng(seed), n = 100;
  const h = Array.from({length: 8}, () => rand() * TAU);
  const amps = Array.from({length: 5}, () => .025 + rand() * .042);
  const points = [], inner = [];
  for (let i=0; i<n; i++) {
    const a = i/n*TAU;
    let r = 1;
    for (let k=0;k<5;k++) r += Math.sin(a*(k+2)+h[k])*amps[k];
    const xx = Math.cos(a)*67*r, yy = Math.sin(a)*53*r;
    points.push([xx, yy]); inner.push([xx*.83, yy*.83]);
  }
  const branches = [];
  function branch(x0,y0,angle,length,depth,spread=1) {
    if (depth < 0 || length < 3) return;
    const bend=(rand()-.5)*.32;
    const x1=x0+Math.cos(angle+bend)*length, y1=y0+Math.sin(angle+bend)*length;
    branches.push({x0,y0,x1:(x0+x1)/2+(rand()-.5)*4,y1:(y0+y1)/2,x2:x1,y2:y1,w:Math.max(.48,depth*.42)});
    branch(x1,y1,angle+(rand()-.5)*.34,length*(.70+rand()*.08),depth-1);
    if(depth>1) {
      branch(x1,y1,angle-(.45+rand()*.45)*spread,length*.51,depth-2);
      branch(x1,y1,angle+(.42+rand()*.5)*spread,length*.46,depth-2);
    }
  }
  branch(-7,41,-Math.PI/2,21,6);
  branch(-12,18,-2.0,19,4);
  branch(13,44,-1.35,16,5);
  branch(28,28,-.92,11,4);
  const feathers = [];
  for(let i=0;i<30;i++) {
    const v=i/29, yy=39-v*78;
    const width=Math.sin(v*Math.PI)*35+10;
    feathers.push({yy,width,slant:(rand()-.5)*5});
  }
  return {x,y,sx,sy,rot,pattern,seed,id,index,points,inner,branches,feathers,phase:rand()*TAU};
}
export const slices = layout.map((s,i)=>makeSlice(...s,i));

function shape(ctx, points, scale=1) {
  ctx.beginPath(); ctx.moveTo(points[0][0]*scale, points[0][1]*scale);
  for(let i=1;i<points.length;i++)ctx.lineTo(points[i][0]*scale,points[i][1]*scale);
  ctx.closePath();
}
function ringFill(ctx,s,scale,color,stroke=null,width=.6) {
  shape(ctx,s.points,scale);ctx.fillStyle=color;ctx.fill();
  if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.stroke();}
}
function drawBase(ctx,s,phase,focus,selected) {
  const glow = ctx.createRadialGradient(0,0,5,0,0,94);
  glow.addColorStop(0,selected ? 'rgba(255,241,193,.5)' : 'rgba(237,171,94,.16)');
  glow.addColorStop(1,'rgba(237,171,94,0)');
  ctx.fillStyle=glow;ctx.fillRect(-96,-85,192,170);
  ctx.save();ctx.translate(3,6);ringFill(ctx,s,1.025,'rgba(9,7,4,.58)');ctx.restore();
  ringFill(ctx,s,1.015,'#34271d','#9d7960',.8);
  ringFill(ctx,s,.985,'#69431e','#c39549',1.3);
  ringFill(ctx,s,.951,'#9e5d27','#d2a466',1.1);
  ringFill(ctx,s,.915,'#c39c6b','#573b27',1.2);
  ringFill(ctx,s,.887,'#e5c99c','#f4e4bf',.8);
  ringFill(ctx,s,.854,'#846f59','#ae8d65',1.6);
  ringFill(ctx,s,.827,'#d0c0a3','#f4e7cd',1.1);
  const g=ctx.createRadialGradient(-18,-20,2,0,5,70);
  const mineral=['#d8d4c4','#d7cfbb','#e3d4b8','#c7c9bd'][s.seed%4],middle=['#a4aaa1','#b7a897','#b8af97','#969f98'][s.seed%4];
  g.addColorStop(0,selected?'#f7eed7':mineral);g.addColorStop(.52,middle);g.addColorStop(1,s.seed%2?'#787469':'#727b72');
  ringFill(ctx,s,.805,g,'#6c5b43',.7);
  ctx.save();shape(ctx,s.points,.795);ctx.clip();
  // Wisps of translucent silica between successive growth fronts.
  for(let i=0;i<13;i++){
    const q=.76-i*.046;
    shape(ctx,s.points,q);
    ctx.strokeStyle=i%3===0?'rgba(255,247,218,.48)':i%3===1?'rgba(88,75,62,.44)':'rgba(179,119,59,.30)';
    ctx.lineWidth=(i%4===0?2.5:.75)+(focus?.32:0);ctx.stroke();
  }
  return g;
}
function drawConcentric(ctx,s,focus,selected) {
  for(let i=0;i<23;i++) {
    const q=.65-i*.021;
    shape(ctx,s.points,q);ctx.strokeStyle=i%5===0?'rgba(105,55,23,.82)':i%3===0?'rgba(246,229,192,.86)':'rgba(92,81,71,.58)';
    ctx.lineWidth=(i%5===0?2.25:i%3===0?1.6:.75)+(selected?.3:0);ctx.stroke();
  }
    shape(ctx,s.points,.15);ctx.fillStyle='rgba(80,72,63,.62)';ctx.fill();
  for(let j=0;j<13;j++){
    const a=j/13*TAU+s.phase;
    ctx.beginPath();ctx.moveTo(Math.cos(a)*9,Math.sin(a)*8);
    ctx.quadraticCurveTo(Math.cos(a+.08)*31,Math.sin(a+.12)*25,Math.cos(a-.02)*51,Math.sin(a-.02)*40);
    ctx.strokeStyle='rgba(246,239,216,.25)';ctx.lineWidth=.55;ctx.stroke();
  }
}
function drawFeather(ctx,s,focus,selected) {
  const grad=ctx.createLinearGradient(-40,-45,40,45);grad.addColorStop(0,'rgba(244,235,207,.3)');grad.addColorStop(.5,'rgba(89,62,42,.52)');grad.addColorStop(1,'rgba(220,199,160,.25)');
  ctx.fillStyle=grad;ctx.fillRect(-65,-55,130,110);
  for(let k=0;k<3;k++) {
    const shift=(k-1)*12;
    ctx.beginPath();ctx.moveTo(shift,46);ctx.bezierCurveTo(shift-15,15,shift+10,-12,shift+2,-48);
    ctx.strokeStyle=k===1?'rgba(72,54,41,.90)':'rgba(241,218,179,.75)';ctx.lineWidth=k===1?2.4:1.1;ctx.stroke();
  }
  for(const f of s.feathers) {
    const rise=12;
    for(const side of [-1,1]) {
      ctx.beginPath();ctx.moveTo(0,f.yy);
      ctx.bezierCurveTo(side*f.width*.15,f.yy-1,side*f.width*.48,f.yy-rise*.25,side*f.width,f.yy-rise+f.slant);
      ctx.bezierCurveTo(side*f.width*.55,f.yy-rise*.15+f.slant,side*f.width*.20,f.yy-5,0,f.yy+1.7);
      ctx.fillStyle=focus?'rgba(246,228,191,.85)':'rgba(69,53,42,.70)';ctx.fill();
      ctx.strokeStyle=selected?'rgba(255,245,211,.94)':'rgba(226,204,166,.68)';ctx.lineWidth=.67;ctx.stroke();
      ctx.beginPath();ctx.moveTo(0,f.yy);ctx.quadraticCurveTo(side*f.width*.45,f.yy-rise*.22,side*f.width*1.08,f.yy-rise+f.slant);
      ctx.strokeStyle=selected?'rgba(69,51,35,.65)':'rgba(45,35,29,.76)';ctx.lineWidth=.78;ctx.stroke();
    }
  }
  for(let i=0;i<7;i++){shape(ctx,s.points,.72-i*.073);ctx.strokeStyle='rgba(244,232,204,.14)';ctx.lineWidth=.55;ctx.stroke();}
}
function drawDendrite(ctx,s,focus,selected) {
  const bg=ctx.createLinearGradient(-50,-45,50,45);bg.addColorStop(0,'rgba(239,213,158,.4)');bg.addColorStop(.48,'rgba(186,114,49,.28)');bg.addColorStop(1,'rgba(48,39,31,.24)');
  ctx.fillStyle=bg;ctx.fillRect(-70,-60,140,120);
  for(let i=0;i<8;i++){shape(ctx,s.points,.74-i*.071);ctx.strokeStyle='rgba(229,203,163,.17)';ctx.lineWidth=.8;ctx.stroke();}
  for(const b of s.branches) {
    ctx.beginPath();ctx.moveTo(b.x0,b.y0);ctx.quadraticCurveTo(b.x1,b.y1,b.x2,b.y2);
    ctx.strokeStyle=selected?'rgba(31,29,24,.98)':'rgba(40,39,31,.93)';
    ctx.lineWidth=b.w*(focus?1.13:1);ctx.lineCap='round';ctx.stroke();
    if(b.w>1){ctx.strokeStyle='rgba(203,176,121,.3)';ctx.lineWidth=.32;ctx.stroke();}
  }
}
function drawCrystalLight(ctx,s,t,selected) {
  ctx.save();ctx.globalCompositeOperation='screen';
  const x=Math.sin(t*TAU+s.phase)*72;
  const beam=ctx.createLinearGradient(x-25,0,x+25,0);
  beam.addColorStop(0,'rgba(255,241,206,0)');beam.addColorStop(.5,selected?'rgba(255,247,213,.24)':'rgba(255,247,213,.09)');beam.addColorStop(1,'rgba(255,241,206,0)');
  ctx.fillStyle=beam;ctx.fillRect(-90,-65,180,130);ctx.restore();
  ctx.save();ctx.globalCompositeOperation='screen';
  const sheen=ctx.createLinearGradient(-50,-45,40,25);sheen.addColorStop(0,'rgba(255,255,235,.25)');sheen.addColorStop(.4,'rgba(255,255,235,0)');sheen.addColorStop(1,'rgba(255,223,166,.12)');
  shape(ctx,s.points,.79);ctx.fillStyle=sheen;ctx.fill();ctx.restore();
}
export function drawAgate(ctx, s, t, filter, selectedIndex=-1) {
  const focus=filter!=='all'&&s.pattern===filter, selected=selectedIndex===s.index||focus;
  const dormant=filter!=='all'&&!focus;
  ctx.save();ctx.translate(s.x,s.y);ctx.rotate(s.rot);ctx.scale(s.sx,s.sy);
  ctx.globalAlpha=dormant?.48:1;
  drawBase(ctx,s,t,focus,selected);
  if(s.pattern==='concentric')drawConcentric(ctx,s,focus,selected);
  if(s.pattern==='feather')drawFeather(ctx,s,focus,selected);
  if(s.pattern==='dendrite')drawDendrite(ctx,s,focus,selected);
  drawCrystalLight(ctx,s,t,selected);
  ctx.restore(); // release the mineral's internal clip
  ctx.restore(); // release the whole specimen transform
  if(selected){
    ctx.save();ctx.globalCompositeOperation='screen';ctx.translate(s.x,s.y);ctx.rotate(s.rot);ctx.scale(s.sx,s.sy);
    shape(ctx,s.points,1.04);ctx.strokeStyle=`rgba(255,222,154,${.40+.18*Math.sin(t*TAU+s.phase)})`;ctx.lineWidth=1.4/s.sx;ctx.stroke();ctx.restore();
  }
  ctx.save();ctx.globalAlpha=dormant?.35:.85;
  // tiny museum inventory tabs, outside each slice's silhouette
  ctx.fillStyle=dormant?'#4b473e':'#d8c99f';ctx.fillRect(s.x-18,s.y+57*s.sy,36,10);
  ctx.fillStyle='#39382f';ctx.font='6px monospace';ctx.textAlign='center';ctx.fillText(s.id,s.x,s.y+64*s.sy);ctx.restore();
}
export function sliceAt(x,y) {
  let hit=-1, best=Infinity;
  for(const s of slices){const dx=(x-s.x)/(70*s.sx),dy=(y-s.y)/(59*s.sy);const d=dx*dx+dy*dy;if(d<1.1&&d<best){hit=s.index;best=d;}}
  return hit;
}
