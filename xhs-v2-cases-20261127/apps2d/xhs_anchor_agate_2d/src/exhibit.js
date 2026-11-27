import { TAU, polygon, roundRect, line, text, trackingText, rng, clamp } from './math.js';
import { drawAgate, slices, PATTERNS } from './agates.js';
import { drawRock } from './rocks.js';

function drawMapCard(ctx,state) {
  ctx.save();ctx.transform(1,-.047,-.68,.57,232,674);
  roundRect(ctx,0,0,500,218,4);ctx.fillStyle='#c7c2a8';ctx.fill();ctx.strokeStyle='#e1d7b9';ctx.lineWidth=2;ctx.stroke();
  roundRect(ctx,9,9,482,200,2);ctx.strokeStyle='#777563';ctx.lineWidth=.7;ctx.stroke();
  text(ctx,'中国玛瑙产地分布',23,36,19,'#303a34','left','600');
  text(ctx,'AGATE LOCALITIES OF CHINA',24,54,7.5,'#4d5750');
  // Original schematic map of China, deliberately drawn as a mineral locality chart.
  const china=[[94,96],[110,77],[137,79],[153,57],[195,60],[207,74],[237,68],[256,74],[281,67],[292,78],[312,69],[321,91],[339,91],[329,110],[307,116],[305,133],[288,138],[277,157],[262,160],[248,181],[232,172],[227,152],[209,147],[192,158],[176,151],[158,164],[142,150],[118,145],[108,128],[87,119]];
  polygon(ctx,[[china[0][0]+5,china[0][1]+6],...china.slice(1).map(p=>[p[0]+5,p[1]+6])]);ctx.fillStyle='rgba(45,48,39,.15)';ctx.fill();
  polygon(ctx,china);ctx.fillStyle='#a8ad91';ctx.fill();ctx.strokeStyle='#f2ecd2';ctx.lineWidth=1.3;ctx.stroke();
  ctx.save();polygon(ctx,china);ctx.clip();
  const provinces=[[[132,66],[129,147]],[[175,57],[169,149]],[[219,63],[210,150]],[[263,68],[246,175]],[[91,100],[311,106]],[[118,131],[280,132]],[[171,151],[296,148]]];
  for(const pts of provinces){ctx.beginPath();ctx.moveTo(...pts[0]);ctx.lineTo(...pts[1]);ctx.strokeStyle='#727b6a';ctx.lineWidth=.7;ctx.stroke();}
  const washes=[[110,83,175,69,161,106,100,115],[165,63,231,66,226,111,168,106],[100,115,164,106,158,150,118,141],[226,68,312,75,296,111,226,110],[164,107,225,110,241,154,175,145]];
  const colors=['#c99775aa','#a1a79088','#d1b17688','#879e8788','#bd806988'];
  washes.forEach((p,i)=>{polygon(ctx,p.map(v=>[v[0],v[1]]));ctx.fillStyle=colors[i];ctx.fill();});
  ctx.restore();
  const localities=[[201,82,'辽宁'],[268,94,'内蒙古'],[177,122,'河北'],[231,139,'湖北'],[145,132,'新疆']];
  for(const [x,y,label] of localities){
    ctx.beginPath();ctx.arc(x,y,3.3,0,TAU);ctx.fillStyle='#6b3025';ctx.fill();ctx.strokeStyle='#efe6ca';ctx.lineWidth=.8;ctx.stroke();
    text(ctx,label,x+7,y+3,8,'#34473b');
  }
  polygon(ctx,[[255,176],[264,171],[261,181]]);ctx.fillStyle='#9da789';ctx.fill();
  // legend and geological time column
  text(ctx,'图例  LOCALITIES',342,67,8,'#374b40','left','600');
  const legend=[['#6b3025','主要玛瑙产地'],['#c18860','沉积 / 火山沉积'],['#859c83','硅质热液活动区']];
  legend.forEach((l,i)=>{ctx.fillStyle=l[0];ctx.fillRect(343,82+i*23,12,7);text(ctx,l[1],362,89+i*23,8,'#4b5449');});
  line(ctx,342,158,469,158,'#6c77684d');text(ctx,'采集 · 切片 · 透光观察',342,179,9,'#465146');text(ctx,'EARTH ARCHIVE / CN–04',342,195,7,'#687064');
  ctx.restore();
}
function drawRuler(ctx,state) {
  const x=863;
  line(ctx,x,133,x,616,'#92866b55');
  text(ctx,'纹理导览',882,156,12,'#cfc3a7');text(ctx,'TEXTURE INDEX',882,174,6.5,'#776f60');
  const cats=[['feather',260],['dendrite',390],['concentric',520]];
  cats.forEach(([key,y])=>{
    const active=state.filter==='all'||state.filter===key;
    ctx.globalAlpha=active?1:.3;
    ctx.fillStyle=active?'#b9a77e':'#635f52';ctx.fillRect(x-1,y-17,2,34);
    text(ctx,PATTERNS[key].index,882,y-14,7,'#8c8068');
    text(ctx,PATTERNS[key].name,882,y+6,14,active?'#ded3b7':'#8d8777','left','500');
    text(ctx,PATTERNS[key].en,882,y+23,6.3,'#877f6b');
    line(ctx,882,y+38,946,y+38,'#9a8b6b44');
    ctx.globalAlpha=1;
  });
  for(let y=145;y<614;y+=14){ctx.fillStyle='#9d987a33';ctx.fillRect(x-4,y,y%28===5?8:4,1);}
}
function drawCabinet(ctx,state) {
  // shadow and deep anodised frame
  ctx.shadowColor='rgba(0,0,0,.75)';ctx.shadowBlur=26;ctx.shadowOffsetY=10;
  roundRect(ctx,26,24,926,704,3);ctx.fillStyle='#141716';ctx.fill();ctx.shadowBlur=0;ctx.shadowOffsetY=0;
  const bevel=ctx.createLinearGradient(26,0,953,0);bevel.addColorStop(0,'#343730');bevel.addColorStop(.06,'#1e211e');bevel.addColorStop(.86,'#101311');bevel.addColorStop(1,'#3a3b32');
  ctx.fillStyle=bevel;ctx.fillRect(26,24,926,704);
  ctx.fillStyle='#0a0c0c';ctx.fillRect(37,36,903,91);
  line(ctx,42,35,938,35,'#91856866');line(ctx,44,126,939,126,'#030505');
  trackingText(ctx,'玛瑙的多样纹理',59,78,4,28,'#e0d4b7');
  trackingText(ctx,'AGATE PATTERNS',60,104,2.5,11,'#a69d87');
  text(ctx,'天然造物的层叠秩序',370,72,10,'#79796e');text(ctx,'SILICA  /  TIME  /  LIGHT',370,94,7,'#696d64');
  // backlit translucent display
  const pulse=.96+.025*Math.sin(state.phase);
  const back=ctx.createLinearGradient(55,132,836,612);
  back.addColorStop(0,`rgba(${Math.round(203*pulse)},${Math.round(184*pulse)},145,1)`);
  back.addColorStop(.33,`rgba(237,221,184,1)`);back.addColorStop(.75,'#b7ae91');back.addColorStop(1,'#8d8b76');
  ctx.fillStyle=back;ctx.fillRect(48,132,799,486);
  const ambient=ctx.createRadialGradient(320,342,40,360,360,480);ambient.addColorStop(0,'rgba(255,249,221,.50)');ambient.addColorStop(1,'rgba(60,63,49,.4)');ctx.fillStyle=ambient;ctx.fillRect(48,132,799,486);
  ctx.save();ctx.globalCompositeOperation='multiply';ctx.fillStyle='rgba(44,50,47,.27)';ctx.fillRect(48,132,799,48);ctx.restore();
  line(ctx,49,134,847,134,'#f4e7c9aa',2);line(ctx,54,613,846,613,'#696951');
  if(state.filter!=='all') {
    ctx.save();ctx.globalCompositeOperation='screen';
    slices.filter(s=>s.pattern===state.filter).forEach(s=>{const halo=ctx.createRadialGradient(s.x,s.y,15,s.x,s.y,95);halo.addColorStop(0,'rgba(255,232,177,.19)');halo.addColorStop(1,'rgba(255,225,165,0)');ctx.fillStyle=halo;ctx.fillRect(s.x-95,s.y-95,190,190);});ctx.restore();
  }
  for(const s of slices)drawAgate(ctx,s,state.t,state.filter,state.selectedSlice);
  drawRuler(ctx,state);
  // tiny glass edge reflections
  ctx.fillStyle='rgba(255,250,223,.13)';ctx.fillRect(53,137,2,474);
  polygon(ctx,[[850,132],[952,127],[952,725],[850,618]]);ctx.fillStyle='#111513';ctx.fill();
  drawRuler(ctx,state);
  // Angled geological map lightbox and flanking rock specimens.
  polygon(ctx,[[45,633],[852,628],[946,728],[35,825]]);const plane=ctx.createLinearGradient(0,637,0,830);plane.addColorStop(0,'#6b6c59');plane.addColorStop(.08,'#b4b098');plane.addColorStop(.5,'#676b5c');plane.addColorStop(1,'#30352e');ctx.fillStyle=plane;ctx.fill();
  polygon(ctx,[[64,648],[126,642],[180,773],[45,792]]);ctx.fillStyle='#3c4037';ctx.fill();ctx.strokeStyle='#91917a';ctx.stroke();
  polygon(ctx,[[722,640],[842,639],[920,709],[771,742]]);ctx.fillStyle='#3a3e34';ctx.fill();ctx.strokeStyle='#96947b';ctx.stroke();
  drawRock(ctx,106,702,.96,324);drawRock(ctx,805,680,.78,692);
  text(ctx,'围岩标本',64,797,9,'#b6b099');text(ctx,'HOST ROCK · 01',65,811,6,'#7b8275');
  text(ctx,'原生矿石',803,748,8,'#c1b899');text(ctx,'ROUGH AGATE · 02',801,762,6,'#7b8275');
  drawMapCard(ctx,state);
  line(ctx,35,825,946,728,'#b5aa8166',1.2);
  polygon(ctx,[[35,826],[946,729],[944,747],[35,840]]);ctx.fillStyle='#121814';ctx.fill();
  // lower cabinet face
  polygon(ctx,[[34,841],[943,748],[951,804],[945,849],[34,878]]);ctx.fillStyle='#141a17';ctx.fill();
  line(ctx,47,854,927,765,'#454b3e',1);
}
export function drawExhibit(ctx,state) { drawCabinet(ctx,state); }
