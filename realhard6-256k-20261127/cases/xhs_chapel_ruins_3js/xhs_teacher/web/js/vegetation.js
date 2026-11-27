import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  mulberry32, fbmTile, createLeafTexture, stoneMaterial,
} from './materials.js';

/* ------------------------------------------------------------------------
   Dry grass, gnarled olive trees and their leaf cards.
   Both use the same wind clock; the amount is driven by the viewer's gaze.
------------------------------------------------------------------------- */

const windUniforms = {
  uTime: { value: 0 },
  uWind: { value: 0.3 },
};

const Y_AXIS = new THREE.Vector3(0, 1, 0);

/* ============================== GRASS ============================== */

function bladeColors(rng) {
  const palettes = [
    new THREE.Color('#b48a4c'),
    new THREE.Color('#caa15f'),
    new THREE.Color('#8a6938'),
    new THREE.Color('#9c8b57'),
    new THREE.Color('#6d5a34'),
    new THREE.Color('#c6ad75'),
  ];
  return palettes[(rng() * palettes.length) | 0];
}

function pushBlade(position, color, indices, rng, originX, originZ, opts = {}) {
  const height = opts.height ?? (0.22 + rng() * 0.55);
  const width = opts.width ?? (0.012 + rng() * 0.021);
  const yaw = opts.yaw ?? rng() * Math.PI * 2;
  const lean = opts.lean ?? (0.08 + rng() * 0.32);
  const segments = 4;
  const bx = originX + (rng() - 0.5) * 0.12;
  const bz = originZ + (rng() - 0.5) * 0.12;
  const dx = Math.cos(yaw);
  const dz = Math.sin(yaw);
  const sideX = -dz;
  const sideZ = dx;
  const baseIndex = position.length / 3;
  const baseCol = bladeColors(rng);
  const tipCol = baseCol.clone().lerp(new THREE.Color('#e0bd7c'), 0.62 + rng() * 0.25);
  const rootCol = baseCol.clone().multiplyScalar(0.32);

  for (let s = 0; s <= segments; s++) {
    const t = s / segments;
    const bend = lean * Math.pow(t, 1.7);
    const curveBack = 0.14 * Math.pow(t, 3.0) * (0.3 + rng() * 0.1);
    const cx = bx + dx * bend + sideX * curveBack;
    const cz = bz + dz * bend + sideZ * curveBack;
    const cy = height * (t - 0.1 * Math.pow(t, 3.2));
    const w = width * (1 - t * 0.92) * (1 - t * 0.15);
    const flutter = opts.flutter ?? 0;
    const fw = w * (0.9 + flutter * 0.2);
    position.push(
      cx - sideX * fw, cy, cz - sideZ * fw,
      cx + sideX * fw, cy, cz + sideZ * fw
    );
    const c = rootCol.clone().lerp(tipCol, Math.pow(t, 0.75));
    color.push(c.r, c.g, c.b, c.r, c.g, c.b);
  }
  for (let s = 0; s < segments; s++) {
    const i = baseIndex + s * 2;
    indices.push(i, i + 1, i + 2, i + 1, i + 3, i + 2);
  }
}

