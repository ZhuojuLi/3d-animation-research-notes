import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';

// -----------------------------------------------------------------------------
// Core
// -----------------------------------------------------------------------------
const appEl = document.getElementById('app');
const loaderEl = document.getElementById('loader');

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x262c2c);
scene.fog = new THREE.Fog(0x8e9694, 17, 34);

const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.08, 80);
const DEFAULT_CAMERA = new THREE.Vector3(3.9, 1.62, 3.55);
const DEFAULT_TARGET = new THREE.Vector3(1.14, 0.92, -0.52);
camera.position.copy(DEFAULT_CAMERA);

const renderer = new THREE.WebGLRenderer({
  antialias: true,
  powerPreference: 'high-performance',
  preserveDrawingBuffer: true,
  stencil: false
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.04;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.shadowMap.bias = -0.0004;
renderer.info.autoReset = false;
appEl.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.copy(DEFAULT_TARGET);
controls.enableDamping = true;
controls.dampingFactor = 0.055;
controls.minDistance = 1.35;
controls.maxDistance = 16;
controls.maxPolarAngle = Math.PI * 0.505;
controls.minPolarAngle = Math.PI * 0.08;
controls.enablePan = true;
controls.screenSpacePanning = false;
controls.zoomSpeed = 0.72;
controls.rotateSpeed = 0.52;
controls.panSpeed = 0.55;
controls.update();

RectAreaLightUniformsLib.init();

const maxAniso = renderer.capabilities.getMaxAnisotropy();

// -----------------------------------------------------------------------------
// Utilities
// -----------------------------------------------------------------------------
const TAU = Math.PI * 2;
const DEG = Math.PI / 180;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smoothstep = (t) => t * t * (3 - 2 * t);

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
const rng = mulberry32(19900312);

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function canvasTexture(canvas, { srgb = true, repeat = null, aniso = 8, flipY = true } = {}) {
  const tex = new THREE.CanvasTexture(canvas);
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = Math.min(aniso, maxAniso);
  tex.flipY = flipY;
  if (repeat) {
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeat[0], repeat[1]);
  }
  tex.needsUpdate = true;
  return tex;
}

function addBox(parent, size, pos, material, { rot = null, cast = true, receive = true, name = '' } = {}) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(size[0], size[1], size[2]), material);
  mesh.position.set(pos[0], pos[1], pos[2]);
  if (rot) mesh.rotation.set(rot[0], rot[1], rot[2]);
  mesh.castShadow = cast;
  mesh.receiveShadow = receive;
  if (name) mesh.name = name;
  parent.add(mesh);
  return mesh;
}

function addRounded(parent, size, radius, pos, material, { seg = 3, rot = null, cast = true, receive = true, name = '' } = {}) {
  const geo = new RoundedBoxGeometry(size[0], size[1], size[2], seg, radius);
  const mesh = new THREE.Mesh(geo, material);
  mesh.position.set(pos[0], pos[1], pos[2]);
  if (rot) mesh.rotation.set(rot[0], rot[1], rot[2]);
  mesh.castShadow = cast;
  mesh.receiveShadow = receive;
  if (name) mesh.name = name;
  parent.add(mesh);
  return mesh;
}

function addCylinder(parent, rTop, rBottom, h, radial, pos, material, { rot = null, cast = true, receive = true, open = false } = {}) {
  const geo = new THREE.CylinderGeometry(rTop, rBottom, h, radial, 1, open);
  const mesh = new THREE.Mesh(geo, material);
  mesh.position.set(pos[0], pos[1], pos[2]);
  if (rot) mesh.rotation.set(rot[0], rot[1], rot[2]);
  mesh.castShadow = cast;
  mesh.receiveShadow = receive;
  parent.add(mesh);
  return mesh;
}

function addTorus(parent, radius, tube, radial, tubular, pos, material, { rot = null, arc = TAU, cast = true, receive = true } = {}) {
  const geo = new THREE.TorusGeometry(radius, tube, radial, tubular, arc);
  const mesh = new THREE.Mesh(geo, material);
  mesh.position.set(pos[0], pos[1], pos[2]);
  if (rot) mesh.rotation.set(rot[0], rot[1], rot[2]);
  mesh.castShadow = cast;
  mesh.receiveShadow = receive;
  parent.add(mesh);
  return mesh;
}

function addPlane(parent, w, h, pos, material, { rot = null, receive = true, name = '' } = {}) {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), material);
  mesh.position.set(pos[0], pos[1], pos[2]);
  if (rot) mesh.rotation.set(rot[0], rot[1], rot[2]);
  mesh.receiveShadow = receive;
  if (name) mesh.name = name;
  parent.add(mesh);
  return mesh;
}

function roundedRectPath(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w * 0.5, h * 0.5);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  ctx.lineTo(x + rr, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
  ctx.lineTo(x, y + rr);
  ctx.quadraticCurveTo(x, y, x + rr, y);
  ctx.closePath();
}

