/**
 * Right-hand analytical panels:
 *   1. Pressure-Volume (P-V) Otto-cycle SVG chart with closed loop, cycle labels,
 *      spark-shifted pressure-rise corner, RPM-scaled glow marker, and stroke isolation.
 *   2. Four-quadrant Valve-timing Phase wheel with active/isolated quadrant emphasis,
 *      intake/exhaust timing arcs, spark-advance ignition marker, and live telemetry.
 */

import { buildPvLoopSamples, computeThermodynamics, clamp } from './cycle.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

function el(tag, attrs = {}, parent = null) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v !== null && v !== undefined) {
      node.setAttribute(k, String(v));
    }
  }
  if (parent) parent.appendChild(node);
  return node;
}

function polarToCartesian(cx, cy, r, deg) {
  const rad = (deg * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  };
}

function buildSectorPath(cx, cy, rInner, rOuter, startDeg, endDeg) {
  const p1 = polarToCartesian(cx, cy, rOuter, startDeg);
  const p2 = polarToCartesian(cx, cy, rOuter, endDeg);
  const p3 = polarToCartesian(cx, cy, rInner, endDeg);
  const p4 = polarToCartesian(cx, cy, rInner, startDeg);
  const largeArc = endDeg - startDeg > 180 ? 1 : 0;
  if (rInner <= 0.5) {
    return [
      `M ${cx.toFixed(2)} ${cy.toFixed(2)}`,
      `L ${p1.x.toFixed(2)} ${p1.y.toFixed(2)}`,
      `A ${rOuter} ${rOuter} 0 ${largeArc} 1 ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`,
      'Z',
    ].join(' ');
  }
  return [
    `M ${p1.x.toFixed(2)} ${p1.y.toFixed(2)}`,
    `A ${rOuter} ${rOuter} 0 ${largeArc} 1 ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`,
    `L ${p3.x.toFixed(2)} ${p3.y.toFixed(2)}`,
    `A ${rInner} ${rInner} 0 ${largeArc} 0 ${p4.x.toFixed(2)} ${p4.y.toFixed(2)}`,
    'Z',
  ].join(' ');
}

