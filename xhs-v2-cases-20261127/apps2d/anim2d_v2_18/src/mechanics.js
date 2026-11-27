import { TAU, clamp, lerp, path, line, circle, glow, hexMix } from './utils.js';

export function computeOptics(scene) {
  const p = scene.t / 8 * TAU;
  const origin = { x: 1000, y: 164 };
  const scanX = 350 - Math.cos(p) * 185;
  const radians = scene.elevation * Math.PI / 180;
  // Perspective projection of the optical axis onto the painted sea plane.
  // This remains continuous through the entire 0–90° control range (no flat clamp at high angles).
  const elevationMix = Math.pow(scene.elevation / 90, 1.7);
  const impact = {
    x: scanX + elevationMix * 240,
    y: 359 + 303 * Math.pow(Math.sin(radians), .45),
  };
  const nightPower = lerp(1, .32, scene.day) * clamp(scene.elevation / 4);
  return { origin, impact, scanX, rawY: impact.y, phase: p, strength: nightPower * (.81 + .19 * Math.cos(p)) };
}

export function drawBeam(ctx, scene, optics) {
  const { day, storm, pulse } = scene;
  const { origin: o, impact: q, strength } = optics;
  const intensity = strength + pulse.envelope * .22;
  const dx = q.x - o.x, dy = q.y - o.y;
  const length = Math.hypot(dx, dy); const nx = -dy / length, ny = dx / length;
  const spread = 66 + storm * 13;
  ctx.save(); ctx.globalCompositeOperation = 'screen';
  const g = ctx.createLinearGradient(o.x, o.y, q.x, q.y);
  g.addColorStop(0, `rgba(202,255,249,${.42 * intensity})`);
  g.addColorStop(.3, `rgba(105,229,236,${.22 * intensity})`);
  g.addColorStop(1, `rgba(71,192,214,${.055 * intensity})`);
  path(ctx, [[o.x, o.y], [q.x + nx * spread, q.y + ny * spread], [q.x - nx * spread, q.y - ny * spread]]);
  ctx.fillStyle = g; ctx.fill();
  const inner = ctx.createLinearGradient(o.x, o.y, q.x, q.y);
  inner.addColorStop(0, `rgba(232,255,248,${.45 * intensity})`); inner.addColorStop(.65, `rgba(155,245,241,${.13 * intensity})`); inner.addColorStop(1, 'rgba(94,218,229,.015)');
  path(ctx, [[o.x, o.y], [q.x + nx * spread * .42, q.y + ny * spread * .42], [q.x - nx * spread * .42, q.y - ny * spread * .42]]); ctx.fillStyle = inner; ctx.fill();
  line(ctx, o.x, o.y, q.x + nx * spread, q.y + ny * spread, `rgba(166,247,247,${.21 * intensity})`, .85);
  line(ctx, o.x, o.y, q.x - nx * spread, q.y - ny * spread, `rgba(94,200,223,${.13 * intensity})`, .85);
  // Longitudinal diaphragm lines reveal volume without turning the beam into a solid triangle.
  for (let i = -2; i <= 2; i++) {
    const f = i / 6;
    line(ctx, o.x, o.y, q.x + nx * spread * f, q.y + ny * spread * f, `rgba(175,247,242,${intensity * .035})`, .65);
  }
  ctx.restore();
}

function drawCoastalBreaker(ctx, t, storm) {
  const p = t / 8 * TAU;
  const crest = [[649, 746], [688, 721], [714, 699], [730, 668], [747, 651], [755, 625], [778, 621], [793, 602], [813, 609], [829, 601], [850, 615], [866, 641]];
  const upper = crest.map(([x, y], i) => [x, y + Math.sin(p * 2 + i * .69) * (1.5 + storm * 5)]);
  const lower = upper.map(([x, y], i) => [x - 13 - (i % 3) * 4, y + 10 + storm * (12 + (i % 4) * 4)]).reverse();
  ctx.save();
  const foam = ctx.createLinearGradient(710, 602, 733, 739);
  foam.addColorStop(0, `rgba(229,248,238,${.22 + storm * .71})`);
  foam.addColorStop(.42, `rgba(179,229,228,${.18 + storm * .66})`);
  foam.addColorStop(1, 'rgba(87,166,187,0)');
  path(ctx, [...upper, ...lower]); ctx.fillStyle = foam; ctx.fill();
  ctx.beginPath(); upper.forEach((q, i) => i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]));
  ctx.strokeStyle = `rgba(228,249,240,${.27 + storm * .7})`; ctx.lineWidth = 1.2 + storm * 3; ctx.stroke();
  for (let i = 0; i < 46; i++) {
    const q = (i * .61803398875) % 1;
    const k = Math.min(upper.length - 2, Math.floor(q * (upper.length - 1)));
    const f = q * (upper.length - 1) - k;
    const x = lerp(upper[k][0], upper[k + 1][0], f) + Math.sin(i * 4.17) * (5 + storm * 16);
    const y = lerp(upper[k][1], upper[k + 1][1], f) + Math.cos(i * 2.31) * (3 + storm * 13);
    const r = .8 + (i % 5) * .7 * storm;
    circle(ctx, x, y, r, `rgba(220,245,237,${(.14 + storm * .65) * (i % 3 === 0 ? .65 : 1)})`);
  }
  // Trailing filaments curl back into the sea instead of ending as a rigid white strip.
  for (let i = 0; i < 6; i++) {
    const x = 669 + i * 21, y = 727 - i * 14 + Math.sin(p * 2 + i) * storm * 5;
    ctx.beginPath(); ctx.moveTo(x - 28, y + 15); ctx.quadraticCurveTo(x - 8, y + 5, x + 5, y - 9);
    ctx.strokeStyle = `rgba(188,234,232,${.17 + storm * .48})`; ctx.lineWidth = 1 + storm * 1.5; ctx.stroke();
  }
  ctx.restore();
}

