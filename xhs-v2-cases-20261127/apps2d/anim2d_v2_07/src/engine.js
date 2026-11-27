/**
 * Multipart, orthographic SVG engine. All transforms are derived from normalized
 * cycle time by render(); this module owns no timers and stores no integration.
 */

export const ENGINE = Object.freeze({
  centerX: 420,
  crankY: 472,
  crankRadius: 54,
  rodLength: 176,
  tdcWristY: 242,
  duration: 8,
});

export const STROKES = ['intake', 'compression', 'power', 'exhaust'];
const TAU = Math.PI * 2;
const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
const mod = (v, n) => ((v % n) + n) % n;
const fixed = v => Number(v.toFixed(4));

export function normalizeTime(seconds) {
  const n = Number(seconds);
  return mod(Number.isFinite(n) ? n : 0, ENGINE.duration);
}

export function strokeAt(time) {
  return STROKES[Math.min(3, Math.floor(normalizeTime(time) / 2))];
}

/** Exact slider-crank solution: theta zero is top dead centre. */
export function mechanismAt(seconds) {
  const time = normalizeTime(seconds);
  const angle = time / ENGINE.duration * 720;
  const theta = angle * Math.PI / 180;
  const s = Math.sin(theta);
  const c = Math.cos(theta);
  const { centerX: x, crankY: cy, crankRadius: r, rodLength: l, tdcWristY } = ENGINE;
  const wristY = cy - (r * c + Math.sqrt(l * l - r * r * s * s));
  const journalX = x + r * s;
  const journalY = cy - r * c;
  const pistonTravel = clamp((wristY - tdcWristY) / (2 * r));
  const rodAngle = -Math.atan2(journalX - x, journalY - wristY) * 180 / Math.PI;
  const liftProfile = start => {
    const u = (time - start) / 2;
    return u > 0 && u < 1 ? Math.pow(Math.sin(Math.PI * u), 1.18) : 0;
  };
  return {
    time,
    angle,
    theta,
    wristY,
    journalX,
    journalY,
    pistonTravel,
    rodAngle,
    pistonOffset: wristY - tdcWristY,
    intakeLift: 22 * liftProfile(0),
    exhaustLift: 20 * liftProfile(6),
    camAngle: angle / 2,
    activeStroke: STROKES[Math.min(3, Math.floor(time / 2))],
  };
}

