/** SVG renderer: maps a complete pure state to a complete pose, with no deltas. */
import { sceneAt } from './motion.js';

const fmt = n => Number(n.toFixed(4));
const attr = (el, name, value) => el.setAttribute(name, String(value));

export class SceneRenderer {
  constructor(svg, telemetry) {
    this.svg = svg;
    this.telemetry = telemetry;
    const ids = [
      'compass-tool', 'tsquare-tool', 'golden-arc', 'cutter-tool', 'segmented-blade',
      'thumb-lock', 'trim-line', 'paper-ribbon', 'ribbon-body', 'ribbon-highlight',
      'ribbon-shadow', 'ribbon-outline', 'phase-label', 'phase-readout', 'phase-dot',
      'speed-readout', 'speed-slider', 'scrub', 'pivot-overlay', 'pivot-toggle',
      'pivot-toggle-text', 'pivot-card', 'overlay-needle-axis', 'overlay-pencil-axis',
      'overlay-hinge-ring', 'overlay-hinge-cross', 'construction-radius',
      'tsquare-guide-vector', 'tsquare-guide-arrow', 'cutter-blade-axis',
      'overlay-hinge-label', 'overlay-radius-label', 'overlay-guide-label',
      'overlay-blade-label', 'play', 'pause',
    ];
    this.el = Object.fromEntries(ids.map(id => [id, document.getElementById(id)]));
    this.sensitive = document.querySelectorAll('.overlay-sensitive');
  }

  render(inputState) {
    const state = {
      ...sceneAt(inputState.t, inputState.speed),
      playing: Boolean(inputState.playing),
      overlay: Boolean(inputState.overlay),
    };
    const e = this.el;
    const c = state.compass;
    const cut = state.cutter;

    // A single transform rotates hinge, both legs, wheel and pencil about the needle.
    attr(e['compass-tool'], 'transform', `translate(${c.needle.x} ${c.needle.y}) rotate(${fmt(c.swingDegrees)})`);
    attr(e['golden-arc'], 'stroke-dashoffset', fmt(100 * (1 - state.progress.arc)));
    attr(e['tsquare-tool'], 'transform', `translate(${fmt(state.tsquare.renderX)} 0)`);

    const radians = cut.angle * Math.PI / 180;
    const cutterX = cut.baseX + Math.cos(radians) * cut.distance;
    const cutterY = cut.baseY + Math.sin(radians) * cut.distance;
    attr(e['cutter-tool'], 'transform', `translate(${fmt(cutterX)} ${fmt(cutterY)}) rotate(${cut.angle})`);
    attr(e['segmented-blade'], 'transform', `translate(${fmt(cut.bladeExtension)} 0)`);
    attr(e['thumb-lock'], 'transform', `translate(${fmt(116 + cut.thumbOffset)} -12)`);

    const trimStart = { x: cut.baseX + Math.cos(radians) * 159, y: cut.baseY + Math.sin(radians) * 159 };
    const trimEnd = { x: trimStart.x + Math.cos(radians) * cut.distance, y: trimStart.y + Math.sin(radians) * cut.distance };
    attr(e['trim-line'], 'd', `M${fmt(trimStart.x)} ${fmt(trimStart.y)}L${fmt(trimEnd.x)} ${fmt(trimEnd.y)}`);
    attr(e['trim-line'], 'stroke-dashoffset', fmt(100 * (1 - state.progress.trim)));

    // The curl's origin follows the cutter and its visible length follows trim progress.
    const ribbonD = `M${fmt(trimEnd.x)} ${fmt(trimEnd.y)}C${fmt(trimEnd.x - 9)} ${fmt(trimEnd.y + 25)} ${fmt(trimEnd.x - 55)} ${fmt(trimEnd.y + 10)} ${fmt(trimEnd.x - 65)} ${fmt(trimEnd.y + 45)}C${fmt(trimEnd.x - 79)} ${fmt(trimEnd.y + 78)} ${fmt(trimEnd.x - 35)} ${fmt(trimEnd.y + 88)} ${fmt(trimEnd.x - 32)} ${fmt(trimEnd.y + 58)}C${fmt(trimEnd.x - 29)} ${fmt(trimEnd.y + 37)} ${fmt(trimEnd.x - 60)} ${fmt(trimEnd.y + 34)} ${fmt(trimEnd.x - 60)} ${fmt(trimEnd.y + 55)}C${fmt(trimEnd.x - 60)} ${fmt(trimEnd.y + 67)} ${fmt(trimEnd.x - 45)} ${fmt(trimEnd.y + 70)} ${fmt(trimEnd.x - 40)} ${fmt(trimEnd.y + 59)}`;
    for (const id of ['ribbon-body', 'ribbon-highlight', 'ribbon-shadow', 'ribbon-outline']) {
      attr(e[id], 'd', ribbonD);
      attr(e[id], 'stroke-dashoffset', fmt(100 * (1 - state.progress.ribbon)));
    }
    
    const ribbonVisibility = state.progress.ribbon > 0.00001 ? 1 : 0;
    attr(e['paper-ribbon'], 'opacity', ribbonVisibility);
    attr(e['paper-ribbon'], 'visibility', ribbonVisibility ? 'visible' : 'hidden');

    e['phase-label'].textContent = `${state.phaseCode}  /  ${state.phaseName}`;
    e['phase-readout'].textContent = `${state.t.toFixed(2)} s`;
    e['phase-dot'].setAttribute('class', `phase-dot phase-${state.phaseIndex}`);
    this.telemetry.render(state);
    this.renderControls(state);
    this.renderOverlay(state);
    return state;
  }