export function drawCliff(ctx, scene) {
  const { day, t, storm } = scene;
  const p = t / 8 * TAU;
  ctx.save();
  drawCoastalBreaker(ctx, t, storm);
  const outline = [[695, 777], [757, 715], [790, 663], [819, 626], [855, 613], [887, 634], [912, 667], [948, 682], [996, 688], [1051, 684], [1090, 702], [1140, 686], [1208, 674], [1230, 780]];
  path(ctx, outline); const rock = ctx.createLinearGradient(840, 620, 950, 795); rock.addColorStop(0, hexMix('#293239', '#515955', day)); rock.addColorStop(.4, '#1e2b33'); rock.addColorStop(1, '#0b1925'); ctx.fillStyle = rock; ctx.fill(); ctx.strokeStyle = '#0c1b27'; ctx.lineWidth = 3; ctx.stroke();
  const facets = [
    [[758, 715], [790, 663], [833, 649], [808, 728]],
    [[790, 663], [819, 626], [855, 613], [868, 637], [833, 649]],
    [[833, 649], [868, 637], [887, 634], [914, 679], [864, 715]],
    [[808, 728], [833, 649], [864, 715], [845, 780]],
    [[864, 715], [914, 679], [948, 682], [926, 780]],
    [[948, 682], [997, 688], [1012, 730], [976, 780], [926, 780]],
    [[1012, 730], [1051, 684], [1090, 702], [1101, 780]],
    [[1101, 780], [1090, 702], [1140, 686], [1171, 737], [1193, 780]],
  ];
  facets.forEach((f, i) => { path(ctx, f); ctx.fillStyle = i % 3 === 0 ? '#26323a' : i % 3 === 1 ? '#17262f' : '#202d34'; ctx.globalAlpha = .76; ctx.fill(); ctx.globalAlpha = 1; ctx.strokeStyle = '#101f29'; ctx.lineWidth = 1.5; ctx.stroke(); });
  const cracks = [
    [[811, 639], [825, 664], [818, 690], [835, 712], [826, 753]],
    [[855, 626], [847, 651], [869, 681], [860, 706], [878, 739]],
    [[923, 688], [906, 707], [920, 731], [907, 755]],
    [[979, 696], [1000, 715], [990, 738], [1008, 764]],
    [[1090, 706], [1120, 721], [1110, 752], [1134, 773]],
  ];
  cracks.forEach(c => { path(ctx, c, false); ctx.strokeStyle = '#0b1a24'; ctx.lineWidth = 2; ctx.stroke(); ctx.beginPath(); c.forEach((q, i) => i ? ctx.lineTo(q[0] + 3, q[1]) : ctx.moveTo(q[0] + 3, q[1])); ctx.strokeStyle = 'rgba(85,101,104,.22)'; ctx.lineWidth = .8; ctx.stroke(); });
  for (let i = 0; i < 9; i++) line(ctx, 750 + i * 49, 739 + (i % 3) * 8, 791 + i * 45, 731 + (i % 3) * 6, 'rgba(97,112,112,.14)', 1);
  // White water breaks on the exposed rock, with spray tied to the foreground swell.
  for (let i = 0; i < 16; i++) {
    const q = i / 15;
    const x = 714 + q * 180, y = 749 - q * 124 + Math.sin(q * 16 + p * 2) * (4 + storm * 5);
    circle(ctx, x - 8, y - 5, (2 + (i % 4)) * (.35 + storm * .7), `rgba(208,238,232,${.28 + storm * .42})`);
    if (i > 0) line(ctx, x - 20, y + 5, x, y, `rgba(170,224,229,${.24 + storm * .42})`, 1.3 + storm * 1.8);
  }
  ctx.restore();
}

