// BMW E30 coupe body shell: front/rear clips, greenhouse, openable right door.
// Car local frame: +X forward, +Y up, +Z = right side. Origin on ground, mid-wheelbase.
import * as THREE from 'three';
import { M } from './materials.js';
import { mesh, box, quad, polyIn, extrudeProfile, tube, arcPts } from './geom.js';

export const DIM = { W: 1.645, wb: 2.57, wheelR: 0.305, beltY: 0.95, roofY: 1.37 };
const HW = DIM.W / 2, AX = DIM.wb / 2, AR = 0.375;
const V = (x, y, z) => new THREE.Vector3(x, y, z);
// greenhouse tumblehome: half-width as function of height
export const ghZ = (y) => 0.775 - (y - 0.95) / 0.42 * 0.17;
// A-pillar x as function of height
const aX = (y) => 0.80 - (y - 0.95) / 0.42 * 0.76;

export function buildBody(car) {
  const B = 0.035; // bevel
  // FRONT CLIP (nose -> A-pillar / door shut line)
  const front = [[0.72, 0.27], [0.88, 0.27], [0.91, 0.31], ...arcPts(AX, 0.31, AR, Math.PI, 0, 18),
    [1.67, 0.31], [2.02, 0.34], [2.08, 0.52], [2.10, 0.80], [2.06, 0.86], [1.20, 0.91], [0.74, 0.95]];
  const f = extrudeProfile(front.map(([x, y]) => [x, y]), DIM.W, M.paint, B);
  car.add(f);
  // REAR CLIP (door shut line -> tail)
  const rear = [[-2.04, 0.36], [-1.70, 0.31], ...arcPts(-AX, 0.31, AR, Math.PI, 0, 18),
    [-0.88, 0.27], [-0.58, 0.27], [-0.58, 0.95], [-1.32, 0.97], [-2.02, 0.98], [-2.08, 0.93], [-2.09, 0.62]];
  car.add(extrudeProfile(rear, DIM.W, M.paint, B));
  // wheel-well liners
  [AX, -AX].forEach(x => {
    const g = new THREE.CylinderGeometry(AR + 0.02, AR + 0.02, DIM.W - 0.3, 24, 1, true, Math.PI / 2, Math.PI);
    const w = mesh(g, M.underbody); w.rotation.x = Math.PI / 2; w.position.set(x, 0.31, 0);
    w.material = M.underbody; w.material.side = THREE.DoubleSide; car.add(w);
  });
  // sills / floorpan under the doors
  car.add(box(1.3, 0.12, DIM.W - 0.02, M.paint, 0.07, 0.31, 0, 0.03));
  car.add(box(4.0, 0.04, DIM.W - 0.18, M.underbody, 0, 0.22, 0));
  // shut lines on hood & trunk (thin dark strips)
  const line = (w, d, x, y, z, ry = 0) => { const b = box(w, 0.004, d, M.trimBlack, x, y, z); b.rotation.y = ry; car.add(b); };
  line(0.006, DIM.W - 0.1, 0.86, 0.94, 0);
  line(1.42, 0.006, 1.38, 0.915, HW - 0.06); line(1.42, 0.006, 1.38, 0.915, -HW + 0.06);
  line(0.006, DIM.W - 0.16, -1.36, 0.975, 0); line(0.68, 0.006, -1.70, 0.985, HW - 0.09); line(0.68, 0.006, -1.70, 0.985, -HW + 0.09);
  // side rubbing strip + shoulder crease highlight
  [1, -1].forEach(s => {
    car.add(box(3.9, 0.035, 0.02, M.trimBlack, 0, 0.53, s * (HW + 0.02), 0.008));
    car.add(box(3.95, 0.012, 0.012, M.paint, 0.02, 0.80, s * (HW + 0.012), 0.005));
  });
  buildGreenhouse(car);
  const leftDoor = buildDoor(-1); car.add(leftDoor);
  const rightDoor = buildDoor(1); car.add(rightDoor);
  return { rightDoor, leftDoor };
}