function drawRoundel(ctx, cx, cy, r) {
  ctx.save();
  ctx.translate(cx, cy);
  // outer black ring
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, TAU);
  ctx.fillStyle = '#121416';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.87, 0, TAU);
  ctx.fillStyle = '#f1f2ed';
  ctx.fill();
  // quadrants
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.arc(0, 0, r * 0.86, -Math.PI / 2, 0);
  ctx.closePath();
  ctx.fillStyle = '#3b9ed1';
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.arc(0, 0, r * 0.86, Math.PI / 2, Math.PI);
  ctx.closePath();
  ctx.fillStyle = '#3b9ed1';
  ctx.fill();
  ctx.strokeStyle = 'rgba(10,16,20,.7)';
  ctx.lineWidth = Math.max(1, r * 0.035);
  ctx.beginPath(); ctx.arc(0, 0, r * 0.86, 0, TAU); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-r * 0.87, 0); ctx.lineTo(r * 0.87, 0); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, -r * 0.87); ctx.lineTo(0, r * 0.87); ctx.stroke();
  // BMW lettering ring
  ctx.fillStyle = '#111417';
  ctx.font = `700 ${Math.max(5, r * 0.28)}px "GarageSans", Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('BMW', 0, -r * 0.66);
  ctx.restore();
}

function labelTexture(w, h, draw, opts = {}) {
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  draw(ctx, w, h);
  return canvasTexture(c, { aniso: 8, ...opts });
}

function textPanel(text, opts = {}) {
  const {
    w = 512, h = 128, bg = 'transparent', fg = '#e9ece9',
    font = '700 64px "GarageSans", Arial, sans-serif',
    align = 'center', letterSpacing = null, sub = null, subFont = '500 22px "GarageMono", monospace'
  } = opts;
  return labelTexture(w, h, (ctx) => {
    ctx.clearRect(0, 0, w, h);
    if (bg !== 'transparent') {
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);
    }
    ctx.fillStyle = fg;
    ctx.font = font;
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    if (letterSpacing && ctx.letterSpacing !== undefined) ctx.letterSpacing = letterSpacing;
    ctx.fillText(text, align === 'center' ? w / 2 : 18, sub ? h * 0.42 : h / 2);
    if (sub) {
      ctx.font = subFont;
      ctx.fillStyle = fg;
      ctx.globalAlpha = 0.62;
      ctx.fillText(sub, align === 'center' ? w / 2 : 18, h * 0.72);
      ctx.globalAlpha = 1;
    }
  });
}

function beamBetween(p1, p2, width, depth, material, parent, up = new THREE.Vector3(0, 1, 0)) {
  const a = new THREE.Vector3(...p1);
  const b = new THREE.Vector3(...p2);
  const dir = b.clone().sub(a);
  const len = dir.length();
  const geo = new THREE.BoxGeometry(width, len, depth);
  const mesh = new THREE.Mesh(geo, material);
  mesh.position.copy(a).add(b).multiplyScalar(0.5);
  const q = new THREE.Quaternion().setFromUnitVectors(up, dir.clone().normalize());
  mesh.quaternion.copy(q);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function tube(parent, points, radius, material, tubular = 30, radial = 6) {
  const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)));
  const geo = new THREE.TubeGeometry(curve, tubular, radius, radial, false);
  const mesh = new THREE.Mesh(geo, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function cloneWheelArray(group, n, fn) {
  for (let i = 0; i < n; i++) group.add(fn(i));
}

// -----------------------------------------------------------------------------
// Procedural textures
// -----------------------------------------------------------------------------
function createConcreteFloorTexture() {
  const S = 2048;
  const c = makeCanvas(S, S);
  const ctx = c.getContext('2d');
  const r = mulberry32(778811);
  ctx.fillStyle = '#77746c';
  ctx.fillRect(0, 0, S, S);

  // Large, slow mottling in the slab.
  for (let i = 0; i < 260; i++) {
    const x = r() * S;
    const y = r() * S;
    const rad = 70 + r() * 460;
    const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
    const warm = r() > 0.5;
    g.addColorStop(0, warm ? `rgba(164,152,130,${0.018 + r() * 0.055})` : `rgba(43,49,48,${0.015 + r() * 0.05})`);
    g.addColorStop(0.55, warm ? `rgba(123,119,107,${0.014 + r() * 0.03})` : `rgba(76,83,81,${0.012 + r() * 0.03})`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }

  // Aggregate and pitting.
  for (let i = 0; i < 24000; i++) {
    const x = r() * S;
    const y = r() * S;
    const rad = r() < 0.9 ? 0.4 + r() * 2.4 : 2.5 + r() * 7;
    const light = r() > 0.46;
    ctx.fillStyle = light
      ? `rgba(${168 + (r() * 35) | 0},${160 + (r() * 30) | 0},${146 + (r() * 30) | 0},${0.035 + r() * 0.16})`
      : `rgba(${30 + (r() * 25) | 0},${31 + (r() * 25) | 0},${28 + (r() * 22) | 0},${0.035 + r() * 0.15})`;
    ctx.beginPath();
    ctx.ellipse(x, y, rad, rad * (0.6 + r() * 0.7), r() * TAU, 0, TAU);
    ctx.fill();
  }

  // Darker, worn traffic path across the bay.
  ctx.save();
  ctx.globalAlpha = 0.12;
  ctx.strokeStyle = '#252723';
  ctx.lineWidth = 240;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(260, 1550);
  ctx.bezierCurveTo(700, 1430, 1110, 1420, 1830, 1170);
  ctx.stroke();
  ctx.restore();

  // Oil and solvent stains.
  function stain(cx, cy, rx, ry, opacity, seed) {
    const rr = mulberry32(seed);
    ctx.save();
    for (let i = 0; i < 18; i++) {
      const ox = (rr() - 0.5) * rx * 1.5;
      const oy = (rr() - 0.5) * ry * 1.4;
      const a = 0.03 + rr() * opacity;
      const g = ctx.createRadialGradient(cx + ox, cy + oy, 2, cx + ox, cy + oy, rx * (0.22 + rr() * 0.5));
      g.addColorStop(0, `rgba(12,13,11,${a})`);
      g.addColorStop(0.63, `rgba(18,18,15,${a * 0.6})`);
      g.addColorStop(1, 'rgba(20,20,16,0)');
      ctx.fillStyle = g;
      ctx.fillRect(cx - rx * 2, cy - ry * 2, rx * 4, ry * 4);
    }
    // faint rainbow edge from solvent
    ctx.globalAlpha = 0.04;
    ctx.strokeStyle = '#8a9480';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(cx + rx * 0.1, cy, rx * 0.7, ry * 0.7, -0.2, 0.4, 4.6);
    ctx.stroke();
    ctx.restore();
  }
  stain(940, 1320, 130, 74, 0.19, 88);
  stain(1500, 1640, 210, 110, 0.13, 125);
  stain(480, 980, 75, 45, 0.16, 72);
  stain(1600, 740, 100, 55, 0.11, 221);
  stain(1050, 1810, 180, 80, 0.12, 546);
  stain(720, 1620, 58, 30, 0.1, 16);

  // Fine spatter around stains.
  for (let k = 0; k < 2500; k++) {
    const x = 900 + (r() - 0.5) * 700;
    const y = 1350 + (r() - 0.5) * 520;
    if (r() > 0.55) continue;
    ctx.fillStyle = `rgba(20,20,16,${0.03 + r() * 0.15})`;
    ctx.beginPath();
    ctx.arc(x, y, 0.5 + r() * 3.5, 0, TAU);
    ctx.fill();
  }

  // Chalk / paint scuffs.
  ctx.save();
  ctx.globalAlpha = 0.11;
  ctx.strokeStyle = '#ded7c0';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(280, 1220); ctx.lineTo(360, 1255); ctx.lineTo(310, 1292);
  ctx.stroke();
  ctx.globalAlpha = 0.08;
  ctx.strokeStyle = '#d8d2c5';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(1380, 1450); ctx.bezierCurveTo(1420, 1390, 1370, 1360, 1450, 1330);
  ctx.stroke();
  ctx.restore();

  // Slab expansion joints.
  function joint(x1, y1, x2, y2) {
    ctx.save();
    ctx.strokeStyle = 'rgba(30,30,26,.52)';
    ctx.lineWidth = 3.5;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    ctx.strokeStyle = 'rgba(205,197,180,.16)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x1 + 3, y1 + 1); ctx.lineTo(x2 + 3, y2 + 1); ctx.stroke();
    ctx.restore();
  }
  joint(0, 905, S, 890);
  joint(815, 0, 795, S);
  joint(1460, 0, 1490, S);

  // Cracks, branching from a few origins.
  function crack(x, y, ang, len, width, depth) {
    if (depth <= 0 || len < 4) return;
    let px = x, py = y, a = ang;
    ctx.strokeStyle = `rgba(32,31,27,${0.24 + r() * 0.2})`;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(px, py);
    const steps = 8 + (r() * 12) | 0;
    for (let i = 0; i < steps; i++) {
      a += (r() - 0.5) * 0.65;
      px += Math.cos(a) * (len / steps);
      py += Math.sin(a) * (len / steps);
      ctx.lineTo(px, py);
    }
    ctx.stroke();
    if (r() > 0.52) crack(px, py, a + (r() - 0.5) * 1.6, len * 0.55, width * 0.7, depth - 1);
    if (r() > 0.7) crack(x + Math.cos(a) * len * 0.5, y + Math.sin(a) * len * 0.5, a + 1.2, len * 0.35, width * 0.55, depth - 1);
  }
  crack(1330, 1180, 2.3, 200, 1.7, 3);
  crack(420, 1570, -0.5, 150, 1.3, 2);
  crack(1780, 980, 2.9, 120, 1.1, 2);
  crack(620, 820, 0.7, 95, 1.0, 2);

  // Worn yellow walkway stripe far back.
  ctx.save();
  ctx.globalAlpha = 0.15;
  ctx.fillStyle = '#c4a84d';
  ctx.fillRect(0, 748, S, 22);
  for (let i = 0; i < 80; i++) {
    ctx.clearRect(r() * S, 748 + r() * 22, 8 + r() * 42, 2 + r() * 5);
  }
  ctx.restore();

  return canvasTexture(c, { repeat: null, aniso: 16 });
}

function createFloorRoughness() {
  const S = 1024;
  const c = makeCanvas(S, S);
  const ctx = c.getContext('2d');
  const r = mulberry32(9231);
  ctx.fillStyle = '#a9a9a9';
  ctx.fillRect(0, 0, S, S);
  for (let i = 0; i < 180; i++) {
    const x = r() * S, y = r() * S, rad = 8 + r() * 120;
    const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
    if (r() > 0.5) {
      g.addColorStop(0, `rgba(80,80,80,${0.05 + r() * 0.2})`);
    } else {
      g.addColorStop(0, `rgba(205,205,205,${0.04 + r() * 0.16})`);
    }
    g.addColorStop(1, 'rgba(160,160,160,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  // Oil = smoother / more reflective
  const stains = [[470, 660, 80, 48], [750, 665, 72, 36], [800, 830, 100, 52], [330, 450, 40, 28]];
  ctx.globalCompositeOperation = 'multiply';
  for (const [x, y, rx, ry] of stains) {
    for (let k = 0; k < 6; k++) {
      const g = ctx.createRadialGradient(x + (r() - .5) * rx, y + (r() - .5) * ry, 1, x, y, rx);
      g.addColorStop(0, 'rgba(52,52,52,.7)');
      g.addColorStop(1, 'rgba(110,110,110,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.ellipse(x, y, rx * .9, ry * .9, .2, 0, TAU); ctx.fill();
    }
  }
  ctx.globalCompositeOperation = 'source-over';
  // Grain
  for (let i = 0; i < 6500; i++) {
    const x = r() * S, y = r() * S;
    ctx.fillStyle = `rgba(${r() > .5 ? 220 : 30},${r() > .5 ? 220 : 30},${r() > .5 ? 220 : 30},${r() * .07})`;
    ctx.fillRect(x, y, 1 + r() * 2, 1 + r() * 2);
  }
  return canvasTexture(c, { srgb: false, aniso: 16 });
}

function createWallTexture() {
  const S = 1024;
  const c = makeCanvas(S, S);
  const ctx = c.getContext('2d');
  const r = mulberry32(45672);
  ctx.fillStyle = '#b9b3a6';
  ctx.fillRect(0, 0, S, S);
  for (let i = 0; i < 190; i++) {
    const x = r() * S, y = r() * S, rad = 30 + r() * 240;
    const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
    const dark = r() > 0.48;
    g.addColorStop(0, dark ? `rgba(73,74,67,${0.012 + r() * 0.055})` : `rgba(236,230,212,${0.015 + r() * 0.05})`);
    g.addColorStop(1, 'rgba(160,155,144,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  // Fine plaster grain and pinholes
  for (let i = 0; i < 11000; i++) {
    const x = r() * S, y = r() * S;
    const light = r() > 0.5;
    ctx.fillStyle = light ? `rgba(232,226,211,${r() * 0.12})` : `rgba(70,70,62,${r() * 0.1})`;
    ctx.beginPath(); ctx.arc(x, y, .4 + r() * 1.5, 0, TAU); ctx.fill();
  }
  // Sooty top band
  const topGrad = ctx.createLinearGradient(0, 0, 0, 280);
  topGrad.addColorStop(0, 'rgba(43,45,41,.19)');
  topGrad.addColorStop(1, 'rgba(43,45,41,0)');
  ctx.fillStyle = topGrad;
  ctx.fillRect(0, 0, S, 280);
  // Dampage / run marks
  for (let i = 0; i < 18; i++) {
    const x = r() * S;
    const w = 2 + r() * 17;
    const grad = ctx.createLinearGradient(0, 0, 0, S);
    grad.addColorStop(0, 'rgba(75,67,53,.0)');
    grad.addColorStop(0.2, `rgba(75,67,53,${0.03 + r() * 0.05})`);
    grad.addColorStop(1, 'rgba(75,67,53,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(x, 0, w, S);
  }
  // Hairline crack
  ctx.strokeStyle = 'rgba(80,74,64,.19)';
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.moveTo(170, 0);
  ctx.bezierCurveTo(190, 200, 110, 370, 160, 580);
  ctx.bezierCurveTo(190, 720, 150, 850, 180, 1024);
  ctx.stroke();
  ctx.restore?.();
  return canvasTexture(c, { aniso: 8 });
}

function createOutsideTexture() {
  const w = 2048, h = 1024;
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  const r = mulberry32(33112);

  // Bright, slightly blown-out daylight sky
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#cfe3ed');
  sky.addColorStop(0.28, '#e7f0ef');
  sky.addColorStop(0.62, '#f3f1e3');
  sky.addColorStop(1, '#dad6c4');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  // Sun bloom at upper right / center
  const sun = ctx.createRadialGradient(w * 0.72, h * 0.12, 0, w * 0.72, h * 0.12, h * 0.85);
  sun.addColorStop(0, 'rgba(255,253,235,.92)');
  sun.addColorStop(.18, 'rgba(255,246,211,.42)');
  sun.addColorStop(.55, 'rgba(255,244,212,.12)');
  sun.addColorStop(1, 'rgba(255,244,212,0)');
  ctx.fillStyle = sun;
  ctx.fillRect(0, 0, w, h);

  // Distant buildings / rooflines
  ctx.fillStyle = 'rgba(157,161,151,.46)';
  ctx.beginPath();
  ctx.moveTo(0, h * .6);
  ctx.lineTo(w * .09, h * .54);
  ctx.lineTo(w * .16, h * .6);
  ctx.lineTo(w * .25, h * .5);
  ctx.lineTo(w * .34, h * .56);
  ctx.lineTo(w * .48, h * .49);
  ctx.lineTo(w * .58, h * .56);
  ctx.lineTo(w * .7, h * .48);
  ctx.lineTo(w * .82, h * .55);
  ctx.lineTo(w * .92, h * .51);
  ctx.lineTo(w, h * .57);
  ctx.lineTo(w, h);
  ctx.lineTo(0, h);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(114,128,120,.16)';
  ctx.fillRect(w * .48, h * .54, w * .13, h * .22);
  ctx.fillRect(w * .06, h * .56, w * .08, h * .3);

  // Soft masses of foliage
  const greens = ['#789061', '#5f7950', '#9ba96e', '#b7b477', '#486444', '#d2c88f'];
  for (let i = 0; i < 180; i++) {
    const x = r() * w;
    const y = h * .27 + r() * h * .62;
    const rad = 24 + r() * 150;
    const col = greens[(r() * greens.length) | 0];
    const g = ctx.createRadialGradient(x - rad * .2, y - rad * .25, 2, x, y, rad);
    g.addColorStop(0, col + 'bb');
    g.addColorStop(.55, col + '66');
    g.addColorStop(1, col + '00');
    ctx.fillStyle = g;
    ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  // Backlit leaf highlights
  for (let i = 0; i < 500; i++) {
    const x = r() * w;
    const y = h * .2 + r() * h * .65;
    const rad = 1 + r() * 7;
    ctx.fillStyle = `rgba(232,235,185,${0.08 + r() * .22})`;
    ctx.beginPath();
    ctx.ellipse(x, y, rad, rad * .45, r() * TAU, 0, TAU);
    ctx.fill();
  }
  // Trunks
  ctx.strokeStyle = 'rgba(79,82,62,.24)';
  for (let i = 0; i < 14; i++) {
    const x = r() * w;
    ctx.lineWidth = 3 + r() * 5;
    ctx.beginPath();
    ctx.moveTo(x, h);
    ctx.bezierCurveTo(x + 20, h * .8, x - 25, h * .58, x + 12 + r() * 20, h * .36);
    ctx.stroke();
  }

  // Light vertical blur from glass + atmospheric wash
  const wash = ctx.createLinearGradient(0, 0, 0, h);
  wash.addColorStop(0, 'rgba(255,252,237,.35)');
  wash.addColorStop(.45, 'rgba(255,249,229,.11)');
  wash.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, w, h);

  return canvasTexture(c, { aniso: 4 });
}

function createCeilingTexture() {
  const w = 1024, h = 1024;
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#343a39';
  ctx.fillRect(0, 0, w, h);
  // corrugated lines
  for (let x = 0; x < w; x += 9) {
    ctx.fillStyle = (x / 9) % 2 === 0 ? 'rgba(17,20,20,.42)' : 'rgba(126,134,127,.09)';
    ctx.fillRect(x, 0, 3, h);
  }
  for (let i = 0; i < 500; i++) {
    const x = rng() * w, y = rng() * h;
    ctx.fillStyle = `rgba(180,178,160,${rng() * .035})`;
    ctx.fillRect(x, y, rng() * 30, rng() * 2);
  }
  return canvasTexture(c, { repeat: [3, 2], aniso: 4 });
}

function createTireSidewallTexture() {
  const S = 512;
  const c = makeCanvas(S, S);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#0b0c0c';
  ctx.fillRect(0, 0, S, S);
  ctx.translate(S / 2, S / 2);
  for (let rr = 70; rr < 244; rr += 5) {
    ctx.strokeStyle = `rgba(${18 + Math.random() * 5},${18 + Math.random() * 5},${17 + Math.random() * 4},.8)`;
    ctx.lineWidth = 2 + Math.random() * 2;
    ctx.beginPath(); ctx.arc(0, 0, rr, 0, TAU); ctx.stroke();
  }
  ctx.fillStyle = 'rgba(170,169,157,.26)';
  ctx.font = '700 15px "GarageSans", Arial';
  ctx.textAlign = 'center';
  const chars = '· 205/55 R15 87V ·';
  for (let i = 0; i < 16; i++) {
    ctx.save();
    ctx.rotate(i / 16 * TAU);
    ctx.translate(0, -183);
    ctx.fillText(chars, 0, 0);
    ctx.restore();
  }
  ctx.strokeStyle = 'rgba(150,150,140,.14)';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(0, 0, 150, 0, TAU); ctx.stroke();
  return canvasTexture(c, { aniso: 8 });
}

// -----------------------------------------------------------------------------
// Materials
// -----------------------------------------------------------------------------
const TEX = {
  floor: createConcreteFloorTexture(),
  floorRough: createFloorRoughness(),
  wall: createWallTexture(),
  outside: createOutsideTexture(),
  ceiling: createCeilingTexture(),
  tireSide: createTireSidewallTexture(),
  roundel: null
};

const floorMat = new THREE.MeshStandardMaterial({
  map: TEX.floor,
  roughnessMap: TEX.floorRough,
  color: 0xd0cbc0,
  roughness: 0.76,
  metalness: 0.03,
  bumpMap: TEX.floor,
  bumpScale: 0.018,
  envMapIntensity: 0.36
});

const wallMat = new THREE.MeshStandardMaterial({
  map: TEX.wall,
  color: 0xd6d0c2,
  roughness: 0.93,
  metalness: 0.0,
  roughnessMap: TEX.floorRough,
  bumpMap: TEX.wall,
  bumpScale: 0.025,
  envMapIntensity: 0.24
});
const wallPaleMat = wallMat.clone();
wallPaleMat.color.set(0xe4dfd3);

const MAT = {
  paint: new THREE.MeshPhysicalMaterial({
    color: 0x2f3b47,
    metalness: 0.76,
    roughness: 0.29,
    clearcoat: 1,
    clearcoatRoughness: 0.12,
    envMapIntensity: 1.35
  }),
  paintDark: new THREE.MeshPhysicalMaterial({
    color: 0x25303a,
    metalness: 0.7,
    roughness: 0.34,
    clearcoat: 0.8,
    clearcoatRoughness: 0.2,
    envMapIntensity: 1.15
  }),
  blackPlastic: new THREE.MeshStandardMaterial({ color: 0x111414, roughness: 0.56, metalness: 0.12, envMapIntensity: 0.65 }),
  bumper: new THREE.MeshStandardMaterial({ color: 0x1b1e1f, roughness: 0.45, metalness: 0.22, envMapIntensity: 0.9 }),
  rubber: new THREE.MeshStandardMaterial({ color: 0x101111, roughness: 0.9, metalness: 0.02 }),
  tire: new THREE.MeshStandardMaterial({ map: null, color: 0x111313, roughness: 0.83, metalness: 0.02 }),
  chrome: new THREE.MeshStandardMaterial({ color: 0xd3d6d4, roughness: 0.12, metalness: 1.0, envMapIntensity: 1.8 }),
  silver: new THREE.MeshStandardMaterial({ color: 0xaeb3b1, roughness: 0.26, metalness: 0.92, envMapIntensity: 1.5 }),
  silverDark: new THREE.MeshStandardMaterial({ color: 0x777e7d, roughness: 0.33, metalness: 0.88, envMapIntensity: 1.25 }),
  glass: new THREE.MeshPhysicalMaterial({
    color: 0x101719, metalness: 0.34, roughness: 0.06, clearcoat: 1, clearcoatRoughness: 0.04,
    transparent: true, opacity: 0.88, envMapIntensity: 2.0, side: THREE.DoubleSide
  }),
  headlightGlass: new THREE.MeshPhysicalMaterial({
    color: 0xdedfda, metalness: 0.12, roughness: 0.05, clearcoat: 1, clearcoatRoughness: 0.03,
    transparent: true, opacity: 0.84, envMapIntensity: 2.2, side: THREE.DoubleSide
  }),
  headlightSilver: new THREE.MeshStandardMaterial({ color: 0xcdd0c9, roughness: 0.16, metalness: 0.9, envMapIntensity: 1.9 }),
  amber: new THREE.MeshPhysicalMaterial({ color: 0xb96b1d, roughness: 0.22, metalness: 0.15, clearcoat: 1, emissive: 0x3a1604, emissiveIntensity: 0.35, transparent: true, opacity: 0.9 }),
  redLight: new THREE.MeshPhysicalMaterial({ color: 0x71150f, roughness: 0.22, metalness: 0.15, clearcoat: 1, emissive: 0x240502, emissiveIntensity: .3 }),
  interiorLeather: new THREE.MeshStandardMaterial({ color: 0x1a1a18, roughness: 0.5, metalness: 0.04, envMapIntensity: 0.4 }),
  interiorLeatherWarm: new THREE.MeshStandardMaterial({ color: 0x3a3028, roughness: 0.45, metalness: 0.03, envMapIntensity: 0.5 }),
  interiorTrim: new THREE.MeshStandardMaterial({ color: 0x232524, roughness: 0.55, metalness: 0.06 }),
  carpet: new THREE.MeshStandardMaterial({ color: 0x161716, roughness: 0.98, metalness: 0.0 }),
  steel: new THREE.MeshStandardMaterial({ color: 0x5d6260, roughness: 0.38, metalness: 0.8, envMapIntensity: 1.0 }),
  darkSteel: new THREE.MeshStandardMaterial({ color: 0x272a29, roughness: 0.5, metalness: 0.72, envMapIntensity: 0.85 }),
  liftBlue: new THREE.MeshStandardMaterial({ color: 0x155a93, roughness: 0.34, metalness: 0.62, envMapIntensity: 1.1 }),
  liftBlueDark: new THREE.MeshStandardMaterial({ color: 0x0d3d68, roughness: 0.42, metalness: 0.58, envMapIntensity: 0.9 }),
  rackBlack: new THREE.MeshStandardMaterial({ color: 0x1f2322, roughness: 0.47, metalness: 0.64, envMapIntensity: 0.8 }),
  toolChest: new THREE.MeshStandardMaterial({ color: 0x181b1b, roughness: 0.32, metalness: 0.42, envMapIntensity: 0.9 }),
  wood: new THREE.MeshStandardMaterial({ color: 0x6f5435, roughness: 0.8, metalness: 0 }),
  cardboard: new THREE.MeshStandardMaterial({ color: 0xa17d4d, roughness: 0.92 }),
  paper: new THREE.MeshStandardMaterial({ color: 0xd8d4c5, roughness: 0.88 }),
  yellow: new THREE.MeshStandardMaterial({ color: 0xb58e26, roughness: 0.56, metalness: 0.18 }),
  redAccent: new THREE.MeshStandardMaterial({ color: 0x92251e, roughness: 0.35, metalness: 0.35 }),
  paleMetal: new THREE.MeshStandardMaterial({ color: 0x9b9c92, roughness: 0.55, metalness: 0.4 }),
  engineAlu: new THREE.MeshStandardMaterial({ color: 0x8b8c86, roughness: 0.46, metalness: 0.72, envMapIntensity: 1.0 }),
  engineDark: new THREE.MeshStandardMaterial({ color: 0x282a29, roughness: 0.51, metalness: 0.6, envMapIntensity: 0.8 }),
  binBlue: new THREE.MeshStandardMaterial({ color: 0x235177, roughness: 0.58, metalness: 0.08 }),
  binGrey: new THREE.MeshStandardMaterial({ color: 0x4d5350, roughness: 0.65, metalness: 0.08 }),
  binBeige: new THREE.MeshStandardMaterial({ color: 0x9c9585, roughness: 0.7, metalness: 0.05 }),
  hose: new THREE.MeshStandardMaterial({ color: 0x141616, roughness: 0.72, metalness: 0.2 }),
};

TEX.roundel = labelTexture(256, 256, (ctx, w, h) => {
  ctx.clearRect(0, 0, w, h);
  drawRoundel(ctx, w / 2, h / 2, w * .47);
});

const roundelMat = new THREE.MeshStandardMaterial({
  map: TEX.roundel, transparent: true, roughness: 0.28, metalness: 0.25, envMapIntensity: 0.9
});

// -----------------------------------------------------------------------------
// Room shell / floor / windows
// -----------------------------------------------------------------------------
const ROOM = {
  backX: -6.8,
  farZ: -5.2,
  frontX: 8.4,
  nearZ: 7.8,
  height: 7.05
};
const room = new THREE.Group();
room.name = 'Garage';
scene.add(room);

// Floor
{
  const floorGeo = new THREE.PlaneGeometry(ROOM.frontX - ROOM.backX, ROOM.nearZ - ROOM.farZ, 1, 1);
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set((ROOM.frontX + ROOM.backX) / 2, 0, (ROOM.nearZ + ROOM.farZ) / 2);
  floor.receiveShadow = true;
  room.add(floor);

  // subtle floor border / skirting
  addBox(room, [ROOM.frontX - ROOM.backX, .12, .05], [(ROOM.frontX + ROOM.backX) / 2, .06, ROOM.farZ + .02], MAT.darkSteel, { cast: false });
  addBox(room, [ROOM.frontX - ROOM.backX, .12, .05], [(ROOM.frontX + ROOM.backX) / 2, .06, ROOM.nearZ - .02], MAT.darkSteel, { cast: false });
}

// Ceiling
{
  const ceil = addBox(room, [ROOM.frontX - ROOM.backX + .6, .08, ROOM.nearZ - ROOM.farZ + .6],
    [(ROOM.frontX + ROOM.backX) / 2, ROOM.height, (ROOM.nearZ + ROOM.farZ) / 2],
    new THREE.MeshStandardMaterial({ map: TEX.ceiling, color: 0x838a83, roughness: 0.92, metalness: .18 }), { cast: false });
  ceil.receiveShadow = true;

  // structural beams
  const beamMat = new THREE.MeshStandardMaterial({ color: 0x2a302f, roughness: 0.56, metalness: 0.58 });
  for (let x = ROOM.backX + 1.0; x < ROOM.frontX; x += 2.65) {
    addBox(room, [.18, .32, ROOM.nearZ - ROOM.farZ], [x, ROOM.height - .22, (ROOM.nearZ + ROOM.farZ) / 2], beamMat, { cast: true });
  }
  for (let z = ROOM.farZ + 1; z < ROOM.nearZ; z += 2.8) {
    addBox(room, [ROOM.frontX - ROOM.backX, .2, .17], [(ROOM.frontX + ROOM.backX) / 2, ROOM.height - .43, z], beamMat, { cast: true });
  }
  // roof purlins
  for (let z = ROOM.farZ + .8; z < ROOM.nearZ; z += 1.3) {
    addBox(room, [ROOM.frontX - ROOM.backX, .08, .07], [(ROOM.frontX + ROOM.backX) / 2, ROOM.height - .1, z], beamMat, { cast: false });
  }
  // pipes
  const copper = new THREE.MeshStandardMaterial({ color: 0x6c5542, roughness: .48, metalness: .72 });
  const pipeMat = new THREE.MeshStandardMaterial({ color: 0x424644, roughness: .48, metalness: .7 });
  const pipe1 = addCylinder(room, .055, .055, ROOM.frontX - ROOM.backX, 12,
    [(ROOM.frontX + ROOM.backX) / 2, ROOM.height - .68, ROOM.farZ + 1.15], pipeMat, { rot: [0, 0, Math.PI / 2], cast: false });
  const pipe2 = addCylinder(room, .035, .035, ROOM.frontX - ROOM.backX, 10,
    [(ROOM.frontX + ROOM.backX) / 2, ROOM.height - .78, ROOM.farZ + 1.28], copper, { rot: [0, 0, Math.PI / 2], cast: false });
  const pipe3 = addCylinder(room, .025, .025, ROOM.nearZ - ROOM.farZ, 8,
    [ROOM.backX + 1.8, ROOM.height - .6, (ROOM.nearZ + ROOM.farZ) / 2], pipeMat, { rot: [Math.PI / 2, 0, 0], cast: false });
  // cable tray
  const tray = addBox(room, [.26, .07, ROOM.nearZ - ROOM.farZ], [1.2, ROOM.height - .58, (ROOM.nearZ + ROOM.farZ) / 2], MAT.darkSteel, { cast: false });
  tube(room, [[1.2, ROOM.height - .57, ROOM.farZ], [1.2, ROOM.height - .57, 3.3], [1.2, ROOM.height - .57, ROOM.nearZ]], .035, MAT.darkSteel, 10, 5);
}

// -----------------------------------------------------------------------------
// Walls with window openings
// -----------------------------------------------------------------------------
const windowFrameMat = new THREE.MeshStandardMaterial({ color: 0x2b302e, roughness: 0.52, metalness: 0.58 });
const sillMat = new THREE.MeshStandardMaterial({ color: 0x6a6c63, roughness: 0.8, metalness: 0.12 });

// Outside light boxes
{
  const outMat = new THREE.MeshBasicMaterial({ map: TEX.outside, toneMapped: false, color: new THREE.Color(1.65, 1.65, 1.58) });
  const back = new THREE.Mesh(new THREE.PlaneGeometry(ROOM.nearZ - ROOM.farZ + 4, 8.4), outMat);
  back.position.set(ROOM.backX - .62, 4.1, (ROOM.nearZ + ROOM.farZ) / 2);
  back.rotation.y = Math.PI / 2;
  room.add(back);

  const far = new THREE.Mesh(new THREE.PlaneGeometry(ROOM.frontX - ROOM.backX + 5, 8.4), outMat);
  far.position.set((ROOM.frontX + ROOM.backX) / 2, 4.1, ROOM.farZ - .62);
  room.add(far);
}

// Back wall: concrete sill, window band, piers, header
const backWall = new THREE.Group();
backWall.name = 'WindowWallWest';
room.add(backWall);
{
  const x = ROOM.backX;
  const wallThk = .26;
  // lower wall
  addBox(backWall, [wallThk, 2.35, ROOM.nearZ - ROOM.farZ], [x - .02, 1.175, (ROOM.nearZ + ROOM.farZ) / 2], wallMat, { cast: true });
  // upper header
  addBox(backWall, [wallThk, .7, ROOM.nearZ - ROOM.farZ], [x - .02, 6.7, (ROOM.nearZ + ROOM.farZ) / 2], wallMat, { cast: true });
  // base trim
  addBox(backWall, [.34, .17, ROOM.nearZ - ROOM.farZ], [x + .02, .085, (ROOM.nearZ + ROOM.farZ) / 2], MAT.darkSteel, { cast: false });

  const bayStart = ROOM.farZ + .52;
  const bayWidth = 1.83;
  const bayStep = 2.12;
  const bayCount = 5;
  const winBottom = 2.35;
  const winTop = 6.32;
  const winHeight = winTop - winBottom;

  // big vertical piers
  for (let i = 0; i <= bayCount; i++) {
    const z = bayStart + i * bayStep - .145;
    addBox(backWall, [.52, ROOM.height - .02, .28], [x - .02, ROOM.height / 2, z], wallPaleMat, { cast: true });
    // geometric shadow reveal
    addBox(backWall, [.06, winHeight, .05], [x + .235, (winTop + winBottom) / 2, z + .17], MAT.darkSteel, { cast: false });
  }
  // sill ledge
  addBox(backWall, [.52, .17, bayCount * bayStep + .1], [x + .05, winBottom - .04, bayStart + (bayCount - 1) * bayStep / 2 + bayWidth / 2 - .2], sillMat, { cast: true });

  for (let b = 0; b < bayCount; b++) {
    const z0 = bayStart + b * bayStep;
    const zc = z0 + bayWidth / 2;
    // continuous glass sheet with faint reflection tint
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(bayWidth - .12, winHeight - .1), new THREE.MeshPhysicalMaterial({
      color: 0x9fb5b9, metalness: .32, roughness: .06, transmission: 0, transparent: true, opacity: .06, envMapIntensity: 1.2, side: THREE.DoubleSide
    }));
    glass.rotation.y = Math.PI / 2;
    glass.position.set(x + .16, (winTop + winBottom) / 2, zc);
    backWall.add(glass);

    // perimeter frame
    const depths = .3;
    const fw = .065;
    addBox(backWall, [.18, fw, bayWidth], [x + .07, winTop - .02, zc], windowFrameMat);
    addBox(backWall, [.18, fw, bayWidth], [x + .07, winBottom + .02, zc], windowFrameMat);
    addBox(backWall, [.18, winHeight, fw], [x + .07, winBottom + winHeight / 2, z0], windowFrameMat);
    addBox(backWall, [.18, winHeight, fw], [x + .07, winBottom + winHeight / 2, z0 + bayWidth], windowFrameMat);
    // mullions: 3 columns x 5 rows
    for (let i = 1; i < 3; i++) {
      addBox(backWall, [.13, winHeight - .08, .035], [x + .08, winBottom + winHeight / 2, z0 + i * bayWidth / 3], windowFrameMat, { cast: true });
    }
    for (let j = 1; j < 5; j++) {
      const hy = winBottom + j * winHeight / 5;
      addBox(backWall, [.13, .038, bayWidth - .06], [x + .08, hy, zc], windowFrameMat, { cast: true });
    }
    // heavier transom at shoulder height
    addBox(backWall, [.17, .075, bayWidth], [x + .075, winBottom + winHeight * .49, zc], windowFrameMat, { cast: true });
  }
}

// Far wall: high band of windows above the workbench / tire wall, solid concrete below
const farWall = new THREE.Group();
farWall.name = 'WindowWallNorth';
room.add(farWall);
{
  const z = ROOM.farZ;
  const wallThk = .28;
  addBox(farWall, [ROOM.frontX - ROOM.backX, 3.9, wallThk], [(ROOM.frontX + ROOM.backX) / 2, 1.95, z - .03], wallMat, { cast: true });
  addBox(farWall, [ROOM.frontX - ROOM.backX, .62, wallThk], [(ROOM.frontX + ROOM.backX) / 2, 6.74, z - .03], wallPaleMat, { cast: true });

  const winBottom = 4.0, winTop = 6.4;
  const bayStart = ROOM.backX + 1.15;
  const bayStep = 2.28;
  const bayCount = 6;
  for (let i = 0; i <= bayCount; i++) {
    addBox(farWall, [.28, ROOM.height - .02, .48], [bayStart + i * bayStep - .14, ROOM.height / 2, z - .02], wallPaleMat, { cast: true });
  }
  addBox(farWall, [bayCount * bayStep + .1, .17, .5], [bayStart + (bayCount - 1) * bayStep / 2 + .2, winBottom - .06, z + .02], sillMat, { cast: true });
  for (let b = 0; b < bayCount; b++) {
    const x0 = bayStart + b * bayStep;
    const xc = x0 + 1.1;
    const g = new THREE.Mesh(new THREE.PlaneGeometry(2.12, winTop - winBottom - .12), new THREE.MeshPhysicalMaterial({
      color: 0x9fb5b9, metalness: .3, roughness: .08, transparent: true, opacity: .05, side: THREE.DoubleSide, envMapIntensity: 1.0
    }));
    g.position.set(xc, (winTop + winBottom) / 2, z + .16);
    farWall.add(g);
    addBox(farWall, [2.2, .065, .18], [xc, winTop, z + .05], windowFrameMat);
    addBox(farWall, [2.2, .06, .18], [xc, winBottom, z + .05], windowFrameMat);
    addBox(farWall, [.06, winTop - winBottom, .18], [x0, (winTop + winBottom) / 2, z + .05], windowFrameMat);
    addBox(farWall, [.06, winTop - winBottom, .18], [x0 + 2.2, (winTop + winBottom) / 2, z + .05], windowFrameMat);
    for (let i = 1; i < 4; i++) addBox(farWall, [.035, winTop - winBottom, .13], [x0 + i * 2.2 / 4, (winTop + winBottom) / 2, z + .055], windowFrameMat);
    for (let j = 1; j < 3; j++) addBox(farWall, [2.2, .035, .13], [xc, winBottom + j * (winTop - winBottom) / 3, z + .055], windowFrameMat);
  }
}

// Near/front walls mostly out of the shot; keep the room enclosed.
{
  const frontMat = wallMat.clone();
  frontMat.color.set(0xb0aea3);
  addBox(room, [.28, ROOM.height, ROOM.nearZ - ROOM.farZ], [ROOM.frontX, ROOM.height / 2, (ROOM.nearZ + ROOM.farZ) / 2], frontMat, { cast: false });
  addBox(room, [ROOM.frontX - ROOM.backX, ROOM.height, .28], [(ROOM.frontX + ROOM.backX) / 2, ROOM.height / 2, ROOM.nearZ], frontMat, { cast: false });
  // faint dark opening to suggest the roll-up door behind camera
  addBox(room, [4.8, 4.3, .04], [4.9, 2.15, ROOM.nearZ - .17], new THREE.MeshStandardMaterial({ color: 0x303633, roughness: .72, metalness: .25 }), { cast: false });
}

// Wall services: conduit, boxes, sockets
{
  const conduit = new THREE.MeshStandardMaterial({ color: 0x4f514b, roughness: .66, metalness: .38 });
  addCylinder(room, .027, .027, 3.2, 8, [ROOM.backX + .17, 3.3, 4.35], conduit);
  addCylinder(room, .027, .027, 2.8, 8, [ROOM.backX + .17, 2.9, -4.0], conduit);
  const boxMat = new THREE.MeshStandardMaterial({ color: 0x666660, roughness: .62, metalness: .35 });
  addBox(room, [.14, .38, .27], [ROOM.backX + .23, 2.1, 4.35], boxMat);
  addBox(room, [.14, .28, .22], [ROOM.backX + .23, 2.35, -4.0], boxMat);
  // small red emergency stop
  addBox(room, [.05, .14, .16], [ROOM.backX + .32, 1.66, 4.35], MAT.redAccent);
}

// Baseboards and floor drain trench
{
  const grateMat = new THREE.MeshStandardMaterial({ color: 0x3d403e, roughness: .42, metalness: .76 });
  const trough = new THREE.MeshStandardMaterial({ color: 0x171918, roughness: .6, metalness: .4 });
  // A long drain near the workshop foreground, following the X axis with a slight diagonal.
  const drain = new THREE.Group();
  drain.position.set(4.8, 0.011, 1.62);
  drain.rotation.y = -0.33;
  room.add(drain);
  addBox(drain, [5.4, .035, .26], [0, 0, 0], trough, { cast: false });
  for (let i = 0; i < 42; i++) {
    addBox(drain, [.072, .026, .245], [-2.55 + i * .124, .019, 0], grateMat, { cast: false, receive: true });
  }
  addBox(drain, [.11, .04, .36], [0, .015, 0], MAT.darkSteel, { cast: false });
}

// Loading bay floor markings (subtle, worn)
{
  const markMat = new THREE.MeshBasicMaterial({ color: 0xbfad7b, transparent: true, opacity: .18, depthWrite: false });
  for (let i = 0; i < 6; i++) {
    addBox(room, [1.03, .002, .09], [-4.1 + i * 1.22, .012, 3.25], markMat, { cast: false, receive: false });
  }
}

// -----------------------------------------------------------------------------
// Exterior daylight entering through the window wall
// -----------------------------------------------------------------------------
const sun = new THREE.DirectionalLight(0xffefd2, 4.4);
sun.position.set(-11.5, 10.6, -8.5);
sun.target.position.set(2.2, 0.35, 2.1);
scene.add(sun.target);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.near = 1.0;
sun.shadow.camera.far = 32;
sun.shadow.camera.left = -10.5;
sun.shadow.camera.right = 10.5;
sun.shadow.camera.top = 10.5;
sun.shadow.camera.bottom = -8.0;
sun.shadow.bias = -0.00025;
sun.shadow.normalBias = .028;
sun.shadow.radius = 3.0;
scene.add(sun);

const hemi = new THREE.HemisphereLight(0xbdd5e8, 0x353630, 0.78);
scene.add(hemi);
const ambient = new THREE.AmbientLight(0xa9b7b8, 0.2);
scene.add(ambient);

// Broad soft window light. It doesn't cast shadow, but paints cool bounce on paint and chrome.
const winLight = new THREE.DirectionalLight(0xc7dcf0, 1.25);
winLight.position.set(-7, 5.2, 3.4);
winLight.target.position.set(1.0, 0.8, -0.2);
scene.add(winLight.target);
scene.add(winLight);

// Very soft fill from the open bay behind the camera.
const bayFill = new THREE.DirectionalLight(0xbfcdd1, 0.72);
bayFill.position.set(8, 5.8, 6.5);
bayFill.target.position.set(0, 0.75, 0);
scene.add(bayFill.target);
scene.add(bayFill);

// Area light for long highlights along the hood and flanks.
const area = new THREE.RectAreaLight(0xc8dfed, 5.0, 5.2, 3.2);
area.position.set(-5.9, 4.45, 2.5);
area.lookAt(0.5, 0.8, 0);
scene.add(area);

const areaWarm = new THREE.RectAreaLight(0xffd9a3, 1.8, 3.2, 2.1);
areaWarm.position.set(3.0, 3.7, 4.2);
areaWarm.lookAt(0.2, 0.7, 0);
scene.add(areaWarm);

// Small warm practical lights / pendant lamps
const lampGlowMat = new THREE.MeshBasicMaterial({ color: 0xffdfae, toneMapped: false });

function createPendantLamp(x, z, h, shadeColor = 0x161918) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  room.add(g);
  const cable = addCylinder(g, .012, .012, ROOM.height - h - .35, 6, [0, (ROOM.height + h + .35) / 2, 0], MAT.hose, { cast: false });
  const shade = new THREE.Mesh(
    new THREE.CylinderGeometry(.12, .36, .3, 28, 1, true),
    new THREE.MeshStandardMaterial({ color: shadeColor, roughness: .35, metalness: .55, side: THREE.DoubleSide })
  );
  shade.position.set(0, h + .15, 0);
  shade.castShadow = true;
  g.add(shade);
  const inner = new THREE.Mesh(
    new THREE.CylinderGeometry(.115, .34, .29, 28, 1, true),
    new THREE.MeshStandardMaterial({ color: 0xd6cfb7, roughness: .45, metalness: .1, side: THREE.BackSide })
  );
  inner.position.set(0, h + .145, 0);
  g.add(inner);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(.06, 12, 8), lampGlowMat);
  bulb.position.set(0, h + .04, 0);
  g.add(bulb);
  const cap = addCylinder(g, .13, .13, .055, 20, [0, h + .32, 0], MAT.blackPlastic, { cast: false });
  const light = new THREE.PointLight(0xffd6a0, 11, 7.5, 2);
  light.position.set(0, h + .02, 0);
  g.add(light);
  return g;
}
createPendantLamp(0.25, 0.2, 4.3);
createPendantLamp(-3.6, -1.15, 4.85, 0x202423);
createPendantLamp(3.5, -2.4, 4.65, 0x202423);

// A shallow warm pool of light from a floor work lamp behind the tool wall
const workGlow = new THREE.PointLight(0xffc27b, 2.6, 5.5, 2);
workGlow.position.set(1.4, 1.1, -3.1);
scene.add(workGlow);

// -----------------------------------------------------------------------------
// World / scene placeholders; car, lift and props are built below.
// -----------------------------------------------------------------------------
const world = new THREE.Group();
scene.add(world);