function gear(ctx, x, y, r, teeth, angle, palette = 'brass', spokes = 6) {
  const colors = palette === 'copper' ? ['#bd794b', '#69472f', '#e6aa62'] : ['#b99754', '#5c4b2f', '#efd28a'];
  ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
  ctx.beginPath();
  for (let i = 0; i < teeth * 4; i++) {
    const a = i / (teeth * 4) * TAU;
    const phase = i % 4;
    const rr = phase === 1 || phase === 2 ? r : r * .82;
    const xx = Math.cos(a) * rr, yy = Math.sin(a) * rr;
    if (!i) ctx.moveTo(xx, yy); else ctx.lineTo(xx, yy);
  }
  ctx.closePath(); ctx.fillStyle = colors[0]; ctx.fill(); ctx.strokeStyle = '#261f19'; ctx.lineWidth = 1.2; ctx.stroke();
  circle(ctx, 0, 0, r * .67, '#17272b', colors[1], 2);
  for (let i = 0; i < spokes; i++) {
    const a = i / spokes * TAU;
    line(ctx, Math.cos(a) * r * .17, Math.sin(a) * r * .17, Math.cos(a) * r * .68, Math.sin(a) * r * .68, colors[0], r > 20 ? 4.4 : 3.1);
    line(ctx, Math.cos(a) * r * .19, Math.sin(a) * r * .19 - .6, Math.cos(a) * r * .64, Math.sin(a) * r * .64 - .6, 'rgba(250,218,143,.27)', .75);
  }
  circle(ctx, 0, 0, r * .23, colors[1], colors[2], 1.3);
  circle(ctx, 0, 0, Math.max(2.2, r * .08), '#283135', '#e2bd74', 1);
  circle(ctx, -r * .033, -r * .05, Math.max(1, r * .025), '#f7dfa4');
  ctx.restore();
}

function wallLamp(ctx, x, y, power) {
  glow(ctx, x, y + 2, 65, `rgba(244,160,60,${.25 * power})`);
  line(ctx, x, y - 18, x, y - 12, '#af8751', 2);
  path(ctx, [[x - 5, y - 11], [x + 5, y - 11], [x + 6, y + 8], [x - 6, y + 8]]);
  ctx.fillStyle = `rgba(255,204,103,${.35 + power * .65})`; ctx.fill(); ctx.strokeStyle = '#6e5633'; ctx.lineWidth = 1.2; ctx.stroke();
  line(ctx, x, y - 10, x, y + 8, '#5d4c31', .9);
  path(ctx, [[x - 7, y - 12], [x, y - 16], [x + 7, y - 12]]); ctx.fillStyle = '#927140'; ctx.fill();
  line(ctx, x - 8, y + 9, x + 8, y + 9, '#9d7b43', 2);
  if (power > .25) circle(ctx, x - 1.5, y - 3, 1.7, 'rgba(255,246,180,.9)');
}

function gauge(ctx, x, y, r, value, t) {
  circle(ctx, x, y, r + 2, '#352e25', '#c69b55', 1.5);
  circle(ctx, x, y, r, '#d4c8a5', '#3c3a30', .8);
  for (let i = 0; i <= 10; i++) {
    const a = Math.PI * .75 + i / 10 * Math.PI * 1.5;
    line(ctx, x + Math.cos(a) * r * .72, y + Math.sin(a) * r * .72, x + Math.cos(a) * r * .9, y + Math.sin(a) * r * .9, '#4a493d', .65);
  }
  const a = Math.PI * .75 + clamp(value) * Math.PI * 1.5 + Math.sin(t * TAU / 8 * 4) * .018;
  line(ctx, x, y, x + Math.cos(a) * r * .66, y + Math.sin(a) * r * .66, '#873e2d', 1.1);
  circle(ctx, x, y, 1.6, '#604b2f');
  ctx.fillStyle = '#4c4b3f'; ctx.font = `${Math.max(4, r * .35)}px monospace`; ctx.textAlign = 'center'; ctx.fillText('PSI', x, y + r * .57);
}

