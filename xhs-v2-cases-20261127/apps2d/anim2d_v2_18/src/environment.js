import { WORLD as W, TAU, clamp, lerp, mod, seeded, hexMix, path, line, circle, glow } from './utils.js';

const rng = seeded(18051896);
const cloudLayers = [[], [], [], []];
for (let layer = 0; layer < 4; layer++) {
  const count = [8, 8, 7, 6][layer];
  for (let i = 0; i < count; i++) {
    const lobes = [];
    const n = 5 + Math.floor(rng() * 5);
    for (let k = 0; k < n; k++) lobes.push({ x: k / (n - 1), y: rng(), r: .65 + rng() * .65 });
    cloudLayers[layer].push({
      x: -150 + i * (1500 / count) + rng() * 110,
      y: [-12, 70, 150, 228][layer] + rng() * 68,
      w: (180 + rng() * 185) * (1 + layer * .09),
      h: 42 + rng() * 53,
      seed: rng() * TAU, lobes,
    });
  }
}
const stars = Array.from({ length: 94 }, () => ({
  a: rng() * Math.PI * 1.05 + Math.PI * .97,
  r: 90 + rng() * 650,
  size: .35 + rng() * 1.15,
  arc: rng() > .38,
  alpha: .18 + rng() * .6,
}));
const rain = Array.from({ length: 260 }, () => ({
  x: rng() * 1450 - 100, offset: rng(), cycle: rng() > .55 ? 3 : 2,
  length: 12 + rng() * 31, alpha: .08 + rng() * .28, width: .35 + rng() * .75,
}));
const foamSeeds = Array.from({ length: 84 }, () => ({ x: rng() * 1350 - 70, width: 18 + rng() * 67, offset: rng(), z: rng() }));

export function waveY(x, layer, t, storm) {
  const p = t / 8 * TAU;
  if (layer === 0) return 365 + Math.sin(x / 165 * TAU + p + x * .0006) * (1.7 + storm * 3.3) + Math.sin(x / 64 * TAU - p * 2) * storm * 1.3;
  if (layer === 1) return 431 + Math.sin(x / 210 * TAU - p + 1.9) * (3.5 + storm * 9.5) + Math.sin(x / 74 * TAU + p * 2 + .8) * storm * 3.4;
  return 555 + Math.sin(x / 288 * TAU + p + 2.4) * (6 + storm * 19) + Math.sin(x / 103 * TAU - p * 2 + .4) * (2 + storm * 7);
}

function cloudPath(ctx, c, dx, dy) {
  const x = c.x + dx, y = c.y + dy, w = c.w, h = c.h;
  ctx.beginPath();
  ctx.moveTo(x, y + h * .69);
  const n = c.lobes.length;
  for (let i = 0; i < n; i++) {
    const l = c.lobes[i];
    const lx = x + l.x * w;
    const ly = y + h * (.64 - l.y * .49);
    const next = c.lobes[i + 1];
    if (!next) {
      ctx.quadraticCurveTo(x + w + h * .07, y + h * .59, x + w * .93, y + h * .82);
    } else {
      const nx = x + next.x * w;
      ctx.bezierCurveTo(lx - w / n * .5, ly - h * .25 * l.r, lx + w / n * .2, ly - h * .45 * l.r, nx, y + h * (.62 - next.y * .49));
    }
  }
  for (let i = 6; i >= 0; i--) {
    const bx = x + w * i / 6;
    ctx.quadraticCurveTo(bx - w * .06, y + h * (1.02 + .08 * Math.sin(i * 2 + c.seed)), bx - w / 6, y + h * (.85 + .07 * Math.cos(i + c.seed)));
  }
  ctx.closePath();
}

