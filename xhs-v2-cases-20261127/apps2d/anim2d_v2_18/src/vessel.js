import { TAU, clamp, lerp, path, line, circle, glow, hexMix } from './utils.js';
import { waveY } from './environment.js';

export function drawBreakwater(ctx, scene) {
  const { day } = scene;
  ctx.save();
  const wall = path(ctx, [[-40, 470], [488, 412], [546, 430], [548, 493], [-40, 568]]);
  ctx.fillStyle = hexMix('#34434a', '#737f7b', day); ctx.fill();
  ctx.strokeStyle = '#142837'; ctx.lineWidth = 2.4; ctx.stroke();
  const top = path(ctx, [[-40, 457], [476, 402], [548, 424], [544, 439], [487, 421], [-40, 480]]);
  ctx.fillStyle = hexMix('#52636b', '#93a098', day); ctx.fill(); ctx.stroke();
  ctx.save(); path(ctx, [[-40, 470], [488, 412], [546, 430], [548, 493], [-40, 568]]); ctx.clip();
  for (let row = 0; row < 6; row++) {
    const y = 422 + row * 23;
    line(ctx, -20, y + 55, 562, y - 6, '#172b36', 1.2);
    for (let col = -1; col < 14; col++) {
      const x = col * 49 + (row % 2) * 25;
      line(ctx, x, y + 58, x + 4, y + 31, '#1e3440', .9);
      line(ctx, x + 5, y + 31, x + 46, y + 26, 'rgba(131,151,151,.16)', .7);
    }
  }
  ctx.restore();
  // The rear channel marker is deliberately much smaller than the two foreground buoys.
  ctx.fillStyle = '#4a5a5c'; ctx.fillRect(473, 389, 18, 30);
  ctx.fillStyle = '#718481'; path(ctx, [[468, 389], [482, 382], [496, 389]]); ctx.fill();
  ctx.fillStyle = '#3f565d'; path(ctx, [[479, 382], [480, 327], [485, 320], [490, 328], [490, 383]]); ctx.fill();
  ctx.strokeStyle = '#192e3b'; ctx.lineWidth = 1.5; ctx.stroke();
  line(ctx, 475, 382, 475, 417, '#96aaa4', 1);
  line(ctx, 477, 337, 492, 337, '#789299', 1);
  const beacon = .4 + scene.pulse.envelope * .6;
  glow(ctx, 486, 324, 16, `rgba(244,165,106,${.13 * beacon})`);
  circle(ctx, 486, 324, 2.1, `rgba(245,178,110,${beacon})`, '#2d4249', .8);
  ctx.restore();
}

function sailPath(ctx, points, fill, stroke = '#172d3a') {
  path(ctx, points); ctx.fillStyle = fill; ctx.fill(); ctx.strokeStyle = stroke; ctx.lineWidth = 1.8; ctx.stroke();
}

function drawSailSeams(ctx, start, end, count, curve = 0) {
  for (let i = 1; i < count; i++) {
    const q = i / count;
    const x1 = lerp(start[0], end[0], q), y1 = lerp(start[1], end[1], q);
    ctx.beginPath(); ctx.moveTo(x1, y1);
    ctx.quadraticCurveTo(x1 + curve, y1 + 38, lerp(start[0], end[0], q) + 5, end[1]);
    ctx.strokeStyle = 'rgba(26,54,65,.29)'; ctx.lineWidth = .7; ctx.stroke();
  }
}

