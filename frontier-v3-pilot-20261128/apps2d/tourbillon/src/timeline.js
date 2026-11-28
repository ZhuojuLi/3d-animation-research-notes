/**
 * timeline.js — 16.0 s Seamless Periodic 3-Act Horology Choreography.
 *
 * Act I  (0.0 - 5.0 s)  : Full-movement panorama; sequential power-path illumination
 *                         from Barrel -> Center -> Third -> Fourth -> Escape -> Balance.
 * Act II (5.0 - 11.0 s) : Smooth zoom into the Escapement & Flying Tourbillon zone,
 *                         fading cutaway sapphire cover to reveal teeth/pallet stones/guide slot,
 *                         and entering slow motion (0.06x) for crystal-clear LOCK->RELEASE->IMPULSE.
 * Act III(11.0 - 16.0 s): Smooth pull back to full tourbillon + gear train + live diagnostics,
 *                         showcasing a full 120-deg symmetric flying tourbillon revolution
 *                         (20.000 s physical time = 80 balance cycles = 5+1/3 escape revs = 1/3 cage rev),
 *                         easing smoothly back to exact t = 0 speed & pose at t = 16.0 s.
 */

import { LOOP_DURATION, WORLD_WIDTH, WORLD_HEIGHT } from './state.js';

function clamp01(x) {
  return x <= 0 ? 0 : x >= 1 ? 1 : x;
}

function smootherstep(edge0, edge1, x) {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * t * (t * (t * 6 - 15) + 10);
}

/**
 * Raised cosine bump on [t0, t1]: 0 at edges, 1 at center, C1-smooth everywhere.
 * Integral over [t0, t1] is exactly 0.5 * (t1 - t0).
 */
function raisedCosine(t, t0, t1) {
  if (t <= t0 || t >= t1) return 0;
  const u = (t - t0) / (t1 - t0);
  return 0.5 * (1 - Math.cos(2 * Math.PI * u));
}

/**
 * Exact analytical integral of raisedCosine(s, t0, t1) from 0 to t.
 */
function integralRaisedCosine(t, t0, t1) {
  if (t <= t0) return 0;
  const w = t1 - t0;
  if (t >= t1) return 0.5 * w;
  const u = (t - t0) / w;
  return w * (0.5 * u - Math.sin(2 * Math.PI * u) / (4 * Math.PI));
}

// Target integrated physical time over 16.0 s default periodic cycle:
// 20.000000 s = 80.000 full 4 Hz balance cycles
//             = 80 / 15 = 5 + 1/3 revs of 3-spoke 15-tooth Escape Wheel (exact 120-deg symmetry!)
//             = 20 / 60 = 1/3 rev of 3-arm 60 s/rev Flying Tourbillon Cage (exact 120-deg symmetry!)
export const PERIODIC_PHYSICAL_TIME_S = 20.0;

// Smooth speed-rate envelope components (calibrated so exact integral over [0, 16] === 20.000000 s):
// Base rate = 0.25 (matches default Time Scale = 0.25x at t = 0 and t = 16!).
// Act II slow-motion dip on [5.2, 10.8] (width 5.6 s): amplitude -0.19 -> dips cleanly to 0.06x!
//   integral contribution = -0.19 * 2.8 = -0.532 s
// Base integral over 16.0 s = 16.0 * 0.25 = 4.000 s
// Act III tourbillon orbital showcase bell on [11.2, 15.6] (width 4.4 s):
//   need integral = 20.000 - (4.000 - 0.532) = 16.532 s
//   amplitude A3 = 16.532 / (0.5 * 4.4) = 7.51454545...
const BASE_RATE = 0.25;
const DIP_T0 = 5.2;
const DIP_T1 = 10.8;
const DIP_AMP = -0.19; // 0.25 - 0.19 = 0.06x in slow-mo peak!
const ORBIT_T0 = 11.2;
const ORBIT_T1 = 15.6;
const ORBIT_AMP = (PERIODIC_PHYSICAL_TIME_S - (LOOP_DURATION * BASE_RATE + 0.5 * (DIP_T1 - DIP_T0) * DIP_AMP)) / (0.5 * (ORBIT_T1 - ORBIT_T0));

/**
 * Exact instantaneous physical time rate d(tau)/dt at default timeScale = 0.25.
 * Note: rate(0) === rate(16) === 0.25 and rate'(0) === rate'(16) === 0 -> ZERO seam velocity jump!
 */
export function getBasePhysicalRate(tRaw) {
  const t = ((tRaw % LOOP_DURATION) + LOOP_DURATION) % LOOP_DURATION;
  return BASE_RATE + DIP_AMP * raisedCosine(t, DIP_T0, DIP_T1) + ORBIT_AMP * raisedCosine(t, ORBIT_T0, ORBIT_T1);
}

