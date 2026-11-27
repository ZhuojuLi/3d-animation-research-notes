import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { deform, triplanarUV, rng } from './util.js';

// Collects deformed stone pieces in world space and merges them per material.
export class StoneBatch {
  constructor(uvScale = 0.5) { this.geos = []; this.uvScale = uvScale; }
  push(geo) { this.geos.push(geo.index ? geo.toNonIndexed() : geo); return this; }
  // rough block: w,h,d size; pos; rotation y (+ small x/z tilt); deformation amplitude
  block(w, h, d, x, y, z, ry = 0, amp = 0.04, tilt = [0, 0], seg = [2, 2, 2]) {
    const g = new THREE.BoxGeometry(w, h, d, ...seg);
    // bevel-ish: pull edge vertices inward a little (weathered rounded edges)
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const vx = p.getX(i), vy = p.getY(i), vz = p.getZ(i);
      const ex = Math.abs(vx) > w / 2 - 1e-4, ey = Math.abs(vy) > h / 2 - 1e-4, ez = Math.abs(vz) > d / 2 - 1e-4;
      const edges = ex + ey + ez;
      if (edges >= 2) { const k = edges === 3 ? 0.88 : 0.93; const m = Math.min(w, h, d) * (1 - k) * 0.5;
        p.setXYZ(i, vx - Math.sign(vx) * (ex ? m : 0), vy - Math.sign(vy) * (ey ? m : 0), vz - Math.sign(vz) * (ez ? m : 0)); }
    }
    g.rotateX(tilt[0]); g.rotateZ(tilt[1]); g.rotateY(ry); g.translate(x, y, z);
    deform(g, amp, 1.7, x * 3.1 + z * 1.7);
    return this.push(g);
  }
  // irregular rubble stone
  rubble(r, x, y, z, seed, squash = 0.7) {
    const g = new THREE.IcosahedronGeometry(r, 1);
    const rr = rng(seed);
    g.scale(1 + rr() * 0.5, squash, 0.8 + rr() * 0.4); g.rotateY(rr() * 6.28); g.translate(x, y, z);
    deform(g, r * 0.28, 1.2 / r, seed);
    return this.push(g);
  }
  build(material, { cast = true, receive = true } = {}) {
    if (!this.geos.length) return null;
    const g = mergeGeometries(this.geos.map(x => { x.deleteAttribute('uv'); return x; }));
    // geometry already in world space; normals from deform are smooth per piece
    triplanarUVKeepNormals(g, this.uvScale);
    const m = new THREE.Mesh(g, material); m.castShadow = cast; m.receiveShadow = receive;
    return m;
  }
}

function triplanarUVKeepNormals(g, scale) {
  const n = g.attributes.normal.clone();
  triplanarUV(g, scale);
  g.setAttribute('normal', n);
}
