/**
 * Unified 3D -> 2D Oblique Perspective Camera & Computational Geometry Engine (`projection25d.js`).
 *
 * Right-handed world coordinates (meters), total visible gallery envelope ~ 7.0 x 5.2 x 12.0:
 *   +X : across gallery aisle (0 = left backlit display wall, ~7.0 = right exhibition wall)
 *   +Y : vertical up (0 = museum floor, 5.2 = gallery ceiling)
 *   -Z : depth into gallery hall (0 = foreground edge, -7.2 = end of agate cabinet, -11.0 = back wall)
 *
 * ALL four spatial zones (left backlit agate wall, sloped China distribution map console,
 * right polishing workbench + task lamp + dual-wheel polisher, front-right core box + cabinet)
 * project exclusively through this single camera instance.
 */

import { LOGICAL_WIDTH, LOGICAL_HEIGHT } from './state.js';

export const HERO_CAMERA = Object.freeze({
  x: 5.14,
  y: 2.54,
  z: 2.41,
  yawDeg: 31.52,
  pitchDeg: 0.0,
  focal: 1346.3,
  cx: 768.0,
  cy: 353.7,
});

export class Camera25D {
  constructor(params = HERO_CAMERA) {
    this.x = params.x;
    this.y = params.y;
    this.z = params.z;
    this.yawDeg = params.yawDeg;
    this.pitchDeg = params.pitchDeg;
    this.focal = params.focal;
    this.cx = params.cx;
    this.cy = params.cy;

    // Viewport mapping from 1536x1024 logical design frame with isotropic scaling (fx === fy)
    this.viewW = LOGICAL_WIDTH;
    this.viewH = LOGICAL_HEIGHT;
    this.scale = 1.0;
    this.offsetX = 0.0;
    this.offsetY = 0.0;

    // Orthonormal basis vectors
    this.fx = 0; this.fy = 0; this.fz = -1;
    this.rx = 1; this.ry = 0; this.rz = 0;
    this.ux = 0; this.uy = 1; this.uz = 0;
    this.updateBasis();
  }

  setPose(pose) {
    this.x = pose.x;
    this.y = pose.y;
    this.z = pose.z;
    this.yawDeg = pose.yawDeg;
    this.pitchDeg = pose.pitchDeg;
    this.focal = pose.focal;
    this.cx = pose.cx;
    this.cy = pose.cy;
    this.updateBasis();
  }

  setViewport(viewW, viewH) {
    this.viewW = Math.max(1, viewW);
    this.viewH = Math.max(1, viewH);
    // Uniform isotropic scale anchoring the 1536x1024 core diorama vertically while letting
    // wider viewports (16:9 / 16:10) organically extend the 3D gallery without letterbox edges.
    this.scale = this.viewH / LOGICAL_HEIGHT;
    const fittedW = LOGICAL_WIDTH * this.scale;
    this.offsetX = (this.viewW - fittedW) * 0.5;
    this.offsetY = 0;
  }

  updateBasis() {
    const yr = (this.yawDeg * Math.PI) / 180;
    const pr = (this.pitchDeg * Math.PI) / 180;
    const cosP = Math.cos(pr);
    const sinP = Math.sin(pr);
    const sinY = Math.sin(yr);
    const cosY = Math.cos(yr);

    // Forward points into -Z rotated by +yaw toward -X (so -Z vanishes right, -X vanishes left)
    this.fx = -sinY * cosP;
    this.fy = sinP;
    this.fz = -cosY * cosP;

    // Right = normalize(cross(Forward, WorldUp(0,1,0))) = normalize((-fz, 0, fx))
    let rx = -this.fz;
    let rz = this.fx;
    const rl = Math.hypot(rx, rz) || 1;
    this.rx = rx / rl;
    this.ry = 0;
    this.rz = rz / rl;

    // Camera Up = cross(Right, Forward)
    this.ux = this.ry * this.fz - this.rz * this.fy;
    this.uy = this.rz * this.fx - this.rx * this.fz;
    this.uz = this.rx * this.fy - this.ry * this.fx;
  }

