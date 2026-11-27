/** Pure deterministic mechanism model. No wall-clock or accumulated state. */
import {
  NEEDLE, COMPASS_LENGTH, COMPASS_SPREAD, COMPASS_SWEEP,
  COMPASS_BASE_ANGLE, TSQUARE_TRAVEL,
} from './geometry.js';

export const DURATION = 6;
export const clamp = (v, min = 0, max = 1) => Math.max(min, Math.min(max, v));
export const lerp = (a, b, u) => a + (b - a) * u;
export const smooth = u => { const x = clamp(u); return x * x * (3 - 2 * x); };
export const smoother = u => { const x = clamp(u); return x * x * x * (x * (x * 6 - 15) + 10); };

export function normalizeTime(seconds) {
  const value = Number.isFinite(Number(seconds)) ? Number(seconds) : 0;
  if (Math.abs(value - DURATION) < 1e-9) return 0;
  if (value >= 0 && value < DURATION) return value;
  return ((value % DURATION) + DURATION) % DURATION;
}

function resetValue(t, start = 4.8) {
  return t < start ? 1 : 1 - smoother((t - start) / (DURATION - start));
}

function phaseInfo(t) {
  if (t < 1.8) return { index: 0, name: 'SCRIBE CONSTRUCTION', code: '01', local: t / 1.8 };
  if (t < 2.8) return { index: 1, name: 'INDEX T-SQUARE', code: '02', local: (t - 1.8) / 1.0 };
  if (t < 4.8) return { index: 2, name: 'GUIDED TRIM & CURL', code: '03', local: (t - 2.8) / 2.0 };
  return { index: 3, name: 'RETURN TO REGISTER', code: '04', local: (t - 4.8) / 1.2 };
}

/** Shared speed law: changing cadence changes rate, never canonical poses. */
export function speedMultiplier(speed) {
  const s = clamp(Number(speed) || 0, 0, 100);
  return s / 60; // 60 => canonical 1.0 cadence; zero holds transport phase
}

function cutterRate(t) {
  // Derivative of the same smooth envelope used by the tool, in mm/s.
  if (t >= 2.8 && t < 4.8) {
    const u = (t - 2.8) / 2;
    return (40 / 2) * (30 * u * u * (1 - u) * (1 - u));
  }
  if (t >= 4.8) {
    const u = (t - 4.8) / 1.2;
    return (40 / 1.2) * (30 * u * u * (1 - u) * (1 - u));
  }
  return 0;
}

export function sceneAt(seconds, speed = 60) {
  const t = normalizeTime(seconds);
  const phase = phaseInfo(t);
  const returning = resetValue(t);
  const arcProgress = t < 1.8 ? smoother(t / 1.8) : returning;
  const squareProgress = t < 1.8 ? 0 : t < 2.8 ? smoother((t - 1.8) / 1.0) : returning;
  const trimProgress = t < 2.8 ? 0 : t < 4.8 ? smoother((t - 2.8) / 2.0) : returning;
  const bladeProgress = t < 2.8 ? 0 : t < 4.8 ? smooth((t - 2.8) / 0.72) : returning;
  const ribbonProgress = trimProgress;

  const compassDegrees = COMPASS_BASE_ANGLE + COMPASS_SWEEP * arcProgress;
  const compassRadians = compassDegrees * Math.PI / 180;
  const spreadRadians = COMPASS_SPREAD * Math.PI / 180;
  // A vertex of two equal rigid legs: chord R = 2 L sin(spread/2).
  // Here R = L = 200, so spread = 60 degrees.
  const localHinge = { x: 100, y: -Math.sqrt(COMPASS_LENGTH ** 2 - 100 ** 2) };
  const rotate = point => ({
    x: NEEDLE.x + point.x * Math.cos(compassRadians) - point.y * Math.sin(compassRadians),
    y: NEEDLE.y + point.x * Math.sin(compassRadians) + point.y * Math.cos(compassRadians),
  });
  const hinge = rotate(localHinge);
  const pencil = {
    x: NEEDLE.x + COMPASS_LENGTH * Math.cos(compassRadians),
    y: NEEDLE.y + COMPASS_LENGTH * Math.sin(compassRadians),
  };
  const swingDegrees = compassDegrees - COMPASS_BASE_ANGLE;
  const cutterDistance = 40 * trimProgress;
  const bladeExtension = 24 * bladeProgress;
  const rate = cutterRate(t);
  const speedGain = speedMultiplier(speed);

  const telemetry = {
    arcAngle: COMPASS_SWEEP * arcProgress,
    compassTravel: COMPASS_LENGTH * COMPASS_SWEEP * Math.PI / 180 * arcProgress,
    tsquarePosition: TSQUARE_TRAVEL * squareProgress,
    cutterSpeed: rate * speedGain,
    trimProgress: trimProgress * 100,
  };

  return {
    t,
    duration: DURATION,
    phase: t,
    phaseIndex: phase.index,
    phaseName: phase.name,
    phaseCode: phase.code,
    phaseLocal: phase.local,
    speed: clamp(Number(speed) || 0, 0, 100),
    playing: false,
    overlay: false,
    progress: { arc: arcProgress, square: squareProgress, trim: trimProgress, ribbon: ribbonProgress, blade: bladeProgress, reset: 1 - returning },
    compass: { degrees: compassDegrees, swingDegrees, spreadDegrees: COMPASS_SPREAD, radius: COMPASS_LENGTH, needle: { ...NEEDLE }, hinge, pencil },
    tsquare: { x: -TSQUARE_TRAVEL * squareProgress, renderX: -60 - TSQUARE_TRAVEL * squareProgress, position: TSQUARE_TRAVEL * squareProgress, y: 0, angle: 90 },
    cutter: { distance: cutterDistance, bladeExtension, thumbOffset: bladeExtension, angle: 55, baseX: 880, baseY: 320 },
    ribbon: { progress: ribbonProgress },
    telemetry,
  };
}

export const phaseForScrub = value => clamp(Number(value) || 0, 0, DURATION);
