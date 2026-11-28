/**
 * Museum Hall Architecture, Back Exhibition Panels, Left Backlit Black-Lacquer Cabinet,
 * Lower Raw-Rock Specimen Plinth, ~18° Sloped China Distribution Map Box & Mineral Plates (`galleryGeometry.js`).
 *
 * Every vertex projects through the unified `Camera25D` instance in `projection25d.js`.
 */

import { mulberry32, clamp } from './state.js';
import {
  drawPoly3D,
  drawLine3D,
  drawBox3D,
  drawTexturedQuad3D,
} from './projection25d.js';
import {
  renderIsolatedCabinetBacklight,
  renderCabinetTopLinearBar,
} from './lighting.js';
import { renderAgateWallSlices } from './agates.js';

export const CABINET_BACKLIT_BOUNDS = Object.freeze({
  xWall: 0.0,
  yBot: 1.18,
  yTop: 3.16,
  zNear: -0.10,
  zFar: -7.12,
});

/**
 * Renders the background museum hall architecture: ceiling, floor with subtle sheen,
 * back exhibition wall (`Z = -10.8`), distant vitrines, and the two featured back-right panels:
 *   - "从岩石到宝石 / From Rock to Gemstone"
 *   - "地球的记忆 / Memories of the Earth"
 */
