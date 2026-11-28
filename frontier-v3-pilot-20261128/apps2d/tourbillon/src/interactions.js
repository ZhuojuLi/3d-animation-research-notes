/**
 * interactions.js — Real-Time Parameter Controls, Transport Buttons, and Direct
 * Circular Balance Wheel Dragging on #movement-canvas.
 *
 * Controls wired:
 * - #hairspring-stiffness (0.60x - 1.40x): alters RK4 oscillator frequency & half-beat period
 * - #mainspring-torque    (0.40 - 1.20 N*mm): alters impulse torque & steady amplitude smoothly (0 angle jump!)
 * - #time-scale           (0.05x - 1.00x): coherently scales solver & diagnostic progression speed
 * - #cutaway-opacity      (0% - 100%): smoothly reveals gear teeth, pinions, ruby stones & guide slots
 * - #play, #pause, #scrub, #reset
 * - Direct pointer drag on #movement-canvas balance wheel: circular drag updates balance wheel angle
 *   and hairspring coils synchronously with zero axis detachment; pointer release resumes real RK4
 *   integration from the perturbed state producing a visible phase-portrait jump!
 */

import { LAYOUT, DEFAULT_PARAMS, LOOP_DURATION } from './state.js';

function updateSliderTrackFill(input) {
  if (!input) return;
  const min = Number(input.min);
  const max = Number(input.max);
  const val = Number(input.value);
  const pct = max > min ? ((val - min) / (max - min)) * 100 : 0;
  input.style.setProperty('--pct', `${Math.max(0, Math.min(100, pct)).toFixed(2)}%`);
}

export class InteractionController {
  constructor({ store, solver, camera, stageWrap, canvas, onRenderNow, onSeekDeterministic, onPlayStateChange, onReset }) {
    this.store = store;
    this.solver = solver;
    this.camera = camera;
    this.stageWrap = stageWrap;
    this.canvas = canvas;
    this.onRenderNow = onRenderNow;
    this.onSeekDeterministic = onSeekDeterministic;
    this.onPlayStateChange = onPlayStateChange;
    this.onReset = onReset;

    // DOM elements
    this.elStiffness = document.getElementById('hairspring-stiffness');
    this.elStiffnessVal = document.getElementById('stiffness-val');
    this.elTorque = document.getElementById('mainspring-torque');
    this.elTorqueVal = document.getElementById('torque-val');
    this.elTimeScale = document.getElementById('time-scale');
    this.elTimeScaleVal = document.getElementById('timescale-val');
    this.elCutaway = document.getElementById('cutaway-opacity');
    this.elCutawayVal = document.getElementById('cutaway-val');
    this.elPlay = document.getElementById('play');
    this.elPause = document.getElementById('pause');
    this.elReset = document.getElementById('reset');
    this.elScrub = document.getElementById('scrub');

    // Drag tracking state
    this.activePointerId = null;
    this.prevPointerAngle = 0;
    this.dragAccumAngle = 0;
    this.wasPlayingBeforeDrag = false;

    this.bindSliders();
    this.bindTransport();
    this.bindCanvasBalanceDrag();
    this.syncSliderReadouts();
  }

  syncSliderReadouts() {
    const p = this.store.params;
    if (this.elStiffness) {
      this.elStiffness.value = p.stiffness.toFixed(2);
      updateSliderTrackFill(this.elStiffness);
    }
    if (this.elStiffnessVal) this.elStiffnessVal.textContent = `${p.stiffness.toFixed(2)}\u00d7`;

    if (this.elTorque) {
      this.elTorque.value = p.torque.toFixed(2);
      updateSliderTrackFill(this.elTorque);
    }
    if (this.elTorqueVal) this.elTorqueVal.textContent = `${p.torque.toFixed(2)} N\u00b7mm`;

    if (this.elTimeScale) {
      this.elTimeScale.value = p.timeScale.toFixed(2);
      updateSliderTrackFill(this.elTimeScale);
    }
    if (this.elTimeScaleVal) this.elTimeScaleVal.textContent = `${p.timeScale.toFixed(2)}\u00d7`;

    if (this.elCutaway) {
      this.elCutaway.value = String(Math.round(p.cutawayOpacity));
      updateSliderTrackFill(this.elCutaway);
    }
    if (this.elCutawayVal) this.elCutawayVal.textContent = `${Math.round(p.cutawayOpacity)}%`;

    if (this.elScrub) {
      updateSliderTrackFill(this.elScrub);
    }

    this.syncTransportButtons();
  }

