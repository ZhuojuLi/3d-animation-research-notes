/**
 * main.js — Application Entry Point for the Swiss Flying Tourbillon & Anchor Escapement Lab.
 *
 * Wires together LabStateStore, HorologySolver, Camera2D, Timeline choreography,
 * HorologyRenderer (Canvas 2D + SVG hybrid), DiagnosticsRenderer, and InteractionController.
 *
 * Exposes required deterministic verification hooks:
 * - window.__SCENE_READY__ = true
 * - window.renderAt(t)
 * - window.__2D_STATE__
 * - window.__getSceneState()
 * - window.__getKinematicState()
 */

import {
  LabStateStore,
  LOOP_DURATION,
  buildKinematicTelemetry,
} from './state.js';
import { HorologySolver } from './solver.js';
import { Camera2D } from './camera.js';
import { evaluateTimeline } from './timeline.js';
import { HorologyRenderer } from './renderer.js';
import { DiagnosticsRenderer } from './diagnostics.js';
import { InteractionController } from './interactions.js';

function bootHorologyLab() {
  const stageWrap = document.getElementById('stage-wrap');
  const canvas = document.getElementById('movement-canvas');
  const svg = document.getElementById('stage-svg');

  const store = new LabStateStore();
  const solver = new HorologySolver();
  const camera = new Camera2D();
  const renderer = new HorologyRenderer(canvas, svg);
  const diagnostics = new DiagnosticsRenderer();

  let rafId = null;
  let lastWallMs = 0;

  function resizeAll() {
    const rect = stageWrap.getBoundingClientRect();
    const cssW = Math.max(100, rect.width || 990);
    const cssH = Math.max(80, rect.height || 600);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    camera.resize(cssW, cssH, dpr);
    renderer.resize(cssW, cssH, dpr);
    diagnostics.resize();
  }

  function publishWindowState(frame, actInfo) {
    const telemetry = buildKinematicTelemetry(frame, actInfo, camera, store.params, store.mode);
    const compactState = {
      t: telemetry.t,
      time: telemetry.t,
      physicalTimeS: telemetry.physicalTimeS,
      act: telemetry.act,
      actLabel: telemetry.actLabel,
      mode: telemetry.mode,
      isPlaying: store.isPlaying,
      escapementState: telemetry.escapementState,
      amplitudeDeg: telemetry.amplitudeDeg,
      steadyAmplitudeDeg: telemetry.steadyAmplitudeDeg,
      frequencyHz: telemetry.frequencyHz,
      beatErrorMs: telemetry.beatErrorMs,
      balanceAngleDeg: telemetry.nodes.balanceWheel.angleDeg,
      balanceOmegaRadS: telemetry.nodes.balanceWheel.omegaRadS,
      tourbillonAngleDeg: telemetry.nodes.tourbillonCage.angleDeg,
      maxJointClosureErrorPx: telemetry.maxJointClosureErrorPx,
      cameraZoom: Number(camera.zoom.toFixed(4)),
    };
    window.__2D_STATE__ = compactState;
    window.__KINEMATIC_STATE__ = telemetry;
  }

  /**
   * Renders the current frame (either deterministic timeline sample or live interactive RK4 state).
   */
  function renderCurrentFrame() {
    resizeAll();
    const t = store.time;
    const actInfo = evaluateTimeline(t, store.params.cutawayOpacity, store.params.timeScale);

    // Keep full panorama camera when user is dragging balance wheel directly so dragging stays intuitive
    if (store.mode === 'interactive' && store.isDraggingBalance) {
      camera.setPose(actInfo.camera.centerX, actInfo.camera.centerY, actInfo.camera.zoom);
    } else {
      camera.setPose(actInfo.camera.centerX, actInfo.camera.centerY, actInfo.camera.zoom);
    }

    const frame =
      store.mode === 'interactive'
        ? solver.getLiveFrame(store.params)
        : solver.sampleDeterministic(t, store.params);

    store.lastFrame = frame;
    store.lastAct = actInfo;
    store.lastCamera = { centerX: camera.centerX, centerY: camera.centerY, zoom: camera.zoom };

    renderer.render(frame, actInfo, camera);
    diagnostics.render(frame, actInfo, store.params, store.mode === 'interactive');
    publishWindowState(frame, actInfo);
  }

  /**
   * Deterministic evaluation hook required by check_2d_v3.mjs and export_2d_mp4.mjs.
   * Calling renderAt(t) at any timestamp t in [0, 16] always produces pixel-identical frames!
   */
  function renderAt(tRaw) {
    const t = Math.max(0, Math.min(LOOP_DURATION, Number(tRaw) || 0));
    store.isPlaying = false;
    stopLoop();
    store.mode = 'deterministic';
    store.time = t;
    interactions.syncTransportButtons();
    renderCurrentFrame();
    return window.__2D_STATE__;
  }

  function stopLoop() {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  }

  function tick(nowMs) {
    if (!store.isPlaying) {
      rafId = null;
      return;
    }
    if (!lastWallMs) lastWallMs = nowMs;
    const dtWall = Math.min(0.05, Math.max(0, (nowMs - lastWallMs) / 1000));
    lastWallMs = nowMs;

    if (!store.isDraggingBalance && dtWall > 0) {
      if (store.mode === 'interactive') {
        solver.stepLive(dtWall, store.params, false);
        store.time = solver.live.t;
      } else {
        store.time = (store.time + dtWall) % LOOP_DURATION;
      }
      renderCurrentFrame();
    }

    rafId = requestAnimationFrame(tick);
  }

  function startLoop() {
    if (rafId !== null) return;
    lastWallMs = performance.now();
    rafId = requestAnimationFrame(tick);
  }

  function resetAll() {
    stopLoop();
    store.reset();
    solver.initLiveFromNominal();
    renderCurrentFrame();
  }

  const interactions = new InteractionController({
    store,
    solver,
    camera,
    stageWrap,
    canvas,
    onRenderNow: () => renderCurrentFrame(),
    onSeekDeterministic: t => {
      stopLoop();
      store.time = t;
      store.mode = 'deterministic';
      renderCurrentFrame();
    },
    onPlayStateChange: playing => {
      if (playing) startLoop();
      else stopLoop();
    },
    onReset: () => resetAll(),
  });

  // Expose deterministic & kinematic inspection API on window
  window.renderAt = renderAt;
  window.__getSceneState = () => window.__2D_STATE__;
  window.__getKinematicState = () => {
    if (store.lastFrame && store.lastAct) {
      return buildKinematicTelemetry(store.lastFrame, store.lastAct, camera, store.params, store.mode);
    }
    return window.__KINEMATIC_STATE__;
  };

  // Expose helper to advance live interactive RK4 deterministically by dt (useful for tests & debugging)
  window.__stepInteractive = dtSec => {
    if (store.mode !== 'interactive' && store.lastFrame) {
      solver.syncLiveFromFrame(store.lastFrame);
      store.mode = 'interactive';
    }
    solver.stepLive(Number(dtSec) || 0.016, store.params, false);
    store.time = solver.live.t;
    renderCurrentFrame();
    return window.__getKinematicState();
  };

  // Responsive resize handling for both 1280x720 and 1440x900 viewports
  if (typeof ResizeObserver === 'function') {
    const ro = new ResizeObserver(() => {
      renderCurrentFrame();
    });
    ro.observe(stageWrap);
  }
  window.addEventListener('resize', () => renderCurrentFrame());

  // Initial deterministic render at t = 0.0
  renderAt(0.0);
  window.__SCENE_READY__ = true;
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootHorologyLab, { once: true });
} else {
  bootHorologyLab();
}