export function drawSky(ctx, scene) {
  const { day, storm, t } = scene;
  const p = t / 8 * TAU;
  const sky = ctx.createLinearGradient(0, 0, 0, W.horizon + 20);
  sky.addColorStop(0, hexMix('#101e38', '#5686a3', day));
  sky.addColorStop(.42, hexMix('#2d4770', '#7eabc0', day));
  sky.addColorStop(.72, hexMix('#72557e', '#d0b9b1', day));
  sky.addColorStop(.91, hexMix('#db826f', '#f7c493', day));
  sky.addColorStop(1, hexMix('#f0a16d', '#fbe1aa', day));
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W.width, W.horizon + 30);

  const sunset = ctx.createRadialGradient(560, 361, 5, 560, 361, 570);
  sunset.addColorStop(0, `rgba(255,179,106,${.2 + day * .25})`);
  sunset.addColorStop(.5, `rgba(196,101,122,${.08 + day * .08})`);
  sunset.addColorStop(1, 'rgba(32,44,84,0)');
  ctx.fillStyle = sunset; ctx.fillRect(0, 0, W.width, 450);

  const starAlpha = Math.pow(1 - day, 1.8) * (1 - storm * .28);
  if (starAlpha > .01) {
    ctx.save();
    for (const s of stars) {
      const cx = 415, cy = 68;
      const a = s.a + Math.sin(p) * .017;
      const x = cx + Math.cos(a) * s.r * 1.4;
      const y = cy + Math.sin(a) * s.r * .46;
      if (y < -10 || y > 295 || x < 0 || x > 1200) continue;
      if (s.arc) {
        ctx.beginPath(); ctx.ellipse(cx, cy, s.r * 1.4, s.r * .46, 0, a - .014, a + .002);
        ctx.strokeStyle = `rgba(172,207,231,${s.alpha * starAlpha * .42})`; ctx.lineWidth = s.size * .55; ctx.stroke();
      }
      circle(ctx, x, y, s.size * .6, `rgba(219,237,242,${s.alpha * starAlpha})`);
    }
    ctx.restore();
  }

  // Fine horizon strata silhouettes, barely visible behind the rain.
  ctx.fillStyle = hexMix('#323457', '#8b8f93', day);
  path(ctx, [[0, 345], [70, 337], [154, 342], [218, 333], [290, 342], [400, 339], [514, 348], [620, 338], [751, 345], [884, 340], [1014, 348], [1200, 337], [1200, 365], [0, 365]]); ctx.fill();

  const nightColors = ['#243654', '#1d2e4d', '#192942', '#132237'];
  const dayColors = ['#738a99', '#667b8d', '#536a7d', '#40586e'];
  for (let layer = 0; layer < 4; layer++) {
    const alpha = [.45, .73, .89, .98][layer] * (.63 + storm * .37) * (1 - day * .28);
    for (const c of cloudLayers[layer]) {
      const dx = Math.sin(p + c.seed) * (6 + layer * 4) - storm * layer * 5;
      const dy = Math.cos(p + c.seed) * 2 + (1 - storm) * (20 + layer * 8);
      cloudPath(ctx, c, dx, dy);
      ctx.fillStyle = hexMix(nightColors[layer], dayColors[layer], day);
      ctx.globalAlpha = alpha * (.77 + storm * .23); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = hexMix('#16263e', '#4e6576', day); ctx.lineWidth = 2; ctx.stroke();
      ctx.save(); cloudPath(ctx, c, dx, dy + 3); ctx.clip();
      const shade = ctx.createLinearGradient(0, c.y, 0, c.y + c.h * 1.1);
      shade.addColorStop(0, 'rgba(104,132,163,.08)'); shade.addColorStop(1, `rgba(4,15,32,${.22 + storm * .2})`);
      ctx.fillStyle = shade; ctx.fillRect(c.x + dx - 5, c.y + dy - 10, c.w + 20, c.h + 30); ctx.restore();
    }
  }
  // Long pen-and-ink wind filaments retain the illustrated rather than photographic finish.
  ctx.save(); ctx.globalAlpha = .13 + storm * .13;
  for (let i = 0; i < 15; i++) {
    const y = 20 + i * 16;
    ctx.beginPath(); ctx.moveTo(35 + i * 12, y + 38);
    ctx.bezierCurveTo(190, y - 10, 378 + i * 5, y - 28, 535 + i * 7, y - 51);
    ctx.strokeStyle = '#a2b7ce'; ctx.lineWidth = .7; ctx.stroke();
  }
  ctx.restore();
}

export function drawOceanBase(ctx, scene) {
  const { day } = scene;
  const g = ctx.createLinearGradient(0, W.horizon, 0, W.height);
  g.addColorStop(0, hexMix('#252d60', '#6295a7', day));
  g.addColorStop(.18, hexMix('#223e61', '#477b91', day));
  g.addColorStop(.52, hexMix('#17465f', '#2f7285', day));
  g.addColorStop(1, hexMix('#0b2d42', '#205967', day));
  ctx.fillStyle = g; ctx.fillRect(0, W.horizon, W.width, W.height - W.horizon);
  line(ctx, 0, 355, 1200, 355, hexMix('#9d7490', '#f4cca5', day), 1);
  ctx.save();
  for (let i = 0; i < 33; i++) {
    const y = 361 + i * i * .37;
    const x = mod(i * 173.7, 1200);
    const len = 30 + (i * 31 % 125);
    line(ctx, x - len, y, x + len, y + Math.sin(i) * 2, `rgba(132,187,201,${.07 + (i % 3) * .025})`, .6 + i * .015);
  }
  ctx.restore();
}

