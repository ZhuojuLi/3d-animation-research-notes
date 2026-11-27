import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { rng, hash } from './materials.js';

function taperedBranch(points, radius, tip = .13, sides = 7) {
  const curve = new THREE.CatmullRomCurve3(points); const segments = Math.max(7, points.length * 5);
  const geo = new THREE.TubeGeometry(curve, segments, 1, sides, false); const p = geo.attributes.position, uv = geo.attributes.uv;
  const center = new THREE.Vector3(), q = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) { const t = uv.getX(i); curve.getPointAt(t, center); q.fromBufferAttribute(p, i).sub(center); const r = radius * (1 - t * (1 - tip)); p.setXYZ(i, center.x + q.x * r, center.y + q.y * r, center.z + q.z * r); }
  geo.computeVertexNormals(); return geo;
}

function windMaterial(material, uniforms, grass = false) {
  material.onBeforeCompile = shader => {
    shader.uniforms.uWindTime = uniforms.time; shader.uniforms.uWindStrength = uniforms.wind;
    shader.vertexShader = 'uniform float uWindTime; uniform float uWindStrength;\n' + shader.vertexShader;
    const code = grass ? `
      #include <begin_vertex>
      float phase = 0.0;
      #ifdef USE_INSTANCING
      phase = instanceMatrix[3].x * 1.17 + instanceMatrix[3].z * .83;
      #endif
      float bend = pow(clamp(position.y, 0.0, 1.0), 1.65);
      transformed.x += (sin(uWindTime * 1.45 + phase) * .095 + sin(uWindTime * 2.23 + phase * 1.7) * .027) * bend * (.32 + uWindStrength);
      transformed.z += cos(uWindTime * 1.09 + phase * .7) * .048 * bend * (.2 + uWindStrength);
      ` : `
      #include <begin_vertex>
      float phase = 0.0;
      #ifdef USE_INSTANCING
      phase = instanceMatrix[3].x * .92 + instanceMatrix[3].z * .73;
      #endif
      transformed.x += sin(uWindTime * .85 + phase) * .052 * uWindStrength;
      transformed.z += cos(uWindTime * .63 + phase * 1.4) * .039 * uWindStrength;
      `;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', code);
  };
  material.customProgramCacheKey = () => grass ? 'dry-grass-wind-v2' : 'sparse-leaf-wind-v2';
  return material;
}

function twistedTree(scene, opts, materials, uniforms, random) {
  const root = new THREE.Group(); root.position.copy(opts.root); root.scale.setScalar(opts.scale || 1); root.name = opts.name; scene.add(root);
  const branchGeos = [], leafPoints = [];
  const s = opts.lean || 0;
  const trunkPoints = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(-.24 + s * .2, 1.08, .04), new THREE.Vector3(-.50 + s * .5, 2.17, -.05), new THREE.Vector3(-.28 + s * .9, 3.22, .14), new THREE.Vector3(.12 + s, 4.29, .05), new THREE.Vector3(.45 + s * 1.3, 5.29, -.1), new THREE.Vector3(.32 + s * 1.5, 6.15, .07), new THREE.Vector3(.78 + s * 1.6, 6.85, -.10)];
  branchGeos.push(taperedBranch(trunkPoints, .245, .038, 9));
  function grow(start, direction, length, radius, depth, key) {
    const dir = direction.clone().normalize();
    const mid = start.clone().addScaledVector(dir, length * .34);
    mid.add(new THREE.Vector3((random() - .5) * .28, (random() - .5) * .17, (random() - .5) * .28));
    const bend = start.clone().addScaledVector(dir, length * .70);
    bend.add(new THREE.Vector3((random() - .5) * .42, (random() - .5) * .23, (random() - .5) * .34));
    const end = start.clone().addScaledVector(dir, length);
    end.add(new THREE.Vector3((random() - .5) * .30, .04 + random() * .17, (random() - .5) * .30));
    branchGeos.push(taperedBranch([start, mid, bend, end], radius, depth === 0 ? .09 : .27, depth > 1 ? 7 : 5));
    if (depth <= 0) { leafPoints.push({ p: end, key }, { p: bend, key: key + 19 }); return; }
    const count = depth > 1 ? (key % 3 === 0 ? 2 : 3) : 2;
    for (let j = 0; j < count; j++) {
      const f = count === 3 ? [.48, .73, .94][j] : [.65, .94][j];
      const from = bend.clone().lerp(end, f);
      const side = j % 2 ? -1 : 1;
      const angle = side * (.55 + random() * 1.05) + key * .37;
      const child = dir.clone().multiplyScalar(.54);
      child.x += Math.sin(angle) * (.69 + random() * .32);
      child.z += Math.cos(angle) * .68 + (random() - .5) * .40;
      child.y += .14 + random() * .39;
      child.y = THREE.MathUtils.clamp(child.y, -.04, .79);
      grow(from, child, length * (.41 + random() * .23), radius * (.30 + random() * .15), depth - 1, key * 2 + j + 1);
    }
  }
  const endpoints = [2, 3, 3, 4, 4, 5, 5, 6, 6, 7];
  endpoints.forEach((e, i) => {
    const side = i % 2 ? 1 : -1; const dir = new THREE.Vector3(side * (.78 + random() * .28), .33 + random() * .35, (random() - .5) * .85);
    grow(trunkPoints[e].clone(), dir, (1.5 + random() * 1.35) * (e < 4 ? 1.08 : .92), .066 + (7 - e) * .009, i % 4 === 0 || i % 3 === 0 ? 3 : 2, i + 1);
  });
  for (let i = 0; i < 5; i++) {
    const dir = new THREE.Vector3(Math.sin(i * 2.7) * .8, .08, Math.cos(i * 2.7) * .9);
    grow(new THREE.Vector3(0, .14, 0), dir, .52 + random() * .4, .075, 0, i + 24);
  }
  const merged = mergeGeometries(branchGeos); branchGeos.forEach(g => g.dispose());
  const trunk = new THREE.Mesh(merged, materials.barkMat); trunk.castShadow = trunk.receiveShadow = true; root.add(trunk);
  const leafCount = opts.leaves || 550;
