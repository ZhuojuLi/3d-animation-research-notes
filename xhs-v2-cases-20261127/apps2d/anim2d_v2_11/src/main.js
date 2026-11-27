import { PERIOD, clamp, fmt } from './config.js';
import { PlaybackClock, clockAt, timecodeAt, periodicTime } from './timeline.js';
import { NetworkScene } from './network.js';
import { AnalyticsScene } from './analytics.js';
import { bindControls, syncControls } from './controls.js';

const settings = { flowMultiplier: 1.0, focusedLine: null, speedLimit: true };
const network = new NetworkScene(document.getElementById('stage'));
const analytics = new AnalyticsScene();
let latest = { trains: [], hubs: [], loads: {}, pressure: [] };
let clock;

function renderFrame(t) {
  const stage = network.render(t, settings);
  const analysis = analytics.render(t, settings);
  latest = { ...stage, ...analysis };
  const clockText = clockAt(t);
  const simClock = document.getElementById('sim-clock');
  simClock.textContent = clockText;
  simClock.setAttribute('datetime', clockText);
  const passengers = 1.2 * settings.flowMultiplier;
  document.getElementById('passenger-value').textContent = passengers.toFixed(1);
  document.getElementById('passenger-trend').textContent = settings.flowMultiplier < 1 ? '平峰' : settings.flowMultiplier > 1 ? '高峰' : '基准';
  syncControls(t, settings, clock ? clock.playing : false, timecodeAt(t));
}
function renderCurrent() { renderFrame(clock ? clock.t : 0); }
function playingChanged() { syncControls(clock.t, settings, clock.playing, timecodeAt(clock.t)); }
clock = new PlaybackClock(renderFrame, playingChanged);
bindControls({ clock, settings, renderCurrent, playingChanged });

window.renderAt = seconds => {
  clock.render(periodicTime(seconds));
  return window.__getSceneState();
};
window.__getSceneState = () => ({
  t: fmt(clock.t), period: PERIOD, mode: 'periodic', playing: clock.playing,
  clock: clockAt(clock.t), timecode: timecodeAt(clock.t),
  flowMultiplier: settings.flowMultiplier, focusedLine: settings.focusedLine,
  speedLimit: settings.speedLimit, speedLimitKmh: settings.speedLimit ? 20 : null,
  passengersWan: fmt(1.2 * settings.flowMultiplier),
  kpi: { punctuality: 98, trainsPerHour: 35, passengersWan: fmt(1.2 * settings.flowMultiplier), energyKwh: 1450 },
  trains: latest.trains, hubs: latest.hubs, bridgeCount: latest.bridges,
  loads: latest.loads, pressure: latest.pressure
});

const resize = () => { network.resize(); analytics.resize(); };
if ('ResizeObserver' in window) {
  const observer = new ResizeObserver(resize);
  observer.observe(document.getElementById('stage-wrap'));
  observer.observe(document.getElementById('charts'));
}
window.addEventListener('resize', resize, { passive: true });
renderFrame(0);
requestAnimationFrame(() => {
  resize();
  renderFrame(clock.t);
  window.__SCENE_READY__ = true;
  document.documentElement.dataset.sceneReady = 'true';
});
