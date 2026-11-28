/**
 * 16 Individually Seeded Procedural Translucent Agate Slices (`agates.js`).
 *
 * Arranged in 3 staggered rows (5 + 6 + 5 = 16 slices) inside the backlit black-lacquer display wall,
 * faithful to `reference-0.png`:
 *   - Irregular organic contours (outer dimensions 0.55–1.15m) with rough volcanic crustal rinds
 *   - Narrow matte-black specimen rim & 3D oblique slice thickness
 *   - Clear acrylic shelf ledges & transparent acrylic display prongs (`透明托脚`) with clear negative space
 *   - Procedural concentric fortification bands, radiating plume feathers, and fractal dendritic manganese trees
 *   - Separate base + transmittance glow baking so `#backlight-intensity` (`20%–100%`) dynamically shifts
 *     internal mineral translucency and inclusion contrast without altering room lighting
 *   - Exact projected 2D polygon click hit-testing (rejecting negative-space gaps) + contour-fitted spotlight
 */

import { mulberry32, clamp, lerp } from './state.js';
import { drawPoly3D, drawLine3D, pointInPoly2D, polygonBounds2D } from './projection25d.js';

/**
 * Curated specification for all 16 agate slices matching the visual rhythm of `reference-0.png`.
 * World coords sit on the backlit cabinet plane X = 0.085, Z in [-7.05, -0.15], Y in [1.24, 3.10].
 */
