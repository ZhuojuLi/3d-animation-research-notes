import * as THREE from 'three';

export const SUN_DIRECTION = new THREE.Vector3(-0.262, 0.074, -0.962).normalize();

/**
 * Calibrated in true Linear-sRGB for ACESFilmicToneMapping + OutputPass:
 * Rich pink-violet zenith -> salmon rose -> fiery orange-gold horizon,
 * with dark purple-umber broken stratocumulus clouds rim-lit in molten gold!
 */
export function createSunsetSkyMesh(radius = 1600) {
  const geo = new THREE.SphereGeometry(radius, 64, 44);

  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      uSunDir: { value: SUN_DIRECTION.clone() },
      uTime: { value: 0.0 }
    },
    vertexShader: /* glsl */ `
      varying vec3 vWorldDir;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldDir = normalize(position);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      varying vec3 vWorldDir;
      uniform vec3 uSunDir;
      uniform float uTime;

      float hash21(vec2 p) {
        p = fract(p * vec2(123.34, 456.21));
        p += dot(p, p + 45.32);
        return fract(p.x * p.y);
      }

      float noise2(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        float a = hash21(i);
        float b = hash21(i + vec2(1.0, 0.0));
        float c = hash21(i + vec2(0.0, 1.0));
        float d = hash21(i + vec2(1.0, 1.0));
        return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
      }

      float fbm(vec2 p) {
        float v = 0.0;
        float a = 0.52;
        mat2 rot = mat2(0.80, 0.60, -0.60, 0.80);
        for (int i = 0; i < 5; i++) {
          v += a * noise2(p);
          p = rot * p * 2.07 + vec2(13.7, 7.3);
          a *= 0.5;
        }
        return v;
      }

      void main() {
        vec3 dir = normalize(vWorldDir);
        float sunDot = max(dot(dir, uSunDir), 0.0);
        float elev = dir.y;

        // True linear-sRGB sunset sky colors (rich orange-red -> salmon-pink -> dusty violet-mauve)
        vec3 colHorizon = vec3(0.88, 0.22, 0.024);
        vec3 colLowMid  = vec3(0.58, 0.19, 0.095);
        vec3 colMid     = vec3(0.30, 0.145, 0.155);
        vec3 colUpper   = vec3(0.165, 0.105, 0.145);

        float h1 = smoothstep(0.00, 0.10, elev);
        float h2 = smoothstep(0.08, 0.21, elev);
        float h3 = smoothstep(0.18, 0.36, elev);

        vec3 sky = mix(colHorizon, colLowMid, h1);
        sky = mix(sky, colMid, h2);
        sky = mix(sky, colUpper, h3);

        // Focused warm golden-orange solar glow near sun azimuth
        float azGlow = pow(sunDot, 7.5) * smoothstep(0.28, 0.00, elev);
        sky += vec3(0.76, 0.24, 0.025) * azGlow * 0.72;
        sky += vec3(0.95, 0.42, 0.06) * pow(sunDot, 36.0) * 0.65;

        // Broken altocumulus / stratocumulus sunset cloud deck right in ny = 0.04..0.38!
        if (elev > 0.005) {
          float py = max(elev + 0.055, 0.045);
          vec2 cloudUV = dir.xz / py * 0.85 + vec2(1.9 + uTime * 0.0025, 0.8);

          vec2 cuv = vec2(cloudUV.x * 0.74, cloudUV.y * 1.42);
          float n1 = fbm(cuv * 1.65);
          float n2 = fbm(cuv * 3.9 - vec2(1.2, 2.3));
          float n3 = fbm(cuv * 8.2 + vec2(4.1, 0.7));
          float raw = n1 * 0.48 + n2 * 0.36 + n3 * 0.16;

          // Rich broken mackerel/stratocumulus clouds spanning ny = 0.04..0.38!
          float altMask = smoothstep(0.015, 0.065, elev) * smoothstep(0.48, 0.20, elev);
          float sunClear = 1.0 - 0.32 * pow(sunDot, 65.0);
          float modulated = (raw + 0.055 * altMask) * sunClear;
          float density = smoothstep(0.415, 0.535, modulated);

          // Sample offset toward setting sun for crisp dark-belly vs molten-gold rim contrast!
          vec2 sunStep = normalize(uSunDir.xz) * 0.085;
          float rawSun = fbm((cuv + sunStep) * 1.65) * 0.52 + fbm((cuv + sunStep) * 3.9 - vec2(1.2, 2.3)) * 0.48;
          float densSun = smoothstep(0.415, 0.535, (rawSun + 0.055 * altMask));

          float rimFactor = clamp((1.0 - densSun) * 0.82 + (1.0 - smoothstep(0.44, 0.54, modulated)) * 0.55, 0.0, 1.0);

          vec3 cloudBelly = mix(vec3(0.052, 0.030, 0.040), vec3(0.090, 0.044, 0.044), pow(sunDot, 3.0));
          vec3 cloudRim   = mix(vec3(0.62, 0.21, 0.072), vec3(1.32, 0.52, 0.070), pow(sunDot, 2.4));
          vec3 cloudCol   = mix(cloudBelly, cloudRim, pow(rimFactor, 1.38) * (0.38 + 0.62 * pow(sunDot, 1.6)));

          cloudCol += vec3(0.98, 0.44, 0.058) * pow(sunDot, 18.0) * (1.0 - density * 0.55) * 0.62;

          float fadeLow = smoothstep(0.012, 0.055, elev);
          sky = mix(sky, cloudCol, density * fadeLow * 0.94);
        }

        // Crisp setting sun disc & tight fiery solar corona
        float sunDisc = smoothstep(0.99948, 0.99984, sunDot);
        float sunCorona = pow(sunDot, 320.0) * 1.95 + pow(sunDot, 75.0) * 0.40;
        sky += vec3(3.4, 2.2, 0.85) * sunDisc + vec3(1.20, 0.44, 0.055) * sunCorona;

        // Warm valley atmospheric haze below horizon
        if (elev < 0.0) {
          float below = smoothstep(0.0, -0.16, elev);
          vec3 valleyHaze = mix(vec3(0.58, 0.18, 0.045), vec3(0.08, 0.045, 0.045), below);
          sky = mix(sky, valleyHaze, smoothstep(0.0, -0.035, elev));
        }

        gl_FragColor = vec4(sky, 1.0);
      }
    `
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'SunsetSkyDome';
  mesh.renderOrder = -10;
  return mesh;
}