  renderControls(state) {
    const { el: e } = this;
    // Avoid changing the native range while it is being dragged unless the scene changed.
    if (document.activeElement !== e.scrub || !state.playing) e.scrub.value = state.t.toFixed(3);
    e.scrub.style.setProperty('--fill', `${(state.t / 6) * 100}%`);
    e['speed-slider'].value = String(state.speed);
    e['speed-slider'].style.setProperty('--fill', `${state.speed}%`);
    e['speed-readout'].textContent = `${Math.round(state.speed)}`;
    e.play.classList.toggle('is-active', state.playing);
    e.pause.classList.toggle('is-active', !state.playing);
    e.play.setAttribute('aria-pressed', String(state.playing));
    e.pause.setAttribute('aria-pressed', String(!state.playing));
  }

  renderOverlay(state) {
    const e = this.el;
    const c = state.compass;
    const visible = state.overlay ? 'visible' : 'hidden';
    attr(e['pivot-overlay'], 'opacity', state.overlay ? 1 : 0);
    attr(e['pivot-overlay'], 'visibility', visible);
    this.sensitive.forEach(el => attr(el, 'visibility', visible));
    e['pivot-toggle'].setAttribute('aria-pressed', String(state.overlay));
    e['pivot-toggle'].classList.toggle('is-active', state.overlay);
    e['pivot-card'].classList.toggle('active', state.overlay);
    e['pivot-toggle-text'].textContent = `PIVOT AXIS · ${state.overlay ? 'ON' : 'OFF'}`;
    e['pivot-toggle'].setAttribute('aria-label', `${state.overlay ? 'Hide' : 'Show'} coordinated pivot-axis overlay`);

    attr(e['overlay-needle-axis'], 'd', `M${c.needle.x} ${c.needle.y}L${fmt(c.hinge.x)} ${fmt(c.hinge.y)}`);
    attr(e['overlay-pencil-axis'], 'd', `M${c.needle.x} ${c.needle.y}L${fmt(c.pencil.x)} ${fmt(c.pencil.y)}`);
    attr(e['construction-radius'], 'd', `M${c.needle.x} ${c.needle.y}L${fmt(c.pencil.x)} ${fmt(c.pencil.y)}`);
    attr(e['overlay-hinge-ring'], 'cx', fmt(c.hinge.x));
    attr(e['overlay-hinge-ring'], 'cy', fmt(c.hinge.y));
    attr(e['overlay-hinge-cross'], 'd', `M${fmt(c.hinge.x - 24)} ${fmt(c.hinge.y)}H${fmt(c.hinge.x + 24)}M${fmt(c.hinge.x)} ${fmt(c.hinge.y - 24)}V${fmt(c.hinge.y + 24)}`);
    attr(e['overlay-hinge-label'], 'x', fmt(c.hinge.x + 18));
    attr(e['overlay-hinge-label'], 'y', fmt(c.hinge.y + 22));
    attr(e['overlay-radius-label'], 'x', fmt((c.needle.x + c.pencil.x) / 2 + 9));
    attr(e['overlay-radius-label'], 'y', fmt((c.needle.y + c.pencil.y) / 2 + 20));
    const gx = 786 + state.tsquare.x;
    attr(e['tsquare-guide-vector'], 'd', `M${fmt(gx + 12)} 199H${fmt(gx - 110)}`);
    attr(e['tsquare-guide-arrow'], 'd', `M${fmt(gx - 102)} 193l-8 6 8 6`);
    attr(e['overlay-guide-label'], 'x', fmt(gx - 95));
    attr(e['overlay-guide-label'], 'y', '217');
    const cut = state.cutter;
    const r = cut.angle * Math.PI / 180;
    const x = cut.baseX + Math.cos(r) * cut.distance;
    const y = cut.baseY + Math.sin(r) * cut.distance;
    attr(e['cutter-blade-axis'], 'd', `M${fmt(x - Math.cos(r) * 26)} ${fmt(y - Math.sin(r) * 26)}L${fmt(x + Math.cos(r) * 193)} ${fmt(y + Math.sin(r) * 193)}`);
    attr(e['overlay-blade-label'], 'x', fmt(x + 58));
    attr(e['overlay-blade-label'], 'y', fmt(y + 102));
  }
}
