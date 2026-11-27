import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

import {
  createAshlarWallTextures,
  createRoughLichenStoneTextures,
  createCarvedLimestoneTextures,
  createFlagstoneTextures,
  createAgedWoodTextures,
  createLancetGlassTexture,
  createFoliageClusterTexture,
  createBarkTextures
} from './textures.js';
import { SUN_DIRECTION, createSunsetSkyMesh, createValleyAndLake } from './skyAndValley.js';
import { createChapel } from './chapel.js';
import { createCourtyardAndSteps } from './courtyardAndSteps.js';
import { createVegetation } from './vegetation.js';

// --- Camera Presets ---
const PRESETS = {
  default: {
    pos: new THREE.Vector3(0.0, 1.55, 8.20),
    target: new THREE.Vector3(0.0, 1.364, 0.0),
    fov: 38,
    candleBoost: 0.0,
    windBoost: 0.0
  },
  archway: {
    pos: new THREE.Vector3(1.18, 1.98, 4.45),
    target: new THREE.Vector3(2.42, 2.28, -0.95),
    fov: 38,
    candleBoost: 1.0,
    windBoost: 0.25
  },
  steps: {
    pos: new THREE.Vector3(-0.45, 1.16, 6.35),
    target: new THREE.Vector3(0.25, 0.86, 1.65),
    fov: 40,
    candleBoost: 0.2,
    windBoost: 1.0
  }
};

const container = document.getElementById('canvas-container');

// 1. WebGLRenderer
const renderer = new THREE.WebGLRenderer({
  antialias: true,
  powerPreference: 'high-performance',
  preserveDrawingBuffer: true
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.02;
container.appendChild(renderer.domElement);

// 2. Scene & Camera
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  PRESETS.default.fov,
  window.innerWidth / window.innerHeight,
  0.12,
  2400
);
camera.position.copy(PRESETS.default.pos);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.copy(PRESETS.default.target);
controls.enableDamping = true;
controls.dampingFactor = 0.065;
controls.maxPolarAngle = Math.PI * 0.56;
controls.minDistance = 1.6;
controls.maxDistance = 24.0;
controls.update();

// 3. Generate Procedural PBR Textures
const textures = {
  ashlar: createAshlarWallTextures(101),
  roughStone: createRoughLichenStoneTextures(202, 0.26),
  heavyLichenStone: createRoughLichenStoneTextures(209, 0.82),
  carvedStone: createCarvedLimestoneTextures(303),
  flagstone: createFlagstoneTextures(404),
  doorWood: createAgedWoodTextures(505, false),
  pewWood: createAgedWoodTextures(519, true),
  lancetGlass: createLancetGlassTexture(),
  foliage: createFoliageClusterTexture(707),
  bark: createBarkTextures(808)
};

// 4. Sky, PMREM Sunset Environment Map & Mountain Valley + Lake
const skyMesh = createSunsetSkyMesh(1600);
scene.add(skyMesh);

{
  const envScene = new THREE.Scene();
  envScene.add(createSunsetSkyMesh(60));
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  const envRT = pmrem.fromScene(envScene, 0.03);
  scene.environment = envRT.texture;
  pmrem.dispose();
}

const { group: valleyGroup, lakeMat } = createValleyAndLake();
scene.add(valleyGroup);

// 5. Exterior Sunset Directional & Twilight Sky Bounce Lights
const sunLight = new THREE.DirectionalLight('#ff9b42', 3.1);
sunLight.position.copy(SUN_DIRECTION).multiplyScalar(42);
sunLight.castShadow = true;
sunLight.shadow.mapSize.set(2048, 2048);
sunLight.shadow.camera.near = 5;
sunLight.shadow.camera.far = 95;
sunLight.shadow.camera.left = -10;
sunLight.shadow.camera.right = 10;
sunLight.shadow.camera.top = 10;
sunLight.shadow.camera.bottom = -6;
sunLight.shadow.bias = -0.00045;
sunLight.shadow.normalBias = 0.025;
scene.add(sunLight);

// Cool-neutral twilight zenith fill + earthy umber bounce so stone shadows read as authentic weathered grey-brown!
const hemiLight = new THREE.HemisphereLight('#b6bcc9', '#524438', 0.95);
scene.add(hemiLight);

// Overhead twilight sky light: illuminates horizontal stone step treads & copings
// while casting real roof shadow so the chapel interior stays dark and sheltered!
const zenithStepLight = new THREE.DirectionalLight('#c6cbd8', 1.32);
zenithStepLight.position.set(1.5, 16.0, 6.5);
zenithStepLight.castShadow = true;
zenithStepLight.shadow.mapSize.set(1024, 1024);
zenithStepLight.shadow.camera.near = 4;
zenithStepLight.shadow.camera.far = 36;
zenithStepLight.shadow.camera.left = -9;
zenithStepLight.shadow.camera.right = 9;
zenithStepLight.shadow.camera.top = 9;
zenithStepLight.shadow.camera.bottom = -9;
zenithStepLight.shadow.bias = -0.0008;
scene.add(zenithStepLight);

// Gentle warm sunset horizon rim on left-facing stone surfaces
const valleyBounceLight = new THREE.DirectionalLight('#ff9a52', 0.32);
valleyBounceLight.position.set(-16, 2.2, -2);
scene.add(valleyBounceLight);

// 6. Build Chapel, Courtyard/Steps & Wind-Animated Vegetation
const chapel = createChapel(textures);
scene.add(chapel.group);

const courtyard = createCourtyardAndSteps(textures, {
  position: chapel.group.position,
  rotation: chapel.group.rotation
});
scene.add(courtyard.group);

const vegetation = createVegetation(textures, courtyard.grassAnchors);
scene.add(vegetation.group);

// 7. Post-Processing Composer (Subtle Selective Solar & Candle Bloom + ACES Output)
const composer = new EffectComposer(renderer);
const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);