/**
 * Multi-octave fractal ridge height helper in JS for natural mountain silhouettes.
 */
function mountainNoise(x, seed = 0) {
  return (
    Math.sin(x * 0.019 + seed) * 0.50 +
    Math.sin(x * 0.047 + seed * 2.1 + 1.3) * 0.26 +
    Math.cos(x * 0.113 - seed * 1.7) * 0.14 +
    Math.sin(x * 0.271 + seed * 3.4) * 0.07 +
    Math.cos(x * 0.530 + 0.8) * 0.03
  );
}

function smoothstepJS(edge0, edge1, x) {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/**
 * Builds the 5 receding mountain valley terrain layers and the golden reflective lake!
 */
export function createValleyAndLake() {
  const group = new THREE.Group();
  group.name = 'MountainValleyAndLake';

  function makeRidgeMaterial(baseHex, hazeHex, hazeAmount, sunScatter) {
    return new THREE.ShaderMaterial({
      uniforms: {
        uSunDir: { value: SUN_DIRECTION.clone() },
        uBaseCol: { value: new THREE.Color(baseHex) }, // THREE.Color converts hex to linear automatically!
        uHazeCol: { value: new THREE.Color(hazeHex) },
        uHazeAmount: { value: hazeAmount },
        uSunScatter: { value: sunScatter }
      },
      vertexShader: /* glsl */ `
        varying vec3 vWorldPos;
        varying vec3 vWorldNormal;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldPos = wp.xyz;
          vWorldNormal = normalize(mat3(modelMatrix) * normal);
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: /* glsl */ `
        precision highp float;
        varying vec3 vWorldPos;
        varying vec3 vWorldNormal;
        uniform vec3 uSunDir;
        uniform vec3 uBaseCol;
        uniform vec3 uHazeCol;
        uniform float uHazeAmount;
        uniform float uSunScatter;

        float hash21(vec2 p) {
          p = fract(p * vec2(127.1, 311.7));
          p += dot(p, p + 34.23);
          return fract(p.x * p.y);
        }
        float noise2(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          vec2 u = f * f * (3.0 - 2.0 * f);
          return mix(
            mix(hash21(i), hash21(i + vec2(1.0, 0.0)), u.x),
            mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), u.x),
            u.y
          );
        }

        void main() {
          vec3 viewDir = normalize(vWorldPos - cameraPosition);
          float sunAlign = max(dot(viewDir, uSunDir), 0.0);
          vec3 N = normalize(vWorldNormal);

          // Multi-scale rocky/scrubby valley slope texture
          float n1 = noise2(vWorldPos.xz * 0.04);
          float n2 = noise2(vWorldPos.xz * 0.15);
          float n3 = noise2(vWorldPos.xz * 0.55);
          float detail = n1 * 0.5 + n2 * 0.32 + n3 * 0.18;

          float ndl = clamp(dot(N, uSunDir) * 0.5 + 0.5, 0.0, 1.0);
          vec3 terrain = uBaseCol * (0.55 + 0.75 * detail) * (0.55 + 0.65 * ndl);

          // Linear-sRGB sunset aerial perspective (dusty mauve-brown -> fiery amber under sun)
          vec3 sunHaze = mix(uHazeCol, vec3(0.72, 0.19, 0.032), pow(sunAlign, 3.2) * uSunScatter);
          float valleyMist = clamp(uHazeAmount + smoothstep(2.0, -26.0, vWorldPos.y) * 0.18, 0.0, 0.94);
          vec3 col = mix(terrain, sunHaze, valleyMist);

          // Warm orange rim glow right beneath the setting sun disc
          col += vec3(0.68, 0.18, 0.025) * pow(sunAlign, 12.0) * uSunScatter * 0.55;

          gl_FragColor = vec4(col, 1.0);
        }
      `
    });
  }

  function buildRidgeBand({ zDist, width, depth, baseY, profileFn, segX = 180, segZ = 20, mat }) {
    const geo = new THREE.PlaneGeometry(width, depth, segX, segZ);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;

    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const zLocal = pos.getZ(i);
      const worldX = x - 110;
      const crest = profileFn(worldX);
      const distFromCrest = Math.abs(zLocal + depth * 0.15) / (depth * 0.65);
      const slope = Math.max(0, 1.0 - Math.pow(distFromCrest, 1.75) * 0.88);
      const gully = mountainNoise(worldX * 2.4 + zLocal * 1.6, 4.2) * 2.4;
      pos.setY(i, baseY + (crest + gully) * slope);
    }
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(-110, 0, zDist);
    return mesh;
  }

  // Layer 5: Distant horizon mountain range (z = -780m)
  group.add(buildRidgeBand({
    zDist: -780,
    width: 980,
    depth: 150,
    baseY: -12,
    profileFn: (wx) => {
      // Gentle saddle around sun x = -210 (nx = 0.238), rising softly on left & right
      const saddle = 1.0 - 0.28 * Math.exp(-Math.pow((wx + 208) / 85, 2));
      return (30 + mountainNoise(wx * 0.7, 1.1) * 14) * saddle;
    },
    mat: makeRidgeMaterial('#4a3238', '#a8624c', 0.82, 0.95)
  }));

  // Layer 4: Mid-far ridge behind the reservoir lake (z = -520m)
  group.add(buildRidgeBand({
    zDist: -520,
    width: 720,
    depth: 130,
    baseY: -15,
    profileFn: (wx) => {
      const basinDip = 1.0 - 0.55 * Math.exp(-Math.pow((wx + 125) / 55, 2));
      return (23 + mountainNoise(wx * 1.1, 2.7) * 9.5) * basinDip;
    },
    mat: makeRidgeMaterial('#432d32', '#945240', 0.70, 0.85)
  }));

  // Valley Reservoir / Lake Surface at z = -390m (nestled in left cove nx = 0.15..0.24, ny = 0.484!)
  const lakeGeo = new THREE.PlaneGeometry(98, 56, 1, 1);
  lakeGeo.rotateX(-Math.PI / 2);
  const lakeMat = new THREE.ShaderMaterial({
    uniforms: {
      uSunDir: { value: SUN_DIRECTION.clone() },
      uTime: { value: 0.0 }
    },
    vertexShader: /* glsl */ `
      varying vec3 vWorldPos;
      varying vec2 vUv;
      void main() {
        vUv = uv;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      varying vec3 vWorldPos;
      varying vec2 vUv;
      uniform vec3 uSunDir;
      uniform float uTime;

      float hash21(vec2 p) {
        p = fract(p * vec2(123.34, 456.21));
        p += dot(p, p + 45.32);
        return fract(p.x * p.y);
      }
      float noise2(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(hash21(i), hash21(i + vec2(1.0, 0.0)), u.x),
          mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), u.x),
          u.y
        );
      }

      void main() {
        vec3 V = normalize(cameraPosition - vWorldPos);
        float r1 = noise2(vec2(vWorldPos.x * 0.45 + uTime * 0.22, vWorldPos.z * 1.8));
        float r2 = noise2(vec2(vWorldPos.x * 1.1 - uTime * 0.15, vWorldPos.z * 3.6));
        vec3 N = normalize(vec3((r1 - 0.5) * 0.06, 1.0, (r2 - 0.5) * 0.10));

        vec3 R = reflect(-V, N);
        float sunSpec = max(dot(normalize(vec2(R.x, R.z)), normalize(vec2(uSunDir.x, uSunDir.z))), 0.0);

        // True linear-sRGB warm golden-salmon lake reflection + shimmering sun streak!
        vec3 waterCol = vec3(0.68, 0.24, 0.075);
        vec3 shimmer  = vec3(1.35, 0.62, 0.14) * pow(sunSpec, 14.0) * (0.65 + 0.35 * r2);
        vec3 col = waterCol + shimmer;

        // Organic cove shoreline vignette
        float edge = smoothstep(0.50, 0.32, abs(vUv.x - 0.5)) * smoothstep(0.50, 0.28, abs(vUv.y - 0.5));
        col *= (0.55 + 0.45 * edge);

        gl_FragColor = vec4(col, 1.0);
      }
    `
  });
  const lakeMesh = new THREE.Mesh(lakeGeo, lakeMat);
  lakeMesh.position.set(-124, -8.6, -390);
  lakeMesh.name = 'ValleyLake';
  group.add(lakeMesh);

  // Layer 3: Overlapping dark-amber headland ridge framing the right side of the lake (z = -315m)
  group.add(buildRidgeBand({
    zDist: -315,
    width: 540,
    depth: 95,
    baseY: -18.5,
    profileFn: (wx) => {
      // Low on left (-160..-102) to reveal the golden lake, rising into a gentle spur on right (-95..-25)!
      const rightSpur = smoothstepJS(-108, -74, wx) * 12.8;
      const farLeftSpur = smoothstepJS(-148, -182, wx) * 11.5;
      return 3.2 + rightSpur + farLeftSpur + mountainNoise(wx * 1.5, 5.1) * 3.2;
    },
    mat: makeRidgeMaterial('#382426', '#7d4435', 0.52, 0.68)
  }));

  // Layer 2: Rolling dusky valley foothills below the lake (z = -180m)
  group.add(buildRidgeBand({
    zDist: -180,
    width: 380,
    depth: 85,
    baseY: -21.5,
    profileFn: (wx) => {
      return 10.2 + mountainNoise(wx * 1.8, 3.3) * 4.5;
    },
    mat: makeRidgeMaterial('#2e1f1c', '#69392b', 0.36, 0.48)
  }));

  // Layer 1: Near rocky scrub hillside below the chapel parapet (z = -68m)
  group.add(buildRidgeBand({
    zDist: -68,
    width: 240,
    depth: 65,
    baseY: -19.2,
    profileFn: (wx) => {
      return 8.8 + mountainNoise(wx * 2.6, 0.9) * 3.2;
    },
    mat: makeRidgeMaterial('#261b15', '#542f23', 0.18, 0.28)
  }));

  return { group, lakeMat };
}
