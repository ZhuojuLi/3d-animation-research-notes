import * as THREE from 'three';
import { stoneBox, stoneMaterial, remapBoxUV, mulberry32, createLichenDecalTexture } from './materials.js';
import { PORTAL } from './church.js';

/* ------------------------------------------------------------------------
   Forecourt: a worn stone terrace, ten broad, uneven steps up to the portal,
   a broken parapet over the valley and the ruined retaining mass on the right.
------------------------------------------------------------------------- */

const FLOOR = PORTAL.floorY;
const STAIR_BOTTOM_Z = 4.95;
const STEP_RUN = 0.675;
const STEPS = 10;
const STEP_RISE = (FLOOR - 0.02) / STEPS;

function smoothstep(a, b, x) {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

function makeRockGeometry(seed, detail = 1) {
  const geo = new THREE.IcosahedronGeometry(1, detail);
  const rng = mulberry32(seed);
  const pos = geo.attributes.position;
  const offsets = new Map();
  for (let i = 0; i < pos.count; i++) {
    const key = `${pos.getX(i).toFixed(3)},${pos.getY(i).toFixed(3)},${pos.getZ(i).toFixed(3)}`;
    if (!offsets.has(key)) {
      offsets.set(key, 0.72 + rng() * 0.5);
    }
    const s = offsets.get(key);
    pos.setXYZ(i, pos.getX(i) * s, pos.getY(i) * (s * 0.75 + 0.1), pos.getZ(i) * s);
  }
  geo.computeVertexNormals();
  return geo;
}

function makeTerraceGround() {
  // Paved shelf around the chapel; its far-left side stops at the cliff.
  const shape = new THREE.Shape();
  shape.moveTo(-27, 16);
  shape.lineTo(12, 16);
  shape.lineTo(12, -2.9);
  shape.lineTo(6.4, -2.9);
  shape.lineTo(6.4, 4.35);
  shape.lineTo(-1.1, 4.35);
  shape.lineTo(-1.1, 3.12);
  shape.lineTo(-27, 3.12);
  shape.closePath();
  const geo = new THREE.ShapeGeometry(shape, 1);
  // Shape is authored in x/y; put it down onto the x/z plane.
  geo.rotateX(Math.PI / 2);
  geo.scale(1, 1, -1);
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    uv.setXY(i, pos.getX(i) / 2.7, pos.getZ(i) / 2.7);
  }
  uv.needsUpdate = true;
  const mat = stoneMaterial('ground', { bumpScale: 0.085, roughness: 0.97 });
  mat.color.setHex(0xbcb2a0);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  mesh.castShadow = false;
  mesh.name = 'terrace-floor';
  return mesh;
}

function makeTerraceEdgeCliff() {
  // A dark rock face just below the parapet, seen only in glimpses.
  const width = 30;
  const depth = 10;
  const geo = new THREE.PlaneGeometry(width, depth, 30, 8);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i) - 5.8;
    const y = -0.15 - (1 - smoothstep(-15, 5, z + depth / 2)) * 8 - Math.abs(x) * 0.04;
    const jitter = Math.sin(x * 1.7 + z * 2.1) * 0.18 + Math.cos(x * 0.7 - z * 1.1) * 0.22;
    pos.setXYZ(i, x - 10.5, y + jitter, z);
  }
  geo.computeVertexNormals();
  const mat = stoneMaterial('rubble', { bumpScale: 0.12 });
  mat.color.setHex(0x75695b);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  mesh.castShadow = true;
  return mesh;
}

