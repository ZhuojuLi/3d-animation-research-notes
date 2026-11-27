import * as THREE from 'three';
import { wind } from './util.js';

// Viewer-driven states:
//  - doorFocus: camera close to / aimed at the portal -> candles flicker brighter, warm light spills out
//  - stepFocus: gaze lowered onto the near steps -> grass & distant trees sway more
export function createInteraction({ camera, controls, interior, params }) {
  const doorPt = new THREE.Vector3(0, 3.6, -2.0), stepPt = new THREE.Vector3(-2.5, 0.6, 6.5);
  const st = { door: 0, step: 0, doorTarget: 0, stepTarget: 0, override: null };
  const fwd = new THREE.Vector3(), to = new THREE.Vector3();
  function aim(pt, cone) {
    camera.getWorldDirection(fwd); to.subVectors(pt, camera.position);
    const dist = to.length(); to.normalize();
    const ang = Math.acos(THREE.MathUtils.clamp(fwd.dot(to), -1, 1));
    return { dist, a: 1 - THREE.MathUtils.smoothstep(ang, cone * 0.35, cone) };
  }
  function update(dt, t) {
    const d = aim(doorPt, 0.5), s = aim(stepPt, 0.6);
    // door: proximity OR centred gaze on the portal (orbit target near the door also counts)
    const near = 1 - THREE.MathUtils.smoothstep(d.dist, 5, 15);
    const tgtNear = 1 - THREE.MathUtils.smoothstep(controls.target.distanceTo(doorPt), 1.0, 4.5);
    st.doorTarget = Math.max(near * (0.4 + 0.6 * d.a), d.a * tgtNear, d.a * 0.35);
    // steps: looking down onto the near flight
    camera.getWorldDirection(fwd);
    const down = THREE.MathUtils.smoothstep(-fwd.y, 0.05, 0.4);
    st.stepTarget = Math.max(s.a * (0.5 + 0.5 * down), 1 - THREE.MathUtils.smoothstep(controls.target.distanceTo(stepPt), 1.5, 5));
    if (st.override) { st.doorTarget = st.override.door; st.stepTarget = st.override.step; }
    const k = 1 - Math.exp(-dt * 1.4);               // slow, gradual brightening
    st.door += (st.doorTarget - st.door) * k; st.step += (st.stepTarget - st.step) * k;

    // candles
    const D = st.door, base = params.candleBase, peak = params.candlePeak;
    const lvl = base + (peak - base) * D;
    interior.flames.forEach((f, i) => {
      const fl = 0.82 + 0.12 * Math.sin(t * 9.1 + f.seed) + 0.08 * Math.sin(t * 23.7 + f.seed * 3) + 0.05 * Math.sin(t * 3.3 + i);
      const amp = 0.5 + D * 1.0;
      f.flame.position.x = f.base.x + Math.sin(t * 6.3 + f.seed) * 0.006 * amp;
      f.flame.scale.set(1, (2.0 + 0.5 * fl) * (0.9 + 0.25 * D), 1);
      f.halo.scale.set(0.5 + 0.9 * D * fl, (0.5 + 0.9 * D * fl) * 1.2, 1);
      f.halo.material.opacity = 0.45 + 0.55 * D;
      f.flame.material.color.setRGB(1.0 * (1 + D * 2.5) * fl, 0.75 * (1 + D * 2.0) * fl, 0.38 * (1 + D));
    });
    const flick = 0.85 + 0.1 * Math.sin(t * 8.3) + 0.06 * Math.sin(t * 19.1) + 0.04 * Math.sin(t * 31.7);
    interior.candle.intensity = lvl * flick;
    interior.mid.intensity = lvl * 0.5 * (0.9 + 0.1 * Math.sin(t * 11.3 + 1));
    interior.spill.intensity = params.spillPeak * D * flick;

    // wind
    wind.uTime.value = t;
    wind.uWind.value = params.windBase + (params.windPeak - params.windBase) * st.step;
    wind.uTree.value = params.treeBase + (params.treePeak - params.treeBase) * st.step;
  }
  return { st, update };
}