function makeDryLeafGeometry() {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([
    0,0,0, -.040,.061,0, 0,.012,.008,
    -.040,.061,0, -.036,.124,.003, 0,.074,.015,
    -.036,.124,.003, 0,.183,-.004, 0,.074,.015,
    0,.183,-.004, .035,.122,.003, 0,.074,.015,
    .035,.122,.003, .039,.057,0, 0,.074,.015,
    .039,.057,0, 0,0,0, 0,.074,.015
  ],3));
  g.computeVertexNormals(); return g;
}
  const leafGeo = makeDryLeafGeometry();
  const leafMat = windMaterial(new THREE.MeshStandardMaterial({ color: 0x777053, roughness: 1, side: THREE.DoubleSide, vertexColors: false }), uniforms, false);
  const leaves = new THREE.InstancedMesh(leafGeo, leafMat, leafCount); leaves.name = '稀疏残叶';
  const dummy = new THREE.Object3D(), tint = new THREE.Color();
  for (let i = 0; i < leafCount; i++) {
    const sample = leafPoints[Math.floor(random() * leafPoints.length)]; const p = sample.p;
    dummy.position.set(p.x + (random() - .5) * .76, p.y + (random() - .5) * .54, p.z + (random() - .5) * .70);
    dummy.rotation.set(random() * Math.PI, random() * Math.PI * 2, random() * Math.PI); const sc = .74 + random() * .90; dummy.scale.set(sc, sc * (1 + random() * .5), sc); dummy.updateMatrix(); leaves.setMatrixAt(i, dummy.matrix);
    tint.setHSL(.10 + random() * .04, .10 + random() * .15, .16 + random() * .14); leaves.setColorAt(i, tint);
  }
  leaves.castShadow = true; leaves.receiveShadow = true; root.add(leaves);
  root.userData.restZ = root.rotation.z; root.userData.phase = random() * 10; return root;
}

function makeGrassGeometry() {
  const positions = [], uv = [], colors = [], indices = []; const segments = 5;
  for (let i = 0; i <= segments; i++) {
    const t = i / segments, w = .025 * (1 - t) + .0007, yy = t, z = t * t * .13;
    positions.push(-w, yy, z, w, yy, z); uv.push(0, t, 1, t);
    const c = new THREE.Color().setHSL(.115, .33, .32 + t * .42); for (let k = 0; k < 2; k++) colors.push(c.r, c.g, c.b);
    if (i < segments) { const n = i * 2; indices.push(n, n + 1, n + 3, n, n + 3, n + 2); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3)); g.setIndex(indices); g.computeVertexNormals(); return g;
}