export function drawShip(ctx, scene) {
  const { t, storm, day, pulse } = scene;
  const p = t / 8 * TAU;
  const sea = waveY(320, 1, t, storm);
  const heave = Math.sin(p * 2 + .7) * (2.5 + storm * 7.2) + (sea - 431) * .22;
  const pitch = Math.sin(p * 2 + 1.1) * (.012 + storm * .033) + Math.sin(p * 3) * storm * .006;
  ctx.save(); ctx.translate(318, 517 + heave); ctx.rotate(pitch); ctx.scale(1.02, 1.02);

  // A broken reflection travels with the same hull transform, avoiding a detached shadow.
  ctx.save(); ctx.translate(0, 72); ctx.scale(1, -.23); ctx.globalAlpha = .18;
  path(ctx, [[-165, 0], [170, 0], [118, 55], [-97, 65]]); ctx.fillStyle = '#031b2b'; ctx.fill(); ctx.restore();

  // Rear rigging, masts and spars.
  line(ctx, -159, 49, -73, -276, '#101f2b', 1.1);
  line(ctx, -73, -276, 178, 34, '#142633', 1);
  line(ctx, 54, -251, -149, 42, '#142633', 1.1);
  line(ctx, 54, -251, 192, 27, '#142633', 1.3);
  line(ctx, -73, -267, 57, -248, '#233741', .8);
  line(ctx, -77, -279, -77, 35, '#17262c', 4.2);
  line(ctx, -75, -278, -75, 31, '#8c8064', 1.2);
  line(ctx, 52, -255, 52, 34, '#17262c', 4);
  line(ctx, 54, -252, 54, 32, '#8f8267', 1);
  line(ctx, -145, -192, -10, -179, '#372f29', 4);
  line(ctx, -144, -194, -9, -181, '#8d8169', 1);
  line(ctx, -5, -171, 110, -177, '#372f29', 4.2);
  line(ctx, -4, -173, 111, -179, '#938269', 1);
  line(ctx, -128, -76, -30, -67, '#393129', 3);
  line(ctx, 8, -57, 119, -42, '#393129', 3);

  // Three principal sails and two narrow staysails, all real Canvas paths.
  let sail = ctx.createLinearGradient(-90, -190, -30, -35);
  sail.addColorStop(0, hexMix('#688390', '#bbc5b9', day)); sail.addColorStop(.68, hexMix('#5b7e86', '#a7b5a7', day)); sail.addColorStop(1, hexMix('#b59c71', '#e4d5a7', day));
  sailPath(ctx, [[-140, -188], [-20, -178], [-26, -147], [-35, -94], [-42, -34], [-83, -50], [-124, -61]], sail);
  drawSailSeams(ctx, [-136, -185], [-48, -36], 6, -8);
  ctx.beginPath(); ctx.moveTo(-132, -177); ctx.quadraticCurveTo(-109, -98, -53, -46); ctx.strokeStyle = 'rgba(204,220,209,.15)'; ctx.lineWidth = 1.2; ctx.stroke();

  sail = ctx.createLinearGradient(25, -169, 71, -32);
  sail.addColorStop(0, hexMix('#738a91', '#c5cbbd', day)); sail.addColorStop(.75, hexMix('#6b8889', '#b0baa8', day)); sail.addColorStop(1, hexMix('#c3a470', '#ecdaad', day));
  sailPath(ctx, [[-1, -166], [102, -173], [102, -117], [96, -59], [87, 9], [37, -4], [10, -22]], sail);
  drawSailSeams(ctx, [5, -163], [22, -21], 7, 6);
  for (let i = 0; i < 4; i++) line(ctx, 10 + i * 20, -153, 22 + i * 16, -29, 'rgba(199,216,204,.12)', .8);

  sail = ctx.createLinearGradient(79, -179, 170, 27);
  sail.addColorStop(0, hexMix('#7d9499', '#c5cec2', day)); sail.addColorStop(1, hexMix('#a69877', '#e5d6b5', day));
  sailPath(ctx, [[59, -211], [186, 24], [104, 1], [78, -52]], sail);
  line(ctx, 65, -199, 166, 13, 'rgba(36,57,60,.28)', .8);
  sailPath(ctx, [[61, -147], [137, -1], [77, -16]], hexMix('#65848d', '#adbdb4', day));
  sailPath(ctx, [[-77, -265], [-123, -194], [-77, -204]], hexMix('#69878e', '#afbeb8', day));

  // Ratlines and front standing rigging.
  for (let i = 0; i < 8; i++) {
    const q = i / 8;
    line(ctx, -76 - 39 * q, -165 + 169 * q, -76 + 22 * q, -165 + 169 * q, 'rgba(18,36,43,.72)', .75);
  }
  line(ctx, -154, 30, 55, -249, 'rgba(18,34,42,.8)', .85);
  line(ctx, -51, 32, 193, 25, '#172c35', 1);
  line(ctx, 54, -246, 181, 28, '#182b32', .8);
  line(ctx, -76, -278, -93, -261, '#182b32', 1.3);
  path(ctx, [[-92, -262], [-113, -267], [-98, -274], [-92, -272]]); ctx.fillStyle = '#a46b52'; ctx.fill(); ctx.strokeStyle = '#26343b'; ctx.lineWidth = 1; ctx.stroke();

  // Hull shape, strakes and visibly planked deck.
  const hull = ctx.createLinearGradient(0, 12, 0, 87);
  hull.addColorStop(0, '#665641'); hull.addColorStop(.38, '#3e4038'); hull.addColorStop(1, '#162e37');
  path(ctx, [[-177, 21], [-148, 13], [-79, 18], [24, 15], [122, 7], [192, 24], [170, 47], [122, 72], [65, 84], [-88, 82], [-142, 62], [-164, 47]]);
  ctx.fillStyle = hull; ctx.fill(); ctx.strokeStyle = '#101f28'; ctx.lineWidth = 2.5; ctx.stroke();
  path(ctx, [[-177, 21], [-101, 30], [16, 25], [115, 15], [192, 24], [147, 28], [48, 34], [-85, 39], [-162, 32]]); ctx.fillStyle = '#807257'; ctx.fill(); ctx.strokeStyle = '#1b2d32'; ctx.lineWidth = 1.5; ctx.stroke();
  for (let i = 0; i < 5; i++) {
    ctx.beginPath(); ctx.moveTo(-155 + i * 3, 41 + i * 7); ctx.quadraticCurveTo(-15, 57 + i * 5, 151 - i * 9, 41 + i * 6);
    ctx.strokeStyle = i === 2 ? 'rgba(153,133,84,.48)' : 'rgba(15,30,35,.7)'; ctx.lineWidth = i === 2 ? 1.6 : 1; ctx.stroke();
  }
  for (let i = 0; i < 15; i++) {
    const x = -145 + i * 20;
    line(ctx, x, 34, x + 2, 45 + Math.sin(i) * 4, 'rgba(20,31,31,.5)', .8);
  }
  line(ctx, -178, 18, -88, 26, '#c0a574', 1.1); line(ctx, -86, 27, 185, 20, '#9a8968', 1);

  // Low aft cabin and its separate warm portholes.
  path(ctx, [[-143, 14], [-127, 0], [-52, 3], [-31, 18]]); ctx.fillStyle = '#58605a'; ctx.fill(); ctx.strokeStyle = '#172b33'; ctx.lineWidth = 1.5; ctx.stroke();
  path(ctx, [[-137, 13], [-125, 4], [-56, 6], [-43, 18]]); ctx.fillStyle = '#6c7160'; ctx.fill();
  const cabinPower = clamp(1 - day * .85 + pulse.envelope * .08);
  glow(ctx, -91, 30, 63, `rgba(242,173,75,${.1 * cabinPower})`);
  for (let i = 0; i < 10; i++) {
    const x = -139 + i * 16;
    const yy = 27 + Math.sin(i * .5) * 2;
    ctx.fillStyle = `rgba(255,200,96,${.34 + cabinPower * .66})`;
    ctx.fillRect(x, yy, 8, 7);
    ctx.strokeStyle = '#162931'; ctx.lineWidth = 1.4; ctx.strokeRect(x, yy, 8, 7);
    line(ctx, x + 4, yy, x + 4, yy + 7, '#795f36', .7);
    if (cabinPower > .25) glow(ctx, x + 4, yy + 3, 12, `rgba(255,183,69,${.08 * cabinPower})`);
  }
  // Bowsprit, stern lantern, helm and deck fittings.
  line(ctx, 131, 12, 202, 17, '#2b3030', 4); line(ctx, 133, 11, 202, 16, '#9f8965', 1);
  line(ctx, -163, 16, -163, -3, '#1c3034', 2);
  circle(ctx, -163, -5, 3, `rgba(250,186,80,${cabinPower})`, '#263438', 1);
  circle(ctx, -46, 10, 8, 'none', '#212e30', 2); circle(ctx, -46, 10, 2, '#8d7955');
  for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; line(ctx, -46, 10, -46 + Math.cos(a) * 10, 10 + Math.sin(a) * 10, '#263339', .8); }
  // Foam lips around the hull are painted last, keeping the planking readable above the waterline.
  for (let i = 0; i < 7; i++) {
    const x = -163 + i * 48;
    const y = 70 + Math.sin(i * 1.7 + p * 2) * (2 + storm * 3);
    ctx.beginPath(); ctx.moveTo(x - 17, y + 3); ctx.quadraticCurveTo(x, y - 3, x + 25, y - 6);
    ctx.strokeStyle = `rgba(192,232,231,${.25 + storm * .48})`; ctx.lineWidth = 1 + storm * 1.6; ctx.stroke();
    if (storm > .3) circle(ctx, x + 14, y - 7, 1 + (i % 3) * storm, `rgba(208,239,235,${storm * .55})`);
  }
  ctx.restore();
}

