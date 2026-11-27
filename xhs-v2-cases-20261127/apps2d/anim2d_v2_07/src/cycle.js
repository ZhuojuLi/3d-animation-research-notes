/** Thermodynamic illustration, P–V chart and valve-timing phase wheel. */
import { mechanismAt, normalizeTime, STROKES } from './engine.js';

const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
const smooth = v => { const x = clamp(v); return x * x * (3 - 2 * x); };
const fixed = v => Number(v.toFixed(3));
const CLEARANCE_VOLUME = 0.095;

export function volumeAt(angle) {
  const theta = angle * Math.PI / 180;
  const travel = (1 - Math.cos(theta)) / 2 * 0.76 + 0.24 * (1 - Math.cos(theta)) ** 2;
  return CLEARANCE_VOLUME + (1 - CLEARANCE_VOLUME) * clamp(travel);
}

function combustionPressure(angle, volume, rpmN, sparkAdvance) {
  const ignition = 360 - sparkAdvance;
  const burnDuration = Math.max(34, 62 - sparkAdvance * 0.24 + rpmN * 10);
  const burn = smooth((angle - ignition) / burnDuration);
  const compressionBase = Math.pow(1 / CLEARANCE_VOLUME, 1.32);
  const base = angle <= 360
    ? Math.pow(1 / volume, 1.32)
    : compressionBase * Math.pow(CLEARANCE_VOLUME / volume, 1.25);
  const heatRelease = (8.2 + 9.3 * rpmN) * burn * Math.pow(CLEARANCE_VOLUME / volume, 1.03);
  return base + heatRelease;
}

export function thermodynamicAt(seconds, rpm = 17000, sparkAdvance = 12) {
  const m = mechanismAt(seconds);
  const angle = m.angle;
  const rpmN = clamp((rpm - 600) / 16400);
  const volume = volumeAt(angle);
  let pressure;
  if (angle < 180) {
    pressure = 1 + 0.045 * Math.sin(Math.PI * angle / 180);
  } else if (angle <= 540) {
    pressure = combustionPressure(angle, volume, rpmN, sparkAdvance);
  } else {
    const blowdown = combustionPressure(540, 1, rpmN, sparkAdvance);
    pressure = blowdown + (1 - blowdown) * smooth((angle - 540) / 180);
  }
  // Closed-loop, repeatable instrumental readout, not a random number source.
  const temperature = 22 + 15 * rpmN + 11.5 * Math.max(0, pressure - 1);
  return {
    pressure,
    temperature,
    volume,
    angle,
    time: m.time,
    activeStroke: m.activeStroke,
    sparkAngle: (360 - sparkAdvance + 720) % 720,
  };
}

const polar = (cx, cy, r, degrees) => {
  const a = degrees * Math.PI / 180;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
};
const pointString = p => `${fixed(p[0])} ${fixed(p[1])}`;
function annularSector(start, end, inner = 69, outer = 94) {
  const a = polar(130, 130, outer, start);
  const b = polar(130, 130, outer, end);
  const c = polar(130, 130, inner, end);
  const d = polar(130, 130, inner, start);
  return `M${pointString(a)}A${outer} ${outer} 0 0 1 ${pointString(b)}L${pointString(c)}A${inner} ${inner} 0 0 0 ${pointString(d)}Z`;
}

