import * as THREE from 'three';
import {mesh,box,cylinder,beam,tube,label,canvasTexture,rand,updateBeam} from './utils.js';

function oilTexture(seed=1){
  const rng=rand(seed);return canvasTexture(512,512,(c,w,h)=>{
    for(let i=0;i<55;i++){
      const x=256+(rng()-.5)*270,y=256+(rng()-.5)*220,r=28+rng()*100;
      const g=c.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,'rgba(15,20,18,.62)');g.addColorStop(.50,'rgba(25,29,23,.43)');g.addColorStop(.76,'rgba(43,42,29,.20)');g.addColorStop(1,'rgba(45,43,35,0)');c.fillStyle=g;c.fillRect(x-r,y-r,r*2,r*2);
    }
    for(let i=0;i<95;i++){c.fillStyle=`rgba(17,22,18,${.08+rng()*.42})`;c.beginPath();c.ellipse(rng()*w,rng()*h,rng()*6+.5,rng()*3+.4,rng()*6,0,7);c.fill();}
    c.strokeStyle='rgba(175,169,138,.13)';c.lineWidth=1.3;for(let i=0;i<14;i++){c.beginPath();c.arc(160+rng()*190,150+rng()*200,20+rng()*110,rng()*4,rng()*4+2.4);c.stroke();}
  });
}
function contactTexture(){return canvasTexture(256,256,c=>{const g=c.createRadialGradient(128,128,8,128,128,126);g.addColorStop(0,'rgba(15,20,19,.38)');g.addColorStop(.6,'rgba(20,22,20,.12)');g.addColorStop(1,'rgba(10,12,11,0)');c.fillStyle=g;c.fillRect(0,0,256,256);});}