export const AGATE_SPECS = [
  // ==================== ROW 1 (Top Row — 5 slices) ====================
  {
    id: 0, code: 'AG-01', row: 0,
    z: -0.78, y: 2.78, width: 1.15, height: 0.62,
    patternType: 'plume', patternZh: '羽状纹', patternEn: 'Plume Agate',
    nameZh: '白羽琥珀玛瑙', nameEn: 'Silvery Feather Plume Agate',
    localityZh: '辽宁 · 阜新', localityEn: 'Fuxin, Liaoning',
    noteZh: '深褐火山皮壳包裹炽热琥珀边带，中央盛开扇状银白矿物羽丝。',
    seed: 1011,
    palette: { rim: '#df7d24', mid: '#9c5432', core: '#56434b', glow: '#ffc26e', plume: '#efe7dc' },
    shapeHarmonics: [0.09, -0.05, 0.06, 0.03, -0.04],
  },
  {
    id: 1, code: 'AG-02', row: 0,
    z: -2.02, y: 2.77, width: 0.86, height: 0.59,
    patternType: 'dendritic', patternZh: '树枝纹', patternEn: 'Dendritic Agate',
    nameZh: '金丝灌木水草玛瑙', nameEn: 'Golden Thicket Dendritic Agate',
    localityZh: '辽宁 · 阜新', localityEn: 'Fuxin, Liaoning',
    noteZh: '暖黄半透明玉髓基底中密生深褐锰质枝状结晶，边缘带铁锈皮壳。',
    seed: 1029,
    palette: { rim: '#cf7c22', mid: '#e8c47c', core: '#faf0d6', glow: '#ffe4a2', ink: '#1f140c' },
    shapeHarmonics: [-0.07, 0.08, -0.04, 0.05, 0.03],
  },
  {
    id: 2, code: 'AG-03', row: 0,
    z: -3.28, y: 2.77, width: 1.04, height: 0.59,
    patternType: 'plume', patternZh: '羽状纹', patternEn: 'Plume Agate',
    nameZh: '赤枫金羽玛瑙', nameEn: 'Russet Maple Plume Agate',
    localityZh: '内蒙古 · 阿拉善', localityEn: 'Alxa, Inner Mongolia',
    noteZh: '外环呈乳白灰蓝同心玉髓，核心簇生赤褐羽状铁质包裹体。',
    seed: 1047,
    palette: { rim: '#d67828', mid: '#d6cfc4', core: '#f2ece0', glow: '#ffdda4', plume: '#7d3b16' },
    shapeHarmonics: [0.06, 0.07, 0.05, -0.04, 0.04],
  },
  {
    id: 3, code: 'AG-04', row: 0,
    z: -4.68, y: 2.76, width: 1.00, height: 0.55,
    patternType: 'dendritic', patternZh: '树枝纹', patternEn: 'Dendritic Agate',
    nameZh: '雾岚孤松树枝玛瑙', nameEn: 'Misty Solitary Pine Agate',
    localityZh: '新疆 · 阿勒泰', localityEn: 'Altay, Xinjiang',
    noteZh: '乳白微灰半透明玉髓中斜展一枝清雅黑锰松羽，意境空灵。',
    seed: 1063,
    palette: { rim: '#b25e32', mid: '#dfd8cf', core: '#f5f0e8', glow: '#fff2dc', ink: '#241b14' },
    shapeHarmonics: [0.05, -0.08, 0.03, 0.04, -0.03],
  },
  {
    id: 4, code: 'AG-05', row: 0,
    z: -6.12, y: 2.75, width: 0.86, height: 0.53,
    patternType: 'concentric', patternZh: '同心纹', patternEn: 'Concentric Agate',
    nameZh: '霜心晶洞眼纹玛瑙', nameEn: 'Frost-Core Geode Eye Agate',
    localityZh: '黑龙江 · 逊克', localityEn: 'Xunke, Heilongjiang',
    noteZh: '粗粝火山皮壳内呈深苔藓环带，中央为高透石英晶洞白心。',
    seed: 1087,
    palette: { rim: '#a87034', mid: '#564c42', core: '#faf6ec', glow: '#fff4d6', accent: '#26231e' },
    shapeHarmonics: [-0.05, 0.04, 0.07, -0.03, 0.04],
  },

  // ===================== ROW 2 (Middle Staggered Row — 6 slices) =====================
  {
    id: 5, code: 'AG-06', row: 1,
    z: -0.22, y: 2.13, width: 0.76, height: 0.61,
    patternType: 'concentric', patternZh: '同心纹', patternEn: 'Concentric Agate',
    nameZh: '焦糖城堡同心玛瑙', nameEn: 'Caramel Fortification Agate',
    localityZh: '云南 · 保山', localityEn: 'Baoshan, Yunnan',
    noteZh: '琥珀、乳白与深炭灰环带交替叠压，呈经典折角城堡状节律。',
    seed: 2017,
    palette: { rim: '#cc6e1c', mid: '#ded5c9', core: '#545058', glow: '#ffca7a', accent: '#281a12' },
    shapeHarmonics: [0.04, 0.06, -0.05, 0.04, 0.03],
  },
  {
    id: 6, code: 'AG-07', row: 1,
    z: -1.32, y: 2.14, width: 0.92, height: 0.61,
    patternType: 'dendritic', patternZh: '树枝纹', patternEn: 'Dendritic Agate',
    nameZh: '寒林古树水草玛瑙', nameEn: 'Winter Canopy Dendritic Agate',
    localityZh: '辽宁 · 阜新', localityEn: 'Fuxin, Liaoning',
    noteZh: '高透月白玉髓背光如琉璃灯盏，墨黑氧化锰结晶勾勒挺拔古树。',
    seed: 2039,
    palette: { rim: '#9f876a', mid: '#e0e1e3', core: '#faf7f0', glow: '#fff6e0', ink: '#161513' },
    shapeHarmonics: [-0.06, 0.07, 0.04, -0.05, 0.03],
  },
  {
    id: 7, code: 'AG-08', row: 1,
    z: -2.56, y: 2.14, width: 1.02, height: 0.60,
    patternType: 'plume', patternZh: '羽状纹', patternEn: 'Plume Agate',
    nameZh: '霞光赤羽火焰玛瑙', nameEn: 'Rosy Glow Plume Agate',
    localityZh: '河北 · 宣化', localityEn: 'Xuanhua, Hebei',
    noteZh: '暖橘与浅灰蓝半透明基质中升腾赤红烟云状羽纹，背光层次丰沛。',
    seed: 2063,
    palette: { rim: '#cf5a22', mid: '#decbc0', core: '#f4eae0', glow: '#ffc280', plume: '#743624' },
    shapeHarmonics: [0.07, -0.04, 0.05, 0.04, -0.03],
  },
  {
    id: 8, code: 'AG-09', row: 1,
    z: -3.86, y: 2.14, width: 0.92, height: 0.57,
    patternType: 'concentric', patternZh: '同心纹', patternEn: 'Concentric Agate',
    nameZh: '暖橙穹顶缠丝玛瑙', nameEn: 'Amber Dome Banded Agate',
    localityZh: '内蒙古 · 阿拉善', localityEn: 'Alxa, Inner Mongolia',
    noteZh: '浓烈橙红宽带包覆细密紫灰缠丝同心环，硅质沉淀脉络清晰。',
    seed: 2089,
    palette: { rim: '#e07220', mid: '#e8d8c9', core: '#8a797e', glow: '#ffc06e', accent: '#683214' },
    shapeHarmonics: [0.05, 0.06, -0.03, 0.05, -0.04],
  },
  {
    id: 9, code: 'AG-10', row: 1,
    z: -5.04, y: 2.11, width: 0.68, height: 0.47,
    patternType: 'concentric', patternZh: '同心纹', patternEn: 'Concentric Agate',
    nameZh: '古铜瞳孔天眼玛瑙', nameEn: 'Bronze Ocellar Eye Agate',
    localityZh: '四川 · 凉山', localityEn: 'Liangshan, Sichuan',
    noteZh: '小巧浑圆的原生晶核，深棕与乳白同心圆构成明晰天眼纹理。',
    seed: 2111,
    palette: { rim: '#946c3c', mid: '#d2be9c', core: '#382a1e', glow: '#f8d89c', accent: '#503820' },
    shapeHarmonics: [-0.04, 0.05, 0.04, -0.03, 0.02],
  },
  {
    id: 10, code: 'AG-11', row: 1,
    z: -6.14, y: 2.13, width: 0.88, height: 0.54,
    patternType: 'dendritic', patternZh: '树枝纹', patternEn: 'Dendritic Agate',
    nameZh: '密林墨影树枝玛瑙', nameEn: 'Dense Grove Dendritic Agate',
    localityZh: '江苏 · 南京', localityEn: 'Nanjing, Jiangsu',
    noteZh: '温润象牙白玉髓底部丛生密集深褐蕨叶状锰晶，宛若水墨山林。',
    seed: 2137,
    palette: { rim: '#987246', mid: '#e2d8c4', core: '#f6ede0', glow: '#ffedc2', ink: '#1b1510' },
    shapeHarmonics: [0.06, -0.05, 0.06, 0.03, -0.04],
  },

  // ===================== ROW 3 (Bottom Row — 5 slices) =====================
  {
    id: 11, code: 'AG-12', row: 2,
    z: -0.68, y: 1.51, width: 0.96, height: 0.61,
    patternType: 'dendritic', patternZh: '树枝纹', patternEn: 'Dendritic Agate',
    nameZh: '秋阳古蕨树枝玛瑙', nameEn: 'Sunlit Fern Dendritic Agate',
    localityZh: '辽宁 · 阜新', localityEn: 'Fuxin, Liaoning',
    noteZh: '大尺寸高透蜜黄切片，中央舒展辐射状墨黑树枝结晶，层次锐利。',
    seed: 3011,
    palette: { rim: '#d67822', mid: '#eedec4', core: '#faf2e2', glow: '#ffe2a2', ink: '#1a130e' },
    shapeHarmonics: [-0.06, 0.08, 0.05, -0.04, 0.03],
  },
  {
    id: 12, code: 'AG-13', row: 2,
    z: -1.96, y: 1.51, width: 1.15, height: 0.60,
    patternType: 'concentric', patternZh: '同心纹', patternEn: 'Concentric Agate',
    nameZh: '流云双核同心玛瑙', nameEn: 'Twin-Heart Fortification Agate',
    localityZh: '黑龙江 · 逊克', localityEn: 'Xunke, Heilongjiang',
    noteZh: '肾形宽幅典范标本，焦糖橙外圈内嵌连绵乳白与青灰双核同心带。',
    seed: 3037,
    palette: { rim: '#e0761c', mid: '#f2eadc', core: '#686266', glow: '#ffcd7e', accent: '#423328' },
    shapeHarmonics: [0.10, 0.06, -0.05, 0.05, -0.03],
  },
  {
    id: 13, code: 'AG-14', row: 2,
    z: -3.40, y: 1.52, width: 1.02, height: 0.61,
    patternType: 'concentric', patternZh: '同心纹', patternEn: 'Concentric Agate',
    nameZh: '赤虹拱门缠丝玛瑙', nameEn: 'Crimson Arch Banded Agate',
    localityZh: '云南 · 保山', localityEn: 'Baoshan, Yunnan',
    noteZh: '厚重深褐火山岩皮壳下绽放明亮橘红双圈色带与高透乳白中心。',
    seed: 3061,
    palette: { rim: '#dc5d1a', mid: '#f8eee0', core: '#ecdac4', glow: '#ffbe68', accent: '#8e3012' },
    shapeHarmonics: [0.05, -0.07, 0.04, 0.05, -0.03],
  },
  {
    id: 14, code: 'AG-15', row: 2,
    z: -4.82, y: 1.51, width: 0.92, height: 0.54,
    patternType: 'dendritic', patternZh: '树枝纹', patternEn: 'Dendritic Agate',
    nameZh: '暮色松林景致玛瑙', nameEn: 'Twilight Pine-Ridge Agate',
    localityZh: '内蒙古 · 阿拉善', localityEn: 'Alxa, Inner Mongolia',
    noteZh: '下方琥珀地平线托起成排直立黑锰松林剪影，构成天然风景画。',
    seed: 3089,
    palette: { rim: '#cf7824', mid: '#d0cdcb', core: '#eceae8', glow: '#ffd996', ink: '#1a1715' },
    shapeHarmonics: [0.06, 0.05, -0.04, 0.04, 0.03],
  },
  {
    id: 15, code: 'AG-16', row: 2,
    z: -6.12, y: 1.52, width: 0.86, height: 0.56,
    patternType: 'concentric', patternZh: '同心纹', patternEn: 'Concentric Agate',
    nameZh: '紫烟峡谷晶洞玛瑙', nameEn: 'Smoky Canyon Geode Agate',
    localityZh: '河北 · 宣化', localityEn: 'Xuanhua, Hebei',
    noteZh: '锯齿状多边形紫灰、暖橙与雪白缠丝环带紧密嵌套，地质节律鲜明。',
    seed: 3119,
    palette: { rim: '#cc7026', mid: '#bfb1ac', core: '#3e3336', glow: '#ffca80', accent: '#241b1e' },
    shapeHarmonics: [-0.07, 0.05, 0.08, -0.04, 0.04],
  },
];

