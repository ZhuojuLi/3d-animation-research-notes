/**
 * state.js — Central Horology Lab State Store, Exact Mechanical Geometry Constants,
 * and Kinematic Telemetry Serializer.
 */

export const WORLD_WIDTH = 1000;
export const WORLD_HEIGHT = 610;
export const LOOP_DURATION = 16.0;
export const NOMINAL_FREQ_HZ = 4.0;
export const TOURBILLON_PERIOD_S = 60.0;

export const DEFAULT_PARAMS = Object.freeze({
  stiffness: 1.0,
  torque: 0.85,
  timeScale: 0.25,
  cutawayOpacity: 85,
});

/**
 * Exact Horological Mechanical Geometry in 1000x610 World Coordinates.
 *
 * Key geometric invariants:
 * - Balance outer rim radius = 112.0 -> Barrel outer radius = 1.45 * 112.0 = 162.4.
 * - Coaxial Flying Tourbillon Cage outer radius = 1.15 * 112.0 = 128.8 (within 1.12..1.18x),
 *   with slender blued-steel pillars at R = 124.5 leaving a crisp ~10-12.5 world-px gap to balance rim.
 * - Exact pitch-circle tangency for every gear mesh in the going train:
 *   Barrel(80T) <-> Center Pinion(12L)    : dist = R_bar_p * (1 + 12/80) = 158.4 * 1.15      = 182.160
 *   Center(75T) <-> Third Pinion(10L)     : dist = R_cen_p * (1 + 10/75) = 88.0  * 1.133333  =  99.733
 *   Third(70T)  <-> Fourth Pinion(8L)     : dist = R_thi_p * (1 + 8/70)  = 101.0 * 1.114286  = 112.543
 *   Fourth(60T) <-> Escape Pinion(8L)     : dist = R_fou_p * (1 + 8/60)  = 92.0  * 1.133333  = 104.267
 *   (Fourth 60T : Escape Pinion 8L === 15:2 exact ratio; Escape Wheel itself has 15 club teeth!)
 * - All 4 upstream train wheels (Barrel, Center, Third, Fourth) have maxX <= 541,
 *   cleanly outside the Act 2 macro escapement zoom frustum [546..962].
 */
