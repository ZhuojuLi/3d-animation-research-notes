export const TAU = Math.PI * 2;
export const DURATION = 8;
export const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = t => { t = clamp(t); return t * t * (3 - 2 * t); };
export const fmt = n => Number(n.toFixed(4));
export function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = Math.imul(1664525, s) + 1013904223 >>> 0) / 4294967296);
}
export function hashed(n) { return ((Math.sin(n * 127.1) * 43758.5453) % 1 + 1) % 1; }
export function polygon(ctx, pts, close = true) {
  ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]));
  if (close) ctx.closePath();
}
export function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath(); ctx.moveTo(x + rr, y); ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr); ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr); ctx.closePath();
}
export function line(ctx, x1, y1, x2, y2, color, width = 1) {
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke();
}
export function text(ctx, value, x, y, size = 14, color = '#d7cbaa', align = 'left', weight = '400') {
  ctx.font = `${weight} ${size}px "Noto Sans CJK SC", "Microsoft YaHei", "PingFang SC", sans-serif`;
  ctx.textAlign = align; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = color; ctx.fillText(value, x, y);
}
export function trackingText(ctx, value, x, y, spacing, size, color, align = 'left') {
  ctx.font = `400 ${size}px "Noto Sans CJK SC", "Microsoft YaHei", sans-serif`;
  const chars = [...value]; const widths = chars.map(c => ctx.measureText(c).width);
  let pen = align === 'center' ? x - (widths.reduce((a,b)=>a+b,0) + spacing * (chars.length - 1))/2 : x;
  ctx.fillStyle = color; ctx.textAlign = 'left';
  chars.forEach((c,i) => { ctx.fillText(c,pen,y); pen += widths[i] + spacing; });
}
