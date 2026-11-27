import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { createSky, createLights, SUN_DIR } from './sky.js';
import { createTerrain, terraceHeight } from './terrain.js';
import { createChapel } from './chapel.js';
import { createSteps, createPier, createParapet } from './steps.js';
import { createInterior } from './interior.js';
import { createGrass, grassPlaces } from './grass.js';
import { createTrees } from './trees.js';
import { createInteraction } from './interaction.js';
import { GradeShader } from './grade.js';
import { setupGUI } from './gui.js';

const T0 = performance.now();
const qs = new URLSearchParams(location.search);
if (qs.has('capture')) document.body.classList.add('capture');

// ---- reference-matched camera (3:2 framing like the reference photo) ----
const camQ = qs.get('cam')?.split(',').map(Number);
export const REF_CAM = camQ ? { pos: new THREE.Vector3(camQ[0], camQ[1], camQ[2]), target: new THREE.Vector3(camQ[3], camQ[4], camQ[5]), fov: camQ[6] }
  : { pos: new THREE.Vector3(-5.35, 1.94, 9.88), target: new THREE.Vector3(-4.154, 2.219, -2.056), fov: 50 };
const camera = new THREE.PerspectiveCamera(REF_CAM.fov, innerWidth / innerHeight, 0.1, 9000);
camera.position.copy(REF_CAM.pos); camera.lookAt(REF_CAM.target);
// place the sun where it sits in the reference frame (x 9%, y 38% from top), using a 3:2 reference camera
{
  const c = new THREE.PerspectiveCamera(REF_CAM.fov, 1.5, 0.1, 100); c.position.copy(REF_CAM.pos); c.lookAt(REF_CAM.target); c.updateMatrixWorld();
  const p = new THREE.Vector3(0.23 * 2 - 1, -(0.39 * 2 - 1), 0.5).unproject(c).sub(c.position).normalize();
  SUN_DIR.copy(p);
}

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0xc77a5c, 0.0011);
const sky = createSky(); scene.add(sky.mesh);
const lights = createLights(scene);
// environment from the sky shader for reflections (water) and soft ambient
{
  const pm = new THREE.PMREMGenerator(renderer), es = new THREE.Scene();
  const m = sky.mesh.clone(); m.material = sky.mesh.material.clone(); m.material.uniforms = sky.uniforms; es.add(m);
  scene.environment = pm.fromScene(es, 0, 0.1, 5000).texture; scene.environmentIntensity = 0.35;
}
const terrain = createTerrain(scene);
const chapel = createChapel(scene);
const steps = createSteps(scene);
createPier(scene); createParapet(scene);
const interior = createInterior(scene);
const grass = createGrass(scene, grassPlaces(steps.tops, terraceHeight));
const trees = createTrees(scene, [
  { x: -14.5, y: terraceHeight(-14.5, -6), z: -6, h: 8.5, seed: 3, lean: 0.25, depth: 4 },
  { x: -5.2, y: 0, z: -4.8, h: 8.8, seed: 8, lean: -0.1, depth: 4 },
  { x: -9.5, y: terraceHeight(-9.5, -9), z: -9, h: 4.5, seed: 14, lean: 0.4, depth: 3 },
  { x: -22, y: terraceHeight(-22, -18), z: -18, h: 6, seed: 22, lean: 0.1, depth: 3 },
  { x: -40, y: terraceHeight(-40, -60), z: -60, h: 9, seed: 31, lean: 0.2, depth: 3 },
  { x: -12, y: terraceHeight(-12, -24), z: -24, h: 6, seed: 40, lean: -0.2, depth: 3 },
]);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.copy(REF_CAM.target); controls.enableDamping = true; controls.dampingFactor = 0.06;
controls.minDistance = 1.5; controls.maxDistance = 60; controls.maxPolarAngle = Math.PI * 0.53;
controls.update();

const params = { candleBase: 1.2, candlePeak: 9, spillPeak: 20, windBase: 0.12, windPeak: 0.55, treeBase: 0.2, treePeak: 1.0, exposure: 1.0, bloom: 0.55 };
const interaction = createInteraction({ camera, controls, interior, params });

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), params.bloom, 0.6, 0.88); composer.addPass(bloom);
const grade = new ShaderPass(GradeShader); composer.addPass(grade);
composer.addPass(new OutputPass());

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight);
});
addEventListener('keydown', e => { if (e.key === 'c' || e.key === 'C') resetCam(); });
function resetCam() { camera.position.copy(REF_CAM.pos); controls.target.copy(REF_CAM.target); controls.update(); }

const clock = new THREE.Clock(); let frames = 0, simT = qs.has('t') ? parseFloat(qs.get('t')) : 0;
function frame() {
  const dt = Math.min(clock.getDelta(), 0.1); simT += dt;
  controls.update();
  interaction.update(dt, simT);
  sky.uniforms.uTime.value = simT;
  renderer.toneMappingExposure = params.exposure; bloom.strength = params.bloom;
  composer.render(); frames++;
  requestAnimationFrame(frame);
}
frame();
if (!qs.has('capture')) setupGUI(params, { lights, sky, scene, interaction, resetCam });

// diagnostics/test hooks for headless capture
window.__scene = { THREE, scene, camera, controls, renderer, interaction, params, REF_CAM,
  setView(p, t) { camera.position.set(...p); controls.target.set(...t); controls.update(); },
  proj() { const o = {}; const pts = { doorSill: [0, 2.25, -0.5], doorApex: [0, 7.15, -0.3], facadeLeftSill: [-4.1, 2.25, 0], step0: [-2, 0.28, 7.6] };
    for (const k in pts) { const v = new THREE.Vector3(...pts[k]).project(camera); o[k] = [+((v.x + 1) / 2).toFixed(3), +((1 - v.y) / 2).toFixed(3)]; } return o; },
  diag() { const i = renderer.info; return { frames, loadMs: Math.round(performance.now() - T0), drawCalls: i.render.calls, triangles: i.render.triangles,
    geometries: i.memory.geometries, textures: i.memory.textures, doorFocus: +interaction.st.door.toFixed(3), stepFocus: +interaction.st.step.toFixed(3),
    candleIntensity: +interior.candle.intensity.toFixed(2), spill: +interior.spill.intensity.toFixed(2), gl: renderer.getContext().getParameter(renderer.getContext().VERSION) }; } };
window.__ready = true;