function drawCutaway(ctx, scene) {
  const { t, day, storm, pulse } = scene;
  const p = t / 8 * TAU;
  const power = clamp(1 - day * .77 + pulse.envelope * .1);
  ctx.save();
  // Arched aperture is the actual inner chamber; all machinery is clipped to it.
  const aperture = () => { ctx.beginPath(); ctx.moveTo(-61, 686); ctx.lineTo(-61, 346); ctx.bezierCurveTo(-61, 275, 61, 275, 61, 346); ctx.lineTo(61, 686); ctx.closePath(); };
  aperture(); const inside = ctx.createLinearGradient(-60, 300, 70, 680); inside.addColorStop(0, '#15272d'); inside.addColorStop(.54, '#25302d'); inside.addColorStop(1, '#121f24'); ctx.fillStyle = inside; ctx.fill();
  ctx.save(); aperture(); ctx.clip();
  glow(ctx, 0, 478, 180, `rgba(190,111,44,${.14 * power})`);
  // Rear brick courses and shadowed ribs show depth behind the machine.
  for (let y = 323; y < 690; y += 23) {
    line(ctx, -70, y, 72, y + 2, 'rgba(126,120,88,.13)', .8);
    for (let x = -63 + ((y / 23) % 2) * 17; x < 70; x += 36) line(ctx, x, y, x, y + 20, 'rgba(116,117,91,.1)', .65);
  }
  path(ctx, [[-54, 679], [-54, 351], [-48, 317], [-39, 302]]); ctx.strokeStyle = 'rgba(103,121,112,.25)'; ctx.lineWidth = 4; ctx.stroke();
  path(ctx, [[53, 684], [53, 350], [45, 314]]); ctx.strokeStyle = '#0a1b23'; ctx.lineWidth = 5; ctx.stroke();

  // Copper service pipes with couplings and two right-angle manifolds.
  ctx.lineJoin = 'round';
  path(ctx, [[-48, 681], [-48, 614], [-53, 605], [-53, 523], [-48, 513], [-48, 463], [-38, 451], [-38, 409]], false);
  ctx.strokeStyle = '#31271e'; ctx.lineWidth = 9; ctx.stroke(); ctx.strokeStyle = '#a76b3f'; ctx.lineWidth = 5.4; ctx.stroke(); ctx.strokeStyle = 'rgba(243,178,103,.48)'; ctx.lineWidth = 1.2; ctx.stroke();
  path(ctx, [[47, 526], [48, 456], [40, 445], [40, 383], [32, 374], [33, 321]], false); ctx.strokeStyle = '#241f1a'; ctx.lineWidth = 8; ctx.stroke(); ctx.strokeStyle = '#966139'; ctx.lineWidth = 4.5; ctx.stroke(); ctx.strokeStyle = '#daa468'; ctx.lineWidth = 1; ctx.stroke();
  for (let y = 475; y < 650; y += 44) { line(ctx, -57, y, -45, y, '#c09459', 2); line(ctx, 43, y - 76, 52, y - 76, '#c09355', 2); }

  // Main wheel and pinion share pitch radii and contra-rotate at the tooth ratio.
  gear(ctx, -18, 350, 28, 20, p, 'brass', 5);
  gear(ctx, 21, 337, 18.5, 14, -p * 20 / 14 + Math.PI / 14, 'copper', 4);
  gear(ctx, -34, 393, 16, 12, -p * 20 / 12 + .2, 'brass', 4);
  // Bearing axles sit in front of the wheels and visually fasten them into the wall.
  circle(ctx, -18, 350, 3.5, '#2c3431', '#e5c47d', 1); circle(ctx, 21, 337, 3, '#2e332e', '#efc57e', 1);

  // Anchor escapement and pendulum are locked to a common two-second pendulum cycle.
  const pend = Math.sin(p * 4) * .18;
  gear(ctx, 17, 414, 17, 15, -p * 3 + Math.sin(p * 4) * .06, 'copper', 5);
  ctx.save(); ctx.translate(-6, 430); ctx.rotate(-pend * .72);
  path(ctx, [[-19, -5], [-14, -22], [-4, -27], [11, -19], [20, -9]]); ctx.strokeStyle = '#c59a5e'; ctx.lineWidth = 4; ctx.stroke();
  path(ctx, [[-22, -8], [-16, -5], [-20, 2]]); ctx.fillStyle = '#e1bd78'; ctx.fill();
  path(ctx, [[21, -12], [25, -5], [18, -4]]); ctx.fillStyle = '#e1bd78'; ctx.fill();
  ctx.restore();
  circle(ctx, -6, 430, 6, '#4a3e2c', '#e3bd75', 1.4); circle(ctx, -6, 430, 2, '#17272b');
  const bx = -6 + Math.sin(pend) * 126, by = 430 + Math.cos(pend) * 126;
  line(ctx, -6, 430, bx, by, '#241f19', 4); line(ctx, -6, 430, bx, by, '#c7a065', 1.8);
  circle(ctx, bx, by, 12.5, '#55472e', '#e1b874', 1.6); circle(ctx, bx - 2.5, by - 3, 8, '#a88a50'); circle(ctx, bx - 4, by - 5, 2.2, 'rgba(255,224,153,.65)');

  wallLamp(ctx, -48, 473, power); wallLamp(ctx, 48, 491, power);
  gauge(ctx, 27, 472, 11.5, .25 + storm * .62 + pulse.envelope * .15, t);
  gauge(ctx, 5, 498, 7.2, .62 + Math.sin(p * 2) * .08, t);
  path(ctx, [[-30, 510], [-20, 510], [-20, 535]]); ctx.strokeStyle = '#94704a'; ctx.lineWidth = 2.5; ctx.stroke();

  // Boiler shell, rivets, firebox and separate feed-water tank.
  const boiler = ctx.createLinearGradient(-48, 0, 3, 0); boiler.addColorStop(0, '#583d2c'); boiler.addColorStop(.4, '#ab7144'); boiler.addColorStop(.72, '#785034'); boiler.addColorStop(1, '#342c26');
  ctx.beginPath(); ctx.moveTo(-48, 569); ctx.quadraticCurveTo(-45, 543, -25, 542); ctx.quadraticCurveTo(-5, 544, -3, 569); ctx.lineTo(-3, 671); ctx.lineTo(-48, 671); ctx.closePath(); ctx.fillStyle = boiler; ctx.fill(); ctx.strokeStyle = '#201f1d'; ctx.lineWidth = 2; ctx.stroke();
  for (let y = 574; y < 665; y += 31) { line(ctx, -48, y, -3, y, '#d09958', 2); line(ctx, -47, y + 2, -4, y + 2, '#3e2d23', 1); for (let x = -42; x < -5; x += 12) circle(ctx, x, y, 1, '#edbb70'); }
  path(ctx, [[-39, 610], [-12, 610], [-12, 651], [-39, 651]]); ctx.fillStyle = '#2b2b27'; ctx.fill(); ctx.strokeStyle = '#c18b4e'; ctx.lineWidth = 2; ctx.stroke();
  path(ctx, [[-34, 644], [-33, 624], [-26, 615], [-19, 625], [-18, 644]]); const fire = ctx.createLinearGradient(0, 619, 0, 647); fire.addColorStop(0, '#ffd37b'); fire.addColorStop(1, '#b9562d'); ctx.fillStyle = fire; ctx.globalAlpha = .4 + power * .6; ctx.fill(); ctx.globalAlpha = 1;
  for (let i = 0; i < 4; i++) line(ctx, -36 + i * 5.4, 631, -36 + i * 5.4, 649, '#342d25', 1.2);
  line(ctx, -45, 674, -47, 687, '#7a6847', 4); line(ctx, -6, 674, -8, 687, '#7a6847', 4);

  // Stairs are foreground geometry and occlude the boiler/pendulum correctly.
  path(ctx, [[9, 548], [68, 675]]); ctx.strokeStyle = '#171e20'; ctx.lineWidth = 6; ctx.stroke();
  path(ctx, [[17, 545], [77, 672]]); ctx.strokeStyle = '#536063'; ctx.lineWidth = 3; ctx.stroke();
  for (let i = 0; i < 15; i++) {
    const y = 551 + i * 8.5, x = 12 + i * 4;
    path(ctx, [[x - 3, y], [x + 29, y + 3], [x + 24, y + 7], [x - 6, y + 4]]);
    ctx.fillStyle = i % 2 ? '#7b7460' : '#8d8063'; ctx.fill(); ctx.strokeStyle = '#202b2d'; ctx.lineWidth = .8; ctx.stroke();
    if (i % 3 === 0) line(ctx, x + 24, y + 2, x + 18, y - 22, '#968466', 1.2);
  }
  path(ctx, [[8, 528], [38, 580], [72, 652]]); ctx.strokeStyle = '#c09b64'; ctx.lineWidth = 2.3; ctx.stroke();
  line(ctx, -61, 685, 75, 685, '#b09a6d', 2);
  ctx.restore();

  // Masonry cut edge / arch voussoirs sit in front of the mechanism.
  aperture(); ctx.strokeStyle = '#13232b'; ctx.lineWidth = 11; ctx.stroke();
  aperture(); ctx.strokeStyle = '#64706c'; ctx.lineWidth = 6.5; ctx.stroke();
  aperture(); ctx.strokeStyle = 'rgba(170,170,137,.35)'; ctx.lineWidth = 1.2; ctx.stroke();
  for (let i = 0; i < 11; i++) {
    const a = Math.PI + i / 10 * Math.PI;
    const x = Math.cos(a) * 62, y = 346 + Math.sin(a) * 58;
    line(ctx, x, y, Math.cos(a) * 69, 346 + Math.sin(a) * 67, '#172a31', 1.2);
  }
  for (let y = 365; y < 685; y += 28) { line(ctx, -68, y, -56, y + 1, '#192c33', 1); line(ctx, 56, y, 69, y + 1, '#172931', 1); }
  ctx.restore();
}