function engineMarkup() {
  return `
  <svg id="stage" viewBox="0 0 840 620" xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="engine-title engine-desc" preserveAspectRatio="xMidYMid meet">
    <title id="engine-title">Animated DOHC engine cutaway</title>
    <desc id="engine-desc">A ringed piston and articulated connecting rod drive a counterweighted crankshaft. Two half-speed overhead camshafts actuate sprung intake and exhaust valves, with a synchronized timing belt.</desc>
    <defs>
      <linearGradient id="cast-metal" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#b0b7a5"/><stop offset=".38" stop-color="#8d9a8d"/><stop offset=".72" stop-color="#68796f"/><stop offset="1" stop-color="#465a55"/>
      </linearGradient>
      <linearGradient id="edge-metal" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#52665f"/><stop offset=".22" stop-color="#c2c4ae"/><stop offset=".5" stop-color="#87978a"/><stop offset=".78" stop-color="#b3b8a2"/><stop offset="1" stop-color="#52635d"/>
      </linearGradient>
      <linearGradient id="piston-metal" x1="0" y1="0" x2="1" y2=".2">
        <stop offset="0" stop-color="#758880"/><stop offset=".18" stop-color="#c4c6b3"/><stop offset=".45" stop-color="#aeb6a5"/><stop offset=".74" stop-color="#8b9d92"/><stop offset="1" stop-color="#586f6b"/>
      </linearGradient>
      <linearGradient id="rod-metal" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#354b4c"/><stop offset=".2" stop-color="#71877c"/><stop offset=".48" stop-color="#bdbca4"/><stop offset=".72" stop-color="#72847a"/><stop offset="1" stop-color="#34494a"/>
      </linearGradient>
      <radialGradient id="crank-metal" cx="35%" cy="26%" r="78%">
        <stop offset="0" stop-color="#b6bba6"/><stop offset=".48" stop-color="#8f9a86"/><stop offset="1" stop-color="#52675f"/>
      </radialGradient>
      <linearGradient id="intake-metal" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#456f86"/><stop offset=".5" stop-color="#7facc0"/><stop offset="1" stop-color="#3f6c7d"/>
      </linearGradient>
      <linearGradient id="exhaust-metal" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#926a43"/><stop offset=".5" stop-color="#d7a46b"/><stop offset="1" stop-color="#7e573e"/>
      </linearGradient>
      <linearGradient id="chamber-gas" x1="0" y1="0" x2="1" y2=".7">
        <stop id="gas-stop-a" offset="0" stop-color="#417f9f"/>
        <stop id="gas-stop-b" offset=".48" stop-color="#6d92a4"/>
        <stop id="gas-stop-c" offset="1" stop-color="#447291"/>
      </linearGradient>
      <radialGradient id="gas-sheen-gradient" cx="50%" cy="44%" r="58%">
        <stop offset="0" stop-color="#fff4cf" stop-opacity=".7"/><stop offset=".35" stop-color="#f5b45f" stop-opacity=".18"/><stop offset="1" stop-color="#d2e3e7" stop-opacity="0"/>
      </radialGradient>
      <radialGradient id="spark-gradient">
        <stop offset="0" stop-color="#ffffff" stop-opacity="1"/><stop offset=".2" stop-color="#fff4b3" stop-opacity=".95"/><stop offset=".55" stop-color="#f7a449" stop-opacity=".4"/><stop offset="1" stop-color="#f08739" stop-opacity="0"/>
      </radialGradient>
      <filter id="engine-shadow" x="-40%" y="-40%" width="180%" height="180%">
        <feGaussianBlur stdDeviation="8"/>
      </filter>
      <filter id="spark-blur" x="-120%" y="-120%" width="340%" height="340%">
        <feGaussianBlur stdDeviation="3"/>
      </filter>
    </defs>

    <!-- Technical construction lines remain still and subordinate to the mechanism. -->
    <g fill="none" stroke="#86a7ad" opacity=".16" stroke-width=".65">
      <path d="M198 70H626 M198 551H626"/>
      <path d="M286 40V566 M555 40V566"/>
      <path d="M272 472H581" stroke-dasharray="2 5"/>
      <path d="M420 42V563" stroke-dasharray="9 5 1 5"/>
      <circle cx="420" cy="472" r="91" stroke-dasharray="2 7"/>
      <circle cx="420" cy="472" r="54" stroke-dasharray="3 5"/>
      <path d="M411 472H429 M420 463V481"/>
    </g>
    <text x="509" y="559" class="engine-label-small">CRANK AXIS</text>
    <text x="304" y="180" class="engine-label-small" transform="rotate(-90 304 180)">Ø 86.0 MM</text>

    <!-- Grounded shadow and separate water-jacket / crankcase castings. -->
    <ellipse cx="423" cy="542" rx="126" ry="15" fill="#0a1219" opacity=".5" filter="url(#engine-shadow)"/>
    <path d="M322 327H518V355C546 382 557 411 557 454V498Q557 548 511 553H329Q283 548 283 498V454C283 411 294 382 322 355Z" fill="url(#cast-metal)" stroke="#c1c3ae" stroke-width="1.8"/>
    <path d="M337 351H503C525 376 537 406 537 449V496Q537 529 505 533H335Q303 529 303 496V449C303 406 315 376 337 351Z" fill="#131e26" stroke="#52685f" stroke-width="2"/>
    <path d="M327 550H513 M292 510H307 M533 510H548" fill="none" stroke="#253d3e" stroke-width="4"/>
    <path d="M317 369C296 405 293 449 299 493 M523 369C544 405 547 449 541 493" fill="none" stroke="#c5c3aa" stroke-opacity=".38" stroke-width="2"/>

    <!-- Right-side synchronous belt and its three independently rotating pulleys. -->
    <g id="timing-drive">
      <path d="M543 67Q558 56 570 71L579 469Q580 489 558 495Q535 493 535 472L541 140Q526 126 538 112Q526 94 539 79Q527 72 543 67Z" fill="none" stroke="#10191f" stroke-width="12" stroke-linejoin="round"/>
      <path id="timing-belt" d="M543 67Q558 56 570 71L579 469Q580 489 558 495Q535 493 535 472L541 140Q526 126 538 112Q526 94 539 79Q527 72 543 67Z" fill="none" stroke="#9aab99" stroke-width="2.2" stroke-dasharray="2.5 3.5" stroke-linejoin="round"/>
      <path d="M516 85H545 M514 112L541 120 M521 472H538" stroke="#8b9c90" stroke-width="11"/>
      <path d="M516 85H545 M514 112L541 120 M521 472H538" stroke="#c0c2ad" stroke-opacity=".55" stroke-width="1.3"/>
      <g id="intake-pulley" transform="translate(555 84)">
        <circle r="16" fill="#24352f" stroke="#c0c1aa" stroke-width="2"/>
        <circle r="11" fill="#61776b" stroke="#1b2b2c" stroke-width="1.5"/>
        <path d="M-10 0H10M0-10V10" stroke="#bcc0aa" stroke-width="2"/><circle r="3.3" fill="#c9c5ac"/>
      </g>
      <g id="exhaust-pulley" transform="translate(555 122)">
        <circle r="16" fill="#24352f" stroke="#c0c1aa" stroke-width="2"/>
        <circle r="11" fill="#61776b" stroke="#1b2b2c" stroke-width="1.5"/>
        <path d="M-10 0H10M0-10V10" stroke="#bcc0aa" stroke-width="2"/><circle r="3.3" fill="#c9c5ac"/>
      </g>
      <g id="crank-pulley" transform="translate(555 472)">
        <circle r="22" fill="#26372f" stroke="#c3c2aa" stroke-width="2"/>
        <circle r="16" fill="#708176" stroke="#263b38" stroke-width="1.5"/>
        <path d="M-14 0H14M0-14V14" stroke="#bcc0aa" stroke-width="3"/><circle r="5" fill="#c9c5ac"/>
      </g>
      <text x="586" y="270" class="engine-label-small" transform="rotate(90 586 270)">TIMING DRIVE · 2 : 1</text>
    </g>

    <!-- Bore is a separate dark sleeve, never merged with the piston silhouette. -->
    <rect x="334" y="157" width="172" height="223" rx="4" fill="url(#edge-metal)" stroke="#bcc2ad" stroke-width="1.5"/>
    <rect x="344" y="170" width="152" height="206" rx="2" fill="#101b25" stroke="#415961" stroke-width="1.5"/>
    <g stroke="#68828a" stroke-width=".45" opacity=".3">
      <path d="M347 189L493 225 M347 206L493 242 M347 223L493 259 M347 240L493 276 M347 257L493 293 M347 274L493 310 M347 291L493 327 M347 308L493 344 M347 325L493 361"/>
      <path d="M347 225L493 189 M347 242L493 206 M347 259L493 223 M347 276L493 240 M347 293L493 257 M347 310L493 274 M347 327L493 291 M347 344L493 308 M347 361L493 325"/>
    </g>
    <path d="M318 157H344V376H318Q309 359 309 338V181Q309 166 318 157Z M496 157H522Q531 166 531 181V338Q531 359 522 376H496Z" fill="url(#cast-metal)" stroke="#bcc1ac" stroke-width="1.5"/>
    <path d="M324 185V346M516 185V346" fill="none" stroke="#243c40" stroke-width="10" stroke-linecap="round"/>
    <path d="M324 185V346M516 185V346" fill="none" stroke="#92a496" stroke-opacity=".52" stroke-width="2" stroke-linecap="round"/>
    <path d="M340 169V376 M500 169V376" stroke="#c7c8b1" stroke-width="2"/>
    <path d="M332 377H508" stroke="#a9b49f" stroke-width="2"/>

    <!-- Intake and exhaust port castings: two independent gas paths. -->
    <path d="M278 137C310 137 330 141 351 154L370 171L350 190C330 172 312 164 278 164Z" fill="url(#cast-metal)" stroke="#b9bfac" stroke-width="1.5"/>
    <path id="intake-port" d="M278 145C311 145 329 148 348 160L358 171L350 179C330 164 313 156 278 156Z" fill="url(#intake-metal)" stroke="#8fb7c6" stroke-width=".8"/>
    <path d="M562 137C530 137 510 141 489 154L470 171L490 190C510 172 528 164 562 164Z" fill="url(#cast-metal)" stroke="#b9bfac" stroke-width="1.5"/>
    <path id="exhaust-port" d="M562 145C529 145 511 148 492 160L482 171L490 179C510 164 527 156 562 156Z" fill="url(#exhaust-metal)" stroke="#d1a472" stroke-width=".8"/>
    <g id="intake-flow" fill="none" stroke="#a1d6ed" stroke-linecap="round">
      <path id="intake-stream" d="M283 150C320 149 335 155 353 170C367 182 374 192 389 201" stroke-width="2.3" stroke-dasharray="5 8"/>
      <path d="M297 146L302 150L296 153 M328 153L334 158L327 160 M360 175L365 182L357 182" stroke-width="1.1"/>
    </g>
    <g id="exhaust-flow" fill="none" stroke="#ffd096" stroke-linecap="round">
      <path id="exhaust-stream" d="M451 202C467 190 474 181 487 169C504 154 520 149 557 150" stroke-width="2.3" stroke-dasharray="5 8"/>
      <path d="M464 183L471 182L470 189 M500 158L507 159L503 165 M538 146L544 150L538 154" stroke-width="1.1"/>
    </g>
    <path d="M279 133V169 M561 133V169" stroke="#b7bfad" stroke-width="3"/>
    <path d="M273 137V164 M567 137V164" stroke="#60746e" stroke-width="2"/>
    <text x="276" y="128" class="engine-label-small" style="fill:#8cb4c5">IN</text>
    <text x="550" y="128" class="engine-label-small" style="fill:#c6a37d">EX</text>

    <!-- Dynamic chamber volume, bounded below by the instantaneous piston crown. -->
    <path id="combustion-gas" d="M354 175Q357 153 381 151L394 177Q420 168 446 177L459 151Q483 153 486 175V196Q420 185 354 196Z" fill="url(#chamber-gas)" opacity=".95"/>
    <path id="gas-sheen" d="M354 175Q357 153 381 151L394 177Q420 168 446 177L459 151Q483 153 486 175V196Q420 185 354 196Z" fill="url(#gas-sheen-gradient)" opacity=".42"/>
    <path d="M354 176Q357 153 381 151L394 177Q420 168 446 177L459 151Q483 153 486 176" fill="none" stroke="#d4ccb0" stroke-width="1.5"/>
    <g id="gas-eddies" fill="none" stroke="#d0e0d8" stroke-width=".85" opacity=".38">
      <path id="eddy-left" d="M373 187C354 181 355 204 376 204C388 204 388 190 379 190"/>
      <path id="eddy-right" d="M467 187C486 181 485 204 464 204C452 204 452 190 461 190"/>
    </g>

    <!-- Rigid crank web + opposing counterweights rotate as one rigid group. -->
    <g id="crankshaft" transform="translate(420 472) rotate(0)">
      <path d="M-29-64Q0-80 29-64L35-27C39-5 53 13 62 37C73 67 47 91 17 85L0 77L-17 85C-47 91-73 67-62 37C-53 13-39-5-35-27Z" fill="#2f4847" stroke="#172d32" stroke-width="5"/>
      <path d="M-25-61Q0-70 25-61L28-26C31-3 47 19 52 39C59 61 38 78 15 72L0 63L-15 72C-38 78-59 61-52 39C-47 19-31-3-28-26Z" fill="url(#crank-metal)" stroke="#b2b7a2" stroke-width="1.5"/>
      <path d="M-15-46Q0-52 15-46L18-19Q17 4 30 24" fill="none" stroke="#d1cbb0" stroke-opacity=".55" stroke-width="2"/>
      <path d="M-45 41Q-34 62-15 59L0 48L15 59Q34 62 45 41" fill="none" stroke="#425e57" stroke-width="2"/>
      <circle cy="-54" r="25" fill="#566f66" stroke="#b5bba5" stroke-width="2"/>
      <circle cy="-54" r="18" fill="#a1ab96" stroke="#334e4b" stroke-width="2"/>
      <path d="M-11-54H11M0-65V-43" stroke="#6c8277" stroke-width="1"/>
      <circle cy="-54" r="5" fill="#d6ceb0" stroke="#586c60"/>
    </g>

    <!-- The rod is a local rigid body rotated about its true crank journal. -->
    <g id="connecting-rod" transform="translate(420 242) rotate(0)">
      <path d="M-14 9Q-18 17-11 31L-8 132Q-20 141-22 155V169Q-21 178-13 181H13Q21 178 22 169V155Q20 141 8 132L11 31Q18 17 14 9Z" fill="url(#rod-metal)" stroke="#263f40" stroke-width="2"/>
      <path d="M-5 30L-3 132H3L5 30Z" fill="#bac0aa" opacity=".54"/>
      <path d="M-9 31L-6 129M9 31L6 129" fill="none" stroke="#233c3e" stroke-width="1.5"/>
      <circle cy="176" r="23" fill="url(#rod-metal)" stroke="#233b3d" stroke-width="2"/>
      <circle cy="176" r="16.5" fill="#263c3e" stroke="#c3c1a7" stroke-width="2"/>
      <circle cy="176" r="12.5" fill="#859788" stroke="#182f35" stroke-width="1.5"/>
      <path d="M-22 163H22 M-20 168H20" stroke="#233c3e" stroke-width="1.5"/>
      <circle cx="-13" cy="170" r="2.5" fill="#d1c8aa"/><circle cx="13" cy="170" r="2.5" fill="#d1c8aa"/>
      <circle r="18" fill="url(#rod-metal)" stroke="#2e4747" stroke-width="2"/>
      <circle r="11.5" fill="#30484a" stroke="#b6bba5" stroke-width="1.5"/>
    </g>

    <!-- Ring pack, skirt, oil ring and wrist pin all share piston translation. -->
    <g id="piston" transform="translate(0 0)">
      <path d="M350 201Q350 192 360 191H480Q490 192 490 201V278L484 297Q477 305 463 306H377Q363 305 356 297L350 278Z" fill="#20373d" stroke="#152b32" stroke-width="5"/>
      <path d="M354 201Q354 196 361 195H479Q486 196 486 201V278L480 294Q474 300 461 300H379Q366 300 360 294L354 278Z" fill="url(#piston-metal)" stroke="#c4c5af" stroke-width="1.2"/>
      <path d="M355 195Q420 186 485 195L484 202H356Z" fill="#bcc4b0" stroke="#d7d2b9" stroke-width="1"/>
      <path d="M353 210H487 M353 217H487 M354 226H486" stroke="#273f44" stroke-width="4"/>
      <path d="M355 208H485 M355 215H485 M356 224H484" stroke="#d0cbb2" stroke-opacity=".75" stroke-width="1.1"/>
      <path d="M357 235H483" stroke="#3e5855" stroke-width="7"/>
      <path d="M358 233H482" stroke="#c0c1a9" stroke-width="1" stroke-dasharray="3 3"/>
      <path d="M363 251Q420 244 477 251V278Q468 290 456 290H384Q372 290 363 278Z" fill="#647d75" opacity=".4"/>
      <path d="M359 280Q370 271 382 277M481 280Q470 271 458 277" fill="none" stroke="#c2c1aa" stroke-width="1.4"/>
      <circle cx="420" cy="242" r="20" fill="#354e50" stroke="#c5c4ac" stroke-width="2"/>
      <circle cx="420" cy="242" r="14" fill="#90a194" stroke="#1e383f" stroke-width="2"/>
      <circle cx="420" cy="242" r="8" fill="#162b36" stroke="#c8c3a9" stroke-width="1.2"/>
      <path d="M410 231L430 253" stroke="#d2cbb0" stroke-opacity=".35" stroke-width="2"/>
      <path d="M374 302V291M466 302V291" stroke="#354f4d" stroke-width="2"/>
    </g>

    <!-- Static stationary centre bearing makes the running clearances legible. -->
    <g id="main-bearing">
      <circle cx="420" cy="472" r="31" fill="#20393d" stroke="#a7b29f" stroke-width="2.2"/>
      <circle cx="420" cy="472" r="24" fill="url(#edge-metal)" stroke="#243c3e" stroke-width="2"/>
      <circle cx="420" cy="472" r="16" fill="#7b9081" stroke="#c7c4aa" stroke-width="1.2"/>
      <circle cx="420" cy="472" r="8" fill="#b7b9a2" stroke="#3c5551" stroke-width="1.5"/>
      <path d="M420 449V456M420 488V495M397 472H404M436 472H443" stroke="#d0c9ad" stroke-width="1.2"/>
      <circle cx="420" cy="472" r="3" fill="#eee0b8"/>
    </g>

    <!-- Cylinder head casting with separated cam carrier and valve guides. -->
    <path d="M321 101H519Q530 105 530 119V140L512 154H498L481 143H458L444 159H396L382 143H359L342 154H328L310 140V119Q310 105 321 101Z" fill="url(#cast-metal)" fill-opacity=".72" stroke="#b7bfab" stroke-width="1.5"/>
    <path d="M319 100V77Q319 60 337 58H503Q521 60 521 77V100" fill="#4c625c" fill-opacity=".7" stroke="#abb7a4" stroke-width="1.5"/>
    <path d="M330 66H510 M316 103H524" stroke="#d0ccb1" stroke-opacity=".55" stroke-width="1.3"/>
    <path d="M337 96H385M455 96H503" stroke="#72897c" stroke-width="10"/>
    <path d="M337 95H385M455 95H503" stroke="#bcc2ab" stroke-width="1"/>
    <path d="M362 84H548 M480 88L548 119" fill="none" stroke="#243a3c" stroke-width="14"/>
    <path d="M362 82H548 M480 86L548 117" fill="none" stroke="url(#edge-metal)" stroke-width="9"/>
    <path d="M362 79H548 M480 83L548 114" fill="none" stroke="#c6c5ac" stroke-opacity=".55" stroke-width="1.2"/>
    <g fill="url(#edge-metal)" stroke="#354d49" stroke-width="1">
      <path d="M331 73H345V96H331Z M389 73H405V96H389Z M439 73H455V96H439Z M491 73H507V96H491Z"/>
      <path d="M535 72H547V96H535Z M530 110L546 105L552 127L536 132Z"/>
    </g>

    <!-- Each spring is its own coil; each poppet valve translates on its inclined guide. -->
    <g id="intake-valve-assembly" transform="translate(365 95) rotate(-12)">
      <rect x="-8" y="27" width="16" height="49" rx="4" fill="#324a49" stroke="#afbaa5" stroke-width="1"/>
      <path id="intake-spring" d="" fill="none" stroke="#b9c2ab" stroke-width="2.4" stroke-linejoin="round"/>
      <path d="M-15 9H15V15H-15Z" fill="url(#edge-metal)" stroke="#c1c4aa"/>
      <g id="intake-valve">
        <path d="M0 7V82" stroke="#263f43" stroke-width="7"/>
        <path d="M-1 7V82" stroke="#c5c5ad" stroke-width="3"/>
        <path d="M-14 6H14V12H-14Z" fill="url(#edge-metal)" stroke="#c7c6ae"/>
        <path d="M-20 80Q0 75 20 80L18 87Q0 93-18 87Z" fill="url(#edge-metal)" stroke="#d1cbb0" stroke-width="1"/>
        <path d="M-17 82Q0 79 17 82" fill="none" stroke="#9ec3ce" stroke-width="2"/>
      </g>
    </g>
    <g id="exhaust-valve-assembly" transform="translate(475 95) rotate(12)">
      <rect x="-8" y="27" width="16" height="49" rx="4" fill="#324a49" stroke="#afbaa5" stroke-width="1"/>
      <path id="exhaust-spring" d="" fill="none" stroke="#b9c2ab" stroke-width="2.4" stroke-linejoin="round"/>
      <path d="M-15 9H15V15H-15Z" fill="url(#edge-metal)" stroke="#c1c4aa"/>
      <g id="exhaust-valve">
        <path d="M0 7V82" stroke="#263f43" stroke-width="7"/>
        <path d="M-1 7V82" stroke="#c5c5ad" stroke-width="3"/>
        <path d="M-14 6H14V12H-14Z" fill="url(#edge-metal)" stroke="#c7c6ae"/>
        <path d="M-20 80Q0 75 20 80L18 87Q0 93-18 87Z" fill="url(#edge-metal)" stroke="#d1cbb0" stroke-width="1"/>
        <path d="M-17 82Q0 79 17 82" fill="none" stroke="#d2ad7e" stroke-width="2"/>
      </g>
    </g>

    <!-- Distinct cam lobes on separate shafts; both turn at exactly half crank speed. -->
    <g id="intake-cam" transform="translate(365 84) rotate(-90)">
      <path d="M0-23C14-23 23-9 21 5C20 18 8 28 0 35C-8 28-20 18-21 5C-23-9-14-23 0-23Z" fill="url(#edge-metal)" stroke="#263f40" stroke-width="1.7"/>
      <path d="M0-18C11-18 16-6 15 4C14 12 8 17 4 20" fill="none" stroke="#d0ccb0" stroke-opacity=".6" stroke-width="1.2"/>
      <circle r="11" fill="#748a7b" stroke="#c7c4ab" stroke-width="1.4"/>
      <circle r="4" fill="#263e42" stroke="#bdbba3"/>
      <path d="M0-10V-5" stroke="#e2d6b4" stroke-width="2"/>
    </g>
    <g id="exhaust-cam" transform="translate(475 84) rotate(45)">
      <path d="M0-24C11-24 19-12 23 0C26 13 13 27 0 37C-5 27-18 18-20 6C-23-8-13-23 0-24Z" fill="url(#edge-metal)" stroke="#263f40" stroke-width="1.7"/>
      <path d="M0-18C9-18 14-10 16-2C18 7 12 14 7 19" fill="none" stroke="#d0ccb0" stroke-opacity=".6" stroke-width="1.2"/>
      <circle r="11" fill="#748a7b" stroke="#c7c4ab" stroke-width="1.4"/>
      <circle r="4" fill="#263e42" stroke="#bdbba3"/>
      <path d="M0-10V-5" stroke="#e2d6b4" stroke-width="2"/>
    </g>

    <!-- Central multi-part spark plug, electrodes, and synchronized ignition flash. -->
    <g id="spark-plug">
      <path d="M410 112H430L427 152L423 174H417L413 152Z" fill="#d7d5bd" stroke="#273e41" stroke-width="1.4"/>
      <path d="M409 121H431 M409 126H431 M410 131H430" stroke="#74877e" stroke-width="2"/>
      <path d="M407 140H433V151H407Z" fill="url(#edge-metal)" stroke="#bec2aa"/>
      <path d="M407 141L413 136H427L433 141L427 149H413Z" fill="none" stroke="#304748" stroke-width="1"/>
      <path d="M414 152H426M415 156H425M416 160H424M416 164H424" stroke="#354d4b" stroke-width="2"/>
      <path d="M420 171V180H427" fill="none" stroke="#e0d4af" stroke-width="2"/>
      <path d="M411 112V102H429V112" fill="url(#edge-metal)" stroke="#bec2aa"/>
      <path d="M417 102V94H423V102" stroke="#d8ccb0" stroke-width="4"/>
    </g>
    <g id="spark-flash" transform="translate(421 180)" opacity="0" pointer-events="none">
      <circle r="31" fill="url(#spark-gradient)" filter="url(#spark-blur)"/>
      <circle r="8" fill="#fff8d8"/>
      <path d="M-32 0H32M0-30V30M-21-20L21 20M-21 20L21-20" stroke="#ffe9a3" stroke-width="1.5"/>
      <path d="M-4-10L3-3L-3 2L5 8" fill="none" stroke="#fff" stroke-width="2.2"/>
    </g>

    <!-- Reference leader-line annotations. -->
    <g id="annotations" aria-label="Engine component labels">
      <path class="leader" d="M39 88H222L337 84"/><circle class="leader-dot" cx="337" cy="84" r="2.8"/>
      <text x="39" y="78" class="engine-label">Dual Overhead Camshafts</text>

      <path class="leader" d="M54 183H177L280 174L349 174L382 178"/><circle class="leader-dot" cx="382" cy="178" r="2.8"/>
      <text x="54" y="173" class="engine-label">Exhaust Valve</text>

      <path class="leader" d="M488 200H574L589 207H794"/><circle class="leader-dot" cx="488" cy="200" r="2.8"/>
      <text x="597" y="197" class="engine-label">Combustion Chamber</text>

      <path class="leader" d="M45 332H223L278 323H351"/><circle class="leader-dot" cx="351" cy="323" r="2.8"/>
      <text x="45" y="322" class="engine-label">Piston &amp; Connecting Rod</text>

      <path class="leader" d="M38 485H227L276 476H333"/><circle class="leader-dot" cx="333" cy="476" r="2.8"/>
      <text x="38" y="475" class="engine-label">Counterweighted Crankshaft</text>
    </g>

    <g opacity=".72">
      <path d="M248 238H263V403H248M253 238V403" fill="none" stroke="#718d92" stroke-width=".7"/>
      <path d="M247 238L252 234L257 238M247 403L252 407L257 403" fill="none" stroke="#a2b2ad" stroke-width=".7"/>
      <text x="232" y="327" class="engine-label-small" transform="rotate(-90 232 327)">108 MM STROKE</text>
    </g>
  </svg>`;
}