/**
 * Exact closed-form integrated physical time tau(t) on [0, 16.0] for default timeScale = 0.25.
 * Satisfies tau(0) = 0 and tau(16.0) = 20.000000000000 exactly.
 */
export function getPeriodicPhysicalTime(tRaw, userTimeScale = 0.25) {
  const clamped = Math.max(0, Math.min(LOOP_DURATION, tRaw));
  const baseTau =
    BASE_RATE * clamped +
    DIP_AMP * integralRaisedCosine(clamped, DIP_T0, DIP_T1) +
    ORBIT_AMP * integralRaisedCosine(clamped, ORBIT_T0, ORBIT_T1);
  return baseTau * (userTimeScale / BASE_RATE);
}

/**
 * Computes full camera, cutaway, power-path highlight, and act metadata at any time t in [0, 16].
 */
export function evaluateTimeline(tRaw, userCutawayOpacity = 85, userTimeScale = 0.25) {
  const t = Math.max(0, Math.min(LOOP_DURATION, tRaw));

  // Act classification
  let act = 1;
  let label = 'ACT I';
  let subtitle = 'POWER TRAIN PANORAMA';
  if (t >= 5.0 && t < 11.0) {
    act = 2;
    label = 'ACT II';
    subtitle = 'ESCAPEMENT SLOW-MOTION';
  } else if (t >= 11.0) {
    act = 3;
    label = 'ACT III';
    subtitle = 'TOURBILLON ORBIT & DIAGNOSTICS';
  }

  // Smooth zoom envelope for Act II macro inspection:
  // Ramps 0 -> 1 on [5.0, 6.7], holds steady plateau at 1.0 on [6.7, 9.5], eases 1 -> 0 on [9.5, 11.3].
  // At plateau (zoom = 2.48, center = (756, 260)):
  //   visible world X at 1280x720 is [554, 958], cleanly excluding all 4 upstream train gears (maxX <= 541)
  //   while framing Escape teeth + ruby pallet stones + Pallet Fork banking slot + Balance/Tourbillon Cage!
  const zoomIn = smootherstep(5.0, 6.7, t);
  const zoomOut = 1.0 - smootherstep(9.5, 11.3, t);
  const zoomBlend = zoomIn * zoomOut;

  const panX = WORLD_WIDTH * 0.5;
  const panY = WORLD_HEIGHT * 0.5;
  const focusX = 748.0;
  const focusY = 242.0;

  const camera = {
    centerX: panX + (focusX - panX) * zoomBlend,
    centerY: panY + (focusY - panY) * zoomBlend,
    zoom: 1.0 + 1.46 * zoomBlend,
  };

  // Effective cutaway opacity: during Act II zoom, gently opens sapphire cover to reveal internal escapement
  // while still honoring the user's #cutaway-opacity slider!
  const userOp = Math.max(0, Math.min(100, userCutawayOpacity)) / 100;
  const actCutawayFactor = 1.0 - 0.78 * zoomBlend;
  const effectiveCutawayOpacity = userOp * actCutawayFactor;

  // Act I sequential power-path illumination (0.0 -> 5.0 s):
  // Smoothly sweeps glowing energy highlight from Barrel -> Center -> Third -> Fourth -> Escape -> Balance
  // Starts at 0.0 at t=0 and fades back to 0.0 by t=5.0 so t=0 and t=16 match identically!
  const powerEnvelope = smootherstep(0.15, 0.75, t) * (1.0 - smootherstep(4.35, 4.95, t));
  const stageProgress = clamp01((t - 0.3) / 4.2) * 5.0; // 0..5 along the 6 power stages
  const powerWeights = [0, 1, 2, 3, 4, 5].map(idx => {
    if (powerEnvelope <= 0.001) return 0;
    const dist = Math.abs(stageProgress - idx);
    const local = Math.max(0, 1.0 - dist * 0.78);
    // Subtle trail keeping upstream nodes softly lit as energy reaches balance
    const trail = stageProgress > idx ? 0.28 : 0.0;
    return powerEnvelope * Math.max(local, trail);
  });

  // Act III tourbillon orbital showcase highlight (fades in after 11.2, completely 0 by 15.8 -> exact t=0 seam)
  const tourbillonHighlight = smootherstep(11.3, 12.1, t) * (1.0 - smootherstep(15.1, 15.8, t));

  const baseRate = getBasePhysicalRate(t);
  const effectiveTimeScale = baseRate * (userTimeScale / BASE_RATE);
  const isTimelapsePeak = t > 11.8 && t < 15.0 && effectiveTimeScale > 1.25;

  return {
    t,
    act,
    label,
    subtitle,
    zoomBlend,
    camera,
    effectiveCutawayOpacity,
    powerEnvelope,
    powerWeights, // [barrel, center, third, fourth, escape, balance]
    tourbillonHighlight,
    effectiveTimeScale,
    isTimelapsePeak,
  };
}
