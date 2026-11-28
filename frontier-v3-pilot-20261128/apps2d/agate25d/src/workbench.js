/**
 * Right Polishing Workbench, Articulated Double-Arm Black Task Lamp (analytical 2-link IK),
 * Deep-Green Horizontal Dual-Wheel Lapidary Polisher (2 visible spinning wheels, arbor & pillow blocks),
 * Raw Nodules & Tools, and Front-Right Finger-Jointed Wooden Core Box (`>=4` compartments, `20` cylindrical
 * gray-white rock cores with clearly visible circular end-faces) on Black Drawer Cabinet (`workbench.js`).
 */

import { clamp, lerp, mulberry32 } from './state.js';
import {
  drawPoly3D,
  drawLine3D,
  drawBox3D,
  pointInPoly2D,
} from './projection25d.js';
import {
  computeTaskLampLighting,
  renderTaskLampBenchPoolAndShadow,
  renderTaskLampVolumetricCone,
} from './lighting.js';

export const WORKBENCH_BOUNDS = Object.freeze({
  x0: 2.72,
  x1: 3.82,
  yTop: 1.00,
  z0: -6.85,
  z1: -4.25,
});

// Lamp base mount anchored on rear-right side of polishing workbench
const LAMP_BASE = [3.68, 1.00, -5.98];
// Target aim line vector (from lamp base toward center of dual-wheel polisher)
const LAMP_POLISHER_REF = [3.16, 1.24, -5.22];

/**
 * Computes exact 2-link analytical articulated double-arm kinematics for the black task lamp
 * given `elevationDeg` in `[15°, 75°]`.
 * Returns joint coordinates, shade dome ring vertices, aim vector, and screen-space hit polygon cache slot.
 */
export function computeTaskLampIK(elevationDeg) {
  const elev = clamp(elevationDeg, 15, 75);
  const t = (elev - 15) / 60; // 0 (15° low grazing) .. 1 (75° high steep)

  // Horizontal unit direction from base toward polisher
  const dx = LAMP_POLISHER_REF[0] - LAMP_BASE[0];
  const dz = LAMP_POLISHER_REF[2] - LAMP_BASE[2];
  const distH = Math.hypot(dx, dz) || 1;
  const dirX = dx / distH;
  const dirZ = dz / distH;
  // Lateral perpendicular for twin parallel struts
  const latX = -dirZ;
  const latZ = dirX;

  const basePostTop = [LAMP_BASE[0], LAMP_BASE[1] + 0.24, LAMP_BASE[2]];

  // Lower double-arm rises gracefully behind the polisher and tilts smoothly with elevation
  const lowerAngleRad = ((lerp(68, 96, t)) * Math.PI) / 180;
  const L1 = 0.74;
  const elbow = [
    basePostTop[0] + dirX * Math.cos(lowerAngleRad) * L1,
    basePostTop[1] + Math.sin(lowerAngleRad) * L1,
    basePostTop[2] + dirZ * Math.cos(lowerAngleRad) * L1,
  ];

  // Upper arm pivots smoothly from elbow over the polisher; elevation directly lifts/lowers the dome shade
  const upperPitchRad = ((lerp(-28, 20, t)) * Math.PI) / 180;
  const L2 = 0.62;
  const wrist = [
    elbow[0] + dirX * Math.cos(upperPitchRad) * L2,
    elbow[1] + Math.sin(upperPitchRad) * L2,
    elbow[2] + dirZ * Math.cos(upperPitchRad) * L2,
  ];

  // Shade tilts smoothly so beam aims steeper downward at 75° and more grazing across wheel at 15°
  const aimDownAngle = ((lerp(42, 82, t)) * Math.PI) / 180;
  const aimDir = [
    dirX * Math.cos(aimDownAngle),
    -Math.sin(aimDownAngle),
    dirZ * Math.cos(aimDownAngle),
  ];

  const shadeNeck = [wrist[0], wrist[1] - 0.04, wrist[2]];
  const shadeHeight = 0.24;
  const shadeRimCenter = [
    shadeNeck[0] + aimDir[0] * shadeHeight,
    shadeNeck[1] + aimDir[1] * shadeHeight,
    shadeNeck[2] + aimDir[2] * shadeHeight,
  ];

  // Construct orthonormal basis perpendicular to aimDir for circular shade rim & cap
  let uX = latX;
  let uY = 0;
  let uZ = latZ;
  // v = cross(aimDir, u)
  let vX = aimDir[1] * uZ - aimDir[2] * uY;
  let vY = aimDir[2] * uX - aimDir[0] * uZ;
  let vZ = aimDir[0] * uY - aimDir[1] * uX;
  const vLen = Math.hypot(vX, vY, vZ) || 1;
  vX /= vLen; vY /= vLen; vZ /= vLen;

  const rimRadius = 0.21;
  const neckRadius = 0.075;
  const ringSegs = 20;
  const shadeRimRing3d = [];
  const shadeNeckRing3d = [];
  const shadeMidRing3d = [];
  for (let i = 0; i < ringSegs; i += 1) {
    const a = (i / ringSegs) * Math.PI * 2;
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    const bx = uX * ca + vX * sa;
    const by = uY * ca + vY * sa;
    const bz = uZ * ca + vZ * sa;
    shadeNeckRing3d.push([
      shadeNeck[0] + bx * neckRadius,
      shadeNeck[1] + by * neckRadius,
      shadeNeck[2] + bz * neckRadius,
    ]);
    const midCenter = [
      lerp(shadeNeck[0], shadeRimCenter[0], 0.45),
      lerp(shadeNeck[1], shadeRimCenter[1], 0.45),
      lerp(shadeNeck[2], shadeRimCenter[2], 0.45),
    ];
    shadeMidRing3d.push([
      midCenter[0] + bx * (rimRadius * 0.78),
      midCenter[1] + by * (rimRadius * 0.78),
      midCenter[2] + bz * (rimRadius * 0.78),
    ]);
    shadeRimRing3d.push([
      shadeRimCenter[0] + bx * rimRadius,
      shadeRimCenter[1] + by * rimRadius,
      shadeRimCenter[2] + bz * rimRadius,
    ]);
  }

  return {
    elevationDeg: elev,
    base: LAMP_BASE,
    basePostTop,
    elbow,
    wrist,
    shadeNeck,
    shadeRimCenter,
    aimDir,
    latVec: [latX, 0, latZ],
    shadeNeckRing3d,
    shadeMidRing3d,
    shadeRimRing3d,
    projectedShadePoly: [],
  };
}

/**
 * Helper to project a 3D circular ring lying in a plane perpendicular to the X-axis (for spinning wheels & arbor).
 */
function buildWheelRingX(cx, cy, cz, radius, segs = 28, phaseRad = 0) {
  const pts = [];
  for (let i = 0; i < segs; i += 1) {
    const a = phaseRad + (i / segs) * Math.PI * 2;
    pts.push([cx, cy + Math.sin(a) * radius, cz + Math.cos(a) * radius]);
  }
  return pts;
}