function buildGreenhouse(car) {
  const y0 = DIM.beltY, y1 = DIM.roofY, z0 = ghZ(y0), z1 = ghZ(y1);
  const xf0 = 0.80, xf1 = 0.04, xr1 = -0.92, xr0 = -1.36;
  // windshield & rear window
  car.add(quad(V(xf0, y0, z0), V(xf0, y0, -z0), V(xf1, y1, -z1), V(xf1, y1, z1), M.glass));
  car.add(quad(V(xr0, y0 + 0.02, -z0), V(xr0, y0 + 0.02, z0), V(xr1, y1, z1), V(xr1, y1, -z1), M.glass));
  // roof slab (slightly crowned via two quads)
  const rc = y1 + 0.03;
  const roof = new THREE.Group();
  roof.add(quad(V(xf1, y1, z1), V(xf1 - 0.04, rc, 0), V(xr1 + 0.04, rc, 0), V(xr1, y1, z1), M.paint));
  roof.add(quad(V(xf1, y1, -z1), V(xr1, y1, -z1), V(xr1 + 0.04, rc, 0), V(xf1 - 0.04, rc, 0), M.paint));
  roof.children.forEach(m => m.material = M.paint);
  car.add(roof);
  // headliner
  const hl = quad(V(xf1, y1 - 0.03, -z1), V(xf1, y1 - 0.03, z1), V(xr1, y1 - 0.03, z1), V(xr1, y1 - 0.03, -z1), M.white);
  hl.material = new THREE.MeshStandardMaterial({ color: 0x8d8a84, roughness: 1, side: THREE.DoubleSide }); car.add(hl);
  [1, -1].forEach(s => {
    // A-pillar, roof rail, C-pillar edges (paint tubes)
    car.add(tube([[xf0 - 0.02, y0, s * z0], [xf1, y1, s * z1]], 0.028, M.paint, 4));
    car.add(tube([[xf1, y1, s * z1], [(xf1 + xr1) / 2, y1 + 0.006, s * z1], [xr1, y1, s * z1]], 0.03, M.paint, 12));
    car.add(tube([[xr1, y1, s * z1], [xr0, y0 + 0.02, s * z0]], 0.03, M.paint, 4));
    // windscreen & rear screen rubber surrounds
    car.add(tube([[xf0, y0 + 0.005, s * z0], [xf0, y0 + 0.005, 0]], 0.012, M.trimBlack, 2));
    // side panels in tilted greenhouse plane: quarter glass + C-pillar sheet
    const fn = (u, v) => V(u, v, s * (ghZ(v) + 0.004));
    const bx = -0.50;
    const quarter = polyIn([[bx - 0.06, y0 + 0.02], [-1.00, y0 + 0.02], [-0.79, y1 - 0.05], [bx - 0.06, y1 - 0.05]], fn, M.glass);
    car.add(quarter);
    const cp = polyIn([[-1.00, y0], [xr0 + 0.02, y0 + 0.01], [xr1, y1], [-0.76, y1], [-0.79, y1 - 0.05]], fn, M.paint);
    cp.material = M.paint; car.add(cp);
    // B-pillar & quarter frame (black)
    const fnO = (u, v) => V(u, v, s * (ghZ(v) + 0.012));
    car.add(polyIn([[bx - 0.06, y0], [bx, y0], [bx, y1 - 0.01], [bx - 0.06, y1 - 0.01]], fnO, M.trimBlack));
    car.add(tube([[bx - 0.06, y1 - 0.045, s * (ghZ(y1) + 0.01)], [-0.79, y1 - 0.045, s * (ghZ(y1) + 0.01)]], 0.01, M.chrome, 2));
    // cowl / wiper area
    car.add(tube([[0.70, y0 + 0.03, s * 0.05], [0.66, y0 + 0.04, s * 0.55]], 0.008, M.trimBlack, 2));
  });
  // plenum strip
  car.add(box(0.10, 0.02, 1.5, M.trimBlack, 0.76, y0 + 0.005, 0));
  // tail panel & lamps
  [1, -1].forEach(s => {
    car.add(box(0.03, 0.15, 0.46, M.tailRed, -2.10, 0.80, s * 0.55, 0.01));
    car.add(box(0.032, 0.05, 0.46, M.amber, -2.101, 0.84, s * 0.55));
  });
  car.add(box(0.03, 0.15, 0.62, M.trimBlack, -2.10, 0.80, 0, 0.01));
}