function buildLayoutGeometry() {
  const plate = { x: 494, y: 342, radius: 444 };
  const balance = {
    x: 734,
    y: 342,
    rimOuterRadius: 112.0,
    rimInnerRadius: 96.5,
    wellRadius: 164.0,
    cageOuterRadius: 128.8, // 1.15 * 112.0 (strictly inside 1.12..1.18x)
    cagePillarRadius: 124.5, // ~12.5 world-px radial gap from rimOuterRadius
    cageInnerRingRadius: 121.0,
    guideSlotRadius: 147.5, // visible curved guide slot inside recessed navy well
    guideSlotHalfWidth: 4.5,
    hairspringTurns: 11, // >= 10 turns required
    hairspringInnerR: 25.0,
    hairspringOuterR: 84.5,
  };

  // 1. Barrel (80T): outer radius 162.4 = 1.45 * 112.0
  const barrelPitchR = 158.4;
  const barrelOuterR = 162.4;
  const barrelRootR = 153.2;
  const barrel = {
    x: 248.0,
    y: 342.0,
    teeth: 80,
    pinion: null,
    pitchR: barrelPitchR,
    outerR: barrelOuterR,
    rootR: barrelRootR,
  };

  // 2. Center Wheel (75T wheel, 12L pinion meshing with Barrel 80T)
  const centerPinionPitchR = barrelPitchR * (12 / 80); // 23.76
  const distBarCen = barrelPitchR + centerPinionPitchR; // 182.16
  const angBarCen = Math.atan2(454 - barrel.y, 404 - barrel.x);
  const centerPitchR = 88.0;
  const center = {
    x: barrel.x + distBarCen * Math.cos(angBarCen),
    y: barrel.y + distBarCen * Math.sin(angBarCen),
    teeth: 75,
    pinion: 12,
    pitchR: centerPitchR,
    outerR: centerPitchR + 3.0,
    rootR: centerPitchR - 3.6,
    pinionPitchR: centerPinionPitchR,
    pinionOuterR: centerPinionPitchR + 3.2,
    pinionRootR: centerPinionPitchR - 3.8,
  };

  // 3. Third Wheel (70T wheel, 10L pinion meshing with Center 75T)
  const thirdPinionPitchR = centerPitchR * (10 / 75); // 11.733
  const distCenThi = centerPitchR + thirdPinionPitchR; // 99.733
  const angCenThi = Math.atan2(354 - center.y, 439 - center.x);
  const thirdPitchR = 100.5;
  const third = {
    x: center.x + distCenThi * Math.cos(angCenThi),
    y: center.y + distCenThi * Math.sin(angCenThi),
    teeth: 70,
    pinion: 10,
    pitchR: thirdPitchR,
    outerR: thirdPitchR + 3.2,
    rootR: thirdPitchR - 3.8,
    pinionPitchR: thirdPinionPitchR,
    pinionOuterR: thirdPinionPitchR + 2.4,
    pinionRootR: thirdPinionPitchR - 2.6,
  };

  // 4. Fourth / Seconds Wheel (60T wheel, 8L pinion meshing with Third 70T)
  const fourthPinionPitchR = thirdPitchR * (8 / 70); // 11.486
  const distThiFou = thirdPitchR + fourthPinionPitchR; // 111.986
  const angThiFou = Math.atan2(244 - third.y, 428 - third.x);
  const fourthPitchR = 92.0;
  const fourth = {
    x: third.x + distThiFou * Math.cos(angThiFou),
    y: third.y + distThiFou * Math.sin(angThiFou),
    teeth: 60,
    pinion: 8,
    pitchR: fourthPitchR,
    outerR: fourthPitchR + 3.1,
    rootR: fourthPitchR - 3.6,
    pinionPitchR: fourthPinionPitchR,
    pinionOuterR: fourthPinionPitchR + 2.2,
    pinionRootR: fourthPinionPitchR - 2.4,
  };

  // 5. Escape Wheel (15 club teeth, 8L pinion meshing with Fourth 60T -> exact 60:8 = 15:2 ratio!)
  const escapePinionPitchR = fourthPitchR * (8 / 60); // 12.267
  const distFouEsc = fourthPitchR + escapePinionPitchR; // 104.267
  const angFouEsc = Math.atan2(214 - fourth.y, 550 - fourth.x);
  const escape = {
    x: fourth.x + distFouEsc * Math.cos(angFouEsc),
    y: fourth.y + distFouEsc * Math.sin(angFouEsc),
    teeth: 15,
    pinion: 8,
    driverTeeth: 60,
    pitchR: 72.0,
    outerR: 79.0,
    rootR: 57.0,
    pinionPitchR: escapePinionPitchR,
    pinionOuterR: escapePinionPitchR + 2.2,
    pinionRootR: escapePinionPitchR - 2.4,
  };

  // 6. Swiss Lever Pallet Fork Pivot (upper-right, matching reference-0.jpg)
  // Positioned cleanly on the cream mainplate above the recessed navy well (well top = 342 - 164 = 178)
  // so the visible banking slot (y=158) and fork horn (y=168) sit cleanly above the well rim!
  const pallet = {
    x: 724.0,
    y: 120.0,
    maxBankDeg: 8.8,
    maxBankRad: (8.8 * Math.PI) / 180,
    bankingRadius: 38.0,
    forkHornRadius: 48.0,
  };

  // Exact contact anchor geometry between Pallet Pivot and Escape Wheel
  const dxPE = escape.x - pallet.x;
  const dyPE = escape.y - pallet.y;
  const distPE = Math.hypot(dxPE, dyPE);
  const angPE = Math.atan2(dyPE, dxPE); // angle from pallet pivot to escape center

  // Entry stone (upper-right escape tooth rim) and Exit stone (lower-right escape tooth rim)
  // Computed in Pallet Fork local frame when fork angle === 0 so stones kiss escape tooth circle R=75.5!
  const escToothR = 75.5;
  const entryTargetX = escape.x + escToothR * 0.84;
  const entryTargetY = escape.y - escToothR * 0.54;
  const exitTargetX = escape.x + escToothR * 0.64;
  const exitTargetY = escape.y + escToothR * 0.77;
  const entryAngleWorld = Math.atan2(entryTargetY - pallet.y, entryTargetX - pallet.x);
  const exitAngleWorld = Math.atan2(exitTargetY - pallet.y, exitTargetX - pallet.x);

  pallet.entryLocalDist = Math.hypot(entryTargetX - pallet.x, entryTargetY - pallet.y);
  pallet.entryLocalAngle = entryAngleWorld;
  pallet.exitLocalDist = Math.hypot(exitTargetX - pallet.x, exitTargetY - pallet.y);
  pallet.exitLocalAngle = exitAngleWorld;

  // Fork stem pointing toward Balance center (734, 342)
  const angPB = Math.atan2(balance.y - pallet.y, balance.x - pallet.x);
  pallet.stemAngle = angPB;
  pallet.distToEscape = distPE;
  pallet.angleToEscape = angPE;

  // Decorative reference-0.jpg mainplate screws & accent jewel
  const screws = [
    { x: 185, y: 58, r: 14, angle: 0.72 },
    { x: 750, y: 58, r: 14, angle: 0.72 },
    { x: 696, y: 538, r: 17, angle: -0.42 },
  ];
  const accentJewel = { x: 604, y: 484, r: 19 };

  // Compute exact gear mesh contact points (pitch circle tangency points)
  const meshContacts = {
    barrelCenter: {
      x: barrel.x + (barrel.pitchR / distBarCen) * (center.x - barrel.x),
      y: barrel.y + (barrel.pitchR / distBarCen) * (center.y - barrel.y),
      expectedDist: distBarCen,
      actualDist: Math.hypot(center.x - barrel.x, center.y - barrel.y),
    },
    centerThird: {
      x: center.x + (center.pitchR / distCenThi) * (third.x - center.x),
      y: center.y + (center.pitchR / distCenThi) * (third.y - center.y),
      expectedDist: distCenThi,
      actualDist: Math.hypot(third.x - center.x, third.y - center.y),
    },
    thirdFourth: {
      x: third.x + (third.pitchR / distThiFou) * (fourth.x - third.x),
      y: third.y + (third.pitchR / distThiFou) * (fourth.y - third.y),
      expectedDist: distThiFou,
      actualDist: Math.hypot(fourth.x - third.x, fourth.y - third.y),
    },
    fourthEscape: {
      x: fourth.x + (fourth.pitchR / distFouEsc) * (escape.x - fourth.x),
      y: fourth.y + (fourth.pitchR / distFouEsc) * (escape.y - fourth.y),
      expectedDist: distFouEsc,
      actualDist: Math.hypot(escape.x - fourth.x, escape.y - fourth.y),
    },
  };

  return Object.freeze({
    plate,
    barrel,
    center,
    third,
    fourth,
    escape,
    pallet,
    balance,
    screws,
    accentJewel,
    meshContacts,
    joints: Object.freeze({
      barrelAxis: { id: 'barrelAxis', label: 'Barrel Axis', x: barrel.x, y: barrel.y },
      centerAxis: { id: 'centerAxis', label: 'Center Wheel Axis', x: center.x, y: center.y },
      thirdAxis: { id: 'thirdAxis', label: 'Third Wheel Axis', x: third.x, y: third.y },
      fourthAxis: { id: 'fourthAxis', label: 'Fourth / Seconds Axis', x: fourth.x, y: fourth.y },
      escapeAxis: { id: 'escapeAxis', label: 'Escape Wheel Axis', x: escape.x, y: escape.y },
      palletPivot: { id: 'palletPivot', label: 'Pallet Fork Pivot', x: pallet.x, y: pallet.y },
      balanceAxis: { id: 'balanceAxis', label: 'Balance Wheel Axis', x: balance.x, y: balance.y },
      tourbillonCagePivot: { id: 'tourbillonCagePivot', label: 'Tourbillon Cage Pivot', x: balance.x, y: balance.y },
    }),
  });
}

