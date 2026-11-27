/** Application coordinator: exactly one requestAnimationFrame playback clock. */
import { EngineScene, mechanismAt, normalizeTime } from './engine.js';
import { CycleAnalysis, thermodynamicAt } from './cycle.js';
import { WorkbenchControls } from './controls.js';

const state = {
  time: 0,
  playing: true,
  RPM: 17000,
  sparkAdvance: 12,
  isolatedStroke: null,
};

const engine = new EngineScene(document.getElementById('engine-stage'));
const analysis = new CycleAnalysis(
  document.getElementById('pv-chart'),
  document.getElementById('phase-wheel'),
);

let frameRequest = 0;
let lastTick = null;

/** Draw the complete scene from a normalized absolute seek, without integration. */
function drawFrame(seconds) {
  state.time = normalizeTime(seconds);
  const mechanics = engine.render(state.time, state.RPM, state.sparkAdvance, state.isolatedStroke);
  const gas = analysis.render(state.time, state.RPM, state.sparkAdvance, state.isolatedStroke);
  controls.sync({ ...state, activeStroke: mechanics.activeStroke });
  return { mechanics, gas };
}

function cancelClock() {
  if (frameRequest) cancelAnimationFrame(frameRequest);
  frameRequest = 0;
  lastTick = null;
}

function pause() {
  state.playing = false;
  cancelClock();
  drawFrame(state.time);
}

function tick(now) {
  if (!state.playing) return;
  if (lastTick === null) lastTick = now;
  const elapsed = Math.max(0, (now - lastTick) / 1000);
  lastTick = now;
  drawFrame(state.time + elapsed);
  frameRequest = requestAnimationFrame(tick);
}

function play() {
  if (state.playing) return;
  state.playing = true;
  cancelClock();
  drawFrame(state.time);
  frameRequest = requestAnimationFrame(tick);
}

const controls = new WorkbenchControls({
  play,
  pause,
  seek(seconds, shouldPause = false) {
    if (shouldPause) pause();
    drawFrame(seconds);
  },
  parameters(next) {
    if (Number.isFinite(next.RPM)) state.RPM = Math.round(next.RPM / 100) * 100;
    if (Number.isFinite(next.sparkAdvance)) state.sparkAdvance = Math.round(next.sparkAdvance);
    // RPM and ignition never alter normalized time or instantiate another clock.
    drawFrame(state.time);
  },
  stroke(stroke, seekTime) {
    pause();
    state.isolatedStroke = stroke;
    if (seekTime !== null) state.time = seekTime;
    drawFrame(state.time);
  },
});

window.__getSceneState = () => {
  const m = mechanismAt(state.time);
  const gas = thermodynamicAt(state.time, state.RPM, state.sparkAdvance);
  return {
    time: state.time,
    t: state.time,
    duration: 8,
    periodic: true,
    playing: state.playing,
    RPM: state.RPM,
    rpm: state.RPM,
    sparkAdvance: state.sparkAdvance,
    spark: state.sparkAdvance,
    isolatedStroke: state.isolatedStroke,
    isolation: state.isolatedStroke,
    crankAngle: m.angle,
    pistonPosition: m.pistonOffset,
    pistonTravel: m.pistonTravel,
    pistonWristY: m.wristY,
    valveLifts: { intake: m.intakeLift, exhaust: m.exhaustLift },
    intakeValveLift: m.intakeLift,
    exhaustValveLift: m.exhaustLift,
    activeStroke: m.activeStroke,
    pressure: gas.pressure,
    temperature: gas.temperature,
    sparkAngle: gas.sparkAngle,
  };
};

/** Public deterministic seek: direct seeks deliberately freeze wall-clock playback. */
window.renderAt = seconds => {
  pause();
  drawFrame(seconds);
  return window.__getSceneState();
};

// Initialize every visual property before advertising readiness.
drawFrame(0);
window.__SCENE_READY__ = true;
frameRequest = requestAnimationFrame(tick);