export function createArchitecture(scene,m){
  const room=new THREE.Group();room.name='Industrial workshop architecture';scene.add(room);
  const floor=mesh(room,new THREE.PlaneGeometry(18,19),m.concrete,[0,-.012,-1.5]);floor.rotation.x=-Math.PI/2;floor.castShadow=false;
  const jointMat=new THREE.MeshStandardMaterial({color:0x454b47,roughness:.9});
  for(const x of [-3.1,1.8])box(room,[.012,.009,15],[x,-.001,-1.0],jointMat);
  box(room,[12,.009,.014],[0,-.001,1.5],jointMat);
  const oils=oilTexture(45),wet=oilTexture(99);
  for(const [x,z,s,r] of [[-.25,-.0,3.3,.3],[.7,-1.5,2.5,-.6],[2.45,-2.55,1.8,.2],[-3.0,-2.6,1.2,0],[-1.8,-3.6,2.5,-.2],[3.4,1.7,2.2,.5]]){
    const p=mesh(room,new THREE.PlaneGeometry(s,s*.65),new THREE.MeshPhysicalMaterial({map:(x<0?oils:wet),transparent:true,roughness:.19,metalness:.35,clearcoat:1,clearcoatRoughness:.11,envMapIntensity:1.1,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1}),[x,.004,z]);p.rotation.x=-Math.PI/2;p.rotation.z=r;p.castShadow=false;
  }
  const exterior=canvasTexture(1024,1024,(c,w,h)=>{
    const g=c.createLinearGradient(0,0,0,h);g.addColorStop(0,'#b7cbd0');g.addColorStop(.42,'#dce0ce');g.addColorStop(1,'#b0b6ab');c.fillStyle=g;c.fillRect(0,0,w,h);
    const rng=rand(18);for(let i=0;i<160;i++){c.fillStyle=`rgba(${rng()>.4?'93,117,88':'178,180,143'},${rng()*.19})`;c.beginPath();c.arc(rng()*w,150+rng()*h*.65,30+rng()*100,0,7);c.fill();}
    c.fillStyle='rgba(171,163,145,.4)';c.fillRect(700,600,240,410);c.fillStyle='rgba(98,120,133,.24)';for(let y=650;y<950;y+=85)for(let x=735;x<920;x+=65)c.fillRect(x,y,35,45);
  });
  label(room,exterior,18,10,[0,4.5,5.62],[0,Math.PI,0],true);
  const frameMat=new THREE.MeshStandardMaterial({color:0x848e86,metalness:.46,roughness:.61});
  const edgeMat=new THREE.MeshStandardMaterial({color:0xb0b2a5,metalness:.2,roughness:.76});
  // Rear masonry apron and five tall gridded window bays.
  box(room,[11.35,1.32,.25],[0,.66,5.15],m.wall);
  box(room,[11.55,.30,.30],[0,5.50,5.15],m.wall);
  const winGlass=new THREE.MeshPhysicalMaterial({color:0xbcccca,roughness:.18,metalness:.07,transparent:true,opacity:.16,side:THREE.DoubleSide,depthWrite:false});
  for(let bay=0;bay<5;bay++){
    const cx=-4.44+bay*2.22;
    box(room,[.21,4.28,.38],[cx-1.11,3.40,5.13],m.wall);
    box(room,[2.07,.18,.27],[cx,1.39,5.05],edgeMat);
    box(room,[2.04,.13,.13],[cx,5.40,5.03],frameMat);
    const p=mesh(room,new THREE.PlaneGeometry(2.06,3.93),winGlass,[cx,3.405,5.17]);p.castShadow=false;
    for(let j=0;j<=3;j++)box(room,[.043,3.95,.10],[cx-1.03+j*2.06/3,3.40,5.035],frameMat);
    for(let j=0;j<=5;j++)box(room,[2.08,.044,.10],[cx,1.43+j*3.94/5,5.035],frameMat);
  }
  box(room,[.21,4.28,.38],[5.55,3.40,5.13],m.wall);
  // Side window wall, visible at the left of the reference framing.
  box(room,[.24,1.32,7.5],[-5.55,.66,1.40],m.wall);
  box(room,[.30,.30,7.55],[-5.55,5.50,1.4],m.wall);
  for(let bay=0;bay<3;bay++){
    const cz=-1.0+bay*2.35;
    box(room,[.36,4.28,.22],[-5.53,3.40,cz-1.175],m.wall);
    const p=mesh(room,new THREE.PlaneGeometry(2.23,3.94),winGlass,[-5.55,3.405,cz]);p.rotation.y=Math.PI/2;p.castShadow=false;
    for(let j=0;j<=3;j++)box(room,[.10,3.95,.045],[-5.43,3.40,cz-1.115+j*2.23/3],frameMat);
    for(let j=0;j<=5;j++)box(room,[.10,.044,2.26],[-5.43,1.43+j*3.94/5,cz],frameMat);
    box(room,[.28,.19,2.31],[-5.42,1.39,cz],edgeMat);
  }
  // Right wall and a lower worn dado.
  box(room,[.28,5.65,8.3],[5.42,2.81,.95],m.wall);
  const dado=new THREE.MeshStandardMaterial({color:0x777d76,roughness:.93});
  box(room,[.035,1.14,8.25],[5.258,.57,.95],dado);
  box(room,[.06,.045,8.25],[5.22,1.15,.95],m.steel);
  // Exposed lintel and roof steel.
  for(const z of [-2.5,1.1,5.0]){
    box(room,[11.35,.21,.19],[0,5.66,z],m.darkSteel);
    box(room,[11.38,.055,.41],[0,5.55,z],m.steel);
    box(room,[11.38,.055,.41],[0,5.78,z],m.steel);
  }
  for(const x of [-4.9,-2.0,1.2,4.5])box(room,[.13,.22,10.4],[x,5.89,1.45],m.darkSteel);
  const ceiling=new THREE.MeshStandardMaterial({color:0x3e4541,roughness:.88,side:THREE.DoubleSide});
  const ce=mesh(room,new THREE.PlaneGeometry(12,10),ceiling,[0,6.04,.9]);ce.rotation.x=Math.PI/2;ce.castShadow=false;
  // Pendant lamps with enamel shades.
  for(const [x,z] of [[-1.4,3.2],[2.7,.3]]){
    beam(room,[x,5.85,z],[x,4.79,z],.014,m.blackMetal);
    cylinder(room,.34,.19,[x,4.72,z],m.blackMetal,'y',40,.13);
    cylinder(room,.31,.013,[x,4.622,z],new THREE.MeshStandardMaterial({color:0xe6e2c6,emissive:0xe6dbb3,emissiveIntensity:.65}),'y',40);
    cylinder(room,.10,.12,[x,4.86,z],m.steel,'y',24);
  }
  // Electric conduit and compressed-air line on the rear wall.
  tube(room,[[-5.1,1.22,4.95],[-5.1,4.6,4.95],[-4.5,4.7,4.95],[-3.5,4.7,4.95]],.017,m.steel);
  tube(room,[[1.1,.12,4.91],[1.1,1.23,4.91],[3.0,1.23,4.91],[3.0,2.8,4.91]],.014,m.blue);
  // BMW dealership era wall poster.
  const poster=canvasTexture(640,1200,(c,w,h)=>{
    c.fillStyle='#e5e2d5';c.fillRect(0,0,w,h);c.fillStyle='#151e25';c.fillRect(0,0,w,740);
    if(m.roundelMap.image){c.drawImage(m.roundelMap.image,170,155,300,300);}c.fillStyle='#f1f0e8';c.textAlign='center';c.font='30px Arial';c.fillText('THE ULTIMATE',320,550);c.font='bold 60px Arial';c.fillText('DRIVING MACHINE',320,620);
    c.fillStyle='#363b38';c.font='bold 51px Arial';c.fillText('BMW 3 SERIES',320,824);c.font='23px Arial';c.fillText('M TECHNIK  ·  1986',320,872);
    c.strokeStyle='#4d5656';c.lineWidth=7;c.beginPath();c.moveTo(110,1030);c.lineTo(156,944);c.lineTo(241,913);c.lineTo(424,913);c.lineTo(505,962);c.lineTo(543,1029);c.lineTo(510,1075);c.lineTo(135,1075);c.closePath();c.stroke();
    c.strokeRect(142,974,375,76);for(const x of [191,448]){c.beginPath();c.arc(x,1070,39,0,7);c.stroke();c.beginPath();c.arc(x,1070,24,0,7);c.stroke();}c.beginPath();c.moveTo(242,917);c.lineTo(275,973);c.lineTo(434,973);c.lineTo(412,917);c.stroke();
    c.fillStyle='#363b38';c.font='18px Arial';c.fillText('WERKSTATT  /  NÜRNBERG',320,1160);
  });
  box(room,[1.04,1.98,.045],[2.77,3.20,4.94],m.blackMetal,.015);
  label(room,poster,1.0,1.93,[2.77,3.20,4.907],[0,Math.PI,0]);
  return room;
}

