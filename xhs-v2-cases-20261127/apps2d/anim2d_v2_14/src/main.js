import { buildScene, SCENE } from './geometry.js';
import { sceneAt, normalizeTime, speedMultiplier, DURATION, clamp } from './motion.js';
import { Telemetry } from './telemetry.js';
import { SceneRenderer } from './renderer.js';
import { bindControls } from './controls.js';

const svg = document.getElementById('stage');
svg.innerHTML = buildScene();
const telemetry = new Telemetry(document);
const renderer = new SceneRenderer(svg, telemetry);

let state = { t: 0, speed: 60, playing: false, overlay: false };
let frameHandle = 0;
let anchorPhase = 0;
let anchorTime = 0;

function paint() {
  const complete = renderer.render(state);
  // Preserve control flags while replacing every derived tool / telemetry value.
  state = { ...complete, t: state.t, speed: state.speed, playing: state.playing, overlay: state.overlay };
  return state;
}

function stopFrame() {
  if (frameHandle) cancelAnimationFrame(frameHandle);
  frameHandle = 0;
}

function frame(now) {
  if (!state.playing) return;
  const elapsed = Math.max(0, (now - anchorTime) / 1000);
  const phase = normalizeTime(anchorPhase + elapsed * speedMultiplier(state.speed));
  state.t = phase;
  paint();
  frameHandle = requestAnimationFrame(frame);
}

function play() {
  if (state.playing && speedMultiplier(state.speed) > 0) return;
  stopFrame();
  state.playing = true;
  anchorPhase = state.t;
  anchorTime = performance.now();
  paint();
  if (speedMultiplier(state.speed) > 0) frameHandle = requestAnimationFrame(frame);
}

function pause() {
  if (state.playing && frameHandle) {
    // Account for the fraction of a frame since the previous paint, then hold exactly.
    state.t = normalizeTime(anchorPhase + Math.max(0, performance.now() - anchorTime) / 1000 * speedMultiplier(state.speed));
  }
  state.playing = false;
  stopFrame();
  paint();
}

/** Deterministic absolute seek: cancels wall-clock transport and rebuilds the pose. */
function renderAt(seconds) {
  state.playing = false;
  stopFrame();
  state.t = normalizeTime(Number(seconds));
  paint();
  return snapshot();
}

function setSpeed(value) {
  const next = clamp(Number(value) || 0, 0, 100);
  if (state.playing) {
    const now = performance.now();
    const elapsed = Math.max(0, (now - anchorTime) / 1000);
    anchorPhase = normalizeTime(anchorPhase + elapsed * speedMultiplier(state.speed));
    anchorTime = now;
    state.t = anchorPhase;
  }
  const wasPlaying = state.playing;
  state.speed = next;
  paint();
  if (wasPlaying) {
    stopFrame();
    if (speedMultiplier(next) > 0) frameHandle = requestAnimationFrame(frame);
    else state.playing = true; // speed 0 is a deliberate cadence hold
  }
  return snapshot();
}

function togglePivot(force) {
  state.overlay = typeof force === 'boolean' ? force : !state.overlay;
  paint(); // no changes to t or any canonical geometric parameter
  return snapshot();
}

function reset() {
  stopFrame();
  state = { t: 0, speed: 60, playing: false, overlay: false };
  paint();
  return snapshot();
}

function snapshot() {
  const base = sceneAt(state.t, state.speed);
  return JSON.parse(JSON.stringify({
    ...base,
    playing: state.playing,
    overlay: state.overlay,
    speed: state.speed,
    tools: {
      compass: base.compass,
      tsquare: base.tsquare,
      cutter: base.cutter,
      ribbon: base.ribbon,
      arcProgress: base.progress.arc,
      trimProgress: base.progress.trim,
    },
    controls: {
      play: state.playing,
      pause: !state.playing,
      scrub: Number(document.getElementById('scrub').value),
      speed: state.speed,
      speedReadout: document.getElementById('speed-readout').textContent,
      pivot: state.overlay,
      scrubFill: document.getElementById('scrub').style.getPropertyValue('--fill'),
      speedFill: document.getElementById('speed-slider').style.getPropertyValue('--fill'),
    },
  }));
}

bindControls({ play, pause, reset, seek: renderAt, setSpeed, togglePivot, getState: snapshot });
window.renderAt = renderAt;
window.__getSceneState = snapshot;
window.__SCENE_EXPORT__ = Object.freeze({ duration: DURATION, width: SCENE.width, height: SCENE.height, fps: 30 });
paint();
window.__SCENE_READY__ = true;