export const LAYOUT = buildLayoutGeometry();

export const TRAIN_RATIOS = Object.freeze({
  barrelToCenter: { label: 'Barrel 80:12', driverTeeth: 80, drivenPinion: 12, exactRatio: -80 / 12 },
  centerToThird: { label: 'Center 75:10', driverTeeth: 75, drivenPinion: 10, exactRatio: -75 / 10 },
  thirdToFourth: { label: 'Third 70:8', driverTeeth: 70, drivenPinion: 8, exactRatio: -70 / 8 },
  fourthToEscape: { label: 'Escape 15:2', driverTeeth: 15, drivenPinion: 2, exactRatio: -15 / 2 },
});

export class LabStateStore {
  constructor() {
    this.params = { ...DEFAULT_PARAMS };
    this.time = 0.0;
    this.isPlaying = false;
    this.mode = 'deterministic'; // 'deterministic' | 'interactive'
    this.isDraggingBalance = false;
    this.dragStartAngle = 0;
    this.lastFrame = null;
    this.lastCamera = null;
    this.lastAct = null;
    this.listeners = new Set();
  }

  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  emit(event, payload) {
    for (const fn of this.listeners) {
      fn(event, payload);
    }
  }

  setParam(key, value) {
    if (!(key in this.params)) return;
    const num = Number(value);
    if (!Number.isFinite(num)) return;
    this.params[key] = num;
    this.emit('param', { key, value: num });
  }