export function buildVegetation(scene, materials, architecture) {
  const random = rng(38763), uniforms = { time: { value: 0 }, wind: { value: .35 } };
  const trees = [];
  trees.push(twistedTree(scene, { root: new THREE.Vector3(-11.35, -.72, -4.6), scale: .68, lean: -.42, name: '前景扭曲橄榄树', leaves: 7200 }, materials, uniforms, random));
  trees.push(twistedTree(scene, { root: new THREE.Vector3(-1.05, 1.15, -7.75), scale: .79, lean: -.60, name: '拱墙旁的枯树', leaves: 6100 }, materials, uniforms, random));
  trees.push(twistedTree(scene, { root: new THREE.Vector3(-14.5, -2.4, -11.5), scale: .48, lean: .4, name: '远处谷边疏树', leaves: 980 }, materials, uniforms, random));
  trees.push(twistedTree(scene, { root: new THREE.Vector3(-24.0, -5.5, -21.0), scale: .54, lean: -.8, name: '谷坡孤树', leaves: 750 }, materials, uniforms, random));
  trees.push(twistedTree(scene, { root: new THREE.Vector3(7.1, 1.65, -1.9), scale: .50, lean: -1.05, name: '右侧荒废山楂灌丛', leaves: 3900 }, materials, uniforms, random));
  const grassMat = windMaterial(new THREE.MeshStandardMaterial({ color: 0xf1dfb7, side: THREE.DoubleSide, roughness: .97, vertexColors: true }), uniforms, true);
  const clumps = [];
  const steps = architecture.stairInfo.steps;
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i]; const count = i < 10 ? 8 + Math.floor(random() * 5) : 5 + Math.floor(random() * 5);
    for (let j = 0; j < count; j++) {
      if (random() < .22) continue;
      const edgeSide = random() < .72;
      const x = edgeSide ? (random() > .5 ? step.xMax - random() * 1.1 : step.xMin + random() * 1.25) : step.xMin + .8 + random() * (step.xMax - step.xMin - 1.6);
      const z = random() > .52 ? step.zFront - .02 - random() ** 1.8 * .22 : step.zBack + .02 + random() ** 1.8 * .20;
      clumps.push({ x, y: step.top + .006, z, height: random() < .58 ? .13 + random() * .25 : .24 + random() ** 1.35 * .46 });
    }
  }
  for (let i = 0; i < 90; i++) {
    const x = -15.3 + random() * 9.0, z = -1.3 + random() * 19.0;
    const groundY = -.08 - Math.max(0, -6.4 - x) * .14;
    clumps.push({ x, y: groundY, z, height: .18 + random() ** 1.4 * .57 });
  }
  const bladesPer = 20, count = clumps.length * bladesPer;
  const grass = new THREE.InstancedMesh(makeGrassGeometry(), grassMat, count); grass.name = '石缝中的暖黄枯草'; const dummy = new THREE.Object3D(), tint = new THREE.Color(); let n = 0;
  clumps.forEach(c => {
    for (let j = 0; j < bladesPer; j++) {
      const ang = random() * Math.PI * 2, rad = random() ** 1.7 * .19;
      dummy.position.set(c.x + Math.cos(ang) * rad, c.y - random() * .035, c.z + Math.sin(ang) * rad);
      dummy.rotation.set((random() - .5) * .38, ang, (random() - .5) * .30);
      const h = c.height * (.40 + random() * .95); dummy.scale.set(.50 + random() * .80, h, .65 + random() * .8); dummy.updateMatrix(); grass.setMatrixAt(n, dummy.matrix);
      tint.setHSL(.105 + random() * .055, .16 + random() * .25, .42 + random() * .28); grass.setColorAt(n, tint); n++;
    }
  });
  grass.castShadow = true; grass.receiveShadow = true; scene.add(grass);
  // Smaller green-grey seams at the bases of old stones.
  const mossGeo = new THREE.IcosahedronGeometry(1, 0), mossMat = new THREE.MeshStandardMaterial({ color: 0x4b5030, roughness: 1, vertexColors: true });
  const moss = new THREE.InstancedMesh(mossGeo, mossMat, 540);
  for (let i = 0; i < 540; i++) {
    const c = clumps[Math.floor(random() * clumps.length)]; const s = .018 + random() * .042;
    dummy.position.set(c.x + (random() - .5) * .34, c.y + .004, c.z + (random() - .5) * .23); dummy.rotation.set(random() * 2, random() * 6, random() * 2); dummy.scale.set(s * 2.0, s * .30, s * 1.45); dummy.updateMatrix(); moss.setMatrixAt(i, dummy.matrix);
    tint.setHSL(.18, .12 + random() * .20, .25 + random() * .12); moss.setColorAt(i, tint);
  }
  moss.receiveShadow = true; scene.add(moss);
  return { uniforms, trees, grass, clumps, update(t, wind) { uniforms.time.value = t; uniforms.wind.value = wind; trees.forEach(tree => { tree.rotation.z = tree.userData.restZ + Math.sin(t * .45 + tree.userData.phase) * .005 * wind; tree.rotation.x = Math.sin(t * .36 + tree.userData.phase * .7) * .003 * wind; }); } };
}