const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  0.18, // Crisp, subtle atmospheric bloom
  0.48,
  0.96  // High threshold so only incandescent sun, lake glint & candle flames glow
);
composer.addPass(bloomPass);

const outputPass = new OutputPass();
composer.addPass(outputPass);

// 8. Interactive Focus, Raycasting & Smooth Camera Glide State
const raycaster = new THREE.Raycaster();
const pointerNDC = new THREE.Vector2(99, 99);
let pointerActive = false;
let pointerOnArch = false;
let pointerOnSteps = false;

let activePresetBoost = { candle: 0.0, wind: 0.0 };
let manualOverride = { candle: null, wind: null };
let smoothCandleFocus = 0.0;
let smoothWindFocus = 0.0;

// Smooth camera transition animation
let camAnim = null;

function flyToPreset(name, instant = false) {
  const p = PRESETS[name] || PRESETS.default;
  activePresetBoost.candle = p.candleBoost;
  activePresetBoost.wind = p.windBoost;

  // Highlight active button in HUD if present
  document.querySelectorAll('[data-preset]').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.preset === name);
  });

  if (instant) {
    camAnim = null;
    camera.position.copy(p.pos);
    controls.target.copy(p.target);
    camera.fov = p.fov;
    camera.updateProjectionMatrix();
    controls.update();
    smoothCandleFocus = p.candleBoost;
    smoothWindFocus = p.windBoost;
    return;
  }

  camAnim = {
    startPos: camera.position.clone(),
    endPos: p.pos.clone(),
    startTarget: controls.target.clone(),
    endTarget: p.target.clone(),
    startFov: camera.fov,
    endFov: p.fov,
    elapsed: 0,
    duration: 1.35
  };
}

// Reveal sleek HUD controls on first human pointer/keyboard interaction (or ?ui=1)
const hudEl = document.getElementById('hud');
if (new URLSearchParams(window.location.search).get('ui') === '1') {
  hudEl?.classList.add('visible');
}