  /**
   * Transforms world 3D point into camera-local space `{ xc, yc, zc }`.
   */
  toCameraSpace(x, y, z) {
    const dx = x - this.x;
    const dy = y - this.y;
    const dz = z - this.z;
    return {
      xc: dx * this.rx + dy * this.ry + dz * this.rz,
      yc: dx * this.ux + dy * this.uy + dz * this.uz,
      zc: dx * this.fx + dy * this.fy + dz * this.fz,
    };
  }

  projectCameraPoint(xc, yc, zc) {
    const safeZ = zc > 0.08 ? zc : 0.08;
    const invZ = this.focal / safeZ;
    const logicalX = this.cx + xc * invZ;
    const logicalY = this.cy - yc * invZ;
    return {
      x: this.offsetX + logicalX * this.scale,
      y: this.offsetY + logicalY * this.scale,
      logicalX,
      logicalY,
      depth: zc,
      visible: zc > 0.12,
    };
  }

  /**
   * Projects a 3D world point (x, y, z) to viewport 2D coordinates { x, y, depth, logicalX, logicalY, visible }.
   */
  project(x, y, z) {
    const c = this.toCameraSpace(x, y, z);
    return this.projectCameraPoint(c.xc, c.yc, c.zc);
  }

  projectVec(v) {
    return this.project(v[0], v[1], v[2]);
  }

  /**
   * Projects a 3D polygon with exact near-plane Sutherland-Hodgman clipping (`zc >= 0.18`)
   * so large architectural walls, floors, backlit panels, and shelves never vanish when extending behind the camera.
   */
  projectPoly(pts3d) {
    const zNear = 0.18;
    const camPts = new Array(pts3d.length);
    for (let i = 0; i < pts3d.length; i += 1) {
      camPts[i] = this.toCameraSpace(pts3d[i][0], pts3d[i][1], pts3d[i][2]);
    }
    const clipped = [];
    for (let i = 0; i < camPts.length; i += 1) {
      const a = camPts[i];
      const b = camPts[(i + 1) % camPts.length];
      const aIn = a.zc >= zNear;
      const bIn = b.zc >= zNear;
      if (aIn && bIn) {
        clipped.push(b);
      } else if (aIn && !bIn) {
        const t = (zNear - a.zc) / ((b.zc - a.zc) || -1e-6);
        clipped.push({
          xc: a.xc + (b.xc - a.xc) * t,
          yc: a.yc + (b.yc - a.yc) * t,
          zc: zNear,
        });
      } else if (!aIn && bIn) {
        const t = (zNear - a.zc) / ((b.zc - a.zc) || 1e-6);
        clipped.push({
          xc: a.xc + (b.xc - a.xc) * t,
          yc: a.yc + (b.yc - a.yc) * t,
          zc: zNear,
        });
        clipped.push(b);
      }
    }

    if (clipped.length < 3) {
      return { pts: [], avgDepth: 0, minDepth: 0, maxDepth: 0, visible: false };
    }

    const out = new Array(clipped.length);
    let minDepth = Infinity;
    let maxDepth = -Infinity;
    let sumDepth = 0;
    for (let i = 0; i < clipped.length; i += 1) {
      const p = this.projectCameraPoint(clipped[i].xc, clipped[i].yc, clipped[i].zc);
      out[i] = p;
      if (p.depth < minDepth) minDepth = p.depth;
      if (p.depth > maxDepth) maxDepth = p.depth;
      sumDepth += p.depth;
    }
    return {
      pts: out,
      avgDepth: sumDepth / clipped.length,
      minDepth,
      maxDepth,
      visible: true,
    };
  }

  /**
   * Projects a 3D unit direction vector to its exact vanishing point in screen & logical space.
   */
  projectDirection(vx, vy, vz) {
    const zc = vx * this.fx + vy * this.fy + vz * this.fz;
    const xc = vx * this.rx + vy * this.ry + vz * this.rz;
    const yc = vx * this.ux + vy * this.uy + vz * this.uz;
    if (Math.abs(zc) < 1e-6) {
      return { x: Infinity, y: Infinity, logicalX: Infinity, logicalY: Infinity, finite: false };
    }
    const logicalX = this.cx + (this.focal * xc) / zc;
    const logicalY = this.cy - (this.focal * yc) / zc;
    return {
      x: this.offsetX + logicalX * this.scale,
      y: this.offsetY + logicalY * this.scale,
      logicalX,
      logicalY,
      finite: true,
    };
  }

