import * as THREE from 'three';
import { fbm, noise3, rng } from './util.js';

// Procedural weathered stone: returns { map (sRGB), bump, rough }
export function stoneTextures({ size = 512, blocks = false, seed = 1, tint = [0.50, 0.46, 0.40], moss = 0.5 } = {}) {
  const r = rng(seed);
  const cc = document.createElement('canvas'), hc = document.createElement('canvas');
  cc.width = cc.height = hc.width = hc.height = size;
  const cx = cc.getContext('2d'), hx = hc.getContext('2d');
  const ci = cx.createImageData(size, size), hi = hx.createImageData(size, size);
  // ashlar layout: rows with random block widths
  const rows = 5, rowH = 1 / rows, rowsData = [];
  for (let j = 0; j < rows; j++) {
    const cuts = [0]; let x = r() * 0.3;
    while (x < 1) { cuts.push(x); x += 0.22 + r() * 0.3; }
    cuts.push(1); rowsData.push({ cuts, tones: cuts.map(() => r()) });
  }
  const P = 4;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = x / size, v = y / size;
    const n1 = fbm(u * P * 2, v * P * 2, seed, 6, P * 2);
    const n2 = fbm(u * P * 6 + 3, v * P * 6, seed + 3, 4, P * 6);
    const lich = noise3(u * P * 3, v * P * 3, seed + 9, P * 3);
    const mossN = fbm(u * P * 1.5, v * P * 1.5, seed + 17, 4, P * 1.5);
    let h = 0.55 + (n1 - 0.5) * 0.7 + (n2 - 0.5) * 0.35;
    let tone = 0, mortar = 0;
    if (blocks) {
      const j = Math.floor(v / rowH), row = rowsData[j];
      const lv = (v - j * rowH) / rowH;
      let k = 0; while (k < row.cuts.length - 1 && u > row.cuts[k + 1]) k++;
      const du = Math.min(u - row.cuts[k], row.cuts[k + 1] - u) * size;
      const dv = Math.min(lv, 1 - lv) * rowH * size;
      const edge = Math.min(du, dv) + (n2 - 0.5) * 9;
      mortar = 1 - Math.min(Math.max(edge / 6, 0), 1);
      tone = (row.tones[k] - 0.5) * 0.18;
      h = h * (1 - mortar * 0.8) - mortar * 0.25 + Math.min(edge / 30, 1) * 0.15;
    }
    let R = tint[0] + tone + (n1 - 0.5) * 0.28, G = tint[1] + tone + (n1 - 0.5) * 0.26, B = tint[2] + tone + (n1 - 0.5) * 0.22;
    const pit = Math.max(0, 0.45 - n2) * 1.2; R -= pit * 0.35; G -= pit * 0.33; B -= pit * 0.3;
    if (lich > 0.72) { const t = (lich - 0.72) * 3; R += t * 0.25; G += t * 0.25; B += t * 0.22; }       // pale lichen
    if (n2 > 0.74 && lich < 0.4) { const t = (n2 - 0.74) * 4; R += t * 0.35; G += t * 0.12; B -= t * 0.05; } // orange lichen
    const m = Math.max(0, mossN - (0.62 - moss * 0.12)) * 3 * moss;
    R = R * (1 - m) + 0.24 * m; G = G * (1 - m) + 0.27 * m; B = B * (1 - m) + 0.14 * m;              // moss stains
    const dk = mortar * 0.55; R *= 1 - dk; G *= 1 - dk; B *= 1 - dk * 0.9;
    const i = (y * size + x) * 4;
    ci.data[i] = Math.max(0, Math.min(255, R * 255)); ci.data[i + 1] = Math.max(0, Math.min(255, G * 255));
    ci.data[i + 2] = Math.max(0, Math.min(255, B * 255)); ci.data[i + 3] = 255;
    const hv = Math.max(0, Math.min(255, h * 255));
    hi.data[i] = hi.data[i + 1] = hi.data[i + 2] = hv; hi.data[i + 3] = 255;
  }
  cx.putImageData(ci, 0, 0); hx.putImageData(hi, 0, 0);
  const map = new THREE.CanvasTexture(cc); map.colorSpace = THREE.SRGBColorSpace;
  const bump = new THREE.CanvasTexture(hc);
  for (const t of [map, bump]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; }
  return { map, bump };
}

export function stoneMaterial(opts = {}, extra = {}) {
  const { map, bump } = stoneTextures(opts);
  return new THREE.MeshStandardMaterial({ map, bumpMap: bump, bumpScale: extra.bumpScale ?? 2.2, roughness: 0.95, metalness: 0, color: extra.color ?? 0xffffff, ...extra.mat });
}

export function glowTexture(inner = 'rgba(255,240,200,1)', mid = 'rgba(255,160,60,0.5)') {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d'), g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, inner); g.addColorStop(0.25, mid); g.addColorStop(1, 'rgba(255,120,30,0)');
  x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// alpha leaf-cluster card for tree foliage
export function leafTexture(seed = 3) {
  const r = rng(seed), c = document.createElement('canvas'); c.width = c.height = 256;
  const x = c.getContext('2d');
  for (let i = 0; i < 260; i++) {
    const a = r() * Math.PI * 2, d = Math.pow(r(), 0.6) * 100;
    const px = 128 + Math.cos(a) * d, py = 128 + Math.sin(a) * d * 0.8;
    const l = 30 + r() * 30;
    x.fillStyle = `rgb(${l + 30},${l + 40},${l * 0.6})`;
    x.save(); x.translate(px, py); x.rotate(r() * Math.PI);
    x.beginPath(); x.ellipse(0, 0, 9 + r() * 6, 2.5 + r() * 1.5, 0, 0, Math.PI * 2); x.fill(); x.restore();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
