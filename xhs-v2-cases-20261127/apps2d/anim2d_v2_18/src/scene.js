import { WORLD, TAU, cyclicTime, clamp, pulseAt } from './utils.js';
import { drawSky, drawOceanBase, drawWaveLayer, drawRain, drawSeaMist, drawLightOnSea } from './environment.js';
import { drawBreakwater, drawShip, drawBuoy } from './vessel.js';
import { computeOptics, drawBeam, drawLighthouse } from './mechanics.js';

export const DEFAULTS = Object.freeze({ t: 0, day: 0, storm: .78, elevation: 28 });

export function getReadings(scene) {
  const pulseAge = Number.isFinite(scene.pulse.age) ? scene.pulse.age : 0;
  const pulseWave = scene.pulse.envelope * Math.sin(pulseAge * 17) * .7;
  const wave = 1 + scene.storm * (3.8 / .78) + pulseWave;
  const period = 5.8 + scene.storm * (1.4 / .78) + scene.pulse.envelope * Math.sin(pulseAge * 11) * .15;
  const knots = Math.round(scene.storm * (42 / .78));
  const lamp = Math.round(clamp(.89 - scene.day * .38 + scene.pulse.envelope * .09, .18, 1) * 100);
  return { wave, period, knots, lamp };
}

function drawTelemetry(ctx, scene) {
  const c = ctx.canvas, w = c.width, h = c.height;
  ctx.clearRect(0, 0, w, h);
  ctx.strokeStyle = 'rgba(92,123,139,.15)'; ctx.lineWidth = 1;
  for (let y = 6; y < h; y += 12) { ctx.beginPath(); ctx.moveTo(0, y + .5); ctx.lineTo(w, y + .5); ctx.stroke(); }
  for (let x = 0; x < w; x += 50) { ctx.beginPath(); ctx.moveTo(x + .5, 0); ctx.lineTo(x + .5, h); ctx.stroke(); }
  const gradient = ctx.createLinearGradient(0, 0, w, 0);
  gradient.addColorStop(0, 'rgba(90,167,183,.3)'); gradient.addColorStop(.7, '#77c3cd'); gradient.addColorStop(1, scene.pulse.envelope > .03 ? '#f0c17c' : '#a5d6d8');
  ctx.beginPath();
  for (let x = 0; x <= w; x += 2) {
    const q = x / w;
    const carrier = Math.sin(q * TAU * 3 + scene.t / 8 * TAU * 3) * (2.1 + scene.storm * 3.3);
    const secondary = Math.sin(q * TAU * 9 - scene.t / 8 * TAU * 2) * scene.storm * 1.1;
    const pulseWave = scene.pulse.envelope * Math.exp(-Math.pow((q - .81) * 10, 2)) * Math.sin(q * 92 - (Number.isFinite(scene.pulse.age) ? scene.pulse.age : 0) * 15) * 10;
    const y = h * .51 + carrier + secondary + pulseWave;
    if (!x) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.strokeStyle = gradient; ctx.lineWidth = 1.6; ctx.stroke();
  ctx.strokeStyle = 'rgba(145,215,217,.07)'; ctx.lineWidth = 5; ctx.stroke();
}

export class TidalScene {
  constructor(canvas, telemetryCanvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.telemetry = telemetryCanvas?.getContext('2d');
    this.cssWidth = 0; this.cssHeight = 0;
    this.resize();
  }
  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.round(rect.width * dpr)), h = Math.max(1, Math.round(rect.height * dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) { this.canvas.width = w; this.canvas.height = h; }
    this.cssWidth = rect.width; this.cssHeight = rect.height; this.dpr = dpr;
  }
  render(input) {
    this.resize();
    const scene = {
      t: cyclicTime(input.t), day: clamp(input.day), storm: clamp(input.storm),
      elevation: clamp(input.elevation, 0, 90),
    };
    scene.pulse = pulseAt(scene.t, input.pulseStart);
    scene.optics = computeOptics(scene);
    const ctx = this.ctx, cw = this.canvas.width, ch = this.canvas.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#10233a'; ctx.fillRect(0, 0, cw, ch);
    const scale = Math.max(cw / WORLD.width, ch / WORLD.height);
    const tx = (cw - WORLD.width * scale) * .5, ty = (ch - WORLD.height * scale) * .5;
    ctx.setTransform(scale, 0, 0, scale, tx, ty);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';

    drawSky(ctx, scene);
    drawOceanBase(ctx, scene);
    drawRain(ctx, scene, false);
    drawSeaMist(ctx, scene);
    drawWaveLayer(ctx, scene, 0);
    drawBreakwater(ctx, scene);
    drawWaveLayer(ctx, scene, 1);
    drawWaveLayer(ctx, scene, 2);
    drawShip(ctx, scene);
    drawLightOnSea(ctx, scene, scene.optics);
    drawBuoy(ctx, scene, scene.optics, 1);
    drawBuoy(ctx, scene, scene.optics, 0);
    drawBeam(ctx, scene, scene.optics);
    drawLighthouse(ctx, scene, scene.optics);
    drawRain(ctx, scene, true);

    // Keep full-canvas state clean for exact out-of-order redraws.
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    if (this.telemetry) drawTelemetry(this.telemetry, scene);
    return scene;
  }
}
