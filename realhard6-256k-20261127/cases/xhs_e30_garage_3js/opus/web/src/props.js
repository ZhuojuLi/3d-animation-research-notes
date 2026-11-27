// Workshop props: tool cabinets, tyre racking, parts bins, BMW poster, pegboard
import * as THREE from 'three';
import { M } from './materials.js';
import { mesh, box, cyl } from './geom.js';
import { posterTex, textTex, tireSideTex } from './textures.js';

let seed = 42; export const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const sideTex = tireSideTex();
const tireSideMat = new THREE.MeshStandardMaterial({ map: sideTex, roughness: 0.85, color: 0xffffff });

export function tire(R = 0.31, W = 0.2) {
  const g = new THREE.Group();
  const t = mesh(new THREE.TorusGeometry(R - W * 0.32, W * 0.36, 14, 36), M.tire); t.scale.set(1, 1, 1.35); g.add(t);
  const tr = mesh(new THREE.CylinderGeometry(R - 0.01, R - 0.01, W * 0.9, 36, 1, true), M.tire); tr.rotation.x = Math.PI / 2; g.add(tr);
  [1, -1].forEach(s => { const sw = mesh(new THREE.RingGeometry(R * 0.6, R - 0.02, 36), tireSideMat); sw.position.z = s * W * 0.47; if (s < 0) sw.rotation.y = Math.PI; g.add(sw); });
  return g;
}

export function toolChest(w = 1.4, h = 1.05, d = 0.55, mat = M.cabinet) {
  const g = new THREE.Group();
  g.add(box(w, h, d, mat, 0, h / 2 + 0.08, 0, 0.015));
  const rows = 7;
  for (let i = 0; i < rows; i++) {
    const dh = (h - 0.1) / rows, y = 0.13 + dh * (i + 0.5);
    g.add(box(w - 0.08, dh - 0.02, 0.01, mat, 0, y, d / 2 + 0.006, 0.003));
    g.add(box(w * 0.6, 0.014, 0.025, M.chrome, 0, y + dh * 0.3, d / 2 + 0.02, 0.005));
  }
  g.add(box(w, 0.025, d + 0.02, new THREE.MeshStandardMaterial({ color: 0x0e0e0e, roughness: 0.85 }), 0, h + 0.095, 0));
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => { const c = cyl(0.04, 0.04, 0.03, M.rubber, 12); c.rotation.x = Math.PI / 2; c.position.set(a * (w / 2 - 0.08), 0.04, b * (d / 2 - 0.06)); g.add(c); });
  const lbl = mesh(new THREE.PlaneGeometry(0.22, 0.05), new THREE.MeshStandardMaterial({ map: textTex(['SONIC'], 256, 64, '#1d1f23', '#e8e8e8', 'bold 40px DejaVu Sans'), roughness: 0.4 }));
  lbl.position.set(w / 2 - 0.16, 0.18, d / 2 + 0.013); g.add(lbl);
  return g;
}

export function partsBin(w, h, d, color) {
  const g = new THREE.Group(); const m = new THREE.MeshStandardMaterial({ color, roughness: 0.6 });
  g.add(box(w, h, d, m, 0, h / 2, 0, 0.01));
  g.add(box(w * 0.6, h * 0.25, 0.005, M.white, 0, h * 0.55, d / 2 + 0.003));
  return g;
}