  computeVanishingPoints() {
    return {
      vpWallDepth: this.projectDirection(0, 0, -1),   // along cabinet / map / bench length / core box depth
      vpAisleCross: this.projectDirection(-1, 0, 0),  // across aisle / core box width / bench width
      vpVertical: this.projectDirection(0, 1, 0),     // vertical architecture (infinite when pitch === 0)
    };
  }

  /**
   * Unprojects a viewport 2D point (sx, sy) to a 3D ray { origin, dir }.
   */
  screenToRay(sx, sy) {
    const lx = (sx - this.offsetX) / (this.scale || 1);
    const ly = (sy - this.offsetY) / (this.scale || 1);
    const nx = (lx - this.cx) / this.focal;
    const ny = (this.cy - ly) / this.focal;
    let dx = this.fx + nx * this.rx + ny * this.ux;
    let dy = this.fy + nx * this.ry + ny * this.uy;
    let dz = this.fz + nx * this.rz + ny * this.uz;
    const len = Math.hypot(dx, dy, dz) || 1;
    return {
      origin: [this.x, this.y, this.z],
      dir: [dx / len, dy / len, dz / len],
    };
  }

  /**
   * Intersects a viewport click/drag point with a 3D plane defined by point P0 and normal N.
   */
  unprojectToPlane(sx, sy, planePoint, planeNormal) {
    const ray = this.screenToRay(sx, sy);
    const denom = ray.dir[0] * planeNormal[0] + ray.dir[1] * planeNormal[1] + ray.dir[2] * planeNormal[2];
    if (Math.abs(denom) < 1e-6) return null;
    const diffX = planePoint[0] - ray.origin[0];
    const diffY = planePoint[1] - ray.origin[1];
    const diffZ = planePoint[2] - ray.origin[2];
    const t = (diffX * planeNormal[0] + diffY * planeNormal[1] + diffZ * planeNormal[2]) / denom;
    if (t <= 0) return null;
    return [
      ray.origin[0] + ray.dir[0] * t,
      ray.origin[1] + ray.dir[1] * t,
      ray.origin[2] + ray.dir[2] * t,
    ];
  }

  /**
   * Computes shortest perpendicular distance (px) from theoretical vanishing point to a projected 3D edge line.
   */
  edgeResidualToVP(p3a, p3b, vp) {
    const a = this.project(p3a[0], p3a[1], p3a[2]);
    const b = this.project(p3b[0], p3b[1], p3b[2]);
    const dx = b.logicalX - a.logicalX;
    const dy = b.logicalY - a.logicalY;
    const len = Math.hypot(dx, dy) || 1;
    // Perpendicular distance from VP to line AB in logical 1536x1024 pixels
    const cross = Math.abs((vp.logicalX - a.logicalX) * dy - (vp.logicalY - a.logicalY) * dx);
    return {
      a: [Number(a.logicalX.toFixed(2)), Number(a.logicalY.toFixed(2))],
      b: [Number(b.logicalX.toFixed(2)), Number(b.logicalY.toFixed(2))],
      residualPx: Number((cross / len).toFixed(4)),
    };
  }
}

/**
 * Audits parallel structural edges across all 4 diorama zones (cabinet, map box, workbench, core box)
 * against the unified camera's theoretical vanishing points. Target residual <= 2.0 px.
 */
