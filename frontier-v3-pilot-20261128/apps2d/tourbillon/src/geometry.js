/**
 * geometry.js — Pure Procedural Horology Vector & Mechanical Component Drawing Primitives.
 *
 * Every gear tooth, pinion leaf, beveled curved spoke, club-tooth escape wheel, Swiss lever
 * anchor pallet fork with ruby stones & visible banking slot, >=10-turn breathing hairspring,
 * coiled mainspring barrel, coaxial 1-minute flying tourbillon cage (slender blued-steel pillars,
 * chamfered golden upper bridge, cutaway sapphire cover, curved guide slot), ruby chaton jewel,
 * and slotted mainplate screw is procedurally synthesized here in Canvas 2D.
 */

const TWO_PI = Math.PI * 2;

/**
 * Traces a crisp involute/epicycloidal watch-gear outer profile path centered at (0, 0).
 */
export function traceHorologyGearPath(ctx, teeth, pitchR, outerR, rootR, addendumRatio = 0.42) {
  const step = TWO_PI / teeth;
  const halfRoot = step * 0.27;
  const halfPitch = step * 0.22;
  const halfTip = step * (0.11 + 0.08 * addendumRatio);
  const midR = (pitchR + rootR) * 0.5;

  ctx.beginPath();
  for (let i = 0; i < teeth; i += 1) {
    const a = i * step;
    const a0 = a - step * 0.5;
    const a1 = a - halfRoot;
    const a2 = a - halfPitch;
    const a3 = a - halfTip;
    const a4 = a + halfTip;
    const a5 = a + halfPitch;
    const a6 = a + halfRoot;

    const x0 = Math.cos(a0) * rootR;
    const y0 = Math.sin(a0) * rootR;
    if (i === 0) ctx.moveTo(x0, y0);
    else ctx.lineTo(x0, y0);

    ctx.lineTo(Math.cos(a1) * rootR, Math.sin(a1) * rootR);
    ctx.quadraticCurveTo(
      Math.cos((a1 + a2) * 0.5) * midR,
      Math.sin((a1 + a2) * 0.5) * midR,
      Math.cos(a2) * pitchR,
      Math.sin(a2) * pitchR
    );
    ctx.lineTo(Math.cos(a3) * outerR, Math.sin(a3) * outerR);
    ctx.quadraticCurveTo(Math.cos(a) * (outerR + 0.45), Math.sin(a) * (outerR + 0.45), Math.cos(a4) * outerR, Math.sin(a4) * outerR);
    ctx.lineTo(Math.cos(a5) * pitchR, Math.sin(a5) * pitchR);
    ctx.quadraticCurveTo(
      Math.cos((a5 + a6) * 0.5) * midR,
      Math.sin((a5 + a6) * 0.5) * midR,
      Math.cos(a6) * rootR,
      Math.sin(a6) * rootR
    );
  }
  ctx.closePath();
}

/**
 * Draws a polished steel horology pinion (with rounded epicycloidal leaves) centered at (0, 0).
 */
export function drawSteelPinion(ctx, leaves, pitchR, outerR, rootR, alpha = 1.0) {
  if (alpha <= 0.01) return;
  ctx.save();
  ctx.globalAlpha *= alpha;
  traceHorologyGearPath(ctx, leaves, pitchR, outerR, rootR, 0.25);

  const grad = ctx.createRadialGradient(-outerR * 0.25, -outerR * 0.25, 1, 0, 0, outerR);
  grad.addColorStop(0, '#eef3f8');
  grad.addColorStop(0.55, '#aeb8c4');
  grad.addColorStop(1, '#687484');
  ctx.fillStyle = grad;
  ctx.fill();

  ctx.lineWidth = 0.85;
  ctx.strokeStyle = '#333d4b';
  ctx.stroke();

  // Inner arbor bore ring
  ctx.beginPath();
  ctx.arc(0, 0, rootR * 0.56, 0, TWO_PI);
  ctx.fillStyle = '#475364';
  ctx.fill();
  ctx.restore();
}

/**
 * Draws a beveled crimson synthetic ruby bearing jewel set in a polished golden chaton.
 */
export function drawRubyBearing(ctx, x, y, outerR, hasChaton = true) {
  ctx.save();
  ctx.translate(x, y);

  if (hasChaton) {
    // Golden bevelled chaton setting
    const chGrad = ctx.createLinearGradient(-outerR, -outerR, outerR, outerR);
    chGrad.addColorStop(0, '#f8e6b8');
    chGrad.addColorStop(0.5, '#cba764');
    chGrad.addColorStop(1, '#7c5f2c');
    ctx.beginPath();
    ctx.arc(0, 0, outerR, 0, TWO_PI);
    ctx.fillStyle = chGrad;
    ctx.fill();
    ctx.lineWidth = 1.0;
    ctx.strokeStyle = '#57421d';
    ctx.stroke();

    // Inner bevel groove
    ctx.beginPath();
    ctx.arc(0, 0, outerR * 0.84, 0, TWO_PI);
    ctx.strokeStyle = 'rgba(255, 248, 224, 0.55)';
    ctx.lineWidth = 0.8;
    ctx.stroke();
  }

  // Deep crimson synthetic corundum ruby
  const rubyR = hasChaton ? outerR * 0.72 : outerR;
  const rGrad = ctx.createRadialGradient(-rubyR * 0.28, -rubyR * 0.28, rubyR * 0.08, 0, 0, rubyR);
  rGrad.addColorStop(0, '#f05a89');
  rGrad.addColorStop(0.35, '#c41e54');
  rGrad.addColorStop(0.8, '#8a1039');
  rGrad.addColorStop(1, '#580823');
  ctx.beginPath();
  ctx.arc(0, 0, rubyR, 0, TWO_PI);
  ctx.fillStyle = rGrad;
  ctx.fill();
  ctx.lineWidth = 0.9;
  ctx.strokeStyle = '#47091d';
  ctx.stroke();

  // Polished oil-sink bevel & specular glint
  ctx.beginPath();
  ctx.arc(0, 0, rubyR * 0.44, 0, TWO_PI);
  ctx.fillStyle = '#4e1326';
  ctx.fill();

  const pivotGrad = ctx.createRadialGradient(-rubyR * 0.1, -rubyR * 0.1, 0.5, 0, 0, rubyR * 0.34);
  pivotGrad.addColorStop(0, '#f7f9fc');
  pivotGrad.addColorStop(0.6, '#b8c3d0');
  pivotGrad.addColorStop(1, '#616d7c');
  ctx.beginPath();
  ctx.arc(0, 0, rubyR * 0.32, 0, TWO_PI);
  ctx.fillStyle = pivotGrad;
  ctx.fill();

  // Specular crescent on ruby dome
  ctx.beginPath();
  ctx.arc(-rubyR * 0.26, -rubyR * 0.28, rubyR * 0.22, 0, TWO_PI);
  ctx.fillStyle = 'rgba(255, 215, 232, 0.45)';
  ctx.fill();

  ctx.restore();
}

/**
 * Draws a slotted watchmaking screw (polished steel or thermally blued steel).
 */
