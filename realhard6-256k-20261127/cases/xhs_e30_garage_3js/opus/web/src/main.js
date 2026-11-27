// Entry: renderer, camera, controls, render loop, diagnostics
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { makeRenderer, setupLights, makeComposer } from './lighting.js';
import { buildScene } from './scene.js';
import { setupInteraction } from './controls.js';

const t0 = performance.now();
const renderer = makeRenderer(document.getElementById('app'));
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.05, 80);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; controls.dampingFactor = 0.08; controls.maxPolarAngle = Math.PI * 0.53;
controls.minDistance = 0.4; controls.maxDistance = 18;

const lights = setupLights(scene, renderer);
const rig = buildScene(scene);
const { composer, bloom } = makeComposer(renderer, scene, camera);

export const PRESETS = {
  'Reference': { pos: [1.0, 1.25, 5.8], tgt: [0.35, 1.12, 1.0] },
  'Front close-up 前脸': { pos: [-1.6, 0.95, 3.6], tgt: [-2.5, 0.65, 2.05] },
  'Wheel close-up 轮毂': { pos: [-0.5, 0.55, 3.0], tgt: [-1.05, 0.33, 2.15] },
  'Door / interior 内饰': { pos: [0.9, 1.45, 3.0], tgt: [-1.0, 0.85, 1.3] },
  'Under lift 底盘': { pos: [2.4, 0.5, 4.2], tgt: [-1.2, 1.1, 0.6] },
  'Workshop wide 全景': { pos: [7.0, 3.2, 7.5], tgt: [0, 1.2, -0.5] },
};
const ui = setupInteraction({ camera, controls, rig, lights, renderer, presets: PRESETS });
ui.flyTo(PRESETS.Reference, true);

// URL params for scripted inspection: ?lift=1.2&door=1&view=2
const q = new URLSearchParams(location.search);
const init = {};
if (q.has('lift')) init.liftHeight = +q.get('lift');
if (q.has('door')) init.leftDoor = +q.get('door');
if (q.has('rdoor')) init.rightDoor = +q.get('rdoor');
ui.setInstant(init);
if (q.has('view')) ui.flyTo(Object.values(PRESETS)[+q.get('view')], true);
if (q.has('cam')) { const c = q.get('cam').split(',').map(Number); camera.position.set(c[0], c[1], c[2]); controls.target.set(c[3], c[4], c[5]); controls.update(); }

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight);
});

const clock = new THREE.Clock(); let frames = 0;
function loop() {
  const dt = Math.min(clock.getDelta(), 0.05);
  ui.update(dt); controls.update(); composer.render(); frames++;
  if (frames === 3) report();
  requestAnimationFrame(loop);
}
loop();

function report() {
  let meshes = 0, tris = 0;
  scene.traverse(o => { if (o.isMesh) { meshes++; const g = o.geometry; tris += (g.index ? g.index.count : g.attributes.position.count) / 3; } });
  const gl = renderer.getContext(); const dbg = gl.getExtension('WEBGL_debug_renderer_info');
  window.__diag = { ok: true, webgl2: renderer.capabilities.isWebGL2, gpu: dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : 'n/a',
    meshes, triangles: Math.round(tris), drawCalls: renderer.info.render.calls, textures: renderer.info.memory.textures,
    initMs: Math.round(performance.now() - t0), camera: camera.position.toArray(), target: controls.target.toArray(), state: { ...ui.state } };
  console.log('DIAG', JSON.stringify(window.__diag));
  document.body.dataset.ready = '1';
}
window.__app = { scene, camera, controls, renderer, rig, ui, lights, PRESETS, bloom };
