import * as THREE from 'three';
import {
  stoneMaterial, stoneBox, remapBoxUV, woodMaterial, createPlasterTexture,
  createFlameTexture, createGlowTexture, mulberry32,
} from './materials.js';

/* ------------------------------------------------------------------------
   The chapel: a massive weathered facade, a deep sculpted portal and a
   very dark little nave with pews, a high window and votive candles.
------------------------------------------------------------------------- */

export const PORTAL = {
  cx: 4.12,
  floorY: 1.56,
  springY: 5.08,
  radius: 1.37,
  wallFront: -4.15,
  wallBack: -5.35,
};

const FLOOR = PORTAL.floorY;
const CX = PORTAL.cx;
const SPRING = PORTAL.springY;
const R = PORTAL.radius;

function scaleUV(geometry, scale) {
  const uv = geometry.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * scale, uv.getY(i) * scale);
  uv.needsUpdate = true;
  return geometry;
}

function openingPath(cx = CX, y0 = FLOOR, spring = SPRING, r = R) {
  const p = new THREE.Path();
  p.moveTo(cx - r, y0);
  p.lineTo(cx - r, spring);
  p.absarc(cx, spring, r, Math.PI, 0, true);
  p.lineTo(cx + r, y0);
  p.closePath();
  return p;
}

function makeWall() {
  const width = 21;
  const height = 13.8;
  const outer = new THREE.Shape();
  outer.moveTo(0, 0);
  outer.lineTo(width, 0);
  outer.lineTo(width, height);
  outer.lineTo(0, height);
  outer.closePath();
  outer.holes.push(openingPath());

  const geo = new THREE.ExtrudeGeometry(outer, {
    depth: 1.2,
    bevelEnabled: false,
    curveSegments: 32,
  });
  scaleUV(geo, 0.29);
  const mat = stoneMaterial('wall');
  const wall = new THREE.Mesh(geo, mat);
  wall.position.z = PORTAL.wallBack;
  wall.castShadow = true;
  wall.receiveShadow = true;
  wall.name = 'chapel-facade';
  return wall;
}

function archBand(innerR, outerR, frontZ, depth, material) {
  const shape = new THREE.Shape();
  shape.moveTo(-outerR, 0);
  shape.absarc(0, 0, outerR, Math.PI, 0, true);
  shape.lineTo(innerR, 0);
  shape.absarc(0, 0, innerR, 0, Math.PI, false);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: 0.018,
    bevelSize: 0.018,
    bevelSegments: 1,
    curveSegments: 28,
  });
  scaleUV(geo, 0.58);
  const mesh = new THREE.Mesh(geo, material);
  mesh.position.set(CX, SPRING, frontZ - depth);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function makeCapital(radius, material) {
  const group = new THREE.Group();
  const profile = [];
  profile.push(new THREE.Vector2(radius * 0.72, 0));
  profile.push(new THREE.Vector2(radius * 1.0, 0.055));
  profile.push(new THREE.Vector2(radius * 1.2, 0.10));
  profile.push(new THREE.Vector2(radius * 1.08, 0.15));
  profile.push(new THREE.Vector2(radius * 0.91, 0.21));
  profile.push(new THREE.Vector2(radius * 0.87, 0.28));
  profile.push(new THREE.Vector2(radius * 1.22, 0.35));
  profile.push(new THREE.Vector2(radius * 1.15, 0.40));
  const lathe = new THREE.LatheGeometry(profile, 20);
  const belly = new THREE.Mesh(lathe, material);
  belly.castShadow = true;
  belly.receiveShadow = true;
  group.add(belly);

  const abacus = new THREE.Mesh(new THREE.BoxGeometry(radius * 2.9, 0.12, radius * 2.9), material);
  abacus.position.y = 0.44;
  abacus.castShadow = true;
  abacus.receiveShadow = true;
  group.add(abacus);

  // Simplified weathered acanthus leaves around the bell.
  const leafGeo = new THREE.SphereGeometry(1, 5, 4);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const leaf = new THREE.Mesh(leafGeo, material);
    leaf.position.set(Math.cos(a) * radius * 0.9, 0.27, Math.sin(a) * radius * 0.9);
    leaf.scale.set(radius * 0.38, radius * 0.34, radius * 0.2);
    leaf.rotation.y = -a;
    group.add(leaf);
  }
  return group;
}