function chartMarkup() {
  return `
  <svg id="pv-svg" viewBox="0 0 430 290" xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="pv-svg-title pv-svg-desc" preserveAspectRatio="xMidYMid meet">
    <title id="pv-svg-title">Closed Otto-cycle pressure volume diagram</title>
    <desc id="pv-svg-desc">A glowing marker follows the current cylinder state through intake, compression, power and exhaust. Spark advance moves the pressure rise corner.</desc>
    <defs>
      <filter id="pv-marker-glow" x="-180%" y="-180%" width="460%" height="460%"><feGaussianBlur stdDeviation="5"/></filter>
      <radialGradient id="pv-marker-core"><stop offset="0" stop-color="#fff"/><stop offset=".45" stop-color="#fff3bc"/><stop offset="1" stop-color="#d6c6a0"/></radialGradient>
    </defs>
    <rect x="53" y="18" width="340" height="222" fill="#17212a" stroke="#89918b" stroke-width="1"/>
    <g stroke="#657983" stroke-width=".6" opacity=".25">
      <path d="M53 73.5H393M53 129H393M53 184.5H393"/>
      <path d="M138 18V240M223 18V240M308 18V240"/>
    </g>
    <g fill="#768a91" font-family="Segoe UI,Arial,sans-serif" font-size="8">
      <text x="46" y="24" text-anchor="end">P<tspan baseline-shift="super" font-size="5">MAX</tspan></text>
      <text x="46" y="133" text-anchor="end">10</text>
      <text x="46" y="238" text-anchor="end">1</text>
      <text x="53" y="252" text-anchor="middle">V<tspan baseline-shift="sub" font-size="5">MIN</tspan></text>
      <text x="393" y="252" text-anchor="middle">V<tspan baseline-shift="sub" font-size="5">MAX</tspan></text>
    </g>
    <path d="M53 240H393M53 18V240" fill="none" stroke="#a5ada3" stroke-width="1.1"/>
    <path id="pv-loop-shadow" d="" fill="none" stroke="#080e13" stroke-width="5" opacity=".6"/>
    <path id="pv-loop" d="" fill="none" stroke="#d7cbae" stroke-width="1.65" stroke-linejoin="round"/>
    <g id="pv-phase-paths" fill="none" stroke-width="3.2" stroke-linecap="round">
      <path id="pv-intake" data-phase="intake" d="" stroke="#8ebbd0"/>
      <path id="pv-compression" data-phase="compression" d="" stroke="#bbc5b3"/>
      <path id="pv-power" data-phase="power" d="" stroke="#edb572"/>
      <path id="pv-exhaust" data-phase="exhaust" d="" stroke="#ba9574"/>
    </g>
    <g font-family="Segoe UI,Arial,sans-serif" font-size="7.4" letter-spacing=".8">
      <text x="201" y="230" text-anchor="middle" fill="#82aabe">INTAKE</text>
      <text id="pv-compression-label" x="77" y="174" fill="#b3baaa" transform="rotate(-77 77 174)">COMPRESSION</text>
      <text x="100" y="42" fill="#e3d4b3">POWER</text>
      <text x="339" y="201" fill="#b89c7d" transform="rotate(72 339 201)">EXHAUST</text>
    </g>
    <g id="pv-tdc-mark" opacity=".6">
      <path d="M53 15V7H73" fill="none" stroke="#aebbad" stroke-width=".8"/>
      <text x="76" y="10" fill="#84999c" font-family="Segoe UI,Arial,sans-serif" font-size="6.5">TDC</text>
    </g>
    <path id="pv-pressure-rise" d="" fill="none" stroke="#e7b477" stroke-width="1.1" stroke-dasharray="2 3" opacity=".65"/>
    <g id="pv-crosshair" opacity=".2" stroke="#dfd4b7" stroke-width=".65" stroke-dasharray="2 5">
      <line id="pv-crosshair-v" x1="53" y1="0" x2="53" y2="240"/>
      <line id="pv-crosshair-h" x1="53" y1="0" x2="393" y2="0"/>
    </g>
    <circle id="pv-glow" cx="53" cy="222" r="13" fill="#ffdf91" opacity=".7" filter="url(#pv-marker-glow)"/>
    <circle id="pv-ring" cx="53" cy="222" r="8" fill="none" stroke="#ead7aa" stroke-width="1" opacity=".35"/>
    <circle id="pv-marker" cx="53" cy="222" r="6" fill="url(#pv-marker-core)" stroke="#fff2c9" stroke-width="1"/>
    <text x="19" y="140" transform="rotate(-90 19 140)" text-anchor="middle" fill="#bfc1b0" font-family="Segoe UI,Arial,sans-serif" font-size="11">Pressure / V</text>
    <text x="223" y="277" text-anchor="middle" fill="#c6c1ae" font-family="Segoe UI,Arial,sans-serif" font-size="11" letter-spacing=".3">Crank-angle</text>
    <text x="409" y="276" text-anchor="end" fill="#657e88" font-family="Segoe UI,Arial,sans-serif" font-size="6.5" letter-spacing=".7">720°</text>
  </svg>`;
}