export function createLift(scene,m){
  const root=new THREE.Group();root.name='Ravaglioli twin-post hydraulic lift';scene.add(root);
  const carriages=[];
  const warn=canvasTexture(128,512,(c,w,h)=>{
    c.fillStyle='#174e71';c.fillRect(0,0,w,h);c.save();c.translate(63,275);c.rotate(-Math.PI/2);c.fillStyle='#eef0df';c.font='bold 36px Arial';c.textAlign='center';c.fillText('Ravaglioli',0,13);c.restore();
    c.fillStyle='#d3c26c';c.fillRect(25,377,79,89);c.fillStyle='#222c2e';c.font='bold 45px Arial';c.textAlign='center';c.fillText('!',65,443);c.fillStyle='#e6e5d9';c.fillRect(24,480,81,3);
  });
  for(const side of [-1,1]){
    const x=side*1.52,z=.39;
    box(root,[.55,.09,.91],[x,.046,z],m.blue,.015);
    box(root,[.33,4.27,.43],[x,2.20,z],m.blue,.018);
    box(root,[.075,4.14,.58],[x-side*.16,2.20,z],m.blueEdge,.01);
    box(root,[.045,3.98,.075],[x-side*.206,2.19,z-.16],m.steel,.006);
    box(root,[.39,.13,.58],[x,4.38,z],m.blue,.013);
    cylinder(root,.032,3.40,[x+side*.065,2.20,z-.255],m.chrome,'y',16);
    for(const dx of [-.2,.2])for(const dz of [-.33,.33]){cylinder(root,.027,.068,[x+dx,.103,z+dz],m.steel,'y',6);cylinder(root,.014,.08,[x+dx,.082,z+dz],m.chrome,'y',12);}
    const front=side<0?z-.228:z-.228;
    label(root,warn,.135,2.08,[x,2.55,front-.005],[0,Math.PI,0]);
    const carriage=new THREE.Group();carriage.position.set(x,.40,z);root.add(carriage);carriages.push(carriage);
    box(carriage,[.47,.43,.62],[0,0,0],m.blue,.018);
    box(carriage,[.15,.13,.20],[-side*.26,.05,0],m.darkSteel,.015);
    cylinder(carriage,.040,.06,[-side*.31,.06,-.04],m.rust,'x',20);
    for(const dz of [-.25,.25])box(carriage,[.06,.36,.09],[side*.23,0,dz],m.steel,.007);
  }
  // Top equaliser beam and hydraulic lines.
  box(root,[3.36,.14,.18],[0,4.42,.47],m.blue,.014);
  tube(root,[[-1.52,4.23,.43],[-1.37,4.65,.44],[0,4.62,.44],[1.46,4.56,.44],[1.52,3.84,.44]],.018,m.blackMetal);
  tube(root,[[-1.53,4.2,.42],[-1.65,3.83,.45],[-1.70,2.20,.50],[-1.55,1.17,.48]],.014,m.blackMetal);
  box(root,[.25,.53,.24],[-1.74,.89,.37],m.blue,.028);
  cylinder(root,.085,.27,[-1.74,1.27,.37],m.blackMetal,'y',24);
  box(root,[.07,.18,.12],[-1.77,.95,.217],m.plastic,.012);
  cylinder(root,.024,.018,[-1.77,1.0,.15],m.red,'z',16);
  cylinder(root,.019,.018,[-1.77,.93,.15],m.white,'z',16);
  const arms=[],pads=[],attach=[];
  for(const side of [-1,1])for(const dir of [-1,1]){
    const a=[side*1.38,.145,.39+dir*.14],b=[side*.67,.145,dir*.93+.10];
    const arm=beam(root,a,b,.095,m.blue,true);arms.push({mesh:arm,side,dir});
    const pad=cylinder(root,.096,.074,[b[0],.180,b[2]],m.rubber,'y',28);
    cylinder(pad,.037,.03,[0,-.048,0],m.steel,'y',16);pads.push(pad);
  }
  return {root,carriages,arms,pads,update(h){carriages.forEach(c=>c.position.y=.39+h);for(const a of arms){const x=a.side*1.38,y=.145+h,z=.39+a.dir*.14,bx=a.side*.67,bz=a.dir*.93+.1;updateBeam(a.mesh,[x,y,z],[bx,y,bz]);}pads.forEach(p=>p.position.y=.181+h);}};
}

