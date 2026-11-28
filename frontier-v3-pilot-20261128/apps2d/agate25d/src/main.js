/**
 * Main Application Entry & Canvas 2D Compositor (`main.js`).
 *
 * Orchestrates the offline zero-WebGL / zero-Three.js 2.5D Museum Agate Gallery Diorama:
 *   - Unified oblique perspective camera (`Camera25D`) across all 4 spatial zones
 *   - 3-layer museum lighting + 16 seeded procedural translucent agate slices
 *   - 16.0s periodic 3-act GSAP choreography + 4 deeply coupled domain interactions
 *   - Exposes `window.__SCENE_READY__ = true`, `window.renderAt(t)`, `window.__2D_STATE__`,
 *     `window.__getKinematicState()`, `window.__getSceneState()`, `window.__auditVanishingPoints()`
 */

import {
  SCENE_DURATION,
  createInitialState,
  computeWheelKinematics,
  buildKinematicSnapshot,
  wrapTime,
} from './state.js';
import { Camera25D, auditVanishingPoints, polygonBounds2D } from './projection25d.js';
import { renderGalleryAtmosphere } from './lighting.js';
import { createMuseumTextures } from './textures.js';
import { createAgateCollection } from './agates.js';
import { renderGalleryBackground, renderLeftDisplayCabinet } from './galleryGeometry.js';
import { renderRightWorkshopZone } from './workbench.js';
import { createSceneTimeline } from './timeline.js';
import { bindInteractions } from './interactions.js';

