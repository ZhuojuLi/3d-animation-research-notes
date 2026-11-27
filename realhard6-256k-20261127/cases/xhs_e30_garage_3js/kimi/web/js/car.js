import * as THREE from 'three';
import {mesh,box,cylinder,beam,tube,quad,canvasTexture,label} from './utils.js';

function upperAt(z){return .858+.048*THREE.MathUtils.clamp((z+2.11)/1.56,0,1)-.047*THREE.MathUtils.clamp((z-1.25)/.86,0,1);}
function sidePanel(parent, side, z0,z1, arch, mat, trim=true) {
  const s=new THREE.Shape();const lower=[];
  if(arch){lower.push([z0,.29],[arch.z-arch.r,.35]);for(let i=0;i<=28;i++){const a=Math.PI-i*Math.PI/28;lower.push([arch.z+Math.cos(a)*arch.r,.35+Math.sin(a)*arch.r]);}lower.push([z1,.29]);}
  else lower.push([z0,.29],[z1,.29]);
  const points=[...lower,...[z1,z0].map(z=>[z,upperAt(z)])];
  points.forEach(([z,y],i)=>{const x=side<0?-z:z;i?s.lineTo(x,y):s.moveTo(x,y);});s.closePath();
  const geo=new THREE.ExtrudeGeometry(s,{depth:.054,bevelEnabled:true,bevelSegments:2,steps:1,bevelSize:.012,bevelThickness:.012});
  const p=mesh(parent,geo,mat,[side*.872,0,0],'E30 pressed steel body');p.rotation.y=side<0?Math.PI/2:-Math.PI/2;
  return p;
}
function sideX(y,side){return side*(.89-(y-.91)*.38);}
function windowBeam(parent,pts,mat,r=.02){for(let i=0;i<pts.length-1;i++)beam(parent,pts[i],pts[i+1],r,mat);}
function mirror(parent,side,m){
  const g=new THREE.Group();g.position.set(side*.97,1.005,-.48);parent.add(g);
  box(g,[.19,.145,.22],[side*.045,0,0],m.paint,.045);
  const mir=box(g,[.012,.108,.167],[side*.148,.0,.005],m.chrome,.015);mir.rotation.z=side*.08;
  beam(g,[side*-.1,-.015,.02],[side*.035,-.015,.02],.026,m.plastic);
}
function seat(parent,x,z,m,rear=false){
  const g=new THREE.Group();parent.add(g);g.position.set(x,0,z);
  box(g,[.55,.16,.48],[0,.67,0],m.leather,.075);
  box(g,[.40,.025,.37],[0,.758,-.012],m.fabric,.025);
  const b=box(g,[.54,.54,.17],[0,.99,.245],m.leather,.06);b.rotation.x=-.10;
  const cf=box(g,[.38,.41,.028],[0,1.0,.148],m.fabric,.025);cf.rotation.x=-.1;
  for(let i=-2;i<=2;i++)box(g,[.009,.36,.012],[i*.065,1.0,.129],m.plastic,.004);
  box(g,[.30,.16,.15],[0,1.31,.27],m.leather,.04);
}

