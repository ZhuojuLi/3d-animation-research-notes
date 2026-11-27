// Small geometry helpers
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export function mesh(geo, mat, cast = true, recv = true) {
  const m = new THREE.Mesh(geo, mat); m.castShadow = cast; m.receiveShadow = recv; return m;
}
export function box(w, h, d, mat, x = 0, y = 0, z = 0, r = 0) {
  const g = r > 0 ? new RoundedBoxGeometry(w, h, d, 2, r) : new THREE.BoxGeometry(w, h, d);
  const m = mesh(g, mat); m.position.set(x, y, z); return m;
}
export function cyl(rt, rb, h, mat, seg = 24) { return mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat); }
// Quad from 4 points (counter-clockwise), double sided via material
export function quad(a, b, c, d, mat) {
  const g = new THREE.BufferGeometry();
  const p = [a, b, c, a, c, d].flatMap(v => [v.x, v.y, v.z]);
  g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1], 2));
  g.computeVertexNormals(); return mesh(g, mat);
}
// Planar polygon (convex/concave) from 2D pts mapped through fn(u,v)->Vector3
export function polyIn(pts2, fn, mat) {
  const shape = new THREE.Shape(pts2.map(p => new THREE.Vector2(p[0], p[1])));
  const g = new THREE.ShapeGeometry(shape);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) { const v = fn(pos.getX(i), pos.getY(i)); pos.setXYZ(i, v.x, v.y, v.z); }
  g.computeVertexNormals(); return mesh(g, mat);
}
// Extrude a side profile (x,y) along z, centered, with bevel
export function extrudeProfile(pts, depth, mat, bevel = 0.03, seg = 3) {
  const shape = new THREE.Shape(pts.map(p => new THREE.Vector2(p[0], p[1])));
  const g = new THREE.ExtrudeGeometry(shape, { depth: depth - 2 * bevel, bevelEnabled: bevel > 0,
    bevelThickness: bevel, bevelSize: bevel, bevelSegments: seg, curveSegments: 16 });
  g.translate(0, 0, -(depth - 2 * bevel) / 2); g.computeVertexNormals();
  return mesh(g, mat);
}
// Tube along a list of points
export function tube(points, r, mat, seg = 32, closed = false) {
  const c = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)), closed);
  return mesh(new THREE.TubeGeometry(c, seg, r, 8, closed), mat);
}
export function arcPts(cx, cy, r, a0, a1, n) {
  const o = []; for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; o.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); } return o;
}