export function getBuoyLight(optics, x, y) {
  const dx = optics.impact.x - optics.origin.x, dy = optics.impact.y - optics.origin.y;
  const len2 = dx * dx + dy * dy;
  const u = ((x - optics.origin.x) * dx + (y - optics.origin.y) * dy) / len2;
  if (u < .05 || u > 1.25) return 0;
  const px = optics.origin.x + dx * u, py = optics.origin.y + dy * u;
  const d = Math.hypot(x - px, y - py);
  const width = 35 + u * 95;
  return Math.exp(-(d * d) / (width * width)) * optics.strength;
}

export function drawBuoy(ctx, scene, optics, index) {
  const { t, storm, pulse, day } = scene;
  const p = t / 8 * TAU;
  const near = index === 0;
  const x = near ? 560 : 713;
  const water = near ? waveY(x, 1, t, storm) + 58 : waveY(x, 0, t, storm) + 72;
  const heave = Math.sin(p * (near ? 2 : 3) + (near ? .4 : 2.1)) * (near ? 3 : 2) * (.45 + storm);
  const tilt = Math.sin(p * 2 + (near ? 1.4 : .1)) * (.025 + storm * .10) * (near ? 1 : -1);
  const y = water + heave;
  const lit = clamp(getBuoyLight(optics, x, y - 30) * (1 - day * .55));
  const flash = clamp(pulse.envelope * (0.65 + .35 * Math.sin((Number.isFinite(pulse.age) ? pulse.age : 0) * 18)));
  ctx.save(); ctx.translate(x, y); ctx.rotate(tilt); ctx.scale(near ? 1 : .69, near ? 1 : .69);
  // Water contact belongs to the buoy's own frame but remains horizontally foreshortened.
  ctx.save(); ctx.scale(1.7, .25); ctx.beginPath(); ctx.arc(0, 4, 30, 0, TAU); ctx.strokeStyle = `rgba(183,230,225,${.24 + storm * .26})`; ctx.lineWidth = 1.8; ctx.stroke(); ctx.restore();
  path(ctx, [[-25, -1], [-18, -15], [18, -15], [26, -1], [18, 6], [-17, 6]]);
  ctx.fillStyle = hexMix('#6f3136', '#a5574b', day); ctx.fill(); ctx.strokeStyle = '#221f2a'; ctx.lineWidth = 2; ctx.stroke();
  line(ctx, -19, -12, 21, -8, '#d17a64', 1.3);
  // Open lattice rails allow water to remain visible through the navigation buoy.
  path(ctx, [[-14, -15], [-6, -73], [5, -73], [15, -15]]); ctx.strokeStyle = '#8a3940'; ctx.lineWidth = 4; ctx.stroke();
  line(ctx, -12, -20, 11, -48, '#b0524c', 2.3); line(ctx, 12, -20, -9, -48, '#4d2831', 2.2);
  line(ctx, -8, -47, 5, -70, '#be6256', 2); line(ctx, 9, -47, -5, -70, '#5d2c34', 2);
  line(ctx, -16, -18, 15, -18, '#cc7160', 1.2); line(ctx, -8, -47, 9, -47, '#aa584e', 1.2);
  path(ctx, [[-10, -74], [-13, -81], [13, -81], [10, -74]]); ctx.fillStyle = '#5f3339'; ctx.fill(); ctx.strokeStyle = '#242832'; ctx.lineWidth = 1.3; ctx.stroke();
  line(ctx, 0, -81, 0, -96, '#74323a', 2.2);
  if (lit > .04) glow(ctx, 0, -58, 66, `rgba(93,230,239,${lit * .22})`);
  if (flash > .025) glow(ctx, 0, -96, 37, `rgba(255,159,94,${flash * .72})`);
  const buoyLamp = flash > .2 ? `rgba(255,230,169,${.6 + flash * .4})` : lit > .15 ? `rgba(193,255,239,${.52 + lit * .4})` : '#c85446';
  circle(ctx, 0, -96, 5.2, buoyLamp, '#482a32', 1.2);
  circle(ctx, -1.2, -97.3, 1.4, `rgba(255,242,198,${.35 + Math.max(flash, lit) * .65})`);
  if (lit > .12) {
    line(ctx, -14, -17, -6, -72, `rgba(170,247,239,${lit})`, 2.2);
    line(ctx, -23, -2, 18, 3, `rgba(185,247,232,${lit * .75})`, 1.5);
  }
  ctx.restore();
}
