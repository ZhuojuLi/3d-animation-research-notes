/**
 * renderer.js — Hybrid Canvas 2D + SVG Horology Workbench Renderer.
 *
 * Canvas 2D renders all high-detail metallic horology geometry (mainplate, barrel, going train,
 * pinions, club-tooth escape wheel, Swiss lever pallet fork, ruby pallet stones, banking slot,
 * 11-turn breathing hairspring, balance wheel, coaxial 1-minute flying tourbillon cage, cutaway
 * sapphire crystal cover, and curved cage guide slot).
 *
 * SVG overlay (#stage-svg) renders crisp, viewBox-bounded technical engineering annotations:
 * - Fine cyan kinematic linkage lines (matching reference-0.jpg)
 * - Live LOCK / RELEASE / IMPULSE callout labels & contact crosshairs driven from the SAME solver state
 * - Act I sequential power-path flow arrows & Act III tourbillon orbital arc telemetry
 * Every emitted SVG primitive is strictly bounded inside [10, 10, 990, 598] to guarantee zero clipping.
 */

import { LAYOUT, WORLD_WIDTH, WORLD_HEIGHT } from './state.js';
import {
  drawMainplate,
  drawMainspringBarrel,
  drawBrassTrainGear,
  drawClubToothEscapeWheel,
  drawPalletForkAndBanking,
  drawBalanceWheelAndHairspring,
  drawFlyingTourbillonCage,
} from './geometry.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const VB_PAD = 12;

function createSvgEl(tag, attrs = {}) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) {
    el.setAttribute(k, String(v));
  }
  return el;
}

/**
 * Liang-Barsky segment clipping strictly inside [minX, maxX] x [minY, maxY].
 * Guarantees zero SVG line clipping errors even under 2.5x Act II zoom.
 */
function clipLineToBox(x1, y1, x2, y2, minX, minY, maxX, maxY) {
  let t0 = 0;
  let t1 = 1;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const checks = [
    [-dx, x1 - minX],
    [dx, maxX - x1],
    [-dy, y1 - minY],
    [dy, maxY - y1],
  ];
  for (const [p, q] of checks) {
    if (Math.abs(p) < 1e-9) {
      if (q < 0) return null;
    } else {
      const r = q / p;
      if (p < 0) {
        if (r > t1) return null;
        if (r > t0) t0 = r;
      } else {
        if (r < t0) return null;
        if (r < t1) t1 = r;
      }
    }
  }
  return {
    x1: x1 + t0 * dx,
    y1: y1 + t0 * dy,
    x2: x1 + t1 * dx,
    y2: y1 + t1 * dy,
  };
}

function isBoxInsideViewBox(x, y, halfW, halfH) {
  return (
    x - halfW >= VB_PAD &&
    x + halfW <= WORLD_WIDTH - VB_PAD &&
    y - halfH >= VB_PAD &&
    y + halfH <= WORLD_HEIGHT - VB_PAD
  );
}

/**
 * Builds a strictly viewBox-clipped SVG polyline path for an arc in world space.
 */
function buildClippedArcPath(cx, cy, r, aStart, aEnd, steps, camera) {
  let d = '';
  let penDown = false;
  for (let i = 0; i <= steps; i += 1) {
    const a = aStart + ((aEnd - aStart) * i) / steps;
    const pt = camera.worldToViewBox(cx + r * Math.cos(a), cy + r * Math.sin(a));
    const inside =
      pt.x >= VB_PAD &&
      pt.x <= WORLD_WIDTH - VB_PAD &&
      pt.y >= VB_PAD &&
      pt.y <= WORLD_HEIGHT - VB_PAD;
    if (inside) {
      d += `${penDown ? 'L' : 'M'}${pt.x.toFixed(1)},${pt.y.toFixed(1)} `;
      penDown = true;
    } else {
      penDown = false;
    }
  }
  return d.trim();
}

