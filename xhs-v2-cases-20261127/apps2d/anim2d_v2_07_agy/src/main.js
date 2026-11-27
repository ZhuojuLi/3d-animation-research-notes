/**
 * Main workbench orchestrator for 'Four-Stroke DOHC Engine Workbench'.
 * Exposes deterministic window.renderAt(t), window.__getSceneState(), and window.__SCENE_READY__.
 */

import {
  DEFAULT_RPM,
  DEFAULT_SPARK_ADVANCE,
  normalizeCycleTime,
  evaluateCycleState,
  clamp,
} from './cycle.js';
import { createEngineStage, renderEngineStage } from './engine.js';
import { createAnalysisPanels, renderAnalysisPanels } from './panels.js';
import { bindControls } from './controls.js';

function initWorkbench() {
  const stageSvg = document.getElementById('stage');
  const pvSvg = document.getElementById('pv-chart');
  const phaseSvg = document.getElementById('phase-wheel');

  const telemetryDom = {
    rpm: document.getElementById('telemetry-rpm'),
    pressure: document.getElementById('telemetry-pressure'),
    temperature: document.getElementById('telemetry-temperature'),
    crankAngle: document.getElementById('telemetry-crank-angle'),
  };

  const controlDom = {
    play: document.getElementById('play'),
    pause: document.getElementById('pause'),
    scrub: document.getElementById('scrub'),
    scrubValue: document.getElementById('scrub-value'),
    cycleFillClip: document.getElementById('cycle-fill-clip-rect'),
    cycleCursorGroup: document.getElementById('cycle-cursor-group'),
    rpmSlider: document.getElementById('rpm-slider'),
    rpmValue: document.getElementById('rpm-value'),
    sparkSlider: document.getElementById('spark-slider'),
    sparkValue: document.getElementById('spark-value'),
    strokeIntake: document.getElementById('stroke-intake'),
    strokeCompression: document.getElementById('stroke-compression'),
    strokePower: document.getElementById('stroke-power'),
    strokeExhaust: document.getElementById('stroke-exhaust'),
    strokeAll: document.getElementById('stroke-all'),
    liveDot: document.getElementById('live-dot'),
  };

  const engineRefs = createEngineStage(stageSvg);
  const panelRefs = createAnalysisPanels(pvSvg, phaseSvg, telemetryDom);

  const settings = {
    time: 0,
    playing: true,
    rpm: DEFAULT_RPM,
    sparkAdvance: DEFAULT_SPARK_ADVANCE,
    isolatedStroke: null,
  };

  let rafId = null;
  let lastNow = 0;
  let latestState = null;

  function stopRafOnly() {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    settings.playing = false;
  }

  let controlsBinding = null;

  function commitRender(rawTime) {
    settings.time = normalizeCycleTime(rawTime);
    latestState = evaluateCycleState(settings.time, settings);
    renderEngineStage(engineRefs, latestState);
    renderAnalysisPanels(panelRefs, latestState);
    if (controlsBinding) {
      controlsBinding.syncControlsUI(latestState);
    }
    return latestState;
  }

  function stepAnimation(now) {
    if (!settings.playing) return;
    const dt = clamp((now - lastNow) / 1000, 0, 0.1);
    lastNow = now;
    commitRender(settings.time + dt);
    rafId = requestAnimationFrame(stepAnimation);
  }

  const controller = {
    play() {
      if (settings.playing) return;
      settings.playing = true;
      lastNow = performance.now();
      commitRender(settings.time);
      rafId = requestAnimationFrame(stepAnimation);
    },

    pause() {
      stopRafOnly();
      commitRender(settings.time);
    },

    scrubTo(t) {
      lastNow = performance.now();
      commitRender(t);
    },

    setRpm(val) {
      settings.rpm = val;
      commitRender(settings.time);
    },

    setSparkAdvance(val) {
      settings.sparkAdvance = val;
      commitRender(settings.time);
    },

    isolateStroke(strokeName, jumpTime) {
      stopRafOnly();
      settings.isolatedStroke = strokeName;
      commitRender(jumpTime);
    },

    clearIsolation() {
      stopRafOnly();
      settings.isolatedStroke = null;
      commitRender(settings.time);
    },
  };

  controlsBinding = bindControls(controlDom, controller);

  // Deterministic external frame seek API (halts RAF clock so out-of-order renders never drift)
  window.renderAt = function renderAt(t) {
    stopRafOnly();
    commitRender(t);
  };

  window.__getSceneState = function __getSceneState() {
    if (!latestState) {
      commitRender(settings.time);
    }
    return {
      t: latestState.t,
      time: latestState.time,
      playing: latestState.playing,
      rpm: latestState.rpm,
      sparkAdvance: latestState.sparkAdvance,
      isolatedStroke: latestState.isolatedStroke,
      crankAngle: latestState.crankAngle,
      crankAngleText: latestState.crankAngleText,
      pistonPosition: latestState.pistonPosition,
      valveLifts: { ...latestState.valveLifts },
      activeStroke: latestState.activeStroke,
      pressure: latestState.pressure,
      temperature: latestState.temperature,
    };
  };

  // Render initial t=0 state and launch playback loop
  commitRender(0);
  lastNow = performance.now();
  rafId = requestAnimationFrame(stepAnimation);
  window.__SCENE_READY__ = true;
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initWorkbench);
} else {
  initWorkbench();
}
