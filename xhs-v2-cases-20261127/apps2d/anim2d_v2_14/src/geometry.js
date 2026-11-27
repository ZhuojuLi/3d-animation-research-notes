/**
 * Static, layered SVG atelier. All measurements are in the 1280 x 720 scene grid.
 * Dynamic transforms are deliberately confined to clearly named part hierarchies.
 */
export const SCENE = Object.freeze({ width: 1280, height: 720, duration: 6 });
export const NEEDLE = Object.freeze({ x: 440, y: 405 });
export const COMPASS_LENGTH = 200;
export const COMPASS_SPREAD = 60;
export const COMPASS_SWEEP = 58;
export const COMPASS_BASE_ANGLE = 0;
export const TSQUARE_START = 826;
export const TSQUARE_TRAVEL = 64;

const f = n => Number(n.toFixed(3));
const line = (x1, y1, x2, y2, cls = '') => `<line x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}"${cls ? ` class="${cls}"` : ''}/>`;
const text = (x, y, value, cls = '', extra = '') => `<text x="${x}" y="${y}"${cls ? ` class="${cls}"` : ''} ${extra}>${value}</text>`;

function boardGrain() {
  let out = '';
  for (let i = 0; i < 24; i += 1) {
    const y = 106 + i * 19.2;
    const wave = 3 + (i % 4) * 1.4;
    out += `<path d="M139 ${f(y)} C300 ${f(y - wave)} 364 ${f(y + wave)} 504 ${f(y)} S797 ${f(y - wave)} 1058 ${f(y + 1)}" class="board-grain ${i % 3 === 0 ? 'grain-dark' : ''}"/>`;
    if (i % 4 === 1) {
      out += `<path d="M180 ${f(y + 5)} C265 ${f(y + 2 - wave)} 333 ${f(y + 9)} 419 ${f(y + 4)}" class="board-grain grain-fine"/>`;
    }
  }
  // Walnut knot, kept behind the paper.
  out += '<path d="M975 529c29-15 73-9 90 5-25 12-63 12-90-5Zm13 0c21-7 47-4 61 3-20 7-42 6-61-3Z" class="board-knot"/>';
  return out;
}

function paperGuides() {
  let out = '';
  for (let x = 274; x <= 974; x += 25) {
    const major = (x - 274) % 100 === 0;
    out += line(x, 260, x, major ? 269 : 265, major ? 'index-major' : 'index-minor');
    if (major && x < 940) out += text(x, 282, String((x - 274) / 25).padStart(2, '0'), 'paper-index');
  }
  for (let y = 308; y <= 553; y += 35) {
    out += line(234, y, 242, y, 'index-minor');
  }
  return out;
}

function rulerTicks() {
  let out = '';
  for (let x = 263; x <= 1023; x += 10) {
    const major = (x - 263) % 50 === 0;
    const mid = (x - 263) % 25 === 0;
    out += line(x, 181, x, major ? 193 : mid ? 189 : 186, major ? 'ruler-tick major' : 'ruler-tick');
    if (major && x < 1010) out += text(x + 3, 177, String((x - 263) / 10), 'ruler-number');
  }
  return out;
}

function tsquareTicks() {
  let out = '';
  for (let y = 213; y <= 548; y += 10) {
    const major = (y - 213) % 50 === 0;
    const mid = (y - 213) % 25 === 0;
    out += line(892, y, major ? 878 : mid ? 883 : 887, y, major ? 'ruler-tick major' : 'ruler-tick');
    if (major && y < 535) out += text(875, y + 3, String((y - 213) / 10), 'ruler-number', 'text-anchor="end"');
  }
  return out;
}

function threadPaths() {
  let out = '';
  for (let i = 0; i < 4; i += 1) {
    out += `<path d="M${77 + i * 7} 349 C${137 + i * 5} 346 ${95 + i * 4} 391 ${118 + i * 3} 425 S${82 + i * 8} 470 ${116 + i * 5} 508" class="linen-thread thread-${i}"/>`;
  }
  return out;
}

function stackSheets() {
  return Array.from({ length: 7 }, (_, i) => {
    const x = i * 5;
    const y = 128 + i * 10;
    const right = 122 - i;
    return `<path d="M${x} ${y} L${right} ${y + 8} ${92 + i} ${y + 287} ${x + 4} ${y + 278}Z" class="stack-sheet"/>`;
  }).join('');
}

