import * as THREE from 'three';

/**
 * Helper to create a curved grid BufferGeometry for sculpted automotive body flanks
 * with true circular wheel-arch cutouts.
 */
function buildSculptedFlankGeometry({
  xStart,
  xEnd,
  xSteps,
  ySteps,
  sideSign, // +1 for right (+Z), -1 for left (-Z)
  wheelX,   // null if door panel, or axle X for fender/quarter
  wheelY = 0.308,
  archRadius = 0.352,
  yBottomBase = 0.20,
}) {
  // E30 cross-section half-width profile z(y) from rocker (0.20) to shoulder beltline (0.825)
  function zProfile(y, x) {
    // Subtle longitudinal taper at very nose & tail
    let endTaper = 1.0;
    if (x > 1.65) endTaper = 1.0 - 0.045 * Math.pow((x - 1.65) / 0.48, 1.6);
    if (x < -1.65) endTaper = 1.0 - 0.040 * Math.pow((-1.65 - x) / 0.48, 1.6);

    const t = THREE.MathUtils.clamp((y - 0.20) / 0.625, 0, 1);
    // Tucked rocker at bottom -> widest at rub-strip (t≈0.42) -> tucked slightly to crisp shoulder crease (t=1.0)
    let z;
    if (t < 0.42) {
      const u = t / 0.42;
      z = THREE.MathUtils.lerp(0.748, 0.818, Math.sin(u * Math.PI * 0.5));
    } else {
      const u = (t - 0.42) / 0.58;
      // Slight inward curve + crisp outward shoulder crease ridge right near t=0.93
      const crease = Math.exp(-Math.pow((t - 0.93) / 0.045, 2)) * 0.008;
      z = THREE.MathUtils.lerp(0.818, 0.785, u * u) + crease;
    }

    // Subtle stamped wheel-arch flare around front/rear fenders!
    if (wheelX !== null) {
      const dx = x - wheelX;
      const dy = y - wheelY;
      const dist = Math.hypot(dx, dy);
      if (dist >= archRadius - 0.01 && dist < archRadius + 0.115 && y > wheelY - 0.05) {
        const f = 1.0 - (dist - archRadius) / 0.115;
        z += Math.sin(THREE.MathUtils.clamp(f, 0, 1) * Math.PI) * 0.022;
      }
    }
    return z * endTaper;
  }

  // Classic E30 beltline: curves down at nose (x > 1.3) to meet hood edge seamlessly at 0.774!
  function yTopAt(x) {
    if (x > 0.62) {
      const u = THREE.MathUtils.clamp((x - 0.62) / (2.09 - 0.62), 0, 1);
      return THREE.MathUtils.lerp(0.832, 0.774, u);
    }
    const u = THREE.MathUtils.clamp((0.62 - x) / 2.71, 0, 1);
    return THREE.MathUtils.lerp(0.832, 0.856, u);
  }

  function yBotAt(x) {
    let yb = yBottomBase;
    // Slight upward sweep at extreme front valance / rear bumper lower corners
    if (x > 1.82) yb = Math.max(yb, THREE.MathUtils.lerp(0.20, 0.24, (x - 1.82) / 0.30));
    if (x < -1.72) yb = Math.max(yb, THREE.MathUtils.lerp(0.20, 0.28, (-1.72 - x) / 0.40));
    if (wheelX !== null) {
      const dx = x - wheelX;
      if (Math.abs(dx) < archRadius) {
        const archY = wheelY + Math.sqrt(Math.max(0, archRadius * archRadius - dx * dx));
        yb = Math.max(yb, archY);
      }
    }
    return yb;
  }

  const positions = [];
  const uvs = [];
  const indices = [];

  for (let ix = 0; ix <= xSteps; ix++) {
    const fx = ix / xSteps;
    const x = THREE.MathUtils.lerp(xStart, xEnd, fx);
    const yb = yBotAt(x);
    const yt = yTopAt(x);
    for (let iy = 0; iy <= ySteps; iy++) {
      const fy = iy / ySteps;
      const y = THREE.MathUtils.lerp(yb, yt, fy);
      const z = sideSign * zProfile(y, x);
      positions.push(x, y, z);
      uvs.push(fx, fy);
    }
  }

  const stride = ySteps + 1;
  for (let ix = 0; ix < xSteps; ix++) {
    for (let iy = 0; iy < ySteps; iy++) {
      const a = ix * stride + iy;
      const b = (ix + 1) * stride + iy;
      const c = (ix + 1) * stride + (iy + 1);
      const d = ix * stride + (iy + 1);
      if (sideSign > 0) {
        indices.push(a, b, c, a, c, d);
      } else {
        indices.push(a, c, b, a, d, c);
      }
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Builds cambered hood / trunk / roof sheetmetal surface from X-Z grid.
 */
function buildCamberedDeckGeometry({
  xStart, xEnd, xSteps, zSteps,
  halfWidthFn, heightFn, centerRidgeFn = null,
}) {
  const positions = [];
  const uvs = [];
  const indices = [];
  for (let ix = 0; ix <= xSteps; ix++) {
    const u = ix / xSteps;
    const x = THREE.MathUtils.lerp(xStart, xEnd, u);
    const hw = halfWidthFn(x);
    const baseH = heightFn(x);
    for (let iz = 0; iz <= zSteps; iz++) {
      const v = iz / zSteps;
      const zn = (v - 0.5) * 2.0; // -1 .. +1
      const z = zn * hw;
      // Gentle transverse automotive crown + optional hood power-dome lines
      const crown = (1.0 - zn * zn) * 0.022;
      const extra = centerRidgeFn ? centerRidgeFn(x, zn) : 0.0;
      positions.push(x, baseH + crown + extra, z);
      uvs.push(u, v);
    }
  }
  const stride = zSteps + 1;
  for (let ix = 0; ix < xSteps; ix++) {
    for (let iz = 0; iz < zSteps; iz++) {
      const a = ix * stride + iz;
      const b = (ix + 1) * stride + iz;
      const c = (ix + 1) * stride + (iz + 1);
      const d = ix * stride + (iz + 1);
      indices.push(a, c, b, a, d, c);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Creates the complete hero BMW E30 2-Door Coupe with:
 * - Deep Delphin Grey-Blue Metallic clearcoat body & M-Tech valance
 * - Quad Hella round glass headlights, narrow chrome twin-kidney grille, ///M badge, B E 3030 plates
 * - 4x 16" BBS RS basketweave wheels with suspension droop
 * - Hinged right & left doors with full interior cockpit (angled E30 dash, sport seats, M-Tech wheel)
 * - Detailed chassis undercarriage (exhaust, driveshaft, finned diff, subframe, control arms)
 */
export function createBMWE30({ wheelFactory, detailTextures, plateTex }) {
  const root = new THREE.Group();
  // bodyGroup rises with the lift; wheels have controllable suspension droop relative to bodyGroup
  const bodyGroup = new THREE.Group();
  root.add(bodyGroup);

  const {
    headlightTex,
    roundelTex,
    mBadgeTex,
    taillightTex,
    clusterTex,
  } = detailTextures;

  // --- Automotive Materials ---
  // Deep grey-blue metallic clearcoat ("Delphin / Cirrus Grey-Blue Metallic" matching reference-0.png)
  const carPaintMat = new THREE.MeshPhysicalMaterial({
    color: 0x4b5b6e,
    metalness: 0.66,
    roughness: 0.17,
    clearcoat: 1.0,
    clearcoatRoughness: 0.045,
    reflectivity: 0.96,
    envMapIntensity: 1.65,
    side: THREE.DoubleSide,
  });

  const blackTrimMat = new THREE.MeshStandardMaterial({
    color: 0x16181c,
    roughness: 0.52,
    metalness: 0.15,
  });

  const matteGrilleMat = new THREE.MeshStandardMaterial({
    color: 0x111316,
    roughness: 0.62,
    metalness: 0.12,
  });

  const chromeMat = new THREE.MeshPhysicalMaterial({
    color: 0xf0f4fa,
    metalness: 0.98,
    roughness: 0.06,
    clearcoat: 0.4,
    envMapIntensity: 1.6,
  });

  // Automotive lightly-tinted laminated cabin glass (reflective outside, clear view of interior!)
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0xd4e2e6,
    metalness: 0.05,
    roughness: 0.04,
    transmission: 0.0,
    transparent: true,
    opacity: 0.34,
    clearcoat: 1.0,
    clearcoatRoughness: 0.03,
    reflectivity: 0.95,
    envMapIntensity: 1.65,
    side: THREE.DoubleSide,
    depthWrite: false,
  });

  const headlightLensMat = new THREE.MeshPhysicalMaterial({
    map: headlightTex,
    color: 0xf4f7fb,
    metalness: 0.15,
    roughness: 0.08,
    transparent: true,
    opacity: 0.76,
    clearcoat: 1.0,
    clearcoatRoughness: 0.04,
    envMapIntensity: 1.5,
  });

  const amberTurnMat = new THREE.MeshPhysicalMaterial({
    color: 0xd9680e,
    emissive: 0x280d00,
    roughness: 0.16,
    metalness: 0.15,
    clearcoat: 0.9,
    envMapIntensity: 1.2,
  });

  const interiorVinylMat = new THREE.MeshStandardMaterial({
    color: 0x1e2126,
    roughness: 0.68,
    metalness: 0.08,
  });

  const seatFabricMat = new THREE.MeshStandardMaterial({
    color: 0x262a31,
    roughness: 0.78,
    metalness: 0.04,
  });

  const carpetMat = new THREE.MeshStandardMaterial({
    color: 0x17191d,
    roughness: 0.92,
    metalness: 0.02,
  });

  const underbodyMat = new THREE.MeshStandardMaterial({
    color: 0x1c1f23,
    roughness: 0.75,
    metalness: 0.25,
  });

  const exhaustSteelMat = new THREE.MeshStandardMaterial({
    color: 0xaab0b8,
    metalness: 0.85,
    roughness: 0.28,
  });

  const alloyCastMat = new THREE.MeshStandardMaterial({
    color: 0x8e959e,
    metalness: 0.76,
    roughness: 0.38,
  });

  // Axle positions (wheelbase = 2.57m)
  const X_FRONT = 1.31;
  const X_REAR = -1.26;
  const WHEEL_Y = 0.308;

  // ============================================================================
  // 1. BODY SHELL: FRONT FENDERS, REAR QUARTERS, ROCKER SILLS, HOOD, TRUNK, ROOF
  // ============================================================================
  for (const sideSign of [1, -1]) {
    // Front fender (x: +0.602 to +2.09)
    const frontFenderGeo = buildSculptedFlankGeometry({
      xStart: 0.602,
      xEnd: 2.09,
      xSteps: 36,
      ySteps: 14,
      sideSign,
      wheelX: X_FRONT,
      wheelY: WHEEL_Y,
      archRadius: 0.352,
    });
    const frontFender = new THREE.Mesh(frontFenderGeo, carPaintMat);
    frontFender.castShadow = true;
    frontFender.receiveShadow = true;
    bodyGroup.add(frontFender);

    // Top fender crown bridge strip connecting outer fender beltline cleanly to hood edge (zero gap!)
    const fenderCrown = new THREE.Mesh(new THREE.BoxGeometry(1.47, 0.018, 0.055), carPaintMat);
    fenderCrown.position.set(1.355, 0.804, sideSign * 0.758);
    fenderCrown.rotation.z = -0.039;
    fenderCrown.rotation.x = sideSign * 0.18;
    bodyGroup.add(fenderCrown);

    // Rear quarter panel (x: -2.09 to -0.362)
    const rearQuarterGeo = buildSculptedFlankGeometry({
      xStart: -2.09,
      xEnd: -0.362,
      xSteps: 40,
      ySteps: 14,
      sideSign,
      wheelX: X_REAR,
      wheelY: WHEEL_Y,
      archRadius: 0.352,
    });
    const rearQuarter = new THREE.Mesh(rearQuarterGeo, carPaintMat);
    rearQuarter.castShadow = true;
    rearQuarter.receiveShadow = true;
    bodyGroup.add(rearQuarter);

    // Stamped wheel-arch lip molding rings (front & rear) + dark inner wheelhouse tubs
    for (const wx of [X_FRONT, X_REAR]) {
      const archLipGeo = new THREE.TorusGeometry(0.352, 0.015, 10, 32, Math.PI * 1.04);
      const archLip = new THREE.Mesh(archLipGeo, carPaintMat);
      archLip.position.set(wx, WHEEL_Y, sideSign * 0.798);
      archLip.rotation.z = -0.02 * Math.PI;
      archLip.scale.set(1.0, 1.0, 1.35);
      archLip.castShadow = true;
      bodyGroup.add(archLip);

      // Upper wheelhouse dark liner (strictly ABOVE axle y >= WHEEL_Y so nothing ever shows below tire!)
      const linerPts = [];
      const linerIdx = [];
      for (let k = 0; k <= 16; k++) {
        const a = (k / 16) * Math.PI; // 0..PI -> sin(a) >= 0 (strictly upper half!)
        const lx = wx + Math.cos(a) * 0.346;
        const ly = WHEEL_Y + Math.sin(a) * 0.346;
        linerPts.push(lx, ly, sideSign * 0.50, lx, ly, sideSign * 0.77);
      }
      for (let k = 0; k < 16; k++) {
        const i0 = k * 2, i1 = i0 + 1, i2 = i0 + 2, i3 = i0 + 3;
        linerIdx.push(i0, i1, i3, i0, i3, i2);
      }
      const linerGeo = new THREE.BufferGeometry();
      linerGeo.setAttribute('position', new THREE.Float32BufferAttribute(linerPts, 3));
      linerGeo.setIndex(linerIdx);
      linerGeo.computeVertexNormals();
      const darkLinerMat = new THREE.MeshStandardMaterial({
        color: 0x121417,
        roughness: 0.9,
        side: THREE.DoubleSide,
      });
      bodyGroup.add(new THREE.Mesh(linerGeo, darkLinerMat));
    }

    // Lower rocker sill beneath doorway (x: -0.92 to +0.96, y: 0.175 to 0.268)
    const sill = new THREE.Mesh(new THREE.BoxGeometry(1.88, 0.092, 0.095), carPaintMat);
    sill.position.set(0.02, 0.222, sideSign * 0.735);
    sill.rotation.x = sideSign * 0.22;
    sill.castShadow = true;
    bodyGroup.add(sill);

    // Black under-sill pinch weld & rubber jacking pads (front X=+0.78, rear X=-0.78)
    const pinch = new THREE.Mesh(new THREE.BoxGeometry(1.86, 0.026, 0.05), blackTrimMat);
    pinch.position.set(0.02, 0.175, sideSign * 0.70);
    bodyGroup.add(pinch);

    for (const jx of [0.78, -0.78]) {
      const jackPad = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, 0.025, 16), blackTrimMat);
      jackPad.position.set(jx, 0.165, sideSign * 0.68);
      bodyGroup.add(jackPad);
    }

    // Black body side molding rub strips on front fender (behind arch) & rear quarter
    const fRub = new THREE.Mesh(new THREE.BoxGeometry(0.33, 0.028, 0.014), blackTrimMat);
    fRub.position.set(0.77, 0.474, sideSign * 0.822);
    bodyGroup.add(fRub);

    const rRub = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.028, 0.014), blackTrimMat);
    rRub.position.set(-0.64, 0.476, sideSign * 0.822);
    bodyGroup.add(rRub);

    const rRubTail = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.028, 0.014), blackTrimMat);
    rRubTail.position.set(-1.84, 0.482, sideSign * 0.800);
    rRubTail.rotation.y = sideSign * 0.06;
    bodyGroup.add(rRubTail);
  }

  // Sculpted Hood Panel (x: +0.62 to +2.095) with E30 twin center character lines!
  const hoodGeo = buildCamberedDeckGeometry({
    xStart: 0.62,
    xEnd: 2.095,
    xSteps: 28,
    zSteps: 32,
    halfWidthFn: (x) => THREE.MathUtils.lerp(0.778, 0.742, Math.pow((x - 0.62) / 1.475, 1.3)),
    heightFn: (x) => THREE.MathUtils.lerp(0.832, 0.772, (x - 0.62) / 1.475),
    centerRidgeFn: (x, zn) => {
      // Classic E30 raised center power dome converging toward twin kidneys!
      const u = (x - 0.62) / 1.475;
      const domeHalfZ = THREE.MathUtils.lerp(0.36, 0.19, u);
      const az = Math.abs(zn);
      if (az < domeHalfZ) return 0.011;
      if (az < domeHalfZ + 0.06) {
        return 0.011 * (1.0 - (az - domeHalfZ) / 0.06);
      }
      return 0.0;
    },
  });
  const hood = new THREE.Mesh(hoodGeo, carPaintMat);
  hood.castShadow = true;
  hood.receiveShadow = true;
  bodyGroup.add(hood);

  // Hood front rounded nose lip curving smoothly down to top of grille
  const noseHeader = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 1.485, 16, 1, false, 0, Math.PI), carPaintMat);
  noseHeader.rotation.x = Math.PI * 0.5;
  noseHeader.position.set(2.092, 0.774, 0);
  bodyGroup.add(noseHeader);

  // Hood BMW Roundel Badge
  const roundelMat = new THREE.MeshStandardMaterial({ map: roundelTex, roughness: 0.2, metalness: 0.3 });
  const hoodBadge = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.034, 0.005, 24), roundelMat);
  hoodBadge.position.set(2.01, 0.806, 0);
  hoodBadge.rotation.z = -0.045;
  hoodBadge.rotation.y = Math.PI * 0.5;
  bodyGroup.add(hoodBadge);

  // Windshield wiper cowl + twin black E30 wiper arms & blades
  const cowl = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.025, 1.48), blackTrimMat);
  cowl.position.set(0.61, 0.842, 0);
  bodyGroup.add(cowl);

  for (const wz of [-0.32, 0.18]) {
    const wiperGroup = new THREE.Group();
    wiperGroup.position.set(0.58, 0.858, wz);
    wiperGroup.rotation.y = 0.08;
    wiperGroup.rotation.z = 0.14;
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.008, 0.42), blackTrimMat);
    arm.position.z = 0.18;
    wiperGroup.add(arm);
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.014, 0.44), blackTrimMat);
    blade.position.set(-0.01, 0.004, 0.28);
    wiperGroup.add(blade);
    bodyGroup.add(wiperGroup);
  }

  // Sculpted Trunk Decklid (x: -2.08 to -1.40) + M-Tech Rear Lip Spoiler
  const trunkGeo = buildCamberedDeckGeometry({
    xStart: -2.08,
    xEnd: -1.38,
    xSteps: 16,
    zSteps: 22,
    halfWidthFn: (x) => THREE.MathUtils.lerp(0.735, 0.772, (x + 2.08) / 0.70),
    heightFn: (x) => THREE.MathUtils.lerp(0.852, 0.868, (x + 2.08) / 0.70),
  });
  const trunk = new THREE.Mesh(trunkGeo, carPaintMat);
  trunk.castShadow = true;
  trunk.receiveShadow = true;
  bodyGroup.add(trunk);

  // Classic E30 rear trunk lip spoiler (visible at back-left of car in reference-0.png!)
  const spoiler = new THREE.Mesh(new THREE.BoxGeometry(0.095, 0.036, 1.42), blackTrimMat);
  spoiler.position.set(-2.04, 0.884, 0);
  spoiler.rotation.z = 0.24;
  spoiler.castShadow = true;
  bodyGroup.add(spoiler);

  const trunkBadge = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.005, 24), roundelMat);
  trunkBadge.position.set(-2.092, 0.79, 0);
  trunkBadge.rotation.z = Math.PI * 0.5;
  trunkBadge.rotation.x = Math.PI * 0.5;
  bodyGroup.add(trunkBadge);

  // ============================================================================
  // 2. GREENHOUSE: ROOF, A/B/C PILLARS (HOFMEISTER KINK), WINDSHIELD, QUARTER GLASS
  // ============================================================================
  const roofGeo = buildCamberedDeckGeometry({
    xStart: -0.98,
    xEnd: 0.08,
    xSteps: 18,
    zSteps: 20,
    halfWidthFn: () => 0.605,
    heightFn: (x) => 1.352 - Math.pow((x + 0.45) / 0.65, 2) * 0.012,
  });
  const roof = new THREE.Mesh(roofGeo, carPaintMat);
  roof.castShadow = true;
  roof.receiveShadow = true;
  bodyGroup.add(roof);

  // Subtle sunroof seam frame on roof
  const sunroofFrame = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.004, 0.78), blackTrimMat);
  sunroofFrame.position.set(-0.22, 1.374, 0);
  bodyGroup.add(sunroofFrame);
  const sunroofInsert = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.005, 0.76), carPaintMat);
  sunroofInsert.position.set(-0.22, 1.375, 0);
  bodyGroup.add(sunroofInsert);

  // Slim A-pillars, B-pillars, C-pillars with Hofmeister kink & Chrome/Shadowline Window Trim
  const addPillar = (p0, p1, w, d, mat) => {
    const v0 = new THREE.Vector3(...p0);
    const v1 = new THREE.Vector3(...p1);
    const len = v0.distanceTo(v1);
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, len, d), mat);
    m.position.copy(v0).add(v1).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), v1.clone().sub(v0).normalize());
    m.castShadow = true;
    bodyGroup.add(m);
    return m;
  };

  for (const s of [1, -1]) {
    // A-pillar (windshield side post)
    addPillar([0.59, 0.835, s * 0.765], [0.06, 1.352, s * 0.602], 0.042, 0.038, carPaintMat);
    addPillar([0.60, 0.838, s * 0.772], [0.06, 1.356, s * 0.610], 0.014, 0.012, chromeMat);

    // Roof drip-rail chrome/silver gutter molding (signature E30 greenhouse trim!)
    addPillar([0.06, 1.356, s * 0.612], [-0.98, 1.348, s * 0.610], 0.018, 0.014, chromeMat);

    // Thin vertical B-pillar at x = -0.36
    addPillar([-0.36, 0.838, s * 0.776], [-0.36, 1.352, s * 0.606], 0.042, 0.024, blackTrimMat);

    // Slanted C-pillar (flush stamped sheetmetal quad + iconic Hofmeister kink at base!)
    const cpPos = new Float32Array([
      -0.96, 1.350, s * 0.605,  // roof rear-outer corner
      -0.86, 1.350, s * 0.605,  // roof forward-outer corner
      -1.25, 0.862, s * 0.775,  // Hofmeister kink base
      -1.44, 0.860, s * 0.768,  // rear decklid base
    ]);
    const cpGeo = new THREE.BufferGeometry();
    cpGeo.setAttribute('position', new THREE.BufferAttribute(cpPos, 3));
    cpGeo.setIndex(s > 0 ? [0, 3, 2, 0, 2, 1] : [0, 2, 3, 0, 1, 2]);
    cpGeo.computeVertexNormals();
    const cPillarMesh = new THREE.Mesh(cpGeo, carPaintMat);
    cPillarMesh.castShadow = true;
    bodyGroup.add(cPillarMesh);

    // Hofmeister forward-swept lower C-pillar fillet & chrome window surround
    addPillar([-0.86, 1.350, s * 0.612], [-1.25, 0.865, s * 0.779], 0.016, 0.014, chromeMat);
    addPillar([-0.36, 0.842, s * 0.782], [-1.25, 0.865, s * 0.779], 0.016, 0.014, chromeMat);

    // Rear quarter window glass (x: -0.36 to -1.24)
    const qShape = new THREE.BufferGeometry();
    const qp = new Float32Array([
      -0.36, 0.842, s * 0.774,
      -1.24, 0.862, s * 0.768,
      -0.865, 1.346, s * 0.604,
      -0.36, 1.348, s * 0.604,
    ]);
    qShape.setAttribute('position', new THREE.BufferAttribute(qp, 3));
    qShape.setIndex(s > 0 ? [0, 2, 1, 0, 3, 2] : [0, 1, 2, 0, 2, 3]);
    qShape.computeVertexNormals();
    const qGlass = new THREE.Mesh(qShape, glassMat);
    bodyGroup.add(qGlass);
  }

  // Front Curved Laminated Windshield Glass (x: +0.59 at base -> +0.06 at header)
  {
    const wsStepsZ = 16;
    const wsPos = [];
    const wsIdx = [];
    for (let iz = 0; iz <= wsStepsZ; iz++) {
      const zn = (iz / wsStepsZ - 0.5) * 2.0; // -1..+1
      const bow = (1.0 - zn * zn) * 0.045;
      wsPos.push(0.585 + bow, 0.842, zn * 0.755);
      wsPos.push(0.065 + bow * 0.65, 1.348, zn * 0.596);
    }
    for (let iz = 0; iz < wsStepsZ; iz++) {
      const a = iz * 2, b = iz * 2 + 1, c = (iz + 1) * 2 + 1, d = (iz + 1) * 2;
      wsIdx.push(a, c, b, a, d, c);
    }
    const wsGeo = new THREE.BufferGeometry();
    wsGeo.setAttribute('position', new THREE.Float32BufferAttribute(wsPos, 3));
    wsGeo.setIndex(wsIdx);
    wsGeo.computeVertexNormals();
    const windshield = new THREE.Mesh(wsGeo, glassMat);
    bodyGroup.add(windshield);

    // Small white/green environmental sticker inside bottom-right corner of windshield (matching reference-0.png!)
    const sticker = new THREE.Mesh(
      new THREE.CircleGeometry(0.026, 16),
      new THREE.MeshBasicMaterial({ color: 0xdbe6dc, side: THREE.DoubleSide })
    );
    sticker.position.set(0.54, 0.895, 0.64);
    sticker.rotation.set(0, Math.PI * 0.5, -0.76);
    bodyGroup.add(sticker);
  }

  // Rear Backlite Window Glass (x: -0.98 at roof -> -1.42 at parcel shelf)
  {
    const rwPos = new Float32Array([
      -0.98, 1.345, -0.59,
      -0.98, 1.345, +0.59,
      -1.42, 0.870, +0.74,
      -1.42, 0.870, -0.74,
    ]);
    const rwGeo = new THREE.BufferGeometry();
    rwGeo.setAttribute('position', new THREE.BufferAttribute(rwPos, 3));
    rwGeo.setIndex([0, 2, 1, 0, 3, 2]);
    rwGeo.computeVertexNormals();
    bodyGroup.add(new THREE.Mesh(rwGeo, glassMat));
  }

  // ============================================================================
  // 3. HINGED DOORS (RIGHT +Z & LEFT -Z): OUTER SKIN, WINDOW SASH, MIRROR, INNER CARD
  // ============================================================================
  function buildDoorAssembly(sideSign) {
    // Pivot right at the front hinge line (x = +0.598, z = sideSign * 0.802)
    const pivot = new THREE.Group();
    pivot.position.set(0.598, 0, sideSign * 0.802);

    // Local helper group shifted back so we can author door parts in car coordinates!
    const local = new THREE.Group();
    local.position.set(-0.598, 0, -sideSign * 0.802);
    pivot.add(local);

    // Sculpted outer door skin (x: -0.358 to +0.598, y: 0.268 to beltline ~0.83)
    const skinGeo = buildSculptedFlankGeometry({
      xStart: -0.358,
      xEnd: 0.598,
      xSteps: 22,
      ySteps: 12,
      sideSign,
      wheelX: null,
      yBottomBase: 0.268,
    });
    const skin = new THREE.Mesh(skinGeo, carPaintMat);
    skin.castShadow = true;
    skin.receiveShadow = true;
    local.add(skin);

    // Door thickness jambs & inner door panel card (so opening the door looks thick and real!)
    const innerCard = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.52, 0.055), interiorVinylMat);
    innerCard.position.set(0.12, 0.535, sideSign * 0.752);
    innerCard.castShadow = true;
    local.add(innerCard);

    // Angled interior armrest pull handle + map pocket + chrome inner release
    const armRest = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.048, 0.065), seatFabricMat);
    armRest.position.set(0.14, 0.56, sideSign * 0.708);
    armRest.rotation.z = -0.16;
    local.add(armRest);

    const mapPocket = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.13, 0.045), blackTrimMat);
    mapPocket.position.set(0.20, 0.36, sideSign * 0.715);
    local.add(mapPocket);

    const innerLatch = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.022, 0.02), chromeMat);
    innerLatch.position.set(0.38, 0.69, sideSign * 0.718);
    local.add(innerLatch);

    // Exterior black protective rub strip along mid-door
    const doorRub = new THREE.Mesh(new THREE.BoxGeometry(0.952, 0.028, 0.014), blackTrimMat);
    doorRub.position.set(0.12, 0.474, sideSign * 0.822);
    local.add(doorRub);

    // Flush E30 black exterior door handle & silver lock cylinder
    const handleBezel = new THREE.Mesh(new THREE.BoxGeometry(0.145, 0.044, 0.018), blackTrimMat);
    handleBezel.position.set(-0.20, 0.745, sideSign * 0.796);
    local.add(handleBezel);

    const lockCyl = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.02, 12), chromeMat);
    lockCyl.rotation.x = Math.PI * 0.5;
    lockCyl.position.set(-0.295, 0.745, sideSign * 0.798);
    local.add(lockCyl);

    // Upper window frame & chrome trim around door glass
    const addDoorFrameBar = (p0, p1, w, d, mat) => {
      const v0 = new THREE.Vector3(...p0);
      const v1 = new THREE.Vector3(...p1);
      const len = v0.distanceTo(v1);
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, len, d), mat);
      m.position.copy(v0).add(v1).multiplyScalar(0.5);
      m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), v1.clone().sub(v0).normalize());
      local.add(m);
    };
    addDoorFrameBar([0.585, 0.835, sideSign * 0.778], [-0.355, 0.842, sideSign * 0.780], 0.018, 0.018, chromeMat);
    addDoorFrameBar([0.585, 0.835, sideSign * 0.774], [0.062, 1.348, sideSign * 0.608], 0.020, 0.018, blackTrimMat);
    addDoorFrameBar([0.062, 1.348, sideSign * 0.608], [-0.355, 1.348, sideSign * 0.608], 0.020, 0.018, blackTrimMat);
    addDoorFrameBar([-0.355, 0.842, sideSign * 0.776], [-0.355, 1.348, sideSign * 0.608], 0.022, 0.018, blackTrimMat);

    // Door Window Glass
    const dgPos = new Float32Array([
      0.46, 0.836, sideSign * 0.772,
      -0.352, 0.842, sideSign * 0.774,
      -0.352, 1.345, sideSign * 0.605,
      0.065, 1.345, sideSign * 0.605,
    ]);
    const dgGeo = new THREE.BufferGeometry();
    dgGeo.setAttribute('position', new THREE.BufferAttribute(dgPos, 3));
    dgGeo.setIndex(sideSign > 0 ? [0, 2, 1, 0, 3, 2] : [0, 1, 2, 0, 2, 3]);
    dgGeo.computeVertexNormals();
    local.add(new THREE.Mesh(dgGeo, glassMat));

    // Front triangular mirror sail & rectangular E30 wing mirror!
    const sailPos = new Float32Array([
      0.585, 0.835, sideSign * 0.772,
      0.455, 0.836, sideSign * 0.772,
      0.475, 0.965, sideSign * 0.730,
    ]);
    const sailGeo = new THREE.BufferGeometry();
    sailGeo.setAttribute('position', new THREE.BufferAttribute(sailPos, 3));
    sailGeo.setIndex(sideSign > 0 ? [0, 2, 1] : [0, 1, 2]);
    sailGeo.computeVertexNormals();
    local.add(new THREE.Mesh(sailGeo, blackTrimMat));

    const mirrorArm = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.032, 0.08), blackTrimMat);
    mirrorArm.position.set(0.50, 0.875, sideSign * 0.805);
    local.add(mirrorArm);

    const mirrorHousing = new THREE.Mesh(new THREE.BoxGeometry(0.105, 0.092, 0.148), carPaintMat);
    mirrorHousing.position.set(0.485, 0.892, sideSign * 0.875);
    mirrorHousing.rotation.y = sideSign * 0.16;
    mirrorHousing.castShadow = true;
    local.add(mirrorHousing);

    const mirrorFace = new THREE.Mesh(new THREE.PlaneGeometry(0.132, 0.078), chromeMat);
    mirrorFace.position.set(0.432, 0.892, sideSign * 0.878);
    mirrorFace.rotation.y = -Math.PI * 0.5 + sideSign * 0.16;
    local.add(mirrorFace);

    bodyGroup.add(pivot);
    return pivot;
  }

  const rightDoorPivot = buildDoorAssembly(1);
  const leftDoorPivot = buildDoorAssembly(-1);

  // ============================================================================
  // 4. ICONIC E30 FRONT FASCIA (+X) & REAR TAIL PANEL (-X)
  // ============================================================================
  const frontGroup = new THREE.Group();
  bodyGroup.add(frontGroup);

  //Slightly forward-leaning E30 nose grille housing (x ≈ 2.09, y: 0.545 .. 0.745, z: -0.74 .. +0.74)
  const grilleBack = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.195, 1.48), matteGrilleMat);
  grilleBack.position.set(2.075, 0.645, 0);
  grilleBack.rotation.z = -0.09; // classic subtle shark cant!
  frontGroup.add(grilleBack);

  // 7 crisp horizontal black louver slats across left & right grille wings
  for (let i = 0; i < 7; i++) {
    const sy = 0.562 + i * 0.027;
    const sx = 2.098 + (sy - 0.56) * 0.08;
    for (const sz of [-0.435, 0.435]) {
      const slat = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.007, 0.58), matteGrilleMat);
      slat.position.set(sx, sy, sz);
      frontGroup.add(slat);
    }
  }

  // Narrow Chrome Twin-Kidney Grille at center (Z = ±0.076)
  function createKidneyBezel(zCenter) {
    const kg = new THREE.Group();
    kg.position.set(2.122, 0.648, zCenter);
    kg.rotation.z = -0.09;

    // Rounded rectangular chrome surround built from top/bottom/left/right bars + corner fillets
    const w = 0.128, h = 0.198, t = 0.013, depth = 0.028;
    const topB = new THREE.Mesh(new THREE.BoxGeometry(depth, t, w), chromeMat);
    topB.position.y = h * 0.5 - t * 0.5;
    const botB = new THREE.Mesh(new THREE.BoxGeometry(depth, t, w), chromeMat);
    botB.position.y = -h * 0.5 + t * 0.5;
    const leftB = new THREE.Mesh(new THREE.BoxGeometry(depth, h - t, t), chromeMat);
    leftB.position.z = -w * 0.5 + t * 0.5;
    const rightB = new THREE.Mesh(new THREE.BoxGeometry(depth, h - t, t), chromeMat);
    rightB.position.z = w * 0.5 - t * 0.5;
    kg.add(topB, botB, leftB, rightB);

    // 8 vertical black kidney slats inside
    for (let s = -3.5; s <= 3.5; s += 1.0) {
      const vSlat = new THREE.Mesh(new THREE.BoxGeometry(0.020, h - 0.028, 0.0055), matteGrilleMat);
      vSlat.position.set(-0.003, 0, s * 0.013);
      kg.add(vSlat);
    }
    return kg;
  }
  frontGroup.add(createKidneyBezel(-0.074));
  frontGroup.add(createKidneyBezel(+0.074));

  // ///M Grille Badge (right of kidneys when facing the car -> Z = -0.225, matching reference-0.png!)
  const mBadge = new THREE.Mesh(
    new THREE.PlaneGeometry(0.076, 0.028),
    new THREE.MeshStandardMaterial({ map: mBadgeTex, roughness: 0.3, metalness: 0.4 })
  );
  mBadge.position.set(2.114, 0.622, -0.225);
  mBadge.rotation.y = Math.PI * 0.5;
  frontGroup.add(mBadge);

  // Quad Round Hella Headlights (4x Ø138mm: Z = ±0.610 outer low-beam, Z = ±0.425 inner high-beam)
  const headlightBulbs = [];
  const headlightSpotLights = [];
  const reflectorSilverMat = new THREE.MeshPhysicalMaterial({
    color: 0xf2f6fc,
    emissive: 0x363d46,
    emissiveIntensity: 0.55,
    metalness: 0.58,
    roughness: 0.14,
    clearcoat: 0.8,
    envMapIntensity: 1.8,
    side: THREE.DoubleSide,
  });

  for (const hz of [-0.610, -0.425, 0.425, 0.610]) {
    const lamp = new THREE.Group();
    lamp.position.set(2.114, 0.648, hz);
    lamp.rotation.y = Math.PI * 0.5; // local +Z points forward along car +X!

    // Black outer recessed housing ring
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.071, 0.0065, 10, 32), blackTrimMat);
    ring.position.z = 0.008;
    lamp.add(ring);

    // Bright chrome inner bezel + bright silvery parabolic reflector dish & backing disc
    const chromeRim = new THREE.Mesh(new THREE.TorusGeometry(0.066, 0.004, 10, 32), chromeMat);
    chromeRim.position.z = 0.011;
    lamp.add(chromeRim);

    const bowlBack = new THREE.Mesh(new THREE.CircleGeometry(0.065, 28), reflectorSilverMat);
    bowlBack.position.z = -0.014;
    lamp.add(bowlBack);

    const bowl = new THREE.Mesh(
      new THREE.CylinderGeometry(0.066, 0.028, 0.028, 28, 1, true),
      reflectorSilverMat
    );
    bowl.rotation.x = Math.PI * 0.5;
    bowl.position.z = 0.0;
    lamp.add(bowl);

    // Center bulb & chrome glare cap
    const bulbMat = new THREE.MeshStandardMaterial({
      color: 0xfff8e6,
      emissive: 0x444038,
      emissiveIntensity: 0.35,
      roughness: 0.15,
      metalness: 0.65,
    });
    headlightBulbs.push(bulbMat);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.015, 14, 14), bulbMat);
    bulb.position.z = 0.002;
    lamp.add(bulb);

    // Fluted convex Hella glass lens sitting proudly in front of grille slats!
    const lens = new THREE.Mesh(
      new THREE.CircleGeometry(0.065, 32),
      headlightLensMat
    );
    lens.position.z = 0.013;
    lamp.add(lens);

    frontGroup.add(lamp);
  }

  // Optional interactive dual SpotLights for toggling headlights on!
  for (const sz of [-0.55, 0.55]) {
    const sp = new THREE.SpotLight(0xfff1d0, 0.0, 14.0, 0.52, 0.55, 1.4);
    sp.position.set(2.14, 0.645, sz);
    const tgt = new THREE.Object3D();
    tgt.position.set(8.5, 0.15, sz * 1.3);
    bodyGroup.add(tgt);
    sp.target = tgt;
    bodyGroup.add(sp);
    headlightSpotLights.push(sp);
  }

  // Front Wraparound Bumper with Rounded Corners + Black Impact Strip + Amber Turn Signals + M-Tech Valance
  const fBumper = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.105, 1.44), carPaintMat);
  fBumper.position.set(2.132, 0.482, 0);
  fBumper.castShadow = true;
  frontGroup.add(fBumper);

  const fBumperRub = new THREE.Mesh(new THREE.BoxGeometry(0.124, 0.046, 1.45), blackTrimMat);
  fBumperRub.position.set(2.135, 0.488, 0);
  frontGroup.add(fBumperRub);

  // Rounded bumper corners + side wings reaching front wheel arch (x: 1.68 .. 2.13)
  for (const s of [1, -1]) {
    const cornerCyl = new THREE.Mesh(
      new THREE.CylinderGeometry(0.085, 0.085, 0.105, 16, 1, false, s > 0 ? 0 : Math.PI * 0.5, Math.PI * 0.5),
      carPaintMat
    );
    cornerCyl.position.set(2.102, 0.482, s * 0.708);
    frontGroup.add(cornerCyl);

    const cornerRub = new THREE.Mesh(
      new THREE.CylinderGeometry(0.092, 0.092, 0.046, 16, 1, false, s > 0 ? 0 : Math.PI * 0.5, Math.PI * 0.5),
      blackTrimMat
    );
    cornerRub.position.set(2.102, 0.488, s * 0.708);
    frontGroup.add(cornerRub);

    const bWing = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.105, 0.055), carPaintMat);
    bWing.position.set(1.89, 0.480, s * 0.768);
    bWing.castShadow = true;
    frontGroup.add(bWing);

    const bWingRub = new THREE.Mesh(new THREE.BoxGeometry(0.43, 0.046, 0.062), blackTrimMat);
    bWingRub.position.set(1.89, 0.488, s * 0.772);
    frontGroup.add(bWingRub);

    // Recessed Amber Front Turn Signal Indicator
    const turn = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.040, 0.140), amberTurnMat);
    turn.position.set(2.192, 0.484, s * 0.545);
    frontGroup.add(turn);
  }

  // German Euro License Plate "B · E 3030" on front bumper
  const plateMat = new THREE.MeshStandardMaterial({
    map: plateTex,
    roughness: 0.30,
    metalness: 0.12,
  });
  const fPlateMount = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.112, 0.52), blackTrimMat);
  fPlateMount.position.set(2.190, 0.456, 0);
  frontGroup.add(fPlateMount);

  const fPlate = new THREE.Mesh(new THREE.PlaneGeometry(0.505, 0.106), plateMat);
  fPlate.position.set(2.204, 0.456, 0);
  fPlate.rotation.y = Math.PI * 0.5;
  frontGroup.add(fPlate);

  // Sleek Tapered E30 Lower Front Valance / Air Dam (y: 0.215 .. 0.428) with recessed brake ducts & fog lamps
  const valance = new THREE.Mesh(new THREE.BoxGeometry(0.095, 0.205, 1.48), carPaintMat);
  valance.position.set(2.104, 0.322, 0);
  valance.rotation.z = 0.11;
  valance.castShadow = true;
  frontGroup.add(valance);

  // Valance side skirts wrapping smoothly back to front arch
  for (const s of [1, -1]) {
    const vSide = new THREE.Mesh(new THREE.BoxGeometry(0.40, 0.195, 0.048), carPaintMat);
    vSide.position.set(1.89, 0.322, s * 0.748);
    frontGroup.add(vSide);

    // Flush dark brake-cooling duct opening + outer fog-lamp lens (aligned cleanly with valance Z-tilt!)
    const duct = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.050, 0.135), matteGrilleMat);
    duct.position.set(2.150, 0.318, s * 0.415);
    duct.rotation.z = 0.11;
    frontGroup.add(duct);

    const fogLamp = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.050, 0.115), headlightLensMat);
    fogLamp.position.set(2.151, 0.318, s * 0.575);
    fogLamp.rotation.z = 0.11;
    frontGroup.add(fogLamp);
  }
  // Flush center valance lower cooling intake slot & front splitter chin lip
  const lowerIntake = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.050, 0.58), matteGrilleMat);
  lowerIntake.position.set(2.150, 0.318, 0);
  lowerIntake.rotation.z = 0.11;
  frontGroup.add(lowerIntake);

  const chinLip = new THREE.Mesh(new THREE.BoxGeometry(0.115, 0.026, 1.50), carPaintMat);
  chinLip.position.set(2.118, 0.218, 0);
  chinLip.castShadow = true;
  frontGroup.add(chinLip);

  const chinBlackEdge = new THREE.Mesh(new THREE.BoxGeometry(0.120, 0.012, 1.51), blackTrimMat);
  chinBlackEdge.position.set(2.122, 0.202, 0);
  frontGroup.add(chinBlackEdge);

  // --- Rear Tail Panel (-X) for 360° OrbitControls Completeness ---
  const rearPanel = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.32, 1.50), carPaintMat);
  rearPanel.position.set(-2.08, 0.69, 0);
  bodyGroup.add(rearPanel);

  const taillightMat = new THREE.MeshPhysicalMaterial({
    map: taillightTex,
    roughness: 0.18,
    clearcoat: 0.85,
  });
  for (const s of [1, -1]) {
    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.135, 0.34), taillightMat);
    tl.position.set(-2.115, 0.705, s * 0.54);
    bodyGroup.add(tl);
  }
  const rPlate = new THREE.Mesh(new THREE.PlaneGeometry(0.515, 0.110), plateMat);
  rPlate.position.set(-2.124, 0.705, 0);
  rPlate.rotation.y = -Math.PI * 0.5;
  bodyGroup.add(rPlate);

  const rBumper = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.12, 1.60), carPaintMat);
  rBumper.position.set(-2.13, 0.49, 0);
  rBumper.castShadow = true;
  bodyGroup.add(rBumper);

  const rBumperRub = new THREE.Mesh(new THREE.BoxGeometry(0.155, 0.05, 1.62), blackTrimMat);
  rBumperRub.position.set(-2.135, 0.498, 0);
  bodyGroup.add(rBumperRub);

  const rValance = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.18, 1.52), carPaintMat);
  rValance.position.set(-2.08, 0.34, 0);
  bodyGroup.add(rValance);

  // ============================================================================
  // 5. DETAILED COCKPIT INTERIOR (SEATS, ANGLED E30 DASH, M-TECH WHEEL, CONSOLE)
  // ============================================================================
  const interior = new THREE.Group();
  bodyGroup.add(interior);

  // Cabin floor tub, transmission tunnel, firewall & rear parcel shelf
  const cabinFloor = new THREE.Mesh(new THREE.BoxGeometry(2.15, 0.04, 1.46), carpetMat);
  cabinFloor.position.set(-0.22, 0.25, 0);
  cabinFloor.receiveShadow = true;
  interior.add(cabinFloor);

  const firewall = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.62, 1.48), carpetMat);
  firewall.position.set(0.68, 0.54, 0);
  interior.add(firewall);

  const transTunnel = new THREE.Mesh(new THREE.BoxGeometry(1.65, 0.14, 0.22), interiorVinylMat);
  transTunnel.position.set(-0.02, 0.33, 0);
  interior.add(transTunnel);

  const parcelShelf = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.04, 1.44), carpetMat);
  parcelShelf.position.set(-1.26, 0.85, 0);
  interior.add(parcelShelf);

  const headliner = new THREE.Mesh(new THREE.BoxGeometry(1.04, 0.015, 1.18), interiorVinylMat);
  headliner.position.set(-0.45, 1.335, 0);
  interior.add(headliner);

  // Automatic warm E30 courtesy dome light that illuminates the cockpit when a door opens!
  const domeLight = new THREE.PointLight(0xffe4b5, 0.0, 2.4, 1.5);
  domeLight.position.set(-0.10, 1.24, 0.0);
  interior.add(domeLight);

  // Classic E30 Dashboard + Driver-Angled Center Console + VDO Gauge Binnacle
  const dashTop = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.15, 1.44), interiorVinylMat);
  dashTop.position.set(0.44, 0.76, 0);
  dashTop.castShadow = true;
  interior.add(dashTop);

  // Sleek sloped instrument cluster hood on driver side (LHD -> Z = -0.35)
  const binnacle = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.125, 0.36), interiorVinylMat);
  binnacle.position.set(0.32, 0.835, -0.35);
  binnacle.rotation.z = -0.22;
  interior.add(binnacle);

  const gauges = new THREE.Mesh(
    new THREE.PlaneGeometry(0.33, 0.115),
    new THREE.MeshStandardMaterial({
      map: clusterTex,
      roughness: 0.25,
      emissive: 0xff6a28,
      emissiveMap: clusterTex,
      emissiveIntensity: 0.28,
    })
  );
  gauges.position.set(0.212, 0.842, -0.35);
  gauges.rotation.y = -Math.PI * 0.5;
  gauges.rotation.z = 0.15;
  interior.add(gauges);

  // Driver-angled center stack (radio, HVAC vents, sliders) — signature E30 ergonomic cant!
  const centerStack = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.32, 0.28), blackTrimMat);
  centerStack.position.set(0.32, 0.62, -0.02);
  centerStack.rotation.y = 0.16; // canted ~9° toward driver (-Z)!
  interior.add(centerStack);

  // Small radio display & HVAC control buttons on center stack
  const radioFace = new THREE.Mesh(
    new THREE.BoxGeometry(0.01, 0.055, 0.21),
    new THREE.MeshStandardMaterial({ color: 0x22262c, emissive: 0xd9581e, emissiveIntensity: 0.25 })
  );
  radioFace.position.set(0.208, 0.68, -0.02);
  radioFace.rotation.y = 0.16;
  interior.add(radioFace);

  // 5-speed Manual Gear Shifter & Handbrake on console
  const shiftBoot = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.09, 12), interiorVinylMat);
  shiftBoot.position.set(0.09, 0.43, 0);
  interior.add(shiftBoot);

  const shiftRod = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.11, 10), blackTrimMat);
  shiftRod.position.set(0.08, 0.49, 0);
  shiftRod.rotation.z = 0.15;
  interior.add(shiftRod);

  const shiftKnob = new THREE.Mesh(new THREE.SphereGeometry(0.024, 14, 14), interiorVinylMat);
  shiftKnob.position.set(0.065, 0.55, 0);
  interior.add(shiftKnob);

  const handbrake = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.028, 0.03), blackTrimMat);
  handbrake.position.set(-0.18, 0.44, -0.05);
  handbrake.rotation.z = -0.26;
  interior.add(handbrake);

  // 3-Spoke M-Tech Leather Steering Wheel (driver side Z = -0.35)
  const wheelCol = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.042, 0.26, 14), blackTrimMat);
  wheelCol.position.set(0.26, 0.78, -0.35);
  wheelCol.rotation.z = 1.22;
  interior.add(wheelCol);

  const steerGroup = new THREE.Group();
  steerGroup.position.set(0.145, 0.825, -0.35);
  steerGroup.rotation.y = -Math.PI * 0.5;
  steerGroup.rotation.x = -0.36; // tilted steering plane facing driver (-X)
  const rimTorus = new THREE.Mesh(new THREE.TorusGeometry(0.175, 0.018, 12, 32), interiorVinylMat);
  steerGroup.add(rimTorus);
  const hornPad = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.062, 0.028, 18), interiorVinylMat);
  hornPad.rotation.x = Math.PI * 0.5;
  steerGroup.add(hornPad);
  const hornBadge = new THREE.Mesh(new THREE.CircleGeometry(0.018, 18), roundelMat);
  hornBadge.position.z = 0.015;
  steerGroup.add(hornBadge);
  for (const sa of [-0.12, Math.PI + 0.12, -Math.PI * 0.5]) {
    const spk = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.032, 0.014), blackTrimMat);
    spk.position.set(Math.cos(sa) * 0.085, Math.sin(sa) * 0.085, 0);
    spk.rotation.z = sa;
    steerGroup.add(spk);
  }
  interior.add(steerGroup);

  // Interior Rearview Mirror hanging from windshield header
  const rvStem = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.085, 8), blackTrimMat);
  rvStem.position.set(0.12, 1.295, 0);
  rvStem.rotation.z = -0.3;
  interior.add(rvStem);
  const rvMirror = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.055, 0.21), blackTrimMat);
  rvMirror.position.set(0.14, 1.255, 0);
  rvMirror.rotation.y = 0.14;
  interior.add(rvMirror);

  // Sculpted E30 Sport Bucket Seats (Left Driver Z=-0.35 & Right Passenger Z=+0.35)
  function createSportSeat() {
    const sg = new THREE.Group();
    // Seat base cushion + extendable E30 thigh bolster + side bolsters
    const cushion = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.10, 0.44), seatFabricMat);
    cushion.position.set(0, 0.34, 0);
    sg.add(cushion);

    const thighPad = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.09, 0.42), seatFabricMat);
    thighPad.position.set(0.27, 0.355, 0);
    thighPad.rotation.z = 0.15;
    sg.add(thighPad);

    for (const bs of [-1, 1]) {
      const lowBolster = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.085, 0.085), interiorVinylMat);
      lowBolster.position.set(0, 0.39, bs * 0.215);
      lowBolster.rotation.x = bs * 0.25;
      sg.add(lowBolster);
    }

    // Reclined backrest with lateral bolsters & classic E30 headrest
    const backGroup = new THREE.Group();
    backGroup.position.set(-0.20, 0.38, 0);
    backGroup.rotation.z = 0.26; // reclined backward (-X)

    const backrest = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.56, 0.42), seatFabricMat);
    backrest.position.set(0, 0.28, 0);
    backrest.castShadow = true;
    backGroup.add(backrest);

    for (const bs of [-1, 1]) {
      const sideBolster = new THREE.Mesh(new THREE.BoxGeometry(0.135, 0.50, 0.085), interiorVinylMat);
      sideBolster.position.set(0.03, 0.27, bs * 0.21);
      sideBolster.rotation.y = -bs * 0.22;
      backGroup.add(sideBolster);

      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.10, 8), chromeMat);
      post.position.set(0, 0.59, bs * 0.09);
      backGroup.add(post);
    }

    const headrest = new THREE.Mesh(new THREE.BoxGeometry(0.095, 0.165, 0.25), interiorVinylMat);
    headrest.position.set(0.015, 0.665, 0);
    headrest.rotation.z = -0.14;
    headrest.castShadow = true;
    backGroup.add(headrest);

    sg.add(backGroup);
    return sg;
  }

  const driverSeat = createSportSeat();
  driverSeat.position.set(-0.12, 0, -0.35);
  interior.add(driverSeat);

  const passengerSeat = createSportSeat();
  passengerSeat.position.set(-0.10, 0, +0.35);
  interior.add(passengerSeat);

  // Rear 2+2 Bench Seat
  const rearCushion = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.12, 1.34), seatFabricMat);
  rearCushion.position.set(-0.86, 0.36, 0);
  interior.add(rearCushion);
  const rearBack = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.48, 1.34), seatFabricMat);
  rearBack.position.set(-1.12, 0.62, 0);
  rearBack.rotation.z = 0.22;
  interior.add(rearBack);

  // ============================================================================
  // 6. DETAILED CHASSIS UNDERCARRIAGE (VISIBLE WHEN LIFTED!)
  // ============================================================================
  const underbody = new THREE.Group();
  bodyGroup.add(underbody);

  // Main stamped floorpan underbody plate & longitudinal frame rails
  const floorPan = new THREE.Mesh(new THREE.BoxGeometry(3.55, 0.03, 1.36), underbodyMat);
  floorPan.position.set(-0.02, 0.215, 0);
  floorPan.castShadow = true;
  underbody.add(floorPan);

  for (const rz of [-0.46, 0.46]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.055, 0.08), underbodyMat);
    rail.position.set(0.0, 0.195, rz);
    underbody.add(rail);
  }

  // Front subframe crossmember, finned M20 aluminum oil sump, & lower control arms
  const fSubframe = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.055, 1.12), underbodyMat);
  fSubframe.position.set(X_FRONT, 0.21, 0);
  underbody.add(fSubframe);

  const oilPan = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.11, 0.28), alloyCastMat);
  oilPan.position.set(1.25, 0.215, 0.04);
  underbody.add(oilPan);

  // Getrag 5-speed transmission casing + center driveshaft + finned rear differential
  const gearbox = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.08, 0.56, 14), alloyCastMat);
  gearbox.rotation.z = Math.PI * 0.5;
  gearbox.position.set(0.68, 0.23, 0);
  underbody.add(gearbox);

  const driveshaft = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 1.72, 12), underbodyMat);
  driveshaft.rotation.z = Math.PI * 0.5;
  driveshaft.position.set(-0.28, 0.225, 0);
  underbody.add(driveshaft);

  const rearSubframe = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.065, 1.18), underbodyMat);
  rearSubframe.position.set(X_REAR + 0.12, 0.23, 0);
  underbody.add(rearSubframe);

  const diff = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.19, 0.24), alloyCastMat);
  diff.position.set(X_REAR, 0.25, 0);
  underbody.add(diff);

  // Front & rear suspension arms & half-shafts
  for (const s of [1, -1]) {
    const lca = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.03, 0.36), underbodyMat);
    lca.position.set(X_FRONT, 0.22, s * 0.52);
    underbody.add(lca);

    const halfShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.56, 10), underbodyMat);
    halfShaft.rotation.x = Math.PI * 0.5;
    halfShaft.position.set(X_REAR, 0.25, s * 0.38);
    underbody.add(halfShaft);
  }

  // Full Twin-Pipe Stainless Exhaust System (downpipes -> resonator -> rear sport muffler -> dual tips)
  for (const ez of [-0.16, -0.22]) {
    const midPipe = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 2.75, 12), exhaustSteelMat);
    midPipe.rotation.z = Math.PI * 0.5;
    midPipe.position.set(-0.22, 0.175, ez);
    midPipe.castShadow = true;
    underbody.add(midPipe);
  }
  const catResonator = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.075, 0.22), exhaustSteelMat);
  catResonator.position.set(0.15, 0.175, -0.19);
  underbody.add(catResonator);

  const rearMuffler = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.105, 0.52, 16), exhaustSteelMat);
  rearMuffler.rotation.z = Math.PI * 0.5;
  rearMuffler.scale.set(1, 1, 1.45);
  rearMuffler.position.set(-1.76, 0.22, -0.38);
  rearMuffler.castShadow = true;
  underbody.add(rearMuffler);

  for (const tz of [-0.34, -0.42]) {
    const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.22, 16, 1, true), chromeMat);
    tip.rotation.z = Math.PI * 0.5;
    tip.rotation.y = 0.08;
    tip.position.set(-2.08, 0.215, tz);
    underbody.add(tip);
  }

  // Fuel tank beside muffler
  const fuelTank = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.16, 0.62), underbodyMat);
  fuelTank.position.set(-0.86, 0.22, 0.24);
  underbody.add(fuelTank);

  // ============================================================================
  // 7. FOUR 16" BBS RS BASKETWEAVE WHEELS (ATTACHED TO SUSPENSION HUBS)
  // ============================================================================
  const wheelsGroup = new THREE.Group();
  bodyGroup.add(wheelsGroup);

  const wheelConfigs = [
    { x: X_FRONT, z: +0.725, flip: false }, // Front-Right (+Z, closest hero wheel!)
    { x: X_FRONT, z: -0.725, flip: true },  // Front-Left (-Z)
    { x: X_REAR,  z: +0.725, flip: false }, // Rear-Right (+Z)
    { x: X_REAR,  z: -0.725, flip: true },  // Rear-Left (-Z)
  ];

  for (const wc of wheelConfigs) {
    const w = wheelFactory.createBBSWheel({ includeBrakes: true });
    w.position.set(wc.x, WHEEL_Y, wc.z);
    if (wc.flip) w.rotation.y = Math.PI;
    wheelsGroup.add(w);
  }

  // Soft ambient-occlusion shadow blob directly under the car on the floor (fades & scales as car lifts!)
  const aoCanvas = document.createElement('canvas');
  aoCanvas.width = 256;
  aoCanvas.height = 128;
  const aoCtx = aoCanvas.getContext('2d');
  const aoGrad = aoCtx.createRadialGradient(128, 64, 18, 128, 64, 122);
  aoGrad.addColorStop(0.0, 'rgba(6,7,9,0.88)');
  aoGrad.addColorStop(0.62, 'rgba(8,10,12,0.58)');
  aoGrad.addColorStop(1.0, 'rgba(8,10,12,0)');
  aoCtx.fillStyle = aoGrad;
  aoCtx.fillRect(0, 0, 256, 128);
  const aoTex = new THREE.CanvasTexture(aoCanvas);
  const contactShadowMat = new THREE.MeshBasicMaterial({
    map: aoTex,
    transparent: true,
    opacity: 0.82,
    depthWrite: false,
  });
  const contactShadow = new THREE.Mesh(new THREE.PlaneGeometry(4.85, 2.35), contactShadowMat);
  contactShadow.rotation.x = -Math.PI * 0.5;
  contactShadow.position.set(0.02, 0.004, 0.0);
  root.add(contactShadow);

  // ============================================================================
  // INTERACTIVE STATE API
  // ============================================================================
  function setLiftState(liftHeight) {
    // First 0.045m of lift unloads coil springs (wheels stay touching ground while body rises),
    // then entire car + drooped wheels rise clear off the concrete floor!
    const droop = Math.min(liftHeight, 0.045);
    bodyGroup.position.y = liftHeight;
    wheelsGroup.position.y = -droop;

    // Ground contact AO softens, expands slightly & fades as car rises off the floor
    const t = THREE.MathUtils.clamp(liftHeight / 1.15, 0, 1);
    contactShadowMat.opacity = THREE.MathUtils.lerp(0.84, 0.22, Math.pow(t, 0.65));
    const sx = THREE.MathUtils.lerp(1.0, 1.16, t);
    contactShadow.scale.set(sx, sx, 1);
    // Slight directional sun-shadow shift toward +Z/+X as car rises
    contactShadow.position.set(0.02 + liftHeight * 0.14, 0.004, liftHeight * 0.42);
  }

  function setRightDoorAngle(deg) {
    const clamped = THREE.MathUtils.clamp(deg, 0, 56);
    rightDoorPivot.rotation.y = THREE.MathUtils.degToRad(clamped);
    domeLight.intensity = clamped > 3 ? THREE.MathUtils.lerp(0, 2.2, clamped / 45) : 0.0;
  }

  function setLeftDoorAngle(deg) {
    leftDoorPivot.rotation.y = -THREE.MathUtils.degToRad(THREE.MathUtils.clamp(deg, 0, 56));
  }

  function setHeadlights(on) {
    for (const bm of headlightBulbs) {
      bm.emissive.setHex(on ? 0xffdfa0 : 0x000000);
      bm.emissiveIntensity = on ? 2.6 : 0.0;
    }
    for (const sp of headlightSpotLights) {
      sp.intensity = on ? 14.0 : 0.0;
    }
    amberTurnMat.emissiveIntensity = on ? 1.4 : 0.35;
  }

  setLiftState(0);

  return {
    root,
    bodyGroup,
    setLiftState,
    setRightDoorAngle,
    setLeftDoorAngle,
    setHeadlights,
  };
}