function buildArcPath(cx, cy, r, startDeg, endDeg) {
  const p1 = polarToCartesian(cx, cy, r, startDeg);
  const p2 = polarToCartesian(cx, cy, r, endDeg);
  const largeArc = Math.abs(endDeg - startDeg) > 180 ? 1 : 0;
  return `M ${p1.x.toFixed(2)} ${p1.y.toFixed(2)} A ${r} ${r} 0 ${largeArc} 1 ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
}

// P-V Chart coordinate mapping inside viewBox 0 0 420 250
const PV_BOX = { x0: 60, y0: 26, x1: 382, y1: 204 };

function mapPvPoint(strokeNorm, pressureBar) {
  // Visual non-linear gamma mapping on pressure so both pumping loop and high peak are crisp & legible like reference
  const pClamped = clamp(pressureBar, 0.5, 62);
  const pNorm = Math.pow((pClamped - 0.55) / 56.5, 0.62);
  const x = PV_BOX.x0 + 18 + strokeNorm * (PV_BOX.x1 - PV_BOX.x0 - 30);
  const y = PV_BOX.y1 - 14 - clamp(pNorm, 0, 0.98) * (PV_BOX.y1 - PV_BOX.y0 - 20);
  return { x, y };
}

export function createAnalysisPanels(pvSvg, phaseSvg, telemetryDom) {
  // =========================================================================
  // 1. P-V Otto-Cycle Chart
  // =========================================================================
  pvSvg.innerHTML = '';
  pvSvg.setAttribute('viewBox', '0 0 420 250');
  pvSvg.setAttribute('preserveAspectRatio', 'xMidYMid meet');

  const pvDefs = el('defs', {}, pvSvg);
  const markerGlow = el('radialGradient', { id: 'pv-marker-glow', cx: '50%', cy: '50%', r: '50%' }, pvDefs);
  el('stop', { offset: '0%', 'stop-color': '#fff9e2', 'stop-opacity': '0.95' }, markerGlow);
  el('stop', { offset: '45%', 'stop-color': '#f5d487', 'stop-opacity': '0.52' }, markerGlow);
  el('stop', { offset: '100%', 'stop-color': '#f0b85c', 'stop-opacity': '0' }, markerGlow);

  // Subtle internal grid lines
  const gridG = el('g', { opacity: '0.28' }, pvSvg);
  for (let gx = 100; gx <= 340; gx += 60) {
    el('line', { x1: gx, y1: PV_BOX.y0, x2: gx, y2: PV_BOX.y1, stroke: '#3a5063', 'stroke-width': '0.7' }, gridG);
  }
  for (let gy = 56; gy <= 176; gy += 40) {
    el('line', { x1: PV_BOX.x0, y1: gy, x2: PV_BOX.x1, y2: gy, stroke: '#3a5063', 'stroke-width': '0.7' }, gridG);
  }

  // Plot frame matching reference-0.jpg
  el(
    'rect',
    {
      x: PV_BOX.x0,
      y: PV_BOX.y0,
      width: PV_BOX.x1 - PV_BOX.x0,
      height: PV_BOX.y1 - PV_BOX.y0,
      fill: 'none',
      stroke: '#8a949a',
      'stroke-width': '1.1',
      opacity: '0.72',
    },
    pvSvg
  );

  // Axis captions required by prompt: "Pressure / V" and "Crank-angle"
  const yCaption = el(
    'text',
    {
      x: 20,
      y: 115,
      transform: 'rotate(-90 20 115)',
      'text-anchor': 'middle',
      fill: '#ded6c0',
      'font-family': 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
      'font-size': '12.5',
      'font-weight': '500',
    },
    pvSvg
  );
  yCaption.textContent = 'Pressure / V';

  const xCaption = el(
    'text',
    {
      x: 221,
      y: 237,
      'text-anchor': 'middle',
      fill: '#ded6c0',
      'font-family': 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
      'font-size': '12.5',
      'font-weight': '500',
    },
    pvSvg
  );
  xCaption.textContent = 'Crank-angle';

  // Closed Otto-cycle base path + 4 stroke-specific overlay paths
  const pvBaseLoop = el(
    'path',
    {
      id: 'pv-closed-loop',
      d: '',
      fill: 'rgba(225, 212, 180, 0.04)',
      stroke: '#dfd4b6',
      'stroke-width': '1.6',
      'stroke-linejoin': 'round',
      opacity: '0.45',
    },
    pvSvg
  );

  const pvStrokePaths = {
    intake: el('path', { fill: 'none', stroke: '#7bc0f0', 'stroke-width': '2', 'stroke-linecap': 'round' }, pvSvg),
    compression: el('path', { fill: 'none', stroke: '#dfd4b6', 'stroke-width': '2', 'stroke-linecap': 'round' }, pvSvg),
    power: el('path', { fill: 'none', stroke: '#e8dcc0', 'stroke-width': '2.2', 'stroke-linecap': 'round' }, pvSvg),
    exhaust: el('path', { fill: 'none', stroke: '#e39c5c', 'stroke-width': '1.9', 'stroke-linecap': 'round' }, pvSvg),
  };

  // Directional cycle arrows group
  const pvArrows = el('path', { d: '', fill: '#e8dec4', opacity: '0.9' }, pvSvg);

  // Ignition / Pressure-rise corner indicator (shifts with #spark-slider)
  const pvIgnGroup = el('g', { id: 'pv-ignition-corner' }, pvSvg);
  const pvIgnLeader = el('line', { x1: 52, y1: 110, x2: 78, y2: 110, stroke: '#f0c878', 'stroke-width': '1', 'stroke-dasharray': '2 2' }, pvIgnGroup);
  const pvIgnDot = el('circle', { cx: 78, cy: 110, r: 3.3, fill: '#ffd884', stroke: '#1b222a', 'stroke-width': '1' }, pvIgnGroup);
  const pvIgnLabel = el(
    'text',
    {
      x: 50,
      y: 113,
      'text-anchor': 'end',
      fill: '#f2d38c',
      'font-family': 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
      'font-size': '10.5',
      'font-weight': '600',
    },
    pvIgnGroup
  );
  pvIgnLabel.textContent = 'IGN';

  // Non-overlapping cycle landmark labels
  const pvPeakLabel = el(
    'text',
    {
      x: 110,
      y: 18,
      'text-anchor': 'middle',
      fill: '#cbbFA4',
      'font-family': 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
      'font-size': '10.5',
    },
    pvSvg
  );
  pvPeakLabel.textContent = 'Peak';

  const pvEvoLabel = el(
    'text',
    {
      x: 410,
      y: 142,
      'text-anchor': 'end',
      fill: '#cbbFA4',
      'font-family': 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
      'font-size': '10.5',
    },
    pvSvg
  );
  pvEvoLabel.textContent = 'EVO';

  const pvInLabel = el(
    'text',
    {
      x: 76,
      y: 218,
      'text-anchor': 'middle',
      fill: '#9eb2c0',
      'font-family': 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
      'font-size': '10.5',
    },
    pvSvg
  );
  pvInLabel.textContent = 'IN';

  const pvBdcLabel = el(
    'text',
    {
      x: 410,
      y: 201,
      'text-anchor': 'end',
      fill: '#9eb2c0',
      'font-family': 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
      'font-size': '10.5',
    },
    pvSvg
  );
  pvBdcLabel.textContent = 'BDC';

  // Glowing current-state marker
  const pvMarkerGroup = el('g', { id: 'pv-current-marker' }, pvSvg);
  const pvMarkerHalo = el('circle', { cx: 78, cy: 190, r: 15, fill: 'url(#pv-marker-glow)', opacity: '0.85' }, pvMarkerGroup);
  const pvMarkerRing = el('circle', { cx: 78, cy: 190, r: 7.5, fill: 'none', stroke: '#ffe7a8', 'stroke-width': '1.2', opacity: '0.65' }, pvMarkerGroup);
  const pvMarkerCore = el('circle', { cx: 78, cy: 190, r: 4.8, fill: '#fff5d6', stroke: '#222830', 'stroke-width': '1.1' }, pvMarkerGroup);

  // =========================================================================
  // 2. Four-Quadrant Valve-Timing Phase Wheel
  // =========================================================================
  phaseSvg.innerHTML = '';
  phaseSvg.setAttribute('viewBox', '0 0 248 228');
  phaseSvg.setAttribute('preserveAspectRatio', 'xMidYMid meet');

  const wCx = 124;
  const wCy = 121;

  // Outer structural bezel rings
  el('circle', { cx: wCx, cy: wCy, r: 80, fill: '#202933', stroke: '#414f5d', 'stroke-width': '3.8' }, phaseSvg);
  el('circle', { cx: wCx, cy: wCy, r: 67, fill: '#1b232c', stroke: '#323e4a', 'stroke-width': '1.2' }, phaseSvg);

  // 4 Quadrant Wedges:
  //   intake:      90° .. 180° (Bottom-Left)
  //   compression: 180° .. 270° (Top-Left)
  //   power:       270° .. 360° (Top-Right, matching reference-0.jpg!)
  //   exhaust:     0° .. 90° (Bottom-Right)
  const quadrantDefs = [
    { key: 'intake', start: 90, end: 180, label: 'Intake', lx: 44, ly: 214 },
    { key: 'compression', start: 180, end: 270, label: 'Compression', lx: 44, ly: 31 },
    { key: 'power', start: 270, end: 360, label: 'Power', lx: 204, ly: 31 },
    { key: 'exhaust', start: 0, end: 90, label: 'Exhaust', lx: 204, ly: 214 },
  ];

  const quadrantWedges = {};
  const quadrantOuterArcs = {};
  const quadrantLabels = {};

  for (const q of quadrantDefs) {
    quadrantWedges[q.key] = el(
      'path',
      {
        id: `phase-quad-${q.key}`,
        d: buildSectorPath(wCx, wCy, 0, 63, q.start, q.end),
        fill: '#2e3945',
        stroke: '#1b232c',
        'stroke-width': '1.4',
      },
      phaseSvg
    );
    quadrantOuterArcs[q.key] = el(
      'path',
      {
        d: buildArcPath(wCx, wCy, 74, q.start + 2, q.end - 2),
        fill: 'none',
        stroke: '#dfd2b0',
        'stroke-width': '4.0',
        'stroke-linecap': 'round',
        opacity: '0.18',
      },
      phaseSvg
    );
    const lbl = el(
      'text',
      {
        x: q.lx,
        y: q.ly,
        'text-anchor': 'middle',
        fill: '#a6b1ba',
        'font-family': 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
        'font-size': '10.8',
        'font-weight': '500',
      },
      phaseSvg
    );
    lbl.textContent = q.label;
    quadrantLabels[q.key] = lbl;
  }

  // Concentric inner timing guide rings
  el('circle', { cx: wCx, cy: wCy, r: 41, fill: 'none', stroke: '#3b4855', 'stroke-width': '1.1', opacity: '0.65' }, phaseSvg);
  el('circle', { cx: wCx, cy: wCy, r: 22, fill: 'none', stroke: '#3b4855', 'stroke-width': '1.1', opacity: '0.65' }, phaseSvg);

  // Valve-timing indicator bands (blue intake arc on 90..180, orange exhaust arc on 0..90)
  const intakeTimingArc = el(
    'path',
    {
      d: buildArcPath(wCx, wCy, 67.5, 93, 177),
      fill: 'none',
      stroke: '#5aa6e0',
      'stroke-width': '2.8',
      'stroke-linecap': 'round',
      opacity: '0.85',
    },
    phaseSvg
  );
  const exhaustTimingArc = el(
    'path',
    {
      d: buildArcPath(wCx, wCy, 67.5, 3, 87),
      fill: 'none',
      stroke: '#e89347',
      'stroke-width': '2.8',
      'stroke-linecap': 'round',
      opacity: '0.85',
    },
    phaseSvg
  );

  // Cardinal axis crosshairs (12, 3, 6, 9 o'clock)
  el('line', { x1: wCx - 80, y1: wCy, x2: wCx + 80, y2: wCy, stroke: '#182028', 'stroke-width': '1.4' }, phaseSvg);
  el('line', { x1: wCx, y1: wCy - 80, x2: wCx, y2: wCy + 80, stroke: '#182028', 'stroke-width': '1.4' }, phaseSvg);

  // Spark-advance Ignition Marker on Phase Wheel (rotates around wCx, wCy near 12 o'clock = 270°)
  const phaseIgnMarker = el('g', { id: 'phase-ignition-marker', transform: `translate(${wCx}, ${wCy}) rotate(-6)` }, phaseSvg);
  el('line', { x1: 0, y1: -61, x2: 0, y2: -84, stroke: '#ffd67c', 'stroke-width': '2.2', 'stroke-linecap': 'round' }, phaseIgnMarker);
  el('polygon', { points: '0,-88 -4,-81 0,-76 4,-81', fill: '#ffe69c', stroke: '#192028', 'stroke-width': '0.9' }, phaseIgnMarker);

  const phaseIgnBadge = el(
    'text',
    {
      x: wCx,
      y: 15,
      'text-anchor': 'middle',
      fill: '#f2d38c',
      'font-family': 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
      'font-size': '10',
      'font-weight': '600',
    },
    phaseSvg
  );
  phaseIgnBadge.textContent = 'IGN 12°';

  // Rotating Phase Cursor Hand (tracks 0..720° crank -> 90..450° wheel)
  const phaseHand = el('g', { id: 'phase-cursor-hand', transform: `translate(${wCx}, ${wCy}) rotate(90)` }, phaseSvg);
  el('line', { x1: 0, y1: 0, x2: 66, y2: 0, stroke: '#fff4d4', 'stroke-width': '2.1', 'stroke-linecap': 'round' }, phaseHand);
  el('circle', { cx: 66, cy: 0, r: 3.3, fill: '#fff4d4', stroke: '#182028', 'stroke-width': '1' }, phaseHand);
  el('circle', { cx: 0, cy: 0, r: 5.0, fill: '#dfd4b6', stroke: '#182028', 'stroke-width': '1.3' }, phaseHand);

  return {
    pvCacheKey: '',
    pvBaseLoop,
    pvStrokePaths,
    pvArrows,
    pvIgnLeader,
    pvIgnDot,
    pvIgnLabel,
    pvPeakLabel,
    pvEvoLabel,
    pvMarkerHalo,
    pvMarkerRing,
    pvMarkerCore,
    quadrantWedges,
    quadrantOuterArcs,
    quadrantLabels,
    intakeTimingArc,
    exhaustTimingArc,
    phaseIgnMarker,
    phaseIgnBadge,
    phaseHand,
    telemetryDom,
  };
}

function buildArrowTriangle(pFrom, pTo, size = 4.4) {
  const angle = Math.atan2(pTo.y - pFrom.y, pTo.x - pFrom.x);
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const tipX = pTo.x;
  const tipY = pTo.y;
  const bx = tipX - cos * size * 1.7;
  const by = tipY - sin * size * 1.7;
  const lx = bx - sin * size;
  const ly = by + cos * size;
  const rx = bx + sin * size;
  const ry = by - cos * size;
  return `M ${tipX.toFixed(1)} ${tipY.toFixed(1)} L ${lx.toFixed(1)} ${ly.toFixed(1)} L ${rx.toFixed(1)} ${ry.toFixed(1)} Z`;
}

export function renderAnalysisPanels(refs, state) {
  const { rpm, sparkAdvance, isolatedStroke, activeStroke, thermo } = state;

  // 1. Rebuild closed Otto-cycle P-V curve whenever RPM or sparkAdvance changes
  const cacheKey = `${rpm}:${sparkAdvance}`;
  if (refs.pvCacheKey !== cacheKey) {
    refs.pvCacheKey = cacheKey;
    const samples = buildPvLoopSamples(rpm, sparkAdvance, 3);
    const mapped = samples.map(s => ({
      ...s,
      ...mapPvPoint(s.strokeNorm, s.pressureBar),
    }));

    const fullCmds = mapped.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`);
    refs.pvBaseLoop.setAttribute('d', `${fullCmds.join(' ')} Z`);

    // Build per-stroke path segments
    for (const strokeName of ['intake', 'compression', 'power', 'exhaust']) {
      const segPts = [];
      for (let i = 0; i < mapped.length; i += 1) {
        const cur = mapped[i];
        const prev = i > 0 ? mapped[i - 1] : null;
        if (cur.stroke === strokeName) {
          if (segPts.length === 0 && prev) {
            segPts.push(`M ${prev.x.toFixed(2)} ${prev.y.toFixed(2)}`);
          }
          segPts.push(`${segPts.length === 0 ? 'M' : 'L'} ${cur.x.toFixed(2)} ${cur.y.toFixed(2)}`);
        }
      }
      refs.pvStrokePaths[strokeName].setAttribute('d', segPts.join(' '));
    }

    // Directional arrows along Compression (~315°), Power (~432°), Exhaust (~630°), Intake (~90°)
    const arrowAngles = [90, 318, 435, 630];
    const arrowCmds = [];
    for (const aDeg of arrowAngles) {
      const idx = Math.min(mapped.length - 2, Math.max(1, Math.round(aDeg / 3)));
      arrowCmds.push(buildArrowTriangle(mapped[idx - 1], mapped[idx + 1], 4.2));
    }
    refs.pvArrows.setAttribute('d', arrowCmds.join(' '));

    // Update Ignition / Pressure-rise corner marker on P-V loop
    const ignTh = computeThermodynamics(thermo.ignitionAngle, rpm, sparkAdvance);
    const ignPt = mapPvPoint(ignTh.strokeNorm, ignTh.pressureBar);
    const labelY = clamp(ignPt.y, 50, 156);
    refs.pvIgnDot.setAttribute('cx', ignPt.x.toFixed(2));
    refs.pvIgnDot.setAttribute('cy', ignPt.y.toFixed(2));
    refs.pvIgnLeader.setAttribute('x1', '52');
    refs.pvIgnLeader.setAttribute('y1', labelY.toFixed(2));
    refs.pvIgnLeader.setAttribute('x2', (ignPt.x - 4).toFixed(2));
    refs.pvIgnLeader.setAttribute('y2', ignPt.y.toFixed(2));
    refs.pvIgnLabel.setAttribute('y', (labelY + 3.5).toFixed(2));

    // Position Peak label cleanly above maximum pressure point
    let minY = 999;
    let peakX = 105;
    for (const p of mapped) {
      if (p.y < minY) {
        minY = p.y;
        peakX = p.x;
      }
    }
    refs.pvPeakLabel.setAttribute('x', clamp(peakX + 12, 96, 180).toFixed(1));
  }

  // Emphasize isolated stroke segment on P-V curve (or warm uniform Otto loop in All mode)
  for (const [strokeName, pathEl] of Object.entries(refs.pvStrokePaths)) {
    if (!isolatedStroke) {
      pathEl.setAttribute('stroke', '#e3d8bc');
      pathEl.setAttribute('stroke-width', strokeName === activeStroke ? '2.4' : '1.8');
      pathEl.setAttribute('opacity', strokeName === activeStroke ? '1' : '0.82');
    } else if (isolatedStroke === strokeName) {
      const highlightColors = {
        intake: '#79c2f5',
        compression: '#efe2c0',
        power: '#ffcf86',
        exhaust: '#f29c52',
      };
      pathEl.setAttribute('stroke', highlightColors[strokeName]);
      pathEl.setAttribute('stroke-width', '3.0');
      pathEl.setAttribute('opacity', '1');
    } else {
      pathEl.setAttribute('stroke', '#8c969e');
      pathEl.setAttribute('stroke-width', '1.3');
      pathEl.setAttribute('opacity', '0.22');
    }
  }

  // Update moving P-V state marker & RPM-responsive emphasis
  const curPv = mapPvPoint(thermo.strokeNorm, thermo.pressureBar);
  const cxStr = curPv.x.toFixed(2);
  const cyStr = curPv.y.toFixed(2);
  const coreR = 4.0 + 2.4 * thermo.rpmNorm;
  const ringR = 6.8 + 4.8 * thermo.rpmNorm;
  const haloR = 11.0 + 10.5 * thermo.rpmNorm;
  const haloAlpha = 0.36 + 0.58 * thermo.rpmNorm;

  refs.pvMarkerCore.setAttribute('cx', cxStr);
  refs.pvMarkerCore.setAttribute('cy', cyStr);
  refs.pvMarkerCore.setAttribute('r', coreR.toFixed(2));

  refs.pvMarkerRing.setAttribute('cx', cxStr);
  refs.pvMarkerRing.setAttribute('cy', cyStr);
  refs.pvMarkerRing.setAttribute('r', ringR.toFixed(2));
  refs.pvMarkerRing.setAttribute('opacity', (0.30 + 0.55 * thermo.rpmNorm).toFixed(3));

  refs.pvMarkerHalo.setAttribute('cx', cxStr);
  refs.pvMarkerHalo.setAttribute('cy', cyStr);
  refs.pvMarkerHalo.setAttribute('r', haloR.toFixed(2));
  refs.pvMarkerHalo.setAttribute('opacity', haloAlpha.toFixed(3));

  // 2. Update Four-Quadrant Valve-Timing Phase Wheel
  const targetStroke = isolatedStroke || activeStroke;
  for (const strokeName of ['intake', 'compression', 'power', 'exhaust']) {
    const isTarget = strokeName === targetStroke;
    const wedge = refs.quadrantWedges[strokeName];
    const outerArc = refs.quadrantOuterArcs[strokeName];
    const lbl = refs.quadrantLabels[strokeName];

    if (isolatedStroke) {
      if (isTarget) {
        wedge.setAttribute('fill', '#e3d5b2');
        wedge.setAttribute('opacity', '0.96');
        outerArc.setAttribute('opacity', '1');
        lbl.setAttribute('fill', '#f2e8ce');
        lbl.setAttribute('opacity', '1');
      } else {
        wedge.setAttribute('fill', '#26303b');
        wedge.setAttribute('opacity', '0.22');
        outerArc.setAttribute('opacity', '0.06');
        lbl.setAttribute('fill', '#7d8994');
        lbl.setAttribute('opacity', '0.32');
      }
    } else {
      if (isTarget) {
        wedge.setAttribute('fill', '#decfa9');
        wedge.setAttribute('opacity', '0.92');
        outerArc.setAttribute('opacity', '0.95');
        lbl.setAttribute('fill', '#efe5cc');
        lbl.setAttribute('opacity', '1');
      } else {
        wedge.setAttribute('fill', '#2f3a46');
        wedge.setAttribute('opacity', '0.78');
        outerArc.setAttribute('opacity', '0.16');
        lbl.setAttribute('fill', '#9aa6b1');
        lbl.setAttribute('opacity', '0.88');
      }
    }
  }

  refs.intakeTimingArc.setAttribute(
    'opacity',
    isolatedStroke && isolatedStroke !== 'intake' ? '0.20' : '0.92'
  );
  refs.exhaustTimingArc.setAttribute(
    'opacity',
    isolatedStroke && isolatedStroke !== 'exhaust' ? '0.20' : '0.92'
  );

  // Rotate phase-wheel ignition marker (-sparkAdvance * 0.5° around 12 o'clock, since -y is 12 o'clock)
  const ignRotDeg = -sparkAdvance * 0.5;
  refs.phaseIgnMarker.setAttribute('transform', `translate(124, 121) rotate(${ignRotDeg.toFixed(2)})`);
  const sparkLabel =
    sparkAdvance >= 0 ? `IGN ${sparkAdvance}° BTDC` : `IGN ${Math.abs(sparkAdvance)}° ATDC`;
  refs.phaseIgnBadge.textContent = sparkLabel;

  // Rotate live phase hand (0° crank = 90° SVG polar = 6 o'clock; 360° crank = 270° = 12 o'clock)
  const wheelDeg = 90 + state.crankAngle * 0.5;
  refs.phaseHand.setAttribute('transform', `translate(124, 121) rotate(${wheelDeg.toFixed(2)})`);

  // 3. Update Telemetry Readouts
  const { telemetryDom } = refs;
  telemetryDom.rpm.textContent = String(Math.round(rpm));
  telemetryDom.pressure.textContent = state.pressure.toFixed(1);
  const tempSign = state.temperature >= 0 ? '+' : '';
  telemetryDom.temperature.textContent = `${tempSign}${state.temperature.toFixed(1)}°C`;
  telemetryDom.crankAngle.textContent = state.crankAngleText;
}