function telemetryStatic(index, x, title, unit) {
  const gx = x + 25;
  return `<g class="telemetry-card" data-gauge="${index}">
    <rect x="${x}" y="625" width="225" height="95" class="telemetry-bg"/>
    <path d="M${x} 625h225" class="telemetry-topline"/>
    ${text(x + 23, 646, title, 'telemetry-title')}
    <g class="mini-gauge" transform="translate(${gx + 8} 692)">
      <path d="M-16 9A20 20 0 1 1 16 9" class="gauge-track"/>
      <path d="M-16 9A20 20 0 1 1 16 9" class="gauge-fill" id="gauge-arc-${index}" pathLength="100" stroke-dasharray="100" stroke-dashoffset="100"/>
      ${[-16, -20, -11, 0, 11, 20, 16].map((tx, i) => {
        const a = (150 + i * 40) * Math.PI / 180;
        return line(Math.cos(a) * 17, Math.sin(a) * 17, Math.cos(a) * 20, Math.sin(a) * 20, 'gauge-tick');
      }).join('')}
      <g id="gauge-needle-${index}"><path d="M-2 3L0-15 2 3Z" class="gauge-needle"/></g>
      <circle r="3.2" class="gauge-pin"/>
    </g>
    ${text(x + 64, 677, '0', 'telemetry-value', `id="gauge-value-${index}"`)}
    ${text(x + 64, 693, unit, 'telemetry-unit')}
    <rect x="${x + 64}" y="702" width="133" height="5" rx="2.5" class="meter-track"/>
    <rect x="${x + 64}" y="702" width="0" height="5" rx="2.5" class="meter-fill" id="meter-${index}"/>
    ${text(x + 198, 716, '00', 'telemetry-phase', `id="gauge-code-${index}" text-anchor="end"`)}
  </g>`;
}

function insetShadow(width, height, depth = 7) {
  return `<rect x="4" y="${depth}" width="${width}" height="${height}" rx="5" class="tool-shadow"/>`;
}