function springPath(lift, maxLift) {
  const top = 17;
  const height = 48 - (lift / maxLift) * 12;
  const turns = 8;
  let d = `M-12 ${fixed(top)}H-10`;
  for (let i = 0; i < turns; i += 1) {
    const y1 = top + height * (i + 0.25) / turns;
    const y2 = top + height * (i + 0.75) / turns;
    d += `L${i % 2 === 0 ? 12 : -12} ${fixed(y1)}L${i % 2 === 0 ? 12 : -12} ${fixed(y2)}`;
  }
  d += `M-12 ${fixed(top)}H12M-12 ${fixed(top + height)}H12`;
  return d;
}

const hexToRgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
const colorMix = (a, b, t) => {
  const aa = hexToRgb(a); const bb = hexToRgb(b);
  return `rgb(${aa.map((v, i) => Math.round(v + (bb[i] - v) * t)).join(',')})`;
};

// Continuous colour keys also close exactly at the 720-degree seam.
const GAS_KEYS = [
  [0, ['#397fa5', '#79afc0', '#366c91']],
  [1, ['#3e85a9', '#76a4b7', '#3d708e']],
  [2, ['#477f99', '#869a9f', '#3f7188']],
  [3.72, ['#758b98', '#c99769', '#a77a56']],
  [4.08, ['#e5a250', '#ffcc7b', '#c87536']],
  [5, ['#d77938', '#f3b45f', '#a95131']],
  [6, ['#b9764a', '#d89e62', '#896249']],
  [7, ['#6c7f87', '#ae9677', '#657888']],
  [8, ['#397fa5', '#79afc0', '#366c91']],
];

