import * as THREE from 'three';
import { StoneBatch } from './batch.js';
import { stoneMaterial } from './textures.js';
import { rng } from './util.js';

export const DOOR = { a: 1.15, sill: 2.25, spring: 5.35, k: 0.86, outerA: 1.9, wallZ: 0, thick: 1.5 };

// pointed arch: points from left springing over apex to right springing
export function archPts(a, ys, k = 0.86, n = 24) {
  const R = 2 * a * k, cx = R - a, pts = [];
  const apexH = Math.sqrt(R * R - cx * cx), angL0 = Math.PI, angL1 = Math.atan2(apexH, -cx);
  for (let i = 0; i <= n; i++) { const t = angL0 + (angL1 - angL0) * i / n; pts.push(new THREE.Vector2(cx + R * Math.cos(t) - 0, ys + R * Math.sin(t))); }
  for (let i = n - 1; i >= 0; i--) { const p = pts[i]; pts.push(new THREE.Vector2(-p.x, p.y)); }
  return pts;
}
const inArch = (x, y, a, ys, k) => {
  if (Math.abs(x) > a) return false; if (y < ys) return true;
  const R = 2 * a * k, cx = R - a; return Math.hypot(Math.abs(x) - (-cx), y - ys) < R; // mirrored center
};

function slab(shapeFn, depth, z) {
  const s = new THREE.Shape(); shapeFn(s);
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 1 });
  g.translate(0, 0, z); return g;
}