function makeColumn(x, z, shaftRadius, material, smoothMaterial) {
  const baseY = FLOOR;
  const capitalH = 0.46;
  const baseH = 0.30;
  const topY = SPRING + 0.025;
  const shaftHeight = topY - baseY - capitalH - baseH;
  const g = new THREE.Group();
  g.position.set(x, baseY, z);

  const baseProfile = [
    new THREE.Vector2(shaftRadius * 1.65, 0),
    new THREE.Vector2(shaftRadius * 1.55, 0.05),
    new THREE.Vector2(shaftRadius * 1.3, 0.10),
    new THREE.Vector2(shaftRadius * 1.18, 0.18),
    new THREE.Vector2(shaftRadius * 1.05, 0.28),
    new THREE.Vector2(shaftRadius * 1.0, 0.30),
  ];
  const base = new THREE.Mesh(new THREE.LatheGeometry(baseProfile, 18), material);
  base.castShadow = true;
  base.receiveShadow = true;
  g.add(base);

  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(shaftRadius * 0.86, shaftRadius, shaftHeight, 14, 4),
    smoothMaterial
  );
  shaft.position.y = baseH + shaftHeight / 2;
  shaft.castShadow = true;
  shaft.receiveShadow = true;
  g.add(shaft);

  // A narrow neck ring under the capital.
  const ring = new THREE.Mesh(new THREE.TorusGeometry(shaftRadius * 0.88, shaftRadius * 0.13, 6, 16), material);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = baseH + shaftHeight - 0.04;
  g.add(ring);

  const capital = makeCapital(shaftRadius, material);
  capital.position.y = baseH + shaftHeight;
  g.add(capital);
  return g;
}

function makeDoorLeaf(material, ironMat) {
  const leaf = new THREE.Group();
  const thickness = 0.085;
  const height = 4.55;
  const width = 1.26;
  const body = new THREE.Mesh(new THREE.BoxGeometry(thickness, height, width), material);
  body.position.y = height / 2;
  body.castShadow = true;
  body.receiveShadow = true;
  leaf.add(body);

  // Age-darkened vertical joints and iron studs.
  for (let i = 0; i < 4; i++) {
    const seam = new THREE.Mesh(new THREE.BoxGeometry(thickness + 0.005, height * 0.92, 0.012), new THREE.MeshStandardMaterial({
      color: 0x16110d, roughness: 0.95,
    }));
    seam.position.set(0, height * 0.48, -width / 2 + width * (0.2 + i * 0.2));
    leaf.add(seam);
  }
  const studGeo = new THREE.SphereGeometry(0.024, 6, 4);
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 2; col++) {
      const stud = new THREE.Mesh(studGeo, ironMat);
      stud.position.set(thickness / 2 + 0.012, 0.7 + row * 0.8, -0.33 + col * 0.66);
      stud.scale.z = 0.7;
      leaf.add(stud);
    }
  }
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.012, 5, 12), ironMat);
  ring.position.set(thickness / 2 + 0.03, 2.1, 0.35);
  ring.rotation.y = Math.PI / 2;
  leaf.add(ring);
  return leaf;
}

