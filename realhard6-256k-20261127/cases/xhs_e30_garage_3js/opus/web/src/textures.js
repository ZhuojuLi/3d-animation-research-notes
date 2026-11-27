// Procedural canvas textures (offline, no external assets)
import * as THREE from 'three';

export function canvas(w, h) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}
function rnd(seed) { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; }

export function toTex(c, srgb = true, rep = [1, 1]) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]);
  t.anisotropy = 8; if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Concrete floor: color map + roughness map with oil stains & joints
export function concreteMaps() {
  const S = 2048, r = rnd(7);
  const [c, g] = canvas(S, S), [rc, rg] = canvas(S, S);
  g.fillStyle = '#8b8984'; g.fillRect(0, 0, S, S);
  rg.fillStyle = '#c8c8c8'; rg.fillRect(0, 0, S, S);
  // mottling
  for (let i = 0; i < 9000; i++) {
    const x = r() * S, y = r() * S, rad = 4 + r() * 60, v = 115 + r() * 40;
    g.fillStyle = `rgba(${v},${v - 2},${v - 6},0.05)`;
    g.beginPath(); g.arc(x, y, rad, 0, 7); g.fill();
  }
  // fine grain
  const id = g.getImageData(0, 0, S, S), d = id.data;
  for (let i = 0; i < d.length; i += 4) { const n = (r() - 0.5) * 22; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
  g.putImageData(id, 0, 0);
  // oil stains (dark, glossy)
  const stain = (x, y, R, a) => {
    for (let k = 0; k < 14; k++) {
      const ox = x + (r() - 0.5) * R, oy = y + (r() - 0.5) * R * 0.7, rr = R * (0.2 + r() * 0.6);
      const gr = g.createRadialGradient(ox, oy, 0, ox, oy, rr);
      gr.addColorStop(0, `rgba(28,26,24,${a})`); gr.addColorStop(1, 'rgba(28,26,24,0)');
      g.fillStyle = gr; g.beginPath(); g.ellipse(ox, oy, rr, rr * 0.75, r() * 3, 0, 7); g.fill();
      const rg2 = rg.createRadialGradient(ox, oy, 0, ox, oy, rr);
      rg2.addColorStop(0, 'rgba(90,90,90,0.4)'); rg2.addColorStop(1, 'rgba(40,40,40,0)');
      rg.fillStyle = rg2; rg.beginPath(); rg.ellipse(ox, oy, rr, rr * 0.75, 0, 0, 7); rg.fill();
    }
  };
  const spots = [[1000, 900, 420, 0.22], [700, 1100, 260, 0.25], [1300, 1200, 240, 0.2], [1050, 600, 200, 0.18],
    [400, 1500, 300, 0.12]];
  spots.forEach(s => stain(...s));
  for (let i = 0; i < 14; i++) stain(r() * S, r() * S, 20 + r() * 50, 0.08);
  // tyre scuffs
  g.strokeStyle = 'rgba(30,30,30,0.06)'; g.lineWidth = 26;
  for (let i = 0; i < 10; i++) { g.beginPath(); g.moveTo(r() * S, 0); g.bezierCurveTo(r() * S, S * 0.3, r() * S, S * 0.6, r() * S, S); g.stroke(); }
  // hairline cracks
  g.strokeStyle = 'rgba(40,38,35,0.35)'; g.lineWidth = 1.5;
  for (let i = 0; i < 18; i++) {
    let x = r() * S, y = r() * S; g.beginPath(); g.moveTo(x, y);
    for (let k = 0; k < 12; k++) { x += (r() - 0.5) * 60; y += (r() - 0.3) * 40; g.lineTo(x, y); } g.stroke();
  }
  // expansion joints (saw cuts)
  g.strokeStyle = 'rgba(35,33,30,0.7)'; g.lineWidth = 4; rg.strokeStyle = '#ffffff'; rg.lineWidth = 4;
  [0, S / 2].forEach(p => { g.beginPath(); g.moveTo(p + 2, 0); g.lineTo(p + 2, S); g.moveTo(0, p + 2); g.lineTo(S, p + 2); g.stroke(); });
  return { map: toTex(c, true), rough: toTex(rc, false) };
}

export function plasterTex(base = '#d9d4c9', S = 1024, seed = 3) {
  const r = rnd(seed); const [c, g] = canvas(S, S);
  g.fillStyle = base; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 3000; i++) {
    const v = r() > 0.5 ? 255 : 0; g.fillStyle = `rgba(${v},${v},${v},0.025)`;
    g.beginPath(); g.arc(r() * S, r() * S, 2 + r() * 40, 0, 7); g.fill();
  }
  // grime drips from top and dirt at bottom
  for (let i = 0; i < 40; i++) {
    const x = r() * S, gr = g.createLinearGradient(0, 0, 0, S * r());
    gr.addColorStop(0, 'rgba(80,70,60,0.10)'); gr.addColorStop(1, 'rgba(80,70,60,0)');
    g.fillStyle = gr; g.fillRect(x, 0, 3 + r() * 14, S);
  }
  const gb = g.createLinearGradient(0, S * 0.8, 0, S); gb.addColorStop(0, 'rgba(60,55,50,0)'); gb.addColorStop(1, 'rgba(60,55,50,0.35)');
  g.fillStyle = gb; g.fillRect(0, 0, S, S);
  return toTex(c);
}

