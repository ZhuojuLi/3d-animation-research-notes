// Engine on pallet, rolling tool cart, loose wheel, tyre stacks, floor jack
import * as THREE from 'three';
import { M } from './materials.js';
import { box, cyl, tube } from './geom.js';
import { tire, can, rand } from './props.js';
import { buildWheel } from './carParts.js';

export function engine() {
  const g = new THREE.Group();
  g.add(box(1.2, 0.12, 0.8, M.wood, 0, 0.06, 0, 0.005));
  for (let i = -2; i <= 2; i++) g.add(box(1.2, 0.02, 0.12, M.wood, 0, 0.13, i * 0.17));
  const E = new THREE.Group(); E.position.y = 0.14; g.add(E);
  E.add(box(0.85, 0.34, 0.36, M.engineBlock, 0, 0.30, 0, 0.03));
  E.add(box(0.9, 0.1, 0.42, M.steelDark, 0, 0.08, 0, 0.02));
  E.add(box(0.86, 0.14, 0.32, M.engineBlock, 0, 0.54, 0.02, 0.02));
  E.add(box(0.82, 0.1, 0.26, M.engineCover, 0, 0.66, 0.02, 0.04));
  for (let i = 0; i < 6; i++) { const p = cyl(0.012, 0.012, 0.04, M.trimBlack, 8); p.position.set(-0.32 + i * 0.13, 0.72, 0.02); E.add(p); }
  for (let i = 0; i < 6; i++) E.add(tube([[-0.32 + i * 0.13, 0.55, -0.15], [-0.32 + i * 0.13, 0.62, -0.28], [-0.32 + i * 0.13, 0.48, -0.36]], 0.025, M.alloyDark, 8));
  E.add(box(0.9, 0.12, 0.1, M.alloyDark, 0, 0.44, -0.38, 0.03));
  for (let i = 0; i < 6; i++) E.add(tube([[-0.32 + i * 0.13, 0.45, 0.2], [-0.3 + i * 0.1, 0.32, 0.3], [0.1, 0.15, 0.32]], 0.022, M.copper, 8));
  E.add(box(0.06, 0.48, 0.3, M.engineBlock, 0.45, 0.36, 0, 0.02));
  [[0.5, 0.18, 0, 0.09], [0.5, 0.5, 0.02, 0.06], [0.5, 0.3, 0.18, 0.05]].forEach(([x, y, z, r]) => { const p = cyl(r, r, 0.04, M.steelDark, 20); p.rotation.z = Math.PI / 2; p.position.set(x, y, z); E.add(p); });
  const fw = cyl(0.2, 0.2, 0.05, M.liftSteel, 32); fw.rotation.z = Math.PI / 2; fw.position.set(-0.47, 0.3, 0); E.add(fw);
  const alt = cyl(0.07, 0.07, 0.14, M.alloyDark, 16); alt.rotation.z = Math.PI / 2; alt.position.set(0.36, 0.3, 0.22); E.add(alt);
  E.add(tube([[0.4, 0.6, -0.1], [0.55, 0.75, -0.2], [0.3, 0.8, -0.35]], 0.025, M.rubber, 10));
  return g;
}

export function toolCart() {
  const g = new THREE.Group(); const W = 0.95, D = 0.5;
  [0.2, 0.55, 0.88].forEach(y => {
    g.add(box(W, 0.03, D, M.cabinetRed, 0, y, 0, 0.01));
    [1, -1].forEach(s => g.add(box(W, 0.12, 0.02, M.cabinetRed, 0, y + 0.06, s * D / 2)));
    [1, -1].forEach(s => g.add(box(0.02, 0.12, D, M.cabinetRed, s * W / 2, y + 0.06, 0)));
  });
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => {
    g.add(box(0.025, 0.85, 0.025, M.trimBlack, a * W / 2, 0.52, b * D / 2));
    const c = cyl(0.045, 0.045, 0.03, M.rubber, 12); c.rotation.x = Math.PI / 2; c.position.set(a * (W / 2 - 0.02), 0.05, b * (D / 2 - 0.02)); g.add(c);
  });
  g.add(tube([[W / 2, 0.88, -0.18], [W / 2 + 0.12, 0.92, -0.18], [W / 2 + 0.12, 0.92, 0.18], [W / 2, 0.88, 0.18]], 0.014, M.chrome, 12));
  for (let i = 0; i < 9; i++) { const w = box(0.22 + rand() * 0.1, 0.012, 0.03, M.chrome, -0.3 + rand() * 0.5, 0.92, -0.18 + rand() * 0.36); w.rotation.y = rand() * 3; g.add(w); }
  const rag = box(0.25, 0.03, 0.2, new THREE.MeshStandardMaterial({ color: 0x9e3326, roughness: 1 }), 0.2, 0.92, 0.08, 0.01); rag.rotation.y = 0.4; g.add(rag);
  [[0xd8d8d8, -0.36, 0.1], [0xc21f1f, -0.25, 0.15]].forEach(([c, x, z]) => { const k = can(c, 0.26, 0.035); k.position.set(x, 0.9, z); g.add(k); });
  const k2 = can(0x1d4fa0, 0.25, 0.1); k2.position.set(0.25, 0.58, 0); g.add(k2);
  return g;
}

export function looseWheel() { const w = buildWheel(); w.rotation.x = -Math.PI / 2; w.position.y = 0.1; return w; }

export function tireStack(n = 4) {
  const g = new THREE.Group();
  for (let i = 0; i < n; i++) { const t = tire(0.31, 0.2); t.rotation.x = Math.PI / 2; t.rotation.z = rand(); t.position.set((rand() - 0.5) * 0.04, 0.1 + i * 0.2, (rand() - 0.5) * 0.04); g.add(t); }
  return g;
}

export function jack() {
  const g = new THREE.Group();
  g.add(box(0.9, 0.12, 0.32, M.cabinetRed, 0, 0.1, 0, 0.02));
  g.add(tube([[-0.4, 0.15, 0], [-0.9, 0.7, 0]], 0.018, M.cabinetRed, 4));
  const s = cyl(0.07, 0.07, 0.03, M.rubber, 16); s.position.set(0.38, 0.19, 0); g.add(s);
  return g;
}