function gasColors(time) {
  for (let i = 0; i < GAS_KEYS.length - 1; i += 1) {
    const [ta, a] = GAS_KEYS[i];
    const [tb, b] = GAS_KEYS[i + 1];
    if (time >= ta && time <= tb) {
      const t = (time - ta) / (tb - ta);
      return a.map((c, j) => colorMix(c, b[j], t));
    }
  }
  return GAS_KEYS[0][1];
}

export class EngineScene {
  constructor(mount) {
    mount.innerHTML = engineMarkup();
    this.svg = mount.querySelector('#stage');
    this.el = {};
    const ids = [
      'piston', 'connecting-rod', 'crankshaft', 'intake-cam', 'exhaust-cam',
      'intake-valve', 'exhaust-valve', 'intake-spring', 'exhaust-spring',
      'intake-pulley', 'exhaust-pulley', 'crank-pulley', 'timing-belt',
      'combustion-gas', 'gas-sheen', 'gas-stop-a', 'gas-stop-b', 'gas-stop-c',
      'intake-flow', 'exhaust-flow', 'intake-stream', 'exhaust-stream',
      'spark-flash', 'gas-eddies', 'eddy-left', 'eddy-right',
    ];
    ids.forEach(id => { this.el[id] = this.svg.querySelector(`#${id}`); });
  }