export function drawSlottedScrew(ctx, x, y, radius, slotAngle = 0.7, blued = false, lightAngle = Math.PI * 0.25) {
  ctx.save();
  ctx.translate(x, y);

  // Subtle recessed counterbore shadow
  ctx.beginPath();
  ctx.arc(0, 0, radius + 1.4, 0, TWO_PI);
  ctx.fillStyle = 'rgba(18, 28, 42, 0.26)';
  ctx.fill();

  const lx = Math.cos(lightAngle) * radius;
  const ly = Math.sin(lightAngle) * radius;
  const grad = ctx.createLinearGradient(-lx, -ly, lx, ly);
  if (blued) {
    grad.addColorStop(0, '#78b0f0');
    grad.addColorStop(0.45, '#2b5ca8');
    grad.addColorStop(1, '#122c59');
  } else {
    grad.addColorStop(0, '#f3efe5');
    grad.addColorStop(0.5, '#bbb5a8');
    grad.addColorStop(1, '#7a756b');
  }

  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, TWO_PI);
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.lineWidth = 1.0;
  ctx.strokeStyle = blued ? '#0c1d3c' : '#524e47';
  ctx.stroke();

  // Chamfer ring
  ctx.beginPath();
  ctx.arc(0, 0, radius * 0.82, 0, TWO_PI);
  ctx.strokeStyle = blued ? 'rgba(175, 215, 255, 0.4)' : 'rgba(255, 255, 255, 0.5)';
  ctx.lineWidth = 0.75;
  ctx.stroke();

  // Machined screw slot
  ctx.rotate(slotAngle);
  const slotW = Math.max(2.0, radius * 0.22);
  ctx.fillStyle = blued ? '#0a1833' : '#4a463f';
  ctx.fillRect(-radius * 0.92, -slotW * 0.5, radius * 1.84, slotW);
  ctx.fillStyle = blued ? 'rgba(165, 210, 255, 0.35)' : 'rgba(255, 252, 240, 0.45)';
  ctx.fillRect(-radius * 0.9, slotW * 0.5, radius * 1.8, 0.8);

  ctx.restore();
}

/**
 * Draws the cream circular Swiss mainplate with brushed gold chamfered bezel,
 * subtle perlage grain, recessed navy balance/tourbillon well, and curved cage guide slot.
 */
export function drawMainplate(ctx, layout, cutawayAlpha) {
  const { plate, balance, screws, accentJewel } = layout;

  ctx.save();
  // Outer drop shadow on dark navy horology workbench
  ctx.beginPath();
  ctx.arc(plate.x, plate.y + 4, plate.radius + 5, 0, TWO_PI);
  ctx.fillStyle = 'rgba(5, 10, 20, 0.52)';
  ctx.fill();

  // Brushed metallic gold chamfered outer bezel ring
  const rimGrad = ctx.createLinearGradient(plate.x - plate.radius, plate.y - plate.radius, plate.x + plate.radius, plate.y + plate.radius);
  rimGrad.addColorStop(0, '#f3dfae');
  rimGrad.addColorStop(0.32, '#d5b572');
  rimGrad.addColorStop(0.68, '#b6904c');
  rimGrad.addColorStop(1, '#e8cf97');
  ctx.beginPath();
  ctx.arc(plate.x, plate.y, plate.radius + 10, 0, TWO_PI);
  ctx.fillStyle = rimGrad;
  ctx.fill();
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = '#5c4620';
  ctx.stroke();

  // Warm cream circular mainplate surface matching reference-0.jpg
  const plateGrad = ctx.createRadialGradient(plate.x - 95, plate.y - 80, 40, plate.x, plate.y, plate.radius);
  plateGrad.addColorStop(0, '#fff7e2');
  plateGrad.addColorStop(0.62, '#f9eed3');
  plateGrad.addColorStop(1, '#eadbb8');
  ctx.beginPath();
  ctx.arc(plate.x, plate.y, plate.radius, 0, TWO_PI);
  ctx.fillStyle = plateGrad;
  ctx.fill();

  // Subtle horological perlage / circular graining rings clipped to mainplate
  ctx.save();
  ctx.clip();
  ctx.strokeStyle = 'rgba(182, 154, 102, 0.10)';
  ctx.lineWidth = 1.0;
  for (let r = 65; r < plate.radius; r += 44) {
    ctx.beginPath();
    ctx.arc(plate.x, plate.y, r, 0, TWO_PI);
    ctx.stroke();
  }
  // Inner bezel hairline
  ctx.beginPath();
  ctx.arc(plate.x, plate.y, plate.radius - 1.5, 0, TWO_PI);
  ctx.strokeStyle = 'rgba(130, 102, 54, 0.35)';
  ctx.lineWidth = 1.6;
  ctx.stroke();
  ctx.restore();

  // Recessed circular dark navy tourbillon & balance wheel well
  ctx.save();
  const wellGrad = ctx.createRadialGradient(balance.x - 25, balance.y - 25, 18, balance.x, balance.y, balance.wellRadius);
  wellGrad.addColorStop(0, '#132642');
  wellGrad.addColorStop(0.72, '#0d1c33');
  wellGrad.addColorStop(1, '#081224');
  ctx.beginPath();
  ctx.arc(balance.x, balance.y, balance.wellRadius, 0, TWO_PI);
  ctx.fillStyle = wellGrad;
  ctx.fill();

  // Recessed chamfer bevel lip around the navy well
  ctx.lineWidth = 3.2;
  ctx.strokeStyle = '#c5a565';
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(balance.x, balance.y, balance.wellRadius - 2.2, 0, TWO_PI);
  ctx.lineWidth = 1.4;
  ctx.strokeStyle = 'rgba(8, 16, 30, 0.72)';
  ctx.stroke();

  // VISIBLE CURVED TOURBILLON CAGE GUIDE SLOT (弧形导向槽) machined inside navy well perimeter
  // Continuous 360-deg precision annular groove + 3 bold 108-deg chamfered guide tracks so the
  // 3 sliding guide shoes remain cleanly nested inside the visible curved guide slot across all 360 deg!
  const slotR = balance.guideSlotRadius;
  const slotBoost = 0.78 + 0.22 * (1 - cutawayAlpha);
  ctx.beginPath();
  ctx.arc(balance.x, balance.y, slotR, 0, TWO_PI);
  ctx.strokeStyle = '#060d19';
  ctx.lineWidth = balance.guideSlotHalfWidth * 2.1;
  ctx.stroke();

  // Continuous inner & outer machined steel/cyan annular rail grooves
  ctx.beginPath();
  ctx.arc(balance.x, balance.y, slotR - balance.guideSlotHalfWidth, 0, TWO_PI);
  ctx.lineWidth = 0.9;
  ctx.strokeStyle = `rgba(95, 185, 215, ${0.26 * slotBoost})`;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(balance.x, balance.y, slotR + balance.guideSlotHalfWidth, 0, TWO_PI);
  ctx.lineWidth = 0.9;
  ctx.strokeStyle = `rgba(210, 178, 118, ${0.24 * slotBoost})`;
  ctx.stroke();

  // 3 prominent 106-deg chamfered curved guide slot tracks (exact 3-fold symmetry)
  for (let k = 0; k < 3; k += 1) {
    const aStart = (k * TWO_PI) / 3 - Math.PI / 6 - 0.92;
    const aEnd = (k * TWO_PI) / 3 - Math.PI / 6 + 0.92;

    ctx.beginPath();
    ctx.arc(balance.x, balance.y, slotR - balance.guideSlotHalfWidth, aStart, aEnd);
    ctx.lineCap = 'round';
    ctx.lineWidth = 1.25;
    ctx.strokeStyle = `rgba(116, 198, 224, ${0.52 + 0.36 * (1 - cutawayAlpha)})`;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(balance.x, balance.y, slotR + balance.guideSlotHalfWidth, aStart, aEnd);
    ctx.lineWidth = 1.25;
    ctx.strokeStyle = `rgba(218, 188, 126, ${0.46 + 0.30 * (1 - cutawayAlpha)})`;
    ctx.stroke();
  }

  // Subtle concentric cyan calibration rings inside balance well (echoing reference-0.jpg)
  ctx.strokeStyle = 'rgba(95, 210, 232, 0.16)';
  ctx.lineWidth = 0.85;
  ctx.beginPath();
  ctx.arc(balance.x, balance.y, balance.rimInnerRadius - 2, 0, TWO_PI);
  ctx.stroke();

  // Subtle curved specular glass arc on right edge of well (matching reference-0.jpg)
  ctx.beginPath();
  ctx.arc(balance.x, balance.y, balance.wellRadius - 6, -0.82, 0.96);
  ctx.strokeStyle = `rgba(195, 230, 250, ${0.18 + 0.25 * cutawayAlpha})`;
  ctx.lineWidth = 7.0;
  ctx.lineCap = 'round';
  ctx.stroke();
  ctx.restore();

  // Decorative mainplate slotted screws & accent ruby bearing matching reference-0.jpg
  for (const s of screws) {
    drawSlottedScrew(ctx, s.x, s.y, s.r, s.angle, false);
  }
  drawRubyBearing(ctx, accentJewel.x, accentJewel.y, accentJewel.r, true);

  ctx.restore();
}

