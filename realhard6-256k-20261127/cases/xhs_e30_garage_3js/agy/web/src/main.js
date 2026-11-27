import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

import {
  createConcreteFloorTextures,
  createWallPlasterTexture,
  createOutdoorBackdropTexture,
  createBMWPosterTexture,
  createMichelinBannerTexture,
  createLiftDecals,
  createLicensePlateTexture,
  createAutomotiveDetailTextures,
} from './textures.js';
import { createWheelFactory } from './wheels.js';
import { createBMWE30 } from './carE30.js';
import { createTwoPostLift } from './lift.js';
import { createGarageEnvironment } from './garage.js';

// --- URL Query Flags (supports ?clean=1 if needed, though default UI is ultra-sleek) ---
const params = new URLSearchParams(window.location.search);
if (params.get('clean') === '1' || params.get('ui') === '0') {
  document.addEventListener('DOMContentLoaded', () => {
    const hud = document.getElementById('hud');
    if (hud) hud.style.display = 'none';
  });
}

const container = document.getElementById('canvas-container');

// --- WebGL Renderer ---
const renderer = new THREE.WebGLRenderer({
  antialias: true,
  powerPreference: 'high-performance',
  preserveDrawingBuffer: true,
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.06;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.shadowMap.autoUpdate = false;
renderer.shadowMap.needsUpdate = true;
container.appendChild(renderer.domElement);

// --- Scene & Default Reference Camera ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x22252a);

// Calibrated to match task/reference-0.png (1536x1024, 3:2 aspect)
const CAMERA_PRESETS = {
  default: {
    pos: new THREE.Vector3(5.86, 1.22, 3.12),
    target: new THREE.Vector3(0.56, 0.99, -1.50),
    fov: 42.6,
  },
  interior: {
    // Looking directly through the wide-open passenger doorway into the warm-lit E30 cockpit!
    pos: new THREE.Vector3(-0.26, 1.28, 1.72),
    target: new THREE.Vector3(0.24, 0.68, -0.14),
    fov: 48.0,
  },
  frontWheel: {
    pos: new THREE.Vector3(3.32, 0.70, 1.52),
    target: new THREE.Vector3(1.68, 0.50, 0.22),
    fov: 38.0,
  },
  undercarriage: {
    pos: new THREE.Vector3(3.55, 0.54, 2.08),
    target: new THREE.Vector3(0.16, 0.54, -0.10),
    fov: 42.0,
  },
};

const camera = new THREE.PerspectiveCamera(
  CAMERA_PRESETS.default.fov,
  window.innerWidth / window.innerHeight,
  0.1,
  45.0
);
camera.position.copy(CAMERA_PRESETS.default.pos);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.copy(CAMERA_PRESETS.default.target);
controls.enableDamping = true;
controls.dampingFactor = 0.065;
controls.minDistance = 1.15;
controls.maxDistance = 11.5;
controls.maxPolarAngle = Math.PI * 0.492; // prevent going beneath concrete floor
controls.update();

// --- Procedural Textures ---
const maxAniso = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);
const floorTextures = createConcreteFloorTextures(maxAniso);
const wallTex = createWallPlasterTexture(maxAniso);
const backdropTex = createOutdoorBackdropTexture();
const bmwPosterTex = createBMWPosterTexture(maxAniso);
const michelinTex = createMichelinBannerTexture(maxAniso);
const liftDecals = createLiftDecals();
const plateTex = createLicensePlateTexture(maxAniso);
const detailTextures = createAutomotiveDetailTextures(maxAniso);

// --- Build Scene Modules ---
const wheelFactory = createWheelFactory(detailTextures);

const garage = createGarageEnvironment({
  floorTextures,
  wallTex,
  backdropTex,
  bmwPosterTex,
  michelinTex,
  detailTextures,
  wheelFactory,
});
scene.add(garage.root);

const lift = createTwoPostLift({ liftDecals });
scene.add(lift.root);

const e30 = createBMWE30({
  wheelFactory,
  detailTextures,
  plateTex,
});
scene.add(e30.root);

// ============================================================================
// LIGHTING: RAKING WINDOW SUNLIGHT + SKY FILL + WARM PENDANT LAMP
// ============================================================================
// 1. Ambient hemisphere bounce (cool window sky top, warm concrete bounce bottom)
const hemiLight = new THREE.HemisphereLight(0xdce9f8, 0x665f56, 1.08);
scene.add(hemiLight);

// 2. Primary Raking Sunlight streaming obliquely through the tall multi-pane windows (Z = -3.85)
const sunLight = new THREE.DirectionalLight(0xfff1d6, 4.5);
sunLight.position.set(-7.0, 8.1, -11.2);
sunLight.target.position.set(1.40, 0.35, -0.30);
scene.add(sunLight);
scene.add(sunLight.target);

sunLight.castShadow = true;
sunLight.shadow.mapSize.set(2048, 2048);
sunLight.shadow.camera.near = 2.0;
sunLight.shadow.camera.far = 26.0;
sunLight.shadow.camera.left = -6.8;
sunLight.shadow.bias = -0.00035;
sunLight.shadow.normalBias = 0.018;
sunLight.shadow.camera.right = 6.8;
sunLight.shadow.camera.top = 5.6;
sunLight.shadow.camera.bottom = -4.6;
sunLight.shadow.radius = 3.2;

// 3. Broad Cool Daylight Sky Fill from the tall window wall & left sectional glazed door
const windowFill = new THREE.DirectionalLight(0xdceaff, 1.55);
windowFill.position.set(-2.2, 3.5, -6.2);
windowFill.target.position.set(1.2, 0.7, 0.6);
scene.add(windowFill, windowFill.target);

const bayDoorFill = new THREE.DirectionalLight(0xf2ece2, 0.85);
bayDoorFill.position.set(-8.5, 2.8, -0.5);
bayDoorFill.target.position.set(0.5, 0.7, 0.2);
scene.add(bayDoorFill, bayDoorFill.target);

// 4. Gentle Shop Interior Bounce Fill from camera/right-aisle side so E30 flank & BBS wheels gleam
const shopBounceFill = new THREE.DirectionalLight(0xe8ecf4, 0.92);
shopBounceFill.position.set(5.6, 2.2, 4.4);
shopBounceFill.target.position.set(0.4, 0.55, 0.0);
scene.add(shopBounceFill, shopBounceFill.target);

// 5. Overhead Dome Pendant Lamp warm local glow
const pendantPoint = new THREE.PointLight(0xffdfa8, 3.0, 8.5, 1.5);
pendantPoint.position.set(0.78, 2.80, -0.82);
scene.add(pendantPoint);

// ============================================================================
// BAKE REALISTIC GARAGE CUBEMAP -> PMREM FOR CAR CLEARCOAT & WHEEL REFLECTIONS!
// ============================================================================
function bakeGarageEnvMap() {
  const cubeRT = new THREE.WebGLCubeRenderTarget(256, {
    type: THREE.HalfFloatType,
    generateMipmaps: true,
    minFilter: THREE.LinearMipmapLinearFilter,
  });
  const cubeCam = new THREE.CubeCamera(0.25, 25.0, cubeRT);
  // Position right at the E30 hood/cabin height so clearcoat reflects actual garage windows!
  cubeCam.position.set(0.65, 1.02, 0.05);

  e30.root.visible = false;
  cubeCam.update(renderer, scene);
  e30.root.visible = true;

  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileCubemapShader();
  const envRT = pmrem.fromCubemap(cubeRT.texture);
  scene.environment = envRT.texture;

  cubeRT.dispose();
  pmrem.dispose();
}
bakeGarageEnvMap();

// ============================================================================
// INTERACTIVE STATE & SMOOTH ANIMATION LOOP
// ============================================================================
const state = {
  liftHeight: 0.0,
  targetLiftHeight: 0.0,
  rightDoorDeg: 0.0,
  targetRightDoorDeg: 0.0,
  leftDoorDeg: 0.0,
  targetLeftDoorDeg: 0.0,
  headlightsOn: false,
  camAnim: null,
};

function animateCameraTo(presetName, durationMs = 750) {
  const p = CAMERA_PRESETS[presetName];
  if (!p) return;

  // Hide ultra-close foreground cart/tire only when camera leaves default corner if needed?
  // Actually in 3D space, foreground props sit at (4.12, 0, 2.76), completely out of the way of all presets!
  state.camAnim = {
    startPos: camera.position.clone(),
    endPos: p.pos.clone(),
    startTarget: controls.target.clone(),
    endTarget: p.target.clone(),
    startFov: camera.fov,
    endFov: p.fov,
    startTime: performance.now(),
    duration: durationMs,
  };
}

// --- Bind UI Controls ---
const liftSlider = document.getElementById('lift-slider');
const liftVal = document.getElementById('lift-val');
const btnLiftToggle = document.getElementById('btn-lift-toggle');
const btnDoorToggle = document.getElementById('btn-door-toggle');
const btnLightsToggle = document.getElementById('btn-lights-toggle');
const presetButtons = document.querySelectorAll('[data-preset]');
const btnHideHud = document.getElementById('btn-toggle-hud');
const hudBody = document.getElementById('hud-body');

function syncUI() {
  if (liftSlider) liftSlider.value = state.targetLiftHeight.toFixed(2);
  if (liftVal) liftVal.textContent = `${state.targetLiftHeight.toFixed(2)}m`;
  if (btnLiftToggle) {
    btnLiftToggle.textContent = state.targetLiftHeight > 0.15 ? '降下举升机' : '升起举升机';
    btnLiftToggle.classList.toggle('active', state.targetLiftHeight > 0.15);
  }
  if (btnDoorToggle) {
    btnDoorToggle.textContent = state.targetRightDoorDeg > 10 ? '关闭车门' : '拉开车门';
    btnDoorToggle.classList.toggle('active', state.targetRightDoorDeg > 10);
  }
  if (btnLightsToggle) {
    btnLightsToggle.classList.toggle('active', state.headlightsOn);
  }
}

if (liftSlider) {
  liftSlider.addEventListener('input', (e) => {
    state.targetLiftHeight = parseFloat(e.target.value) || 0;
    syncUI();
  });
}

if (btnLiftToggle) {
  btnLiftToggle.addEventListener('click', () => {
    state.targetLiftHeight = state.targetLiftHeight > 0.15 ? 0.0 : 0.68;
    syncUI();
  });
}

if (btnDoorToggle) {
  btnDoorToggle.addEventListener('click', () => {
    state.targetRightDoorDeg = state.targetRightDoorDeg > 10 ? 0.0 : 52.0;
    syncUI();
  });
}

if (btnLightsToggle) {
  btnLightsToggle.addEventListener('click', () => {
    state.headlightsOn = !state.headlightsOn;
    e30.setHeadlights(state.headlightsOn);
    syncUI();
  });
}

presetButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    const preset = btn.getAttribute('data-preset');
    presetButtons.forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');

    // Helpful automatic staging when clicking inspection presets
    if (preset === 'interior' && state.targetRightDoorDeg < 25) {
      state.targetRightDoorDeg = 52.0;
    } else if (preset === 'undercarriage' && state.targetLiftHeight < 0.35) {
      state.targetLiftHeight = 0.78;
    } else if (preset === 'default') {
      state.targetLiftHeight = 0.0;
      state.targetRightDoorDeg = 0.0;
    }
    syncUI();
    animateCameraTo(preset);
  });
});

