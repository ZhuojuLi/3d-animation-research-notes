/**
 * Procedural Museum Graphic Plate & Map Texture Generators (`textures.js`).
 *
 * Pre-renders every signage wall panel, cabinet title band, pattern legend, sloped China agate
 * distribution map, and mineral graphic plate onto high-resolution offscreen canvases (deterministic seeds),
 * then perspective-maps them onto exact 3D quads via `projection25d.js -> drawTexturedQuad3D`.
 * This achieves crisp museum typography that truly obeys 3D oblique perspective foreshortening.
 */

import { mulberry32, fbm2D } from './state.js';

function makeOffscreen(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return { canvas: c, ctx: c.getContext('2d') };
}

/**
 * 1) Left Display Cabinet Upper Header Band: "玛瑙的多样纹理 / Agate Patterns" + curatorial text.
 */
function buildCabinetHeaderTexture() {
  const w = 1400;
  const h = 250;
  const { canvas, ctx } = makeOffscreen(w, h);

  // Matte black-charcoal lacquered backing with subtle museum brushed sheen
  const bg = ctx.createLinearGradient(0, 0, w, h);
  bg.addColorStop(0, '#171718');
  bg.addColorStop(0.5, '#1d1d1f');
  bg.addColorStop(1, '#121214');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  // Subtle horizontal brushed-metal hairlines
  ctx.fillStyle = 'rgba(255, 255, 255, 0.015)';
  for (let y = 0; y < h; y += 3) {
    ctx.fillRect(0, y, w, 1);
  }

  // Subtle warm-ivory gallery reflection vignette on the right half
  const refl = ctx.createRadialGradient(w * 0.72, h * 0.45, 20, w * 0.72, h * 0.45, 340);
  refl.addColorStop(0, 'rgba(255, 245, 224, 0.055)');
  refl.addColorStop(1, 'rgba(255, 245, 224, 0.0)');
  ctx.fillStyle = refl;
  ctx.fillRect(0, 0, w, h);

  // Main bilingual title matching reference-0.png left-aligned museum typography
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#ece6db';
  ctx.font = '500 54px "Noto Serif SC", "Songti SC", "SimSun", "Noto Sans SC", serif';
  ctx.fillText('玛瑙的多样纹理', 58, 38);

  ctx.fillStyle = '#b9b0a1';
  ctx.font = '400 29px "Georgia", "Times New Roman", "Segoe UI", serif';
  ctx.fillText('Agate Patterns', 62, 104);

  // Readable two-line curatorial explanation
  ctx.fillStyle = '#9c9488';
  ctx.font = '400 18px "Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif';
  ctx.fillText('玛瑙形成于火山岩气孔或热液裂隙中，二氧化硅胶体分期沉淀造就了千变万化的色带与内含物。', 62, 158);
  ctx.fillText('透射光下可见同心纹、羽状纹与树枝状锰铁氧化物结晶，记录着矿物生长的地质节律。', 62, 188);

  return canvas;
}

/**
 * 2) Recessed Right Legend Strip inside Display Cabinet: 羽状纹 / 树枝纹 / 同心纹.
 */
