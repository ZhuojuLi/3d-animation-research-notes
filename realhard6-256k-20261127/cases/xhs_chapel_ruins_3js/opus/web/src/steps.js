import * as THREE from 'three';
import { StoneBatch } from './batch.js';
import { stoneMaterial } from './textures.js';
import { rng } from './util.js';
import { DOOR } from './chapel.js';

// Flight of worn steps climbing from the forecourt toward the portal.
// Each step is made of several irregular slabs; lower steps are wider and spread left.
export function createSteps(scene) {
  const r = rng(21), b = new StoneBatch(0.55);
  const N = 7, rise = DOOR.sill / N, tops = [];
  for (let i = 0; i < N; i++) {
    const yTop = rise * (i + 1);
    const zFront = 5.0 - i * 0.62;
    const depth = 0.62;
    const xl = -4.9 - (N - 1 - i) * 0.75 - r() * 0.5, xr = 2.6;
    tops.push({ y: yTop, zFront, zBack: zFront - depth, xl, xr });
    let x = xl;
    while (x < xr) {
      const w = Math.min(0.7 + r() * 1.2, xr - x);
      if (w < 0.2) break;
      const sunk = (r() - 0.5) * 0.06 - (r() < 0.12 ? 0.07 : 0);
      const tilt = [(r() - 0.5) * 0.05, (r() - 0.5) * 0.04];
      const fz = zFront - (r() * 0.12) + (i === 0 ? 0 : 0);
      // slab extends down to ground (solid flight, no gaps underneath)
      const h = yTop + 0.25;
      b.block(w - 0.04, h, depth + 0.35, x + w / 2, yTop - h / 2 + sunk, fz - (depth + 0.35) / 2, (r() - 0.5) * 0.05, 0.05, tilt, [3, 3, 2]);
      x += w;
    }
  }
  // landing in front of the threshold
  b.block(7.4, DOOR.sill + 0.2, 1.3, -1.1, DOOR.sill / 2 - 0.12, 0.62, 0, 0.03, [0, 0], [6, 2, 2]);
  b.block(DOOR.a * 2 + 0.2, 0.25, 1.8, 0, DOOR.sill - 0.06, -0.6, 0, 0.02, [0, 0], [3, 1, 2]);
  // broken cheek wall on the left of the upper flight
  for (let k = 0; k < 9; k++) b.block(0.7 + r() * 0.4, 0.4, 0.6, -6.6 + k * 0.62 * 0 - r() * 0.3, 0.2 + Math.floor(k / 3) * 0.38 + 1.0, -0.2 + (k % 3) * 0.75, (r() - .5) * .2, 0.06, [(r() - .5) * .06, (r() - .5) * .06]);
  // broken left cheek wall + scattered rubble
  for (let i = 0; i < 26; i++) {
    const t = r(); const z = 5.6 - t * 5;
    const xs = tops[Math.min(N - 1, Math.floor(t * N))].xl - 0.3 - r() * 0.6;
    b.rubble(0.25 + r() * 0.3, xs, 0.25 + t * 1.6 * r(), z, 100 + i);
  }
  const mat = stoneMaterial({ seed: 41, tint: [0.56, 0.52, 0.47], moss: 0.9 }, { bumpScale: 3.2 });
  const mesh = b.build(mat);
  scene.add(mesh);
  return { mesh, tops };
}

// right-front rubble pier (weathered masonry mass occupying the lower right corner)
export function createPier(scene) {
  const r = rng(77), b = new StoneBatch(0.55);
  for (let y = 0; y < 3.4; y += 0.38) for (let z = 4.6; z > 0.9; z -= 0.55 + r() * 0.35) for (let x = 0.35 + (4.6 - z) * 0.03; x < 4.5; x += 0.6 + r() * 0.45) {
    if (y > 2.7 + Math.sin(x * 1.7 + z) * 0.35 - (z > 3.6 ? 0.4 : 0)) continue;
    b.block(0.6 + r() * 0.5, 0.34, 0.55 + r() * 0.4, x + r() * 0.1, y + 0.17, z, (r() - 0.5) * 0.15, 0.06, [(r() - 0.5) * 0.06, (r() - 0.5) * 0.06], [2, 2, 2]);
  }
  for (let i = 0; i < 14; i++) b.rubble(0.12 + r() * 0.2, 0.6 + r() * 3.5, 2.75 + r() * 0.4, 1.2 + r() * 3.2, 300 + i);
  const mat = stoneMaterial({ seed: 51, tint: [0.5, 0.47, 0.42], moss: 1.0 }, { bumpScale: 3.5 });
  const m = b.build(mat); scene.add(m); return m;
}

// low ruined parapet along the left terrace edge
export function createParapet(scene) {
  const r = rng(91), b = new StoneBatch(0.6);
  const path = [[-18, -1.5], [-14, -3.2], [-10, -4.2], [-6.8, -3.6]];
  for (let s = 0; s < path.length - 1; s++) {
    const [x0, z0] = path[s], [x1, z1] = path[s + 1], len = Math.hypot(x1 - x0, z1 - z0), ang = Math.atan2(z1 - z0, x1 - x0);
    for (let t = 0; t < len; t += 0.55 + r() * 0.3) {
      const x = x0 + (x1 - x0) * t / len, z = z0 + (z1 - z0) * t / len;
      const hgt = 0.6 + Math.sin(t * 1.3 + s) * 0.25 + r() * 0.2;
      for (let y = 0; y < hgt; y += 0.3) b.block(0.55, 0.28, 0.5, x, y + 0.12, z, -ang, 0.05, [(r() - .5) * .05, (r() - .5) * .05], [2, 1, 1]);
    }
  }
  const mat = stoneMaterial({ seed: 61, tint: [0.52, 0.48, 0.42], moss: 0.8 }, { bumpScale: 3 });
  const m = b.build(mat); scene.add(m); return m;
}