/**
 * Draws the Mainspring Barrel (80T outer rim, radially brushed silver-champagne drum,
 * cutaway-revealed coiled mainspring spiral inside, and golden/steel central arbor cap).
 */
export function drawMainspringBarrel(ctx, barrel, barrelAngle, mainspringAngle, cutawayAlpha, highlightWeight = 0) {
  ctx.save();
  ctx.translate(barrel.x, barrel.y);

  // Power-path highlight aura in Act I
  if (highlightWeight > 0.02) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, barrel.outerR + 8, 0, TWO_PI);
    ctx.strokeStyle = `rgba(95, 210, 232, ${0.65 * highlightWeight})`;
    ctx.lineWidth = 4.5;
    ctx.stroke();
    ctx.restore();
  }

  // Subtle shadow under barrel drum
  ctx.beginPath();
  ctx.arc(2, 3, barrel.outerR + 1, 0, TWO_PI);
  ctx.fillStyle = 'rgba(18, 26, 40, 0.22)';
  ctx.fill();

  // Rotating 80-tooth barrel drum
  ctx.save();
  ctx.rotate(barrelAngle);
  traceHorologyGearPath(ctx, barrel.teeth, barrel.pitchR, barrel.outerR, barrel.rootR, 0.48);

  const drumGrad = ctx.createLinearGradient(-barrel.outerR, -barrel.outerR, barrel.outerR, barrel.outerR);
  drumGrad.addColorStop(0, '#ebe8df');
  drumGrad.addColorStop(0.35, '#d5d0c3');
  drumGrad.addColorStop(0.7, '#b7b0a0');
  drumGrad.addColorStop(1, '#ded9cb');
  ctx.fillStyle = drumGrad;
  ctx.fill();
  ctx.lineWidth = 1.05;
  ctx.strokeStyle = '#4e4b43';
  ctx.stroke();

  // Inner barrel recess showing coiled blued-steel mainspring (becomes super crisp as cutaway opens!)
  const cavityR = barrel.rootR - 9;
  ctx.beginPath();
  ctx.arc(0, 0, cavityR, 0, TWO_PI);
  ctx.fillStyle = '#243144';
  ctx.fill();
  ctx.lineWidth = 1.4;
  ctx.strokeStyle = '#736c5e';
  ctx.stroke();

  // Procedural coiled blued-steel mainspring spiral (7.5 thick tempered turns)
  ctx.save();
  ctx.rotate(mainspringAngle - barrelAngle);
  const turns = 7.5;
  const rInner = 34;
  const rOuter = cavityR - 6;
  const pts = 260;
  ctx.beginPath();
  for (let i = 0; i <= pts; i += 1) {
    const u = i / pts;
    const ang = u * turns * TWO_PI;
    const rad = rInner + (rOuter - rInner) * u;
    const px = Math.cos(ang) * rad;
    const py = Math.sin(ang) * rad;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.strokeStyle = '#3b649e';
  ctx.lineWidth = 4.6;
  ctx.lineCap = 'round';
  ctx.stroke();
  ctx.strokeStyle = '#8ec2f7';
  ctx.lineWidth = 1.3;
  ctx.stroke();
  ctx.restore();

  // Brushed barrel cover lid controlled smoothly by cutawayAlpha!
  if (cutawayAlpha > 0.02) {
    ctx.save();
    ctx.globalAlpha = cutawayAlpha;
    const coverGrad = ctx.createRadialGradient(-36, -36, 12, 0, 0, cavityR);
    coverGrad.addColorStop(0, '#f3f0e7');
    coverGrad.addColorStop(0.5, '#d6d1c3');
    coverGrad.addColorStop(0.85, '#bdb6a6');
    coverGrad.addColorStop(1, '#d3cebf');
    ctx.beginPath();
    ctx.arc(0, 0, cavityR, 0, TWO_PI);
    ctx.fillStyle = coverGrad;
    ctx.fill();

    // Fine circular satin sunray brushing lines
    ctx.strokeStyle = 'rgba(110, 104, 92, 0.16)';
    ctx.lineWidth = 0.85;
    for (let r = 46; r < cavityR - 4; r += 7) {
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, TWO_PI);
      ctx.stroke();
    }

    // Subtle recessed groove ring + clockwise torque arrow on barrel lid (matching reference-0.jpg!)
    ctx.beginPath();
    ctx.arc(0, 0, cavityR - 14, 0, TWO_PI);
    ctx.strokeStyle = 'rgba(72, 68, 60, 0.35)';
    ctx.lineWidth = 1.1;
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();

  // Stationary directional mainspring torque arc arrow (matching reference-0.jpg!)
  ctx.save();
  ctx.strokeStyle = cutawayAlpha > 0.35 ? '#2b3646' : '#85d9ee';
  ctx.fillStyle = ctx.strokeStyle;
  ctx.lineWidth = 1.5;
  const arrowR = barrel.rootR - 48;
  ctx.beginPath();
  ctx.arc(0, 0, arrowR, -Math.PI * 0.85, -Math.PI * 0.25);
  ctx.stroke();
  // Arrowhead CW at -pi/4
  const ax = Math.cos(-Math.PI * 0.25) * arrowR;
  const ay = Math.sin(-Math.PI * 0.25) * arrowR;
  ctx.save();
  ctx.translate(ax, ay);
  ctx.rotate(-Math.PI * 0.25 + Math.PI * 0.5);
  ctx.beginPath();
  ctx.moveTo(4, 0);
  ctx.lineTo(-5, -3.5);
  ctx.lineTo(-3.5, 0);
  ctx.lineTo(-5, 3.5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.beginPath();
  ctx.arc(0, 0, arrowR, Math.PI * 0.15, Math.PI * 0.65);
  ctx.stroke();
  ctx.restore();

  // Central golden barrel arbor cap + slotted ratchet screw (stationary arbor)
  const capR = 39;
  const capGrad = ctx.createLinearGradient(-capR, -capR, capR, capR);
  capGrad.addColorStop(0, '#f3dfa7');
  capGrad.addColorStop(0.5, '#cfaa62');
  capGrad.addColorStop(1, '#8c6d33');
  ctx.beginPath();
  ctx.arc(0, 0, capR, 0, TWO_PI);
  ctx.fillStyle = capGrad;
  ctx.fill();
  ctx.lineWidth = 1.3;
  ctx.strokeStyle = '#5b461f';
  ctx.stroke();

  // Two tiny ratchet retaining pins on cap
  drawSlottedScrew(ctx, -28, 0, 5.2, 0.3, false);
  drawSlottedScrew(ctx, 28, 0, 5.2, 0.3, false);
  drawSlottedScrew(ctx, 0, 0, 17, 0.72, false);

  ctx.restore();
}

/**
 * Draws a brass Swiss going-train gear wheel with involute teeth, beveled spokes,
 * coaxial steel pinion underneath (revealed cleanly as cutaway opacity decreases),
 * and central crimson ruby bearing.
 */
export function drawBrassTrainGear(ctx, gear, angle, spokeCount, hasRuby, cutawayAlpha, highlightWeight = 0) {
  ctx.save();
  ctx.translate(gear.x, gear.y);

  // Power-path glow aura in Act I
  if (highlightWeight > 0.02) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, gear.outerR + 6, 0, TWO_PI);
    ctx.strokeStyle = `rgba(95, 210, 232, ${0.72 * highlightWeight})`;
    ctx.lineWidth = 4.0;
    ctx.stroke();
    ctx.restore();
  }

  // Drop shadow on plate
  ctx.beginPath();
  ctx.arc(1.5, 2.5, gear.rootR, 0, TWO_PI);
  ctx.fillStyle = 'rgba(20, 28, 42, 0.16)';
  ctx.fill();

  ctx.save();
  ctx.rotate(angle);

  // 1. Coaxial steel pinion beneath wheel (clearly visible through wheel cutouts & cutaway mode!)
  if (gear.pinion) {
    drawSteelPinion(ctx, gear.pinion, gear.pinionPitchR, gear.pinionOuterR, gear.pinionRootR, 1.0);
  }

  // 2. Outer brass toothed rim + spoked body (slightly translucent at very low cutaway to reveal pinion mesh)
  const rimAlpha = 0.62 + 0.38 * cutawayAlpha;
  ctx.save();
  ctx.globalAlpha = rimAlpha;

  const rimInnerR = gear.rootR * 0.76;
  const hubR = Math.max(gear.pinionOuterR ? gear.pinionOuterR + 4 : 18, gear.rootR * 0.32);

  // Cutout mask using even-odd fill rule so spokes & rim form one crisp solid brass casting
  traceHorologyGearPath(ctx, gear.teeth, gear.pitchR, gear.outerR, gear.rootR, 0.42);
  // Add circular inner rim hole in reverse winding
  ctx.moveTo(rimInnerR, 0);
  ctx.arc(0, 0, rimInnerR, 0, TWO_PI, true);

  const brassGrad = ctx.createLinearGradient(-gear.outerR, -gear.outerR, gear.outerR, gear.outerR);
  brassGrad.addColorStop(0, '#f5e1a8');
  brassGrad.addColorStop(0.35, '#d9b974');
  brassGrad.addColorStop(0.7, '#b59049');
  brassGrad.addColorStop(1, '#e8cf91');
  ctx.fillStyle = brassGrad;
  ctx.fill('evenodd');

  ctx.lineWidth = 0.95;
  ctx.strokeStyle = '#5c471e';
  ctx.stroke();

  // Inner rim bevel highlight ring
  ctx.beginPath();
  ctx.arc(0, 0, (gear.rootR + rimInnerR) * 0.5, 0, TWO_PI);
  ctx.strokeStyle = 'rgba(255, 246, 212, 0.42)';
  ctx.lineWidth = 1.1;
  ctx.stroke();

  // Beveled tapered spokes
  const spokeBaseW = Math.max(8.5, gear.rootR * 0.14);
  const spokeTipW = spokeBaseW * 0.62;
  for (let i = 0; i < spokeCount; i += 1) {
    const a = (i * TWO_PI) / spokeCount;
    ctx.save();
    ctx.rotate(a);
    ctx.beginPath();
    ctx.moveTo(hubR - 2, -spokeBaseW * 0.5);
    ctx.lineTo(rimInnerR + 2, -spokeTipW * 0.5);
    ctx.lineTo(rimInnerR + 2, spokeTipW * 0.5);
    ctx.lineTo(hubR - 2, spokeBaseW * 0.5);
    ctx.closePath();
    ctx.fillStyle = brassGrad;
    ctx.fill();
    ctx.lineWidth = 0.9;
    ctx.strokeStyle = '#624c22';
    ctx.stroke();

    // Central bevel rib highlight on each spoke
    ctx.beginPath();
    ctx.moveTo(hubR + 2, 0);
    ctx.lineTo(rimInnerR - 2, 0);
    ctx.strokeStyle = 'rgba(255, 248, 224, 0.45)';
    ctx.lineWidth = 1.0;
    ctx.stroke();
    ctx.restore();
  }

  // Central golden hub collar
  ctx.beginPath();
  ctx.arc(0, 0, hubR, 0, TWO_PI);
  ctx.fillStyle = brassGrad;
  ctx.fill();
  ctx.lineWidth = 1.0;
  ctx.strokeStyle = '#5c471e';
  ctx.stroke();

  ctx.restore();
  ctx.restore();

  // Re-draw crisp pinion silhouette overlay when cutaway is low (< 40%) so pinion-to-wheel mesh is unmistakable
  if (gear.pinion && cutawayAlpha < 0.45) {
    ctx.save();
    ctx.rotate(angle);
    drawSteelPinion(ctx, gear.pinion, gear.pinionPitchR, gear.pinionOuterR, gear.pinionRootR, (0.45 - cutawayAlpha) * 1.9);
    ctx.restore();
  }

  // Central ruby bearing or steel arbor
  if (hasRuby) {
    drawRubyBearing(ctx, 0, 0, Math.min(20, gear.rootR * 0.24), true);
  } else {
    drawSlottedScrew(ctx, 0, 0, 12, 0.4, false);
  }

  ctx.restore();
}

