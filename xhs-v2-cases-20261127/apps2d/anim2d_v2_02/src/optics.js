/** Pure optical math. Every function is deterministic and side-effect free. */
export const DURATION = 8;
export const F_STOPS = [1.7, 2, 2.5, 3.2, 4, 5.6, 8, 11, 16];
export const FOCUS_STOPS = [0.7, 1, 1.5, 3, 5, 10, Infinity];

export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
export const lerp = (a, b, amount) => a + (b - a) * amount;
export const smooth = value => {
  const x = clamp(value, 0, 1);
  return x * x * (3 - 2 * x);
};
export const phase = (time, start, end) => smooth((time - start) / (end - start));

export function apertureRadius(fNumber) {
  const f = clamp(Number(fNumber) || 2.5, 1.7, 16);
  const normalized = (Math.log(16) - Math.log(f)) / (Math.log(16) - Math.log(1.7));
  return lerp(8, 51, normalized);
}

export function nearestStop(value, stops) {
  return stops.reduce((best, item, index) => {
    const bestDistance = Math.abs(stops[best] - value);
    return Math.abs(item - value) < bestDistance ? index : best;
  }, 0);
}

export function stepAperture(value, direction) {
  const index = nearestStop(value, F_STOPS);
  return F_STOPS[clamp(index + Math.sign(direction), 0, F_STOPS.length - 1)];
}

/** Logarithmic focus scale: 0 is 0.7 m, 1 is infinity. */
export function normalizedToDistance(value) {
  const n = clamp(Number(value) || 0, 0, 1);
  if (n >= 0.9995) return Infinity;
  return 0.7 * Math.exp(n * Math.log(50 / 0.7));
}

export function distanceToNormalized(distance) {
  if (!Number.isFinite(distance)) return 1;
  return clamp(Math.log(clamp(distance, 0.7, 50) / 0.7) / Math.log(50 / 0.7), 0, 1);
}

export function stepFocus(distance, direction) {
  const finiteDistance = Number.isFinite(distance) ? distance : 1000000;
  let index = FOCUS_STOPS.findIndex(item => Math.abs(item - finiteDistance) < 0.03);
  if (index < 0) {
    index = direction > 0
      ? FOCUS_STOPS.findIndex(item => item > finiteDistance)
      : FOCUS_STOPS.findLastIndex(item => item < finiteDistance);
    if (index < 0) index = direction > 0 ? FOCUS_STOPS.length - 1 : 0;
    return FOCUS_STOPS[index];
  }
  return FOCUS_STOPS[clamp(index + Math.sign(direction), 0, FOCUS_STOPS.length - 1)];
}

export function formatDistance(distance) {
  if (!Number.isFinite(distance)) return '∞';
  if (distance < 10) return distance.toFixed(distance < 1 ? 1 : 2).replace(/0$/, '');
  return Math.round(distance).toString();
}

export function focusTravel(distance) {
  // Near focus moves the floating group forward (towards the front element).
  return lerp(-17, 12, distanceToNormalized(distance));
}

export function timelinePhase(time) {
  if (time < 2) return 'lens';
  if (time < 4) return 'aperture';
  if (time < 6) return 'focus';
  return 'exposure';
}

export const FINISHES = {
  silver: {
    label: 'Silver / black', metalLight: '#e4e0d4', metalMid: '#a9a99f',
    metalDark: '#686d69', leather: '#252a28', edge: '#353a37', accent: '#862f35',
  },
  black: {
    label: 'All black', metalLight: '#555b57', metalMid: '#292e2c',
    metalDark: '#111514', leather: '#151a18', edge: '#0a0d0c', accent: '#a04448',
  },
  champagne: {
    label: 'Champagne titanium', metalLight: '#e0d2b5', metalMid: '#b5a485',
    metalDark: '#706855', leather: '#30332e', edge: '#4d4a3e', accent: '#8a3c3b',
  },
};
