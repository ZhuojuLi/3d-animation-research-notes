import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { createMaterials } from './materials.js';
import { buildArchitecture } from './architecture.js';
import { buildLandscape } from './landscape.js';
import { buildVegetation } from './vegetation.js';
import { buildAtmosphere } from './atmosphere.js';

const params = new URLSearchParams(location.search);
const state = { view: 'courtyard', hover: 'none', focus: 0, wind: .35, transition: false, clean: false, phase: 'building', autoFocus: null, frames: 0, fps: 0 };
const scene = new THREE.Scene(); scene.name = '山间晚祷 — 废弃教堂前庭'; scene.background = new THREE.Color(0x5f4845);
const camera = new THREE.PerspectiveCamera(48, innerWidth / innerHeight, .08, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', alpha: false });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5)); renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = .91;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.info.autoReset = false;
renderer.domElement.setAttribute('aria-label', '可自由环视的落日山间教堂三维场景'); renderer.domElement.tabIndex = 0;
document.body.prepend(renderer.domElement);
const controls = new OrbitControls(camera, renderer.domElement); controls.enableDamping = true; controls.dampingFactor = .07; controls.rotateSpeed = .43; controls.panSpeed = .55; controls.zoomSpeed = .67;
controls.minDistance = 1.45; controls.maxDistance = 78; controls.maxPolarAngle = Math.PI * .57; controls.minPolarAngle = .18; controls.screenSpacePanning = true;
const views = {
  courtyard: { position: [-5.4, 3.15, 12.7], target: [-2.50, 2.70, -5.70], fov: 48 },
  portal: { position: [3.3, 4.25, -1.5], target: [4.2, 4.90, -12.0], fov: 54 },
  grass: { position: [-4.40, 1.5, 8.25], target: [1.4, 1.22, 1.6], fov: 51 },
  interior: { position: [4.20, 4.13, -7.65], target: [4.2, 4.6, -17.0], fov: 58 },
  reverse: { position: [-19, 11, -24], target: [3, 3, -1], fov: 49 },
  detail: { position: [-.65, 4.2, -.8], target: [2.1, 4.0, -6], fov: 51 }
};
function setCameraView(v) { camera.position.fromArray(v.position); camera.fov = v.fov; controls.target.fromArray(v.target); camera.updateProjectionMatrix(); controls.update(); }
setCameraView(views.courtyard);
if (innerWidth / innerHeight < 1) { camera.position.x -= 3; camera.position.z += 4; camera.setFocalLength(29); }
// Small deterministic initial construction sequence keeps the loading veil responsive.
await new Promise(resolve => requestAnimationFrame(resolve));
const materials = createMaterials();
const architecture = buildArchitecture(scene, materials);
const landscape = buildLandscape(scene, materials, architecture);
const vegetation = buildVegetation(scene, materials, architecture);
const atmosphere = buildAtmosphere(scene, camera);
// Gentle screen-space contact shadows separate every chipped tread and wall joint.
const composer = new EffectComposer(renderer); composer.addPass(new RenderPass(scene, camera));
const ao = new GTAOPass(scene, camera, innerWidth, innerHeight);
ao.blendIntensity = .72;
ao.updateGtaoMaterial({ radius: .42, distanceExponent: 2.0, thickness: 1.25, distanceFallOff: .65, scale: 1.0, samples: 8 });
ao.updatePdMaterial({ lumaPhi: 8, depthPhi: 3.5, normalPhi: 3.2, radius: 4, samples: 8 });
composer.addPass(ao);
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), .23, .55, 1.12); composer.addPass(bloom);
const finish = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 } },
  vertexShader: 'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uTime; varying vec2 vUv;
    float rand(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
    void main(){vec3 c=texture2D(tDiffuse,vUv).rgb;
      float vig=smoothstep(.18,.77,length((vUv-.5)*vec2(1.05,.82))); c*=1.-vig*.25;
      c+=vec3(.010,.002,-.003)*vig;
      float grain=(rand(vUv*vec2(1536.,1024.)+floor(uTime*12.))-.5)*.003;
      gl_FragColor=vec4(c+grain,1.);
    }`
}); composer.addPass(finish); composer.addPass(new OutputPass());

let destination = views.courtyard, targetPosition = new THREE.Vector3(), targetLook = new THREE.Vector3(), transitionStarted = 0;
let viewFocusOverride = null, viewFocusUntil = 0;
function setView(name, immediate = false) {
  if (!views[name]) name = 'courtyard';
  state.view = name; destination = views[name]; state.transition = !immediate; transitionStarted = performance.now();
  targetPosition.fromArray(destination.position); targetLook.fromArray(destination.target);
  if (immediate) { setCameraView(destination); state.focus = name === 'portal' || name === 'interior' ? .92 : 0; state.wind = name === 'grass' ? 1.3 : .35; }
  if (name === 'portal' || name === 'interior') { viewFocusOverride = 'portal'; viewFocusUntil = performance.now() + 20000; }
  else if (name === 'grass') { viewFocusOverride = 'grass'; viewFocusUntil = performance.now() + 16000; }
  else { viewFocusOverride = null; viewFocusUntil = 0; }
  if (name === 'courtyard') atmosphere.sunlight.target.updateMatrixWorld();
  document.querySelectorAll('[data-view]').forEach(b => b.classList.toggle('active', b.dataset.view === name));
  document.getElementById('state-label').textContent = name === 'portal' || name === 'interior' ? '烛火回应你的凝视' : name === 'grass' ? '风穿过枯草与疏枝' : '余晖停在石阶上';
}
document.querySelectorAll('[data-view]').forEach(b => b.addEventListener('click', () => setView(b.dataset.view)));
controls.addEventListener('start', () => { state.transition = false; viewFocusOverride = null; });
const raycaster = new THREE.Raycaster(), pointer = new THREE.Vector2(2, 2), forward = new THREE.Vector3(), doorVector = new THREE.Vector3(), stairVector = new THREE.Vector3();
const stairFocusPoint = new THREE.Vector3(-.4, 1.25, 4.4);
let hoverPortal = false, hoverGrass = false, pinnedPortalUntil = 0, pinnedGrassUntil = 0;
function updatePointer(e) {
  pointer.set(e.clientX / innerWidth * 2 - 1, -e.clientY / innerHeight * 2 + 1);
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObject(architecture.group, true);
  hoverPortal = false; hoverGrass = false;
  if (hits.length) {
    let obj = hits[0].object; let belongsToStairs = false;
    while (obj) { if (obj.name === '风化石阶') belongsToStairs = true; obj = obj.parent; }
    const holeDistance = Math.hypot(hits[0].point.x - 4.2, hits[0].point.y - 5.2);
    if (belongsToStairs && hits[0].point.z > -3) hoverGrass = true;
    else if (holeDistance < 5.0 || hits[0].point.z < -5.8) hoverPortal = true;
  }
}
renderer.domElement.addEventListener('pointermove', e => updatePointer(e));
renderer.domElement.addEventListener('pointerleave', () => { hoverGrass = hoverPortal = false; });
renderer.domElement.addEventListener('click', e => { updatePointer(e); const now = performance.now(); if (hoverPortal) pinnedPortalUntil = now + 13000; if (hoverGrass) pinnedGrassUntil = now + 10000; });
function cleanToggle() { state.clean = !state.clean; document.body.classList.toggle('clean', state.clean); }
document.getElementById('clean').addEventListener('click', cleanToggle);
document.getElementById('save').addEventListener('click', () => { composer.render(); renderer.domElement.toBlob(blob => { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `vesper-${state.view}.png`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 3000); }, 'image/png'); });
window.addEventListener('keydown', e => { if (e.key.toLowerCase() === 'h') cleanToggle(); if (e.key.toLowerCase() === 'r') setView('courtyard'); if (e.key === '1') setView('courtyard'); if (e.key === '2') setView('portal'); if (e.key === '3') setView('grass'); });
window.addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight); });

const clock = new THREE.Clock(); let startup = performance.now(), fpsWindow = startup, fpsFrames = 0;
const diagnostics = { title: '山间晚祷 / Vesper at the Forgotten Chapel', version: '1.0', three: THREE.REVISION, renderer: 'WebGL / real geometry', reference: { image: 'task/reference-0.png', aspect: '3:2', output: '1536 x 1024', composition: 'right foreground chapel wall, deep pointed portal, rising worn stairs, left sunset valley' }, features: ['OrbitControls', 'real extruded Gothic arch', 'procedural PBR masonry, soil, bark and old wood', 'deep nave with pews and candles', 'focus-responsive candlelight', 'wind-animated dry grass and sparse branches', 'layered mountains and animated water', 'GTAO, bloom and restrained film finishing'], state, errors: [], fps: 0, camera: {}, gpu: {}, meshes: {}, interactions: { courtyard: 'drag / scroll / click masonry', portal: 'approach, look at or click portal: gradual candlelight', grass: 'look near or click steps: stronger wind', keys: '1,2,3 views · H clean view · R reset · PNG button' } };
const gl = renderer.getContext(); const ext = gl.getExtension('WEBGL_debug_renderer_info'); if (ext) diagnostics.gpu = { vendor: gl.getParameter(ext.UNMASKED_VENDOR_WEBGL), renderer: gl.getParameter(ext.UNMASKED_RENDERER_WEBGL), webgl: gl.getParameter(gl.VERSION) };
function updateDiagnostics() {
  diagnostics.meshes = { geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures, composerCalls: renderer.info.render.calls, composerTriangles: renderer.info.render.triangles, points: renderer.info.render.points, grassBlades: vegetation.grass.count, facadeInstances: architecture.facade.count, sideCourseInstances: architecture.sideCourseCount, treeLeafInstances: vegetation.trees.reduce((sum, tree) => sum + (tree.children.find(child => child.isInstancedMesh)?.count || 0), 0), roofForm: architecture.roofForm };
  diagnostics.fps = state.fps; diagnostics.camera = { position: camera.position.toArray().map(n => +n.toFixed(3)), target: controls.target.toArray().map(n => +n.toFixed(3)), fov: camera.fov, aspect: camera.aspect, state: state.view, candleFocus: +state.focus.toFixed(3), wind: +state.wind.toFixed(3) };
  diagnostics.interactionState = { portalFocus: state.focus, wind: state.wind, windTarget: state.windTarget, stairLook: state.stairLook, stairNearness: state.stairNearness, doorLook: state.doorLook, hoverPortal, hoverGrass, pinnedPortal: state.portalPinned, pinnedGrass: state.grassPinned, windUniform: vegetation.uniforms.wind.value, candleIntensities: architecture.candleLights.map(light => light.intensity), spillIntensity: architecture.spill.intensity, interiorFillIntensity: architecture.interiorFill.intensity };
  diagnostics.clean = { enabled: state.clean, bodyClass: document.body.className, canvasWidth: renderer.domElement.width, canvasHeight: renderer.domElement.height };
}
window.__CHAPEL__ = {
  scene, camera, renderer, controls, architecture, landscape, vegetation,
  atmosphere, state, diagnostics, setView, views, materials,
  setClean(value) {
    state.clean = Boolean(value);
    document.body.classList.toggle('clean', state.clean);
  },
  samplePixelInteraction(x, y) {
    updatePointer({ clientX: x, clientY: y });
    return { portal: hoverPortal, grass: hoverGrass };
  },
  pinInteraction(kind, seconds = 10) {
    const until = performance.now() + seconds * 1000;
    if (kind === 'portal') pinnedPortalUntil = until;
    if (kind === 'grass') pinnedGrassUntil = until;
  },
  interactionState() {
    updateDiagnostics();
    return {
      ...diagnostics.interactionState,
      bodyClasses: document.body.className,
      treeRotations: vegetation.trees.map(tree => tree.rotation.toArray().slice(0, 3))
    };
  },
  capture() {
    renderer.info.reset();
    composer.render();
    updateDiagnostics();
    return renderer.domElement.toDataURL('image/png');
  }
};
let firstFrames = 0;
function animate() {
  requestAnimationFrame(animate);
  const delta = Math.min(.35, clock.getDelta()), t = clock.elapsedTime, now = performance.now();
  if (state.transition) {
    const a = 1 - Math.exp(-delta * 2.05); camera.position.lerp(targetPosition, a); controls.target.lerp(targetLook, a);
    camera.fov = THREE.MathUtils.lerp(camera.fov, destination.fov, a); camera.updateProjectionMatrix();
    if (camera.position.distanceTo(targetPosition) < .018 && now - transitionStarted > 500) state.transition = false;
  }
  controls.update();
  camera.getWorldDirection(forward); doorVector.copy(architecture.door).sub(camera.position); const nearDoor = doorVector.length(); doorVector.normalize();
  const doorLooking = THREE.MathUtils.clamp((forward.dot(doorVector) - .89) / .095, 0, 1);
  stairVector.copy(stairFocusPoint).sub(camera.position); const nearStairs = stairVector.length(); stairVector.normalize();
  const stairLooking = THREE.MathUtils.clamp((forward.dot(stairVector) - .94) / .055, 0, 1);
  const stairProximity = THREE.MathUtils.clamp(1 - (nearStairs - 2) / 12, 0, 1);
  const proximity = THREE.MathUtils.clamp(1 - (nearDoor - 4.8) / 9, 0, 1);
  const pinnedPortal = now < pinnedPortalUntil, pinnedGrass = now < pinnedGrassUntil;
  const viewPortal = now < viewFocusUntil && viewFocusOverride === 'portal', viewGrass = now < viewFocusUntil && viewFocusOverride === 'grass';
  const focusTarget = Math.max(proximity, doorLooking * .83, hoverPortal ? 1 : 0, pinnedPortal || viewPortal ? 1 : 0);
  const focusRate = focusTarget > state.focus ? .70 : .37; state.focus = THREE.MathUtils.lerp(state.focus, focusTarget, 1 - Math.exp(-delta * focusRate));
  const windTarget = Math.max(.28, stairLooking * 1.22, stairProximity * .70, hoverGrass ? 1.40 : 0, pinnedGrass || viewGrass ? 1.35 : 0, nearDoor > 28 ? .50 : 0);
  state.portalPinned = pinnedPortal; state.grassPinned = pinnedGrass;
  state.stairLook = stairLooking; state.stairNearness = stairProximity; state.doorLook = doorLooking; state.windTarget = windTarget;
  state.wind = THREE.MathUtils.lerp(state.wind, windTarget, 1 - Math.exp(-delta * .68));
  vegetation.update(t, state.wind);
  atmosphere.skyMaterial.uniforms.uTime.value = t; atmosphere.dustMat.uniforms.uTime.value = t; landscape.lakeMat.uniforms.uTime.value = t;
  architecture.flames.forEach((flame, i) => {
    flame.quaternion.copy(camera.quaternion); flame.material.uniforms.uTime.value = t + i * 3.18; flame.material.uniforms.uPower.value = .30 + state.focus * .70;
    const flicker = .95 + Math.sin(t * 8.7 + i * 2.7) * .036 + Math.sin(t * 15.2 + i) * .023;
    flame.scale.set(flicker, .88 + state.focus * .22 + Math.sin(t * 7 + i) * .07, 1);
  });
  architecture.candleLights.forEach((light, i) => { const flicker = 1 + Math.sin(t * 9.5 + i * 2.8) * .075 + Math.sin(t * 15.4 + i) * .043; light.intensity = (1.4 + state.focus * 7.5) * flicker; });
  architecture.interiorFill.intensity = .60 + state.focus * 4.0 + Math.sin(t * 4.7) * (.035 + state.focus * .055);
  architecture.spill.intensity = 4.0 + state.focus ** 1.45 * 22 + Math.sin(t * 7.1) * (.12 + state.focus * .26);
  architecture.spill.color.setHSL(.073 - state.focus * .008, .77, .61);
  state.autoFocus = viewPortal || hoverPortal || pinnedPortal ? 'portal' : viewGrass || hoverGrass || pinnedGrass ? 'grass' : 'none';
  document.body.classList.toggle('portal-focus', state.focus > .68);
  if (state.frames % 35 === 0 && state.view !== 'grass') document.getElementById('state-label').textContent = state.focus > .68 ? '烛火回应你的凝视' : '余晖停在石阶上';
  finish.uniforms.uTime.value = t; renderer.info.reset(); composer.render(delta); state.frames++;
  fpsFrames++;
  if (now - fpsWindow > 1600) { state.fps = Math.round(fpsFrames * 1000 / (now - fpsWindow)); fpsWindow = now; fpsFrames = 0; updateDiagnostics(); }
  if (++firstFrames === 3) {
    state.phase = 'ready'; updateDiagnostics(); document.getElementById('loading').classList.add('gone');
    window.__CHAPEL_READY__ = true; console.log('CHAPEL_READY', JSON.stringify(diagnostics));
  }
}
const requested = params.get('view'); if (requested && views[requested]) setView(requested, true);
if (params.get('clean') === '1') window.__CHAPEL__.setClean(true);
animate();
window.addEventListener('error', e => diagnostics.errors.push(String(e.message || e)));
