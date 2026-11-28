/**
 * Three-Layer Museum Illumination System (`lighting.js`):
 *   Layer 1: Architectural top linear LED light bar inside cabinet header + recessed museum ceiling downlights.
 *   Layer 2: Isolated display cabinet milky-acrylic backlight (`20%–100%`) strictly clipped to the cabinet recess
 *            so modifying `#backlight-intensity` transforms agate transmittance & contrast without globally brightening the hall.
 *   Layer 3: Articulated double-arm task lamp local volumetric cone, dynamic bench speculars & elevation-coupled cast shadow.
 */

import { clamp, lerp } from './state.js';
import { drawPoly3D } from './projection25d.js';

/**
 * Computes physically coupled task-lamp lighting parameters from `lampElevationDeg` (15°–75°)
 * and the computed lamp shade kinematics.
 */
export function computeTaskLampLighting(lampIK, elevationDeg) {
  const elev = clamp(elevationDeg, 15, 75);
  const t = (elev - 15) / 60; // 0 at 15° (low grazing), 1 at 75° (high overhead)

  // Elevation affects beam landing target on the benchtop (Y = 1.00) and shadow length/direction
  // At low elevation (15°): shade aims further across the polisher toward near-left, casting longer shadow;
  // At high elevation (75°): shade hovers higher above polisher, focused tight circular pool & short shadow.
  const aimDir = lampIK.aimDir;
  const shadePos = lampIK.shadeRimCenter;
  const benchY = 1.005;
  const dy = shadePos[1] - benchY;
  const rayT = aimDir[1] < -0.12 ? dy / (-aimDir[1]) : 1.1;
  const clampedRayT = clamp(rayT, 0.35, 2.2);

  const hitX = clamp(shadePos[0] + aimDir[0] * clampedRayT, 2.55, 3.88);
  const hitZ = clamp(shadePos[2] + aimDir[2] * clampedRayT, -6.55, -4.35);

  // Pool footprint radius shrinks as lamp rises steeper and widens at grazing angle
  const poolRadiusX = lerp(0.56, 0.36, t);
  const poolRadiusZ = lerp(0.72, 0.42, t);

  // Cast shadow of polisher housing relative to lamp shade position
  const polisherCenter = [3.16, 1.24, -5.24];
  const ldx = polisherCenter[0] - shadePos[0];
  const ldz = polisherCenter[2] - shadePos[2];
  const horizDist = Math.hypot(ldx, ldz) || 0.01;
  const shadowReach = lerp(0.58, 0.14, t);
  const shadowShiftX = (ldx / horizDist) * shadowReach;
  const shadowShiftZ = (ldz / horizDist) * shadowReach;

  // Specular highlights on the green polisher housing & spinning wheels respond to elevation
  const housingSpecYNorm = lerp(0.22, 0.84, t); // low lamp highlights side rim, high lamp highlights top crown
  const wheelSpecBoost = lerp(1.18, 0.72, t);   // grazing angle intensifies metallic wheel face glint
  const coneOpacity = lerp(0.24, 0.34, t);
  const poolIntensity = lerp(0.68, 1.0, t);

  return {
    elevationDeg: elev,
    elevNorm: t,
    shadePos,
    aimDir,
    benchHit: [hitX, benchY, hitZ],
    poolRadiusX,
    poolRadiusZ,
    shadowShiftX,
    shadowShiftZ,
    shadowStretch: lerp(1.42, 0.82, t),
    housingSpecYNorm,
    wheelSpecBoost,
    coneOpacity,
    poolIntensity,
  };
}

/**
 * Layer 1A: Warm recessed ceiling spotlights & ambient gallery gradient backdrop.
 */