export function posterTex() {
  const [c, g] = canvas(512, 900);
  g.fillStyle = '#1b2230'; g.fillRect(0, 0, 512, 900);
  const cx = 256, cy = 300;
  g.fillStyle = '#e8e8e8'; g.beginPath(); g.arc(cx, cy, 170, 0, 7); g.fill();
  g.fillStyle = '#111'; g.beginPath(); g.arc(cx, cy, 160, 0, 7); g.fill();
  g.fillStyle = '#d6d6d6'; g.beginPath(); g.arc(cx, cy, 104, 0, 7); g.fill();
  g.fillStyle = '#fff'; g.beginPath(); g.arc(cx, cy, 98, 0, 7); g.fill();
  g.fillStyle = '#1c69d4';
  g.beginPath(); g.moveTo(cx, cy); g.arc(cx, cy, 98, -Math.PI / 2, 0); g.fill();
  g.beginPath(); g.moveTo(cx, cy); g.arc(cx, cy, 98, Math.PI / 2, Math.PI); g.fill();
  g.fillStyle = '#fff'; g.font = 'bold 54px DejaVu Sans'; g.textAlign = 'center';
  [['B', -50], ['M', 0], ['W', 50]].forEach(([t, a]) => {
    g.save(); g.translate(cx, cy); g.rotate(a * Math.PI / 180); g.fillText(t, 0, -114); g.restore();
  });
  g.fillStyle = '#e9e4da'; g.fillRect(0, 560, 512, 340);
  g.fillStyle = '#2a2f3a'; // simple E30 silhouette
  g.beginPath(); g.moveTo(80, 780); g.lineTo(90, 730); g.lineTo(190, 715); g.lineTo(240, 670); g.lineTo(350, 668);
  g.lineTo(395, 712); g.lineTo(440, 718); g.lineTo(445, 780); g.closePath(); g.fill();
  g.fillStyle = '#111'; [[150, 782], [380, 782]].forEach(([x, y]) => { g.beginPath(); g.arc(x, y, 26, 0, 7); g.fill(); });
  g.fillStyle = '#333'; g.font = 'bold 30px DejaVu Sans'; g.fillText('THE 3 SERIES', 256, 640);
  g.font = '20px DejaVu Sans'; g.fillText('E30 · 1982–1994', 256, 860);
  return toTex(c);
}

export function textTex(lines, w, h, bg, fg, font, opts = {}) {
  const [c, g] = canvas(w, h);
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  if (opts.border) { g.strokeStyle = opts.border; g.lineWidth = opts.bw || 6; g.strokeRect(6, 6, w - 12, h - 12); }
  g.fillStyle = fg; g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle';
  lines.forEach((t, i) => g.fillText(t, w / 2 + (opts.dx || 0), h * (i + 1) / (lines.length + 1)));
  if (opts.draw) opts.draw(g);
  return toTex(c);
}

export function plateTex() {
  return textTex(['B·E 3030'], 520, 112, '#f4f4ee', '#111', 'bold 78px DejaVu Sans Mono', {
    border: '#111', bw: 5, dx: 22,
    draw: g => { g.fillStyle = '#1440a0'; g.fillRect(8, 8, 46, 96); g.fillStyle = '#fff'; g.font = 'bold 30px DejaVu Sans'; g.fillText('D', 31, 80); }
  });
}

export function tireSideTex() {
  const [c, g] = canvas(512, 512);
  g.fillStyle = '#161616'; g.fillRect(0, 0, 512, 512);
  g.fillStyle = '#2a2a2a'; g.font = 'bold 34px DejaVu Sans'; g.textAlign = 'center';
  ['PILOT', '205/55 R15', 'RADIAL'].forEach((t, i) => {
    g.save(); g.translate(256, 256); g.rotate(i * 2.1); g.fillText(t, 0, -205); g.restore();
  });
  return toTex(c);
}

export function noiseTex(S = 256, amp = 40, base = 128, seed = 11) {
  const r = rnd(seed); const [c, g] = canvas(S, S); const id = g.createImageData(S, S);
  for (let i = 0; i < id.data.length; i += 4) { const v = base + (r() - 0.5) * amp; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 255; }
  g.putImageData(id, 0, 0); return toTex(c, false);
}

export function beamTex() {
  const [c, g] = canvas(64, 256);
  const gr = g.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, 'rgba(255,240,215,0.9)'); gr.addColorStop(1, 'rgba(255,240,215,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 256);
  const gx = g.createLinearGradient(0, 0, 64, 0);
  gx.addColorStop(0, 'rgba(0,0,0,1)'); gx.addColorStop(0.2, 'rgba(0,0,0,0)'); gx.addColorStop(0.8, 'rgba(0,0,0,0)'); gx.addColorStop(1, 'rgba(0,0,0,1)');
  g.globalCompositeOperation = 'destination-out'; g.fillStyle = gx; g.fillRect(0, 0, 64, 256);
  return toTex(c);
}
