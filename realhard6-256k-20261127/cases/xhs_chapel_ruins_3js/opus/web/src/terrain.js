import * as THREE from 'three';
import { fbm, triplanarUV } from './util.js';
import { stoneMaterial } from './textures.js';

// terrace height: flat forecourt that falls away into the valley on the left / far side
export function terraceHeight(x, z) {
  const n = (fbm(x * 0.15, z * 0.15, 4.2, 4) - 0.5);
  let h = n * 0.35;
  const edgeZ = -5.2 + n * 3 - Math.max(0, x + 4) * 0.6;
  const d = Math.max(0, edgeZ - z);
  h -= d * d * 0.06 + d * 0.8;
  if (x > 9) h += (x - 9) * 0.25 * (0.6 + n);
  return h;
}

export function createTerrain(scene) {
  const group = new THREE.Group();
  // near forecourt
  const g = new THREE.PlaneGeometry(90, 90, 220, 220); g.rotateX(-Math.PI / 2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) p.setY(i, terraceHeight(p.getX(i), p.getZ(i)));
  triplanarUV(g, 0.28);
  const groundMat = stoneMaterial({ seed: 31, tint: [0.45, 0.39, 0.32], moss: 0.8, size: 512 }, { bumpScale: 3 });
  groundMat.color.set(0xd8c8b8);
  const ground = new THREE.Mesh(g, groundMat); ground.receiveShadow = true;
  group.add(ground);

  // distant valley + mountain ridges
  const fg = new THREE.PlaneGeometry(5000, 5000, 300, 300); fg.rotateX(-Math.PI / 2);
  const fp = fg.attributes.position, col = new Float32Array(fp.count * 3);
  for (let i = 0; i < fp.count; i++) {
    const x = fp.getX(i), z = fp.getZ(i), r = Math.hypot(x, z);
    const n = fbm(x * 0.0022, z * 0.0022, 1.3, 6), ridge = 1 - Math.abs(fbm(x * 0.0011, z * 0.0011, 8.1, 5) * 2 - 1);
    let h = -70 + (n - 0.5) * 50;
    h += THREE.MathUtils.smoothstep(r, 500, 1700) * (ridge * 260 + n * 120);
    const lake = Math.exp(-(((x + 330) / 220) ** 2 + ((z + 760) / 70) ** 2));
    h = h * (1 - lake) + (-84) * lake;
    if (r < 45) h = -100;
    fp.setY(i, h);
    const t = Math.min(1, Math.max(0, (h + 70) / 200));
    col[i * 3] = 0.42 - t * 0.05 + (n - 0.5) * 0.15; col[i * 3 + 1] = 0.30 - t * 0.04 + (n - 0.5) * 0.12; col[i * 3 + 2] = 0.22 + t * 0.06;
  }
  fg.setAttribute('color', new THREE.BufferAttribute(col, 3));
  fg.computeVertexNormals();
  const far = new THREE.Mesh(fg, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }));
  group.add(far);

  // still water catching the sunset
  const water = new THREE.Mesh(new THREE.PlaneGeometry(900, 260), new THREE.MeshStandardMaterial({ color: 0x3a2a2a, roughness: 0.06, metalness: 1.0, envMapIntensity: 1.25 }));
  water.rotation.x = -Math.PI / 2; water.position.set(-330, -79.5, -760);
  group.add(water);
  scene.add(group);
  return { ground, far, water };
}