export function drawWaveLayer(ctx, scene, layer) {
  const { t, storm, day } = scene;
  const points = [];
  for (let x = -30; x <= 1230; x += 7) points.push([x, waveY(x, layer, t, storm)]);
  const top = waveY(0, layer, t, storm);
  const g = ctx.createLinearGradient(0, top, 0, 760);
  if (layer === 0) {
    g.addColorStop(0, hexMix('#315673', '#689aa8', day)); g.addColorStop(1, hexMix('#173d58', '#357384', day));
  } else if (layer === 1) {
    g.addColorStop(0, hexMix('#2a5c74', '#4a8a9a', day)); g.addColorStop(.65, hexMix('#17435c', '#2e6c7b', day)); g.addColorStop(1, '#14394e');
  } else {
    g.addColorStop(0, hexMix('#20546d', '#3a7b89', day)); g.addColorStop(.5, hexMix('#123e56', '#255c6a', day)); g.addColorStop(1, '#0b293d');
  }
  path(ctx, [...points, [1230, 780], [-30, 780]]); ctx.fillStyle = g; ctx.fill();
  strokeWatercolor(ctx, points, layer, storm, day, t);
  drawCrestFoam(ctx, scene, layer);
}

function drawCrestFoam(ctx, scene, layer) {
  const { t, storm } = scene;
  if (storm < .035 || layer === 0) return;
  const p = t / 8 * TAU;
  const waveLength = layer === 2 ? 288 : 210;
  const direction = layer === 2 ? 1 : -1;
  const offset = layer === 2 ? 2.4 : 1.9;
  const first = ((Math.PI / 2 - direction * p - offset) / TAU) * waveLength;
  ctx.save(); ctx.lineJoin = 'round';
  for (let n = -1; n < 6; n++) {
    const center = first + n * waveLength;
    const half = (layer === 2 ? 27 : 18) + storm * (layer === 2 ? 34 : 19);
    if (center + half < -20 || center - half > 1220) continue;
    const upper = [], lower = [];
    for (let x = center - half; x <= center + half; x += 5) {
      const q = (x - center + half) / (half * 2);
      const crown = Math.sin(q * Math.PI);
      upper.push([x, waveY(x, layer, t, storm) - 1.8 - crown * storm * 3]);
      lower.push([x, waveY(x, layer, t, storm) + (3 + storm * 10) * crown + Math.sin(q * 27 + p * 2) * 2.3 * storm]);
    }
    const foam = ctx.createLinearGradient(0, waveY(center, layer, t, storm) - 8, 0, waveY(center, layer, t, storm) + 23);
    foam.addColorStop(0, `rgba(225,246,239,${(.28 + storm * .6) * (layer === 2 ? 1 : .63)})`);
    foam.addColorStop(.35, `rgba(181,229,229,${(.12 + storm * .38) * (layer === 2 ? 1 : .65)})`);
    foam.addColorStop(1, 'rgba(104,188,204,0)');
    path(ctx, [...upper, ...lower.reverse()]); ctx.fillStyle = foam; ctx.fill();
    strokePathOpen(ctx, upper, `rgba(222,246,238,${.27 + storm * .56})`, .8 + storm * (layer === 2 ? 2.1 : 1));
    if (layer === 2) {
      for (let k = 0; k < 8; k++) {
        const a = k * 2.39 + n;
        const x = center + Math.sin(a) * half * .8;
        const y = waveY(x, layer, t, storm) - 3 - Math.abs(Math.sin(a + p * 2)) * storm * 13;
        circle(ctx, x, y, .65 + (k % 3) * storm * .7, `rgba(211,242,237,${storm * .58})`);
      }
    }
  }
  ctx.restore();
}

function strokePathOpen(ctx, points, color, width) {
  ctx.beginPath(); points.forEach((q, i) => i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]));
  ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke();
}

