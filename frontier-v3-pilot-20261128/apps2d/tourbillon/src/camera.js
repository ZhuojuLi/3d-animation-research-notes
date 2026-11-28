/**
 * camera.js — 2D World-to-Screen Camera with Smooth Pan/Zoom and Exact Inverse Mapping.
 *
 * Maps logical world space [0..1000] x [0..610] uniformly into any viewport aspect ratio
 * (including 1280x720 and 1440x900) with zero distortion, while supporting smooth camera
 * zoom/focus into the escapement/tourbillon zone during Act 2 and inverse pointer mapping
 * for direct circular dragging of the balance wheel.
 */

import { WORLD_WIDTH, WORLD_HEIGHT } from './state.js';

export class Camera2D {
  constructor() {
    this.viewportWidth = WORLD_WIDTH;
    this.viewportHeight = WORLD_HEIGHT;
    this.dpr = 1;
    this.baseScale = 1;
    this.offsetX = 0;
    this.offsetY = 0;

    // Animated camera state in world coordinates
    this.centerX = WORLD_WIDTH * 0.5;
    this.centerY = WORLD_HEIGHT * 0.5;
    this.zoom = 1.0;
  }

  resize(cssWidth, cssHeight, dpr = 1) {
    this.viewportWidth = Math.max(1, cssWidth);
    this.viewportHeight = Math.max(1, cssHeight);
    this.dpr = Math.max(1, dpr);

    // Uniform scale preserving aspect ratio with exact alignment to stage-svg viewBox
    this.baseScale = Math.min(this.viewportWidth / WORLD_WIDTH, this.viewportHeight / WORLD_HEIGHT);
    this.offsetX = (this.viewportWidth - WORLD_WIDTH * this.baseScale) * 0.5;
    this.offsetY = (this.viewportHeight - WORLD_HEIGHT * this.baseScale) * 0.5;
  }

  setPose(centerX, centerY, zoom) {
    this.centerX = centerX;
    this.centerY = centerY;
    this.zoom = Math.max(0.5, zoom);
  }

  getTotalScale() {
    return this.baseScale * this.zoom;
  }

  /**
   * Maps world point (wx, wy) to stage-svg viewBox coordinates [0..1000] x [0..610].
   */
  worldToViewBox(wx, wy) {
    return {
      x: (wx - this.centerX) * this.zoom + WORLD_WIDTH * 0.5,
      y: (wy - this.centerY) * this.zoom + WORLD_HEIGHT * 0.5,
    };
  }

  /**
   * Maps world point (wx, wy) to CSS pixel coordinates inside #stage-wrap.
   */
  worldToScreen(wx, wy) {
    const vb = this.worldToViewBox(wx, wy);
    return {
      x: this.offsetX + vb.x * this.baseScale,
      y: this.offsetY + vb.y * this.baseScale,
    };
  }

  /**
   * Exact inverse: maps CSS pixel coordinates inside #stage-wrap back to world coordinates.
   */
  screenToWorld(sx, sy) {
    const vbx = (sx - this.offsetX) / this.baseScale;
    const vby = (sy - this.offsetY) / this.baseScale;
    return {
      x: (vbx - WORLD_WIDTH * 0.5) / this.zoom + this.centerX,
      y: (vby - WORLD_HEIGHT * 0.5) / this.zoom + this.centerY,
    };
  }

  /**
   * Returns current visible world bounds [minX, maxX, minY, maxY] on the canvas.
   */
  getVisibleWorldBounds() {
    const tl = this.screenToWorld(0, 0);
    const br = this.screenToWorld(this.viewportWidth, this.viewportHeight);
    return {
      minX: tl.x,
      minY: tl.y,
      maxX: br.x,
      maxY: br.y,
      width: br.x - tl.x,
      height: br.y - tl.y,
    };
  }

  /**
   * Applies the full DPR + world-to-screen + zoom transform to a CanvasRenderingContext2D.
   */
  applyToContext(ctx) {
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.translate(this.offsetX + WORLD_WIDTH * 0.5 * this.baseScale, this.offsetY + WORLD_HEIGHT * 0.5 * this.baseScale);
    ctx.scale(this.baseScale * this.zoom, this.baseScale * this.zoom);
    ctx.translate(-this.centerX, -this.centerY);
  }

  /**
   * Resets context transform to CSS pixel space (with DPR scaling).
   */
  resetContext(ctx) {
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }
}
