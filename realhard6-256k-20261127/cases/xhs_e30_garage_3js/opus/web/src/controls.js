// Interaction: lift height, doors, camera presets, sun angle; GUI + keyboard + click-to-open doors
import * as THREE from 'three';
import GUI from 'three/addons/libs/lil-gui.module.min.js';

export function setupInteraction({ camera, controls, rig, lights, renderer, presets }) {
  const state = { liftHeight: 0, leftDoor: 0, rightDoor: 0, sunAzimuth: -0.62, sunElevation: 0.5, exposure: 1.0, view: 'Reference' };
  const target = { ...state };
  const gui = new GUI({ title: 'E30 Garage' });
  gui.add(target, 'liftHeight', 0, 1.6, 0.01).name('举升高度 Lift (m)');
  gui.add(target, 'leftDoor', 0, 1, 0.01).name('左车门 Left door');
  gui.add(target, 'rightDoor', 0, 1, 0.01).name('右车门 Right door');
  gui.add(state, 'sunAzimuth', -1.2, 0.6, 0.01).name('日光方位 Sun az').onChange(() => lights.setSun(state.sunAzimuth, state.sunElevation));
  gui.add(state, 'sunElevation', 0.2, 1.0, 0.01).name('日光高度 Sun el').onChange(() => lights.setSun(state.sunAzimuth, state.sunElevation));
  gui.add(state, 'exposure', 0.4, 2, 0.01).name('曝光 Exposure').onChange(v => renderer.toneMappingExposure = v);
  gui.add(state, 'view', Object.keys(presets)).name('机位 View').onChange(v => flyTo(presets[v]));
  if (new URLSearchParams(location.search).has('nogui')) gui.hide();

  let fly = null;
  function flyTo(p, instant = false) {
    const from = { pos: camera.position.clone(), tgt: controls.target.clone() };
    if (instant) { camera.position.set(...p.pos); controls.target.set(...p.tgt); controls.update(); return; }
    fly = { from, to: { pos: new THREE.Vector3(...p.pos), tgt: new THREE.Vector3(...p.tgt) }, t: 0 };
  }
  addEventListener('keydown', e => {
    if (e.key === 'ArrowUp') target.liftHeight = Math.min(1.6, target.liftHeight + 0.1);
    if (e.key === 'ArrowDown') target.liftHeight = Math.max(0, target.liftHeight - 0.1);
    if (e.key === 'd' || e.key === 'D') target.leftDoor = target.leftDoor > 0.5 ? 0 : 1;
    if (e.key === 'f' || e.key === 'F') target.rightDoor = target.rightDoor > 0.5 ? 0 : 1;
    const k = Object.keys(presets)[+e.key - 1]; if (k) flyTo(presets[k]);
    gui.controllersRecursive().forEach(c => c.updateDisplay());
  });
  // click a door to toggle it
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(); let down = null;
  renderer.domElement.addEventListener('pointerdown', e => down = [e.clientX, e.clientY]);
  renderer.domElement.addEventListener('pointerup', e => {
    if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 4) return;
    ndc.set(e.clientX / innerWidth * 2 - 1, -e.clientY / innerHeight * 2 + 1); ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObject(rig.car, true)[0]; const d = hit?.object.userData.doorRoot;
    if (d) { const key = d.userData.side > 0 ? 'rightDoor' : 'leftDoor'; target[key] = target[key] > 0.5 ? 0 : 1; gui.controllersRecursive().forEach(c => c.updateDisplay()); }
  });

  function update(dt) {
    const k = 1 - Math.exp(-dt * 3);
    state.liftHeight += (target.liftHeight - state.liftHeight) * k;
    state.leftDoor += (target.leftDoor - state.leftDoor) * k * 1.5;
    state.rightDoor += (target.rightDoor - state.rightDoor) * k * 1.5;
    rig.lift.userData.setHeight(state.liftHeight);
    rig.carRig.position.y = state.liftHeight;
    rig.doors.leftDoor.rotation.y = state.leftDoor * 1.15;   // swing outward (-Z side)
    rig.doors.rightDoor.rotation.y = -state.rightDoor * 1.15; // swing outward (+Z side)
    if (fly) {
      fly.t = Math.min(1, fly.t + dt / 1.6); const e = fly.t < 0.5 ? 2 * fly.t * fly.t : 1 - Math.pow(-2 * fly.t + 2, 2) / 2;
      camera.position.lerpVectors(fly.from.pos, fly.to.pos, e); controls.target.lerpVectors(fly.from.tgt, fly.to.tgt, e);
      if (fly.t >= 1) fly = null;
    }
  }
  function setInstant(o) { Object.assign(target, o); Object.assign(state, o); update(0); gui.controllersRecursive().forEach(c => c.updateDisplay()); }
  return { state, target, update, flyTo, setInstant, gui };
}
