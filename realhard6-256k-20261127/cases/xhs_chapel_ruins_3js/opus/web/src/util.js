import * as THREE from 'three';

export function rng(seed = 1) {
  let s = (seed * 2654435761) >>> 0 || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}
function hash(x, y, z) {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 1440662683);
  h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
const sm = t => t * t * (3 - 2 * t);
const mod = (a, p) => (p ? ((a % p) + p) % p : a);
// value noise, optionally periodic in x/y (for tileable textures)
export function noise3(x, y, z = 0, p = 0) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const fx = sm(x - xi), fy = sm(y - yi), fz = sm(z - zi);
  const X0 = mod(xi, p), X1 = mod(xi + 1, p), Y0 = mod(yi, p), Y1 = mod(yi + 1, p);
  const l = (a, b, t) => a + (b - a) * t;
  const c = (zz) => l(l(hash(X0, Y0, zz), hash(X1, Y0, zz), fx), l(hash(X0, Y1, zz), hash(X1, Y1, zz), fx), fy);
  return l(c(zi), c(zi + 1), fz);
}
export function fbm(x, y, z = 0, oct = 5, p = 0) {
  let a = 0.5, f = 1, s = 0, n = 0;
  for (let i = 0; i < oct; i++) { s += a * noise3(x * f, y * f, z * f, p ? p * f : 0); n += a; a *= 0.5; f *= 2; }
  return s / n;
}

// displace vertices with smooth 3D noise (positions identical -> same offset => no cracks)
export function deform(geo, amp = 0.05, freq = 2, seed = 0) {
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    p.setXYZ(i,
      x + (fbm(x * freq + seed, y * freq, z * freq, 3) - 0.5) * 2 * amp,
      y + (fbm(x * freq, y * freq + seed + 7, z * freq, 3) - 0.5) * 2 * amp,
      z + (fbm(x * freq, y * freq, z * freq + seed + 13, 3) - 0.5) * 2 * amp);
  }
  geo.computeVertexNormals();
  return geo;
}

// world-space box-projected UVs so textures keep consistent scale on merged meshes
export function triplanarUV(geo, scale = 0.5, off = 0) {
  geo.computeVertexNormals();
  const p = geo.attributes.position, n = geo.attributes.normal;
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
    let u, v;
    if (ay >= ax && ay >= az) { u = p.getX(i); v = p.getZ(i); }
    else if (ax >= az) { u = p.getZ(i); v = p.getY(i); }
    else { u = p.getX(i); v = p.getY(i); }
    uv[i * 2] = u * scale + off; uv[i * 2 + 1] = v * scale + off * 0.7;
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return geo;
}

// shared wind uniforms + shader injection (applied after instancing, in object space)
export const wind = { uTime: { value: 0 }, uWind: { value: 0.3 }, uTree: { value: 0.3 } };
export function addWind(mat, mode = 'grass') {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = wind.uTime; sh.uniforms.uWind = wind.uWind; sh.uniforms.uTree = wind.uTree;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
uniform float uTime; uniform float uWind; uniform float uTree;`)
      .replace('#include <project_vertex>', `
vec4 mvPosition = vec4(transformed, 1.0);
#ifdef USE_INSTANCING
mvPosition = instanceMatrix * mvPosition;
#endif
${mode === 'grass' ? `
float hh = max(position.y, 0.0);
vec3 ip = mvPosition.xyz;
float g = sin(uTime*1.7 + ip.x*0.55 + ip.z*0.35) + 0.45*sin(uTime*3.9 + ip.x*1.9 - ip.z*1.3) + 0.25*sin(uTime*7.3 + ip.z*3.1);
float gust = 0.6 + 0.4*sin(uTime*0.6 + ip.x*0.15);
mvPosition.x += uWind * hh*hh * g * gust * 0.55;
mvPosition.z += uWind * hh*hh * (0.5*g + 0.3*sin(uTime*2.3+ip.x)) * 0.3;
` : `
float hh = max(mvPosition.y - 1.2, 0.0);
float g = sin(uTime*0.9 + mvPosition.x*0.25) + 0.35*sin(uTime*2.1 + mvPosition.z*0.6 + mvPosition.y*0.4);
float fl = sin(uTime*5.0 + mvPosition.x*3.0 + mvPosition.y*2.7) * 0.012 * hh;
mvPosition.x += uTree * (hh*hh*0.006*g) + uTree*fl;
mvPosition.z += uTree * (hh*hh*0.003*g) + uTree*fl*0.6;
`}
mvPosition = modelViewMatrix * mvPosition;
gl_Position = projectionMatrix * mvPosition;`);
  };
  return mat;
}
