// Blue two-post lift. Built in car-aligned local frame. setHeight(h) raises carriages, arms & car.
import * as THREE from 'three';
import { M } from './materials.js';
import { mesh, box, cyl } from './geom.js';
import { textTex } from './textures.js';

export function buildLift() {
  const L = new THREE.Group(); L.name = 'TwoPostLift';
  const colX = 0.15, colZ = 1.42, colH = 4.1;
  const carriages = [];
  const label = new THREE.MeshStandardMaterial({ map: textTex(['RavagliOLI'], 512, 96, '#0f4fb8', '#ffffff', 'italic bold 60px DejaVu Sans'), roughness: 0.4 });
  [1, -1].forEach(s => {
    const col = new THREE.Group(); col.position.set(colX, 0, s * colZ); L.add(col);
    col.add(box(0.36, colH, 0.30, M.liftBlue, 0, colH / 2, 0, 0.02));        // column
    col.add(box(0.06, colH - 0.3, 0.10, M.trimBlack, 0, colH / 2, -s * 0.16)); // carriage slot
    col.add(box(0.60, 0.03, 0.50, M.liftBlue, 0, 0.015, 0, 0.01));             // base plate
    [[-0.22, -0.18], [0.22, -0.18], [-0.22, 0.18], [0.22, 0.18]].forEach(([x, z]) => { const b = cyl(0.02, 0.02, 0.03, M.liftSteel, 8); b.position.set(x, 0.04, z); col.add(b); });
    // label plate on side
    const lp = mesh(new THREE.PlaneGeometry(0.9, 0.16), label); lp.rotation.y = s > 0 ? 0 : Math.PI;
    lp.rotation.z = Math.PI / 2; lp.position.set(0, 2.9, s * 0.152); col.add(lp);
    // warning stickers & control box on the near column
    const st = box(0.005, 0.12, 0.12, M.yellow, 0.182, 1.6, 0); col.add(st);
    if (s > 0) {
      col.add(box(0.14, 0.26, 0.18, new THREE.MeshStandardMaterial({ color: 0xd8d8d0, roughness: 0.5 }), 0.25, 1.3, 0.0, 0.01));
      const btn = cyl(0.025, 0.025, 0.02, new THREE.MeshStandardMaterial({ color: 0x0a7a20 }), 12); btn.rotation.z = Math.PI / 2; btn.position.set(0.33, 1.34, 0); col.add(btn);
      const btn2 = cyl(0.025, 0.025, 0.02, new THREE.MeshStandardMaterial({ color: 0xb01010 }), 12); btn2.rotation.z = Math.PI / 2; btn2.position.set(0.33, 1.26, 0); col.add(btn2);
    }
    // hydraulic cylinder on inside face
    const hc = cyl(0.045, 0.045, 1.6, M.liftSteel, 16); hc.position.set(0.14, 0.9, -s * 0.18); col.add(hc);
    // carriage + 2 swing arms
    const car = new THREE.Group(); col.add(car); carriages.push(car);
    car.add(box(0.28, 0.6, 0.12, M.liftBlue, 0, 0.42, -s * 0.2, 0.015));
    [[1.0, 0.62], [-0.95, 0.55]].forEach(([px, pz]) => {
      // arm from pivot at carriage to pad position (car-frame px, s*pz)
      const pivot = new THREE.Vector3(0.12 * Math.sign(px), 0.08, -s * 0.26);
      const pad = new THREE.Vector3(px - colX, 0.08, s * pz - s * colZ);
      const d = pad.clone().sub(pivot), len = d.length();
      const arm = new THREE.Group(); arm.position.copy(pivot); arm.rotation.y = Math.atan2(-d.z, d.x); car.add(arm);
      arm.add(box(len * 0.62, 0.075, 0.13, M.liftBlue, len * 0.31, 0, 0, 0.012));
      arm.add(box(len * 0.45, 0.06, 0.10, M.liftSteel, len * 0.72, 0, 0, 0.01));    // telescoping inner arm
      const pin = cyl(0.05, 0.05, 0.1, M.liftSteel, 16); arm.add(pin);
      const screw = cyl(0.03, 0.03, 0.06, M.liftSteel, 10); screw.position.set(len, 0.06, 0); arm.add(screw);
      const padM = cyl(0.065, 0.065, 0.03, M.padRubber, 20); padM.position.set(len, 0.095, 0); arm.add(padM);
    });
  });
  // overhead beam with hoses (clear-floor style), and floor cable cover between columns
  L.add(box(0.22, 0.2, colZ * 2 + 0.3, M.liftBlue, colX, colH - 0.1, 0, 0.02));
  L.add(box(0.4, 0.035, colZ * 2 - 0.3, M.liftBlue, colX, 0.018, 0, 0.01));
  L.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  L.userData.setHeight = (h) => carriages.forEach(c => c.position.y = h);
  return L;
}