export function auditVanishingPoints(camera) {
  const vps = camera.computeVanishingPoints();
  const zEdges = [
    { zone: 'cabinet_top_led', p0: [0.58, 3.88, -0.6], p1: [0.58, 3.88, -7.2] },
    { zone: 'cabinet_backlit_top', p0: [0.0, 3.16, -0.2], p1: [0.0, 3.16, -7.15] },
    { zone: 'cabinet_backlit_bottom', p0: [0.0, 1.18, -0.2], p1: [0.0, 1.18, -7.15] },
    { zone: 'map_box_top_edge', p0: [0.08, 1.15, -1.95], p1: [0.08, 1.15, -5.35] },
    { zone: 'map_box_front_edge', p0: [1.46, 0.70, -1.95], p1: [1.46, 0.70, -5.35] },
    { zone: 'workbench_left_edge', p0: [2.72, 1.00, -4.25], p1: [2.72, 1.00, -6.85] },
    { zone: 'workbench_right_edge', p0: [3.82, 1.00, -4.25], p1: [3.82, 1.00, -6.85] },
    { zone: 'core_box_left_edge', p0: [3.50, 1.16, -2.02], p1: [3.50, 1.16, -3.82] },
    { zone: 'core_box_right_edge', p0: [4.50, 1.16, -2.02], p1: [4.50, 1.16, -3.82] },
  ];
  const xEdges = [
    { zone: 'cabinet_return_top', p0: [0.0, 3.88, -7.2], p1: [0.64, 3.88, -7.2] },
    { zone: 'workbench_front_edge', p0: [2.72, 1.00, -4.25], p1: [3.82, 1.00, -4.25] },
    { zone: 'core_box_front_edge', p0: [3.50, 1.16, -2.02], p1: [4.50, 1.16, -2.02] },
    { zone: 'core_box_back_edge', p0: [3.50, 1.16, -3.82], p1: [4.50, 1.16, -3.82] },
    { zone: 'drawer_cabinet_front', p0: [3.44, 0.88, -1.96], p1: [4.56, 0.88, -1.96] },
  ];

  const depthResults = zEdges.map(e => ({
    zone: e.zone,
    axis: '-Z',
    ...camera.edgeResidualToVP(e.p0, e.p1, vps.vpWallDepth),
  }));
  const crossResults = xEdges.map(e => ({
    zone: e.zone,
    axis: '-X',
    ...camera.edgeResidualToVP(e.p0, e.p1, vps.vpAisleCross),
  }));
  const all = [...depthResults, ...crossResults];
  const maxResidualPx = Math.max(...all.map(r => r.residualPx), 0);
  const meanResidualPx = all.reduce((acc, r) => acc + r.residualPx, 0) / (all.length || 1);

  return {
    ok: maxResidualPx <= 2.0,
    thresholdPx: 2.0,
    maxResidualPx: Number(maxResidualPx.toFixed(4)),
    meanResidualPx: Number(meanResidualPx.toFixed(4)),
    vanishingPointsLogical: {
      vpWallDepth: [Number(vps.vpWallDepth.logicalX.toFixed(2)), Number(vps.vpWallDepth.logicalY.toFixed(2))],
      vpAisleCross: [Number(vps.vpAisleCross.logicalX.toFixed(2)), Number(vps.vpAisleCross.logicalY.toFixed(2))],
    },
    edges: all,
  };
}

/**
 * Exact 2D ray-casting point-in-polygon test against projected canvas vertices.
 */
export function pointInPoly2D(px, py, poly) {
  if (!poly || poly.length < 3) return false;
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i, i += 1) {
    const xi = poly[i].x;
    const yi = poly[i].y;
    const xj = poly[j].x;
    const yj = poly[j].y;
    const intersect = (yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / ((yj - yi) || 1e-9) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export function polygonArea2D(poly) {
  let sum = 0;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i, i += 1) {
    sum += (poly[j].x + poly[i].x) * (poly[j].y - poly[i].y);
  }
  return Math.abs(sum) * 0.5;
}

export function polygonBounds2D(poly) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < poly.length; i += 1) {
    const p = poly[i];
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
}

/**
 * Draws a filled and optionally stroked 3D polygon projected through the shared camera.
 */
export function drawPoly3D(ctx, camera, pts3d, fillStyle, strokeStyle = null, lineWidth = 1) {
  const proj = camera.projectPoly(pts3d);
  if (!proj.visible) return null;
  const pts = proj.pts;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i += 1) {
    ctx.lineTo(pts[i].x, pts[i].y);
  }
  ctx.closePath();
  if (fillStyle) {
    ctx.fillStyle = fillStyle;
    ctx.fill();
  }
  if (strokeStyle) {
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }
  return proj;
}

/**
 * Draws a 3D line segment projected through the shared camera with near-plane clipping (`zc >= 0.18`).
 */
