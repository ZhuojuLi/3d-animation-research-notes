import * as THREE from 'three';

/* ------------------------------------------------------------------------
   Sky dome.  The painted panorama (assets/sky.png) covers the sector the
   camera can inspect.  A tight HDR glow is added around the sun so the
   bloom pass gets a clean, hot core without washing out the whole sky.
------------------------------------------------------------------------- */

export const SKY_SECTOR = {
  lonMin: THREE.MathUtils.degToRad(-80),
  lonMax: THREE.MathUtils.degToRad(80),
  latMin: THREE.MathUtils.degToRad(-10),
  latMax: THREE.MathUtils.degToRad(47),
};

const vertexShader = /* glsl */`
  varying vec3 vWorldPosition;
  varying vec3 vDirection;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorldPosition = world.xyz;
    vDirection = normalize(position);
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const fragmentShader = /* glsl */`
  uniform sampler2D uSkyMap;
  uniform vec3 uSunDir;
  uniform vec3 uFallbackLow;
  uniform vec3 uFallbackHigh;
  uniform float uLonMin;
  uniform float uLonMax;
  uniform float uLatMin;
  uniform float uLatMax;
  uniform float uIntensity;

  varying vec3 vWorldPosition;

  void main() {
    vec3 dir = normalize(vWorldPosition - cameraPosition);
    float lon = atan(dir.x, -dir.z);
    float lat = asin(clamp(dir.y, -1.0, 1.0));
    float u = (lon - uLonMin) / (uLonMax - uLonMin);
    float v = (uLatMax - lat) / (uLatMax - uLatMin);
    float inSector = step(0.0, u) * step(u, 1.0) * step(0.0, v) * step(v, 1.0);
    u = clamp(u, 0.001, 0.999);
    v = clamp(v, 0.001, 0.999);
    vec3 mapCol = texture2D(uSkyMap, vec2(u, v)).rgb;
    // Out-of-sector directions (only reachable when tilting far up) fall
    // back to a quiet continuation of the upper air.
    vec3 fallback = mix(uFallbackLow, uFallbackHigh, smoothstep(0.0, 0.7, dir.y));
    vec3 col = mix(fallback, mapCol, inSector);

    // A tight atmospheric halo. The painted map already contains the sun;
    // this lift is what gives it a genuine physical glare through the bloom.
    float sd = clamp(dot(dir, uSunDir), 0.0, 1.0);
    col += vec3(3.8, 1.9, 0.72) * pow(sd, 880.0) * 0.55;
    col += vec3(1.9, 0.78, 0.25) * pow(sd, 140.0) * 0.27;
    col += vec3(0.55, 0.18, 0.045) * pow(sd, 16.0) * 0.11;

    // Very gentle exposure lift, then a whisper of dither against banding.
    float dither = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5;
    col += dither / 255.0;
    gl_FragColor = vec4(max(col, 0.0) * uIntensity, 1.0);
  }
`;

export function createSky(sunDir, skyTexture) {
  skyTexture.wrapS = THREE.ClampToEdgeWrapping;
  skyTexture.wrapT = THREE.ClampToEdgeWrapping;
  skyTexture.minFilter = THREE.LinearMipmapLinearFilter;
  skyTexture.magFilter = THREE.LinearFilter;
  skyTexture.generateMipmaps = true;
  skyTexture.flipY = false;
  skyTexture.colorSpace = THREE.SRGBColorSpace;
  skyTexture.needsUpdate = true;

  const uniforms = {
    uSkyMap: { value: skyTexture },
    uSunDir: { value: sunDir.clone().normalize() },
    uFallbackLow: { value: new THREE.Color('#9a707e') },
    uFallbackHigh: { value: new THREE.Color('#59465d') },
    uLonMin: { value: SKY_SECTOR.lonMin },
    uLonMax: { value: SKY_SECTOR.lonMax },
    uLatMin: { value: SKY_SECTOR.latMin },
    uLatMax: { value: SKY_SECTOR.latMax },
    uIntensity: { value: 1.05 },
  };

  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader,
    fragmentShader,
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: true,
    fog: false,
  });

  const geometry = new THREE.SphereGeometry(760, 96, 64);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'sunset-sky';
  mesh.frustumCulled = false;
  mesh.renderOrder = -1000;
  mesh.userData.uniforms = uniforms;
  return mesh;
}

export function createSunSprite(sunDir) {
  // Crisp, additive star. Kept fairly small; the painted sky supplies the
  // broad colour field, while this gives the lens/bloom something to hold.
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0.0, 'rgba(255,255,250,1)');
  g.addColorStop(0.035, 'rgba(255,247,218,1)');
  g.addColorStop(0.08, 'rgba(255,218,154,0.92)');
  g.addColorStop(0.20, 'rgba(255,166,82,0.35)');
  g.addColorStop(0.48, 'rgba(255,124,49,0.07)');
  g.addColorStop(1.0, 'rgba(255,100,20,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({
    map: tex,
    color: new THREE.Color().setRGB(2.4, 1.8, 1.2),
    transparent: true,
    opacity: 0.95,
    depthWrite: false,
    depthTest: true,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
  const sprite = new THREE.Sprite(material);
  sprite.position.copy(sunDir).normalize().multiplyScalar(710);
  sprite.scale.set(72, 72, 1);
  sprite.renderOrder = -990;
  return sprite;
}