export function createWorkshopProps(scene,m){
  const root=new THREE.Group();root.name='Tools, spares and shop equipment';scene.add(root);
  const crateMats=[new THREE.MeshStandardMaterial({color:0x7e837b,roughness:.83}),new THREE.MeshStandardMaterial({color:0x414a48,roughness:.78}),new THREE.MeshStandardMaterial({color:0x9a9786,roughness:.9})];
  function textMap(text,bg='#242c2c',fg='#d9d9cb',font=42){return canvasTexture(512,128,(c,w,h)=>{c.fillStyle=bg;c.fillRect(0,0,w,h);c.font=`bold ${font}px Arial`;c.textAlign='center';c.textBaseline='middle';c.fillStyle=fg;c.fillText(text,w/2,h/2);});}
  function tire(parent,pos,r=.37,axis='z',withRim=false){
    const gr=new THREE.Group();gr.position.set(...pos);parent.add(gr);
    const t=mesh(gr,new THREE.TorusGeometry(r*.73,r*.27,14,40),m.rubber);if(axis==='y')t.rotation.x=Math.PI/2;if(axis==='x')t.rotation.y=Math.PI/2;
    const c=cylinder(gr,r*.87,r*.52,[0,0,0],m.rubber,axis,40);
    const hole=cylinder(gr,r*.47,r*.535,[0,0,0],withRim?m.darkSteel:m.plastic,axis,32);
    if(withRim){cylinder(gr,r*.11,r*.56,[0,0,0],m.alloy,axis,20);for(let i=0;i<10;i++){const a=i/10*Math.PI*2;if(axis==='z')beam(gr,[Math.sin(a)*r*.13,Math.cos(a)*r*.13,-r*.28],[Math.sin(a)*r*.43,Math.cos(a)*r*.43,-r*.28],.015,m.steel);}}
    return gr;
  }
  // Tall black cantilever rack at the right wall.
  const rack=new THREE.Group();rack.position.set(4.42,0,2.20);rack.rotation.y=.12;root.add(rack);
  for(const x of [-1.35,1.35]){
    for(const z of [-.43,.43])box(rack,[.095,3.48,.095],[x,1.74,z],m.blackMetal,.007);
    for(const y of [.28,1.18,2.20,3.2])beam(rack,[x,y,-.49],[x,y,.49],.065,m.steel,true);
    beam(rack,[x,.17,.43],[x,2.77,.43],.035,m.steel);
    beam(rack,[x,2.18,.43],[x,3.40,-.43],.034,m.steel);
  }
  for(const y of [.18,1.10,2.14]){box(rack,[2.79,.08,.94],[0,y,0],m.darkSteel,.009);box(rack,[2.82,.135,.05],[0,y+.035,-.49],m.blackMetal,.004);}
  box(rack,[2.87,.23,.06],[0,3.28,-.47],m.blackMetal,.004);
  label(rack,textMap('MICHELIN', '#273032','#d7dcd7',54),1.33,.225,[0,3.28,-.506],[0,Math.PI,0]);
  for(const x of [-1.01,-.34,.34,1.01])for(let k=0;k<3;k++)tire(rack,[x,2.37+k*.24,.02],.38,'y');
  for(let row=0;row<2;row++)for(let i=0;i<3;i++)tire(rack,[-.84+i*.84,.68+row*1.01,-.04],.415,'z',row===0&&i!==1);
  for(let i=0;i<4;i++)box(rack,[.52,.26,.61],[-.93+i*.62,.38,.05],crateMats[i%3],.016);
  // Dark roller tool cabinet with individually modelled drawers and hardware.
  const cab=new THREE.Group();cab.position.set(2.77,0,4.34);cab.rotation.y=-.04;root.add(cab);
  box(cab,[2.10,1.12,.64],[0,.79,0],m.blackMetal,.035);
  box(cab,[2.19,.09,.79],[0,1.386,.0],m.darkSteel,.023);
  for(const x of [-.90,.90])for(const z of [-.21,.21]){const wh=cylinder(cab,.074,.049,[x,.155,z],m.rubber,'x',24);box(cab,[.055,.13,.055],[x,.225,z],m.steel);}
  for(let i=0;i<7;i++){
    const y=.37+i*.139;
    box(cab,[1.96,.115,.024],[0,y,-.336],m.darkSteel,.008);
    box(cab,[1.77,.024,.031],[0,y+.027,-.357],m.steel,.006);
  }
  label(cab,textMap('SONIC', '#242c2c','#d9d9cb',40),.45,.12,[.65,.257,-.338],[0,Math.PI,0]);
  // Pegboard, wrenches, sockets and bottles.
  const peg=canvasTexture(256,256,(c)=>{c.fillStyle='#363c38';c.fillRect(0,0,256,256);c.fillStyle='#171e1c';for(let y=10;y<256;y+=20)for(let x=10;x<256;x+=20){c.beginPath();c.arc(x,y,2.4,0,7);c.fill();}});peg.wrapS=peg.wrapT=THREE.RepeatWrapping;peg.repeat.set(4,2);
  box(cab,[2.06,1.05,.049],[0,1.97,.305],new THREE.MeshStandardMaterial({map:peg,roughness:.72,metalness:.52}));
  for(let i=0;i<11;i++){
    const x=-.88+i*.17,y=1.78+(i%3)*.04;
    beam(cab,[x,y,-.002],[x,y+.31+(i%4)*.03,-.002],.009,m.chrome);
    const head=mesh(cab,new THREE.TorusGeometry(.032,.009,6,16),m.chrome,[x,y+.34+(i%4)*.03,-.002]);
    if(i%2)box(cab,[.052,.04,.019],[x,y,-.002],m.chrome,.008);
  }
  for(const [x,col] of [[-.8,0xa83927],[-.58,0x306b8b],[.68,0xafab7b]]){
    const mat=new THREE.MeshStandardMaterial({color:col,roughness:.5,metalness:.2});cylinder(cab,.063,.22,[x,1.54,-.11],mat,'y',20);cylinder(cab,.034,.054,[x,1.68,-.11],m.plastic,'y',16);
  }
  box(cab,[.25,.19,.20],[.22,1.51,-.06],m.plastic,.025);box(cab,[.18,.09,.01],[.22,1.535,-.167],new THREE.MeshStandardMaterial({color:0x647b65,emissive:0x324732,emissiveIntensity:.25}),.005);
  // Rear low workbench below windows.
  const bench=new THREE.Group();bench.position.set(-.6,0,4.57);root.add(bench);
  box(bench,[2.48,.14,.66],[0,1.11,0],m.wood,.025);
  for(const x of [-1.04,1.04])for(const z of [-.23,.23])box(bench,[.08,1.09,.08],[x,.55,z],m.steel);
  box(bench,[.64,.83,.55],[.76,.63,.01],m.blue,.02);
  for(let j=0;j<4;j++){box(bench,[.58,.145,.025],[.76,.30+j*.185,-.292],m.blueEdge,.01);box(bench,[.32,.022,.03],[.76,.32+j*.185,-.317],m.chrome);}
  cylinder(bench,.08,.22,[-.88,1.30,0],m.steel,'y',24);box(bench,[.30,.11,.25],[-.74,1.31,-.01],m.blueEdge,.015);
  for(let i=0;i<6;i++)cylinder(bench,.022,.26,[-.36+i*.14,1.31,.15],i%2?m.chrome:m.darkSteel,'y',12);
  // Oil / brake-fluid bottles under the rear bench.
  for(let i=0;i<5;i++){
    const col=[0xddd5b8,0x8e482c,0x426578][i%3],mat=new THREE.MeshStandardMaterial({color:col,roughness:.68});
    box(bench,[.20,.42,.24],[-1.00+i*.28,.26,-.05],mat,.026);cylinder(bench,.045,.06,[-1+i*.28,.50,-.05],m.plastic,'y',16);
  }
  // Complete engine on an independent rolling service stand, lower right.
  const eng=new THREE.Group();eng.name='M20 engine on rolling stand';eng.position.set(3.12,0,1.13);eng.rotation.y=-.20;root.add(eng);
  const standMat=new THREE.MeshStandardMaterial({color:0x5b2723,metalness:.65,roughness:.5});
  box(eng,[.84,.10,.85],[0,.17,0],standMat,.02);box(eng,[.12,1.00,.13],[0,.69,.30],standMat,.015);
  for(const x of [-.35,.35])for(const z of [-.31,.31])cylinder(eng,.055,.044,[x,.072,z],m.rubber,'x',16);
  box(eng,[.65,.49,.78],[0,.78,-.04],m.steel,.065);
  box(eng,[.60,.24,.83],[0,1.095,-.05],m.darkSteel,.052);
  box(eng,[.43,.13,.76],[0,1.25,-.04],m.blackMetal,.055);
  for(let i=0;i<5;i++)box(eng,[.36,.016,.025],[0,1.323,-.30+i*.14],m.steel,.004);
  for(let i=0;i<6;i++){
    const z=-.34+i*.126;cylinder(eng,.017,.05,[-.27,1.096,z],m.chrome,'y',8);cylinder(eng,.017,.05,[.27,1.096,z],m.chrome,'y',8);
  }
  for(const [r,z] of [[.14,-.46],[.07,-.477],[.09,-.49]])cylinder(eng,r,.047,[0,.76,z],m.blackMetal,'z',24);
  tube(eng,[[-.16,.80,-.51],[.10,1.0,-.51],[.14,1.20,-.42]],.013,m.rubber);
  for(let i=0;i<4;i++)tube(eng,[[-.34,.95,-.30+i*.18],[-.50,.88,-.29+i*.18],[-.53,.66,-.22+i*.13]],.032,m.steel);
  cylinder(eng,.068,.24,[.37,.73,.08],m.blue,'y',24);
  box(eng,[.31,.28,.25],[.31,.85,.36],m.steel,.04);
  label(eng,textMap('M20', '#303933','#c2c6ba',52),.25,.10,[0,1.34,-.03],[-Math.PI/2,0,0]);
  // Foreground cart with visibly scattered hand tools.
  const cart=new THREE.Group();cart.position.set(-3.27,0,-2.58);cart.rotation.y=-.08;root.add(cart);
  box(cart,[1.38,.08,.65],[0,.94,0],m.darkSteel,.025);box(cart,[1.28,.67,.58],[0,.57,0],m.blackMetal,.022);
  for(let j=0;j<5;j++){const y=.32+j*.126;box(cart,[1.20,.103,.027],[0,y,-.304],m.darkSteel,.009);box(cart,[.68,.017,.023],[0,y+.018,-.324],m.steel,.003);}
  label(cart,textMap('TOOL  /  03','#1b2222','#a7b1a8',31),.48,.09,[-.29,.866,-.321],[0,Math.PI,0]);
  for(const x of [-.60,.60])for(const z of [-.25,.25]){box(cart,[.044,.85,.044],[x,.55,z],m.steel);cylinder(cart,.079,.045,[x,.094,z],m.rubber,'x',20);}
  box(cart,[1.39,.18,.045],[0,1.04,.31],m.blackMetal,.005);box(cart,[1.39,.18,.045],[0,1.04,-.31],m.blackMetal,.005);box(cart,[.04,.18,.66],[-.68,1.04,0],m.blackMetal,.005);
  for(let i=0;i<4;i++){beam(cart,[-.49+i*.23,1.00,-.15],[-.35+i*.21,1.002,.13],.019,m.chrome);const ring=mesh(cart,new THREE.TorusGeometry(.050,.012,6,16),m.chrome,[-.35+i*.21,1.007,.14]);ring.rotation.x=Math.PI/2;}
  box(cart,[.39,.12,.20],[.26,1.045,.10],m.red,.022);for(let i=0;i<4;i++)cylinder(cart,.029,.06,[.14+i*.075,1.135,.10],m.chrome,'y',16);
  const fluid=new THREE.MeshStandardMaterial({color:0x386c8b,roughness:.49});cylinder(cart,.061,.24,[-.54,1.10,.10],fluid,'y',20);cylinder(cart,.033,.07,[-.54,1.255,.10],m.red,'y',16);
  const loose=tire(root,[-3.30,.43,-3.22],.44,'x',true);loose.rotation.z=.17;
  // Wheel dolly and two spare road wheels, tucked into the foreground.
  const loose2=tire(root,[-2.92,.18,-3.24],.42,'y',true);loose2.rotation.z=.08;
  // Parts bins, cartons and cleaning supplies beneath rack.
  for(let i=0;i<5;i++){
    const x=3.97+(i%2)*.47,z=.35+Math.floor(i/2)*.38;
    box(root,[.39,.32,.31],[x,.18,z],crateMats[i%3],.015);
    label(root,textMap(i%2?'E30':'PARTS','#bdbaa6','#343c38',35),.20,.055,[x,.21,z-.158],[0,Math.PI,0]);
  }
  // Slotted floor drain in the path of the low sunlight.
  const drain=new THREE.Group();drain.position.set(3.45,.002,-2.26);drain.rotation.y=-.58;root.add(drain);
  box(drain,[.19,.013,4.65],[0,0,0],m.blackMetal);
  for(let i=0;i<60;i++)box(drain,[.18,.016,.014],[0,.011,-2.27+i*.077],m.steel);
  return root;
}