function addLichenDecals(group, mat) {
  const planeGeo = new THREE.PlaneGeometry(1, 1);
  const rng = mulberry32(5202);
  const spots = [
    [1.35, 3.1, 1.2, 0.8], [2.2, 6.3, 1.8, 1.1], [0.55, 8.4, 1.4, 0.9],
    [7.1, 6.2, 1.6, 1.1], [9.4, 3.3, 2.2, 1.3], [11.8, 8.7, 2.8, 1.5],
    [7.9, 10.6, 1.8, 1.2], [1.0, 1.3, 0.9, 0.6], [13.6, 5.0, 2.0, 1.2],
  ];
  for (const [x, y, w, h] of spots) {
    const m = new THREE.Mesh(planeGeo, mat);
    m.scale.set(w, h, 1);
    m.position.set(x, y, PORTAL.wallFront + 0.006 + rng() * 0.008);
    m.rotation.z = (rng() - 0.5) * 0.5;
    m.renderOrder = 2;
    group.add(m);
  }
}

function makeWindow() {
  const s = new THREE.Shape();
  const w = 0.38;
  const h = 1.38;
  s.moveTo(-w / 2, 0);
  s.lineTo(w / 2, 0);
  s.lineTo(w / 2, h - w / 2);
  s.absarc(0, h - w / 2, w / 2, 0, Math.PI, false);
  s.lineTo(-w / 2, 0);
  const geo = new THREE.ShapeGeometry(s, 12);
  const material = new THREE.MeshBasicMaterial({ color: 0xffe1a1, toneMapped: true });
  material.color.setRGB(2.35, 1.62, 0.86);
  const windowMesh = new THREE.Mesh(geo, material);
  windowMesh.position.set(4.74, 3.26, -13.77);
  const frame = new THREE.Group();
  const dark = new THREE.MeshStandardMaterial({ color: 0x17130f, roughness: 0.9 });
  for (let i = -2; i <= 2; i++) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.018, 1.42, 0.03), dark);
    bar.position.set(4.74 + i * 0.072, 3.96, -13.74);
    frame.add(bar);
  }
  const crossBar = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.022, 0.03), dark);
  crossBar.position.set(4.74, 3.96, -13.74);
  frame.add(crossBar);
  return { windowMesh, frame };
}

function makeBench(width, mat, darkMat) {
  const g = new THREE.Group();
  const seatY = 0.48;
  const seat = new THREE.Mesh(new THREE.BoxGeometry(width, 0.075, 0.46), mat);
  seat.position.set(0, seatY, 0);
  seat.castShadow = true;
  seat.receiveShadow = true;
  g.add(seat);

  const back = new THREE.Mesh(new THREE.BoxGeometry(width, 0.52, 0.055), mat);
  back.position.set(0, seatY + 0.4, -0.23);
  back.rotation.x = -0.07;
  back.castShadow = true;
  g.add(back);

  for (let i = 0; i < 3; i++) {
    const slat = new THREE.Mesh(new THREE.BoxGeometry(width - 0.08, 0.035, 0.02), mat);
    slat.position.set(0, seatY + 0.19 + i * 0.16, 0.2);
    g.add(slat);
  }

  for (const sx of [-width / 2 + 0.08, width / 2 - 0.08]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.09, seatY, 0.37), darkMat);
    leg.position.set(sx, seatY / 2, 0);
    leg.castShadow = true;
    g.add(leg);
  }
  return g;
}