export function renderGalleryAtmosphere(ctx, camera, width, height) {
  // Deep museum obsidian-charcoal ambient base (strictly independent of cabinet backlight!)
  const bgGrad = ctx.createLinearGradient(0, 0, width, height);
  bgGrad.addColorStop(0, '#0a0b0d');
  bgGrad.addColorStop(0.45, '#111214');
  bgGrad.addColorStop(0.75, '#141312');
  bgGrad.addColorStop(1, '#09090b');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // Subtle warm museum downlight shafts in the distant exhibition hall (right background)
  const spots3d = [
    [2.6, 4.78, -9.2],
    [4.4, 4.78, -9.8],
    [6.1, 4.78, -9.5],
  ];
  ctx.save();
  for (let i = 0; i < spots3d.length; i += 1) {
    const sp = camera.project(spots3d[i][0], spots3d[i][1], spots3d[i][2]);
    if (!sp.visible) continue;
    const rOuter = 240 * camera.scale * (8.5 / Math.max(3, sp.depth));
    const g = ctx.createRadialGradient(sp.x, sp.y, 2, sp.x, sp.y + rOuter * 0.35, rOuter);
    g.addColorStop(0, 'rgba(255, 240, 210, 0.30)');
    g.addColorStop(0.22, 'rgba(240, 212, 165, 0.10)');
    g.addColorStop(1, 'rgba(240, 212, 165, 0.0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(sp.x, sp.y + rOuter * 0.25, rOuter, 0, Math.PI * 2);
    ctx.fill();

    // Crisp recessed ceiling LED fixture dot
    const rDot = Math.max(2.5, 6.5 * camera.scale * (8.5 / Math.max(3, sp.depth)));
    ctx.fillStyle = 'rgba(255, 248, 232, 0.92)';
    ctx.beginPath();
    ctx.ellipse(sp.x, sp.y, rDot * 1.4, rDot * 0.55, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/**
 * Layer 2: Isolated Milky-Acrylic Cabinet Backlight Panel (`20%–100%`).
 * Clipped strictly inside the 3D recessed backlit wall polygon so zero brightness leaks into the hall.
 */
export function renderIsolatedCabinetBacklight(ctx, camera, backlightIntensityPct, cabinetBounds) {
  const intensity = clamp(backlightIntensityPct, 20, 100) / 100; // 0.20 .. 1.00
  const norm = (intensity - 0.20) / 0.80; // 0.00 .. 1.00

  const { xWall, yBot, yTop, zNear, zFar } = cabinetBounds;
  const quad = [
    [xWall, yTop, zNear],
    [xWall, yTop, zFar],
    [xWall, yBot, zFar],
    [xWall, yBot, zNear],
  ];
  const proj = camera.projectPoly(quad);
  if (!proj.visible) return null;

  const pts = proj.pts;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  ctx.lineTo(pts[1].x, pts[1].y);
  ctx.lineTo(pts[2].x, pts[2].y);
  ctx.lineTo(pts[3].x, pts[3].y);
  ctx.closePath();
  ctx.clip();

  // Base milky acrylic panel luminance scaled cleanly by `backlightIntensityPct`
  // High intensity (84–100%) produces luminous pearl-white gallery lightbox matching reference-0.png,
  // while low intensity (20%) drops to a moody dim warm-umber glow strictly inside the clipped recess.
  const rCore = Math.round(lerp(74, 255, Math.pow(norm, 0.62)));
  const gCore = Math.round(lerp(66, 252, Math.pow(norm, 0.64)));
  const bCore = Math.round(lerp(56, 240, Math.pow(norm, 0.68)));

  const rEdge = Math.round(lerp(36, 232, Math.pow(norm, 0.72)));
  const gEdge = Math.round(lerp(32, 222, Math.pow(norm, 0.74)));
  const bEdge = Math.round(lerp(28, 202, Math.pow(norm, 0.78)));

  const pMidTop = camera.project(xWall, yTop, (zNear + zFar) * 0.5);
  const pMidBot = camera.project(xWall, yBot, (zNear + zFar) * 0.5);

  const vertGrad = ctx.createLinearGradient(pMidTop.x, pMidTop.y, pMidBot.x, pMidBot.y);
  vertGrad.addColorStop(0.0, `rgb(${rEdge}, ${gEdge}, ${bEdge})`);
  vertGrad.addColorStop(0.11, `rgb(${rCore}, ${gCore}, ${bCore})`);
  vertGrad.addColorStop(0.88, `rgb(${rCore}, ${gCore}, ${bCore})`);
  vertGrad.addColorStop(1.0, `rgb(${Math.round(rEdge * 0.96)}, ${Math.round(gEdge * 0.94)}, ${Math.round(bEdge * 0.92)})`);
  ctx.fillStyle = vertGrad;
  ctx.fillRect(0, 0, camera.viewW, camera.viewH);

  // Soft radiant LED diffuser bloom behind the 3 staggered agate rows
  const rowYs = [2.76, 2.11, 1.49];
  for (let i = 0; i < rowYs.length; i += 1) {
    const bandQuad = [
      [xWall, rowYs[i] + 0.18, zNear],
      [xWall, rowYs[i] + 0.18, zFar],
      [xWall, rowYs[i] - 0.18, zFar],
      [xWall, rowYs[i] - 0.18, zNear],
    ];
    drawPoly3D(ctx, camera, bandQuad, `rgba(255, 250, 238, ${lerp(0.05, 0.32, norm).toFixed(3)})`);
  }

  // Subtle recessed edge falloff near far-right cabinet return
  const sideGrad = ctx.createLinearGradient(pts[0].x, pts[0].y, pts[1].x, pts[1].y);
  sideGrad.addColorStop(0.0, 'rgba(30, 22, 14, 0.02)');
  sideGrad.addColorStop(0.84, 'rgba(30, 22, 14, 0.00)');
  sideGrad.addColorStop(0.96, `rgba(22, 18, 14, ${lerp(0.26, 0.12, norm).toFixed(3)})`);
  sideGrad.addColorStop(1.0, `rgba(12, 10, 9, ${lerp(0.48, 0.24, norm).toFixed(3)})`);
  ctx.fillStyle = sideGrad;
  ctx.fillRect(0, 0, camera.viewW, camera.viewH);

  // Subtle backlit reflection bounce onto cabinet bottom lip only (still inside clipped quad)
  const topShadow = ctx.createLinearGradient(pMidTop.x, pMidTop.y, pMidTop.x, pMidTop.y + 38 * camera.scale);
  topShadow.addColorStop(0, `rgba(10, 10, 12, ${lerp(0.55, 0.30, norm).toFixed(3)})`);
  topShadow.addColorStop(1, 'rgba(10, 10, 12, 0)');
  ctx.fillStyle = topShadow;
  ctx.fillRect(0, 0, camera.viewW, camera.viewH);

  ctx.restore();
  return proj;
}

/**
 * Layer 1B: Crisp Top Linear LED Light Bar recessed in the upper front rim of the left cabinet.
 */
export function renderCabinetTopLinearBar(ctx, camera) {
  const pNear = camera.project(0.54, 3.86, -0.35);
  const pFar = camera.project(0.54, 3.86, -7.12);
  if (!pNear.visible || !pFar.visible) return;

  ctx.save();
  // Soft warm-white atmospheric bloom along the top ceiling soffit of the display box
  ctx.globalCompositeOperation = 'screen';
  ctx.lineCap = 'round';

  ctx.strokeStyle = 'rgba(255, 245, 224, 0.14)';
  ctx.lineWidth = Math.max(8, 26 * camera.scale);
  ctx.beginPath();
  ctx.moveTo(pNear.x, pNear.y);
  ctx.lineTo(pFar.x, pFar.y);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(255, 250, 236, 0.42)';
  ctx.lineWidth = Math.max(3, 9 * camera.scale);
  ctx.beginPath();
  ctx.moveTo(pNear.x, pNear.y);
  ctx.lineTo(pFar.x, pFar.y);
  ctx.stroke();

  // Sharp core diffuser filament
  ctx.globalCompositeOperation = 'source-over';
  ctx.strokeStyle = '#fffdf7';
  ctx.lineWidth = Math.max(1.8, 3.6 * camera.scale);
  ctx.beginPath();
  ctx.moveTo(pNear.x, pNear.y);
  ctx.lineTo(pFar.x, pFar.y);
  ctx.stroke();

  // Subtle warm sheen cast downward onto the matte header face just below the LED strip
  const washQuad = [
    [0.06, 3.84, -0.45],
    [0.06, 3.84, -7.12],
    [0.06, 3.24, -7.12],
    [0.06, 3.24, -0.45],
  ];
  const pWashTop = camera.project(0.06, 3.84, -3.8);
  const pWashBot = camera.project(0.06, 3.24, -3.8);
  const washGrad = ctx.createLinearGradient(pWashTop.x, pWashTop.y, pWashBot.x, pWashBot.y);
  washGrad.addColorStop(0, 'rgba(255, 246, 224, 0.13)');
  washGrad.addColorStop(0.45, 'rgba(255, 242, 214, 0.04)');
  washGrad.addColorStop(1, 'rgba(255, 242, 214, 0.0)');
  drawPoly3D(ctx, camera, washQuad, washGrad);

  ctx.restore();
}

/**
 * Layer 3A: Dynamic Benchtop Illuminated Pool + Elevation-Coupled Polisher Cast Shadow
 * (drawn onto the workbench top surface BEFORE the polisher sits on top!).
 */
export function renderTaskLampBenchPoolAndShadow(ctx, camera, lampLight, benchBounds) {
  const { x0, x1, yTop, z0, z1 } = benchBounds;
  const benchQuad = [
    [x0, yTop, z1],
    [x1, yTop, z1],
    [x1, yTop, z0],
    [x0, yTop, z0],
  ];
  const projBench = camera.projectPoly(benchQuad);
  if (!projBench.visible) return;

  ctx.save();
  // Clip strictly to the workbench top surface
  ctx.beginPath();
  ctx.moveTo(projBench.pts[0].x, projBench.pts[0].y);
  for (let i = 1; i < projBench.pts.length; i += 1) {
    ctx.lineTo(projBench.pts[i].x, projBench.pts[i].y);
  }
  ctx.closePath();
  ctx.clip();

  // 1) Warm elliptical light pool projected in 3D on the benchtop
  const [hx, hy, hz] = lampLight.benchHit;
  const rx = lampLight.poolRadiusX;
  const rz = lampLight.poolRadiusZ;
  const poolPts = [];
  const segs = 24;
  for (let i = 0; i < segs; i += 1) {
    const a = (i / segs) * Math.PI * 2;
    poolPts.push([hx + Math.cos(a) * rx, hy, hz + Math.sin(a) * rz]);
  }
  const pCenter = camera.project(hx, hy, hz);
  const pEdge = camera.project(hx + rx, hy, hz);
  const pEdgeZ = camera.project(hx, hy, hz + rz);
  const screenR = Math.max(
    18,
    Math.hypot(pEdge.x - pCenter.x, pEdge.y - pCenter.y),
    Math.hypot(pEdgeZ.x - pCenter.x, pEdgeZ.y - pCenter.y)
  );

  const poolGrad = ctx.createRadialGradient(pCenter.x, pCenter.y, 2, pCenter.x, pCenter.y, screenR * 1.15);
  poolGrad.addColorStop(0.0, `rgba(255, 232, 184, ${(0.58 * lampLight.poolIntensity).toFixed(3)})`);
  poolGrad.addColorStop(0.42, `rgba(248, 210, 146, ${(0.30 * lampLight.poolIntensity).toFixed(3)})`);
  poolGrad.addColorStop(0.82, `rgba(225, 178, 108, ${(0.09 * lampLight.poolIntensity).toFixed(3)})`);
  poolGrad.addColorStop(1.0, 'rgba(225, 178, 108, 0.0)');

  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  drawPoly3D(ctx, camera, poolPts, poolGrad);
  ctx.restore();

  // 2) Dynamic elevation-coupled cast shadow of the green lapidary polisher
  const polX = 3.14;
  const polZ = -5.24;
  const sx = polX + lampLight.shadowShiftX;
  const sz = polZ + lampLight.shadowShiftZ;
  const srX = 0.34 * lampLight.shadowStretch;
  const srZ = 0.42 * lampLight.shadowStretch;
  const shadowPts = [];
  for (let i = 0; i < 20; i += 1) {
    const a = (i / 20) * Math.PI * 2;
    shadowPts.push([sx + Math.cos(a) * srX, hy, sz + Math.sin(a) * srZ]);
  }
  const psC = camera.project(sx, hy, sz);
  const psE = camera.project(sx + srX, hy, sz);
  const shR = Math.max(14, Math.hypot(psE.x - psC.x, psE.y - psC.y) * 1.35);
  const shGrad = ctx.createRadialGradient(psC.x, psC.y, 3, psC.x, psC.y, shR);
  shGrad.addColorStop(0.0, 'rgba(4, 5, 7, 0.68)');
  shGrad.addColorStop(0.60, 'rgba(6, 7, 10, 0.38)');
  shGrad.addColorStop(1.0, 'rgba(6, 7, 10, 0.0)');
  drawPoly3D(ctx, camera, shadowPts, shGrad);

  ctx.restore();
}

/**
 * Layer 3B: Soft Volumetric Task Lamp Light Cone rendered AFTER the lamp & polisher.
 */
export function renderTaskLampVolumetricCone(ctx, camera, lampIK, lampLight) {
  const rimPts3d = lampIK.shadeRimRing3d;
  if (!rimPts3d || rimPts3d.length < 6) return;

  // Project rim ellipse extreme left/right points and bench landing ellipse extremes
  const projRim = rimPts3d.map(p => camera.project(p[0], p[1], p[2]));
  if (projRim.some(p => !p.visible)) return;

  let rimMin = projRim[0];
  let rimMax = projRim[0];
  for (const p of projRim) {
    if (p.x < rimMin.x) rimMin = p;
    if (p.x > rimMax.x) rimMax = p;
  }

  const [hx, hy, hz] = lampLight.benchHit;
  const rx = lampLight.poolRadiusX * 0.92;
  const rz = lampLight.poolRadiusZ * 0.92;
  const basePts3d = [];
  for (let i = 0; i < 16; i += 1) {
    const a = (i / 16) * Math.PI * 2;
    basePts3d.push([hx + Math.cos(a) * rx, hy, hz + Math.sin(a) * rz]);
  }
  const projBase = basePts3d.map(p => camera.project(p[0], p[1], p[2]));
  let baseMin = projBase[0];
  let baseMax = projBase[0];
  let baseMidY = 0;
  for (const p of projBase) {
    if (p.x < baseMin.x) baseMin = p;
    if (p.x > baseMax.x) baseMax = p;
    baseMidY += p.y;
  }
  baseMidY /= projBase.length;

  const rimCenter = camera.project(lampIK.shadeRimCenter[0], lampIK.shadeRimCenter[1], lampIK.shadeRimCenter[2]);
  const hitCenter = camera.project(hx, hy, hz);

  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  const coneGrad = ctx.createLinearGradient(rimCenter.x, rimCenter.y, hitCenter.x, baseMidY);
  coneGrad.addColorStop(0.0, `rgba(255, 236, 192, ${(lampLight.coneOpacity * 1.15).toFixed(3)})`);
  coneGrad.addColorStop(0.32, `rgba(255, 224, 165, ${(lampLight.coneOpacity * 0.52).toFixed(3)})`);
  coneGrad.addColorStop(0.75, `rgba(244, 200, 128, ${(lampLight.coneOpacity * 0.16).toFixed(3)})`);
  coneGrad.addColorStop(1.0, 'rgba(244, 200, 128, 0.0)');

  ctx.fillStyle = coneGrad;
  ctx.beginPath();
  ctx.moveTo(rimMin.x, rimMin.y);
  ctx.lineTo(rimMax.x, rimMax.y);
  ctx.lineTo(baseMax.x, baseMax.y);
  ctx.lineTo(baseMin.x, baseMin.y);
  ctx.closePath();
  ctx.fill();

  // Warm bulb core halo just inside the open dome rim
  const bulbR = Math.max(8, Math.abs(rimMax.x - rimMin.x) * 0.52);
  const bulbGrad = ctx.createRadialGradient(rimCenter.x, rimCenter.y, 1, rimCenter.x, rimCenter.y, bulbR);
  bulbGrad.addColorStop(0, 'rgba(255, 248, 225, 0.78)');
  bulbGrad.addColorStop(0.45, 'rgba(255, 222, 152, 0.30)');
  bulbGrad.addColorStop(1, 'rgba(255, 222, 152, 0.0)');
  ctx.fillStyle = bulbGrad;
  ctx.beginPath();
  ctx.arc(rimCenter.x, rimCenter.y, bulbR, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