  /** Pure seek renderer. Isolation affects emphasis, never mechanical time. */
  render(time, rpm = 17000, sparkAdvance = 12, isolatedStroke = null) {
    const m = mechanismAt(time);
    const e = this.el;
    const set = (id, attr, value) => e[id].setAttribute(attr, String(value));
    set('piston', 'transform', `translate(0 ${fixed(m.pistonOffset)})`);
    set('connecting-rod', 'transform', `translate(${ENGINE.centerX} ${fixed(m.wristY)}) rotate(${fixed(m.rodAngle)})`);
    set('crankshaft', 'transform', `translate(${ENGINE.centerX} ${ENGINE.crankY}) rotate(${fixed(m.angle)})`);
    set('intake-cam', 'transform', `translate(365 84) rotate(${fixed(m.camAngle - 90)})`);
    set('exhaust-cam', 'transform', `translate(475 84) rotate(${fixed(m.camAngle - 315)})`);
    set('intake-valve', 'transform', `translate(0 ${fixed(m.intakeLift)})`);
    set('exhaust-valve', 'transform', `translate(0 ${fixed(m.exhaustLift)})`);
    set('intake-spring', 'd', springPath(m.intakeLift, 22));
    set('exhaust-spring', 'd', springPath(m.exhaustLift, 20));
    set('intake-pulley', 'transform', `translate(555 84) rotate(${fixed(m.camAngle)})`);
    set('exhaust-pulley', 'transform', `translate(555 122) rotate(${fixed(m.camAngle)})`);
    set('crank-pulley', 'transform', `translate(555 472) rotate(${fixed(m.angle)})`);
    set('timing-belt', 'stroke-dashoffset', fixed(-m.angle / 2));

    const pistonTop = 192 + m.pistonOffset;
    const chamberPath = `M354 175Q357 153 381 151L394 177Q420 168 446 177L459 151Q483 153 486 175V${fixed(pistonTop + 4)}Q420 ${fixed(pistonTop - 7)} 354 ${fixed(pistonTop + 4)}Z`;
    set('combustion-gas', 'd', chamberPath);
    set('gas-sheen', 'd', chamberPath);

    // During compression/power the static eddies are moved with the available volume,
    // maintaining a clear gap above the crown even at firing TDC.
    const eddyScale = clamp((pistonTop - 176) / 80, 0.13, 1);
    set('gas-eddies', 'transform', `translate(0 176) scale(1 ${fixed(eddyScale)}) translate(0 -176)`);
    set('gas-eddies', 'opacity', fixed(0.16 + 0.24 * (1 - m.pistonTravel)));

    const colors = gasColors(m.time);
    set('gas-stop-a', 'stop-color', colors[0]);
    set('gas-stop-b', 'stop-color', colors[1]);
    set('gas-stop-c', 'stop-color', colors[2]);
    const rpmN = clamp((rpm - 600) / 16400);
    set('gas-sheen', 'opacity', fixed(0.13 + rpmN * 0.52 + (m.activeStroke === 'power' ? 0.12 : 0)));
    set('combustion-gas', 'opacity', fixed(0.82 + rpmN * 0.15));

    const isolation = isolatedStroke || null;
    const intakeRelevant = m.activeStroke === 'intake' || m.activeStroke === 'compression';
    const exhaustRelevant = m.activeStroke === 'exhaust' || m.activeStroke === 'power';
    let intakeOpacity = 0.13 + 0.8 * (m.intakeLift / 22);
    let exhaustOpacity = 0.13 + 0.8 * (m.exhaustLift / 20);
    if (!isolation) {
      intakeOpacity = intakeRelevant ? Math.max(0.23, intakeOpacity) : 0.1;
      exhaustOpacity = exhaustRelevant ? Math.max(0.23, exhaustOpacity) : 0.1;
    } else if (isolation === 'intake') {
      intakeOpacity = 0.95; exhaustOpacity = 0.08;
    } else if (isolation === 'exhaust') {
      exhaustOpacity = 0.95; intakeOpacity = 0.08;
    } else if (isolation === 'power') {
      exhaustOpacity = 0.5; intakeOpacity = 0.08;
    } else {
      intakeOpacity = 0.44; exhaustOpacity = 0.08;
    }
    set('intake-flow', 'opacity', fixed(intakeOpacity));
    set('exhaust-flow', 'opacity', fixed(exhaustOpacity));
    set('intake-stream', 'stroke-dashoffset', fixed(-m.time * 34));
    set('exhaust-stream', 'stroke-dashoffset', fixed(-m.time * 34));

    // Ignition is at compression TDC (360°), shifted by the signed BTDC control.
    const ignitionAngle = mod(360 - sparkAdvance, 720);
    const angleDelta = mod(m.angle - ignitionAngle + 360, 720) - 360;
    const flash = clamp(1 - Math.abs(angleDelta) / 8);
    set('spark-flash', 'opacity', fixed(flash));
    set('spark-flash', 'transform', `translate(421 180) scale(${fixed(0.72 + flash * 0.42)})`);

    return { ...m, sparkFlash: flash };
  }
}