if (btnHideHud && hudBody) {
  btnHideHud.addEventListener('click', () => {
    const collapsed = hudBody.classList.toggle('collapsed');
    btnHideHud.textContent = collapsed ? '展开控制' : '收起';
  });
}

window.addEventListener('keydown', (e) => {
  if (e.key === 'h' || e.key === 'H') {
    const hud = document.getElementById('hud');
    if (hud) hud.style.display = hud.style.display === 'none' ? '' : 'none';
  }
});

// Cancel camera preset tween if user manually drags OrbitControls
controls.addEventListener('start', () => {
  state.camAnim = null;
});

// --- Resize Handler ---
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// --- Main Render Loop ---
let lastTime = performance.now();
let lastShadowLift = 0.0;
let lastShadowDoor = 0.0;

function tick(now) {
  requestAnimationFrame(tick);
  const dt = Math.min((now - lastTime) / 1000, 0.35);
  lastTime = now;

  // Smooth exponential damping for mechanical lift & door hinges
  const mechLerp = 1.0 - Math.exp(-9.0 * dt);
  let shadowDirty = false;

  if (Math.abs(state.liftHeight - state.targetLiftHeight) > 0.001) {
    state.liftHeight = THREE.MathUtils.lerp(state.liftHeight, state.targetLiftHeight, mechLerp);
    if (Math.abs(state.liftHeight - state.targetLiftHeight) <= 0.002) {
      state.liftHeight = state.targetLiftHeight;
      shadowDirty = true;
    }
    lift.setLiftHeight(state.liftHeight);
    e30.setLiftState(state.liftHeight);
    if (Math.abs(state.liftHeight - lastShadowLift) > 0.025) {
      lastShadowLift = state.liftHeight;
      shadowDirty = true;
    }
  }
  if (Math.abs(state.rightDoorDeg - state.targetRightDoorDeg) > 0.05) {
    state.rightDoorDeg = THREE.MathUtils.lerp(state.rightDoorDeg, state.targetRightDoorDeg, mechLerp);
    if (Math.abs(state.rightDoorDeg - state.targetRightDoorDeg) <= 0.15) {
      state.rightDoorDeg = state.targetRightDoorDeg;
      shadowDirty = true;
    }
    e30.setRightDoorAngle(state.rightDoorDeg);
    if (Math.abs(state.rightDoorDeg - lastShadowDoor) > 3.0) {
      lastShadowDoor = state.rightDoorDeg;
      shadowDirty = true;
    }
  }
  if (Math.abs(state.leftDoorDeg - state.targetLeftDoorDeg) > 0.05) {
    state.leftDoorDeg = THREE.MathUtils.lerp(state.leftDoorDeg, state.targetLeftDoorDeg, mechLerp);
    e30.setLeftDoorAngle(state.leftDoorDeg);
  }
  if (shadowDirty) {
    renderer.shadowMap.needsUpdate = true;
  }

  // Smooth camera preset transition
  if (state.camAnim) {
    const u = Math.min(1.0, (now - state.camAnim.startTime) / state.camAnim.duration);
    const ease = u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
    camera.position.lerpVectors(state.camAnim.startPos, state.camAnim.endPos, ease);
    controls.target.lerpVectors(state.camAnim.startTarget, state.camAnim.endTarget, ease);
    camera.fov = THREE.MathUtils.lerp(state.camAnim.startFov, state.camAnim.endFov, ease);
    camera.updateProjectionMatrix();
    if (u >= 1.0) state.camAnim = null;
  }

  controls.update();
  renderer.render(scene, camera);
}