function makeTuftGeometry(seed, style = 0) {
  const rng = mulberry32(seed);
  const position = [];
  const color = [];
  const indices = [];
  const bladeCount = style === 0 ? 27 : style === 1 ? 36 : 18;
  const spread = 0.22 + rng() * 0.2;

  for (let i = 0; i < bladeCount; i++) {
    const a = rng() * Math.PI * 2;
    const r = Math.sqrt(rng()) * spread;
    const ox = Math.cos(a) * r;
    const oz = Math.sin(a) * r;
    const h = style === 2 ? 0.55 + rng() * 0.62 : 0.22 + rng() * (style === 1 ? 0.55 : 0.7);
    pushBlade(position, color, indices, rng, ox, oz, {
      height: h,
      width: (style === 1 ? 0.012 : 0.010) + rng() * 0.018,
      yaw: Math.atan2(oz, ox) + (rng() - 0.5) * 1.5,
      lean: 0.12 + rng() * (style === 2 ? 0.45 : 0.32),
      flutter: rng(),
    });
  }

  // A couple of tall dried umbels / seed stems.
  if (style !== 1) {
    const stems = style === 2 ? 8 : 3;
    for (let i = 0; i < stems; i++) {
      const yaw = rng() * Math.PI * 2;
      const h = style === 2 ? 0.85 + rng() * 0.55 : 0.55 + rng() * 0.45;
      const rr = Math.sqrt(rng()) * 0.10;
      const ox = Math.cos(yaw) * rr;
      const oz = Math.sin(yaw) * rr;
      const lean = 0.08 + rng() * 0.22;
      pushBlade(position, color, indices, rng, ox, oz, {
        height: h, width: 0.009, yaw, lean: lean, flutter: 0.3,
      });
      // A loose, warm seed head made of tiny crossed blades.
      const segs = 9;
      const topYaw = rng() * Math.PI * 2;
      const headHeight = 0.10 + rng() * 0.09;
      const headBase = h;
      const baseX = ox + Math.cos(yaw) * lean;
      const baseZ = oz + Math.sin(yaw) * lean;
      const headColor = new THREE.Color('#c6a567');
      for (let s = 0; s < segs; s++) {
        const t = s / segs;
        const ang = topYaw + s * 2.4;
        const spread = 0.02 + t * 0.05;
        const hx = baseX + Math.cos(ang) * spread;
        const hz = baseZ + Math.sin(ang) * spread;
        const hy = headBase + t * headHeight;
        const ex = hx + Math.cos(ang) * 0.035;
        const ez = hz + Math.sin(ang) * 0.035;
        const ey = hy + 0.012;
        const bx2 = hx - Math.cos(ang) * 0.005;
        const bz2 = hz - Math.sin(ang) * 0.005;
        const bi = position.length / 3;
        position.push(bx2, hy, bz2, ex, ey, ez, hx, hy + 0.025, hz);
        const cc = headColor.clone().multiplyScalar(0.65 + t * 0.4);
        color.push(cc.r, cc.g, cc.b, cc.r, cc.g, cc.b, cc.r, cc.g, cc.b);
        indices.push(bi, bi + 1, bi + 2);
      }
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(position, 3));
  geo.setAttribute('aColor', new THREE.Float32BufferAttribute(color, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  return geo;
}

const grassVertex = /* glsl */`
  attribute vec3 aColor;
  uniform float uTime;
  uniform float uWind;
  varying vec3 vColor;
  varying vec3 vWorld;
  varying vec3 vNormal;

  void main() {
    vec3 p = position;
    vec3 inst = vec3(0.0);
    #ifdef USE_INSTANCING
      inst = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
    #endif
    float phase = inst.x * 0.43 + inst.z * 0.77 + inst.y * 0.2;
    float h = clamp(p.y / 0.95, 0.0, 1.0);
    float bend = pow(h, 1.55) * (0.085 + uWind * 0.13);
    p.x += sin(uTime * 1.35 + phase + p.y * 2.2) * bend;
    p.z += cos(uTime * 1.07 + phase * 1.31 + p.y * 1.75) * bend * 0.72;
    p.x += sin(uTime * 3.8 + phase * 2.0 + p.x * 8.0) * bend * 0.18;
    p.y -= abs(sin(uTime * 1.35 + phase + p.y * 2.2)) * bend * 0.22;

    vec4 world = vec4(p, 1.0);
    vec3 n = normal;
    #ifdef USE_INSTANCING
      world = instanceMatrix * world;
      n = mat3(instanceMatrix) * n;
    #endif
    world = modelMatrix * world;
    vWorld = world.xyz;
    vColor = aColor;
    vNormal = normalize(mat3(modelMatrix) * n);
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const grassFragment = /* glsl */`
  uniform vec3 uSunDir;
  uniform vec3 uSunColor;
  uniform vec3 uSkyColor;
  uniform vec3 uGroundColor;
  uniform vec3 uFogColor;
  uniform float uFogDensity;
  varying vec3 vColor;
  varying vec3 vWorld;
  varying vec3 vNormal;

  void main() {
    vec3 n = normalize(vNormal);
    if (!gl_FrontFacing) n = -n;
    vec3 toCam = normalize(cameraPosition - vWorld);
    vec3 rayDir = -toCam;
    float back = pow(clamp(dot(rayDir, uSunDir), 0.0, 1.0), 1.8);
    float hemi = 0.52 + 0.48 * n.y;
    float diffuse = max(dot(n, uSunDir), 0.0);

    vec3 light = uSkyColor * (0.16 + hemi * 0.38);
    light += uGroundColor * 0.06;
    light += uSunColor * diffuse * 0.18;
    vec3 col = vColor * light;
    // Translucent straw glows when the sun sits behind the blades.
    col += vColor * uSunColor * back * (0.38 + 0.45 * max(n.y, 0.0));
    col += vec3(0.10, 0.055, 0.012) * back * 0.5;

    float dist = length(cameraPosition - vWorld);
    float fog = 1.0 - exp(-uFogDensity * uFogDensity * dist * dist);
    col = mix(col, uFogColor, clamp(fog, 0.0, 1.0));

    gl_FragColor = vec4(col, 1.0);
  }
`;

function makeGrassMaterial(sunDir) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: windUniforms.uTime,
      uWind: windUniforms.uWind,
      uSunDir: { value: sunDir.clone() },
      uSunColor: { value: new THREE.Color('#ffbd7f').multiplyScalar(1.5) },
      uSkyColor: { value: new THREE.Color('#c9959d') },
      uGroundColor: { value: new THREE.Color('#2a2420') },
      uFogColor: { value: new THREE.Color('#c99697') },
      uFogDensity: { value: 0.0034 },
    },
    vertexShader: grassVertex,
    fragmentShader: grassFragment,
    side: THREE.DoubleSide,
  });
}

function buildGrass(sites, sunDir) {
  const group = new THREE.Group();
  group.name = 'dry-grass';
  const material = makeGrassMaterial(sunDir);
  const variants = [
    makeTuftGeometry(1001, 0),
    makeTuftGeometry(2002, 1),
    makeTuftGeometry(3003, 2),
  ];
  const buckets = [[], [], []];
  const rng = mulberry32(661);
  for (const site of sites) {
    const v = rng() < 0.45 ? 0 : rng() < 0.6 ? 1 : 2;
    buckets[v].push(site);
  }
  const dummy = new THREE.Object3D();
  for (let vi = 0; vi < variants.length; vi++) {
    const list = buckets[vi];
    if (!list.length) continue;
    const mesh = new THREE.InstancedMesh(variants[vi], material, list.length);
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    for (let i = 0; i < list.length; i++) {
      const s = list[i];
      const scale = s.scale * (vi === 2 ? 1.3 : 1.0);
      dummy.position.set(s.x, s.y, s.z);
      dummy.rotation.set(0, rng() * Math.PI * 2, 0);
      dummy.scale.set(scale * (0.85 + rng() * 0.3), scale * (0.8 + rng() * 0.35), scale * (0.85 + rng() * 0.3));
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.frustumCulled = false;
    group.add(mesh);
  }
  return group;
}

/* ============================== TREES ============================== */

function makeBark() {
  const size = 256;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const u = x / size;
      const v = y / size;
      const ridge = fbmTile(u * 1.6, v * 0.28, 6, 4, 61, 0.55);
      const fine = fbmTile(u * 9, v, 16, 3, 71, 0.5);
      const t = 0.58 + ridge * 0.55 + (fine - 0.5) * 0.25;
      img.data[i] = 38 * t + 10;
      img.data[i + 1] = 31 * t + 8;
      img.data[i + 2] = 24 * t + 6;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const color = new THREE.CanvasTexture(c);
  color.colorSpace = THREE.SRGBColorSpace;
  color.wrapS = color.wrapT = THREE.RepeatWrapping;
  color.repeat.set(3, 2);
  const bump = color.clone();
  bump.colorSpace = THREE.NoColorSpace;
  return { color, bump };
}

function makeBranchMaterial() {
  const bark = makeBark();
  return new THREE.MeshStandardMaterial({
    color: 0x91806b,
    map: bark.color,
    bumpMap: bark.bump,
    bumpScale: 0.055,
    roughness: 0.98,
    metalness: 0,
    side: THREE.DoubleSide,
  });
}

function addCylinderSegment(geometries, a, b, radiusA, radiusB, radialSegments = 6) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const length = dir.length();
  if (length < 0.001) return;
  const geo = new THREE.CylinderGeometry(radiusB, radiusA, length, radialSegments, 1, true);
  const q = new THREE.Quaternion().setFromUnitVectors(Y_AXIS, dir.clone().normalize());
  geo.applyQuaternion(q);
  geo.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
  geometries.push(geo);
}

function buildTreeSkeleton(seed, opts = {}) {
  const rng = mulberry32(seed);
  const geometries = [];
  const leafClusters = [];
  const maxDepth = opts.maxDepth ?? 5;
  const totalHeight = opts.height ?? 9;

  function grow(start, dir, length, radius, depth) {
    const segments = depth === 0 ? 5 : depth < 3 ? 3 : 2;
    let p = start.clone();
    let d = dir.clone().normalize();
    const curl = (rng() - 0.5) * 0.9;
    for (let s = 0; s < segments; s++) {
      const t = (s + 1) / segments;
      d.x += (rng() - 0.5) * 0.26 + Math.sin((s + depth) * 1.61 + seed) * 0.045;
      d.z += (rng() - 0.5) * 0.26 + Math.cos((s + depth) * 1.13 + seed) * 0.04;
      d.y += (rng() - 0.5) * 0.13 + (depth === 0 ? 0.03 : 0.015);
      d.normalize();
      const next = p.clone().addScaledVector(d, length / segments);
      addCylinderSegment(
        geometries, p, next,
        radius * (1 - (t - 1 / segments) * 0.35),
        radius * (1 - t * 0.35),
        depth < 2 ? 7 : depth < 4 ? 5 : 4
      );
      p = next;
    }

    const atEnd = depth >= maxDepth;
    if (atEnd) {
      leafClusters.push({
        position: p.clone(),
        scale: 0.9 + rng() * 0.9,
        density: opts.leafiness ?? 0.5,
      });
      return;
    }

    const children = depth === 0 ? 3 : depth === 1 ? 3 : depth < 4 ? 2 : (rng() > 0.28 ? 2 : 1);
    for (let c = 0; c < children; c++) {
      const lateral = new THREE.Vector3(
        (rng() - 0.5) * 1.25,
        0,
        (rng() - 0.5) * 1.25
      );
      // Bias branches outward from the trunk's axis but keep a searching
      // upward curl.  Occasional limbs sweep quite far sideways.
      lateral.add(new THREE.Vector3(d.z, 0, -d.x).multiplyScalar((rng() - 0.5) * 1.8));
      lateral.normalize().multiplyScalar(0.5 + rng() * 0.68);
      const upward = 0.34 + rng() * 0.55 + (depth === 0 ? 0.3 : 0);
      const nd = d.clone().multiplyScalar(0.62).add(lateral).addScaledVector(Y_AXIS, upward).normalize();
      const childLength = length * (0.56 + rng() * 0.17) * (c === 0 ? 1.12 : 1.0);
      grow(p, nd, childLength, radius * (0.5 + rng() * 0.16), depth + 1);
    }

    // A few clusters along the final forks make the canopy less geometric.
    if (depth >= maxDepth - 2 && rng() < (opts.leafiness ?? 0.5) * 0.35) {
      leafClusters.push({
        position: p.clone().add(new THREE.Vector3((rng() - 0.5) * 0.7, rng() * 0.3, (rng() - 0.5) * 0.7)),
        scale: 0.7 + rng() * 0.8,
        density: opts.leafiness ?? 0.5,
      });
    }
  }

  // Roots gripping exposed rock.
  const rootCount = opts.roots ? 5 : 0;
  for (let r = 0; r < rootCount; r++) {
    const a = (r / rootCount) * Math.PI * 2 + rng() * 0.5;
    const start = new THREE.Vector3(0, 0.13, 0);
    const end = new THREE.Vector3(Math.cos(a) * (0.65 + rng() * 0.75), -0.17 - rng() * 0.15, Math.sin(a) * (0.65 + rng() * 0.7));
    const mid = start.clone().lerp(end, 0.55);
    mid.y += 0.06;
    addCylinderSegment(geometries, start, mid, 0.13, 0.075, 5);
    addCylinderSegment(geometries, mid, end, 0.075, 0.028, 5);
  }

  const leanDir = new THREE.Vector3(opts.leanX ?? 0, 1, opts.leanZ ?? 0).normalize();
  const trunkLength = totalHeight * (opts.trunkFraction ?? 0.31);
  grow(
    new THREE.Vector3(0, opts.roots ? 0.05 : 0.12, 0),
    leanDir,
    trunkLength,
    opts.trunkRadius ?? 0.24,
    0
  );

  const merged = mergeGeometries(geometries, false);
  merged.computeVertexNormals();
  return { geometry: merged, leafClusters };
}

function makeLeafGeometry() {
  const planes = [];
  for (let i = 0; i < 3; i++) {
    const p = new THREE.PlaneGeometry(1, 1, 1, 1);
    p.rotateY((i / 3) * Math.PI);
    planes.push(p);
  }
  return mergeGeometries(planes, false);
}

function patchLeafWind(material) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = windUniforms.uTime;
    shader.uniforms.uWind = windUniforms.uWind;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;\nuniform float uWind;')
      .replace('#include <begin_vertex>', `
        #include <begin_vertex>
        vec3 leafInst = vec3(0.0);
        #ifdef USE_INSTANCING
          leafInst = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
        #endif
        float leafPhase = leafInst.x * 0.62 + leafInst.z * 0.88 + leafInst.y * 0.4;
        float sway = uWind * (0.035 + 0.018 * sin(uTime * 0.55 + leafPhase));
        transformed.x += sin(uTime * 1.2 + leafPhase + position.y * 1.7) * sway;
        transformed.z += cos(uTime * 0.86 + leafPhase * 1.27 + position.x * 1.1) * sway * 0.8;
        transformed.y += sin(uTime * 0.65 + leafPhase * 2.0) * sway * 0.25;
      `);
  };
  material.customProgramCacheKey = () => 'leaf-wind-v2';
}

function makeLeafMaterial(leafTexture) {
  const mat = new THREE.MeshStandardMaterial({
    map: leafTexture,
    color: 0xcfc6a9,
    alphaTest: 0.42,
    side: THREE.DoubleSide,
    roughness: 0.92,
    metalness: 0,
    transparent: false,
    emissive: 0x0e0b06,
    emissiveIntensity: 0.5,
  });
  patchLeafWind(mat);
  return mat;
}

function makeLeafDepthMaterial(leafTexture) {
  const mat = new THREE.MeshDepthMaterial({
    depthPacking: THREE.RGBADepthPacking,
    map: leafTexture,
    alphaTest: 0.42,
    side: THREE.DoubleSide,
  });
  patchLeafWind(mat);
  return mat;
}

function makeTreeInstance(spec, shared) {
  const group = new THREE.Group();
  group.name = spec.name;
  group.position.copy(spec.position);
  group.rotation.y = spec.yaw ?? 0;
  group.scale.setScalar(spec.scale ?? 1);

  const { geometry, leafClusters } = buildTreeSkeleton(spec.seed, spec.opts);
  const branchMesh = new THREE.Mesh(geometry, shared.branchMaterial);
  branchMesh.castShadow = true;
  branchMesh.receiveShadow = true;
  group.add(branchMesh);

  const rng = mulberry32(spec.seed + 77);
  const leafCount = Math.floor(leafClusters.length * spec.leafDensity);
  const leaves = new THREE.InstancedMesh(shared.leafGeometry, shared.leafMaterial, leafCount);
  const dummy = new THREE.Object3D();
  let placed = 0;
  for (const cluster of leafClusters) {
    if (placed >= leafCount) break;
    if (rng() > spec.leafDensity * 1.35 + 0.15) continue;
    const copies = spec.leafDensity > 0.4 ? 2 : 1;
    for (let c = 0; c < copies && placed < leafCount; c++) {
      dummy.position.copy(cluster.position);
      dummy.position.x += (rng() - 0.5) * 0.9;
      dummy.position.y += (rng() - 0.5) * 0.75;
      dummy.position.z += (rng() - 0.5) * 0.9;
      dummy.rotation.set(
        (rng() - 0.5) * 0.7,
        rng() * Math.PI * 2,
        (rng() - 0.5) * 0.8
      );
      const s = cluster.scale * (0.8 + rng() * 0.75) * spec.leafScale;
      dummy.scale.set(s, s * (0.8 + rng() * 0.35), s);
      dummy.updateMatrix();
      leaves.setMatrixAt(placed, dummy.matrix);
      const tint = new THREE.Color().setHSL(0.12 + rng() * 0.05, 0.18 + rng() * 0.14, 0.28 + rng() * 0.14);
      leaves.setColorAt(placed, tint);
      placed++;
    }
  }
  leaves.count = placed;
  leaves.instanceMatrix.needsUpdate = true;
  leaves.instanceColor.needsUpdate = true;
  leaves.castShadow = true;
  leaves.receiveShadow = true;
  leaves.customDepthMaterial = shared.leafDepthMaterial;
  group.add(leaves);

  group.userData.baseRotation = { x: group.rotation.x, z: group.rotation.z, y: group.rotation.y };
  group.userData.phase = spec.phase ?? rng() * 6.28;
  group.userData.swayFactor = spec.swayFactor ?? 1;
  return group;
}

function buildTrees(sunDir) {
  const branchMaterial = makeBranchMaterial();
  const leafTexture = createLeafTexture();
  const leafMaterial = makeLeafMaterial(leafTexture);
  const leafDepthMaterial = makeLeafDepthMaterial(leafTexture);
  leafMaterial.alphaMap = null;
  const shared = {
    branchMaterial,
    leafMaterial,
    leafDepthMaterial,
    leafGeometry: makeLeafGeometry(),
  };
  const group = new THREE.Group();
  group.name = 'gnarled-trees';
  const trees = [];

  const specs = [
    {
      name: 'left-tree',
      seed: 8301,
      position: new THREE.Vector3(-7.55, -2.1, -1.9),
      yaw: 0.5,
      scale: 1.05,
      leafDensity: 0.72,
      leafScale: 1.28,
      phase: 1.4,
      swayFactor: 1.15,
      opts: {
        height: 11.8, maxDepth: 5, leafiness: 0.8, trunkRadius: 0.30,
        roots: true, leanX: 0.18, leanZ: -0.04, trunkFraction: 0.29,
      },
    },
    {
      name: 'portal-tree',
      seed: 4411,
      position: new THREE.Vector3(-0.95, 0.13, -2.28),
      yaw: -0.6,
      scale: 1.0,
      leafDensity: 0.34,
      leafScale: 0.94,
      phase: 3.3,
      swayFactor: 0.8,
      opts: {
        height: 7.4, maxDepth: 5, leafiness: 0.28, trunkRadius: 0.19,
        roots: true, leanX: -0.2, leanZ: 0.1, trunkFraction: 0.36,
      },
    },
  ];

  for (const spec of specs) {
    const t = makeTreeInstance(spec, shared);
    group.add(t);
    trees.push(t);
  }

  return {
    group,
    trees,
    update(time, wind) {
      windUniforms.uTime.value = time;
      windUniforms.uWind.value = wind;
      for (const t of trees) {
        const p = t.userData.phase;
        const f = t.userData.swayFactor * (0.35 + wind * 0.65);
        t.rotation.z = Math.sin(time * 0.31 + p) * 0.0018 * f;
        t.rotation.x = Math.cos(time * 0.24 + p * 1.7) * 0.0011 * f;
        t.rotation.y = t.userData.baseRotation.y + Math.sin(time * 0.18 + p * 0.6) * 0.0012 * f;
      }
    },
  };
}

/* ============================== API ============================== */

export function createVegetation(scene, sunDir, grassSites) {
  const group = new THREE.Group();
  group.name = 'vegetation';
  scene.add(group);

  const grass = buildGrass(grassSites, sunDir);
  group.add(grass);

  const trees = buildTrees(sunDir);
  group.add(trees.group);

  // A low, dark scrub line just beyond the parapet.
  const scrubMat = new THREE.MeshStandardMaterial({ color: 0x25261c, roughness: 1 });
  const scrubGeo = new THREE.IcosahedronGeometry(1, 1);
  const scrub = new THREE.InstancedMesh(scrubGeo, scrubMat, 22);
  const rng = mulberry32(5501);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < scrub.count; i++) {
    dummy.position.set(-17 + rng() * 16, -0.2 + rng() * 0.35, -1.2 - rng() * 6);
    dummy.scale.set(0.4 + rng() * 1.5, 0.28 + rng() * 0.75, 0.45 + rng() * 1.2);
    dummy.rotation.y = rng() * 6.28;
    dummy.updateMatrix();
    scrub.setMatrixAt(i, dummy.matrix);
  }
  scrub.frustumCulled = false;
  group.add(scrub);

  return {
    group,
    windUniforms,
    update(time, wind) {
      windUniforms.uTime.value = time;
      windUniforms.uWind.value = wind;
      trees.update(time, wind);
    },
  };
}