export function buildScene() {
  const cards = [
    ['ARC ANGLE', 'DEGREES / CONSTRUCTION', 'deg'],
    ['COMPASS TRAVEL', 'SCRIBED DISTANCE / mm', 'mm'],
    ['T-SQUARE POSITION', 'INDEXED TRAVEL / mm', 'mm'],
    ['CUTTER SPEED', 'STROKE RATE / mm·s⁻¹', 'mm/s'],
    ['TRIM PROGRESS', 'GUIDED CUT / percent', '%'],
  ];
  return `
  <defs>
    <linearGradient id="bg-wash" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#e9e1cf"/><stop offset="1" stop-color="#cfc6b2"/></linearGradient>
    <linearGradient id="walnut" x1="0" y1="0" x2="0.9" y2="1"><stop stop-color="#896447"/><stop offset="0.48" stop-color="#765039"/><stop offset="1" stop-color="#5e402f"/></linearGradient>
    <linearGradient id="paper" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#fff5d9"/><stop offset="0.52" stop-color="#f7edcf"/><stop offset="1" stop-color="#eadbb7"/></linearGradient>
    <linearGradient id="brass" x1="0" y1="0" x2="1" y2="0"><stop stop-color="#8e642d"/><stop offset="0.25" stop-color="#d7b56c"/><stop offset="0.52" stop-color="#f0d58d"/><stop offset="0.77" stop-color="#b18641"/><stop offset="1" stop-color="#795326"/></linearGradient>
    <linearGradient id="brass-vertical" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#edd393"/><stop offset="0.45" stop-color="#bc914b"/><stop offset="1" stop-color="#80602f"/></linearGradient>
    <linearGradient id="navy-enamel" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#344653"/><stop offset="0.45" stop-color="#1c2d3b"/><stop offset="1" stop-color="#0f1c29"/></linearGradient>
    <linearGradient id="steel" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#f0eee4"/><stop offset="0.35" stop-color="#aeb5b3"/><stop offset="0.65" stop-color="#e1e1d8"/><stop offset="1" stop-color="#747f83"/></linearGradient>
    <linearGradient id="bone" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#fff8dd"/><stop offset="0.45" stop-color="#e8d8ae"/><stop offset="0.63" stop-color="#fff5d4"/><stop offset="1" stop-color="#bcaa82"/></linearGradient>
    <linearGradient id="rail-bg" x1="0" y1="0" x2="1" y2="0"><stop stop-color="#a7ada9"/><stop offset="1" stop-color="#8f999a"/></linearGradient>
    <radialGradient id="hinge-metal"><stop offset="0" stop-color="#f6df9b"/><stop offset="0.45" stop-color="#bf934b"/><stop offset="1" stop-color="#715026"/></radialGradient>
    <filter id="desk-shadow" x="-20%" y="-20%" width="150%" height="160%"><feGaussianBlur stdDeviation="6"/></filter>
    <pattern id="paper-fibres" width="48" height="36" patternUnits="userSpaceOnUse"><path d="M3 9l13-1m12 20 15-2M9 31l7-1M32 6l9 1" stroke="#806e49" stroke-width="0.55" opacity="0.11"/></pattern>
    <pattern id="rail-grid" width="14" height="14" patternUnits="userSpaceOnUse"><path d="M14 0H0V14" fill="none" stroke="#364b57" stroke-width="0.45" opacity="0.09"/></pattern>
    <clipPath id="board-clip"><rect x="132" y="79" width="925" height="524" rx="21"/></clipPath>
    <clipPath id="paper-clip"><path d="M252 171H1005L987 576H225Z"/></clipPath>
    <clipPath id="cutter-window"><rect data-allow-clip="true" x="-4" y="-9" width="125" height="17" rx="3"/></clipPath>
  </defs>

  <!-- ENVIRONMENT: warm linen desk and walnut drawing board. -->
  <g id="environment-layer">
    <rect width="1280" height="720" fill="url(#bg-wash)"/>
    <rect x="0" y="0" width="1280" height="42" class="navy-header"/>
    <rect x="0" y="40.5" width="1280" height="2" class="header-rule"/>
    <g class="menu-mark"><rect x="25" y="13" width="12" height="1.5"/><rect x="25" y="18" width="12" height="1.5"/><rect x="25" y="23" width="12" height="1.5"/></g>
    ${text(52, 25, 'ARCHITECTURAL BOARD', 'header-label')}
    ${text(640, 25, 'DRAFT &amp; BOOKBINDING ATELIER', 'header-title', 'text-anchor="middle"')}
    <path d="M1071 44H1280V617H1071Z" fill="url(#rail-bg)"/>
    <path d="M1071 44H1280V617H1071Z" fill="url(#rail-grid)"/>
    <path d="M1070.5 43V617" class="rail-divider"/>
    ${text(1175, 25, 'INSPECTOR RAIL', 'header-title', 'text-anchor="middle"')}
    ${text(28, 59, 'PLATE 07', 'table-caption')}
    ${text(1047, 59, 'MECHANICAL STUDY  /  6 s', 'table-caption', 'text-anchor="end"')}

    <rect x="144" y="96" width="926" height="520" rx="22" fill="#3f352b" opacity="0.23" filter="url(#desk-shadow)"/>
    <rect x="132" y="79" width="925" height="524" rx="21" fill="url(#walnut)" class="board-outline"/>
    <g clip-path="url(#board-clip)">${boardGrain()}</g>
    <path d="M147 93Q141 94 141 111V566Q141 587 157 588H1035" class="board-bevel-light"/>
    <rect x="139" y="86" width="911" height="510" rx="17" class="board-inner-rule"/>
    <circle cx="157" cy="104" r="2.6" class="board-pin"/><circle cx="1030" cy="577" r="2.6" class="board-pin"/>

    <!-- loose bookbinding supplies at the left margin -->
    <g id="stacked-sheets">${stackSheets()}</g>
    <path d="M16 121L123 129 92 412 6 402Z" class="stack-top"/>
    <path d="M26 137L108 142M22 148L103 153" class="stack-deckle"/>
    <g id="linen-thread">${threadPaths()}</g>
    ${text(25, 520, 'LINEN', 'supply-label')}${text(25, 535, 'THREAD', 'supply-label')}
    <path d="M65 504l23-28 17-7" class="leader-line"/>
    <g id="bone-folder" transform="translate(151 433) rotate(11)">
      <path d="M-15 91Q-23 74-15 36L-4-68Q0-92 9-78L22 28Q28 66 17 88Q3 103-15 91Z" fill="#332a23" opacity="0.2" transform="translate(5 6)"/>
      <path d="M-15 85Q-23 68-15 30L-4-74Q0-98 9-84L22 22Q28 60 17 82Q3 97-15 85Z" fill="url(#bone)" stroke="#514737" stroke-width="1.6"/>
      <path d="M-7 74Q-13 45-5 3L3-68" fill="none" stroke="#fff9e3" stroke-width="2.4" opacity="0.75"/>
      <path d="M16 65Q21 34 12-13" fill="none" stroke="#a38f66" opacity="0.4"/>
    </g>
    ${text(24, 566, 'BONE', 'supply-label')}${text(24, 581, 'FOLDER', 'supply-label')}
    <path d="M67 557l36-19 27-5" class="leader-line"/>
  </g>

  <!-- PAPER: several inset cream sheets, registration and index ticks. -->
  <g id="paper-layer">
    <path d="M259 178H1007L989 581H232Z" fill="#463729" opacity="0.17" transform="translate(4 5)"/>
    <path d="M253 175H1005L987 579H227Z" fill="#cbbd99" stroke="#5c4a34" stroke-width="1.2"/>
    <path d="M250 173H1006L988 577H226Z" fill="#ece0bf" stroke="#827153"/>
    <path d="M252 171H1005L987 576H225Z" fill="url(#paper)" stroke="#5f523c" stroke-width="1.3"/>
    <path d="M252 171H1005L987 576H225Z" fill="url(#paper-fibres)"/>
    <path d="M263 181H994M237 564H977" class="paper-inner-rule"/>
    <g id="indexed-guides">${paperGuides()}</g>
    <g class="registration-crosses">
      <g transform="translate(272 218)"><circle r="7"/><path d="M-11 0H11M0-11V11"/></g>
      <g transform="translate(934 218)"><circle r="7"/><path d="M-11 0H11M0-11V11"/></g>
      <g transform="translate(250 515)"><circle r="7"/><path d="M-11 0H11M0-11V11"/></g>
      <g transform="translate(935 515)"><circle r="7"/><path d="M-11 0H11M0-11V11"/></g>
    </g>
    ${text(294, 218, 'INDEXED GUIDE', 'paper-heading')}
    ${text(294, 235, 'A—07  /  REGISTERED CREAM STOCK', 'paper-micro')}
    ${text(695, 548, '200 gsm', 'paper-micro', 'text-anchor="end"')}
    <path d="M291 244H362" class="paper-underline"/>
  </g>

  <!-- FIXED RULER: slotted brass rule immediately above the compass hinge. -->
  <g id="slotted-ruler">
    ${insetShadow(850, 31, 6)}
    <rect x="195" y="164" width="850" height="31" rx="3" fill="#242724" opacity="0.14" transform="translate(3 4)"/>
    <rect x="195" y="161" width="850" height="31" rx="3" fill="url(#brass-vertical)" stroke="#4b402d" stroke-width="1.4"/>
    <rect x="205" y="168" width="830" height="9" rx="4.5" fill="#4b412f" stroke="#ead094" stroke-width="0.7"/>
    <path d="M215 172.5H1025" stroke="#1e2426" stroke-width="2.2"/>
    ${rulerTicks()}
    ${text(204, 207, 'HORIZONTAL SLOTTED RULE', 'tool-caption')}
    ${text(1025, 207, 'mm  /  0—76', 'tool-micro', 'text-anchor="end"')}
  </g>

  <!-- CONSTRUCTION: pathLength normalisation makes arc growth deterministic. -->
  <g id="construction-layer" clip-path="url(#paper-clip)">
    <path d="M640 405A200 200 0 0 1 545.98 574.61" class="construction-underlay"/>
    <path d="M640 405A200 200 0 0 1 545.98 574.61" class="construction-ghost"/>
    <path id="golden-arc" d="M640 405A200 200 0 0 1 545.98 574.61" pathLength="100" stroke-dasharray="100" stroke-dashoffset="100" class="golden-arc"/>
    <path d="M440 405L622 405M440 405L599 334" class="construction-conjugate"/>
    <circle cx="440" cy="405" r="200" class="construction-radius-ghost"/>
    <g id="trim-layer"><path id="trim-line" d="M971.20 450.24L994.15 483.00" pathLength="100" stroke-dasharray="100" stroke-dashoffset="100" class="trim-line"/></g>
    <g id="paper-ribbon" opacity="0">
      <path id="ribbon-shadow" d="M782 286C710 302 696 375 704 441C712 493 778 498 786 453C794 413 732 406 731 443C730 462 752 469 763 451" class="ribbon-shadow" pathLength="100" stroke-dasharray="100" stroke-dashoffset="100"/>
      <path id="ribbon-outline" d="M782 286C710 302 696 375 704 441C712 493 778 498 786 453C794 413 732 406 731 443C730 462 752 469 763 451" class="ribbon-outline" pathLength="100" stroke-dasharray="100" stroke-dashoffset="100"/>
      <path id="ribbon-body" d="M782 286C710 302 696 375 704 441C712 493 778 498 786 453C794 413 732 406 731 443C730 462 752 469 763 451" class="ribbon-body" pathLength="100" stroke-dasharray="100" stroke-dashoffset="100"/>
      <path id="ribbon-highlight" d="M782 286C710 302 696 375 704 441C712 493 778 498 786 453C794 413 732 406 731 443C730 462 752 469 763 451" class="ribbon-highlight" pathLength="100" stroke-dasharray="100" stroke-dashoffset="100"/>
    </g>
  </g>

  <!-- T-SQUARE: one rigid translated hierarchy, including index blade and head. -->
  <g id="tsquare-tool" transform="translate(0 0)">
    <path d="M823 213H870V590H823Z" fill="#322a23" opacity="0.19" transform="translate(7 5)"/>
    <path d="M826 209H864V585H826Z" fill="url(#brass)" stroke="#493c2b" stroke-width="1.6"/>
    <path d="M832 214H842V579H832Z" fill="#efcf86" opacity="0.65"/>
    <path d="M853 214H859V579H853Z" fill="#674b28" opacity="0.53"/>
    <path d="M822 219H899V585H822Z" fill="url(#brass-vertical)" stroke="#4b402c" stroke-width="1.25"/>
    <path d="M865 219H892V585H865Z" fill="#d8b86e" opacity="0.55"/>
    <g>${tsquareTicks()}</g>
    <path d="M714 203V180Q714 160 739 160H826V207ZM864 160H961Q989 160 989 184V203H864Z" fill="url(#navy-enamel)" stroke="#172630" stroke-width="1.7"/>
    <rect x="826" y="151" width="40" height="72" rx="2" fill="url(#brass)" stroke="#51412b" stroke-width="1.4"/>
    <path d="M843 154V218M831 159V216M860 159V216" stroke="#7b582a" stroke-width="0.75" opacity="0.65"/>
    <g class="tsquare-screws"><g transform="translate(835 161)"><circle r="3.6"/><path d="M-2 0h4"/></g><g transform="translate(855 161)"><circle r="3.6"/><path d="M-2 0h4"/></g><g transform="translate(835 183)"><circle r="3.6"/><path d="M-2 0h4"/></g><g transform="translate(855 183)"><circle r="3.6"/><path d="M-2 0h4"/></g><g transform="translate(835 207)"><circle r="3.6"/><path d="M-2 0h4"/></g><g transform="translate(855 207)"><circle r="3.6"><title>T-square head screw</title></circle><path d="M-2 0h4"/></g><g transform="translate(855 207)"><circle r="3.6"/><path d="M-2 0h4"/></g></g>
    <path d="M828 574H891" stroke="#f6d98d" stroke-width="2"/>
    <g id="tsquare-position-marker"><path d="M897 388l9-7v14Z" fill="#213542"/><path d="M901 388h22" class="position-tick"/></g>
    ${text(750, 257, 'T-SQUARE', 'tool-label')}
    ${text(750, 273, '90° INDEXED', 'tool-micro')}
    <path d="M781 280v45h35" class="leader-line"/>
  </g>

  <!-- COMPASS: one rigid body about the fixed local needle origin (0,0). -->
  <g id="compass-tool" transform="translate(440 405) rotate(0)">
    <g id="compass-shadow" opacity="0.16" transform="translate(7 9)">
      <path d="M0 0L100-173.205M100-173.205L200 0" class="compass-shadow-line"/>
      <circle cx="100" cy="-173.205" r="15" fill="#1d2529"/>
    </g>
    <g id="needle-leg">
      <path d="M0 0L89.94-169.78 102.06-162.78Z" fill="url(#brass)" stroke="#463a28" stroke-width="1.5"/>
      <path d="M5-8.66L93-161.1" stroke="#f3d58c" stroke-width="2" opacity="0.72"/>
      <path d="M0 0L9-15.59" stroke="#1a2a34" stroke-width="3.2"/>
      <path d="M-2 2L1-9 4-1Z" fill="#25323a"/>
      <g transform="translate(25 -43.3) rotate(-60)"><rect x="-9" y="-5" width="18" height="10" rx="4" fill="url(#brass-vertical)" stroke="#4a3b26"/><path d="M-4-3v6M0-3v6M4-3v6" stroke="#715026" stroke-width="0.8"/></g>
    </g>
    <g id="compass-swing">
      <g id="pencil-leg">
        <path d="M200 0L97.94-162.78 110.06-169.78Z" fill="url(#brass)" stroke="#463a28" stroke-width="1.5"/>
        <path d="M195-8.66L108-159.37" stroke="#f4d788" stroke-width="2" opacity="0.75"/>
        <g id="pencil-holder" transform="rotate(-120)">
          <path d="M0 0L13-5.5 13 5.5Z" fill="#e7bd6a" stroke="#30383a" stroke-width="0.8"/>
          <path d="M0 0L6-2.5 6 2.5Z" fill="#142630"/>
          <rect x="12" y="-5.5" width="46" height="11" rx="3" fill="url(#navy-enamel)" stroke="#142530" stroke-width="1.1"/>
          <path d="M20-3H51" stroke="#879395" stroke-width="1.2"/>
          <rect x="11" y="-6.5" width="8" height="13" rx="2" fill="url(#brass-vertical)" stroke="#4f3e27"/>
          <path d="M54-4v8" stroke="#d3b169" stroke-width="3.5"/>
        </g>
      </g>
      <g id="compass-hinge" transform="translate(100 -173.205)">
        <path d="M-3-15V-35Q-3-39 0-39Q3-39 3-35V-15" fill="url(#brass)" stroke="#493c29" stroke-width="1.1"/>
        <ellipse cy="-35" rx="4" ry="2.5" fill="#ecd28e" stroke="#4b3925"/>
        <rect x="-6" y="-5" width="12" height="28" rx="5" fill="url(#brass)" stroke="#4b3927"/>
        <path d="M-3 9h6M-3 14h6M-3 19h6" stroke="#79582b" stroke-width="1"/>
        <circle r="17" fill="url(#hinge-metal)" stroke="#3f3729" stroke-width="1.5"/>
        <circle r="11.5" fill="#263845" stroke="#e1bd6b" stroke-width="1"/>
        <circle r="6.5" fill="url(#brass-vertical)" stroke="#171f24"/>
        <path d="M-4 0h8M0-4v8" stroke="#25333b" stroke-width="1.4"/>
        <circle cy="-1" r="1.2" fill="#f7dfa3"/>
      </g>
      <g id="adjustment-wheel" transform="translate(100 -95.263)">
        <path d="M-48 0H48" stroke="#30383a" stroke-width="3"/>
        <path d="M-45-3v6M-40-3v6M40-3v6M45-3v6" stroke="#b58c46" stroke-width="1"/>
        <ellipse rx="6" ry="12" fill="url(#brass-vertical)" stroke="#4d3d27" stroke-width="1.1"/>
        <path d="M-4-8H4M-5-4H5M-5 0H5M-5 4H5M-4 8H4" stroke="#705126" stroke-width="1"/>
        <circle r="2.3" fill="#283740"/>
      </g>
    </g>
  </g>
  <g id="compass-label">
    ${text(292, 370, 'BOW–COMPASS', 'tool-label')}
    ${text(292, 386, 'FIXED NEEDLE  /  R 200', 'tool-micro')}
    <path d="M402 393l27 8" class="leader-line"/>
  </g>

  <!-- Fixed diagonal trim rule; the utility body slides coaxially along its slot. -->
  <g id="diagonal-trim-rule" transform="translate(880 320) rotate(55)">
    <path d="M-22-5H222V5H-22Z" fill="#d7b96f" fill-opacity="0.16" stroke="#8b743f" stroke-width="0.85"/>
    <path d="M-15 0H214" stroke="#566363" stroke-width="0.65" stroke-dasharray="8 5" opacity="0.6"/>
    ${Array.from({ length: 21 }, (_, i) => `<path d="M${i * 10}-5v${i % 5 === 0 ? 4 : 2}" stroke="#766038" stroke-width="0.7"/>`).join('')}
  </g>

  <!-- UTILITY CUTTER: coaxial shell, positive blade carriage and linked thumb lock. -->
  <g id="cutter-tool" transform="translate(880 320) rotate(55)">
    <g transform="translate(6 7)" opacity="0.2"><rect x="-18" y="-14" width="177" height="28" rx="12" fill="#272b29"/></g>
    <path d="M-18 6V-5Q-18-14-8-14H137Q153-14 159 0Q153 14 137 14H-8Q-18 14-18 6Z" fill="url(#brass)" stroke="#31332c" stroke-width="1.5"/>
    <path d="M-17-6Q-17-12-8-12H112V-1H-17Z" fill="#263844" stroke="#17262e" stroke-width="0.9"/>
    <rect x="-4" y="-9" width="121" height="17" rx="3" fill="#283740" stroke="#d4b169" stroke-width="1.2"/>
    <g id="blade-carriage">
      <g id="segmented-blade">
        <path d="M4-8H111L159 0 111 8H4Z" fill="url(#steel)" stroke="#3d494c" stroke-width="0.8"/>
        ${Array.from({ length: 8 }, (_, i) => `<path d="M${20 + i * 17}-8L${7 + i * 17} 8" stroke="#596568" stroke-width="0.9"/><path d="M${22 + i * 17}-7L${10 + i * 17} 6" stroke="#f5f2e7" stroke-width="0.6"/>`).join('')}
        <path d="M145-3L157 0 145 3" fill="none" stroke="#faf9ee" stroke-width="1.1"/>
      </g>
    </g>
    <path d="M-11 8H138" stroke="#f4d791" stroke-width="1.6" opacity="0.7"/>
    <path d="M-9-12H104" stroke="#f7dfa1" stroke-width="1" opacity="0.85"/>
    <path d="M128-12Q153-13 159 0Q153 13 128 12Q140 0 128-12Z" fill="url(#navy-enamel)" stroke="#1a2930"/>
    <path d="M141-9Q153-5 153 0" fill="none" stroke="#52626a" stroke-width="1.2"/>
    <g id="thumb-lock" transform="translate(116 -12)">
      <rect x="-11" y="-7" width="22" height="12" rx="3" fill="#2a393e" stroke="#111f27"/>
      <path d="M-7-4H7M-7-1H7M-7 2H7" stroke="#b2aba0" stroke-width="1"/>
      <circle cy="8" r="3" fill="url(#brass-vertical)" stroke="#493c2b"/>
    </g>
    <g id="blade-grip"><rect x="61" y="3" width="34" height="9" rx="3" fill="#25343a"/>
      ${[64, 68, 72, 76, 80, 84, 88, 92].map(x => `<path d="M${x} 4v7" stroke="#9c8d70" stroke-width="1"/>`).join('')}
    </g>
    ${text(38, 7, '07', 'cutter-mark', 'text-anchor="middle"')}
  </g>
  <g id="cutter-caption">
    ${text(850, 588, 'UTILITY CUTTER', 'tool-label')}
    ${text(850, 601, 'SEGMENTED / LOCKED', 'tool-micro')}
  </g>
  <path id="cutter-guide" d="M971.20 450.24L994.15 483.00" class="cutter-guide"/>
  ${text(962, 430, 'TRIM VECTOR', 'construction-label', 'text-anchor="end"')}

  <!-- Live phase annotation belongs to the shared scene state, not its own clock. -->
  <g id="phase-badge">
    <rect x="282" y="536" width="232" height="29" rx="3" class="phase-badge-bg"/>
    <circle id="phase-dot" cx="296" cy="550.5" r="3"/>
    ${text(307, 554, '01  /  SCRIBE CONSTRUCTION', 'phase-label', 'id="phase-label"')}
  </g>

  <!-- INSPECTOR: three static wireframe studies with a coordinated active state. -->
  <g id="inspector-rail">
    <rect x="1084" y="55" width="181" height="154" rx="3" class="inspector-card active" id="pivot-card"/>
    ${text(1097, 74, '01 / PIVOT AXIS', 'inspector-kicker')}
    <g class="wire-diagram" transform="translate(1174 126)">
      <path d="M0-52L-39 29H39ZM0-52V42M-39 29L0 42 39 29" class="diamond-frame"/>
      <path d="M0-42L-26-9 0 8 26-9ZM0-42V8M-26 21L0 34 26 21" class="diamond-solid"/>
      <path d="M-45 27A46 46 0 0 1-38-30M45 27A46 46 0 0 0 38-30" class="diagram-arc"/>
      <path d="M-45 27l-1-8 7 3M45 27l1-8-7 3" class="diagram-brass"/>
      <path d="M0-58V51M-48 29H48" class="diagram-axis"/>
      <circle r="4" class="diagram-node"/>
      <g class="overlay-sensitive" visibility="hidden"><path d="M-30-9H30M0-35V31" class="diagram-active"/><circle r="9" class="diagram-cross"/></g>
    </g>
    <foreignObject x="1094" y="181" width="164" height="22">
      <button id="pivot-toggle" class="inspector-toggle" type="button" aria-pressed="false" aria-label="Show coordinated pivot-axis overlay"><span class="toggle-glyph">⌖</span><span id="pivot-toggle-text">PIVOT AXIS · OFF</span></button>
    </foreignObject>
    <rect x="1084" y="216" width="181" height="135" rx="3" class="inspector-card"/>
    ${text(1097, 235, '02 / ANGLE', 'inspector-kicker')}
    <g transform="translate(1113 318)">
      <path d="M0 0H116M0 0L82-58" class="angle-ray"/>
      <path d="M39 0A39 39 0 0 0 27-28" class="angle-arc"/>
      <path d="M37-5l4 5-6 1M24-24l3-4 3 5" class="diagram-brass"/>
      <circle r="5" class="angle-node"/>
      <path d="M49-4h10M54-9v10" class="diagram-axis"/>
      ${text(62, -16, 'θ', 'diagram-greek')}
      ${text(72, 25, 'INCLUDED ANGLE', 'diagram-caption')}
    </g>
    <rect x="1084" y="358" width="181" height="115" rx="3" class="inspector-card"/>
    ${text(1097, 377, '03 / PIVOT–AXIS', 'inspector-kicker')}
    <g transform="translate(1174 412)">
      <path d="M0 0L-47 37M0 0V45M0 0L48 37" class="angle-ray"/>
      <path d="M-42 32A39 39 0 0 0-10 27M10 27A39 39 0 0 0 43 32" class="diagram-arc"/>
      <path d="M-43 32l3-7 4 6M-7 20l-3 7 7-1M7 20l3 7-7-1M44 32l-3-7-4 6" class="diagram-brass"/>
      <circle r="8" class="pivot-ring"/><circle r="3.5" class="diagram-node"/>
      <path d="M-52 47H53M0-9V52" class="diagram-axis"/>
      ${text(0, 57, 'COHERENT PIVOT', 'diagram-caption', 'text-anchor="middle"')}
    </g>
    <path d="M1091 480H1257" class="inspector-separator"/>
    ${text(1097, 499, 'STROKE-SPEED', 'inspector-kicker')}
    ${text(1252, 499, '60', 'speed-readout', 'id="speed-readout" text-anchor="end"')}
    <foreignObject x="1096" y="506" width="158" height="25">
      <input id="speed-slider" type="range" min="0" max="100" step="1" value="60" aria-label="stroke-speed" />
    </foreignObject>
    ${text(1097, 541, '0', 'range-min')}${text(1252, 541, '100', 'range-min', 'text-anchor="end"')}
    ${text(1097, 561, 'LOOP-PHASE', 'inspector-kicker')}
    ${text(1252, 561, '0.00 s', 'phase-readout', 'id="phase-readout" text-anchor="end"')}
    <foreignObject x="1096" y="566" width="158" height="27">
      <input id="scrub" type="range" min="0" max="6" step="0.001" value="0" aria-label="loop-phase" />
    </foreignObject>
    <g id="transport-controls">
      <foreignObject x="1093" y="598" width="50" height="19"><button id="play" type="button" class="transport-btn" aria-label="Play demonstration">PLAY</button></foreignObject>
      <foreignObject x="1147" y="598" width="50" height="19"><button id="pause" type="button" class="transport-btn" aria-label="Pause demonstration">PAUSE</button></foreignObject>
      <foreignObject x="1201" y="598" width="54" height="19"><button id="reset-btn" type="button" class="transport-btn" aria-label="Reset demonstration">RESET</button></foreignObject>
    </g>
  </g>

  <!-- TELEMETRY: five independent instruments, all derived from renderAt(t). -->
  <g id="telemetry-strip">
    <rect x="0" y="617" width="1280" height="103" class="telemetry-shell"/>
    <rect x="0" y="617" width="107" height="103" class="telemetry-intro"/>
    ${text(53.5, 644, 'LIVE', 'intro-title', 'text-anchor="middle"')}
    ${text(53.5, 661, 'TELEMETRY', 'intro-title', 'text-anchor="middle"')}
    ${text(53.5, 678, 'STRIP', 'intro-title', 'text-anchor="middle"')}
    <path d="M42 693h23M53.5 682v23" class="intro-cross"/>
    ${cards.map((c, i) => telemetryStatic(i, 107 + i * 225, c[0], c[1])).join('')}
    <path d="M1232 617V720" class="telemetry-edge"/>
    <g transform="translate(1250 652)"><circle r="15" class="loop-ring"/><path d="M-6 1l5 5 9-12" class="loop-check"/></g>
    ${text(1250, 687, 'SYNC', 'sync-label', 'text-anchor="middle"')}
    ${text(1250, 702, 'LOCK', 'sync-label', 'text-anchor="middle"')}
  </g>

  <!-- Overlays are independent of tool geometry and transform only visibility. -->
  <g id="pivot-overlay" opacity="0" pointer-events="none">
    <g class="overlay-lines">
      <path d="M440 405L540 231.795" id="overlay-needle-axis"/>
      <path id="overlay-pencil-axis" d="M440 405L640 405"/>
      <circle id="overlay-hinge-ring" cx="540" cy="231.795" r="24"/>
      <path id="overlay-hinge-cross" d="M516 231.795H564M540 207.795V255.795"/>
      <path d="M427 405H453M440 392V418"/>
      <circle cx="440" cy="405" r="11"/>
      <path d="M440 405L640 405" id="construction-radius"/>
      <path d="M851 199H703" id="tsquare-guide-vector"/>
      <path d="M711 193l-8 6 8 6" id="tsquare-guide-arrow"/>
      <path d="M870 305L1011 503" id="cutter-blade-axis"/>
    </g>
    <g class="overlay-labels">
      ${text(459, 391, 'N / FIXED NEEDLE', 'axis-label')}
      ${text(550, 226, 'H / HINGE', 'axis-label', 'id="overlay-hinge-label"')}
      ${text(559, 381, 'R 200', 'axis-label', 'id="overlay-radius-label"')}
      ${text(762, 217, 'X / GUIDE', 'axis-label', 'id="overlay-guide-label"')}
      ${text(981, 397, 'B / BLADE', 'axis-label', 'id="overlay-blade-label"')}
    </g>
  </g>`;
}