/**
 * Draws the 15-tooth Swiss Club-Tooth Steel Escape Wheel with 3 curved horological spokes
 * (120-deg symmetry matching 80-cycle / 5+1/3-rev periodic alignment) and coaxial 8L pinion.
 */
export function drawClubToothEscapeWheel(ctx, escape, angle, cutawayAlpha, highlightWeight = 0) {
  ctx.save();
  ctx.translate(escape.x, escape.y);

  // Canonical 3-fold (120-deg) symmetry angle eliminates floating-point raster jitter across full cycles
  const sector = TWO_PI / 3;
  let drawAngle = ((angle % sector) + sector) % sector;
  if (Math.abs(drawAngle - sector) < 1e-5) drawAngle = 0;

  if (highlightWeight > 0.02) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, escape.outerR + 7, 0, TWO_PI);
    ctx.strokeStyle = `rgba(95, 210, 232, ${0.78 * highlightWeight})`;
    ctx.lineWidth = 4.0;
    ctx.stroke();
    ctx.restore();
  }

  ctx.save();
  ctx.rotate(drawAngle);

  // Coaxial 8-leaf escape pinion (tucked cleanly under steel hub at high cutaway, revealed smoothly when cutaway opens!)
  if (cutawayAlpha < 0.65) {
    drawSteelPinion(ctx, escape.pinion, escape.pinionPitchR, escape.pinionOuterR, escape.pinionRootR, Math.min(1.0, (0.65 - cutawayAlpha) * 2.2));
  }

  // 15 forward-leaning club teeth (CW impulse lifting face)
  const teeth = escape.teeth;
  const step = TWO_PI / teeth;
  const rootR = escape.rootR;
  const tipR = escape.outerR;
  const rimInnerR = rootR - 9.5;

  // World-aligned top-left studio lighting so brushed steel highlight stays fixed in space!
  const ldx = Math.cos(-drawAngle + Math.PI * 0.25) * tipR;
  const ldy = Math.sin(-drawAngle + Math.PI * 0.25) * tipR;
  const steelGrad = ctx.createLinearGradient(-ldx, -ldy, ldx, ldy);
  steelGrad.addColorStop(0, '#f3f6fa');
  steelGrad.addColorStop(0.45, '#c6cfd9');
  steelGrad.addColorStop(0.82, '#8d99a8');
  steelGrad.addColorStop(1, '#dce3ec');

  ctx.beginPath();
  for (let i = 0; i < teeth; i += 1) {
    const a = i * step;
    // Undercut root -> forward-leaning leading edge -> angled club impulse tip -> curved trailing back
    const aBaseLead = a - 0.07;
    const aClubLead = a + 0.17;
    const aClubHeel = a + 0.27;
    const aBaseTrail = a + 0.13;
    const aNextRoot = a + step - 0.07;

    const p0x = Math.cos(aBaseLead) * rootR;
    const p0y = Math.sin(aBaseLead) * rootR;
    if (i === 0) ctx.moveTo(p0x, p0y);
    else ctx.lineTo(p0x, p0y);

    // Leading locking face leaning CW
    ctx.lineTo(Math.cos(aClubLead) * tipR, Math.sin(aClubLead) * tipR);
    // Club-tooth lifting impulse face
    ctx.lineTo(Math.cos(aClubHeel) * (tipR - 3.6), Math.sin(aClubHeel) * (tipR - 3.6));
    // Concave trailing flank returning to root
    ctx.quadraticCurveTo(
      Math.cos(aBaseTrail + 0.02) * ((rootR + tipR) * 0.52),
      Math.sin(aBaseTrail + 0.02) * ((rootR + tipR) * 0.52),
      Math.cos(aBaseTrail) * rootR,
      Math.sin(aBaseTrail) * rootR
    );
    ctx.arc(0, 0, rootR, aBaseTrail, aNextRoot);
  }
  ctx.closePath();

  // Subtract circular rim interior
  ctx.moveTo(rimInnerR, 0);
  ctx.arc(0, 0, rimInnerR, 0, TWO_PI, true);

  ctx.fillStyle = steelGrad;
  ctx.fill('evenodd');
  ctx.lineWidth = 1.0;
  ctx.strokeStyle = '#384352';
  ctx.stroke();

  // 3 sculpted curved spokes (exact 120-deg symmetry with true world-aligned studio lighting!)
  const hubR = 16.5;
  for (let i = 0; i < 3; i += 1) {
    const a = (i * TWO_PI) / 3;
    ctx.save();
    ctx.rotate(a);
    const totalA = drawAngle + a;
    const slx = Math.cos(Math.PI * 0.25 - totalA) * tipR;
    const sly = Math.sin(Math.PI * 0.25 - totalA) * tipR;
    const spokeGrad = ctx.createLinearGradient(-slx, -sly, slx, sly);
    spokeGrad.addColorStop(0, '#f3f6fa');
    spokeGrad.addColorStop(0.45, '#c6cfd9');
    spokeGrad.addColorStop(0.82, '#8d99a8');
    spokeGrad.addColorStop(1, '#dce3ec');

    ctx.beginPath();
    ctx.moveTo(hubR - 1, -4.4);
    ctx.quadraticCurveTo((hubR + rimInnerR) * 0.52, -9.5, rimInnerR + 1.5, -3.0);
    ctx.lineTo(rimInnerR + 1.5, 3.0);
    ctx.quadraticCurveTo((hubR + rimInnerR) * 0.52, -3.2, hubR - 1, 4.4);
    ctx.closePath();
    ctx.fillStyle = spokeGrad;
    ctx.fill();
    ctx.lineWidth = 0.9;
    ctx.strokeStyle = '#3d4858';
    ctx.stroke();
    ctx.restore();
  }

  // Steel hub collar
  ctx.beginPath();
  ctx.arc(0, 0, hubR, 0, TWO_PI);
  ctx.fillStyle = steelGrad;
  ctx.fill();
  ctx.lineWidth = 1.0;
  ctx.strokeStyle = '#384352';
  ctx.stroke();

  ctx.restore();

  // Pinion visibility reinforcement when cutaway is low
  if (cutawayAlpha < 0.45) {
    ctx.save();
    ctx.rotate(angle);
    drawSteelPinion(ctx, escape.pinion, escape.pinionPitchR, escape.pinionOuterR, escape.pinionRootR, (0.45 - cutawayAlpha) * 1.6);
    ctx.restore();
  }

  // Polished steel pivot cap with subtle cyan center jewel dot
  ctx.beginPath();
  ctx.arc(0, 0, 8.2, 0, TWO_PI);
  ctx.fillStyle = '#aeb9c7';
  ctx.fill();
  ctx.strokeStyle = '#364150';
  ctx.lineWidth = 1.0;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, 3.2, 0, TWO_PI);
  ctx.fillStyle = '#5fd2e8';
  ctx.fill();

  ctx.restore();
}

