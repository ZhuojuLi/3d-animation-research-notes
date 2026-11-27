// Garage shell: concrete floor, walls, tall grid windows w/ bright exterior, roof trusses, lamps, drain
import * as THREE from 'three';
import { M } from './materials.js';
import { mesh, box, cyl } from './geom.js';
import { concreteMaps, plasterTex, canvas, toTex } from './textures.js';

export const ROOM = { x0: -8, x1: 9, z0: -4.6, z1: 9, h: 6.2 };

function exteriorTex() {
  const [c, g] = canvas(1024, 512);
  const sky = g.createLinearGradient(0, 0, 0, 512);
  sky.addColorStop(0, '#dfeaf2'); sky.addColorStop(0.6, '#f4f1e8'); sky.addColorStop(1, '#d9d6c8');
  g.fillStyle = sky; g.fillRect(0, 0, 1024, 512);
  let s = 3; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 260; i++) { // soft tree canopies
    const x = r() * 1024, y = 150 + r() * 260, R = 20 + r() * 70, gg = 120 + r() * 80;
    g.fillStyle = `rgba(${gg * 0.75 | 0},${gg | 0},${gg * 0.55 | 0},0.18)`; g.beginPath(); g.arc(x, y, R, 0, 7); g.fill();
  }
  g.fillStyle = 'rgba(200,195,185,0.5)'; g.fillRect(620, 300, 300, 160); // building across the yard
  return toTex(c);
}