  syncTransportButtons() {
    if (this.elPlay) this.elPlay.classList.toggle('active', this.store.isPlaying);
    if (this.elPause) this.elPause.classList.toggle('active', !this.store.isPlaying);
  }

  bindSliders() {
    const enterLiveWithoutJump = () => {
      if (this.store.mode !== 'interactive' && this.store.lastFrame) {
        this.solver.syncLiveFromFrame(this.store.lastFrame);
        this.store.mode = 'interactive';
      }
    };

    if (this.elStiffness) {
      const handleStiffness = () => {
        const val = Math.max(0.6, Math.min(1.4, Number(this.elStiffness.value)));
        enterLiveWithoutJump();
        this.store.setParam('stiffness', val);
        this.syncSliderReadouts();
        this.onRenderNow();
      };
      this.elStiffness.addEventListener('input', handleStiffness);
      this.elStiffness.addEventListener('change', handleStiffness);
    }

    if (this.elTorque) {
      const handleTorque = () => {
        const val = Math.max(0.4, Math.min(1.2, Number(this.elTorque.value)));
        // Preserve exact (theta, omega) so changing mainspring torque NEVER causes an angle jump!
        enterLiveWithoutJump();
        this.store.setParam('torque', val);
        this.syncSliderReadouts();
        this.onRenderNow();
      };
      this.elTorque.addEventListener('input', handleTorque);
      this.elTorque.addEventListener('change', handleTorque);
    }

    if (this.elTimeScale) {
      const handleTimeScale = () => {
        const val = Math.max(0.05, Math.min(1.0, Number(this.elTimeScale.value)));
        enterLiveWithoutJump();
        this.store.setParam('timeScale', val);
        this.syncSliderReadouts();
        this.onRenderNow();
      };
      this.elTimeScale.addEventListener('input', handleTimeScale);
      this.elTimeScale.addEventListener('change', handleTimeScale);
    }

    if (this.elCutaway) {
      const handleCutaway = () => {
        const val = Math.max(0, Math.min(100, Number(this.elCutaway.value)));
        this.store.setParam('cutawayOpacity', val);
        this.syncSliderReadouts();
        this.onRenderNow();
      };
      this.elCutaway.addEventListener('input', handleCutaway);
      this.elCutaway.addEventListener('change', handleCutaway);
    }
  }

  bindTransport() {
    if (this.elPlay) {
      this.elPlay.addEventListener('click', () => {
        this.store.isPlaying = true;
        this.syncTransportButtons();
        this.onPlayStateChange(true);
      });
    }

    if (this.elPause) {
      this.elPause.addEventListener('click', () => {
        this.store.isPlaying = false;
        this.syncTransportButtons();
        this.onPlayStateChange(false);
      });
    }

    if (this.elReset) {
      this.elReset.addEventListener('click', () => {
        this.onReset();
        this.syncSliderReadouts();
      });
    }

    if (this.elScrub) {
      const handleScrub = () => {
        const t = Math.max(0, Math.min(LOOP_DURATION, Number(this.elScrub.value)));
        updateSliderTrackFill(this.elScrub);
        this.store.isPlaying = false;
        this.store.mode = 'deterministic';
        this.syncTransportButtons();
        this.onSeekDeterministic(t);
      };
      this.elScrub.addEventListener('input', handleScrub);
      this.elScrub.addEventListener('change', handleScrub);
    }
  }

