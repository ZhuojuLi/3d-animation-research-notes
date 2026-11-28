/**
 * Deterministic seeded PRNG, noise utilities, and centralized simulation/kinematic state.
 * Zero randomness outside seeded generators so repeated renderAt(t) calls are bit-exact.
 */

export const SCENE_DURATION = 16.0;
export const LOGICAL_WIDTH = 1536;
export const LOGICAL_HEIGHT = 1024;
export const WORLD_ENVELOPE = Object.freeze({ width: 7.0, height: 5.2, depth: 12.0 });

export const DEFAULT_CONFIG = Object.freeze({
  lampElevationDeg: 44,
  backlightIntensityPct: 84,
  polisherSpeedRpm: 480,
  selectedSliceId: null,
});

/**
 * Deterministic Mulberry32 PRNG returning floats in [0, 1).
 */
export function mulberry32(seed) {
  let a = (seed >>> 0) || 1;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashInt(x, y, seed = 1337) {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(seed | 0, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export function valueNoise2D(x, y, seed = 1337) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = hashInt(xi, yi, seed);
  const b = hashInt(xi + 1, yi, seed);
  const c = hashInt(xi, yi + 1, seed);
  const d = hashInt(xi + 1, yi + 1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

export function fbm2D(x, y, seed = 1337, octaves = 4) {
  let value = 0;
  let amp = 0.5;
  let freq = 1;
  let norm = 0;
  for (let i = 0; i < octaves; i += 1) {
    value += amp * valueNoise2D(x * freq, y * freq, seed + i * 97);
    norm += amp;
    amp *= 0.5;
    freq *= 2.02;
  }
  return value / (norm || 1);
}

export function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function smoothstep(edge0, edge1, x) {
  const t = clamp((x - edge0) / (edge1 - edge0 || 1), 0, 1);
  return t * t * (3 - 2 * t);
}

export function wrapTime(t, duration = SCENE_DURATION) {
  if (!Number.isFinite(t)) return 0;
  if (Math.abs(t - duration) < 1e-6) return 0;
  const m = t % duration;
  return m < 0 ? m + duration : m;
}

export function createInitialState() {
  return {
    t: 0,
    rawT: 0,
    duration: SCENE_DURATION,
    playing: true,
    actIndex: 1,
    actName: 'panorama',
    actLabel: 'Act 1 · 全景建立',
    selectedSliceId: DEFAULT_CONFIG.selectedSliceId,
    selectionProgress: 0,
    selectionChangedAtMs: 0,
    hoverSliceId: null,
    hoverLamp: false,
    draggingLamp: false,
    lampElevationDeg: DEFAULT_CONFIG.lampElevationDeg,
    backlightIntensityPct: DEFAULT_CONFIG.backlightIntensityPct,
    polisherSpeedRpm: DEFAULT_CONFIG.polisherSpeedRpm,
    wheelAngleRad: 0,
    wheelAngularVelRadSec: (DEFAULT_CONFIG.polisherSpeedRpm * Math.PI * 2) / 60,
    housingVibrationMm: 0,
    camera: {
      x: 5.14,
      y: 2.54,
      z: 2.41,
      yawDeg: 31.52,
      pitchDeg: 0.0,
      focal: 1346.3,
      cx: 768,
      cy: 353.7,
    },
    macroSpotlightPhase: 0,
    viewport: { width: 1280, height: 720, scale: 720 / 1024 },
  };
}

export function resetStateToDefaults(state) {
  state.t = 0;
  state.rawT = 0;
  state.playing = false;
  state.actIndex = 1;
  state.actName = 'panorama';
  state.actLabel = 'Act 1 · 全景建立';
  state.selectedSliceId = DEFAULT_CONFIG.selectedSliceId;
  state.selectionProgress = 0;
  state.hoverSliceId = null;
  state.hoverLamp = false;
  state.draggingLamp = false;
  state.lampElevationDeg = DEFAULT_CONFIG.lampElevationDeg;
  state.backlightIntensityPct = DEFAULT_CONFIG.backlightIntensityPct;
  state.polisherSpeedRpm = DEFAULT_CONFIG.polisherSpeedRpm;
  computeWheelKinematics(state, 0);
}

/**
 * Computes deterministic angular displacement and micro-vibration from time `t` and `polisherSpeedRpm`.
 * Because polisherSpeedRpm uses 15-rpm increments (480 rpm default = 8 rev/s = 128 exact revolutions in 16s),
 * the periodic loop at t=0 and t=16 aligns seamlessly with zero visual discontinuity.
 */
export function computeWheelKinematics(state, t) {
  const rpm = clamp(Number(state.polisherSpeedRpm) || 0, 0, 1200);
  const revPerSec = rpm / 60;
  const omega = revPerSec * Math.PI * 2;
  const wrappedT = wrapTime(t, state.duration);
  const totalAngle = omega * wrappedT;
  const speedNorm = rpm / 1200;
  // Exact integer cycles over 16s so vibration at t=0 equals vibration at t=16 (0)
  const vibFreqHz = 6.0;
  const vibAmp = speedNorm > 0.001 ? (0.18 + 0.82 * speedNorm * speedNorm) * 0.65 : 0;
  const vib = vibAmp * Math.sin(2 * Math.PI * vibFreqHz * wrappedT);

  state.wheelAngularVelRadSec = omega;
  state.wheelAngleRad = totalAngle;
  state.housingVibrationMm = vib;
  return {
    rpm,
    omega,
    wheelAngleRad: totalAngle,
    housingVibrationMm: vib,
  };
}

/**
 * Public telemetry snapshot for `window.__2D_STATE__` and `window.__getKinematicState()`.
 */
export function buildKinematicSnapshot(state, slices = []) {
  const selected = state.selectedSliceId !== null
    ? slices.find(s => s.id === state.selectedSliceId) || null
    : null;
  return {
    t: Number(state.t.toFixed(4)),
    rawT: Number(state.rawT.toFixed(4)),
    duration: state.duration,
    playing: Boolean(state.playing),
    act: {
      index: state.actIndex,
      name: state.actName,
      label: state.actLabel,
    },
    camera: {
      x: Number(state.camera.x.toFixed(4)),
      y: Number(state.camera.y.toFixed(4)),
      z: Number(state.camera.z.toFixed(4)),
      yawDeg: Number(state.camera.yawDeg.toFixed(3)),
      pitchDeg: Number(state.camera.pitchDeg.toFixed(3)),
      focal: Number(state.camera.focal.toFixed(2)),
      cx: Number(state.camera.cx.toFixed(2)),
      cy: Number(state.camera.cy.toFixed(2)),
    },
    selectedSlice: selected
      ? {
          id: selected.id,
          code: selected.code,
          nameZh: selected.nameZh,
          nameEn: selected.nameEn,
          patternType: selected.patternType,
          localityZh: selected.localityZh,
          selectionProgress: Number(state.selectionProgress.toFixed(3)),
          selectionLatencyMs: Number((state.selectionLatencyMs || 0).toFixed(1)),
        }
      : null,
    lampElevationDeg: Number(state.lampElevationDeg.toFixed(2)),
    backlightIntensityPct: Number(state.backlightIntensityPct.toFixed(1)),
    polisherSpeedRpm: Number(state.polisherSpeedRpm.toFixed(1)),
    wheelAngularDisplacementRad: Number(state.wheelAngleRad.toFixed(4)),
    wheelAngleMod2Pi: Number((((state.wheelAngleRad % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)).toFixed(4)),
    housingVibrationMm: Number(state.housingVibrationMm.toFixed(4)),
  };
}