function updatePointerRay(clientX, clientY) {
  pointerNDC.x = (clientX / window.innerWidth) * 2 - 1;
  pointerNDC.y = -(clientY / window.innerHeight) * 2 + 1;
  pointerActive = true;

  raycaster.setFromCamera(pointerNDC, camera);
  const archHits = raycaster.intersectObject(chapel.archHitBox, false);
  pointerOnArch = archHits.length > 0;

  if (!pointerOnArch) {
    const stepHits = raycaster.intersectObject(courtyard.stepsHitBox, false);
    pointerOnSteps = stepHits.length > 0;
  } else {
    pointerOnSteps = false;
  }
}

window.addEventListener('pointermove', (e) => {
  hudEl?.classList.add('visible');
  updatePointerRay(e.clientX, e.clientY);
});

renderer.domElement.addEventListener('click', (e) => {
  updatePointerRay(e.clientX, e.clientY);
  if (pointerOnArch) {
    flyToPreset('archway', false);
  }
});

// Cancel preset camera glide if user manually drags OrbitControls
controls.addEventListener('start', () => {
  camAnim = null;
  activePresetBoost.candle = 0.0;
  activePresetBoost.wind = 0.0;
});

// Wire HUD preset buttons & sliders
document.querySelectorAll('[data-preset]').forEach((btn) => {
  btn.addEventListener('click', () => {
    manualOverride.candle = null;
    manualOverride.wind = null;
    flyToPreset(btn.dataset.preset, false);
  });
});

const candleSlider = document.getElementById('slider-candle');
const windSlider = document.getElementById('slider-wind');
candleSlider?.addEventListener('input', (e) => {
  manualOverride.candle = parseFloat(e.target.value);
});
windSlider?.addEventListener('input', (e) => {
  manualOverride.wind = parseFloat(e.target.value);
});

window.addEventListener('keydown', (e) => {
  hudEl?.classList.add('visible');
  if (e.key === '1') flyToPreset('default', false);
  if (e.key === '2') flyToPreset('archway', false);
  if (e.key === '3') flyToPreset('steps', false);
});

window.addEventListener('resize', () => {
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  composer.setSize(w, h);
  bloomPass.setSize(w, h);
});

// Compute dynamic camera proximity & gaze triggers every frame
const tmpForward = new THREE.Vector3();
const tmpToArch = new THREE.Vector3();
const tmpToSteps = new THREE.Vector3();

function computeTargetFocusLevels() {
  camera.getWorldDirection(tmpForward);

  // 1. Archway proximity & gaze focus -> Candle warm light spill
  const distToArch = camera.position.distanceTo(chapel.archWorldCenter);
  tmpToArch.subVectors(chapel.archWorldCenter, camera.position).normalize();
  const archAlign = tmpForward.dot(tmpToArch);

  // Ramp up smoothly when camera approaches closer than 7.3m while looking toward archway
  const proximityCandle =
    THREE.MathUtils.smoothstep(7.35, 4.35, distToArch) *
    THREE.MathUtils.smoothstep(0.72, 0.93, archAlign);

  let targetCandle = Math.max(
    activePresetBoost.candle,
    pointerOnArch ? 0.95 : 0.0,
    proximityCandle
  );
  if (manualOverride.candle !== null) targetCandle = manualOverride.candle;

  // 2. Near stone steps gaze / proximity -> Dry grass & distant tree wind sway
  const distToSteps = camera.position.distanceTo(courtyard.stepsWorldCenter);
  tmpToSteps.subVectors(courtyard.stepsWorldCenter, camera.position).normalize();
  const stepsAlign = tmpForward.dot(tmpToSteps);

  const proximityWind =
    THREE.MathUtils.smoothstep(6.8, 4.5, distToSteps) *
    THREE.MathUtils.smoothstep(0.75, 0.94, stepsAlign);
  const downwardGazeWind = THREE.MathUtils.smoothstep(-0.06, -0.18, tmpForward.y) * 0.85;

  let targetWind = Math.max(
    activePresetBoost.wind,
    pointerOnSteps ? 0.95 : 0.0,
    proximityWind,
    downwardGazeWind
  );
  if (manualOverride.wind !== null) targetWind = manualOverride.wind;

  return {
    targetCandle: THREE.MathUtils.clamp(targetCandle, 0, 1),
    targetWind: THREE.MathUtils.clamp(targetWind, 0, 1)
  };
}

