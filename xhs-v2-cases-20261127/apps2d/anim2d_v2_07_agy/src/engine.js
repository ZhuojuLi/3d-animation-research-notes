/**
 * Multipart SVG Four-Stroke DOHC Engine builder and deterministic renderer.
 * Every animated property in #stage is driven purely by evaluateCycleState().
 */

import { ENGINE_GEOM, clamp } from './cycle.js';

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

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function lerpColor(hexA, hexB, t) {
  const u = clamp(t, 0, 1);
  const a = parseInt(hexA.slice(1), 16);
  const b = parseInt(hexB.slice(1), 16);
  const r = Math.round(lerp((a >> 16) & 255, (b >> 16) & 255, u));
  const g = Math.round(lerp((a >> 8) & 255, (b >> 8) & 255, u));
  const bl = Math.round(lerp(a & 255, b & 255, u));
  return `rgb(${r}, ${g}, ${bl})`;
}

/**
 * Generates an analytical conjugate cam lobe closed path in local cam coordinates.
 * Lobe nose at noseDeg lifts smoothly from baseR to baseR + peakLift over ±45° cam angle.
 */
function buildCamLobePath(baseR, peakLift, noseDeg) {
  const pts = [];
  const steps = 96;
  for (let i = 0; i < steps; i += 1) {
    const deg = (i / steps) * 360;
    let delta = ((deg - noseDeg + 540) % 360) - 180;
    let r = baseR;
    if (Math.abs(delta) < 45) {
      r = baseR + peakLift * 0.5 * (1 + Math.cos((delta / 45) * Math.PI));
    }
    const rad = (deg * Math.PI) / 180;
    const x = (r * Math.cos(rad)).toFixed(2);
    const y = (r * Math.sin(rad)).toFixed(2);
    pts.push(`${i === 0 ? 'M' : 'L'} ${x} ${y}`);
  }
  return `${pts.join(' ')} Z`;
}

/**
 * Generates spoked gear path centered at (0,0) for cam/crank timing sprockets.
 */
function buildToothedGearPath(outerR, rootR, teethCount) {
  const pts = [];
  const totalSteps = teethCount * 4;
  for (let i = 0; i < totalSteps; i += 1) {
    const phase = i % 4;
    const r = phase === 1 || phase === 2 ? outerR : rootR;
    const angle = ((i + (phase === 1 ? 0.15 : phase === 2 ? -0.15 : 0)) / totalSteps) * Math.PI * 2;
    const x = (r * Math.cos(angle)).toFixed(2);
    const y = (r * Math.sin(angle)).toFixed(2);
    pts.push(`${i === 0 ? 'M' : 'L'} ${x} ${y}`);
  }
  return `${pts.join(' ')} Z`;
}

/**
 * Generates helical valve spring coil path along a tilted valve stem from fixed seat to moving retainer.
 */
function buildValveSpringPath(seatX, seatY, retX, retY, halfWidth, coils = 6) {
  const dx = retX - seatX;
  const dy = retY - seatY;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  // Perpendicular normal
  const nx = -uy;
  const ny = ux;

  const cmds = [];
  // Bottom seat flat turn
  cmds.push(
    `M ${(seatX - nx * halfWidth).toFixed(2)} ${(seatY - ny * halfWidth).toFixed(2)}`,
    `L ${(seatX + nx * halfWidth).toFixed(2)} ${(seatY + ny * halfWidth).toFixed(2)}`
  );

  const totalHalfTurns = coils * 2;
  for (let k = 1; k <= totalHalfTurns; k += 1) {
    const frac = k / (totalHalfTurns + 1);
    const side = k % 2 === 0 ? 1 : -1;
    const px = seatX + dx * frac + nx * halfWidth * side;
    const py = seatY + dy * frac + ny * halfWidth * side;
    cmds.push(`L ${px.toFixed(2)} ${py.toFixed(2)}`);
  }

  // Top retainer flat turn
  cmds.push(
    `L ${(retX - nx * halfWidth).toFixed(2)} ${(retY - ny * halfWidth).toFixed(2)}`,
    `L ${(retX + nx * halfWidth).toFixed(2)} ${(retY + ny * halfWidth).toFixed(2)}`
  );
  return cmds.join(' ');
}

