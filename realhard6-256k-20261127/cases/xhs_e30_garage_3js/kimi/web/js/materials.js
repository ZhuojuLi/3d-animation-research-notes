import * as THREE from 'three';
import {canvasTexture,rand} from './utils.js';
export function createMaterials() {
  const rng=rand(309);
  const concrete=canvasTexture(1024,1024,(c,w,h)=>{
    c.fillStyle='#70716b';c.fillRect(0,0,w,h);
    const img=c.getImageData(0,0,w,h);for(let i=0;i<img.data.length;i+=4){const n=(rng()-.5)*46,v=(rng()-.5)*13;img.data[i]+=n+v;img.data[i+1]+=n;img.data[i+2]+=n*.83;}c.putImageData(img,0,0);
    for(let i=0;i<2100;i++){c.fillStyle=`rgba(${rng()<.55?'28,30,27':'202,195,174'},${rng()*.24})`;c.beginPath();c.ellipse(rng()*w,rng()*h,rng()*13+.4,rng()*4+.3,rng()*6,0,Math.PI*2);c.fill();}
    for(let i=0;i<34;i++){const x=rng()*w,y=rng()*h,r=22+rng()*80,g=c.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,'rgba(30,31,27,.20)');g.addColorStop(1,'rgba(30,31,27,0)');c.fillStyle=g;c.fillRect(x-r,y-r,r*2,r*2);}
    c.lineCap='round';for(let i=0;i<36;i++){let x=rng()*w,y=rng()*h;c.beginPath();c.moveTo(x,y);for(let j=0;j<6;j++){x+=(rng()-.5)*75;y+=rng()*30;c.lineTo(x,y);}c.strokeStyle='rgba(30,32,28,.26)';c.lineWidth=rng()*1.7+.4;c.stroke();}
  });concrete.wrapS=concrete.wrapT=THREE.RepeatWrapping;concrete.repeat.set(3,3);
  const wallMap=canvasTexture(512,512,(c,w,h)=>{
    c.fillStyle='#b2ad9e';c.fillRect(0,0,w,h);for(let i=0;i<7000;i++){const a=rng()*.13;c.fillStyle=`rgba(${rng()>.5?'255,251,230':'44,45,39'},${a})`;c.fillRect(rng()*w,rng()*h,rng()*5+.4,rng()*16+.5);}
    for(let i=0;i<16;i++){let x=rng()*w;c.fillStyle='rgba(63,64,55,.06)';c.fillRect(x,0,rng()*9+2,h);}
  });wallMap.wrapS=wallMap.wrapT=THREE.RepeatWrapping;wallMap.repeat.set(3,2);
  const headlamp=canvasTexture(256,256,(c,w,h)=>{
    const g=c.createRadialGradient(112,105,4,128,128,125);g.addColorStop(0,'#b8c1bc');g.addColorStop(.18,'#667477');g.addColorStop(.58,'#414c50');g.addColorStop(.89,'#6d7878');g.addColorStop(1,'#20292d');c.fillStyle=g;c.fillRect(0,0,w,h);
    c.translate(128,128);for(let i=0;i<96;i++){c.rotate(Math.PI*2/96);c.strokeStyle=i%4?'rgba(210,222,214,.24)':'rgba(15,24,27,.64)';c.lineWidth=i%4?1:2;c.beginPath();c.moveTo(21,0);c.lineTo(121,0);c.stroke();}
    for(let r=28;r<124;r+=10){c.strokeStyle=r%20?'rgba(185,198,188,.27)':'rgba(13,23,25,.5)';c.lineWidth=2;c.beginPath();c.arc(0,0,r,0,7);c.stroke();}
    c.fillStyle='rgba(227,230,209,.30)';c.beginPath();c.ellipse(-24,-33,28,13,-.3,0,7);c.fill();
  });
  const roundel=canvasTexture(256,256,(c)=>{
    c.fillStyle='#14191b';c.fillRect(0,0,256,256);c.beginPath();c.arc(128,128,119,0,7);c.fillStyle='#c7cbc7';c.fill();c.beginPath();c.arc(128,128,109,0,7);c.fillStyle='#11191e';c.fill();
    c.strokeStyle='#e9ece5';c.lineWidth=6;c.beginPath();c.arc(128,128,82,0,7);c.stroke();
    for(let i=0;i<4;i++){c.beginPath();c.moveTo(128,128);c.arc(128,128,76,i*Math.PI/2,(i+1)*Math.PI/2);c.closePath();c.fillStyle=i%2?'#e4ebea':'#3983ac';c.fill();}
    c.font='bold 29px Arial';c.textAlign='center';c.fillStyle='#edf0e7';c.fillText('BMW',128,41);
  });
  roundel.wrapS=THREE.RepeatWrapping;roundel.repeat.x=-1;roundel.offset.x=1;
  const paint=new THREE.MeshPhysicalMaterial({color:0x182b39,metalness:.78,roughness:.17,clearcoat:1,clearcoatRoughness:.09,envMapIntensity:1.2});
  return {
    paint, paintDark:new THREE.MeshStandardMaterial({color:0x1d2d36,metalness:.65,roughness:.34}),
    chrome:new THREE.MeshStandardMaterial({color:0xc5cbcb,metalness:.94,roughness:.19,envMapIntensity:1.7}),
    alloy:new THREE.MeshStandardMaterial({color:0xc0c5c3,metalness:.9,roughness:.26,envMapIntensity:1.35}),
    blackMetal:new THREE.MeshStandardMaterial({color:0x141a1c,metalness:.65,roughness:.39}),
    rubber:new THREE.MeshStandardMaterial({color:0x161918,roughness:.88,metalness:.03}),
    tread:new THREE.MeshStandardMaterial({color:0x101413,roughness:.96}),
    plastic:new THREE.MeshStandardMaterial({color:0x202625,roughness:.68,metalness:.1}),
    leather:new THREE.MeshStandardMaterial({color:0x262a28,roughness:.7,metalness:.05}),
    fabric:new THREE.MeshStandardMaterial({color:0x393f3a,roughness:.96}),
    glass:new THREE.MeshPhysicalMaterial({color:0x263e47,metalness:.22,roughness:.055,transparent:true,opacity:.48,envMapIntensity:1.5,clearcoat:1,clearcoatRoughness:.04,side:THREE.DoubleSide,depthWrite:false}),
    lamp:new THREE.MeshPhysicalMaterial({map:headlamp,color:0xb7c4c1,metalness:.35,roughness:.13,clearcoat:1,clearcoatRoughness:.05,envMapIntensity:.7}),
    amber:new THREE.MeshPhysicalMaterial({color:0xbb5913,roughness:.25,metalness:.15,clearcoat:1,emissive:0x6b2100,emissiveIntensity:.18}),
    red:new THREE.MeshPhysicalMaterial({color:0x781e18,roughness:.27,clearcoat:1}),
    blue:new THREE.MeshStandardMaterial({color:0x164f77,metalness:.68,roughness:.35,envMapIntensity:.9}),
    blueEdge:new THREE.MeshStandardMaterial({color:0x286284,metalness:.7,roughness:.3}),
    steel:new THREE.MeshStandardMaterial({color:0x565b58,metalness:.85,roughness:.45}),
    darkSteel:new THREE.MeshStandardMaterial({color:0x252a28,metalness:.75,roughness:.5}),
    rust:new THREE.MeshStandardMaterial({color:0x625149,metalness:.57,roughness:.72}),
    concrete:new THREE.MeshStandardMaterial({map:concrete,bumpMap:concrete,bumpScale:.030,roughness:.67,metalness:.13}),
    wall:new THREE.MeshStandardMaterial({map:wallMap,color:0xc3bdab,roughness:.98}),
    wood:new THREE.MeshStandardMaterial({color:0x67543e,roughness:.92}),
    roundelMap:roundel,
    roundel:new THREE.MeshStandardMaterial({map:roundel,metalness:.35,roughness:.25}),
    headlampMap:headlamp,
    white:new THREE.MeshStandardMaterial({color:0xdbdcd2,roughness:.65})
  };
}
