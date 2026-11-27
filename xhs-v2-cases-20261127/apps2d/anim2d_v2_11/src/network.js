import { COLORS, HUBS, TAU, clamp, mod, smoothstep, fmt } from './config.js';
import { easedPhase, globalPace } from './timeline.js';

const NS = 'http://www.w3.org/2000/svg';
const make = (tag, attrs = {}, parent) => {
  const node = document.createElementNS(NS, tag);
  Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, value));
  if (parent) parent.appendChild(node);
  return node;
};
const routeDefs = [
  { id: 'cyan', d: 'M 52 128 H 466 Q 490 128 502 151 L 570 264 Q 582 286 578 313 L 570 350', stations: [
    [.09, '黄浦大道', 0, -18, 'middle'], [.28, '南京西路', 0, 25, 'middle'], [.44, '静安寺', -4, -18, 'middle'], [.79, '豫园', 17, 17, 'start'], [.96, '浦东滨江', -10, 24, 'end']
  ], arrows: [.18, .52, .88] },
  { id: 'orange', d: 'M 96 520 C 108 439 151 354 228 315 Q 252 276 301 276 H 878', stations: [
    [.11, '龙华', -15, 20, 'end'], [.27, '打浦桥', -12, -16, 'end'], [.45, '淮海中路', 0, -17, 'middle'], [.80, '浦东大道', 0, 24, 'middle'], [.94, '龙阳路', 0, -17, 'middle']
  ], arrows: [.17, .55, .90] },
  { id: 'purple', d: 'M 312 548 V 486 Q 312 450 345 431 L 426 414 L 612 276 L 698 198 Q 710 186 710 168 V 38', stations: [
    [.07, '上海南站', 15, 4, 'start'], [.20, '漕溪路', -15, 0, 'end'], [.75, '民生路', -15, -3, 'end'], [.94, '金桥', 15, 0, 'start']
  ], arrows: [.13, .58, .88] },
  { id: 'green-horizontal', line: 'green', d: 'M 242 414 H 874', stations: [
    [.08, '桂林公园', 0, -18, 'middle'], [.76, '上海科技馆', 0, -18, 'middle'], [.94, '张江路', 0, 24, 'middle']
  ], arrows: [.18, .86] },
  { id: 'green-vertical', line: 'green', d: 'M 426 48 V 532', stations: [
    [.38, '陕西南路', 17, 0, 'start'], [.86, '漕宝路', 17, 0, 'start']
  ], arrows: [.28, .78] }
];
const trainPlan = [
  ['cyan', 'cyan', .07, 1], ['cyan', 'cyan', .31, -1], ['cyan', 'cyan', .58, 1], ['cyan', 'cyan', .84, -1],
  ['orange', 'orange', .12, 1], ['orange', 'orange', .36, -1], ['orange', 'orange', .61, 1], ['orange', 'orange', .87, -1],
  ['purple', 'purple', .09, 1], ['purple', 'purple', .34, -1], ['purple', 'purple', .60, 1], ['purple', 'purple', .85, -1],
  ['green', 'green-horizontal', .10, 1], ['green', 'green-horizontal', .32, -1], ['green', 'green-horizontal', .61, 1], ['green', 'green-horizontal', .86, -1],
  ['green', 'green-vertical', .27, 1], ['green', 'green-vertical', .72, -1]
];
const baseSpeeds = { cyan: 54, orange: 56, purple: 52, green: 58 };

function zoneFactor(q, z0, z1) {
  const low = 20 / baseSpeeds.green;
  const ramp = .042;
  if (q >= z0 && q <= z1) return low;
  if (q > z0 - ramp && q < z0) return 1 - (1 - low) * smoothstep((q - z0 + ramp) / ramp);
  if (q > z1 && q < z1 + ramp) return low + (1 - low) * smoothstep((q - z1) / ramp);
  return 1;
}