function drawTowerBody(ctx, scene) {
  const { day } = scene;
  ctx.save(); ctx.translate(1000, 0);
  const bodyGrad = ctx.createLinearGradient(-90, 0, 94, 0);
  bodyGrad.addColorStop(0, hexMix('#526974', '#8b9993', day)); bodyGrad.addColorStop(.36, hexMix('#738184', '#b0b3a5', day)); bodyGrad.addColorStop(.64, hexMix('#485f6a', '#8a9890', day)); bodyGrad.addColorStop(1, '#304853');
  path(ctx, [[-53, 216], [53, 216], [89, 702], [77, 713], [-80, 713], [-92, 702]]); ctx.fillStyle = bodyGrad; ctx.fill(); ctx.strokeStyle = '#101f29'; ctx.lineWidth = 3; ctx.stroke();
  ctx.save(); path(ctx, [[-53, 216], [53, 216], [89, 702], [-92, 702]]); ctx.clip();
  for (let y = 239, row = 0; y < 706; y += 19, row++) {
    const half = 53 + (y - 216) * .073;
    line(ctx, -half, y, half, y + .5, '#233a45', 1);
    line(ctx, -half, y + 1.5, half, y + 2, 'rgba(153,170,158,.23)', .7);
    for (let x = -85 + (row % 2) * 15; x < 100; x += 31) line(ctx, x, y, x + .5, y + 19, '#2c434c', .75);
  }
  const shade = ctx.createLinearGradient(-90, 0, 96, 0); shade.addColorStop(0, 'rgba(6,23,34,.27)'); shade.addColorStop(.4, 'rgba(255,245,201,.05)'); shade.addColorStop(1, 'rgba(4,18,29,.32)'); ctx.fillStyle = shade; ctx.fillRect(-100, 210, 200, 510);
  ctx.restore();
  drawCutaway(ctx, scene);
  // Plinth and two foundation courses.
  path(ctx, [[-92, 691], [91, 691], [96, 710], [79, 719], [-79, 719], [-97, 710]]); ctx.fillStyle = '#405660'; ctx.fill(); ctx.strokeStyle = '#142630'; ctx.lineWidth = 2.5; ctx.stroke();
  line(ctx, -91, 702, 92, 702, '#91a097', 1.2); line(ctx, -82, 710, 82, 710, '#203941', 1.2);
  ctx.restore();
}

