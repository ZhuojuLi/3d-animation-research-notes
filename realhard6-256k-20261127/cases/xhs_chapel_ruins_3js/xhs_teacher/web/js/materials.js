import * as THREE from 'three';

/* ------------------------------------------------------------------------
   Small deterministic random + tileable procedural noise toolkit.
   Everything is generated locally so the scene stays fully editable.
------------------------------------------------------------------------- */

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

function hash2(x, y, seed) {
  let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(seed | 0, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

// Value noise that wraps every `period` lattice cells.
function noiseTile(x, y, period, seed) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const tx = x - xi;
  const ty = y - yi;
  const sx = tx * tx * (3 - 2 * tx);
  const sy = ty * ty * (3 - 2 * ty);
  const x0 = ((xi % period) + period) % period;
  const y0 = ((yi % period) + period) % period;
  const x1 = (x0 + 1) % period;
  const y1 = (y0 + 1) % period;
  const a = hash2(x0, y0, seed);
  const b = hash2(x1, y0, seed);
  const c = hash2(x0, y1, seed);
  const d = hash2(x1, y1, seed);
  return lerp(lerp(a, b, sx), lerp(c, d, sx), sy);
}

export function fbmTile(u, v, baseFreq = 4, octaves = 5, seed = 1, gain = 0.5) {
  let amp = 0.5;
  let sum = 0;
  let norm = 0;
  let freq = baseFreq;
  for (let i = 0; i < octaves; i++) {
    sum += amp * noiseTile(u * freq, v * freq, freq, seed + i * 37);
    norm += amp;
    amp *= gain;
    freq *= 2;
  }
  return sum / norm;
}

/* ------------------------------------------------------------------------
   Texture painting helpers
------------------------------------------------------------------------- */

function wrappedPaint(ctx, w, h, x, y, radius, draw) {
  const xs = [x];
  const ys = [y];
  if (x < radius) xs.push(x + w);
  if (x > w - radius) xs.push(x - w);
  if (y < radius) ys.push(y + h);
  if (y > h - radius) ys.push(y - h);
  for (const px of xs) {
    for (const py of ys) {
      ctx.save();
      ctx.translate(px, py);
      draw(ctx);
      ctx.restore();
    }
  }
}

function makeCanvas(w, h) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  return canvas;
}

let MAX_ANISO = 8;
export function setMaxAnisotropy(value) {
  MAX_ANISO = Math.max(1, value);
}

function toTexture(canvas, { srgb = true, repeat = [1, 1] } = {}) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat[0], repeat[1]);
  tex.anisotropy = MAX_ANISO;
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/* ------------------------------------------------------------------------
   Masonry.  A single field of stone creates colour, bump and roughness,
   with irregular ashlar courses, lichen blooms, damp streaks and cracks.
------------------------------------------------------------------------- */