function makeCandle(height, rng, mats) {
  const g = new THREE.Group();
  const candle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.032, 0.038, height, 8),
    mats.wax
  );
  candle.position.y = height / 2;
  g.add(candle);
  const wick = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.007, 0.045, 5), mats.wick);
  wick.position.y = height + 0.02;
  g.add(wick);

  const flameMat = new THREE.SpriteMaterial({
    map: mats.flameTexture,
    color: 0xffd58d,
    transparent: true,
    opacity: 0.95,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const flame = new THREE.Sprite(flameMat);
  flame.position.y = height + 0.085;
  flame.scale.set(0.055, 0.115, 1);
  g.add(flame);
  const glowMat = new THREE.SpriteMaterial({
    map: mats.glowTexture,
    color: 0xff9d52,
    transparent: true,
    opacity: 0.34,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const glow = new THREE.Sprite(glowMat);
  glow.position.y = height + 0.08;
  glow.scale.set(0.35, 0.35, 1);
  g.add(glow);
  return { group: g, flame, glow, height, phase: rng() * Math.PI * 2 };
}

function makeCandelabra(mats, rng) {
  const g = new THREE.Group();
  const iron = new THREE.MeshStandardMaterial({ color: 0x1a1612, roughness: 0.62, metalness: 0.55 });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.42, 0.06, 10), iron);
  base.position.y = 0.03;
  g.add(base);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.04, 1.55, 8), iron);
  stem.position.y = 0.8;
  g.add(stem);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.018, 5, 12), iron);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.22;
  g.add(ring);

  const arms = new THREE.Group();
  arms.position.y = 1.58;
  for (let i = 0; i < 3; i++) {
    const a = -0.8 + i * 0.8;
    const arm = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.012, 4, 14, Math.PI), iron);
    arm.rotation.z = a;
    arm.position.set(Math.sin(a) * 0.18, 0.09, 0);
    arms.add(arm);
  }
  const cross = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.025, 0.025), iron);
  cross.position.y = 0.15;
  arms.add(cross);
  g.add(arms);

  const candles = [];
  const offsets = [-0.36, -0.18, 0, 0.18, 0.36];
  const heights = [0.28, 0.36, 0.44, 0.31, 0.24];
  offsets.forEach((x, i) => {
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.025, 0.05, 8), iron);
    cup.position.set(x, 1.73, 0);
    g.add(cup);
    const c = makeCandle(heights[i], rng, mats);
    c.group.position.set(x, 1.75, 0);
    g.add(c.group);
    candles.push(c);
  });
  return { group: g, candles };
}