/**
 * Generates an irregular organic closed polygon in normalized local coordinates `[-1, 1]^2`.
 */
function buildOrganicContourLocal(spec, count = 64) {
  const rand = mulberry32(spec.seed * 7 + 13);
  const phases = [rand() * 6.28, rand() * 6.28, rand() * 6.28, rand() * 6.28, rand() * 6.28];
  const h = spec.shapeHarmonics;
  const pts = [];

  for (let i = 0; i < count; i += 1) {
    const a = (i / count) * Math.PI * 2;
    let r = 0.84;
    r += h[0] * Math.cos(2 * a + phases[0]);
    r += h[1] * Math.sin(3 * a + phases[1]);
    r += h[2] * Math.cos(4 * a + phases[2]);
    r += h[3] * Math.sin(5 * a + phases[3]);
    r += h[4] * Math.cos(7 * a + phases[4]);
    // Fine volcanic bark micro-roughness along outer crust
    const bark = (Math.sin(13 * a + phases[1]) * 0.015) + (Math.cos(19 * a + phases[3]) * 0.011);
    r = clamp(r + bark, 0.58, 0.96);

    // Slight flatter base so slice sits naturally in its acrylic museum cradle
    let ny = Math.sin(a) * r;
    if (ny > 0.56) {
      ny = 0.56 + (ny - 0.56) * 0.62;
    }
    const nx = Math.cos(a) * r;
    pts.push({ x: nx, y: ny });
  }
  return pts;
}

/**
 * Draws a scaled inward version of the organic contour path.
 */
