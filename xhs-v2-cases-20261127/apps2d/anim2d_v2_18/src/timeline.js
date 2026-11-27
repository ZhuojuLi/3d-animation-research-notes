import { TidalScene, DEFAULTS, getReadings } from './scene.js';
import { cyclicTime, clamp, formatTime } from './utils.js';

const $ = id => document.getElementById(id);
const state = { ...DEFAULTS, pulseStart: null, playing: true };
const tidal = new TidalScene($('canvas'), $('telemetry-canvas'));
let lastNow = performance.now();
let latestScene = null;

function utcForDay(day) {
  const minutes = ((22 * 60 + 38 + Math.round(day * 14 * 60)) % 1440 + 1440) % 1440;
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')} UTC`;
}
function paintRange(input) {
  const value = (+input.value - +input.min) / (+input.max - +input.min) * 100;
  input.style.setProperty('--fill', `${value}%`);
}
function syncUI(scene) {
  $('day-night-slider').value = String(state.day);
  $('storm-slider').value = String(state.storm);
  $('beam-elevation').value = String(state.elevation);
  $('beam-value').value = `${Math.round(state.elevation)}°`;
  $('day-value').value = state.day < .18 ? 'NIGHT' : state.day < .43 ? 'DAWN' : state.day < .72 ? 'DAYLIGHT' : 'GOLDEN';
  $('storm-value').value = `${Math.round(state.storm * 100)}%`;
  $('weather-status').textContent = state.storm < .18 ? 'CALM' : state.storm < .45 ? 'BREEZE' : state.storm < .72 ? 'SQUALL' : 'STORM';
  $('utc-time').textContent = utcForDay(state.day);
  $('dial-needle').style.transform = `rotate(${-135 + state.elevation / 90 * 270}deg)`;
  $('scrub').value = String(state.t);
  $('timecode').innerHTML = `${formatTime(state.t)} <span>/ 00:08.00</span>`;
  $('play-state').textContent = state.playing ? 'RUNNING' : 'PAUSED';
  $('play').setAttribute('aria-pressed', String(state.playing));
  $('pause').setAttribute('aria-pressed', String(!state.playing));
  document.querySelector('.loop-state i').style.background = state.playing ? '#89c8ad' : '#a49379';
  $('foghorn-btn').classList.toggle('is-pulsing', scene.pulse.envelope > .035);
  const readings = getReadings(scene);
  $('wave-reading').innerHTML = `${readings.wave.toFixed(1)} m <span>|</span> ${readings.period.toFixed(1)} s`;
  $('wave-reading').classList.toggle('pulse', scene.pulse.envelope > .04);
  $('wind-reading').innerHTML = `${readings.knots} kts <span>${scene.storm < .18 ? 'W' : 'WNW'}</span>`;
  $('lamp-reading').textContent = `${readings.lamp}% POWER`;
  $('tide-reading').innerHTML = `EBBING <b>↘</b>`;
  for (const id of ['day-night-slider', 'storm-slider', 'beam-elevation', 'scrub']) paintRange($(id));
}

function render() {
  latestScene = tidal.render(state);
  syncUI(latestScene);
}
function seek(value, pause = true) {
  state.t = cyclicTime(value);
  if (pause) state.playing = false;
  lastNow = performance.now();
  render();
}

$('play').addEventListener('click', () => { state.playing = true; lastNow = performance.now(); render(); });
$('pause').addEventListener('click', () => { state.playing = false; lastNow = performance.now(); render(); });
$('scrub').addEventListener('input', event => seek(+event.target.value));
$('day-night-slider').addEventListener('input', event => { state.day = clamp(+event.target.value); render(); });
$('storm-slider').addEventListener('input', event => { state.storm = clamp(+event.target.value); render(); });
$('beam-elevation').addEventListener('input', event => { state.elevation = clamp(+event.target.value, 0, 90); render(); });
$('foghorn-btn').addEventListener('click', () => { state.pulseStart = state.t; lastNow = performance.now(); render(); });
function reset() {
  Object.assign(state, DEFAULTS, { pulseStart: null, playing: false });
  lastNow = performance.now(); render();
}
$('reset-btn').addEventListener('click', reset);
window.addEventListener('keydown', event => {
  if (event.key.toLowerCase() === 'r' && !/INPUT|TEXTAREA/.test(document.activeElement?.tagName || '')) reset();
  if (event.code === 'Space' && !/INPUT|BUTTON/.test(document.activeElement?.tagName || '')) {
    event.preventDefault(); state.playing = !state.playing; lastNow = performance.now(); render();
  }
});
window.addEventListener('resize', render);

window.renderAt = async seconds => {
  seek(seconds, true);
  return window.__getSceneState();
};
window.__getSceneState = () => ({
  t: state.t, time: state.t, duration: 8, playing: state.playing,
  day: state.day, dayNight: state.day, night: 1 - state.day,
  storm: state.storm, stormIntensity: state.storm,
  elevation: state.elevation, beamElevation: state.elevation,
  pulseStart: state.pulseStart,
  beaconPulse: latestScene?.pulse.envelope || 0,
  foghornPulse: latestScene?.pulse.envelope || 0,
  pulseAge: Number.isFinite(latestScene?.pulse.age) ? latestScene.pulse.age : null,
  utc: utcForDay(state.day),
  readings: latestScene ? getReadings(latestScene) : null,
  periodic: true,
});

function frame(now) {
  const dt = Math.min((now - lastNow) / 1000, .12);
  lastNow = now;
  if (state.playing) { state.t = cyclicTime(state.t + dt); render(); }
  requestAnimationFrame(frame);
}
render();
window.__SCENE_READY__ = true;
requestAnimationFrame(frame);
