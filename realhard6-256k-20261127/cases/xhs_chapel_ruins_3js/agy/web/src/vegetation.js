import * as THREE from 'three';
import { SUN_DIRECTION } from './skyAndValley.js';

function createRng(seed = 4242) {
  let s = seed >>> 0;
  return function () {
    s += 0x6d2b79f5;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Fine, wispy, arching 3D dry grass stem geometry.
 */
function createSingleBladeGeometry() {
  const segs = 5;
  const positions = [];
  const normals = [];
  const uvs = [];
  const indices = [];

  const baseHalfW = 0.0038;
  const height = 0.29;

  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const w = baseHalfW * (1.0 - t * 0.90);
    const y = Math.sin(t * Math.PI * 0.45) * height;
    const zBend = t * t * 0.135;

    positions.push(-w, y, zBend);
    positions.push( w, y, zBend);

    normals.push(-0.15, 0.45, 0.88);
    normals.push( 0.15, 0.45, 0.88);

    uvs.push(0, t);
    uvs.push(1, t);

    if (i < segs) {
      const r0 = i * 2;
      const r1 = (i + 1) * 2;
      indices.push(r0, r0 + 1, r1);
      indices.push(r0 + 1, r1 + 1, r1);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  return geo;
}

function createTaperedBranchGeometry(points, rStart, rEnd, tubularSegs = 22, radialSegs = 7) {
  const curve = new THREE.CatmullRomCurve3(points);
  const frames = curve.computeFrenetFrames(tubularSegs, false);

  const pos = [];
  const nrm = [];
  const uvs = [];
  const swayWeight = [];
  const idx = [];

  for (let i = 0; i <= tubularSegs; i++) {
    const t = i / tubularSegs;
    const pt = curve.getPointAt(t);
    const N = frames.normals[i];
    const B = frames.binormals[i];
    const gnarl = 1.0 + Math.sin(t * 19.0) * 0.09;
    const r = THREE.MathUtils.lerp(rStart, rEnd, Math.pow(t, 0.78)) * gnarl;

    for (let j = 0; j <= radialSegs; j++) {
      const v = j / radialSegs;
      const ang = v * Math.PI * 2;
      const ca = Math.cos(ang);
      const sa = Math.sin(ang);

      const nx = ca * N.x + sa * B.x;
      const ny = ca * N.y + sa * B.y;
      const nz = ca * N.z + sa * B.z;

      pos.push(pt.x + r * nx, pt.y + r * ny, pt.z + r * nz);
      nrm.push(nx, ny, nz);
      uvs.push(v, t * 4.0);
      swayWeight.push(Math.pow(t, 1.4) * THREE.MathUtils.clamp(0.10 / Math.max(rStart, 0.03), 0.20, 1.5));
    }
  }

  const stride = radialSegs + 1;
  for (let i = 0; i < tubularSegs; i++) {
    for (let j = 0; j < radialSegs; j++) {
      const a = i * stride + j;
      const b = (i + 1) * stride + j;
      const c = (i + 1) * stride + (j + 1);
      const d = i * stride + (j + 1);
      idx.push(a, b, d);
      idx.push(b, c, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setAttribute('aSway', new THREE.Float32BufferAttribute(swayWeight, 1));
  geo.setIndex(idx);
  return geo;
}

function mergeBufferGeometries(geos) {
  let totalVerts = 0;
  let totalIdx = 0;
  for (const g of geos) {
    totalVerts += g.attributes.position.count;
    totalIdx += g.index.count;
  }

  const pos = new Float32Array(totalVerts * 3);
  const nrm = new Float32Array(totalVerts * 3);
  const uv  = new Float32Array(totalVerts * 2);
  const sw  = new Float32Array(totalVerts);
  const idx = new Uint32Array(totalIdx);

  let vOff = 0;
  let iOff = 0;
  for (const g of geos) {
    const count = g.attributes.position.count;
    pos.set(g.attributes.position.array, vOff * 3);
    nrm.set(g.attributes.normal.array, vOff * 3);
    uv.set(g.attributes.uv.array, vOff * 2);
    if (g.attributes.aSway) sw.set(g.attributes.aSway.array, vOff);
    const gIdx = g.index.array;
    for (let k = 0; k < gIdx.length; k++) idx[iOff + k] = gIdx[k] + vOff;
    vOff += count;
    iOff += gIdx.length;
    g.dispose();
  }

  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  merged.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  merged.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  merged.setAttribute('aSway', new THREE.BufferAttribute(sw, 1));
  merged.setIndex(new THREE.BufferAttribute(idx, 1));
  return merged;
}

export function createVegetation(textures, grassAnchors) {
  const group = new THREE.Group();
  group.name = 'WindAnimatedVegetation';
  const rng = createRng(7788);

  const windUniforms = {
    uTime: { value: 0.0 },
    uWindFocus: { value: 0.0 },
    uSunDir: { value: SUN_DIRECTION.clone() }
  };

  // =========================================================================
  // 1. INSTANCED WARM-OCHRE DRY GRASS TUFTS (CALIBRATED IN TRUE LINEAR-SRGB!)
  // =========================================================================
  let totalBlades = 0;
  for (const a of grassAnchors) totalBlades += a.count;

  const bladeGeo = createSingleBladeGeometry();
  const phases = new Float32Array(totalBlades);

  const grassMat = new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    uniforms: windUniforms,
    vertexShader: /* glsl */ `
      attribute float aPhase;
      varying vec2 vUv;
      varying vec3 vColor;
      varying vec3 vWorldPos;
      varying vec3 vWorldNormal;

      uniform float uTime;
      uniform float uWindFocus;

      void main() {
        vUv = uv;
        vColor = instanceColor;

        vec4 worldPos = modelMatrix * instanceMatrix * vec4(position, 1.0);

        float h = uv.y;
        float bendFactor = h * h;
        float windAmp = 0.015 + uWindFocus * 0.072;
        float gust =
          sin(uTime * 2.15 + aPhase + worldPos.x * 0.85 + worldPos.z * 0.55) +
          0.45 * sin(uTime * 4.70 + aPhase * 1.9 - worldPos.x * 1.3) +
          0.25 * cos(uTime * 1.25 + worldPos.z * 0.7);

        worldPos.x += gust * windAmp * bendFactor;
        worldPos.z += gust * windAmp * 0.55 * bendFactor;
        worldPos.y -= abs(gust) * windAmp * 0.22 * bendFactor;

        vWorldPos = worldPos.xyz;
        vWorldNormal = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);

        gl_Position = projectionMatrix * viewMatrix * worldPos;
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      varying vec2 vUv;
      varying vec3 vColor;
      varying vec3 vWorldPos;
      varying vec3 vWorldNormal;
      uniform vec3 uSunDir;

      void main() {
        vec3 V = normalize(cameraPosition - vWorldPos);
        float h = vUv.y;

        // Shadowy earthy root in stone crevice -> warm golden-ochre dry straw tip (true linear-sRGB!)
        vec3 rootTint = vColor * 0.28;
        vec3 tipTint  = vColor * 1.15;
        vec3 baseCol  = mix(rootTint, tipTint, pow(h, 0.68));

        float backLight = pow(max(dot(-V, uSunDir), 0.0), 2.5);
        float skyLight  = 0.42 + 0.58 * clamp(vWorldNormal.y * 0.5 + 0.5, 0.0, 1.0);

        vec3 lit = baseCol * skyLight;
        lit += vec3(0.24, 0.095, 0.015) * backLight * (0.25 + 0.75 * h);

        gl_FragColor = vec4(lit, 1.0);
      }
    `
  });

  const grassMesh = new THREE.InstancedMesh(bladeGeo, grassMat, totalBlades);
  grassMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(totalBlades * 3), 3);

  const dummy = new THREE.Object3D();
  // Rich natural tawny-ochre, golden straw, russet & muted mountain olive (converted to linear by THREE.Color)
  const cDry1  = new THREE.Color('#7c5628');
  const cDry2  = new THREE.Color('#a47335');
  const cDry3  = new THREE.Color('#583d1c');
  const cOlive = new THREE.Color('#30381e');
  const tmpCol = new THREE.Color();

  let idx = 0;
  for (const anchor of grassAnchors) {
    for (let k = 0; k < anchor.count; k++) {
      const rDist = Math.pow(rng(), 0.65) * 0.13 * anchor.scale;
      const rAng  = rng() * Math.PI * 2;
      const bx = anchor.x + Math.cos(rAng) * rDist;
      const bz = anchor.z + Math.sin(rAng) * rDist;
      const by = anchor.y - 0.012;

      dummy.position.set(bx, by, bz);
      const outwardYaw = Math.atan2(Math.sin(rAng), Math.cos(rAng)) + (rng() - 0.5) * 1.2;
      const tiltOut = 0.22 + rng() * 0.62;
      dummy.rotation.set(tiltOut, outwardYaw, (rng() - 0.5) * 0.28);

      const hScale = anchor.scale * (0.62 + rng() * 0.78) * (anchor.type === 'tallGoldenGrass' ? 1.45 : 1.0);
      const wScale = 0.78 + rng() * 0.52;
      dummy.scale.set(wScale, hScale, wScale);
      dummy.updateMatrix();
      grassMesh.setMatrixAt(idx, dummy.matrix);

      if (anchor.type === 'oliveScrub' && rng() < 0.76) {
        tmpCol.copy(cOlive).lerp(cDry1, rng() * 0.28);
      } else if (anchor.type === 'tallGoldenGrass') {
        tmpCol.copy(cDry1).lerp(cDry2, 0.25 + rng() * 0.75);
      } else {
        const pick = rng();
        if (pick < 0.45) tmpCol.copy(cDry1).lerp(cDry2, rng());
        else if (pick < 0.85) tmpCol.copy(cDry1).lerp(cDry3, rng() * 0.7);
        else tmpCol.copy(cOlive).lerp(cDry1, 0.45);
      }
      grassMesh.setColorAt(idx, tmpCol);
      phases[idx] = rng() * Math.PI * 2;
      idx++;
    }
  }
  bladeGeo.setAttribute('aPhase', new THREE.InstancedBufferAttribute(phases, 1));
  grassMesh.instanceMatrix.needsUpdate = true;
  grassMesh.instanceColor.needsUpdate = true;
  group.add(grassMesh);

  // =========================================================================
  // 2. GNARLED SILHOUETTED TREES & VALLEY SHRUBS (COHESIVE BACKLIT SILHOUETTE!)
  // =========================================================================
  const branchGeos = [];
  const foliageCards = [];

  function addBranchWithSubTwigs(pts, r0, r1, addLeaves = true, leafDensity = 6, leafSize = 0.62) {
    branchGeos.push(createTaperedBranchGeometry(pts, r0, r1, 20, 7));
    if (!addLeaves) return;

    const curve = new THREE.CatmullRomCurve3(pts);
    for (let i = 0; i < leafDensity; i++) {
      const t = 0.32 + (i / Math.max(leafDensity - 1, 1)) * 0.68;
      const p = curve.getPointAt(Math.min(1, t));
      p.add(new THREE.Vector3(
        (rng() - 0.5) * leafSize * 0.42,
        (rng() - 0.35) * leafSize * 0.38,
        (rng() - 0.5) * leafSize * 0.42
      ));
      foliageCards.push({
        pos: p,
        scale: leafSize * (0.80 + rng() * 0.46),
        rotY: (rng() - 0.5) * 0.85,
        rotZ: (rng() - 0.5) * 1.5,
        sway: 0.60 + t * 0.70
      });
    }
  }

  // -------------------------------------------------------------------------
  // HERO TREE #1: Left Foreground/Midground Gnarled Oak/Olive Tree
  // Enters from left edge (nx = 0..0.225, ny = 0.23..0.64) with S-curved lower bough!
  // -------------------------------------------------------------------------
  addBranchWithSubTwigs([
    new THREE.Vector3(-4.05, 0.45, 2.30),
    new THREE.Vector3(-3.55, 0.92, 2.22),
    new THREE.Vector3(-3.22, 1.42, 2.14),
    new THREE.Vector3(-2.98, 1.96, 2.08),
    new THREE.Vector3(-3.08, 2.52, 2.02)
  ], 0.115, 0.036, true, 12, 0.72);

  // Signature S-curved sweeping lower bough (dips down at nx=0.06..0.11, sweeps up to nx=0.22!)
  addBranchWithSubTwigs([
    new THREE.Vector3(-3.62, 0.86, 2.24),
    new THREE.Vector3(-3.02, 0.76, 2.18),
    new THREE.Vector3(-2.58, 0.86, 2.12),
    new THREE.Vector3(-2.46, 1.22, 2.06),
    new THREE.Vector3(-2.14, 1.54, 1.98),
    new THREE.Vector3(-1.72, 1.76, 1.92)
  ], 0.068, 0.016, true, 12, 0.58);

  // Delicate outer spray reaching just left of the sun disc (nx ~ 0.225, ny ~ 0.39)
  addBranchWithSubTwigs([
    new THREE.Vector3(-2.14, 1.54, 1.98),
    new THREE.Vector3(-1.84, 1.60, 1.95),
    new THREE.Vector3(-1.56, 1.62, 1.90)
  ], 0.028, 0.009, true, 7, 0.46);

  // Upper crooked canopy branches of Left Tree
  addBranchWithSubTwigs([
    new THREE.Vector3(-3.16, 1.58, 2.12),
    new THREE.Vector3(-2.70, 1.84, 2.05),
    new THREE.Vector3(-2.26, 2.04, 1.98),
    new THREE.Vector3(-1.96, 2.08, 1.94)
  ], 0.050, 0.014, true, 11, 0.64);

  addBranchWithSubTwigs([
    new THREE.Vector3(-3.04, 1.95, 2.08),
    new THREE.Vector3(-2.74, 2.30, 2.04),
    new THREE.Vector3(-2.52, 2.58, 2.00)
  ], 0.042, 0.012, true, 9, 0.64);

  addBranchWithSubTwigs([
    new THREE.Vector3(-3.30, 1.42, 2.18),
    new THREE.Vector3(-3.58, 1.90, 2.15),
    new THREE.Vector3(-3.48, 2.46, 2.10),
    new THREE.Vector3(-3.20, 2.70, 2.06)
  ], 0.052, 0.014, true, 11, 0.68);

  // -------------------------------------------------------------------------
  // HERO TREE #2: Tall Crooked Chapel-Side Tree Next to Left Buttress!
  // Stands at nx = 0.34..0.525, ny = 0.07..0.53 right beside the vertical ashlar wall!
  // -------------------------------------------------------------------------
  addBranchWithSubTwigs([
    new THREE.Vector3( 0.05, -0.85, -1.28),
    new THREE.Vector3(-0.02,  0.95, -1.25),
    new THREE.Vector3(-0.08,  1.72, -1.22),
    new THREE.Vector3(-0.18,  2.48, -1.18),
    new THREE.Vector3(-0.44,  3.18, -1.12),
    new THREE.Vector3(-0.82,  3.65, -1.08)
  ], 0.175, 0.024, true, 12, 0.66);

  // High slender crooked limb climbing right alongside the chapel's left stone corner!
  addBranchWithSubTwigs([
    new THREE.Vector3(-0.14, 2.35, -1.20),
    new THREE.Vector3(-0.02, 3.05, -1.16),
    new THREE.Vector3( 0.06, 3.75, -1.12),
    new THREE.Vector3(-0.10, 4.30, -1.10)
  ], 0.048, 0.012, true, 9, 0.54);

  // Sweeping left-arching crooked limbs framing the orange clouds
  addBranchWithSubTwigs([
    new THREE.Vector3(-0.10, 1.85, -1.22),
    new THREE.Vector3(-0.62, 2.15, -1.15),
    new THREE.Vector3(-1.18, 2.38, -1.08),
    new THREE.Vector3(-1.64, 2.30, -1.02)
  ], 0.065, 0.015, true, 12, 0.64);

  addBranchWithSubTwigs([
    new THREE.Vector3(-0.55, 2.12, -1.15),
    new THREE.Vector3(-0.95, 2.68, -1.10),
    new THREE.Vector3(-1.38, 2.95, -1.05)
  ], 0.040, 0.012, true, 8, 0.58);

  // Drooping lower-left wiry branch toward valley (matches delicate branch at nx=0.35, ny=0.45!)
  addBranchWithSubTwigs([
    new THREE.Vector3(-0.12, 1.65, -1.20),
    new THREE.Vector3(-0.64, 1.76, -1.12),
    new THREE.Vector3(-1.16, 1.62, -1.05),
    new THREE.Vector3(-1.48, 1.38, -1.00)
  ], 0.042, 0.010, true, 8, 0.52);

  // -------------------------------------------------------------------------
  // DELICATE UPRIGHT VALLEY SCRUB SHRUBS (Just beyond the low stone piers, nx = 0.22..0.40)
  // -------------------------------------------------------------------------
  const scrubBases = [
    { x: -2.18, y: 0.25, z: 1.45, h: 0.92 },
    { x: -1.32, y: 0.36, z: 0.65, h: 0.98 }
  ];
  for (const sb of scrubBases) {
    for (let b = 0; b < 3; b++) {
      const spreadX = (b - 1) * 0.22 + (rng() - 0.5) * 0.10;
      addBranchWithSubTwigs([
        new THREE.Vector3(sb.x, sb.y, sb.z),
        new THREE.Vector3(sb.x + spreadX * 0.5, sb.y + sb.h * 0.52, sb.z - 0.06),
        new THREE.Vector3(sb.x + spreadX, sb.y + sb.h, sb.z - 0.12)
      ], 0.016, 0.005, true, 4, 0.38);
    }
  }

  // Cohesive Backlit Silhouette + Sunset Rim Shader for 3D Tree Trunks & Branches!
  const mergedBranchesGeo = mergeBufferGeometries(branchGeos);
  const branchMat = new THREE.ShaderMaterial({
    uniforms: {
      uBarkMap: { value: textures.bark.map },
      uTime: windUniforms.uTime,
      uWindFocus: windUniforms.uWindFocus,
      uSunDir: windUniforms.uSunDir
    },
    vertexShader: /* glsl */ `
      attribute float aSway;
      varying vec2 vUv;
      varying vec3 vWorldPos;
      varying vec3 vWorldNormal;
      uniform float uTime;
      uniform float uWindFocus;

      void main() {
        vUv = uv;
        vec3 p = position;
        float branchAmp = (0.008 + uWindFocus * 0.042) * aSway;
        float bGust = sin(uTime * 1.45 + p.x * 0.7 + p.y * 0.5)
                    + 0.4 * cos(uTime * 2.9 + p.y * 1.1);
        p.x += bGust * branchAmp;
        p.y += bGust * branchAmp * 0.35;

        vec4 wp = modelMatrix * vec4(p, 1.0);
        vWorldPos = wp.xyz;
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      varying vec2 vUv;
      varying vec3 vWorldPos;
      varying vec3 vWorldNormal;
      uniform sampler2D uBarkMap;
      uniform vec3 uSunDir;

      void main() {
        vec3 V = normalize(cameraPosition - vWorldPos);
        vec3 N = normalize(vWorldNormal);
        float barkTex = texture2D(uBarkMap, vUv).r;

        // Deep dark umber-charcoal backlit bark in linear space (authentic silhouette!)
        vec3 darkBark = vec3(0.012, 0.0085, 0.0055) * (0.70 + 0.70 * barkTex);

        // Tight golden grazing rim ONLY on extreme edge & very near the sun disc!
        float fresnel = pow(1.0 - max(dot(N, V), 0.0), 4.0);
        float sunSide = clamp(dot(N, uSunDir) * 0.5 + 0.5, 0.0, 1.0);
        float sunProximity = pow(max(dot(-V, uSunDir), 0.0), 38.0);
        vec3 rim = vec3(0.45, 0.15, 0.02) * fresnel * sunSide * (0.08 + 1.25 * sunProximity);

        gl_FragColor = vec4(darkBark + rim, 1.0);
      }
    `
  });

  const branchesMesh = new THREE.Mesh(mergedBranchesGeo, branchMat);
  branchesMesh.castShadow = true;
  branchesMesh.name = 'GnarledTreeBranches';
  group.add(branchesMesh);

  // Cohesive Backlit Silhouette + Sunset Edge Scatter Shader for Lacy Foliage Sprays!
  const leafPlaneGeo = new THREE.PlaneGeometry(1.0, 1.0, 2, 2);
  const foliageMat = new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    uniforms: {
      uMap: { value: textures.foliage },
      uTime: windUniforms.uTime,
      uWindFocus: windUniforms.uWindFocus,
      uSunDir: windUniforms.uSunDir
    },
    vertexShader: /* glsl */ `
      attribute float aLeafSway;
      attribute float aLeafPhase;
      varying vec2 vUv;
      varying vec3 vWorldPos;
      uniform float uTime;
      uniform float uWindFocus;

      void main() {
        vUv = uv;
        vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);

        float flutterAmp = (0.012 + uWindFocus * 0.056) * aLeafSway * (0.35 + (1.0 - uv.y) * 0.65);
        float w1 = sin(uTime * 1.65 + aLeafPhase + wp.x * 0.7 + wp.y * 0.5);
        float w2 = sin(uTime * 4.20 + aLeafPhase * 2.3 + wp.y * 1.9) * 0.38;
        wp.x += (w1 + w2) * flutterAmp;
        wp.y += w2 * flutterAmp * 0.5;

        vWorldPos = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      varying vec2 vUv;
      varying vec3 vWorldPos;
      uniform sampler2D uMap;
      uniform vec3 uSunDir;

      void main() {
        vec4 texel = texture2D(uMap, vUv);
        if (texel.a < 0.42) discard;

        vec3 V = normalize(cameraPosition - vWorldPos);
        float sunAlign = max(dot(-V, uSunDir), 0.0);

        // Deep dark olive-umber silhouette in true linear-sRGB (crisp against bright clouds!)
        vec3 darkLeaf = vec3(0.014, 0.011, 0.006) * (0.75 + 0.55 * texel.g * 4.5);

        // Fiery golden-orange backlit scatter ONLY on razor-thin leaf edges right near the sun!
        float thinEdge = 1.0 - smoothstep(0.42, 0.78, texel.a);
        vec3 sunRim = vec3(0.68, 0.23, 0.025) * pow(sunAlign, 52.0) * (0.25 + 0.75 * thinEdge);
        vec3 skyRim = vec3(0.018, 0.010, 0.005) * thinEdge;

        gl_FragColor = vec4(darkLeaf + sunRim + skyRim, 1.0);
      }
    `
  });

  const totalLeafInstances = foliageCards.length * 2;
  const leafInstMesh = new THREE.InstancedMesh(leafPlaneGeo, foliageMat, totalLeafInstances);
  const fullSway = new Float32Array(totalLeafInstances);
  const fullPhase = new Float32Array(totalLeafInstances);

  for (let i = 0; i < foliageCards.length; i++) {
    const fc = foliageCards[i];
    for (let cross = 0; cross < 2; cross++) {
      const k = i * 2 + cross;
      dummy.position.copy(fc.pos);
      dummy.rotation.set(
        (cross === 0 ? 0.08 : -0.12),
        fc.rotY + (cross === 1 ? 0.78 : 0.0),
        fc.rotZ
      );
      dummy.scale.setScalar(fc.scale);
      dummy.updateMatrix();
      leafInstMesh.setMatrixAt(k, dummy.matrix);
      fullSway[k] = fc.sway;
      fullPhase[k] = i * 1.37 + cross * 0.9;
    }
  }
  leafPlaneGeo.setAttribute('aLeafSway', new THREE.InstancedBufferAttribute(fullSway, 1));
  leafPlaneGeo.setAttribute('aLeafPhase', new THREE.InstancedBufferAttribute(fullPhase, 1));
  leafInstMesh.instanceMatrix.needsUpdate = true;
  leafInstMesh.name = 'GnarledTreeFoliage';
  group.add(leafInstMesh);

  function updateVegetation(time, windFocusLevel) {
    windUniforms.uTime.value = time;
    windUniforms.uWindFocus.value = windFocusLevel;
  }

  return {
    group,
    updateVegetation
  };
}