function buildCabinetLegendTexture() {
  const w = 380;
  const h = 880;
  const { canvas, ctx } = makeOffscreen(w, h);

  const bg = ctx.createLinearGradient(0, 0, w, 0);
  bg.addColorStop(0, '#141517');
  bg.addColorStop(0.55, '#1d1e21');
  bg.addColorStop(1, '#121315');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  // Subtle vertical backlit bounce strip on left edge adjacent to milky acrylic wall
  const edgeBounce = ctx.createLinearGradient(0, 0, 56, 0);
  edgeBounce.addColorStop(0, 'rgba(255, 240, 206, 0.16)');
  edgeBounce.addColorStop(1, 'rgba(255, 240, 206, 0.0)');
  ctx.fillStyle = edgeBounce;
  ctx.fillRect(0, 0, 56, h);

  const entries = [
    {
      y: 130,
      title: '羽状纹',
      sub: 'Plume Agate',
      line1: '矿物纤维呈羽毛状辐射生长，',
      line2: '透光层次如云雾舒展。',
    },
    {
      y: 425,
      title: '树枝纹',
      sub: 'Dendritic Agate',
      line1: '锰铁氧化物沿微裂隙结晶，',
      line2: '形成蕨叶与古树剪影。',
    },
    {
      y: 705,
      title: '同心纹',
      sub: 'Concentric Agate',
      line1: '硅质胶体沿岩壁逐层沉积，',
      line2: '呈环带与城堡状几何节律。',
    },
  ];

  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  for (const item of entries) {
    // Thin horizontal pointer rule matching reference-0.png
    ctx.strokeStyle = 'rgba(225, 215, 198, 0.78)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(22, item.y + 18);
    ctx.lineTo(54, item.y + 18);
    ctx.stroke();

    ctx.fillStyle = '#ece6db';
    ctx.font = '600 32px "Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.fillText(item.title, 68, item.y);

    ctx.fillStyle = '#b9a684';
    ctx.font = '500 18px "Segoe UI", system-ui, sans-serif';
    ctx.fillText(item.sub, 68, item.y + 42);

    ctx.fillStyle = '#a49c90';
    ctx.font = '400 17px "Noto Sans SC", "PingFang SC", sans-serif';
    ctx.fillText(item.line1, 68, item.y + 72);
    ctx.fillText(item.line2, 68, item.y + 98);
  }

  return canvas;
}

/**
 * 3) Sloped ~18° China Agate Distribution Map Box ("中国玛瑙产地分布").
 */