// Coupe door with frame & glass. s=+1 right side (hinged at front, opens outward)
function buildDoor(s) {
  const hinge = new THREE.Group();
  const xh = 0.72, xb = -0.565;
  hinge.position.set(xh, 0, s * (HW - 0.035));
  const door = new THREE.Group(); hinge.add(door);
  const P = (x, y) => [x - xh, y];
  const prof = [P(xb, 0.29), P(0.705, 0.29), P(0.72, 0.95), P(xb, 0.95)];
  const skin = extrudeProfile(prof, 0.07, M.paint, 0.012, 2);
  skin.position.z = 0; door.add(skin);
  // inner door card (interior trim)
  const card = box(1.08, 0.58, 0.02, M.leather, (xb + 0.70) / 2 - xh, 0.62, -s * 0.045);
  door.add(card);
  door.add(box(0.7, 0.05, 0.06, M.dash, -0.6, 0.78, -s * 0.07)); // armrest
  door.add(box(0.5, 0.18, 0.02, M.carpet, -0.55, 0.45, -s * 0.058)); // map pocket
  // window frame & glass in tilted plane (relative to hinge z)
  const zoff = s * (HW - 0.035);
  const fn = (dz) => (u, v) => V(u - xh, v, s * (ghZ(v) + dz) - zoff);
  const y0 = DIM.beltY, y1 = DIM.roofY - 0.035;
  const glass = polyIn([[aX(y0) - 0.06, y0], [xb + 0.07, y0], [xb + 0.07, y1 - 0.02], [aX(y1) - 0.04, y1 - 0.02]], fn(0.0), M.glass);
  door.add(glass);
  const fr = (pts, r) => door.add(tube(pts.map(([x, y, dz]) => [x - xh, y, s * (ghZ(y) + dz) - zoff]), r, M.trimBlack, 4));
  fr([[aX(y0) - 0.03, y0, 0.01], [aX(y1) - 0.02, y1, 0.01]], 0.016);
  fr([[aX(y1) - 0.02, y1, 0.01], [xb + 0.04, y1, 0.01]], 0.016);
  fr([[xb + 0.04, y1, 0.01], [xb + 0.04, y0, 0.01]], 0.02);
  door.add(box(1.12, 0.02, 0.05, M.chrome, (xb + 0.72) / 2 - xh, y0 + 0.006, s * 0.0)); // belt chrome
  // handle + lock
  door.add(box(0.14, 0.03, 0.025, M.chrome, xb + 0.2 - xh, 0.86, s * 0.045, 0.008));
  // mirror
  const mir = new THREE.Group();
  mir.add(box(0.05, 0.05, 0.08, M.trimBlack, 0, 0, 0));
  const head = box(0.10, 0.10, 0.16, M.trimBlack, -0.02, 0.03, s * 0.1, 0.03); mir.add(head);
  const glassM = box(0.004, 0.085, 0.14, M.chrome, -0.072, 0.03, s * 0.1); mir.add(glassM);
  mir.position.set(aX(y0) - 0.1 - xh, y0 + 0.04, s * 0.02); door.add(mir);
  hinge.userData = { door: true, side: s };
  hinge.traverse(o => { o.userData.doorRoot = hinge; });
  return hinge;
}
