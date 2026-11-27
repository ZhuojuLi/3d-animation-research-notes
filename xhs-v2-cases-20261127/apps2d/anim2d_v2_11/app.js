(() => {
  // output/src/config.js
  var PERIOD = 8;
  var TAU = Math.PI * 2;
  var COLORS = {
    cyan: "#28d7df",
    orange: "#ff765f",
    purple: "#b77bf4",
    green: "#55df8a"
  };
  var LINE_NAMES = { cyan: "\u9752\u7EBF", orange: "\u6A59\u7EA2\u7EBF", purple: "\u7D2B\u8272\u7EBF", green: "\u7EFF\u7EBF" };
  var HUBS = [
    { id: "people", name: "\u4EBA\u6C11\u5E7F\u573A", x: 426, y: 128, color: COLORS.cyan, phase: 0, labelX: 446, labelY: 119 },
    { id: "century", name: "\u4E16\u7EAA\u5927\u9053", x: 612, y: 276, color: COLORS.orange, phase: 2.1, labelX: 632, labelY: 304 },
    { id: "xujiahui", name: "\u5F90\u5BB6\u6C47", x: 426, y: 414, color: COLORS.green, phase: 4.2, labelX: 446, labelY: 442 }
  ];
  var clamp = (v, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
  var mod = (v, n = 1) => (v % n + n) % n;
  var smoothstep = (v) => {
    const x = clamp(v);
    return x * x * (3 - 2 * x);
  };
  var fmt = (n) => Number(n.toFixed(4));

  // output/src/timeline.js
  function periodicTime(seconds) {
    const n = Number(seconds);
    if (!Number.isFinite(n)) return 0;
    return mod(Math.round(n * 1e5) / 1e5, PERIOD);
  }
  function clockAt(t) {
    const total = 15 * 3600 + 38 * 60 + 45 + Math.floor(t + 1e-7);
    const hh = String(Math.floor(total / 3600) % 24).padStart(2, "0");
    const mm = String(Math.floor(total / 60) % 60).padStart(2, "0");
    const ss = String(total % 60).padStart(2, "0");
    return `${hh}:${mm}:${ss}`;
  }
  function timecodeAt(t) {
    const seconds = Math.floor(t + 1e-6);
    const tenth = Math.floor((t - seconds + 1e-6) * 10);
    return `00:${String(seconds).padStart(2, "0")}.${tenth}`;
  }
  function easedPhase(phase) {
    return phase + 0.025 * Math.sin(TAU * phase);
  }
  function globalPace(phase) {
    return 1 + 0.025 * TAU * Math.cos(TAU * phase);
  }
  var PlaybackClock = class {
    constructor(onFrame, onPlayingChange) {
      this.onFrame = onFrame;
      this.onPlayingChange = onPlayingChange;
      this.t = 0;
      this.playing = false;
      this.raf = 0;
      this.last = 0;
      this.tick = this.tick.bind(this);
    }
    seek(seconds) {
      this.pause();
      this.t = periodicTime(seconds);
      this.onFrame(this.t);
      return this.t;
    }
    render(seconds) {
      this.pause();
      this.t = periodicTime(seconds);
      this.onFrame(this.t);
      return this.t;
    }
    play() {
      if (this.playing) return;
      this.playing = true;
      this.last = performance.now();
      this.onPlayingChange(true);
      this.raf = requestAnimationFrame(this.tick);
    }
    pause() {
      if (!this.playing) return;
      this.playing = false;
      cancelAnimationFrame(this.raf);
      this.onPlayingChange(false);
    }
    tick(now) {
      if (!this.playing) return;
      const dt = Math.min(0.1, Math.max(0, (now - this.last) / 1e3));
      this.last = now;
      this.t = mod(this.t + dt, PERIOD);
      this.onFrame(this.t);
      this.raf = requestAnimationFrame(this.tick);
    }
  };

  // output/src/network.js
  var NS = "http://www.w3.org/2000/svg";
  var make = (tag, attrs = {}, parent) => {
    const node2 = document.createElementNS(NS, tag);
    Object.entries(attrs).forEach(([key, value]) => node2.setAttribute(key, value));
    if (parent) parent.appendChild(node2);
    return node2;
  };
  var routeDefs = [
    { id: "cyan", d: "M 52 128 H 466 Q 490 128 502 151 L 570 264 Q 582 286 578 313 L 570 350", stations: [
      [0.09, "\u9EC4\u6D66\u5927\u9053", 0, -18, "middle"],
      [0.28, "\u5357\u4EAC\u897F\u8DEF", 0, 25, "middle"],
      [0.44, "\u9759\u5B89\u5BFA", -4, -18, "middle"],
      [0.79, "\u8C6B\u56ED", 17, 17, "start"],
      [0.96, "\u6D66\u4E1C\u6EE8\u6C5F", -10, 24, "end"]
    ], arrows: [0.18, 0.52, 0.88] },
    { id: "orange", d: "M 96 520 C 108 439 151 354 228 315 Q 252 276 301 276 H 878", stations: [
      [0.11, "\u9F99\u534E", -15, 20, "end"],
      [0.27, "\u6253\u6D66\u6865", -12, -16, "end"],
      [0.45, "\u6DEE\u6D77\u4E2D\u8DEF", 0, -17, "middle"],
      [0.8, "\u6D66\u4E1C\u5927\u9053", 0, 24, "middle"],
      [0.94, "\u9F99\u9633\u8DEF", 0, -17, "middle"]
    ], arrows: [0.17, 0.55, 0.9] },
    { id: "purple", d: "M 312 548 V 486 Q 312 450 345 431 L 426 414 L 612 276 L 698 198 Q 710 186 710 168 V 38", stations: [
      [0.07, "\u4E0A\u6D77\u5357\u7AD9", 15, 4, "start"],
      [0.2, "\u6F15\u6EAA\u8DEF", -15, 0, "end"],
      [0.75, "\u6C11\u751F\u8DEF", -15, -3, "end"],
      [0.94, "\u91D1\u6865", 15, 0, "start"]
    ], arrows: [0.13, 0.58, 0.88] },
    { id: "green-horizontal", line: "green", d: "M 242 414 H 874", stations: [
      [0.08, "\u6842\u6797\u516C\u56ED", 0, -18, "middle"],
      [0.76, "\u4E0A\u6D77\u79D1\u6280\u9986", 0, -18, "middle"],
      [0.94, "\u5F20\u6C5F\u8DEF", 0, 24, "middle"]
    ], arrows: [0.18, 0.86] },
    { id: "green-vertical", line: "green", d: "M 426 48 V 532", stations: [
      [0.38, "\u9655\u897F\u5357\u8DEF", 17, 0, "start"],
      [0.86, "\u6F15\u5B9D\u8DEF", 17, 0, "start"]
    ], arrows: [0.28, 0.78] }
  ];
  var trainPlan = [
    ["cyan", "cyan", 0.07, 1],
    ["cyan", "cyan", 0.31, -1],
    ["cyan", "cyan", 0.58, 1],
    ["cyan", "cyan", 0.84, -1],
    ["orange", "orange", 0.12, 1],
    ["orange", "orange", 0.36, -1],
    ["orange", "orange", 0.61, 1],
    ["orange", "orange", 0.87, -1],
    ["purple", "purple", 0.09, 1],
    ["purple", "purple", 0.34, -1],
    ["purple", "purple", 0.6, 1],
    ["purple", "purple", 0.85, -1],
    ["green", "green-horizontal", 0.1, 1],
    ["green", "green-horizontal", 0.32, -1],
    ["green", "green-horizontal", 0.61, 1],
    ["green", "green-horizontal", 0.86, -1],
    ["green", "green-vertical", 0.27, 1],
    ["green", "green-vertical", 0.72, -1]
  ];
  var baseSpeeds = { cyan: 54, orange: 56, purple: 52, green: 58 };
  function zoneFactor(q, z0, z1) {
    const low = 20 / baseSpeeds.green;
    const ramp = 0.042;
    if (q >= z0 && q <= z1) return low;
    if (q > z0 - ramp && q < z0) return 1 - (1 - low) * smoothstep((q - z0 + ramp) / ramp);
    if (q > z1 && q < z1 + ramp) return low + (1 - low) * smoothstep((q - z1) / ramp);
    return 1;
  }
  function limitedProfile(offset, direction, z0, z1) {
    const S = 2048, N = 1024;
    const cumulative = new Float64Array(S + 1);
    for (let i = 0; i < S; i++) {
      const q = mod(offset + direction * (i + 0.5) / S);
      cumulative[i + 1] = cumulative[i] + 1 / (S * zoneFactor(q, z0, z1));
    }
    const total = cumulative[S];
    const table = new Float64Array(N + 1);
    for (let j = 0; j <= N; j++) {
      if (j === N) {
        table[j] = offset;
        continue;
      }
      const target = j / N * total;
      let lo = 0, hi = S;
      while (lo + 1 < hi) {
        const mid = lo + hi >> 1;
        if (cumulative[mid] <= target) lo = mid;
        else hi = mid;
      }
      const span = cumulative[lo + 1] - cumulative[lo];
      const f = span ? clamp((target - cumulative[lo]) / span) : 0;
      table[j] = mod(offset + direction * (lo + f) / S);
    }
    return { table, N, z0, z1 };
  }
  function sampleProfile(profile, phase) {
    const x = phase * profile.N;
    const i = Math.min(profile.N - 1, Math.floor(x));
    const f = x - i;
    let a = profile.table[i], b = profile.table[i + 1];
    if (b - a > 0.5) b -= 1;
    if (a - b > 0.5) a -= 1;
    return mod(a + (b - a) * f);
  }
  function tangent(path, q, direction) {
    const len = path.__length;
    const d = q * len;
    const a = path.getPointAtLength(clamp(d - 1.6, 0, len));
    const b = path.getPointAtLength(clamp(d + 1.6, 0, len));
    let angle = Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI;
    if (direction < 0) angle += 180;
    return angle;
  }
  var NetworkScene = class {
    constructor(svg) {
      this.svg = svg;
      this.paths = /* @__PURE__ */ new Map();
      this.lineLayers = /* @__PURE__ */ new Map();
      this.trains = [];
      this.hubs = [];
      this.zone = { x0: 568, x1: 710 };
      this.build();
      this.resize();
    }
    build() {
      this.svg.innerHTML = `
      <defs>
        <pattern id="minor-grid" width="24" height="24" patternUnits="userSpaceOnUse"><path d="M24 0H0V24" fill="none" stroke="#17334b" stroke-width=".55" opacity=".55"/></pattern>
        <pattern id="major-grid" width="120" height="120" patternUnits="userSpaceOnUse"><rect width="120" height="120" fill="url(#minor-grid)"/><path d="M120 0H0V120" fill="none" stroke="#214158" stroke-width=".8" opacity=".5"/></pattern>
        <linearGradient id="river-water" x1="0" y1="1" x2="1" y2="0"><stop stop-color="#087bd4"/><stop offset=".45" stop-color="#079de6"/><stop offset="1" stop-color="#04b9ef"/></linearGradient>
        <linearGradient id="river-shine" x1="0" y1="0" x2="1" y2="0"><stop stop-color="#7be8ff" stop-opacity="0"/><stop offset=".5" stop-color="#7be8ff" stop-opacity=".35"/><stop offset="1" stop-color="#7be8ff" stop-opacity="0"/></linearGradient>
        <filter id="river-glow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="6"/></filter>
        <filter id="hub-soft" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="5"/></filter>
        <clipPath id="speed-clip"><rect x="568" y="385" width="142" height="58"/></clipPath>
        ${HUBS.map((h) => `<radialGradient id="glow-${h.id}"><stop offset="0" stop-color="${h.color}" stop-opacity=".56"/><stop offset=".24" stop-color="${h.color}" stop-opacity=".24"/><stop offset=".62" stop-color="${h.color}" stop-opacity=".08"/><stop offset="1" stop-color="${h.color}" stop-opacity="0"/></radialGradient>`).join("")}
      </defs>
      <g id="landscape">
        <rect data-allow-clip="true" x="-1000" y="-1000" width="3000" height="2600" fill="#071526"/>
        <rect data-allow-clip="true" x="-1000" y="-1000" width="3000" height="2600" fill="url(#major-grid)"/>
        <g id="city-blocks"></g><g id="street-fabric"></g>
      </g>
      <g id="river-layer">
        <path data-allow-clip="true" class="river-course" d="M -25 596 C 29 408 235 310 413 218 C 548 149 596 73 625 -40" fill="none" stroke="#063558" stroke-width="112" opacity=".44" filter="url(#river-glow)"/>
        <path data-allow-clip="true" class="river-course" d="M -25 596 C 29 408 235 310 413 218 C 548 149 596 73 625 -40" fill="none" stroke="#2b5975" stroke-width="106"/>
        <path data-allow-clip="true" class="river-course" d="M -25 596 C 29 408 235 310 413 218 C 548 149 596 73 625 -40" fill="none" stroke="#102e4b" stroke-width="102"/>
        <path data-allow-clip="true" class="river-course" d="M -25 596 C 29 408 235 310 413 218 C 548 149 596 73 625 -40" fill="none" stroke="#2a92b7" stroke-width="98"/>
        <path data-allow-clip="true" class="river-course" d="M -25 596 C 29 408 235 310 413 218 C 548 149 596 73 625 -40" fill="none" stroke="url(#river-water)" stroke-width="93"/>
        <path data-allow-clip="true" class="river-course" d="M -25 596 C 29 408 235 310 413 218 C 548 149 596 73 625 -40" fill="none" stroke="#43c9f0" stroke-width="1.2" opacity=".55"/>
        <path data-allow-clip="true" id="river-current" class="river-course" d="M -25 596 C 29 408 235 310 413 218 C 548 149 596 73 625 -40" fill="none" stroke="#a4f0ff" stroke-width="1" stroke-dasharray="1 20" opacity=".32"/>
        <text x="245" y="289" fill="#a0ecff" opacity=".58" font-size="16" letter-spacing="7" transform="rotate(-29 245 289)">\u9EC4 \u6D66 \u6C5F</text>
      </g>
      <g id="bridges"></g>
      <g id="district-labels" fill="#46718b" opacity=".52" font-size="11" letter-spacing="3"><text x="132" y="237">\u6D66\u897F\u6838\u5FC3\u533A</text><text x="787" y="109">\u6D66\u4E1C\u65B0\u533A</text></g>
      <g id="routes"></g><g id="speed-restriction"></g><g id="hub-layer"></g><g id="train-layer"></g>
    `;
      this.buildCityTexture();
      this.buildRiverDetails();
      this.buildRoutes();
      this.buildSpeedZone();
      this.buildHubs();
      this.buildTrains();
    }
    buildCityTexture() {
      const blocks = this.svg.querySelector("#city-blocks");
      const streets = this.svg.querySelector("#street-fabric");
      for (let row = 0; row < 14; row++) {
        for (let col = 0; col < 23; col++) {
          if ((row * 7 + col * 5) % 4 !== 0) continue;
          const x = 26 + col * 43 + row % 2 * 8, y = 23 + row * 39;
          const w = 18 + (row + col) % 3 * 5, h = 10 + (row * 2 + col) % 3 * 4;
          make("rect", { "data-allow-clip": "true", x, y, width: w, height: h, rx: 1.5, fill: "#102a40", stroke: "#1a3a50", "stroke-width": 0.45, opacity: 0.38 }, blocks);
        }
      }
      const streetPaths = [
        "M20 203L310 54L481 43",
        "M49 350L167 223L337 195L391 61",
        "M154 558L199 399L371 331L538 66",
        "M447 555L483 364L654 127L763 27",
        "M575 553L622 397L813 200L934 148",
        "M671 516L799 377L944 324",
        "M36 468L231 451L411 474L612 458L910 492",
        "M66 86L253 74L339 30",
        "M533 336L725 339L931 296",
        "M514 178L685 107L894 99",
        "M705 548L729 423L907 409"
      ];
      streetPaths.forEach((d) => make("path", { d, fill: "none", stroke: "#24445a", "stroke-width": 0.8, opacity: 0.38 }, streets));
    }
    buildRiverDetails() {
      const river = this.svg.querySelector(".river-course");
      const layer = this.svg.querySelector("#bridges");
      const len = river.getTotalLength();
      [0.22, 0.51, 0.79].forEach((fraction, index) => {
        const d = fraction * len;
        const p = river.getPointAtLength(d);
        const a = river.getPointAtLength(Math.max(0, d - 2));
        const b = river.getPointAtLength(Math.min(len, d + 2));
        const angle = Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI + 90;
        const g = make("g", { transform: `translate(${p.x.toFixed(2)} ${p.y.toFixed(2)}) rotate(${angle.toFixed(2)})`, opacity: 0.9 }, layer);
        make("rect", { x: -60, y: -9, width: 120, height: 18, rx: 1, fill: "#0b243a", stroke: "#7796a5", "stroke-width": 1 }, g);
        make("rect", { x: -60, y: -6, width: 120, height: 12, fill: "#234156", stroke: "#a0b5be", "stroke-width": 0.55 }, g);
        make("line", { x1: -60, y1: 0, x2: 60, y2: 0, stroke: "#9db7bf", "stroke-width": 0.7, "stroke-dasharray": "6 5", opacity: 0.75 }, g);
        [-10, 10].forEach((y) => make("line", { x1: -60, y1: y, x2: 60, y2: y, stroke: "#071727", "stroke-width": 1.5 }, g));
        make("rect", { x: -4, y: -13, width: 8, height: 26, fill: "#18364b", stroke: "#688695", "stroke-width": 0.6 }, g);
        g.dataset.bridge = String(index + 1);
      });
      const coords = [[75, 378, 106, 360], [413, 190, 440, 168], [545, 90, 570, 68]];
      coords.forEach(([x1, y1, x2, y2]) => make("path", { d: `M${x1} ${y1}L${x2} ${y2}`, stroke: "url(#river-shine)", "stroke-width": 2, opacity: 0.35, fill: "none" }, this.svg.querySelector("#river-layer")));
    }
    buildRoutes() {
      const root = this.svg.querySelector("#routes");
      ["cyan", "orange", "purple", "green"].forEach((line) => {
        const g = make("g", { id: `line-${line}`, "data-line-layer": line }, root);
        this.lineLayers.set(line, g);
      });
      routeDefs.forEach((def) => {
        const line = def.line || def.id;
        const color = COLORS[line];
        const parent = this.lineLayers.get(line);
        const group = make("g", { "data-route": def.id }, parent);
        make("path", { d: def.d, fill: "none", stroke: "#020a14", "stroke-width": 9, "stroke-linecap": "round", "stroke-linejoin": "round", opacity: 0.78 }, group);
        make("path", { d: def.d, fill: "none", stroke: color, "stroke-width": 6.5, "stroke-linecap": "round", "stroke-linejoin": "round", opacity: 0.12 }, group);
        const path = make("path", { id: `route-${def.id}`, d: def.d, fill: "none", stroke: color, "stroke-width": 3.1, "stroke-linecap": "round", "stroke-linejoin": "round" }, group);
        make("path", { d: def.d, fill: "none", stroke: "#d8ffff", "stroke-width": 0.55, "stroke-linecap": "round", "stroke-linejoin": "round", opacity: 0.24 }, group);
        path.__length = path.getTotalLength();
        this.paths.set(def.id, path);
        def.stations.forEach(([f, name, dx, dy, anchor]) => {
          const p = path.getPointAtLength(path.__length * f);
          make("circle", { cx: p.x, cy: p.y, r: 4, fill: "#071827", stroke: color, "stroke-width": 1.3 }, group);
          make("circle", { cx: p.x, cy: p.y, r: 1.45, fill: "#d8fbff" }, group);
          const text = make("text", { x: p.x + dx, y: p.y + dy, "text-anchor": anchor, fill: "#a6bdcb", "font-size": 10.5, "letter-spacing": 0.25, "paint-order": "stroke", stroke: "#071526", "stroke-width": 2.5, "stroke-linejoin": "round" }, group);
          text.textContent = name;
        });
        def.arrows.forEach((f, index) => {
          const p = path.getPointAtLength(path.__length * f);
          const angle = tangent(path, f, index % 2 ? -1 : 1);
          const arrow = make("path", { d: "M -5 -3.8 L 0 0 L -5 3.8", fill: "none", stroke: color, "stroke-width": 1.6, "stroke-linecap": "round", "stroke-linejoin": "round", transform: `translate(${p.x.toFixed(2)} ${p.y.toFixed(2)}) rotate(${angle.toFixed(2)})`, opacity: 0.9 }, group);
          arrow.dataset.direction = "true";
        });
      });
    }
    buildSpeedZone() {
      const layer = this.svg.querySelector("#speed-restriction");
      const { x0, x1 } = this.zone;
      const g = make("g", { id: "speed-zone", "data-speed-zone": "green" }, layer);
      make("rect", { x: x0, y: 385, width: x1 - x0, height: 58, fill: "#a58b1d", "fill-opacity": 0.055, stroke: "#e0bd37", "stroke-width": 0.65, "stroke-dasharray": "2 3", opacity: 0.85 }, g);
      const hatches = make("g", { "clip-path": "url(#speed-clip)", opacity: 0.24 }, g);
      for (let x = x0 - 70; x < x1 + 70; x += 11) make("line", { x1: x, y1: 450, x2: x + 57, y2: 378, stroke: "#e3c340", "stroke-width": 2 }, hatches);
      make("path", { d: `M${x0} 386V380H${x1}V386 M${x0} 437V444H${x1}V437`, fill: "none", stroke: "#e8c340", "stroke-width": 1.8 }, g);
      make("line", { x1: x0 + 5, y1: 424, x2: x1 - 5, y2: 424, stroke: "#f0c942", "stroke-width": 0.6, opacity: 0.6 }, g);
      const label = make("text", { x: (x0 + x1) / 2, y: 401, "text-anchor": "middle", fill: "#f5d655", "font-size": 11, "font-weight": 600, "letter-spacing": 0.25, "paint-order": "stroke", stroke: "#172235", "stroke-width": 2 }, g);
      label.textContent = "\u9650\u901F 20km/h";
      const sub = make("text", { x: (x0 + x1) / 2, y: 458, "text-anchor": "middle", fill: "#bda540", "font-size": 7.5, "letter-spacing": 1.4 }, g);
      sub.textContent = "GREEN LINE \xB7 SPEED CONTROL";
      this.speedZone = g;
    }
    buildHubs() {
      const root = this.svg.querySelector("#hub-layer");
      HUBS.forEach((h) => {
        const g = make("g", { id: `hub-${h.id}`, "data-hub": h.id }, root);
        const glow = make("circle", { cx: h.x, cy: h.y, r: 34, fill: `url(#glow-${h.id})`, opacity: 0.8 }, g);
        const soft = make("circle", { cx: h.x, cy: h.y, r: 16, fill: h.color, opacity: 0.1, filter: "url(#hub-soft)" }, g);
        const pulse = make("circle", { cx: h.x, cy: h.y, r: 18, fill: "none", stroke: h.color, "stroke-width": 0.65, opacity: 0.23 }, g);
        make("circle", { cx: h.x, cy: h.y, r: 11.5, fill: "#071a2a", stroke: h.color, "stroke-width": 1.6 }, g);
        make("circle", { cx: h.x, cy: h.y, r: 7.4, fill: "#0e2638", stroke: "#d6ffff", "stroke-width": 0.6, opacity: 0.95 }, g);
        make("circle", { cx: h.x, cy: h.y, r: 3.2, fill: h.color, opacity: 0.88 }, g);
        make("path", { d: `M${h.x - 16} ${h.y}h4 M${h.x + 12} ${h.y}h4 M${h.x} ${h.y - 16}v4 M${h.x} ${h.y + 12}v4`, stroke: h.color, "stroke-width": 0.7, opacity: 0.48 }, g);
        const label = make("text", { x: h.labelX, y: h.labelY, fill: "#e1f0f5", "font-size": 11.5, "font-weight": 600, "letter-spacing": 0.5, "paint-order": "stroke", stroke: "#081727", "stroke-width": 3 }, g);
        label.textContent = h.name;
        this.hubs.push({ ...h, glow, soft, pulse, label });
      });
    }
    buildTrains() {
      const layer = this.svg.querySelector("#train-layer");
      const z0 = (this.zone.x0 - 242) / (874 - 242);
      const z1 = (this.zone.x1 - 242) / (874 - 242);
      trainPlan.forEach(([line, routeId, offset, direction], index) => {
        const color = COLORS[line];
        const path = this.paths.get(routeId);
        const outer = make("g", { "data-train-line": line, "data-train-id": `${line}-${index + 1}` }, layer);
        const g = make("g", {}, outer);
        make("rect", { x: -15, y: -7, width: 30, height: 14, rx: 6, fill: color, opacity: 0.1 }, g);
        make("path", { d: "M 9 -4.6 L 15 0 L 9 4.6 Z", fill: color, stroke: "#d9ffff", "stroke-width": 0.45 }, g);
        make("rect", { x: -12, y: -4.8, width: 23, height: 9.6, rx: 3.2, fill: "#092031", stroke: color, "stroke-width": 1.2 }, g);
        make("rect", { x: -10.5, y: -3.1, width: 18.5, height: 2.8, rx: 0.8, fill: color, opacity: 0.8 }, g);
        [-7, -1.5, 4].forEach((x) => make("rect", { x, y: -2.55, width: 3.5, height: 1.7, rx: 0.4, fill: "#d9fcff", opacity: 0.88 }, g));
        make("path", { d: "M-9 2.6H7", stroke: "#c9f7ff", "stroke-width": 0.65, opacity: 0.7 }, g);
        make("circle", { cx: 9.2, cy: 1.7, r: 1, fill: "#fffbd5" }, g);
        const limited = routeId === "green-horizontal" ? limitedProfile(offset, direction, z0, z1) : null;
        this.trains.push({ line, routeId, offset, direction, path, outer, g, limited, index, q: offset, speed: baseSpeeds[line] });
      });
    }
    resize() {
      const rect = this.svg.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const aspect = rect.width / rect.height, baseW = 960, baseH = 560;
      let w = baseW, h = baseH;
      if (aspect > baseW / baseH) w = baseH * aspect;
      else h = baseW / aspect;
      const x = (baseW - w) / 2, y = (baseH - h) / 2;
      this.svg.setAttribute("viewBox", `${x.toFixed(3)} ${y.toFixed(3)} ${w.toFixed(3)} ${h.toFixed(3)}`);
    }
    render(t, settings2) {
      const phase = mod(t / 8), angle = phase * TAU;
      this.svg.querySelector("#river-current").setAttribute("stroke-dashoffset", fmt(-21 * phase));
      const focus = settings2.focusedLine;
      for (const [line, layer] of this.lineLayers) layer.setAttribute("opacity", focus && focus !== line ? 0.13 : 1);
      this.speedZone.setAttribute("display", settings2.speedLimit ? "inline" : "none");
      this.speedZone.setAttribute("opacity", focus && focus !== "green" ? 0.13 : 1);
      const hubState = this.hubs.map((h) => {
        const wave = 0.5 + 0.5 * Math.sin(angle * 2 + h.phase);
        const radius = (29 + 7 * wave) * (0.55 + 0.45 * settings2.flowMultiplier);
        const opacity = clamp(0.3 + settings2.flowMultiplier * 0.25 + wave * 0.18, 0.18, 0.98);
        h.glow.setAttribute("r", fmt(radius));
        h.glow.setAttribute("opacity", fmt(opacity));
        h.soft.setAttribute("r", fmt(11 + radius * 0.18));
        h.soft.setAttribute("opacity", fmt(0.055 + 0.065 * settings2.flowMultiplier + wave * 0.03));
        h.pulse.setAttribute("r", fmt(16 + wave * 4 * settings2.flowMultiplier));
        h.pulse.setAttribute("opacity", fmt(0.12 + 0.12 * wave));
        return { id: h.id, radius: fmt(radius), intensity: fmt(opacity) };
      });
      const trainState = this.trains.map((train) => {
        const q = train.limited && settings2.speedLimit ? sampleProfile(train.limited, phase) : mod(train.offset + train.direction * easedPhase(phase));
        const p = train.path.getPointAtLength(q * train.path.__length);
        const a = tangent(train.path, q, train.direction);
        train.g.setAttribute("transform", `translate(${fmt(p.x)} ${fmt(p.y)}) rotate(${fmt(a)})`);
        const edge = clamp(Math.min(q, 1 - q) / 0.025);
        const fade = smoothstep(edge);
        const focusOpacity = focus && focus !== train.line ? 0.13 : 1;
        train.outer.setAttribute("opacity", fmt(fade * focusOpacity));
        let speed = baseSpeeds[train.line] * globalPace(phase);
        if (train.limited && settings2.speedLimit) speed = baseSpeeds[train.line] * zoneFactor(q, train.limited.z0, train.limited.z1);
        train.q = q;
        train.speed = speed;
        return { id: `${train.line}-${train.index + 1}`, line: train.line, route: train.routeId, direction: train.direction > 0 ? "forward" : "reverse", progress: fmt(q), x: fmt(p.x), y: fmt(p.y), angle: fmt(a), speedKmh: fmt(speed), limited: Boolean(train.limited && settings2.speedLimit && q >= train.limited.z0 && q <= train.limited.z1) };
      });
      return { trains: trainState, hubs: hubState, bridges: 3 };
    }
  };

  // output/src/analytics.js
  var NS2 = "http://www.w3.org/2000/svg";
  var node = (tag, attrs, parent) => {
    const n = document.createElementNS(NS2, tag);
    for (const [k, v] of Object.entries(attrs || {})) n.setAttribute(k, v);
    if (parent) parent.appendChild(n);
    return n;
  };
  var chartSpecs = [
    { id: "cyan", phase: 0.2, base: 19, peak: 0.6, lift: 52 },
    { id: "orange", phase: 1.9, base: 23, peak: 0.53, lift: 47 },
    { id: "purple", phase: 3.8, base: 16, peak: 0.66, lift: 56 }
  ];
  var stationBase = [
    { name: "\u4EBA\u6C11\u5E7F\u573A", value: 86, phase: 0.1 },
    { name: "\u4E16\u7EAA\u5927\u9053", value: 74, phase: 1.4 },
    { name: "\u5F90\u5BB6\u6C47", value: 65, phase: 2.8 },
    { name: "\u9759\u5B89\u5BFA", value: 57, phase: 4.1 },
    { name: "\u9655\u897F\u5357\u8DEF", value: 47, phase: 5.2 }
  ];
  var AnalyticsScene = class {
    constructor() {
      this.settings = { flowMultiplier: 1, focusedLine: null };
      this.lastT = 0;
      this.charts = chartSpecs.map((spec) => ({ ...spec, svg: document.getElementById(`chart-${spec.id}`), h: 82 }));
      this.buildPressure();
      this.charts.forEach((chart) => this.buildChart(chart));
    }
    buildChart(chart) {
      const svg = chart.svg;
      const width = 280, h = chart.h;
      const left = 23, right = 276, top = 4, bottom = h - 14;
      chart.layout = { left, right, top, bottom, width, h };
      svg.setAttribute("viewBox", `0 0 ${width} ${h.toFixed(2)}`);
      svg.innerHTML = "";
      const defs = node("defs", {}, svg);
      const gradient = node("linearGradient", { id: `area-${chart.id}`, x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
      node("stop", { offset: 0, "stop-color": COLORS[chart.id], "stop-opacity": 0.38 }, gradient);
      node("stop", { offset: 1, "stop-color": COLORS[chart.id], "stop-opacity": 0.025 }, gradient);
      const bands = [
        [150, 200, "#ff5b62", 0.105],
        [100, 150, "#f39843", 0.102],
        [50, 100, "#e8d34e", 0.075],
        [0, 50, "#43d59b", 0.068]
      ];
      const y = (value) => bottom - value / 200 * (bottom - top);
      bands.forEach(([lo, hi, color, opacity]) => node("rect", { x: left, y: y(hi), width: right - left, height: y(lo) - y(hi), fill: color, opacity }, svg));
      [200, 150, 100, 50, 0].forEach((value) => {
        node("line", { x1: left, y1: y(value), x2: right, y2: y(value), stroke: "#7090a3", "stroke-width": 0.45, opacity: value === 0 ? 0.4 : 0.21 }, svg);
        const label = node("text", { x: 18, y: y(value) + 2.5, "text-anchor": "end", fill: "#7894a6", "font-size": 7.2, "font-family": "Consolas, monospace" }, svg);
        label.textContent = value;
      });
      for (let i = 0; i < 6; i++) {
        const x = left + (right - left) * i / 5;
        node("line", { x1: x, y1: top, x2: x, y2: bottom, stroke: "#52758a", "stroke-width": 0.35, opacity: 0.12 }, svg);
        const label = node("text", { x, y: h - 3, "text-anchor": i === 0 ? "start" : i === 5 ? "end" : "middle", fill: "#7894a6", "font-size": 7.1, "font-family": "Consolas, monospace" }, svg);
        label.textContent = `${i + 1}:00`;
      }
      const curveLayer = node("g", { "data-curve-line": chart.id }, svg);
      chart.fill = node("path", { fill: `url(#area-${chart.id})`, stroke: "none" }, curveLayer);
      chart.path = node("path", { fill: "none", stroke: COLORS[chart.id], "stroke-width": 1.65, "stroke-linecap": "round", "stroke-linejoin": "round" }, curveLayer);
      chart.pathGlow = node("path", { fill: "none", stroke: COLORS[chart.id], "stroke-width": 4.5, opacity: 0.1, "stroke-linecap": "round", "stroke-linejoin": "round" }, curveLayer);
      chart.dot = node("circle", { r: 2.3, fill: "#dfffff", stroke: COLORS[chart.id], "stroke-width": 1.3 }, curveLayer);
      chart.layer = curveLayer;
      if (this.lastValues) this.render(this.lastT, this.settings);
    }
    resize() {
      let changed = false;
      this.charts.forEach((chart) => {
        const rect = chart.svg.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        const h = clamp(280 * rect.height / rect.width, 62, 150);
        if (Math.abs(h - chart.h) > 0.4) {
          chart.h = h;
          this.buildChart(chart);
          changed = true;
        }
      });
      if (changed) this.render(this.lastT, this.settings);
    }
    buildPressure() {
      const svg = document.getElementById("pressure-chart");
      svg.innerHTML = "";
      this.pressureRows = [];
      const barX = 59, barW = 169;
      for (let i = 0; i < 5; i++) {
        const y = 4 + i * 21;
        const group = node("g", {}, svg);
        const name = node("text", { x: 0, y: y + 11, fill: "#a9c0cf", "font-size": 9 }, group);
        node("rect", { x: barX, y: y + 3, width: barW, height: 9, rx: 1.5, fill: "#132b3f" }, group);
        const bar = node("rect", { x: barX, y: y + 3, width: 50, height: 9, rx: 1.5, fill: "#39d2d5", opacity: 0.88 }, group);
        const cap = node("rect", { x: barX + 45, y: y + 3, width: 2, height: 9, fill: "#b9ffff", opacity: 0.65 }, group);
        const value = node("text", { x: 237, y: y + 11, fill: "#8fb3c6", "font-size": 8.5, "font-family": "Consolas, monospace" }, group);
        this.pressureRows.push({ group, name, bar, cap, value });
      }
      [0, 20, 40, 60, 80, 100].forEach((tick, i) => {
        const x = barX + barW * i / 5;
        node("line", { x1: x, y1: 110, x2: x, y2: 115, stroke: "#527389", "stroke-width": 0.6 }, svg);
        const label = node("text", { x, y: 126, "text-anchor": i === 0 ? "start" : i === 5 ? "end" : "middle", fill: "#658398", "font-size": 7.2, "font-family": "Consolas, monospace" }, svg);
        label.textContent = tick;
      });
      node("line", { x1: barX, y1: 111, x2: barX + barW, y2: 111, stroke: "#395b72", "stroke-width": 0.55 }, svg);
      const caption = node("text", { x: 276, y: 126, "text-anchor": "end", fill: "#43677e", "font-size": 6.6, "letter-spacing": 0.4 }, svg);
      caption.textContent = "PRESSURE";
    }
    render(t, settings2) {
      this.lastT = t;
      this.lastValues = true;
      this.settings = { ...settings2 };
      const angle = t / 8 * TAU;
      const loads = {};
      this.charts.forEach((chart) => {
        const { left, right, top, bottom } = chart.layout;
        const points = [];
        const values = [];
        const samples = 88;
        for (let i = 0; i < samples; i++) {
          const u = i / (samples - 1);
          const rush = Math.exp(-Math.pow((u - chart.peak) / 0.205, 2));
          const shoulder = 12 * Math.exp(-Math.pow((u - 0.24) / 0.14, 2));
          const temporal = (4.2 + 3 * u) * Math.sin(TAU * u * 1.35 + angle + chart.phase) + 2.3 * Math.sin(TAU * u * 3.1 - angle * 2 + chart.phase);
          const shape = chart.base + chart.lift * rush + shoulder + 18 * u + 7 * Math.sin(Math.PI * u + chart.phase) + temporal;
          const value = clamp(shape * settings2.flowMultiplier, 0, 200);
          const x = left + (right - left) * u;
          const y = bottom - value / 200 * (bottom - top);
          points.push([x, y]);
          values.push(value);
        }
        const linePath = points.map((p, i) => `${i ? "L" : "M"}${fmt(p[0])} ${fmt(p[1])}`).join(" ");
        const areaPath = `${linePath} L${fmt(right)} ${fmt(bottom)} L${fmt(left)} ${fmt(bottom)} Z`;
        chart.path.setAttribute("d", linePath);
        chart.pathGlow.setAttribute("d", linePath);
        chart.fill.setAttribute("d", areaPath);
        const last = points[points.length - 1];
        chart.dot.setAttribute("cx", fmt(last[0]));
        chart.dot.setAttribute("cy", fmt(last[1]));
        chart.layer.setAttribute("opacity", settings2.focusedLine && settings2.focusedLine !== chart.id ? 0.13 : 1);
        const current = values[values.length - 1];
        loads[chart.id] = { name: LINE_NAMES[chart.id], current: fmt(current), samples: values.map(fmt) };
        const output = document.getElementById(`load-${chart.id}`);
        output.textContent = `${Math.round(current)}%`;
        output.setAttribute("opacity", settings2.focusedLine && settings2.focusedLine !== chart.id ? 0.3 : 1);
      });
      const pressure = stationBase.map((s) => ({
        name: s.name,
        value: clamp(s.value * (0.93 + 0.07 * Math.sin(angle * 2 + s.phase)) * settings2.flowMultiplier, 0, 100)
      })).sort((a, b) => b.value - a.value);
      const colors = ["#35d7d5", "#43c9df", "#56bce6", "#72abe9", "#8b9fe6"];
      pressure.forEach((item, i) => {
        const row = this.pressureRows[i], width = 169 * item.value / 100;
        row.name.textContent = item.name;
        row.bar.setAttribute("width", fmt(width));
        row.bar.setAttribute("fill", colors[i]);
        row.cap.setAttribute("x", fmt(59 + Math.max(0, width - 1.5)));
        row.value.textContent = String(Math.round(item.value)).padStart(2, "0");
        item.value = fmt(item.value);
      });
      return { loads, pressure };
    }
  };

  // output/src/controls.js
  function bindControls({ clock: clock2, settings: settings2, renderCurrent: renderCurrent2, playingChanged: playingChanged2 }) {
    const flow = document.getElementById("flow-multiplier");
    const scrub = document.getElementById("scrub");
    flow.addEventListener("input", () => {
      settings2.flowMultiplier = Math.round(Number(flow.value) * 10) / 10;
      renderCurrent2();
    });
    scrub.addEventListener("input", () => clock2.seek(Number(scrub.value)));
    scrub.addEventListener("change", () => clock2.seek(Number(scrub.value)));
    document.getElementById("play").addEventListener("click", () => clock2.play());
    document.getElementById("pause").addEventListener("click", () => clock2.pause());
    document.querySelectorAll(".line-focus[data-line]").forEach((button) => {
      button.addEventListener("click", () => {
        const line = button.dataset.line;
        settings2.focusedLine = settings2.focusedLine === line ? null : line;
        renderCurrent2();
      });
    });
    document.getElementById("speed-limit-toggle").addEventListener("click", () => {
      settings2.speedLimit = !settings2.speedLimit;
      renderCurrent2();
    });
    return { playingChanged: playingChanged2 };
  }
  function syncControls(t, settings2, playing, timecode) {
    const flow = document.getElementById("flow-multiplier");
    flow.value = settings2.flowMultiplier.toFixed(1);
    flow.style.setProperty("--range-progress", `${(settings2.flowMultiplier - 0.6) / 1.4 * 100}%`);
    document.getElementById("flow-output").innerHTML = `${settings2.flowMultiplier.toFixed(1)}<span>\xD7</span>`;
    document.querySelectorAll(".line-focus[data-line]").forEach((button) => {
      const active = settings2.focusedLine === button.dataset.line;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
      button.title = active ? "\u518D\u6B21\u70B9\u51FB\u6062\u590D\u5168\u7F51" : `\u805A\u7126${button.textContent.trim().replace(/聚焦|\d+/g, "")}`;
    });
    const speedButton = document.getElementById("speed-limit-toggle");
    speedButton.classList.toggle("active", settings2.speedLimit);
    speedButton.setAttribute("aria-pressed", String(settings2.speedLimit));
    document.getElementById("speed-button-text").textContent = settings2.speedLimit ? "\u89E3\u9664\u9650\u901F" : "\u5E94\u7528\u9650\u901F";
    const speedStatus = document.getElementById("speed-status");
    speedStatus.classList.toggle("active", settings2.speedLimit);
    speedStatus.querySelector("span").textContent = settings2.speedLimit ? "\u7EFF\u7EBF \xB7 \u9650\u901F\u4E2D" : "\u7EFF\u7EBF \xB7 \u5E38\u901F\u8FD0\u884C";
    const scrub = document.getElementById("scrub");
    scrub.value = String(t);
    scrub.style.setProperty("--range-progress", `${t / 8 * 100}%`);
    document.getElementById("time-output").textContent = timecode;
    const playState = document.getElementById("play-state");
    playState.classList.toggle("playing", playing);
    playState.innerHTML = `<i></i>${playing ? "\u8FD0\u884C\u4E2D" : "\u5DF2\u6682\u505C"}`;
    document.getElementById("play").setAttribute("aria-pressed", String(playing));
    document.getElementById("pause").setAttribute("aria-pressed", String(!playing));
  }

  // output/src/main.js
  var settings = { flowMultiplier: 1, focusedLine: null, speedLimit: true };
  var network = new NetworkScene(document.getElementById("stage"));
  var analytics = new AnalyticsScene();
  var latest = { trains: [], hubs: [], loads: {}, pressure: [] };
  var clock;
  function renderFrame(t) {
    const stage = network.render(t, settings);
    const analysis = analytics.render(t, settings);
    latest = { ...stage, ...analysis };
    const clockText = clockAt(t);
    const simClock = document.getElementById("sim-clock");
    simClock.textContent = clockText;
    simClock.setAttribute("datetime", clockText);
    const passengers = 1.2 * settings.flowMultiplier;
    document.getElementById("passenger-value").textContent = passengers.toFixed(1);
    document.getElementById("passenger-trend").textContent = settings.flowMultiplier < 1 ? "\u5E73\u5CF0" : settings.flowMultiplier > 1 ? "\u9AD8\u5CF0" : "\u57FA\u51C6";
    syncControls(t, settings, clock ? clock.playing : false, timecodeAt(t));
  }
  function renderCurrent() {
    renderFrame(clock ? clock.t : 0);
  }
  function playingChanged() {
    syncControls(clock.t, settings, clock.playing, timecodeAt(clock.t));
  }
  clock = new PlaybackClock(renderFrame, playingChanged);
  bindControls({ clock, settings, renderCurrent, playingChanged });
  window.renderAt = (seconds) => {
    clock.render(periodicTime(seconds));
    return window.__getSceneState();
  };
  window.__getSceneState = () => ({
    t: fmt(clock.t),
    period: PERIOD,
    mode: "periodic",
    playing: clock.playing,
    clock: clockAt(clock.t),
    timecode: timecodeAt(clock.t),
    flowMultiplier: settings.flowMultiplier,
    focusedLine: settings.focusedLine,
    speedLimit: settings.speedLimit,
    speedLimitKmh: settings.speedLimit ? 20 : null,
    passengersWan: fmt(1.2 * settings.flowMultiplier),
    kpi: { punctuality: 98, trainsPerHour: 35, passengersWan: fmt(1.2 * settings.flowMultiplier), energyKwh: 1450 },
    trains: latest.trains,
    hubs: latest.hubs,
    bridgeCount: latest.bridges,
    loads: latest.loads,
    pressure: latest.pressure
  });
  var resize = () => {
    network.resize();
    analytics.resize();
  };
  if ("ResizeObserver" in window) {
    const observer = new ResizeObserver(resize);
    observer.observe(document.getElementById("stage-wrap"));
    observer.observe(document.getElementById("charts"));
  }
  window.addEventListener("resize", resize, { passive: true });
  renderFrame(0);
  requestAnimationFrame(() => {
    resize();
    renderFrame(clock.t);
    window.__SCENE_READY__ = true;
    document.documentElement.dataset.sceneReady = "true";
  });
})();
