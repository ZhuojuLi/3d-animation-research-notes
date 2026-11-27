/**
 * Pure deterministic 4-stroke DOHC kinematic & thermodynamic cycle model.
 * One complete 720° Otto cycle is normalized to 8.0 seconds:
 *   t = 0.0 .. 2.0s  (0° .. 180°)   : Intake      (t=0 TDC -> t=2 BDC, mid t=1)
 *   t = 2.0 .. 4.0s  (180° .. 360°) : Compression (t=2 BDC -> t=4 Firing TDC, mid t=3)
 *   t = 4.0 .. 6.0s  (360° .. 540°) : Power       (t=4 Firing TDC -> t=6 BDC, mid t=5)
 *   t = 6.0 .. 8.0s  (540° .. 720°) : Exhaust     (t=6 BDC -> t=8/0 TDC, mid t=7)
 */

export const CYCLE_DURATION = 8.0;
export const DEFAULT_RPM = 17000;
export const DEFAULT_SPARK_ADVANCE = 12;

export const STROKE_JUMP_TIMES = {
  intake: 1.0,
  compression: 3.0,
  power: 5.0,
  exhaust: 7.0,
};

export const ENGINE_GEOM = {
  cx: 400,
  cyCrank: 434,
  crankRadius: 42,
  rodLength: 128,
  boreRadius: 54,
  pistonCrownOffset: 28,
  pistonSkirtOffset: 24,
  maxValveLiftPx: 9.5,
  maxValveLiftMm: 10.8,
  valveTiltDeg: 17,
  cyCam: 104,
  cxIntakeCam: 342,
  cxExhaustCam: 458,
  camBaseRadius: 14.5,
  camPeakLift: 9.5,
};

export function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