function makeStepSet() {
  const group = new THREE.Group();
  group.name = 'steps';
  const rng = mulberry32(8851);
  const stepInfo = [];

  for (let i = 0; i < STEPS; i++) {
    const u = i / (STEPS - 1);
    const topY = 0.155 + i * STEP_RISE;
    const frontZ = STAIR_BOTTOM_Z - i * STEP_RUN + (rng() - 0.5) * 0.045;
    const depth = 0.86;
    const width = THREE.MathUtils.lerp(8.9, 6.75, u) + (rng() - 0.5) * 0.22;
    const centerX = THREE.MathUtils.lerp(2.15, 3.72, smoothstep(0, 1, u)) + (rng() - 0.5) * 0.09;

    const block = stoneBox(width, topY, depth, 'steps', { textureScale: 1.6, bumpScale: 0.09 });
    block.position.set(centerX, topY / 2, frontZ - depth / 2);
    block.rotation.y = (rng() - 0.5) * 0.005;
    block.receiveShadow = true;
    group.add(block);

    // The worn lip catches the last of the daylight.
    const lip = stoneBox(width + 0.035, 0.075, 0.22, 'steps', { textureScale: 1.0, bumpScale: 0.08 });
    lip.position.set(centerX, topY - 0.018, frontZ - 0.09);
    lip.rotation.y = block.rotation.y;
    group.add(lip);

    // Broken, chipped corners.
    for (const side of [-1, 1]) {
      if (rng() > 0.35) {
        const chip = new THREE.Mesh(
          makeRockGeometry(900 + i * 7 + side, 1),
          stoneMaterial('steps')
        );
        const s = 0.12 + rng() * 0.22;
        chip.scale.set(s * 1.5, s * 0.7, s * 1.2);
        chip.position.set(centerX + side * width / 2, topY - 0.03 + rng() * 0.06, frontZ - 0.08 - rng() * 0.3);
        chip.rotation.set(rng() * 0.4, rng() * Math.PI, rng() * 0.3);
        chip.castShadow = true;
        chip.receiveShadow = true;
        group.add(chip);
      }
    }

    // A low broken kerb on the left side of the stair.
    const kerbW = 0.34;
    const kerbH = 0.18 + rng() * 0.18;
    const kerb = stoneBox(kerbW, kerbH, depth * 0.92, 'rubble', { textureScale: 1.0 });
    kerb.position.set(centerX - width / 2 - kerbW * 0.34, topY + kerbH / 2 - 0.03, frontZ - depth * 0.53);
    kerb.rotation.y = (rng() - 0.5) * 0.04;
    group.add(kerb);

    stepInfo.push({ i, topY, frontZ, width, centerX, u });
  }

  // Landing in front of the portal.
  const landingTop = FLOOR;
  const landing = stoneBox(6.9, landingTop + 0.12, 3.1, 'steps', { textureScale: 1.7, bumpScale: 0.08 });
  landing.position.set(3.78, (landingTop + 0.12) / 2 - 0.06, -2.76);
  landing.receiveShadow = true;
  group.add(landing);
  const landSlab = stoneBox(6.85, 0.12, 2.95, 'steps', { textureScale: 1.4, bumpScale: 0.09 });
  landSlab.position.set(3.8, landingTop + 0.01, -2.75);
  group.add(landSlab);

  // A threshold slab tilted by centuries of feet.
  const doorStep = stoneBox(3.25, 0.13, 0.58, 'steps', { textureScale: 1.0 });
  doorStep.position.set(PORTAL.cx, FLOOR + 0.065, -3.85);
  group.add(doorStep);

  // Scattered rubble at the foot of the stairs.
  const rubbleGeo = makeRockGeometry(412, 1);
  const rubbleMat = stoneMaterial('rubble', { textureScale: 1.0 });
  const rubble = new THREE.InstancedMesh(rubbleGeo, rubbleMat, 48);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < rubble.count; i++) {
    const bottom = rng() > 0.35;
    let x, y, z;
    if (bottom) {
      x = -3.6 + rng() * 10.2;
      z = 3.7 + rng() * 4.2;
      y = 0.02;
    } else {
      const info = stepInfo[(rng() * stepInfo.length) | 0];
      x = info.centerX + (rng() - 0.5) * info.width * 0.95;
      z = info.frontZ - 0.12 - rng() * 0.5;
      y = info.topY + 0.02;
    }
    const s = 0.06 + Math.pow(rng(), 2) * 0.18;
    dummy.position.set(x, y + s * 0.35, z);
    dummy.scale.set(s * (0.7 + rng()), s * 0.5, s * (0.6 + rng()));
    dummy.rotation.set(rng() * Math.PI, rng() * Math.PI, rng() * Math.PI);
    dummy.updateMatrix();
    rubble.setMatrixAt(i, dummy.matrix);
  }
  rubble.castShadow = true;
  rubble.receiveShadow = true;
  group.add(rubble);

  return { group, stepInfo };
}

