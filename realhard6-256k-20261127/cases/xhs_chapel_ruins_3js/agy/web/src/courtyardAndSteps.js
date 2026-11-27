import * as THREE from 'three';

function createRng(seed = 9001) {
  let s = seed >>> 0;
  return function () {
    s += 0x6d2b79f5;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Builds an organically worn, chipped medieval stone block with proper triplanar UVs
 * (zero stretching on vertical risers or cheek walls!).
 */
function createWeatheredStoneGeo(w, h, d, rng, chipAmount = 0.022, uvScale = 0.62) {
  const geo = new THREE.BoxGeometry(w, h, d, 5, 3, 4);
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;

  const pSeedX = rng() * 37;
  const pSeedZ = rng() * 37;

  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i);
    let y = pos.getY(i);
    let z = pos.getZ(i);

    const nx = x / (w * 0.5);
    const ny = y / (h * 0.5);
    const nz = z / (d * 0.5);

    const edgeCount = (Math.abs(nx) > 0.92 ? 1 : 0) + (Math.abs(ny) > 0.92 ? 1 : 0) + (Math.abs(nz) > 0.92 ? 1 : 0);
    if (edgeCount >= 2) {
      const wear = (ny > 0 && nz > 0) ? 1.45 : 0.85;
      x -= Math.sign(x) * chipAmount * 0.65 * wear;
      y -= Math.sign(y) * chipAmount * 0.72 * wear;
      z -= Math.sign(z) * chipAmount * 0.65 * wear;
    }

    const wave =
      Math.sin((x + pSeedX) * 7.3 + (z + pSeedZ) * 5.9) * 0.5 +
      Math.cos((x - pSeedZ) * 13.1 + y * 11.7) * 0.3 +
      Math.sin((z + y) * 19.3 + pSeedX) * 0.2;

    x += wave * chipAmount * 0.55;
    if (ny > 0.5) {
      y += wave * chipAmount * 0.65 - (1.0 - nx * nx * 0.5) * chipAmount * 0.22;
    } else {
      y += wave * chipAmount * 0.35;
    }
    z += wave * chipAmount * 0.55;

    pos.setXYZ(i, x, y, z);
  }

  geo.computeVertexNormals();
  const nrm = geo.attributes.normal;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) + pSeedX;
    const y = pos.getY(i) + pSeedZ * 0.5;
    const z = pos.getZ(i) + pSeedZ;
    const ax = Math.abs(nrm.getX(i));
    const ay = Math.abs(nrm.getY(i));
    const az = Math.abs(nrm.getZ(i));

    if (ay >= ax && ay >= az) {
      uv.setXY(i, x * uvScale, z * uvScale);
    } else if (ax >= az) {
      uv.setXY(i, z * uvScale, y * uvScale);
    } else {
      uv.setXY(i, x * uvScale, y * uvScale);
    }
  }

  return geo;
}