function phaseMarkup() {
  const ticks = [];
  for (let i = 0; i < 72; i += 1) {
    const a = i * 5 - 90;
    const p1 = polar(130, 130, i % 18 === 0 ? 100 : 103, a);
    const p2 = polar(130, 130, 106, a);
    ticks.push(`<path d="M${pointString(p1)}L${pointString(p2)}" stroke="${i % 18 === 0 ? '#9ea894' : '#647974'}" stroke-width="${i % 18 === 0 ? 1 : .6}"/>`);
  }
  return `
  <svg id="phase-svg" viewBox="0 0 260 260" xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="phase-title phase-desc">
    <title id="phase-title">Four-quadrant valve timing phase wheel</title>
    <desc id="phase-desc">Intake, compression, power and exhaust are highlighted with the current stroke. The amber diamond indicates ignition advance.</desc>
    <circle cx="130" cy="130" r="113" fill="#141f27" stroke="#2c4148" stroke-width="1"/>
    <circle cx="130" cy="130" r="98" fill="none" stroke="#a8ad98" stroke-opacity=".18"/>
    <g id="phase-ticks">${ticks.join('')}</g>
    <g id="phase-quadrants">
      <path id="phase-intake" data-phase="intake" d="${annularSector(-88, -2)}" fill="#d6d0b4" stroke="#dfd4b4" stroke-width=".8"/>
      <path id="phase-compression" data-phase="compression" d="${annularSector(2, 88)}" fill="#d6d0b4" stroke="#dfd4b4" stroke-width=".8"/>
      <path id="phase-power" data-phase="power" d="${annularSector(92, 178)}" fill="#d6d0b4" stroke="#dfd4b4" stroke-width=".8"/>
      <path id="phase-exhaust" data-phase="exhaust" d="${annularSector(182, 268)}" fill="#d6d0b4" stroke="#dfd4b4" stroke-width=".8"/>
    </g>
    <circle cx="130" cy="130" r="65" fill="#243038" stroke="#101a22" stroke-width="5"/>
    <circle cx="130" cy="130" r="56" fill="none" stroke="#52656a" stroke-width=".8"/>
    <circle cx="130" cy="130" r="36" fill="#131f28" stroke="#354b53" stroke-width="1"/>
    <g fill="#243138" stroke="#657977" stroke-width="1.2">
      <path d="M121 103H139L141 130L137 160H123L119 130Z"/>
      <circle cx="130" cy="142" r="13"/><circle cx="130" cy="105" r="9"/>
    </g>
    <path d="M130 103V119M130 87V96M103 130H115M145 130H157" stroke="#8c9b91" stroke-width=".8"/>
    <g id="phase-crank-needle" transform="rotate(0 130 130)">
      <path d="M130 129L126 42L130 27L134 42Z" fill="#e8dabb" opacity=".9"/>
      <path d="M130 40V25" stroke="#f2e5c5" stroke-width="1.4"/>
    </g>
    <g id="phase-ignition" transform="rotate(174 130 130)">
      <path d="M130 15L136 22L130 29L124 22Z" fill="#f1b56c" stroke="#ffe0a9" stroke-width=".8"/>
      <path d="M130 30V45" stroke="#e2a766" stroke-width="1.2"/>
    </g>
    <circle cx="130" cy="130" r="4" fill="#e4d7b8" stroke="#243b3e" stroke-width="1.2"/>
    <g font-family="Segoe UI,Arial,sans-serif" font-size="7.5" letter-spacing=".5" text-anchor="middle">
      <text id="label-intake" x="178" y="82" fill="#263039">INTAKE</text>
      <text id="label-compression" x="178" y="184" fill="#bdbaa8">COMP.</text>
      <text id="label-power" x="82" y="184" fill="#bdbaa8">POWER</text>
      <text id="label-exhaust" x="82" y="82" fill="#bdbaa8">EXHAUST</text>
    </g>
    <g font-family="Segoe UI,Arial,sans-serif" font-size="6.5" fill="#6c838b">
      <text x="130" y="12" text-anchor="middle">0°</text>
      <text x="249" y="133" text-anchor="end">180°</text>
      <text x="130" y="253" text-anchor="middle">360°</text>
      <text x="11" y="133">540°</text>
    </g>
  </svg>`;
}