function makeParapet(grassSites) {
  const group = new THREE.Group();
  group.name = 'parapet';
  const rng = mulberry32(322);
  const z = 3.25;
  const segments = 20;
  for (let i = 0; i < segments; i++) {
    const u = i / (segments - 1);
    const x = THREE.MathUtils.lerp(-17.4, -2.25, u);
    const broken = i === 7 || i === 8 || i === 15;
    const h = broken ? 0.2 + rng() * 0.12 : 0.52 + rng() * 0.23;
    const w = 0.83;
    const block = stoneBox(w, h, 0.43, 'rubble', { textureScale: 0.95, bumpScale: 0.07 });
    block.position.set(x, h / 2 - 0.02, z + Math.sin(i * 0.7) * 0.04);
    block.rotation.y = (rng() - 0.5) * 0.06;
    group.add(block);
    if (!broken) {
      const cap = stoneBox(w + 0.08, 0.08, 0.54, 'steps', { textureScale: 0.8 });
      cap.position.set(x, h + 0.02, z);
      cap.rotation.y = block.rotation.y;
      group.add(cap);
    }
    if (rng() > 0.55) {
      const chip = new THREE.Mesh(makeRockGeometry(220 + i, 1), stoneMaterial('rubble'));
      const s = 0.08 + rng() * 0.14;
      chip.scale.set(s, s * 0.6, s);
      chip.position.set(x + (rng() - 0.5) * w, h + 0.02, z + (rng() - 0.5) * 0.3);
      chip.rotation.set(rng() * 2, rng() * 2, rng() * 2);
      chip.castShadow = true;
      group.add(chip);
    }
    if (grassSites && rng() > 0.42) {
      grassSites.push({
        x: x + (rng() - 0.5) * 0.8,
        y: rng() > 0.3 ? h + 0.02 : 0.02,
        z: z + 0.12 + rng() * 0.4,
        scale: 0.45 + rng() * 0.55,
      });
    }
  }
  // Two weathered piers mark the old gate.
  for (const px of [-9.7, -3.1]) {
    const pier = stoneBox(0.66, 1.05, 0.65, 'rubble', { textureScale: 1.0 });
    pier.position.set(px, 0.51, z);
    group.add(pier);
    const cap = stoneBox(0.82, 0.12, 0.8, 'steps', { textureScale: 0.8 });
    cap.position.set(px, 1.08, z);
    group.add(cap);
    const finial = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 8, 6),
      stoneMaterial('trim', { bumpScale: 0.02 })
    );
    finial.scale.y = 0.6;
    finial.position.set(px, 1.21, z);
    group.add(finial);
  }
  return group;
}