/**
 * Helper to draw a shaded 3D cylinder oriented along the X-axis (used for grinding wheels, arbor, motor drum).
 */
function drawCylinderX(ctx, camera, xLeft, xRight, cy, cz, radius, options = {}) {
  const segs = options.segs || 28;
  const phase = options.phaseRad || 0;
  const ringL = buildWheelRingX(xLeft, cy, cz, radius, segs, phase);
  const ringR = buildWheelRingX(xRight, cy, cz, radius, segs, phase);

  // Back cap if camera is to the left (rare), usually camera is at +X so right cap is front-facing!
  if (camera.x < xLeft && options.leftCapFill) {
    drawPoly3D(ctx, camera, ringL, options.leftCapFill, options.stroke || null, 0.8);
  }

  // Barrel quads depth-sorted back-to-front
  const quads = [];
  for (let i = 0; i < segs; i += 1) {
    const ni = (i + 1) % segs;
    const pts = [ringL[i], ringR[i], ringR[ni], ringL[ni]];
    const proj = camera.projectPoly(pts);
    const midAngle = phase + ((i + 0.5) / segs) * Math.PI * 2;
    quads.push({ pts, depth: proj.avgDepth, midAngle, idx: i });
  }
  quads.sort((a, b) => b.depth - a.depth);

  for (let q = 0; q < quads.length; q += 1) {
    const item = quads[q];
    const fill = typeof options.barrelColorFn === 'function'
      ? options.barrelColorFn(item.midAngle, item.idx)
      : (options.barrelFill || '#3c584c');
    drawPoly3D(ctx, camera, item.pts, fill, options.barrelStroke || null, 0.5);
  }

  // Front-facing circular cap (+X face toward camera)
  if (camera.x > xRight && options.rightCapFill) {
    drawPoly3D(ctx, camera, ringR, options.rightCapFill, options.capStroke || null, options.capStrokeW || 1.2);
  }
  return { ringL, ringR };
}

/**
 * Renders one spinning lapidary grinding wheel with rotating radial diamond/grit texture,
 * steel flange nut, concentric wear tracks, and task-lamp specular rim highlight.
 */