function buildChinaMapTexture() {
  const w = 1120;
  const h = 540;
  const { canvas, ctx } = makeOffscreen(w, h);

  // Warm parchment-ivory backlit display plate
  const bg = ctx.createLinearGradient(0, 0, w, h);
  bg.addColorStop(0, '#ddd6c7');
  bg.addColorStop(0.5, '#eae4d7');
  bg.addColorStop(1, '#d4cbb8');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  // Inner museum frame rule
  ctx.strokeStyle = 'rgba(65, 58, 48, 0.35)';
  ctx.lineWidth = 3;
  ctx.strokeRect(18, 18, w - 36, h - 36);

  // Subtle topographic grid lines
  ctx.strokeStyle = 'rgba(110, 102, 88, 0.12)';
  ctx.lineWidth = 1;
  for (let x = 350; x < w - 36; x += 64) {
    ctx.beginPath();
    ctx.moveTo(x, 78);
    ctx.lineTo(x, h - 36);
    ctx.stroke();
  }
  for (let y = 96; y < h - 36; y += 64) {
    ctx.beginPath();
    ctx.moveTo(350, y);
    ctx.lineTo(w - 36, y);
    ctx.stroke();
  }

  // Title centered over map area (matches reference-0.png)
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#25211c';
  ctx.font = '700 36px "Noto Serif SC", "Noto Sans SC", "Microsoft YaHei", serif';
  ctx.fillText('中国玛瑙产地分布', 690, 34);

  ctx.fillStyle = '#6c6254';
  ctx.font = '500 15px "Segoe UI", system-ui, sans-serif';
  ctx.fillText('MAJOR AGATE LOCALITIES OF CHINA', 690, 78);

  // Left legend panel
  ctx.textAlign = 'left';
  ctx.fillStyle = '#2b2620';
  ctx.font = '700 22px "Noto Sans SC", "Microsoft YaHei", sans-serif';
  ctx.fillText('主要矿带图例', 48, 44);
  ctx.fillStyle = '#756b5d';
  ctx.font = '500 13px "Segoe UI", sans-serif';
  ctx.fillText('LEGEND · MINERAL ZONES', 48, 72);

  const legendItems = [
    { col: '#c7613f', name: '辽宁 · 阜新水草玛瑙', sub: 'Fuxin, Liaoning' },
    { col: '#d98f43', name: '内蒙古 · 阿拉善戈壁玛瑙', sub: 'Alxa, Inner Mongolia' },
    { col: '#b84237', name: '云南 · 保山南红玛瑙', sub: 'Baoshan, Yunnan' },
    { col: '#7c9a59', name: '黑龙江 · 逊克北红玛瑙', sub: 'Xunke, Heilongjiang' },
    { col: '#b38c4e', name: '河北 · 宣化战国红玛瑙', sub: 'Xuanhua, Hebei' },
    { col: '#86976c', name: '江苏 · 南京雨花玛瑙', sub: 'Nanjing, Jiangsu' },
    { col: '#9b7b56', name: '新疆 · 准噶尔戈壁玛瑙', sub: 'Xinjiang Basin' },
    { col: '#a86752', name: '四川 · 凉山火山岩玛瑙', sub: 'Liangshan, Sichuan' },
  ];

  for (let i = 0; i < legendItems.length; i += 1) {
    const it = legendItems[i];
    const y = 108 + i * 48;
    ctx.fillStyle = it.col;
    ctx.fillRect(48, y + 4, 20, 14);
    ctx.strokeStyle = 'rgba(40,34,26,0.35)';
    ctx.lineWidth = 1;
    ctx.strokeRect(48, y + 4, 20, 14);

    ctx.fillStyle = '#2c2721';
    ctx.font = '600 17px "Noto Sans SC", "Microsoft YaHei", sans-serif';
    ctx.fillText(it.name, 78, y);

    ctx.fillStyle = '#736a5e';
    ctx.font = '400 12px "Segoe UI", sans-serif';
    ctx.fillText(it.sub, 78, y + 22);
  }

  // Stylized multi-region China outline (rooster silhouette) in the right half [380..1040, 110..485]
  const chinaOutline = [
    [405, 255], [430, 210], [472, 185], [518, 178], [568, 212], [625, 220],
    [682, 205], [735, 198], [786, 178], [835, 128], [892, 118], [942, 142],
    [986, 172], [1004, 204], [966, 232], [928, 252], [902, 272], [875, 286],
    [912, 314], [926, 344], [948, 378], [926, 412], [888, 438], [842, 456],
    [794, 466], [752, 454], [712, 464], [662, 452], [612, 424], [552, 404],
    [495, 384], [446, 355], [412, 315],
  ];

  // Drop shadow under map landmass
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(chinaOutline[0][0] + 4, chinaOutline[0][1] + 5);
  for (let i = 1; i < chinaOutline.length; i += 1) {
    ctx.lineTo(chinaOutline[i][0] + 4, chinaOutline[i][1] + 5);
  }
  ctx.closePath();
  ctx.fillStyle = 'rgba(55, 48, 38, 0.16)';
  ctx.fill();
  ctx.restore();

  // Clip interior regions to China landmass
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(chinaOutline[0][0], chinaOutline[0][1]);
  for (let i = 1; i < chinaOutline.length; i += 1) {
    ctx.lineTo(chinaOutline[i][0], chinaOutline[i][1]);
  }
  ctx.closePath();
  ctx.fillStyle = '#c5cb9c';
  ctx.fill();
  ctx.clip();

  // Geological provinces / colored agate belts
  const belts = [
    // Xinjiang NW desert agate belt
    { fill: '#c8b47c', pts: [[395, 170], [585, 170], [605, 310], [405, 325]] },
    // Inner Mongolia / Gansu corridor (Alxa)
    { fill: '#d6a460', pts: [[565, 195], [820, 175], [805, 290], [580, 310]] },
    // Northeast (Heilongjiang / Liaoning - Xunke & Fuxin)
    { fill: '#9db474', pts: [[785, 105], [1025, 115], [995, 275], [810, 265]] },
    // North China (Hebei Xuanhua)
    { fill: '#cf7c52', pts: [[740, 245], [910, 248], [900, 338], [735, 345]] },
    // East China (Jiangsu Nanjing)
    { fill: '#97ab78', pts: [[845, 325], [975, 325], [965, 425], [835, 415]] },
    // Southwest volcanic belt (Yunnan Baoshan & Sichuan Liangshan)
    { fill: '#cb6346', pts: [[595, 350], [790, 345], [775, 485], [580, 465]] },
    // Tibetan plateau
    { fill: '#d8c594', pts: [[410, 295], [630, 305], [615, 445], [415, 415]] },
    // South China
    { fill: '#bf7c5c', pts: [[765, 390], [945, 390], [925, 485], [755, 480]] },
  ];

  for (const b of belts) {
    ctx.beginPath();
    ctx.moveTo(b.pts[0][0], b.pts[0][1]);
    for (let i = 1; i < b.pts.length; i += 1) {
      ctx.lineTo(b.pts[i][0], b.pts[i][1]);
    }
    ctx.closePath();
    ctx.fillStyle = b.fill;
    ctx.fill();
    ctx.strokeStyle = 'rgba(250, 245, 232, 0.55)';
    ctx.lineWidth = 1.6;
    ctx.stroke();
  }

  // Subtle topographic relief texture speckles
  const rand = mulberry32(4091);
  for (let i = 0; i < 420; i += 1) {
    const px = 400 + rand() * 610;
    const py = 115 + rand() * 365;
    ctx.fillStyle = rand() > 0.5 ? 'rgba(255,248,230,0.14)' : 'rgba(80,62,42,0.10)';
    ctx.beginPath();
    ctx.arc(px, py, 2 + rand() * 6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // Crisp outer national coastline & border stroke
  ctx.beginPath();
  ctx.moveTo(chinaOutline[0][0], chinaOutline[0][1]);
  for (let i = 1; i < chinaOutline.length; i += 1) {
    ctx.lineTo(chinaOutline[i][0], chinaOutline[i][1]);
  }
  ctx.closePath();
  ctx.strokeStyle = '#574c3d';
  ctx.lineWidth = 2.2;
  ctx.stroke();

  // Hainan & Taiwan islands
  ctx.fillStyle = '#bf7c5c';
  ctx.strokeStyle = '#574c3d';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.ellipse(812, 492, 13, 8, -0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.ellipse(955, 434, 8, 20, 0.25, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // South China Sea inset box bottom-right
  ctx.strokeStyle = 'rgba(85, 76, 62, 0.55)';
  ctx.lineWidth = 1.4;
  ctx.strokeRect(988, 396, 86, 108);
  ctx.fillStyle = '#6c6254';
  ctx.font = '500 11px "Noto Sans SC", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('南海诸岛', 1031, 488);

  // Locality pin dots & clean non-overlapping callout labels
  const pins = [
    { x: 912, y: 156, label: '逊克', col: '#3e6231' },
    { x: 896, y: 242, label: '阜新', col: '#9e351e' },
    { x: 822, y: 268, label: '宣化', col: '#8d5b1f' },
    { x: 678, y: 266, label: '阿拉善', col: '#a85a14' },
    { x: 495, y: 248, label: '新疆', col: '#785028' },
    { x: 892, y: 356, label: '南京', col: '#4a6b3b' },
    { x: 694, y: 398, label: '凉山', col: '#8f3024' },
    { x: 656, y: 438, label: '保山', col: '#99261b' },
  ];
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  for (const pin of pins) {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(pin.x, pin.y, 6.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = pin.col;
    ctx.beginPath();
    ctx.arc(pin.x, pin.y, 4.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#241e18';
    ctx.font = '700 15px "Noto Sans SC", "Microsoft YaHei", sans-serif';
    ctx.fillText(pin.label, pin.x + 9, pin.y);
  }

  return canvas;
}

/**
 * 4) Lower-Right Sloped Mineral Graphic Plate (raw volcanic nodules, fractured specimens & notes).
 */
function buildMineralPlateTexture() {
  const w = 780;
  const h = 420;
  const { canvas, ctx } = makeOffscreen(w, h);

  const bg = ctx.createLinearGradient(0, 0, w, h);
  bg.addColorStop(0, '#2c2f34');
  bg.addColorStop(0.5, '#373a40');
  bg.addColorStop(1, '#25272b');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = 'rgba(220, 210, 195, 0.22)';
  ctx.lineWidth = 3;
  ctx.strokeRect(16, 16, w - 32, h - 32);

  // Paint 3 realistic volcanic rock / raw agate nodule graphic illustrations
  const cards = [
    { cx: 145, cy: 170, rx: 95, ry: 68, title: '玄武岩晶洞原石', sub: 'Basalt Geode Matrix', kind: 'geode', seed: 9101 },
    { cx: 390, cy: 170, rx: 98, ry: 70, title: '琥珀色带剖面', sub: 'Banded Chalcedony', kind: 'banded', seed: 9102 },
    { cx: 635, cy: 170, rx: 92, ry: 68, title: '硅质热液围岩', sub: 'Silica Hydrothermal Crust', kind: 'crust', seed: 9103 },
  ];

  for (const card of cards) {
    const rand = mulberry32(card.seed);
    // Soft shadow under specimen illustration
    ctx.fillStyle = 'rgba(0, 0, 0, 0.38)';
    ctx.beginPath();
    ctx.ellipse(card.cx + 8, card.cy + 16, card.rx * 0.92, card.ry * 0.78, 0.1, 0, Math.PI * 2);
    ctx.fill();

    // Irregular rock polygon
    const pts = [];
    for (let i = 0; i < 28; i += 1) {
      const a = (i / 28) * Math.PI * 2;
      const rMod = 0.84 + 0.24 * Math.sin(a * 3 + card.seed) + (rand() - 0.5) * 0.14;
      pts.push([card.cx + Math.cos(a) * card.rx * rMod, card.cy + Math.sin(a) * card.ry * rMod]);
    }
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i += 1) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();

    const rockGrad = ctx.createRadialGradient(card.cx - 24, card.cy - 20, 12, card.cx, card.cy, card.rx);
    if (card.kind === 'banded') {
      rockGrad.addColorStop(0, '#f0b86e');
      rockGrad.addColorStop(0.45, '#b86a34');
      rockGrad.addColorStop(0.78, '#5a3d2d');
      rockGrad.addColorStop(1, '#2b2420');
    } else if (card.kind === 'geode') {
      rockGrad.addColorStop(0, '#c8beb2');
      rockGrad.addColorStop(0.42, '#7d7268');
      rockGrad.addColorStop(0.75, '#4b443e');
      rockGrad.addColorStop(1, '#292623');
    } else {
      rockGrad.addColorStop(0, '#8d867e');
      rockGrad.addColorStop(0.55, '#524e48');
      rockGrad.addColorStop(1, '#242320');
    }
    ctx.fillStyle = rockGrad;
    ctx.fill();
    ctx.clip();

    // Internal strata or crystal speckles
    if (card.kind === 'banded') {
      for (let r = 18; r < 82; r += 9) {
        ctx.strokeStyle = r % 18 === 0 ? 'rgba(255, 232, 195, 0.65)' : 'rgba(135, 58, 22, 0.55)';
        ctx.lineWidth = 3.2;
        ctx.beginPath();
        ctx.ellipse(card.cx, card.cy, r * 1.15, r * 0.72, -0.2, 0, Math.PI * 2);
        ctx.stroke();
      }
    } else {
      for (let k = 0; k < 140; k += 1) {
        const sx = card.cx + (rand() - 0.5) * card.rx * 1.7;
        const sy = card.cy + (rand() - 0.5) * card.ry * 1.6;
        ctx.fillStyle = rand() > 0.45 ? 'rgba(235, 225, 208, 0.25)' : 'rgba(18, 16, 14, 0.35)';
        ctx.fillRect(sx, sy, 3 + rand() * 8, 2 + rand() * 5);
      }
    }
    ctx.restore();

    // Caption bar beneath each specimen
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#e8e2d6';
    ctx.font = '600 22px "Noto Sans SC", "Microsoft YaHei", sans-serif';
    ctx.fillText(card.title, card.cx, 286);

    ctx.fillStyle = '#b4ab9d';
    ctx.font = '400 15px "Segoe UI", sans-serif';
    ctx.fillText(card.sub, card.cx, 318);

    ctx.strokeStyle = 'rgba(218, 188, 134, 0.45)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(card.cx - 56, 352);
    ctx.lineTo(card.cx + 56, 352);
    ctx.stroke();
  }

  return canvas;
}

/**
 * 5) Lower-Left Raw Rock Specimen Placard inside acrylic box.
 */
function buildRockPlacardTexture() {
  const w = 520;
  const h = 190;
  const { canvas, ctx } = makeOffscreen(w, h);

  ctx.fillStyle = '#25272b';
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = 'rgba(218, 206, 185, 0.32)';
  ctx.lineWidth = 2;
  ctx.strokeRect(10, 10, w - 20, h - 20);

  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#efe9de';
  ctx.font = '600 28px "Noto Sans SC", "Microsoft YaHei", sans-serif';
  ctx.fillText('玄武岩玛瑙原石标本', 28, 26);

  ctx.fillStyle = '#c8b48e';
  ctx.font = '500 17px "Segoe UI", sans-serif';
  ctx.fillText('Volcanic Basalt Agate Nodule', 28, 64);

  ctx.fillStyle = '#b1a99c';
  ctx.font = '400 16px "Noto Sans SC", sans-serif';
  ctx.fillText('产自白垩纪玄武岩杏仁体气孔层，外覆深褐火山岩皮壳。', 28, 104);
  ctx.fillText('切片抛光后呈现多层半透明玉髓纹理。', 28, 132);

  return canvas;
}

/**
 * 6) Back-Right Museum Wall Banner: "从岩石到宝石 / From Rock to Gemstone".
 */
function buildRockToGemstonePanel() {
  const w = 540;
  const h = 1120;
  const { canvas, ctx } = makeOffscreen(w, h);

  // Dark matte exhibition board
  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, '#1e1d1c');
  bg.addColorStop(0.22, '#181819');
  bg.addColorStop(1, '#0e0f11');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  // Warm overhead museum spotlight wash at top
  const spot = ctx.createRadialGradient(w * 0.45, 80, 15, w * 0.45, 160, 320);
  spot.addColorStop(0, 'rgba(255, 232, 185, 0.16)');
  spot.addColorStop(1, 'rgba(255, 232, 185, 0.0)');
  ctx.fillStyle = spot;
  ctx.fillRect(0, 0, w, 450);

  // Crisp bilingual title
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#efe8db';
  ctx.font = '600 44px "Noto Serif SC", "Noto Sans SC", serif';
  ctx.fillText('从岩石到宝石', 42, 128);

  ctx.fillStyle = '#d3b27e';
  ctx.font = '500 24px "Georgia", "Segoe UI", serif';
  ctx.fillText('From Rock to Gemstone', 44, 186);

  // Short museum intro lines
  ctx.fillStyle = '#9e978b';
  ctx.font = '400 16px "Noto Sans SC", sans-serif';
  ctx.fillText('火山喷发形成的玄武岩气孔，在漫长地质', 44, 238);
  ctx.fillText('演化中由富含二氧化硅的热液逐步充填。', 44, 264);
  ctx.fillText('经切割、研磨与双轮抛光后显现宝石光泽。', 44, 290);

  // Photographic-style geological strata landscape painting (y = 342 .. 770)
  const px = 42;
  const py = 342;
  const pw = w - 84;
  const ph = 420;
  ctx.save();
  ctx.beginPath();
  ctx.rect(px, py, pw, ph);
  ctx.clip();

  // Overcast geological canyon sky
  const sky = ctx.createLinearGradient(px, py, px, py + ph * 0.45);
  sky.addColorStop(0, '#5a6068');
  sky.addColorStop(1, '#8b8e90');
  ctx.fillStyle = sky;
  ctx.fillRect(px, py, pw, ph);

  // Layered basalt ridges & strata folds
  const rand = mulberry32(7201);
  const layers = [
    { y0: py + 115, col: '#4a4742', hi: '#736c62', amp: 44 },
    { y0: py + 185, col: '#3a3836', hi: '#645c53', amp: 38 },
    { y0: py + 255, col: '#2d2d30', hi: '#5a534c', amp: 30 },
    { y0: py + 325, col: '#212226', hi: '#46423d', amp: 24 },
  ];
  for (let l = 0; l < layers.length; l += 1) {
    const lay = layers[l];
    ctx.beginPath();
    ctx.moveTo(px, py + ph);
    for (let x = 0; x <= pw; x += 12) {
      const n = fbm2D(x * 0.014 + l * 3.1, l * 1.7, 7201 + l * 31, 4);
      const ridge = lay.y0 + (n - 0.5) * lay.amp * 2.2 - Math.sin((x / pw) * Math.PI) * 26;
      ctx.lineTo(px + x, ridge);
    }
    ctx.lineTo(px + pw, py + ph);
    ctx.closePath();
    const lg = ctx.createLinearGradient(px, lay.y0 - 30, px, py + ph);
    lg.addColorStop(0, lay.hi);
    lg.addColorStop(0.28, lay.col);
    lg.addColorStop(1, '#151618');
    ctx.fillStyle = lg;
    ctx.fill();

    // Mineral strata veins across rock slope
    ctx.strokeStyle = 'rgba(218, 200, 172, 0.16)';
    ctx.lineWidth = 1.5;
    for (let v = 0; v < 4; v += 1) {
      ctx.beginPath();
      for (let x = 0; x <= pw; x += 18) {
        const yy = lay.y0 + 20 + v * 16 + Math.sin(x * 0.025 + v) * 8 + (rand() - 0.5) * 3;
        if (x === 0) ctx.moveTo(px + x, yy);
        else ctx.lineTo(px + x, yy);
      }
      ctx.stroke();
    }
  }
  ctx.restore();

  // Photo subtle border
  ctx.strokeStyle = 'rgba(220, 208, 190, 0.22)';
  ctx.lineWidth = 2;
  ctx.strokeRect(px, py, pw, ph);

  // Lower curatorial captions
  ctx.fillStyle = '#8d877d';
  ctx.font = '400 15px "Noto Sans SC", sans-serif';
  ctx.fillText('▲ 火山岩矿床与硅质热液脉露头', 44, 790);
  ctx.fillStyle = '#6f6a62';
  ctx.font = '400 14px "Segoe UI", sans-serif';
  ctx.fillText('Volcanic basalt host rock & silica hydrothermal veins', 44, 818);

  return canvas;
}

/**
 * 7) Far-Right Museum Wall Banner: "地球的记忆 / Memories of the Earth".
 */
function buildMemoriesEarthPanel() {
  const w = 620;
  const h = 1120;
  const { canvas, ctx } = makeOffscreen(w, h);

  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, '#22211e');
  bg.addColorStop(0.25, '#19191a');
  bg.addColorStop(1, '#101012');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  // Top title band (shifted comfortably inside panel margin so full bilingual title stays readable)
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#f0e9dc';
  ctx.font = '600 44px "Noto Serif SC", "Noto Sans SC", serif';
  ctx.fillText('地球的记忆', 28, 102);

  ctx.fillStyle = '#d3b27e';
  ctx.font = '500 22px "Georgia", "Segoe UI", serif';
  ctx.fillText('Memories of the Earth', 30, 158);

  // Dramatic rugged basalt mountain monolith mural (y = 216 .. 820)
  const px = 22;
  const py = 216;
  const pw = w - 44;
  const ph = 605;
  ctx.save();
  ctx.beginPath();
  ctx.rect(px, py, pw, ph);
  ctx.clip();

  const skyGrad = ctx.createLinearGradient(px, py, px, py + 170);
  skyGrad.addColorStop(0, '#3a4a5e');
  skyGrad.addColorStop(1, '#7b8a97');
  ctx.fillStyle = skyGrad;
  ctx.fillRect(px, py, pw, ph);

  // Dramatic craggy peaks & warm ochre illuminated rock facets
  const rand = mulberry32(8831);
  const ridges = [
    { baseY: py + 135, colA: '#6f5b43', colB: '#2a241d', jag: 95 },
    { baseY: py + 255, colA: '#836b4c', colB: '#26201a', jag: 82 },
    { baseY: py + 390, colA: '#5f4d39', colB: '#1c1814', jag: 68 },
    { baseY: py + 505, colA: '#43382c', colB: '#151311', jag: 45 },
  ];
  for (let r = 0; r < ridges.length; r += 1) {
    const rg = ridges[r];
    ctx.beginPath();
    ctx.moveTo(px, py + ph);
    for (let x = 0; x <= pw; x += 14) {
      const n = fbm2D(x * 0.012 + r * 5.3, r * 2.1, 8831 + r * 19, 4);
      const peak = Math.sin((x / pw) * Math.PI * (1.8 + r * 0.4) + r) * rg.jag * 0.65;
      ctx.lineTo(px + x, rg.baseY - Math.abs(peak) + (n - 0.5) * rg.jag);
    }
    ctx.lineTo(px + pw, py + ph);
    ctx.closePath();
    const g = ctx.createLinearGradient(px, rg.baseY - 90, px + pw * 0.6, py + ph);
    g.addColorStop(0, rg.colA);
    g.addColorStop(0.5, rg.colB);
    g.addColorStop(1, '#12100e');
    ctx.fillStyle = g;
    ctx.fill();

    // Sunlit warm rock facet streaks
    for (let f = 0; f < 34; f += 1) {
      const fx = px + rand() * pw;
      const fy = rg.baseY + (rand() - 0.3) * 140;
      const fw = 12 + rand() * 34;
      const fh = 16 + rand() * 52;
      ctx.fillStyle = rand() > 0.4 ? 'rgba(186, 152, 102, 0.14)' : 'rgba(12, 10, 8, 0.28)';
      ctx.beginPath();
      ctx.moveTo(fx, fy);
      ctx.lineTo(fx + fw * 0.6, fy + fh);
      ctx.lineTo(fx - fw * 0.4, fy + fh * 0.85);
      ctx.closePath();
      ctx.fill();
    }
  }
  ctx.restore();

  ctx.strokeStyle = 'rgba(218, 202, 178, 0.20)';
  ctx.lineWidth = 2;
  ctx.strokeRect(px, py, pw, ph);

  return canvas;
}

/**
 * 8) Distant background outcrop graphic behind the glass divider (between left cabinet and central panel).
 */
function buildBgOutcropPanel() {
  const w = 360;
  const h = 920;
  const { canvas, ctx } = makeOffscreen(w, h);

  ctx.fillStyle = '#151516';
  ctx.fillRect(0, 0, w, h);

  // Upper illuminated outcrop geological cliff photography (smooth layered basalt strata, no blocky rectangles)
  const rand = mulberry32(5512);
  ctx.save();
  ctx.beginPath();
  ctx.rect(18, 118, w - 36, 368);
  ctx.clip();
  const g = ctx.createLinearGradient(0, 118, 0, 486);
  g.addColorStop(0, '#5a5042');
  g.addColorStop(0.45, '#3b3329');
  g.addColorStop(1, '#191613');
  ctx.fillStyle = g;
  ctx.fillRect(18, 118, w - 36, 368);

  const strata = [
    { y: 195, col: '#4a4033', hi: '#786954', amp: 36 },
    { y: 275, col: '#383127', hi: '#645643', amp: 30 },
    { y: 358, col: '#28231d', hi: '#4e4437', amp: 24 },
    { y: 430, col: '#1b1814', hi: '#3a3228', amp: 18 },
  ];
  for (let s = 0; s < strata.length; s += 1) {
    const st = strata[s];
    ctx.beginPath();
    ctx.moveTo(18, 486);
    for (let x = 18; x <= w - 18; x += 10) {
      const n = fbm2D(x * 0.02 + s * 4.2, s * 2.1, 5512 + s * 17, 4);
      ctx.lineTo(x, st.y + (n - 0.5) * st.amp * 2);
    }
    ctx.lineTo(w - 18, 486);
    ctx.closePath();
    const sg = ctx.createLinearGradient(0, st.y - 24, 0, 486);
    sg.addColorStop(0, st.hi);
    sg.addColorStop(0.28, st.col);
    sg.addColorStop(1, '#141210');
    ctx.fillStyle = sg;
    ctx.fill();
  }
  // Fine illuminated mineral streaks
  ctx.strokeStyle = 'rgba(218, 195, 155, 0.14)';
  ctx.lineWidth = 1.2;
  for (let k = 0; k < 14; k += 1) {
    const y0 = 175 + k * 21 + (rand() - 0.5) * 6;
    ctx.beginPath();
    ctx.moveTo(22, y0);
    ctx.bezierCurveTo(120, y0 - 12, 230, y0 + 10, w - 22, y0 - 4);
    ctx.stroke();
  }
  ctx.restore();

  // Subtle museum vitrine light strips lower down
  ctx.fillStyle = 'rgba(212, 194, 160, 0.14)';
  ctx.fillRect(24, 520, w - 48, 120);
  ctx.fillStyle = 'rgba(24, 24, 26, 0.72)';
  ctx.fillRect(32, 528, w - 64, 104);

  return canvas;
}

export function createMuseumTextures() {
  return {
    cabinetHeader: buildCabinetHeaderTexture(),
    cabinetLegend: buildCabinetLegendTexture(),
    chinaMap: buildChinaMapTexture(),
    mineralPlateRight: buildMineralPlateTexture(),
    rockPlacard: buildRockPlacardTexture(),
    panelRockToGem: buildRockToGemstonePanel(),
    panelMemoriesEarth: buildMemoriesEarthPanel(),
    panelBgOutcrop: buildBgOutcropPanel(),
  };
}