syncUI();
requestAnimationFrame(tick);

// --- Programmatic Inspection & Testing API ---
window.garageApp = {
  scene,
  camera,
  controls,
  renderer,
  state,
  PRESETS: CAMERA_PRESETS,
  setImmediateState({ liftHeight, rightDoorDeg, leftDoorDeg, headlightsOn, preset } = {}) {
    state.camAnim = null;
    if (typeof liftHeight === 'number') {
      state.liftHeight = state.targetLiftHeight = liftHeight;
      lift.setLiftHeight(liftHeight);
      e30.setLiftState(liftHeight);
    }
    if (typeof rightDoorDeg === 'number') {
      state.rightDoorDeg = state.targetRightDoorDeg = rightDoorDeg;
      e30.setRightDoorAngle(rightDoorDeg);
    }
    if (typeof leftDoorDeg === 'number') {
      state.leftDoorDeg = state.targetLeftDoorDeg = leftDoorDeg;
      e30.setLeftDoorAngle(leftDoorDeg);
    }
    if (typeof headlightsOn === 'boolean') {
      state.headlightsOn = headlightsOn;
      e30.setHeadlights(headlightsOn);
    }
    if (preset && CAMERA_PRESETS[preset]) {
      const p = CAMERA_PRESETS[preset];
      camera.position.copy(p.pos);
      controls.target.copy(p.target);
      camera.fov = p.fov;
      camera.updateProjectionMatrix();
      controls.update();
    }
    syncUI();
    renderer.shadowMap.needsUpdate = true;
    renderer.render(scene, camera);
  },
  setCustomCamera(posArr, targetArr, fov = 40.5) {
    state.camAnim = null;
    camera.position.set(...posArr);
    controls.target.set(...targetArr);
    camera.fov = fov;
    camera.updateProjectionMatrix();
    controls.update();
    renderer.render(scene, camera);
  },
};
