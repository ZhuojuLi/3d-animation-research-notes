import * as THREE from 'three';
import { DOOR } from './chapel.js';
import { stoneMaterial, glowTexture } from './textures.js';

// Dim nave behind the portal: walls, pews, altar, cross, candelabra with flickering flames.
export function createInterior(scene) {
  const g = new THREE.Group(), y0 = DOOR.sill, zb = -DOOR.thick;
  const wall = stoneMaterial({ seed: 71, blocks: true, tint: [0.42, 0.38, 0.34], moss: 0.2 }, { bumpScale: 1.5 });
  const W = 7, Dp = 11, H = 8;
  wall.side = THREE.BackSide;
  const none = new THREE.MeshBasicMaterial({ visible: false });
  const box = new THREE.Mesh(new THREE.BoxGeometry(W, H, Dp), [wall, wall, wall, none, none, wall]);
  box.position.set(0, y0 + H / 2 - 0.05, zb - Dp / 2); box.receiveShadow = true; g.add(box);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, Dp), stoneMaterial({ seed: 72, tint: [0.4, 0.36, 0.32], moss: 0.1 }));
  floor.rotation.x = -Math.PI / 2; floor.position.set(0, y0 + 0.01, zb - Dp / 2); floor.receiveShadow = true; g.add(floor);

  const wood = new THREE.MeshStandardMaterial({ color: 0x3b2618, roughness: 0.75 });
  const pew = () => {
    const p = new THREE.Group();
    const seat = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.07, 0.42), wood); seat.position.y = 0.46;
    const back = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.5, 0.06), wood); back.position.set(0, 0.8, -0.2); back.rotation.x = -0.1;
    p.add(seat, back);
    for (const sx of [-0.98, 0.98]) { const e = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.95, 0.5), wood); e.position.set(sx, 0.48, -0.05); p.add(e); }
    p.traverse(o => { o.castShadow = o.receiveShadow = true; }); return p;
  };
  for (let i = 0; i < 4; i++) for (const sx of [-1.35, 1.35]) {
    const p = pew(); p.position.set(sx, y0, zb - 2.6 - i * 1.25); p.rotation.y = Math.PI + (Math.sin(i * 7 + sx) * 0.05); g.add(p);
  }
  // altar + cross
  const altar = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.0, 0.7), stoneMaterial({ seed: 73, tint: [0.5, 0.46, 0.4] }));
  altar.position.set(0.3, y0 + 0.5, zb - Dp + 1.3); altar.castShadow = altar.receiveShadow = true; g.add(altar);
  const metal = new THREE.MeshStandardMaterial({ color: 0x6b4a26, roughness: 0.4, metalness: 0.8 });
  const cv = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.6, 0.04), metal); cv.position.set(0.3, y0 + 1.3, zb - Dp + 1.3);
  const ch = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.06, 0.04), metal); ch.position.set(0.3, y0 + 1.45, zb - Dp + 1.3); g.add(cv, ch);

  // tall candle stands + candles
  const glowTex = glowTexture();
  const flames = [], wax = new THREE.MeshStandardMaterial({ color: 0xefe6d0, roughness: 0.5, emissive: 0x442200, emissiveIntensity: 0.3 });
  const spots = [[-0.55, zb - Dp + 1.4, 1.35], [-0.95, zb - Dp + 1.6, 1.1], [0.3, zb - Dp + 1.35, 1.0], [-0.3, zb - 4.6, 1.5]];
  spots.forEach(([x, z, hgt], i) => {
    const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.06, hgt, 8), metal); stand.position.set(x, y0 + hgt / 2, z); g.add(stand);
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.32, 10), wax); c.position.set(x, y0 + hgt + 0.16, z); g.add(c);
    const flame = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffd27a }));
    flame.scale.set(1, 2.2, 1); flame.position.set(x, y0 + hgt + 0.38, z);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffb060, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    halo.scale.setScalar(0.7); flame.add(halo); halo.scale.set(0.7, 0.32, 1);
    g.add(flame); flames.push({ flame, halo, base: flame.position.clone(), seed: i * 1.7 });
  });
  // main candle light (inside), and a spill light at the threshold reaching the steps
  const candle = new THREE.PointLight(0xff9a40, 4, 14, 1.6); candle.position.set(-0.3, y0 + 1.8, zb - Dp + 2.2);
  candle.castShadow = true; candle.shadow.mapSize.set(512, 512); candle.shadow.bias = -0.003; g.add(candle);
  const mid = new THREE.PointLight(0xff9040, 2, 9, 1.5); mid.position.set(-0.3, y0 + 1.9, zb - 4.6); g.add(mid);
  const spill = new THREE.SpotLight(0xff9a48, 0, 16, 0.75, 0.8, 1.3);
  spill.position.set(0, y0 + 2.4, zb - 3.0); spill.target.position.set(-0.8, 0.5, 6); g.add(spill, spill.target);
  scene.add(g);
  return { group: g, flames, candle, mid, spill, glowTex };
}
