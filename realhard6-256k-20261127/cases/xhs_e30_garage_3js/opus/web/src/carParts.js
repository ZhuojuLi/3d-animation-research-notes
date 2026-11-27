// E30 front fascia, bumpers, wheels (silver mesh / BBS style), interior, underbody
import * as THREE from 'three';
import { M } from './materials.js';
import { mesh, box, cyl, tube } from './geom.js';
import { plateTex } from './textures.js';
import { DIM } from './carBody.js';

const AXf = DIM.wb / 2;

export function buildFront(car) {
  const xF = 2.105;
  car.add(box(0.04, 0.24, DIM.W - 0.06, M.trimBlack, xF - 0.02, 0.70, 0, 0.01));
  const lamp = (z, r) => {
    const g = new THREE.Group();
    const bezel = mesh(new THREE.TorusGeometry(r + 0.008, 0.011, 10, 40), M.chrome); bezel.rotation.y = Math.PI / 2; g.add(bezel);
    const bowl = mesh(new THREE.SphereGeometry(r, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), M.reflector);
    bowl.rotation.z = Math.PI / 2; bowl.scale.set(0.5, 1, 1); bowl.position.x = 0.01; g.add(bowl);
    const bulb = mesh(new THREE.SphereGeometry(0.018, 12, 8), M.chrome); bulb.position.x = -0.02; g.add(bulb);
    const lens = mesh(new THREE.SphereGeometry(r, 32, 12, 0, Math.PI * 2, 0, 0.5), M.lensGlass);
    lens.rotation.z = -Math.PI / 2; lens.scale.set(1, 0.35, 1); lens.position.x = -0.002; g.add(lens);
    g.position.set(xF + 0.01, 0.705, z); return g;
  };
  [1, -1].forEach(s => { car.add(lamp(s * 0.62, 0.085)); car.add(lamp(s * 0.405, 0.075)); });
  // narrow twin kidney grille
  [1, -1].forEach(s => {
    const k = new THREE.Group();
    const shp = new THREE.Shape(); const w = 0.07, h = 0.10, r = 0.03;
    shp.moveTo(-w + r, -h); shp.lineTo(w - r, -h); shp.quadraticCurveTo(w, -h, w, -h + r); shp.lineTo(w, h - r);
    shp.quadraticCurveTo(w, h, w - r, h); shp.lineTo(-w + r, h); shp.quadraticCurveTo(-w, h, -w, h - r); shp.lineTo(-w, -h + r);
    shp.quadraticCurveTo(-w, -h, -w + r, -h);
    k.add(mesh(new THREE.ExtrudeGeometry(shp, { depth: 0.02, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.01, bevelSegments: 3 }), M.chrome));
    const inner = mesh(new THREE.ShapeGeometry(shp), M.trimBlack); inner.scale.set(0.82, 0.86, 1); inner.position.z = 0.023; k.add(inner);
    for (let i = -2; i <= 2; i++) k.add(box(0.008, 0.17, 0.008, M.chrome, i * 0.024, 0, 0.026));
    k.rotation.y = Math.PI / 2; k.position.set(xF + 0.01, 0.705, s * 0.09); car.add(k);
  });
  const badge = cyl(0.035, 0.035, 0.01, M.chrome, 32); badge.rotation.z = Math.PI / 2; badge.position.set(xF - 0.03, 0.84, 0); car.add(badge);
  const bb = cyl(0.028, 0.028, 0.012, new THREE.MeshStandardMaterial({ color: 0x1c69d4, roughness: 0.3 }), 32);
  bb.rotation.z = Math.PI / 2; bb.position.set(xF - 0.026, 0.84, 0); car.add(bb);
  // bumper + apron
  car.add(box(0.16, 0.13, DIM.W + 0.04, M.plasticBlack, xF + 0.03, 0.50, 0, 0.04));
  car.add(box(0.012, 0.025, DIM.W + 0.02, M.chrome, xF + 0.112, 0.535, 0));
  car.add(box(0.20, 0.13, DIM.W - 0.02, M.plasticBlack, xF - 0.02, 0.36, 0, 0.03));
  [1, -1].forEach(s => {
    car.add(box(0.02, 0.05, 0.22, M.amber, xF + 0.112, 0.48, s * 0.56, 0.008));
    car.add(box(0.02, 0.05, 0.14, M.trimBlack, xF + 0.08, 0.37, s * 0.5));
  });
  const pl = mesh(new THREE.PlaneGeometry(0.52, 0.112), new THREE.MeshStandardMaterial({ map: plateTex(), roughness: 0.45 }));
  pl.rotation.y = Math.PI / 2; pl.position.set(xF + 0.115, 0.47, 0); car.add(pl);
  car.add(box(0.15, 0.14, DIM.W + 0.04, M.plasticBlack, -2.13, 0.52, 0, 0.04));
  car.add(box(0.012, 0.025, DIM.W + 0.02, M.chrome, -2.205, 0.55, 0));
}