export class CycleAnalysis {
  constructor(chartMount, wheelMount) {
    chartMount.innerHTML = chartMarkup();
    wheelMount.innerHTML = phaseMarkup();
    this.chart = chartMount.querySelector('svg');
    this.wheel = wheelMount.querySelector('svg');
    this.cacheKey = '';
    this.rpmN = 1;
    this.maxPressure = 80;
    this.els = {};
    [
      'pv-loop', 'pv-loop-shadow', 'pv-phase-paths', 'pv-pressure-rise',
      'pv-marker', 'pv-glow', 'pv-ring', 'pv-crosshair-v', 'pv-crosshair-h',
      'phase-crank-needle', 'phase-ignition',
      ...STROKES.map(s => `pv-${s}`), ...STROKES.map(s => `phase-${s}`),
      ...STROKES.map(s => `label-${s}`),
    ].forEach(id => { this.els[id] = document.getElementById(id); });
    this.telemetry = {
      rpm: document.getElementById('rpm-readout'),
      pressure: document.getElementById('pressure-readout'),
      temperature: document.getElementById('temperature-readout'),
      angle: document.getElementById('angle-readout'),
      stroke: document.getElementById('active-stroke'),
    };
  }

  pressureY(pressure) {
    const pMax = this.maxPressure;
    return 240 - Math.log(Math.max(1, pressure) / 1) / Math.log(pMax) * 222;
  }

  chartPoint(angle, rpm, spark) {
    const volume = volumeAt(angle);
    const rpmN = clamp((rpm - 600) / 16400);
    let p;
    if (angle < 180) p = 1 + .045 * Math.sin(Math.PI * angle / 180);
    else if (angle <= 540) p = combustionPressure(angle, volume, rpmN, spark);
    else {
      const blowdown = combustionPressure(540, 1, rpmN, spark);
      p = blowdown + (1 - blowdown) * smooth((angle - 540) / 180);
    }
    return { x: 53 + (volume - CLEARANCE_VOLUME) / (1 - CLEARANCE_VOLUME) * 340, y: this.pressureY(p), pressure: p };
  }

  updateStatic(rpm, spark) {
    const key = `${rpm}/${spark}`;
    if (key === this.cacheKey) return;
    this.cacheKey = key;
    const rpmN = clamp((rpm - 600) / 16400);
    this.rpmN = rpmN;
    const candidateMax = combustionPressure(360, CLEARANCE_VOLUME, rpmN, spark);
    this.maxPressure = Math.max(48, Math.ceil((candidateMax * 1.17) / 10) * 10);
    const makePath = (from, to) => {
      const pts = [];
      const count = Math.max(8, Math.round((to - from) / 2));
      for (let i = 0; i <= count; i += 1) {
        const a = from + (to - from) * i / count;
        const p = this.chartPoint(a, rpm, spark);
        pts.push(`${i ? 'L' : 'M'}${fixed(p.x)} ${fixed(p.y)}`);
      }
      return pts.join('');
    };
    const loop = makePath(0, 720);
    this.els['pv-loop'].setAttribute('d', loop);
    this.els['pv-loop-shadow'].setAttribute('d', loop);
    const starts = [0, 180, 360, 540];
    STROKES.forEach((stroke, i) => {
      this.els[`pv-${stroke}`].setAttribute('d', makePath(starts[i], starts[i] + 180));
      // Coloured strokes provide a fine edge over the ivory theoretical loop.
      this.els[`pv-${stroke}`].setAttribute('stroke-opacity', '.38');
    });
    const ignition = (360 - spark + 720) % 720;
    const a = this.chartPoint(ignition, rpm, spark);
    const b = this.chartPoint(360, rpm, spark);
    this.els['pv-pressure-rise'].setAttribute('d', `M${fixed(a.x)} ${fixed(a.y)}L${fixed(b.x)} ${fixed(b.y)}`);
    this.els['phase-ignition'].setAttribute('transform', `rotate(${fixed(ignition / 2)} 130 130)`);
  }

