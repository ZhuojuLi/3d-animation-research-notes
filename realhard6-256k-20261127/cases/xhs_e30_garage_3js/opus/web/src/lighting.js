// Renderer, environment, sun + window area lights, volumetric beams, post-processing
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { beamTex } from './textures.js';
import { ROOM } from './garage.js';

export function makeRenderer(canvasParent) {
  const r = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  r.setPixelRatio(Math.min(devicePixelRatio, 2));
  r.setSize(innerWidth, innerHeight);
  r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.0;
  r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
  canvasParent.appendChild(r.domElement);
  return r;
}

export function setupLights(scene, renderer) {
  RectAreaLightUniformsLib.init();
  const pm = new THREE.PMREMGenerator(renderer);
  const env = pm.fromScene(new RoomEnvironment(), 0.03).texture;
  scene.environment = env; scene.environmentIntensity = 0.3;
  scene.background = new THREE.Color(0x1a1c20);

  const hemi = new THREE.HemisphereLight(0xdfe8f2, 0x5a5048, 0.25); scene.add(hemi);
  // low-angle afternoon sun through back windows
  const sun = new THREE.DirectionalLight(0xffe2b8, 5.5);
  sun.castShadow = true; sun.shadow.mapSize.set(4096, 4096);
  const sc = sun.shadow.camera; sc.left = -13; sc.right = 13; sc.top = 11; sc.bottom = -11; sc.near = 1; sc.far = 50;
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03; sun.shadow.radius = 3;
  scene.add(sun); scene.add(sun.target);
  // window glow area lights (sky fill, facing into room)
  const rects = [];
  [[-5.4, 3.5, 4.0, 3.8], [-0.2, 3.5, 3.4, 4.2], [6.45, 4.4, 4.3, 2.4]].forEach(([x, y, w, h]) => {
    const R = new THREE.RectAreaLight(0xe6eef8, 2.2, w, h);
    R.position.set(x, y, ROOM.z0 + 0.05); R.lookAt(x, y - 0.6, 5); scene.add(R); rects.push(R);
  });
  // a little front fill so the nose isn't black (open roller door behind camera)
  const fill = new THREE.RectAreaLight(0xf2efe8, 1.6, 8, 3.5); fill.position.set(0, 2.5, ROOM.z1 - 0.2); fill.lookAt(0, 1, 0); scene.add(fill);
  // dusty light shafts (additive planes aligned with the sun)
  const beams = new THREE.Group(); scene.add(beams);
  const bmat = new THREE.MeshBasicMaterial({ map: beamTex(), transparent: true, opacity: 0.035, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const setSun = (az, el) => {
    const d = new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el));
    sun.target.position.set(1.5, 0, 2.5); sun.position.copy(sun.target.position).addScaledVector(d, 25);
    beams.clear();
    [[-5.4, 4.0, 2.4], [-0.2, 3.4, 2.4], [6.45, 4.3, 1.4]].forEach(([x, w, hh]) => {
      for (let k = 0; k < 3; k++) {
        const len = 9; const m = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.9, len), bmat);
        const top = new THREE.Vector3(x + (k - 1) * w * 0.05, 3.2 + k * 0.7, ROOM.z0);
        m.position.copy(top).addScaledVector(d, -len / 2);
        const zA = new THREE.Vector3(0, 0, 1).addScaledVector(d, -d.z).normalize();
        const xA = new THREE.Vector3().crossVectors(d, zA);
        m.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(xA, d, zA));
        beams.add(m);
      }
    });
  };
  setSun(-0.62, 0.50);
  return { sun, hemi, rects, beams, setSun, env };
}

export function makeComposer(renderer, scene, camera) {
  const c = new EffectComposer(renderer);
  c.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.22, 0.6, 0.92);
  c.addPass(bloom); c.addPass(new OutputPass());
  return { composer: c, bloom };
}