// 9. Main Render & Animation Loop
let lastTime = performance.now() * 0.001;
let simTime = 0.0;

function tick(nowMs) {
  requestAnimationFrame(tick);

  const now = nowMs * 0.001;
  const dt = Math.min(Math.max(now - lastTime, 0.001), 0.1);
  lastTime = now;
  simTime += dt;

  // Handle smooth camera preset glide
  if (camAnim) {
    camAnim.elapsed += dt;
    const rawT = Math.min(camAnim.elapsed / camAnim.duration, 1.0);
    const ease = rawT < 0.5 ? 4 * rawT * rawT * rawT : 1 - Math.pow(-2 * rawT + 2, 3) / 2;
    camera.position.lerpVectors(camAnim.startPos, camAnim.endPos, ease);
    controls.target.lerpVectors(camAnim.startTarget, camAnim.endTarget, ease);
    camera.fov = THREE.MathUtils.lerp(camAnim.startFov, camAnim.endFov, ease);
    camera.updateProjectionMatrix();
    if (rawT >= 1.0) camAnim = null;
  }

  controls.update();

  const { targetCandle, targetWind } = computeTargetFocusLevels();
  const lerpRate = 1.0 - Math.exp(-dt * 3.6);
  smoothCandleFocus = THREE.MathUtils.lerp(smoothCandleFocus, targetCandle, lerpRate);
  smoothWindFocus = THREE.MathUtils.lerp(smoothWindFocus, targetWind, lerpRate);

  // Sync HUD sliders visually when driven automatically
  if (candleSlider && manualOverride.candle === null) {
    candleSlider.value = smoothCandleFocus.toFixed(2);
  }
  if (windSlider && manualOverride.wind === null) {
    windSlider.value = smoothWindFocus.toFixed(2);
  }

  // Update animated subsystems
  skyMesh.material.uniforms.uTime.value = simTime;
  lakeMat.uniforms.uTime.value = simTime;
  chapel.updateChapelLighting(simTime, smoothCandleFocus);
  vegetation.updateVegetation(simTime, smoothWindFocus);

  composer.render();
}

// Render initial deterministic frame immediately so load-time screenshots never see blank frame
chapel.updateChapelLighting(0.0, 0.0);
vegetation.updateVegetation(0.0, 0.0);
composer.render();
requestAnimationFrame(tick);

// 10. Expose Clean Inspection & Diagnostic API
window.chapelAPI = {
  setPreset(name, instant = true) {
    manualOverride.candle = null;
    manualOverride.wind = null;
    flyToPreset(name, instant);
    chapel.updateChapelLighting(simTime, smoothCandleFocus);
    vegetation.updateVegetation(simTime, smoothWindFocus);
    composer.render();
  },
  setCustomCamera(posArr, targetArr, fov = 38) {
    camAnim = null;
    camera.position.fromArray(posArr);
    controls.target.fromArray(targetArr);
    camera.fov = fov;
    camera.updateProjectionMatrix();
    controls.update();
    composer.render();
  },
  setFocusOverrides(candle, wind) {
    manualOverride.candle = candle;
    manualOverride.wind = wind;
    if (candle !== null) smoothCandleFocus = candle;
    if (wind !== null) smoothWindFocus = wind;
    chapel.updateChapelLighting(simTime, smoothCandleFocus);
    vegetation.updateVegetation(simTime, smoothWindFocus);
    composer.render();
  },
  advanceTime(seconds) {
    simTime += seconds;
    skyMesh.material.uniforms.uTime.value = simTime;
    lakeMat.uniforms.uTime.value = simTime;
    chapel.updateChapelLighting(simTime, smoothCandleFocus);
    vegetation.updateVegetation(simTime, smoothWindFocus);
    composer.render();
  },
  getState() {
    return {
      candleFocus: smoothCandleFocus,
      windFocus: smoothWindFocus,
      pointerOnArch,
      pointerOnSteps,
      camPos: camera.position.toArray(),
      camTarget: controls.target.toArray()
    };
  }
};
