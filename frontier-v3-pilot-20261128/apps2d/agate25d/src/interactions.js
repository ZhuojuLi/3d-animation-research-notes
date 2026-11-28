/**
 * Coupled Domain Interactions & Transport Controls (`interactions.js`).
 *
 * Implements all four tightly coupled geological museum interactions + transport controls:
 *   1. Direct `#scene-canvas` click on projected 64-vertex agate polygons (unique selection, <=250ms
 *      contour-fitted spotlight & transmittance ramp, synced info readout, strict gap rejection).
 *   2. Direct canvas drag on projected task lamp shade <-> `#lamp-elevation` (`15°–75°`) bidirectional sync.
 *   3. `#backlight-intensity` (`20%–100%`) isolated to cabinet backlight & agate transmittance contrast.
 *   4. `#polisher-speed` (`0–1200 rpm`) driving dual wheels, highlights & micro-vibration; clean stop at 0; frozen on pause.
 *   5. `#play`, `#pause`, `#scrub`, `#reset` deterministic controls.
 */

import { clamp, resetStateToDefaults, computeWheelKinematics } from './state.js';
import { hitTestAgateSlices } from './agates.js';
import { hitTestLampShade } from './workbench.js';

export function bindInteractions({
  canvas,
  camera,
  slices,
  state,
  getLastLampIK,
  onRenderCurrent,
  onRenderAtTime,
  onSyncHud,
}) {
  const elPlay = document.getElementById('play');
  const elPause = document.getElementById('pause');
  const elReset = document.getElementById('reset');
  const elScrub = document.getElementById('scrub');
  const elLamp = document.getElementById('lamp-elevation');
  const elBacklight = document.getElementById('backlight-intensity');
  const elSpeed = document.getElementById('polisher-speed');

  let dragActive = false;
  let dragStartY = 0;
  let dragStartElev = state.lampElevationDeg;
  let dragMovedPx = 0;
  let selectionRampRaf = null;

  function toCanvasCoords(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const sx = canvas.width / (rect.width || 1);
    const sy = canvas.height / (rect.height || 1);
    return {
      x: (clientX - rect.left) * sx,
      y: (clientY - rect.top) * sy,
    };
  }

  /**
   * Smooth <= 180ms contour-fitted spotlight ramp after clicking an agate slice (well within 250ms target),
   * cleanly stopping once `selectionProgress === 1` so paused frames stay 100% static afterward.
   */
  function startSelectionFocusRamp() {
    if (selectionRampRaf !== null) {
      cancelAnimationFrame(selectionRampRaf);
      selectionRampRaf = null;
    }
    const durationMs = 165;
    const t0 = performance.now();
    state.selectionChangedAtMs = t0;
    state.selectionLatencyMs = 0;
    state.selectionProgress = 0.28;
    onRenderCurrent();

    const step = now => {
      const elapsed = now - t0;
      const p = clamp(elapsed / durationMs, 0, 1);
      // Cubic ease-out for crisp museum spotlight ignition within <= 250ms
      state.selectionProgress = 0.28 + 0.72 * (1 - Math.pow(1 - p, 3));
      state.selectionLatencyMs = Number(elapsed.toFixed(1));
      onRenderCurrent();
      if (p < 1 && state.selectedSliceId !== null) {
        selectionRampRaf = requestAnimationFrame(step);
      } else {
        state.selectionProgress = state.selectedSliceId !== null ? 1.0 : 0.0;
        state.selectionLatencyMs = Number((performance.now() - t0).toFixed(1));
        selectionRampRaf = null;
        onRenderCurrent();
      }
    };
    selectionRampRaf = requestAnimationFrame(step);
  }

  function applyLampElevation(nextDeg) {
    const clamped = Math.round(clamp(Number(nextDeg) || 44, 15, 75));
    state.lampElevationDeg = clamped;
    if (elLamp) elLamp.value = String(clamped);
    onSyncHud();
    onRenderCurrent();
  }

  function applyBacklightIntensity(nextPct) {
    const clamped = Math.round(clamp(Number(nextPct) || 84, 20, 100));
    state.backlightIntensityPct = clamped;
    if (elBacklight) elBacklight.value = String(clamped);
    onSyncHud();
    onRenderCurrent();
  }

  function applyPolisherSpeed(nextRpm) {
    const clamped = Math.round(clamp(Number(nextRpm) || 0, 0, 1200));
    state.polisherSpeedRpm = clamped;
    if (elSpeed) elSpeed.value = String(clamped);
    computeWheelKinematics(state, state.t);
    onSyncHud();
    onRenderCurrent();
  }

  // ==================== DIRECT CANVAS POINTER INTERACTIONS ====================
  canvas.addEventListener('pointerdown', ev => {
    const pt = toCanvasCoords(ev.clientX, ev.clientY);
    const lampIK = getLastLampIK();

    // Priority 1: Check projected task lamp shade polygon for elevation drag
    if (hitTestLampShade(lampIK, pt.x, pt.y)) {
      dragActive = true;
      state.draggingLamp = true;
      dragStartY = ev.clientY;
      dragStartElev = state.lampElevationDeg;
      dragMovedPx = 0;
      canvas.style.cursor = 'grabbing';
      try {
        canvas.setPointerCapture(ev.pointerId);
      } catch {
        // Synthetic pointer events in headless tests may not carry an active browser pointerId
      }
      onRenderCurrent();
      return;
    }

    // Priority 2: Direct projected polygon hit-testing across all 16 agate slices
    // Clicking negative-space gap between slices returns null and must NEVER select a slice!
    const hitSlice = hitTestAgateSlices(slices, camera, pt.x, pt.y);
    if (hitSlice) {
      state.selectedSliceId = hitSlice.id;
      state.selectionChangedAtMs = performance.now();
      onSyncHud();
      startSelectionFocusRamp();
    } else {
      // Clear selection cleanly if user clicks empty negative space
      if (selectionRampRaf !== null) {
        cancelAnimationFrame(selectionRampRaf);
        selectionRampRaf = null;
      }
      if (state.selectedSliceId !== null) {
        state.selectedSliceId = null;
        state.selectionProgress = 0;
        onSyncHud();
        onRenderCurrent();
      }
    }
  });

  canvas.addEventListener('pointermove', ev => {
    const pt = toCanvasCoords(ev.clientX, ev.clientY);
    if (dragActive) {
      const dy = dragStartY - ev.clientY; // dragging upward increases elevation angle (15° -> 75°)
      dragMovedPx = Math.max(dragMovedPx, Math.abs(dy));
      const sensitivityDegPerPx = 0.42;
      applyLampElevation(dragStartElev + dy * sensitivityDegPerPx);
      return;
    }

    const lampIK = getLastLampIK();
    const overLamp = hitTestLampShade(lampIK, pt.x, pt.y);
    const overSlice = overLamp ? null : hitTestAgateSlices(slices, camera, pt.x, pt.y);
    const nextHoverSliceId = overSlice ? overSlice.id : null;

    const changed = state.hoverLamp !== overLamp || state.hoverSliceId !== nextHoverSliceId;
    state.hoverLamp = overLamp;
    state.hoverSliceId = nextHoverSliceId;

    if (overLamp) canvas.style.cursor = 'grab';
    else if (overSlice) canvas.style.cursor = 'pointer';
    else canvas.style.cursor = 'default';

    if (changed && !state.playing) {
      onRenderCurrent();
    }
  });

  const endLampDrag = ev => {
    if (!dragActive) return;
    dragActive = false;
    state.draggingLamp = false;
    canvas.style.cursor = state.hoverLamp ? 'grab' : 'default';
    if (ev && ev.pointerId !== undefined) {
      try {
        canvas.releasePointerCapture(ev.pointerId);
      } catch {}
    }
    onRenderCurrent();
  };
  canvas.addEventListener('pointerup', endLampDrag);
  canvas.addEventListener('pointercancel', endLampDrag);
  window.addEventListener('pointerup', endLampDrag);

  // ==================== SLIDER & TRANSPORT CONTROL BINDINGS ====================
  if (elLamp) {
    const onLampInput = () => applyLampElevation(elLamp.value);
    elLamp.addEventListener('input', onLampInput);
    elLamp.addEventListener('change', onLampInput);
  }

  if (elBacklight) {
    const onBacklightInput = () => applyBacklightIntensity(elBacklight.value);
    elBacklight.addEventListener('input', onBacklightInput);
    elBacklight.addEventListener('change', onBacklightInput);
  }

  if (elSpeed) {
    const onSpeedInput = () => applyPolisherSpeed(elSpeed.value);
    elSpeed.addEventListener('input', onSpeedInput);
    elSpeed.addEventListener('change', onSpeedInput);
  }

  if (elPlay) {
    elPlay.addEventListener('click', () => {
      state.playing = true;
      onSyncHud();
    });
  }

  if (elPause) {
    elPause.addEventListener('click', () => {
      state.playing = false;
      onSyncHud();
    });
  }

  if (elScrub) {
    const onScrubInput = () => {
      state.playing = false;
      const val = clamp(Number(elScrub.value) || 0, 0, state.duration);
      onRenderAtTime(val);
    };
    elScrub.addEventListener('input', onScrubInput);
    elScrub.addEventListener('change', onScrubInput);
  }

  if (elReset) {
    elReset.addEventListener('click', () => {
      if (selectionRampRaf !== null) {
        cancelAnimationFrame(selectionRampRaf);
        selectionRampRaf = null;
      }
      resetStateToDefaults(state);
      if (elLamp) elLamp.value = String(state.lampElevationDeg);
      if (elBacklight) elBacklight.value = String(state.backlightIntensityPct);
      if (elSpeed) elSpeed.value = String(state.polisherSpeedRpm);
      if (elScrub) elScrub.value = '0';
      onRenderAtTime(0);
    });
  }

  return {
    applyLampElevation,
    applyBacklightIntensity,
    applyPolisherSpeed,
  };
}