function traceScaledContour(ctx, contour, cx, cy, sx, sy, scale, wobbleAmp = 0, wobbleSeed = 0) {
  ctx.beginPath();
  for (let i = 0; i < contour.length; i += 1) {
    const p = contour[i];
    const w = wobbleAmp > 0 ? 1 + wobbleAmp * Math.sin(i * 0.55 + wobbleSeed) : 1;
    const x = cx + p.x * sx * scale * w;
    const y = cy + p.y * sy * scale * w;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

/**
 * Recursive fractal manganese dendrite branch painter.
 */
function drawDendriteBranch(ctx, x, y, angle, length, width, depth, rand, inkColor) {
  if (depth <= 0 || length < 2.2) return;
  const ex = x + Math.cos(angle) * length;
  const ey = y + Math.sin(angle) * length;

  ctx.strokeStyle = inkColor;
  ctx.lineWidth = Math.max(0.65, width);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x, y);
  const mx = (x + ex) * 0.5 + (rand() - 0.5) * length * 0.22;
  const my = (y + ey) * 0.5 + (rand() - 0.5) * length * 0.22;
  ctx.quadraticCurveTo(mx, my, ex, ey);
  ctx.stroke();

  // Tiny moss cluster nodes along outer twigs
  if (depth <= 2) {
    ctx.fillStyle = inkColor;
    for (let k = 0; k < 2; k += 1) {
      const t = 0.4 + rand() * 0.6;
      ctx.beginPath();
      ctx.arc(lerp(x, ex, t) + (rand() - 0.5) * 3, lerp(y, ey, t) + (rand() - 0.5) * 3, 1.1 + rand() * 1.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const branches = depth >= 4 ? 3 : 2;
  for (let b = 0; b < branches; b += 1) {
    const spread = (b - (branches - 1) * 0.5) * (0.62 + rand() * 0.34) + (rand() - 0.5) * 0.24;
    const nextLen = length * (0.62 + rand() * 0.18);
    drawDendriteBranch(ctx, ex, ey, angle + spread, nextLen, width * 0.68, depth - 1, rand, inkColor);
  }
  // Occasional mid-stem side shoot
  if (depth >= 3 && rand() > 0.32) {
    const t = 0.45 + rand() * 0.25;
    const sx = lerp(x, ex, t);
    const sy = lerp(y, ey, t);
    const side = rand() > 0.5 ? 1 : -1;
    drawDendriteBranch(ctx, sx, sy, angle + side * (0.55 + rand() * 0.45), length * 0.58, width * 0.6, depth - 2, rand, inkColor);
  }
}

/**
 * Radiating mineral feather plume painter (`羽状纹`).
 */
function drawPlumeCluster(ctx, cx, cy, radius, spec, rand) {
  const plumeCol = spec.palette.plume || '#e8ddd0';
  const fronds = 22 + Math.floor(rand() * 12);
  ctx.save();
  for (let i = 0; i < fronds; i += 1) {
    const baseAngle = -Math.PI * 0.92 + (i / (fronds - 1)) * Math.PI * 0.84 + (rand() - 0.5) * 0.14;
    const len = radius * (0.48 + rand() * 0.52);
    const ox = cx + (rand() - 0.5) * radius * 0.35;
    const oy = cy + radius * 0.36 + (rand() - 0.5) * radius * 0.14;
    const ex = ox + Math.cos(baseAngle) * len;
    const ey = oy + Math.sin(baseAngle) * len;
    const ctrlX = (ox + ex) * 0.5 + (rand() - 0.5) * 18;
    const ctrlY = (oy + ey) * 0.5 - 8;

    ctx.strokeStyle = plumeCol;
    ctx.globalAlpha = 0.45 + rand() * 0.38;
    ctx.lineWidth = 1.6 + rand() * 1.6;
    ctx.beginPath();
    ctx.moveTo(ox, oy);
    ctx.quadraticCurveTo(ctrlX, ctrlY, ex, ey);
    ctx.stroke();

    // Feathered lateral barbs along each plume stem
    const barbCount = 8 + Math.floor(rand() * 7);
    for (let b = 1; b <= barbCount; b += 1) {
      const t = b / (barbCount + 1);
      const bx = (1 - t) * (1 - t) * ox + 2 * (1 - t) * t * ctrlX + t * t * ex;
      const by = (1 - t) * (1 - t) * oy + 2 * (1 - t) * t * ctrlY + t * t * ey;
      const barbLen = (1 - t * 0.55) * (9 + rand() * 11);
      for (const sgn of [-1, 1]) {
        const ba = baseAngle + sgn * (0.42 + rand() * 0.22);
        ctx.lineWidth = 0.95;
        ctx.globalAlpha = 0.32 + rand() * 0.36;
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.lineTo(bx + Math.cos(ba) * barbLen, by + Math.sin(ba) * barbLen);
        ctx.stroke();
      }
    }
  }
  ctx.restore();
}

/**
 * Bakes high-resolution procedural `baseCanvas` (mineral matter, rind, bands, inclusions)
 * and `glowCanvas` (backlit quartz transmittance map) for one agate slice.
 */
function bakeAgateSprites(spec, contour) {
  const size = 320;
  const cx = size * 0.5;
  const cy = size * 0.5;
  const sx = size * 0.48;
  const sy = size * 0.48;

  const baseCanvas = document.createElement('canvas');
  baseCanvas.width = size;
  baseCanvas.height = size;
  const ctx = baseCanvas.getContext('2d');

  const glowCanvas = document.createElement('canvas');
  glowCanvas.width = size;
  glowCanvas.height = size;
  const gctx = glowCanvas.getContext('2d');

  const rand = mulberry32(spec.seed);

  // ==================== 1) BASE MINERAL LAYER ====================
  ctx.save();
  traceScaledContour(ctx, contour, cx, cy, sx, sy, 1.0);
  ctx.clip();

  // Outer rough volcanic basalt/rhyolite rind
  const rindGrad = ctx.createRadialGradient(cx, cy, size * 0.25, cx, cy, size * 0.5);
  rindGrad.addColorStop(0, '#5a412c');
  rindGrad.addColorStop(0.76, '#463324');
  rindGrad.addColorStop(0.92, '#2d2219');
  rindGrad.addColorStop(1.0, '#191410');
  ctx.fillStyle = rindGrad;
  ctx.fillRect(0, 0, size, size);

  // Mottled rough volcanic bark speckles around the outer crust
  for (let i = 0; i < 260; i += 1) {
    const a = rand() * Math.PI * 2;
    const rad = 0.78 + rand() * 0.21;
    const rx = cx + Math.cos(a) * sx * rad;
    const ry = cy + Math.sin(a) * sy * rad;
    ctx.fillStyle = rand() > 0.48 ? 'rgba(138, 108, 76, 0.36)' : 'rgba(20, 15, 11, 0.52)';
    ctx.beginPath();
    ctx.arc(rx, ry, 2 + rand() * 5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Translucent inner chalcedony body clipped inside the rough rind
  ctx.save();
  traceScaledContour(ctx, contour, cx, cy, sx, sy, 0.89, 0.025, spec.seed);
  ctx.clip();

  const innerGrad = ctx.createRadialGradient(cx - 10, cy - 8, 8, cx, cy, size * 0.44);
  innerGrad.addColorStop(0.0, spec.palette.core);
  innerGrad.addColorStop(0.55, spec.palette.mid);
  innerGrad.addColorStop(0.84, spec.palette.rim);
  innerGrad.addColorStop(1.0, '#6a2e0e');
  ctx.fillStyle = innerGrad;
  ctx.fillRect(0, 0, size, size);

  // Outer amber fortification border rings (present across nearly all real volcanic agates)
  const rimBands = [
    { sc: 0.87, col: 'rgba(105, 42, 12, 0.75)', lw: 8 },
    { sc: 0.83, col: spec.palette.rim, lw: 7 },
    { sc: 0.78, col: 'rgba(255, 224, 174, 0.65)', lw: 4 },
    { sc: 0.74, col: 'rgba(154, 72, 24, 0.45)', lw: 3.5 },
  ];
  for (const b of rimBands) {
    traceScaledContour(ctx, contour, cx, cy, sx, sy, b.sc, 0.02, spec.seed + b.sc * 20);
    ctx.strokeStyle = b.col;
    ctx.lineWidth = b.lw;
    ctx.stroke();
  }

  // Pattern-specific mineral internals
  if (spec.patternType === 'concentric') {
    const ringCount = 19;
    const bandColors = [
      spec.palette.rim,
      '#f4ece0',
      spec.palette.accent || '#48382e',
      spec.palette.mid,
      '#df9750',
      '#fcf6ec',
      '#6c6266',
      '#c77936',
    ];
    for (let k = 0; k < ringCount; k += 1) {
      const sc = lerp(0.71, 0.08, k / (ringCount - 1));
      const wobble = 0.032 * (1 - k / ringCount) + 0.012;
      traceScaledContour(ctx, contour, cx + (spec.id === 12 ? -14 : 0), cy + 2, sx, sy, sc, wobble, spec.seed + k * 0.7);
      ctx.strokeStyle = bandColors[k % bandColors.length];
      ctx.lineWidth = 2.6 + (k % 3 === 0 ? 3.2 : 1.2);
      ctx.globalAlpha = 0.72 + (k % 2) * 0.20;
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // Twin heart swirl for hero slice #12
    if (spec.id === 12) {
      for (let k = 0; k < 8; k += 1) {
        const sc = lerp(0.32, 0.06, k / 7);
        traceScaledContour(ctx, contour, cx + 44, cy - 8, sx * 0.55, sy * 0.62, sc, 0.04, spec.seed + k);
        ctx.strokeStyle = k % 2 === 0 ? '#5c5256' : '#f4eee2';
        ctx.lineWidth = 2.4;
        ctx.stroke();
      }
    }

    // Bright druzy crystalline quartz center
    const coreG = ctx.createRadialGradient(cx, cy, 2, cx, cy, 34);
    coreG.addColorStop(0, 'rgba(255, 250, 240, 0.85)');
    coreG.addColorStop(0.55, 'rgba(218, 206, 194, 0.35)');
    coreG.addColorStop(1, 'rgba(218, 206, 194, 0.0)');
    ctx.fillStyle = coreG;
    ctx.beginPath();
    ctx.arc(cx, cy, 34, 0, Math.PI * 2);
    ctx.fill();
  } else if (spec.patternType === 'plume') {
    // Soft smoky chalcedony clouds inside cavity
    for (let c = 0; c < 18; c += 1) {
      const px = cx + (rand() - 0.5) * 140;
      const py = cy + (rand() - 0.5) * 110;
      const pr = 22 + rand() * 44;
      const cg = ctx.createRadialGradient(px, py, 2, px, py, pr);
      cg.addColorStop(0, spec.id === 0 ? 'rgba(92, 66, 74, 0.42)' : 'rgba(176, 118, 86, 0.34)');
      cg.addColorStop(1, 'rgba(92, 66, 74, 0.0)');
      ctx.fillStyle = cg;
      ctx.beginPath();
      ctx.arc(px, py, pr, 0, Math.PI * 2);
      ctx.fill();
    }
    drawPlumeCluster(ctx, cx, cy + 6, 118, spec, rand);
    if (spec.id === 7) {
      drawPlumeCluster(ctx, cx - 36, cy + 16, 74, spec, rand);
      drawPlumeCluster(ctx, cx + 44, cy + 12, 82, spec, rand);
    }
  } else if (spec.patternType === 'dendritic') {
    // Pale misty chalcedony clouds
    for (let c = 0; c < 14; c += 1) {
      const px = cx + (rand() - 0.5) * 140;
      const py = cy + (rand() - 0.5) * 110;
      const pr = 28 + rand() * 48;
      const cg = ctx.createRadialGradient(px, py, 4, px, py, pr);
      cg.addColorStop(0, 'rgba(255, 248, 234, 0.45)');
      cg.addColorStop(1, 'rgba(255, 248, 234, 0.0)');
      ctx.fillStyle = cg;
      ctx.beginPath();
      ctx.arc(px, py, pr, 0, Math.PI * 2);
      ctx.fill();
    }

    const ink = spec.palette.ink || '#221b15';
    if (spec.id === 14) {
      // Landscape pine-forest silhouette along amber floor
      for (let t = 0; t < 11; t += 1) {
        const tx = cx - 94 + t * 19 + (rand() - 0.5) * 6;
        const ty = cy + 66;
        const hLen = 28 + rand() * 34;
        drawDendriteBranch(ctx, tx, ty, -Math.PI * 0.5 + (rand() - 0.5) * 0.16, hLen, 2.4, 4, rand, ink);
      }
    } else if (spec.id === 3) {
      // Diagonal single graceful frond
      drawDendriteBranch(ctx, cx + 42, cy + 56, -Math.PI * 0.72, 46, 3.0, 5, rand, ink);
    } else if (spec.id === 6 || spec.id === 11) {
      // Iconic solitary museum botanical tree dendrite!
      drawDendriteBranch(ctx, cx - 4, cy + 88, -Math.PI * 0.50, 48, 4.4, 5, rand, ink);
      drawDendriteBranch(ctx, cx + 28, cy + 78, -Math.PI * 0.40, 34, 3.0, 4, rand, ink);
      drawDendriteBranch(ctx, cx - 34, cy + 78, -Math.PI * 0.62, 32, 2.8, 4, rand, ink);
    } else {
      // Multi-cluster thicket dendrites
      const roots = 5 + Math.floor(rand() * 3);
      for (let r = 0; r < roots; r += 1) {
        const rx = cx + (rand() - 0.5) * 116;
        const ry = cy + 48 + rand() * 36;
        const ang = -Math.PI * 0.5 + (rand() - 0.5) * 0.7;
        drawDendriteBranch(ctx, rx, ry, ang, 30 + rand() * 20, 2.8, 4, rand, ink);
      }
    }
  }

  // Subtle polished agate slab glass sheen
  const sheen = ctx.createLinearGradient(cx - 110, cy - 110, cx + 90, cy + 90);
  sheen.addColorStop(0.0, 'rgba(255, 255, 255, 0.18)');
  sheen.addColorStop(0.32, 'rgba(255, 255, 255, 0.03)');
  sheen.addColorStop(0.65, 'rgba(255, 255, 255, 0.0)');
  sheen.addColorStop(1.0, 'rgba(255, 232, 194, 0.09)');
  ctx.fillStyle = sheen;
  ctx.fillRect(0, 0, size, size);

  ctx.restore(); // end inner chalcedony clip
  ctx.restore(); // end outer contour clip

  // Narrow matte-black museum specimen mounting rim (`黑色窄边框`)
  traceScaledContour(ctx, contour, cx, cy, sx, sy, 0.992);
  ctx.strokeStyle = '#111215';
  ctx.lineWidth = 4.2;
  ctx.stroke();

  // ==================== 2) BACKLIT TRANSMITTANCE GLOW MAP ====================
  gctx.save();
  traceScaledContour(gctx, contour, cx, cy, sx, sy, 0.88, 0.02, spec.seed);
  gctx.clip();

  const glowG = gctx.createRadialGradient(cx, cy, 8, cx, cy, size * 0.44);
  if (spec.patternType === 'dendritic') {
    glowG.addColorStop(0.0, 'rgba(255, 250, 234, 0.95)');
    glowG.addColorStop(0.66, 'rgba(255, 224, 162, 0.78)');
    glowG.addColorStop(0.90, spec.palette.glow || 'rgba(255, 175, 84, 0.62)');
    glowG.addColorStop(1.0, 'rgba(180, 72, 12, 0.08)');
  } else {
    glowG.addColorStop(0.0, 'rgba(255, 240, 206, 0.72)');
    glowG.addColorStop(0.58, 'rgba(255, 202, 122, 0.68)');
    glowG.addColorStop(0.88, 'rgba(255, 152, 54, 0.85)');
    glowG.addColorStop(1.0, 'rgba(160, 56, 8, 0.12)');
  }
  gctx.fillStyle = glowG;
  gctx.fillRect(0, 0, size, size);

  // Subtle luminous inner translucent rings for glowing fortification contrast
  for (let b = 0; b < 4; b += 1) {
    traceScaledContour(gctx, contour, cx, cy, sx, sy, 0.82 - b * 0.14, 0.025, spec.seed + b * 4);
    gctx.strokeStyle = b === 0 ? 'rgba(255, 198, 102, 0.75)' : 'rgba(255, 244, 214, 0.35)';
    gctx.lineWidth = b === 0 ? 7 : 3;
    gctx.stroke();
  }
  gctx.restore();

  return { baseCanvas, glowCanvas, size };
}

/**
 * Initializes all 16 agate slice objects with 3D world contours and baked procedural textures.
 */
export function createAgateCollection() {
  const X_PLANE = 0.095;
  const SLICE_THICK = 0.036;

  return AGATE_SPECS.map(spec => {
    const contourLocal = buildOrganicContourLocal(spec, 64);
    const halfW = spec.width * 0.5;
    const halfH = spec.height * 0.5;

    // 3D front contour on cabinet mounting plane X = X_PLANE
    const contour3dFront = contourLocal.map(p => [
      X_PLANE + SLICE_THICK,
      spec.y - p.y * halfH,
      spec.z - p.x * halfW,
    ]);
    // 3D back contour resting near acrylic panel
    const contour3dBack = contourLocal.map(p => [
      X_PLANE,
      spec.y - p.y * halfH,
      spec.z - p.x * halfW,
    ]);

    // 3D quad bounding the baked sprite [TL, TR, BR, BL]
    const quad3d = [
      [X_PLANE + SLICE_THICK, spec.y + halfH, spec.z + halfW],
      [X_PLANE + SLICE_THICK, spec.y + halfH, spec.z - halfW],
      [X_PLANE + SLICE_THICK, spec.y - halfH, spec.z - halfW],
      [X_PLANE + SLICE_THICK, spec.y - halfH, spec.z + halfW],
    ];

    // Clear acrylic mounting prongs under bottom edge (`透明托脚`)
    const standY = spec.y - halfH * 0.74;
    const prongSpan = halfW * 0.42;

    const sprites = bakeAgateSprites(spec, contourLocal);
    return {
      ...spec,
      xPlane: X_PLANE,
      thickness: SLICE_THICK,
      standY,
      prongSpan,
      contourLocal,
      contour3dFront,
      contour3dBack,
      quad3d,
      sprites,
      lastProjectedPoly: [],
      lastProjectedBounds: null,
    };
  });
}

/**
 * Draws the 3 clear acrylic horizontal museum display ledges spanning the backlit wall.
 */
export function renderAcrylicShelfRails(ctx, camera, backlightIntensityPct) {
  const norm = clamp((backlightIntensityPct - 20) / 80, 0, 1);
  const railYs = [2.46, 1.82, 1.21];
  for (let i = 0; i < railYs.length; i += 1) {
    const y = railYs[i];
    const topQuad = [
      [0.01, y, -0.15],
      [0.01, y, -7.08],
      [0.24, y, -7.08],
      [0.24, y, -0.15],
    ];
    const edgeQuad = [
      [0.24, y, -0.15],
      [0.24, y, -7.08],
      [0.24, y - 0.022, -7.08],
      [0.24, y - 0.022, -0.15],
    ];
    drawPoly3D(ctx, camera, topQuad, `rgba(255, 250, 238, ${(0.18 + norm * 0.16).toFixed(3)})`);
    drawPoly3D(
      ctx,
      camera,
      edgeQuad,
      `rgba(248, 250, 255, ${(0.34 + norm * 0.24).toFixed(3)})`,
      `rgba(255, 255, 255, ${(0.28 + norm * 0.22).toFixed(3)})`,
      0.8
    );
  }
}

/**
 * Draws one projected agate slice through `camera.project`, updating `slice.lastProjectedPoly`
 * for exact contour-fitted hit-testing and selection spotlighting.
 */
function renderSingleAgateSlice(ctx, camera, slice, backlightNorm, isSelected, selectionWeight, isHovered, macroSweepBoost) {
  const projFront = camera.projectPoly(slice.contour3dFront);
  const projBack = camera.projectPoly(slice.contour3dBack);
  const qTL = camera.project(slice.quad3d[0][0], slice.quad3d[0][1], slice.quad3d[0][2]);
  const qTR = camera.project(slice.quad3d[1][0], slice.quad3d[1][1], slice.quad3d[1][2]);
  const qBL = camera.project(slice.quad3d[3][0], slice.quad3d[3][1], slice.quad3d[3][2]);
  if (
    !projFront.visible ||
    !projBack.visible ||
    projFront.pts.length < 3 ||
    projBack.pts.length < 3 ||
    !qTL.visible ||
    !qTR.visible ||
    !qBL.visible
  ) {
    slice.lastProjectedPoly = [];
    slice.lastProjectedBounds = null;
    return;
  }

  slice.lastProjectedPoly = projFront.pts;
  slice.lastProjectedBounds = polygonBounds2D(projFront.pts);

  // 1) Soft contact shadow cast onto milky backlit panel behind the slice
  ctx.save();
  ctx.beginPath();
  for (let i = 0; i < projBack.pts.length; i += 1) {
    const p = projBack.pts[i];
    if (i === 0) ctx.moveTo(p.x - 4 * camera.scale, p.y + 7 * camera.scale);
    else ctx.lineTo(p.x - 4 * camera.scale, p.y + 7 * camera.scale);
  }
  ctx.closePath();
  ctx.fillStyle = `rgba(22, 16, 10, ${(0.18 + backlightNorm * 0.12).toFixed(3)})`;
  ctx.fill();
  ctx.restore();

  // 2) Contour-fitted backlit spotlight bloom behind selected slice (or subtle Act 2 macro spotlight)
  const spotEnergy = Math.max(selectionWeight, macroSweepBoost * 0.55);
  if (spotEnergy > 0.01 && slice.lastProjectedBounds) {
    const b = slice.lastProjectedBounds;
    const cx = (b.minX + b.maxX) * 0.5;
    const cy = (b.minY + b.maxY) * 0.5;
    const rad = Math.max(b.width, b.height) * 0.78;
    if (Number.isFinite(cx) && Number.isFinite(cy) && Number.isFinite(rad) && rad > 2 && rad < 4000) {
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      const halo = ctx.createRadialGradient(cx, cy, rad * 0.18, cx, cy, rad);
      halo.addColorStop(0.0, `rgba(255, 226, 152, ${(0.68 * spotEnergy).toFixed(3)})`);
      halo.addColorStop(0.55, `rgba(255, 192, 92, ${(0.34 * spotEnergy).toFixed(3)})`);
      halo.addColorStop(1.0, 'rgba(255, 170, 64, 0.0)');
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(cx, cy, rad, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  // 3) 3D oblique outer rind & narrow black mounting thickness extrusion between back & front contours
  ctx.save();
  ctx.beginPath();
  for (let i = 0; i < projBack.pts.length; i += 1) {
    const p = projBack.pts[i];
    if (i === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  }
  ctx.closePath();
  ctx.fillStyle = '#231b15';
  ctx.fill();
  ctx.strokeStyle = '#111113';
  ctx.lineWidth = Math.max(1.2, 2.2 * camera.scale);
  ctx.stroke();

  // Connect side thickness chords around the perimeter when both contours are unclipped (1:1 vertex match)
  if (
    projFront.pts.length === slice.contour3dFront.length &&
    projBack.pts.length === slice.contour3dBack.length
  ) {
    ctx.strokeStyle = '#382a1e';
    ctx.lineWidth = Math.max(1.0, 2.0 * camera.scale);
    for (let i = 0; i < projFront.pts.length; i += 4) {
      ctx.beginPath();
      ctx.moveTo(projBack.pts[i].x, projBack.pts[i].y);
      ctx.lineTo(projFront.pts[i].x, projFront.pts[i].y);
      ctx.stroke();
    }
  }
  ctx.restore();

  // 4) Map baked procedural agate texture cleanly onto the projected 3D plane (local Jacobian affine transform)
  const sz = slice.sprites.size;

  const ux = (qTR.x - qTL.x) / sz;
  const uy = (qTR.y - qTL.y) / sz;
  const vx = (qBL.x - qTL.x) / sz;
  const vy = (qBL.y - qTL.y) / sz;

  // Clip strictly to the exact projected 64-vertex organic contour
  ctx.save();
  ctx.beginPath();
  for (let i = 0; i < projFront.pts.length; i += 1) {
    const p = projFront.pts[i];
    if (i === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  }
  ctx.closePath();
  ctx.clip();

  // Dim slightly when backlight is low (20%) so high backlight (100%) dramatically increases translucency contrast
  ctx.save();
  ctx.transform(ux, uy, vx, vy, qTL.x, qTL.y);
  ctx.drawImage(slice.sprites.baseCanvas, 0, 0);

  // Darkening attenuation veil when backlight is low (strictly inside slice contour)
  const darkVeil = lerp(0.50, 0.0, backlightNorm) * (1 - selectionWeight * 0.72);
  if (darkVeil > 0.01) {
    ctx.fillStyle = `rgba(14, 11, 9, ${darkVeil.toFixed(3)})`;
    ctx.fillRect(0, 0, sz, sz);
  }

  // Transmitted backlight mineral glow modulated by `#backlight-intensity` + selection boost
  const glowAlpha = clamp(
    lerp(0.04, 0.56, Math.pow(backlightNorm, 1.12)) + selectionWeight * 0.42 + macroSweepBoost * 0.16,
    0,
    0.92
  );
  if (glowAlpha > 0.01) {
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = glowAlpha;
    ctx.drawImage(slice.sprites.glowCanvas, 0, 0);
  }
  ctx.restore();
  ctx.restore();

  // 5) Crisp narrow matte-black specimen rim border (`黑色窄边框`)
  ctx.save();
  ctx.beginPath();
  for (let i = 0; i < projFront.pts.length; i += 1) {
    const p = projFront.pts[i];
    if (i === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  }
  ctx.closePath();
  ctx.strokeStyle = isSelected ? '#ffcf76' : (isHovered ? 'rgba(255, 224, 160, 0.85)' : '#141315');
  ctx.lineWidth = isSelected
    ? Math.max(2.2, 3.8 * camera.scale * (0.7 + 0.3 * selectionWeight))
    : (isHovered ? Math.max(1.8, 2.6 * camera.scale) : Math.max(1.2, 2.0 * camera.scale));
  ctx.stroke();

  // Extra luminous contour-fitted inner rim highlight when selected
  if (selectionWeight > 0.02) {
    ctx.globalCompositeOperation = 'screen';
    ctx.strokeStyle = `rgba(255, 238, 186, ${(0.88 * selectionWeight).toFixed(3)})`;
    ctx.lineWidth = Math.max(3.0, 6.2 * camera.scale);
    ctx.stroke();
  }
  ctx.restore();

  // 6) Clear acrylic cradle prongs (`透明托脚`) reaching snugly up into the slice's lower edge
  const railY = slice.row === 0 ? 2.46 : (slice.row === 1 ? 1.82 : 1.21);
  const prongTopY = Math.max(railY + 0.085, slice.y - slice.height * 0.34);
  const prongZs = [slice.z + slice.prongSpan, slice.z - slice.prongSpan];
  for (let pIdx = 0; pIdx < prongZs.length; pIdx += 1) {
    const pz = prongZs[pIdx];
    const prongFoot = [
      [0.08, railY + 0.004, pz + 0.022],
      [0.08, railY + 0.004, pz - 0.022],
      [0.20, railY + 0.004, pz - 0.022],
      [0.20, railY + 0.004, pz + 0.022],
    ];
    const prongTab = [
      [0.155, railY + 0.004, pz + 0.018],
      [0.155, railY + 0.004, pz - 0.018],
      [0.145, prongTopY, pz - 0.014],
      [0.145, prongTopY, pz + 0.014],
    ];
    drawPoly3D(ctx, camera, prongFoot, 'rgba(248, 252, 255, 0.34)', 'rgba(255, 255, 255, 0.50)', 0.7);
    drawPoly3D(ctx, camera, prongTab, 'rgba(238, 246, 255, 0.28)', 'rgba(255, 255, 255, 0.62)', 0.9);
    drawLine3D(ctx, camera, [0.15, railY + 0.008, pz], [0.145, prongTopY - 0.004, pz], 'rgba(255, 255, 255, 0.72)', 1.1);
  }
}

/**
 * Renders all 16 depth-sorted procedural agate slices with clear negative space and acrylic stands.
 */
export function renderAgateWallSlices(ctx, camera, slices, state) {
  const backlightNorm = clamp((state.backlightIntensityPct - 20) / 80, 0, 1);

  // Draw horizontal transparent acrylic ledges first
  renderAcrylicShelfRails(ctx, camera, state.backlightIntensityPct);

  // Sort slices back-to-front by camera depth so oblique overlaps obey exact 3D occlusion
  const order = slices.map(slice => {
    const center = camera.project(slice.xPlane + slice.thickness * 0.5, slice.y, slice.z);
    return { slice, depth: center.depth };
  });
  order.sort((a, b) => b.depth - a.depth);

  // Act 2 subtle moving macro gallery spotlight highlight (only when user hasn't clicked a specific slice)
  const macroSpotZ = state.actIndex === 2 ? lerp(-0.9, -4.4, state.macroSpotlightPhase) : null;

  for (let i = 0; i < order.length; i += 1) {
    const slice = order[i].slice;
    const isSelected = state.selectedSliceId === slice.id;
    const selectionWeight = isSelected ? clamp(state.selectionProgress, 0, 1) : 0;
    const isHovered = state.hoverSliceId === slice.id;

    let macroSweepBoost = 0;
    if (macroSpotZ !== null && state.selectedSliceId === null) {
      const dz = Math.abs(slice.z - macroSpotZ);
      macroSweepBoost = clamp(1 - dz / 1.15, 0, 1) * 0.65;
    }

    renderSingleAgateSlice(
      ctx,
      camera,
      slice,
      backlightNorm,
      isSelected,
      selectionWeight,
      isHovered,
      macroSweepBoost
    );
  }
}

/**
 * Exact projected-polygon click hit-testing across all 16 agate slices.
 * Tests front-to-back in camera depth; returns null if click falls in negative-space gaps between slices!
 */
export function hitTestAgateSlices(slices, camera, canvasX, canvasY) {
  // Sort front-to-back (smallest depth first)
  const ordered = slices
    .filter(s => s.lastProjectedPoly && s.lastProjectedPoly.length >= 3)
    .map(s => ({
      slice: s,
      depth: camera.project(s.xPlane + s.thickness, s.y, s.z).depth,
    }))
    .sort((a, b) => a.depth - b.depth);

  for (let i = 0; i < ordered.length; i += 1) {
    const s = ordered[i].slice;
    const b = s.lastProjectedBounds;
    if (!b || canvasX < b.minX || canvasX > b.maxX || canvasY < b.minY || canvasY > b.maxY) {
      continue;
    }
    if (pointInPoly2D(canvasX, canvasY, s.lastProjectedPoly)) {
      return s;
    }
  }
  return null;
}
