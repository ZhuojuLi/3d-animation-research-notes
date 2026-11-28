/**
 * 16.0s Seamless Periodic 3-Act Museum Camera Choreography (`timeline.js`).
 *
 * Uses offline local GSAP (`window.gsap`) to construct a paused deterministic master timeline:
 *   - Act 1 (0.0s – 5.0s): Panorama establishing & slow dolly revealing all 4 gallery zones
 *   - Act 2 (5.0s – 11.0s): Agate wall macro study showing transmitted banding, rim thickness & spotlight sweep
 *   - Act 3 (11.0s – 16.0s): Articulated task lamp + dual-wheel polisher close-up returning smoothly in 14.6–16.0s
 *                            to exact `t = 0` panorama pose with zero seam jump
 */

import { SCENE_DURATION, wrapTime } from './state.js';
import { HERO_CAMERA } from './projection25d.js';

export const ACT_META = Object.freeze([
  { index: 1, name: 'panorama', start: 0.0, end: 5.0, label: 'Act 1 · 全景建立' },
  { index: 2, name: 'agate_macro', start: 5.0, end: 11.0, label: 'Act 2 · 玛瑙微距' },
  { index: 3, name: 'polisher_closeup', start: 11.0, end: 16.0, label: 'Act 3 · 抛光工坊' },
]);

export function resolveActInfo(t) {
  const wt = wrapTime(t, SCENE_DURATION);
  if (wt < 5.0) return ACT_META[0];
  if (wt < 11.0) return ACT_META[1];
  return ACT_META[2];
}

/**
 * Builds the paused deterministic GSAP timeline controlling the unified 2.5D camera & macro spotlight sweep.
 */
export function createSceneTimeline() {
  const rig = {
    x: HERO_CAMERA.x,
    y: HERO_CAMERA.y,
    z: HERO_CAMERA.z,
    yawDeg: HERO_CAMERA.yawDeg,
    pitchDeg: HERO_CAMERA.pitchDeg,
    focal: HERO_CAMERA.focal,
    cx: HERO_CAMERA.cx,
    cy: HERO_CAMERA.cy,
    macroSpotlightPhase: 0,
  };

  const gsapRef = typeof window !== 'undefined' ? window.gsap : null;
  if (!gsapRef || typeof gsapRef.timeline !== 'function') {
    throw new Error('Offline GSAP runtime (vendor/gsap/gsap.min.js) is required');
  }

  const tl = gsapRef.timeline({ paused: true });

  // ==================== ACT 1 (0.0s -> 5.0s): Panorama Establishing & Gentle Dolly ====================
  // Smooth gentle dolly-in and slight gallery breathing pan from exact HERO_CAMERA
  tl.to(
    rig,
    {
      x: 4.82,
      y: 2.48,
      z: 1.72,
      yawDeg: 33.4,
      pitchDeg: 0.0,
      focal: 1418.0,
      cx: 768.0,
      cy: 368.0,
      macroSpotlightPhase: 0.0,
      duration: 4.0,
      ease: 'sine.inOut',
    },
    0.0
  );

  // ==================== ACT 1 -> ACT 2 Transition (4.0s -> 5.4s): Glide to Agate Macro ====================
  tl.to(
    rig,
    {
      x: 2.38,
      y: 2.20,
      z: -0.58,
      yawDeg: 58.0,
      pitchDeg: 0.0,
      focal: 1580.0,
      cx: 768.0,
      cy: 472.0,
      macroSpotlightPhase: 0.05,
      duration: 1.4,
      ease: 'power2.inOut',
    },
    4.0
  );

  // ==================== ACT 2 (5.4s -> 10.2s): Agate Wall Macro Study ====================
  // Intimate lateral macro glide showcasing feather plumes, translucent dendrites & concentric fortification bands
  tl.to(
    rig,
    {
      x: 2.32,
      y: 2.02,
      z: -2.05,
      yawDeg: 55.5,
      pitchDeg: 0.0,
      focal: 1640.0,
      cx: 768.0,
      cy: 492.0,
      macroSpotlightPhase: 0.56,
      duration: 2.4,
      ease: 'sine.inOut',
    },
    5.4
  );

  tl.to(
    rig,
    {
      x: 2.46,
      y: 2.12,
      z: -3.28,
      yawDeg: 53.0,
      pitchDeg: 0.0,
      focal: 1595.0,
      cx: 768.0,
      cy: 468.0,
      macroSpotlightPhase: 1.0,
      duration: 2.4,
      ease: 'sine.inOut',
    },
    7.8
  );

  // ==================== ACT 2 -> ACT 3 Transition (10.2s -> 11.5s): Sweep to Polishing Bench ====================
  tl.to(
    rig,
    {
      x: 4.86,
      y: 1.88,
      z: -2.28,
      yawDeg: 27.6,
      pitchDeg: -4.2,
      focal: 1640.0,
      cx: 768.0,
      cy: 422.0,
      macroSpotlightPhase: 0.0,
      duration: 1.3,
      ease: 'power2.inOut',
    },
    10.2
  );

  // ==================== ACT 3 (11.5s -> 14.5s): Lamp + Dual-Wheel Polisher Close-Up ====================
  // Subtle orbit around articulated task lamp, spinning grinding wheels, arbor & foreground core-box corner
  tl.to(
    rig,
    {
      x: 4.66,
      y: 1.78,
      z: -2.52,
      yawDeg: 25.4,
      pitchDeg: -3.8,
      focal: 1680.0,
      cx: 768.0,
      cy: 432.0,
      macroSpotlightPhase: 0.0,
      duration: 3.0,
      ease: 'sine.inOut',
    },
    11.5
  );

  // ==================== ACT 3 Return (14.5s -> 16.0s): Smooth Return to Exact t = 0 Panorama ====================
  tl.to(
    rig,
    {
      x: HERO_CAMERA.x,
      y: HERO_CAMERA.y,
      z: HERO_CAMERA.z,
      yawDeg: HERO_CAMERA.yawDeg,
      pitchDeg: HERO_CAMERA.pitchDeg,
      focal: HERO_CAMERA.focal,
      cx: HERO_CAMERA.cx,
      cy: HERO_CAMERA.cy,
      macroSpotlightPhase: 0.0,
      duration: 1.5,
      ease: 'power2.inOut',
    },
    14.5
  );

  /**
   * Evaluates deterministic camera & choreography state at any timestamp `t` in `[0, 16]`.
   */
  function evaluateAt(t) {
    const wt = wrapTime(t, SCENE_DURATION);
    tl.time(wt, false);
    const act = resolveActInfo(wt);
    return {
      t: wt,
      act,
      camera: {
        x: rig.x,
        y: rig.y,
        z: rig.z,
        yawDeg: rig.yawDeg,
        pitchDeg: rig.pitchDeg,
        focal: rig.focal,
        cx: rig.cx,
        cy: rig.cy,
      },
      macroSpotlightPhase: rig.macroSpotlightPhase,
    };
  }

  return { tl, rig, evaluateAt };
}