function drawLantern(ctx, scene, optics) {
  const { day, t, pulse } = scene;
  const p = t / 8 * TAU;
  const power = clamp(.92 - day * .4 + pulse.envelope * .3);
  ctx.save(); ctx.translate(1000, 0);
  // Octagonal gallery pedestal and projecting walkway.
  path(ctx, [[-61, 211], [-76, 222], [-63, 231], [58, 231], [75, 222], [61, 211]]);
  const deck = ctx.createLinearGradient(0, 211, 0, 232); deck.addColorStop(0, '#82918c'); deck.addColorStop(1, '#354d58'); ctx.fillStyle = deck; ctx.fill(); ctx.strokeStyle = '#10232f'; ctx.lineWidth = 2.4; ctx.stroke();
  line(ctx, -74, 221, 73, 221, '#a0a89b', 1.2);
  // Lantern glass enclosure, each pane separately framed.
  glow(ctx, 0, 158, 113, `rgba(113,226,229,${.24 * power})`);
  path(ctx, [[-46, 117], [45, 117], [50, 201], [-51, 201]]);
  const glass = ctx.createLinearGradient(-45, 115, 52, 199); glass.addColorStop(0, `rgba(108,178,184,${.34 + power * .2})`); glass.addColorStop(.5, `rgba(155,226,214,${.18 + power * .12})`); glass.addColorStop(1, 'rgba(51,102,122,.65)'); ctx.fillStyle = glass; ctx.fill(); ctx.strokeStyle = '#152d37'; ctx.lineWidth = 2; ctx.stroke();
  for (let i = 0; i < 6; i++) {
    const x = -46 + i * 18;
    path(ctx, [[x, 121], [x + 17, 121], [x + 19, 197], [x - 2, 197]]); ctx.fillStyle = i % 2 ? 'rgba(195,235,217,.06)' : 'rgba(75,151,171,.1)'; ctx.fill(); ctx.strokeStyle = 'rgba(139,195,191,.27)'; ctx.lineWidth = .65; ctx.stroke();
  }
  // Rotating annular Fresnel lens: projected width and specular ridge share a single optical phase.
  ctx.save(); ctx.translate(0, 157); const projection = .52 + .48 * Math.abs(Math.cos(p)); ctx.scale(projection, 1);
  const lens = ctx.createRadialGradient(-5, -9, 2, 0, 0, 34); lens.addColorStop(0, `rgba(255,251,198,${.85 * power})`); lens.addColorStop(.25, `rgba(202,247,220,${.68 * power})`); lens.addColorStop(.66, 'rgba(98,193,191,.35)'); lens.addColorStop(1, 'rgba(50,119,134,.12)');
  ctx.beginPath(); ctx.ellipse(0, 0, 25, 35, 0, 0, TAU); ctx.fillStyle = lens; ctx.fill(); ctx.strokeStyle = '#b0d8c1'; ctx.lineWidth = 1.4; ctx.stroke();
  for (let i = -6; i <= 6; i++) {
    const y = i * 4.8, half = Math.sqrt(Math.max(0, 1 - (y / 35) ** 2)) * 25;
    ctx.beginPath(); ctx.ellipse(0, y, half, 3.3, 0, 0, Math.PI); ctx.strokeStyle = `rgba(225,249,215,${.25 + power * .33})`; ctx.lineWidth = 1; ctx.stroke();
    ctx.beginPath(); ctx.ellipse(0, y + 1.2, half, 2.8, 0, Math.PI, TAU); ctx.strokeStyle = 'rgba(40,113,126,.48)'; ctx.lineWidth = .75; ctx.stroke();
  }
  circle(ctx, 0, 0, 12, `rgba(244,248,191,${.4 + power * .32})`, '#d5ddb0', 1);
  const ridgeX = Math.sin(p) * 17;
  line(ctx, ridgeX, -27, ridgeX, 26, `rgba(255,255,225,${.45 + power * .4})`, 2);
  ctx.restore();
  // Structural mullions are in front of the optical element.
  for (const x of [-49, -25, 0, 25, 48]) { line(ctx, x, 117, x * 1.04, 201, '#263f48', x === 0 ? 3 : 2.2); line(ctx, x + 1.1, 118, x * 1.04 + 1.1, 200, 'rgba(164,193,180,.4)', .6); }
  line(ctx, -50, 137, 50, 137, '#38545a', 2.2); line(ctx, -52, 196, 52, 196, '#8a9b91', 3);
  // Veranda posts, rails and cross-braces outside the lantern room.
  path(ctx, [[-67, 185], [-72, 219]]); ctx.strokeStyle = '#142d39'; ctx.lineWidth = 2.3; ctx.stroke();
  for (let i = 0; i <= 12; i++) {
    const x = -69 + i * 11.4;
    line(ctx, x, 185 + Math.abs(x) * .012, x + Math.sign(x) * 5, 220, '#19333e', 1.7);
    line(ctx, x + 1, 188, x + Math.sign(x) * 5 + 1, 218, 'rgba(139,170,174,.43)', .55);
  }
  path(ctx, [[-68, 185], [-47, 181], [47, 181], [68, 185]]); ctx.strokeStyle = '#8c9d96'; ctx.lineWidth = 2; ctx.stroke();
  path(ctx, [[-72, 219], [-48, 215], [48, 215], [72, 219]]); ctx.strokeStyle = '#152f3b'; ctx.lineWidth = 2.1; ctx.stroke();
  // Conical copper-slate roof, standing seams and ventilator finial.
  path(ctx, [[-55, 113], [-34, 95], [-13, 80], [13, 80], [34, 95], [56, 113], [47, 120], [-46, 120]]);
  const roof = ctx.createLinearGradient(-50, 88, 53, 117); roof.addColorStop(0, '#6c8587'); roof.addColorStop(.48, '#425f67'); roof.addColorStop(1, '#203d4d'); ctx.fillStyle = roof; ctx.fill(); ctx.strokeStyle = '#102736'; ctx.lineWidth = 2; ctx.stroke();
  for (const x of [-42, -25, 0, 25, 42]) line(ctx, 0, 80, x, 114, x === 0 ? '#a1b0a1' : '#274853', .85);
  path(ctx, [[-59, 114], [-48, 119], [48, 119], [59, 114]]); ctx.fillStyle = '#81938b'; ctx.fill(); ctx.strokeStyle = '#16323e'; ctx.lineWidth = 1.5; ctx.stroke();
  path(ctx, [[-10, 80], [-9, 72], [-5, 68], [5, 68], [9, 72], [10, 80]]); ctx.fillStyle = '#547078'; ctx.fill(); ctx.stroke();
  circle(ctx, 0, 66, 5, '#71847d', '#193442', 1.4); line(ctx, 0, 61, 0, 48, '#284751', 1.8); circle(ctx, 0, 48, 1.6, '#a4afa0');
  const beaconFlash = clamp(pulse.envelope * (.7 + .3 * Math.sin((Number.isFinite(pulse.age) ? pulse.age : 0) * 18)));
  if (beaconFlash > .02) glow(ctx, 0, 157, 165, `rgba(205,255,225,${beaconFlash * .43})`);
  circle(ctx, 0, 157, 4 + beaconFlash * 2, `rgba(255,255,220,${.52 + power * .4})`);
  ctx.restore();
}

