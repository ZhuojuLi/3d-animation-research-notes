// Assembles the E30: body + front + wheels + interior + underbody
import * as THREE from 'three';
import { buildBody, DIM } from './carBody.js';
import { buildFront, buildWheel, buildInterior, buildUnderbody } from './carParts.js';

export function buildCar() {
  const car = new THREE.Group(); car.name = 'BMW_E30';
  const doors = buildBody(car);
  buildFront(car); buildInterior(car); buildUnderbody(car);
  const wheels = [];
  [[DIM.wb / 2, 1], [DIM.wb / 2, -1], [-DIM.wb / 2, 1], [-DIM.wb / 2, -1]].forEach(([x, s]) => {
    const w = buildWheel(); w.position.set(x, DIM.wheelR, s * (DIM.W / 2 - 0.1));
    if (s < 0) w.rotation.y = Math.PI;
    if (x > 0) w.rotation.y += s * 0.12; // slight steer
    car.add(w); wheels.push(w);
  });
  car.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return { car, doors, wheels };
}