  /**
   * Computes angle around the balance wheel pivot from a pointer event on #movement-canvas.
   */
  getPointerBalanceInfo(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    const sx = clientX - rect.left;
    const sy = clientY - rect.top;
    const world = this.camera.screenToWorld(sx, sy);
    const bx = LAYOUT.balance.x;
    const by = LAYOUT.balance.y;
    const dx = world.x - bx;
    const dy = world.y - by;
    const dist = Math.hypot(dx, dy);
    const angle = Math.atan2(dy, dx);
    return { world, dist, angle };
  }

  isOverBalanceWheel(dist) {
    return dist >= 14 && dist <= LAYOUT.balance.cageOuterRadius + 10;
  }

  bindCanvasBalanceDrag() {
    const onPointerDown = ev => {
      if (ev.button !== undefined && ev.button !== 0) return;
      const info = this.getPointerBalanceInfo(ev.clientX, ev.clientY);
      if (!this.isOverBalanceWheel(info.dist)) return;

      ev.preventDefault();
      this.activePointerId = ev.pointerId ?? 1;
      if (this.canvas.setPointerCapture && ev.pointerId !== undefined) {
        try {
          this.canvas.setPointerCapture(ev.pointerId);
        } catch {
          // ignore synthetic pointer events without active OS pointer
        }
      }

      this.wasPlayingBeforeDrag = this.store.isPlaying;
      this.store.isDraggingBalance = true;
      this.stageWrap.classList.add('is-dragging');

      // Sync live RK4 state cleanly from current rendered frame so drag starts with zero jump
      if (this.store.mode !== 'interactive' && this.store.lastFrame) {
        this.solver.syncLiveFromFrame(this.store.lastFrame);
      }
      this.store.mode = 'interactive';
      this.prevPointerAngle = info.angle;
      this.dragAccumAngle = this.solver.live.theta;
    };

    const onPointerMove = ev => {
      const info = this.getPointerBalanceInfo(ev.clientX, ev.clientY);
      if (!this.store.isDraggingBalance) {
        this.stageWrap.classList.toggle('can-drag', this.isOverBalanceWheel(info.dist));
        return;
      }

      ev.preventDefault();
      // Shortest signed circular angular delta
      let dAng = info.angle - this.prevPointerAngle;
      while (dAng > Math.PI) dAng -= Math.PI * 2;
      while (dAng < -Math.PI) dAng += Math.PI * 2;
      this.prevPointerAngle = info.angle;

      // Amplify gently (1.65x) so a crisp circular gesture easily sweeps +/- 180+ deg on the balance wheel
      this.dragAccumAngle += dAng * 1.65;
      this.solver.applyManualBalanceDrag(this.dragAccumAngle, this.store.params);
      this.onRenderNow();
    };

    const finishDrag = ev => {
      if (!this.store.isDraggingBalance) return;
      this.store.isDraggingBalance = false;
      this.activePointerId = null;
      this.stageWrap.classList.remove('is-dragging');

      if (this.canvas.releasePointerCapture && ev && ev.pointerId !== undefined) {
        try {
          this.canvas.releasePointerCapture(ev.pointerId);
        } catch {
          // ignore
        }
      }

      // Release balance wheel from rest (omega = 0) at perturbed angle & immediately resume real RK4 integration!
      this.solver.releaseManualBalanceDrag(this.store.params);
      this.store.isPlaying = true;
      this.syncTransportButtons();
      this.onPlayStateChange(true);
      this.onRenderNow();
    };

    this.canvas.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', finishDrag);
    window.addEventListener('pointercancel', finishDrag);

    // Also support classic mouse events if synthetic mouse drags are dispatched
    this.canvas.addEventListener('mousedown', ev => {
      if (this.store.isDraggingBalance) return;
      onPointerDown(ev);
    });
    window.addEventListener('mousemove', ev => {
      if (!this.store.isDraggingBalance) {
        const info = this.getPointerBalanceInfo(ev.clientX, ev.clientY);
        this.stageWrap.classList.toggle('can-drag', this.isOverBalanceWheel(info.dist));
        return;
      }
      onPointerMove(ev);
    });
    window.addEventListener('mouseup', ev => {
      if (this.store.isDraggingBalance) finishDrag(ev);
    });
  }
}