function bootstrap() {
  const canvas = document.getElementById('scene-canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to acquire Canvas 2D context');
  }

  const state = createInitialState();
  const camera = new Camera25D(state.camera);
  const textures = createMuseumTextures();
  const slices = createAgateCollection();
  const timeline = createSceneTimeline();

  let lastLampIK = null;
  let lastFrameWallMs = performance.now();

  // HUD DOM handles
  const elPlay = document.getElementById('play');
  const elPause = document.getElementById('pause');
  const elScrub = document.getElementById('scrub');
  const elTimeReadout = document.getElementById('time-readout');
  const elLampVal = document.getElementById('lamp-elevation-val');
  const elBacklightVal = document.getElementById('backlight-intensity-val');
  const elSpeedVal = document.getElementById('polisher-speed-val');
  const elActBadge = document.getElementById('act-badge');
  const elSpecimenTag = document.getElementById('specimen-tag');
  const elSpecimenTitle = document.getElementById('specimen-title');
  const elSpecimenMeta = document.getElementById('specimen-meta');

  function syncCanvasSize() {
    const rect = canvas.getBoundingClientRect();
    const targetW = Math.max(320, Math.round(rect.width || window.innerWidth || 1280));
    const targetH = Math.max(200, Math.round(rect.height || window.innerHeight || 720));
    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW;
      canvas.height = targetH;
    }
    camera.setViewport(targetW, targetH);
    state.viewport.width = targetW;
    state.viewport.height = targetH;
    state.viewport.scale = camera.scale;
  }

  function syncHud() {
    if (elPlay) elPlay.classList.toggle('is-active', state.playing);
    if (elPause) elPause.classList.toggle('is-active', !state.playing);
    if (elScrub) elScrub.value = state.t.toFixed(2);
    if (elTimeReadout) elTimeReadout.textContent = `${state.t.toFixed(1)}s`;
    if (elLampVal) elLampVal.textContent = `${Math.round(state.lampElevationDeg)}°`;
    if (elBacklightVal) elBacklightVal.textContent = `${Math.round(state.backlightIntensityPct)}%`;
    if (elSpeedVal) elSpeedVal.textContent = `${Math.round(state.polisherSpeedRpm)} rpm`;
    if (elActBadge) elActBadge.textContent = state.actLabel;

    const selected = state.selectedSliceId !== null
      ? slices.find(s => s.id === state.selectedSliceId) || null
      : null;

    if (selected) {
      if (elSpecimenTag) elSpecimenTag.textContent = `${selected.code} · ${selected.patternZh} · ${selected.localityZh}`;
      if (elSpecimenTitle) elSpecimenTitle.textContent = `${selected.nameZh} · ${selected.nameEn}`;
      if (elSpecimenMeta) elSpecimenMeta.textContent = selected.noteZh;
    } else {
      if (elSpecimenTag) elSpecimenTag.textContent = '点击玛瑙鉴赏';
      if (elSpecimenTitle) elSpecimenTitle.textContent = '玛瑙的多样纹理 · Agate Patterns';
      if (elSpecimenMeta) elSpecimenMeta.textContent = '16 枚程序化切片 · 点击展墙切片查看纹理与产地';
    }
  }

  /**
   * Draws a single deterministic frame using current `state` and `camera`.
   */
  function drawFrame() {
    syncCanvasSize();
    const w = canvas.width;
    const h = canvas.height;

    ctx.save();
    ctx.clearRect(0, 0, w, h);

    // 1) Layer 1A: Ambient obsidian gallery atmosphere & ceiling downlights (independent of cabinet backlight)
    renderGalleryAtmosphere(ctx, camera, w, h);

    // 2) Gallery architectural shell, terrazzo floor, distant vitrine & back-right exhibition wall panels
    renderGalleryBackground(ctx, camera, textures);

    // 3) Left black-lacquer backlit display cabinet, top linear LED, isolated backlight, 16 agate slices & 18° sloped console
    renderLeftDisplayCabinet(ctx, camera, textures, slices, state);

    // 4) Right polishing workbench, articulated task lamp, dual-wheel lapidary polisher & foreground core box
    const workshopRes = renderRightWorkshopZone(ctx, camera, state);
    lastLampIK = workshopRes.lampIK;

    // 5) Subtle peripheral museum lens vignette framing the exhibition hall
    const vig = ctx.createRadialGradient(w * 0.48, h * 0.46, Math.min(w, h) * 0.36, w * 0.50, h * 0.50, Math.max(w, h) * 0.78);
    vig.addColorStop(0.0, 'rgba(0, 0, 0, 0.0)');
    vig.addColorStop(0.75, 'rgba(4, 4, 6, 0.08)');
    vig.addColorStop(1.0, 'rgba(2, 2, 4, 0.34)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, w, h);

    ctx.restore();

    // Update live telemetry globals for deterministic verification & kinematic queries
    const snap = buildKinematicSnapshot(state, slices);
    window.__2D_STATE__ = snap;
    return snap;
  }

  /**
   * Evaluates choreography + wheel kinematics deterministically at timestamp `t` (seconds) and renders.
   */
  function renderAtInternal(t, pauseWallClock = false) {
    if (pauseWallClock) {
      state.playing = false;
    }
    const rawT = Number.isFinite(Number(t)) ? Number(t) : 0;
    const wt = wrapTime(rawT, SCENE_DURATION);
    const evalRes = timeline.evaluateAt(wt);

    state.rawT = rawT;
    state.t = wt;
    state.actIndex = evalRes.act.index;
    state.actName = evalRes.act.name;
    state.actLabel = evalRes.act.label;
    state.camera = { ...evalRes.camera };
    state.macroSpotlightPhase = evalRes.macroSpotlightPhase;

    camera.setPose(state.camera);
    computeWheelKinematics(state, wt);
    syncHud();
    return drawFrame();
  }

  // Bind all 4 coupled domain interactions + transport controls
  bindInteractions({
    canvas,
    camera,
    slices,
    state,
    getLastLampIK: () => lastLampIK,
    onRenderCurrent: () => drawFrame(),
    onRenderAtTime: tVal => renderAtInternal(tVal, true),
    onSyncHud: () => syncHud(),
  });

  window.addEventListener('resize', () => {
    drawFrame();
  });

  // Expose required deterministic hooks & audit APIs
  window.renderAt = function renderAt(t) {
    return renderAtInternal(t, true);
  };

  window.__getKinematicState = function getKinematicState() {
    return buildKinematicSnapshot(state, slices);
  };

  window.__getSceneState = function getSceneState() {
    return buildKinematicSnapshot(state, slices);
  };

  window.__auditVanishingPoints = function getVanishingPointAudit() {
    return auditVanishingPoints(camera);
  };

  window.__getInteractiveTargets = function getInteractiveTargets() {
    const rect = canvas.getBoundingClientRect();
    const toClient = p => ({
      x: Number((rect.left + (p.x / (canvas.width || 1)) * rect.width).toFixed(2)),
      y: Number((rect.top + (p.y / (canvas.height || 1)) * rect.height).toFixed(2)),
    });

    const sliceTargets = slices.map(s => {
      const b = s.lastProjectedBounds;
      const center = b
        ? toClient({ x: (b.minX + b.maxX) * 0.5, y: (b.minY + b.maxY) * 0.5 })
        : null;
      return {
        id: s.id,
        code: s.code,
        row: s.row,
        patternType: s.patternType,
        localityZh: s.localityZh,
        centerClient: center,
        boundsCanvas: b ? {
          minX: Number(b.minX.toFixed(1)),
          minY: Number(b.minY.toFixed(1)),
          maxX: Number(b.maxX.toFixed(1)),
          maxY: Number(b.maxY.toFixed(1)),
        } : null,
      };
    });

    // Compute guaranteed negative-space gap point midway between slice #1 and slice #2 (top row)
    const gapWorld = [0.095, 2.74, -2.64];
    const gapProj = camera.project(gapWorld[0], gapWorld[1], gapWorld[2]);

    const shadePoly = lastLampIK?.projectedShadePoly || [];
    const shadeBounds = shadePoly.length >= 3 ? polygonBounds2D(shadePoly) : null;
    const lampCenterClient = shadeBounds
      ? toClient({ x: (shadeBounds.minX + shadeBounds.maxX) * 0.5, y: (shadeBounds.minY + shadeBounds.maxY) * 0.5 })
      : null;

    return {
      viewport: { width: rect.width, height: rect.height },
      slices: sliceTargets,
      gapBetweenSlicesClient: toClient(gapProj),
      lampShadeCenterClient: lampCenterClient,
      lampShadeBoundsCanvas: shadeBounds,
    };
  };

  // Render exact initial frame at t = 0 and declare scene ready
  renderAtInternal(0, false);
  window.__SCENE_READY__ = true;

  // Wall-clock rAF playback loop (strictly frozen when `state.playing === false`)
  function tick(now) {
    const dtSec = Math.min(0.08, Math.max(0, (now - lastFrameWallMs) / 1000));
    lastFrameWallMs = now;
    if (state.playing && dtSec > 0) {
      const nextT = (state.t + dtSec) % SCENE_DURATION;
      renderAtInternal(nextT, false);
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap, { once: true });
} else {
  bootstrap();
}