export function drawLine3D(ctx, camera, p0, p1, strokeStyle, lineWidth = 1.5, lineCap = 'round') {
  const zNear = 0.18;
  let c0 = camera.toCameraSpace(p0[0], p0[1], p0[2]);
  let c1 = camera.toCameraSpace(p1[0], p1[1], p1[2]);
  if (c0.zc < zNear && c1.zc < zNear) return;
  if (c0.zc < zNear) {
    const t = (zNear - c0.zc) / ((c1.zc - c0.zc) || 1e-6);
    c0 = { xc: c0.xc + (c1.xc - c0.xc) * t, yc: c0.yc + (c1.yc - c0.yc) * t, zc: zNear };
  } else if (c1.zc < zNear) {
    const t = (zNear - c1.zc) / ((c0.zc - c1.zc) || 1e-6);
    c1 = { xc: c1.xc + (c0.xc - c1.xc) * t, yc: c1.yc + (c0.yc - c1.yc) * t, zc: zNear };
  }
  const a = camera.projectCameraPoint(c0.xc, c0.yc, c0.zc);
  const b = camera.projectCameraPoint(c1.xc, c1.yc, c1.zc);
  ctx.save();
  ctx.strokeStyle = strokeStyle;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = lineCap;
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
  ctx.restore();
}

/**
 * Draws a textured 2D triangle onto Canvas 2D using exact affine mapping from UV triangle (u0,v0..u2,v2)
 * to screen triangle (x0,y0..x2,y2), with micro-expansion (0.45px) to prevent subpixel seam hairlines.
 */
function drawTexturedTriangle(ctx, img, x0, y0, x1, y1, x2, y2, u0, v0, u1, v1, u2, v2) {
  const denom = (u0 - u2) * (v1 - v2) - (u1 - u2) * (v0 - v2);
  if (Math.abs(denom) < 1e-6) return;

  // Slightly expand clip triangle outward from centroid to eliminate anti-aliasing seams between subdivisions
  const cx = (x0 + x1 + x2) / 3;
  const cy = (y0 + y1 + y2) / 3;
  const expand = (x, y) => {
    const dx = x - cx;
    const dy = y - cy;
    const l = Math.hypot(dx, dy) || 1;
    return [x + (dx / l) * 0.45, y + (dy / l) * 0.45];
  };
  const [ex0, ey0] = expand(x0, y0);
  const [ex1, ey1] = expand(x1, y1);
  const [ex2, ey2] = expand(x2, y2);

  const a = ((x0 - x2) * (v1 - v2) - (x1 - x2) * (v0 - v2)) / denom;
  const b = ((y0 - y2) * (v1 - v2) - (y1 - y2) * (v0 - v2)) / denom;
  const c = ((u0 - u2) * (x1 - x2) - (u1 - u2) * (x0 - x2)) / denom;
  const d = ((u0 - u2) * (y1 - y2) - (u1 - u2) * (y0 - y2)) / denom;
  const e = x2 - a * u2 - c * v2;
  const f = y2 - b * u2 - d * v2;

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(ex0, ey0);
  ctx.lineTo(ex1, ey1);
  ctx.lineTo(ex2, ey2);
  ctx.closePath();
  ctx.clip();
  ctx.transform(a, b, c, d, e, f);
  ctx.drawImage(img, 0, 0);
  ctx.restore();
}

/**
 * Projects a 3D planar quad [TL, TR, BR, BL] with true perspective-correct subdivided texture mapping!
 * Subdividing into cols x rows bilinear patches eliminates affine warping artifacts across steep oblique walls.
 */