function renderSpinningGrindingWheel(ctx, camera, xCenter, thickness, cy, cz, radius, wheelAngleRad, lampLight, isFrontHero) {
  const xL = xCenter - thickness * 0.5;
  const xR = xCenter + thickness * 0.5;
  const specAngle = lerp(0.55, 1.42, lampLight.elevNorm); // top/front highlight angle driven by lamp elevation

  // Draw rotating cylindrical grit tread along perimeter
  drawCylinderX(ctx, camera, xL, xR, cy, cz, radius, {
    segs: 32,
    phaseRad: wheelAngleRad,
    barrelColorFn: (ang, idx) => {
      const lit = 0.5 + 0.5 * Math.sin(ang - specAngle + 0.5);
      // Alternating subtle abrasive diamond grit micro-facets rotating with wheelAngleRad
      const grit = idx % 2 === 0 ? 9 : -6;
      const spec = Math.pow(Math.max(0, Math.sin(ang - specAngle + 1.1)), 6) * 68 * lampLight.wheelSpecBoost;
      const baseR = clamp(Math.round(78 + lit * 56 + grit + spec), 30, 255);
      const baseG = clamp(Math.round(70 + lit * 48 + grit + spec * 0.92), 28, 248);
      const baseB = clamp(Math.round(62 + lit * 38 + grit + spec * 0.78), 24, 232);
      return `rgb(${baseR}, ${baseG}, ${baseB})`;
    },
    rightCapFill: isFrontHero ? '#534538' : '#4a4641',
    capStroke: '#221c17',
    capStrokeW: 1.4,
  });

  // Render rich concentric face & rotating grit spokes on the +X face of the wheel
  const center2d = camera.project(xR + 0.002, cy, cz);
  const edge2d = camera.project(xR + 0.002, cy + radius, cz);
  if (!center2d.visible || !edge2d.visible) return;
  const screenR = Math.max(8, Math.hypot(edge2d.x - center2d.x, edge2d.y - center2d.y));

  // Concentric diamond abrasive tracks
  const rings = [0.92, 0.76, 0.58, 0.36];
  for (let rIdx = 0; rIdx < rings.length; rIdx += 1) {
    const ringPts = buildWheelRingX(xR + 0.003, cy, cz, radius * rings[rIdx], 28, 0);
    const col = rIdx === 0
      ? (isFrontHero ? '#7a5d42' : '#6b6760')
      : (rIdx === 1 ? '#614d3b' : (rIdx === 2 ? '#8f7458' : '#3a3c40'));
    drawPoly3D(ctx, camera, ringPts, col, 'rgba(22, 18, 14, 0.45)', 0.9);
  }

  // Rotating radial abrasive lines & grit notches (moves strictly with `wheelAngleRad` — freezes on pause!)
  const spokeCount = 12;
  for (let s = 0; s < spokeCount; s += 1) {
    const a = wheelAngleRad + (s / spokeCount) * Math.PI * 2;
    const r0 = radius * 0.36;
    const r1 = radius * 0.93;
    const p0 = [xR + 0.004, cy + Math.sin(a) * r0, cz + Math.cos(a) * r0];
    const p1 = [xR + 0.004, cy + Math.sin(a) * r1, cz + Math.cos(a) * r1];
    const bright = s % 3 === 0 ? 0.55 : 0.24;
    const col = s % 3 === 0
      ? `rgba(255, 224, 174, ${(bright * lampLight.wheelSpecBoost).toFixed(3)})`
      : 'rgba(28, 22, 16, 0.38)';
    drawLine3D(ctx, camera, p0, p1, col, s % 3 === 0 ? 1.8 : 1.1);
  }

  // Rotating bright metallic notch marker on outer bevel so rotation speed is immediately unmistakable
  for (let m = 0; m < 3; m += 1) {
    const a = wheelAngleRad + (m * Math.PI * 2) / 3;
    const pA = [xR + 0.005, cy + Math.sin(a) * radius * 0.78, cz + Math.cos(a) * radius * 0.78];
    const pB = [xR + 0.005, cy + Math.sin(a) * radius * 0.96, cz + Math.cos(a) * radius * 0.96];
    drawLine3D(ctx, camera, pA, pB, 'rgba(255, 236, 194, 0.82)', 2.4);
  }

  // Specular crescent glare on wheel rim responding to task lamp elevation
  const specPt = camera.project(
    xR + 0.006,
    cy + Math.sin(specAngle) * radius * 0.64,
    cz + Math.cos(specAngle) * radius * 0.64
  );
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  const gSpec = ctx.createRadialGradient(specPt.x, specPt.y, 1, specPt.x, specPt.y, screenR * 0.68);
  gSpec.addColorStop(0.0, `rgba(255, 240, 205, ${(0.58 * lampLight.wheelSpecBoost).toFixed(3)})`);
  gSpec.addColorStop(0.45, `rgba(255, 214, 148, ${(0.22 * lampLight.wheelSpecBoost).toFixed(3)})`);
  gSpec.addColorStop(1.0, 'rgba(255, 200, 120, 0.0)');
  ctx.fillStyle = gSpec;
  ctx.beginPath();
  ctx.arc(specPt.x, specPt.y, screenR * 0.68, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Central machined steel arbor clamp flange & rotating hex arbor nut
  const flangePts = buildWheelRingX(xR + 0.008, cy, cz, radius * 0.25, 18, 0);
  drawPoly3D(ctx, camera, flangePts, '#8e9296', '#2a2d30', 1.0);
  const nutPts = buildWheelRingX(xR + 0.014, cy, cz, radius * 0.13, 6, wheelAngleRad);
  drawPoly3D(ctx, camera, nutPts, '#c5c9ce', '#35383c', 1.0);
}

/**
 * Renders the Deep-Green Horizontal Dual-Wheel Lapidary Polisher (`卧式双轮抛光机`)
 * with mounting base, bolted pillow-block bearings (`轴座`), steel arbor shaft,
 * TWO visible spinning grinding wheels, water splash guard hood, and RPM-coupled micro-vibration.
 */
function renderLapidaryPolisher(ctx, camera, state, lampLight) {
  // Subtle micro-vibration scaled from housingVibrationMm (strictly 0 at 0 rpm or when paused)
  const vibWorldY = state.housingVibrationMm * 0.0024;
  const vibWorldX = state.housingVibrationMm * 0.0014;
  const vibWorldZ = state.housingVibrationMm * 0.0012;

  const baseY = 1.00;
  const arborY = 1.27 + vibWorldY;
  const arborZ = -5.20 + vibWorldZ;
  const wheelAngle = state.wheelAngleRad;

  // 1) Heavy cast-iron mounting base plate bolted to benchtop (stationary base + vibrating upper feet)
  drawBox3D(
    ctx,
    camera,
    { x0: 2.78, x1: 3.52, y0: baseY, y1: baseY + 0.052, z0: -5.54, z1: -4.92 },
    {
      top: '#243c33',
      posX: '#1c2f28',
      posZ: '#162520',
      negX: '#172721',
      stroke: 'rgba(180, 215, 195, 0.14)',
    }
  );
  // Four corner anchor bolts
  const bolts = [
    [2.83, -4.97], [3.47, -4.97], [2.83, -5.49], [3.47, -5.49],
  ];
  for (const [bx, bz] of bolts) {
    const p = camera.project(bx, baseY + 0.056, bz);
    if (!p.visible) continue;
    ctx.fillStyle = '#aeb4b8';
    ctx.beginPath();
    ctx.arc(p.x, p.y, Math.max(1.8, 3.0 * camera.scale), 0, Math.PI * 2);
    ctx.fill();
  }

  // 2) Far / Left Spinning Grinding Wheel #1 (`X = 2.82`, radius `0.175m`, clearly visible left of motor)
  renderSpinningGrindingWheel(
    ctx,
    camera,
    2.82 + vibWorldX,
    0.072,
    arborY,
    arborZ,
    0.175,
    wheelAngle,
    lampLight,
    false
  );

  // Left protruding steel arbor stub connecting Wheel #1 to Left Pillow Block #1 (behind motor body!)
  drawCylinderX(ctx, camera, 2.85 + vibWorldX, 2.98 + vibWorldX, arborY, arborZ, 0.030, {
    segs: 14,
    barrelColorFn: ang => {
      const lit = 0.4 + 0.6 * Math.max(0, Math.sin(ang + 0.5));
      const v = clamp(Math.round(92 + lit * 120), 60, 240);
      return `rgb(${v}, ${v + 3}, ${v + 6})`;
    },
  });

  // 3) Left Cast-Iron Pillow Block Bearing Pedestal (`轴座 #1` at X = 2.94)
  drawBox3D(
    ctx,
    camera,
    {
      x0: 2.90 + vibWorldX,
      x1: 2.98 + vibWorldX,
      y0: baseY + 0.05,
      y1: arborY + 0.06,
      z0: arborZ - 0.085,
      z1: arborZ + 0.085,
    },
    {
      top: '#395a4d',
      posX: '#29443a',
      posZ: '#20362e',
      negX: '#243c33',
      stroke: 'rgba(195, 224, 206, 0.16)',
    }
  );

  // 4) Central Deep-Green Cast-Iron Lapidary Motor Housing (`X in [2.98..3.32]`)
  //    Motor saddle cradle
  drawBox3D(
    ctx,
    camera,
    {
      x0: 3.00 + vibWorldX,
      x1: 3.30 + vibWorldX,
      y0: baseY + 0.05,
      y1: arborY - 0.02,
      z0: arborZ - 0.16,
      z1: arborZ + 0.14,
    },
    {
      top: '#2e4e41',
      posX: '#223a31',
      posZ: '#1b2f27',
      negX: '#20372e',
      stroke: 'rgba(190, 220, 204, 0.12)',
    }
  );

  // Cylindrical deep-green enameled cast-iron motor drum with elevation-coupled top/side specular!
  const specCrownAngle = lerp(0.58, 1.48, lampLight.housingSpecYNorm);
  drawCylinderX(
    ctx,
    camera,
    2.98 + vibWorldX,
    3.31 + vibWorldX,
    arborY + 0.01,
    arborZ,
    0.172,
    {
      segs: 24,
      barrelColorFn: ang => {
        const diff = 0.45 + 0.55 * Math.max(0, Math.sin(ang + 0.4));
        const spec = Math.pow(Math.max(0, Math.cos(ang - specCrownAngle)), 8) * 62 * lampLight.poolIntensity;
        const r = clamp(Math.round(28 + diff * 34 + spec * 0.92), 18, 225);
        const g = clamp(Math.round(52 + diff * 54 + spec * 1.00), 34, 240);
        const b = clamp(Math.round(44 + diff * 44 + spec * 0.80), 28, 215);
        return `rgb(${r}, ${g}, ${b})`;
      },
      rightCapFill: '#29473c',
      capStroke: '#15251f',
    }
  );

  // Cast-iron cooling fin bands around the motor housing
  for (let f = 0; f < 3; f += 1) {
    const fx = 3.05 + f * 0.095 + vibWorldX;
    const finRing = buildWheelRingX(fx, arborY + 0.01, arborZ, 0.176, 18, 0);
    for (let k = 0; k < 9; k += 1) {
      drawLine3D(ctx, camera, finRing[k], finRing[k + 1], 'rgba(16, 32, 26, 0.52)', 1.2);
    }
  }

  // Brushed brass motor serial nameplate on front face of green motor housing
  drawPoly3D(
    ctx,
    camera,
    [
      [3.05 + vibWorldX, arborY + 0.04, arborZ + 0.175],
      [3.22 + vibWorldX, arborY + 0.04, arborZ + 0.175],
      [3.22 + vibWorldX, arborY - 0.035, arborZ + 0.175],
      [3.05 + vibWorldX, arborY - 0.035, arborZ + 0.175],
    ],
    '#a68d5c',
    '#4d3f26',
    0.9
  );

  // 5) Right Cast-Iron Pillow Block Bearing Pedestal (`轴座 #2` at X = 3.36)
  drawBox3D(
    ctx,
    camera,
    {
      x0: 3.32 + vibWorldX,
      x1: 3.40 + vibWorldX,
      y0: baseY + 0.05,
      y1: arborY + 0.065,
      z0: arborZ - 0.085,
      z1: arborZ + 0.085,
    },
    {
      top: '#3f6254',
      posX: '#2e4a3f',
      posZ: '#223930',
      stroke: 'rgba(204, 232, 216, 0.18)',
    }
  );

  // Right protruding gleaming steel arbor shaft stub connecting motor -> Pillow Block #2 -> Wheel #2
  drawCylinderX(ctx, camera, 3.31 + vibWorldX, 3.55 + vibWorldX, arborY, arborZ, 0.031, {
    segs: 14,
    barrelColorFn: ang => {
      const lit = 0.4 + 0.6 * Math.max(0, Math.sin(ang + 0.5));
      const v = clamp(Math.round(96 + lit * 124), 60, 244);
      return `rgb(${v}, ${v + 3}, ${v + 6})`;
    },
    rightCapFill: '#cfd5da',
  });

  // 6) Curved metallic water-splash wheel guard hood behind/over the hero front grinding wheel
  const hoodX0 = 3.41 + vibWorldX;
  const hoodX1 = 3.52 + vibWorldX;
  const hoodR = 0.232;
  for (let i = 0; i < 10; i += 1) {
    const a0 = Math.PI * 0.48 + (i / 10) * Math.PI * 0.92;
    const a1 = Math.PI * 0.48 + ((i + 1) / 10) * Math.PI * 0.92;
    const p00 = [hoodX0, arborY + Math.sin(a0) * hoodR, arborZ + Math.cos(a0) * hoodR];
    const p01 = [hoodX1, arborY + Math.sin(a0) * hoodR, arborZ + Math.cos(a0) * hoodR];
    const p11 = [hoodX1, arborY + Math.sin(a1) * hoodR, arborZ + Math.cos(a1) * hoodR];
    const p10 = [hoodX0, arborY + Math.sin(a1) * hoodR, arborZ + Math.cos(a1) * hoodR];
    const shade = 120 + Math.round(Math.sin(a0) * 55);
    drawPoly3D(ctx, camera, [p00, p01, p11, p10], `rgb(${shade}, ${shade - 8}, ${shade - 18})`, 'rgba(28, 24, 20, 0.45)', 0.7);
  }

  // 7) Near / Right Hero Spinning Grinding Wheel #2 (`X = 3.47`, radius `0.205m`, same direction `wheelAngle`)
  renderSpinningGrindingWheel(
    ctx,
    camera,
    3.47 + vibWorldX,
    0.082,
    arborY,
    arborZ,
    0.205,
    wheelAngle,
    lampLight,
    true
  );
}

/**
 * Renders the articulated double-arm black architect task lamp (`黑色双臂台灯`)
 * and caches `lampIK.projectedShadePoly` for exact direct-canvas pointer drag hit-testing!
 */
function renderArticulatedTaskLamp(ctx, camera, lampIK, lampLight, isHovered, isDragging) {
  const { base, basePostTop, elbow, wrist, shadeNeck, shadeRimCenter, latVec } = lampIK;
  const off = 0.022;

  // 1) Heavy matte-black clamp base on rear-right benchtop
  drawBox3D(
    ctx,
    camera,
    { x0: base[0] - 0.08, x1: base[0] + 0.08, y0: base[1], y1: base[1] + 0.06, z0: base[2] - 0.08, z1: base[2] + 0.08 },
    { top: '#2b2d31', posX: '#1c1d20', posZ: '#141518', stroke: 'rgba(255,255,255,0.08)' }
  );
  drawLine3D(ctx, camera, base, basePostTop, '#24262a', Math.max(4, 7 * camera.scale));

  // 2) Lower twin parallel struts (articulated parallelogram arm + tension spring!)
  const pBaseL = [basePostTop[0] - latVec[0] * off, basePostTop[1], basePostTop[2] - latVec[2] * off];
  const pBaseR = [basePostTop[0] + latVec[0] * off, basePostTop[1], basePostTop[2] + latVec[2] * off];
  const pElbL = [elbow[0] - latVec[0] * off, elbow[1], elbow[2] - latVec[2] * off];
  const pElbR = [elbow[0] + latVec[0] * off, elbow[1], elbow[2] + latVec[2] * off];

  const armW = Math.max(2.2, 4.0 * camera.scale);
  drawLine3D(ctx, camera, pBaseL, pElbL, '#202226', armW);
  drawLine3D(ctx, camera, pBaseR, pElbR, '#35383e', armW);
  // Subtle chrome tension spring parallel to lower arm
  const springA = [lerp(basePostTop[0], elbow[0], 0.18), lerp(basePostTop[1], elbow[1], 0.18) - 0.025, lerp(basePostTop[2], elbow[2], 0.18)];
  const springB = [lerp(basePostTop[0], elbow[0], 0.65), lerp(basePostTop[1], elbow[1], 0.65) - 0.025, lerp(basePostTop[2], elbow[2], 0.65)];
  drawLine3D(ctx, camera, springA, springB, '#8a8f96', Math.max(1.2, 2.0 * camera.scale));

  // 3) Upper articulated arm twin struts
  const pWrL = [wrist[0] - latVec[0] * (off * 0.75), wrist[1], wrist[2] - latVec[2] * (off * 0.75)];
  const pWrR = [wrist[0] + latVec[0] * (off * 0.75), wrist[1], wrist[2] + latVec[2] * (off * 0.75)];
  drawLine3D(ctx, camera, pElbL, pWrL, '#1f2125', armW * 0.92);
  drawLine3D(ctx, camera, pElbR, pWrR, '#393c42', armW * 0.92);

  // Mechanical joint knobs at elbow & wrist
  for (const jPt of [basePostTop, elbow, wrist]) {
    const pj = camera.project(jPt[0], jPt[1], jPt[2]);
    if (!pj.visible) continue;
    ctx.fillStyle = '#181a1d';
    ctx.strokeStyle = '#9aa0a6';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(pj.x, pj.y, Math.max(3.5, 6.2 * camera.scale), 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  // 4) Matte-black spun-aluminum conical dome shade (drawn back-to-front via faceted rings)
  const rimRing = lampIK.shadeRimRing3d;
  const midRing = lampIK.shadeMidRing3d;
  const neckRing = lampIK.shadeNeckRing3d;

  // Bright illuminated white/amber inner reflector cavity visible at bottom of dome
  drawPoly3D(ctx, camera, rimRing, '#f4d9a4', '#26282c', 1.4);
  // Warm tungsten-LED bulb core inside shade
  const bulbPos = [
    lerp(shadeNeck[0], shadeRimCenter[0], 0.68),
    lerp(shadeNeck[1], shadeRimCenter[1], 0.68),
    lerp(shadeNeck[2], shadeRimCenter[2], 0.68),
  ];
  const pBulb = camera.project(bulbPos[0], bulbPos[1], bulbPos[2]);
  if (pBulb.visible) {
    ctx.fillStyle = '#fff9e6';
    ctx.beginPath();
    ctx.arc(pBulb.x, pBulb.y, Math.max(4, 9 * camera.scale), 0, Math.PI * 2);
    ctx.fill();
  }

  // Faceted black exterior bell of shade (2 rings: neck->mid, mid->rim)
  const shadeFacets = [];
  const nSegs = rimRing.length;
  for (let i = 0; i < nSegs; i += 1) {
    const ni = (i + 1) % nSegs;
    const upperPts = [neckRing[i], neckRing[ni], midRing[ni], midRing[i]];
    const lowerPts = [midRing[i], midRing[ni], rimRing[ni], rimRing[i]];
    const pUp = camera.projectPoly(upperPts);
    const pLo = camera.projectPoly(lowerPts);
    const ang = (i / nSegs) * Math.PI * 2;
    shadeFacets.push({ pts: upperPts, depth: pUp.avgDepth, ang, band: 0 });
    shadeFacets.push({ pts: lowerPts, depth: pLo.avgDepth, ang, band: 1 });
  }
  shadeFacets.sort((a, b) => b.depth - a.depth);

  for (let f = 0; f < shadeFacets.length; f += 1) {
    const item = shadeFacets[f];
    const lit = 0.35 + 0.65 * Math.max(0, Math.cos(item.ang - 0.9));
    const gloss = Math.pow(Math.max(0, Math.cos(item.ang - 0.55)), 10) * 56;
    const v = clamp(Math.round((item.band === 0 ? 22 : 16) + lit * 26 + gloss), 12, 130);
    drawPoly3D(ctx, camera, item.pts, `rgb(${v}, ${v + 2}, ${v + 5})`, 'rgba(10, 11, 13, 0.35)', 0.5);
  }

  // Top ventilated socket cap on dome crown
  drawPoly3D(ctx, camera, neckRing, '#2b2e33', '#111214', 1.0);

  // Subtle amber drag affordance ring when hovered or actively dragged
  const allShade2d = [
    ...rimRing.map(p => camera.project(p[0], p[1], p[2])),
    ...neckRing.map(p => camera.project(p[0], p[1], p[2])),
  ].filter(p => p.visible);

  // Compute exact 2D convex hull of projected shade for accurate canvas hit-testing!
  lampIK.projectedShadePoly = computeConvexHull2D(allShade2d);

  if ((isHovered || isDragging) && lampIK.projectedShadePoly.length >= 3) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(lampIK.projectedShadePoly[0].x, lampIK.projectedShadePoly[0].y);
    for (let i = 1; i < lampIK.projectedShadePoly.length; i += 1) {
      ctx.lineTo(lampIK.projectedShadePoly[i].x, lampIK.projectedShadePoly[i].y);
    }
    ctx.closePath();
    ctx.strokeStyle = isDragging ? '#ffcf72' : 'rgba(255, 214, 132, 0.75)';
    ctx.lineWidth = isDragging ? 2.4 : 1.6;
    ctx.setLineDash(isDragging ? [] : [5, 4]);
    ctx.stroke();
    ctx.restore();
  }
}

/**
 * Monotone chain 2D convex hull for clean projected lamp-shade hit polygon.
 */
function computeConvexHull2D(points) {
  if (points.length <= 3) return points;
  const pts = points.slice().sort((a, b) => (a.x === b.x ? a.y - b.y : a.x - b.x));
  const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lower = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper = [];
  for (let i = pts.length - 1; i >= 0; i -= 1) {
    const p = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  upper.pop();
  lower.pop();
  return lower.concat(upper);
}

/**
 * Renders the secondary tools, trim saw block, and rough agate raw nodules on the workbench & side pedestal.
 */
function renderBenchToolsAndNodules(ctx, camera) {
  // 1) Secondary matte-black raw specimen pedestal immediately left-front of workbench
  //    (matching the cut brown agate rock blocks visible in reference-0.png left of the polisher!)
  drawBox3D(
    ctx,
    camera,
    { x0: 1.88, x1: 2.70, y0: 0.0, y1: 0.96, z0: -4.85, z1: -3.72 },
    {
      top: '#1f2023',
      posX: '#131417',
      posZ: '#0e0f11',
      negX: '#16171a',
      stroke: 'rgba(255, 255, 255, 0.055)',
    }
  );
  // Subtle drawer recess on pedestal front
  drawPoly3D(
    ctx,
    camera,
    [[2.704, 0.84, -3.84], [2.704, 0.84, -4.72], [2.704, 0.28, -4.72], [2.704, 0.28, -3.84]],
    '#101113',
    'rgba(255,255,255,0.07)',
    0.9
  );
  drawLine3D(ctx, camera, [2.706, 0.68, -4.10], [2.706, 0.68, -4.46], '#52555a', 2.4);

  // Rough raw agate stone nodules & fractured volcanic ore chunks arranged on the side pedestal
  const rawChunks = [
    { cx: 2.20, cz: -4.46, rx: 0.21, rz: 0.17, h: 0.13, col: '#7d6142', hi: '#a4835b', seed: 7401 },
    { cx: 2.28, cz: -4.06, rx: 0.22, rz: 0.16, h: 0.11, col: '#6d5339', hi: '#94744f', seed: 7402 },
    { cx: 2.52, cz: -4.34, rx: 0.16, rz: 0.18, h: 0.14, col: '#886947', hi: '#b59064', seed: 7403 },
  ];
  for (const ch of rawChunks) {
    const rgen = mulberry32(ch.seed);
    const bot = [];
    const top = [];
    for (let i = 0; i < 12; i += 1) {
      const a = (i / 12) * Math.PI * 2;
      const m = 0.82 + 0.28 * Math.sin(a * 3 + ch.seed) + (rgen() - 0.5) * 0.15;
      bot.push([ch.cx + Math.cos(a) * ch.rx * m, 0.96, ch.cz + Math.sin(a) * ch.rz * m]);
      top.push([ch.cx + Math.cos(a) * ch.rx * m * 0.78, 0.96 + ch.h * (0.82 + rgen() * 0.28), ch.cz + Math.sin(a) * ch.rz * m * 0.78]);
    }
    for (let i = 0; i < 12; i += 1) {
      const ni = (i + 1) % 12;
      drawPoly3D(ctx, camera, [bot[i], bot[ni], top[ni], top[i]], i % 2 === 0 ? ch.col : '#4d3a27', 'rgba(20, 14, 9, 0.35)', 0.6);
    }
    drawPoly3D(ctx, camera, top, ch.hi, 'rgba(24, 17, 10, 0.32)', 0.7);
  }
  // Small crisp white museum specimen label card in front of raw nodules
  drawPoly3D(
    ctx,
    camera,
    [[2.42, 0.99, -3.96], [2.64, 0.99, -3.96], [2.64, 0.965, -3.82], [2.42, 0.965, -3.82]],
    '#d9d3c7',
    '#666056',
    0.7
  );

  // 2) Secondary lapidary slab-trim unit & aluminum vise on rear part of workbench (Z in [-6.55..-5.85])
  drawBox3D(
    ctx,
    camera,
    { x0: 3.16, x1: 3.62, y0: 1.00, y1: 1.22, z0: -6.48, z1: -5.94 },
    {
      top: '#78726a',
      posX: '#5e5952',
      posZ: '#484540',
      negX: '#4e4a44',
      stroke: 'rgba(255, 255, 255, 0.09)',
    }
  );
  // Small metallic feed rail & handwheel on trim unit
  drawBox3D(
    ctx,
    camera,
    { x0: 3.30, x1: 3.68, y0: 1.00, y1: 1.11, z0: -5.94, z1: -5.74 },
    { top: '#8d8880', posX: '#66625c', posZ: '#524f4a' }
  );

  // 3) Benchtop lapidary hand tools (brass vernier caliper, diamond scribe & raw cut agate halves)
  // Brass caliper lying at front-right corner of workbench
  drawLine3D(ctx, camera, [3.26, 1.012, -4.46], [3.62, 1.012, -4.74], '#c7a462', 2.4);
  drawLine3D(ctx, camera, [3.26, 1.012, -4.46], [3.34, 1.012, -4.38], '#c7a462', 2.0);
  drawLine3D(ctx, camera, [3.42, 1.012, -4.58], [3.50, 1.012, -4.50], '#c7a462', 2.0);
  // Polishing wooden block & wet sponge
  drawBox3D(
    ctx,
    camera,
    { x0: 2.86, x1: 3.06, y0: 1.00, y1: 1.048, z0: -4.64, z1: -4.42 },
    { top: '#8d7354', posX: '#6a543c', posZ: '#574430' }
  );
  // Raw half-cut amber agate nodule awaiting polishing
  const nodP = camera.project(3.16, 1.045, -4.52);
  if (nodP.visible) {
    const r = 10 * camera.scale;
    ctx.fillStyle = '#4e3927';
    ctx.beginPath();
    ctx.ellipse(nodP.x, nodP.y, r * 1.35, r * 0.85, -0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#df9444';
    ctx.beginPath();
    ctx.ellipse(nodP.x - r * 0.12, nodP.y - r * 0.1, r * 0.85, r * 0.50, -0.2, 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * Renders one 3D cylindrical gray-white drill rock core lying inside the wooden core box,
 * oriented along the Z-axis so its circular/elliptical end-face (`圆柱端面`) clearly faces the viewer!
 */
function renderRockCoreCylinderZ(ctx, camera, cx, cy, zBack, zFront, radius, seed) {
  const rand = mulberry32(seed);
  const segs = 16;
  const ringBack = [];
  const ringFront = [];
  for (let i = 0; i < segs; i += 1) {
    const a = (i / segs) * Math.PI * 2;
    ringBack.push([cx + Math.cos(a) * radius, cy + Math.sin(a) * radius, zBack]);
    ringFront.push([cx + Math.cos(a) * radius, cy + Math.sin(a) * radius, zFront]);
  }

  // Lithological mineral tint variation across gray-white, pale sandstone, and slate cores
  const warmTint = (rand() - 0.45) * 18;
  const baseLuma = 128 + Math.round((rand() - 0.5) * 34);

  // Subtle dark contact shadow on wooden trough floor beneath cylinder
  drawPoly3D(
    ctx,
    camera,
    [
      [cx - radius * 1.05, cy - radius + 0.004, zFront],
      [cx + radius * 1.15, cy - radius + 0.004, zFront],
      [cx + radius * 1.15, cy - radius + 0.004, zBack],
      [cx - radius * 1.05, cy - radius + 0.004, zBack],
    ],
    'rgba(14, 10, 7, 0.55)'
  );

  // Visible upper & side barrel quads depth-sorted
  const quads = [];
  for (let i = 0; i < segs; i += 1) {
    const ni = (i + 1) % segs;
    const midA = ((i + 0.5) / segs) * Math.PI * 2;
    // Skip bottom occluded strips
    if (Math.sin(midA) < -0.55) continue;
    const pts = [ringBack[i], ringBack[ni], ringFront[ni], ringFront[i]];
    const proj = camera.projectPoly(pts);
    quads.push({ pts, depth: proj.avgDepth, midA });
  }
  quads.sort((a, b) => b.depth - a.depth);

  for (let q = 0; q < quads.length; q += 1) {
    const item = quads[q];
    // Top-right warm illumination from museum overhead + task lamp spill
    const lit = 0.48 + 0.52 * Math.max(0, Math.sin(item.midA) * 0.85 + Math.cos(item.midA) * 0.35);
    const v = clamp(Math.round(baseLuma * (0.45 + 0.72 * lit)), 38, 224);
    const r = clamp(Math.round(v + warmTint * 0.6), 35, 230);
    const g = clamp(Math.round(v + warmTint * 0.25), 35, 226);
    const b = clamp(Math.round(v - warmTint * 0.35), 36, 222);
    drawPoly3D(ctx, camera, item.pts, `rgb(${r}, ${g}, ${b})`);
  }

  // Geological sedimentary / mineral fracture bands wrapped around the rock core barrel
  const bandCount = 3 + Math.floor(rand() * 3);
  for (let b = 0; b < bandCount; b += 1) {
    const bz = lerp(zBack + 0.08, zFront - 0.08, (b + 0.5) / bandCount) + (rand() - 0.5) * 0.05;
    const bandPts = [];
    for (let k = 0; k <= 8; k += 1) {
      const a = -0.15 + (k / 8) * (Math.PI + 0.3);
      bandPts.push([cx + Math.cos(a) * (radius + 0.001), cy + Math.sin(a) * (radius + 0.001), bz]);
    }
    const isDarkSeam = rand() > 0.45;
    for (let k = 0; k < bandPts.length - 1; k += 1) {
      drawLine3D(
        ctx,
        camera,
        bandPts[k],
        bandPts[k + 1],
        isDarkSeam ? 'rgba(38, 35, 32, 0.52)' : 'rgba(235, 228, 214, 0.44)',
        1.1
      );
    }
  }

  // Clearly visible front circular/elliptical cylinder end-face (`可见圆柱端面`)!
  const endR = clamp(Math.round(baseLuma * 0.92 + warmTint * 0.5), 55, 215);
  const endG = clamp(Math.round(baseLuma * 0.90 + warmTint * 0.2), 55, 212);
  const endB = clamp(Math.round(baseLuma * 0.88 - warmTint * 0.2), 55, 210);
  drawPoly3D(
    ctx,
    camera,
    ringFront,
    `rgb(${endR}, ${endG}, ${endB})`,
    'rgba(48, 44, 40, 0.72)',
    1.1
  );
  // Inner saw-cut rock grain ring on the cylinder end-face
  const innerEnd = [];
  for (let i = 0; i < 12; i += 1) {
    const a = (i / 12) * Math.PI * 2;
    innerEnd.push([cx + Math.cos(a) * radius * 0.56, cy + Math.sin(a) * radius * 0.56, zFront + 0.001]);
  }
  drawPoly3D(ctx, camera, innerEnd, `rgba(${endR - 18}, ${endG - 16}, ${endB - 14}, 0.52)`);
}

/**
 * Renders the Front-Right Matte-Black Multi-Drawer Cabinet (`抽屉柜`) and the Crafted Finger-Jointed
 * Wooden Compartmentalized Core Box (`1.8m × 1.0m × 0.28m`, 4 compartments, 20 gray-white rock cores).
 */
export function renderFrontCoreBoxAndCabinet(ctx, camera) {
  // 1) Matte-black multi-drawer museum specimen cabinet (`X in [3.44..4.56], Z in [-3.88..-1.96], Y in [0.0..0.88]`)
  drawBox3D(
    ctx,
    camera,
    { x0: 3.44, x1: 4.56, y0: 0.0, y1: 0.88, z0: -3.88, z1: -1.96 },
    {
      top: '#1c1d20',
      posX: '#0c0d0f',
      posZ: '#101114',
      negX: '#151619',
      stroke: 'rgba(255, 255, 255, 0.075)',
    }
  );

  // Subtle recessed metal drawer panels & brushed bar handles on the visible -X left side & +Z front side
  const drawerBands = [
    { y0: 0.62, y1: 0.84 },
    { y0: 0.34, y1: 0.58 },
    { y0: 0.06, y1: 0.30 },
  ];
  for (const d of drawerBands) {
    // Front (+Z) recessed drawer face
    drawPoly3D(
      ctx,
      camera,
      [[3.50, d.y1, -1.956], [4.50, d.y1, -1.956], [4.50, d.y0, -1.956], [3.50, d.y0, -1.956]],
      '#141518',
      'rgba(255, 255, 255, 0.085)',
      0.9
    );
    // Horizontal drawer handle pull
    drawLine3D(ctx, camera, [3.84, (d.y0 + d.y1) * 0.5 + 0.04, -1.952], [4.16, (d.y0 + d.y1) * 0.5 + 0.04, -1.952], '#5e6268', 2.4);

    // Left (-X) drawer side reveal & subtle specimen drawer handle
    drawPoly3D(
      ctx,
      camera,
      [[3.436, d.y1, -3.80], [3.436, d.y1, -2.04], [3.436, d.y0, -2.04], [3.436, d.y0, -3.80]],
      '#131417',
      'rgba(255, 255, 255, 0.07)',
      0.8
    );
  }
  // Crisp highlight on cabinet top lip
  drawLine3D(ctx, camera, [3.44, 0.882, -1.96], [4.56, 0.882, -1.96], 'rgba(220, 214, 200, 0.22)', 1.2);
  drawLine3D(ctx, camera, [3.44, 0.882, -1.96], [3.44, 0.882, -3.88], 'rgba(220, 214, 200, 0.18)', 1.2);

  // 2) Wooden Compartmentalized Core Box (`1.0m × 1.8m × 0.28m`: X in [3.50..4.50], Z in [-3.82..-2.02], Y in [0.88..1.16])
  const bx0 = 3.50;
  const bx1 = 4.50;
  const bz0 = -3.82; // back wall
  const bz1 = -2.02; // front wall
  const by0 = 0.88;
  const by1 = 1.16;
  const wallT = 0.045;

  // Interior floor of wooden box
  drawPoly3D(
    ctx,
    camera,
    [[bx0 + wallT, by0 + 0.025, bz1 - wallT], [bx1 - wallT, by0 + 0.025, bz1 - wallT], [bx1 - wallT, by0 + 0.025, bz0 + wallT], [bx0 + wallT, by0 + 0.025, bz0 + wallT]],
    '#3e2c1c'
  );

  // Back wooden wall (`Z in [bz0..bz0+wallT]`)
  drawBox3D(
    ctx,
    camera,
    { x0: bx0, x1: bx1, y0: by0, y1: by1, z0: bz0, z1: bz0 + wallT },
    { top: '#9c784f', posZ: '#5e432a', negX: '#553c25', posX: '#4b341f', stroke: 'rgba(28, 18, 10, 0.55)' }
  );

  // Far-right outer wooden wall (`X in [bx1-wallT..bx1]`)
  drawBox3D(
    ctx,
    camera,
    { x0: bx1 - wallT, x1: bx1, y0: by0, y1: by1, z0: bz0 + wallT, z1: bz1 - wallT },
    { top: '#98744c', negX: '#664a2f', posX: '#48321e', stroke: 'rgba(28, 18, 10, 0.55)' }
  );

  // Center longitudinal wooden divider (`X in [3.98..4.02]`) — splits box into Left & Right columns
  drawBox3D(
    ctx,
    camera,
    { x0: 3.98, x1: 4.02, y0: by0 + 0.02, y1: by1 - 0.03, z0: bz0 + wallT, z1: bz1 - wallT },
    { top: '#8f6c46', negX: '#5d422a', posX: '#4f3822', stroke: 'rgba(24, 16, 8, 0.45)' }
  );

  // 3) 4 Compartments × 5 Cylindrical Gray-White Rock Cores = 20 Cores (generous cylindrical diameter resting high in tray!)
  const coreRadius = 0.044;
  const coreY = by0 + 0.068 + coreRadius;
  const colSlots = [
    // Left column (5 cores across X in [3.55..3.96])
    [3.59, 3.68, 3.77, 3.86, 3.94],
    // Right column (5 cores across X in [4.04..4.45])
    [4.07, 4.16, 4.25, 4.34, 4.42],
  ];

  // Back 2 compartments (10 cores)
  for (let colIdx = 0; colIdx < 2; colIdx += 1) {
    const xs = colSlots[colIdx];
    for (let i = 0; i < xs.length; i += 1) {
      const lenTrim = ((i * 37 + colIdx * 13) % 7) * 0.014;
      renderRockCoreCylinderZ(
        ctx,
        camera,
        xs[i],
        coreY,
        bz0 + wallT + 0.02,
        -2.96 - lenTrim,
        coreRadius,
        8200 + colIdx * 31 + i * 7
      );
    }
  }

  // Central wooden cross-divider (`Z in [-2.95..-2.89]`) creating 4 crisp compartments!
  drawBox3D(
    ctx,
    camera,
    { x0: bx0 + wallT, x1: bx1 - wallT, y0: by0 + 0.02, y1: by1 - 0.015, z0: -2.95, z1: -2.895 },
    { top: '#a47f56', posZ: '#65492e', stroke: 'rgba(24, 16, 8, 0.55)' }
  );

  // Front 2 compartments (10 cores — total 20 cores >= 16!)
  for (let colIdx = 0; colIdx < 2; colIdx += 1) {
    const xs = colSlots[colIdx];
    for (let i = 0; i < xs.length; i += 1) {
      const lenTrim = ((i * 29 + colIdx * 19 + 5) % 6) * 0.015;
      renderRockCoreCylinderZ(
        ctx,
        camera,
        xs[i],
        coreY,
        -2.885,
        bz1 - wallT - 0.015 - lenTrim,
        coreRadius,
        8400 + colIdx * 41 + i * 11
      );
    }
  }

  // Left outer wooden wall (`X in [bx0..bx0+wallT]`)
  drawBox3D(
    ctx,
    camera,
    { x0: bx0, x1: bx0 + wallT, y0: by0, y1: by1, z0: bz0 + wallT, z1: bz1 - wallT },
    { top: '#a27e55', negX: '#5f442a', posX: '#4c3520', stroke: 'rgba(28, 18, 10, 0.58)' }
  );

  // Front outer wooden wall (`Z in [bz1-wallT..bz1]`)
  drawBox3D(
    ctx,
    camera,
    { x0: bx0, x1: bx1, y0: by0, y1: by1, z0: bz1 - wallT, z1: bz1 },
    { top: '#a68158', posZ: '#573d25', negX: '#4c3520', posX: '#422d1a', stroke: 'rgba(24, 15, 8, 0.62)' }
  );

  // 4) Explicit Finger-Jointed Box Corners (`木盒榫接`) on front-left & front-right corners!
  const fingers = 6;
  const fingerH = (by1 - by0) / fingers;
  for (let f = 0; f < fingers; f += 1) {
    const fy0 = by0 + f * fingerH;
    const fy1 = fy0 + fingerH;
    const isEndGrainFront = f % 2 === 0;

    // Front-left corner `(bx0, bz1)`
    if (isEndGrainFront) {
      drawPoly3D(
        ctx,
        camera,
        [[bx0, fy1, bz1 + 0.002], [bx0 + wallT, fy1, bz1 + 0.002], [bx0 + wallT, fy0, bz1 + 0.002], [bx0, fy0, bz1 + 0.002]],
        '#3b2716',
        'rgba(18, 11, 6, 0.65)',
        0.7
      );
    } else {
      drawPoly3D(
        ctx,
        camera,
        [[bx0 - 0.002, fy1, bz1 - wallT], [bx0 - 0.002, fy1, bz1], [bx0 - 0.002, fy0, bz1], [bx0 - 0.002, fy0, bz1 - wallT]],
        '#412b19',
        'rgba(18, 11, 6, 0.65)',
        0.7
      );
    }

    // Front-right corner `(bx1, bz1)`
    if (isEndGrainFront) {
      drawPoly3D(
        ctx,
        camera,
        [[bx1 - wallT, fy1, bz1 + 0.002], [bx1, fy1, bz1 + 0.002], [bx1, fy0, bz1 + 0.002], [bx1 - wallT, fy0, bz1 + 0.002]],
        '#382515',
        'rgba(18, 11, 6, 0.65)',
        0.7
      );
    }
  }
}

/**
 * Renders the complete Right Polishing Zone: workbench, raw specimen pedestal,
 * dynamic task-lamp bench pool & cast shadow, dual-wheel green lapidary polisher,
 * articulated double-arm black task lamp, volumetric light cone, and front-right wooden core box.
 */
export function renderRightWorkshopZone(ctx, camera, state) {
  // Compute articulated task lamp kinematics & physically coupled local lighting
  const lampIK = computeTaskLampIK(state.lampElevationDeg);
  const lampLight = computeTaskLampLighting(lampIK, state.lampElevationDeg);

  // 1) Polishing Workbench (`2.6m × 1.1m × 1.0m`: X in [2.72..3.82], Z in [-6.85..-4.25], Y in [0..1.00])
  // Matte-black structural base & back panel beneath tabletop
  drawBox3D(
    ctx,
    camera,
    { x0: 2.76, x1: 3.78, y0: 0.0, y1: 0.92, z0: -6.80, z1: -4.30 },
    {
      top: '#18191c',
      posX: '#101114',
      posZ: '#0c0d10',
      negX: '#151619',
      stroke: 'rgba(255, 255, 255, 0.055)',
    }
  );
  // Thick warm timber/slate worktop (`Y in [0.92..1.00]`)
  drawBox3D(
    ctx,
    camera,
    { x0: WORKBENCH_BOUNDS.x0, x1: WORKBENCH_BOUNDS.x1, y0: 0.92, y1: WORKBENCH_BOUNDS.yTop, z0: WORKBENCH_BOUNDS.z0, z1: WORKBENCH_BOUNDS.z1 },
    {
      top: '#6e6353',
      posX: '#463f36',
      posZ: '#38322b',
      negX: '#4c443a',
      stroke: 'rgba(25, 21, 16, 0.55)',
    }
  );

  // 2) LAYER 3A: Dynamic Task-Lamp Benchtop Light Pool + Elevation-Coupled Cast Shadow
  renderTaskLampBenchPoolAndShadow(ctx, camera, lampLight, WORKBENCH_BOUNDS);

  // 3) Side specimen pedestal, raw agate nodules, trim saw & bench tools
  renderBenchToolsAndNodules(ctx, camera);

  // 4) Deep-Green Horizontal Dual-Wheel Lapidary Polisher (2 spinning wheels, arbor & pillow blocks)
  renderLapidaryPolisher(ctx, camera, state, lampLight);

  // 5) Articulated Double-Arm Black Architect Task Lamp (computes `lampIK.projectedShadePoly`)
  renderArticulatedTaskLamp(ctx, camera, lampIK, lampLight, state.hoverLamp, state.draggingLamp);

  // 6) LAYER 3B: Volumetric Task-Lamp Light Cone
  renderTaskLampVolumetricCone(ctx, camera, lampIK, lampLight);

  // 7) Front-Right Black Drawer Cabinet + Finger-Jointed Wooden Core Box (4 compartments, 20 rock cores)
  renderFrontCoreBoxAndCabinet(ctx, camera);

  return { lampIK, lampLight };
}

/**
 * Tests whether canvas coordinates `(canvasX, canvasY)` fall inside the projected 2D lamp shade polygon.
 */
export function hitTestLampShade(lampIK, canvasX, canvasY) {
  if (!lampIK || !lampIK.projectedShadePoly || lampIK.projectedShadePoly.length < 3) return false;
  return pointInPoly2D(canvasX, canvasY, lampIK.projectedShadePoly);
}
