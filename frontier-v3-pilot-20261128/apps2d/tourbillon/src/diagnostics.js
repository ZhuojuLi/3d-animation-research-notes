/**
 * diagnostics.js — Live Real-Time Telemetry Renderer (Phase Portrait, Amplitude Trace,
 * Beat Error, Escapement State Badge, and Slow-Motion Timeline Readouts).
 *
 * Strictly zero fake curves: every point plotted on #phase-canvas (theta vs omega)
 * and #amplitude-canvas (oscillation waveform + amplitude envelope) is read directly
 * from the RK4 solver's integrated trajectory history buffer!
 */

const RAD_TO_DEG = 180 / Math.PI;
const TWO_PI = Math.PI * 2;

export class DiagnosticsRenderer {
  constructor() {
    this.phaseCanvas = document.getElementById('phase-canvas');
    this.ampCanvas = document.getElementById('amplitude-canvas');
    this.phaseCtx = this.phaseCanvas ? this.phaseCanvas.getContext('2d') : null;
    this.ampCtx = this.ampCanvas ? this.ampCanvas.getContext('2d') : null;

    this.beatErrorEl = document.getElementById('beat-error-val');
    this.statusEl = document.getElementById('escapement-status-val');
    this.actIndicatorEl = document.getElementById('act-indicator');
    this.timelineRateEl = document.getElementById('timeline-rate-val');
    this.scrubEl = document.getElementById('scrub');
  }

  resize() {
    const syncCanvas = canvas => {
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      if (rect.width < 4 || rect.height < 4) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.round(rect.width * dpr);
      const h = Math.round(rect.height * dpr);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
    };
    syncCanvas(this.phaseCanvas);
    syncCanvas(this.ampCanvas);
  }