export function createChurch(scene) {
  const group = new THREE.Group();
  group.name = 'chapel';
  scene.add(group);

  const trimMat = stoneMaterial('trim', { bumpScale: 0.035 });
  const smoothStone = new THREE.MeshStandardMaterial({
    color: 0x9b9280,
    map: null,
    roughness: 0.88,
    metalness: 0,
    bumpMap: stoneMaterial('trim').bumpMap,
    bumpScale: 0.025,
  });
  const ironMat = new THREE.MeshStandardMaterial({ color: 0x191613, roughness: 0.68, metalness: 0.58 });
  const woodMat = woodMaterial();
  woodMat.color.setHex(0x574331);
  woodMat.roughness = 0.88;
  const darkWood = new THREE.MeshStandardMaterial({ color: 0x241c15, roughness: 0.9 });

  /* ----------------------------- Facade ----------------------------- */

  group.add(makeWall());

  // A deep plinth anchors the building to the hill.
  const plinth = stoneBox(21, 0.72, 1.4, 'wall', { textureScale: 2.0 });
  plinth.position.set(10.5, 0.36, PORTAL.wallFront + 0.06);
  group.add(plinth);

  // Corner and intermediate buttresses create a little movement in the mass.
  for (const [bx, by, bw, bh, bd] of [
    [-0.12, 6.6, 0.42, 13.2, 1.5],
    [8.2, 5.1, 0.85, 10.2, 1.48],
    [15.6, 5.5, 0.7, 11.0, 1.46],
  ]) {
    const b = stoneBox(bw, bh, bd, 'wall', { textureScale: 2.1 });
    b.position.set(bx, by, PORTAL.wallFront + 0.02);
    group.add(b);
  }

  // Nested archivolts stepping inward, like worn stone lace.
  group.add(archBand(1.37, 1.53, -3.895, 0.40, trimMat));
  group.add(archBand(1.53, 1.79, -4.00, 0.34, trimMat));
  group.add(archBand(1.79, 2.10, -4.11, 0.28, trimMat));

  // Square jambs and plinths around the portal.
  for (const sign of [-1, 1]) {
    const jx = CX + sign * 2.32;
    const jamb = stoneBox(0.52, SPRING - FLOOR, 0.52, 'trim', { textureScale: 1.6 });
    jamb.position.set(jx, FLOOR + (SPRING - FLOOR) / 2, PORTAL.wallFront + 0.06);
    group.add(jamb);

    const foot = stoneBox(0.66, 0.30, 0.62, 'trim', { textureScale: 1.6 });
    foot.position.set(jx, FLOOR + 0.15, PORTAL.wallFront + 0.08);
    group.add(foot);
  }

  // A plain outer hood, echoed higher up with a small keystone.
  const keystone = stoneBox(0.34, 0.58, 0.2, 'trim', { textureScale: 1.2 });
  keystone.position.set(CX, SPRING + 2.12, -3.82);
  group.add(keystone);

  // Twin colonnettes each side, with carved bases and capitals.
  for (const sign of [-1, 1]) {
    const main = makeColumn(CX + sign * 1.55, -3.58, 0.142, trimMat, smoothStone);
    group.add(main);
    const companion = makeColumn(CX + sign * 1.83, -3.56, 0.105, trimMat, smoothStone);
    group.add(companion);
    // Impost ledge linking the two capitals.
    const ledge = stoneBox(0.58, 0.10, 0.36, 'trim', { textureScale: 1.0 });
    ledge.position.set(CX + sign * 1.69, SPRING - 0.02, -3.53);
    group.add(ledge);
  }

  // Lichen crawling over the left face of the wall.
  const lichenTex = makeLichenMaterialMap();
  const lichenMat = new THREE.MeshStandardMaterial({
    map: lichenTex,
    transparent: true,
    alphaTest: 0.06,
    roughness: 1,
    metalness: 0,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
  });
  addLichenDecals(group, lichenMat);

  // A few displaced stones enliven the ashlar plane at grazing light.
  const rng = mulberry32(812);
  for (let i = 0; i < 26; i++) {
    const w = 0.16 + rng() * 0.36;
    const h = 0.11 + rng() * 0.28;
    const s = stoneBox(w, h, 0.04 + rng() * 0.055, 'wall', { textureScale: 1.2 });
    s.position.set(0.5 + rng() * 13.0, 0.8 + rng() * 10.7, PORTAL.wallFront + 0.01);
    s.rotation.z = (rng() - 0.5) * 0.06;
    group.add(s);
  }

  // Threshold worn into a shallow saddle.
  const threshold = stoneBox(3.12, 0.16, 0.5, 'steps', { textureScale: 1.0 });
  threshold.position.set(CX, FLOOR - 0.06, -4.18);
  group.add(threshold);

  /* ----------------------------- Door leaves ----------------------------- */

  const doorPivot = new THREE.Group();
  doorPivot.position.set(CX - R + 0.05, FLOOR, -4.30);
  doorPivot.rotation.y = -1.24;
  const leaf = makeDoorLeaf(woodMat, ironMat);
  leaf.position.z = 0.63;
  doorPivot.add(leaf);
  group.add(doorPivot);

  const doorPivot2 = new THREE.Group();
  doorPivot2.position.set(CX + R - 0.05, FLOOR, -4.30);
  doorPivot2.rotation.y = 1.3;
  const leaf2 = makeDoorLeaf(woodMat, ironMat);
  leaf2.position.z = 0.63;
  doorPivot2.add(leaf2);
  group.add(doorPivot2);

  /* ----------------------------- Nave ----------------------------- */

  const nave = new THREE.Group();
  nave.name = 'nave';
  group.add(nave);

  const plasterTex = createPlasterTexture();
  const plasterMat = new THREE.MeshStandardMaterial({
    map: plasterTex,
    color: 0x72614d,
    roughness: 0.97,
    metalness: 0,
    side: THREE.DoubleSide,
  });
  plasterMat.map.repeat.set(2.2, 1.4);
  const floorMat = stoneMaterial('ground', { bumpScale: 0.04 });
  floorMat.color.setHex(0x5e5548);

  const innerW = 7.2;
  const innerBack = -13.9;
  const innerFront = PORTAL.wallFront - 0.1;

  const floor = new THREE.Mesh(new THREE.BoxGeometry(innerW, 0.16, innerFront - innerBack), floorMat);
  floor.position.set(CX, FLOOR + 0.02, (innerFront + innerBack) / 2);
  floor.receiveShadow = true;
  nave.add(floor);
  // A step up into the nave.
  const innerStep = stoneBox(innerW - 0.3, 0.14, 0.36, 'steps', { textureScale: 1.0 });
  innerStep.position.set(CX, FLOOR + 0.07, innerFront - 0.2);
  nave.add(innerStep);

  const backWall = new THREE.Mesh(new THREE.BoxGeometry(innerW + 0.6, 7.5, 0.25), plasterMat);
  backWall.position.set(CX, FLOOR + 3.7, innerBack);
  backWall.receiveShadow = true;
  nave.add(backWall);

  for (const sign of [-1, 1]) {
    const side = new THREE.Mesh(new THREE.BoxGeometry(0.28, 6.7, innerFront - innerBack + 0.2), plasterMat);
    side.position.set(CX + sign * (innerW / 2 + 0.15), FLOOR + 3.35, (innerFront + innerBack) / 2);
    side.receiveShadow = true;
    nave.add(side);
  }

  const ceiling = new THREE.Mesh(new THREE.BoxGeometry(innerW + 0.4, 0.25, innerFront - innerBack), plasterMat.clone());
  ceiling.material.color.setHex(0x392f27);
  ceiling.position.set(CX, 7.35, (innerFront + innerBack) / 2);
  nave.add(ceiling);

  // Two heavy beams in the dark, just visible from the threshold.
  for (const bz of [-7.9, -11.0]) {
    const beam = new THREE.Mesh(new THREE.BoxGeometry(innerW + 0.2, 0.28, 0.42), darkWood);
    beam.position.set(CX, 6.95, bz);
    beam.castShadow = true;
    nave.add(beam);
    for (const sign of [-1, 1]) {
      const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.55, 0.6), darkWood);
      bracket.position.set(CX + sign * (innerW / 2 - 0.35), 6.58, bz);
      nave.add(bracket);
    }
  }

  // A faint transverse arch gives depth to the darkness.
  const ribMat = new THREE.MeshStandardMaterial({ color: 0x51473a, roughness: 0.95 });
  const rib = new THREE.Mesh(new THREE.TorusGeometry(3.05, 0.12, 6, 26, Math.PI), ribMat);
  rib.position.set(CX, 6.0, -9.4);
  rib.scale.y = 1.35;
  nave.add(rib);

  const { windowMesh, frame } = makeWindow();
  nave.add(windowMesh, frame);

  // Pews.  Their silhouettes are the first thing the warm light finds.
  const pewRows = [-6.35, -7.85, -9.35, -10.85];
  for (let i = 0; i < pewRows.length; i++) {
    const bench = makeBench(3.75 - i * 0.07, woodMat, darkWood);
    bench.position.set(CX - 0.4 + (i % 2) * 0.08, FLOOR + 0.11, pewRows[i]);
    bench.rotation.y = 0.012 * (i % 2 ? -1 : 1);
    nave.add(bench);
    const sideBench = makeBench(1.5, woodMat, darkWood);
    sideBench.position.set(CX + 2.78, FLOOR + 0.11, pewRows[i] + 0.05);
    sideBench.rotation.y = -0.08;
    nave.add(sideBench);
  }

  // Altar and cross.
  const altar = new THREE.Group();
  const altarTop = new THREE.Mesh(new THREE.BoxGeometry(2.45, 0.12, 0.68), woodMat);
  altarTop.position.y = 1.0;
  altarTop.castShadow = true;
  altar.add(altarTop);
  for (const sx of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.98, 0.54), darkWood);
    leg.position.set(sx * 1.05, 0.49, 0);
    altar.add(leg);
  }
  const cloth = new THREE.Mesh(
    new THREE.BoxGeometry(2.35, 0.02, 0.72),
    new THREE.MeshStandardMaterial({ color: 0x7a6b53, roughness: 1 })
  );
  cloth.position.y = 1.07;
  altar.add(cloth);
  altar.position.set(CX - 0.1, FLOOR + 0.1, -12.45);
  nave.add(altar);

  const crossMat = new THREE.MeshStandardMaterial({ color: 0x242018, roughness: 0.75, metalness: 0.15 });
  const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.075, 1.25, 0.075), crossMat);
  crossV.position.set(CX + 0.25, FLOOR + 1.85, -12.5);
  nave.add(crossV);
  const crossH = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.075, 0.075), crossMat);
  crossH.position.set(CX + 0.25, FLOOR + 2.18, -12.5);
  nave.add(crossH);

  // Candelabra and little votive lights.
  const candleMats = {
    wax: new THREE.MeshStandardMaterial({ color: 0xd5c6a3, roughness: 0.78, emissive: 0x3c2913, emissiveIntensity: 0.6 }),
    wick: new THREE.MeshStandardMaterial({ color: 0x16110b, roughness: 1 }),
    flameTexture: createFlameTexture(),
    glowTexture: createGlowTexture(),
  };
  const rng2 = mulberry32(451);
  const candelabra = makeCandelabra(candleMats, rng2);
  candelabra.group.position.set(CX + 2.12, FLOOR + 0.12, -10.25);
  candelabra.group.rotation.y = -0.16;
  nave.add(candelabra.group);

  const altarCandles = [];
  for (const sx of [-0.72, 0.72]) {
    const c = makeCandle(0.26 + rng2() * 0.08, rng2, candleMats);
    c.group.position.set(CX + 0.25 + sx, FLOOR + 1.21, -12.35);
    nave.add(c.group);
    altarCandles.push(c);
  }

  const windowLight = new THREE.PointLight(0xffd7a0, 26, 10, 2);
  windowLight.position.set(CX + 0.6, FLOOR + 3.3, -12.6);
  nave.add(windowLight);
  const windowFill = new THREE.PointLight(0x8a6c62, 3.2, 10, 2);
  windowFill.position.set(CX + 0.3, 5.6, -8.0);
  nave.add(windowFill);

  const candleLight = new THREE.PointLight(0xff9a48, 2.2, 7.5, 2);
  candleLight.position.set(CX + 2.12, FLOOR + 1.30, -9.8);
  nave.add(candleLight);

  /* Soft warm spill from the doorway when the viewer leans in. */
  const spill = new THREE.SpotLight(0xffa45d, 0, 17, 0.72, 0.96, 1.6);
  spill.position.set(CX, FLOOR + 1.35, PORTAL.wallFront - 0.3);
  spill.target.position.set(CX - 0.9, 0.1, 4.6);
  scene.add(spill, spill.target);

  const doorGlowLight = new THREE.PointLight(0xff9a52, 0, 9.5, 2);
  doorGlowLight.position.set(CX, FLOOR + 1.15, -5.1);
  scene.add(doorGlowLight);

  /* A breath of dust in the nave, only visible against the candles. */
  const dust = makeDust(nave);

  const focusPoint = new THREE.Vector3(CX, FLOOR + 1.9, -8.0);
  const lanternPoint = new THREE.Vector3(CX, FLOOR + 1.4, PORTAL.wallFront - 0.3);

  function update(time, focus, wind) {
    const flickerBase = 0.88 + 0.08 * Math.sin(time * 2.3) + 0.04 * Math.sin(time * 5.7 + 1.7);
    const intensity = 2.2 + focus * 3.6;
    candleLight.intensity = intensity * (0.9 + 0.1 * Math.sin(time * 7.3));
    spill.intensity = focus * 72.0;
    doorGlowLight.intensity = focus * 15.0;
    windowLight.intensity = 24.0 + Math.sin(time * 0.7) * 0.8;

    for (const c of [...candelabra.candles, ...altarCandles]) {
      const f = 0.75 + 0.25 * Math.sin(time * (6.1 + c.phase) + c.phase) * Math.sin(time * 2.2 + c.phase * 2.0);
      const grow = 0.7 + focus * 0.9;
      c.flame.scale.set(0.052 * grow * (0.9 + f * 0.18), 0.115 * grow * (0.83 + f * 0.3), 1);
      c.flame.position.x = Math.sin(time * 3.3 + c.phase) * 0.007 + Math.sin(time * 7.7 + c.phase) * 0.003;
      c.flame.material.opacity = 0.8 + f * 0.2;
      c.glow.scale.setScalar(0.30 + focus * 0.28 + f * 0.035);
      c.glow.material.opacity = 0.26 + focus * 0.32 + f * 0.05;
    }

    // Every few seconds the votive light catches a fold of stone.
    const glimmer = 0.86 + 0.14 * Math.sin(time * 1.3 + Math.sin(time * 3.1) * 0.8);
    spill.color.setHSL(0.072, 0.54, 0.52 + focus * 0.06);
    spill.intensity = focus * 72.0 * glimmer;
    dust.material.uniforms.uTime.value = time;
    dust.material.uniforms.uFocus.value = focus;
    dust.material.uniforms.uWind.value = wind;
  }

  update(0, 0, 0);

  return {
    group, nave, update, focusPoint, lanternPoint,
    candleLight, windowLight, spill, doorGlowLight,
    candelabra, altarCandles,
  };
}