function limitedProfile(offset, direction, z0, z1) {
  const S = 2048, N = 1024;
  const cumulative = new Float64Array(S + 1);
  for (let i = 0; i < S; i++) {
    const q = mod(offset + direction * (i + .5) / S);
    cumulative[i + 1] = cumulative[i] + 1 / (S * zoneFactor(q, z0, z1));
  }
  const total = cumulative[S];
  const table = new Float64Array(N + 1);
  for (let j = 0; j <= N; j++) {
    if (j === N) { table[j] = offset; continue; }
    const target = (j / N) * total;
    let lo = 0, hi = S;
    while (lo + 1 < hi) {
      const mid = (lo + hi) >> 1;
      if (cumulative[mid] <= target) lo = mid; else hi = mid;
    }
    const span = cumulative[lo + 1] - cumulative[lo];
    const f = span ? clamp((target - cumulative[lo]) / span) : 0;
    table[j] = mod(offset + direction * (lo + f) / S);
  }
  return { table, N, z0, z1 };
}
function sampleProfile(profile, phase) {
  const x = phase * profile.N;
  const i = Math.min(profile.N - 1, Math.floor(x));
  const f = x - i;
  let a = profile.table[i], b = profile.table[i + 1];
  if (b - a > .5) b -= 1;
  if (a - b > .5) a -= 1;
  return mod(a + (b - a) * f);
}
function tangent(path, q, direction) {
  const len = path.__length;
  const d = q * len;
  const a = path.getPointAtLength(clamp(d - 1.6, 0, len));
  const b = path.getPointAtLength(clamp(d + 1.6, 0, len));
  let angle = Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI;
  if (direction < 0) angle += 180;
  return angle;
}

