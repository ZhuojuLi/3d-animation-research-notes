(() => {
  // output/src/optics.js
  var DURATION = 8;
  var F_STOPS = [1.7, 2, 2.5, 3.2, 4, 5.6, 8, 11, 16];
  var FOCUS_STOPS = [0.7, 1, 1.5, 3, 5, 10, Infinity];
  var clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  var lerp = (a, b, amount) => a + (b - a) * amount;
  var smooth = (value) => {
    const x = clamp(value, 0, 1);
    return x * x * (3 - 2 * x);
  };
  var phase = (time2, start, end) => smooth((time2 - start) / (end - start));
  function apertureRadius(fNumber) {
    const f = clamp(Number(fNumber) || 2.5, 1.7, 16);
    const normalized = (Math.log(16) - Math.log(f)) / (Math.log(16) - Math.log(1.7));
    return lerp(8, 51, normalized);
  }
  function nearestStop(value, stops) {
    return stops.reduce((best, item, index) => {
      const bestDistance = Math.abs(stops[best] - value);
      return Math.abs(item - value) < bestDistance ? index : best;
    }, 0);
  }
  function stepAperture(value, direction) {
    const index = nearestStop(value, F_STOPS);
    return F_STOPS[clamp(index + Math.sign(direction), 0, F_STOPS.length - 1)];
  }
  function normalizedToDistance(value) {
    const n = clamp(Number(value) || 0, 0, 1);
    if (n >= 0.9995) return Infinity;
    return 0.7 * Math.exp(n * Math.log(50 / 0.7));
  }
  function distanceToNormalized(distance) {
    if (!Number.isFinite(distance)) return 1;
    return clamp(Math.log(clamp(distance, 0.7, 50) / 0.7) / Math.log(50 / 0.7), 0, 1);
  }
  function stepFocus(distance, direction) {
    const finiteDistance = Number.isFinite(distance) ? distance : 1e6;
    let index = FOCUS_STOPS.findIndex((item) => Math.abs(item - finiteDistance) < 0.03);
    if (index < 0) {
      index = direction > 0 ? FOCUS_STOPS.findIndex((item) => item > finiteDistance) : FOCUS_STOPS.findLastIndex((item) => item < finiteDistance);
      if (index < 0) index = direction > 0 ? FOCUS_STOPS.length - 1 : 0;
      return FOCUS_STOPS[index];
    }
    return FOCUS_STOPS[clamp(index + Math.sign(direction), 0, FOCUS_STOPS.length - 1)];
  }
  function formatDistance(distance) {
    if (!Number.isFinite(distance)) return "\u221E";
    if (distance < 10) return distance.toFixed(distance < 1 ? 1 : 2).replace(/0$/, "");
    return Math.round(distance).toString();
  }
  function focusTravel(distance) {
    return lerp(-17, 12, distanceToNormalized(distance));
  }
  function timelinePhase(time2) {
    if (time2 < 2) return "lens";
    if (time2 < 4) return "aperture";
    if (time2 < 6) return "focus";
    return "exposure";
  }
  var FINISHES = {
    silver: {
      label: "Silver / black",
      metalLight: "#e4e0d4",
      metalMid: "#a9a99f",
      metalDark: "#686d69",
      leather: "#252a28",
      edge: "#353a37",
      accent: "#862f35"
    },
    black: {
      label: "All black",
      metalLight: "#555b57",
      metalMid: "#292e2c",
      metalDark: "#111514",
      leather: "#151a18",
      edge: "#0a0d0c",
      accent: "#a04448"
    },
    champagne: {
      label: "Champagne titanium",
      metalLight: "#e0d2b5",
      metalMid: "#b5a485",
      metalDark: "#706855",
      leather: "#30332e",
      edge: "#4d4a3e",
      accent: "#8a3c3b"
    }
  };

  // output/src/camera-stage.js
  var NS = "http://www.w3.org/2000/svg";
  var AXIS_Y = 323;
  var $ = (root, id) => root.querySelector(`#${id}`);
  var fixed = (value) => Number(value.toFixed(3));
  function svgNode(tag, attributes = {}, parent) {
    const node = document.createElementNS(NS, tag);
    for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
    if (parent) parent.appendChild(node);
    return node;
  }
  function line(parent, x1, y1, x2, y2, attributes = {}) {
    return svgNode("line", { x1, y1, x2, y2, ...attributes }, parent);
  }
  function polar(radius, angle) {
    return [radius * Math.cos(angle), radius * Math.sin(angle)];
  }
  function pointString(point) {
    return `${fixed(point[0])} ${fixed(point[1])}`;
  }
  var CameraStage = class {
    constructor(root) {
      this.root = root;
      this.lenses = [];
      this.blades = [];
      this.gears = [];
      this.windowPairs = [];
      this.buildDefinitions();
      this.buildBench();
      this.buildBody();
      this.buildMechanics();
      this.buildLensBarrel();
      this.buildAperture();
      this.buildGlass();
      this.buildRangefinders();
      this.buildExteriorDetails();
    }
    buildDefinitions() {
      this.defs = svgNode("defs", {}, this.root);
      this.defs.innerHTML = `
      <linearGradient id="body-metal" x1="0" y1="0" x2="0.88" y2="1">
        <stop id="metal-stop-0" offset="0" stop-color="#e4e0d4"/>
        <stop id="metal-stop-1" offset="0.32" stop-color="#c5c3b9"/>
        <stop id="metal-stop-2" offset="0.63" stop-color="#a9a99f"/>
        <stop id="metal-stop-3" offset="1" stop-color="#686d69"/>
      </linearGradient>
      <linearGradient id="barrel-metal" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#b9bab2"/><stop offset=".15" stop-color="#e3e0d5"/>
        <stop offset=".32" stop-color="#7d817b"/><stop offset=".66" stop-color="#333936"/>
        <stop offset=".88" stop-color="#9fa19a"/><stop offset="1" stop-color="#313633"/>
      </linearGradient>
      <linearGradient id="blade-metal" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#d7d6cb"/><stop offset=".34" stop-color="#767d77"/>
        <stop offset=".63" stop-color="#b4b5aa"/><stop offset="1" stop-color="#424945"/>
      </linearGradient>
      <radialGradient id="iris-well">
        <stop offset="0" stop-color="#131c1b"/><stop offset=".63" stop-color="#252e2b"/>
        <stop offset=".89" stop-color="#0d1211"/><stop offset="1" stop-color="#5b625b"/>
      </radialGradient>
      <linearGradient id="glass-a" x1="0" y1="0" x2="1" y2=".15">
        <stop offset="0" stop-color="#a7d2dc" stop-opacity=".30"/>
        <stop offset=".28" stop-color="#eefbfa" stop-opacity=".88"/>
        <stop offset=".58" stop-color="#afc9d0" stop-opacity=".38"/>
        <stop offset=".88" stop-color="#698b9b" stop-opacity=".65"/>
        <stop offset="1" stop-color="#d9f0ed" stop-opacity=".7"/>
      </linearGradient>
      <linearGradient id="glass-b" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#6e8d9b" stop-opacity=".62"/><stop offset=".35" stop-color="#f0fbf6" stop-opacity=".78"/>
        <stop offset=".7" stop-color="#b9d3d5" stop-opacity=".38"/><stop offset="1" stop-color="#7996a5" stop-opacity=".62"/>
      </linearGradient>
      <linearGradient id="glass-c" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#f5fbeb" stop-opacity=".76"/><stop offset=".37" stop-color="#a5c6d0" stop-opacity=".42"/>
        <stop offset=".73" stop-color="#8799b2" stop-opacity=".64"/><stop offset="1" stop-color="#d7e5e3" stop-opacity=".75"/>
      </linearGradient>
      <linearGradient id="sensor-spectrum" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#aac3ad"/><stop offset=".22" stop-color="#d4b26b"/>
        <stop offset=".43" stop-color="#ac7881"/><stop offset=".66" stop-color="#667f9b"/>
        <stop offset=".84" stop-color="#88a99b"/><stop offset="1" stop-color="#d6b775"/>
      </linearGradient>
      <linearGradient id="amber-cone" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#edc85a" stop-opacity=".08"/><stop offset=".6" stop-color="#e5af31" stop-opacity=".38"/>
        <stop offset="1" stop-color="#f4c754" stop-opacity=".68"/>
      </linearGradient>
      <radialGradient id="window-amber">
        <stop offset="0" stop-color="#efc150" stop-opacity=".75"/><stop offset="1" stop-color="#9c6820" stop-opacity=".34"/>
      </radialGradient>
      <pattern id="leather-pattern" width="7" height="7" patternUnits="userSpaceOnUse">
        <rect width="7" height="7" fill="#252a28"/>
        <path d="M1 1h1m2 3h1M0 6h2" stroke="#7d8179" stroke-opacity=".20" stroke-width=".8"/>
      </pattern>
      <pattern id="fine-ribs" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="skewY(8)">
        <rect width="5" height="5" fill="#4d534e"/><path d="M1 0v5" stroke="#b4b6ac" stroke-width="1"/>
      </pattern>
      <radialGradient id="ground-shadow">
        <stop offset="0" stop-color="#454b44" stop-opacity=".25"/>
        <stop offset=".55" stop-color="#4c5048" stop-opacity=".12"/>
        <stop offset="1" stop-color="#4c5048" stop-opacity="0"/>
      </radialGradient>
    `;
    }
    buildBench() {
      const bench = svgNode("g", { id: "optical-bench" }, this.root);
      svgNode("ellipse", { cx: 432, cy: 440, rx: 300, ry: 34, fill: "url(#ground-shadow)", opacity: ".72" }, bench);
      this.lensShadow = svgNode("ellipse", { cx: 239, cy: 425, rx: 188, ry: 24, fill: "url(#ground-shadow)", opacity: "0" }, bench);
      this.opticalBack = svgNode("g", { id: "optical-paths-back", fill: "none" }, this.root);
      line(this.opticalBack, 55, AXIS_Y, 708, AXIS_Y, {
        id: "optical-axis",
        stroke: "#a9833a",
        "stroke-width": ".8",
        "stroke-dasharray": "8 7",
        opacity: ".55"
      });
      line(this.opticalBack, 55, AXIS_Y + 6, 708, AXIS_Y + 6, {
        stroke: "#b49555",
        "stroke-width": ".45",
        opacity: ".23"
      });
      this.rfCones = svgNode("g", { id: "rangefinder-light-paths", fill: "#d8ad3f", stroke: "#b18a38", "stroke-width": ".6" }, this.opticalBack);
      svgNode("path", { d: "M666 286 L620 52 L620 111 Z", opacity: ".26" }, this.rfCones);
      svgNode("path", { d: "M675 289 L718 54 L784 65 L784 107 Z", opacity: ".20" }, this.rfCones);
      svgNode("path", { d: "M669 352 L626 484 L626 544 L690 492 Z", opacity: ".25" }, this.rfCones);
      svgNode("path", { d: "M677 350 L724 474 L790 486 L790 533 Z", opacity: ".20" }, this.rfCones);
      const leaders = svgNode("g", { stroke: "#7f765c", "stroke-width": ".7", fill: "none", opacity: ".67" }, this.opticalBack);
      svgNode("path", { d: "M658 91 V142 L694 177 M755 100 V146 L722 174 M663 488 V457 L630 423 M760 474 V448 L709 414" }, leaders);
      svgNode("path", { d: "M92 401 L55 451 H167 M247 248 L192 210 H74 M545 405 V460 H695" }, leaders);
      this.mainCone = svgNode("path", {
        id: "exposure-light-cone",
        d: "",
        fill: "url(#amber-cone)",
        stroke: "#c39736",
        "stroke-width": ".55",
        opacity: ".25"
      }, this.opticalBack);
      this.apertureRayTop = svgNode("path", { fill: "none", stroke: "#e7b644", "stroke-width": ".8", opacity: ".5" }, this.opticalBack);
      this.apertureRayBottom = svgNode("path", { fill: "none", stroke: "#e7b644", "stroke-width": ".8", opacity: ".5" }, this.opticalBack);
    }
    buildBody() {
      this.body = svgNode("g", { id: "camera-body", "stroke-linejoin": "round" }, this.root);
      svgNode("path", {
        d: "M431 164 Q432 143 469 129 L505 125 L633 153 L701 177 Q735 187 746 218 L754 383 Q756 420 726 436 Q711 445 676 438 L565 418 L483 382 L438 346 Z",
        fill: "url(#body-metal)",
        stroke: "#343a36",
        "stroke-width": "2"
      }, this.body);
      svgNode("path", { d: "M436 176 L614 203 L615 397 L564 417 L481 380 L439 344 Z", fill: "url(#leather-pattern)", stroke: "#333936", "stroke-width": "1.5" }, this.body);
      svgNode("path", { d: "M433 164 L475 138 L623 164 L704 190 L744 219 L615 202 Z", fill: "url(#body-metal)", stroke: "#464b46", "stroke-width": "1.1" }, this.body);
      svgNode("path", { d: "M614 203 L744 220 L750 383 Q751 417 724 431 L679 434 L615 397 Z", fill: "#858a81", stroke: "#3d443f", "stroke-width": "1.1", opacity: ".55" }, this.body);
      svgNode("path", { d: "M449 350 L564 382 L564 410 L482 375 Z", fill: "#151b19", stroke: "#60665e", "stroke-width": "1" }, this.body);
      svgNode("path", { d: "M573 408 L679 426 Q721 433 738 410", fill: "none", stroke: "#d5d4c8", "stroke-width": "2", opacity: ".7" }, this.body);
      svgNode("path", { d: "M444 184 L444 338 M610 211 L610 391", fill: "none", stroke: "#0d1210", "stroke-width": "3" }, this.body);
      svgNode("path", { d: "M437 161 Q470 176 518 183 M634 171 L700 192", fill: "none", stroke: "#f5f1e4", "stroke-width": "2", opacity: ".64" }, this.body);
      const seams = svgNode("g", { fill: "none", stroke: "#8f9389", "stroke-width": ".65", opacity: ".54" }, this.body);
      svgNode("path", { d: "M451 197 L590 219 M451 206 L590 228 M455 352 L555 380" }, seams);
      for (let y = 225; y < 343; y += 13) line(seams, 600, y, 612, y + 1);
      svgNode("ellipse", { cx: 467, cy: 207, rx: 13, ry: 17, fill: "url(#body-metal)", stroke: "#313733", "stroke-width": "1.6" }, this.body);
      svgNode("ellipse", { cx: 467, cy: 207, rx: 8, ry: 11, fill: "#4d534e", stroke: "#d9d7ca", "stroke-width": "1" }, this.body);
      svgNode("ellipse", { cx: 441, cy: 240, rx: 6, ry: 12, fill: "#62685f", stroke: "#232925", "stroke-width": "1.5" }, this.body);
      svgNode("circle", { cx: 441, cy: 240, r: 3, fill: "#222825" }, this.body);
      this.sectionCover = svgNode("path", {
        id: "section-cover",
        d: "M617 207 L738 222 L743 381 Q744 410 720 423 L678 426 L619 396 Z",
        fill: "url(#body-metal)",
        stroke: "#3a413c",
        "stroke-width": "1.3",
        opacity: ".94"
      }, this.body);
      this.sectionHatch = svgNode("g", { id: "section-hatch", stroke: "#4c524c", "stroke-width": ".65", opacity: ".3" }, this.body);
      for (let y = 228; y < 402; y += 11) line(this.sectionHatch, 710, y, 737, y + 1);
    }
    buildMechanics() {
      this.mechanics = svgNode("g", { id: "focal-plane-mechanics", opacity: ".08" }, this.root);
      svgNode("path", { d: "M533 231 L682 249 L686 399 L535 378 Z", fill: "#1d2421", stroke: "#777d73", "stroke-width": "2" }, this.mechanics);
      svgNode("path", { d: "M545 247 L655 260 L655 385 L545 371 Z", fill: "#080e0c", stroke: "#777e75", "stroke-width": "1" }, this.mechanics);
      const rails = svgNode("g", { id: "curtain-guides", stroke: "#afb2a5", fill: "none" }, this.mechanics);
      svgNode("path", { d: "M548 249 V374 M563 251 V376 M581 254 V379 M598 256 V381", "stroke-width": "2" }, rails);
      svgNode("path", { d: "M542 250 H604 M542 374 L604 382", "stroke-width": "1" }, rails);
      for (let y = 260; y < 373; y += 13) {
        line(rails, 544, y, 550, y + 1, { "stroke-width": ".65" });
        line(rails, 595, y + 3, 602, y + 4, { "stroke-width": ".65" });
      }
      this.frontCurtain = svgNode("g", { id: "front-curtain" }, this.mechanics);
      this.rearCurtain = svgNode("g", { id: "rear-curtain" }, this.mechanics);
      const curtain = (parent, x, y, tone) => {
        svgNode("path", { d: `M${x} ${y} l17 2 v119 l-17 -2 Z`, fill: tone, stroke: "#0f1512", "stroke-width": ".9" }, parent);
        for (let k = 7; k < 116; k += 9) {
          line(parent, x + 1, y + k, x + 16, y + k + 2, { stroke: "#91968a", "stroke-width": ".6", opacity: ".7" });
        }
        svgNode("path", { d: `M${x + 4} ${y + 3} v112`, stroke: "#c0c1b5", "stroke-width": ".5", opacity: ".45" }, parent);
      };
      curtain(this.frontCurtain, 548, 251, "#3c433e");
      curtain(this.rearCurtain, 583, 254, "#4b514b");
      this.sensor = svgNode("g", { id: "sensor-assembly" }, this.mechanics);
      svgNode("path", { d: "M661 252 L682 255 L682 391 L661 388 Z", fill: "#28302c", stroke: "#a9aea2", "stroke-width": "1.5" }, this.sensor);
      svgNode("path", { d: "M654 266 L669 268 L669 378 L654 376 Z", fill: "#303d3b", stroke: "#bbb9a5", "stroke-width": "1" }, this.sensor);
      svgNode("path", { d: "M657 272 L666 273 L666 373 L657 372 Z", fill: "url(#sensor-spectrum)", opacity: ".20" }, this.sensor);
      this.sensorLight = svgNode("path", {
        id: "sensor-exposure",
        d: "M657 272 L666 273 L666 373 L657 372 Z",
        fill: "url(#sensor-spectrum)",
        opacity: "0"
      }, this.sensor);
      this.sensorScan = svgNode("path", { d: "M656 272 L667 273", stroke: "#fcebad", "stroke-width": "2", opacity: "0" }, this.sensor);
      for (let y = 280; y < 373; y += 7) line(this.sensor, 658, y, 665, y + 0.5, { stroke: "#eee1b4", "stroke-width": ".35", opacity: ".32" });
      svgNode("path", { d: "M691 260 H699 V385 H691", fill: "none", stroke: "#b7ad8e", "stroke-width": ".75" }, this.sensor);
      line(this.sensor, 694, 322, 702, 322, { stroke: "#b7ad8e", "stroke-width": ".75" });
      this.gearTrain = svgNode("g", { id: "gear-train" }, this.mechanics);
      svgNode("path", { d: "M602 343 L641 347 L641 394 L603 388 Z", fill: "#747a71", stroke: "#242b27", "stroke-width": "1.3" }, this.gearTrain);
      svgNode("path", { d: "M603 351 L638 355 M603 383 L638 389", fill: "none", stroke: "#d1d0c0", "stroke-width": "1" }, this.gearTrain);
      [[614, 364, 13], [633, 376, 10], [611, 389, 8]].forEach(([cx, cy, r], index) => {
        const gear = svgNode("g", { id: `gear-${index + 1}` }, this.gearTrain);
        svgNode("circle", { cx: 0, cy: 0, r, fill: "#a7aa9c", stroke: "#303832", "stroke-width": "1.2" }, gear);
        svgNode("circle", { cx: 0, cy: 0, r: r * 0.45, fill: "#323b35", stroke: "#d1cdb9", "stroke-width": ".8" }, gear);
        for (let k = 0; k < 12; k++) {
          const a = k * Math.PI / 6;
          line(gear, Math.cos(a) * r * 0.72, Math.sin(a) * r * 0.72, Math.cos(a) * (r + 2), Math.sin(a) * (r + 2), {
            stroke: "#313933",
            "stroke-width": "2.4"
          });
        }
        gear.dataset.x = cx;
        gear.dataset.y = cy;
        this.gears.push(gear);
      });
      svgNode("path", { d: "M606 345 V327 L621 320 L638 327 V349", fill: "none", stroke: "#b6b6a8", "stroke-width": "3" }, this.gearTrain);
      this.photon = svgNode("g", { id: "exposure-wavefront", opacity: "0" }, this.root);
      svgNode("ellipse", { cx: 0, cy: AXIS_Y, rx: 5, ry: 43, fill: "url(#window-amber)", opacity: ".42" }, this.photon);
      svgNode("line", { x1: 0, y1: AXIS_Y - 43, x2: 0, y2: AXIS_Y + 43, stroke: "#ffdf70", "stroke-width": "1.2" }, this.photon);
    }
    buildLensBarrel() {
      this.barrel = svgNode("g", { id: "lens-barrel", "stroke-linejoin": "round" }, this.root);
      svgNode("path", { d: "M438 257 Q463 245 493 267 L520 283 L520 364 L493 382 Q462 398 438 381 Z", fill: "url(#barrel-metal)", stroke: "#303733", "stroke-width": "1.6" }, this.barrel);
      svgNode("ellipse", { cx: 491, cy: 324, rx: 26, ry: 60, fill: "none", stroke: "#171e1b", "stroke-width": "4" }, this.barrel);
      svgNode("ellipse", { cx: 499, cy: 324, rx: 21, ry: 55, fill: "none", stroke: "#b7b9ae", "stroke-width": "2" }, this.barrel);
      this.barrelRear = svgNode("g", { id: "barrel-rear-section" }, this.barrel);
      svgNode("path", { d: "M368 266 Q396 246 442 260 L474 278 L474 371 L441 388 Q396 401 368 377 Z", fill: "url(#barrel-metal)", stroke: "#252d29", "stroke-width": "1.5" }, this.barrelRear);
      svgNode("path", { d: "M380 272 L380 374 M387 268 L387 379 M395 266 L395 382", fill: "none", stroke: "#ced0c4", "stroke-width": "1", opacity: ".7" }, this.barrelRear);
      svgNode("path", { d: "M402 263 Q425 257 450 268 L450 281 Q428 274 402 280 Z", fill: "#252d29", stroke: "#8d9187", "stroke-width": "1" }, this.barrelRear);
      svgNode("path", { d: "M402 371 Q426 382 450 369 L450 383 Q426 394 402 380 Z", fill: "#171e1b", stroke: "#8d9187", "stroke-width": "1" }, this.barrelRear);
      this.barrelFront = svgNode("g", { id: "barrel-front-section" }, this.barrel);
      svgNode("path", { d: "M287 258 Q319 236 371 258 L391 274 L391 370 L371 389 Q321 410 287 384 Z", fill: "url(#barrel-metal)", stroke: "#2e3531", "stroke-width": "1.7" }, this.barrelFront);
      svgNode("ellipse", { cx: 289, cy: 322, rx: 29, ry: 64, fill: "#2b332f", stroke: "#a5aaa1", "stroke-width": "2" }, this.barrelFront);
      svgNode("ellipse", { cx: 289, cy: 322, rx: 22, ry: 53, fill: "#121a17", stroke: "#0d1411", "stroke-width": "2" }, this.barrelFront);
      svgNode("path", { d: "M302 256 L302 388 M309 253 L309 392 M368 259 L368 389", stroke: "#e0ded1", "stroke-width": "1.2", opacity: ".65" }, this.barrelFront);
      const knurl = svgNode("path", { d: "M318 249 L363 256 L373 267 L373 375 L363 390 L318 397 Z", fill: "url(#fine-ribs)", stroke: "#303733", "stroke-width": "1", opacity: ".86" }, this.barrelFront);
      this.frontKnurl = knurl;
      svgNode("path", { d: "M316 276 L365 281 L365 361 L316 366 Z", fill: "#161e1b", stroke: "#bbc0b5", "stroke-width": ".8", opacity: ".65" }, this.barrelFront);
      const threads = svgNode("g", { fill: "none", stroke: "#bec1b6", "stroke-width": ".6", opacity: ".55" }, this.barrelFront);
      for (let x = 320; x < 365; x += 5) svgNode("path", { d: `M${x} 278 l-5 84 M${x + 2} 278 l-5 84` }, threads);
      svgNode("circle", { cx: 372, cy: 279, r: 3.2, fill: "#9c393d", stroke: "#e4b7ad", "stroke-width": ".6" }, this.barrelFront);
      this.barrelCutaway = svgNode("g", { id: "inner-barrel-completion", opacity: ".2" }, this.barrel);
      svgNode("path", { d: "M297 267 Q337 252 381 271 M297 377 Q337 395 381 373 M386 278 Q419 266 452 280 M386 368 Q419 383 452 370", fill: "none", stroke: "#dde0d4", "stroke-width": "1.3" }, this.barrelCutaway);
    }
    buildAperture() {
      this.iris = svgNode("g", { id: "nine-blade-aperture", transform: `translate(428 ${AXIS_Y}) scale(.66 1)` }, this.root);
      svgNode("circle", { cx: 0, cy: 0, r: 72, fill: "#1b231f", stroke: "#b7baad", "stroke-width": "3" }, this.iris);
      svgNode("circle", { cx: 0, cy: 0, r: 65, fill: "url(#iris-well)", stroke: "#111814", "stroke-width": "1.8" }, this.iris);
      svgNode("circle", { cx: 0, cy: 0, r: 57, fill: "#26302a", stroke: "#959b8e", "stroke-width": ".8" }, this.iris);
      const bladeGroup = svgNode("g", { id: "aperture-blades" }, this.iris);
      for (let index = 0; index < 9; index++) {
        const blade = svgNode("path", {
          id: `aperture-blade-${index + 1}`,
          d: "",
          fill: "url(#blade-metal)",
          stroke: "#252e28",
          "stroke-width": ".9",
          opacity: index % 2 ? ".92" : "1"
        }, bladeGroup);
        this.blades.push(blade);
        const angle = index * Math.PI * 2 / 9;
        const [px, py] = polar(61, angle);
        svgNode("circle", { cx: fixed(px), cy: fixed(py), r: 2.15, fill: "#242c27", stroke: "#d7d4c4", "stroke-width": ".8" }, this.iris);
      }
      this.irisOpening = svgNode("circle", { cx: 0, cy: 0, r: 32, fill: "#101a16", stroke: "#d5cda9", "stroke-width": ".9", opacity: ".3" }, this.iris);
      svgNode("circle", { cx: 0, cy: 0, r: 70, fill: "none", stroke: "#ece6d4", "stroke-width": ".8", opacity: ".6" }, this.iris);
    }
    buildGlass() {
      this.glass = svgNode("g", { id: "seven-independent-lens-elements", opacity: ".3" }, this.root);
      const definitions = [
        [100, 73, 18, 17, 22, "glass-a"],
        [157, 67, 14, -10, 21, "glass-b"],
        [211, 60, 15, 15, -8, "glass-c"],
        [263, 56, 13, -13, 14, "glass-a"],
        [314, 51, 16, 19, 17, "glass-b"],
        [359, 47, 11, -9, 12, "glass-c"],
        [398, 44, 12, 13, -7, "glass-a"]
      ];
      definitions.forEach((definition, index) => {
        const [x, h, thick, leftCurve, rightCurve, gradient] = definition;
        const group = svgNode("g", { id: `lens-element-${index + 1}`, class: "lens-element", "data-lens-index": index + 1 }, this.glass);
        const d = [
          `M 0 ${-h}`,
          `C ${leftCurve} ${-h * 0.73} ${leftCurve} ${h * 0.73} 0 ${h}`,
          `C ${rightCurve} ${h * 0.72} ${rightCurve} ${-h * 0.72} 0 ${-h} Z`
        ].join(" ");
        svgNode("path", { d, fill: `url(#${gradient})`, stroke: "#526b72", "stroke-width": "1.35" }, group);
        svgNode("path", {
          d: `M ${leftCurve * 0.15} ${-h + 3} C ${leftCurve * 0.72} ${-h * 0.55} ${leftCurve * 0.68} ${h * 0.42} ${rightCurve * 0.12} ${h - 3}`,
          fill: "none",
          stroke: "#f4fffa",
          "stroke-width": "2.1",
          opacity: ".68"
        }, group);
        svgNode("path", {
          d: `M ${leftCurve * 0.53} ${-h * 0.54} Q ${thick * 0.65} 0 ${rightCurve * 0.48} ${h * 0.57}`,
          fill: "none",
          stroke: "#77969d",
          "stroke-width": ".7",
          opacity: ".8"
        }, group);
        svgNode("path", { d: `M-4 ${-h - 2} Q0 ${-h - 5} 4 ${-h - 2}`, fill: "none", stroke: "#5c625a", "stroke-width": "1" }, group);
        svgNode("circle", { cx: 0, cy: -h - 7, r: 1.4, fill: "#9d864b" }, group);
        group.dataset.explodedX = x;
        group.dataset.height = h;
        this.lenses.push(group);
      });
    }
    buildRangefinders() {
      this.rfLayer = svgNode("g", { id: "coupled-rangefinder-windows" }, this.root);
      const makeWindow = (id, x, y, skew, amber) => {
        const group = svgNode("g", { id, transform: `translate(${x} ${y}) skewY(${skew})` }, this.rfLayer);
        svgNode("rect", { x: 0, y: 0, width: 68, height: 57, rx: 5, fill: "#333b35", stroke: "#171e1a", "stroke-width": "2" }, group);
        svgNode("rect", { x: 5, y: 5, width: 58, height: 47, rx: 2, fill: amber ? "#ae8030" : "#27312f", stroke: "#899086", "stroke-width": ".7" }, group);
        if (amber) svgNode("rect", { x: 6, y: 6, width: 56, height: 45, fill: "url(#window-amber)" }, group);
        const pair = svgNode("g", {}, group);
        const imageA = svgNode("g", { class: "rangefinder-image-a" }, pair);
        const imageB = svgNode("g", { class: "rangefinder-image-b" }, pair);
        const silhouettes = (parent) => {
          svgNode("path", { d: "M6 43 L19 29 L26 34 L37 18 L54 36 L62 29 L62 50 L6 50 Z", fill: amber ? "#78521d" : "#66716a", opacity: ".65" }, parent);
          svgNode("path", { d: "M26 49 V30 L32 24 L38 30 V49 M30 34h4m-4 6h4", fill: "none", stroke: amber ? "#f4ce67" : "#9fa99d", "stroke-width": "1.3", opacity: ".8" }, parent);
          svgNode("path", { d: "M7 13 L20 12 L26 17 L46 14 L61 16", fill: "none", stroke: amber ? "#e3b654" : "#78857d", "stroke-width": ".8" }, parent);
        };
        silhouettes(imageA);
        silhouettes(imageB);
        imageB.setAttribute("opacity", ".48");
        svgNode("rect", { x: 25, y: 6, width: 20, height: 44, fill: "#e9b845", opacity: amber ? ".24" : ".14" }, group);
        svgNode("path", { d: "M3 53 L65 53", stroke: "#c1c1ad", "stroke-width": ".6", opacity: ".6" }, group);
        this.windowPairs.push({ a: imageA, b: imageB, amber });
        return group;
      };
      makeWindow("rangefinder-upper-left", 620, 40, -3, true);
      makeWindow("rangefinder-upper-right", 720, 42, 3, false);
      makeWindow("rangefinder-lower-left", 627, 487, 4, false);
      makeWindow("rangefinder-lower-right", 722, 477, 4, true);
    }
    buildExteriorDetails() {
      this.exterior = svgNode("g", { id: "top-plate-and-exterior-controls", "stroke-linejoin": "round" }, this.root);
      const dial = (id, x, y, rx, ry, height) => {
        const group = svgNode("g", { id }, this.exterior);
        svgNode("path", { d: `M${x - rx} ${y} v${height} a${rx} ${ry} 0 0 0 ${rx * 2} 0 v${-height} Z`, fill: "url(#barrel-metal)", stroke: "#353b36", "stroke-width": "1" }, group);
        svgNode("ellipse", { cx: x, cy: y, rx, ry, fill: "url(#body-metal)", stroke: "#424842", "stroke-width": "1.2" }, group);
        svgNode("ellipse", { cx: x, cy: y, rx: rx * 0.72, ry: ry * 0.68, fill: "none", stroke: "#676e66", "stroke-width": ".65" }, group);
        for (let k = 0; k < 24; k++) {
          const a = k * Math.PI * 2 / 24;
          const px = x + Math.cos(a) * rx;
          const py = y + Math.sin(a) * ry;
          line(group, px, py + 1, px, py + height - 1, { stroke: "#303832", "stroke-width": ".7" });
        }
        for (let k = 0; k < 8; k++) {
          const a = k * Math.PI / 4;
          line(group, x + Math.cos(a) * rx * 0.36, y + Math.sin(a) * ry * 0.35, x + Math.cos(a) * rx * 0.62, y + Math.sin(a) * ry * 0.62, { stroke: "#51584f", "stroke-width": "1" });
        }
        svgNode("circle", { cx: x, cy: y, r: 2.4, fill: "#6b7068" }, group);
      };
      dial("shutter-speed-dial", 490, 134, 24, 9, 13);
      dial("iso-dial", 567, 151, 28, 10, 12);
      const shoe = svgNode("g", { id: "hot-shoe", transform: "translate(611 159) skewY(12)" }, this.exterior);
      svgNode("path", { d: "M0 0 H65 V18 H0 Z", fill: "#4b524b", stroke: "#252b27", "stroke-width": "1" }, shoe);
      svgNode("path", { d: "M7 3 H57 V15 H7 Z", fill: "#afb2a6", stroke: "#252b27", "stroke-width": ".8" }, shoe);
      for (let x = 9; x < 61; x += 13) svgNode("path", { d: `M${x} 2 V16`, stroke: "#1f2822", "stroke-width": "4" }, shoe);
      svgNode("rect", { x: 25, y: 6, width: 12, height: 7, fill: "#343d37", stroke: "#e1ddcd", "stroke-width": ".7" }, shoe);
      svgNode("path", { d: "M523 181 L553 186 L553 207 L523 202 Z", fill: "#1b2929", stroke: "#838c83", "stroke-width": "1.5" }, this.exterior);
      svgNode("path", { d: "M528 185 L548 189 L548 201 L528 198 Z", fill: "#53686c", opacity: ".55" }, this.exterior);
      svgNode("path", { d: "M558 186 L572 188 L572 205 L558 203 Z", fill: "#172824", stroke: "#77847b", "stroke-width": "1.2" }, this.exterior);
      svgNode("ellipse", { cx: 533, cy: 191, rx: 4, ry: 6, fill: "#9db4b1", opacity: ".3" }, this.exterior);
      svgNode("path", { d: "M527 211 L531 235 Q532 240 537 238 L543 233", fill: "none", stroke: "#afb2a7", "stroke-width": "3" }, this.exterior);
      this.sectionFrame = svgNode("path", {
        id: "section-emphasis",
        d: "",
        fill: "none",
        stroke: "#85383d",
        "stroke-width": "1",
        "stroke-dasharray": "3 4",
        opacity: ".65"
      }, this.root);
    }
    updateBlades(radius) {
      const angleOffset = 0.27 + (51 - radius) * 35e-4;
      const step = Math.PI * 2 / 9;
      for (let index = 0; index < 9; index++) {
        const angle = index * step;
        const pivot = polar(61, angle);
        const outer = polar(66, angle + 0.78);
        const innerNext = polar(radius, angle + angleOffset + step * 0.96);
        const inner = polar(radius, angle + angleOffset);
        const d = [
          `M ${pointString(pivot)}`,
          `Q ${pointString(polar(70, angle + 0.37))} ${pointString(outer)}`,
          `L ${pointString(innerNext)}`,
          `Q ${pointString(polar(radius * 0.91, angle + angleOffset + step * 0.47))} ${pointString(inner)}`,
          `Q ${pointString(polar(radius * 1.48, angle + 0.15))} ${pointString(pivot)} Z`
        ].join(" ");
        this.blades[index].setAttribute("d", d);
      }
      this.irisOpening.setAttribute("r", fixed(radius));
    }
    render(view) {
      const {
        time: time2,
        aperture,
        distance,
        finish,
        section,
        explodedOverride,
        focusInteractive
      } = view;
      const explodeTimeline = phase(time2, 0, 2);
      const exploded = explodedOverride === null ? explodeTimeline : explodedOverride ? 1 : 0;
      const irisPhase = phase(time2, 2, 4);
      const focusPhase = phase(time2, 4, 6);
      const exposurePhase = phase(time2, 6, 8);
      const frontOpen = phase(time2, 6.05, 7.03);
      const rearClose = phase(time2, 7.05, 7.94);
      const exposed = phase(time2, 6.42, 7.69);
      const irisPulse = Math.sin(irisPhase * Math.PI);
      const finishDefinition = FINISHES[finish] || FINISHES.silver;
      const metalStops = [finishDefinition.metalLight, finishDefinition.metalMid, finishDefinition.metalMid, finishDefinition.metalDark];
      metalStops.forEach((color, index) => $(this.root, `metal-stop-${index}`).setAttribute("stop-color", color));
      this.body.querySelectorAll("path").forEach((path) => {
        if (path.getAttribute("fill") === "url(#leather-pattern)") path.setAttribute("stroke", finishDefinition.edge);
      });
      this.frontKnurl.setAttribute("opacity", finish === "black" ? ".64" : ".86");
      const reveal = Math.max(0.06, explodeTimeline, exploded, time2 >= 2 ? 0.97 : 0);
      this.mechanics.setAttribute("opacity", fixed(reveal * (section === "right" ? 1 : 0.38)));
      this.sectionCover.setAttribute("opacity", fixed(lerp(0.94, section === "right" ? 0.12 : 0.72, reveal)));
      this.sectionHatch.setAttribute("opacity", fixed(lerp(0.3, section === "right" ? 0.07 : 0.22, reveal)));
      this.glass.setAttribute("opacity", fixed(lerp(0.28, 1, Math.max(exploded, time2 >= 2 ? 0.95 : 0))));
      this.iris.setAttribute("opacity", section === "left" ? "1" : ".88");
      this.barrelCutaway.setAttribute("opacity", fixed(lerp(0.12, section === "left" ? 0.96 : 0.55, reveal)));
      this.lensShadow.setAttribute("opacity", fixed(exploded * 0.13));
      this.barrelFront.setAttribute("transform", `translate(${fixed(-32 * exploded)} 0)`);
      this.barrelRear.setAttribute("transform", `translate(${fixed(-10 * exploded)} 0)`);
      const travel = focusTravel(distance);
      const demoTravel = (1 - focusPhase) * (Number.isFinite(distance) ? lerp(14, 0, clamp((distance - 0.7) / 9.3, 0, 1)) : 0);
      const explodedPositions = [100, 157, 211, 263, 314, 359, 398];
      const compactPositions = [337, 350, 363, 376, 389, 402, 415];
      this.lenses.forEach((lens, index) => {
        const floating = index >= 4 ? travel * (index === 4 ? 0.65 : 1) + demoTravel * (index === 4 ? 0.55 : 1) : 0;
        const x = lerp(compactPositions[index], explodedPositions[index], exploded) + floating;
        const sectionLift = section === "left" && index < 3 ? 0 : 0;
        lens.setAttribute("transform", `translate(${fixed(x)} ${AXIS_Y + sectionLift})`);
        lens.setAttribute("opacity", fixed(index < 4 ? lerp(0.5, 1, exploded) : 1));
      });
      const baseRadius = apertureRadius(aperture);
      const visualRadius = baseRadius + (52 - baseRadius) * irisPulse * 0.8;
      this.updateBlades(visualRadius);
      this.iris.setAttribute("transform", `translate(428 ${AXIS_Y}) scale(.66 1)`);
      const nearError = Number.isFinite(distance) ? 12 * Math.exp(-(distance - 0.7) * 0.37) : 0;
      const demoResolution = focusInteractive ? 1 : 1 - focusPhase;
      const disparity = nearError * demoResolution;
      this.windowPairs.forEach(({ a, b, amber }, index) => {
        const sign = index < 2 ? 1 : -1;
        a.setAttribute("transform", `translate(${fixed(-disparity * 0.45 * sign)} 0)`);
        b.setAttribute("transform", `translate(${fixed(disparity * 0.45 * sign)} 0)`);
        b.setAttribute("opacity", fixed(disparity < 0.03 ? 0 : amber ? 0.55 : 0.43));
      });
      this.frontCurtain.setAttribute("transform", `translate(0 ${fixed(-119 * frontOpen)})`);
      this.rearCurtain.setAttribute("transform", `translate(18 ${fixed(119 * (1 - rearClose))})`);
      this.sensorLight.setAttribute("opacity", fixed(exposed * 0.94));
      this.sensorScan.setAttribute("opacity", fixed(exposurePhase > 0 && exposurePhase < 1 ? 0.75 : 0));
      this.sensorScan.setAttribute("transform", `translate(0 ${fixed(100 * exposurePhase)})`);
      this.gears.forEach((gear, index) => {
        const direction = index === 1 ? -1 : 1;
        const rotation = direction * (frontOpen * 155 + rearClose * 128 + focusPhase * 35);
        gear.setAttribute("transform", `translate(${gear.dataset.x} ${gear.dataset.y}) rotate(${fixed(rotation)})`);
      });
      const rayHalf = visualRadius * 0.92;
      const frontX = lerp(326, 82, exploded);
      this.mainCone.setAttribute("d", `M ${fixed(frontX)} ${fixed(AXIS_Y - rayHalf * 0.45)} L 428 ${fixed(AXIS_Y - rayHalf)} L 657 273 L 657 372 L 428 ${fixed(AXIS_Y + rayHalf)} L ${fixed(frontX)} ${fixed(AXIS_Y + rayHalf * 0.45)} Z`);
      this.mainCone.setAttribute("opacity", fixed(lerp(0.08, 0.62, exposed) + exploded * 0.07));
      this.apertureRayTop.setAttribute("d", `M ${fixed(frontX)} ${AXIS_Y} L 428 ${fixed(AXIS_Y - rayHalf)} L657 272`);
      this.apertureRayBottom.setAttribute("d", `M ${fixed(frontX)} ${AXIS_Y} L 428 ${fixed(AXIS_Y + rayHalf)} L657 372`);
      this.apertureRayTop.setAttribute("opacity", fixed(0.15 + exposed * 0.62));
      this.apertureRayBottom.setAttribute("opacity", fixed(0.15 + exposed * 0.62));
      const waveX = lerp(431, 657, exposurePhase);
      this.photon.setAttribute("transform", `translate(${fixed(waveX)} 0)`);
      this.photon.setAttribute("opacity", fixed(time2 >= 6 && time2 < 7.8 ? Math.sin(exposurePhase * Math.PI) * 0.9 : 0));
      this.rfCones.setAttribute("opacity", fixed(0.52 + exposed * 0.48));
      this.sectionFrame.setAttribute("d", section === "right" ? "M523 224 L704 243 L709 417 L530 397 Z" : "M275 235 Q355 212 448 245 L455 402 Q355 424 270 400 Z");
      this.sectionFrame.setAttribute("opacity", fixed(0.28 + reveal * 0.42));
      return {
        explodedAmount: exploded,
        visualApertureRadius: visualRadius,
        frontCurtainOpen: frontOpen,
        rearCurtainClosed: rearClose,
        sensorExposure: exposed,
        focusDisparity: disparity
      };
    }
  };

  // output/src/controls.js
  var byId = (id) => document.getElementById(id);
  function fillRange(input) {
    const min = Number(input.min || 0);
    const max = Number(input.max || 100);
    const percentage = (Number(input.value) - min) / (max - min) * 100;
    input.style.setProperty("--fill", `${Math.max(0, Math.min(100, percentage))}%`);
  }
  function createControls(actions) {
    const elements = {
      play: byId("play"),
      pause: byId("pause"),
      scrub: byId("scrub"),
      aperture: byId("aperture-slider"),
      focus: byId("focus-slider"),
      finish: byId("finish-select"),
      sectionInset: byId("section-inset")
    };
    elements.play.addEventListener("click", actions.play);
    elements.pause.addEventListener("click", actions.pause);
    const scrub = () => actions.setTime(Number(elements.scrub.value), true);
    elements.scrub.addEventListener("input", scrub);
    elements.scrub.addEventListener("change", scrub);
    elements.aperture.addEventListener("input", () => {
      actions.setParameter("aperture", Number(elements.aperture.value));
    });
    byId("aperture-prev").addEventListener("click", () => {
      actions.setParameter("aperture", stepAperture(actions.getState().aperture, -1));
    });
    byId("aperture-next").addEventListener("click", () => {
      actions.setParameter("aperture", stepAperture(actions.getState().aperture, 1));
    });
    elements.focus.addEventListener("input", () => {
      actions.setParameter("distance", normalizedToDistance(elements.focus.value));
    });
    byId("focus-prev").addEventListener("click", () => {
      actions.setParameter("distance", stepFocus(actions.getState().distance, -1));
    });
    byId("focus-next").addEventListener("click", () => {
      actions.setParameter("distance", stepFocus(actions.getState().distance, 1));
    });
    elements.finish.addEventListener("change", () => actions.setParameter("finish", elements.finish.value));
    byId("exploded-toggle").addEventListener("click", () => {
      actions.setParameter("explodedOverride", !actions.getState().exploded);
    });
    byId("section-left").addEventListener("click", () => actions.setParameter("section", "left"));
    byId("section-right").addEventListener("click", () => actions.setParameter("section", "right"));
    byId("reset-btn").addEventListener("click", actions.reset);
    byId("tab-aperture").addEventListener("click", () => actions.setParameter("activeControl", "aperture"));
    byId("tab-focus").addEventListener("click", () => actions.setParameter("activeControl", "focus"));
    document.querySelectorAll(".chapter-nav [data-phase]").forEach((button) => {
      const times = { lens: 0, aperture: 2, focus: 4, exposure: 6 };
      button.addEventListener("click", () => actions.setTime(times[button.dataset.phase], true));
    });
    const menu = byId("menu-btn");
    const index = byId("product-index");
    menu.addEventListener("click", () => {
      const expanded = menu.getAttribute("aria-expanded") === "true";
      menu.setAttribute("aria-expanded", String(!expanded));
      index.hidden = expanded;
    });
    return {
      sync(state, visual, phaseName) {
        elements.scrub.value = state.time.toFixed(3);
        elements.aperture.value = String(state.aperture);
        elements.focus.value = String(distanceToNormalized(state.distance).toFixed(3));
        elements.finish.value = state.finish;
        [elements.scrub, elements.aperture, elements.focus].forEach(fillRange);
        byId("time-display").innerHTML = `${state.time.toFixed(1).padStart(4, "0")} <span>/ 08.0</span>`;
        byId("aperture-value").textContent = state.aperture.toFixed(1).replace(".0", "");
        elements.aperture.setAttribute("aria-valuetext", `f/${state.aperture.toFixed(1)}`);
        const focusText = formatDistance(state.distance);
        byId("focus-value").textContent = focusText;
        byId("focus-value").dataset.infinite = String(!Number.isFinite(state.distance));
        byId("focus-unit").textContent = Number.isFinite(state.distance) ? "m" : "infinity";
        elements.focus.setAttribute("aria-valuetext", Number.isFinite(state.distance) ? `${focusText} metres` : "Infinity");
        byId("phase-name").textContent = phaseName;
        document.querySelectorAll(".chapter-nav [data-phase]").forEach((button) => {
          const active = button.dataset.phase === state.phase;
          button.classList.toggle("active", active);
          if (active) button.setAttribute("aria-current", "step");
          else button.removeAttribute("aria-current");
        });
        elements.play.classList.toggle("active", state.playing);
        elements.pause.classList.toggle("active", !state.playing && state.time > 0 && state.time < 8);
        elements.play.setAttribute("aria-pressed", String(state.playing));
        const apertureActive = state.activeControl === "aperture";
        byId("tab-aperture").classList.toggle("active", apertureActive);
        byId("tab-focus").classList.toggle("active", !apertureActive);
        byId("tab-aperture").setAttribute("aria-pressed", String(apertureActive));
        byId("tab-focus").setAttribute("aria-pressed", String(!apertureActive));
        byId("aperture-readout").classList.toggle("active", apertureActive);
        byId("focus-readout").classList.toggle("active", !apertureActive);
        const right = state.section === "right";
        byId("section-left").classList.toggle("active", !right);
        byId("section-right").classList.toggle("active", right);
        byId("section-left").setAttribute("aria-pressed", String(!right));
        byId("section-right").setAttribute("aria-pressed", String(right));
        elements.sectionInset.textContent = right ? "SECTION R \xB7 FOCAL PLANE" : "SECTION L \xB7 FLOATING OPTICS";
        const explodedButton = byId("exploded-toggle");
        explodedButton.setAttribute("aria-pressed", String(visual.explodedAmount >= 0.5));
        byId("mode-status").textContent = visual.explodedAmount >= 0.98 ? "EXPLODED" : visual.explodedAmount <= 0.02 ? "ASSEMBLED" : "IN TRANSITION";
        byId("finish-swatch").dataset.finish = state.finish;
        byId("playback-status").textContent = state.playing ? "PLAYING / ONE SHOT" : state.time >= 8 ? "EXPOSURE COMPLETE" : state.time > 0 ? "PAUSED / HOLD" : "READY / ONE SHOT";
        document.querySelector(".status-dot").classList.toggle("playing", state.playing);
        const captions = state.time < 2 ? "ASSEMBLED EXTERIOR / AXIAL RELEASE" : state.time < 4 ? "NINE-BLADE IRIS / COORDINATED ACTUATION" : state.time < 6 ? "FLOATING GROUP / RANGEFINDER COUPLING" : state.time < 8 ? "FOCAL PLANE / EXPOSURE INTEGRATION" : "FULL EXPOSURE / COMPLETE OPTICAL SECTION";
        byId("mechanism-caption").textContent = captions;
        const phaseLabels = {
          lens: "LENS / AXIAL ASSEMBLY",
          aperture: "APERTURE / NINE BLADES",
          focus: "FOCUS / DOUBLE-IMAGE COUPLING",
          exposure: "EXPOSURE / FOCAL PLANE"
        };
        byId("phase-name").textContent = phaseLabels[state.phase];
      }
    };
  }

  // output/src/main.js
  var initialParameters = () => ({
    aperture: 2.5,
    distance: 0.7,
    finish: "silver",
    section: "right",
    explodedOverride: null,
    activeControl: "aperture",
    focusInteractive: false
  });
  var parameters = initialParameters();
  var time = 0;
  var playing = false;
  var frameRequest = 0;
  var playbackOrigin = 0;
  var timeOrigin = 0;
  var hasPlayedAutomatically = false;
  var lastVisual = {};
  var lastDrawKey = "";
  var phase2 = "lens";
  var stage = new CameraStage(document.getElementById("stage"));
  function snapshot() {
    return {
      t: time,
      time,
      duration: DURATION,
      playing,
      playback: playing ? "playing" : time >= DURATION ? "complete" : "paused",
      mode: "oneshot",
      aperture: parameters.aperture,
      fNumber: parameters.aperture,
      distance: parameters.distance,
      focusDistance: parameters.distance,
      focusLabel: Number.isFinite(parameters.distance) ? `${parameters.distance.toFixed(2)} m` : "\u221E",
      finish: parameters.finish,
      colorway: parameters.finish,
      section: parameters.section,
      sectionMode: parameters.section === "right" ? "right-cutaway" : "left-cutaway",
      exploded: lastVisual.explodedAmount >= 0.5,
      explodedMode: lastVisual.explodedAmount >= 0.5 ? "exploded" : "assembled",
      explodedAmount: lastVisual.explodedAmount,
      phase: phase2,
      optical: { ...lastVisual }
    };
  }
  function draw() {
    const signature = [
      time,
      playing,
      parameters.aperture,
      String(parameters.distance),
      parameters.finish,
      parameters.section,
      String(parameters.explodedOverride),
      parameters.activeControl,
      parameters.focusInteractive
    ].join("|");
    if (signature === lastDrawKey) return;
    lastDrawKey = signature;
    phase2 = timelinePhase(time);
    lastVisual = stage.render({ time, ...parameters });
    controls.sync(snapshot(), lastVisual, phase2);
  }
  function cancelFrame() {
    if (frameRequest) cancelAnimationFrame(frameRequest);
    frameRequest = 0;
  }
  function animationFrame(now) {
    frameRequest = 0;
    if (!playing) return;
    time = clamp(timeOrigin + (now - playbackOrigin) / 1e3, 0, DURATION);
    if (time >= DURATION) {
      time = DURATION;
      playing = false;
    }
    draw();
    if (playing) frameRequest = requestAnimationFrame(animationFrame);
  }
  function pause() {
    hasPlayedAutomatically = true;
    playing = false;
    cancelFrame();
    draw();
  }
  function play() {
    cancelFrame();
    if (time >= DURATION) time = 0;
    playing = true;
    timeOrigin = time;
    playbackOrigin = performance.now();
    draw();
    frameRequest = requestAnimationFrame(animationFrame);
  }
  function applyTime(value, shouldPause = true) {
    hasPlayedAutomatically = true;
    if (shouldPause) {
      playing = false;
      cancelFrame();
    }
    const numeric = Number(value);
    time = Number.isFinite(numeric) ? clamp(numeric, 0, DURATION) : 0;
    draw();
    return time;
  }
  function setParameter(key, value) {
    if (!(key in parameters)) return;
    if (key === "aperture") parameters.aperture = clamp(Number(value) || 2.5, 1.7, 16);
    else if (key === "distance") {
      parameters.distance = value === Infinity ? Infinity : clamp(Number(value) || 0.7, 0.7, 50);
      if (Number(value) >= 50) parameters.distance = Infinity;
      parameters.focusInteractive = true;
    } else if (key === "explodedOverride") parameters.explodedOverride = Boolean(value);
    else if (key === "finish" && ["silver", "black", "champagne"].includes(value)) parameters.finish = value;
    else if (key === "section" && ["left", "right"].includes(value)) parameters.section = value;
    else if (key === "activeControl" && ["aperture", "focus"].includes(value)) parameters.activeControl = value;
    draw();
  }
  function reset() {
    playing = false;
    cancelFrame();
    Object.assign(parameters, initialParameters());
    time = 0;
    hasPlayedAutomatically = true;
    draw();
  }
  var controls = createControls({
    getState: snapshot,
    play,
    pause,
    setTime: applyTime,
    setParameter,
    reset
  });
  window.renderAt = (seconds) => applyTime(seconds, true);
  window.__getSceneState = () => snapshot();
  window.__SCENE_READY__ = false;
  draw();
  window.__SCENE_READY__ = true;
})();