export function buildGarage(scene) {
  const G = new THREE.Group(); G.name = 'Garage'; scene.add(G);
  const { x0, x1, z0, z1, h } = ROOM;
  const fm = concreteMaps();
  fm.map.repeat.set(3, 3); fm.rough.repeat.set(3, 3);
  const floorMat = new THREE.MeshPhysicalMaterial({ map: fm.map, roughnessMap: fm.rough, roughness: 0.9, metalness: 0.0,
    clearcoat: 0.25, clearcoatRoughness: 0.35, color: 0xb8b4ac });
  const floor = mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0), floorMat, false, true);
  floor.rotation.x = -Math.PI / 2; floor.position.set((x0 + x1) / 2, 0, (z0 + z1) / 2); G.add(floor);
  // floor drain channel (diagonal, front-right)
  const drain = new THREE.Group();
  drain.add(box(9, 0.01, 0.16, new THREE.MeshStandardMaterial({ color: 0x2b2b2b, metalness: 0.7, roughness: 0.5 }), 0, 0.003, 0));
  for (let i = -44; i <= 44; i++) drain.add(box(0.03, 0.012, 0.15, new THREE.MeshStandardMaterial({ color: 0x55585c, metalness: 0.8, roughness: 0.4 }), i * 0.1, 0.006, 0));
  drain.position.set(4.8, 0, 3.3); drain.rotation.y = 0.42; G.add(drain);

  const wallMat = new THREE.MeshStandardMaterial({ map: plasterTex('#d8d2c6'), roughness: 0.92 });
  const lowMat = new THREE.MeshStandardMaterial({ color: 0x5f646b, roughness: 0.8 }); // painted dado
  // back wall with window openings (built from slabs so sun shines through)
  const wins = [[-7.4, -3.4, 1.6, 5.4], [-1.9, 1.5, 1.4, 5.6], [4.3, 8.6, 3.2, 5.6]];
  const bw = new THREE.Group(); G.add(bw);
  const slab = (xa, xb, ya, yb, mat = wallMat) => { const b = box(xb - xa, yb - ya, 0.3, mat, (xa + xb) / 2, (ya + yb) / 2, z0 - 0.15); bw.add(b); };
  let xc = x0;
  wins.forEach(([a, b, ya, yb]) => { slab(xc, a, 0, h); slab(a, b, 0, ya); slab(a, b, yb, h); xc = b; });
  slab(xc, x1, 0, h);
  bw.add(box(x1 - x0, 1.0, 0.02, lowMat, (x0 + x1) / 2, 0.5, z0 + 0.01));
  // window frames: white steel grid
  const ext = new THREE.MeshBasicMaterial({ map: exteriorTex(), toneMapped: true, color: 0xffffff });
  ext.color.setScalar(2.2);
  wins.forEach(([a, b, ya, yb]) => {
    const W = b - a, H = yb - ya, cx = (a + b) / 2, cy = (ya + yb) / 2;
    const outside = mesh(new THREE.PlaneGeometry(W + 4, H + 3), ext, false, false); outside.position.set(cx, cy, z0 - 2.5); G.add(outside);
    const nx = Math.round(W / 0.62), ny = Math.round(H / 0.48);
    for (let i = 0; i <= nx; i++) bw.add(box(i % 3 === 0 ? 0.07 : 0.035, H, 0.08, M.frameWhite, a + i * W / nx, cy, z0 - 0.1));
    for (let j = 0; j <= ny; j++) bw.add(box(W, j % 4 === 0 ? 0.07 : 0.035, 0.08, M.frameWhite, cx, ya + j * H / ny, z0 - 0.1));
    bw.add(box(W + 0.1, 0.06, 0.32, M.frameWhite, cx, ya - 0.03, z0 - 0.05)); // sill
  });
  // structural pilasters
  [-3.1, 1.85, 4.0].forEach(x => bw.add(box(0.45, h, 0.25, wallMat, x, h / 2, z0 + 0.1)));
  // left & right walls
  const lw = box(0.3, h, z1 - z0, wallMat, x0 - 0.15, h / 2, (z0 + z1) / 2); G.add(lw);
  const rw = box(0.3, h, z1 - z0, wallMat, x1 + 0.15, h / 2, (z0 + z1) / 2); G.add(rw);
  // ceiling + trusses
  const ceil = box(x1 - x0, 0.2, z1 - z0, new THREE.MeshStandardMaterial({ color: 0x9b9790, roughness: 0.9 }), (x0 + x1) / 2, h + 0.1, (z0 + z1) / 2);
  G.add(ceil);
  const steel = new THREE.MeshStandardMaterial({ color: 0x6e6a64, roughness: 0.6, metalness: 0.5 });
  for (let z = z0 + 0.6; z < z1; z += 2.6) {
    G.add(box(x1 - x0, 0.35, 0.16, steel, (x0 + x1) / 2, h - 0.2, z));
    G.add(box(x1 - x0, 0.06, 0.18, steel, (x0 + x1) / 2, h - 0.9, z));
    for (let x = x0 + 0.5; x < x1; x += 1.0) { const d = box(0.05, 0.85, 0.05, steel, x, h - 0.55, z); d.rotation.z = (Math.round(x) % 2 ? 0.5 : -0.5); G.add(d); }
  }
  // pipes along the back wall (left)
  [[-6.8, 0.12], [-6.5, 0.08]].forEach(([x, r]) => { const p = cyl(r, r, h, steel, 16); p.position.set(x, h / 2, z0 + 0.25); G.add(p); });
  const hp = cyl(0.07, 0.07, x1 - x0, steel, 12); hp.rotation.z = Math.PI / 2; hp.position.set((x0 + x1) / 2, 5.75, z0 + 0.3); G.add(hp);
  // pendant shop lamps (warm)
  const lamps = [];
  [[-0.4, 1.0], [-4.5, 1.6], [4.5, 1.0], [0.5, 5.5]].forEach(([x, z]) => {
    const g = new THREE.Group(); g.position.set(x, 4.95, z);
    g.add(cyl(0.008, 0.008, 1.0, M.trimBlack, 4)); g.children[0].position.y = 0.6;
    const shade = mesh(new THREE.ConeGeometry(0.28, 0.24, 24, 1, true), new THREE.MeshStandardMaterial({ color: 0x2c3035, metalness: 0.6, roughness: 0.4, side: THREE.DoubleSide }));
    g.add(shade);
    const bulb = mesh(new THREE.SphereGeometry(0.07, 16, 8), new THREE.MeshBasicMaterial({ color: 0xfff0d0 })); bulb.position.y = -0.08; g.add(bulb);
    const L = new THREE.PointLight(0xffd9a8, 6, 9, 1.6); L.position.y = -0.15; g.add(L); lamps.push(L);
    G.add(g);
  });
  G.traverse(o => { if (o.isMesh && o !== floor) { o.castShadow = true; o.receiveShadow = true; } });
  ext.userData.noShadow = true;
  G.traverse(o => { if (o.isMesh && o.material === ext) o.castShadow = false; });
  return { group: G, floor, lamps };
}