export function createCourtyardAndSteps(textures, chapelTransform) {
  const root = new THREE.Group();
  root.name = 'CourtyardAndSteps';

  const rng = createRng(2026);

  const stairGroup = new THREE.Group();
  stairGroup.position.copy(chapelTransform.position);
  stairGroup.rotation.copy(chapelTransform.rotation);
  root.add(stairGroup);

  const stepStoneMat = new THREE.MeshStandardMaterial({
    map: textures.roughStone.map,
    normalMap: textures.roughStone.normalMap,
    normalScale: new THREE.Vector2(0.85, 0.85),
    roughnessMap: textures.roughStone.roughnessMap,
    roughness: 0.88,
    metalness: 0.01,
    envMapIntensity: 0.52
  });

  const heavyLichenMat = new THREE.MeshStandardMaterial({
    map: textures.heavyLichenStone.map,
    normalMap: textures.heavyLichenStone.normalMap,
    normalScale: new THREE.Vector2(0.95, 0.95),
    roughnessMap: textures.heavyLichenStone.roughnessMap,
    roughness: 0.90,
    metalness: 0.01,
    envMapIntensity: 0.50
  });

  const flagTex = textures.flagstone;
  flagTex.map.repeat.set(4.6, 4.6);
  flagTex.normalMap.repeat.set(4.6, 4.6);
  flagTex.roughnessMap.repeat.set(4.6, 4.6);

  const courtyardMat = new THREE.MeshStandardMaterial({
    map: flagTex.map,
    normalMap: flagTex.normalMap,
    normalScale: new THREE.Vector2(0.70, 0.70),
    roughnessMap: flagTex.roughnessMap,
    roughness: 0.88,
    metalness: 0.01,
    envMapIntensity: 0.38
  });

  const pierPlasterMat = new THREE.MeshStandardMaterial({
    map: textures.carvedStone.map,
    normalMap: textures.carvedStone.normalMap,
    color: new THREE.Color('#a39482'),
    roughness: 0.88,
    metalness: 0.01,
    envMapIntensity: 0.45
  });

  const localGrassAnchors = [];

  // =========================================================================
  // 1. 9 ANCIENT MULTI-BLOCK STONE STEPS
  // =========================================================================
  const numSteps = 9;
  const stepRise = 0.118;
  const stepDepth = 0.375;
  const startZ = 0.22;

  for (let s = 0; s < numSteps; s++) {
    const t = s / (numSteps - 1);
    const leftX = -1.68 - t * 0.72;
    const rightX = 1.25;
    const wSpan = rightX - leftX;
    const topY = -0.02 - s * stepRise;
    const zFront = startZ + (s + 1) * stepDepth;

    const underCoreGeo = createWeatheredStoneGeo(wSpan - 0.08, 0.28, stepDepth + 0.16, rng, 0.01, 0.55);
    const underCore = new THREE.Mesh(underCoreGeo, heavyLichenMat);
    underCore.position.set((leftX + rightX) * 0.5, topY - 0.16, zFront - stepDepth * 0.55);
    underCore.receiveShadow = true;
    stairGroup.add(underCore);

    const numBlocks = 6 + ((s + 1) % 3);
    let curX = leftX;
    for (let b = 0; b < numBlocks; b++) {
      const remW = rightX - curX;
      const remBlocks = numBlocks - b;
      const bw = b === numBlocks - 1
        ? remW
        : (remW / remBlocks) * (0.78 + rng() * 0.44);

      const gap = 0.012 + rng() * 0.014;
      const actualW = Math.max(0.18, bw - gap);
      const bh = stepRise + 0.048;
      const bd = stepDepth + 0.08 + (rng() - 0.5) * 0.04;

      const blockGeo = createWeatheredStoneGeo(actualW, bh, bd, rng, 0.021, 0.65);
      const matChoice = (rng() > 0.78) ? heavyLichenMat : stepStoneMat;
      const block = new THREE.Mesh(blockGeo, matChoice);

      const jitterY = (rng() - 0.5) * 0.016;
      const jitterZ = (rng() - 0.5) * 0.026;
      const cx = curX + bw * 0.5;
      const cy = topY - bh * 0.5 + jitterY;
      const cz = zFront - bd * 0.5 + jitterZ;

      block.position.set(cx, cy, cz);
      block.rotation.set(
        (rng() - 0.5) * 0.025,
        (rng() - 0.5) * 0.028,
        (rng() - 0.5) * 0.022
      );
      block.castShadow = true;
      block.receiveShadow = true;
      stairGroup.add(block);

      // Delicate, natural grass tufts peeking out of select stone block joints (keeps treads readable!)
      if (b < numBlocks - 1 && rng() > 0.56) {
        localGrassAnchors.push({
          x: curX + bw,
          y: topY - 0.008,
          z: zFront - stepDepth * (0.12 + rng() * 0.55),
          scale: 0.36 + rng() * 0.30,
          count: 11 + ((rng() * 10) | 0),
          type: (s === 1 || s === 0) ? 'oliveScrub' : 'dryGrass'
        });
      }
      // Small tufts tucked at the riser base crevices
      if (rng() > 0.58) {
        localGrassAnchors.push({
          x: cx + (rng() - 0.5) * actualW * 0.55,
          y: topY - stepRise + 0.005,
          z: zFront + 0.018,
          scale: 0.40 + rng() * 0.36,
          count: 13 + ((rng() * 12) | 0),
          type: 'dryGrass'
        });
      }

      curX += bw;
    }
  }

  // Prominent low olive-green & dry weed rosette in the middle-left step (matches ref_steps_fg.png!)
  localGrassAnchors.push({
    x: -0.48,
    y: -0.02 - 4 * stepRise,
    z: startZ + 4.35 * stepDepth,
    scale: 0.72,
    count: 38,
    type: 'oliveScrub'
  });

  // =========================================================================
  // 2. LEFT STEPPED ROUGH STONE KERB / CHEEK WALL
  // =========================================================================
  const kerbSpecs = [
    { x: -1.86, y: -0.08, z: 0.85, w: 0.46, h: 0.42, d: 0.58 },
    { x: -1.98, y: -0.22, z: 1.42, w: 0.44, h: 0.40, d: 0.56 },
    { x: -2.14, y: -0.36, z: 1.98, w: 0.46, h: 0.42, d: 0.60 },
    { x: -2.35, y: -0.52, z: 2.52, w: 0.48, h: 0.40, d: 0.56 },
    { x: -2.62, y: -0.64, z: 2.95, w: 0.48, h: 0.42, d: 0.52 },
    { x: -2.92, y: -0.68, z: 3.22, w: 0.45, h: 0.40, d: 0.48 }
  ];
  for (const ks of kerbSpecs) {
    const kGeo = createWeatheredStoneGeo(ks.w, ks.h, ks.d, rng, 0.030, 0.68);
    const kMesh = new THREE.Mesh(kGeo, heavyLichenMat);
    kMesh.position.set(ks.x, ks.y, ks.z);
    kMesh.rotation.y = (rng() - 0.5) * 0.08;
    kMesh.castShadow = true;
    kMesh.receiveShadow = true;
    stairGroup.add(kMesh);

    localGrassAnchors.push({
      x: ks.x + ks.w * 0.44,
      y: ks.y - ks.h * 0.36,
      z: ks.z + (rng() - 0.5) * 0.22,
      scale: 0.52 + rng() * 0.30,
      count: 16,
      type: 'dryGrass'
    });
  }

  // =========================================================================
  // 3. FOREGROUND-RIGHT LICHEN-COVERED CHEEK WALL & BOTTOM-RIGHT ROCK LEDGE
  // =========================================================================
  const rightWallMainGeo = createWeatheredStoneGeo(1.05, 1.48, 1.72, rng, 0.040, 0.72);
  const rightWallMain = new THREE.Mesh(rightWallMainGeo, heavyLichenMat);
  rightWallMain.position.set(1.42, -0.38, 2.82);
  rightWallMain.rotation.y = 0.04;
  rightWallMain.castShadow = true;
  rightWallMain.receiveShadow = true;
  stairGroup.add(rightWallMain);

  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 3; col++) {
      const bGeo = createWeatheredStoneGeo(0.36, 0.32, 0.54, rng, 0.028, 0.78);
      const bMesh = new THREE.Mesh(bGeo, heavyLichenMat);
      bMesh.position.set(
        1.02 + (rng() - 0.5) * 0.04,
        -0.88 + row * 0.31,
        2.15 + col * 0.52 + (row % 2) * 0.14
      );
      bMesh.castShadow = true;
      bMesh.receiveShadow = true;
      stairGroup.add(bMesh);
    }
  }

  const rightCopingGeo = createWeatheredStoneGeo(1.08, 0.26, 1.76, rng, 0.042, 0.72);
  const rightCoping = new THREE.Mesh(rightCopingGeo, heavyLichenMat);
  rightCoping.position.set(1.43, 0.34, 2.82);
  rightCoping.castShadow = true;
  rightCoping.receiveShadow = true;
  stairGroup.add(rightCoping);

  const fgBoulderGeo = createWeatheredStoneGeo(1.52, 0.44, 1.38, rng, 0.045, 0.72);
  const fgBoulder = new THREE.Mesh(fgBoulderGeo, heavyLichenMat);
  fgBoulder.position.set(0.96, -1.03, 4.04);
  fgBoulder.rotation.set(0.05, -0.14, 0.03);
  fgBoulder.castShadow = true;
  fgBoulder.receiveShadow = true;
  stairGroup.add(fgBoulder);

  // Wispy arching golden-brown dry grass bank tucked along the right cheek wall & boulder!
  for (let g = 0; g < 14; g++) {
    const gt = g / 13;
    localGrassAnchors.push({
      x: 0.64 + (rng() - 0.35) * 0.36,
      y: -0.38 - gt * 0.68,
      z: 2.05 + gt * 2.05 + (rng() - 0.5) * 0.16,
      scale: 0.85 + rng() * 0.55,
      count: 26 + ((rng() * 14) | 0),
      type: 'tallGoldenGrass'
    });
  }

  // =========================================================================
  // 4. CRACKED FLAGSTONE COURTYARD PAVING & ROCKY MOUNTAIN PROMONTORY SKIRT
  // =========================================================================
  const yardGeo = new THREE.PlaneGeometry(24.0, 22.0, 64, 56);
  yardGeo.rotateX(-Math.PI / 2);
  const yPos = yardGeo.attributes.position;
  for (let i = 0; i < yPos.count; i++) {
    const x = yPos.getX(i);
    const z = yPos.getZ(i);
    const slopeLeft = Math.min(0, (x + 0.6) * 0.045);
    const undul = Math.sin(x * 1.1 + z * 0.9) * 0.022 + Math.cos(x * 2.4 - z * 2.1) * 0.012;
    // Drop outer perimeter smoothly into a natural mountain promontory cliff skirt!
    const radialOut = Math.max(0, Math.hypot(x * 0.85, (z - 0.5) * 0.9) - 6.8);
    const cliffDrop = radialOut * radialOut * 0.28;
    // Also slope steeply down into the valley beyond the left parapet line!
    const worldX = x - 1.2;
    const worldZ = z + 3.2;
    const beyondParapet = Math.max(0, (-worldX * 0.52 - worldZ * 0.85) - 0.15);
    const valleyDrop = beyondParapet * beyondParapet * 0.55;

    yPos.setY(i, 0.32 + slopeLeft + undul - cliffDrop - valleyDrop);
  }
  yardGeo.computeVertexNormals();

  const yardMesh = new THREE.Mesh(yardGeo, courtyardMat);
  yardMesh.position.set(-1.2, 0, 3.2);
  yardMesh.receiveShadow = true;
  yardMesh.name = 'CourtyardFlagstones';
  root.add(yardMesh);

  // Low Stone Valley Parapet Wall & 2 Square Capped Piers along the left terrace edge
  const parapetGroup = new THREE.Group();
  root.add(parapetGroup);

  const pStart = new THREE.Vector3(-5.2, 0.15, 3.65);
  const pEnd   = new THREE.Vector3(-0.95, 0.51, 1.05);
  const pDir   = new THREE.Vector3().subVectors(pEnd, pStart);
  const pLen   = pDir.length();
  const pAngle = Math.atan2(pDir.x, pDir.z);

  const pierFractions = [0.46, 0.76];
  const segBounds = [0.0, pierFractions[0], pierFractions[1], 1.0];

  for (let s = 0; s < 3; s++) {
    const t0 = segBounds[s];
    const t1 = segBounds[s + 1];
    const tMid = (t0 + t1) * 0.5;
    const segLen = (t1 - t0) * pLen - 0.34;
    if (segLen <= 0.1) continue;

    const midPt = new THREE.Vector3().lerpVectors(pStart, pEnd, tMid);
    const wallSegGeo = createWeatheredStoneGeo(0.32, 0.38, segLen, rng, 0.022, 0.68);
    const wallSeg = new THREE.Mesh(wallSegGeo, heavyLichenMat);
    wallSeg.position.set(midPt.x, midPt.y + 0.17, midPt.z);
    wallSeg.rotation.y = pAngle;
    wallSeg.castShadow = true;
    wallSeg.receiveShadow = true;
    parapetGroup.add(wallSeg);

    const copeGeo = createWeatheredStoneGeo(0.37, 0.085, segLen + 0.04, rng, 0.016, 0.68);
    const cope = new THREE.Mesh(copeGeo, stepStoneMat);
    cope.position.set(midPt.x, midPt.y + 0.39, midPt.z);
    cope.rotation.y = pAngle;
    cope.castShadow = true;
    cope.receiveShadow = true;
    parapetGroup.add(cope);
  }

  for (const pf of pierFractions) {
    const pt = new THREE.Vector3().lerpVectors(pStart, pEnd, pf);
    const pierBody = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.44, 0.38), pierPlasterMat);
    pierBody.position.set(pt.x, pt.y + 0.21, pt.z);
    pierBody.rotation.y = pAngle;
    pierBody.castShadow = true;
    pierBody.receiveShadow = true;
    parapetGroup.add(pierBody);

    const pierCapGeo = createWeatheredStoneGeo(0.48, 0.12, 0.48, rng, 0.022, 0.72);
    const pierCap = new THREE.Mesh(pierCapGeo, heavyLichenMat);
    pierCap.position.set(pt.x, pt.y + 0.47, pt.z);
    pierCap.rotation.y = pAngle;
    pierCap.castShadow = true;
    pierCap.receiveShadow = true;
    parapetGroup.add(pierCap);
  }

  stairGroup.updateMatrixWorld(true);
  const worldGrassAnchors = [];
  for (const la of localGrassAnchors) {
    const wp = new THREE.Vector3(la.x, la.y, la.z).applyMatrix4(stairGroup.matrixWorld);
    worldGrassAnchors.push({
      x: wp.x,
      y: wp.y,
      z: wp.z,
      scale: la.scale,
      count: la.count,
      type: la.type
    });
  }

  // Natural dry grass tufts along the base of the left parapet wall & bottom-left step corner
  for (let i = 0; i < 16; i++) {
    const t = i / 15;
    const pt = new THREE.Vector3().lerpVectors(pStart, pEnd, t);
    worldGrassAnchors.push({
      x: pt.x + 0.22 + (rng() - 0.3) * 0.45,
      y: pt.y + 0.01,
      z: pt.z + 0.28 + rng() * 0.65,
      scale: 0.48 + rng() * 0.38,
      count: 16 + ((rng() * 12) | 0),
      type: 'dryGrass'
    });
  }

  // Sparse low dry grass clusters at bottom-left foreground step transition (nx = 0.08..0.48, ny = 0.76..0.94)
  for (let i = 0; i < 12; i++) {
    const fx = -2.2 + rng() * 2.8;
    const fz = 3.7 + rng() * 1.4;
    const fy = 0.32 + Math.min(0, (fx + 2.2) * 0.045);
    worldGrassAnchors.push({
      x: fx,
      y: fy,
      z: fz,
      scale: 0.46 + rng() * 0.38,
      count: 16 + ((rng() * 14) | 0),
      type: 'dryGrass'
    });
  }

  const stepsHitBox = new THREE.Mesh(
    new THREE.BoxGeometry(5.2, 1.8, 4.8),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  stepsHitBox.position.set(-0.35, -0.55, 2.35);
  stepsHitBox.name = 'StepsHitTarget';
  stairGroup.add(stepsHitBox);

  const stepsWorldCenter = new THREE.Vector3(-0.2, -0.55, 2.5).applyMatrix4(stairGroup.matrixWorld);

  return {
    group: root,
    grassAnchors: worldGrassAnchors,
    stepsHitBox,
    stepsWorldCenter
  };
}