  /**
   * Renders the real-time (theta, omega) phase portrait directly from solver.history.
   */
  renderPhasePortrait(frame) {
    const ctx = this.phaseCtx;
    const canvas = this.phaseCanvas;
    if (!ctx || !canvas) return;

    const w = canvas.width;
    const h = canvas.height;
    const dpr = w / Math.max(1, canvas.getBoundingClientRect().width || 96);
    const cx = w * 0.5;
    const cy = h * 0.5;
    const rMax = Math.min(w, h) * 0.44;

    ctx.clearRect(0, 0, w, h);

    // Subtle dark circular calibration scope backdrop
    ctx.beginPath();
    ctx.arc(cx, cy, rMax + 2 * dpr, 0, TWO_PI);
    ctx.fillStyle = 'rgba(9, 17, 30, 0.65)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(130, 165, 200, 0.22)';
    ctx.lineWidth = 1.0 * dpr;
    ctx.stroke();

    // Orthogonal phase axes (theta horizontal, omega vertical)
    ctx.strokeStyle = 'rgba(135, 170, 205, 0.28)';
    ctx.lineWidth = 0.8 * dpr;
    ctx.beginPath();
    ctx.moveTo(cx - rMax, cy);
    ctx.lineTo(cx + rMax, cy);
    ctx.moveTo(cx, cy - rMax);
    ctx.lineTo(cx, cy + rMax);
    ctx.stroke();

    // Subtle concentric reference ellipses (100 deg, 180 deg, 240 deg, 295 deg chronoscope grid)
    ctx.strokeStyle = 'rgba(95, 210, 232, 0.16)';
    ctx.lineWidth = 0.7 * dpr;
    for (const frac of [0.27, 0.49, 0.66, 0.81]) {
      ctx.beginPath();
      ctx.ellipse(cx, cy, rMax * frac, rMax * frac * 0.82, -0.35, 0, TWO_PI);
      ctx.stroke();
    }

    // Plot real integrated RK4 (theta, omega) phase trajectory
    // Normalize theta by 365 deg (6.37 rad), omega by 165 rad/s (4 Hz * 365 deg)
    const thetaScale = rMax / (365 * (Math.PI / 180));
    const omegaScale = rMax / 165.0;

    // Slight classic tilted phase-space projection aesthetic matching reference-0.jpg
    const tilt = -0.22;
    const cosT = Math.cos(tilt);
    const sinT = Math.sin(tilt);
    const mapPt = (th, om) => {
      const ux = Math.max(-rMax, Math.min(rMax, th * thetaScale));
      const uy = Math.max(-rMax, Math.min(rMax, -om * omegaScale));
      return {
        x: cx + ux * cosT - uy * sinT,
        y: cy + ux * sinT + uy * cosT,
      };
    };

    const hist = frame.history || [];
    if (hist.length >= 2) {
      // Draw fading cyan ribbon from oldest to newest real RK4 points
      const segs = 4;
      const chunkSize = Math.max(2, Math.floor(hist.length / segs));
      for (let s = 0; s < segs; s += 1) {
        const iStart = s * chunkSize;
        const iEnd = s === segs - 1 ? hist.length - 1 : Math.min(hist.length - 1, (s + 1) * chunkSize);
        const alpha = 0.25 + (0.72 * (s + 1)) / segs;

        ctx.beginPath();
        for (let i = iStart; i <= iEnd; i += 1) {
          const pt = mapPt(hist[i].theta, hist[i].omega);
          if (i === iStart) ctx.moveTo(pt.x, pt.y);
          else ctx.lineTo(pt.x, pt.y);
        }
        ctx.strokeStyle = `rgba(95, 214, 240, ${alpha.toFixed(2)})`;
        ctx.lineWidth = (1.1 + 0.55 * (s / segs)) * dpr;
        ctx.stroke();
      }
    }

    // Live head state dot (warm gold glowing marker at current (theta, omega))
    const cur = mapPt(frame.nodes.balanceWheel.angle, frame.nodes.balanceWheel.omega);
    ctx.beginPath();
    ctx.arc(cur.x, cur.y, 4.4 * dpr, 0, TWO_PI);
    ctx.fillStyle = 'rgba(240, 206, 130, 0.34)';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cur.x, cur.y, 2.3 * dpr, 0, TWO_PI);
    ctx.fillStyle = '#fae1a4';
    ctx.fill();
  }

  /**
   * Renders the real-time balance oscillation waveform & amplitude trace directly from solver.history.
   */
  renderAmplitudeTrace(frame) {
    const ctx = this.ampCtx;
    const canvas = this.ampCanvas;
    if (!ctx || !canvas) return;

    const w = canvas.width;
    const h = canvas.height;
    const dpr = w / Math.max(1, canvas.getBoundingClientRect().width || 210);
    const padX = 6 * dpr;
    const midY = h * 0.5;
    const ampPx = h * 0.41;

    ctx.clearRect(0, 0, w, h);

    // Center zero-axis line
    ctx.strokeStyle = 'rgba(138, 170, 204, 0.25)';
    ctx.lineWidth = 0.9 * dpr;
    ctx.beginPath();
    ctx.moveTo(padX, midY);
    ctx.lineTo(w - padX, midY);
    ctx.stroke();

    // Nominal +/-295 deg envelope guide hairlines
    const nomY = (295.0 / 365.0) * ampPx;
    ctx.strokeStyle = 'rgba(95, 210, 232, 0.16)';
    ctx.setLineDash([3 * dpr, 3 * dpr]);
    ctx.beginPath();
    ctx.moveTo(padX, midY - nomY);
    ctx.lineTo(w - padX, midY - nomY);
    ctx.moveTo(padX, midY + nomY);
    ctx.lineTo(w - padX, midY + nomY);
    ctx.stroke();
    ctx.setLineDash([]);

    const hist = frame.history || [];
    if (hist.length >= 2) {
      const spanW = w - padX * 2;
      const scaleY = ampPx / (365.0 * (Math.PI / 180));

      // Subtle cyan upper/lower measured amplitude envelope curve
      ctx.beginPath();
      for (let i = 0; i < hist.length; i += 1) {
        const x = padX + (i / (hist.length - 1)) * spanW;
        const envY = Math.min(ampPx, (hist[i].ampDeg / 365.0) * ampPx);
        if (i === 0) ctx.moveTo(x, midY - envY);
        else ctx.lineTo(x, midY - envY);
      }
      ctx.strokeStyle = 'rgba(95, 210, 232, 0.32)';
      ctx.lineWidth = 1.0 * dpr;
      ctx.stroke();

      // Main warm-gold real oscillation waveform theta(t)
      ctx.beginPath();
      for (let i = 0; i < hist.length; i += 1) {
        const x = padX + (i / (hist.length - 1)) * spanW;
        const y = midY - Math.max(-ampPx, Math.min(ampPx, hist[i].theta * scaleY));
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      const waveGrad = ctx.createLinearGradient(padX, 0, w - padX, 0);
      waveGrad.addColorStop(0, 'rgba(214, 186, 128, 0.32)');
      waveGrad.addColorStop(0.55, 'rgba(236, 212, 162, 0.85)');
      waveGrad.addColorStop(1, '#fff1ce');
      ctx.strokeStyle = waveGrad;
      ctx.lineWidth = 1.45 * dpr;
      ctx.stroke();

      // Live trace head marker on right edge
      const last = hist[hist.length - 1];
      const lx = w - padX;
      const ly = midY - Math.max(-ampPx, Math.min(ampPx, last.theta * scaleY));
      ctx.beginPath();
      ctx.arc(lx, ly, 2.4 * dpr, 0, TWO_PI);
      ctx.fillStyle = '#7ee8ff';
      ctx.fill();
    }
  }

  /**
   * Synchronizes all live DOM telemetry readouts from the exact same solver frame.
   */
  render(frame, actInfo, params, isInteractiveMode) {
    this.resize();
    this.renderPhasePortrait(frame);
    this.renderAmplitudeTrace(frame);

    // Beat error readout (+0.1 ms nominal, dynamic on perturbation)
    if (this.beatErrorEl) {
      const be = frame.beatErrorMs;
      const sign = be >= 0 ? '+' : '';
      this.beatErrorEl.textContent = `${sign}${be.toFixed(1)} ms`;
    }

    // Escapement status badge synced to SAME solver state
    if (this.statusEl) {
      const displayState = frame.escapementState === 'LOCK' ? 'LOCKED' : frame.escapementState;
      const ampRounded = Math.round(frame.amplitudeDeg);
      this.statusEl.textContent = `${displayState} \u2022 ${ampRounded}\u00b0`;
      this.statusEl.className = 'status-readout';
      if (frame.escapementState === 'IMPULSE') this.statusEl.classList.add('state-impulse');
      else if (frame.escapementState === 'RELEASE') this.statusEl.classList.add('state-release');
      else if (frame.escapementState === 'RELOCK') this.statusEl.classList.add('state-relock');
    }

    // Act badge + timeline scrub sync
    if (this.actIndicatorEl && actInfo) {
      const actStr = actInfo.label;
      this.actIndicatorEl.textContent = `${actStr} \u2022 ${frame.t.toFixed(1)}s`;
    }

    if (this.timelineRateEl && actInfo) {
      const shownRate = isInteractiveMode ? params.timeScale : actInfo.effectiveTimeScale;
      this.timelineRateEl.textContent = `${shownRate.toFixed(2)}\u00d7`;
    }

    if (this.scrubEl) {
      this.scrubEl.value = frame.t.toFixed(2);
      const pct = Math.max(0, Math.min(100, (frame.t / 16.0) * 100));
      this.scrubEl.style.setProperty('--pct', `${pct.toFixed(2)}%`);
    }
  }
}
