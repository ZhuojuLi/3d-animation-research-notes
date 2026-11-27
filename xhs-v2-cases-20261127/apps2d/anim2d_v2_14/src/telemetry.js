/** Five display channels. Each is a pure projection of the shared scene state. */
const METRICS = [
  { key: 'arcAngle', max: 58, code: 'ARC', format: v => `${v.toFixed(1)}°` },
  { key: 'compassTravel', max: 202.4, code: 'PTH', format: v => `${v.toFixed(1)} mm` },
  { key: 'tsquarePosition', max: 64, code: 'IDX', format: v => `${v.toFixed(1)} mm` },
  { key: 'cutterSpeed', max: 150, code: 'VEL', format: v => `${v.toFixed(1)}` },
  { key: 'trimProgress', max: 100, code: 'CUT', format: v => `${v.toFixed(0)}%` },
];

export class Telemetry {
  constructor(root = document) {
    this.nodes = METRICS.map((metric, index) => ({
      metric,
      value: root.getElementById(`gauge-value-${index}`),
      arc: root.getElementById(`gauge-arc-${index}`),
      needle: root.getElementById(`gauge-needle-${index}`),
      meter: root.getElementById(`meter-${index}`),
      code: root.getElementById(`gauge-code-${index}`),
    }));
  }

  render(state) {
    this.nodes.forEach(({ metric, value, arc, needle, meter, code }) => {
      const raw = Math.max(0, state.telemetry[metric.key]);
      const fraction = Math.max(0, Math.min(1, raw / metric.max));
      value.textContent = metric.format(raw);
      arc.setAttribute('stroke-dashoffset', (100 * (1 - fraction)).toFixed(4));
      needle.setAttribute('transform', `rotate(${-120 + 240 * fraction})`);
      meter.setAttribute('width', (133 * fraction).toFixed(4));
      code.textContent = `${metric.code} ${String(Math.round(fraction * 99)).padStart(2, '0')}`;
    });
  }
}