function drawServiceHouse(ctx, scene) {
  const { day, pulse, t } = scene;
  const p = t / 8 * TAU;
  const power = clamp(1 - day * .86 + pulse.envelope * .12);
  ctx.save(); ctx.translate(1058, 0);
  // Chimney and deterministic wisps sit behind the pitched roof.
  path(ctx, [[75, 595], [77, 560], [88, 560], [90, 596]]); ctx.fillStyle = '#3c4e55'; ctx.fill(); ctx.strokeStyle = '#162b36'; ctx.lineWidth = 1.6; ctx.stroke();
  line(ctx, 75, 567, 89, 567, '#82908a', 1);
  for (let i = 0; i < 5; i++) {
    const q = (i / 5 + t / 8) % 1;
    const x = 82 + Math.sin(q * 5 + p) * 5 - q * 12;
    const y = 554 - q * 55;
    circle(ctx, x, y, 5 + q * 8, `rgba(141,160,165,${(1 - q) * (.05 + scene.storm * .07)})`);
  }
  path(ctx, [[2, 622], [89, 619], [102, 698], [-3, 698]]); ctx.fillStyle = hexMix('#435963', '#84938b', day); ctx.fill(); ctx.strokeStyle = '#112630'; ctx.lineWidth = 2.3; ctx.stroke();
  ctx.save(); path(ctx, [[2, 622], [89, 619], [102, 698], [-3, 698]]); ctx.clip();
  for (let y = 636, row = 0; y < 699; y += 16, row++) { line(ctx, -5, y, 104, y, '#263e48', .9); for (let x = -5 + row % 2 * 13; x < 110; x += 27) line(ctx, x, y, x, y + 16, '#263d45', .7); }
  ctx.restore();
  path(ctx, [[-15, 621], [42, 578], [78, 577], [117, 622], [97, 629], [39, 595], [0, 630]]); const roof = ctx.createLinearGradient(0, 580, 0, 627); roof.addColorStop(0, '#4d5c63'); roof.addColorStop(1, '#253943'); ctx.fillStyle = roof; ctx.fill(); ctx.strokeStyle = '#10242f'; ctx.lineWidth = 2.4; ctx.stroke();
  for (let i = 0; i < 7; i++) { line(ctx, 40, 583 + i * 3, -5 + i * 3, 620, 'rgba(121,139,138,.25)', .75); line(ctx, 48 + i * 6, 583, 64 + i * 7, 619, '#172d38', .7); }
  line(ctx, 42, 578, 79, 577, '#97a399', 1.6);
  // Warm arched window with masonry surround and mullion.
  glow(ctx, 41, 658, 56, `rgba(247,169,66,${.14 * power})`);
  ctx.beginPath(); ctx.moveTo(30, 680); ctx.lineTo(30, 650); ctx.quadraticCurveTo(41, 632, 52, 650); ctx.lineTo(52, 680); ctx.closePath(); ctx.fillStyle = '#1d3035'; ctx.fill(); ctx.strokeStyle = '#87928a'; ctx.lineWidth = 3; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(34, 677); ctx.lineTo(34, 651); ctx.quadraticCurveTo(41, 641, 48, 651); ctx.lineTo(48, 677); ctx.closePath(); ctx.fillStyle = `rgba(255,201,99,${.27 + power * .73})`; ctx.fill();
  line(ctx, 41, 646, 41, 678, '#65533a', 1.4); line(ctx, 34, 659, 48, 659, '#65533a', 1.2);
  path(ctx, [[69, 697], [69, 646], [91, 646], [95, 697]]); ctx.fillStyle = '#253b43'; ctx.fill(); ctx.strokeStyle = '#182d37'; ctx.lineWidth = 1.5; ctx.stroke(); circle(ctx, 86, 671, 1.7, '#b39760');
  path(ctx, [[79, 696], [113, 696], [121, 705], [84, 705]]); ctx.fillStyle = '#53636a'; ctx.fill(); ctx.strokeStyle = '#213842'; ctx.lineWidth = 1.2; ctx.stroke();
  ctx.restore();
}

