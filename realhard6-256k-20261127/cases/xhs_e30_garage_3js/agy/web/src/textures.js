import * as THREE from 'three';

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

// Deterministic pseudo-random helper for repeatable procedural textures
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * World-mapped concrete workshop floor textures (diffuse, roughness, bump).
 * Floor world span: X in [-8.0, +7.0] (width 15m), Z in [-4.0, +5.0] (depth 9m), centered at (-0.5, +0.5).
 */
export function createConcreteFloorTextures(maxAniso = 8) {
  const W = 2048, H = 1536;
  const diffCanvas = makeCanvas(W, H);
  const roughCanvas = makeCanvas(W, H);
  const bumpCanvas = makeCanvas(W, H);

  const dCtx = diffCanvas.getContext('2d');
  const rCtx = roughCanvas.getContext('2d');
  const bCtx = bumpCanvas.getContext('2d');

  const rand = mulberry32(30301988);

  // Base concrete tone
  dCtx.fillStyle = '#6d6b66';
  dCtx.fillRect(0, 0, W, H);

  // Base medium-high roughness (0.74 -> ~189)
  rCtx.fillStyle = 'rgb(188,188,188)';
  rCtx.fillRect(0, 0, W, H);

  bCtx.fillStyle = 'rgb(128,128,128)';
  bCtx.fillRect(0, 0, W, H);

  // Helper to convert world (x, z) to canvas (u, v)
  // PlaneGeometry(15, 9) rotated -PI/2 around X placed at (-0.5, 0, 0.5):
  // x in [-8.0, +7.0] -> u in [0, W]
  // z in [-4.0, +5.0] -> v in [0, H]
  const wx = (x) => ((x + 8.0) / 15.0) * W;
  const wz = (z) => ((z + 4.0) / 9.0) * H;

  // Large mottled concrete clouds
  for (let i = 0; i < 420; i++) {
    const x = rand() * W;
    const y = rand() * H;
    const r = 35 + rand() * 160;
    const shade = Math.floor(88 + rand() * 44);
    const alpha = 0.04 + rand() * 0.08;
    const g = dCtx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(${shade + 4},${shade + 2},${shade - 2},${alpha})`);
    g.addColorStop(1, 'rgba(108,106,101,0)');
    dCtx.fillStyle = g;
    dCtx.beginPath();
    dCtx.arc(x, y, r, 0, Math.PI * 2);
    dCtx.fill();

    const rVal = Math.floor(150 + rand() * 75);
    const rg = rCtx.createRadialGradient(x, y, 0, x, y, r);
    rg.addColorStop(0, `rgba(${rVal},${rVal},${rVal},0.10)`);
    rg.addColorStop(1, 'rgba(188,188,188,0)');
    rCtx.fillStyle = rg;
    rCtx.beginPath();
    rCtx.arc(x, y, r, 0, Math.PI * 2);
    rCtx.fill();
  }

  // Darker grime & dust near walls (Z < -2.6 or X < -6.2)
  const wallGrad = dCtx.createLinearGradient(0, wz(-4.0), 0, wz(-2.1));
  wallGrad.addColorStop(0, 'rgba(38,36,33,0.48)');
  wallGrad.addColorStop(1, 'rgba(38,36,33,0)');
  dCtx.fillStyle = wallGrad;
  dCtx.fillRect(0, 0, W, wz(-2.1));

  // Concrete control / expansion joints
  dCtx.strokeStyle = 'rgba(42,40,38,0.42)';
  bCtx.strokeStyle = 'rgba(65,65,65,0.65)';
  dCtx.lineWidth = 2.2;
  bCtx.lineWidth = 3.0;
  for (const xLine of [-4.5, -0.5, 3.5]) {
    const px = wx(xLine);
    dCtx.beginPath(); dCtx.moveTo(px, 0); dCtx.lineTo(px, H); dCtx.stroke();
    bCtx.beginPath(); bCtx.moveTo(px, 0); bCtx.lineTo(px, H); bCtx.stroke();
  }
  for (const zLine of [-1.8, 1.8]) {
    const pz = wz(zLine);
    dCtx.beginPath(); dCtx.moveTo(0, pz); dCtx.lineTo(W, pz); dCtx.stroke();
    bCtx.beginPath(); bCtx.moveTo(0, pz); bCtx.lineTo(W, pz); bCtx.stroke();
  }

  // Subtle tire rubber tracks along the lift bay (Z ≈ ±0.80, X from -7 to +3.5)
  for (const zTrack of [-0.80, 0.80]) {
    const tz = wz(zTrack);
    const tg = dCtx.createLinearGradient(0, tz - 26, 0, tz + 26);
    tg.addColorStop(0, 'rgba(45,44,42,0)');
    tg.addColorStop(0.5, 'rgba(40,39,37,0.20)');
    tg.addColorStop(1, 'rgba(45,44,42,0)');
    dCtx.fillStyle = tg;
    dCtx.fillRect(wx(-7.2), tz - 26, wx(3.2) - wx(-7.2), 52);
  }

  // Art-directed motor oil stains, damp blotches & glossy patches under car and foreground aisle
  // Especially in X in [-0.8, +4.8], Z in [-0.6, +2.6] (matching foreground sheen in reference-0.png)
  const oilZones = [
    { x: 1.45, z: 0.15, rx: 0.65, rz: 0.45, dark: 0.44, gloss: 32 },
    { x: 2.35, z: 0.72, rx: 0.85, rz: 0.55, dark: 0.36, gloss: 26 },
    { x: 2.95, z: 1.45, rx: 1.05, rz: 0.68, dark: 0.42, gloss: 24 },
    { x: 3.65, z: 1.85, rx: 0.90, rz: 0.55, dark: 0.38, gloss: 28 },
    { x: 2.05, z: 1.65, rx: 0.72, rz: 0.48, dark: 0.35, gloss: 30 },
    { x: 0.25, z: 0.05, rx: 0.95, rz: 0.65, dark: 0.40, gloss: 38 },
    { x: 3.55, z: -2.95, rx: 0.55, rz: 0.40, dark: 0.46, gloss: 42 }, // under standalone engine
    { x: 4.15, z: 2.25, rx: 0.65, rz: 0.50, dark: 0.34, gloss: 35 },
  ];

  for (const oz of oilZones) {
    for (let k = 0; k < 14; k++) {
      const ox = wx(oz.x + (rand() - 0.5) * oz.rx * 1.3);
      const oy = wz(oz.z + (rand() - 0.5) * oz.rz * 1.3);
      const radX = (0.12 + rand() * oz.rx * 0.65) * (W / 15.0);
      const radY = (0.10 + rand() * oz.rz * 0.65) * (H / 9.0);
      const rot = rand() * Math.PI;

      dCtx.save();
      dCtx.translate(ox, oy);
      dCtx.rotate(rot);
      dCtx.scale(1, radY / radX);
      const dg = dCtx.createRadialGradient(0, 0, radX * 0.1, 0, 0, radX);
      dg.addColorStop(0, `rgba(34,31,27,${oz.dark * (0.45 + rand() * 0.55)})`);
      dg.addColorStop(0.65, `rgba(48,44,38,${oz.dark * 0.32})`);
      dg.addColorStop(1, 'rgba(60,56,50,0)');
      dCtx.fillStyle = dg;
      dCtx.beginPath();
      dCtx.arc(0, 0, radX, 0, Math.PI * 2);
      dCtx.fill();
      dCtx.restore();

      // Smooth damp/oily sheen (avoiding overly mirror-like dots)
      rCtx.save();
      rCtx.translate(ox, oy);
      rCtx.rotate(rot);
      rCtx.scale(1, radY / radX);
      const rg = rCtx.createRadialGradient(0, 0, radX * 0.15, 0, 0, radX);
      const gVal = 78 + Math.floor(rand() * 38);
      rg.addColorStop(0, `rgba(${gVal},${gVal},${gVal},0.55)`);
      rg.addColorStop(0.7, `rgba(${gVal + 35},${gVal + 35},${gVal + 35},0.25)`);
      rg.addColorStop(1, 'rgba(188,188,188,0)');
      rCtx.fillStyle = rg;
      rCtx.beginPath();
      rCtx.arc(0, 0, radX, 0, Math.PI * 2);
      rCtx.fill();
      rCtx.restore();
    }
  }

  // Per-pixel organic concrete aggregate noise (zero blocky squares!)
  const dImg = dCtx.getImageData(0, 0, W, H);
  const bImg = bCtx.getImageData(0, 0, W, H);
  const dData = dImg.data;
  const bData = bImg.data;
  for (let i = 0; i < dData.length; i += 4) {
    const n = (rand() - 0.5) * 22 + (rand() - 0.5) * 12;
    dData[i]     = Math.max(0, Math.min(255, dData[i] + n));
    dData[i + 1] = Math.max(0, Math.min(255, dData[i + 1] + n * 0.98));
    dData[i + 2] = Math.max(0, Math.min(255, dData[i + 2] + n * 0.94));
    const bn = Math.max(0, Math.min(255, 128 + n * 2.2));
    bData[i] = bData[i + 1] = bData[i + 2] = bn;
  }
  dCtx.putImageData(dImg, 0, 0);
  bCtx.putImageData(bImg, 0, 0);

  // Soft small dark motor-oil drips & scuff marks around work area (diffuse only, no bright specular dots!)
  for (let i = 0; i < 220; i++) {
    const ox = wx(-1.5 + rand() * 6.8);
    const oy = wz(-2.8 + rand() * 5.8);
    const rr = 2.5 + rand() * 12.0;
    const og = dCtx.createRadialGradient(ox, oy, 0, ox, oy, rr);
    og.addColorStop(0, `rgba(30,28,25,${0.18 + rand() * 0.28})`);
    og.addColorStop(1, 'rgba(30,28,25,0)');
    dCtx.fillStyle = og;
    dCtx.beginPath();
    dCtx.arc(ox, oy, rr, 0, Math.PI * 2);
    dCtx.fill();
  }

  // Hairline floor cracks
  dCtx.strokeStyle = 'rgba(38,36,34,0.38)';
  bCtx.strokeStyle = 'rgba(70,70,70,0.55)';
  dCtx.lineWidth = 1.1;
  bCtx.lineWidth = 1.4;
  for (let c = 0; c < 18; c++) {
    let cx = rand() * W;
    let cy = rand() * H;
    dCtx.beginPath(); dCtx.moveTo(cx, cy);
    bCtx.beginPath(); bCtx.moveTo(cx, cy);
    let ang = rand() * Math.PI * 2;
    for (let s = 0; s < 14; s++) {
      ang += (rand() - 0.5) * 0.7;
      cx += Math.cos(ang) * (8 + rand() * 18);
      cy += Math.sin(ang) * (8 + rand() * 18);
      dCtx.lineTo(cx, cy);
      bCtx.lineTo(cx, cy);
    }
    dCtx.stroke();
    bCtx.stroke();
  }

  const map = new THREE.CanvasTexture(diffCanvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = maxAniso;

  const roughnessMap = new THREE.CanvasTexture(roughCanvas);
  roughnessMap.colorSpace = THREE.NoColorSpace;
  roughnessMap.anisotropy = maxAniso;

  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.colorSpace = THREE.NoColorSpace;
  bumpMap.anisotropy = maxAniso;

  return { map, roughnessMap, bumpMap };
}

/**
 * Aged industrial concrete / painted plaster wall texture.
 */
export function createWallPlasterTexture(maxAniso = 4) {
  const W = 1024, H = 1024;
  const c = makeCanvas(W, H);
  const ctx = c.getContext('2d');
  const rand = mulberry32(991122);

  // Warm aged industrial cream-grey plaster
  ctx.fillStyle = '#aba69b';
  ctx.fillRect(0, 0, W, H);

  for (let i = 0; i < 320; i++) {
    const x = rand() * W;
    const y = rand() * H;
    const r = 20 + rand() * 110;
    const v = Math.floor(142 + rand() * 44);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(${v},${v - 3},${v - 9},0.12)`);
    g.addColorStop(1, 'rgba(170,165,155,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Subtle vertical grime streaks from upper ceiling/windows
  for (let i = 0; i < 90; i++) {
    const x = rand() * W;
    const w = 2 + rand() * 10;
    const h = 80 + rand() * 380;
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, 'rgba(68,64,58,0.16)');
    g.addColorStop(1, 'rgba(68,64,58,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x, rand() * 220, w, h);
  }

  // Fine plaster grain & tie-holes
  for (let i = 0; i < 9000; i++) {
    const v = Math.floor(120 + rand() * 70);
    ctx.fillStyle = `rgba(${v},${v - 2},${v - 6},0.16)`;
    ctx.fillRect(rand() * W, rand() * H, 1.5, 1.5);
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = maxAniso;
  return tex;
}

/**
 * Luminous outdoor daylight panorama behind factory windows & bay door.
 */
export function createOutdoorBackdropTexture() {
  const W = 2048, H = 1024;
  const c = makeCanvas(W, H);
  const ctx = c.getContext('2d');
  const rand = mulberry32(445566);

  // Bright slightly overexposed sunlit sky gradient
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0.0, '#dce9f7');
  sky.addColorStop(0.45, '#f5f8fc');
  sky.addColorStop(0.75, '#fbf9f2');
  sky.addColorStop(1.0, '#d8d3c8');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  // Neighboring industrial brick/concrete courtyard buildings in soft daylight haze
  const buildings = [
    { x: 60, y: 430, w: 420, h: 480, col: '#dfd0c2' },
    { x: 960, y: 470, w: 360, h: 450, col: '#c7ced6' },
    { x: 1620, y: 500, w: 380, h: 420, col: '#d6cfc5' },
  ];
  for (const b of buildings) {
    ctx.fillStyle = b.col;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = 'rgba(130,140,152,0.32)';
    for (let wy = b.y + 36; wy < b.y + b.h - 50; wy += 74) {
      for (let wx = b.x + 28; wx < b.x + b.w - 48; wx += 72) {
        ctx.fillRect(wx, wy, 44, 48);
      }
    }
  }

  // Sunlit golden-green autumn trees outside the factory windows
  const treeClusters = [
    { cx: 680, cy: 430, r: 230 },
    { cx: 860, cy: 380, r: 210 },
    { cx: 1180, cy: 360, r: 190 },
    { cx: 1520, cy: 340, r: 240 },
    { cx: 1760, cy: 370, r: 210 },
  ];
  for (const tc of treeClusters) {
    // Subtle branches
    ctx.strokeStyle = 'rgba(105,96,82,0.35)';
    ctx.lineWidth = 6;
    for (let b = 0; b < 6; b++) {
      ctx.beginPath();
      ctx.moveTo(tc.cx + (rand() - 0.5) * 40, tc.cy + tc.r * 0.9);
      ctx.lineTo(tc.cx + (rand() - 0.5) * tc.r * 1.1, tc.cy - rand() * tc.r * 0.6);
      ctx.stroke();
    }
    // Dappled sunlit foliage puffs
    for (let p = 0; p < 85; p++) {
      const px = tc.cx + (rand() - 0.5) * tc.r * 1.7;
      const py = tc.cy + (rand() - 0.5) * tc.r * 1.4;
      const pr = 18 + rand() * 52;
      const warm = rand();
      const col = warm > 0.45
        ? `rgba(${192 + Math.floor(rand() * 42)},${196 + Math.floor(rand() * 36)},${132 + Math.floor(rand() * 35)},0.34)`
        : `rgba(${156 + Math.floor(rand() * 35)},${174 + Math.floor(rand() * 32)},${126 + Math.floor(rand() * 30)},0.30)`;
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(px, py, pr, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Soft sun bloom wash so windows look genuinely bright and airy
  const bloom = ctx.createRadialGradient(W * 0.58, H * 0.28, 40, W * 0.58, H * 0.28, 780);
  bloom.addColorStop(0, 'rgba(255,253,244,0.65)');
  bloom.addColorStop(0.5, 'rgba(255,251,238,0.22)');
  bloom.addColorStop(1, 'rgba(255,250,235,0)');
  ctx.fillStyle = bloom;
  ctx.fillRect(0, 0, W, H);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Vintage BMW "THE ULTIMATE DRIVING MACHINE" banner poster on the concrete wall pier.
 */
export function createBMWPosterTexture(maxAniso = 8) {
  const W = 512, H = 1024;
  const c = makeCanvas(W, H);
  const ctx = c.getContext('2d');

  // Upper charcoal-black banner section
  ctx.fillStyle = '#1b1c1f';
  ctx.fillRect(0, 0, W, H * 0.53);

  // Lower warm cream vintage paper/cloth section
  ctx.fillStyle = '#d3cec2';
  ctx.fillRect(0, H * 0.53, W, H * 0.47);

  // Subtle vertical fabric folds / sheen
  for (let x = 0; x < W; x += 4) {
    const wave = Math.sin(x * 0.045) * 0.03 + Math.cos(x * 0.11) * 0.015;
    ctx.fillStyle = wave > 0 ? `rgba(255,255,255,${wave})` : `rgba(0,0,0,${-wave})`;
    ctx.fillRect(x, 0, 4, H);
  }

  // BMW Roundel centered at (W/2, H*0.275)
  const cx = W * 0.5, cy = H * 0.275, rOuter = 148, rInner = 92;
  // Outer silver ring
  ctx.beginPath();
  ctx.arc(cx, cy, rOuter, 0, Math.PI * 2);
  ctx.fillStyle = '#cfd3d8';
  ctx.fill();

  ctx.beginPath();
  ctx.arc(cx, cy, rOuter - 7, 0, Math.PI * 2);
  ctx.fillStyle = '#111316';
  ctx.fill();

  // Inner silver ring
  ctx.beginPath();
  ctx.arc(cx, cy, rInner + 5, 0, Math.PI * 2);
  ctx.fillStyle = '#cfd3d8';
  ctx.fill();

  // 4 Bavarian quadrants (top-left blue, top-right white, bottom-left white, bottom-right blue)
  const drawQuad = (a0, a1, color) => {
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, rInner, a0, a1);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  };
  drawQuad(Math.PI, Math.PI * 1.5, '#1d6fb8');
  drawQuad(Math.PI * 1.5, Math.PI * 2, '#eef0f2');
  drawQuad(0, Math.PI * 0.5, '#1d6fb8');
  drawQuad(Math.PI * 0.5, Math.PI, '#eef0f2');

  // Crosshair divider lines
  ctx.strokeStyle = '#9aa0a8';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(cx - rInner, cy); ctx.lineTo(cx + rInner, cy);
  ctx.moveTo(cx, cy - rInner); ctx.lineTo(cx, cy + rInner);
  ctx.stroke();

  // "B M W" letters arched along upper black ring
  ctx.fillStyle = '#e7eaee';
  ctx.font = 'bold 42px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const letters = [
    { ch: 'B', ang: -Math.PI * 0.73 },
    { ch: 'M', ang: -Math.PI * 0.50 },
    { ch: 'W', ang: -Math.PI * 0.27 },
  ];
  const rText = (rOuter - 7 + rInner + 5) * 0.5;
  for (const l of letters) {
    ctx.save();
    ctx.translate(cx + Math.cos(l.ang) * rText, cy + Math.sin(l.ang) * rText);
    ctx.rotate(l.ang + Math.PI * 0.5);
    ctx.fillText(l.ch, 0, 0);
    ctx.restore();
  }

  // Typography on lower cream half
  ctx.fillStyle = '#252629';
  ctx.textAlign = 'left';
  ctx.font = 'bold 31px Impact, "Arial Narrow", sans-serif';
  ctx.fillText('THE ULTIMATE', 42, 608);
  ctx.fillText('DRIVING MACHINE', 42, 646);

  // Detailed crisp side-profile illustration of BMW E30 Coupe (facing left)
  ctx.save();
  ctx.translate(46, 735);
  // Shadow oval under car illustration
  ctx.fillStyle = 'rgba(20,20,22,0.38)';
  ctx.beginPath();
  ctx.ellipse(212, 92, 188, 10, 0, 0, Math.PI * 2);
  ctx.fill();

  // Car silhouette body
  ctx.fillStyle = '#22252a';
  ctx.beginPath();
  ctx.moveTo(14, 72);   // front valance lip
  ctx.lineTo(8, 52);    // front bumper
  ctx.lineTo(22, 34);   // forward-leaning E30 nose
  ctx.lineTo(132, 26);  // flat hood to base of windshield
  ctx.lineTo(178, -8);  // A-pillar up to roof
  ctx.lineTo(298, -8);  // flat E30 roof
  ctx.lineTo(352, 27);  // C-pillar down to trunk
  ctx.lineTo(412, 30);  // trunk deck + subtle lip
  ctx.lineTo(418, 54);  // rear taillight & bumper
  ctx.lineTo(404, 72);  // rear lower valance
  ctx.closePath();
  ctx.fill();

  // Greenhouse windows (cream cutouts with B-pillar & Hofmeister kink)
  ctx.fillStyle = '#dcd7cc';
  // Front door window
  ctx.beginPath();
  ctx.moveTo(142, 25);
  ctx.lineTo(182, -2);
  ctx.lineTo(246, -2);
  ctx.lineTo(246, 25);
  ctx.closePath();
  ctx.fill();
  // Rear quarter window with Hofmeister kink
  ctx.beginPath();
  ctx.moveTo(254, -2);
  ctx.lineTo(294, -2);
  ctx.lineTo(338, 25);
  ctx.lineTo(254, 25);
  ctx.closePath();
  ctx.fill();

  // Silver trim line & rub strip
  ctx.strokeStyle = '#a4a9b0';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(24, 44); ctx.lineTo(408, 44);
  ctx.stroke();

  // Two BBS-style wheels on the poster car
  for (const wx of [86, 332]) {
    ctx.beginPath();
    ctx.arc(wx, 70, 31, 0, Math.PI * 2);
    ctx.fillStyle = '#15171a';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(wx, 70, 20, 0, Math.PI * 2);
    ctx.fillStyle = '#c8cdd4';
    ctx.fill();
    ctx.strokeStyle = '#484d55';
    ctx.lineWidth = 1.4;
    for (let a = 0; a < 10; a++) {
      const th = (a / 10) * Math.PI;
      ctx.beginPath();
      ctx.moveTo(wx + Math.cos(th) * 18, 70 + Math.sin(th) * 18);
      ctx.lineTo(wx - Math.cos(th) * 18, 70 - Math.sin(th) * 18);
      ctx.stroke();
    }
  }
  ctx.restore();

  // Small spec footer & corner grommets
  ctx.fillStyle = '#5c5a55';
  ctx.font = 'bold 14px monospace';
  ctx.fillText('BMW E30 · M20 / S14 HERITAGE', 42, 968);
  for (const [gx, gy] of [[22, 22], [W - 22, 22], [22, H - 22], [W - 22, H - 22]]) {
    ctx.beginPath();
    ctx.arc(gx, gy, 7, 0, Math.PI * 2);
    ctx.strokeStyle = '#7d7a72';
    ctx.lineWidth = 3;
    ctx.stroke();
  }

  // Subtle dark border & aging vignette
  ctx.strokeStyle = 'rgba(20,20,20,0.45)';
  ctx.lineWidth = 6;
  ctx.strokeRect(3, 3, W - 6, H - 6);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAniso;
  return tex;
}

/**
 * MICHELIN banner across the top tire rack beam.
 */
export function createMichelinBannerTexture(maxAniso = 8) {
  const W = 1024, H = 192;
  const c = makeCanvas(W, H);
  const ctx = c.getContext('2d');

  // Deep Michelin blue background
  ctx.fillStyle = '#1b2d52';
  ctx.fillRect(0, 0, W, H);

  // Subtle top/bottom yellow racing stripes
  ctx.fillStyle = '#f2c618';
  ctx.fillRect(16, 12, W - 32, 6);
  ctx.fillRect(16, H - 18, W - 32, 6);

  // Simplified friendly white Bibendum figure on left
  ctx.save();
  ctx.translate(185, 112);
  ctx.fillStyle = '#f3f5f8';
  ctx.strokeStyle = '#1b2d52';
  ctx.lineWidth = 3;
  // Torso tire rings
  for (let r = 0; r < 4; r++) {
    ctx.beginPath();
    ctx.ellipse(0, 26 - r * 16, 36 - r * 2, 11, -0.08, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  // Head
  ctx.beginPath();
  ctx.arc(-4, -38, 22, 0, Math.PI * 2);
  ctx.fill();
  // Waving arm
  ctx.lineWidth = 14;
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#f3f5f8';
  ctx.beginPath();
  ctx.moveTo(26, -12);
  ctx.quadraticCurveTo(58, -36, 48, -64);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-28, -8);
  ctx.quadraticCurveTo(-54, 8, -44, 32);
  ctx.stroke();
  // Eyes/smile
  ctx.fillStyle = '#1b2d52';
  ctx.beginPath(); ctx.arc(-10, -42, 3, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(3, -42, 3, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  // Bold italic MICHELIN lettering
  ctx.save();
  ctx.fillStyle = '#f4f6fa';
  ctx.font = 'italic 900 88px Arial, Helvetica, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.transform(1, 0, -0.14, 1, 275, H * 0.53);
  ctx.fillText('MICHELIN', 0, 0);
  ctx.restore();

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAniso;
  return tex;
}

/**
 * Vertical "Ravaglioli" logo + safety warning sticker placard for the blue lift columns.
 */
export function createLiftDecals() {
  // 1. Vertical Ravaglioli text on blue background
  const c1 = makeCanvas(128, 512);
  const ctx1 = c1.getContext('2d');
  ctx1.fillStyle = '#0d4a86';
  ctx1.fillRect(0, 0, 128, 512);
  ctx1.save();
  ctx1.translate(68, 256);
  ctx1.rotate(-Math.PI * 0.5);
  ctx1.fillStyle = '#e9eef4';
  ctx1.font = 'bold 64px Arial, Helvetica, sans-serif';
  ctx1.textAlign = 'center';
  ctx1.textBaseline = 'middle';
  ctx1.fillText('Ravaglioli', 0, 0);
  ctx1.restore();
  const logoTex = new THREE.CanvasTexture(c1);
  logoTex.colorSpace = THREE.SRGBColorSpace;

  // 2. Stacked warning/capacity stickers
  const c2 = makeCanvas(192, 512);
  const ctx2 = c2.getContext('2d');
  ctx2.fillStyle = '#0d4a86';
  ctx2.fillRect(0, 0, 192, 512);

  // Top yellow warning placard
  ctx2.fillStyle = '#e5b524';
  ctx2.fillRect(24, 18, 144, 130);
  ctx2.strokeStyle = '#1d1e20';
  ctx2.lineWidth = 5;
  ctx2.strokeRect(28, 22, 136, 122);
  ctx2.beginPath();
  ctx2.arc(96, 78, 36, 0, Math.PI * 2);
  ctx2.fillStyle = '#d9541e';
  ctx2.fill();
  ctx2.fillStyle = '#111';
  ctx2.font = 'bold 20px sans-serif';
  ctx2.textAlign = 'center';
  ctx2.fillText('3200 kg', 96, 136);

  // Middle white instruction placard
  ctx2.fillStyle = '#e8e6df';
  ctx2.fillRect(24, 170, 144, 155);
  ctx2.fillStyle = '#d9481e';
  ctx2.fillRect(24, 170, 144, 28);
  ctx2.fillStyle = '#222';
  for (let y = 212; y < 312; y += 18) {
    ctx2.fillRect(36, y, 52, 8);
    ctx2.fillRect(98, y, 56, 8);
  }

  // Bottom silver spec plate
  ctx2.fillStyle = '#cfd2d6';
  ctx2.fillRect(24, 345, 144, 135);
  ctx2.strokeStyle = '#333';
  ctx2.lineWidth = 3;
  ctx2.strokeRect(28, 349, 136, 127);
  ctx2.fillStyle = '#1a1c20';
  ctx2.font = 'bold 22px monospace';
  ctx2.fillText('CE 2024', 96, 388);
  ctx2.font = '15px monospace';
  ctx2.fillText('KPX 337W', 96, 420);
  ctx2.fillText('MADE IN ITALY', 96, 452);

  const safetyTex = new THREE.CanvasTexture(c2);
  safetyTex.colorSpace = THREE.SRGBColorSpace;
  return { logoTex, safetyTex };
}

/**
 * Authentic German Euro license plate "B · E 3030"
 */
export function createLicensePlateTexture(maxAniso = 8) {
  const W = 512, H = 112;
  const c = makeCanvas(W, H);
  const ctx = c.getContext('2d');

  // Reflective white background
  ctx.fillStyle = '#eceee9';
  ctx.fillRect(0, 0, W, H);

  // Outer black rounded frame
  ctx.strokeStyle = '#16181b';
  ctx.lineWidth = 7;
  ctx.strokeRect(4, 4, W - 8, H - 8);

  // Left EU blue band
  ctx.fillStyle = '#0c439c';
  ctx.fillRect(8, 8, 56, H - 16);

  // 12 yellow EU stars circle
  ctx.fillStyle = '#f5c71a';
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(36 + Math.cos(a) * 15, 36 + Math.sin(a) * 15, 2.2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 26px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('D', 36, 90);

  // German plate lettering: "B" [stickers] "E 3030"
  ctx.fillStyle = '#141619';
  ctx.font = 'bold 76px "Arial Narrow", Impact, Arial, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.save();
  ctx.scale(0.88, 1.0);
  ctx.fillText('B', 90, H * 0.54);
  ctx.fillText('E 3030', 196, H * 0.54);
  ctx.restore();

  // TÜV (top orange/yellow) & Berlin state seal (bottom blue/white)
  ctx.beginPath();
  ctx.arc(144, 34, 12, 0, Math.PI * 2);
  ctx.fillStyle = '#e08b26';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(144, 74, 14, 0, Math.PI * 2);
  ctx.fillStyle = '#2458a6';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(144, 74, 9, 0, Math.PI * 2);
  ctx.fillStyle = '#eef0f2';
  ctx.fill();

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAniso;
  return tex;
}

/**
 * Hella E30 fluted round glass headlight lens + BMW roundel + M badge + Taillights + SONIC & Liqui Moly labels
 */
export function createAutomotiveDetailTextures(maxAniso = 8) {
  // 1. Headlight glass fluted lens
  const hc = makeCanvas(256, 256);
  const hctx = hc.getContext('2d');
  const hg = hctx.createRadialGradient(128, 128, 8, 128, 128, 124);
  hg.addColorStop(0, '#eef3f8');
  hg.addColorStop(0.55, '#cfd6df');
  hg.addColorStop(0.88, '#98a2ae');
  hg.addColorStop(1.0, '#454c54');
  hctx.fillStyle = hg;
  hctx.fillRect(0, 0, 256, 256);

  // Vertical optical Fresnel ribs
  for (let x = 16; x < 240; x += 8) {
    hctx.fillStyle = x % 16 === 0 ? 'rgba(255,255,255,0.28)' : 'rgba(40,46,55,0.22)';
    hctx.fillRect(x, 12, 3, 232);
  }
  // Horizontal collector bands & concentric prism circles
  hctx.strokeStyle = 'rgba(255,255,255,0.35)';
  hctx.lineWidth = 2;
  for (const r of [34, 68, 98, 118]) {
    hctx.beginPath(); hctx.arc(128, 128, r, 0, Math.PI * 2); hctx.stroke();
  }
  hctx.strokeStyle = 'rgba(55,60,68,0.35)';
  hctx.beginPath();
  hctx.moveTo(12, 128); hctx.lineTo(244, 128);
  hctx.moveTo(128, 12); hctx.lineTo(128, 244);
  hctx.stroke();

  const headlightTex = new THREE.CanvasTexture(hc);
  headlightTex.colorSpace = THREE.SRGBColorSpace;
  headlightTex.anisotropy = maxAniso;

  // 2. Small crisp BMW Roundel badge (hood, trunk, wheel center caps, steering wheel)
  const bc = makeCanvas(256, 256);
  const bctx = bc.getContext('2d');
  bctx.clearRect(0, 0, 256, 256);
  bctx.beginPath(); bctx.arc(128, 128, 122, 0, Math.PI * 2); bctx.fillStyle = '#d4d8de'; bctx.fill();
  bctx.beginPath(); bctx.arc(128, 128, 112, 0, Math.PI * 2); bctx.fillStyle = '#121417'; bctx.fill();
  bctx.beginPath(); bctx.arc(128, 128, 76, 0, Math.PI * 2); bctx.fillStyle = '#d4d8de'; bctx.fill();
  const q = (a0, a1, col) => {
    bctx.beginPath(); bctx.moveTo(128, 128); bctx.arc(128, 128, 70, a0, a1); bctx.closePath();
    bctx.fillStyle = col; bctx.fill();
  };
  q(Math.PI, Math.PI * 1.5, '#0066b1');
  q(Math.PI * 1.5, Math.PI * 2, '#f4f6f8');
  q(0, Math.PI * 0.5, '#0066b1');
  q(Math.PI * 0.5, Math.PI, '#f4f6f8');
  bctx.fillStyle = '#eceff2';
  bctx.font = 'bold 28px Arial, sans-serif';
  bctx.textAlign = 'center';
  bctx.textBaseline = 'middle';
  bctx.fillText('M', 128, 34);
  bctx.save(); bctx.translate(64, 62); bctx.rotate(-0.72); bctx.fillText('B', 0, 0); bctx.restore();
  bctx.save(); bctx.translate(192, 62); bctx.rotate(0.72); bctx.fillText('W', 0, 0); bctx.restore();
  const roundelTex = new THREE.CanvasTexture(bc);
  roundelTex.colorSpace = THREE.SRGBColorSpace;
  roundelTex.anisotropy = maxAniso;

  // 3. ///M grille badge
  const mc = makeCanvas(256, 96);
  const mctx = mc.getContext('2d');
  mctx.fillStyle = '#141618';
  mctx.fillRect(0, 0, 256, 96);
  const stripes = ['#0088ce', '#1c2b6b', '#e42229'];
  for (let i = 0; i < 3; i++) {
    mctx.fillStyle = stripes[i];
    mctx.beginPath();
    const x0 = 28 + i * 32;
    mctx.moveTo(x0 + 22, 14);
    mctx.lineTo(x0 + 50, 14);
    mctx.lineTo(x0 + 28, 82);
    mctx.lineTo(x0, 82);
    mctx.closePath();
    mctx.fill();
  }
  mctx.fillStyle = '#e5e9ef';
  mctx.font = 'italic 900 68px Arial, sans-serif';
  mctx.fillText('M', 122, 74);
  const mBadgeTex = new THREE.CanvasTexture(mc);
  mBadgeTex.colorSpace = THREE.SRGBColorSpace;

  // 4. E30 ribbed taillight texture
  const tc = makeCanvas(256, 128);
  const tctx = tc.getContext('2d');
  tctx.fillStyle = '#b01818';
  tctx.fillRect(0, 0, 256, 128);
  tctx.fillStyle = '#d96c14'; // amber turn section
  tctx.fillRect(0, 0, 165, 52);
  tctx.fillStyle = '#e2e5ea'; // reverse lamp section
  tctx.fillRect(170, 8, 78, 40);
  // Horizontal black E30 ribs
  tctx.fillStyle = 'rgba(15,15,18,0.48)';
  for (let y = 0; y < 128; y += 12) {
    tctx.fillRect(0, y, 256, 3);
  }
  const taillightTex = new THREE.CanvasTexture(tc);
  taillightTex.colorSpace = THREE.SRGBColorSpace;

  // 5. E30 VDO Instrument Cluster gauges
  const ic = makeCanvas(512, 256);
  const ictx = ic.getContext('2d');
  ictx.fillStyle = '#121417';
  ictx.fillRect(0, 0, 512, 256);
  const drawGauge = (gx, gy, gr, label) => {
    ictx.beginPath(); ictx.arc(gx, gy, gr, 0, Math.PI * 2);
    ictx.fillStyle = '#181b20'; ictx.fill();
    ictx.strokeStyle = '#3a3f47'; ictx.lineWidth = 4; ictx.stroke();
    ictx.strokeStyle = '#e8ecf2'; ictx.lineWidth = 2.5;
    for (let k = 0; k <= 12; k++) {
      const a = Math.PI * 0.75 + (k / 12) * Math.PI * 1.5;
      ictx.beginPath();
      ictx.moveTo(gx + Math.cos(a) * (gr - 14), gy + Math.sin(a) * (gr - 14));
      ictx.lineTo(gx + Math.cos(a) * (gr - 4), gy + Math.sin(a) * (gr - 4));
      ictx.stroke();
    }
    // Red/orange classic BMW gauge needle
    ictx.strokeStyle = '#ef4d28'; ictx.lineWidth = 4;
    ictx.beginPath(); ictx.moveTo(gx, gy); ictx.lineTo(gx - gr * 0.58, gy + gr * 0.35); ictx.stroke();
    ictx.fillStyle = '#cfd5dd'; ictx.font = 'bold 14px sans-serif'; ictx.textAlign = 'center';
    ictx.fillText(label, gx, gy + 28);
  };
  drawGauge(90, 136, 56, 'TEMP');
  drawGauge(196, 122, 78, 'km/h');
  drawGauge(324, 122, 78, '1/min x1000');
  drawGauge(426, 136, 56, 'FUEL');
  // Green/amber SI service indicator strip at bottom
  const siCols = ['#22b34c', '#22b34c', '#22b34c', '#22b34c', '#e6b81e', '#d93228'];
  for (let i = 0; i < 6; i++) {
    ictx.fillStyle = siCols[i];
    ictx.fillRect(216 + i * 14, 214, 10, 10);
  }
  const clusterTex = new THREE.CanvasTexture(ic);
  clusterTex.colorSpace = THREE.SRGBColorSpace;

  // 6. Tire tread bump & diffuse texture
  const trc = makeCanvas(512, 256);
  const trctx = trc.getContext('2d');
  trctx.fillStyle = '#1f2124';
  trctx.fillRect(0, 0, 512, 256);
  // Circumferential grooves (along X since cylinder wraps around)
  trctx.fillStyle = '#0c0d0f';
  for (const gy of [52, 102, 154, 204]) {
    trctx.fillRect(0, gy - 6, 512, 12);
  }
  // Diagonal siping blocks
  trctx.strokeStyle = '#121316';
  trctx.lineWidth = 5;
  for (let x = -32; x < 544; x += 24) {
    trctx.beginPath();
    trctx.moveTo(x, 0); trctx.lineTo(x + 18, 52);
    trctx.moveTo(x + 8, 58); trctx.lineTo(x - 6, 102);
    trctx.moveTo(x, 154); trctx.lineTo(x + 14, 204);
    trctx.moveTo(x + 12, 210); trctx.lineTo(x - 6, 256);
    trctx.stroke();
  }
  const tireTreadTex = new THREE.CanvasTexture(trc);
  tireTreadTex.colorSpace = THREE.SRGBColorSpace;
  tireTreadTex.wrapS = tireTreadTex.wrapT = THREE.RepeatWrapping;
  tireTreadTex.repeat.set(4, 1);

  // 7. SONIC cabinet badge & LIQUI MOLY carton texture
  const sc = makeCanvas(256, 64);
  const sctx = sc.getContext('2d');
  sctx.fillStyle = '#15171a';
  sctx.fillRect(0, 0, 256, 64);
  sctx.fillStyle = '#e4e8ee';
  sctx.font = 'bold 44px Arial, Helvetica, sans-serif';
  sctx.textAlign = 'center';
  sctx.textBaseline = 'middle';
  sctx.fillText('SONIC', 128, 34);
  const sonicTex = new THREE.CanvasTexture(sc);
  sonicTex.colorSpace = THREE.SRGBColorSpace;

  const lc = makeCanvas(256, 192);
  const lctx = lc.getContext('2d');
  lctx.fillStyle = '#dcdad2';
  lctx.fillRect(0, 0, 256, 192);
  lctx.fillStyle = '#194794';
  lctx.fillRect(46, 36, 164, 58);
  lctx.fillStyle = '#d42222';
  lctx.fillRect(46, 94, 164, 58);
  lctx.fillStyle = '#ffffff';
  lctx.font = 'bold 34px Impact, Arial, sans-serif';
  lctx.textAlign = 'center';
  lctx.fillText('LIQUI', 128, 78);
  lctx.fillText('MOLY', 128, 136);
  const liquiMolyTex = new THREE.CanvasTexture(lc);
  liquiMolyTex.colorSpace = THREE.SRGBColorSpace;

  return {
    headlightTex,
    roundelTex,
    mBadgeTex,
    taillightTex,
    clusterTex,
    tireTreadTex,
    sonicTex,
    liquiMolyTex,
  };
}