  reset() {
    this.params = { ...DEFAULT_PARAMS };
    this.time = 0.0;
    this.isPlaying = false;
    this.mode = 'deterministic';
    this.isDraggingBalance = false;
    this.emit('reset', null);
  }
}

/**
 * Formats the public kinematic telemetry payload exposed via window.__getKinematicState().
 */
export function buildKinematicTelemetry(frame, actInfo, camera, params, mode) {
  const n = frame.nodes;
  const rBC = n.centerWheel.omega / n.barrel.omega;
  const rCT = n.thirdWheel.omega / n.centerWheel.omega;
  const rTF = n.fourthWheel.omega / n.thirdWheel.omega;
  const rFE = n.escapeWheel.omega / n.fourthWheel.omega;

  const scale = camera ? camera.getTotalScale() : 1.0;
  const closurePx = {};
  let maxClosurePx = 0;
  for (const [k, worldErr] of Object.entries(frame.closureErrorsWorld)) {
    const px = Number((worldErr * scale).toFixed(5));
    closurePx[k] = px;
    if (px > maxClosurePx) maxClosurePx = px;
  }

  const nodeSummary = {};
  for (const [id, node] of Object.entries(n)) {
    nodeSummary[id] = {
      angleRad: Number(node.angle.toFixed(6)),
      angleDeg: Number(((node.angle * 180) / Math.PI).toFixed(4)),
      omegaRadS: Number(node.omega.toFixed(6)),
      teeth: node.teeth ?? null,
      pinion: node.pinion ?? null,
    };
  }

  const jointList = Object.values(LAYOUT.joints).map(j => {
    const scr = camera ? camera.worldToScreen(j.x, j.y) : { x: j.x, y: j.y };
    return {
      id: j.id,
      label: j.label,
      worldX: Number(j.x.toFixed(3)),
      worldY: Number(j.y.toFixed(3)),
      screenX: Number(scr.x.toFixed(2)),
      screenY: Number(scr.y.toFixed(2)),
    };
  });

  return {
    t: Number(frame.t.toFixed(5)),
    physicalTimeS: Number(frame.physTime.toFixed(5)),
    mode,
    act: actInfo ? actInfo.act : 1,
    actLabel: actInfo ? actInfo.label : 'ACT I',
    nodeCount: Object.keys(nodeSummary).length,
    jointCount: jointList.length,
    nodes: nodeSummary,
    joints: jointList,
    toothRatios: {
      barrelToCenter: {
        nominal: -80 / 12,
        measured: Number(rBC.toFixed(6)),
        error: Number(Math.abs(rBC - (-80 / 12)).toFixed(9)),
      },
      centerToThird: {
        nominal: -75 / 10,
        measured: Number(rCT.toFixed(6)),
        error: Number(Math.abs(rCT - (-75 / 10)).toFixed(9)),
      },
      thirdToFourth: {
        nominal: -70 / 8,
        measured: Number(rTF.toFixed(6)),
        error: Number(Math.abs(rTF - (-70 / 8)).toFixed(9)),
      },
      fourthToEscape: {
        nominal: -15 / 2,
        measured: Number(rFE.toFixed(6)),
        error: Number(Math.abs(rFE - (-15 / 2)).toFixed(9)),
      },
    },
    jointClosureErrorsPx: closurePx,
    maxJointClosureErrorPx: Number(maxClosurePx.toFixed(5)),
    escapementState: frame.escapementState,
    escapementSide: frame.escapementSide,
    frequencyHz: Number(frame.frequencyHz.toFixed(4)),
    halfBeatMs: Number(frame.halfBeatMs.toFixed(3)),
    amplitudeDeg: Number(frame.amplitudeDeg.toFixed(2)),
    steadyAmplitudeDeg: Number(frame.steadyAmplitudeDeg.toFixed(2)),
    impulseTorqueNmm: Number(frame.impulseTorqueNmm.toFixed(4)),
    beatErrorMs: Number(frame.beatErrorMs.toFixed(3)),
    tourbillonPeriodS: TOURBILLON_PERIOD_S,
    tourbillonCageRadiusRatio: Number((LAYOUT.balance.cageOuterRadius / LAYOUT.balance.rimOuterRadius).toFixed(4)),
    barrelToBalanceRadiusRatio: Number((LAYOUT.barrel.outerR / LAYOUT.balance.rimOuterRadius).toFixed(4)),
    hairspringTurns: LAYOUT.balance.hairspringTurns,
    params: { ...params },
  };
}
