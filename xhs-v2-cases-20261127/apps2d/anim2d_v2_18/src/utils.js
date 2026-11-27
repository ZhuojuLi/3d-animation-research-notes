export const TAU = Math.PI * 2;
export const DURATION = 8;
export const WORLD = { width: 1200, height: 760, horizon: 354 };
export const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = t => { t = clamp(t); return t * t * (3 - 2 * t); };
export const mod = (n, m) => ((n % m) + m) % m;
export const cyclicTime = t => mod(Number.isFinite(+t) ? +t : 0, DURATION);
export function seeded(seed = 18) {
  let s = seed >>> 0;
  return () => { s = (Math.imul(1664525, s) + 1013904223) >>> 0; return s / 4294967296; };
}
export function hexMix(a, b, t) {
  const p = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const A = p(a), B = p(b);
  return `rgb(${Math.round(lerp(A[0], B[0], t))},${Math.round(lerp(A[1], B[1], t))},${Math.round(lerp(A[2], B[2], t))})`;
}
export function path(ctx, points, close = true) {
  ctx.beginPath();
  points.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]));
  if (close) ctx.closePath();
}
export function strokePath(ctx, points, color, width = 1, close = false) {
  path(ctx, points, close); ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke();
}
export function circle(ctx, x, y, r, fill, stroke = null, width = 1) {
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = width; ctx.stroke(); }
}
export function line(ctx, x1, y1, x2, y2, color, width = 1) {
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke();
}
export function glow(ctx, x, y, radius, inner, outer = 'rgba(0,0,0,0)') {
  const g = ctx.createRadialGradient(x, y, 0, x, y, radius);
  g.addColorStop(0, inner); g.addColorStop(1, outer);
  ctx.fillStyle = g; ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
}
export function pulseAt(t, startedAt) {
  if (startedAt == null) return { age: Infinity, strength: 0, envelope: 0 };
  const age = mod(t - startedAt, DURATION);
  const envelope = age < 3.4 ? Math.exp(-age * 1.25) : 0;
  return { age, strength: envelope * (0.72 + 0.28 * Math.cos(age * 17)), envelope };
}
export function formatTime(seconds) {
  const s = clamp(seconds, 0, DURATION);
  return `00:${String(Math.floor(s)).padStart(2, '0')}.${String(Math.floor((s % 1) * 100)).padStart(2, '0')}`;
}
