import { COLORS, LINE_NAMES, TAU, clamp, fmt } from './config.js';

const NS = 'http://www.w3.org/2000/svg';
const node = (tag, attrs, parent) => {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs || {})) n.setAttribute(k, v);
  if (parent) parent.appendChild(n);
  return n;
};
const chartSpecs = [
  { id: 'cyan', phase: .2, base: 19, peak: .60, lift: 52 },
  { id: 'orange', phase: 1.9, base: 23, peak: .53, lift: 47 },
  { id: 'purple', phase: 3.8, base: 16, peak: .66, lift: 56 }
];
const stationBase = [
  { name: '人民广场', value: 86, phase: .1 },
  { name: '世纪大道', value: 74, phase: 1.4 },
  { name: '徐家汇', value: 65, phase: 2.8 },
  { name: '静安寺', value: 57, phase: 4.1 },
  { name: '陕西南路', value: 47, phase: 5.2 }
];

export class AnalyticsScene {
  constructor() {
    this.settings = { flowMultiplier: 1, focusedLine: null };
    this.lastT = 0;
    this.charts = chartSpecs.map(spec => ({ ...spec, svg: document.getElementById(`chart-${spec.id}`), h: 82 }));
    this.buildPressure();
    this.charts.forEach(chart => this.buildChart(chart));
  }
  buildChart(chart) {
    const svg = chart.svg;
    const width = 280, h = chart.h;
    const left = 23, right = 276, top = 4, bottom = h - 14;
    chart.layout = { left, right, top, bottom, width, h };
    svg.setAttribute('viewBox', `0 0 ${width} ${h.toFixed(2)}`);
    svg.innerHTML = '';
    const defs = node('defs', {}, svg);
    const gradient = node('linearGradient', { id: `area-${chart.id}`, x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
    node('stop', { offset: 0, 'stop-color': COLORS[chart.id], 'stop-opacity': .38 }, gradient);
    node('stop', { offset: 1, 'stop-color': COLORS[chart.id], 'stop-opacity': .025 }, gradient);
    const bands = [
      [150, 200, '#ff5b62', .105], [100, 150, '#f39843', .102], [50, 100, '#e8d34e', .075], [0, 50, '#43d59b', .068]
    ];
    const y = value => bottom - value / 200 * (bottom - top);
    bands.forEach(([lo, hi, color, opacity]) => node('rect', { x: left, y: y(hi), width: right - left, height: y(lo) - y(hi), fill: color, opacity }, svg));
    [200, 150, 100, 50, 0].forEach(value => {
      node('line', { x1: left, y1: y(value), x2: right, y2: y(value), stroke: '#7090a3', 'stroke-width': .45, opacity: value === 0 ? .40 : .21 }, svg);
      const label = node('text', { x: 18, y: y(value) + 2.5, 'text-anchor': 'end', fill: '#7894a6', 'font-size': 7.2, 'font-family': 'Consolas, monospace' }, svg);
      label.textContent = value;
    });
    for (let i = 0; i < 6; i++) {
      const x = left + (right - left) * i / 5;
      node('line', { x1: x, y1: top, x2: x, y2: bottom, stroke: '#52758a', 'stroke-width': .35, opacity: .12 }, svg);
      const label = node('text', { x, y: h - 3, 'text-anchor': i === 0 ? 'start' : i === 5 ? 'end' : 'middle', fill: '#7894a6', 'font-size': 7.1, 'font-family': 'Consolas, monospace' }, svg);
      label.textContent = `${i + 1}:00`;
    }
    const curveLayer = node('g', { 'data-curve-line': chart.id }, svg);
    chart.fill = node('path', { fill: `url(#area-${chart.id})`, stroke: 'none' }, curveLayer);
    chart.path = node('path', { fill: 'none', stroke: COLORS[chart.id], 'stroke-width': 1.65, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, curveLayer);
    chart.pathGlow = node('path', { fill: 'none', stroke: COLORS[chart.id], 'stroke-width': 4.5, opacity: .10, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, curveLayer);
    chart.dot = node('circle', { r: 2.3, fill: '#dfffff', stroke: COLORS[chart.id], 'stroke-width': 1.3 }, curveLayer);
    chart.layer = curveLayer;
    if (this.lastValues) this.render(this.lastT, this.settings);
  }
  resize() {
    let changed = false;
    this.charts.forEach(chart => {
      const rect = chart.svg.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const h = clamp(280 * rect.height / rect.width, 62, 150);
      if (Math.abs(h - chart.h) > .4) { chart.h = h; this.buildChart(chart); changed = true; }
    });
    if (changed) this.render(this.lastT, this.settings);
  }
  buildPressure() {
    const svg = document.getElementById('pressure-chart');
    svg.innerHTML = '';
    this.pressureRows = [];
    const barX = 59, barW = 169;
    for (let i = 0; i < 5; i++) {
      const y = 4 + i * 21;
      const group = node('g', {}, svg);
      const name = node('text', { x: 0, y: y + 11, fill: '#a9c0cf', 'font-size': 9 }, group);
      node('rect', { x: barX, y: y + 3, width: barW, height: 9, rx: 1.5, fill: '#132b3f' }, group);
      const bar = node('rect', { x: barX, y: y + 3, width: 50, height: 9, rx: 1.5, fill: '#39d2d5', opacity: .88 }, group);
      const cap = node('rect', { x: barX + 45, y: y + 3, width: 2, height: 9, fill: '#b9ffff', opacity: .65 }, group);
      const value = node('text', { x: 237, y: y + 11, fill: '#8fb3c6', 'font-size': 8.5, 'font-family': 'Consolas, monospace' }, group);
      this.pressureRows.push({ group, name, bar, cap, value });
    }
    [0, 20, 40, 60, 80, 100].forEach((tick, i) => {
      const x = barX + barW * i / 5;
      node('line', { x1: x, y1: 110, x2: x, y2: 115, stroke: '#527389', 'stroke-width': .6 }, svg);
      const label = node('text', { x, y: 126, 'text-anchor': i === 0 ? 'start' : i === 5 ? 'end' : 'middle', fill: '#658398', 'font-size': 7.2, 'font-family': 'Consolas, monospace' }, svg);
      label.textContent = tick;
    });
    node('line', { x1: barX, y1: 111, x2: barX + barW, y2: 111, stroke: '#395b72', 'stroke-width': .55 }, svg);
    const caption = node('text', { x: 276, y: 126, 'text-anchor': 'end', fill: '#43677e', 'font-size': 6.6, 'letter-spacing': .4 }, svg);
    caption.textContent = 'PRESSURE';
  }
  render(t, settings) {
    this.lastT = t;
    this.lastValues = true;
    this.settings = { ...settings };
    const angle = t / 8 * TAU;
    const loads = {};
    this.charts.forEach(chart => {
      const { left, right, top, bottom } = chart.layout;
      const points = [];
      const values = [];
      const samples = 88;
      for (let i = 0; i < samples; i++) {
        const u = i / (samples - 1);
        const rush = Math.exp(-Math.pow((u - chart.peak) / .205, 2));
        const shoulder = 12 * Math.exp(-Math.pow((u - .24) / .14, 2));
        const temporal = (4.2 + 3 * u) * Math.sin(TAU * u * 1.35 + angle + chart.phase) + 2.3 * Math.sin(TAU * u * 3.1 - angle * 2 + chart.phase);
        const shape = chart.base + chart.lift * rush + shoulder + 18 * u + 7 * Math.sin(Math.PI * u + chart.phase) + temporal;
        const value = clamp(shape * settings.flowMultiplier, 0, 200);
        const x = left + (right - left) * u;
        const y = bottom - value / 200 * (bottom - top);
        points.push([x, y]); values.push(value);
      }
      const linePath = points.map((p, i) => `${i ? 'L' : 'M'}${fmt(p[0])} ${fmt(p[1])}`).join(' ');
      const areaPath = `${linePath} L${fmt(right)} ${fmt(bottom)} L${fmt(left)} ${fmt(bottom)} Z`;
      chart.path.setAttribute('d', linePath);
      chart.pathGlow.setAttribute('d', linePath);
      chart.fill.setAttribute('d', areaPath);
      const last = points[points.length - 1];
      chart.dot.setAttribute('cx', fmt(last[0])); chart.dot.setAttribute('cy', fmt(last[1]));
      chart.layer.setAttribute('opacity', settings.focusedLine && settings.focusedLine !== chart.id ? .13 : 1);
      const current = values[values.length - 1];
      loads[chart.id] = { name: LINE_NAMES[chart.id], current: fmt(current), samples: values.map(fmt) };
      const output = document.getElementById(`load-${chart.id}`);
      output.textContent = `${Math.round(current)}%`;
      output.setAttribute('opacity', settings.focusedLine && settings.focusedLine !== chart.id ? .3 : 1);
    });
    const pressure = stationBase.map(s => ({
      name: s.name,
      value: clamp(s.value * (.93 + .07 * Math.sin(angle * 2 + s.phase)) * settings.flowMultiplier, 0, 100)
    })).sort((a, b) => b.value - a.value);
    const colors = ['#35d7d5', '#43c9df', '#56bce6', '#72abe9', '#8b9fe6'];
    pressure.forEach((item, i) => {
      const row = this.pressureRows[i], width = 169 * item.value / 100;
      row.name.textContent = item.name;
      row.bar.setAttribute('width', fmt(width)); row.bar.setAttribute('fill', colors[i]);
      row.cap.setAttribute('x', fmt(59 + Math.max(0, width - 1.5)));
      row.value.textContent = String(Math.round(item.value)).padStart(2, '0');
      item.value = fmt(item.value);
    });
    return { loads, pressure };
  }
}
