import * as THREE from 'three';
import { mulberry32 } from './materials.js';

/* ------------------------------------------------------------------------
   The valley beyond the chapel.  A single heightfield carries the near
   cliffs and the far ridges; a reflection shader paints the water.
------------------------------------------------------------------------- */

const HAZE = new THREE.Color('#c99697');

function hash(x, y) {
  let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

function noise(x, y) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const tx = x - xi;
  const ty = y - yi;
  const sx = tx * tx * (3 - 2 * tx);
  const sy = ty * ty * (3 - 2 * ty);
  const a = hash(xi, yi);
  const b = hash(xi + 1, yi);
  const c = hash(xi, yi + 1);
  const d = hash(xi + 1, yi + 1);
  return (a + (b - a) * sx) + ((c + (d - c) * sx) - (a + (b - a) * sx)) * sy;
}

function fbm(x, y, octaves = 5) {
  let value = 0;
  let amp = 0.5;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    value += noise(x, y) * amp;
    norm += amp;
    amp *= 0.5;
    x = x * 2.03 + 13.7;
    y = y * 2.03 + 7.1;
  }
  return value / norm;
}

const smoothstep = (a, b, x) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

const LAKE = { x: -3, z: -236, rx: 84, rz: 31, y: -5.35 };

function lakeMask(x, z) {
  const dx = (x - LAKE.x) / LAKE.rx;
  const dz = (z - LAKE.z) / LAKE.rz;
  const angle = Math.atan2(dz, dx);
  const wobble = 0.12 * Math.sin(angle * 3.0 + 1.2) + 0.08 * Math.sin(angle * 7.0 + 0.2);
  const d = Math.sqrt(dx * dx + dz * dz) + wobble;
  return 1 - smoothstep(0.72, 1.02, d);
}

function terrainHeight(x, z) {
  const d = -z;
  const base = -19.0 + 14.5 * smoothstep(25, 255, d);
  const hills = (1.4 + 7.2 * fbm(x * 0.0135 + 12.8, z * 0.0135 - 4.1, 5)) * smoothstep(45, 235, d);
  const folded = (0.4 + 2.4 * fbm(x * 0.04 + 4.2, z * 0.04 + 9.1, 4)) * smoothstep(15, 90, d);
  const farRidge = (2.0 + 11.0 * fbm(x * 0.0062 - 8.0, z * 0.0075 + 2.0, 6)) * smoothstep(225, 370, d);
  let y = base + hills + folded + farRidge;
  // Cut a shallow bed so the water sits in the landscape.
  const lake = lakeMask(x, z);
  y = y * (1 - lake) + (LAKE.y - 3.5) * lake;
  return y;
}

function terrainColor(x, z, y, out) {
  const d = -z;
  const n = fbm(x * 0.032 + 7.3, z * 0.032 - 2.4, 3);
  const far = smoothstep(70, 300, d);
  const nearRock = new THREE.Color('#3d3a32');
  const olive = new THREE.Color('#56503b');
  const mauve = new THREE.Color('#6f5962');
  const rose = new THREE.Color('#9b7880');

  out.copy(nearRock).lerp(olive, smoothstep(0.35, 0.7, n) * 0.8);
  out.lerp(mauve, 0.32 + far * 0.25);
  out.lerp(rose, smoothstep(0.55, 1.0, far) * 0.5);
  // Tiny sunlit ridges and shadowed gullies.
  const light = smoothstep(-10, 7, y) * 0.16 + (n - 0.5) * 0.12;
  out.r += light * 0.5;
  out.g += light * 0.36;
  out.b += light * 0.29;
  return out;
}