export function createEngineStage(svg) {
  svg.innerHTML = '';
  svg.setAttribute('viewBox', '0 0 840 580');
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');

  const defs = el('defs', {}, svg);

  // Metal casting gradient (muted gray-green pewter matching reference)
  const metalGrad = el('linearGradient', { id: 'cast-metal-grad', x1: '0%', y1: '0%', x2: '100%', y2: '0%' }, defs);
  el('stop', { offset: '0%', 'stop-color': '#93978c' }, metalGrad);
  el('stop', { offset: '28%', 'stop-color': '#aeb1a4' }, metalGrad);
  el('stop', { offset: '72%', 'stop-color': '#9a9e92' }, metalGrad);
  el('stop', { offset: '100%', 'stop-color': '#83887d' }, metalGrad);

  // Machined steel gradient for piston, conrod, crank
  const steelGrad = el('linearGradient', { id: 'machined-steel-grad', x1: '0%', y1: '0%', x2: '100%', y2: '15%' }, defs);
  el('stop', { offset: '0%', 'stop-color': '#8f9489' }, steelGrad);
  el('stop', { offset: '42%', 'stop-color': '#babcaeff' }, steelGrad);
  el('stop', { offset: '78%', 'stop-color': '#989c91' }, steelGrad);
  el('stop', { offset: '100%', 'stop-color': '#787d74' }, steelGrad);

  // Fix 6-digit hex stops for cross-browser strictness
  steelGrad.children[1].setAttribute('stop-color', '#babcae');

  // Intake port blue gas gradient
  const intakePortGrad = el('linearGradient', { id: 'intake-port-grad', x1: '0%', y1: '20%', x2: '100%', y2: '80%' }, defs);
  el('stop', { offset: '0%', 'stop-color': '#3f83bd', 'stop-opacity': '0.92' }, intakePortGrad);
  el('stop', { offset: '60%', 'stop-color': '#5da3dc', 'stop-opacity': '0.88' }, intakePortGrad);
  el('stop', { offset: '100%', 'stop-color': '#77b8ea', 'stop-opacity': '0.82' }, intakePortGrad);

  // Exhaust port orange gas gradient
  const exhaustPortGrad = el('linearGradient', { id: 'exhaust-port-grad', x1: '0%', y1: '80%', x2: '100%', y2: '20%' }, defs);
  el('stop', { offset: '0%', 'stop-color': '#eb964b', 'stop-opacity': '0.90' }, exhaustPortGrad);
  el('stop', { offset: '55%', 'stop-color': '#d57b34', 'stop-opacity': '0.88' }, exhaustPortGrad);
  el('stop', { offset: '100%', 'stop-color': '#9e531d', 'stop-opacity': '0.82' }, exhaustPortGrad);

  // Dynamic combustion chamber horizontal blue-to-orange gradient
  const chamberGrad = el('linearGradient', { id: 'chamber-gas-grad', x1: '0%', y1: '15%', x2: '100%', y2: '25%' }, defs);
  const chStop0 = el('stop', { offset: '0%', 'stop-color': '#4d92cb', 'stop-opacity': '0.88' }, chamberGrad);
  const chStopMid = el('stop', { offset: '52%', 'stop-color': '#8eb4c8', 'stop-opacity': '0.84' }, chamberGrad);
  const chStop1 = el('stop', { offset: '100%', 'stop-color': '#df883f', 'stop-opacity': '0.90' }, chamberGrad);

  // Dynamic RPM gas sheen gradient
  const sheenGrad = el('radialGradient', { id: 'chamber-sheen-grad', cx: '50%', cy: '32%', r: '62%' }, defs);
  const sheenStop0 = el('stop', { offset: '0%', 'stop-color': '#fff6dc', 'stop-opacity': '0.65' }, sheenGrad);
  const sheenStop1 = el('stop', { offset: '55%', 'stop-color': '#f5b86e', 'stop-opacity': '0.25' }, sheenGrad);
  el('stop', { offset: '100%', 'stop-color': '#3b7bb2', 'stop-opacity': '0' }, sheenGrad);

  // Spark / flame kernel radial gradient
  const sparkKernelGrad = el('radialGradient', { id: 'spark-kernel-grad', cx: '50%', cy: '38%', r: '55%' }, defs);
  el('stop', { offset: '0%', 'stop-color': '#ffffff', 'stop-opacity': '1' }, sparkKernelGrad);
  el('stop', { offset: '34%', 'stop-color': '#ffea9f', 'stop-opacity': '0.94' }, sparkKernelGrad);
  el('stop', { offset: '70%', 'stop-color': '#f08c34', 'stop-opacity': '0.58' }, sparkKernelGrad);
  el('stop', { offset: '100%', 'stop-color': '#e07222', 'stop-opacity': '0' }, sparkKernelGrad);

  // Lower bore crankcase reflection gradient (cool left, warm right, dark bottom)
  const underBoreGrad = el('linearGradient', { id: 'under-bore-grad', x1: '0%', y1: '0%', x2: '100%', y2: '65%' }, defs);
  el('stop', { offset: '0%', 'stop-color': '#356189', 'stop-opacity': '0.62' }, underBoreGrad);
  el('stop', { offset: '55%', 'stop-color': '#3c4d5c', 'stop-opacity': '0.45' }, underBoreGrad);
  el('stop', { offset: '100%', 'stop-color': '#6f4e37', 'stop-opacity': '0.52' }, underBoreGrad);

  // 1. Blueprint Grid Backdrop (strictly inside [2, 2, 838, 578])
  const bgGroup = el('g', { id: 'blueprint-grid' }, svg);
  el('rect', { x: 2, y: 2, width: 836, height: 576, fill: '#1b232b' }, bgGroup);

  const minorD = [];
  const majorD = [];
  for (let x = 20; x <= 820; x += 20) {
    (x % 80 === 0 ? majorD : minorD).push(`M ${x} 6 L ${x} 574`);
  }
  for (let y = 20; y <= 560; y += 20) {
    (y % 80 === 0 ? majorD : minorD).push(`M 6 ${y} L 834 ${y}`);
  }
  el('path', { d: minorD.join(' '), stroke: '#2c4050', 'stroke-width': '0.6', opacity: '0.48', fill: 'none' }, bgGroup);
  el('path', { d: majorD.join(' '), stroke: '#3b566b', 'stroke-width': '0.85', opacity: '0.58', fill: 'none' }, bgGroup);

  // 2. Engine Interior Cavities (Crankcase interior + Cylinder bore backdrop)
  const interiorGroup = el('g', { id: 'engine-interiors' }, svg);

  // Crankcase dark interior cavity
  el(
    'path',
    {
      d: 'M 346 358 L 454 358 C 476 368 488 394 488 434 C 488 488 468 516 400 516 C 332 516 312 488 312 434 C 312 394 324 368 346 358 Z',
      fill: '#171e25',
      stroke: '#10151a',
      'stroke-width': '1.5',
    },
    interiorGroup
  );

  // Bore inner background + under-piston sheen
  el('rect', { x: 346, y: 204, width: 108, height: 156, fill: '#1c252f' }, interiorGroup);
  const underPistonRect = el(
    'rect',
    { x: 346, y: 264, width: 108, height: 96, fill: 'url(#under-bore-grad)' },
    interiorGroup
  );

  // 3. Blue Intake Port & Orange Exhaust Port Gas Channels
  const portsGroup = el('g', { id: 'gas-ports' }, svg);

  const intakeGasGroup = el('g', { id: 'intake-gas-path' }, portsGroup);
  el(
    'path',
    {
      d: 'M 294 148 L 328 148 C 350 148 364 162 376 196 L 386 210 L 352 214 C 344 194 334 184 316 184 L 294 184 Z',
      fill: 'url(#intake-port-grad)',
    },
    intakeGasGroup
  );
  // Intake flow arrow & streamlines
  const intakeFlowArrow = el(
    'path',
    {
      d: 'M 304 166 L 332 166 C 344 166 353 174 360 190 M 354 186 L 361 192 L 363 183',
      stroke: '#cbe9ff',
      'stroke-width': '2',
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
      fill: 'none',
      opacity: '0.65',
    },
    intakeGasGroup
  );

  const exhaustGasGroup = el('g', { id: 'exhaust-gas-path' }, portsGroup);
  el(
    'path',
    {
      d: 'M 532 148 L 472 148 C 450 148 436 162 424 196 L 414 210 L 448 214 C 456 194 466 184 484 184 L 532 184 Z',
      fill: 'url(#exhaust-port-grad)',
    },
    exhaustGasGroup
  );
  const exhaustFlowArrow = el(
    'path',
    {
      d: 'M 439 191 C 446 174 456 166 470 166 L 500 166 M 494 161 L 502 166 L 494 171',
      stroke: '#ffe0b5',
      'stroke-width': '2',
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
      fill: 'none',
      opacity: '0.65',
    },
    exhaustGasGroup
  );

  // 4. Dynamic Combustion Chamber Volume
  const chamberGroup = el('g', { id: 'combustion-chamber-group' }, svg);
  const chamberGasPath = el(
    'path',
    {
      id: 'chamber-gas-fill',
      d: 'M 346 226 Q 372 198 400 198 Q 428 198 454 226 L 454 236 L 346 236 Z',
      fill: 'url(#chamber-gas-grad)',
    },
    chamberGroup
  );
  // Dynamic valve-curtain gas jets when intake or exhaust poppet valve lifts
  const intakeCurtainJet = el(
    'path',
    {
      d: 'M 358 206 C 362 218 366 228 375 236 M 384 205 C 388 216 390 225 386 234',
      stroke: '#9ad4ff',
      'stroke-width': '2.4',
      'stroke-linecap': 'round',
      fill: 'none',
      opacity: '0',
    },
    chamberGroup
  );
  const exhaustCurtainJet = el(
    'path',
    {
      d: 'M 424 235 C 432 225 437 216 441 205 M 413 233 C 412 223 414 214 418 205',
      stroke: '#ffd199',
      'stroke-width': '2.4',
      'stroke-linecap': 'round',
      fill: 'none',
      opacity: '0',
    },
    chamberGroup
  );
  // RPM-responsive gas sheen layer inside chamber
  const chamberSheenPath = el(
    'path',
    {
      id: 'chamber-gas-sheen',
      d: 'M 350 226 Q 374 200 400 200 Q 426 200 450 226 L 450 236 L 350 236 Z',
      fill: 'url(#chamber-sheen-grad)',
      opacity: '0.65',
    },
    chamberGroup
  );

  // Swirl / tumble curved arrows inside chamber (matching reference-0.jpg)
  const swirlGroup = el('g', { id: 'chamber-swirl-arrows', opacity: '0.72' }, chamberGroup);
  const swirlLeft = el(
    'path',
    {
      d: 'M 364 214 C 358 223 366 231 381 229 M 376 226 L 383 229 L 377 233',
      stroke: '#26323d',
      'stroke-width': '2.1',
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
      fill: 'none',
    },
    swirlGroup
  );
  const swirlRight = el(
    'path',
    {
      d: 'M 436 214 C 442 223 434 231 419 229 M 424 226 L 417 229 L 423 233',
      stroke: '#26323d',
      'stroke-width': '2.1',
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
      fill: 'none',
    },
    swirlGroup
  );

  // Spark & Flame Kernel right beneath central spark plug gap (400, 205)
  const sparkGroup = el('g', { id: 'spark-flash-group' }, chamberGroup);
  const flameHalo = el(
    'ellipse',
    {
      cx: 400,
      cy: 213,
      rx: 22,
      ry: 16,
      fill: 'url(#spark-kernel-grad)',
      opacity: '0',
    },
    sparkGroup
  );
  const sparkArc = el(
    'path',
    {
      d: 'M 400 201 L 397 205 L 403 207 L 399 212 M 394 206 L 400 205 L 406 206',
      stroke: '#fffef2',
      'stroke-width': '2.2',
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
      fill: 'none',
      opacity: '0',
    },
    sparkGroup
  );

  // 5. Multipart Structural Castings: Cylinder Head, Block Walls (w/ Water Jackets), Liner, and Crankcase Walls
  const structureGroup = el('g', { id: 'engine-structure' }, svg);

  // Separate Crankcase Housing Wall (bolted below y = 358)
  el(
    'path',
    {
      id: 'crankcase-wall',
      d: [
        'M 314 358 L 346 358',
        'C 324 368 312 394 312 434',
        'C 312 488 332 516 400 516',
        'C 468 516 488 488 488 434',
        'C 488 394 476 368 454 358',
        'L 486 358 L 486 368',
        'C 496 382 500 400 500 416',
        'L 505 416 L 505 452 L 500 452',
        'C 500 460 499 466 498 470',
        'L 505 470 L 505 484 L 496 484',
        'C 488 514 460 528 400 528',
        'C 340 528 312 514 304 484',
        'L 295 484 L 295 470 L 302 470',
        'C 299 458 299 446 299 434',
        'C 299 400 304 380 314 368 Z',
      ].join(' '),
      fill: 'url(#cast-metal-grad)',
      stroke: '#1d2329',
      'stroke-width': '2',
      'stroke-linejoin': 'round',
    },
    structureGroup
  );
  // Crankcase split flange seam marks
  el('line', { x1: 295, y1: 477, x2: 306, y2: 477, stroke: '#232a31', 'stroke-width': '1.6' }, structureGroup);
  el('line', { x1: 494, y1: 477, x2: 505, y2: 477, stroke: '#232a31', 'stroke-width': '1.6' }, structureGroup);

  // Separate Left Cylinder Block Wall + Coolant Water Jacket
  const leftBlockGroup = el('g', { id: 'cylinder-block-left' }, structureGroup);
  el(
    'rect',
    {
      x: 318,
      y: 206,
      width: 28,
      height: 152,
      rx: 1.5,
      fill: 'url(#cast-metal-grad)',
      stroke: '#1d2329',
      'stroke-width': '2',
    },
    leftBlockGroup
  );
  el(
    'rect',
    {
      x: 326.5,
      y: 215,
      width: 9.5,
      height: 133,
      rx: 4.5,
      fill: '#23303b',
      stroke: '#1b2229',
      'stroke-width': '1.4',
    },
    leftBlockGroup
  );

  // Separate Right Cylinder Block Wall + Coolant Water Jacket
  const rightBlockGroup = el('g', { id: 'cylinder-block-right' }, structureGroup);
  el(
    'rect',
    {
      x: 454,
      y: 206,
      width: 28,
      height: 152,
      rx: 1.5,
      fill: 'url(#cast-metal-grad)',
      stroke: '#1d2329',
      'stroke-width': '2',
    },
    rightBlockGroup
  );
  el(
    'rect',
    {
      x: 464,
      y: 215,
      width: 9.5,
      height: 133,
      rx: 4.5,
      fill: '#23303b',
      stroke: '#1b2229',
      'stroke-width': '1.4',
    },
    rightBlockGroup
  );

  // Separate Honed Cylinder Bore Liners
  el('rect', { x: 342, y: 206, width: 4, height: 154, fill: '#c8cbbd', stroke: '#1d2329', 'stroke-width': '1.2' }, structureGroup);
  el('rect', { x: 454, y: 206, width: 4, height: 154, fill: '#c8cbbd', stroke: '#1d2329', 'stroke-width': '1.2' }, structureGroup);

  // Separate Cylinder Head Port Walls & Pent-Roof Deck
  const headGroup = el('g', { id: 'cylinder-head-casting' }, structureGroup);
  // Left intake port upper & lower cast walls
  el(
    'path',
    {
      d: 'M 294 140 L 332 140 C 350 140 364 150 374 174 L 386 174 L 386 198 L 376 198 C 365 166 350 148 328 148 L 294 148 Z',
      fill: 'url(#cast-metal-grad)',
      stroke: '#1d2329',
      'stroke-width': '1.8',
      'stroke-linejoin': 'round',
    },
    headGroup
  );
  el(
    'path',
    {
      d: 'M 294 184 L 316 184 C 336 184 346 194 352 214 L 346 226 L 346 206 L 316 206 C 316 196 308 192 294 192 Z',
      fill: 'url(#cast-metal-grad)',
      stroke: '#1d2329',
      'stroke-width': '1.8',
      'stroke-linejoin': 'round',
    },
    headGroup
  );

  // Right exhaust port upper & lower cast walls (extending to x=532 with end flange like reference-0.jpg)
  el(
    'path',
    {
      d: 'M 532 140 L 468 140 C 450 140 436 150 426 174 L 414 174 L 414 198 L 424 198 C 435 166 450 148 472 148 L 532 148 Z',
      fill: 'url(#cast-metal-grad)',
      stroke: '#1d2329',
      'stroke-width': '1.8',
      'stroke-linejoin': 'round',
    },
    headGroup
  );
  el(
    'path',
    {
      d: 'M 532 184 L 484 184 C 464 184 454 194 448 214 L 454 226 L 454 206 L 484 206 C 484 196 492 192 532 192 Z',
      fill: 'url(#cast-metal-grad)',
      stroke: '#1d2329',
      'stroke-width': '1.8',
      'stroke-linejoin': 'round',
    },
    headGroup
  );
  // Central head bridge around spark plug reach
  el(
    'path',
    {
      d: 'M 384 176 L 416 176 L 413 200 Q 400 197 387 200 Z',
      fill: 'url(#cast-metal-grad)',
      stroke: '#1d2329',
      'stroke-width': '1.6',
    },
    headGroup
  );

  // 6. Rotating & Reciprocating Bottom-End Mechanism
  const mechanismGroup = el('g', { id: 'bottom-end-mechanism' }, svg);

  // 6A. Counterweighted Crankshaft (rotates around 400, 434)
  const crankGroup = el('g', { id: 'crankshaft-group', transform: 'translate(400, 434) rotate(0)' }, mechanismGroup);
  // Concentric crank timing gear ring behind counterweight
  el(
    'path',
    {
      d: buildToothedGearPath(29, 25, 20),
      fill: '#6c7268',
      stroke: '#1d2329',
      'stroke-width': '1.2',
    },
    crankGroup
  );
  // Sculpted counterweighted crankshaft web (throw at (0, -42), broad counterweight lobe opposite at +y)
  el(
    'path',
    {
      d: [
        'M -18 -44',
        'C -18 -56 18 -56 18 -44',
        'L 23 -12',
        'C 46 -6 64 12 65 32',
        'C 66 44 54 50 38 46',
        'C 26 43 18 52 10 64',
        'C 2 70 -18 68 -34 60',
        'C -54 50 -66 32 -63 14',
        'C -60 -2 -44 -10 -23 -12 Z',
      ].join(' '),
      fill: 'url(#machined-steel-grad)',
      stroke: '#1c2228',
      'stroke-width': '2',
      'stroke-linejoin': 'round',
    },
    crankGroup
  );
  // Machined balance pocket detail on counterweight
  el(
    'path',
    {
      d: 'M -46 22 C -42 40 -22 52 2 52 C 14 52 24 42 36 36',
      stroke: '#70756b',
      'stroke-width': '2',
      fill: 'none',
      opacity: '0.65',
    },
    crankGroup
  );

  // 6B. Ringed Piston (slides vertically along x = 400, anchored at wristY)
  const pistonGroup = el('g', { id: 'piston-group', transform: 'translate(400, 264)' }, mechanismGroup);
  // Main piston body with arched lower skirt relief
  el(
    'path',
    {
      d: [
        'M -52.2 -28 L 52.2 -28',
        'L 52.2 24 L 34 24',
        'C 30 14 22 10 14 10',
        'L -14 10',
        'C -22 10 -30 14 -34 24',
        'L -52.2 24 Z',
      ].join(' '),
      fill: 'url(#machined-steel-grad)',
      stroke: '#1b2127',
      'stroke-width': '1.9',
      'stroke-linejoin': 'round',
    },
    pistonGroup
  );
  // Piston crown thermal top land highlight
  el('rect', { x: -51, y: -27, width: 102, height: 3.5, fill: '#d8d9cb', opacity: '0.7' }, pistonGroup);
  // Three distinct piston rings (2 compression + 1 oil control ring)
  for (const ry of [-21.5, -17, -12.5]) {
    el('rect', { x: -53.3, y: ry, width: 106.6, height: 2.6, rx: 0.8, fill: '#cfd2c4', stroke: '#191f25', 'stroke-width': '1' }, pistonGroup);
  }
  // Wrist-pin boss ring on piston
  el('circle', { cx: 0, cy: 0, r: 15.5, fill: '#8a8f84', stroke: '#1d2329', 'stroke-width': '1.6' }, pistonGroup);

  // 6C. Articulated Forged I-Beam Connecting Rod (small end at (0,0) = wrist pin, big end at (0, 128) = crank journal)
  const conrodGroup = el('g', { id: 'connecting-rod-group', transform: 'translate(400, 264) rotate(0)' }, mechanismGroup);
  el(
    'path',
    {
      d: [
        'M -14 0 A 14 14 0 1 1 14 0',
        'L 10 18 L 13 102',
        'C 20 108 23 117 23 128',
        'A 23 23 0 1 1 -23 128',
        'C -23 117 -20 108 -13 102',
        'L -10 18 Z',
      ].join(' '),
      fill: 'url(#machined-steel-grad)',
      stroke: '#1b2127',
      'stroke-width': '1.9',
      'stroke-linejoin': 'round',
    },
    conrodGroup
  );
  // Recessed I-beam flute channel along rod shank
  el(
    'path',
    {
      d: 'M -4.2 19 L 4.2 19 L 6.4 102 L -6.4 102 Z',
      fill: '#6f746a',
      stroke: '#2b3238',
      'stroke-width': '1.1',
    },
    conrodGroup
  );
  // Split big-end bearing cap parting line & bolt lugs
  el('line', { x1: -23, y1: 128, x2: -13, y2: 128, stroke: '#1b2127', 'stroke-width': '1.6' }, conrodGroup);
  el('line', { x1: 13, y1: 128, x2: 23, y2: 128, stroke: '#1b2127', 'stroke-width': '1.6' }, conrodGroup);
  el('rect', { x: -24.5, y: 118, width: 4.5, height: 18, rx: 1, fill: '#9fa396', stroke: '#1b2127', 'stroke-width': '1.1' }, conrodGroup);
  el('rect', { x: 20, y: 118, width: 4.5, height: 18, rx: 1, fill: '#9fa396', stroke: '#1b2127', 'stroke-width': '1.1' }, conrodGroup);

  // 6D. Separate Wrist Pin & Crankpin Journal Foregrounds + Main Shaft Hub
  const wristPinGroup = el('g', { id: 'wrist-pin-group', transform: 'translate(400, 264)' }, mechanismGroup);
  el('circle', { cx: 0, cy: 0, r: 10.2, fill: '#c8cbbd', stroke: '#1b2127', 'stroke-width': '1.6' }, wristPinGroup);
  el('circle', { cx: 0, cy: 0, r: 5.4, fill: '#2c353e', stroke: '#191f25', 'stroke-width': '1.2' }, wristPinGroup);

  const crankJournalGroup = el('g', { id: 'crank-journal-group', transform: 'translate(400, 392)' }, mechanismGroup);
  el('circle', { cx: 0, cy: 0, r: 15.2, fill: '#888d82', stroke: '#1b2127', 'stroke-width': '1.5' }, crankJournalGroup);
  el('circle', { cx: 0, cy: 0, r: 11.4, fill: '#cfd2c4', stroke: '#1b2127', 'stroke-width': '1.5' }, crankJournalGroup);
  el('circle', { cx: 0, cy: 0, r: 3.2, fill: '#313a43' }, crankJournalGroup);

  // Main Crankshaft Center Bearing Hub at (400, 434)
  const mainHub = el('g', { id: 'crank-main-hub', transform: 'translate(400, 434)' }, mechanismGroup);
  el('circle', { cx: 0, cy: 0, r: 13.5, fill: '#b8bbb0', stroke: '#1b2127', 'stroke-width': '1.6' }, mainHub);
  el('circle', { cx: 0, cy: 0, r: 5.5, fill: '#6c7268', stroke: '#1b2127', 'stroke-width': '1.2' }, mainHub);

  // 7. Valvetrain, Poppet Valves, Valve Springs, Central Spark Plug, and Dual Overhead Camshafts
  const valvetrainGroup = el('g', { id: 'dohc-valvetrain' }, svg);

  // Fixed lower spring seats / valve guides on head
  // Intake axis: cam (342, 104) -> seat (373, 206), unit = (+0.2908, +0.9568)
  // Exhaust axis: cam (458, 104) -> seat (427, 206), unit = (-0.2908, +0.9568)
  el(
    'polygon',
    {
      points: '355,174 373,168 377,181 359,187',
      fill: '#7d8277',
      stroke: '#1d2329',
      'stroke-width': '1.4',
    },
    valvetrainGroup
  );
  el(
    'polygon',
    {
      points: '445,174 427,168 423,181 441,187',
      fill: '#7d8277',
      stroke: '#1d2329',
      'stroke-width': '1.4',
    },
    valvetrainGroup
  );

  // Dynamic Valve Springs
  const intakeSpringPath = el(
    'path',
    {
      id: 'intake-valve-spring',
      d: '',
      stroke: '#c9ccbe',
      'stroke-width': '2.6',
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
      fill: 'none',
    },
    valvetrainGroup
  );
  const exhaustSpringPath = el(
    'path',
    {
      id: 'exhaust-valve-spring',
      d: '',
      stroke: '#c9ccbe',
      'stroke-width': '2.6',
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
      fill: 'none',
    },
    valvetrainGroup
  );

  // Moving Intake Poppet Valve (local origin at closed seat center (373, 206), rotated -16.91° so -y is up along stem!)
  const intakeValveWrapper = el('g', { id: 'intake-valve-group', transform: 'translate(373, 206)' }, valvetrainGroup);
  const intakeValveLocal = el('g', { transform: 'rotate(-16.91)' }, intakeValveWrapper);
  // Poppet tulip head + stem + upper retainer + tappet bucket cap
  el(
    'path',
    {
      d: 'M -15 2 L 15 2 L 12 -2 C 5 -5 3 -12 2.6 -22 L 2.6 -80 L -2.6 -80 L -2.6 -22 C -3 -12 -5 -5 -12 -2 Z',
      fill: 'url(#machined-steel-grad)',
      stroke: '#1b2127',
      'stroke-width': '1.6',
      'stroke-linejoin': 'round',
    },
    intakeValveLocal
  );
  // Upper spring retainer & tappet bucket cap (top surface at y = -92.3 -> radius 14.5 from cam center at y = -106.8!)
  el('rect', { x: -13, y: -84, width: 26, height: 4.5, rx: 1.5, fill: '#b8bbb0', stroke: '#1b2127', 'stroke-width': '1.3' }, intakeValveLocal);
  el('rect', { x: -11, y: -92.3, width: 22, height: 8.3, rx: 2, fill: '#9ca094', stroke: '#1b2127', 'stroke-width': '1.4' }, intakeValveLocal);

  // Moving Exhaust Poppet Valve (local origin at closed seat center (427, 206), rotated +16.91°)
  const exhaustValveWrapper = el('g', { id: 'exhaust-valve-group', transform: 'translate(427, 206)' }, valvetrainGroup);
  const exhaustValveLocal = el('g', { transform: 'rotate(16.91)' }, exhaustValveWrapper);
  el(
    'path',
    {
      d: 'M -15 2 L 15 2 L 12 -2 C 5 -5 3 -12 2.6 -22 L 2.6 -80 L -2.6 -80 L -2.6 -22 C -3 -12 -5 -5 -12 -2 Z',
      fill: 'url(#machined-steel-grad)',
      stroke: '#1b2127',
      'stroke-width': '1.6',
      'stroke-linejoin': 'round',
    },
    exhaustValveLocal
  );
  el('rect', { x: -13, y: -84, width: 26, height: 4.5, rx: 1.5, fill: '#b8bbb0', stroke: '#1b2127', 'stroke-width': '1.3' }, exhaustValveLocal);
  el('rect', { x: -11, y: -92.3, width: 22, height: 8.3, rx: 2, fill: '#9ca094', stroke: '#1b2127', 'stroke-width': '1.4' }, exhaustValveLocal);

  // Central Spark Plug (x = 400)
  const sparkPlug = el('g', { id: 'central-spark-plug' }, valvetrainGroup);
  // Terminal stud
  el('rect', { x: 397.5, y: 129, width: 5, height: 9, rx: 1.5, fill: '#c8cbbd', stroke: '#1b2127', 'stroke-width': '1.2' }, sparkPlug);
  // White ribbed ceramic insulator
  el('rect', { x: 394, y: 138, width: 12, height: 28, rx: 2.5, fill: '#f0ece1', stroke: '#232a31', 'stroke-width': '1.4' }, sparkPlug);
  for (const iy of [144, 150, 156]) {
    el('line', { x1: 394.5, y1: iy, x2: 405.5, y2: iy, stroke: '#9da39a', 'stroke-width': '1.2' }, sparkPlug);
  }
  // Hex steel shell & threaded reach
  el('rect', { x: 391.5, y: 166, width: 17, height: 11, rx: 1.5, fill: '#8e9388', stroke: '#1b2127', 'stroke-width': '1.5' }, sparkPlug);
  el('rect', { x: 394, y: 177, width: 12, height: 22, fill: '#757a70', stroke: '#1b2127', 'stroke-width': '1.4' }, sparkPlug);
  for (const ty of [182, 187, 192, 196]) {
    el('line', { x1: 394, y1: ty, x2: 406, y2: ty, stroke: '#232a31', 'stroke-width': '1.2' }, sparkPlug);
  }
  // Center electrode + J-ground strap
  el('rect', { x: 398.5, y: 199, width: 3, height: 4.5, fill: '#e6e2d3', stroke: '#1b2127', 'stroke-width': '0.9' }, sparkPlug);
  el(
    'path',
    {
      d: 'M 395 199 L 395 206.5 L 402 206.5',
      stroke: '#aeb2a5',
      'stroke-width': '2',
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
      fill: 'none',
    },
    sparkPlug
  );

  // Horizontal DOHC Camshaft Carrier Shaft & Bearing Journals (matching reference-0.jpg top bar)
  const camCarrier = el('g', { id: 'cam-carrier-bar' }, valvetrainGroup);
  // Main horizontal cross-shaft bar
  el('rect', { x: 294, y: 97, width: 211, height: 14, fill: 'url(#cast-metal-grad)', stroke: '#1b2127', 'stroke-width': '1.6' }, camCarrier);
  // Bearing cap towers along the bar
  for (const [bx, bw, bh] of [
    [297, 12, 34],
    [369, 14, 26],
    [417, 14, 26],
    [483, 13, 28],
  ]) {
    el(
      'rect',
      {
        x: bx,
        y: 104 - bh / 2,
        width: bw,
        height: bh,
        rx: 2,
        fill: 'url(#machined-steel-grad)',
        stroke: '#1b2127',
        'stroke-width': '1.6',
      },
      camCarrier
    );
  }

  // Dual Overhead Camshafts with Rotating Spoked Gears & Distinct Conjugate Lobes (0.5x crank speed!)
  // Intake Cam at (342, 104): valve axis is +73.09°, peak at camAngle = 45° -> local noseDeg = 28.09°
  const intakeCamGroup = el('g', { id: 'intake-cam-group', transform: 'translate(342, 104) rotate(0)' }, valvetrainGroup);
  el('path', { d: buildToothedGearPath(20, 17, 16), fill: '#6c7268', stroke: '#1b2127', 'stroke-width': '1.1' }, intakeCamGroup);
  el(
    'path',
    {
      d: buildCamLobePath(ENGINE_GEOM.camBaseRadius, ENGINE_GEOM.camPeakLift, 28.09),
      fill: 'url(#machined-steel-grad)',
      stroke: '#1b2127',
      'stroke-width': '1.8',
    },
    intakeCamGroup
  );
  el('circle', { cx: 0, cy: 0, r: 6.2, fill: '#888d82', stroke: '#1b2127', 'stroke-width': '1.4' }, intakeCamGroup);
  el('line', { x1: -5, y1: 0, x2: 5, y2: 0, stroke: '#1b2127', 'stroke-width': '1.5' }, intakeCamGroup);

  // Exhaust Cam at (458, 104): valve axis is +106.91°, peak at camAngle = 315° -> local noseDeg = 151.91°
  const exhaustCamGroup = el('g', { id: 'exhaust-cam-group', transform: 'translate(458, 104) rotate(0)' }, valvetrainGroup);
  el('path', { d: buildToothedGearPath(20, 17, 16), fill: '#6c7268', stroke: '#1b2127', 'stroke-width': '1.1' }, exhaustCamGroup);
  el(
    'path',
    {
      d: buildCamLobePath(ENGINE_GEOM.camBaseRadius, ENGINE_GEOM.camPeakLift, 151.91),
      fill: 'url(#machined-steel-grad)',
      stroke: '#1b2127',
      'stroke-width': '1.8',
    },
    exhaustCamGroup
  );
  el('circle', { cx: 0, cy: 0, r: 6.2, fill: '#888d82', stroke: '#1b2127', 'stroke-width': '1.4' }, exhaustCamGroup);
  el('line', { x1: -5, y1: 0, x2: 5, y2: 0, stroke: '#1b2127', 'stroke-width': '1.5' }, exhaustCamGroup);

  // 8. Cam Pulley, Crank Pulley, and Advancing Right-Side Timing Belt
  const beltDriveGroup = el('g', { id: 'timing-belt-drive' }, svg);

  // Upper Cam Pulley (x = 502..520, y = 56..152 -> 96px diameter, 2:1 ratio with crank pulley)
  const camPulleyGroup = el('g', { id: 'cam-pulley' }, beltDriveGroup);
  el('rect', { x: 503, y: 56, width: 16, height: 96, rx: 2, fill: 'url(#machined-steel-grad)', stroke: '#1b2127', 'stroke-width': '1.7' }, camPulleyGroup);
  const camPulleyTeethLeft = el(
    'line',
    {
      x1: 502,
      y1: 60,
      x2: 502,
      y2: 148,
      stroke: '#dfd6be',
      'stroke-width': '2.4',
      'stroke-dasharray': '4 4',
      'stroke-dashoffset': '0',
    },
    camPulleyGroup
  );
  const camPulleyTeethRight = el(
    'line',
    {
      x1: 520,
      y1: 60,
      x2: 520,
      y2: 148,
      stroke: '#dfd6be',
      'stroke-width': '2.4',
      'stroke-dasharray': '4 4',
      'stroke-dashoffset': '0',
    },
    camPulleyGroup
  );
  // Cam shaft end cap
  el('rect', { x: 519, y: 95, width: 8, height: 18, rx: 1.5, fill: '#9ca094', stroke: '#1b2127', 'stroke-width': '1.5' }, camPulleyGroup);

  // Lower Crank Pulley (x = 503..519, y = 410..458 -> 48px diameter) + Snout Boss
  const crankPulleyGroup = el('g', { id: 'crank-pulley' }, beltDriveGroup);
  el('rect', { x: 503, y: 410, width: 16, height: 48, rx: 2, fill: 'url(#machined-steel-grad)', stroke: '#1b2127', 'stroke-width': '1.7' }, crankPulleyGroup);
  const crankPulleyTeethLeft = el(
    'line',
    {
      x1: 502,
      y1: 413,
      x2: 502,
      y2: 455,
      stroke: '#dfd6be',
      'stroke-width': '2.4',
      'stroke-dasharray': '4 4',
      'stroke-dashoffset': '0',
    },
    crankPulleyGroup
  );
  const crankPulleyTeethRight = el(
    'line',
    {
      x1: 520,
      y1: 413,
      x2: 520,
      y2: 455,
      stroke: '#dfd6be',
      'stroke-width': '2.4',
      'stroke-dasharray': '4 4',
      'stroke-dashoffset': '0',
    },
    crankPulleyGroup
  );
  // Crank snout end cap (matching reference-0.jpg bottom-right boss)
  el('rect', { x: 519, y: 418, width: 12, height: 32, rx: 2, fill: 'url(#cast-metal-grad)', stroke: '#1b2127', 'stroke-width': '1.6' }, crankPulleyGroup);

  // Right-Side Timing Belt Web & Advancing Inner Cogs
  el(
    'rect',
    {
      x: 506,
      y: 55,
      width: 10,
      height: 404,
      rx: 2,
      fill: '#232930',
      stroke: '#12161b',
      'stroke-width': '1.5',
    },
    beltDriveGroup
  );
  const timingBeltCogs = el(
    'line',
    {
      id: 'timing-belt-cogs',
      x1: 511,
      y1: 59,
      x2: 511,
      y2: 455,
      stroke: '#8a9188',
      'stroke-width': '5.5',
      'stroke-dasharray': '3.5 4.5',
      'stroke-dashoffset': '0',
    },
    beltDriveGroup
  );
  // Outer belt spine sheen
  el('line', { x1: 514.5, y1: 57, x2: 514.5, y2: 457, stroke: '#4c5661', 'stroke-width': '1.2' }, beltDriveGroup);

  // 9. Five Reference Leader-Line Labels (clean horizontal leaders + warm ivory circular dots)
  const labelsGroup = el('g', { id: 'leader-labels' }, svg);
  const callouts = [
    {
      id: 'label-cams',
      text: 'Dual Overhead Camshafts',
      tx: 238,
      ty: 108,
      anchor: 'end',
      x1: 246,
      y1: 104,
      x2: 342,
      y2: 104,
    },
    {
      id: 'label-piston-rod',
      text: 'Piston & Connecting Rod',
      tx: 238,
      ty: 298,
      anchor: 'end',
      x1: 246,
      y1: 294,
      x2: 386,
      y2: 294,
    },
    {
      id: 'label-crank',
      text: 'Counterweighted Crankshaft',
      tx: 238,
      ty: 438,
      anchor: 'end',
      x1: 246,
      y1: 434,
      x2: 400,
      y2: 434,
    },
    {
      id: 'label-exhaust-valve',
      text: 'Exhaust Valve',
      tx: 574,
      ty: 140,
      anchor: 'start',
      x1: 566,
      y1: 136,
      x2: 448,
      y2: 136,
    },
    {
      id: 'label-chamber',
      text: 'Combustion Chamber',
      tx: 574,
      ty: 224,
      anchor: 'start',
      x1: 566,
      y1: 220,
      x2: 424,
      y2: 220,
    },
  ];

  for (const item of callouts) {
    const g = el('g', { id: item.id }, labelsGroup);
    el(
      'line',
      {
        x1: item.x1,
        y1: item.y1,
        x2: item.x2,
        y2: item.y2,
        stroke: '#ded5bc',
        'stroke-width': '1.35',
      },
      g
    );
    el(
      'circle',
      {
        cx: item.x2,
        cy: item.y2,
        r: 3.1,
        fill: '#e9e1cb',
        stroke: '#1b2229',
        'stroke-width': '1',
      },
      g
    );
    const txt = el(
      'text',
      {
        x: item.tx,
        y: item.ty,
        'text-anchor': item.anchor,
        fill: '#e8e1cd',
        'font-family': 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
        'font-size': '14.5',
        'font-weight': '500',
        'letter-spacing': '0.15',
      },
      g
    );
    txt.textContent = item.text;
  }

  return {
    chStop0,
    chStopMid,
    chStop1,
    sheenStop0,
    sheenStop1,
    underPistonRect,
    intakeGasGroup,
    intakeFlowArrow,
    exhaustGasGroup,
    exhaustFlowArrow,
    chamberGasPath,
    intakeCurtainJet,
    exhaustCurtainJet,
    chamberSheenPath,
    swirlGroup,
    swirlLeft,
    swirlRight,
    flameHalo,
    sparkArc,
    crankGroup,
    pistonGroup,
    conrodGroup,
    wristPinGroup,
    crankJournalGroup,
    intakeSpringPath,
    exhaustSpringPath,
    intakeValveWrapper,
    exhaustValveWrapper,
    intakeCamGroup,
    exhaustCamGroup,
    timingBeltCogs,
    camPulleyTeethLeft,
    camPulleyTeethRight,
    crankPulleyTeethLeft,
    crankPulleyTeethRight,
  };
}