export function createChapel(scene) {
  const D = DOOR, r = rng(11);
  const wallMat = stoneMaterial({ seed: 5, blocks: true, tint: [0.50, 0.49, 0.46], moss: 0.6 }, { bumpScale: 2.5 });
  const blockMat = stoneMaterial({ seed: 7, tint: [0.53, 0.51, 0.47], moss: 0.7 }, { bumpScale: 2.8 });
  const carvedMat = stoneMaterial({ seed: 9, tint: [0.60, 0.55, 0.48], moss: 0.4 }, { bumpScale: 1.6 });
  const L = -4.1, Rx = 9, top = 17, base = -0.6, T = D.thick;

  // core wall slab with outer portal opening (blocks are layered on top)
  const outer = archPts(D.outerA, D.spring, 0.8, 20);
  const core = new StoneBatch(0.35);
  core.push(slab(s => { s.moveTo(L, base); s.lineTo(Rx, base); s.lineTo(Rx, top); s.lineTo(L, top); s.lineTo(L, base);
    const h = new THREE.Path(); h.moveTo(-D.outerA, D.sill); outer.forEach(p => h.lineTo(p.x, p.y)); h.lineTo(D.outerA, D.sill); h.lineTo(-D.outerA, D.sill); s.holes.push(h); }, T, -T - 0.02));
  // side wall going back (visible from the camera on the left)
  core.push(slab(s => { s.moveTo(-14, base); s.lineTo(0, base); s.lineTo(0, top - 2); s.lineTo(-14, top - 4); s.lineTo(-14, base); }, 1.2, 0).rotateY(-Math.PI / 2).translate(L + 0.02, 0, -0.02));
  const group = new THREE.Group();
  group.add(core.build(wallMat));

  // ashlar blocks on facade face, skipping opening + voussoir band
  const bb = new StoneBatch(0.6);
  let y = base;
  while (y < top - 0.2) {
    const h = 0.32 + r() * 0.22; let x = L + (r() * 0.4);
    while (x < Rx) {
      const w = Math.min(0.55 + r() * 0.75, Rx - x); const cxp = x + w / 2, cyp = y + h / 2;
      const nearArch = inArch(cxp, cyp, D.outerA + 0.62, D.spring, 0.8) || inArch(x + 0.02, cyp, D.outerA + 0.5, D.spring, 0.8) || inArch(x + w - 0.02, cyp, D.outerA + 0.5, D.spring, 0.8);
      const decay = r() < 0.06;   // a few missing / eroded stones
      if (!nearArch && !decay && w > 0.15) bb.block(w - 0.035, h - 0.035, 0.22, cxp, cyp, 0.04 + r() * 0.04, 0, 0.035, [0, (r() - 0.5) * 0.02], [2, 2, 1]);
      x += w;
    }
    y += h;
  }
  // corner quoins wrapping onto side wall
  for (let qy = base; qy < top - 1; qy += 0.5) {
    const alt = Math.round((qy - base) / 0.5) % 2;
    bb.block(alt ? 0.9 : 0.5, 0.46, alt ? 0.5 : 0.9, L + (alt ? 0.38 : 0.18), qy + 0.25, alt ? 0.1 : -0.3, 0, 0.04, [0, 0], [2, 2, 2]);
  }
  // ashlar on side face
  for (let sy = base; sy < top - 3; sy += 0.45) for (let sz = -1.2; sz > -13; sz -= 0.8 + r() * 0.5)
    if (r() > 0.08) bb.block(0.18, 0.4, 0.75 + r() * 0.4, L - 0.06, sy + 0.22, sz, 0, 0.03, [0, 0], [1, 2, 2]);
  group.add(bb.build(blockMat));

  // portal: voussoirs (two orders), jambs, colonnettes with capitals, hood moulding
  const cv = new StoneBatch(0.7);
  const orders = [{ a: D.outerA + 0.3, w: 0.5, z: 0.08, d: 0.7 }, { a: D.outerA - 0.12, w: 0.42, z: -0.35, d: 0.6 }, { a: D.a + 0.25, w: 0.3, z: -0.9, d: 0.7 }];
  for (const o of orders) {
    const pts = archPts(o.a, D.spring, 0.8, 16);
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i], p1 = pts[i + 1], mid = p0.clone().add(p1).multiplyScalar(0.5);
      const ang = Math.atan2(p1.y - p0.y, p1.x - p0.x), len = p0.distanceTo(p1);
      const g = new THREE.BoxGeometry(len * 1.02, o.w, o.d, 2, 2, 1); g.translate(0, -o.w / 2 + 0.02, 0);
      g.rotateZ(ang); g.translate(mid.x, mid.y, o.z - o.d / 2 + 0.3);
      cv.push(g);
    }
    for (const sx of [-1, 1]) for (let jy = D.sill - 0.1; jy < D.spring; jy += 0.5)
      cv.block(o.w * 0.9, 0.48, o.d, sx * (o.a - o.w * 0.45), jy + 0.25, o.z - o.d / 2 + 0.3, 0, 0.025, [0, 0], [1, 2, 1]);
  }
  // colonnettes in the recesses
  for (const sx of [-1, 1]) for (const [ox, oz] of [[D.outerA + 0.05, 0.12], [D.outerA - 0.35, -0.45]]) {
    const shaft = new THREE.CylinderGeometry(0.13, 0.14, D.spring - D.sill - 0.7, 12, 6); shaft.translate(sx * ox, (D.spring + D.sill) / 2 - 0.05, oz); cv.push(shaft);
    const cap = new THREE.CylinderGeometry(0.26, 0.15, 0.42, 10, 2); cap.translate(sx * ox, D.spring - 0.2, oz); cv.push(cap);
    const abacus = new THREE.BoxGeometry(0.6, 0.12, 0.55); abacus.translate(sx * ox, D.spring + 0.05, oz); cv.push(abacus);
    const bse = new THREE.CylinderGeometry(0.2, 0.24, 0.32, 10); bse.translate(sx * ox, D.sill + 0.12, oz); cv.push(bse);
  }
  // hood moulding (projecting torus following the arch)
  const hood = archPts(D.outerA + 0.42, D.spring, 0.8, 30).map(p => new THREE.Vector3(p.x, p.y, 0.4));
  cv.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(hood), 80, 0.11, 8, false));
  // string course + plinth
  cv.block(Rx - L + 0.3, 0.22, 0.3, (Rx + L) / 2 + 0.1, 9.4, 0.25, 0, 0.03, [0, 0], [12, 1, 1]);
  cv.block(Rx - D.outerA - 0.7, 0.5, 0.45, (Rx + D.outerA + 0.7) / 2, D.sill - 0.25, 0.22, 0, 0.04, [0, 0], [8, 1, 1]);
  cv.block(-D.outerA - 0.7 - L, 0.5, 0.45, (L - D.outerA - 0.7) / 2, D.sill - 0.25, 0.22, 0, 0.04, [0, 0], [3, 1, 1]);
  group.add(cv.build(carvedMat));
  scene.add(group);
  return { group, wallMat };
}