function wheel(parent,x,y,z,side,m){
  const g=new THREE.Group();g.position.set(x,y,z);g.name='BBS basketweave alloy wheel';parent.add(g);
  cylinder(g,.332,.224,[0,0,0],m.rubber,'x',64);
  for(const x0 of [-.108,.108]){const t=mesh(g,new THREE.TorusGeometry(.268,.062,16,64),m.rubber,[x0,0,0]);t.rotation.y=Math.PI/2;}
  for(let i=0;i<64;i++){
    const a=i/64*Math.PI*2;const t=box(g,[.15,.012,.026],[0,Math.sin(a)*.329,Math.cos(a)*.329],m.tread,.003);t.rotation.x=Math.PI/2-a;t.rotation.z=(i%2?1:-1)*.1;
  }
  const sx=side*.128;
  cylinder(g,.232,.16,[side*.025,0,0],m.darkSteel,'x',48);
  cylinder(g,.202,.012,[side*.09,0,0],m.steel,'x',64);
  const alloyBarrel=mesh(g,new THREE.CylinderGeometry(.224,.224,.032,64,1,true),m.alloy,[sx*.84,0,0]);alloyBarrel.rotation.z=Math.PI/2;
  const darkBarrel=mesh(g,new THREE.CylinderGeometry(.208,.208,.032,64,1,true),m.blackMetal,[sx,0,0]);darkBarrel.rotation.z=Math.PI/2;
  for(const xx of [sx*.94,sx*1.11]){const rim=mesh(g,new THREE.TorusGeometry(.226,.014,10,64),m.chrome,[xx,0,0]);rim.rotation.y=Math.PI/2;}
  // Flat cast spokes alternate on two depth planes, producing the genuine
  // open diamond lattice and stepped highlights of a period BBS basketweave.
  for(let i=0;i<20;i++){
    const a=i/20*Math.PI*2;
    beam(g,[sx*.92,Math.sin(a)*.061,Math.cos(a)*.061],[sx*.96,Math.sin(a+.055)*.111,Math.cos(a+.055)*.111],.019,m.alloy,true);
  }
  for(const rr of [.111,.211]){const ring=mesh(g,new THREE.TorusGeometry(rr,.0065,8,80),m.alloy,[sx*.99,0,0]);ring.rotation.y=Math.PI/2;}
  for(let i=0;i<24;i++){
    const a=i/24*Math.PI*2;
    beam(g,[sx*.95,Math.sin(a-.10)*.108,Math.cos(a-.10)*.108],[sx*1.055,Math.sin(a+.14)*.213,Math.cos(a+.14)*.213],.014,m.alloy,true);
    beam(g,[sx*1.035,Math.sin(a+.12)*.108,Math.cos(a+.12)*.108],[sx*.96,Math.sin(a-.15)*.213,Math.cos(a-.15)*.213],.012,m.chrome,true);
  }
  cylinder(g,.070,.042,[sx*1.07,0,0],m.alloy,'x',32);
  cylinder(g,.044,.045,[sx*1.105,0,0],m.blackMetal,'x',32);
  const cap=mesh(g,new THREE.CircleGeometry(.037,40),m.roundel,[sx*1.15,0,0]);cap.rotation.y=side<0?-Math.PI/2:Math.PI/2;
  for(let i=0;i<4;i++){const a=i*Math.PI/2+.4;cylinder(g,.010,.025,[sx*1.16,Math.sin(a)*.053,Math.cos(a)*.053],m.chrome,'x',12);}
  const caliper=box(g,[.04,.08,.06],[sx*.65,.09,.10],m.rust,.01);
  return g;
}