function stoneField(size, opts) {
  const {
    seed = 11,
    rows = 7,
    cols = 5,
    base = [108, 99, 87],
    light = [142, 133, 118],
    dark = [58, 53, 47],
    lichen = 0.62,
    moss = 0.32,
    coursed = true,
    joint = 2.6,
    rugged = 0.5,
    warm = 0.0,
  } = opts;

  const count = size * size;
  const colorData = new Uint8ClampedArray(count * 4);
  const hData = new Uint8ClampedArray(count * 4);
  const rData = new Uint8ClampedArray(count * 4);

  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const i = (y * size + x) * 4;

      const n1 = fbmTile(u, v, 3, 6, seed + 2, 0.52);
      const n2 = fbmTile(u, v, 11, 4, seed + 15, 0.5);
      const grain = noiseTile(u * size * 0.9, v * size * 0.9, size, seed + 41);
      const streak = fbmTile(u * 0.42, v, 9, 4, seed + 27, 0.55);

      // Broad warm / cool patches and fine mineral grain.
      const shade = 0.66 + n1 * 0.58 + (grain - 0.5) * 0.18;
      let r = base[0] * shade + (n2 - 0.5) * 20 + warm * 17;
      let g = base[1] * shade + (n2 - 0.5) * 16 + warm * 8;
      let b = base[2] * shade + (n2 - 0.5) * 12 - warm * 3;

      // Dark water stains follow gravity a little.
      const damp = smoothstep(0.58, 0.82, streak) * smoothstep(0.45, 0.95, v) * 0.28;
      r = lerp(r, dark[0] * 1.15, damp);
      g = lerp(g, dark[1] * 1.15, damp);
      b = lerp(b, dark[2] * 1.1, damp);

      // Sparse pale lichen + green-black moss, both low frequency and speckled.
      const lichenN = fbmTile(u, v, 6, 5, seed + 91, 0.54);
      const lichenFine = noiseTile(u * 120, v * 120, 120, seed + 7);
      const lm = smoothstep(0.58 - lichen * 0.1, 0.76, lichenN) * smoothstep(0.20, 0.7, lichenFine) * lichen;
      if (lm > 0.01) {
        const pale = 0.72 + lichenFine * 0.28;
        r = lerp(r, 156 * pale, lm * 0.62);
        g = lerp(g, 158 * pale, lm * 0.62);
        b = lerp(b, 138 * pale, lm * 0.62);
      }
      const mossN = fbmTile(u + 4.2, v + 2.8, 7, 4, seed + 133, 0.5);
      const mm = smoothstep(0.63, 0.82, mossN) * moss * (0.3 + smoothstep(0.6, 1, v) * 0.7);
      if (mm > 0.01) {
        r = lerp(r, 65, mm * 0.6);
        g = lerp(g, 72, mm * 0.6);
        b = lerp(b, 48, mm * 0.6);
      }

      colorData[i] = r;
      colorData[i + 1] = g;
      colorData[i + 2] = b;
      colorData[i + 3] = 255;

      const hVal = clamp(110 + (n1 - 0.5) * 92 + (grain - 0.5) * 95 + (n2 - 0.5) * 34, 24, 215);
      hData[i] = hData[i + 1] = hData[i + 2] = hVal;
      hData[i + 3] = 255;

      // Lichen is rougher than weathered stone; wet dark seams are a touch smoother.
      const rough = clamp(198 + (n2 - 0.5) * 28 + lm * 42 - damp * 38 + (grain - 0.5) * 18, 120, 255);
      rData[i] = rData[i + 1] = rData[i + 2] = rough;
      rData[i + 3] = 255;
    }
  }

  const colorCanvas = makeCanvas(size, size);
  const heightCanvas = makeCanvas(size, size);
  const roughCanvas = makeCanvas(size, size);
  const cctx = colorCanvas.getContext('2d');
  const hctx = heightCanvas.getContext('2d');
  const rctx = roughCanvas.getContext('2d');
  cctx.putImageData(new ImageData(colorData, size, size), 0, 0);
  hctx.putImageData(new ImageData(hData, size, size), 0, 0);
  rctx.putImageData(new ImageData(rData, size, size), 0, 0);

  const rng = mulberry32(seed * 932 + 7);

  if (coursed) {
    const rowH = size / rows;
    for (let row = 0; row < rows; row++) {
      const y0 = row * rowH;
      const rowTone = (rng() - 0.5) * 0.13;
      let x = -rng() * rowH * 1.4;
      while (x < size) {
        const w = rowH * (0.95 + rng() * 1.25);
        const tone = rowTone + (rng() - 0.5) * 0.11;
        const inset = 1.7;
        const drawTone = (ctx, alphaScale = 1) => {
          if (tone > 0) {
            ctx.fillStyle = `rgba(228,221,202,${Math.abs(tone) * 0.42 * alphaScale})`;
          } else {
            ctx.fillStyle = `rgba(24,22,20,${Math.abs(tone) * 0.5 * alphaScale})`;
          }
          ctx.fillRect(x + inset, y0 + inset, w - inset * 2, rowH - inset * 2);
        };
        drawTone(cctx, 1);
        drawTone(hctx, 1.4);

        // Pillowed edges: a faint light catch on the top of each course.
        cctx.fillStyle = 'rgba(205,193,169,0.07)';
        cctx.fillRect(x + inset, y0 + inset, w - inset * 2, 2.2);
        cctx.fillStyle = 'rgba(18,17,15,0.11)';
        cctx.fillRect(x + inset, y0 + rowH - inset - 3, w - inset * 2, 3);

        // Vertical mortar joint, with a slightly broken silhouette.
        const jx = x + w;
        for (const ctx of [cctx, hctx]) {
          ctx.save();
          ctx.strokeStyle = ctx === cctx ? 'rgba(31,28,25,0.58)' : 'rgba(18,18,18,0.8)';
          ctx.lineWidth = joint * (ctx === hctx ? 1.25 : 1);
          ctx.beginPath();
          const jitter = (rng() - 0.5) * 3;
          ctx.moveTo(jx + jitter, y0 + 2);
          ctx.bezierCurveTo(jx - 2 + jitter, y0 + rowH * 0.36, jx + 2.5 + jitter, y0 + rowH * 0.72, jx + jitter * 0.4, y0 + rowH - 2);
          ctx.stroke();
          ctx.restore();
        }
        x += w;
      }

      // Horizontal course joint.
      for (const ctx of [cctx, hctx]) {
        ctx.save();
        ctx.strokeStyle = ctx === cctx ? 'rgba(34,31,27,0.5)' : 'rgba(16,16,16,0.85)';
        ctx.lineWidth = joint * (ctx === hctx ? 1.2 : 1);
        ctx.beginPath();
        for (let sx = 0; sx <= size; sx += 32) {
          const yy = y0 + Math.sin((sx / size) * Math.PI * 4 + row * 2.1) * 0.8;
          if (sx === 0) ctx.moveTo(sx, yy);
          else ctx.lineTo(sx, yy);
        }
        ctx.stroke();
        ctx.restore();
      }
      cctx.fillStyle = 'rgba(216,204,181,0.055)';
      cctx.fillRect(0, y0 + joint + 1, size, 1.2);
    }
  } else {
    // Rubble / cliff-face stone: loose cobbles and shards instead of courses.
    const wraps = 44;
    for (let i = 0; i < wraps; i++) {
      const cx = rng() * size;
      const cy = rng() * size;
      const radius = 9 + rng() * 42;
      const sx = 0.7 + rng() * 1.8;
      wrappedPaint(cctx, size, size, cx, cy, radius * sx, (ctx) => {
        ctx.rotate(rng() * Math.PI);
        ctx.beginPath();
        const points = 8;
        for (let p = 0; p < points; p++) {
          const a = (p / points) * Math.PI * 2;
          const rr = radius * (0.65 + hash2(i * 13 + p, seed, 5) * 0.55);
          const px = Math.cos(a) * rr * sx;
          const py = Math.sin(a) * rr;
          if (p === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        const tone = rng();
        ctx.fillStyle = tone > 0.5 ? `rgba(190,179,158,${0.06 + tone * 0.09})` : `rgba(22,20,18,${0.05 + tone * 0.1})`;
        ctx.fill();
        ctx.strokeStyle = 'rgba(27,25,22,0.34)';
        ctx.lineWidth = 1 + rng() * 2;
        ctx.stroke();
      });
    }
  }

  // Long erosion cracks.
  for (let c = 0; c < (rugged > 0.6 ? 15 : 9); c++) {
    let x = rng() * size;
    let y = rng() * size;
    const len = 40 + rng() * 200;
    const ang = -0.8 + rng() * 1.6;
    for (const ctx of [cctx, hctx]) {
      ctx.save();
      ctx.strokeStyle = ctx === cctx ? 'rgba(28,25,22,0.55)' : 'rgba(15,15,15,0.7)';
      ctx.lineWidth = ctx === hctx ? 2.2 : 1.0;
      ctx.beginPath();
      ctx.moveTo(x, y);
      let cx = x;
      let cy = y;
      for (let s = 0; s < 16; s++) {
        cx += Math.cos(ang) * len / 16 + (rng() - 0.5) * 8;
        cy += Math.sin(ang) * len / 16 + (rng() - 0.5) * 7;
        ctx.lineTo(cx, cy);
      }
      ctx.stroke();
      ctx.restore();
    }
  }

  // Small pitting, useful in the bump map.
  for (let i = 0; i < 100; i++) {
    const x = rng() * size;
    const y = rng() * size;
    const rr = 1 + rng() * 5;
    wrappedPaint(hctx, size, size, x, y, rr * 2, (ctx) => {
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rr);
      g.addColorStop(0, 'rgba(15,15,15,0.55)');
      g.addColorStop(1, 'rgba(15,15,15,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, rr, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  // A very light mineral bloom catches the low sun.
  for (let i = 0; i < 60; i++) {
    const x = rng() * size;
    const y = rng() * size;
    const rr = 3 + rng() * 18;
    wrappedPaint(cctx, size, size, x, y, rr * 2, (ctx) => {
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rr);
      g.addColorStop(0, `rgba(207,202,178,${0.025 + rng() * 0.055})`);
      g.addColorStop(1, 'rgba(207,202,178,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, rr, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  return {
    color: toTexture(colorCanvas, { srgb: true }),
    bump: toTexture(heightCanvas, { srgb: false }),
    rough: toTexture(roughCanvas, { srgb: false }),
  };
}

const stoneCache = new Map();

export function getStoneSet(kind = 'wall') {
  if (stoneCache.has(kind)) return stoneCache.get(kind);
  let set;
  if (kind === 'wall') {
    set = stoneField(1024, {
      seed: 14, rows: 7, cols: 5, base: [113, 105, 94], light: [151, 143, 127],
      dark: [55, 51, 45], lichen: 0.76, moss: 0.4, joint: 2.8, warm: 0.8, ruggged: 0.4,
    });
  } else if (kind === 'trim') {
    set = stoneField(512, {
      seed: 28, rows: 5, cols: 3, base: [137, 129, 116], light: [177, 168, 150],
      dark: [69, 64, 56], lichen: 0.42, moss: 0.2, joint: 1.7, warm: 1.2, rugged: 0.2,
    });
  } else if (kind === 'steps') {
    set = stoneField(1024, {
      seed: 43, rows: 4, cols: 3, base: [105, 99, 89], light: [153, 145, 128],
      dark: [47, 44, 39], lichen: 0.9, moss: 0.58, joint: 3.6, warm: 0.35, rugged: 0.7,
    });
  } else if (kind === 'ground') {
    set = stoneField(1024, {
      seed: 62, rows: 3, cols: 2, base: [100, 95, 86], light: [154, 145, 126],
      dark: [42, 39, 35], lichen: 0.84, moss: 0.62, joint: 4.2, warm: 0.3, rugged: 0.85,
    });
  } else if (kind === 'rubble') {
    set = stoneField(1024, {
      seed: 77, rows: 5, cols: 4, base: [111, 105, 95], light: [160, 151, 132],
      dark: [52, 48, 42], lichen: 1.0, moss: 0.62, coursed: false, joint: 2,
      warm: 0.6, rugged: 1.0,
    });
  } else {
    // Interior plaster / stone.
    set = stoneField(512, {
      seed: 96, rows: 6, cols: 4, base: [79, 71, 60], light: [111, 100, 84],
      dark: [34, 30, 26], lichen: 0.18, moss: 0.15, joint: 2.0, warm: 0.6, rugged: 0.4,
    });
  }
  stoneCache.set(kind, set);
  return set;
}

export function stoneMaterial(kind = 'wall', opts = {}) {
  const set = getStoneSet(kind);
  const mat = new THREE.MeshStandardMaterial({
    map: set.color,
    bumpMap: set.bump,
    bumpScale: opts.bumpScale ?? 0.055,
    roughnessMap: set.rough,
    roughness: opts.roughness ?? 0.94,
    metalness: 0,
    color: opts.color ?? 0xffffff,
    side: opts.side ?? THREE.FrontSide,
  });
  if (opts.color) mat.color.copy(new THREE.Color(opts.color));
  return mat;
}

/* ------------------------------------------------------------------------
   Box UVs in world scale so a shared masonry texture never looks pasted on.
------------------------------------------------------------------------- */

export function remapBoxUV(geometry, width, height, depth, textureScale = 2.4) {
  const uv = geometry.attributes.uv;
  const dims = [
    [depth, height], [depth, height],
    [width, depth], [width, depth],
    [width, height], [width, height],
  ];
  // BoxGeometry face order is +x,-x,+y,-y,+z,-z, each with 4 vertices.
  for (let face = 0; face < 6; face++) {
    const su = dims[face][0] / textureScale;
    const sv = dims[face][1] / textureScale;
    for (let i = 0; i < 4; i++) {
      const idx = face * 4 + i;
      uv.setXY(idx, uv.getX(idx) * su, uv.getY(idx) * sv);
    }
  }
  uv.needsUpdate = true;
  return geometry;
}

export function stoneBox(width, height, depth, kind = 'wall', opts = {}) {
  const geo = new THREE.BoxGeometry(width, height, depth, 1, 1, 1);
  remapBoxUV(geo, width, height, depth, opts.textureScale ?? 2.4);
  const mat = stoneMaterial(kind, opts);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/* ------------------------------------------------------------------------
   Wood, plaster, foliage and flame sprites
------------------------------------------------------------------------- */

export function createWoodTexture() {
  const size = 512;
  const canvas = makeCanvas(size, size);
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const u = x / size;
      const v = y / size;
      const warp = fbmTile(u, v, 4, 4, 71, 0.55);
      const grain = Math.sin((v * 40 + warp * 8) * Math.PI) * 0.5 + 0.5;
      const fine = noiseTile(u * 250, v * 18, 250, 7);
      const t = 0.58 + grain * 0.22 + fine * 0.12;
      img.data[i] = 59 * t + 15;
      img.data[i + 1] = 44 * t + 12;
      img.data[i + 2] = 31 * t + 8;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  // Dark seams between planks.
  ctx.strokeStyle = 'rgba(12,9,7,0.55)';
  ctx.lineWidth = 3;
  for (let p = 0; p <= 4; p++) {
    ctx.beginPath();
    ctx.moveTo((p / 4) * size, 0);
    ctx.lineTo((p / 4) * size, size);
    ctx.stroke();
  }
  return toTexture(canvas);
}

export function woodMaterial() {
  const map = createWoodTexture();
  return new THREE.MeshStandardMaterial({ map, color: 0x8d7055, roughness: 0.76, metalness: 0.02 });
}

export function createPlasterTexture() {
  const size = 512;
  const canvas = makeCanvas(size, size);
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const u = x / size;
      const v = y / size;
      const n = fbmTile(u, v, 4, 5, 200, 0.58);
      const stain = fbmTile(u, v, 9, 4, 214, 0.5);
      const t = 0.6 + n * 0.5;
      let r = 82 * t, g = 70 * t, b = 57 * t;
      if (stain > 0.62) {
        const s = (stain - 0.62) * 1.8;
        r = lerp(r, 44, s);
        g = lerp(g, 38, s);
        b = lerp(b, 32, s);
      }
      img.data[i] = r; img.data[i + 1] = g; img.data[i + 2] = b; img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  // Cracks in old lime render.
  const rng = mulberry32(818);
  for (let c = 0; c < 12; c++) {
    let x = rng() * size, y = rng() * size;
    ctx.strokeStyle = 'rgba(35,29,24,0.5)';
    ctx.lineWidth = 0.8 + rng() * 1.2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let s = 0; s < 12; s++) {
      x += (rng() - 0.5) * 30;
      y += rng() * 18;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  return toTexture(canvas);
}

export function createLeafTexture() {
  const size = 256;
  const canvas = makeCanvas(size, size);
  const ctx = canvas.getContext('2d');
  const rng = mulberry32(3107);
  ctx.clearRect(0, 0, size, size);
  // A twig and many small, elongated leaves form one foliage card.
  ctx.strokeStyle = 'rgba(43,39,27,0.9)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(size * 0.12, size * 0.82);
  ctx.quadraticCurveTo(size * 0.4, size * 0.55, size * 0.88, size * 0.2);
  ctx.stroke();
  for (let i = 0; i < 95; i++) {
    const t = rng();
    const bx = lerp(size * 0.12, size * 0.88, t) + (rng() - 0.5) * 90;
    const by = lerp(size * 0.82, size * 0.2, t) + (rng() - 0.5) * 100;
    const rx = 6 + rng() * 9;
    const ry = 2.2 + rng() * 3.4;
    const a = rng() * Math.PI * 2;
    const shade = 45 + rng() * 40;
    ctx.save();
    ctx.translate(bx, by);
    ctx.rotate(a);
    const grd = ctx.createLinearGradient(-rx, 0, rx, 0);
    grd.addColorStop(0, `rgba(${25 + shade * 0.2},${30 + shade * 0.28},${18 + shade * 0.18},0.96)`);
    grd.addColorStop(0.65, `rgba(${32 + shade * 0.3},${38 + shade * 0.33},${22 + shade * 0.2},1)`);
    grd.addColorStop(1, `rgba(${52 + shade * 0.4},${50 + shade * 0.35},${28 + shade * 0.25},0.9)`);
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = MAX_ANISO;
  return tex;
}

export function createFlameTexture() {
  const size = 128;
  const canvas = makeCanvas(size, size);
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size * 0.63, 1, size / 2, size * 0.55, size * 0.42);
  g.addColorStop(0, 'rgba(255,255,235,1)');
  g.addColorStop(0.12, 'rgba(255,239,178,1)');
  g.addColorStop(0.28, 'rgba(255,172,71,0.92)');
  g.addColorStop(0.55, 'rgba(244,93,24,0.3)');
  g.addColorStop(1, 'rgba(190,50,8,0)');
  ctx.fillStyle = g;
  // A tapered flame rather than a circle.
  ctx.beginPath();
  ctx.moveTo(size / 2, size * 0.08);
  ctx.bezierCurveTo(size * 0.78, size * 0.35, size * 0.78, size * 0.72, size / 2, size * 0.94);
  ctx.bezierCurveTo(size * 0.24, size * 0.78, size * 0.24, size * 0.46, size / 2, size * 0.08);
  ctx.fill();
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createGlowTexture() {
  const size = 128;
  const canvas = makeCanvas(size, size);
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,250,230,1)');
  g.addColorStop(0.15, 'rgba(255,217,161,0.9)');
  g.addColorStop(0.4, 'rgba(255,156,82,0.35)');
  g.addColorStop(1, 'rgba(255,120,50,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createLichenDecalTexture() {
  const size = 256;
  const canvas = makeCanvas(size, size);
  const ctx = canvas.getContext('2d');
  const rng = mulberry32(401);
  ctx.clearRect(0, 0, size, size);
  for (let i = 0; i < 900; i++) {
    const r = 0.7 + rng() * 5.5;
    const x = rng() * size;
    const y = rng() * size;
    const a = Math.pow(rng(), 1.6) * 0.75;
    const palette = [
      [177, 180, 152], [153, 160, 134], [204, 201, 169], [114, 126, 92],
    ];
    const p = palette[(Math.random() * palette.length) | 0];
    ctx.fillStyle = `rgba(${p[0]},${p[1]},${p[2]},${a})`;
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * (0.5 + rng() * 0.8), rng() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
  // Feathery fringe.
  for (let i = 0; i < 100; i++) {
    ctx.strokeStyle = `rgba(200,199,166,${0.06 + rng() * 0.2})`;
    ctx.lineWidth = 0.6 + rng();
    ctx.beginPath();
    const x = rng() * size, y = rng() * size;
    ctx.moveTo(x, y);
    ctx.lineTo(x + (rng() - 0.5) * 14, y + (rng() - 0.5) * 14);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = MAX_ANISO;
  return tex;
}