  render(seconds, rpm = 17000, spark = 12, isolatedStroke = null) {
    this.updateStatic(rpm, spark);
    const time = normalizeTime(seconds);
    const state = thermodynamicAt(time, rpm, spark);
    const m = mechanismAt(time);
    const pt = this.chartPoint(m.angle, rpm, spark);
    const markerRadius = 5 + 2.6 * this.rpmN;
    ['pv-marker', 'pv-ring', 'pv-glow'].forEach(id => {
      this.els[id].setAttribute('cx', fixed(pt.x));
      this.els[id].setAttribute('cy', fixed(pt.y));
    });
    this.els['pv-marker'].setAttribute('r', fixed(markerRadius));
    this.els['pv-marker'].setAttribute('stroke-width', fixed(0.8 + this.rpmN * 0.8));
    this.els['pv-ring'].setAttribute('r', fixed(markerRadius + 4.5));
    this.els['pv-ring'].setAttribute('opacity', fixed(.22 + this.rpmN * .3));
    this.els['pv-glow'].setAttribute('r', fixed(10 + this.rpmN * 8));
    this.els['pv-glow'].setAttribute('opacity', fixed(.35 + this.rpmN * .5));
    this.els['pv-crosshair-v'].setAttribute('x1', fixed(pt.x));
    this.els['pv-crosshair-v'].setAttribute('x2', fixed(pt.x));
    this.els['pv-crosshair-h'].setAttribute('y1', fixed(pt.y));
    this.els['pv-crosshair-h'].setAttribute('y2', fixed(pt.y));

    STROKES.forEach(stroke => {
      const active = m.activeStroke === stroke;
      const isolated = isolatedStroke === stroke;
      let opacity = active ? .98 : .36;
      let labelFill = active ? '#263039' : '#bdbaa8';
      if (isolatedStroke && stroke !== isolatedStroke) opacity = .12;
      if (isolated) opacity = 1;
      this.els[`phase-${stroke}`].setAttribute('opacity', fixed(opacity));
      this.els[`label-${stroke}`].setAttribute('fill', labelFill);
      this.els[`label-${stroke}`].setAttribute('opacity', isolatedStroke && !isolated ? '.5' : '1');
      this.els[`pv-${stroke}`].setAttribute('stroke-opacity', isolatedStroke ? (isolated ? '.95' : '.06') : (active ? '.72' : '.28'));
    });
    this.els['pv-loop'].setAttribute('opacity', isolatedStroke ? '.34' : '1');
    this.els['phase-crank-needle'].setAttribute('transform', `rotate(${fixed(m.angle / 2)} 130 130)`);

    this.telemetry.rpm.textContent = String(rpm);
    this.telemetry.pressure.textContent = state.pressure.toFixed(1);
    this.telemetry.temperature.innerHTML = `${state.temperature >= 0 ? '+' : ''}${state.temperature.toFixed(1)}<span>°C</span>`;
    this.telemetry.angle.innerHTML = `${Math.round(m.angle) % 720}<span>° / 720</span>`;
    this.telemetry.stroke.textContent = (isolatedStroke || m.activeStroke).toUpperCase();
    return state;
  }
}