export function createLandscape(scene, sunDir) {
  const group = new THREE.Group();
  group.name = 'valley';

  const W = 470;
  const D = 380;
  const segX = 150;
  const segZ = 110;
  const geo = new THREE.PlaneGeometry(W, D, segX, segZ);
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, 0, -190 + 190 - D / 2 - 10); // z from -10 to -390
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const tmpColor = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) + Math.sin(i * 2.19) * 0.4;
    const z = pos.getZ(i);
    const y = terrainHeight(x, z);
    pos.setXYZ(i, x, y, z);
    terrainColor(x, z, y, tmpColor);
    colors[i * 3] = tmpColor.r;
    colors[i * 3 + 1] = tmpColor.g;
    colors[i * 3 + 2] = tmpColor.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();

  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 1,
    metalness: 0,
    flatShading: false,
  });
  const terrain = new THREE.Mesh(geo, mat);
  terrain.receiveShadow = true;
  group.add(terrain);

  /* ---------------- Water shader ---------------- */

  const waterUniforms = {
    uTime: { value: 0 },
    uSunDir: { value: sunDir.clone().normalize() },
    uSkyA: { value: new THREE.Color('#e9aa86') },
    uSkyB: { value: new THREE.Color('#b1889d') },
    uDeep: { value: new THREE.Color('#5c6570') },
    uFogColor: { value: HAZE.clone() },
    uFogDensity: { value: 0.0034 },
  };
  const waterMat = new THREE.ShaderMaterial({
    uniforms: waterUniforms,
    vertexShader: /* glsl */`
      varying vec3 vWorld;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vWorld = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }
    `,
    fragmentShader: /* glsl */`
      uniform float uTime;
      uniform vec3 uSunDir;
      uniform vec3 uSkyA;
      uniform vec3 uSkyB;
      uniform vec3 uDeep;
      uniform vec3 uFogColor;
      uniform float uFogDensity;
      varying vec3 vWorld;

      float hash21(vec2 p) {
        p = fract(p * vec2(123.34, 456.21));
        p += dot(p, p + 45.32);
        return fract(p.x * p.y);
      }

      void main() {
        vec3 view = normalize(cameraPosition - vWorld);
        float dist = length(cameraPosition - vWorld);

        vec2 p = vWorld.xz;
        float t = uTime;
        // Very shallow, long ripples; the lake is seen almost edge-on.
        float w1 = sin(p.x * 0.37 + p.y * 0.18 + t * 0.7);
        float w2 = sin(p.x * 1.13 - p.y * 0.47 - t * 1.15);
        float w3 = sin(p.x * 2.7 + p.y * 1.9 + t * 1.8);
        vec2 slope = vec2(
          cos(p.x * 0.37 + p.y * 0.18 + t * 0.7) * 0.09,
          cos(p.x * 1.13 - p.y * 0.47 - t * 1.15) * 0.06
        );
        slope += vec2(cos(p.x * 2.7 + p.y * 1.9 + t * 1.8) * 0.012, 0.0);
        vec3 n = normalize(vec3(-slope.x, 1.0, -slope.y));

        vec3 refl = reflect(-view, n);
        float sunSpec = pow(max(dot(refl, uSunDir), 0.0), 180.0);
        float broad = pow(max(dot(refl, uSunDir), 0.0), 18.0);
        float fres = pow(1.0 - max(dot(view, n), 0.0), 3.0);

        vec3 skyReflect = mix(uSkyB, uSkyA, pow(max(dot(refl, uSunDir), 0.0), 1.4));
        vec3 col = mix(uDeep, skyReflect, 0.3 + fres * 0.66);
        col += vec3(4.4, 1.6, 0.42) * sunSpec * (0.55 + 0.45 * sin(xor(p.x, p.y)));
        col += vec3(1.4, 0.45, 0.15) * broad * 0.13;

        // Glints: broken, warm path of light towards the viewer.
        float sparkleNoise = hash21(floor(p * 5.0 + vec2(t * 1.7, -t * 0.4)));
        float sparkle = step(0.88, sparkleNoise) * pow(max(dot(refl, uSunDir), 0.0), 7.0);
        col += vec3(2.3, 0.9, 0.28) * sparkle * 0.7;

        float fog = 1.0 - exp(-uFogDensity * uFogDensity * dist * dist);
        col = mix(col, uFogColor, clamp(fog, 0.0, 1.0));
        gl_FragColor = vec4(col, 1.0);
      }
    `,
    side: THREE.DoubleSide,
  });

  function xor(a, b) {
    // Kept as a GLSL-friendly deterministic shimmer in JS uniforms would be
    // overkill; this function is only here to keep the shader readable.
    return 0.0;
  }

  const waterShape = new THREE.Shape();
  const points = 80;
  for (let i = 0; i < points; i++) {
    const a = (i / points) * Math.PI * 2;
    const wob = 1 + 0.1 * Math.sin(a * 3.1 + 0.9) + 0.07 * Math.sin(a * 5.7 + 2.3);
    const x = Math.cos(a) * LAKE.rx * wob;
    const z = Math.sin(a) * LAKE.rz * wob;
    if (i === 0) waterShape.moveTo(x, z);
    else waterShape.lineTo(x, z);
  }
  waterShape.closePath();
  const waterGeo = new THREE.ShapeGeometry(waterShape, 1);
  waterGeo.rotateX(-Math.PI / 2);
  const water = new THREE.Mesh(waterGeo, waterMat);
  water.position.set(LAKE.x, LAKE.y, LAKE.z);
  water.rotation.y = -0.17;
  group.add(water);

  // A second, smaller pool catching the light further towards the ridge.
  const pool = water.clone();
  pool.scale.set(0.42, 1, 0.34);
  pool.rotation.y = 0.4;
  pool.position.set(48, LAKE.y + 0.15, -286);
  group.add(pool);

  /* ---------------- Hazy far ridge silhouettes ---------------- */

  const ridgeGroup = new THREE.Group();
  const ridgeSpecs = [
    { z: -318, base: -16, color: '#7e6068', scale: 1.0, seed: 3, haze: 0.34 },
    { z: -348, base: -18, color: '#8e6e77', scale: 0.86, seed: 7, haze: 0.5 },
    { z: -382, base: -22, color: '#9b7d84', scale: 0.72, seed: 13, haze: 0.64 },
  ];
  for (const spec of ridgeSpecs) {
    const shape = new THREE.Shape();
    const n = 80;
    const width = 700;
    const profile = [];
    for (let i = 0; i <= n; i++) {
      const u = i / n;
      const x = -width / 2 + u * width;
      const ridgeNoise = fbm(u * 6.5 + spec.seed, spec.seed * 1.7, 5);
      const peak = -0.5 + spec.scale * (4.0 + 9.0 * ridgeNoise) + 2.2 * Math.sin(u * 9.0 + spec.seed);
      profile.push([x, peak]);
    }
    shape.moveTo(profile[0][0], spec.base);
    for (const [x, y] of profile) shape.lineTo(x, y);
    shape.lineTo(profile[n][0], spec.base);
    shape.closePath();
    const geo = new THREE.ShapeGeometry(shape, 1);
    const mat = new THREE.MeshBasicMaterial({
      color: spec.color,
      fog: true,
      transparent: true,
      opacity: 1 - spec.haze,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.z = spec.z;
    mesh.position.y = 0;
    mesh.renderOrder = -4;
    ridgeGroup.add(mesh);
  }
  group.add(ridgeGroup);

  /* ---------------- Scattered far tree silhouettes ---------------- */

  const rng = mulberry32(923);
  const shrubMat = new THREE.MeshBasicMaterial({
    color: 0x322d27, transparent: true, opacity: 0.72, fog: true, depthWrite: false,
  });
  const shrubGeo = new THREE.ConeGeometry(1, 1, 5, 1);
  const shrubs = new THREE.InstancedMesh(shrubGeo, shrubMat, 90);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < shrubs.count; i++) {
    const x = -140 + rng() * 260;
    const z = -110 - rng() * 160;
    const y = terrainHeight(x, z) + 1.1;
    const s = 2.5 + rng() * 7;
    dummy.position.set(x, y, z);
    dummy.scale.set(s * (0.5 + rng() * 0.8), s * (1.2 + rng() * 1.8), s * 0.5);
    dummy.rotation.y = rng() * Math.PI;
    dummy.updateMatrix();
    shrubs.setMatrixAt(i, dummy.matrix);
  }
  shrubs.frustumCulled = false;
  group.add(shrubs);

  scene.add(group);

  // Low warm lights in the valley are almost lost, but they keep the world
  // from feeling completely empty.
  const pinMat = new THREE.SpriteMaterial({
    map: makeLightSprite(),
    color: 0xffb167,
    transparent: true,
    opacity: 0.45,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  for (let i = 0; i < 4; i++) {
    const sprite = new THREE.Sprite(pinMat);
    sprite.position.set(-70 + rng() * 120, terrainHeight(-20, -210) + 4, -210 - rng() * 40);
    sprite.scale.setScalar(1.3 + rng() * 1.1);
    group.add(sprite);
  }

  return {
    group,
    terrain,
    water,
    ridges: ridgeGroup,
    update(time, wind = 0) {
      waterUniforms.uTime.value = time;
      waterUniforms.uSkyA.value.setRGB(0.88, 0.52, 0.35).multiplyScalar(1.4);
      shrubs.position.x = Math.sin(time * 0.22) * 0.02 * (0.4 + wind);
    },
  };
}

function makeLightSprite() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,240,205,1)');
  g.addColorStop(0.16, 'rgba(255,190,110,0.9)');
  g.addColorStop(1, 'rgba(255,130,50,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