export function smoothstep(edge0, edge1, x) {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

/**
 * Wraps arbitrary time t (seconds) periodically onto [0, 8.0).
 * Ensures t = 0 and t = 8 map to exact 0.000000 for seamless periodic loops.
 */
export function normalizeCycleTime(rawT) {
  const num = Number.isFinite(Number(rawT)) ? Number(rawT) : 0;
  let wrapped = ((num % CYCLE_DURATION) + CYCLE_DURATION) % CYCLE_DURATION;
  if (Math.abs(wrapped - CYCLE_DURATION) < 1e-9 || Math.abs(wrapped) < 1e-9) {
    wrapped = 0;
  }
  return wrapped;
}

/**
 * Determines active stroke name from crank angle [0, 720).
 */
export function strokeFromAngle(crankAngle) {
  if (crankAngle < 180) return 'intake';
  if (crankAngle < 360) return 'compression';
  if (crankAngle < 540) return 'power';
  return 'exhaust';
}

/**
 * Slider-crank kinematics at crank angle (degrees [0, 720)).
 */
export function computeKinematics(crankAngle) {
  const { cx, cyCrank, crankRadius: R, rodLength: L, pistonCrownOffset } = ENGINE_GEOM;
  const rad = (crankAngle * Math.PI) / 180;

  const journalX = cx + R * Math.sin(rad);
  const journalY = cyCrank - R * Math.cos(rad);
  const dx = journalX - cx;
  const wristY = journalY - Math.sqrt(Math.max(1, L * L - dx * dx));
  const crownY = wristY - pistonCrownOffset;

  const tdcWristY = cyCrank - R - L;
  const bdcWristY = cyCrank + R - L;
  const pistonNorm = clamp((wristY - tdcWristY) / (bdcWristY - tdcWristY), 0, 1);

  // SVG rotation angle for rod anchored at (cx, wristY) pointing +y of length L toward (journalX, journalY)
  const rodSvgRotateDeg = (-Math.atan2(journalX - cx, journalY - wristY) * 180) / Math.PI;

  // Camshafts run at exact 0.5x crank speed (0..360° per 720° cycle)
  const camAngleDeg = crankAngle * 0.5;

  // Valve lift profiles: C1-smooth raised cosine strictly within intended gas-exchange strokes
  let intakeLiftNorm = 0;
  if (crankAngle > 0 && crankAngle < 180) {
    const u = crankAngle / 180;
    intakeLiftNorm = 0.5 * (1 - Math.cos(2 * Math.PI * u));
  }

  let exhaustLiftNorm = 0;
  if (crankAngle > 540 && crankAngle < 720) {
    const u = (crankAngle - 540) / 180;
    exhaustLiftNorm = 0.5 * (1 - Math.cos(2 * Math.PI * u));
  }

  return {
    crankRad: rad,
    crankRotationDeg: crankAngle % 360,
    camAngleDeg,
    journalX,
    journalY,
    wristX: cx,
    wristY,
    crownY,
    pistonNorm,
    rodSvgRotateDeg,
    intakeLiftNorm,
    exhaustLiftNorm,
    intakeLiftPx: intakeLiftNorm * ENGINE_GEOM.maxValveLiftPx,
    exhaustLiftPx: exhaustLiftNorm * ENGINE_GEOM.maxValveLiftPx,
    intakeLiftMm: Number((intakeLiftNorm * ENGINE_GEOM.maxValveLiftMm).toFixed(3)),
    exhaustLiftMm: Number((exhaustLiftNorm * ENGINE_GEOM.maxValveLiftMm).toFixed(3)),
  };
}

/**
 * Formats crank angle into engineering TDC/ATDC/BDC/BTDC notation (e.g., "24 ATDC").
 */
export function formatCrankAngleTelemetry(crankAngle) {
  const revDeg = ((crankAngle % 360) + 360) % 360;
  const rounded = Math.round(revDeg);
  if (rounded === 0 || rounded === 360) return '0 TDC';
  if (rounded === 180) return '180 BDC';
  if (rounded < 180) return `${rounded} ATDC`;
  return `${360 - rounded} BTDC`;
}

/**
 * Computes periodic cylinder pressure (bar), gas temperature (°C), combustion burn fraction,
 * and spark intensity for a given crankAngle [0, 720), rpm [600..17000], and sparkAdvance [-10..40].
 */
export function computeThermodynamics(crankAngle, rpm, sparkAdvance) {
  const cleanRpm = clamp(Number(rpm) || DEFAULT_RPM, 600, 17000);
  const cleanSpark = clamp(Number(sparkAdvance) ?? DEFAULT_SPARK_ADVANCE, -10, 40);
  const rpmNorm = (cleanRpm - 600) / (17000 - 600);

  // Slider-crank normalized volume V / Vc with compression ratio rc = 11.8
  const { R, L } = { R: ENGINE_GEOM.crankRadius, L: ENGINE_GEOM.rodLength };
  const rad = (crankAngle * Math.PI) / 180;
  const dx = R * Math.sin(rad);
  const wristDisp = R * (1 - Math.cos(rad)) + (L - Math.sqrt(L * L - dx * dx));
  const strokeNorm = clamp(wristDisp / (2 * R), 0, 1);

  const compressionRatio = 11.8;
  const relVolume = 1 + (compressionRatio - 1) * strokeNorm; // 1.0 at TDC, 11.8 at BDC

  // RPM affects volumetric charge density, pumping pressure, and combustion energy
  const pIntake = 0.76 + 0.34 * rpmNorm;
  const pExhaust = 1.14 + 0.42 * rpmNorm;

  // Gas-exchange vs closed-valve blending across IVC (~185°) and EVO (~510°)
  const closedMask = smoothstep(168, 198, crankAngle) * (1 - smoothstep(496, 542, crankAngle));

  // Polytropic compression baseline
  const gamma = 1.32;
  const vAtIvc = 1 + (compressionRatio - 1) * 0.995;
  const pComp = pIntake * Math.pow(vAtIvc / relVolume, gamma);

  // Ignition angle in [320°, 370°]
  const ignitionAngle = 360 - cleanSpark;
  const burnDuration = 40;
  let burnFraction = 0;
  if (crankAngle > ignitionAngle) {
    const uBurn = clamp((crankAngle - ignitionAngle) / burnDuration, 0, 1);
    burnFraction = 1 - Math.exp(-5.2 * Math.pow(uBurn, 2.15));
  }
  // Decay burned-gas pressure boost during exhaust blowdown
  const blowdownKeep = 1 - smoothstep(492, 548, crankAngle);

  // Spark timing phasing factor: optimal torque around ~16° BTDC, slightly lower peak if retarded
  const advanceFactor = 1.0 + 0.24 * ((cleanSpark - 12) / 28);
  const rpmEnergy = 0.56 + 0.56 * Math.pow(rpmNorm, 0.82);

  const pCombustionDelta =
    44.0 * rpmEnergy * advanceFactor * burnFraction * blowdownKeep * Math.pow(1 / relVolume, 1.24);

  const pClosed = pComp + pCombustionDelta;

  // Smooth open-valve baseline transitioning from exhaust backpressure at 720/0° into intake draw and back to exhaust
  const intakeDip = Math.sin(( clamp(crankAngle, 0, 180) / 180 ) * Math.PI);
  const exhaustHump = Math.sin(( clamp(crankAngle - 540, 0, 180) / 180 ) * Math.PI);
  const pBoundary = 0.5 * (pIntake + pExhaust); // exact value at 0° and 720°
  const pOpen =
    pBoundary -
    (pBoundary - pIntake + 0.14) * intakeDip +
    (pExhaust - pBoundary + 0.22) * exhaustHump;

  const pressureBar = closedMask * pClosed + (1 - closedMask) * pOpen;

  // Gas temperature (°C) — smoothly periodic across 0°/720° and responsive to RPM at every angle
  const intakeChargeTempC = 24.5 + 18.8 * rpmNorm;
  const exhaustResidualTempC = 148.0 + 95.0 * rpmNorm;
  const boundaryTempC = 32.0 + 21.5 * rpmNorm;

  let tempOpenC = boundaryTempC;
  if (crankAngle <= 180) {
    const s = Math.sin((crankAngle / 180) * Math.PI);
    tempOpenC = boundaryTempC * (1 - s) + intakeChargeTempC * s;
  } else if (crankAngle >= 540) {
    const s = Math.sin(((crankAngle - 540) / 180) * Math.PI);
    tempOpenC = boundaryTempC * (1 - s) + exhaustResidualTempC * s;
  }

  // Closed-cycle temperature scaled smoothly so mid-Power around 24 ATDC shows warm telemetry
  // and scales deterministically with RPM across the entire cycle
  const tempClosedC =
    intakeChargeTempC +
    (185 + 140 * rpmNorm) * Math.pow((compressionRatio - relVolume) / (compressionRatio - 1), 1.45) +
    (520 + 360 * rpmNorm) * burnFraction * blowdownKeep * Math.pow(1 / relVolume, 0.68);

  const temperatureC = closedMask * tempClosedC + (1 - closedMask) * tempOpenC;

  // Brief spark arc flash centered at ignitionAngle (width ~ ±13°)
  const sparkDist = Math.abs(crankAngle - ignitionAngle);
  const sparkFlash = sparkDist < 14 ? Math.pow(Math.cos((sparkDist / 14) * (Math.PI * 0.5)), 2) : 0;

  // Flame kernel glow following ignition through early power stroke
  const flameDelta = crankAngle - ignitionAngle;
  let flameKernel = 0;
  if (flameDelta >= -4 && flameDelta <= 95) {
    const rise = smoothstep(-4, 10, flameDelta);
    const fall = 1 - smoothstep(18, 95, flameDelta);
    flameKernel = rise * fall * (0.68 + 0.32 * rpmNorm);
  }

  // Chamber color warmth [0 = cool intake blue, 1 = hot combustion/exhaust orange]
  // Carefully periodic: value and slope match at 0° and 720°!
  const warmRise = smoothstep(ignitionAngle - 16, ignitionAngle + 28, crankAngle);
  const exhaustFade = 1 - smoothstep(665, 720, crankAngle);
  const intakeCool = 1 - smoothstep(0, 48, crankAngle);
  // At 0° and 720°: warmMix = 0.24 smoothly transitioning into cool blue (0.0) in Intake
  let chamberWarmth = 0;
  if (crankAngle < 180) {
    chamberWarmth = 0.24 * intakeCool;
  } else if (crankAngle < ignitionAngle - 16) {
    // Slight compression warming
    chamberWarmth = 0.16 * smoothstep(210, 350, crankAngle);
  } else {
    const postIgn = 0.16 + 0.84 * warmRise;
    // Blend from hot power/exhaust back to 0.24 at 720°
    chamberWarmth = 0.24 + (postIgn - 0.24) * exhaustFade;
  }

  return {
    rpm: cleanRpm,
    rpmNorm,
    sparkAdvance: cleanSpark,
    ignitionAngle,
    strokeNorm,
    relVolume,
    pressureBar: Number(pressureBar.toFixed(2)),
    temperatureC: Number(temperatureC.toFixed(1)),
    burnFraction,
    sparkFlash,
    flameKernel,
    chamberWarmth: clamp(chamberWarmth, 0, 1),
  };
}

/**
 * Generates sampled closed P-V Otto-cycle curve points for current RPM & sparkAdvance.
 */
export function buildPvLoopSamples(rpm, sparkAdvance, stepDeg = 3) {
  const samples = [];
  for (let deg = 0; deg <= 720; deg += stepDeg) {
    const wrappedDeg = deg === 720 ? 0 : deg;
    const th = computeThermodynamics(wrappedDeg, rpm, sparkAdvance);
    samples.push({
      deg,
      stroke: strokeFromAngle(wrappedDeg),
      strokeNorm: th.strokeNorm,
      relVolume: th.relVolume,
      pressureBar: th.pressureBar,
    });
  }
  return samples;
}

/**
 * Computes full deterministic workbench state for time t and control settings.
 */
export function evaluateCycleState(rawT, settings) {
  const time = normalizeCycleTime(rawT);
  const crankAngle = (time / CYCLE_DURATION) * 720;
  const activeStroke = strokeFromAngle(crankAngle);
  const kinematics = computeKinematics(crankAngle);
  const thermo = computeThermodynamics(crankAngle, settings.rpm, settings.sparkAdvance);
  const crankAngleText = formatCrankAngleTelemetry(crankAngle);

  return {
    t: Number(time.toFixed(4)),
    time: Number(time.toFixed(4)),
    playing: Boolean(settings.playing),
    rpm: thermo.rpm,
    sparkAdvance: thermo.sparkAdvance,
    isolatedStroke: settings.isolatedStroke || null,
    crankAngle: Number(crankAngle.toFixed(2)),
    crankAngleText,
    pistonPosition: Number(kinematics.pistonNorm.toFixed(4)),
    valveLifts: {
      intake: kinematics.intakeLiftMm,
      exhaust: kinematics.exhaustLiftMm,
    },
    activeStroke,
    pressure: thermo.pressureBar,
    temperature: thermo.temperatureC,
    kinematics,
    thermo,
  };
}
