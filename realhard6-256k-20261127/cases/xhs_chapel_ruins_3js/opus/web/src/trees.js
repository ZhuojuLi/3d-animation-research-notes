import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { addWind, rng } from './util.js';
import { leafTexture } from './textures.js';

// Twisted olive / holm-oak style tree: recursive tapered tube branches + alpha leaf cards.
function grow(r, start, dir, len, rad, depth, branches, leaves) {
  const pts = [start.clone()], segs = 5; let p = start.clone(), d = dir.clone();
  for (let i = 1; i <= segs; i++) {
    d.add(new THREE.Vector3((r() - 0.5) * 0.7, (r() - 0.4) * 0.3, (r() - 0.5) * 0.7)).normalize();
    p = p.clone().addScaledVector(d, len / segs); pts.push(p);
  }
  const curve = new THREE.CatmullRomCurve3(pts);
  const tube = new THREE.TubeGeometry(curve, 10, rad, 7, false);
  // taper along length
  const pos = tube.attributes.position, ring = 8;
  for (let i = 0; i < pos.count; i++) {
    const seg = Math.floor(i / ring), t = seg / 10, c = curve.getPoint(t);
    const k = 1 - t * 0.6; pos.setXYZ(i, c.x + (pos.getX(i) - c.x) * k, c.y + (pos.getY(i) - c.y) * k, c.z + (pos.getZ(i) - c.z) * k);
  }
  tube.computeVertexNormals(); branches.push(tube);
  if (depth <= 0) {
    for (let i = 0; i < 3; i++) leaves.push(curve.getPoint(0.55 + r() * 0.45).add(new THREE.Vector3((r() - .5) * .8, r() * .4, (r() - .5) * .8)));
    return;
  }
  const n = depth > 2 ? 2 : 2 + (r() < 0.5 ? 1 : 0);
  for (let i = 0; i < n; i++) {
    const t = 0.55 + r() * 0.45, o = curve.getPoint(t), nd = curve.getTangent(t).clone();
    nd.add(new THREE.Vector3((r() - 0.5) * 1.6, 0.25 + r() * 0.4, (r() - 0.5) * 1.6)).normalize();
    grow(r, o, nd, len * (0.62 + r() * 0.2), rad * 0.62, depth - 1, branches, leaves);
  }
}

export function createTrees(scene, specs) {
  const barkMat = addWind(new THREE.MeshStandardMaterial({ color: 0x2c221c, roughness: 0.95 }), 'tree');
  const leafMat = addWind(new THREE.MeshStandardMaterial({ map: leafTexture(), alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.9, color: 0x8f8a62, emissive: 0x1a0c04 }), 'tree');
  const allB = [], allL = [];
  specs.forEach((s, ti) => {
    const r = rng(s.seed), br = [], lv = [];
    const dir = new THREE.Vector3(s.lean ?? 0.2, 1, (r() - 0.5) * 0.3).normalize();
    grow(r, new THREE.Vector3(s.x, s.y - 0.3, s.z), dir, s.h * 0.42, s.h * 0.035, s.depth ?? 4, br, lv);
    allB.push(...br.map(g => g.toNonIndexed ? g.toNonIndexed() : g));
    lv.forEach(p => {
      const sz = s.h * (0.16 + r() * 0.1), c = new THREE.PlaneGeometry(sz, sz * 0.8);
      c.rotateY(r() * Math.PI); c.rotateX((r() - 0.5) * 0.6); c.translate(p.x, p.y, p.z); allL.push(c);
    });
  });
  const bm = new THREE.Mesh(mergeGeometries(allB), barkMat), lm = new THREE.Mesh(mergeGeometries(allL), leafMat);
  bm.castShadow = true; lm.receiveShadow = true;
  scene.add(bm, lm);
  return { branches: bm, leaves: lm };
}