function makeLichenMaterialMap() {
  // A tiny repeated lichen alpha field, reused across a few flat decals.
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  const rng = mulberry32(719);
  ctx.clearRect(0, 0, 256, 256);
  for (let i = 0; i < 300; i++) {
    const x = rng() * 256;
    const y = rng() * 256;
    const r = 2 + Math.pow(rng(), 2) * 28;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(206,208,180,${0.1 + rng() * 0.5})`);
    g.addColorStop(0.65, `rgba(185,191,158,${0.08 + rng() * 0.25})`);
    g.addColorStop(1, 'rgba(170,180,148,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}

function makeDust(parent) {
  const count = 150;
  const positions = new Float32Array(count * 3);
  const seeds = new Float32Array(count * 2);
  const rng = mulberry32(1912);
  for (let i = 0; i < count; i++) {
    positions[i * 3] = CX - 1.5 + rng() * 3.4;
    positions[i * 3 + 1] = FLOOR + 0.2 + rng() * 3.8;
    positions[i * 3 + 2] = -13.3 + rng() * 8.2;
    seeds[i * 2] = rng();
    seeds[i * 2 + 1] = rng();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 2));
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uFocus: { value: 0 },
      uWind: { value: 0 },
      uColor: { value: new THREE.Color('#ffc07d') },
    },
    vertexShader: /* glsl */`
      attribute vec2 aSeed;
      uniform float uTime;
      uniform float uFocus;
      uniform float uWind;
      varying float vAlpha;
      void main() {
        vec3 p = position;
        float t = uTime * (0.04 + aSeed.x * 0.05) + aSeed.y * 6.2831;
        p.x += sin(t + p.z) * (0.10 + aSeed.y * 0.12);
        p.y += sin(t * 1.7 + aSeed.x * 5.0) * 0.08 + mod(uTime * 0.018, 1.0) * 0.15;
        p.z += cos(t * 1.2 + aSeed.x * 3.0) * 0.08;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = (2.0 + aSeed.y * 3.0) * (240.0 / -mv.z);
        gl_Position = projectionMatrix * mv;
        vAlpha = (0.14 + aSeed.x * 0.38) * (0.35 + uFocus * 0.9);
      }
    `,
    fragmentShader: /* glsl */`
      uniform vec3 uColor;
      varying float vAlpha;
      void main() {
        vec2 q = gl_PointCoord - 0.5;
        float a = smoothstep(0.5, 0.04, length(q));
        gl_FragColor = vec4(uColor * 1.4, a * vAlpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  parent.add(points);
  return points;
}