// Silver cross-spoke mesh wheel (BBS-style) + tyre + brake. Face points +Z.
export function buildWheel() {
  const g = new THREE.Group(); const R = DIM.wheelR, rimR = 0.19, w = 0.19;
  const tire = mesh(new THREE.TorusGeometry(R - 0.06, 0.068, 20, 48), M.tire); tire.scale.set(1, 1, 1.35); g.add(tire);
  const tread = mesh(new THREE.CylinderGeometry(R - 0.005, R - 0.005, w - 0.02, 48, 1, true), M.tire);
  tread.rotation.x = Math.PI / 2; g.add(tread);
  const barrel = mesh(new THREE.CylinderGeometry(rimR, rimR, w - 0.03, 40, 1, true), M.alloyDark);
  barrel.rotation.x = Math.PI / 2; g.add(barrel);
  const face = new THREE.Group(); face.position.z = w / 2 - 0.02; g.add(face);
  face.add(mesh(new THREE.TorusGeometry(rimR + 0.003, 0.013, 10, 48), M.chrome));
  const dish = mesh(new THREE.CircleGeometry(rimR, 40), M.trimBlack); dish.position.z = -0.035; face.add(dish);
  for (let i = 0; i < 16; i++) {
    const a = i / 16 * Math.PI * 2;
    [0.42, -0.42].forEach(t => {
      const p0 = [Math.cos(a) * 0.055, Math.sin(a) * 0.055, 0.0], a1 = a + t;
      const p1 = [Math.cos(a1) * (rimR - 0.01), Math.sin(a1) * (rimR - 0.01), -0.014];
      face.add(tube([p0, p1], 0.0085, M.alloy, 2));
    });
  }
  const ring = mesh(new THREE.TorusGeometry(0.12, 0.006, 6, 40), M.alloy); ring.position.z = -0.007; face.add(ring);
  const hub = cyl(0.058, 0.064, 0.035, M.alloy, 32); hub.rotation.x = Math.PI / 2; face.add(hub);
  const cap = cyl(0.028, 0.028, 0.04, M.chrome); cap.rotation.x = Math.PI / 2; cap.position.z = 0.01; face.add(cap);
  const capB = mesh(new THREE.CircleGeometry(0.022, 24), new THREE.MeshStandardMaterial({ color: 0x1c69d4, roughness: 0.3 })); capB.position.z = 0.031; face.add(capB);
  for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; const b = cyl(0.005, 0.005, 0.012, M.chrome, 6); b.rotation.x = Math.PI / 2; b.position.set(Math.cos(a) * (rimR - 0.008), Math.sin(a) * (rimR - 0.008), 0.002); face.add(b); }
  const disc = cyl(0.13, 0.13, 0.02, M.steelDark, 32); disc.rotation.x = Math.PI / 2; disc.position.z = -0.04; g.add(disc);
  g.add(box(0.07, 0.11, 0.05, M.steelDark, 0.1, 0.06, -0.04, 0.01));
  return g;
}