/**
 * Draws the Swiss Lever Anchor Pallet Fork, visible machined Banking Slot (限位槽)
 * & Banking Pins, and Crimson Synthetic Ruby Entry/Exit Pallet Stones with live state glow!
 */
export function drawPalletForkAndBanking(ctx, layout, forkAngle, contacts, escapementState, cutawayAlpha) {
  const { pallet } = layout;

  ctx.save();

  // 1. VISIBLE MACHINED BANKING SLOT (限位槽) & BANKING PINS mounted on mainplate
  const slotR = pallet.bankingRadius;
  const aLeft = pallet.stemAngle - pallet.maxBankRad;
  const aRight = pallet.stemAngle + pallet.maxBankRad;

  // Machined curved banking slot recess on mainplate
  ctx.beginPath();
  ctx.arc(pallet.x, pallet.y, slotR, aLeft - 0.08, aRight + 0.08);
  ctx.lineCap = 'round';
  ctx.lineWidth = 11.5;
  ctx.strokeStyle = '#2b394d';
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(pallet.x, pallet.y, slotR, aLeft - 0.05, aRight + 0.05);
  ctx.lineWidth = 6.2;
  ctx.strokeStyle = '#121d2e';
  ctx.stroke();

  // Crisp metallic bevel outline around banking slot
  ctx.beginPath();
  ctx.arc(pallet.x, pallet.y, slotR, aLeft - 0.08, aRight + 0.08);
  ctx.lineWidth = 1.0;
  ctx.strokeStyle = 'rgba(218, 192, 134, 0.65)';
  ctx.stroke();

  // Left & Right Brass/Steel Banking Pins at exact lock limits
  for (const pin of [contacts.leftPin, contacts.rightPin]) {
    ctx.beginPath();
    ctx.arc(pin.x, pin.y, 4.2, 0, TWO_PI);
    const pGrad = ctx.createRadialGradient(pin.x - 1.2, pin.y - 1.2, 0.6, pin.x, pin.y, 4.2);
    pGrad.addColorStop(0, '#fff2cf');
    pGrad.addColorStop(0.55, '#c7a45e');
    pGrad.addColorStop(1, '#5e481e');
    ctx.fillStyle = pGrad;
    ctx.fill();
    ctx.lineWidth = 0.9;
    ctx.strokeStyle = '#2d220e';
    ctx.stroke();
  }

  // 2. PALLET FORK ROTATING BODY centered on palletPivot
  ctx.save();
  ctx.translate(pallet.x, pallet.y);
  ctx.rotate(forkAngle);

  // Compute local coordinates of entry & exit ruby stone seats
  const ex = pallet.entryLocalDist * Math.cos(pallet.entryLocalAngle);
  const ey = pallet.entryLocalDist * Math.sin(pallet.entryLocalAngle);
  const xx = pallet.exitLocalDist * Math.cos(pallet.exitLocalAngle);
  const xy = pallet.exitLocalDist * Math.sin(pallet.exitLocalAngle);
  const midX = (ex + xx) * 0.44;
  const midY = (ey + xy) * 0.44;

  const steelGrad = ctx.createLinearGradient(-150, -30, 30, 80);
  steelGrad.addColorStop(0, '#e6ecf3');
  steelGrad.addColorStop(0.45, '#b6c0cc');
  steelGrad.addColorStop(1, '#798594');

  // Main sculpted Swiss lever arm from pivot -> smooth curved anchor yoke hugging escape circumference
  const yokeX = (ex + xx) * 0.5 + 10;
  const yokeY = (ey + xy) * 0.5;
  const drawAnchorBodyPath = () => {
    // Tapered main lever arm from pivot to anchor yoke center
    ctx.beginPath();
    ctx.moveTo(0, -6.2);
    ctx.lineTo(yokeX + 2, yokeY - 5.2);
    ctx.lineTo(yokeX + 2, yokeY + 5.2);
    ctx.lineTo(0, 6.8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Sculpted curved Swiss anchor yoke bridging entry & exit ruby stone seats
    ctx.beginPath();
    ctx.moveTo(ex * 0.90 - 5, ey * 0.90 - 3);
    ctx.quadraticCurveTo(yokeX + 8, yokeY - 4, xx * 0.90 - 5, xy * 0.90 - 4);
    ctx.lineTo(xx * 0.90 + 6, xy * 0.90 + 3);
    ctx.quadraticCurveTo(yokeX + 18, yokeY + 2, ex * 0.90 + 6, ey * 0.90 + 4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  };

  // Subtle drop shadow under anchor body
  ctx.save();
  ctx.translate(1.5, 2.5);
  ctx.fillStyle = 'rgba(12, 20, 34, 0.22)';
  ctx.strokeStyle = 'rgba(12, 20, 34, 0.0)';
  drawAnchorBodyPath();
  ctx.restore();

  ctx.fillStyle = steelGrad;
  ctx.lineWidth = 1.05;
  ctx.strokeStyle = '#384352';
  drawAnchorBodyPath();

  // Pallet Fork Stem & Impulse Horn Slot pointing along pallet.stemAngle (cleanly on cream plate above navy well!)
  ctx.save();
  ctx.rotate(pallet.stemAngle);
  ctx.beginPath();
  ctx.moveTo(0, -5.8);
  ctx.lineTo(pallet.bankingRadius - 3, -4.6);
  ctx.lineTo(pallet.forkHornRadius + 6, -10.0);
  ctx.lineTo(pallet.forkHornRadius + 8, -4.4);
  ctx.lineTo(pallet.forkHornRadius - 3, -3.4);
  ctx.lineTo(pallet.forkHornRadius - 3, 3.4);
  ctx.lineTo(pallet.forkHornRadius + 8, 4.4);
  ctx.lineTo(pallet.forkHornRadius + 6, 10.0);
  ctx.lineTo(pallet.bankingRadius - 3, 4.6);
  ctx.lineTo(0, 5.8);
  ctx.closePath();
  ctx.fillStyle = steelGrad;
  ctx.fill();
  ctx.lineWidth = 1.05;
  ctx.strokeStyle = '#384352';
  ctx.stroke();

  // Guard dart pin centered in fork horn notch
  ctx.beginPath();
  ctx.moveTo(pallet.forkHornRadius - 2, 0);
  ctx.lineTo(pallet.forkHornRadius + 7, 0);
  ctx.strokeStyle = '#c8a65e';
  ctx.lineWidth = 1.9;
  ctx.stroke();

  // Sliding guide pin seated inside the visible banking slot
  ctx.beginPath();
  ctx.arc(pallet.bankingRadius, 0, 2.9, 0, TWO_PI);
  ctx.fillStyle = '#5fd2e8';
  ctx.fill();
  ctx.strokeStyle = '#18324a';
  ctx.lineWidth = 0.85;
  ctx.stroke();
  ctx.restore();

  // 3. ENTRY & EXIT RUBY PALLET STONES (vivid crimson jewels + active impulse/lock glow)
  const drawPalletStone = (sx, sy, rot, isHighlighted, accentColor) => {
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(rot);

    if (isHighlighted) {
      ctx.beginPath();
      ctx.roundRect(-14, -7, 24, 14, 3);
      ctx.fillStyle = accentColor;
      ctx.fill();
    }

    const rGrad = ctx.createLinearGradient(-12, -5, 10, 5);
    rGrad.addColorStop(0, '#f45b8c');
    rGrad.addColorStop(0.5, '#c41e54');
    rGrad.addColorStop(1, '#750c2e');

    ctx.beginPath();
    ctx.moveTo(-13, -4.8);
    ctx.lineTo(6, -4.8);
    ctx.lineTo(10, 1.5); // angled impulse plane
    ctx.lineTo(5, 4.8);
    ctx.lineTo(-13, 4.8);
    ctx.closePath();
    ctx.fillStyle = rGrad;
    ctx.fill();
    ctx.lineWidth = 1.05;
    ctx.strokeStyle = '#48081e';
    ctx.stroke();

    // Specular facet highlight
    ctx.beginPath();
    ctx.moveTo(-10, -2.5);
    ctx.lineTo(5, -2.5);
    ctx.strokeStyle = 'rgba(255, 220, 236, 0.55)';
    ctx.lineWidth = 1.1;
    ctx.stroke();
    ctx.restore();
  };

  const entryGlow = escapementState === 'IMPULSE' || escapementState === 'RELEASE';
  const exitGlow = escapementState === 'LOCK' || escapementState === 'RELOCK';
  const glowCol =
    escapementState === 'IMPULSE'
      ? 'rgba(95, 210, 232, 0.42)'
      : escapementState === 'RELEASE'
        ? 'rgba(255, 213, 126, 0.42)'
        : 'rgba(232, 82, 130, 0.34)';

  drawPalletStone(ex * 0.94, ey * 0.94, pallet.entryLocalAngle + 0.35, entryGlow, glowCol);
  drawPalletStone(xx * 0.94, xy * 0.94, pallet.exitLocalAngle - 0.45, exitGlow, glowCol);

  // Subtle brass counterpoise accent matching reference-0.jpg upper pallet shoulder
  ctx.beginPath();
  ctx.moveTo(ex * 0.85, ey * 0.85 - 2);
  ctx.lineTo(ex * 0.72, ey * 0.72 - 14);
  ctx.lineTo(ex * 0.63, ey * 0.63 - 6);
  ctx.lineTo(ex * 0.76, ey * 0.76 + 5);
  ctx.closePath();
  ctx.fillStyle = escapementState === 'LOCK' ? '#e5bd73' : '#caa35c';
  ctx.fill();
  ctx.strokeStyle = '#5c461f';
  ctx.lineWidth = 0.9;
  ctx.stroke();

  ctx.restore();

  // Pallet Fork Ruby Pivot Bearing
  drawRubyBearing(ctx, pallet.x, pallet.y, 17.5, true);

  // Subtle highlight indicator on active contact point when cutaway opens
  if (cutawayAlpha < 0.7) {
    const kAlpha = 0.35 + 0.5 * (1 - cutawayAlpha);
    ctx.beginPath();
    ctx.arc(contacts.entryStoneTip.x, contacts.entryStoneTip.y, 3.2, 0, TWO_PI);
    ctx.fillStyle = `rgba(126, 232, 255, ${kAlpha})`;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(contacts.exitStoneTip.x, contacts.exitStoneTip.y, 3.2, 0, TWO_PI);
    ctx.fillStyle = `rgba(255, 213, 126, ${kAlpha})`;
    ctx.fill();
  }

  ctx.restore();
}

/**
 * Draws the Balance Wheel, >=10-turn (11-turn) Breathing Archimedean/Breguet Hairspring,
 * Poising Timing Weights, and Coaxial Impulse Roller Jewel inside the navy well.
 */
export function drawBalanceWheelAndHairspring(ctx, balance, balanceAngle, balanceOmega, effectiveRate, highlightWeight = 0) {
  ctx.save();
  ctx.translate(balance.x, balance.y);

  // 1. BREATHING 11-TURN ARCHIMEDEAN / BREGUET HAIRSPRING SPIRAL
  // Inner collet rotates with balanceAngle; outer terminal stud stays pinned to balance cock!
  // Real elastic breathing: radial displacement scales smoothly with (1 - u)^1.15 * sin(phase)
  const turns = balance.hairspringTurns; // 11 turns (>= 10 required!)
  const rIn = balance.hairspringInnerR;
  const rOut = balance.hairspringOuterR;
  const pts = 440;
  const studAngle = -Math.PI * 0.5;
  const breatheScale = balanceAngle * 0.045; // physically visible radial expansion/contraction

  ctx.beginPath();
  for (let i = 0; i <= pts; i += 1) {
    const u = i / pts; // 0 = inner collet pinned to balance shaft, 1 = outer terminal pinned to stud
    const localRot = balanceAngle * (1 - u) * (1 - 0.15 * u);
    const theta = studAngle + (1 - u) * turns * TWO_PI + localRot;
    // Coils breathe radially outward when unwinding and inward when winding
    const envelope = Math.sin(Math.PI * u);
    const rad = rIn + (rOut - rIn) * u + breatheScale * 18.0 * envelope * (1 - 0.25 * Math.cos(theta));
    const px = Math.cos(theta) * rad;
    const py = Math.sin(theta) * rad;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.strokeStyle = '#9ddff2';
  ctx.lineWidth = 1.15;
  ctx.stroke();

  // Outer Breguet terminal overcoil curve anchored cleanly to stud pin
  const studX = Math.cos(studAngle) * (rOut + 4);
  const studY = Math.sin(studAngle) * (rOut + 4);
  ctx.beginPath();
  ctx.arc(studX, studY, 3.0, 0, TWO_PI);
  ctx.fillStyle = '#e5cb94';
  ctx.fill();
  ctx.strokeStyle = '#4e3c1b';
  ctx.lineWidth = 0.8;
  ctx.stroke();

  // 2. ROTATING BALANCE WHEEL (3 sleek beveled steel/glucydur spokes + brushed gold rim + 12 timing screws)
  ctx.save();
  ctx.rotate(balanceAngle);

  const rOutRim = balance.rimOuterRadius; // 112.0
  const rInRim = balance.rimInnerRadius; // 96.5

  // Subtle realistic high-speed angular motion sheen during Act III time-lapse peak
  const screenSpeed = Math.abs(balanceOmega) * effectiveRate;
  if (screenSpeed > 28) {
    const blurAlpha = Math.min(0.28, (screenSpeed - 28) / 140);
    ctx.beginPath();
    ctx.arc(0, 0, (rOutRim + rInRim) * 0.5, 0, TWO_PI);
    ctx.strokeStyle = `rgba(240, 212, 148, ${blurAlpha})`;
    ctx.lineWidth = rOutRim - rInRim + 4;
    ctx.stroke();
  }

  // Brushed gold outer rim with chamfered dark bevels
  const rimGrad = ctx.createLinearGradient(-rOutRim, -rOutRim, rOutRim, rOutRim);
  rimGrad.addColorStop(0, '#f8e6b4');
  rimGrad.addColorStop(0.35, '#d7b670');
  rimGrad.addColorStop(0.7, '#ae8841');
  rimGrad.addColorStop(1, '#ecd294');

  ctx.beginPath();
  ctx.arc(0, 0, rOutRim, 0, TWO_PI);
  ctx.moveTo(rInRim, 0);
  ctx.arc(0, 0, rInRim, 0, TWO_PI, true);
  ctx.fillStyle = rimGrad;
  ctx.fill('evenodd');
  ctx.lineWidth = 1.25;
  ctx.strokeStyle = '#4a3717';
  ctx.stroke();

  // Subtle inner chamfer highlight line
  ctx.beginPath();
  ctx.arc(0, 0, (rOutRim + rInRim) * 0.5, 0, TWO_PI);
  ctx.strokeStyle = 'rgba(255, 249, 224, 0.45)';
  ctx.lineWidth = 1.0;
  ctx.stroke();

  // 12 precision gold timing/poising masselottes around balance rim (stays <= 115.0, well clear of cage pillars at 124.5!)
  for (let i = 0; i < 12; i += 1) {
    const a = (i * TWO_PI) / 12;
    ctx.save();
    ctx.rotate(a);
    ctx.fillStyle = '#e4c786';
    ctx.strokeStyle = '#533e1a';
    ctx.lineWidth = 0.85;
    ctx.beginPath();
    ctx.roundRect(rOutRim - 2.2, -4.4, 5.2, 8.8, 1.5);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  // 3 sculpted steel balance spokes (matching reference-0.jpg!)
  const spokeGrad = ctx.createLinearGradient(-rInRim, 0, rInRim, 0);
  spokeGrad.addColorStop(0, '#e6ebf2');
  spokeGrad.addColorStop(0.5, '#b6c0cc');
  spokeGrad.addColorStop(1, '#dce3ec');
  for (let i = 0; i < 3; i += 1) {
    const a = (i * TWO_PI) / 3 + Math.PI;
    ctx.save();
    ctx.rotate(a);
    ctx.beginPath();
    ctx.moveTo(22, -6.2);
    ctx.lineTo(rInRim + 2, -4.0);
    ctx.lineTo(rInRim + 2, 4.0);
    ctx.lineTo(22, 6.2);
    ctx.closePath();
    ctx.fillStyle = spokeGrad;
    ctx.fill();
    ctx.lineWidth = 0.95;
    ctx.strokeStyle = '#384352';
    ctx.stroke();

    // Rim anchor lug
    ctx.beginPath();
    ctx.arc(rInRim - 4, 0, 2.5, 0, TWO_PI);
    ctx.fillStyle = '#5b6778';
    ctx.fill();
    ctx.restore();
  }

  // Central balance staff collet & impulse roller disc
  ctx.beginPath();
  ctx.arc(0, 0, 26.5, 0, TWO_PI);
  ctx.fillStyle = '#c8d1dc';
  ctx.fill();
  ctx.lineWidth = 1.1;
  ctx.strokeStyle = '#3c4859';
  ctx.stroke();

  // Crimson impulse roller jewel pin
  ctx.beginPath();
  ctx.arc(0, -21, 3.2, 0, TWO_PI);
  ctx.fillStyle = '#e63268';
  ctx.fill();
  ctx.strokeStyle = '#4e0a20';
  ctx.lineWidth = 0.8;
  ctx.stroke();

  ctx.restore();

  // Power-path highlight aura around balance in Act I
  if (highlightWeight > 0.02) {
    ctx.beginPath();
    ctx.arc(0, 0, balance.rimOuterRadius + 6, 0, TWO_PI);
    ctx.strokeStyle = `rgba(95, 210, 232, ${0.65 * highlightWeight})`;
    ctx.lineWidth = 3.5;
    ctx.stroke();
  }

  ctx.restore();
}

/**
 * Draws the Coaxial 1-Minute Flying Tourbillon Cage (60 s/rev, outer diameter 1.15 * D_balance):
 * - Slender thermally-blued steel structural pillars at R = 124.5 (clear ~12.5 px radial gap from balance rim!)
 * - 3 precision guide shoes riding cleanly inside the visible curved guide slot at R = 147.5
 * - Sculpted 3-arm chamfered golden upper flying tourbillon bridge carrying central ruby jewel & blued screws
 * - Cutaway transparent sapphire crystal cover dome smoothly controlled by #cutaway-opacity
 * - 3-fold rotational symmetry (120 deg) matching exact 20.0 s periodic return!
 */
export function drawFlyingTourbillonCage(ctx, balance, cageAngle, contacts, cutawayAlpha, tourbillonHighlight = 0) {
  ctx.save();
  ctx.translate(balance.x, balance.y);

  // Canonical 3-fold (120-deg) symmetry angle eliminates sub-pixel raster jitter across 120-deg periodic wrap
  const sector = TWO_PI / 3;
  let drawCageAngle = ((cageAngle % sector) + sector) % sector;
  if (Math.abs(drawCageAngle - sector) < 1e-5) drawCageAngle = 0;

  // Subtle cyan orbital halo during Act III tourbillon showcase
  if (tourbillonHighlight > 0.02) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, balance.guideSlotRadius, 0, TWO_PI);
    ctx.strokeStyle = `rgba(95, 210, 232, ${0.42 * tourbillonHighlight})`;
    ctx.lineWidth = 2.6;
    ctx.setLineDash([8, 6]);
    ctx.stroke();
    ctx.restore();
  }

  ctx.save();
  ctx.rotate(drawCageAngle);

  const rOuter = balance.cageOuterRadius; // 128.8 (1.15 * 112.0)
  const rInner = balance.cageInnerRingRadius; // 121.0 (clear 9 px gap from balance rim 112.0!)
  const rPillar = balance.cagePillarRadius; // 124.5
  const rSlot = balance.guideSlotRadius; // 147.5

  // World-aligned top-left studio lighting vector inside cage frame (keeps metallic sheen physically fixed!)
  const ldxO = Math.cos(-drawCageAngle + Math.PI * 0.25) * rOuter;
  const ldyO = Math.sin(-drawCageAngle + Math.PI * 0.25) * rOuter;
  const ldxP = Math.cos(-drawCageAngle + Math.PI * 0.25) * rPillar;
  const ldyP = Math.sin(-drawCageAngle + Math.PI * 0.25) * rPillar;

  // 1. SLENDER BLUED-STEEL OUTER CAGE RING (distinct radial clearance gap outside golden balance rim!)
  const blueGrad = ctx.createLinearGradient(-ldxO, -ldyO, ldxO, ldyO);
  blueGrad.addColorStop(0, '#6aa6eb');
  blueGrad.addColorStop(0.32, '#2a5ca8');
  blueGrad.addColorStop(0.68, '#17376e');
  blueGrad.addColorStop(1, '#5894dc');

  ctx.beginPath();
  ctx.arc(0, 0, rOuter, 0, TWO_PI);
  ctx.moveTo(rInner, 0);
  ctx.arc(0, 0, rInner, 0, TWO_PI, true);
  ctx.fillStyle = blueGrad;
  ctx.fill('evenodd');
  ctx.lineWidth = 1.05;
  ctx.strokeStyle = '#0d2042';
  ctx.stroke();

  // Fine specular edge highlight on blued-steel cage ring
  ctx.beginPath();
  ctx.arc(0, 0, (rOuter + rInner) * 0.5, 0, TWO_PI);
  ctx.strokeStyle = 'rgba(170, 214, 255, 0.45)';
  ctx.lineWidth = 0.85;
  ctx.stroke();

  // 2. THREE SLENDER BLUED-STEEL PILLARS + RADIAL GUIDE TABS + SLIDING GUIDE SHOES IN CURVED SLOT
  for (let i = 0; i < 3; i += 1) {
    const a = (i * TWO_PI) / 3 - Math.PI / 6;
    ctx.save();
    ctx.rotate(a);

    // Slender blued-steel guide arm bridging cage ring -> curved guide slot shoe (0.00 px closure error!)
    ctx.beginPath();
    ctx.moveTo(rOuter - 2, -2.8);
    ctx.lineTo(rSlot, -2.0);
    ctx.lineTo(rSlot, 2.0);
    ctx.lineTo(rOuter - 2, 2.8);
    ctx.closePath();
    ctx.fillStyle = '#3369b8';
    ctx.fill();
    ctx.strokeStyle = '#0f2347';
    ctx.lineWidth = 0.85;
    ctx.stroke();

    // Sliding ruby/steel guide shoe centered EXACTLY at (rSlot, 0) inside curved slot
    ctx.beginPath();
    ctx.arc(rSlot, 0, 4.4, 0, TWO_PI);
    ctx.fillStyle = '#6ec8e8';
    ctx.fill();
    ctx.lineWidth = 1.1;
    ctx.strokeStyle = '#132845';
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(rSlot, 0, 1.8, 0, TWO_PI);
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    // Prominent cylindrical thermally-blued steel vertical pillar at R = rPillar (radially symmetric sheen)
    const pGrad = ctx.createRadialGradient(rPillar, 0, 0.8, rPillar, 0, 6.2);
    pGrad.addColorStop(0, '#9bd0ff');
    pGrad.addColorStop(0.45, '#2b63b8');
    pGrad.addColorStop(1, '#0e244d');
    ctx.beginPath();
    ctx.arc(rPillar, 0, 6.0, 0, TWO_PI);
    ctx.fillStyle = pGrad;
    ctx.fill();
    ctx.lineWidth = 1.0;
    ctx.strokeStyle = '#0a1936';
    ctx.stroke();

    ctx.restore();
  }

  // 3. SCULPTED GOLDEN UPPER FLYING TOURBILLON BRIDGE (3-arm lyre-beveled upper carriage)
  const bridgeAlpha = 0.28 + 0.72 * cutawayAlpha;
  ctx.save();
  ctx.globalAlpha = bridgeAlpha;

  const goldBridgeGrad = ctx.createLinearGradient(-ldxP, -ldyP, ldxP, ldyP);
  goldBridgeGrad.addColorStop(0, '#fae8b8');
  goldBridgeGrad.addColorStop(0.4, '#d9b76d');
  goldBridgeGrad.addColorStop(0.75, '#b28c42');
  goldBridgeGrad.addColorStop(1, '#f0d799');

  // World-space drop shadow vector rotated into cage frame
  const shX = 2.0 * Math.cos(-drawCageAngle) - 3.5 * Math.sin(-drawCageAngle);
  const shY = 2.0 * Math.sin(-drawCageAngle) + 3.5 * Math.cos(-drawCageAngle);

  for (let i = 0; i < 3; i += 1) {
    const a = (i * TWO_PI) / 3 - Math.PI / 6;
    ctx.save();
    ctx.rotate(a);

    const totalA = drawCageAngle + a;
    const armLx = Math.cos(Math.PI * 0.25 - totalA) * rPillar;
    const armLy = Math.sin(Math.PI * 0.25 - totalA) * rPillar;
    const armGoldGrad = ctx.createLinearGradient(-armLx, -armLy, armLx, armLy);
    armGoldGrad.addColorStop(0, '#fae8b8');
    armGoldGrad.addColorStop(0.4, '#d9b76d');
    armGoldGrad.addColorStop(0.75, '#b28c42');
    armGoldGrad.addColorStop(1, '#f0d799');

    const armShX = shX * Math.cos(-a) - shY * Math.sin(-a);
    const armShY = shX * Math.sin(-a) + shY * Math.cos(-a);

    ctx.beginPath();
    ctx.moveTo(21, -5.0);
    ctx.quadraticCurveTo(68, -11.5, rPillar - 4, -4.4);
    ctx.lineTo(rPillar - 4, 4.4);
    ctx.quadraticCurveTo(68, -2.5, 21, 5.0);
    ctx.closePath();

    ctx.save();
    ctx.translate(armShX, armShY);
    ctx.fillStyle = 'rgba(6, 12, 24, 0.30)';
    ctx.fill();
    ctx.restore();

    // Sculpted chamfered gold bridge arm
    ctx.fillStyle = armGoldGrad;
    ctx.fill();
    ctx.lineWidth = 1.05;
    ctx.strokeStyle = '#5a441d';
    ctx.stroke();

    // Anglage specular bevel rib
    ctx.beginPath();
    ctx.moveTo(25, -0.5);
    ctx.quadraticCurveTo(68, -7.2, rPillar - 7, -0.5);
    ctx.strokeStyle = 'rgba(255, 250, 232, 0.62)';
    ctx.lineWidth = 1.05;
    ctx.stroke();

    // World-lit thermally blued retaining screw where upper bridge locks to blued pillar
    drawSlottedScrew(ctx, rPillar, 0, 4.0, 0.0, true, Math.PI * 0.25 - totalA);
    ctx.restore();
  }

  // Central golden upper bridge hub & shock-spring lyre ring
  ctx.beginPath();
  ctx.arc(0, 0, 23.5, 0, TWO_PI);
  ctx.fillStyle = goldBridgeGrad;
  ctx.fill();
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = '#5c451c';
  ctx.stroke();

  ctx.restore();
  ctx.restore(); // exit cageAngle rotation so sapphire dome & central cap jewel keep fixed studio light!

  // 4. CUTAWAY TRANSPARENT SAPPHIRE COVER DOME (fixed crystal bezel, smoothly controlled by #cutaway-opacity!)
  if (cutawayAlpha > 0.02) {
    ctx.save();
    ctx.globalAlpha = cutawayAlpha;

    const glassGrad = ctx.createRadialGradient(-34, -38, 12, 0, 0, rInner);
    glassGrad.addColorStop(0, 'rgba(205, 236, 255, 0.22)');
    glassGrad.addColorStop(0.55, 'rgba(130, 185, 232, 0.09)');
    glassGrad.addColorStop(0.88, 'rgba(92, 165, 224, 0.15)');
    glassGrad.addColorStop(1, 'rgba(210, 240, 255, 0.26)');
    ctx.beginPath();
    ctx.arc(0, 0, rInner - 0.8, 0, TWO_PI);
    ctx.fillStyle = glassGrad;
    ctx.fill();

    // Crisp anti-reflective sapphire crescent reflection arcs (fixed to studio lighting!)
    ctx.beginPath();
    ctx.arc(0, 0, rInner - 9, -2.35, -1.35);
    ctx.strokeStyle = 'rgba(235, 248, 255, 0.42)';
    ctx.lineWidth = 3.2;
    ctx.lineCap = 'round';
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(0, 0, rInner - 12, 0.35, 1.05);
    ctx.strokeStyle = 'rgba(140, 220, 250, 0.24)';
    ctx.lineWidth = 2.0;
    ctx.stroke();
    ctx.restore();
  }

  // Central Incabloc ruby cap jewel (always 100% opaque with fixed top-left specular glint!)
  drawRubyBearing(ctx, 0, 0, 15.5, true);

  ctx.restore();
}