export class NetworkScene {
  constructor(svg) {
    this.svg = svg;
    this.paths = new Map();
    this.lineLayers = new Map();
    this.trains = [];
    this.hubs = [];
    this.zone = { x0: 568, x1: 710 };
    this.build();
    this.resize();
  }
  build() {
    this.svg.innerHTML = `
      <defs>
        <pattern id="minor-grid" width="24" height="24" patternUnits="userSpaceOnUse"><path d="M24 0H0V24" fill="none" stroke="#17334b" stroke-width=".55" opacity=".55"/></pattern>
        <pattern id="major-grid" width="120" height="120" patternUnits="userSpaceOnUse"><rect width="120" height="120" fill="url(#minor-grid)"/><path d="M120 0H0V120" fill="none" stroke="#214158" stroke-width=".8" opacity=".5"/></pattern>
        <linearGradient id="river-water" x1="0" y1="1" x2="1" y2="0"><stop stop-color="#087bd4"/><stop offset=".45" stop-color="#079de6"/><stop offset="1" stop-color="#04b9ef"/></linearGradient>
        <linearGradient id="river-shine" x1="0" y1="0" x2="1" y2="0"><stop stop-color="#7be8ff" stop-opacity="0"/><stop offset=".5" stop-color="#7be8ff" stop-opacity=".35"/><stop offset="1" stop-color="#7be8ff" stop-opacity="0"/></linearGradient>
        <filter id="river-glow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="6"/></filter>
        <filter id="hub-soft" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="5"/></filter>
        <clipPath id="speed-clip"><rect x="568" y="385" width="142" height="58"/></clipPath>
        ${HUBS.map(h => `<radialGradient id="glow-${h.id}"><stop offset="0" stop-color="${h.color}" stop-opacity=".56"/><stop offset=".24" stop-color="${h.color}" stop-opacity=".24"/><stop offset=".62" stop-color="${h.color}" stop-opacity=".08"/><stop offset="1" stop-color="${h.color}" stop-opacity="0"/></radialGradient>`).join('')}
      </defs>
      <g id="landscape">
        <rect data-allow-clip="true" x="-1000" y="-1000" width="3000" height="2600" fill="#071526"/>
        <rect data-allow-clip="true" x="-1000" y="-1000" width="3000" height="2600" fill="url(#major-grid)"/>
        <g id="city-blocks"></g><g id="street-fabric"></g>
      </g>
      <g id="river-layer">
        <path data-allow-clip="true" class="river-course" d="M -25 596 C 29 408 235 310 413 218 C 548 149 596 73 625 -40" fill="none" stroke="#063558" stroke-width="112" opacity=".44" filter="url(#river-glow)"/>
        <path data-allow-clip="true" class="river-course" d="M -25 596 C 29 408 235 310 413 218 C 548 149 596 73 625 -40" fill="none" stroke="#2b5975" stroke-width="106"/>
        <path data-allow-clip="true" class="river-course" d="M -25 596 C 29 408 235 310 413 218 C 548 149 596 73 625 -40" fill="none" stroke="#102e4b" stroke-width="102"/>
        <path data-allow-clip="true" class="river-course" d="M -25 596 C 29 408 235 310 413 218 C 548 149 596 73 625 -40" fill="none" stroke="#2a92b7" stroke-width="98"/>
        <path data-allow-clip="true" class="river-course" d="M -25 596 C 29 408 235 310 413 218 C 548 149 596 73 625 -40" fill="none" stroke="url(#river-water)" stroke-width="93"/>
        <path data-allow-clip="true" class="river-course" d="M -25 596 C 29 408 235 310 413 218 C 548 149 596 73 625 -40" fill="none" stroke="#43c9f0" stroke-width="1.2" opacity=".55"/>
        <path data-allow-clip="true" id="river-current" class="river-course" d="M -25 596 C 29 408 235 310 413 218 C 548 149 596 73 625 -40" fill="none" stroke="#a4f0ff" stroke-width="1" stroke-dasharray="1 20" opacity=".32"/>
        <text x="245" y="289" fill="#a0ecff" opacity=".58" font-size="16" letter-spacing="7" transform="rotate(-29 245 289)">黄 浦 江</text>
      </g>
      <g id="bridges"></g>
      <g id="district-labels" fill="#46718b" opacity=".52" font-size="11" letter-spacing="3"><text x="132" y="237">浦西核心区</text><text x="787" y="109">浦东新区</text></g>
      <g id="routes"></g><g id="speed-restriction"></g><g id="hub-layer"></g><g id="train-layer"></g>
    `;
    this.buildCityTexture();
    this.buildRiverDetails();
    this.buildRoutes();
    this.buildSpeedZone();
    this.buildHubs();
    this.buildTrains();
  }
  buildCityTexture() {
    const blocks = this.svg.querySelector('#city-blocks');
    const streets = this.svg.querySelector('#street-fabric');
    for (let row = 0; row < 14; row++) {
      for (let col = 0; col < 23; col++) {
        if ((row * 7 + col * 5) % 4 !== 0) continue;
        const x = 26 + col * 43 + (row % 2) * 8, y = 23 + row * 39;
        const w = 18 + ((row + col) % 3) * 5, h = 10 + ((row * 2 + col) % 3) * 4;
        make('rect', { 'data-allow-clip': 'true', x, y, width: w, height: h, rx: 1.5, fill: '#102a40', stroke: '#1a3a50', 'stroke-width': .45, opacity: .38 }, blocks);
      }
    }
    const streetPaths = [
      'M20 203L310 54L481 43', 'M49 350L167 223L337 195L391 61', 'M154 558L199 399L371 331L538 66',
      'M447 555L483 364L654 127L763 27', 'M575 553L622 397L813 200L934 148', 'M671 516L799 377L944 324',
      'M36 468L231 451L411 474L612 458L910 492', 'M66 86L253 74L339 30', 'M533 336L725 339L931 296',
      'M514 178L685 107L894 99', 'M705 548L729 423L907 409'
    ];
    streetPaths.forEach(d => make('path', { d, fill: 'none', stroke: '#24445a', 'stroke-width': .8, opacity: .38 }, streets));
  }
  buildRiverDetails() {
    const river = this.svg.querySelector('.river-course');
    const layer = this.svg.querySelector('#bridges');
    const len = river.getTotalLength();
    [.22, .51, .79].forEach((fraction, index) => {
      const d = fraction * len;
      const p = river.getPointAtLength(d);
      const a = river.getPointAtLength(Math.max(0, d - 2));
      const b = river.getPointAtLength(Math.min(len, d + 2));
      const angle = Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI + 90;
      const g = make('g', { transform: `translate(${p.x.toFixed(2)} ${p.y.toFixed(2)}) rotate(${angle.toFixed(2)})`, opacity: .9 }, layer);
      make('rect', { x: -60, y: -9, width: 120, height: 18, rx: 1, fill: '#0b243a', stroke: '#7796a5', 'stroke-width': 1 }, g);
      make('rect', { x: -60, y: -6, width: 120, height: 12, fill: '#234156', stroke: '#a0b5be', 'stroke-width': .55 }, g);
      make('line', { x1: -60, y1: 0, x2: 60, y2: 0, stroke: '#9db7bf', 'stroke-width': .7, 'stroke-dasharray': '6 5', opacity: .75 }, g);
      [-10, 10].forEach(y => make('line', { x1: -60, y1: y, x2: 60, y2: y, stroke: '#071727', 'stroke-width': 1.5 }, g));
      make('rect', { x: -4, y: -13, width: 8, height: 26, fill: '#18364b', stroke: '#688695', 'stroke-width': .6 }, g);
      g.dataset.bridge = String(index + 1);
    });
    const coords = [[75, 378, 106, 360], [413, 190, 440, 168], [545, 90, 570, 68]];
    coords.forEach(([x1, y1, x2, y2]) => make('path', { d: `M${x1} ${y1}L${x2} ${y2}`, stroke: 'url(#river-shine)', 'stroke-width': 2, opacity: .35, fill: 'none' }, this.svg.querySelector('#river-layer')));
  }
  buildRoutes() {
    const root = this.svg.querySelector('#routes');
    ['cyan', 'orange', 'purple', 'green'].forEach(line => {
      const g = make('g', { id: `line-${line}`, 'data-line-layer': line }, root);
      this.lineLayers.set(line, g);
    });
    routeDefs.forEach(def => {
      const line = def.line || def.id;
      const color = COLORS[line];
      const parent = this.lineLayers.get(line);
      const group = make('g', { 'data-route': def.id }, parent);
      make('path', { d: def.d, fill: 'none', stroke: '#020a14', 'stroke-width': 9, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', opacity: .78 }, group);
      make('path', { d: def.d, fill: 'none', stroke: color, 'stroke-width': 6.5, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', opacity: .12 }, group);
      const path = make('path', { id: `route-${def.id}`, d: def.d, fill: 'none', stroke: color, 'stroke-width': 3.1, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, group);
      make('path', { d: def.d, fill: 'none', stroke: '#d8ffff', 'stroke-width': .55, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', opacity: .24 }, group);
      path.__length = path.getTotalLength();
      this.paths.set(def.id, path);
      def.stations.forEach(([f, name, dx, dy, anchor]) => {
        const p = path.getPointAtLength(path.__length * f);
        make('circle', { cx: p.x, cy: p.y, r: 4, fill: '#071827', stroke: color, 'stroke-width': 1.3 }, group);
        make('circle', { cx: p.x, cy: p.y, r: 1.45, fill: '#d8fbff' }, group);
        const text = make('text', { x: p.x + dx, y: p.y + dy, 'text-anchor': anchor, fill: '#a6bdcb', 'font-size': 10.5, 'letter-spacing': .25, 'paint-order': 'stroke', stroke: '#071526', 'stroke-width': 2.5, 'stroke-linejoin': 'round' }, group);
        text.textContent = name;
      });
      def.arrows.forEach((f, index) => {
        const p = path.getPointAtLength(path.__length * f);
        const angle = tangent(path, f, index % 2 ? -1 : 1);
        const arrow = make('path', { d: 'M -5 -3.8 L 0 0 L -5 3.8', fill: 'none', stroke: color, 'stroke-width': 1.6, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', transform: `translate(${p.x.toFixed(2)} ${p.y.toFixed(2)}) rotate(${angle.toFixed(2)})`, opacity: .9 }, group);
        arrow.dataset.direction = 'true';
      });
    });
  }
  buildSpeedZone() {
    const layer = this.svg.querySelector('#speed-restriction');
    const { x0, x1 } = this.zone;
    const g = make('g', { id: 'speed-zone', 'data-speed-zone': 'green' }, layer);
    make('rect', { x: x0, y: 385, width: x1 - x0, height: 58, fill: '#a58b1d', 'fill-opacity': .055, stroke: '#e0bd37', 'stroke-width': .65, 'stroke-dasharray': '2 3', opacity: .85 }, g);
    const hatches = make('g', { 'clip-path': 'url(#speed-clip)', opacity: .24 }, g);
    for (let x = x0 - 70; x < x1 + 70; x += 11) make('line', { x1: x, y1: 450, x2: x + 57, y2: 378, stroke: '#e3c340', 'stroke-width': 2 }, hatches);
    make('path', { d: `M${x0} 386V380H${x1}V386 M${x0} 437V444H${x1}V437`, fill: 'none', stroke: '#e8c340', 'stroke-width': 1.8 }, g);
    make('line', { x1: x0 + 5, y1: 424, x2: x1 - 5, y2: 424, stroke: '#f0c942', 'stroke-width': .6, opacity: .6 }, g);
    const label = make('text', { x: (x0 + x1) / 2, y: 401, 'text-anchor': 'middle', fill: '#f5d655', 'font-size': 11, 'font-weight': 600, 'letter-spacing': .25, 'paint-order': 'stroke', stroke: '#172235', 'stroke-width': 2 }, g);
    label.textContent = '限速 20km/h';
    const sub = make('text', { x: (x0 + x1) / 2, y: 458, 'text-anchor': 'middle', fill: '#bda540', 'font-size': 7.5, 'letter-spacing': 1.4 }, g);
    sub.textContent = 'GREEN LINE · SPEED CONTROL';
    this.speedZone = g;
  }
  buildHubs() {
    const root = this.svg.querySelector('#hub-layer');
    HUBS.forEach(h => {
      const g = make('g', { id: `hub-${h.id}`, 'data-hub': h.id }, root);
      const glow = make('circle', { cx: h.x, cy: h.y, r: 34, fill: `url(#glow-${h.id})`, opacity: .8 }, g);
      const soft = make('circle', { cx: h.x, cy: h.y, r: 16, fill: h.color, opacity: .10, filter: 'url(#hub-soft)' }, g);
      const pulse = make('circle', { cx: h.x, cy: h.y, r: 18, fill: 'none', stroke: h.color, 'stroke-width': .65, opacity: .23 }, g);
      make('circle', { cx: h.x, cy: h.y, r: 11.5, fill: '#071a2a', stroke: h.color, 'stroke-width': 1.6 }, g);
      make('circle', { cx: h.x, cy: h.y, r: 7.4, fill: '#0e2638', stroke: '#d6ffff', 'stroke-width': .6, opacity: .95 }, g);
      make('circle', { cx: h.x, cy: h.y, r: 3.2, fill: h.color, opacity: .88 }, g);
      make('path', { d: `M${h.x - 16} ${h.y}h4 M${h.x + 12} ${h.y}h4 M${h.x} ${h.y - 16}v4 M${h.x} ${h.y + 12}v4`, stroke: h.color, 'stroke-width': .7, opacity: .48 }, g);
      const label = make('text', { x: h.labelX, y: h.labelY, fill: '#e1f0f5', 'font-size': 11.5, 'font-weight': 600, 'letter-spacing': .5, 'paint-order': 'stroke', stroke: '#081727', 'stroke-width': 3 }, g);
      label.textContent = h.name;
      this.hubs.push({ ...h, glow, soft, pulse, label });
    });
  }
  buildTrains() {
    const layer = this.svg.querySelector('#train-layer');
    const z0 = (this.zone.x0 - 242) / (874 - 242);
    const z1 = (this.zone.x1 - 242) / (874 - 242);
    trainPlan.forEach(([line, routeId, offset, direction], index) => {
      const color = COLORS[line];
      const path = this.paths.get(routeId);
      const outer = make('g', { 'data-train-line': line, 'data-train-id': `${line}-${index + 1}` }, layer);
      const g = make('g', {}, outer);
      make('rect', { x: -15, y: -7, width: 30, height: 14, rx: 6, fill: color, opacity: .10 }, g);
      make('path', { d: 'M 9 -4.6 L 15 0 L 9 4.6 Z', fill: color, stroke: '#d9ffff', 'stroke-width': .45 }, g);
      make('rect', { x: -12, y: -4.8, width: 23, height: 9.6, rx: 3.2, fill: '#092031', stroke: color, 'stroke-width': 1.2 }, g);
      make('rect', { x: -10.5, y: -3.1, width: 18.5, height: 2.8, rx: .8, fill: color, opacity: .8 }, g);
      [-7, -1.5, 4].forEach(x => make('rect', { x, y: -2.55, width: 3.5, height: 1.7, rx: .4, fill: '#d9fcff', opacity: .88 }, g));
      make('path', { d: 'M-9 2.6H7', stroke: '#c9f7ff', 'stroke-width': .65, opacity: .7 }, g);
      make('circle', { cx: 9.2, cy: 1.7, r: 1, fill: '#fffbd5' }, g);
      const limited = routeId === 'green-horizontal' ? limitedProfile(offset, direction, z0, z1) : null;
      this.trains.push({ line, routeId, offset, direction, path, outer, g, limited, index, q: offset, speed: baseSpeeds[line] });
    });
  }
  resize() {
    const rect = this.svg.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const aspect = rect.width / rect.height, baseW = 960, baseH = 560;
    let w = baseW, h = baseH;
    if (aspect > baseW / baseH) w = baseH * aspect; else h = baseW / aspect;
    const x = (baseW - w) / 2, y = (baseH - h) / 2;
    this.svg.setAttribute('viewBox', `${x.toFixed(3)} ${y.toFixed(3)} ${w.toFixed(3)} ${h.toFixed(3)}`);
  }
  render(t, settings) {
    const phase = mod(t / 8), angle = phase * TAU;
    this.svg.querySelector('#river-current').setAttribute('stroke-dashoffset', fmt(-21 * phase));
    const focus = settings.focusedLine;
    for (const [line, layer] of this.lineLayers) layer.setAttribute('opacity', focus && focus !== line ? .13 : 1);
    this.speedZone.setAttribute('display', settings.speedLimit ? 'inline' : 'none');
    this.speedZone.setAttribute('opacity', focus && focus !== 'green' ? .13 : 1);
    const hubState = this.hubs.map(h => {
      const wave = .5 + .5 * Math.sin(angle * 2 + h.phase);
      const radius = (29 + 7 * wave) * (.55 + .45 * settings.flowMultiplier);
      const opacity = clamp(.30 + settings.flowMultiplier * .25 + wave * .18, .18, .98);
      h.glow.setAttribute('r', fmt(radius));
      h.glow.setAttribute('opacity', fmt(opacity));
      h.soft.setAttribute('r', fmt(11 + radius * .18));
      h.soft.setAttribute('opacity', fmt(.055 + .065 * settings.flowMultiplier + wave * .03));
      h.pulse.setAttribute('r', fmt(16 + wave * 4 * settings.flowMultiplier));
      h.pulse.setAttribute('opacity', fmt(.12 + .12 * wave));
      return { id: h.id, radius: fmt(radius), intensity: fmt(opacity) };
    });
    const trainState = this.trains.map(train => {
      const q = train.limited && settings.speedLimit
        ? sampleProfile(train.limited, phase)
        : mod(train.offset + train.direction * easedPhase(phase));
      const p = train.path.getPointAtLength(q * train.path.__length);
      const a = tangent(train.path, q, train.direction);
      train.g.setAttribute('transform', `translate(${fmt(p.x)} ${fmt(p.y)}) rotate(${fmt(a)})`);
      const edge = clamp(Math.min(q, 1 - q) / .025);
      const fade = smoothstep(edge);
      const focusOpacity = focus && focus !== train.line ? .13 : 1;
      train.outer.setAttribute('opacity', fmt(fade * focusOpacity));
      let speed = baseSpeeds[train.line] * globalPace(phase);
      if (train.limited && settings.speedLimit) speed = baseSpeeds[train.line] * zoneFactor(q, train.limited.z0, train.limited.z1);
      train.q = q; train.speed = speed;
      return { id: `${train.line}-${train.index + 1}`, line: train.line, route: train.routeId, direction: train.direction > 0 ? 'forward' : 'reverse', progress: fmt(q), x: fmt(p.x), y: fmt(p.y), angle: fmt(a), speedKmh: fmt(speed), limited: Boolean(train.limited && settings.speedLimit && q >= train.limited.z0 && q <= train.limited.z1) };
    });
    return { trains: trainState, hubs: hubState, bridges: 3 };
  }
}