export function drawTexturedQuad3D(ctx, camera, quad3d, img, cols = 6, rows = 4, alpha = 1.0) {
  if (!img || !img.width || !img.height) return;
  const [tl, tr, br, bl] = quad3d;
  const w = img.width;
  const h = img.height;

  // Build projected grid of vertices
  const grid = new Array(rows + 1);
  for (let r = 0; r <= rows; r += 1) {
    const vFrac = r / rows;
    const rowArr = new Array(cols + 1);
    const lx = tl[0] + (bl[0] - tl[0]) * vFrac;
    const ly = tl[1] + (bl[1] - tl[1]) * vFrac;
    const lz = tl[2] + (bl[2] - tl[2]) * vFrac;
    const rx = tr[0] + (br[0] - tr[0]) * vFrac;
    const ry = tr[1] + (br[1] - tr[1]) * vFrac;
    const rz = tr[2] + (br[2] - tr[2]) * vFrac;
    for (let c = 0; c <= cols; c += 1) {
      const uFrac = c / cols;
      const px = lx + (rx - lx) * uFrac;
      const py = ly + (ry - ly) * uFrac;
      const pz = lz + (rz - lz) * uFrac;
      rowArr[c] = {
        p: camera.project(px, py, pz),
        u: uFrac * w,
        v: vFrac * h,
      };
    }
    grid[r] = rowArr;
  }

  ctx.save();
  if (alpha < 0.999) ctx.globalAlpha = alpha;
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const a = grid[r][c];
      const b = grid[r][c + 1];
      const d = grid[r + 1][c + 1];
      const e = grid[r + 1][c];
      if (!a.p.visible || !b.p.visible || !d.p.visible || !e.p.visible) continue;
      drawTexturedTriangle(
        ctx, img,
        a.p.x, a.p.y, b.p.x, b.p.y, d.p.x, d.p.y,
        a.u, a.v, b.u, b.v, d.u, d.v
      );
      drawTexturedTriangle(
        ctx, img,
        a.p.x, a.p.y, d.p.x, d.p.y, e.p.x, e.p.y,
        a.u, a.v, d.u, d.v, e.u, e.v
      );
    }
  }
  ctx.restore();
}

/**
 * Helper to build and depth-sort visible faces of an axis-aligned 3D box `[x0,x1] x [y0,y1] x [z0,z1]`.
 */
export function drawBox3D(ctx, camera, bounds, styles = {}) {
  const { x0, x1, y0, y1, z0, z1 } = bounds;
  const cx = camera.x;
  const cy = camera.y;
  const cz = camera.z;

  const faces = [];
  // +Y top
  if (cy > y1 && styles.top !== null) {
    faces.push({
      key: 'top',
      pts: [[x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]],
      fill: styles.top || '#26282c',
      stroke: styles.stroke || null,
    });
  }
  // -Y bottom
  if (cy < y0 && styles.bottom !== null) {
    faces.push({
      key: 'bottom',
      pts: [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]],
      fill: styles.bottom || '#0e0f11',
      stroke: styles.stroke || null,
    });
  }
  // +X right-facing (facing +X toward camera when cx > x1)
  if (cx > x1 && styles.posX !== null) {
    faces.push({
      key: 'posX',
      pts: [[x1, y1, z1], [x1, y1, z0], [x1, y0, z0], [x1, y0, z1]],
      fill: styles.posX || '#1b1d20',
      stroke: styles.stroke || null,
    });
  }
  // -X left-facing (facing -X toward camera when cx < x0)
  if (cx < x0 && styles.negX !== null) {
    faces.push({
      key: 'negX',
      pts: [[x0, y1, z0], [x0, y1, z1], [x0, y0, z1], [x0, y0, z0]],
      fill: styles.negX || '#141619',
      stroke: styles.stroke || null,
    });
  }
  // +Z near-facing (facing +Z toward camera when cz > z1)
  if (cz > z1 && styles.posZ !== null) {
    faces.push({
      key: 'posZ',
      pts: [[x0, y1, z1], [x1, y1, z1], [x1, y0, z1], [x0, y0, z1]],
      fill: styles.posZ || '#121316',
      stroke: styles.stroke || null,
    });
  }
  // -Z far-facing (facing -Z toward camera when cz < z0)
  if (cz < z0 && styles.negZ !== null) {
    faces.push({
      key: 'negZ',
      pts: [[x1, y1, z0], [x0, y1, z0], [x0, y0, z0], [x1, y0, z0]],
      fill: styles.negZ || '#101114',
      stroke: styles.stroke || null,
    });
  }

  // Sort back-to-front by average projected depth
  for (const f of faces) {
    const p = camera.projectPoly(f.pts);
    f.depth = p.avgDepth;
    f.proj = p;
  }
  faces.sort((a, b) => b.depth - a.depth);

  for (const f of faces) {
    drawPoly3D(ctx, camera, f.pts, f.fill, f.stroke, styles.lineWidth || 0.9);
  }
  return faces;
}

/**
 * Depth-sorts a list of renderable descriptors (`{ depth, draw }`) back-to-front and draws them.
 */
export function renderDepthSorted(items) {
  items.sort((a, b) => b.depth - a.depth);
  for (let i = 0; i < items.length; i += 1) {
    items[i].draw();
  }
}
