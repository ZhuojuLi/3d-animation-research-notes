import * as THREE from 'three';

/**
 * Builds the complete classic restoration garage architecture & all workshop props:
 * - Oil-stained world-mapped concrete floor + slotted cast-iron drainage trench grate
 * - High-bay multi-pane industrial windows + sunlit outdoor courtyard/foliage backdrop
 * - Exposed steel I-beam roof trusses, fluorescent battens, and enameled dome pendant lamp
 * - Black SONIC 14-drawer tool cabinet + pegboard hand tools + blue parts bins + fluid jugs
 * -BMW "THE ULTIMATE DRIVING MACHINE" wall banner
 * - Tall MICHELIN 2-tier tire & parts shelving rack + Liqui Moly boxes
 * - Standalone metallic BMW engine block assembly on wooden pallet (bottom-right)
 * - Foreground rolling mechanic's service cart + spray cans + shop rag + leaning spare wheel (bottom-left)
 */
export function createGarageEnvironment({
  floorTextures,
  wallTex,
  backdropTex,
  bmwPosterTex,
  michelinTex,
  detailTextures,
  wheelFactory,
}) {
  const root = new THREE.Group();
  const { sonicTex, liquiMolyTex } = detailTextures;

  // --- Shared Architectural & Prop Materials ---
  const floorMat = new THREE.MeshStandardMaterial({
    map: floorTextures.map,
    roughnessMap: floorTextures.roughnessMap,
    bumpMap: floorTextures.bumpMap,
    bumpScale: 0.006,
    roughness: 1.0,
    metalness: 0.06,
    envMapIntensity: 0.85,
  });

  const plasterWallMat = new THREE.MeshStandardMaterial({
    map: wallTex,
    roughness: 0.88,
    metalness: 0.02,
  });

  const dadoWallMat = new THREE.MeshStandardMaterial({
    color: 0x262d36,
    roughness: 0.78,
    metalness: 0.08,
  });

  const windowFrameMat = new THREE.MeshStandardMaterial({
    color: 0x626568,
    roughness: 0.58,
    metalness: 0.45,
  });

  const steelBeamMat = new THREE.MeshStandardMaterial({
    color: 0x3b3e42,
    roughness: 0.55,
    metalness: 0.62,
  });

  const roofDeckMat = new THREE.MeshStandardMaterial({
    color: 0x4d5055,
    roughness: 0.65,
    metalness: 0.50,
  });

  const blackCabinetMat = new THREE.MeshPhysicalMaterial({
    color: 0x16181c,
    roughness: 0.34,
    metalness: 0.48,
    clearcoat: 0.25,
    envMapIntensity: 0.9,
  });

  const rackBlackMat = new THREE.MeshStandardMaterial({
    color: 0x1a1c20,
    roughness: 0.48,
    metalness: 0.55,
  });

  const brushedAluMat = new THREE.MeshStandardMaterial({
    color: 0xd4dae2,
    roughness: 0.25,
    metalness: 0.88,
  });

  const castAlloyMat = new THREE.MeshStandardMaterial({
    color: 0x9aa1aa,
    roughness: 0.34,
    metalness: 0.82,
    envMapIntensity: 1.15,
  });

  const darkIronMat = new THREE.MeshStandardMaterial({
    color: 0x2b2e33,
    roughness: 0.55,
    metalness: 0.68,
  });

  const woodPalletMat = new THREE.MeshStandardMaterial({
    color: 0x9d7a52,
    roughness: 0.85,
    metalness: 0.02,
  });

  const greyCrateMat = new THREE.MeshStandardMaterial({
    color: 0x7a7e82,
    roughness: 0.62,
    metalness: 0.05,
  });

  const blueBinMat = new THREE.MeshStandardMaterial({
    color: 0x0e4d92,
    roughness: 0.42,
    metalness: 0.08,
  });

  // ============================================================================
  // 1. OIL-STAINED CONCRETE FLOOR & SLOTTED DRAINAGE TRENCH GRATE
  // ============================================================================
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(15.0, 9.0), floorMat);
  floor.rotation.x = -Math.PI * 0.5;
  floor.position.set(-0.5, 0.0, 0.5);
  floor.receiveShadow = true;
  root.add(floor);

  // Recessed floor drainage channel running along the shop aisle ahead of the E30 bumper
  // Projects cleanly along the exact diagonal from (x≈38%, y≈76%) down to (x≈94%, y=100%)!
  {
    const drainGroup = new THREE.Group();
    const pStart = new THREE.Vector3(1.05, 0.002, 0.35);
    const pEnd = new THREE.Vector3(5.78, 0.002, 0.52);
    const drainLen = pStart.distanceTo(pEnd);
    const yaw = Math.atan2(pEnd.x - pStart.x, pEnd.z - pStart.z);

    drainGroup.position.copy(pStart).add(pEnd).multiplyScalar(0.5);
    drainGroup.rotation.y = yaw;

    // Dark recessed trench trough
    const trough = new THREE.Mesh(
      new THREE.PlaneGeometry(0.115, drainLen),
      new THREE.MeshStandardMaterial({ color: 0x101113, roughness: 0.9 })
    );
    trough.rotation.x = -Math.PI * 0.5;
    drainGroup.add(trough);

    // Steel side rails
    for (const sx of [-0.056, 0.056]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.006, drainLen), darkIronMat);
      rail.position.set(sx, 0.002, 0);
      drainGroup.add(rail);
    }

    // Instanced transverse cast-iron grate bars (170 bars!)
    const numBars = 170;
    const barGeo = new THREE.BoxGeometry(0.098, 0.005, 0.016);
    const barsInst = new THREE.InstancedMesh(barGeo, darkIronMat, numBars);
    barsInst.receiveShadow = true;
    const dummy = new THREE.Object3D();
    for (let i = 0; i < numBars; i++) {
      const zLocal = -drainLen * 0.5 + (i + 0.5) * (drainLen / numBars);
      dummy.position.set(0, 0.0025, zLocal);
      dummy.updateMatrix();
      barsInst.setMatrixAt(i, dummy.matrix);
    }
    drainGroup.add(barsInst);
    root.add(drainGroup);
  }

  // ============================================================================
  // 2. SUNLIT OUTDOOR BACKDROP & HIGH-BAY INDUSTRIAL WINDOWED WALLS
  // ============================================================================
  // Bright emissive-like outdoor panorama behind Z = -3.85 and X = -7.60
  const backdropMat = new THREE.MeshBasicMaterial({
    map: backdropTex,
    toneMapped: false,
  });
  // Slight warm-bright multiplier via vertex/color so windows glow and reflect realistically on E30 clearcoat!
  backdropMat.color.setRGB(1.22, 1.20, 1.15);

  const backBackdrop = new THREE.Mesh(new THREE.PlaneGeometry(16.0, 5.4), backdropMat);
  backBackdrop.position.set(-0.4, 2.35, -4.65);
  root.add(backBackdrop);

  const leftBackdrop = new THREE.Mesh(new THREE.PlaneGeometry(9.5, 5.2), backdropMat);
  leftBackdrop.position.set(-8.35, 2.35, 0.4);
  leftBackdrop.rotation.y = Math.PI * 0.5;
  root.add(leftBackdrop);

  // Helper to construct a multi-pane steel factory window grid in the X-Y plane (at Z = -3.84)
  const paneGlassMat = new THREE.MeshPhysicalMaterial({
    color: 0xf4f8fc,
    roughness: 0.08,
    metalness: 0.05,
    transparent: true,
    opacity: 0.16,
    envMapIntensity: 0.9,
  });

  function addMultiPaneWindowXY(x0, x1, y0, y1, zPos, cols, rows) {
    const wg = new THREE.Group();
    const w = x1 - x0;
    const h = y1 - y0;
    const cx = (x0 + x1) * 0.5;
    const cy = (y0 + y1) * 0.5;

    // Outer steel frame
    const frameThick = 0.055, frameDepth = 0.09;
    const topF = new THREE.Mesh(new THREE.BoxGeometry(w, frameThick, frameDepth), windowFrameMat);
    topF.position.set(cx, y1 - frameThick * 0.5, zPos);
    const botF = new THREE.Mesh(new THREE.BoxGeometry(w, frameThick + 0.03, frameDepth + 0.04), windowFrameMat);
    botF.position.set(cx, y0 + frameThick * 0.5, zPos);
    wg.add(topF, botF);

    // Vertical mullions
    for (let c = 0; c <= cols; c++) {
      const x = x0 + (c / cols) * w;
      const mul = new THREE.Mesh(
        new THREE.BoxGeometry(c === 0 || c === cols ? frameThick : 0.028, h, frameDepth * 0.75),
        windowFrameMat
      );
      mul.position.set(x, cy, zPos);
      mul.castShadow = true;
      wg.add(mul);
    }

    // Horizontal transoms
    for (let r = 1; r < rows; r++) {
      const y = y0 + (r / rows) * h;
      const tr = new THREE.Mesh(new THREE.BoxGeometry(w, 0.026, frameDepth * 0.7), windowFrameMat);
      tr.position.set(cx, y, zPos);
      tr.castShadow = true;
      wg.add(tr);
    }

    // Subtle glass sheet
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.06, h - 0.06), paneGlassMat);
    glass.position.set(cx, cy, zPos);
    wg.add(glass);

    root.add(wg);
  }

  // --- Long Back-Right Wall at Z = -3.85 (X from -7.6 to +6.8, height 4.55m) ---
  const WALL_Z = -3.85;
  const CEIL_Y = 4.50;

  // Continuous lower solid workshop wall (Y: 0 .. 1.58m) with dark dado band
  const lowerWall = new THREE.Mesh(new THREE.BoxGeometry(14.6, 1.58, 0.22), dadoWallMat);
  lowerWall.position.set(-0.3, 0.79, WALL_Z);
  lowerWall.receiveShadow = true;
  lowerWall.castShadow = true;
  root.add(lowerWall);

  // Concrete wall below the high right-hand clerestory window (behind tire rack: X = +1.82 .. +4.55, Y = 1.58 .. 3.05)
  const rackBackWall = new THREE.Mesh(new THREE.BoxGeometry(2.75, 1.50, 0.22), plasterWallMat);
  rackBackWall.position.set(3.18, 2.32, WALL_Z);
  rackBackWall.receiveShadow = true;
  rackBackWall.castShadow = true;
  root.add(rackBackWall);

  // Structural Concrete Piers along Z = -3.85 (cast real raking shadows between sunlit window bays!)
  const piers = [
    { x0: -7.65, x1: -5.20 }, // Back-left corner solid wall section
    { x0: -2.55, x1: -2.22 }, // Narrow mullion pier between Window Bay 1 & Bay 2 (holds small framed picture!)
    { x0: +0.62, x1: +1.85 }, // Wide concrete pier holding the BMW Banner Poster!
    { x0: +4.35, x1: +6.95 }, // Far-right pier
  ];
  for (const p of piers) {
    const pw = p.x1 - p.x0;
    const pier = new THREE.Mesh(new THREE.BoxGeometry(pw, CEIL_Y, 0.28), plasterWallMat);
    pier.position.set((p.x0 + p.x1) * 0.5, CEIL_Y * 0.5, WALL_Z + 0.02);
    pier.castShadow = true;
    pier.receiveShadow = true;
    root.add(pier);
  }

  // Upper wall lintel above windows (Y: 4.24 .. 4.55)
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(14.6, 0.32, 0.26), plasterWallMat);
  lintel.position.set(-0.3, 4.39, WALL_Z);
  lintel.castShadow = true;
  root.add(lintel);

  // Three Tall Multi-Pane Industrial Windows along Z = -3.84:
  addMultiPaneWindowXY(-5.20, -2.55, 1.58, 4.24, WALL_Z + 0.02, 4, 6); // Left window bay
  addMultiPaneWindowXY(-2.22, +0.62, 1.58, 4.24, WALL_Z + 0.02, 4, 6); // Center window bay
  addMultiPaneWindowXY(+1.85, +4.35, 3.05, 4.24, WALL_Z + 0.02, 4, 3); // Right high window above tire rack!

  // Small framed vintage certificate on center mullion pier (-2.38, 2.75) matching reference-0.png!
  const smallFrame = new THREE.Mesh(
    new THREE.BoxGeometry(0.18, 0.26, 0.02),
    new THREE.MeshStandardMaterial({ color: 0x8b693e, roughness: 0.6 })
  );
  smallFrame.position.set(-2.38, 2.74, WALL_Z + 0.17);
  root.add(smallFrame);

  // --- Back-Left End Wall at X = -7.60 with Glazed Sectional Garage Door ---
  const END_X = -7.60;
  // Solid wall segments flanking & above the sectional door (door spans Z = -2.90 .. +1.20, Y = 0 .. 3.35)
  const endWallLeft = new THREE.Mesh(new THREE.BoxGeometry(0.24, CEIL_Y, 1.10), plasterWallMat);
  endWallLeft.position.set(END_X, CEIL_Y * 0.5, -3.40);
  root.add(endWallLeft);

  const endWallRight = new THREE.Mesh(new THREE.BoxGeometry(0.24, CEIL_Y, 3.80), plasterWallMat);
  endWallRight.position.set(END_X, CEIL_Y * 0.5, +3.10);
  root.add(endWallRight);

  const endWallHeader = new THREE.Mesh(new THREE.BoxGeometry(0.24, 1.18, 4.20), plasterWallMat);
  endWallHeader.position.set(END_X, 3.92, -0.85);
  root.add(endWallHeader);

  // Sectional Garage Door: solid lower panels (Y: 0..1.42) + glazed multi-pane window band (Y: 1.42..2.92) + top panel
  const doorPanelMat = new THREE.MeshStandardMaterial({ color: 0x9fa2a6, roughness: 0.62, metalness: 0.25 });
  const doorLow = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.42, 4.10), doorPanelMat);
  doorLow.position.set(END_X + 0.06, 0.71, -0.85);
  doorLow.receiveShadow = true;
  root.add(doorLow);

  const doorTopPanel = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.44, 4.10), doorPanelMat);
  doorTopPanel.position.set(END_X + 0.06, 3.14, -0.85);
  root.add(doorTopPanel);

  // Glazed grid in the sectional door (Z: -2.90 .. +1.20, Y: 1.42 .. 2.92)
  {
    const dg = new THREE.Group();
    const z0 = -2.90, z1 = 1.20, y0 = 1.42, y1 = 2.92;
    const cols = 5, rows = 4;
    for (let c = 0; c <= cols; c++) {
      const z = z0 + (c / cols) * (z1 - z0);
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.05, y1 - y0, 0.032), windowFrameMat);
      bar.position.set(END_X + 0.06, (y0 + y1) * 0.5, z);
      dg.add(bar);
    }
    for (let r = 0; r <= rows; r++) {
      const y = y0 + (r / rows) * (y1 - y0);
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.032, z1 - z0), windowFrameMat);
      bar.position.set(END_X + 0.06, y, (z0 + z1) * 0.5);
      dg.add(bar);
    }
    const dGlass = new THREE.Mesh(new THREE.PlaneGeometry(z1 - z0, y1 - y0), paneGlassMat);
    dGlass.rotation.y = Math.PI * 0.5;
    dGlass.position.set(END_X + 0.06, (y0 + y1) * 0.5, (z0 + z1) * 0.5);
    dg.add(dGlass);
    root.add(dg);
  }

  // Opposite (+Z = +4.95) & Front (+X = +6.95) Walls so 360° OrbitControls stays inside an enclosed garage!
  const frontWall = new THREE.Mesh(new THREE.BoxGeometry(0.24, CEIL_Y, 9.0), plasterWallMat);
  frontWall.position.set(6.95, CEIL_Y * 0.5, 0.5);
  frontWall.receiveShadow = true;
  root.add(frontWall);

  const sideWallPlusZ = new THREE.Mesh(new THREE.BoxGeometry(14.6, CEIL_Y, 0.24), plasterWallMat);
  sideWallPlusZ.position.set(-0.3, CEIL_Y * 0.5, 4.95);
  sideWallPlusZ.receiveShadow = true;
  root.add(sideWallPlusZ);

  const sideDadoPlusZ = new THREE.Mesh(new THREE.BoxGeometry(14.5, 1.55, 0.26), dadoWallMat);
  sideDadoPlusZ.position.set(-0.3, 0.775, 4.93);
  root.add(sideDadoPlusZ);

  // ============================================================================
  // 3. EXPOSED INDUSTRIAL CEILING BEAMS, CONDUITS & VINTAGE PENDANT DOME LAMP
  // ============================================================================
  const ceilingSlab = new THREE.Mesh(new THREE.PlaneGeometry(15.0, 9.2), roofDeckMat);
  ceilingSlab.rotation.x = Math.PI * 0.5;
  ceilingSlab.position.set(-0.3, CEIL_Y, 0.5);
  root.add(ceilingSlab);

  // Transverse steel I-beams across Z
  for (const bx of [-6.8, -4.3, -1.8, +0.7, +3.2, +5.7]) {
    const web = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.24, 9.0), steelBeamMat);
    web.position.set(bx, CEIL_Y - 0.14, 0.5);
    const botFlange = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.025, 9.0), steelBeamMat);
    botFlange.position.set(bx, CEIL_Y - 0.26, 0.5);
    root.add(web, botFlange);
  }
  // Longitudinal steel purlins along X
  for (const pz of [-3.55, -1.25, +1.15, +3.45]) {
    const purlin = new THREE.Mesh(new THREE.BoxGeometry(14.6, 0.11, 0.09), steelBeamMat);
    purlin.position.set(-0.3, CEIL_Y - 0.08, pz);
    root.add(purlin);
  }

  // Twin-tube ceiling fluorescent batten light fixture at top-left (visible in reference-0.png!)
  {
    const batten = new THREE.Group();
    batten.position.set(-4.6, 4.18, -1.65);
    const housing = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.05, 1.55), brushedAluMat);
    batten.add(housing);
    const tubeMat = new THREE.MeshBasicMaterial({ color: 0xf7fbff });
    for (const tx of [-0.04, 0.04]) {
      const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 1.48, 8), tubeMat);
      tube.rotation.x = Math.PI * 0.5;
      tube.position.set(tx, -0.032, 0);
      batten.add(tube);
    }
    root.add(batten);
  }

  // Corner orange junction box & conduit pipes (visible in back-left corner of reference-0.png!)
  const jBox = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 0.16, 0.12),
    new THREE.MeshStandardMaterial({ color: 0xc95b24, roughness: 0.5 })
  );
  jBox.position.set(-7.35, 3.62, -3.55);
  root.add(jBox);

  // Iconic Black/White Enameled Dome Pendant Lamp hanging at top-center (x≈45.5%, y≈5.5% in ref!)
  {
    const pendant = new THREE.Group();
    pendant.position.set(0.78, 2.94, -0.82);

    const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 1.55, 8), rackBlackMat);
    cord.position.y = 0.80;
    pendant.add(cord);

    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.052, 0.09, 16), rackBlackMat);
    neck.position.y = 0.06;
    pendant.add(neck);

    const shadePts = [
      new THREE.Vector2(0.048, 0.03),
      new THREE.Vector2(0.115, 0.01),
      new THREE.Vector2(0.185, -0.06),
      new THREE.Vector2(0.215, -0.11),
    ];
    const shadeOuter = new THREE.Mesh(new THREE.LatheGeometry(shadePts, 28), rackBlackMat);
    pendant.add(shadeOuter);

    const shadeInner = new THREE.Mesh(
      new THREE.LatheGeometry(shadePts, 28),
      new THREE.MeshBasicMaterial({ color: 0xfff8eb, side: THREE.BackSide })
    );
    shadeInner.scale.set(0.97, 0.97, 0.97);
    pendant.add(shadeInner);

    const bulb = new THREE.Mesh(
      new THREE.SphereGeometry(0.042, 16, 12),
      new THREE.MeshBasicMaterial({ color: 0xfffdf2 })
    );
    bulb.position.y = -0.055;
    pendant.add(bulb);

    root.add(pendant);
  }

  // ============================================================================
  // 4. BMW WALL BANNER POSTER + SONIC 14-DRAWER TOOL CABINET + PEGBOARD + BINS
  // ============================================================================
  // BMW Poster hanging on the wide concrete pier (X = +1.22, Y = 2.68, Z = -3.69)
  const poster = new THREE.Mesh(
    new THREE.PlaneGeometry(0.84, 1.66),
    new THREE.MeshStandardMaterial({ map: bmwPosterTex, roughness: 0.62, metalness: 0.05 })
  );
  poster.position.set(1.22, 2.68, WALL_Z + 0.168);
  poster.receiveShadow = true;
  root.add(poster);

  // Black SONIC 14-Drawer Roller Tool Chest & Workbench (X: -0.22 .. +1.34, Z: -3.42)
  {
    const sonic = new THREE.Group();
    sonic.position.set(0.56, 0, -3.40);

    const cabW = 1.52, cabH = 0.94, cabD = 0.62;
    const body = new THREE.Mesh(new THREE.BoxGeometry(cabW, cabH, cabD), blackCabinetMat);
    body.position.y = 0.09 + cabH * 0.5;
    body.castShadow = true;
    body.receiveShadow = true;
    sonic.add(body);

    // Top stainless/dark worktop lip
    const worktop = new THREE.Mesh(new THREE.BoxGeometry(cabW + 0.03, 0.035, cabD + 0.03), darkIronMat);
    worktop.position.y = 0.09 + cabH + 0.018;
    sonic.add(worktop);

    // 4 heavy caster wheels
    for (const cx of [-cabW * 0.44, cabW * 0.44]) {
      for (const cz of [-cabD * 0.38, cabD * 0.38]) {
        const caster = new THREE.Mesh(new THREE.CylinderGeometry(0.044, 0.044, 0.036, 14), rackBlackMat);
        caster.rotation.z = Math.PI * 0.5;
        caster.position.set(cx, 0.045, cz);
        sonic.add(caster);
      }
    }

    // Two banks of drawers (left wide bank 0.90m, right narrow bank 0.50m) with bright silver pulls!
    const drawerHeights = [0.085, 0.085, 0.095, 0.105, 0.115, 0.145, 0.195];
    let curY = 0.98;
    for (const dh of drawerHeights) {
      curY -= dh + 0.008;
      // Left wide drawer + pull bar
      const dL = new THREE.Mesh(new THREE.BoxGeometry(0.88, dh, 0.018), blackCabinetMat);
      dL.position.set(-0.27, curY + dh * 0.5, cabD * 0.5 + 0.008);
      sonic.add(dL);
      const pullL = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.014, 0.026), brushedAluMat);
      pullL.position.set(-0.27, curY + dh - 0.015, cabD * 0.5 + 0.014);
      sonic.add(pullL);

      // Right narrow drawer + pull bar
      const dR = new THREE.Mesh(new THREE.BoxGeometry(0.50, dh, 0.018), blackCabinetMat);
      dR.position.set(+0.46, curY + dh * 0.5, cabD * 0.5 + 0.008);
      sonic.add(dR);
      const pullR = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.014, 0.026), brushedAluMat);
      pullR.position.set(+0.46, curY + dh - 0.015, cabD * 0.5 + 0.014);
      sonic.add(pullR);
    }

    // Crisp "SONIC" badges at top-right fascia and bottom-right drawer
    const sonicMat = new THREE.MeshStandardMaterial({ map: sonicTex, roughness: 0.35 });
    const badgeTop = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 0.042), sonicMat);
    badgeTop.position.set(0.52, 0.99, cabD * 0.5 + 0.020);
    const badgeBot = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.056), sonicMat);
    badgeBot.position.set(0.46, 0.22, cabD * 0.5 + 0.022);
    sonic.add(badgeTop, badgeBot);

    // Dark Pegboard mounted above worktop (Y: 1.06 .. 1.72) with hanging wrenches & screwdrivers!
    const pegboard = new THREE.Mesh(new THREE.BoxGeometry(1.48, 0.66, 0.025), rackBlackMat);
    pegboard.position.set(0, 1.39, -cabD * 0.44);
    sonic.add(pegboard);

    // Graded row of 12 chrome combination wrenches hanging on pegboard
    for (let w = 0; w < 12; w++) {
      const len = 0.14 + w * 0.014;
      const wrench = new THREE.Mesh(new THREE.BoxGeometry(0.014, len, 0.006), brushedAluMat);
      wrench.position.set(-0.56 + w * 0.052, 1.60 - len * 0.5, -cabD * 0.41);
      sonic.add(wrench);
    }
    // Red/blue handle screwdrivers & pliers on right half of pegboard
    const redToolMat = new THREE.MeshStandardMaterial({ color: 0xc82822, roughness: 0.4 });
    for (let s = 0; s < 7; s++) {
      const hdl = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.010, 0.08, 8), s % 2 === 0 ? redToolMat : blueBinMat);
      hdl.position.set(0.14 + s * 0.065, 1.56, -cabD * 0.40);
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.12, 6), brushedAluMat);
      shaft.position.set(0.14 + s * 0.065, 1.46, -cabD * 0.40);
      sonic.add(hdl, shaft);
    }

    // Bottles, spray cans & small trays on workbench top
    const bottleCols = [0x2268b0, 0xd9a018, 0xc82c24, 0x2a8844, 0xd8dce0];
    for (let b = 0; b < 7; b++) {
      const bh = 0.14 + (b % 3) * 0.04;
      const can = new THREE.Mesh(
        new THREE.CylinderGeometry(0.032, 0.034, bh, 12),
        new THREE.MeshStandardMaterial({ color: bottleCols[b % bottleCols.length], roughness: 0.35 })
      );
      can.position.set(-0.55 + b * 0.18, 1.05 + bh * 0.5, -0.05 + (b % 2) * 0.12);
      sonic.add(can);
    }

    root.add(sonic);
  }

  // Stacked Blue Small-Parts Bin Organizer + Floor Fluid Jugs (between SONIC chest and Tire Rack: X = 1.45..2.02)
  {
    const binGroup = new THREE.Group();
    binGroup.position.set(1.74, 0, -3.40);

    // Lower dark storage cabinet crate
    const lowCrate = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.88, 0.48), rackBlackMat);
    lowCrate.position.y = 0.44;
    lowCrate.castShadow = true;
    binGroup.add(lowCrate);

    // 4 cols x 6 rows of bright cobalt-blue parts bins (Y: 0.90 .. 1.66, clearly visible in reference-0.png!)
    for (let r = 0; r < 6; r++) {
      for (let c = 0; c < 4; c++) {
        const bin = new THREE.Mesh(new THREE.BoxGeometry(0.115, 0.105, 0.36), blueBinMat);
        bin.position.set(-0.18 + c * 0.12, 0.96 + r * 0.118, 0.04);
        binGroup.add(bin);
      }
    }

    // White & grey 5L fluid jugs sitting on floor in front (matching reference-0.png x=68..78%, y=59..68%)
    const whiteJugMat = new THREE.MeshStandardMaterial({ color: 0xdadbd6, roughness: 0.45 });
    const jug1 = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.34, 0.16), whiteJugMat);
    jug1.position.set(-0.28, 0.17, 0.42);
    jug1.rotation.y = 0.25;
    jug1.castShadow = true;
    const jug2 = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.31, 0.15), whiteJugMat);
    jug2.position.set(0.18, 0.155, 0.44);
    jug2.rotation.y = -0.18;
    jug2.castShadow = true;
    const capYellow = new THREE.Mesh(
      new THREE.CylinderGeometry(0.025, 0.025, 0.03, 10),
      new THREE.MeshStandardMaterial({ color: 0xe2a818 })
    );
    capYellow.position.set(0.18, 0.32, 0.44);
    binGroup.add(jug1, jug2, capYellow);

    root.add(binGroup);
  }

  // ============================================================================
  // 5. TALL "MICHELIN" TIRE & PARTS RACK + STANDALONE ENGINE BLOCK ON PALLET
  // ============================================================================
  {
    const rack = new THREE.Group();
    rack.position.set(3.22, 0, -3.32); // Spans X from +2.10 to +4.34 (width = 2.24m)

    const RW = 2.24, RD = 0.72, RH = 3.05;
    // 4 vertical slotted steel angle uprights
    for (const ux of [-RW * 0.5, RW * 0.5]) {
      for (const uz of [-RD * 0.5, RD * 0.5]) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.055, RH, 0.055), rackBlackMat);
        post.position.set(ux, RH * 0.5, uz);
        post.castShadow = true;
        rack.add(post);
      }
      // Diagonal side bracing struts
      for (const by of [0.65, 1.55, 2.45]) {
        const brace = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, RD * 1.12), rackBlackMat);
        brace.position.set(ux, by, 0);
        brace.rotation.x = 0.52;
        rack.add(brace);
      }
    }

    // Horizontal shelf beams at Y = 0.86, 1.38, 1.88, 2.66
    const shelfLevels = [0.86, 1.38, 1.88, 2.66];
    for (const sy of shelfLevels) {
      for (const sz of [-RD * 0.46, RD * 0.46]) {
        const beam = new THREE.Mesh(new THREE.BoxGeometry(RW, 0.052, 0.045), rackBlackMat);
        beam.position.set(0, sy, sz);
        beam.castShadow = true;
        rack.add(beam);
      }
      // Shelf deck plate on lower two parts shelves (0.86 & 1.38)
      if (sy < 1.6) {
        const deck = new THREE.Mesh(new THREE.BoxGeometry(RW - 0.06, 0.022, RD - 0.06), darkIronMat);
        deck.position.set(0, sy + 0.015, 0);
        deck.receiveShadow = true;
        deck.castShadow = true;
        rack.add(deck);
      }
    }

    // MICHELIN Banner sign across the front upper beam (Y = 2.48 .. 2.72)
    const michSign = new THREE.Mesh(
      new THREE.PlaneGeometry(1.58, 0.27),
      new THREE.MeshStandardMaterial({ map: michelinTex, roughness: 0.42, metalness: 0.12 })
    );
    michSign.position.set(0.04, 2.56, RD * 0.49);
    rack.add(michSign);

    // Top Tier (Y = 2.96) & Second Tier (Y = 2.16): Stacked Rows of Vertical Radial Tires!
    // Each tire has width ~0.215m -> rotated Y=90° so its axle runs along X and tread faces viewer (+Z)!
    for (let i = 0; i < 8; i++) {
      const tTop = wheelFactory.createUnmountedTire();
      tTop.rotation.y = Math.PI * 0.5 + (i % 2 === 0 ? 0.03 : -0.02);
      tTop.rotation.z = 0.08;
      tTop.position.set(-0.88 + i * 0.248, 2.95 + (i > 4 ? 0.025 : 0), 0.02);
      rack.add(tTop);
    }
    for (let i = 0; i < 7; i++) {
      const tMid = wheelFactory.createUnmountedTire();
      tMid.rotation.y = Math.PI * 0.5 + 0.04;
      tMid.position.set(-0.82 + i * 0.265, 2.15, 0.02);
      rack.add(tMid);
    }

    // Shelf 3 (Y = 1.40): Grey Euro parts boxes, red torque-wrench case, small cardboard boxes
    const crate1 = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.16, 0.38), greyCrateMat);
    crate1.position.set(-0.76, 1.48, 0.08);
    const crate2 = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.14, 0.36), greyCrateMat);
    crate2.position.set(-0.18, 1.47, 0.06);
    const redCase = new THREE.Mesh(
      new THREE.BoxGeometry(0.62, 0.08, 0.22),
      new THREE.MeshStandardMaterial({ color: 0xb8241e, roughness: 0.45 })
    );
    redCase.position.set(0.18, 1.58, 0.06);
    const boxKraftMat = new THREE.MeshStandardMaterial({ color: 0x9b7c56, roughness: 0.85 });
    const cBox1 = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.18, 0.30), boxKraftMat);
    cBox1.position.set(0.55, 1.49, 0.05);
    rack.add(crate1, crate2, redCase, cBox1);

    // Shelf 2 (Y = 0.88): Large grey lidded Euro storage tote + cardboard parts box
    const bigTote = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.26, 0.46), greyCrateMat);
    bigTote.position.set(-0.56, 1.02, 0.06);
    bigTote.castShadow = true;
    const toteLid = new THREE.Mesh(new THREE.BoxGeometry(0.70, 0.035, 0.48), darkIronMat);
    toteLid.position.set(-0.56, 1.16, 0.06);
    const cBox2 = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.24, 0.36), boxKraftMat);
    cBox2.position.set(0.72, 1.01, 0.08);
    rack.add(bigTote, toteLid, cBox2);

    // Floor Bay Left (X local: -0.95 .. -0.35): LIQUI MOLY carton, battery, yellow tool box
    const liquiBox = new THREE.Mesh(
      new THREE.BoxGeometry(0.35, 0.27, 0.27),
      new THREE.MeshStandardMaterial({ map: liquiMolyTex, roughness: 0.65 })
    );
    liquiBox.position.set(-0.74, 0.135, 0.18);
    liquiBox.rotation.y = 0.08;
    liquiBox.castShadow = true;

    const yellowTopBox = new THREE.Mesh(
      new THREE.BoxGeometry(0.33, 0.15, 0.25),
      new THREE.MeshStandardMaterial({ color: 0xd49c1a, roughness: 0.5 })
    );
    yellowTopBox.position.set(-0.74, 0.345, 0.14);
    rack.add(liquiBox, yellowTopBox);

    // Floor Bay Right (X local: -0.25 .. +0.72): STANDALONE METALLIC BMW ENGINE BLOCK ON WOODEN PALLET!
    const engGroup = new THREE.Group();
    engGroup.position.set(0.18, 0, 0.20);
    engGroup.rotation.y = -0.12;

    // Slatted wooden mini-pallet (0.86m x 0.58m x 0.10m)
    for (const px of [-0.36, 0, 0.36]) {
      const runner = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.075, 0.56), woodPalletMat);
      runner.position.set(px, 0.038, 0);
      runner.castShadow = true;
      engGroup.add(runner);
    }
    for (let s = -2; s <= 2; s++) {
      const slat = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.022, 0.085), woodPalletMat);
      slat.position.set(0, 0.086, s * 0.11);
      slat.castShadow = true;
      engGroup.add(slat);
    }

    // Cast-alloy Oil Sump, Ribbed Cylinder Block, Cylinder Head, Finned Valve Cover, Pulleys & Bellhousing!
    const sump = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.12, 0.28), castAlloyMat);
    sump.position.set(-0.04, 0.16, 0);
    engGroup.add(sump);

    const block = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.24, 0.26), darkIronMat);
    block.position.set(-0.04, 0.33, 0);
    block.castShadow = true;
    engGroup.add(block);

    // External block casting ribs & freeze plugs facing viewer (+Z)
    for (let r = -2; r <= 2; r++) {
      const rib = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.20, 0.29), castAlloyMat);
      rib.position.set(-0.04 + r * 0.11, 0.33, 0);
      engGroup.add(rib);

      const port = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.06, 12), brushedAluMat);
      port.rotation.x = Math.PI * 0.5;
      port.position.set(-0.04 + r * 0.10, 0.48, 0.14);
      engGroup.add(port);
    }

    const cylHead = new THREE.Mesh(new THREE.BoxGeometry(0.60, 0.14, 0.30), castAlloyMat);
    cylHead.position.set(-0.04, 0.50, 0);
    cylHead.castShadow = true;
    engGroup.add(cylHead);

    const valveCover = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.075, 0.24), brushedAluMat);
    valveCover.position.set(-0.04, 0.60, -0.01);
    valveCover.rotation.x = 0.12; // classic BMW canted head!
    engGroup.add(valveCover);

    const oilFillerCap = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.025, 12), rackBlackMat);
    oilFillerCap.position.set(-0.22, 0.645, -0.01);
    engGroup.add(oilFillerCap);

    // Bellhousing / flywheel flange on right (+X) end & timing pulleys on left (-X) end
    const bellHousing = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.12, 24), darkIronMat);
    bellHousing.rotation.z = Math.PI * 0.5;
    bellHousing.position.set(0.28, 0.32, 0);
    bellHousing.castShadow = true;
    engGroup.add(bellHousing);

    const crankPulley = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.045, 20), rackBlackMat);
    crankPulley.rotation.z = Math.PI * 0.5;
    crankPulley.position.set(-0.36, 0.26, 0);
    const wpPulley = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.058, 0.038, 18), brushedAluMat);
    wpPulley.rotation.z = Math.PI * 0.5;
    wpPulley.position.set(-0.35, 0.44, 0.02);
    engGroup.add(crankPulley, wpPulley);

    rack.add(engGroup);
    root.add(rack);
  }

  // ============================================================================
  // 6. FOREGROUND MECHANIC'S ROLLING TOOL CART, CANS & SPARE WHEEL (BOTTOM-LEFT)
  // ============================================================================
  const foregroundProps = new THREE.Group();
  {
    // Placed right beside the default camera's front-left so it frames bottom-left (x: 0..24%, y: 58..100%)
    const cart = new THREE.Group();
    cart.position.set(4.25, 0, 2.60);
    cart.rotation.y = 0.28;

    const cw = 0.78, cd = 0.50, ch = 0.74;
    // Lower tray, corner legs & upper deep mechanic tray
    const lowTray = new THREE.Mesh(new THREE.BoxGeometry(cw, 0.05, cd), blackCabinetMat);
    lowTray.position.y = 0.14;
    cart.add(lowTray);

    const topTrayBox = new THREE.Mesh(new THREE.BoxGeometry(cw, 0.17, cd), blackCabinetMat);
    topTrayBox.position.y = ch - 0.085;
    topTrayBox.castShadow = true;
    topTrayBox.receiveShadow = true;
    cart.add(topTrayBox);

    // Small white inventory sticker on front-right face of cart (matching reference-0.png!)
    const cartSticker = new THREE.Mesh(
      new THREE.PlaneGeometry(0.085, 0.052),
      new THREE.MeshStandardMaterial({ color: 0xd8dce0, roughness: 0.5 })
    );
    cartSticker.position.set(cw * 0.24, ch - 0.075, cd * 0.5 + 0.003);
    cart.add(cartSticker);

    for (const lx of [-cw * 0.47, cw * 0.47]) {
      for (const lz of [-cd * 0.46, cd * 0.46]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.036, ch, 0.036), rackBlackMat);
        leg.position.set(lx, ch * 0.5, lz);
        cart.add(leg);
      }
    }

    // White/blue/red brake-cleaner aerosol spray can + black oil filter canister on visible right-front of cart!
    const sprayCan = new THREE.Mesh(
      new THREE.CylinderGeometry(0.036, 0.036, 0.21, 16),
      new THREE.MeshStandardMaterial({ color: 0xe6e9ee, roughness: 0.32 })
    );
    sprayCan.position.set(0.06, ch + 0.095, 0.14);
    const sprayBand = new THREE.Mesh(
      new THREE.CylinderGeometry(0.0368, 0.0368, 0.095, 16),
      new THREE.MeshStandardMaterial({ color: 0x1b64b0, roughness: 0.35 })
    );
    sprayBand.position.set(0.06, ch + 0.085, 0.14);
    const sprayCap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.022, 0.026, 0.044, 12),
      new THREE.MeshStandardMaterial({ color: 0xd83222, roughness: 0.4 })
    );
    sprayCap.position.set(0.06, ch + 0.215, 0.14);

    const blackCanister = new THREE.Mesh(
      new THREE.CylinderGeometry(0.042, 0.042, 0.165, 16),
      new THREE.MeshStandardMaterial({ color: 0x181a1e, roughness: 0.32, metalness: 0.48 })
    );
    blackCanister.position.set(0.16, ch + 0.075, 0.10);

    // Red-handled screwdriver, chrome ratchet wrench & folded dark mechanic's shop cloth on cart tray!
    const redDriver = new THREE.Mesh(
      new THREE.CylinderGeometry(0.015, 0.015, 0.14, 10),
      new THREE.MeshStandardMaterial({ color: 0xd43226, roughness: 0.45 })
    );
    redDriver.rotation.z = Math.PI * 0.46;
    redDriver.rotation.y = 0.45;
    redDriver.position.set(0.12, ch + 0.018, 0.18);

    const ratchet = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.012, 0.018), brushedAluMat);
    ratchet.position.set(0.20, ch + 0.012, 0.06);
    ratchet.rotation.y = -0.35;

    const ragFold1 = new THREE.Mesh(
      new THREE.BoxGeometry(0.19, 0.024, 0.15),
      new THREE.MeshStandardMaterial({ color: 0x52504e, roughness: 0.94 })
    );
    ragFold1.position.set(0.24, ch + 0.016, 0.14);
    ragFold1.rotation.y = 0.28;
    const ragFold2 = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, 0.022, 0.12),
      new THREE.MeshStandardMaterial({ color: 0x625f5c, roughness: 0.94 })
    );
    ragFold2.position.set(0.22, ch + 0.032, 0.13);
    ragFold2.rotation.set(0.08, -0.22, -0.06);

    cart.add(sprayCan, sprayBand, sprayCap, blackCanister, redDriver, ratchet, ragFold1, ragFold2);
    foregroundProps.add(cart);

    // Foreground Spare Wheel arc at bottom-left edge in front of tool cart (x: 2..25%, y: 91..100% in ref!)
    const fgWheel = wheelFactory.createBBSWheel({ includeBrakes: false });
    fgWheel.position.set(4.92, 0.05, 2.54);
    fgWheel.rotation.y = 0.68;
    fgWheel.rotation.x = -0.22;
    foregroundProps.add(fgWheel);
  }
  root.add(foregroundProps);

  return {
    root,
    foregroundProps,
  };
}