export function drawPressureRings(ctx, scene) {
  const { pulse } = scene;
  if (pulse.age > 3.2) return;
  ctx.save();
  for (const [origin, baseDelay] of [[{ x: 1000, y: 165 }, 0], [{ x: 1102, y: 606 }, .22]]) {
    for (let i = 0; i < 3; i++) {
      const age = pulse.age - baseDelay - i * .24;
      if (age < 0 || age > 2.65) continue;
      const r = 25 + age * 99;
      const alpha = Math.pow(1 - age / 2.65, 1.5) * .5;
      ctx.beginPath(); ctx.arc(origin.x, origin.y, r, 0, TAU);
      ctx.strokeStyle = `rgba(186,234,224,${alpha})`; ctx.lineWidth = 1.8 - age * .35; ctx.stroke();
      ctx.beginPath(); ctx.arc(origin.x, origin.y, r + 4, -.5, 1.4); ctx.strokeStyle = `rgba(237,207,143,${alpha * .42})`; ctx.lineWidth = .8; ctx.stroke();
    }
  }
  ctx.restore();
}

export function drawLighthouse(ctx, scene, optics) {
  drawCliff(ctx, scene);
  drawTowerBody(ctx, scene);
  drawLantern(ctx, scene, optics);
  drawServiceHouse(ctx, scene);
  drawPressureRings(ctx, scene);
}
