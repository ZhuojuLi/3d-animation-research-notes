import * as THREE from 'three';

function getPointedArchPoints(halfW, ySpring, pointFactor = 0.24, segments = 28) {
  const ecc = halfW * pointFactor;
  const radius = halfW + ecc;
  const maxAngle = Math.acos(ecc / radius);
  const pts = [];

  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * maxAngle;
    pts.push(new THREE.Vector2(-ecc + Math.cos(a) * radius, ySpring + Math.sin(a) * radius));
  }
  for (let i = 1; i <= segments; i++) {
    const a = (Math.PI - maxAngle) + (i / segments) * maxAngle;
    pts.push(new THREE.Vector2(ecc + Math.cos(a) * radius, ySpring + Math.sin(a) * radius));
  }
  return pts;
}

function applyBoxTriplanarUV(geo, scale = 0.55) {
  const pos = geo.attributes.position;
  const nrm = geo.attributes.normal;
  const uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const ax = Math.abs(nrm.getX(i));
    const ay = Math.abs(nrm.getY(i));
    const az = Math.abs(nrm.getZ(i));
    if (ay >= ax && ay >= az) {
      uv.setXY(i, x * scale, z * scale);
    } else if (ax >= az) {
      uv.setXY(i, z * scale, y * scale);
    } else {
      uv.setXY(i, x * scale, y * scale);
    }
  }
}

function createArchivoltBand(innerHalfW, outerHalfW, ySpring, depth, pointFactor, material, zPos) {
  const outerPts = getPointedArchPoints(outerHalfW, ySpring, pointFactor, 32);
  const innerPts = getPointedArchPoints(innerHalfW, ySpring, pointFactor, 32).reverse();

  const shape = new THREE.Shape();
  shape.moveTo(outerPts[0].x, outerPts[0].y);
  for (let i = 1; i < outerPts.length; i++) shape.lineTo(outerPts[i].x, outerPts[i].y);
  for (let i = 0; i < innerPts.length; i++) shape.lineTo(innerPts[i].x, innerPts[i].y);
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: 0.018,
    bevelSize: 0.015,
    bevelSegments: 2,
    curveSegments: 18
  });

  applyBoxTriplanarUV(geo, 0.62);
  geo.computeVertexNormals();

  const mesh = new THREE.Mesh(geo, material);
  mesh.position.z = zPos;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function createColonnette(material, darkCreviceMat, heightShaft = 0.88) {
  const col = new THREE.Group();

  const plinthGeo = new THREE.BoxGeometry(0.20, 0.14, 0.20);
  applyBoxTriplanarUV(plinthGeo, 0.8);
  const plinth = new THREE.Mesh(plinthGeo, material);
  plinth.position.y = 0.07;
  plinth.castShadow = true;
  plinth.receiveShadow = true;
  col.add(plinth);

  const basePts = [
    new THREE.Vector2(0.001, 0.00),
    new THREE.Vector2(0.096, 0.00),
    new THREE.Vector2(0.102, 0.025),
    new THREE.Vector2(0.080, 0.052),
    new THREE.Vector2(0.072, 0.074),
    new THREE.Vector2(0.085, 0.098),
    new THREE.Vector2(0.066, 0.118)
  ];
  const baseMesh = new THREE.Mesh(new THREE.LatheGeometry(basePts, 20), material);
  baseMesh.position.y = 0.14;
  baseMesh.castShadow = true;
  baseMesh.receiveShadow = true;
  col.add(baseMesh);

  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.066, heightShaft, 20, 4), material);
  shaft.position.y = 0.258 + heightShaft * 0.5;
  shaft.castShadow = true;
  shaft.receiveShadow = true;
  col.add(shaft);

  // Mid-shaft stone drum seam
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.065, 0.006, 8, 20), darkCreviceMat);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.258 + heightShaft * 0.52;
  col.add(ring);

  // Carved Romanesque foliate capital
  const capY = 0.258 + heightShaft;
  const neckRing = new THREE.Mesh(new THREE.TorusGeometry(0.070, 0.010, 8, 20), material);
  neckRing.rotation.x = Math.PI / 2;
  neckRing.position.y = capY + 0.01;
  col.add(neckRing);

  const capBellPts = [
    new THREE.Vector2(0.062, 0.00),
    new THREE.Vector2(0.068, 0.04),
    new THREE.Vector2(0.094, 0.13),
    new THREE.Vector2(0.116, 0.20),
    new THREE.Vector2(0.122, 0.23),
    new THREE.Vector2(0.001, 0.23)
  ];
  const capBell = new THREE.Mesh(new THREE.LatheGeometry(capBellPts, 20), darkCreviceMat);
  capBell.position.y = capY;
  capBell.castShadow = true;
  capBell.receiveShadow = true;
  col.add(capBell);

  // Sculpted acanthus leaves & volute curls around bell
  for (let k = 0; k < 4; k++) {
    const ang = (k + 0.5) * (Math.PI / 2);
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.038, 10, 8), material);
    leaf.scale.set(0.88, 1.72, 0.68);
    leaf.position.set(Math.cos(ang) * 0.086, capY + 0.115, Math.sin(ang) * 0.086);
    leaf.rotation.y = -ang;
    leaf.rotation.x = -0.26;
    leaf.castShadow = true;
    col.add(leaf);

    const volute = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 8), material);
    volute.position.set(Math.cos(ang) * 0.106, capY + 0.198, Math.sin(ang) * 0.106);
    col.add(volute);
  }

  const abacusGeo = new THREE.BoxGeometry(0.24, 0.052, 0.24);
  applyBoxTriplanarUV(abacusGeo, 0.8);
  const abacus = new THREE.Mesh(abacusGeo, material);
  abacus.position.y = capY + 0.248;
  abacus.castShadow = true;
  abacus.receiveShadow = true;
  col.add(abacus);

  return col;
}

