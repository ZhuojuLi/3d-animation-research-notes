import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { createSky } from './sky.js';
import { createLandscape } from './landscape.js';
import { createChurch, PORTAL } from './church.js';
import { createForecourt } from './forecourt.js';
import { createVegetation } from './vegetation.js';
import { setMaxAnisotropy } from './materials.js';

/* ------------------------------------------------------------------------
   VESPER — a small editable study of a ruined hilltop chapel at sunset.
   Everything below is procedural; no external image assets are used.
------------------------------------------------------------------------- */

const canvasHost = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({
  antialias: true,
  powerPreference: 'high-performance',
  preserveDrawingBuffer: true,
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.info.autoReset = false;
canvasHost.appendChild(renderer.domElement);
setMaxAnisotropy(renderer.capabilities.getMaxAnisotropy());

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(new THREE.Color('#c08c8f'), 0.0033);

const camera = new THREE.PerspectiveCamera(43, window.innerWidth / window.innerHeight, 0.08, 1600);
const INITIAL_CAMERA = new THREE.Vector3(-5.8, 2.45, 10.8);
const INITIAL_TARGET = new THREE.Vector3(-1.0, 1.95, -3.2);
camera.position.copy(INITIAL_CAMERA);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.copy(INITIAL_TARGET);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.rotateSpeed = 0.55;
controls.zoomSpeed = 0.75;
controls.panSpeed = 0.6;
controls.minDistance = 3.4;
controls.maxDistance = 26;
controls.minPolarAngle = 1.08;
controls.maxPolarAngle = 1.55;
const initialAzimuth = controls.getAzimuthalAngle();
controls.minAzimuthAngle = initialAzimuth - 0.72;
controls.maxAzimuthAngle = initialAzimuth + 0.72;
controls.update();

/* ----------------------------- Light ----------------------------- */

const SUN_DIR = new THREE.Vector3(0.026, 0.06, -1.0).normalize();

const hemi = new THREE.HemisphereLight(0xffc7a3, 0x2a2224, 1.65);
scene.add(hemi);

const sun = new THREE.DirectionalLight(0xffb877, 3.1);
sun.position.copy(SUN_DIR).multiplyScalar(85);
sun.target.position.set(2, 0, -3);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.near = 25;
sun.shadow.camera.far = 125;
sun.shadow.camera.left = -25;
sun.shadow.camera.right = 25;
sun.shadow.camera.top = 22;
sun.shadow.camera.bottom = -12;
sun.shadow.bias = -0.00035;
sun.shadow.normalBias = 0.04;
sun.shadow.radius = 2.8;
scene.add(sun, sun.target);

// Soft light returning from the pale western sky. It is not physically the
// sun itself — it keeps the shaded masonry legible and warm.
const skyFill = new THREE.DirectionalLight(0xffcbaa, 1.0);
skyFill.position.set(-18, 13, 22);
skyFill.target.position.set(2, 2.5, -4);
scene.add(skyFill, skyFill.target);

const edgeFill = new THREE.DirectionalLight(0x8d7685, 0.38);
edgeFill.position.set(15, 9, 4);
edgeFill.target.position.set(0, 2, -2);
scene.add(edgeFill, edgeFill.target);

const ambient = new THREE.AmbientLight(0x503d3e, 0.32);
scene.add(ambient);

/* ----------------------------- World ----------------------------- */

const sky = createSky(SUN_DIR);
scene.add(sky);

const landscape = createLandscape(scene, SUN_DIR);
const church = createChurch(scene);
const forecourt = createForecourt(scene);
const vegetation = createVegetation(scene, SUN_DIR, forecourt.grassSites);

// An invisible pick target across the arch: clicking it glides into the nave.
const doorPick = new THREE.Mesh(
  new THREE.PlaneGeometry(2.9, 5.2),
  new THREE.MeshBasicMaterial({ visible: false })
);
doorPick.position.set(PORTAL.cx, PORTAL.floorY + 2.55, -3.8);
doorPick.userData.isDoor = true;
scene.add(doorPick);

/* ----------------------------- Post FX ----------------------------- */

const composer = new EffectComposer(renderer);
composer.renderTarget1.samples = 4;
composer.renderTarget2.samples = 4;

const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);

const bloom = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  0.42,
  0.72,
  1.02
);
composer.addPass(bloom);