export function tyreRack() {
  // tall steel racking: 4 levels, stacked tyres on upper, bins/boxes on lower
  const g = new THREE.Group(); const W = 2.7, D = 0.9, H = 4.0;
  [[-W / 2, -D / 2], [W / 2, -D / 2], [-W / 2, D / 2], [W / 2, D / 2], [0, -D / 2], [0, D / 2]].forEach(([x, z]) => g.add(box(0.07, H, 0.07, M.shelf, x, H / 2, z)));
  const levels = [0.15, 0.95, 1.75, 2.65, 3.6];
  levels.forEach(y => {
    [1, -1].forEach(s => g.add(box(W, 0.1, 0.05, M.shelf, 0, y, s * D / 2)));
    g.add(box(W, 0.02, D, new THREE.MeshStandardMaterial({ color: 0x3a3c40, metalness: 0.6, roughness: 0.6 }), 0, y + 0.05, 0));
  });
  // Michelin banner
  const ban = mesh(new THREE.PlaneGeometry(1.5, 0.22), new THREE.MeshStandardMaterial({ map: textTex(['MICHELIN'], 512, 76, '#14306e', '#ffffff', 'italic bold 52px DejaVu Sans'), roughness: 0.5 }));
  ban.position.set(0, 3.35, D / 2 + 0.04); g.add(ban);
  // tyres standing in rows on top two levels
  [[2.65, 0.3], [3.6, 0.33]].forEach(([y, R]) => {
    for (let x = -W / 2 + 0.22; x < W / 2 - 0.1; x += 0.24) {
      const t = tire(R, 0.21); t.rotation.y = Math.PI / 2 + (rand() - 0.5) * 0.15; t.position.set(x, y + 0.06 + R, 0.05); g.add(t);
    }
  });
  // second level: tyre stack + boxes
  for (let x = -W / 2 + 0.2; x < 0.2; x += 0.24) { const t = tire(0.3, 0.2); t.rotation.y = Math.PI / 2; t.position.set(x, 1.81 + 0.3, 0.05); g.add(t); }
  [[0.6, 0.25, 0.3], [1.0, 0.18, 0.25]].forEach(([x, w, h]) => g.add(box(w * 2, h, 0.5, M.cardboard, x, 1.8 + h / 2, 0, 0.01)));
  // bins on lower levels
  const cols = [0xbfbfbf, 0xd6d3cc, 0x2f5fa8, 0xc23b2a];
  for (let i = 0; i < 5; i++) { const b = partsBin(0.42, 0.22, 0.55, cols[i % 4]); b.position.set(-W / 2 + 0.3 + i * 0.52, 1.0, 0.05); g.add(b); }
  for (let i = 0; i < 4; i++) { const b = box(0.5, 0.3 + rand() * 0.15, 0.55, i % 2 ? M.cardboard : M.white, -W / 2 + 0.35 + i * 0.66, 0.2 + 0.17, 0, 0.01); g.add(b); }
  return g;
}

export function pegboard() {
  const g = new THREE.Group();
  g.add(box(1.8, 1.2, 0.03, new THREE.MeshStandardMaterial({ color: 0x2b2f36, roughness: 0.7 }), 0, 0, 0));
  const toolMat = [M.chrome, M.cabinetRed, M.yellow, M.trimBlack];
  for (let i = 0; i < 26; i++) {
    const x = -0.8 + (i % 13) * 0.13, y = i < 13 ? 0.28 : -0.22, l = 0.18 + rand() * 0.22;
    g.add(box(0.025, l, 0.025, toolMat[(i * 7) % 4], x, y - l / 2 + 0.1, 0.03));
  }
  for (let i = 0; i < 8; i++) g.add(box(0.12, 0.06, 0.12, toolMat[i % 4], -0.7 + i * 0.2, -0.5, 0.06, 0.01));
  return g;
}

export function poster() {
  const g = new THREE.Group();
  const m = mesh(new THREE.PlaneGeometry(0.95, 1.67), new THREE.MeshStandardMaterial({ map: posterTex(), roughness: 0.55 }));
  g.add(m); g.add(box(0.99, 1.71, 0.02, M.trimBlack, 0, 0, -0.012));
  return g;
}

// small clutter on bench/floor: oil cans, jerrycan
export function can(color, h = 0.28, r = 0.08) {
  const g = new THREE.Group(); const c = cyl(r, r, h, new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.3 }), 16); c.position.y = h / 2; g.add(c);
  const cap = cyl(r * 0.3, r * 0.3, 0.04, M.trimBlack, 8); cap.position.set(r * 0.4, h + 0.02, 0); g.add(cap);
  return g;
}