export function createChapel(textures) {
  const chapel = new THREE.Group();
  chapel.name = 'ChapelStructure';

  chapel.position.set(2.05, 1.42, 0.55);
  chapel.rotation.y = -0.37;

  // --- Materials ---
  const wallMat = new THREE.MeshStandardMaterial({
    map: textures.ashlar.map,
    normalMap: textures.ashlar.normalMap,
    normalScale: new THREE.Vector2(0.85, 0.85),
    roughnessMap: textures.ashlar.roughnessMap,
    roughness: 0.88,
    metalness: 0.01,
    envMapIntensity: 0.58
  });

  const roughStoneMat = new THREE.MeshStandardMaterial({
    map: textures.heavyLichenStone.map,
    normalMap: textures.heavyLichenStone.normalMap,
    normalScale: new THREE.Vector2(0.95, 0.95),
    roughnessMap: textures.heavyLichenStone.roughnessMap,
    roughness: 0.90,
    metalness: 0.01,
    envMapIntensity: 0.56
  });

  const portalStoneMat = new THREE.MeshStandardMaterial({
    map: textures.carvedStone.map,
    normalMap: textures.carvedStone.normalMap,
    normalScale: new THREE.Vector2(0.85, 0.85),
    roughnessMap: textures.carvedStone.roughnessMap,
    color: new THREE.Color('#d2c8b8'),
    roughness: 0.84,
    metalness: 0.01,
    envMapIntensity: 0.56
  });

  // Slightly darker recessed limestone for cavetto hollows & inner arch crevices!
  const portalRecessMat = new THREE.MeshStandardMaterial({
    map: textures.carvedStone.map,
    normalMap: textures.carvedStone.normalMap,
    normalScale: new THREE.Vector2(0.95, 0.95),
    roughnessMap: textures.carvedStone.roughnessMap,
    color: new THREE.Color('#9e9282'),
    roughness: 0.90,
    metalness: 0.01,
    envMapIntensity: 0.40
  });

  const interiorWallMat = new THREE.MeshStandardMaterial({
    map: textures.carvedStone.map,
    normalMap: textures.carvedStone.normalMap,
    normalScale: new THREE.Vector2(0.95, 0.95),
    color: new THREE.Color('#574434'),
    roughness: 0.94,
    metalness: 0.0,
    envMapIntensity: 0.04
  });

  const interiorFloorMat = new THREE.MeshStandardMaterial({
    map: textures.flagstone.map,
    normalMap: textures.flagstone.normalMap,
    color: new THREE.Color('#68594b'),
    roughness: 0.80,
    metalness: 0.02,
    envMapIntensity: 0.06
  });

  const doorWoodMat = new THREE.MeshStandardMaterial({
    map: textures.doorWood.map,
    normalMap: textures.doorWood.normalMap,
    color: new THREE.Color('#8a7b6c'),
    roughness: 0.86,
    metalness: 0.02,
    envMapIntensity: 0.14
  });

  const pewWoodMat = new THREE.MeshStandardMaterial({
    map: textures.pewWood.map,
    normalMap: textures.pewWood.normalMap,
    color: new THREE.Color('#6b4d35'),
    roughness: 0.72,
    metalness: 0.04,
    envMapIntensity: 0.05
  });

  const ironMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#1c1815'),
    roughness: 0.60,
    metalness: 0.72,
    envMapIntensity: 0.08
  });

  // =========================================================================
  // 1. FRONT FACADE WALL WITH POINTED ARCH PORTAL CUTOUT
  // =========================================================================
  const ySpring = 1.62;
  const outerCutHalfW = 1.08;
  const wallShape = new THREE.Shape();
  wallShape.moveTo(-1.92, -0.18);
  wallShape.lineTo( 1.92, -0.18);
  wallShape.lineTo( 1.92,  4.50);
  wallShape.lineTo( 0.00,  5.35);
  wallShape.lineTo(-1.92,  4.50);
  wallShape.closePath();

  const holePath = new THREE.Path();
  const holeArch = getPointedArchPoints(outerCutHalfW, ySpring, 0.24, 30);
  holePath.moveTo( outerCutHalfW, -0.02);
  holePath.lineTo( holeArch[0].x, holeArch[0].y);
  for (let i = 1; i < holeArch.length; i++) holePath.lineTo(holeArch[i].x, holeArch[i].y);
  holePath.lineTo(-outerCutHalfW, -0.02);
  holePath.closePath();
  wallShape.holes.push(holePath);

  const facadeGeo = new THREE.ExtrudeGeometry(wallShape, {
    depth: 0.52,
    bevelEnabled: false,
    curveSegments: 20
  });
  applyBoxTriplanarUV(facadeGeo, 0.34);

  const facadeMesh = new THREE.Mesh(facadeGeo, wallMat);
  facadeMesh.position.z = -0.46;
  facadeMesh.castShadow = true;
  facadeMesh.receiveShadow = true;
  chapel.add(facadeMesh);

  // =========================================================================
  // 2. STEPPED CORNER BUTTRESSES & QUOINS
  // =========================================================================
  const numCourses = 9;
  const courseH = 0.44;
  for (let c = 0; c < numCourses; c++) {
    const wBlock = 0.50 + (c % 2 === 0 ? 0.028 : 0.0);
    const dBlock = 0.58 + (c % 2 === 1 ? 0.020 : 0.0);
    const qGeo = new THREE.BoxGeometry(wBlock, courseH - 0.008, dBlock);
    applyBoxTriplanarUV(qGeo, 0.36);
    // Offset UV slightly per block so courses don't repeat identically
    const uv = qGeo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) + c * 0.19, uv.getY(i) + c * 0.13);

    const qMesh = new THREE.Mesh(qGeo, wallMat);
    qMesh.position.set(-1.71 - (c % 2 === 0 ? 0.01 : 0), 0.20 + c * courseH, -0.04);
    qMesh.castShadow = true;
    qMesh.receiveShadow = true;
    chapel.add(qMesh);
  }

  // Heavy mossy projecting base plinth at foot of left buttress
  const plinthGeoL = new THREE.BoxGeometry(0.86, 0.48, 0.70);
  applyBoxTriplanarUV(plinthGeoL, 0.52);
  const leftBasePlinth = new THREE.Mesh(plinthGeoL, roughStoneMat);
  leftBasePlinth.position.set(-1.76, 0.19, 0.28);
  leftBasePlinth.rotation.y = 0.03;
  leftBasePlinth.castShadow = true;
  leftBasePlinth.receiveShadow = true;
  chapel.add(leftBasePlinth);

  // Right corner buttress
  for (let c = 0; c < numCourses; c++) {
    const wBlock = 0.52 + (c % 2 === 0 ? 0.025 : 0.0);
    const qGeo = new THREE.BoxGeometry(wBlock, courseH - 0.008, 0.58);
    applyBoxTriplanarUV(qGeo, 0.36);
    const qMesh = new THREE.Mesh(qGeo, wallMat);
    qMesh.position.set(1.72, 0.20 + c * courseH, -0.02);
    qMesh.castShadow = true;
    qMesh.receiveShadow = true;
    chapel.add(qMesh);
  }

  // =========================================================================
  // 3. RECESSED STEPPED ARCHIVOLTS, DENTIL RING & PAIRED COLONNETTES
  // =========================================================================
  const portalGroup = new THREE.Group();
  chapel.add(portalGroup);

  // Alternating bright roll-moldings and darker recessed hollows for authentic Romanesque relief!
  portalGroup.add(createArchivoltBand(1.07, 1.15, ySpring, 0.11, 0.24, portalStoneMat, 0.045));
  portalGroup.add(createArchivoltBand(1.02, 1.08, ySpring, 0.13, 0.24, portalRecessMat, -0.01));
  portalGroup.add(createArchivoltBand(0.94, 1.03, ySpring, 0.16, 0.24, portalStoneMat, -0.06));
  portalGroup.add(createArchivoltBand(0.86, 0.95, ySpring, 0.19, 0.24, portalRecessMat, -0.16));
  portalGroup.add(createArchivoltBand(0.76, 0.87, ySpring, 0.22, 0.24, portalStoneMat, -0.27));
  portalGroup.add(createArchivoltBand(0.66, 0.77, ySpring - 0.02, 0.32, 0.24, portalRecessMat, -0.48));

  // 3D Carved Dentil / Billet Teeth Ring along Order 2
  const dentilCurvePts = getPointedArchPoints(0.915, ySpring, 0.24, 24);
  const toothGeo = new THREE.BoxGeometry(0.034, 0.044, 0.055);
  applyBoxTriplanarUV(toothGeo, 1.2);
  for (let i = 0; i < dentilCurvePts.length - 1; i++) {
    const p0 = dentilCurvePts[i];
    const p1 = dentilCurvePts[i + 1];
    const tooth = new THREE.Mesh(toothGeo, portalStoneMat);
    tooth.position.set((p0.x + p1.x) * 0.5, (p0.y + p1.y) * 0.5, 0.032);
    tooth.rotation.z = Math.atan2(p1.y - p0.y, p1.x - p0.x);
    tooth.castShadow = true;
    tooth.receiveShadow = true;
    portalGroup.add(tooth);
  }

  for (const side of [-1, 1]) {
    const jambPlinthGeo = new THREE.BoxGeometry(0.56, 0.25, 0.58);
    applyBoxTriplanarUV(jambPlinthGeo, 0.55);
    const jambPlinth = new THREE.Mesh(jambPlinthGeo, portalRecessMat);
    jambPlinth.position.set(side * 0.92, 0.125, -0.14);
    jambPlinth.castShadow = true;
    jambPlinth.receiveShadow = true;
    portalGroup.add(jambPlinth);

    const innerJambGeo = new THREE.BoxGeometry(0.24, ySpring, 0.48);
    applyBoxTriplanarUV(innerJambGeo, 0.55);
    const innerJamb = new THREE.Mesh(innerJambGeo, portalRecessMat);
    innerJamb.position.set(side * 0.76, ySpring * 0.5, -0.34);
    innerJamb.castShadow = true;
    innerJamb.receiveShadow = true;
    portalGroup.add(innerJamb);

    const outerJambGeo = new THREE.BoxGeometry(0.26, ySpring, 0.28);
    applyBoxTriplanarUV(outerJambGeo, 0.55);
    const outerJamb = new THREE.Mesh(outerJambGeo, portalRecessMat);
    outerJamb.position.set(side * 1.04, ySpring * 0.5, -0.08);
    outerJamb.castShadow = true;
    outerJamb.receiveShadow = true;
    portalGroup.add(outerJamb);

    const colOuter = createColonnette(portalStoneMat, portalRecessMat, 0.86);
    colOuter.position.set(side * 0.99, 0.24, 0.02);
    portalGroup.add(colOuter);

    const colInner = createColonnette(portalStoneMat, portalRecessMat, 0.86);
    colInner.position.set(side * 0.82, 0.24, -0.09);
    portalGroup.add(colInner);

    // Moulded Impost Cornice crowning the capitals
    const impostGeo = new THREE.BoxGeometry(0.58, 0.075, 0.60);
    applyBoxTriplanarUV(impostGeo, 0.65);
    const impost = new THREE.Mesh(impostGeo, portalStoneMat);
    impost.position.set(side * 0.92, ySpring - 0.01, -0.13);
    impost.castShadow = true;
    impost.receiveShadow = true;
    portalGroup.add(impost);
  }

  const threshGeo = new THREE.BoxGeometry(1.65, 0.12, 0.82);
  applyBoxTriplanarUV(threshGeo, 0.6);
  const threshold = new THREE.Mesh(threshGeo, roughStoneMat);
  threshold.position.set(0, -0.04, -0.24);
  threshold.receiveShadow = true;
  chapel.add(threshold);

  // =========================================================================
  // 4. DARK ENCLOSED INTERIOR SANCTUARY
  // =========================================================================
  const interior = new THREE.Group();
  interior.name = 'ChapelInterior';
  chapel.add(interior);

  const naveFloor = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.2, 5.2), interiorFloorMat);
  naveFloor.position.set(0, -0.10, -2.95);
  naveFloor.receiveShadow = true;
  interior.add(naveFloor);

  const leftNaveWall = new THREE.Mesh(new THREE.BoxGeometry(0.45, 4.2, 5.2), interiorWallMat);
  leftNaveWall.position.set(-1.85, 2.0, -2.95);
  leftNaveWall.castShadow = true;
  leftNaveWall.receiveShadow = true;
  interior.add(leftNaveWall);

  const rightNaveWall = new THREE.Mesh(new THREE.BoxGeometry(0.45, 4.2, 5.2), interiorWallMat);
  rightNaveWall.position.set(1.85, 2.0, -2.95);
  rightNaveWall.castShadow = true;
  rightNaveWall.receiveShadow = true;
  interior.add(rightNaveWall);

  // Back sanctuary wall with tall narrow Lancet Stained-Glass Window
  const backWallShape = new THREE.Shape();
  backWallShape.moveTo(-1.95, -0.1);
  backWallShape.lineTo( 1.95, -0.1);
  backWallShape.lineTo( 1.95,  4.1);
  backWallShape.lineTo(-1.95,  4.1);
  backWallShape.closePath();

  const winX = -0.36;
  const winW = 0.105;
  const winHole = new THREE.Path();
  winHole.moveTo(winX - winW, 0.88);
  winHole.lineTo(winX + winW, 0.88);
  winHole.lineTo(winX + winW, 1.60);
  winHole.absarc(winX, 1.60, winW, 0, Math.PI, false);
  winHole.lineTo(winX - winW, 0.88);
  backWallShape.holes.push(winHole);

  const backWallGeo = new THREE.ExtrudeGeometry(backWallShape, { depth: 0.42, bevelEnabled: false });
  applyBoxTriplanarUV(backWallGeo, 0.45);
  const backWall = new THREE.Mesh(backWallGeo, interiorWallMat);
  backWall.position.z = -5.35;
  backWall.castShadow = true;
  backWall.receiveShadow = true;
  interior.add(backWall);

  const splayL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.92, 0.36), interiorWallMat);
  splayL.position.set(winX - 0.19, 1.29, -5.05);
  splayL.rotation.y = 0.38;
  interior.add(splayL);

  const splayR = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.92, 0.36), interiorWallMat);
  splayR.position.set(winX + 0.19, 1.29, -5.05);
  splayR.rotation.y = -0.38;
  interior.add(splayR);

  const glassMat = new THREE.MeshBasicMaterial({
    map: textures.lancetGlass,
    color: new THREE.Color('#fff0bd')
  });
  const glassPane = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.92), glassMat);
  glassPane.position.set(winX, 1.29, -5.20);
  interior.add(glassPane);

  const ceilingCap = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.5, 5.5), interiorWallMat);
  ceilingCap.position.set(0, 3.85, -2.95);
  ceilingCap.castShadow = true;
  ceilingCap.receiveShadow = true;
  interior.add(ceilingCap);

  // Overhead vaulted ceiling (rotation.x = -Math.PI/2 so the cylinder arches UPWARD above y=2.05!)
  const archVault = new THREE.Mesh(
    new THREE.CylinderGeometry(1.82, 1.82, 5.1, 20, 1, true, -Math.PI / 2, Math.PI),
    interiorWallMat
  );
  archVault.rotation.x = -Math.PI / 2;
  archVault.material.side = THREE.DoubleSide;
  archVault.position.set(0, 2.05, -2.95);
  archVault.castShadow = true;
  interior.add(archVault);

  // Exterior Pitched Stone/Slate Gable Roof Slopes (seals top & looks authentic in 3D overview!)
  const roofPitch = Math.atan2(0.85, 1.92);
  const roofSlopeLen = Math.hypot(1.98, 0.88);
  for (const side of [-1, 1]) {
    const roofSlopeGeo = new THREE.BoxGeometry(roofSlopeLen, 0.18, 5.35);
    applyBoxTriplanarUV(roofSlopeGeo, 0.45);
    const roofSlope = new THREE.Mesh(roofSlopeGeo, roughStoneMat);
    roofSlope.position.set(side * 0.96, 4.88, -2.92);
    roofSlope.rotation.z = -side * roofPitch;
    roofSlope.castShadow = true;
    roofSlope.receiveShadow = true;
    interior.add(roofSlope);
  }

  for (const bz of [-1.65, -3.35]) {
    const tieBeam = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.10, 0.11), pewWoodMat);
    tieBeam.position.set(0, 2.18, bz);
    tieBeam.castShadow = true;
    interior.add(tieBeam);

    const kingPost = new THREE.Mesh(new THREE.BoxGeometry(0.09, 1.45, 0.09), pewWoodMat);
    kingPost.position.set(0, 2.92, bz);
    interior.add(kingPost);
  }

  const backDado = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.50, 0.34), interiorWallMat);
  backDado.position.set(0, 0.25, -4.82);
  backDado.receiveShadow = true;
  interior.add(backDado);

  // =========================================================================
  // 5. SWUNG-OPEN ARCHED HEAVY WOODEN DOOR (TUCKED CLEANLY INSIDE PORTAL!)
  // =========================================================================
  const doorPivot = new THREE.Group();
  doorPivot.position.set(-0.62, 0.0, -0.68); // Recessed cleanly behind inner stone archivolt!
  doorPivot.rotation.y = -1.36;
  interior.add(doorPivot);

  const doorShape = new THREE.Shape();
  doorShape.moveTo(0.0, 0.0);
  doorShape.lineTo(0.74, 0.0);
  doorShape.lineTo(0.74, 1.72);
  doorShape.quadraticCurveTo(0.68, 2.15, 0.0, 2.38);
  doorShape.closePath();

  const doorGeo = new THREE.ExtrudeGeometry(doorShape, { depth: 0.072, bevelEnabled: false });
  {
    const pos = doorGeo.attributes.position;
    const uv = doorGeo.attributes.uv;
    for (let i = 0; i < pos.count; i++) {
      uv.setXY(i, pos.getX(i) * 1.35, pos.getY(i) * 0.55);
    }
  }
  const doorLeaf = new THREE.Mesh(doorGeo, doorWoodMat);
  doorLeaf.position.z = -0.036;
  doorLeaf.castShadow = true;
  doorLeaf.receiveShadow = true;
  doorPivot.add(doorLeaf);

  for (const hy of [0.42, 1.18, 1.78]) {
    const strap = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.042, 0.088), ironMat);
    strap.position.set(0.30, hy, 0);
    doorPivot.add(strap);

    const crossVert = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.17, 0.090), ironMat);
    crossVert.position.set(0.50, hy, 0);
    doorPivot.add(crossVert);
  }

  // =========================================================================
  // 6. WEATHERED OPEN-RAIL WOODEN PEWS (AUTHENTIC HISTORIC BENCH SILHOUETTE!)
  // =========================================================================
  function createPew(width = 1.12) {
    const pew = new THREE.Group();
    const seat = new THREE.Mesh(new THREE.BoxGeometry(width, 0.042, 0.38), pewWoodMat);
    seat.position.set(0, 0.44, 0);
    seat.castShadow = true;
    seat.receiveShadow = true;
    pew.add(seat);

    // Open-rail chapel backrest (mid rail + top rail + center stile, letting light filter through!)
    const midRail = new THREE.Mesh(new THREE.BoxGeometry(width, 0.11, 0.032), pewWoodMat);
    midRail.position.set(0, 0.65, 0.17);
    midRail.castShadow = true;
    midRail.receiveShadow = true;
    pew.add(midRail);

    const topRail = new THREE.Mesh(new THREE.BoxGeometry(width + 0.04, 0.058, 0.072), pewWoodMat);
    topRail.position.set(0, 0.88, 0.185);
    topRail.castShadow = true;
    topRail.receiveShadow = true;
    pew.add(topRail);

    for (const sx of [-width * 0.46, 0, width * 0.46]) {
      if (sx === 0) {
        const centerStile = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.44, 0.036), pewWoodMat);
        centerStile.position.set(0, 0.66, 0.17);
        pew.add(centerStile);
      } else {
        // Front & rear bench legs + armrest instead of solid opaque slab!
        const rearPost = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.90, 0.065), pewWoodMat);
        rearPost.position.set(sx, 0.45, 0.17);
        rearPost.castShadow = true;
        pew.add(rearPost);

        const frontLeg = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.62, 0.058), pewWoodMat);
        frontLeg.position.set(sx, 0.31, -0.15);
        frontLeg.castShadow = true;
        pew.add(frontLeg);

        const armRest = new THREE.Mesh(new THREE.BoxGeometry(0.062, 0.042, 0.40), pewWoodMat);
        armRest.position.set(sx, 0.63, 0.01);
        pew.add(armRest);
      }
    }
    const kneeler = new THREE.Mesh(new THREE.BoxGeometry(width - 0.08, 0.038, 0.13), pewWoodMat);
    kneeler.position.set(0, 0.10, 0.26);
    pew.add(kneeler);

    return pew;
  }

  for (const pz of [-2.10, -2.85, -3.60]) {
    const pew = createPew(1.08);
    pew.position.set(-0.56, 0, pz);
    interior.add(pew);
  }

  // =========================================================================
  // 7. VOTIVE CANDLE STAND, CRUCIFIX & ANIMATED FLAMES
  // =========================================================================
  const candleStandGroup = new THREE.Group();
  candleStandGroup.position.set(0.32, 0.0, -4.42);
  interior.add(candleStandGroup);

  const trayW = 0.56, trayD = 0.26, trayY = 0.92;
  const tray = new THREE.Mesh(new THREE.BoxGeometry(trayW, 0.03, trayD), ironMat);
  tray.position.y = trayY;
  candleStandGroup.add(tray);

  const midShelf = new THREE.Mesh(new THREE.BoxGeometry(trayW - 0.04, 0.025, trayD - 0.04), ironMat);
  midShelf.position.y = 0.48;
  candleStandGroup.add(midShelf);

  for (const lx of [-trayW * 0.45, trayW * 0.45]) {
    for (const lz of [-trayD * 0.42, trayD * 0.42]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.014, trayY, 8), ironMat);
      leg.position.set(lx, trayY * 0.5, lz);
      candleStandGroup.add(leg);
    }
  }

  const sidePost = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.022, 0.86, 8), ironMat);
  sidePost.position.set(-0.42, 0.43, 0.05);
  candleStandGroup.add(sidePost);
  const sideTop = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.04, 0.14), ironMat);
  sideTop.position.set(-0.42, 0.87, 0.05);
  candleStandGroup.add(sideTop);

  const crossGroup = new THREE.Group();
  crossGroup.position.set(0.34, 1.48, -4.82);
  const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.52, 0.04), ironMat);
  const crossH = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.042, 0.04), ironMat);
  crossH.position.y = 0.11;
  crossGroup.add(crossV, crossH);
  interior.add(crossGroup);

  const waxMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#dfcca8'),
    emissive: new THREE.Color('#ff8a24'),
    emissiveIntensity: 0.22,
    roughness: 0.55
  });

  const flameUniforms = {
    uTime: { value: 0.0 },
    uFocus: { value: 0.0 }
  };

  const flameMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: flameUniforms,
    vertexShader: /* glsl */ `
      uniform float uTime;
      uniform float uFocus;
      attribute float aPhase;
      varying vec2 vUv;
      void main() {
        vUv = uv;
        vec3 p = position;
        float h = clamp(uv.y, 0.0, 1.0);
        float swayAmp = (0.012 + uFocus * 0.022) * h * h;
        p.x += sin(uTime * 5.8 + aPhase) * swayAmp + cos(uTime * 11.3 + aPhase * 2.1) * swayAmp * 0.45;
        p.z += cos(uTime * 4.9 + aPhase * 1.3) * swayAmp * 0.6;
        p *= (1.0 + uFocus * 0.45);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      varying vec2 vUv;
      uniform float uFocus;
      void main() {
        vec2 c = vec2((vUv.x - 0.5) * 2.0, vUv.y);
        float width = sin(clamp(c.y, 0.0, 1.0) * 3.14159) * (1.0 - c.y * 0.42);
        float d = abs(c.x) / max(width, 0.001);
        float alpha = smoothstep(1.0, 0.15, d) * smoothstep(0.0, 0.14, c.y) * smoothstep(1.0, 0.55, c.y);
        vec3 core = vec3(1.2, 0.95, 0.55);
        vec3 mid  = vec3(0.95, 0.35, 0.04);
        vec3 col  = mix(mid, core, smoothstep(0.75, 0.0, d));
        float boost = 1.25 + uFocus * 1.65;
        gl_FragColor = vec4(col * boost, alpha);
      }
    `
  });

  const candleSpecs = [
    { x: -0.21, z: -0.04, h: 0.13, phase: 0.3 },
    { x: -0.11, z:  0.04, h: 0.10, phase: 1.7 },
    { x: -0.03, z: -0.02, h: 0.11, phase: 3.1 },
    { x:  0.06, z:  0.03, h: 0.15, phase: 4.4 },
    { x:  0.14, z: -0.03, h: 0.17, phase: 5.6 },
    { x:  0.22, z:  0.02, h: 0.12, phase: 2.3 }
  ];

  for (const cs of candleSpecs) {
    const taper = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.011, cs.h, 8), waxMat);
    taper.position.set(cs.x, trayY + 0.015 + cs.h * 0.5, cs.z);
    candleStandGroup.add(taper);

    for (const rotY of [0, Math.PI / 2]) {
      const fGeo = new THREE.PlaneGeometry(0.036, 0.078, 1, 6);
      fGeo.translate(0, 0.039, 0);
      const phases = new Float32Array(fGeo.attributes.position.count).fill(cs.phase);
      fGeo.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
      const fMesh = new THREE.Mesh(fGeo, flameMat);
      fMesh.position.set(cs.x, trayY + 0.015 + cs.h, cs.z);
      fMesh.rotation.y = rotY;
      candleStandGroup.add(fMesh);
    }

    const haloGeo = new THREE.PlaneGeometry(0.16, 0.16);
    const haloMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: flameUniforms,
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        uniform float uFocus;
        void main() {
          vUv = uv;
          vec4 mvCenter = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
          float s = 1.0 + uFocus * 0.90;
          mvCenter.xy += position.xy * s;
          gl_Position = projectionMatrix * mvCenter;
        }
      `,
      fragmentShader: /* glsl */ `
        precision highp float;
        varying vec2 vUv;
        uniform float uFocus;
        void main() {
          float d = length(vUv - 0.5) * 2.0;
          float g = pow(max(1.0 - d, 0.0), 3.2);
          vec3 c = vec3(0.85, 0.30, 0.04) * (0.35 + uFocus * 0.95);
          gl_FragColor = vec4(c * g, g);
        }
      `
    });
    const halo = new THREE.Mesh(haloGeo, haloMat);
    halo.position.set(cs.x, trayY + 0.04 + cs.h, cs.z);
    candleStandGroup.add(halo);
  }

  // =========================================================================
  // 8. INTERIOR LIGHTS & DYNAMIC ARCHWAY WARM SPILL RIG
  // =========================================================================
  // Soft twilight sky bounce entering through the open archway so pew silhouettes
  // and the wooden door planks are subtly discernible in default view (like reference-0.png!)
  const portalTwilightBounce = new THREE.SpotLight('#bfa892', 1.15, 7.5, Math.PI * 0.34, 0.85, 1.5);
  portalTwilightBounce.position.set(0.1, 1.45, 0.95);
  portalTwilightBounce.target.position.set(-0.42, 0.52, -3.2);
  interior.add(portalTwilightBounce);
  interior.add(portalTwilightBounce.target);

  const lancetLight = new THREE.PointLight('#e5a54e', 0.65, 4.4, 1.7);
  lancetLight.position.set(winX, 1.32, -4.55);
  interior.add(lancetLight);

  const candleMainLight = new THREE.PointLight('#ff8624', 1.10, 7.2, 1.55);
  candleMainLight.position.set(0.26, 1.28, -4.10);
  interior.add(candleMainLight);

  // Mid-nave warm candle bounce (low in default, surges when focusing archway to rim-light pews & door!)
  const naveWarmLight = new THREE.PointLight('#ff8e2b', 0.25, 7.5, 1.45);
  naveWarmLight.position.set(-0.10, 1.32, -1.95);
  interior.add(naveWarmLight);

  // Portal Warm Spill SpotLight: spills golden-amber candlelight out across jambs & upper stone steps!
  const spillSpot = new THREE.SpotLight('#ff9230', 0.08, 10.5, Math.PI * 0.42, 0.68, 1.35);
  spillSpot.position.set(0.05, 1.65, -1.35);
  spillSpot.target.position.set(-0.20, -0.75, 3.15);
  interior.add(spillSpot);
  interior.add(spillSpot.target);

  const archHitBox = new THREE.Mesh(
    new THREE.BoxGeometry(1.55, 2.65, 0.6),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  archHitBox.position.set(0, 1.32, -0.15);
  archHitBox.name = 'ArchwayHitTarget';
  chapel.add(archHitBox);

  const archWorldCenter = new THREE.Vector3(0, 1.25, -0.2);
  chapel.updateMatrixWorld(true);
  archWorldCenter.applyMatrix4(chapel.matrixWorld);

  function updateChapelLighting(time, focusLevel) {
    flameUniforms.uTime.value = time;
    flameUniforms.uFocus.value = focusLevel;

    const flicker =
      Math.sin(time * 6.3) * 0.065 +
      Math.sin(time * 13.7 + 1.2) * 0.045 +
      Math.cos(time * 21.1 + 0.5) * 0.025;
    const fScale = 1.0 + flicker * (0.65 + focusLevel * 1.25);

    candleMainLight.intensity = (1.10 + focusLevel * 5.2) * fScale;
    naveWarmLight.intensity   = (0.25 + focusLevel * 4.8) * fScale;
    spillSpot.intensity       = (0.06 + focusLevel * 9.5) * fScale;
    lancetLight.intensity     = 0.65 + focusLevel * 0.40;
    waxMat.emissiveIntensity  = (0.22 + focusLevel * 0.72) * fScale;
  }

  return {
    group: chapel,
    archHitBox,
    archWorldCenter,
    updateChapelLighting
  };
}
