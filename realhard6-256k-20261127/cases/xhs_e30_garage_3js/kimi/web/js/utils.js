import * as THREE from 'three';
import { RoundedBoxGeometry } from '../vendor/geometries/RoundedBoxGeometry.js';

export function mesh(parent, geometry, material, position=[0,0,0], name='') {
  const m = new THREE.Mesh(geometry, material);
  m.position.set(...position); m.castShadow = true; m.receiveShadow = true; m.name = name;
  parent.add(m); return m;
}
export function box(parent, size, position, material, bevel=0, name='') {
  const g = bevel > 0 ? new RoundedBoxGeometry(...size, 2, bevel) : new THREE.BoxGeometry(...size);
  return mesh(parent, g, material, position, name);
}
export function cylinder(parent, radius, depth, position, material, axis='y', segments=32, radiusTop=radius) {
  const m = mesh(parent, new THREE.CylinderGeometry(radiusTop,radius,depth,segments), material, position);
  if(axis==='x') m.rotation.z=Math.PI/2;
  if(axis==='z') m.rotation.x=Math.PI/2;
  return m;
}
export function beam(parent, a, b, radius, material, square=false) {
  const av=new THREE.Vector3(...a), bv=new THREE.Vector3(...b), d=bv.clone().sub(av);
  const g = square ? new THREE.BoxGeometry(radius,d.length(),radius) : new THREE.CylinderGeometry(radius,radius,d.length(),10);
  const m=mesh(parent,g,material,av.clone().add(bv).multiplyScalar(.5).toArray());
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize()); return m;
}
export function updateBeam(m,a,b) {
  const av=new THREE.Vector3(...a), bv=new THREE.Vector3(...b), d=bv.clone().sub(av);
  m.position.copy(av.add(bv).multiplyScalar(.5)); m.scale.y=d.length()/m.geometry.parameters.height;
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());
}
export function tube(parent, points, radius, material, closed=false) {
  const curve = new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)),closed,'centripetal');
  return mesh(parent,new THREE.TubeGeometry(curve,Math.max(12,points.length*4),radius,8,closed),material);
}
export function quad(parent, vertices, material) {
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(vertices.flat(),3));
  g.setIndex([0,1,2,0,2,3]);g.computeVertexNormals();
  return mesh(parent,g,material);
}
export function canvasTexture(w,h,draw) {
  const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'),w,h);
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=8;return t;
}
export function label(parent, texture, width,height, position, rotation=[0,0,0], emissive=false) {
  if(!texture.userData.counterReflected){texture.wrapS=THREE.RepeatWrapping;texture.repeat.x=-1;texture.offset.x=1;texture.userData.counterReflected=true;}
  const m=mesh(parent,new THREE.PlaneGeometry(width,height),new THREE.MeshStandardMaterial({map:texture,roughness:.65,side:THREE.DoubleSide,emissive:emissive?0x333333:0,emissiveMap:emissive?texture:null}),position);
  m.rotation.set(...rotation);m.castShadow=false;return m;
}
export function rand(seed=1234) { let s=seed; return ()=>{s=(s*1664525+1013904223)>>>0;return s/4294967296;};}