/**
 * Deterministically updates every animated SVG element in #stage from state.
 */
export function renderEngineStage(refs, state) {
  const { kinematics: kin, thermo: th, isolatedStroke, activeStroke } = state;

  // 1. Crankshaft, Piston, Wrist Pin, Connecting Rod, and Crankpin Journal
  refs.crankGroup.setAttribute('transform', `translate(400, 434) rotate(${kin.crankRotationDeg.toFixed(3)})`);
  refs.pistonGroup.setAttribute('transform', `translate(400, ${kin.wristY.toFixed(3)})`);
  refs.wristPinGroup.setAttribute('transform', `translate(400, ${kin.wristY.toFixed(3)})`);
  refs.conrodGroup.setAttribute(
    'transform',
    `translate(400, ${kin.wristY.toFixed(3)}) rotate(${kin.rodSvgRotateDeg.toFixed(3)})`
  );
  refs.crankJournalGroup.setAttribute(
    'transform',
    `translate(${kin.journalX.toFixed(3)}, ${kin.journalY.toFixed(3)})`
  );

  // Update under-piston bore shading below moving skirt
  const skirtBottom = Math.min(358, kin.wristY + 22);
  refs.underPistonRect.setAttribute('y', skirtBottom.toFixed(2));
  refs.underPistonRect.setAttribute('height', Math.max(2, 360 - skirtBottom).toFixed(2));

  // 2. Dual Overhead Camshafts (0.5x crank speed)
  const camRot = kin.camAngleDeg.toFixed(3);
  refs.intakeCamGroup.setAttribute('transform', `translate(342, 104) rotate(${camRot})`);
  refs.exhaustCamGroup.setAttribute('transform', `translate(458, 104) rotate(${camRot})`);

  // 3. Poppet Valves & Helical Valve Springs
  const tiltRad = (16.91 * Math.PI) / 180;
  const sinT = Math.sin(tiltRad);
  const cosT = Math.cos(tiltRad);

  const inDx = sinT * kin.intakeLiftPx;
  const inDy = cosT * kin.intakeLiftPx;
  refs.intakeValveWrapper.setAttribute(
    'transform',
    `translate(${(373 + inDx).toFixed(3)}, ${(206 + inDy).toFixed(3)})`
  );

  // Fixed intake spring lower seat ~30px up along stem, moving upper retainer ~81px up from moving head
  const inSeatX = 373 - sinT * 30;
  const inSeatY = 206 - cosT * 30;
  const inRetX = 373 + inDx - sinT * 80.5;
  const inRetY = 206 + inDy - cosT * 80.5;
  refs.intakeSpringPath.setAttribute('d', buildValveSpringPath(inSeatX, inSeatY, inRetX, inRetY, 9.6, 6));

  const exDx = -sinT * kin.exhaustLiftPx;
  const exDy = cosT * kin.exhaustLiftPx;
  refs.exhaustValveWrapper.setAttribute(
    'transform',
    `translate(${(427 + exDx).toFixed(3)}, ${(206 + exDy).toFixed(3)})`
  );

  const exSeatX = 427 + sinT * 30;
  const exSeatY = 206 - cosT * 30;
  const exRetX = 427 + exDx + sinT * 80.5;
  const exRetY = 206 + exDy - cosT * 80.5;
  refs.exhaustSpringPath.setAttribute('d', buildValveSpringPath(exSeatX, exSeatY, exRetX, exRetY, 9.6, 6));

  // 4. Right-Side Timing Belt & Pulleys (exact integer pitch cycle = 16 * 8 = 128px per 720° cycle)
  const beltTravel = ((state.crankAngle / 720) * 128) % 8;
  const dashOffset = (-beltTravel).toFixed(3);
  refs.timingBeltCogs.setAttribute('stroke-dashoffset', dashOffset);
  refs.camPulleyTeethLeft.setAttribute('stroke-dashoffset', dashOffset);
  refs.camPulleyTeethRight.setAttribute('stroke-dashoffset', dashOffset);
  refs.crankPulleyTeethLeft.setAttribute('stroke-dashoffset', dashOffset);
  refs.crankPulleyTeethRight.setAttribute('stroke-dashoffset', dashOffset);

  // 5. Combustion Chamber Geometry, Blue-to-Orange Gas Gradient, RPM Sheen, and Swirl Arrows
  const crownY = kin.crownY;
  refs.chamberGasPath.setAttribute(
    'd',
    `M 346 226 Q 372 198 400 198 Q 428 198 454 226 L 454 ${crownY.toFixed(2)} L 346 ${crownY.toFixed(2)} Z`
  );
  refs.chamberSheenPath.setAttribute(
    'd',
    `M 349 226 Q 374 200 400 200 Q 426 200 451 226 L 451 ${(crownY - 1).toFixed(2)} L 349 ${(crownY - 1).toFixed(2)} Z`
  );

  // Coordinate blue-to-orange chamber gradient from warmth [0..1]
  const w = th.chamberWarmth;
  const leftCol = lerpColor('#3f89c8', '#5e96c2', w * 0.65);
  const midCol = lerpColor('#6bb1e4', '#e59a50', w);
  const rightCol = lerpColor('#8fc4e8', '#ec8535', clamp(0.28 + w * 0.85, 0, 1));
  refs.chStop0.setAttribute('stop-color', leftCol);
  refs.chStopMid.setAttribute('stop-color', midCol);
  refs.chStop1.setAttribute('stop-color', rightCol);

  // RPM visibly adjusts chamber gas sheen intensity at every crank angle
  const sheenOpacity = 0.14 + 0.72 * th.rpmNorm;
  refs.chamberSheenPath.setAttribute('opacity', sheenOpacity.toFixed(3));
  refs.sheenStop0.setAttribute('stop-color', lerpColor('#bfe4ff', '#fff5d4', w));
  refs.sheenStop0.setAttribute('stop-opacity', (0.28 + 0.56 * th.rpmNorm).toFixed(3));
  refs.sheenStop1.setAttribute('stop-color', lerpColor('#67ace3', '#f4a24c', w));

  // Position chamber swirl arrows cleanly inside instantaneous clearance volume
  const chamberMidY = 203 + (crownY - 203) * 0.54;
  const swirlOffsetY = chamberMidY - 222;
  refs.swirlGroup.setAttribute('transform', `translate(0, ${swirlOffsetY.toFixed(2)})`);
  const swirlAlpha = isolatedStroke
    ? isolatedStroke === 'compression' || isolatedStroke === 'power'
      ? 0.92
      : 0.65
    : 0.52 + 0.30 * th.rpmNorm;
  refs.swirlGroup.setAttribute('opacity', swirlAlpha.toFixed(3));

  // 6. Spark Plug Arc & Flame Kernel near Firing TDC (shifted by sparkAdvance)
  const kernelStrength = Math.max(th.sparkFlash, th.flameKernel);
  const rx = 14 + 26 * kernelStrength * (0.78 + 0.22 * th.rpmNorm);
  const ry = Math.min(Math.max(8, (crownY - 203) * 0.55), 10 + 18 * kernelStrength);
  const kernelCy = Math.min(crownY - ry * 0.55, 206 + 8 * kernelStrength);
  refs.flameHalo.setAttribute('cx', '400');
  refs.flameHalo.setAttribute('cy', kernelCy.toFixed(2));
  refs.flameHalo.setAttribute('rx', rx.toFixed(2));
  refs.flameHalo.setAttribute('ry', ry.toFixed(2));
  refs.flameHalo.setAttribute('opacity', clamp(kernelStrength * 1.05, 0, 0.98).toFixed(3));

  refs.sparkArc.setAttribute('opacity', clamp(th.sparkFlash * 1.15, 0, 1).toFixed(3));

  // 7. Gas-path emphasis & Stroke-isolation dimming/highlighting
  let intakePortOpacity = 0.72 + 0.26 * kin.intakeLiftNorm;
  let exhaustPortOpacity = 0.72 + 0.26 * kin.exhaustLiftNorm;
  let intakeArrowOpacity = 0.25 + 0.75 * kin.intakeLiftNorm;
  let exhaustArrowOpacity = 0.25 + 0.75 * kin.exhaustLiftNorm;
  let chamberOpacity = 0.92;

  if (isolatedStroke === 'intake') {
    intakePortOpacity = 1.0;
    intakeArrowOpacity = 1.0;
    exhaustPortOpacity = 0.18;
    exhaustArrowOpacity = 0.08;
    chamberOpacity = 0.98;
  } else if (isolatedStroke === 'compression') {
    intakePortOpacity = 0.20;
    intakeArrowOpacity = 0.08;
    exhaustPortOpacity = 0.20;
    exhaustArrowOpacity = 0.08;
    chamberOpacity = 1.0;
  } else if (isolatedStroke === 'power') {
    intakePortOpacity = 0.20;
    intakeArrowOpacity = 0.08;
    exhaustPortOpacity = 0.22;
    exhaustArrowOpacity = 0.08;
    chamberOpacity = 1.0;
  } else if (isolatedStroke === 'exhaust') {
    intakePortOpacity = 0.18;
    intakeArrowOpacity = 0.08;
    exhaustPortOpacity = 1.0;
    exhaustArrowOpacity = 1.0;
    chamberOpacity = 0.98;
  } else {
    // Normal "All" mode: emphasize active gas-exchange port naturally
    if (activeStroke === 'intake') intakeArrowOpacity = Math.max(intakeArrowOpacity, 0.65);
    if (activeStroke === 'exhaust') exhaustArrowOpacity = Math.max(exhaustArrowOpacity, 0.65);
  }

  refs.intakeGasGroup.setAttribute('opacity', intakePortOpacity.toFixed(3));
  refs.intakeFlowArrow.setAttribute('opacity', intakeArrowOpacity.toFixed(3));
  refs.exhaustGasGroup.setAttribute('opacity', exhaustPortOpacity.toFixed(3));
  refs.exhaustFlowArrow.setAttribute('opacity', exhaustArrowOpacity.toFixed(3));
  refs.chamberGasPath.setAttribute('opacity', chamberOpacity.toFixed(3));

  const inJetAlpha =
    isolatedStroke && isolatedStroke !== 'intake' ? 0 : kin.intakeLiftNorm * (isolatedStroke === 'intake' ? 0.92 : 0.72);
  const exJetAlpha =
    isolatedStroke && isolatedStroke !== 'exhaust' ? 0 : kin.exhaustLiftNorm * (isolatedStroke === 'exhaust' ? 0.92 : 0.72);
  refs.intakeCurtainJet.setAttribute('opacity', inJetAlpha.toFixed(3));
  refs.exhaustCurtainJet.setAttribute('opacity', exJetAlpha.toFixed(3));
}
