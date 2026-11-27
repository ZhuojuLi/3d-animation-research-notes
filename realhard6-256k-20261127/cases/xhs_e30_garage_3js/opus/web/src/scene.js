// Scene composition: places garage, car on lift, and props
import * as THREE from 'three';
import { buildGarage } from './garage.js';
import { buildCar } from './car.js';
import { buildLift } from './lift.js';
import { toolChest, tyreRack, pegboard, poster, partsBin, can, tire } from './props.js';
import { engine, toolCart, looseWheel, tireStack, jack } from './props2.js';
import { M } from './materials.js';
import { box } from './geom.js';

export const CAR_YAW = -0.78; // front 3/4 toward camera, right flank visible (as reference)

export function buildScene(scene) {
  const garage = buildGarage(scene);
  // bay: lift + car share a rig so the car rides with the lift
  const bay = new THREE.Group(); bay.name = 'LiftBay'; bay.position.set(-1.6, 0, 0.2); bay.rotation.y = CAR_YAW; scene.add(bay);
  const lift = buildLift(); bay.add(lift);
  const { car, doors, wheels } = buildCar();
  const carRig = new THREE.Group(); carRig.add(car); bay.add(carRig);
  // workshop furniture (world coords)
  const P = (obj, x, y, z, ry = 0) => { obj.position.set(x, y, z); obj.rotation.y = ry; scene.add(obj); return obj; };
  P(toolChest(1.5, 1.05, 0.55), 2.55, 0, -4.15);
  P(toolChest(0.75, 0.75, 0.5, M.cabinet), 3.5, 0, -4.15);
  const top = P(toolChest(1.5, 0.45, 0.4), 2.55, 1.15, -4.25); top.children[0].material = M.cabinet;
  P(pegboard(), 2.6, 2.35, -4.42);
  P(poster(), 4.0, 3.2, -4.32);
  P(tyreRack(), 6.6, 0, -3.95);
  // second rack along right wall
  P(tyreRack(), 8.4, 0, -0.9, -Math.PI / 2);
  P(engine(), 6.2, 0, 0.3, 0.5);
  // parts bins stack & cans near cabinets
  [[4.4, 0, -4.1, 0xd9d9d2], [4.4, 0.32, -4.1, 0xd9d9d2], [4.85, 0, -4.05, 0xc23b2a]].forEach(([x, y, z, c]) => P(partsBin(0.42, 0.3, 0.5, c), x, y, z));
  P(can(0xe6e2d6, 0.4, 0.12), 3.95, 0, -3.8); P(can(0xc21f1f, 0.3, 0.1), 5.3, 0, -3.6); P(can(0xe6e2d6, 0.35, 0.11), 5.0, 0, -3.45);
  P(box(0.55, 0.42, 0.45, M.cardboard, 0, 0.21, 0, 0.01), 5.5, 0, -3.3, 0.2);
  // front-left foreground: tool cart, tyre+wheel
  P(toolCart(), -2.6, 0, 4.6, 0.25);
  P(looseWheel(), -1.6, 0, 6.0, 0.0);
  P(tireStack(2), -3.7, 0, 5.4);
  P(can(0xd8d8d8, 0.32, 0.06), -3.1, 0, 4.15); P(can(0xc21f1f, 0.36, 0.07), -2.95, 0, 4.05);
  P(jack(), 1.9, 0, 2.6, 2.6);
  P(tireStack(5), -6.6, 0, -3.6); P(tireStack(3), -6.0, 0, -3.9);
  P(toolChest(1.2, 0.9, 0.5, M.cabinetRed), -4.6, 0, -4.15);
  // oil drain pan under car
  const pan = box(0.6, 0.06, 0.6, M.yellow, 0, 0.03, 0, 0.01); P(pan, -0.2, 0, 1.6);
  scene.traverse(o => { if (o.isMesh && o.castShadow === false && o.receiveShadow === false) return; if (o.isMesh) { o.castShadow ??= true; } });
  return { garage, bay, lift, car, carRig, doors, wheels };
}