export function renderGalleryBackground(ctx, camera, textures) {
  // 1) Gallery dark matte ceiling plane (Y = 4.82)
  drawPoly3D(
    ctx,
    camera,
    [[-0.4, 4.82, -11.4], [8.2, 4.82, -11.4], [8.2, 4.82, 0.5], [-0.4, 4.82, 0.5]],
    '#0d0e10'
  );

  // Subtle architectural ceiling soffit beam running across the gallery
  drawBox3D(
    ctx,
    camera,
    { x0: 0.6, x1: 7.8, y0: 4.46, y1: 4.82, z0: -10.2, z1: -9.85 },
    { bottom: '#171719', posZ: '#101113', negX: '#131416' }
  );

  // 2) Polished dark museum terrazzo floor (Y = 0)
  const pFloorNear = camera.project(3.0, 0, -1.0);
  const pFloorFar = camera.project(3.0, 0, -11.0);
  const floorGrad = ctx.createLinearGradient(pFloorFar.x, pFloorFar.y, pFloorNear.x, pFloorNear.y);
  floorGrad.addColorStop(0.0, '#141517');
  floorGrad.addColorStop(0.55, '#1d1e20');
  floorGrad.addColorStop(1.0, '#161719');
  drawPoly3D(
    ctx,
    camera,
    [[-0.2, 0.0, -11.4], [8.2, 0.0, -11.4], [8.2, 0.0, 1.0], [-0.2, 0.0, 1.0]],
    floorGrad
  );

  // Subtle floor stone joint lines converging cleanly to both vanishing points
  for (let z = -2.0; z >= -10.5; z -= 1.7) {
    drawLine3D(ctx, camera, [0.5, 0.002, z], [7.8, 0.002, z], 'rgba(255, 255, 255, 0.032)', 1);
  }
  for (let x = 1.6; x <= 7.2; x += 1.4) {
    drawLine3D(ctx, camera, [x, 0.002, -0.5], [x, 0.002, -11.2], 'rgba(255, 255, 255, 0.036)', 1);
  }

  // 3) Back exhibition room wall (Z = -11.0)
  drawPoly3D(
    ctx,
    camera,
    [[-0.3, 0.0, -11.0], [8.2, 0.0, -11.0], [8.2, 4.82, -11.0], [-0.3, 4.82, -11.0]],
    '#101113'
  );

  // 4) Far-left background outcrop panel & illuminated low mineral vitrine behind glass divider
  drawTexturedQuad3D(
    ctx,
    camera,
    [
      [0.35, 4.22, -10.82],
      [1.82, 4.22, -10.82],
      [1.82, 0.35, -10.82],
      [0.35, 0.35, -10.82],
    ],
    textures.panelBgOutcrop,
    3,
    4,
    0.92
  );

  // Distant low illuminated glass showcase table (mid-back aisle, X in [0.55..2.35], Z in [-9.6..-8.4])
  drawBox3D(
    ctx,
    camera,
    { x0: 0.55, x1: 2.38, y0: 0.0, y1: 0.96, z0: -9.65, z1: -8.55 },
    { top: '#2b2822', posX: '#171719', posZ: '#131416', stroke: 'rgba(255,255,255,0.06)' }
  );
  // Warm interior glow of distant rock specimens inside background glass vitrine
  drawPoly3D(
    ctx,
    camera,
    [[0.62, 1.38, -8.56], [2.32, 1.38, -8.56], [2.32, 0.96, -8.56], [0.62, 0.96, -8.56]],
    'rgba(225, 200, 152, 0.14)',
    'rgba(230, 224, 212, 0.22)',
    0.9
  );
  const bgSpecimens = [
    { x: 0.95, z: -9.05, r: 0.14, col: '#b89f78' },
    { x: 1.35, z: -9.12, r: 0.18, col: '#cbb896' },
    { x: 1.76, z: -9.02, r: 0.16, col: '#9e8260' },
    { x: 2.12, z: -9.15, r: 0.13, col: '#d4c3a4' },
  ];
  for (const sp of bgSpecimens) {
    const p = camera.project(sp.x, 1.05, sp.z);
    if (!p.visible) continue;
    const rx = sp.r * (camera.focal / Math.max(2, p.depth)) * camera.scale;
    ctx.fillStyle = sp.col;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, rx, rx * 0.65, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // 5) Center-right tall exhibition panel: "从岩石到宝石 / From Rock to Gemstone"
  drawBox3D(
    ctx,
    camera,
    { x0: 2.02, x1: 4.18, y0: 0.0, y1: 4.30, z0: -10.95, z1: -10.62 },
    { top: '#1d1e20', posX: '#101113', negX: '#17181a', posZ: '#151618', stroke: 'rgba(255,255,255,0.05)' }
  );
  drawTexturedQuad3D(
    ctx,
    camera,
    [
      [2.05, 4.24, -10.61],
      [4.15, 4.24, -10.61],
      [4.15, 0.08, -10.61],
      [2.05, 0.08, -10.61],
    ],
    textures.panelRockToGem,
    4,
    5
  );

  // Structural dark vertical gallery column between the two back panels
  drawBox3D(
    ctx,
    camera,
    { x0: 4.30, x1: 4.72, y0: 0.0, y1: 4.82, z0: -10.95, z1: -10.35 },
    { posX: '#131416', negX: '#1a1b1e', posZ: '#0c0d0f' }
  );

  // 6) Far-right tall exhibition panel: "地球的记忆 / Memories of the Earth"
  drawBox3D(
    ctx,
    camera,
    { x0: 4.68, x1: 7.36, y0: 0.0, y1: 4.46, z0: -10.95, z1: -10.58 },
    { top: '#1c1c1e', negX: '#17181a', posZ: '#141517', stroke: 'rgba(255,255,255,0.05)' }
  );
  drawTexturedQuad3D(
    ctx,
    camera,
    [
      [4.72, 4.42, -10.57],
      [7.32, 4.42, -10.57],
      [7.32, 1.16, -10.57],
      [4.72, 1.16, -10.57],
    ],
    textures.panelMemoriesEarth,
    4,
    5
  );

  // Lower horizontal glass rock vitrine directly beneath "地球的记忆"
  drawBox3D(
    ctx,
    camera,
    { x0: 4.84, x1: 7.36, y0: 0.0, y1: 0.92, z0: -10.56, z1: -9.75 },
    { top: '#242527', posZ: '#101113', negX: '#17181a', stroke: 'rgba(255,255,255,0.06)' }
  );
  drawPoly3D(
    ctx,
    camera,
    [[4.88, 1.24, -9.76], [7.30, 1.24, -9.76], [7.30, 0.92, -9.76], [4.88, 0.92, -9.76]],
    'rgba(220, 212, 198, 0.10)',
    'rgba(235, 232, 226, 0.22)',
    0.8
  );
  // Subtle mineral silhouettes inside far-right showcase
  for (let i = 0; i < 4; i += 1) {
    const p = camera.project(5.25 + i * 0.48, 0.98, -10.12);
    if (!p.visible) continue;
    const r = 10 * camera.scale;
    ctx.fillStyle = i % 2 === 0 ? '#9c8f7d' : '#7a7064';
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, r * 1.4, r * 0.72, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Subtle architectural glass partition divider standing behind the left cabinet
  drawLine3D(ctx, camera, [0.85, 0.0, -7.85], [0.85, 4.78, -7.85], 'rgba(220, 224, 230, 0.14)', 1.5);
  drawLine3D(ctx, camera, [1.85, 0.0, -9.65], [1.85, 4.78, -9.65], 'rgba(220, 224, 230, 0.10)', 1.2);
}

/**
 * Renders the 3D rough dark volcanic basalt-agate rock specimen resting inside the lower-left plinth showcase
 * with organic contoured strata, mineral speckles, and glossy quartz crystal glints.
 */
function renderRawRockSpecimen3D(ctx, camera) {
  const rand = mulberry32(6143);
  const cx = 0.56;
  const cz = -1.04;
  const slopeY = x => 1.165 - (x - 0.05) * 0.3249;

  // Soft dark ambient contact shadow on sloped tray underneath rock
  const shadowPts = [];
  for (let i = 0; i < 24; i += 1) {
    const a = (i / 24) * Math.PI * 2;
    const rx = cx + Math.cos(a) * 0.36;
    const rz = cz + Math.sin(a) * 0.62;
    shadowPts.push([rx + 0.04, slopeY(rx) + 0.014, rz]);
  }
  drawPoly3D(ctx, camera, shadowPts, 'rgba(5, 4, 4, 0.72)');

  // High-density organic contoured basalt boulder strata (smooth organic shading instead of flat low-poly)
  const layers = [
    { h: 0.015, rx: 0.34, rz: 0.58, col: '#1f1b18' },
    { h: 0.055, rx: 0.32, rz: 0.55, col: '#2b2520' },
    { h: 0.095, rx: 0.28, rz: 0.49, col: '#383029' },
    { h: 0.135, rx: 0.23, rz: 0.42, col: '#473c32' },
    { h: 0.168, rx: 0.16, rz: 0.31, col: '#55473b' },
    { h: 0.192, rx: 0.09, rz: 0.18, col: '#665647' },
  ];
  const segs = 28;
  for (let l = 0; l < layers.length; l += 1) {
    const lay = layers[l];
    const pts = [];
    for (let i = 0; i < segs; i += 1) {
      const a = (i / segs) * Math.PI * 2;
      const organic = 0.84 + 0.16 * Math.sin(a * 3 + l * 0.8) + 0.09 * Math.cos(a * 5 - l * 1.1) + (rand() - 0.5) * 0.07;
      const rx = cx + Math.cos(a) * lay.rx * organic - l * 0.01;
      const rz = cz + Math.sin(a) * lay.rz * organic;
      pts.push([rx, slopeY(rx) + lay.h + (rand() - 0.5) * 0.014, rz]);
    }
    drawPoly3D(ctx, camera, pts, lay.col);
  }

  // Glossy crystalline mineral highlights & amygdule vesicles across the volcanic rock top
  for (let s = 0; s < 48; s += 1) {
    const a = rand() * Math.PI * 2;
    const rad = Math.sqrt(rand()) * 0.85;
    const rx = cx + Math.cos(a) * 0.26 * rad;
    const rz = cz + Math.sin(a) * 0.46 * rad;
    const ry = slopeY(rx) + 0.08 + (1 - rad) * 0.11;
    const p = camera.project(rx, ry, rz);
    if (!p.visible) continue;
    const isGlint = rand() > 0.52;
    ctx.fillStyle = isGlint ? 'rgba(218, 198, 168, 0.38)' : 'rgba(14, 11, 9, 0.48)';
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, (1.5 + rand() * 3.8) * camera.scale, (1.0 + rand() * 2.0) * camera.scale, rand() * 3.14, 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * Renders the complete Left Black-Lacquer Backlit Agate Cabinet (~7.2m × 3.88m)
 * AND the ~18° Sloped Lower Console (Rock Plinth + 3.4m × 1.5m China Distribution Map + Mineral Plates).
 */
export function renderLeftDisplayCabinet(ctx, camera, textures, slices, state) {
  // 1) Completed occluded back housing & solid structural shell behind the cabinet
  drawBox3D(
    ctx,
    camera,
    { x0: -0.28, x1: 0.0, y0: 0.0, y1: 4.08, z0: -7.28, z1: 0.0 },
    { top: '#0c0d0f', posX: '#111214', negZ: '#0a0b0d' }
  );

  // 2) Lower matte-black lacquered cabinet plinth base (Y in [0.0, 0.695], X in [0.0, 1.54])
  drawBox3D(
    ctx,
    camera,
    { x0: 0.0, x1: 1.54, y0: 0.0, y1: 0.695, z0: -7.26, z1: 0.0 },
    {
      top: '#18191c',
      posX: '#0c0d0f',
      posZ: '#08090b',
      negZ: '#090a0c',
      stroke: 'rgba(255, 255, 255, 0.04)',
    }
  );

  // Matte-black lower front plinth subtle recessed cabinet door seams (aligned to map & specimen zones)
  const seamZs = [-1.94, -5.36, -7.18];
  for (const sz of seamZs) {
    drawLine3D(ctx, camera, [1.542, 0.02, sz], [1.542, 0.692, sz], 'rgba(255, 255, 255, 0.075)', 1.2);
  }
  // Subtle upper chamfer highlight lip along front edge of sloped plinth
  drawLine3D(ctx, camera, [1.542, 0.695, -0.05], [1.542, 0.695, -7.26], 'rgba(215, 210, 200, 0.16)', 1.4);

  // 3) Side return wall of the sloped console at far end Z = -7.26 (completes triangular wedge thickness!)
  drawPoly3D(
    ctx,
    camera,
    [
      [0.0, 1.16, -7.26],
      [1.54, 0.695, -7.26],
      [1.54, 0.0, -7.26],
      [0.0, 0.0, -7.26],
    ],
    '#0e0f11',
    'rgba(255, 255, 255, 0.05)',
    0.9
  );

  // 4) Recessed interior ceiling soffit & side return inside upper cabinet cavity
  drawPoly3D(
    ctx,
    camera,
    [
      [0.0, 3.88, -0.05],
      [0.62, 3.88, -0.05],
      [0.62, 3.88, -7.20],
      [0.0, 3.88, -7.20],
    ],
    '#141517'
  );
  // Recessed interior floor ledge directly beneath the backlit agate wall
  drawPoly3D(
    ctx,
    camera,
    [
      [0.0, 1.18, -0.05],
      [0.62, 1.18, -0.05],
      [0.62, 1.18, -7.20],
      [0.0, 1.18, -7.20],
    ],
    '#1d1d20'
  );

  // 5) Recessed Right Interior Legend Panel ("— 羽状纹 / — 树枝纹 / — 同心纹")
  //    Located immediately to the right of the backlit wall inside the cabinet recess (Z = -7.14, X in [0.0..0.58])
  drawTexturedQuad3D(
    ctx,
    camera,
    [
      [0.02, 3.16, -7.14],
      [0.58, 3.16, -7.14],
      [0.58, 1.18, -7.14],
      [0.02, 1.18, -7.14],
    ],
    textures.cabinetLegend,
    3,
    4
  );

  // Upper dark back wall behind title band + mapped bilingual header ("玛瑙的多样纹理 / Agate Patterns")
  drawPoly3D(
    ctx,
    camera,
    [
      [0.0, 3.88, -0.05],
      [0.0, 3.88, -7.18],
      [0.0, 3.16, -7.18],
      [0.0, 3.16, -0.05],
    ],
    '#161719'
  );
  drawTexturedQuad3D(
    ctx,
    camera,
    [
      [0.02, 3.85, -0.20],
      [0.02, 3.85, -7.12],
      [0.02, 3.17, -7.12],
      [0.02, 3.17, -0.20],
    ],
    textures.cabinetHeader,
    6,
    2
  );

  // 6) LAYER 2: Isolated Milky-Acrylic Backlight Panel (`20%–100%`)
  renderIsolatedCabinetBacklight(ctx, camera, state.backlightIntensityPct, CABINET_BACKLIT_BOUNDS);

  // 7) 16 Procedural Translucent Agate Slices + Clear Acrylic Shelf Rails + Acrylic Prongs
  renderAgateWallSlices(ctx, camera, slices, state);

  // 8) LAYER 1B: Top Linear LED Light Bar inside front-upper cabinet soffit
  renderCabinetTopLinearBar(ctx, camera);

  // 9) Upper black-lacquer fascia beam & vertical front-right cabinet frame post
  //    (forms the crisp black outer framing visible in reference-0.png)
  drawBox3D(
    ctx,
    camera,
    { x0: 0.54, x1: 0.64, y0: 3.88, y1: 4.18, z0: -7.28, z1: 0.0 },
    { posX: '#0b0c0e', bottom: '#17181b', negZ: '#08090b' }
  );
  // Crisp outer right vertical black-lacquer pillar of display cabinet (Z in [-7.28..-7.14], X in [0.54..0.64])
  drawBox3D(
    ctx,
    camera,
    { x0: 0.54, x1: 0.65, y0: 0.695, y1: 4.18, z0: -7.28, z1: -7.14 },
    {
      posX: '#121316',
      posZ: '#0c0d0f',
      negZ: '#090a0c',
      stroke: 'rgba(255, 255, 255, 0.055)',
    }
  );
  // Subtle specular reflection along the glass front pane edge of the upper display cabinet
  const glassQuad = [
    [0.60, 3.86, -0.10],
    [0.60, 3.86, -7.14],
    [0.60, 1.18, -7.14],
    [0.60, 1.18, -0.10],
  ];
  const pG1 = camera.project(0.60, 3.5, -5.0);
  const pG2 = camera.project(0.60, 1.5, -6.8);
  const glassGrad = ctx.createLinearGradient(pG1.x, pG1.y, pG2.x, pG2.y);
  glassGrad.addColorStop(0.0, 'rgba(255, 252, 245, 0.0)');
  glassGrad.addColorStop(0.45, 'rgba(255, 250, 240, 0.028)');
  glassGrad.addColorStop(0.75, 'rgba(255, 248, 236, 0.048)');
  glassGrad.addColorStop(1.0, 'rgba(255, 245, 230, 0.012)');
  drawPoly3D(ctx, camera, glassQuad, glassGrad);
  drawLine3D(ctx, camera, [0.60, 3.86, -7.14], [0.60, 1.18, -7.14], 'rgba(230, 224, 214, 0.18)', 1.2);

  // 10) ~18° SLOPED CONSOLE DECK (runs along entire cabinet front X = 0.05 -> 1.52, Y = 1.165 -> 0.695)
  //     tan(18°) = 0.3249 -> drop = 1.47 * 0.3249 = 0.478m; slope surface length = 1.545m (~1.5m!)
  const slopeY = x => 1.165 - (x - 0.05) * 0.3249;
  drawPoly3D(
    ctx,
    camera,
    [
      [0.05, slopeY(0.05), -0.05],
      [0.05, slopeY(0.05), -7.24],
      [1.52, slopeY(1.52), -7.24],
      [1.52, slopeY(1.52), -0.05],
    ],
    '#141518',
    'rgba(255, 255, 255, 0.06)',
    1.0
  );

  // 10A) Left Sloped Rock-Specimen Plinth Showcase (Z in [-1.90, -0.15])
  const rockTray = [
    [0.12, slopeY(0.12) + 0.012, -0.18],
    [0.12, slopeY(0.12) + 0.012, -1.86],
    [1.42, slopeY(1.42) + 0.012, -1.86],
    [1.42, slopeY(1.42) + 0.012, -0.18],
  ];
  drawPoly3D(ctx, camera, rockTray, '#1e2024', 'rgba(210, 206, 198, 0.28)', 1.2);
  // Specimen placard strip near front edge of left tray
  drawTexturedQuad3D(
    ctx,
    camera,
    [
      [0.98, slopeY(0.98) + 0.016, -0.24],
      [0.98, slopeY(0.98) + 0.016, -1.78],
      [1.38, slopeY(1.38) + 0.016, -1.78],
      [1.38, slopeY(1.38) + 0.016, -0.24],
    ],
    textures.rockPlacard,
    4,
    2
  );
  // 3D rough basalt-agate rock specimen inside showcase
  renderRawRockSpecimen3D(ctx, camera);
  // Clear glass bevel cover edge over rock showcase
  drawLine3D(ctx, camera, [1.42, slopeY(1.42) + 0.014, -0.18], [1.42, slopeY(1.42) + 0.014, -1.86], 'rgba(235, 238, 244, 0.42)', 1.6);

  // 10B) Center ~18° Sloped China Agate Distribution Map Box (`3.40m × 1.50m`, Z in [-5.35, -1.95])
  //      Raised aluminum & glass beveled frame + backlit warm China map plate!
  const mapRaise = 0.032;
  const mapOuter = [
    [0.10, slopeY(0.10) + mapRaise, -1.96],
    [0.10, slopeY(0.10) + mapRaise, -5.34],
    [1.45, slopeY(1.45) + mapRaise, -5.34],
    [1.45, slopeY(1.45) + mapRaise, -1.96],
  ];
  // Map box front & side metallic frame thickness
  drawPoly3D(
    ctx,
    camera,
    [
      [1.45, slopeY(1.45) + mapRaise, -1.96],
      [1.45, slopeY(1.45) + mapRaise, -5.34],
      [1.45, slopeY(1.45), -5.34],
      [1.45, slopeY(1.45), -1.96],
    ],
    '#2a2c30',
    'rgba(220, 214, 204, 0.25)',
    0.8
  );
  drawPoly3D(
    ctx,
    camera,
    [
      [0.10, slopeY(0.10) + mapRaise, -5.34],
      [1.45, slopeY(1.45) + mapRaise, -5.34],
      [1.45, slopeY(1.45), -5.34],
      [0.10, slopeY(0.10), -5.34],
    ],
    '#1e2024'
  );
  drawPoly3D(ctx, camera, mapOuter, '#3b3c3f', 'rgba(235, 228, 214, 0.45)', 1.4);

  // Map surface graphic warped with 8x5 true perspective subdivisions!
  const mapInner = [
    [0.14, slopeY(0.14) + mapRaise + 0.004, -2.02],
    [0.14, slopeY(0.14) + mapRaise + 0.004, -5.28],
    [1.41, slopeY(1.41) + mapRaise + 0.004, -5.28],
    [1.41, slopeY(1.41) + mapRaise + 0.004, -2.02],
  ];
  drawTexturedQuad3D(ctx, camera, mapInner, textures.chinaMap, 8, 5);

  // Subtle tempered glass sheen diagonally across the China map glass
  const pM1 = camera.project(0.25, slopeY(0.25) + mapRaise, -2.4);
  const pM2 = camera.project(1.30, slopeY(1.30) + mapRaise, -4.8);
  const mapSheen = ctx.createLinearGradient(pM1.x, pM1.y, pM2.x, pM2.y);
  mapSheen.addColorStop(0.0, 'rgba(255, 255, 255, 0.06)');
  mapSheen.addColorStop(0.35, 'rgba(255, 252, 244, 0.02)');
  mapSheen.addColorStop(0.50, 'rgba(255, 255, 255, 0.10)');
  mapSheen.addColorStop(0.65, 'rgba(255, 255, 255, 0.01)');
  mapSheen.addColorStop(1.0, 'rgba(20, 18, 16, 0.08)');
  drawPoly3D(ctx, camera, mapInner, mapSheen, 'rgba(255, 250, 240, 0.35)', 1.0);

  // 10C) Right Sloped Mineral Graphic Plate (Z in [-7.12, -5.42])
  const plateOuter = [
    [0.11, slopeY(0.11) + 0.022, -5.44],
    [0.11, slopeY(0.11) + 0.022, -7.12],
    [1.44, slopeY(1.44) + 0.022, -7.12],
    [1.44, slopeY(1.44) + 0.022, -5.44],
  ];
  drawPoly3D(ctx, camera, plateOuter, '#222428', 'rgba(215, 210, 200, 0.32)', 1.1);
  drawTexturedQuad3D(
    ctx,
    camera,
    [
      [0.15, slopeY(0.15) + 0.026, -5.49],
      [0.15, slopeY(0.15) + 0.026, -7.07],
      [1.40, slopeY(1.40) + 0.026, -7.07],
      [1.40, slopeY(1.40) + 0.026, -5.49],
    ],
    textures.mineralPlateRight,
    5,
    4
  );
}
