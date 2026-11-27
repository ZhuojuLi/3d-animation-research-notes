import { CameraStage } from './camera-stage.js';
import { createControls } from './controls.js';
import { clamp, DURATION, timelinePhase } from './optics.js';

const initialParameters = () => ({
  aperture: 2.5,
  distance: 0.7,
  finish: 'silver',
  section: 'right',
  explodedOverride: null,
  activeControl: 'aperture',
  focusInteractive: false,
});

const parameters = initialParameters();
let time = 0;
let playing = false;
let frameRequest = 0;
let playbackOrigin = 0;
let timeOrigin = 0;
let hasPlayedAutomatically = false;
let lastVisual = {};
let lastDrawKey = '';
let phase = 'lens';

const stage = new CameraStage(document.getElementById('stage'));

function snapshot() {
  return {
    t: time,
    time,
    duration: DURATION,
    playing,
    playback: playing ? 'playing' : time >= DURATION ? 'complete' : 'paused',
    mode: 'oneshot',
    aperture: parameters.aperture,
    fNumber: parameters.aperture,
    distance: parameters.distance,
    focusDistance: parameters.distance,
    focusLabel: Number.isFinite(parameters.distance) ? `${parameters.distance.toFixed(2)} m` : '∞',
    finish: parameters.finish,
    colorway: parameters.finish,
    section: parameters.section,
    sectionMode: parameters.section === 'right' ? 'right-cutaway' : 'left-cutaway',
    exploded: lastVisual.explodedAmount >= .5,
    explodedMode: lastVisual.explodedAmount >= .5 ? 'exploded' : 'assembled',
    explodedAmount: lastVisual.explodedAmount,
    phase,
    optical: { ...lastVisual },
  };
}

function draw() {
  const signature = [
    time, playing, parameters.aperture, String(parameters.distance), parameters.finish,
    parameters.section, String(parameters.explodedOverride), parameters.activeControl,
    parameters.focusInteractive,
  ].join('|');
  // Range elements emit input followed by change. Avoid re-rasterizing an
  // identical SVG when both events describe exactly the same scene state.
  if (signature === lastDrawKey) return;
  lastDrawKey = signature;
  phase = timelinePhase(time);
  lastVisual = stage.render({ time, ...parameters });
  controls.sync(snapshot(), lastVisual, phase);
}

function cancelFrame() {
  if (frameRequest) cancelAnimationFrame(frameRequest);
  frameRequest = 0;
}

function animationFrame(now) {
  frameRequest = 0;
  if (!playing) return;
  time = clamp(timeOrigin + (now - playbackOrigin) / 1000, 0, DURATION);
  if (time >= DURATION) {
    time = DURATION;
    playing = false;
  }
  draw();
  if (playing) frameRequest = requestAnimationFrame(animationFrame);
}

function pause() {
  hasPlayedAutomatically = true;
  playing = false;
  cancelFrame();
  draw();
}

function play() {
  cancelFrame();
  if (time >= DURATION) time = 0;
  playing = true;
  timeOrigin = time;
  playbackOrigin = performance.now();
  draw();
  frameRequest = requestAnimationFrame(animationFrame);
}

function applyTime(value, shouldPause = true) {
  hasPlayedAutomatically = true;
  if (shouldPause) {
    playing = false;
    cancelFrame();
  }
  const numeric = Number(value);
  time = Number.isFinite(numeric) ? clamp(numeric, 0, DURATION) : 0;
  draw();
  return time;
}

function setParameter(key, value) {
  if (!(key in parameters)) return;
  if (key === 'aperture') parameters.aperture = clamp(Number(value) || 2.5, 1.7, 16);
  else if (key === 'distance') {
    parameters.distance = value === Infinity ? Infinity : clamp(Number(value) || .7, .7, 50);
    if (Number(value) >= 50) parameters.distance = Infinity;
    parameters.focusInteractive = true;
  } else if (key === 'explodedOverride') parameters.explodedOverride = Boolean(value);
  else if (key === 'finish' && ['silver', 'black', 'champagne'].includes(value)) parameters.finish = value;
  else if (key === 'section' && ['left', 'right'].includes(value)) parameters.section = value;
  else if (key === 'activeControl' && ['aperture', 'focus'].includes(value)) parameters.activeControl = value;
  draw();
}

function reset() {
  playing = false;
  cancelFrame();
  Object.assign(parameters, initialParameters());
  time = 0;
  hasPlayedAutomatically = true;
  draw();
}

const controls = createControls({
  getState: snapshot,
  play,
  pause,
  setTime: applyTime,
  setParameter,
  reset,
});

window.renderAt = seconds => applyTime(seconds, true);
window.__getSceneState = () => snapshot();
window.__SCENE_READY__ = false;

draw();
window.__SCENE_READY__ = true;

// Armed, not autoplaying: the initial publication remains available for review.
// Play is the only wall-clock driver and always stops permanently at t = 8.
// Seeks and reset remain pure functions of scene state.