export function createCar(m){
  const root=new THREE.Group();root.name='BMW E30 318i · complete vehicle';
  const body=new THREE.Group();body.name='Coachwork';root.add(body);
  box(body,[1.48,.17,3.78],[0,.36,0],m.darkSteel,.035);
  // Four dimensional body sides with true pressed wheel openings.
  for(const side of [-1,1]){
    sidePanel(body,side,-2.11,-.55,{z:-1.34,r:.378},m.paint);
    sidePanel(body,side,.42,2.11,{z:1.34,r:.378},m.paint);
    // Black protective mouldings outside the moving door.
    box(body,[.035,.063,1.72],[side*.914,.58,-.35],m.plastic,.012);
    box(body,[.035,.063,1.78],[side*.914,.58,1.265],m.plastic,.012);
    for(const [a,b] of [[-2.07,-.55],[.42,2.07]])box(body,[.021,.018,b-a],[side*.92,.735,(a+b)/2],m.chrome,.006);
    box(body,[.016,.025,1.69],[side*.916,.29,-1.265],m.blackMetal,.004);
    box(body,[.016,.025,1.69],[side*.916,.29,1.265],m.blackMetal,.004);
    // Fine panel shut lines on rear door / quarter.
    beam(body,[side*.93,.30,.41],[side*.925,.91,.41],.007,m.blackMetal);
    beam(body,[side*.91,.33,1.19],[side*.92,.88,1.19],.006,m.blackMetal);
    box(body,[.04,.037,.16],[side*.94,.817,.84],m.blackMetal,.014);
    box(body,[.012,.03,.095],[side*.962,.835,.85],m.chrome,.006);
  }
  // Bonnet and boot: gently crowned lofted panels.
  function bonnet(z0,z1,w0,w1,y0,y1){
    const verts=[],idx=[],N=12;
    for(let j=0;j<=N;j++){const t=j/N,z=THREE.MathUtils.lerp(z0,z1,t),w=THREE.MathUtils.lerp(w0,w1,t);for(let i=0;i<=N;i++){const u=i/N*2-1;verts.push(u*w,THREE.MathUtils.lerp(y0,y1,t)+.033*(1-u*u)+.008*Math.sin(t*Math.PI),z);}}
    for(let j=0;j<N;j++)for(let i=0;i<N;i++){const a=j*(N+1)+i;idx.push(a,a+1,a+N+1,a+1,a+N+2,a+N+1);}
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));g.setIndex(idx);g.computeVertexNormals();const material=m.paint.clone();material.side=THREE.DoubleSide;
    mesh(body,g,material);
    for(const side of [-1,1])tube(body,[[side*w0,y0,z0],[side*(w0+w1)/2,(y0+y1)/2+.003,(z0+z1)/2],[side*w1,y1,z1]],.009,m.paintDark);
  }
  bonnet(-2.10,-.575,.795,.842,.858,.907);
  bonnet(1.255,2.105,.842,.785,.908,.855);
  // Front apron, classic grille and four separate circular lamps.
  box(body,[1.62,.34,.12],[0,.67,-2.082],m.paintDark,.025);
  box(body,[1.57,.27,.027],[0,.681,-2.153],m.blackMetal,.012);
  for(const x of [-.667,-.316,.316,.667]){
    cylinder(body,.154,.055,[x,.684,-2.168],m.blackMetal,'z',48);
    const bowl=mesh(body,new THREE.CylinderGeometry(.139,.126,.035,64,1,true),m.chrome,[x,.684,-2.191]);bowl.rotation.x=Math.PI/2;
    cylinder(body,.136,.009,[x,.684,-2.208],m.lamp,'z',64);
    const ring=mesh(body,new THREE.TorusGeometry(.146,.010,10,48),m.chrome,[x,.684,-2.222]);ring.rotation.y=0;
    cylinder(body,.027,.011,[x,.684,-2.224],m.steel,'z',32);
  }
  for(const x of [-.100,.100]){
    box(body,[.161,.237,.034],[x,.682,-2.195],m.chrome,.029);
    box(body,[.132,.208,.038],[x,.682,-2.216],m.blackMetal,.021);
    for(let i=-2;i<=2;i++)box(body,[.009,.183,.012],[x+i*.023,.681,-2.241],m.steel,.003);
  }
  for(const side of [-1,1]){
    box(body,[.145,.099,.032],[side*.715,.494,-2.186],m.amber,.015);
    for(let i=-2;i<=2;i++)box(body,[.008,.082,.004],[side*.715+i*.022,.494,-2.205],m.chrome,.001);
  }
  box(body,[1.72,.145,.18],[0,.425,-2.154],m.plastic,.036);
  box(body,[1.71,.025,.026],[0,.492,-2.254],m.chrome,.008);
  box(body,[1.57,.035,.024],[0,.411,-2.255],m.blackMetal,.007);
  box(body,[1.53,.11,.135],[0,.303,-2.10],m.paintDark,.02);
  const plateMap=canvasTexture(512,128,(c,w,h)=>{c.fillStyle='#e2e2d5';c.fillRect(0,0,w,h);c.fillStyle='#31649b';c.fillRect(0,0,50,h);c.fillStyle='#252a29';c.font='bold 66px Arial';c.textAlign='center';c.fillText('B  E 3030',290,87);c.font='24px Arial';c.fillStyle='#eee';c.fillText('D',25,54);c.strokeStyle='#4e5550';c.lineWidth=4;c.strokeRect(2,2,w-4,h-4);});
  box(body,[.505,.135,.022],[0,.425,-2.256],m.blackMetal,.009);
  label(body,plateMap,.485,.116,[0,.425,-2.270],[0,Math.PI,0]);
  // BMW bonnet roundel.
  const badge=mesh(body,new THREE.CircleGeometry(.047,48),m.roundel,[0,.884,-2.002], 'BMW bonnet insignia');badge.rotation.x=-Math.PI/2+.043;
  // Cabin glass, roof and pillars.
  const glassVerts={wind:[[-.758,.925,-.564],[.758,.925,-.564],[.646,1.350,-.246],[-.646,1.350,-.246]],rear:[[-.76,.924,1.251],[-.65,1.353,.859],[.65,1.353,.859],[.76,.924,1.251]]};
  quad(body,glassVerts.wind,m.glass);quad(body,glassVerts.rear,m.glass);
  windowBeam(body,[...glassVerts.wind,glassVerts.wind[0]],m.plastic,.028);
  windowBeam(body,[...glassVerts.rear,glassVerts.rear[0]],m.plastic,.025);
  box(body,[1.375,.068,1.23],[0,1.38,.371],m.paint,.037);
  // The roof is a clean steel pressing without an anachronistic glass panel.
  for(const side of [-1,1])beam(body,[side*.635,1.390,-.224],[side*.635,1.390,.855],.003,m.paintDark);
  for(const side of [-1,1]){
    beam(body,[side*.77,.91,-.573],[side*.66,1.37,-.239],.035,m.paint);
    beam(body,[side*.765,.922,1.27],[side*.659,1.368,.852],.047,m.paint);
    beam(body,[side*.70,1.385,-.236],[side*.70,1.385,.87],.012,m.chrome);
    beam(body,[side*.653,1.35,.434],[side*.874,.916,.434],.036,m.plastic);
    const rearWindow=quad(body,[[side*.868,.93,.457],[sideX(1.345,side),1.345,.457],[sideX(1.348,side),1.348,.837],[side*.868,.93,1.213]],m.glass);
    windowBeam(body,[[side*.87,.93,.448],[sideX(1.353,side),1.353,.448],[sideX(1.357,side),1.357,.842],[side*.87,.93,1.233],[side*.87,.93,.448]],m.plastic,.018);
    beam(body,[sideX(1.04,side),1.04,.886],[sideX(1.04,side),1.04,1.065],.018,m.plastic);
    beam(body,[side*.905,.91,-.54],[side*.91,.91,1.26],.014,m.chrome);
  }
  // Windscreen wipers.
  for(const x of [-.37,.30]){
    beam(body,[x,.944,-.563],[x+.18,1.015,-.502],.009,m.blackMetal);
    beam(body,[x+.13,1.013,-.508],[x+.35,1.031,-.488],.012,m.plastic);
  }
  // Front opening door, built as a hierarchical hinged assembly.
  const doorPivot=new THREE.Group();doorPivot.name='Driver door hinge · click to open';doorPivot.position.set(-.886,0,-.55);root.add(doorPivot);
  const dc=new THREE.Group();dc.position.set(.886,0,.55);doorPivot.add(dc);
  sidePanel(dc,-1,-.55,.42,null,m.paint);
  box(dc,[.035,.063,.93],[-.914,.58,-.065],m.plastic,.012);
  box(dc,[.024,.02,.93],[-.92,.735,-.065],m.chrome,.005);
  box(dc,[.032,.038,.17],[-.94,.817,.22],m.blackMetal,.014);
  box(dc,[.012,.026,.10],[-.963,.835,.22],m.chrome,.005);
  // Side door seams, outside front and rear edge.
  beam(dc,[-.93,.30,-.552],[-.93,.91,-.552],.007,m.blackMetal);
  beam(dc,[-.93,.30,.419],[-.93,.91,.419],.007,m.blackMetal);
  const dw=[[-.874,.937,-.492],[sideX(1.352,-1),1.352,-.218],[sideX(1.352,-1),1.352,.395],[-.874,.937,.395]];
  quad(dc,dw,m.glass);windowBeam(dc,[...dw,dw[0]],m.plastic,.024);
  windowBeam(dc,[dw[1],dw[2]],m.chrome,.009);
  mirror(dc,-1,m);
  // Door inner leather panel, arm rest, pull handle and storage pocket.
  box(dc,[.036,.30,.84],[-.842,.583,-.074],m.leather,.035);
  box(dc,[.10,.063,.32],[-.798,.765,.054],m.plastic,.02);
  box(dc,[.033,.29,.66],[-.815,.397,-.045],m.plastic,.025);
  beam(dc,[-.81,.76,-.13],[-.81,.76,.16],.019,m.leather);
  mirror(body,1,m);
  // Right front fixed door for integrity from inspection angles.
  sidePanel(body,1,-.55,.42,null,m.paint);
  quad(body,dw.map(([x,y,z])=>[-x,y,z]),m.glass);
  windowBeam(body,dw.map(([x,y,z])=>[-x,y,z]),m.plastic,.023);
  box(body,[.033,.038,.17],[.94,.817,.22],m.blackMetal,.014);
  beam(body,[.93,.30,-.552],[.93,.91,-.552],.007,m.blackMetal);
  beam(body,[.93,.30,.419],[.93,.91,.419],.007,m.blackMetal);
  // Interior visible through real window openings.
  const interior=new THREE.Group();interior.name='Anthracite leather cabin';root.add(interior);
  box(interior,[1.51,.09,2.18],[0,.60,.16],m.plastic,.025);
  box(interior,[1.50,.17,.37],[0,.895,-.50],m.plastic,.06);
  box(interior,[1.45,.14,.20],[0,.984,-.433],m.leather,.025);
  for(const x of [-.55,-.34,.32,.55])box(interior,[.12,.035,.04],[x,1.00,-.326],m.blackMetal,.006);
  seat(interior,-.39,.28,m);seat(interior,.39,.28,m);
  box(interior,[1.32,.15,.48],[0,.70,1.02],m.leather,.07);
  const rear=box(interior,[1.32,.45,.16],[0,.96,1.25],m.leather,.06);rear.rotation.x=-.09;
  for(const x of [-.43,0,.43])box(interior,[.28,.13,.13],[x,1.21,1.25],m.leather,.035);
  const steer=new THREE.Group();steer.position.set(-.39,1.075,-.285);steer.rotation.x=-.25;interior.add(steer);
  mesh(steer,new THREE.TorusGeometry(.158,.018,10,48),m.leather);
  cylinder(steer,.049,.035,[0,0,0],m.plastic,'z',24);
  for(const a of [Math.PI/2,Math.PI*1.17,Math.PI*1.83])beam(steer,[0,0,0],[Math.cos(a)*.15,Math.sin(a)*.15,0],.011,m.steel);
  beam(interior,[-.39,.98,-.48],[-.39,1.075,-.285],.024,m.plastic);
  box(interior,[.18,.20,.50],[0,.73,.06],m.plastic,.035);
  beam(interior,[0,.81,-.01],[0,.94,-.05],.012,m.steel);cylinder(interior,.027,.035,[0,.95,-.05],m.leather,'y',20);
  // Rear bumper, taillights and badging.
  box(root,[1.70,.15,.19],[0,.425,2.085],m.plastic,.033);
  box(root,[1.68,.024,.025],[0,.49,2.19],m.chrome,.006);
  for(const x of [-.55,.55]){box(root,[.46,.15,.03],[x,.755,2.105],m.red,.018);box(root,[.18,.145,.034],[x+(x<0?.13:-.13),.755,2.108],m.amber,.014);}
  label(root,canvasTexture(256,64,c=>{c.clearRect(0,0,256,64);c.fillStyle='#ccc';c.font='italic 31px Arial';c.fillText('318i',10,42);}),.25,.063,[.55,.885,2.112]);
  // Wheels with individual tread blocks and actual woven spokes.
  for(const side of [-1,1])for(const z of [-1.34,1.34])wheel(root,side*.891,.349,z,side,m);
  // Fully built underside, plainly visible after raising the lift.
  const under=new THREE.Group();under.name='E30 chassis, suspension and exhaust';root.add(under);
  box(under,[1.40,.050,2.80],[0,.243,.10],m.darkSteel,.010);
  // Stamped rails, repair seams, captive bolts and heat shielding break up the pan.
  for(const side of [-1,1]){
    box(under,[.18,.085,2.90],[side*.51,.25,.10],m.blackMetal,.012);
    for(const z of [-.90,.04,.99])box(under,[.31,.035,.075],[side*.51,.205,z],m.steel,.008);
    for(let j=0;j<8;j++)cylinder(under,.012,.012,[side*.625,.212,-1.03+j*.31],m.chrome,'y',8);
  }
  box(under,[.62,.040,.72],[-.25,.19,.69],m.steel,.04);
  for(let i=0;i<5;i++)box(under,[.60,.012,.015],[-.25,.164,.45+i*.12],m.darkSteel,.003);
  box(under,[.54,.13,.53],[-.24,.20,.83],m.darkSteel,.045);
  tube(under,[[-.43,.22,-.88],[-.43,.20,-.1],[-.40,.18,.6],[-.31,.2,1.42]],.018,m.blackMetal);
  for(const z of [-.65,.4,1.42])beam(under,[-.61,.21,z],[.55,.21,z],.018,m.steel);
  box(under,[.76,.26,.61],[0,.30,-.96],m.darkSteel,.04);
  cylinder(under,.052,2.17,[.12,.185,.31],m.steel,'z',20);
  cylinder(under,.15,.26,[.12,.18,1.31],m.darkSteel,'x',24);
  box(under,[.42,.17,.64],[.12,.17,1.08],m.steel,.04);
  tube(under,[[.20,.16,-1.2],[.22,.16,-.4],[.32,.15,.20],[.32,.15,1.1],[.23,.20,1.67]],.034,m.rust);
  box(under,[.60,.18,.39],[.21,.19,1.67],m.steel,.07);
  cylinder(under,.049,.34,[.23,.20,1.97],m.chrome,'z',24);
  for(const z of [-1.34,1.34]){
    beam(under,[-.79,.30,z],[.79,.30,z],.053,m.darkSteel);
    cylinder(under,.078,.92,[0,.31,z],m.steel,'x',24);
    for(const side of [-1,1]){
      beam(under,[side*.53,.24,z-.24],[side*.84,.31,z],.033,m.steel);
      beam(under,[side*.53,.24,z+.24],[side*.84,.31,z],.033,m.steel);
      cylinder(under,.044,.35,[side*.77,.49,z],m.darkSteel,'y',20);
      for(let j=0;j<5;j++){const coil=mesh(under,new THREE.TorusGeometry(.065,.010,6,16),m.steel,[side*.77,.39+j*.044,z]);coil.rotation.x=Math.PI/2;}
    }
  }
  root.userData.doorPivot=doorPivot;
  root.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
  return {root,doorPivot};
}