export function buildInterior(car) {
  const I = new THREE.Group(); car.add(I);
  I.add(box(1.5, 0.05, DIM.W - 0.16, M.carpet, -0.15, 0.32, 0));
  I.add(box(0.30, 0.22, DIM.W - 0.16, M.dash, 0.66, 0.84, 0, 0.04));
  I.add(box(0.2, 0.12, 0.46, M.dash, 0.56, 0.90, 0.37, 0.03));
  I.add(box(0.03, 0.08, 0.34, new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.2 }), 0.46, 0.89, 0.37));
  I.add(box(0.36, 0.28, 0.22, M.dash, 0.46, 0.58, 0, 0.03));
  I.add(box(0.6, 0.12, 0.16, M.dash, 0.05, 0.42, 0, 0.03));
  const sw = new THREE.Group(); sw.position.set(0.40, 0.84, 0.37); sw.rotation.z = 0.45; I.add(sw);
  const rim = mesh(new THREE.TorusGeometry(0.19, 0.018, 10, 40), M.leather); rim.rotation.y = Math.PI / 2; sw.add(rim);
  sw.add(box(0.06, 0.1, 0.13, M.leather, 0, 0, 0, 0.02));
  sw.add(box(0.02, 0.025, 0.36, M.leather, 0, 0, 0));
  const seat = (z) => {
    const s = new THREE.Group();
    s.add(box(0.5, 0.13, 0.48, M.cloth, 0, 0.45, 0, 0.05));
    const back = box(0.13, 0.62, 0.48, M.cloth, -0.27, 0.76, 0, 0.05); back.rotation.z = 0.22; s.add(back);
    const hr = box(0.1, 0.17, 0.26, M.cloth, -0.36, 1.13, 0, 0.04); hr.rotation.z = 0.22; s.add(hr);
    [1, -1].forEach(k => s.add(box(0.48, 0.05, 0.06, M.leather, 0, 0.53, k * 0.21, 0.02)));
    s.position.set(0.0, 0, z); return s;
  };
  I.add(seat(0.37)); I.add(seat(-0.37));
  I.add(box(0.45, 0.16, DIM.W - 0.3, M.cloth, -0.95, 0.44, 0, 0.05));
  const rb = box(0.14, 0.52, DIM.W - 0.3, M.cloth, -1.18, 0.74, 0, 0.05); rb.rotation.z = 0.3; I.add(rb);
  I.add(box(0.3, 0.03, DIM.W - 0.3, M.dash, -1.32, 0.96, 0));
  const gear = cyl(0.008, 0.008, 0.14, M.chrome); gear.position.set(0.28, 0.5, 0); I.add(gear);
  const knob = mesh(new THREE.SphereGeometry(0.025, 12, 8), M.dash); knob.position.set(0.28, 0.58, 0); I.add(knob);
  I.add(box(0.03, 0.06, 0.2, M.dash, 0.30, 1.30, 0));
  return I;
}

export function buildUnderbody(car) {
  const U = new THREE.Group(); car.add(U);
  U.add(box(0.5, 0.12, 0.5, M.steelDark, 1.35, 0.30, 0));
  U.add(box(0.12, 0.06, 1.25, M.steelDark, AXf, 0.26, 0));
  U.add(box(0.12, 0.06, 1.1, M.steelDark, -AXf, 0.27, 0));
  U.add(tube([[1.2, 0.24, 0.12], [0.4, 0.2, 0.12], [-0.6, 0.2, 0.15], [-1.3, 0.23, 0.18], [-2.05, 0.25, 0.42]], 0.028, M.exhaust, 30));
  U.add(box(0.5, 0.1, 0.22, M.exhaust, -0.1, 0.21, 0.13, 0.04));
  U.add(box(0.45, 0.12, 0.3, M.exhaust, -1.75, 0.27, 0.35, 0.04));
  U.add(tube([[0.9, 0.22, 0], [-1.1, 0.24, 0]], 0.025, M.steelDark, 6));
  U.add(box(0.28, 0.16, 0.3, M.steelDark, -AXf, 0.31, 0, 0.03));
  [1, -1].forEach(s => {
    U.add(tube([[AXf + 0.1, 0.27, s * 0.62], [AXf - 0.25, 0.26, s * 0.25]], 0.02, M.steelDark, 4));
    U.add(box(3.2, 0.07, 0.06, M.underbody, 0, 0.24, s * 0.66));
  });
  return U;
}
