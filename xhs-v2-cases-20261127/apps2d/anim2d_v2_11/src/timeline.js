import { PERIOD, TAU, mod } from './config.js';

export function periodicTime(seconds) {
  const n = Number(seconds);
  if (!Number.isFinite(n)) return 0;
  return mod(Math.round(n * 100000) / 100000, PERIOD);
}
export function clockAt(t) {
  const total = 15 * 3600 + 38 * 60 + 45 + Math.floor(t + 1e-7);
  const hh = String(Math.floor(total / 3600) % 24).padStart(2, '0');
  const mm = String(Math.floor(total / 60) % 60).padStart(2, '0');
  const ss = String(total % 60).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}
export function timecodeAt(t) {
  const seconds = Math.floor(t + 1e-6);
  const tenth = Math.floor((t - seconds + 1e-6) * 10);
  return `00:${String(seconds).padStart(2, '0')}.${tenth}`;
}
export function easedPhase(phase) {
  return phase + 0.025 * Math.sin(TAU * phase);
}
export function globalPace(phase) {
  return 1 + 0.025 * TAU * Math.cos(TAU * phase);
}

export class PlaybackClock {
  constructor(onFrame, onPlayingChange) {
    this.onFrame = onFrame;
    this.onPlayingChange = onPlayingChange;
    this.t = 0;
    this.playing = false;
    this.raf = 0;
    this.last = 0;
    this.tick = this.tick.bind(this);
  }
  seek(seconds) {
    this.pause();
    this.t = periodicTime(seconds);
    this.onFrame(this.t);
    return this.t;
  }
  render(seconds) {
    this.pause();
    this.t = periodicTime(seconds);
    this.onFrame(this.t);
    return this.t;
  }
  play() {
    if (this.playing) return;
    this.playing = true;
    this.last = performance.now();
    this.onPlayingChange(true);
    this.raf = requestAnimationFrame(this.tick);
  }
  pause() {
    if (!this.playing) return;
    this.playing = false;
    cancelAnimationFrame(this.raf);
    this.onPlayingChange(false);
  }
  tick(now) {
    if (!this.playing) return;
    const dt = Math.min(0.1, Math.max(0, (now - this.last) / 1000));
    this.last = now;
    this.t = mod(this.t + dt, PERIOD);
    this.onFrame(this.t);
    this.raf = requestAnimationFrame(this.tick);
  }
}