export class HorologyRenderer {
  constructor(canvas, svg) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.svg = svg;
    this.gGuides = svg.querySelector('#svg-kinematic-guides');
    this.gPower = svg.querySelector('#svg-power-path');
    this.gCallouts = svg.querySelector('#svg-escapement-callouts');
    this.gTourbillon = svg.querySelector('#svg-tourbillon-hud');
  }

  resize(cssWidth, cssHeight, dpr) {
    const w = Math.max(1, Math.round(cssWidth * dpr));
    const h = Math.max(1, Math.round(cssHeight * dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
  }

  /**
   * Renders the full mechanical horology scene in strict physical Z-order on Canvas 2D,
   * followed by crisp viewBox-aligned technical annotations on #stage-svg.
   */
  render(frame, actInfo, camera) {
    const ctx = this.ctx;
    const { nodes, contacts } = frame;
    const cutawayAlpha = actInfo.effectiveCutawayOpacity;
    const pw = actInfo.powerWeights || [0, 0, 0, 0, 0, 0];

    // 1. Clear workbench backdrop in device pixel space
    camera.resetContext(ctx);
    const bgGrad = ctx.createRadialGradient(
      camera.viewportWidth * 0.48,
      camera.viewportHeight * 0.5,
      20,
      camera.viewportWidth * 0.48,
      camera.viewportHeight * 0.5,
      Math.max(camera.viewportWidth, camera.viewportHeight) * 0.72
    );
    bgGrad.addColorStop(0, '#1e324f');
    bgGrad.addColorStop(0.65, '#15243b');
    bgGrad.addColorStop(1, '#101c2f');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, camera.viewportWidth, camera.viewportHeight);

    // 2. Apply exact camera world-to-screen transform
    camera.applyToContext(ctx);

    // Layer 0: Cream circular mainplate, recessed navy well, visible curved cage guide slot, screws
    drawMainplate(ctx, LAYOUT, cutawayAlpha);

    // Layer 1: Mainspring Barrel (left, 80T, 1.45x balance outer diameter)
    drawMainspringBarrel(
      ctx,
      LAYOUT.barrel,
      nodes.barrel.angle,
      nodes.mainspring.angle,
      cutawayAlpha,
      pw[0]
    );

    // Layer 2: Going Train triangular layout in true mechanical Z-stacking
    // 2a. Fourth / Seconds Wheel (upper brass wheel, 60T / 8L pinion)
    drawBrassTrainGear(ctx, LAYOUT.fourth, nodes.fourthWheel.angle, 5, false, cutawayAlpha, pw[3]);

    // 2b. Center Wheel (lower brass wheel, 75T / 12L pinion meshing with Barrel 80T)
    drawBrassTrainGear(ctx, LAYOUT.center, nodes.centerWheel.angle, 5, true, cutawayAlpha, pw[1]);

    // 2c. Third Wheel (prominent central gold wheel, 70T / 10L pinion meshing with Center 75T)
    drawBrassTrainGear(ctx, LAYOUT.third, nodes.thirdWheel.angle, 5, true, cutawayAlpha, pw[2]);

    // Layer 3: Club-Tooth Steel Escape Wheel (15 club teeth, 3 curved spokes, 8L pinion = 15:2 from Fourth!)
    drawClubToothEscapeWheel(ctx, LAYOUT.escape, nodes.escapeWheel.angle, cutawayAlpha, pw[4]);

    // Layer 4: Swiss Lever Anchor Pallet Fork, visible machined Banking Slot & Pins, Crimson Ruby Pallet Stones
    drawPalletForkAndBanking(ctx, LAYOUT, nodes.palletFork.angle, contacts, frame.escapementState, cutawayAlpha);

    // Layer 5: Balance Wheel + Breathing 11-Turn Hairspring inside recessed navy well
    drawBalanceWheelAndHairspring(
      ctx,
      LAYOUT.balance,
      nodes.balanceWheel.angle,
      nodes.balanceWheel.omega,
      actInfo.effectiveTimeScale,
      pw[5]
    );

    // Layer 6: Coaxial 1-Minute Flying Tourbillon Cage (slender blued-steel pillars, golden upper bridge,
    // cutaway sapphire cover, and 3 sliding guide shoes constrained in curved guide slot)
    drawFlyingTourbillonCage(
      ctx,
      LAYOUT.balance,
      nodes.tourbillonCage.angle,
      contacts,
      cutawayAlpha,
      actInfo.tourbillonHighlight
    );

    // 3. Render dynamic vector engineering annotations in #stage-svg (strictly viewBox-clipped)
    this.renderSvgOverlay(frame, actInfo, camera);
  }

  renderSvgOverlay(frame, actInfo, camera) {
    const { contacts, escapementState } = frame;
    const gGuides = this.gGuides;
    const gPower = this.gPower;
    const gCallouts = this.gCallouts;
    const gTourbillon = this.gTourbillon;

    gGuides.textContent = '';
    gPower.textContent = '';
    gCallouts.textContent = '';
    gTourbillon.textContent = '';

    const addClippedLine = (parent, wx1, wy1, wx2, wy2, attrs) => {
      const p1 = camera.worldToViewBox(wx1, wy1);
      const p2 = camera.worldToViewBox(wx2, wy2);
      const clipped = clipLineToBox(p1.x, p1.y, p2.x, p2.y, VB_PAD, VB_PAD, WORLD_WIDTH - VB_PAD, WORLD_HEIGHT - VB_PAD);
      if (!clipped) return;
      parent.appendChild(
        createSvgEl('line', {
          x1: clipped.x1.toFixed(1),
          y1: clipped.y1.toFixed(1),
          x2: clipped.x2.toFixed(1),
          y2: clipped.y2.toFixed(1),
          ...attrs,
        })
      );
    };

    // 1. Classic cyan kinematic linkage triangle & escapement sightlines (echoing reference-0.jpg!)
    const { third, escape, pallet, balance, barrel, center, fourth } = LAYOUT;
    addClippedLine(gGuides, third.x, third.y, escape.x, escape.y, {
      stroke: '#58c9df',
      'stroke-width': '0.95',
      'stroke-opacity': '0.52',
    });
    addClippedLine(gGuides, third.x, third.y, balance.x, balance.y, {
      stroke: '#58c9df',
      'stroke-width': '0.95',
      'stroke-opacity': '0.48',
    });
    addClippedLine(gGuides, escape.x, escape.y, pallet.x, pallet.y, {
      stroke: '#58c9df',
      'stroke-width': '0.9',
      'stroke-opacity': '0.45',
    });
    // Live impulse sightline from pallet fork horn down to balance axis (shifts subtly with forkAngle!)
    addClippedLine(gGuides, contacts.forkHornTip.x, contacts.forkHornTip.y, balance.x, balance.y, {
      stroke: escapementState === 'IMPULSE' ? '#7ee8ff' : '#d84f7f',
      'stroke-width': escapementState === 'IMPULSE' ? '1.35' : '0.95',
      'stroke-opacity': escapementState === 'IMPULSE' ? '0.85' : '0.52',
    });

    // Subtle directional curved motion indicator near lower-left center wheel (matching reference-0.jpg!)
    const dirArcD = buildClippedArcPath(center.x, center.y, center.outerR + 12, 1.85, 3.02, 22, camera);
    if (dirArcD) {
      gGuides.appendChild(
        createSvgEl('path', {
          d: dirArcD,
          fill: 'none',
          stroke: '#5fd2e8',
          'stroke-width': '1.25',
          'stroke-opacity': '0.68',
        })
      );
    }

    // 2. Act I sequential power-path illumination vector flow (Barrel -> Center -> Third -> Fourth -> Escape -> Balance)
    if (actInfo.powerEnvelope > 0.02) {
      const chain = [barrel, center, third, fourth, escape, balance];
      const pw = actInfo.powerWeights;
      for (let i = 0; i < chain.length - 1; i += 1) {
        const w = Math.max(pw[i], pw[i + 1]);
        if (w <= 0.03) continue;
        addClippedLine(gPower, chain[i].x, chain[i].y, chain[i + 1].x, chain[i + 1].y, {
          stroke: '#7ee8ff',
          'stroke-width': (1.4 + 2.2 * w).toFixed(2),
          'stroke-opacity': (0.85 * w).toFixed(2),
          'stroke-dasharray': '7 5',
          'stroke-dashoffset': (-(frame.t * 48) % 24).toFixed(1),
        });
      }
    }

    // 3. Live LOCK / RELEASE callouts + active contact pulse rings (strictly driven by SAME solver state!)
    const isLockActive = escapementState === 'LOCK' || escapementState === 'RELOCK';
    const isReleaseActive = escapementState === 'RELEASE' || escapementState === 'IMPULSE';

    // LOCK label positioned cleanly on cream mainplate above upper entry pallet stone
    const lockWorld = { x: 632, y: 126 };
    const lockVb = camera.worldToViewBox(lockWorld.x, lockWorld.y);
    if (isBoxInsideViewBox(lockVb.x, lockVb.y, 40, 16)) {
      const lockText = createSvgEl('text', {
        x: lockVb.x.toFixed(1),
        y: lockVb.y.toFixed(1),
        'text-anchor': 'middle',
        'font-family': 'Inter, Segoe UI, system-ui, sans-serif',
        'font-size': (14.5 + 1.5 * actInfo.zoomBlend).toFixed(1),
        'font-weight': isLockActive ? '700' : '500',
        'letter-spacing': '0.06em',
        fill: isLockActive ? '#8f133b' : '#263242',
      });
      lockText.textContent = escapementState === 'RELOCK' ? 'RELOCK' : 'LOCK';
      gCallouts.appendChild(lockText);

      // Clean pointer leader tick to entry pallet stone contact
      addClippedLine(
        gCallouts,
        lockWorld.x - 4,
        lockWorld.y + 6,
        contacts.entryStoneTip.x + 6,
        contacts.entryStoneTip.y - 8,
        {
          stroke: isLockActive ? '#b82552' : '#4a5a6e',
          'stroke-width': isLockActive ? '1.35' : '0.9',
          'stroke-opacity': isLockActive ? '0.88' : '0.45',
        }
      );
    }

    // RELEASE / IMPULSE label positioned cleanly on bright cream mainplate right of fork horn & banking slot!
    const relWorld = { x: 806, y: 162 };
    const relVb = camera.worldToViewBox(relWorld.x, relWorld.y);
    if (isBoxInsideViewBox(relVb.x, relVb.y, 48, 16)) {
      const relText = createSvgEl('text', {
        x: relVb.x.toFixed(1),
        y: relVb.y.toFixed(1),
        'text-anchor': 'middle',
        'font-family': 'Inter, Segoe UI, system-ui, sans-serif',
        'font-size': (14.5 + 1.5 * actInfo.zoomBlend).toFixed(1),
        'font-weight': isReleaseActive ? '700' : '500',
        'letter-spacing': '0.06em',
        fill: escapementState === 'IMPULSE' ? '#0b5c78' : isReleaseActive ? '#8a4e0b' : '#263242',
      });
      relText.textContent = escapementState === 'IMPULSE' ? 'IMPULSE' : 'RELEASE';
      gCallouts.appendChild(relText);

      addClippedLine(
        gCallouts,
        relWorld.x - 40,
        relWorld.y + 2,
        contacts.forkHornTip.x + 10,
        contacts.forkHornTip.y - 2,
        {
          stroke: escapementState === 'IMPULSE' ? '#1c86a6' : '#556578',
          'stroke-width': isReleaseActive ? '1.4' : '0.9',
          'stroke-opacity': isReleaseActive ? '0.88' : '0.45',
        }
      );
    }

    // Live active escapement contact marker ring (strictly periodic over 16.0 s!)
    const activePt = isLockActive ? contacts.entryStoneTip : contacts.forkHornTip;
    const actVb = camera.worldToViewBox(activePt.x, activePt.y);
    const pulseR = 6.2 + 2.2 * Math.abs(Math.sin((frame.t / 16.0) * Math.PI * 2 * 16));
    if (isBoxInsideViewBox(actVb.x, actVb.y, pulseR + 2, pulseR + 2)) {
      gCallouts.appendChild(
        createSvgEl('circle', {
          cx: actVb.x.toFixed(1),
          cy: actVb.y.toFixed(1),
          r: pulseR.toFixed(2),
          fill: 'none',
          stroke: escapementState === 'IMPULSE' ? '#5fd2e8' : isReleaseActive ? '#f5b942' : '#c8245a',
          'stroke-width': '1.6',
          'stroke-opacity': '0.85',
        })
      );
    }

    // 4. Dynamic Coaxial Tourbillon Cage Orbital Telemetry Arc & 3-Fold Symmetric Guide Shoe Reticles
    const cageAngle = frame.nodes.tourbillonCage.angle;
    for (const shoe of contacts.cageGuideShoes) {
      const shoeVb = camera.worldToViewBox(shoe.x, shoe.y);
      if (isBoxInsideViewBox(shoeVb.x, shoeVb.y, 10, 10)) {
        gTourbillon.appendChild(
          createSvgEl('circle', {
            cx: shoeVb.x.toFixed(1),
            cy: shoeVb.y.toFixed(1),
            r: (5.2 + 1.2 * actInfo.zoomBlend).toFixed(1),
            fill: 'none',
            stroke: '#7ee8ff',
            'stroke-width': '1.15',
            'stroke-opacity': (0.50 + 0.35 * actInfo.tourbillonHighlight).toFixed(2),
          })
        );
      }
    }

    // Live orbital sweep arc around curved guide slot showing tourbillon progress (guarded against 2pi/3 wrap epsilon!)
    const sector = (Math.PI * 2) / 3;
    const modAngle = ((cageAngle % sector) + sector) % sector;
    if (modAngle > 0.025 && modAngle < sector - 0.025) {
      const sweepStart = -Math.PI / 6;
      const orbitArcD = buildClippedArcPath(
        balance.x,
        balance.y,
        balance.guideSlotRadius,
        sweepStart,
        sweepStart + modAngle,
        28,
        camera
      );
      if (orbitArcD) {
        gTourbillon.appendChild(
          createSvgEl('path', {
            d: orbitArcD,
            fill: 'none',
            stroke: '#5fd2e8',
            'stroke-width': (1.4 + 1.2 * actInfo.tourbillonHighlight).toFixed(2),
            'stroke-opacity': (0.45 + 0.45 * actInfo.tourbillonHighlight).toFixed(2),
            'stroke-linecap': 'round',
          })
        );
      }
    }
  }
}
