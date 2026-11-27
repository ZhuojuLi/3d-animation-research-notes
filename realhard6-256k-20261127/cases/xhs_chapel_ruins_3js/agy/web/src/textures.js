import * as THREE from 'three';

function createRng(seed = 1337) {
  let s = seed >>> 0;
  return function () {
    s += 0x6d2b79f5;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

class TileNoise2D {
  constructor(seed = 42, period = 64) {
    this.period = period;
    const rng = createRng(seed);
    this.grid = new Float32Array(period * period);
    for (let i = 0; i < this.grid.length; i++) {
      this.grid[i] = rng();
    }
  }

  sample(x, y, freq = 1) {
    const p = Math.max(2, (this.period * freq) | 0);
    const fx = ((x * p) % p + p) % p;
    const fy = ((y * p) % p + p) % p;
    const x0 = fx | 0;
    const y0 = fy | 0;
    const x1 = (x0 + 1) % p;
    const y1 = (y0 + 1) % p;
    const tx = fx - x0;
    const ty = fy - y0;
    const u = tx * tx * (3 - 2 * tx);
    const v = ty * ty * (3 - 2 * ty);

    const g = this.grid;
    const m = this.period;
    const a = g[((y0 % m) * m) + (x0 % m)];
    const b = g[((y0 % m) * m) + (x1 % m)];
    const c = g[((y1 % m) * m) + (x0 % m)];
    const d = g[((y1 % m) * m) + (x1 % m)];

    return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
  }

  fbm(x, y, octaves = 4, baseFreq = 1) {
    let sum = 0;
    let amp = 0.5;
    let norm = 0;
    let freq = baseFreq;
    for (let i = 0; i < octaves; i++) {
      sum += amp * this.sample(x, y, freq);
      norm += amp;
      amp *= 0.5;
      freq *= 2;
    }
    return sum / norm;
  }
}

/**
 * Generates clean, rock-solid tangent-space normal maps (box-smoothed first
 * to eliminate 1px sandpaper sparkle while preserving crisp cracks & block joints!).
 */
function heightToNormalCanvas(heightArr, w, h, strength = 2.0) {
  const blurred = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    const ym = (y - 1 + h) % h;
    const yp = (y + 1) % h;
    for (let x = 0; x < w; x++) {
      const xm = (x - 1 + w) % w;
      const xp = (x + 1) % w;
      blurred[y * w + x] = (
        heightArr[y * w + x] * 4 +
        heightArr[ym * w + x] + heightArr[yp * w + x] +
        heightArr[y * w + xm] + heightArr[y * w + xp]
      ) / 8.0;
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(w, h);
  const data = img.data;

  for (let y = 0; y < h; y++) {
    const ym = (y - 1 + h) % h;
    const yp = (y + 1) % h;
    for (let x = 0; x < w; x++) {
      const xm = (x - 1 + w) % w;
      const xp = (x + 1) % w;

      const tl = blurred[ym * w + xm];
      const t  = blurred[ym * w + x];
      const tr = blurred[ym * w + xp];
      const l  = blurred[y  * w + xm];
      const r  = blurred[y  * w + xp];
      const bl = blurred[yp * w + xm];
      const b  = blurred[yp * w + x];
      const br = blurred[yp * w + xp];

      const dx = ((tr + 2 * r + br) - (tl + 2 * l + bl)) * strength;
      const dy = ((bl + 2 * b + br) - (tl + 2 * t + tr)) * strength;
      const dz = 1.0;
      const inv = 1.0 / Math.hypot(dx, dy, dz);

      const idx = (y * w + x) * 4;
      data[idx]     = Math.round((-dx * inv * 0.5 + 0.5) * 255);
      data[idx + 1] = Math.round((-dy * inv * 0.5 + 0.5) * 255);
      data[idx + 2] = Math.round(( dz * inv * 0.5 + 0.5) * 255);
      data[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.needsUpdate = true;
  return tex;
}

function makeCanvasTex(canvas, isSRGB = true) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = isSRGB ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

/**
 * 1. Historic Coursed Weathered Grey-Brown Limestone Wall (Chapel Facade & Buttresses)
 */
export function createAshlarWallTextures(seed = 101) {
  const w = 512, h = 512;
  const n1 = new TileNoise2D(seed, 32);
  const n2 = new TileNoise2D(seed + 17, 64);
  const n3 = new TileNoise2D(seed + 61, 128);
  const rng = createRng(seed + 99);

  const cDiff = document.createElement('canvas');
  cDiff.width = w; cDiff.height = h;
  const ctxD = cDiff.getContext('2d');
  const imgD = ctxD.createImageData(w, h);

  const cRough = document.createElement('canvas');
  cRough.width = w; cRough.height = h;
  const ctxR = cRough.getContext('2d');
  const imgR = ctxR.createImageData(w, h);

  const heights = new Float32Array(w * h);

  const numRows = 6;
  const rowBounds = [0];
  for (let r = 1; r < numRows; r++) {
    rowBounds.push(r / numRows + (rng() - 0.5) * 0.018);
  }
  rowBounds.push(1.0);

  const rowCols = [];
  for (let r = 0; r < numRows; r++) {
    const cols = 3 + ((rng() * 2) | 0);
    const offset = (r % 2) * (0.5 / cols) + (rng() - 0.5) * 0.08;
    const warm = (rng() - 0.5) * 0.06;
    rowCols.push({ cols, offset, warm });
  }

  for (let py = 0; py < h; py++) {
    const v = py / h;
    let rIdx = 0;
    for (let r = 0; r < numRows; r++) {
      if (v >= rowBounds[r] && v <= rowBounds[r + 1]) {
        rIdx = r;
        break;
      }
    }
    const rTop = rowBounds[rIdx];
    const rBot = rowBounds[rIdx + 1];
    const rowH = rBot - rTop;
    const rc = rowCols[rIdx];

    for (let px = 0; px < w; px++) {
      const u = px / w;
      const warpX = (n1.fbm(u, v, 3, 1) - 0.5) * 0.012;
      const warpY = (n2.fbm(u, v, 3, 1) - 0.5) * 0.008;

      const localV = (v + warpY - rTop) / rowH;
      const colPos = ((u + warpX + rc.offset) * rc.cols);
      const colIdx = Math.floor(colPos);
      const localU = colPos - colIdx;

      const cellHash = Math.sin((rIdx * 31 + ((colIdx % rc.cols + rc.cols) % rc.cols) * 17) * 12.9898) * 43758.5453;
      const blockVar = cellHash - Math.floor(cellHash);

      const edgeV = Math.min(localV, 1.0 - localV) * rowH * numRows;
      const edgeU = Math.min(localU, 1.0 - localU) * (5.0 / rc.cols);
      const edgeDist = Math.min(edgeV, edgeU);
      const mortarMask = THREE.MathUtils.smoothstep(edgeDist, 0.006, 0.028);

      const macroMottle = n1.fbm(u, v, 4, 1);
      const grain = n2.fbm(u * 2, v * 2, 4, 2);
      const streak = n1.fbm(u * 2.5, v * 0.4, 3, 1);

      // Authentic medium weathered grey-taupe limestone (0.45-0.58 sRGB!)
      const baseTone = (0.48 + (blockVar - 0.5) * 0.07 + (macroMottle - 0.5) * 0.16) * (0.86 + 0.28 * grain);
      let r = baseTone * (1.03 + rc.warm);
      let g = baseTone * 1.00;
      let b = baseTone * (0.96 - rc.warm * 0.4);

      // Aged brownish-grey weathering streaks
      const streakDark = THREE.MathUtils.smoothstep(streak, 0.52, 0.76) * 0.24;
      r *= (1.0 - streakDark * 0.92);
      g *= (1.0 - streakDark * 1.00);
      b *= (1.0 - streakDark * 1.08);

      // Bold pale grey-white crustose lichen colonies (broad rosettes!)
      const lichCluster = n1.fbm(u * 1.5 + 0.35, v * 1.5 + 0.2, 3, 1);
      const lichRosette = n3.fbm(u * 3.2, v * 3.2, 3, 2);
      const lich = THREE.MathUtils.smoothstep(lichCluster * 0.65 + lichRosette * 0.35, 0.56, 0.65);
      r = THREE.MathUtils.lerp(r, 0.76, lich * 0.78);
      g = THREE.MathUtils.lerp(g, 0.75, lich * 0.78);
      b = THREE.MathUtils.lerp(b, 0.71, lich * 0.78);

      // Muted olive-moss tint in occasional damp patches
      const moss = THREE.MathUtils.smoothstep(n2.fbm(u * 1.3 + 0.6, v * 1.3, 3, 1), 0.63, 0.77);
      r = THREE.MathUtils.lerp(r, 0.36, moss * 0.45);
      g = THREE.MathUtils.lerp(g, 0.38, moss * 0.45);
      b = THREE.MathUtils.lerp(b, 0.26, moss * 0.45);

      // Subtle weathered mortar seam
      r = THREE.MathUtils.lerp(baseTone * 0.66, r, mortarMask);
      g = THREE.MathUtils.lerp(baseTone * 0.65, g, mortarMask);
      b = THREE.MathUtils.lerp(baseTone * 0.62, b, mortarMask);

      const idx = (py * w + px) * 4;
      imgD.data[idx]     = Math.min(255, Math.max(0, Math.round(r * 255)));
      imgD.data[idx + 1] = Math.min(255, Math.max(0, Math.round(g * 255)));
      imgD.data[idx + 2] = Math.min(255, Math.max(0, Math.round(b * 255)));
      imgD.data[idx + 3] = 255;

      const rough = THREE.MathUtils.clamp(0.82 + (1 - mortarMask) * 0.12 + lich * 0.08 - grain * 0.10, 0.68, 0.98);
      const rByte = Math.round(rough * 255);
      imgR.data[idx] = imgR.data[idx + 1] = imgR.data[idx + 2] = rByte;
      imgR.data[idx + 3] = 255;

      heights[py * w + px] = (0.35 + 0.65 * mortarMask) * (0.60 + (blockVar - 0.5) * 0.10 + grain * 0.25 + lich * 0.08);
    }
  }

  ctxD.putImageData(imgD, 0, 0);
  ctxR.putImageData(imgR, 0, 0);

  return {
    map: makeCanvasTex(cDiff, true),
    roughnessMap: makeCanvasTex(cRough, false),
    normalMap: heightToNormalCanvas(heights, w, h, 1.8)
  };
}

/**
 * 2. Rough Mottled Lichen & Moss Ruin Stone (Steps, Cheek Walls, Parapet, Plinths)
 * Distinct macro blotches of pale chalk-white lichen, grey-taupe weathered limestone,
 * dark charcoal/moss pockets, and warm ochre erosion — zero sandpaper grain!
 */
export function createRoughLichenStoneTextures(seed = 202, lichenAmount = 0.78) {
  const w = 512, h = 512;
  const n1 = new TileNoise2D(seed, 32);
  const n2 = new TileNoise2D(seed + 31, 64);
  const n3 = new TileNoise2D(seed + 73, 128);

  const cDiff = document.createElement('canvas');
  cDiff.width = w; cDiff.height = h;
  const ctxD = cDiff.getContext('2d');
  const imgD = ctxD.createImageData(w, h);

  const cRough = document.createElement('canvas');
  cRough.width = w; cRough.height = h;
  const ctxR = cRough.getContext('2d');
  const imgR = ctxR.createImageData(w, h);

  const heights = new Float32Array(w * h);

  for (let py = 0; py < h; py++) {
    const v = py / h;
    for (let px = 0; px < w; px++) {
      const u = px / w;

      const macro = n1.fbm(u, v, 4, 1);
      const meso  = n2.fbm(u * 1.6, v * 1.6, 4, 1);
      const fine  = n3.fbm(u * 3.5, v * 3.5, 3, 2);
      const crag  = Math.abs(n1.fbm(u * 1.5 + 0.15, v * 1.5 + 0.4, 3, 1) - 0.5) * 2.0;
      const crevice = THREE.MathUtils.smoothstep(crag, 0.02, 0.20);

      // Medium weathered grey-brown mountain stone (calm, natural contrast when lichenAmount is low!)
      const contrastScale = 0.45 + 0.55 * lichenAmount;
      const base = (0.38 + macro * 0.16) * (0.82 + meso * 0.30) * (0.62 + 0.38 * crevice);
      let r = base * 1.04;
      let g = base * 1.00;
      let b = base * 0.94;

      // Warm brown-ochre mineral weathering patches
      const ochre = THREE.MathUtils.smoothstep(n2.fbm(u * 1.2 + 0.4, v * 1.2, 3, 1), 0.54, 0.72);
      r = THREE.MathUtils.lerp(r, 0.48, ochre * 0.34);
      g = THREE.MathUtils.lerp(g, 0.38, ochre * 0.34);
      b = THREE.MathUtils.lerp(b, 0.28, ochre * 0.34);

      // Deep dark charcoal & olive-moss pockets (stronger on rough cheek walls, subtler on step treads!)
      const darkPocket = THREE.MathUtils.smoothstep(n1.fbm(u * 1.8 + 0.7, v * 1.8 + 0.2, 3, 1), 0.56, 0.72);
      r = THREE.MathUtils.lerp(r, 0.20, darkPocket * 0.65 * contrastScale);
      g = THREE.MathUtils.lerp(g, 0.21, darkPocket * 0.65 * contrastScale);
      b = THREE.MathUtils.lerp(b, 0.17, darkPocket * 0.65 * contrastScale);

      // Crustose pale grey-white lichen colonies (clustered organically!)
      const lichCluster = n1.fbm(u * 1.3 + 0.2, v * 1.3 + 0.5, 3, 1);
      const lichMeso    = n2.fbm(u * 3.8, v * 3.8, 3, 2);
      const lichVal = lichCluster * 0.72 + lichMeso * 0.28;
      const thresh = 0.69 - lichenAmount * 0.17;
      const lich = THREE.MathUtils.smoothstep(lichVal, thresh, thresh + 0.065) * crevice;

      r = THREE.MathUtils.lerp(r, 0.76, lich * (0.45 + 0.42 * lichenAmount));
      g = THREE.MathUtils.lerp(g, 0.75, lich * (0.45 + 0.42 * lichenAmount));
      b = THREE.MathUtils.lerp(b, 0.71, lich * (0.45 + 0.42 * lichenAmount));

      const idx = (py * w + px) * 4;
      imgD.data[idx]     = Math.min(255, Math.max(0, Math.round(r * 255)));
      imgD.data[idx + 1] = Math.min(255, Math.max(0, Math.round(g * 255)));
      imgD.data[idx + 2] = Math.min(255, Math.max(0, Math.round(b * 255)));
      imgD.data[idx + 3] = 255;

      const rough = THREE.MathUtils.clamp(0.76 + (1 - meso) * 0.18 + lich * 0.10 - macro * 0.08, 0.64, 0.98);
      const rb = Math.round(rough * 255);
      imgR.data[idx] = imgR.data[idx + 1] = imgR.data[idx + 2] = rb;
      imgR.data[idx + 3] = 255;

      heights[py * w + px] = crevice * (0.45 + macro * 0.28 + meso * 0.20 + fine * 0.08 + lich * 0.08);
    }
  }

  ctxD.putImageData(imgD, 0, 0);
  ctxR.putImageData(imgR, 0, 0);

  return {
    map: makeCanvasTex(cDiff, true),
    roughnessMap: makeCanvasTex(cRough, false),
    normalMap: heightToNormalCanvas(heights, w, h, 2.0)
  };
}

/**
 * 3. Carved Warm Buff-Grey Portal Limestone (Archivolts, Colonnettes, Capitals)
 */
export function createCarvedLimestoneTextures(seed = 303) {
  const w = 512, h = 512;
  const n1 = new TileNoise2D(seed, 32);
  const n2 = new TileNoise2D(seed + 41, 64);

  const cDiff = document.createElement('canvas');
  cDiff.width = w; cDiff.height = h;
  const ctxD = cDiff.getContext('2d');
  const imgD = ctxD.createImageData(w, h);

  const cRough = document.createElement('canvas');
  cRough.width = w; cRough.height = h;
  const ctxR = cRough.getContext('2d');
  const imgR = ctxR.createImageData(w, h);

  const heights = new Float32Array(w * h);

  for (let py = 0; py < h; py++) {
    const v = py / h;
    for (let px = 0; px < w; px++) {
      const u = px / w;
      const baseN = n1.fbm(u, v, 4, 1);
      const fine  = n2.fbm(u * 2.5, v * 2.5, 4, 2);
      const stain = n1.fbm(u * 2.0, v * 0.7, 4, 1);

      const val = 0.48 + baseN * 0.16 + fine * 0.08;
      let r = val * 1.07;
      let g = val * 1.00;
      let b = val * 0.89;

      const darkCrust = THREE.MathUtils.smoothstep(stain, 0.52, 0.74);
      r *= 1.0 - darkCrust * 0.36;
      g *= 1.0 - darkCrust * 0.37;
      b *= 1.0 - darkCrust * 0.35;

      const palePatch = THREE.MathUtils.smoothstep(fine + baseN * 0.35, 0.74, 0.88);
      r = THREE.MathUtils.lerp(r, 0.74, palePatch * 0.52);
      g = THREE.MathUtils.lerp(g, 0.71, palePatch * 0.52);
      b = THREE.MathUtils.lerp(b, 0.65, palePatch * 0.52);

      const idx = (py * w + px) * 4;
      imgD.data[idx]     = Math.min(255, Math.round(r * 255));
      imgD.data[idx + 1] = Math.min(255, Math.round(g * 255));
      imgD.data[idx + 2] = Math.min(255, Math.round(b * 255));
      imgD.data[idx + 3] = 255;

      const rough = THREE.MathUtils.clamp(0.76 + darkCrust * 0.16 - fine * 0.08, 0.62, 0.96);
      const rb = Math.round(rough * 255);
      imgR.data[idx] = imgR.data[idx + 1] = imgR.data[idx + 2] = rb;
      imgR.data[idx + 3] = 255;

      heights[py * w + px] = 0.5 + baseN * 0.25 + fine * 0.18 - darkCrust * 0.12;
    }
  }

  ctxD.putImageData(imgD, 0, 0);
  ctxR.putImageData(imgR, 0, 0);

  return {
    map: makeCanvasTex(cDiff, true),
    roughnessMap: makeCanvasTex(cRough, false),
    normalMap: heightToNormalCanvas(heights, w, h, 1.6)
  };
}

/**
 * 4. Large Irregular Cracked Flagstone Courtyard Slabs
 */
export function createFlagstoneTextures(seed = 404) {
  const w = 512, h = 512;
  const rng = createRng(seed);
  const n1 = new TileNoise2D(seed + 11, 32);
  const n2 = new TileNoise2D(seed + 53, 64);

  const gridN = 4;
  const pts = [];
  for (let gy = 0; gy < gridN; gy++) {
    for (let gx = 0; gx < gridN; gx++) {
      pts.push({
        x: (gx + 0.16 + rng() * 0.68) / gridN,
        y: (gy + 0.16 + rng() * 0.68) / gridN,
        tone: 0.86 + rng() * 0.28
      });
    }
  }

  const cDiff = document.createElement('canvas');
  cDiff.width = w; cDiff.height = h;
  const ctxD = cDiff.getContext('2d');
  const imgD = ctxD.createImageData(w, h);

  const cRough = document.createElement('canvas');
  cRough.width = w; cRough.height = h;
  const ctxR = cRough.getContext('2d');
  const imgR = ctxR.createImageData(w, h);

  const heights = new Float32Array(w * h);

  for (let py = 0; py < h; py++) {
    const v = py / h;
    for (let px = 0; px < w; px++) {
      const u = px / w;
      const wx = u + (n1.fbm(u, v, 3, 1) - 0.5) * 0.048;
      const wy = v + (n2.fbm(u, v, 3, 1) - 0.5) * 0.048;

      let d1 = 999, d2 = 999, cellTone = 1.0;
      for (let i = 0; i < pts.length; i++) {
        let dx = Math.abs(wx - pts[i].x);
        let dy = Math.abs(wy - pts[i].y);
        if (dx > 0.5) dx = 1.0 - dx;
        if (dy > 0.5) dy = 1.0 - dy;
        const d = Math.hypot(dx, dy);
        if (d < d1) {
          d2 = d1;
          d1 = d;
          cellTone = pts[i].tone;
        } else if (d < d2) {
          d2 = d;
        }
      }

      const crack = d2 - d1;
      const slabMask = THREE.MathUtils.smoothstep(crack, 0.003, 0.011);
      const micro = n2.fbm(u * 3.5, v * 3.5, 4, 2);
      const fineGrain = n2.fbm(u * 9.0, v * 9.0, 3, 2);
      const macro = n1.fbm(u * 1.6, v * 1.6, 4, 1);

      const fracLine = Math.abs(n1.fbm(u * 2.4 + 0.3, v * 2.4, 3, 1) - 0.5);
      const hairline = THREE.MathUtils.smoothstep(fracLine, 0.002, 0.010);

      const combinedMask = slabMask * (0.76 + 0.24 * hairline);
      const val = (0.34 + macro * 0.14 + micro * 0.09 + (fineGrain - 0.5) * 0.08) * cellTone;
      let r = THREE.MathUtils.lerp(0.15, val * 1.05, combinedMask);
      let g = THREE.MathUtils.lerp(0.14, val * 1.00, combinedMask);
      let b = THREE.MathUtils.lerp(0.13, val * 0.94, combinedMask);

      const lich = THREE.MathUtils.smoothstep(micro + macro * 0.4, 0.84, 0.94) * slabMask;
      r = THREE.MathUtils.lerp(r, 0.68, lich * 0.55);
      g = THREE.MathUtils.lerp(g, 0.67, lich * 0.55);
      b = THREE.MathUtils.lerp(b, 0.63, lich * 0.55);

      const idx = (py * w + px) * 4;
      imgD.data[idx]     = Math.min(255, Math.round(r * 255));
      imgD.data[idx + 1] = Math.min(255, Math.round(g * 255));
      imgD.data[idx + 2] = Math.min(255, Math.round(b * 255));
      imgD.data[idx + 3] = 255;

      // Natural matte-satin mountain flagstone roughness (0.72-0.96, zero glare puddles!)
      const rough = THREE.MathUtils.clamp(0.74 + (1 - combinedMask) * 0.22 + (1 - micro) * 0.12, 0.70, 0.97);
      const rb = Math.round(rough * 255);
      imgR.data[idx] = imgR.data[idx + 1] = imgR.data[idx + 2] = rb;
      imgR.data[idx + 3] = 255;

      heights[py * w + px] = combinedMask * (0.62 + cellTone * 0.12 + macro * 0.16 + micro * 0.10);
    }
  }

  ctxD.putImageData(imgD, 0, 0);
  ctxR.putImageData(imgR, 0, 0);

  return {
    map: makeCanvasTex(cDiff, true),
    roughnessMap: makeCanvasTex(cRough, false),
    normalMap: heightToNormalCanvas(heights, w, h, 1.8)
  };
}

export function createAgedWoodTextures(seed = 505, dark = false) {
  const w = 256, h = 512;
  const n2 = new TileNoise2D(seed + 23, 64);

  const cDiff = document.createElement('canvas');
  cDiff.width = w; cDiff.height = h;
  const ctxD = cDiff.getContext('2d');
  const imgD = ctxD.createImageData(w, h);
  const heights = new Float32Array(w * h);

  const planks = 6;
  for (let py = 0; py < h; py++) {
    const v = py / h;
    for (let px = 0; px < w; px++) {
      const u = px / w;
      const pPos = u * planks;
      const pIdx = Math.floor(pPos);
      const pFrac = pPos - pIdx;
      const seam = THREE.MathUtils.smoothstep(Math.min(pFrac, 1 - pFrac), 0.015, 0.06);

      const grain = n2.fbm(u * 8 + pIdx * 0.37, v * 1.2, 4, 2);
      const ring = Math.sin((u * 24 + grain * 4.0) * Math.PI);
      const val = (dark ? 0.28 : 0.40) + grain * 0.13 + ring * 0.025;

      let r = THREE.MathUtils.lerp(0.08, val * (dark ? 1.22 : 1.05), seam);
      let g = THREE.MathUtils.lerp(0.07, val * (dark ? 0.95 : 0.99), seam);
      let b = THREE.MathUtils.lerp(0.06, val * (dark ? 0.72 : 0.92), seam);

      const idx = (py * w + px) * 4;
      imgD.data[idx]     = Math.min(255, Math.round(r * 255));
      imgD.data[idx + 1] = Math.min(255, Math.round(g * 255));
      imgD.data[idx + 2] = Math.min(255, Math.round(b * 255));
      imgD.data[idx + 3] = 255;

      heights[py * w + px] = seam * (0.6 + grain * 0.3 + ring * 0.08);
    }
  }
  ctxD.putImageData(imgD, 0, 0);

  return {
    map: makeCanvasTex(cDiff, true),
    normalMap: heightToNormalCanvas(heights, w, h, 1.6)
  };
}

export function createLancetGlassTexture() {
  const w = 128, h = 512;
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');

  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0.0, '#d8b46a');
  grad.addColorStop(0.45, '#efd28d');
  grad.addColorStop(1.0, '#a87b3b');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = 'rgba(38, 28, 18, 0.85)';
  ctx.lineWidth = 3.2;
  const step = 26;
  for (let y = -h; y < h * 2; y += step) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y + w * 1.35);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(w, y);
    ctx.lineTo(0, y + w * 1.35);
    ctx.stroke();
  }

  ctx.strokeStyle = 'rgba(26, 18, 12, 0.94)';
  ctx.lineWidth = 5.5;
  for (let y of [h * 0.28, h * 0.56, h * 0.82]) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }

  const vig = ctx.createRadialGradient(w * 0.5, h * 0.5, w * 0.12, w * 0.5, h * 0.5, w * 0.72);
  vig.addColorStop(0, 'rgba(255,240,190,0.16)');
  vig.addColorStop(1, 'rgba(42,26,12,0.65)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, w, h);

  return makeCanvasTex(canvas, true);
}

export function createFoliageClusterTexture(seed = 707) {
  const w = 512, h = 512;
  const rng = createRng(seed);
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, w, h);

  function drawTwig(x, y, angle, len, width, depth) {
    if (depth <= 0 || len < 6) return;
    const nx = x + Math.cos(angle) * len;
    const ny = y + Math.sin(angle) * len;

    ctx.strokeStyle = '#140f0a';
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(
      (x + nx) * 0.5 + (rng() - 0.5) * len * 0.28,
      (y + ny) * 0.5 + (rng() - 0.5) * len * 0.28,
      nx, ny
    );
    ctx.stroke();

    if (depth <= 3) {
      const leafCount = 5 + ((rng() * 6) | 0);
      for (let i = 0; i < leafCount; i++) {
        const t = 0.15 + rng() * 0.92;
        const lx = x + (nx - x) * t + (rng() - 0.5) * 16;
        const ly = y + (ny - y) * t + (rng() - 0.5) * 16;
        const la = angle + (rng() > 0.5 ? 1 : -1) * (0.35 + rng() * 1.05);
        const lLen = 7.5 + rng() * 10.5;
        const lWid = 3.2 + rng() * 4.0;

        ctx.save();
        ctx.translate(lx, ly);
        ctx.rotate(la);
        const shade = rng();
        ctx.fillStyle = shade > 0.65 ? '#231d11' : (shade > 0.3 ? '#1a150c' : '#120e08');
        ctx.beginPath();
        ctx.ellipse(lLen * 0.5, 0, lLen * 0.55, lWid * 0.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    const subBranches = depth === 4 ? 3 : 2;
    for (let b = 0; b < subBranches; b++) {
      const spread = (b - (subBranches - 1) * 0.5) * (0.56 + rng() * 0.34) + (rng() - 0.5) * 0.24;
      drawTwig(nx, ny, angle + spread, len * (0.64 + rng() * 0.16), width * 0.68, depth - 1);
    }
  }

  drawTwig(w * 0.5, h * 0.90, -Math.PI * 0.5 - 0.32, 102, 5.5, 4);
  drawTwig(w * 0.5, h * 0.90, -Math.PI * 0.5 + 0.30, 98, 5.2, 4);
  drawTwig(w * 0.5, h * 0.84, -Math.PI * 0.5 - 0.78, 84, 4.2, 4);
  drawTwig(w * 0.5, h * 0.84, -Math.PI * 0.5 + 0.80, 82, 4.2, 4);
  drawTwig(w * 0.5, h * 0.88, -Math.PI * 0.5, 106, 4.8, 4);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

export function createBarkTextures(seed = 808) {
  const w = 256, h = 512;
  const n1 = new TileNoise2D(seed, 32);
  const n2 = new TileNoise2D(seed + 19, 64);

  const cDiff = document.createElement('canvas');
  cDiff.width = w; cDiff.height = h;
  const ctxD = cDiff.getContext('2d');
  const imgD = ctxD.createImageData(w, h);
  const heights = new Float32Array(w * h);

  for (let py = 0; py < h; py++) {
    const v = py / h;
    for (let px = 0; px < w; px++) {
      const u = px / w;
      const twist = u + (n1.fbm(u, v * 0.6, 3, 2) - 0.5) * 0.18;
      const ridge = n2.fbm(twist * 5.0, v * 1.4, 4, 2);
      const val = 0.08 + ridge * 0.11;

      const idx = (py * w + px) * 4;
      imgD.data[idx]     = Math.round(val * 1.12 * 255);
      imgD.data[idx + 1] = Math.round(val * 0.96 * 255);
      imgD.data[idx + 2] = Math.round(val * 0.76 * 255);
      imgD.data[idx + 3] = 255;

      heights[py * w + px] = ridge;
    }
  }
  ctxD.putImageData(imgD, 0, 0);
  return {
    map: makeCanvasTex(cDiff, true),
    normalMap: heightToNormalCanvas(heights, w, h, 2.0)
  };
}