function makeRightRuin(grassSites) {
  const group = new THREE.Group();
  group.name = 'right-ruin';
  const rng = mulberry32(998);
  const segments = 8;
  for (let i = 0; i < segments; i++) {
    const u = i / (segments - 1);
    const z = 4.7 - i * 1.12;
    const h = THREE.MathUtils.lerp(1.05, 3.4, smoothstep(0, 1, u)) + (rng() - 0.5) * 0.25;
    const w = 2.6 + rng() * 0.3;
    const block = stoneBox(w, h, 1.25, 'rubble', { textureScale: 1.55, bumpScale: 0.12 });
    block.position.set(8.45 + (rng() - 0.5) * 0.18, h / 2, z);
    block.rotation.y = -0.03 + (rng() - 0.5) * 0.02;
    block.castShadow = true;
    block.receiveShadow = true;
    group.add(block);

    if (rng() > 0.18) {
      const boulder = new THREE.Mesh(makeRockGeometry(330 + i, 2), stoneMaterial('rubble', { bumpScale: 0.14 }));
      const s = 0.4 + rng() * 0.5;
      boulder.scale.set(s * 1.6, s * 0.85, s * 1.4);
      boulder.position.set(8.45 + (rng() - 0.5) * 1.2, h + 0.1, z + (rng() - 0.5) * 0.6);
      boulder.rotation.set(rng() * 2, rng() * 3, rng() * 2);
      boulder.castShadow = true;
      boulder.receiveShadow = true;
      group.add(boulder);
    }
    if (grassSites && i < 5) {
      grassSites.push({
        x: 7.2 + rng() * 0.55,
        y: h + (rng() > 0.5 ? 0.15 : -0.35),
        z: z + (rng() - 0.5) * 0.8,
        scale: 0.45 + rng() * 0.45,
      });
    }
  }

  // One broad lichen-covered boulder jammed into the foreground.
  const crown = new THREE.Mesh(makeRockGeometry(844, 2), stoneMaterial('rubble', { bumpScale: 0.16 }));
  crown.scale.set(1.7, 1.18, 1.55);
  crown.position.set(8.3, 2.3, 5.1);
  crown.rotation.set(0.2, 0.7, 0.1);
  crown.castShadow = true;
  crown.receiveShadow = true;
  group.add(crown);

  // Lichen splashes on the retaining face, close enough to see.
  const lichenTex = createLichenDecalTexture();
  const mat = new THREE.MeshStandardMaterial({
    map: lichenTex, transparent: true, alphaTest: 0.04, roughness: 1,
    depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1,
  });
  mat.color.setHex(0xc9c8ae);
  const geo = new THREE.PlaneGeometry(1, 1);
  for (let i = 0; i < 9; i++) {
    const patch = new THREE.Mesh(geo, mat);
    patch.scale.set(0.55 + rng() * 1.2, 0.35 + rng() * 0.9, 1);
    patch.position.set(7.11, 0.5 + rng() * 2.2, 4.1 - rng() * 7.3);
    patch.rotation.y = -Math.PI / 2;
    patch.rotation.z = rng() * Math.PI;
    patch.renderOrder = 3;
    group.add(patch);
  }
  return group;
}

function makeDryLeaves(stepInfo) {
  const group = new THREE.Group();
  const rng = mulberry32(717);
  const geo = new THREE.CircleGeometry(0.055, 5);
  const mats = [
    new THREE.MeshStandardMaterial({ color: 0x6f4a24, roughness: 1, side: THREE.DoubleSide }),
    new THREE.MeshStandardMaterial({ color: 0x9b6931, roughness: 1, side: THREE.DoubleSide }),
    new THREE.MeshStandardMaterial({ color: 0x4c2f19, roughness: 1, side: THREE.DoubleSide }),
  ];
  const count = 38;
  for (let i = 0; i < count; i++) {
    const m = new THREE.Mesh(geo, mats[(rng() * mats.length) | 0]);
    let x, y, z;
    if (rng() > 0.35) {
      const s = stepInfo[(rng() * stepInfo.length) | 0];
      x = s.centerX + (rng() - 0.5) * s.width * 0.9;
      y = s.topY + 0.008;
      z = s.frontZ - 0.1 - rng() * 0.55;
    } else {
      x = -6 + rng() * 12;
      y = 0.012;
      z = 4.6 + rng() * 4.8;
    }
    m.position.set(x, y, z);
    m.rotation.x = -Math.PI / 2 + (rng() - 0.5) * 0.2;
    m.rotation.z = rng() * Math.PI;
    m.scale.set(0.7 + rng() * 0.9, 0.45 + rng() * 0.6, 1);
    group.add(m);
  }
  return group;
}

function makeWildflowers() {
  const group = new THREE.Group();
  const rng = mulberry32(6011);
  const stemMat = new THREE.MeshBasicMaterial({ color: 0x5c552c });
  const petalMat = new THREE.MeshBasicMaterial({ color: 0xd9ae53, side: THREE.DoubleSide });
  const geo = new THREE.CircleGeometry(0.026, 5);
  for (let i = 0; i < 24; i++) {
    const x = -12 + rng() * 14;
    const z = 5.0 + rng() * 5.5;
    const h = 0.18 + rng() * 0.28;
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.006, h, 4), stemMat);
    stem.position.set(x, h / 2, z);
    group.add(stem);
    const flower = new THREE.Mesh(geo, petalMat);
    flower.position.set(x, h, z);
    flower.rotation.x = -Math.PI / 2 + (rng() - 0.5) * 0.4;
    flower.rotation.z = rng() * 6;
    flower.scale.setScalar(0.7 + rng() * 0.7);
    group.add(flower);
  }
  return group;
}

