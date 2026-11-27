export const PERIOD = 8;
export const TAU = Math.PI * 2;
export const COLORS = {
  cyan: '#28d7df', orange: '#ff765f', purple: '#b77bf4', green: '#55df8a'
};
export const LINE_NAMES = { cyan: '青线', orange: '橙红线', purple: '紫色线', green: '绿线' };
export const HUBS = [
  { id: 'people', name: '人民广场', x: 426, y: 128, color: COLORS.cyan, phase: 0.0, labelX: 446, labelY: 119 },
  { id: 'century', name: '世纪大道', x: 612, y: 276, color: COLORS.orange, phase: 2.1, labelX: 632, labelY: 304 },
  { id: 'xujiahui', name: '徐家汇', x: 426, y: 414, color: COLORS.green, phase: 4.2, labelX: 446, labelY: 442 }
];
export const clamp = (v, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
export const mod = (v, n = 1) => ((v % n) + n) % n;
export const smoothstep = v => { const x = clamp(v); return x * x * (3 - 2 * x); };
export const fmt = n => Number(n.toFixed(4));