const FinalShader = {
  uniforms: {
    tDiffuse: { value: null },
    uExposure: { value: 1.06 },
    uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
    uTime: { value: 0 },
    uFocus: { value: 0 },
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;
    uniform float uExposure;
    uniform vec2 uResolution;
    uniform float uTime;
    uniform float uFocus;
    varying vec2 vUv;

    float hash12(vec2 p) {
      vec3 p3 = fract(vec3(p.xyx) * 0.1031);
      p3 += dot(p3, p3.yzx + 33.33);
      return fract((p3.x + p3.y) * p3.z);
    }

    vec3 aces(vec3 x) {
      // Stephen Hill's fitted ACES curve, tuned for filmic warm highlights.
      const float a = 2.51;
      const float b = 0.03;
      const float c = 2.43;
      const float d = 0.59;
      const float e = 0.14;
      return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
    }

    vec3 linearToSRGB(vec3 c) {
      return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
    }

    void main() {
      vec2 uv = vUv;
      vec2 centered = uv - 0.5;
      float r2 = dot(centered, centered);
      // Gentle lateral colour edge, strongest in the far corners.
      vec2 ca = centered * (0.0009 + r2 * 0.0021);
      vec3 hdr;
      hdr.r = texture2D(tDiffuse, uv + ca).r;
      hdr.g = texture2D(tDiffuse, uv).g;
      hdr.b = texture2D(tDiffuse, uv - ca).b;

      hdr *= uExposure;
      // A hint of coolness in the deepest shadows lets the candlelight read.
      hdr = mix(hdr, hdr * vec3(0.94, 0.98, 1.08), smoothstep(0.12, 0.0, dot(hdr, vec3(0.3, 0.5, 0.2))) * 0.5);
      vec3 col = aces(hdr);

      float luma = dot(col, vec3(0.2126, 0.7152, 0.0722));
      col = mix(vec3(luma), col, 1.045);
      col *= vec3(1.015, 1.0, 0.988);
      col = pow(col, vec3(0.975, 0.99, 1.005));

      vec3 srgb = linearToSRGB(col);

      // Fine film grain; less intrusive in the blacks.
      float grain = hash12(gl_FragCoord.xy + uTime * 83.0) - 0.5;
      srgb += grain * mix(0.020, 0.008, smoothstep(0.0, 0.5, luma));

      // Vignette and a slight separation toward the warmer centre.
      vec2 vq = centered * vec2(uResolution.x / uResolution.y, 1.0);
      float vig = smoothstep(1.05, 0.2, length(vq));
      srgb *= mix(0.68, 1.0, vig);
      srgb += vec3(0.014, 0.006, 0.0) * (1.0 - vig) * (0.4 + uFocus * 0.5);
      gl_FragColor = vec4(clamp(srgb, 0.0, 1.0), 1.0);
    }
  `,
};

const finalPass = new ShaderPass(FinalShader);
composer.addPass(finalPass);

/* ----------------------------- Interaction ----------------------------- */

const raycaster = new THREE.Raycaster();
const pointerNdc = new THREE.Vector2(2, 2);
let pointerInside = false;
let pointerDown = null;
let hoverDoor = false;
let hoverSteps = false;

const stepPickObjects = [];
forecourt.group.traverse((o) => {
  if (o.isMesh && !o.isInstancedMesh) {
    o.userData.windSurface = true;
    stepPickObjects.push(o);
  }
});

const windProxies = [];
{
  // Broad, invisible slabs make gaze/hover testing forgiving.
  const terraceProxy = new THREE.Mesh(
    new THREE.PlaneGeometry(26, 12).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  terraceProxy.position.set(-5.5, 0.05, 8.1);
  terraceProxy.userData.windSurface = true;
  scene.add(terraceProxy);
  windProxies.push(terraceProxy);

  for (let i = 0; i < 4; i++) {
    const proxy = new THREE.Mesh(
      new THREE.PlaneGeometry(8.2 - i * 0.4, 1.4).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    proxy.position.set(2.3 + i * 0.22, 0.25 + i * 0.35, 4.4 - i * 1.4);
    proxy.rotation.z = 0.04;
    proxy.userData.windSurface = true;
    scene.add(proxy);
    windProxies.push(proxy);
  }
}

function updatePointer(clientX, clientY) {
  pointerNdc.x = (clientX / window.innerWidth) * 2 - 1;
  pointerNdc.y = -(clientY / window.innerHeight) * 2 + 1;
  pointerInside = true;
}

renderer.domElement.addEventListener('pointermove', (e) => {
  updatePointer(e.clientX, e.clientY);
  document.body.classList.add('active');
  clearTimeout(window.__hintTimer);
  window.__hintTimer = setTimeout(() => document.body.classList.remove('active'), 2600);
});

renderer.domElement.addEventListener('pointerleave', () => {
  pointerInside = false;
  hoverDoor = false;
  hoverSteps = false;
});

renderer.domElement.addEventListener('pointerdown', (e) => {
  pointerDown = { x: e.clientX, y: e.clientY, t: performance.now() };
  updatePointer(e.clientX, e.clientY);
});

renderer.domElement.addEventListener('pointerup', (e) => {
  if (!pointerDown) return;
  const dx = e.clientX - pointerDown.x;
  const dy = e.clientY - pointerDown.y;
  const moved = Math.hypot(dx, dy) > 6;
  const quick = performance.now() - pointerDown.t < 650;
  pointerDown = null;
  if (moved || !quick) return;

  updatePointer(e.clientX, e.clientY);
  raycaster.setFromCamera(pointerNdc, camera);
  const hits = raycaster.intersectObject(doorPick, false);
  if (hits.length > 0) {
    beginFocusTween();
  }
});

const focusView = {
  camera: new THREE.Vector3(4.1, 2.7, 1.25),
  target: new THREE.Vector3(4.08, 2.62, -5.7),
};

let tween = null;
function beginFocusTween() {
  if (tween) return;
  const startCamera = camera.position.clone();
  const startTarget = controls.target.clone();
  // If already close, pull back to the establishing view instead.
  const close = camera.position.distanceTo(focusView.camera) < 3.4 &&
    controls.target.distanceTo(focusView.target) < 3.0;
  const endCamera = close ? INITIAL_CAMERA.clone() : focusView.camera.clone();
  const endTarget = close ? INITIAL_TARGET.clone() : focusView.target.clone();
  tween = {
    startCamera, startTarget, endCamera, endTarget,
    start: performance.now(),
    duration: close ? 2100 : 2300,
  };
  controls.enabled = false;
  document.body.classList.toggle('focused', !close);
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (tween) return;
    const startCamera = camera.position.clone();
    const startTarget = controls.target.clone();
    tween = {
      startCamera, startTarget,
      endCamera: INITIAL_CAMERA.clone(), endTarget: INITIAL_TARGET.clone(),
      start: performance.now(), duration: 2000,
    };
    controls.enabled = false;
    document.body.classList.remove('focused');
  }
});

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/* ----------------------------- Clock / state ----------------------------- */

const clock = new THREE.Clock();
let elapsed = 0;
let focus = 0;
let wind = 0.22;
let pointerTime = 0;
let doorAnchor = new THREE.Vector3(PORTAL.cx, PORTAL.floorY + 1.6, PORTAL.wallFront + 0.5);
let lanternAnchor = new THREE.Vector3(PORTAL.cx, PORTAL.floorY + 1.2, PORTAL.wallFront - 0.4);

let frames = 0;
let fpsTimer = 0;
let fps = 0;
let renderTimeMs = 0;

const diagnostics = {
  errors: [],
  ready: false,
  firstRenderMs: null,
  sceneCreationMs: null,
  frames: 0,
  fps: 0,
  renderTimeMs: 0,
  focus: 0,
  wind: 0.22,
  camera: camera.position.toArray(),
  target: controls.target.toArray(),
  webgl2: renderer.capabilities.isWebGL2,
  renderer: null,
  triangles: 0,
  calls: 0,
  textures: 0,
  geometries: 0,
};
window.addEventListener('error', (e) => diagnostics.errors.push(String(e.message || e.error)));
window.addEventListener('unhandledrejection', (e) => diagnostics.errors.push(String(e.reason)));

function updateHover() {
  if (!pointerInside) {
    hoverDoor = false;
    hoverSteps = false;
    return;
  }
  raycaster.setFromCamera(pointerNdc, camera);
  hoverDoor = raycaster.intersectObject(doorPick, false).length > 0;
  if (!hoverDoor) {
    hoverSteps = raycaster.intersectObjects(windProxies, false).length > 0;
  } else {
    hoverSteps = false;
  }
  renderer.domElement.style.cursor = hoverDoor ? 'pointer' : 'default';
}

function updateViewState(dt) {
  if (tween) {
    const t = Math.min(1, (performance.now() - tween.start) / tween.duration);
    const k = ease(t);
    camera.position.lerpVectors(tween.startCamera, tween.endCamera, k);
    controls.target.lerpVectors(tween.startTarget, tween.endTarget, k);
    camera.lookAt(controls.target);
    if (t >= 1) {
      tween = null;
      controls.enabled = true;
      controls.update();
    }
  } else {
    controls.update();
  }

  updateHover();

  const camToDoor = doorAnchor.clone().sub(camera.position);
  const doorDist = camToDoor.length();
  const forward = new THREE.Vector3();
  camera.getWorldDirection(forward);
  const gazeDoor = forward.dot(camToDoor.normalize());
  const proximity = 1 - THREE.MathUtils.smoothstep(doorDist, 6.0, 16.0);
  const alignment = THREE.MathUtils.smoothstep(gazeDoor, 0.910, 0.997);
  const targetFocus = THREE.MathUtils.clamp(proximity * (0.35 + alignment * 0.75), 0, 1);
  focus += (targetFocus - focus) * Math.min(1, dt * 2.4);

  const camToSteps = forecourt.stepFocus.clone().sub(camera.position);
  const stepDist = camToSteps.length();
  const stepsDir = camToSteps.normalize();
  const gazeSteps = THREE.MathUtils.smoothstep(forward.dot(stepsDir), 0.80, 0.995);
  const nearSteps = 1 - THREE.MathUtils.smoothstep(stepDist, 5.0, 13.0);
  const hoverBoost = hoverSteps ? 1 : 0;
  const gust = 0.08 * Math.sin(elapsed * 0.43) + 0.05 * Math.sin(elapsed * 1.12 + 1.3);
  const targetWind = 0.22 + Math.max(nearSteps * 0.54, hoverBoost * 0.72, gazeSteps * 0.26) + gust * (0.3 + nearSteps);
  wind += (targetWind - wind) * Math.min(1, dt * 1.8);
}

function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setSize(w, h);
  composer.setSize(w, h);
  bloom.setSize(w, h);
  finalPass.uniforms.uResolution.value.set(w, h);
}
window.addEventListener('resize', resize);

const startCreation = performance.now();
// Creation happens synchronously above; this timestamp is useful diagnostics.
diagnostics.sceneCreationMs = performance.now() - startCreation;

function renderFrame() {
  requestAnimationFrame(renderFrame);
  const dt = Math.min(clock.getDelta(), 0.05);
  elapsed += dt;

  updateViewState(dt);

  sky.userData.uniforms.uTime.value = elapsed;
  landscape.update(elapsed, wind);
  church.update(elapsed, focus, wind);
  vegetation.update(elapsed, wind);

  finalPass.uniforms.uTime.value = elapsed;
  finalPass.uniforms.uFocus.value = focus;
  finalPass.uniforms.uExposure.value = renderer.toneMappingExposure;

  const t0 = performance.now();
  renderer.info.reset();
  composer.render();
  renderTimeMs = performance.now() - t0;
  frames++;
  fpsTimer += dt;
  if (fpsTimer > 0.6) {
    fps = frames / fpsTimer;
    frames = 0;
    fpsTimer = 0;
    diagnostics.fps = Math.round(fps * 10) / 10;
  }
  diagnostics.frames++;
  diagnostics.renderTimeMs = Math.round(renderTimeMs * 10) / 10;
  diagnostics.focus = Math.round(focus * 1000) / 1000;
  diagnostics.wind = Math.round(wind * 1000) / 1000;
  diagnostics.camera = camera.position.toArray().map((v) => Math.round(v * 1000) / 1000);
  diagnostics.target = controls.target.toArray().map((v) => Math.round(v * 1000) / 1000);
  diagnostics.triangles = renderer.info.render.triangles;
  diagnostics.calls = renderer.info.render.calls;
  diagnostics.textures = renderer.info.memory.textures;
  diagnostics.geometries = renderer.info.memory.geometries;
  window.__diagnostics = diagnostics;

  if (!diagnostics.ready) {
    diagnostics.ready = true;
    diagnostics.firstRenderMs = Math.round(performance.now() * 10) / 10;
    document.body.classList.add('ready');
    window.__ready = true;
  }
}

// Expose a small, stable API for inspection and capture.
window.__vesper = {
  renderer,
  scene,
  camera,
  controls,
  composer,
  church,
  forecourt,
  landscape,
  vegetation,
  diagnostics,
  focusView,
  initialCamera: INITIAL_CAMERA,
  initialTarget: INITIAL_TARGET,
  setFocus(v) {
    if (v) {
      camera.position.copy(focusView.camera);
      controls.target.copy(focusView.target);
      controls.update();
      focus = 1;
      document.body.classList.add('focused');
    } else {
      camera.position.copy(INITIAL_CAMERA);
      controls.target.copy(INITIAL_TARGET);
      controls.update();
      focus = 0;
      document.body.classList.remove('focused');
    }
  },
  setWind(v) {
    wind = v;
    vegetation.windUniforms.uWind.value = v;
  },
  stepFocus: forecourt.stepFocus,
  doorAnchor,
};

const gl = renderer.getContext();
const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
diagnostics.renderer = debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
diagnostics.vendor = debugInfo ? gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR);

renderFrame();