export function createForecourt(scene) {
  const group = new THREE.Group();
  group.name = 'forecourt';
  scene.add(group);

  const grassSites = [];

  group.add(makeTerraceGround());
  group.add(makeTerraceEdgeCliff());

  const { group: steps, stepInfo } = makeStepSet();
  group.add(steps);

  // Additional paving stones, loose and uneven, along the terrace.
  const rng = mulberry32(517);
  for (let i = 0; i < 34; i++) {
    const w = 0.7 + rng() * 1.5;
    const d = 0.55 + rng() * 1.15;
    const h = 0.035 + rng() * 0.045;
    const slab = stoneBox(w, h, d, 'ground', { textureScale: 1.0, bumpScale: 0.03 });
    slab.position.set(-14.5 + rng() * 15.2, h / 2 - 0.01, 4.5 + rng() * 8.5);
    slab.rotation.y = (rng() - 0.5) * 0.13;
    slab.receiveShadow = true;
    group.add(slab);
  }

  // Grass gathering places: on step lips, cracks and along the terrace edge.
  for (const s of stepInfo) {
    const count = s.i < 4 ? 7 : 5;
    for (let g = 0; g < count; g++) {
      const side = rng();
      let x;
      if (side < 0.35) x = s.centerX - s.width * 0.5 + 0.12 + rng() * 0.35;
      else if (side > 0.68) x = s.centerX + s.width * 0.5 - 0.12 - rng() * 0.35;
      else x = s.centerX + (rng() - 0.5) * s.width * 0.82;
      if (Math.abs(x - 3.7) < 0.55 && rng() > 0.4) continue;
      grassSites.push({
        x,
        y: s.topY + 0.015,
        z: s.frontZ - 0.16 - rng() * 0.44,
        scale: (0.32 + rng() * 0.6) * (s.i < 3 ? 1.2 : 1.0),
        dry: rng(),
      });
    }
    if (rng() > 0.5) {
      grassSites.push({
        x: s.centerX + (rng() - 0.5) * s.width * 0.7,
        y: s.topY - s.i * 0.0 + 0.02,
        z: s.frontZ - 0.08,
        scale: 0.35 + rng() * 0.25,
        dry: 0.9,
      });
    }
  }
  for (let i = 0; i < 55; i++) {
    const x = -16.5 + rng() * 25;
    const z = 3.5 + rng() * 10.4;
    if (x > -1 && x < 7.2 && z < 5.0) continue;
    grassSites.push({ x, y: 0.01, z, scale: 0.45 + rng() * 0.75, dry: rng() });
  }
  // A few stragglers on the landing and around the door.
  for (let i = 0; i < 12; i++) {
    grassSites.push({
      x: 0.8 + rng() * 6.1,
      y: FLOOR + 0.10,
      z: -1.9 - rng() * 1.7,
      scale: 0.3 + rng() * 0.4,
      dry: 0.7 + rng() * 0.3,
    });
  }

  group.add(makeParapet(grassSites));
  group.add(makeRightRuin(grassSites));
  group.add(makeDryLeaves(stepInfo));
  group.add(makeWildflowers());

  // Some displaced loosened slabs on the top landing.
  for (let i = 0; i < 9; i++) {
    const stone = stoneBox(0.5 + rng() * 0.8, 0.06 + rng() * 0.1, 0.3 + rng() * 0.5, 'steps', { textureScale: 0.9 });
    stone.position.set(1.2 + rng() * 4.8, FLOOR + 0.14, -2.2 - rng() * 2.8);
    stone.rotation.set((rng() - 0.5) * 0.15, rng() * 3, (rng() - 0.5) * 0.15);
    group.add(stone);
  }

  const stepFocus = new THREE.Vector3(2.8, 0.8, 2.7);

  return {
    group,
    grassSites,
    stepFocus,
    stepInfo,
  };
}