function strokeWatercolor(ctx, points, layer, storm, day, t) {
  ctx.save();
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  const p = t / 8;
  const stride = layer === 2 ? 1 : 2;
  for (let i = 0; i < foamSeeds.length; i++) {
    const f = foamSeeds[i];
    if ((i % 3) !== (2 - layer)) continue;
    const flow = mod(f.offset + p * (layer === 0 ? 1 : 2), 1);
    const x = f.x + Math.sin(flow * TAU) * 12;
    const width = f.width * (.6 + storm * .55);
    const seg = [];
    for (let xx = x; xx < x + width; xx += 5) {
      if (xx < -10 || xx > 1210) continue;
      seg.push([xx, waveY(xx, layer, t, storm) - 1.5 - Math.sin((xx - x) / width * Math.PI) * (1 + f.z * 2)]);
    }
    if (seg.length < 2) continue;
    ctx.beginPath(); seg.forEach((q, j) => j ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]));
    const alpha = (.16 + storm * .32) * (layer === 2 ? 1.25 : .8);
    ctx.strokeStyle = `rgba(${day > .5 ? '211,235,226' : '184,226,232'},${alpha})`;
    ctx.lineWidth = (.65 + f.z * 1.3 + storm * (layer === 2 ? 1.35 : .65)); ctx.stroke();
    if (layer > 0 && storm > .2 && f.z > .47) {
      const crest = seg[Math.floor(seg.length * .55)];
      const rr = .7 + f.z * 2 * storm;
      circle(ctx, crest[0] + 3, crest[1] - 4 - f.z * 6 * storm, rr, `rgba(207,239,237,${storm * .48})`);
      circle(ctx, crest[0] + 8 + f.z * 6, crest[1] - 1, rr * .55, `rgba(203,237,237,${storm * .34})`);
    }
  }
  // Parallel ink strokes give each swell a sculpted volume.
  for (let k = 0; k < (layer === 2 ? 11 : 6); k++) {
    const x = 25 + k * 117 + layer * 43;
    const pts = [];
    for (let xx = x; xx < x + 76; xx += 6) pts.push([xx, waveY(xx, layer, t, storm) + 10 + k % 3 * 6]);
    ctx.beginPath(); pts.forEach((q, j) => j ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]));
    ctx.strokeStyle = 'rgba(127,194,207,.16)'; ctx.lineWidth = .8; ctx.stroke();
  }
  ctx.restore();
}

export function drawLightOnSea(ctx, scene, optics) {
  const { day, t, storm } = scene;
  const { impact, strength } = optics;
  const power = strength * (1 - day * .68);
  if (power < .015) return;
  ctx.save(); ctx.globalCompositeOperation = 'screen';
  const radius = 90 + storm * 28;
  const g = ctx.createRadialGradient(impact.x, impact.y, 3, impact.x, impact.y, radius);
  g.addColorStop(0, `rgba(127,239,239,${.36 * power})`);
  g.addColorStop(.35, `rgba(67,197,210,${.24 * power})`); g.addColorStop(1, 'rgba(29,133,161,0)');
  ctx.save(); ctx.translate(impact.x, impact.y); ctx.scale(1.8, .48); ctx.translate(-impact.x, -impact.y);
  ctx.fillStyle = g; ctx.fillRect(impact.x - radius, impact.y - radius, radius * 2, radius * 2); ctx.restore();
  for (let i = 0; i < 18; i++) {
    const q = i / 18;
    const y = impact.y + q * 140;
    const spread = 7 + q * (48 + storm * 20);
    const x = impact.x + Math.sin(i * 2.13 + t / 8 * TAU * 2) * (4 + q * 12);
    const len = spread * (.35 + .65 * Math.abs(Math.sin(i * 3.77 + t / 8 * TAU)));
    line(ctx, x - len, y, x + len, y + .6, `rgba(149,242,234,${power * (1 - q) * .33})`, .7 + (1 - q) * 1.2);
  }
  ctx.restore();
}

export function drawRain(ctx, scene, front = true) {
  const { t, storm, day } = scene;
  const count = Math.floor(18 + storm * (front ? 205 : 100));
  const slant = 25 + storm * 145;
  ctx.save(); ctx.lineCap = 'round';
  for (let i = 0; i < count; i++) {
    const r = rain[(i + (front ? 0 : 91)) % rain.length];
    if (front && i % 3 === 0) continue;
    const q = mod(r.offset + t / 8 * r.cycle, 1);
    const y = q * 900 - 70;
    const x = r.x - q * slant + (front ? 0 : 40);
    const len = r.length * (.45 + storm * .85);
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - slant / 900 * len, y - len);
    ctx.strokeStyle = `rgba(${day > .5 ? '212,231,230' : '167,196,216'},${r.alpha * (.24 + storm * .76) * (front ? .85 : .55)})`;
    ctx.lineWidth = r.width; ctx.stroke();
  }
  ctx.restore();
}

export function drawSeaMist(ctx, scene) {
  const mist = ctx.createLinearGradient(0, 327, 0, 424);
  mist.addColorStop(0, 'rgba(174,147,163,0)'); mist.addColorStop(.5, `rgba(134,163,178,${.045 + scene.storm * .025})`); mist.addColorStop(1, 'rgba(94,134,158,0)');
  ctx.fillStyle = mist; ctx.fillRect(0, 327, 1200, 105);
}
