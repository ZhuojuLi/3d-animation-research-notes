import { TAU, rng, polygon, roundRect, line, text, trackingText, clamp, lerp } from './math.js';

const coreRand=rng(12091);
const cores=Array.from({length:12},(_,i)=>({i,chip:coreRand(),rings:Array.from({length:6},()=>coreRand()),cracks:Array.from({length:4},()=>[coreRand(),coreRand(),coreRand()])}));
function panel(ctx,x,y,w,h,title,en,type) {
  ctx.shadowColor='#0009';ctx.shadowBlur=14;ctx.shadowOffsetY=5;ctx.fillStyle='#101613';ctx.fillRect(x,y,w,h);ctx.shadowBlur=0;ctx.shadowOffsetY=0;
  ctx.strokeStyle='#726a473d';ctx.lineWidth=1;ctx.strokeRect(x+.5,y+.5,w-1,h-1);
  text(ctx,title,x+18,y+36,17,'#b8aa7e','left','500');trackingText(ctx,en,x+19,y+55,1.1,6.6,'#77775f');
  line(ctx,x+18,y+67,x+w-18,y+67,'#726d4d66');
  if(type===0){
    const g=ctx.createLinearGradient(0,y+80,0,y+h-34);g.addColorStop(0,'#655539');g.addColorStop(.3,'#332f26');g.addColorStop(.7,'#5d5940');g.addColorStop(1,'#202c25');ctx.fillStyle=g;ctx.fillRect(x+17,y+79,w-34,h-126);
    ctx.save();ctx.beginPath();ctx.rect(x+17,y+79,w-34,h-126);ctx.clip();
    for(let i=0;i<17;i++){
      const yy=y+91+i*8;
      ctx.beginPath();ctx.moveTo(x+10,yy);ctx.bezierCurveTo(x+35,yy+12,x+75,yy-7,x+w-8,yy+3);ctx.strokeStyle=i%4===0?'#b49c6455':'#2f302877';ctx.lineWidth=i%4===0?2.5:3.5;ctx.stroke();
    }
    // stylised intrusive agate formation
    ctx.beginPath();ctx.moveTo(x+53,y+230);ctx.bezierCurveTo(x+22,y+184,x+57,y+120,x+84,y+104);ctx.bezierCurveTo(x+117,y+114,x+131,y+180,x+106,y+226);ctx.closePath();
    ctx.fillStyle='#30271e';ctx.fill();ctx.strokeStyle='#b0975e';ctx.lineWidth=3;ctx.stroke();
    for(let j=0;j<8;j++){ctx.beginPath();ctx.ellipse(x+81,y+170,29-j*3,50-j*5,-.13,0,TAU);ctx.strokeStyle=j%2?'#b3aa8055':'#171c18aa';ctx.lineWidth=1.4;ctx.stroke();}
    ctx.restore();
    text(ctx,'火山热液中的二氧化硅沉积',x+18,y+h-24,8,'#8f8e74');
  } else {
    const g=ctx.createLinearGradient(x+20,y+80,x+w-30,y+h-30);g.addColorStop(0,'#57442a');g.addColorStop(.5,'#26372d');g.addColorStop(1,'#765b35');ctx.fillStyle=g;ctx.fillRect(x+17,y+79,w-34,h-126);
    ctx.save();ctx.beginPath();ctx.rect(x+17,y+79,w-34,h-126);ctx.clip();
    for(let i=0;i<25;i++){
      const yy=y+78+i*8;
      ctx.beginPath();ctx.moveTo(x+12,yy+25);ctx.bezierCurveTo(x+35,yy-8,x+55,yy+22,x+w-9,yy-12);ctx.strokeStyle=i%5===0?'#b79f6466':i%3===0?'#112a24bb':'#786b4855';ctx.lineWidth=2+i%3;ctx.stroke();
    }
    // crystal druse in the wall display
    const rand=rng(562);
    for(let i=0;i<50;i++){
      const xx=x+31+rand()*(w-64),yy=y+96+rand()*(h-160),r=2+rand()*6;
      polygon(ctx,[[xx-r,yy+r],[xx-r*.5,yy-r],[xx+r*.6,yy-r*.8],[xx+r,yy+r]]);ctx.fillStyle=i%3?'#9d956551':'#dfd0a344';ctx.fill();
    }
    ctx.restore();text(ctx,'结晶作用将深时封存在层理之间',x+18,y+h-24,8,'#8f8e74');
  }
}
export function drawRoom(ctx,state) {
  const bg=ctx.createLinearGradient(0,0,1460,870);bg.addColorStop(0,'#20231d');bg.addColorStop(.52,'#151c18');bg.addColorStop(1,'#25251c');ctx.fillStyle=bg;ctx.fillRect(0,0,1600,900);
  polygon(ctx,[[951,0],[1600,0],[1600,472],[951,510]]);const wall=ctx.createLinearGradient(940,0,1600,0);wall.addColorStop(0,'#171d18');wall.addColorStop(.5,'#2a2d22');wall.addColorStop(1,'#111a17');ctx.fillStyle=wall;ctx.fill();
  // Receding ceiling ribs and architectural seams establish depth.
  polygon(ctx,[[941,0],[1600,0],[1600,19],[966,54]]);ctx.fillStyle='#090e0c';ctx.fill();
  for(let i=0;i<5;i++){const xx=1004+i*141;line(ctx,xx,21,xx+18,470,'#6c68442a',1);line(ctx,xx+4,20,xx+21,470,'#05090888',3);}
  line(ctx,960,62,1600,31,'#84734a55',2);line(ctx,960,69,1600,38,'#111812',4);
  for(let x=992;x<1600;x+=195){ctx.fillStyle='#c4ad6b22';ctx.fillRect(x,39,65,2);}
  panel(ctx,983,86,236,298,'从岩石到宝石','FROM ROCK TO GEM',0);
  panel(ctx,1291,55,254,308,'地球的记忆','MEMORY OF THE EARTH',1);
  // distant museum bench and display drawers
  polygon(ctx,[[974,392],[1539,373],[1560,421],[976,450]]);ctx.fillStyle='#171e18';ctx.fill();
  for(let i=0;i<3;i++){ctx.fillStyle=i%2?'#24271d':'#1b201a';ctx.fillRect(1000+i*168,397-i*2,145,42);line(ctx,1004+i*168,400-i*2,1140+i*168,398-i*2,'#6a654445');ctx.fillStyle='#7d715133';ctx.fillRect(1062+i*168,414-i*2,24,2);}
  // floor perspective, with stone joints
  polygon(ctx,[[0,681],[1600,478],[1600,900],[0,900]]);const floor=ctx.createLinearGradient(0,550,0,900);floor.addColorStop(0,'#1a211b');floor.addColorStop(1,'#0c1311');ctx.fillStyle=floor;ctx.fill();
  for(let i=0;i<8;i++){line(ctx,970+i*96,519,927+i*156,900,'#5a5b4324');}
  for(let y=563;y<900;y+=65){line(ctx,930,y,1600,y-77,'#6c664529');}
  const vignette=ctx.createRadialGradient(1210,410,30,1240,430,460);vignette.addColorStop(0,'rgba(147,130,81,.09)');vignette.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=vignette;ctx.fillRect(900,0,700,900);
}
function drawLampCone(ctx,state) {
  const power=state.lamp/100;
  ctx.save();ctx.globalCompositeOperation='screen';
  const cone=ctx.createLinearGradient(1328,307,1150,670);cone.addColorStop(0,`rgba(255,231,174,${.36*power})`);cone.addColorStop(.52,`rgba(236,186,111,${.15*power})`);cone.addColorStop(1,'rgba(255,210,138,0)');
  polygon(ctx,[[1309,311],[1335,291],[1502,651],[1023,685]]);ctx.fillStyle=cone;ctx.fill();
  const pool=ctx.createRadialGradient(1217,555,10,1217,555,206);pool.addColorStop(0,`rgba(255,225,164,${.19*power})`);pool.addColorStop(1,'rgba(247,195,115,0)');ctx.save();ctx.scale(1,.36);ctx.fillStyle=pool;ctx.beginPath();ctx.ellipse(1217,1540,190,192,0,0,TAU);ctx.fill();ctx.restore();ctx.restore();
}
function drawPolisher(ctx,state) {
  const on=state.polisherOn, power=.65+state.lamp/190;
  // vibration is rotational only; the heavy machine body remains rigidly mounted.
  polygon(ctx,[[1051,463],[1174,450],[1231,482],[1100,507]]);ctx.fillStyle='#343d36';ctx.fill();
  polygon(ctx,[[1100,507],[1231,482],[1230,500],[1101,526]]);ctx.fillStyle='#19251f';ctx.fill();
  line(ctx,1052,463,1174,450,'#9b9d8077');
  for(const x of [1073,1150]){roundRect(ctx,x,493,18,21,2);ctx.fillStyle='#252b24';ctx.fill();ctx.fillStyle='#94927a';ctx.fillRect(x+5,509,8,4);}
  // horizontal motor cylinder with axial brushed-metal shading
  ctx.save();ctx.translate(1108,418);ctx.rotate(-.075);
  roundRect(ctx,-50,-29,117,59,19);const body=ctx.createLinearGradient(0,-29,0,30);body.addColorStop(0,'#5f675a');body.addColorStop(.22,`rgba(207,207,173,${power})`);body.addColorStop(.47,`rgb(${Math.round(75+state.lamp*.55)},${Math.round(85+state.lamp*.48)},${Math.round(74+state.lamp*.35)})`);body.addColorStop(.78,'#343f36');body.addColorStop(1,'#202c25');ctx.fillStyle=body;ctx.fill();ctx.strokeStyle='#9b9b7e';ctx.lineWidth=.9;ctx.stroke();
  ctx.beginPath();ctx.ellipse(-49,0,10,28,0,0,TAU);ctx.fillStyle='#454f44';ctx.fill();ctx.strokeStyle='#979b7c';ctx.stroke();
  for(let i=0;i<8;i++){ctx.fillStyle=i%2?'#303a31':'#8d9378';ctx.fillRect(-35+i*8,-27,3,54);}
  for(const xx of [-39,53]){roundRect(ctx,xx,-32,13,65,5);ctx.fillStyle='#495449';ctx.fill();ctx.strokeStyle='#a4a38b';ctx.stroke();}
  // ventilation housing and central maker plate
  roundRect(ctx,-1,-13,43,27,2);ctx.fillStyle='#313c33';ctx.fill();for(let i=0;i<7;i++)line(ctx,4+i*5,-9,4+i*5,9,'#9a9c7c66');
  ctx.restore();
  // opaque bearing, shaft, water nozzle and chuck
  polygon(ctx,[[1160,405],[1197,402],[1202,420],[1163,424]]);const shaft=ctx.createLinearGradient(0,404,0,424);shaft.addColorStop(0,'#d1cdb1');shaft.addColorStop(.35,'#6d776b');shaft.addColorStop(.7,'#c0c3a9');shaft.addColorStop(1,'#36443c');ctx.fillStyle=shaft;ctx.fill();
  ctx.beginPath();ctx.ellipse(1197,411,5,9,0,0,TAU);ctx.fillStyle='#333f37';ctx.fill();
  ctx.beginPath();ctx.moveTo(1165,399);ctx.lineTo(1167,373);ctx.quadraticCurveTo(1170,361,1181,367);ctx.lineTo(1202,385);ctx.strokeStyle='#9da896';ctx.lineWidth=5;ctx.stroke();ctx.strokeStyle='#3b4c42';ctx.lineWidth=2;ctx.stroke();
  ctx.fillStyle=on?'#a4d3bf':'#617367';ctx.fillRect(1198,382,4,6);
  // rotating polishing wheel, transformed as one rigid disk about its axle
  ctx.save();ctx.translate(1220,412);
  ctx.beginPath();ctx.ellipse(0,0,16,52,0,0,TAU);ctx.fillStyle='#17241f';ctx.fill();
  ctx.save();ctx.scale(.29,1);ctx.rotate(on?state.phase*4:state.phase*.035);
  const disc=ctx.createRadialGradient(-9,-9,3,0,0,49);disc.addColorStop(0,on?'#c3bca3':'#999b89');disc.addColorStop(.65,'#5d695e');disc.addColorStop(1,'#28382f');ctx.fillStyle=disc;ctx.beginPath();ctx.arc(0,0,49,0,TAU);ctx.fill();
  for(let i=0;i<16;i++){const a=i/16*TAU;line(ctx,Math.cos(a)*8,Math.sin(a)*8,Math.cos(a+.11)*45,Math.sin(a+.11)*45,i%4===0?'#d7d2ad99':'#a1a98c44',i%4===0?1.4:.7);}
  ctx.beginPath();ctx.arc(0,0,42,0,TAU);ctx.strokeStyle='#e0d8b67a';ctx.lineWidth=1;ctx.stroke();ctx.beginPath();ctx.arc(0,0,35,0,TAU);ctx.strokeStyle='#253a30aa';ctx.lineWidth=3;ctx.stroke();
  ctx.restore();ctx.beginPath();ctx.ellipse(0,0,16,52,0,0,TAU);ctx.strokeStyle='#b6b79b';ctx.lineWidth=1.2;ctx.stroke();
  ctx.beginPath();ctx.ellipse(0,0,5,10,0,0,TAU);ctx.fillStyle='#28342d';ctx.fill();ctx.strokeStyle='#b4b59c';ctx.stroke();ctx.restore();
  // transparent splash hood, slim and optically reflective
  ctx.beginPath();ctx.moveTo(1197,364);ctx.quadraticCurveTo(1247,347,1263,383);ctx.lineTo(1260,441);ctx.quadraticCurveTo(1250,466,1237,468);ctx.strokeStyle='#a3afa088';ctx.lineWidth=2.2;ctx.stroke();
  ctx.beginPath();ctx.moveTo(1200,365);ctx.quadraticCurveTo(1242,355,1258,382);ctx.strokeStyle='#e0dbc077';ctx.lineWidth=.7;ctx.stroke();
  // status plate and a grounded switch
  roundRect(ctx,1073,469,89,16,1);ctx.fillStyle='#1b251f';ctx.fill();text(ctx,'LAP–08  精密切磨',1079,480,7,'#aaa98b');
  ctx.fillStyle=on?'#b6d99b':'#564e37';ctx.fillRect(1175,470,7,4);
  if(on){
    ctx.save();ctx.globalCompositeOperation='screen';
    for(let i=0;i<5;i++){const a=state.phase*4+i*1.33;const yy=413+Math.sin(a)*28;const dx=11+((state.phase/TAU*46+i*13)%30);ctx.fillStyle=`rgba(182,212,192,${.3*(1-dx/41)})`;ctx.fillRect(1220+dx,413+(yy-413)*.6,1.4,1.4);}
    ctx.restore();
  }
}
function metalRod(ctx,a,b,width,color='#8e9585') {
  const dx=b[0]-a[0],dy=b[1]-a[1],l=Math.hypot(dx,dy),nx=-dy/l*width/2,ny=dx/l*width/2;
  polygon(ctx,[[a[0]+nx,a[1]+ny],[b[0]+nx,b[1]+ny],[b[0]-nx,b[1]-ny],[a[0]-nx,a[1]-ny]]);const g=ctx.createLinearGradient(a[0]+nx,a[1]+ny,a[0]-nx,a[1]-ny);g.addColorStop(0,'#333e36');g.addColorStop(.35,'#b0b299');g.addColorStop(.55,color);g.addColorStop(1,'#303d34');ctx.fillStyle=g;ctx.fill();ctx.strokeStyle='#b6b89a44';ctx.lineWidth=.5;ctx.stroke();
}
function pivot(ctx,p,r=8) {
  ctx.beginPath();ctx.arc(...p,r+3,0,TAU);ctx.fillStyle='#26352d';ctx.fill();ctx.strokeStyle='#919982';ctx.lineWidth=2;ctx.stroke();
  ctx.beginPath();ctx.arc(...p,r-2,0,TAU);ctx.fillStyle='#6f7b69';ctx.fill();ctx.strokeStyle='#c5c5a2';ctx.lineWidth=.8;ctx.stroke();
  ctx.beginPath();ctx.arc(...p,2.5,0,TAU);ctx.fillStyle='#25362e';ctx.fill();line(ctx,p[0]-1.5,p[1]-1.5,p[0]+1.5,p[1]+1.5,'#b6b996',.7);
}
function drawLamp(ctx,state) {
  const p0=[1440,505],p1=[1472,358],p2=[1407,249],p3=[1326,309];
  // twin bars form an articulated, rigid anglepoise structure
  metalRod(ctx,[p0[0]-9,p0[1]],[p1[0]-9,p1[1]],7);metalRod(ctx,[p0[0]+4,p0[1]-2],[p1[0]+4,p1[1]-2],7);
  metalRod(ctx,[p1[0]-5,p1[1]-3],[p2[0]-5,p2[1]-3],6);metalRod(ctx,[p1[0]+9,p1[1]-6],[p2[0]+9,p2[1]-6],6);
  metalRod(ctx,p2,[1350,279],8);metalRod(ctx,[1399,240],[1344,269],5);
  // spring and its fixings follow the same upper-arm segment, not a detached spiral.
  const ax=1420,ay=276,bx=1459,by=346,dx=bx-ax,dy=by-ay,len=Math.hypot(dx,dy),nx=-dy/len*5,ny=dx/len*5;
  ctx.beginPath();ctx.moveTo(ax,ay);for(let i=0;i<=28;i++){const q=i/28,w=i%2?1:-1;ctx.lineTo(ax+dx*q+nx*w,ay+dy*q+ny*w);}ctx.lineTo(bx,by);ctx.strokeStyle='#9b9f82';ctx.lineWidth=1.2;ctx.stroke();
  [p0,p1,p2].forEach((p,i)=>pivot(ctx,p,i===0?9:8));
  roundRect(ctx,1411,500,70,14,7);ctx.fillStyle='#354139';ctx.fill();ctx.strokeStyle='#b0af8b';ctx.stroke();ctx.beginPath();ctx.ellipse(1444,514,38,8,0,0,TAU);ctx.fillStyle='#17251e';ctx.fill();
  // shade casts in the same direction as the computed light cone
  ctx.save();ctx.translate(1325,300);ctx.rotate(-.70);
  ctx.beginPath();ctx.moveTo(-15,-13);ctx.quadraticCurveTo(0,-25,15,-13);ctx.lineTo(31,18);ctx.quadraticCurveTo(0,30,-31,18);ctx.closePath();
  const shade=ctx.createLinearGradient(-18,-20,26,22);shade.addColorStop(0,'#a5aa90');shade.addColorStop(.25,'#5e6b5a');shade.addColorStop(.55,'#24372b');shade.addColorStop(1,'#101f18');ctx.fillStyle=shade;ctx.fill();ctx.strokeStyle='#b7b795';ctx.lineWidth=.8;ctx.stroke();
  ctx.beginPath();ctx.ellipse(0,18,31,9,0,0,TAU);ctx.fillStyle=`rgba(242,221,160,${.38+state.lamp/180})`;ctx.fill();ctx.strokeStyle='#aaa98d';ctx.stroke();
  ctx.beginPath();ctx.ellipse(0,16,9,4,0,0,TAU);ctx.fillStyle=`rgba(255,246,205,${state.lamp/100})`;ctx.fill();ctx.restore();
  line(ctx,1439,504,1463,539,'#121b17',2.4);ctx.beginPath();ctx.moveTo(1463,539);ctx.bezierCurveTo(1510,550,1480,594,1540,584);ctx.strokeStyle='#151b17';ctx.lineWidth=2;ctx.stroke();
}
export function drawWorkbench(ctx,state) {
  // heavy stone/metal bench in shallow perspective
  polygon(ctx,[[968,458],[1420,417],[1548,528],[1051,598]]);const top=ctx.createLinearGradient(1090,440,1370,553);top.addColorStop(0,'#777a63');top.addColorStop(.33,'#545e50');top.addColorStop(1,'#283c32');ctx.fillStyle=top;ctx.fill();ctx.strokeStyle='#8f906e';ctx.lineWidth=1;ctx.stroke();
  polygon(ctx,[[1051,598],[1548,528],[1544,548],[1053,622]]);ctx.fillStyle='#14231b';ctx.fill();
  polygon(ctx,[[1083,616],[1511,551],[1511,691],[1092,753]]);ctx.fillStyle='#17251d';ctx.fill();
  for(let i=0;i<3;i++){polygon(ctx,[[1100+i*137,616-i*21],[1219+i*137,598-i*21],[1219+i*137,680-i*21],[1100+i*137,700-i*21]]);ctx.fillStyle=i%2?'#1a281f':'#1b291f';ctx.fill();line(ctx,1120+i*137,637-i*21,1197+i*137,625-i*21,'#565d4633');}
  // warm reflected task-light pool on the tabletop
  const power=state.lamp/100;
  const pool=ctx.createLinearGradient(1035,463,1405,572);pool.addColorStop(0,`rgba(218,193,127,${.36*power})`);pool.addColorStop(1,`rgba(231,190,108,${.16*power})`);
  polygon(ctx,[[1001,462],[1329,433],[1451,514],[1084,565]]);ctx.fillStyle=pool;ctx.fill();
  drawPolisher(ctx,state);drawLampCone(ctx,state);drawLamp(ctx,state);
  // sample tray and finishing tools
  polygon(ctx,[[1270,500],[1393,482],[1440,514],[1310,538]]);ctx.fillStyle='#2a372d';ctx.fill();ctx.strokeStyle='#96967b';ctx.lineWidth=1;ctx.stroke();
  polygon(ctx,[[1281,501],[1391,486],[1426,512],[1312,532]]);ctx.fillStyle='#8c876a';ctx.fill();
  const samples=[[1322,510,16],[1362,500,14],[1392,511,12]];
  samples.forEach(([x,y,r],i)=>{ctx.save();ctx.translate(x,y);ctx.scale(1,.64);const g=ctx.createRadialGradient(-4,-5,1,0,0,r);g.addColorStop(0,'#e3c696');g.addColorStop(.4,'#9e6543');g.addColorStop(.55,'#4d4431');g.addColorStop(.8,'#c8b281');g.addColorStop(1,'#4c3f2b');ctx.fillStyle=g;ctx.beginPath();ctx.arc(0,0,r,0,TAU);ctx.fill();ctx.strokeStyle='#e0c89688';ctx.stroke();ctx.restore();});
  // felt pad, calipers and spiral cable
  polygon(ctx,[[1030,529],[1120,512],[1155,536],[1064,555]]);ctx.fillStyle='#5a5b40';ctx.fill();
  line(ctx,1320,469,1370,462,'#bec0a3',2);line(ctx,1320,469,1331,480,'#bec0a3',2);line(ctx,1358,464,1369,475,'#bec0a3',2);
  ctx.beginPath();for(let i=0;i<=100;i++){const a=i/100*TAU*8,r=3+i*.05;ctx.lineTo(1460+Math.cos(a)*r,503+Math.sin(a)*r*.36);}ctx.strokeStyle='#172219';ctx.lineWidth=1.4;ctx.stroke();
  text(ctx,'POLISHING STATION  /  02',1276,568,6.5,'#9ca082');
}
function drawCore(ctx,c,x,y,illumination) {
  const len=48,w=22;
  ctx.save();ctx.translate(x,y);ctx.rotate(-.185);
  ctx.shadowColor='#0009';ctx.shadowBlur=4;ctx.shadowOffsetY=5;
  roundRect(ctx,-len/2,-w/2,len,w,w/2);const g=ctx.createLinearGradient(0,-w/2,0,w/2);g.addColorStop(0,'#777d6d');g.addColorStop(.2,`rgb(${Math.round(146+85*illumination)},${Math.round(151+78*illumination)},${Math.round(139+66*illumination)})`);g.addColorStop(.48,'#a4a894');g.addColorStop(1,'#424f44');ctx.fillStyle=g;ctx.fill();ctx.shadowBlur=0;ctx.shadowOffsetY=0;
  ctx.strokeStyle='#bbc0a655';ctx.lineWidth=.6;ctx.stroke();
  for(let i=0;i<7;i++){const xx=-18+i*5+c.chip*3;line(ctx,xx,-9,xx+3,9,i%2?'#727b6b88':'#d0d0b466',i%3===0?1.2:.6);}
  for(const [a,b,d] of c.cracks){ctx.beginPath();ctx.moveTo(-20+a*28,-8);ctx.lineTo(-18+b*30,-2+b*4);ctx.lineTo(-13+d*26,8);ctx.strokeStyle='#4b5b4fb0';ctx.lineWidth=.55;ctx.stroke();}
  ctx.beginPath();ctx.ellipse(len/2,0,4.5,10.5,0,0,TAU);const face=ctx.createRadialGradient(23,-3,1,24,0,11);face.addColorStop(0,'#d0d0b9');face.addColorStop(.7,'#9bA38f');face.addColorStop(1,'#515f50');ctx.fillStyle=face;ctx.fill();ctx.strokeStyle='#c3c5a677';ctx.stroke();
  for(let i=0;i<3;i++){ctx.beginPath();ctx.ellipse(24,0,1.2+i*.8,3+i*2.3,0,0,TAU);ctx.strokeStyle=i%2?'#cfccb066':'#56655688';ctx.lineWidth=.6;ctx.stroke();}
  ctx.restore();
}
export function drawCoreBox(ctx,state) {
  const illumination=state.lamp/100;
  // plinth under the open specimen drawer
  polygon(ctx,[[1121,721],[1494,666],[1526,851],[1166,888]]);const pedestal=ctx.createLinearGradient(1170,700,1450,850);pedestal.addColorStop(0,'#243024');pedestal.addColorStop(1,'#0e1914');ctx.fillStyle=pedestal;ctx.fill();
  line(ctx,1167,757,1488,711,'#59604a55');line(ctx,1169,848,1502,804,'#625e423d');
  roundRect(ctx,1276,797,61,7,3);ctx.fillStyle='#76704c';ctx.fill();
  text(ctx,'岩芯档案  CORE ARCHIVE',1248,831,8,'#787e65');text(ctx,'NO.  07 — 18',1284,846,6,'#5b6956');
  // bottom then the two rows, with convincing wood grain and dark routed dividers
  polygon(ctx,[[1067,614],[1442,549],[1553,727],[1176,807]]);ctx.fillStyle='#342a18';ctx.fill();ctx.strokeStyle='#9e8958';ctx.lineWidth=1.5;ctx.stroke();
  polygon(ctx,[[1080,621],[1437,560],[1535,718],[1180,792]]);const wood=ctx.createLinearGradient(1100,600,1490,765);wood.addColorStop(0,'#76613d');wood.addColorStop(.45,'#4e472d');wood.addColorStop(1,'#292d20');ctx.fillStyle=wood;ctx.fill();
  ctx.save();polygon(ctx,[[1080,621],[1437,560],[1535,718],[1180,792]]);ctx.clip();
  for(let i=0;i<23;i++){
    const y=635+i*7.1;ctx.beginPath();ctx.moveTo(1076,y);ctx.bezierCurveTo(1190,y-29,1333,y-74,1540,y-91);
    ctx.strokeStyle=i%4===0?'rgba(211,173,108,.16)':'rgba(30,30,20,.2)';ctx.lineWidth=i%4===0?.8:.45;ctx.stroke();
  }
  for(const [x,y,rx]of[[1121,723,11],[1448,671,9],[1310,781,7]]){
    ctx.beginPath();ctx.ellipse(x,y,rx,2.6,-.19,0,TAU);ctx.strokeStyle='rgba(24,30,20,.32)';ctx.lineWidth=.75;ctx.stroke();
    ctx.beginPath();ctx.ellipse(x,y,rx*.5,1.3,-.19,0,TAU);ctx.strokeStyle='rgba(188,153,94,.18)';ctx.stroke();
  }
  ctx.restore();
  for(let r=0;r<2;r++)for(let i=0;i<6;i++){
    const x=1132+i*55+r*67,y=645-i*9.7+r*87;
    drawCore(ctx,cores[r*6+i],x,y,illumination);
    text(ctx,`${String(r*6+i+1).padStart(2,'0')}`,x+4,y+24,6,'#c0b58a','center');
  }
  // pair of full-length core channels
  line(ctx,1093,673,1450,607,'#151f17',5);line(ctx,1171,768,1526,692,'#172219',5);
  polygon(ctx,[[1067,614],[1088,610],[1200,790],[1176,807]]);ctx.fillStyle='#6d5734';ctx.fill();ctx.strokeStyle='#b2965b';ctx.lineWidth=.8;ctx.stroke();
  polygon(ctx,[[1067,614],[1442,549],[1450,560],[1084,626]]);ctx.fillStyle='#96784a';ctx.fill();
  polygon(ctx,[[1442,549],[1553,727],[1536,720],[1435,561]]);ctx.fillStyle='#6d5737';ctx.fill();
  polygon(ctx,[[1176,807],[1553,727],[1547,743],[1183,825]]);const front=ctx.createLinearGradient(0,750,0,824);front.addColorStop(0,'#8a7044');front.addColorStop(.3,'#5b482c');front.addColorStop(1,'#372f20');ctx.fillStyle=front;ctx.fill();ctx.strokeStyle='#9d8050';ctx.stroke();
  for(let i=0;i<9;i++){const y=618+i*4;line(ctx,1087+i*3,y,1190+i*3,y+181,'#c2a0681a',.6);}
  // angled brass specimen label, readable but quiet
  polygon(ctx,[[1328,760],[1453,736],[1466,750],[1338,777]]);ctx.fillStyle='#b1a075';ctx.fill();text(ctx,'钻孔岩芯 · 灰白硅质层',1388,758,8,'#303c30','center');
  // small control light reflection from the working lamp
  ctx.save();ctx.globalCompositeOperation='screen';const light=ctx.createLinearGradient(1130,620,1540,740);light.addColorStop(0,`rgba(245,222,161,${illumination*.16})`);light.addColorStop(1,'rgba(255,226,158,0)');polygon(ctx,[[1084,623],[1434,562],[1537,715],[1183,790]]);ctx.fillStyle=light;ctx.fill();ctx.restore();
}
export function coreBoxScreenPoint(row,index){return [1132+index*55+row*67,645-index*9.7+row*87];}
