import * as THREE from 'three';
import { addWind, rng } from './util.js';

// Dry grass tuft geometry: several curved tapered blades fanning out from a base.
function tuftGeometry(seed, blades = 18, height = 0.55) {
  const r = rng(seed), pos = [], col = [], idx = [];
  for (let b = 0; b < blades; b++) {
    const a = r() * Math.PI * 2, lean = 0.15 + r() * 0.55, h = height * (0.5 + r() * 0.7), w = 0.012 + r() * 0.014;
    const dx = Math.cos(a), dz = Math.sin(a), px = -dz, pz = dx, segs = 4, base = pos.length / 3;
    const ox = dx * r() * 0.06, oz = dz * r() * 0.06;
    const tone = 0.75 + r() * 0.35, dead = r() < 0.25;
    for (let s = 0; s <= segs; s++) {
      const t = s / segs, bend = lean * t * t * h, y = h * t, ww = w * (1 - t * 0.9);
      const cx = ox + dx * bend, cz = oz + dz * bend;
      pos.push(cx - px * ww, y, cz - pz * ww, cx + px * ww, y, cz + pz * ww);
      const c = dead ? [0.55, 0.47, 0.36] : [0.62 + t * 0.3, 0.46 + t * 0.26, 0.2 + t * 0.1];
      for (let k = 0; k < 2; k++) col.push(c[0] * tone * (0.45 + 0.55 * t), c[1] * tone * (0.45 + 0.55 * t), c[2] * tone * (0.45 + 0.55 * t));
      if (s < segs) { const i = base + s * 2; idx.push(i, i + 1, i + 2, i + 1, i + 3, i + 2); }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx); g.computeVertexNormals();
  // bias normals upward for soft, translucent-looking grass shading
  const n = g.attributes.normal; for (let i = 0; i < n.count; i++) { n.setY(i, Math.abs(n.getY(i)) + 0.8); }
  g.normalizeNormals?.();
  return g;
}

// places: array of {x,y,z,s} spawn points
export function createGrass(scene, places) {
  const mat = addWind(new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.85, emissive: 0x2a1406, emissiveIntensity: 0.35 }), 'grass');
  const variants = [tuftGeometry(1, 22, 0.6), tuftGeometry(2, 14, 0.4), tuftGeometry(3, 30, 0.75)];
  const meshes = [], r = rng(5), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  variants.forEach((geo, vi) => {
    const list = places.filter((_, i) => i % 3 === vi);
    const im = new THREE.InstancedMesh(geo, mat, list.length);
    list.forEach((p, i) => {
      e.set((r() - 0.5) * 0.25, r() * 6.28, (r() - 0.5) * 0.25); q.setFromEuler(e);
      const s = p.s * (0.7 + r() * 0.6);
      m4.compose(new THREE.Vector3(p.x, p.y - 0.02, p.z), q, new THREE.Vector3(s, s * (0.8 + r() * 0.5), s)); im.setMatrixAt(i, m4);
    });
    im.castShadow = true; im.receiveShadow = true; im.frustumCulled = false;
    scene.add(im); meshes.push(im);
  });
  return { meshes, mat };
}

// generate spawn points: along step edges / joints, on terrace, in pier cracks
export function grassPlaces(tops, terraceHeight) {
  const r = rng(9), out = [];
  tops.forEach((t, i) => {
    const n = 7 + Math.floor(r() * 7);
    for (let k = 0; k < n; k++) {
      const x = t.xl + r() * (t.xr - t.xl);
      const atRiser = r() < 0.65;
      out.push({ x, y: atRiser ? (i ? tops[i - 1].y : 0) : t.y, z: atRiser ? t.zFront + 0.08 + r() * 0.08 : t.zFront - r() * 0.55, s: 0.45 + r() * 0.6 });
    }
    // cluster along the left ragged edge
    for (let k = 0; k < 4; k++) out.push({ x: t.xl - 0.2 - r() * 1.4, y: 0.05, z: t.zFront - r() * 0.6, s: 0.6 + r() * 0.7 });
  });
  for (let k = 0; k < 160; k++) {                // open forecourt
    const x = -18 + r() * 14, z = -6 + r() * 12; if (x > -9 && z > 0) continue;
    out.push({ x, y: terraceHeight(x, z), z, s: 0.5 + r() * 0.8 });
  }
  for (let k = 0; k < 70; k++) {                 // pier ledges and wall foot
    const x = 0.5 + r() * 3.5, z = 1.2 + r() * 3.2;
    out.push({ x, y: 2.55 + r() * 0.3, z, s: 0.7 + r() * 0.8 });
  }
  for (let k = 0; k < 24; k++) out.push({ x: -4.4 + r() * 2.6, y: DOORY + 0.02, z: 0.1 + r() * 1.0, s: 0.4 + r() * 0.5 });
  return out;
}
const DOORY = 2.25;
