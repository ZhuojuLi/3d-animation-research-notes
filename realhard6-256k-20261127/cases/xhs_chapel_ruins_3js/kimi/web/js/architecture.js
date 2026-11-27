import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { rng, wornBox, shadowMesh, worldUV } from './materials.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
function pointedPath(a, spring, base) {
  const pts = [];
  const rise = Math.sqrt(3) * a;
  pts.push(new THREE.Vector2(-a, base));
  for (let i = 1; i <= 7; i++) pts.push(new THREE.Vector2(-a, THREE.MathUtils.lerp(base, spring, i / 7)));
  for (let i = 1; i <= 30; i++) {
    const t = Math.PI - (Math.PI / 3) * i / 30;
    pts.push(new THREE.Vector2(a + 2 * a * Math.cos(t), spring + 2 * a * Math.sin(t)));
  }
  for (let i = 1; i <= 30; i++) {
    const t = Math.PI / 3 * (1 - i / 30);
    pts.push(new THREE.Vector2(-a + 2 * a * Math.cos(t), spring + 2 * a * Math.sin(t)));
  }
  for (let i = 1; i <= 7; i++) pts.push(new THREE.Vector2(a, THREE.MathUtils.lerp(spring, base, i / 7)));
  return { pts, rise };
}
function gothicRing(a, width, spring, base, front, back, material, seed = 1) {
  const inner = pointedPath(a, spring, base).pts;
  const outer = pointedPath(a + width, spring, base).pts;
  const positions = [], colors = [], uv = [], random = rng(seed);
  const color = new THREE.Color();
  function quad(A, B, C, D, c) {
    for (const p of [A, B, C, A, C, D]) { positions.push(...p); uv.push(p[0] * .7, p[1] * .65); colors.push(c.r, c.g, c.b); }
  }
  for (let i = 0; i < inner.length - 1; i++) {
    const gap = .017;
    const t0 = gap, t1 = 1 - gap;
    const p = inner[i], q = inner[i + 1], P = outer[i], Q = outer[i + 1];
    const lin = (u, v, t) => [THREE.MathUtils.lerp(u.x, v.x, t), THREE.MathUtils.lerp(u.y, v.y, t)];
    const i0 = lin(p, q, t0), i1 = lin(p, q, t1), o0 = lin(P, Q, t0), o1 = lin(P, Q, t1);
    const f = front + (random() - .5) * .033;
    color.setHSL(.105 + random() * .035, .08 + random() * .08, .66 + random() * .20);
    const fi0 = [i0[0], i0[1], f], fi1 = [i1[0], i1[1], f], fo0 = [o0[0], o0[1], f], fo1 = [o1[0], o1[1], f];
    const bi0 = [i0[0], i0[1], back], bi1 = [i1[0], i1[1], back], bo0 = [o0[0], o0[1], back], bo1 = [o1[0], o1[1], back];
    quad(fi0, fi1, fo1, fo0, color); quad(bi1, bi0, bo0, bo1, color);
    quad(fi1, bi1, bi0, fi0, color); quad(fo0, bo0, bo1, fo1, color);
    quad(fi0, bi0, bo0, fo0, color); quad(fo1, bo1, bi1, fi1, color);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  g.computeVertexNormals();
  const mat = material.clone(); mat.vertexColors = true; mat.side = THREE.DoubleSide; mat.color.multiplyScalar(1.08);
  const mesh = shadowMesh(new THREE.Mesh(g, mat)); mesh.geometry.computeBoundingSphere(); return mesh;
}

function crackRibbon(points, width, material) {
  const positions = [];
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i], b = points[i + 1];
    const dx = b.x - a.x, dz = b.z - a.z, len = Math.hypot(dx, dz) || 1;
    const px = -dz / len, pz = dx / len;
    const wa = width * (.55 + .45 * Math.sin(i * 2.1 + 1.4) ** 2);
    const wb = width * (.35 + .45 * Math.sin(i * 1.7 + .3) ** 2);
    const A = [a.x + px * wa, a.y, a.z + pz * wa], B = [a.x - px * wa, a.y, a.z - pz * wa];
    const C = [b.x + px * wb, b.y, b.z + pz * wb], D = [b.x - px * wb, b.y, b.z - pz * wb];
    positions.push(...A, ...B, ...C, ...B, ...D, ...C);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); g.computeVertexNormals();
  const mesh = new THREE.Mesh(g, material); mesh.renderOrder = 2; return mesh;
}
function addCracks(group, x, z, y, width, random, material) {
  if (random() > .42) return;
  const pts = []; let xx = x + (random() - .5) * width * .64, zz = z + .32;
  for (let j = 0; j < 6; j++) { pts.push(V(xx, y + .003, zz)); xx += (random() - .5) * .19; zz -= .09 + random() * .09; }
  group.add(crackRibbon(pts, .003 + random() * .003, material));
  if (random() > .52) {
    const p = pts[2], branch = [p.clone(), p.clone().add(V((random() - .5) * .16, 0, -.09)), p.clone().add(V((random() - .5) * .28, 0, -.19))];
    group.add(crackRibbon(branch, .0024, material));
  }
}

function brokenSlab(w, h, d, seed) {
  const random = rng(seed * 31 + 7), pts = [];
  const chipped = .05 + random() * .09;
  pts.push([-w / 2 + chipped * random(), -d / 2 + chipped * random()]);
  pts.push([-w * .12 + (random() - .5) * .09, -d / 2 + (random() - .5) * .045]);
  pts.push([w / 2 - chipped * (.3 + random()), -d / 2 + chipped * random()]);
  pts.push([w / 2 - chipped * random(), -d * .18 + (random() - .5) * .07]);
  pts.push([w / 2 - chipped * random(), d / 2 - chipped * (.3 + random())]);
  pts.push([w * .10 + (random() - .5) * .10, d / 2 - (random() - .5) * .05]);
  pts.push([-w / 2 + chipped * (.3 + random()), d / 2 - chipped * random()]);
  pts.push([-w / 2 + chipped * random(), d * .13 + (random() - .5) * .07]);
  const shape = new THREE.Shape(); shape.moveTo(...pts[0]); for (let i = 1; i < pts.length; i++) shape.lineTo(...pts[i]); shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, { depth: Math.max(.04, h - .045), steps: 1, bevelEnabled: true, bevelSegments: 1, bevelSize: .022, bevelThickness: .024, curveSegments: 1 });
  g.rotateX(Math.PI / 2); g.computeBoundingBox();
  const box = g.boundingBox; g.translate(0, -(box.min.y + box.max.y) / 2, 0);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    p.setXYZ(i, x + (random() - .5) * .008, y + (random() - .5) * .009, z + (random() - .5) * .009);
  }
  g.computeVertexNormals(); return worldUV(g, .65, seed);
}

export function buildArchitecture(scene, materials) {
  const { stoneMat, darkStone, innerStone, mortar, stepMat, woodMat, crackMat } = materials;
  const group = new THREE.Group(); group.name = '风化教堂与石阶'; scene.add(group);
  const random = rng(1717); const doorX = 4.2, base = 2.72, spring = 6.12, a = 2.18;
  // Structural facade: a real Gothic opening extruded through three metres of masonry.
  const outline = new THREE.Shape(); outline.moveTo(-.8, base - .1); outline.lineTo(20.5, base - .1); outline.lineTo(20.5, 15.7); outline.lineTo(-.8, 15.7); outline.closePath();
  const pp = pointedPath(a + .02, spring, base).pts;
  const hole = new THREE.Path(); hole.moveTo(pp[0].x + doorX, pp[0].y);
  for (let i = 1; i < pp.length; i++) hole.lineTo(pp[i].x + doorX, pp[i].y); hole.closePath(); outline.holes.push(hole);
  const mass = new THREE.Mesh(new THREE.ExtrudeGeometry(outline, { depth: 3.0, bevelEnabled: false }), mortar);
  mass.position.z = -9.3; shadowMesh(mass); group.add(mass);
  // Coursed facade blocks, individually tinted and gently displaced.
  const geo = new RoundedBoxGeometry(1, 1, 1, 1, .035); const blocks = [];
  for (let row = 0; row < 25; row++) {
    const h = .505 + random() * .055, y = base + .23 + row * .535;
    let x = -.72 - (row % 2) * .64;
    while (x < 20.5) {
      const w = .85 + random() * .81;
      const cx = x + w / 2;
      let maxHalf = 0;
      for (const yy of [y - h / 2, y, y + h / 2]) {
        if (yy >= base && yy < spring) maxHalf = a;
        else if (yy >= spring && yy < spring + Math.sqrt(3) * a) maxHalf = Math.sqrt(Math.max(0, (2 * a) ** 2 - (yy - spring) ** 2)) - a;
      }
      if (!(Math.abs(cx - doorX) - w / 2 < maxHalf + .04)) blocks.push({ x: cx, y, w, h, d: .37 + random() * .16, z: -6.03 - random() * .11, rot: (random() - .5) * .015 });
      x += w + .027;
    }
  }
  const facade = new THREE.InstancedMesh(geo, stoneMat, blocks.length); facade.name = '逐块砌筑的灰褐砂岩';
  const dummy = new THREE.Object3D(), tint = new THREE.Color();
  blocks.forEach((b, i) => {
    dummy.position.set(b.x, b.y, b.z); dummy.rotation.set((random() - .5) * .013, (random() - .5) * .023, b.rot); dummy.scale.set(b.w, b.h, b.d); dummy.updateMatrix(); facade.setMatrixAt(i, dummy.matrix);
    tint.setHSL(.105 + random() * .025, .014 + random() * .03, .78 + random() * .17); facade.setColorAt(i, tint);
  });
  shadowMesh(facade); group.add(facade);
  // Five hand-cut archivolts and deep reveals.
  for (let j = 0; j < 5; j++) {
    const ring = gothicRing(a + j * .245, .225, spring, base, -5.66 + j * .105, -6.46 + j * .07, j === 0 ? darkStone : stoneMat, 51 + j);
    ring.position.x = doorX; group.add(ring);
  }
  const reveal = gothicRing(a, .12, spring, base, -6.23, -9.32, innerStone, 88); reveal.position.x = doorX; group.add(reveal);
  // Colonnettes, capitals, plinths and tiny carved collars.
  for (const side of [-1, 1]) for (let c = 0; c < 3; c++) {
    const x = doorX + side * (a + .24 + c * .27), z = -5.55 + c * .055;
    const shaft = shadowMesh(new THREE.Mesh(new THREE.CylinderGeometry(.105, .13, spring - base - .4, 9), darkStone)); shaft.position.set(x, base + (spring - base) / 2, z); group.add(shaft);
    for (const [yy, rad, hh] of [[base + .08, .24, .16], [base + .25, .17, .11], [spring - .21, .18, .12], [spring - .08, .26, .18]]) {
      const cap = shadowMesh(new THREE.Mesh(new THREE.CylinderGeometry(rad * .82, rad, hh, 8), stoneMat)); cap.position.set(x, yy, z); group.add(cap);
    }
  }
  // Broken flags sit in dark compacted earth; the stair silhouette is deliberately discontinuous.
  const stairs = new THREE.Group(); stairs.name = '风化石阶'; group.add(stairs);
  const stairInfo = { minX: -9.5, maxX: 10.3, frontZ: 9.25, backZ: -6.12, base, steps: [] }; const stepRandom = rng(288);
  const N = 13, tread = (stairInfo.frontZ - stairInfo.backZ) / N, rise = base / N;
  for (let i = 0; i < N; i++) {
    const zFront = stairInfo.frontZ - i * tread + Math.sin(i * 2.31) * .10, top = .10 + (i + 1) * rise;
    const xMin = -9.55 + Math.max(0, 9 - i) * .072 + Math.sin(i * 1.7) * .19;
    const count = 8 + Math.floor(stepRandom() * 4);
    const total = 20.15 - Math.max(0, 7 - i) * .055; const weights = [];
    let sum = 0; for (let j = 0; j < count; j++) { const w = .58 + stepRandom() ** .72 * 1.85; weights.push(w); sum += w; }
    const fillH = top + .06;
    const earthTread = shadowMesh(new THREE.Mesh(brokenSlab(total + .10, fillH, tread + .06, 1500 + i), materials.earthMat), false, true);
    earthTread.position.set(xMin + total / 2, top - .026 - fillH / 2, zFront - tread / 2); stairs.add(earthTread);
    let xx = xMin;
    for (let j = 0; j < count; j++) {
      const w = total * weights[j] / sum, h = rise + .14 + stepRandom() * .095;
      const edge = j === 0 || j === count - 1;
      const missing = stepRandom() < (edge ? .14 : .047);
      if (!missing) {
        const depth = tread + .045 + (stepRandom() - .5) * .24;
        const geometry = brokenSlab(Math.max(.28, w - .032 - stepRandom() * .055), h, depth, i * 19 + j);
        const slab = shadowMesh(new THREE.Mesh(geometry, stepRandom() > .84 ? darkStone : stepMat));
        const nosing = (stepRandom() - .5) * .25;
        const actualTop = top + (stepRandom() - .5) * .075;
        slab.position.set(xx + w / 2 + (stepRandom() - .5) * .052, actualTop - h / 2, zFront - tread / 2 + nosing);
        slab.rotation.set((stepRandom() - .5) * .026, (stepRandom() - .5) * .034, (stepRandom() - .5) * .024); stairs.add(slab);
        if (j % 2 === 0) addCracks(stairs, slab.position.x, slab.position.z, actualTop, w, stepRandom, crackMat);
      }
      xx += w;
    }
    stairInfo.steps.push({ zFront, zBack: zFront - tread, top, xMin, xMax: xMin + total });
  }
  // Broken foundation and side retaining wall.
  for (let i = 0; i < 13; i++) {
    const block = shadowMesh(new THREE.Mesh(wornBox(.9 + random() * .5, .44 + random() * .22, .93, .07, i + 50), darkStone));
    block.position.set(-.72 + (random() - .5) * .05, base + .16 + (i % 3) * .49, -6.4 - i * .57); block.rotation.y = (random() - .5) * .08; group.add(block);
  }
  // The quiet, genuinely deep nave.
  const interior = new THREE.Group(); interior.name = '暗门厅长椅和烛台'; group.add(interior);
  const floor = shadowMesh(new THREE.Mesh(worldUV(new THREE.BoxGeometry(6.4, .25, 13.8), .65, 601), innerStone), false, true); floor.position.set(doorX, base - .16, -12.1); interior.add(floor);
  for (const side of [-1, 1]) {
    const wall = shadowMesh(new THREE.Mesh(worldUV(new THREE.BoxGeometry(1.1, 8.6, 14), .65, 602 + side), innerStone)); wall.position.set(doorX + side * 3.28, base + 4.15, -12.5); interior.add(wall);
    for (let k = 0; k < 6; k++) {
      const butt = shadowMesh(new THREE.Mesh(wornBox(.5, 7.1, .6, .04, 700 + k), innerStone)); butt.position.set(doorX + side * 2.6, base + 3.55, -7.1 - k * 2.1); interior.add(butt);
    }
  }
  const rear = shadowMesh(new THREE.Mesh(worldUV(new THREE.BoxGeometry(7.6, 9.0, .7), .65, 604), innerStone)); rear.position.set(doorX, base + 4.3, -19.2); interior.add(rear);
  // A masonry rear gable closes the former triangular sky leak beneath the ridge.
  const gableShape = new THREE.Shape();
  gableShape.moveTo(-3.78, base + 8.62); gableShape.lineTo(3.78, base + 8.62); gableShape.lineTo(.18, base + 10.64); gableShape.closePath();
  const gableGeo = new THREE.ExtrudeGeometry(gableShape, { depth: .52, bevelEnabled: false });
  const rearGable = shadowMesh(new THREE.Mesh(worldUV(gableGeo, .65, 605), innerStone)); rearGable.position.set(doorX, 0, -19.50); interior.add(rearGable);
  // Irregular wall heads imply ruin while the remaining roof still shelters the dark nave.
  for (const side of [-1, 1]) for (let k = 0; k < 4; k++) {
    const roof = shadowMesh(new THREE.Mesh(wornBox(4.22, .20, 3.48, .035, 840 + k + side * 9), innerStone));
    roof.position.set(doorX + side * 1.83, base + 9.50, -7.85 - k * 3.42);
    roof.rotation.z = -side * .49; interior.add(roof);
  }
  // Exterior return-wall courses make the chapel coherent from OrbitControls inspection views.
  const sideGeo = new RoundedBoxGeometry(1, 1, 1, 1, .035), sideBlocks = [];
  for (const side of [-1, 1]) for (let row = 0; row < 17; row++) for (let k = 0; k < 12; k++) {
    if (row > 13 && ((k + row * 2 + (side > 0 ? 1 : 0)) % 7 < 2)) continue;
    sideBlocks.push({ x: doorX + side * 3.84, y: base + .27 + row * .49, z: -6.9 - k * 1.04 + (row % 2) * .49, side });
  }
  const sideCourses = new THREE.InstancedMesh(sideGeo, stoneMat, sideBlocks.length); sideCourses.name = '废墟侧墙独立砌石';
  sideBlocks.forEach((b, i) => {
    dummy.position.set(b.x + (random() - .5) * .045, b.y, b.z); dummy.rotation.set((random() - .5) * .015, (random() - .5) * .015, (random() - .5) * .012); dummy.scale.set(.22, .455 + random() * .04, .995); dummy.updateMatrix(); sideCourses.setMatrixAt(i, dummy.matrix);
    tint.setHSL(.11, .018 + random() * .03, .75 + random() * .17); sideCourses.setColorAt(i, tint);
  });
  shadowMesh(sideCourses); interior.add(sideCourses);
  const innerBlocks = [];
  for (const side of [-1, 1]) for (let row = 0; row < 17; row++) for (let k = 0; k < 13; k++) {
    const z = -6.25 - k * 1.0 + (row % 2) * .47;
    if (z < -18.7 || (row > 13 && (k * 3 + row) % 9 < 2)) continue;
    innerBlocks.push({ x: doorX + side * 2.70, y: base + .25 + row * .50, z });
  }
  const innerCourses = new THREE.InstancedMesh(sideGeo, innerStone, innerBlocks.length); innerCourses.name = '中殿内侧风化砌石';
  innerBlocks.forEach((b, i) => {
    dummy.position.set(b.x, b.y, b.z); dummy.rotation.set((random() - .5) * .013, (random() - .5) * .018, (random() - .5) * .012); dummy.scale.set(.16, .463 + random() * .024, .94); dummy.updateMatrix(); innerCourses.setMatrixAt(i, dummy.matrix);
    tint.setHSL(.10, .018 + random() * .025, .64 + random() * .16); innerCourses.setColorAt(i, tint);
  });
  shadowMesh(innerCourses); interior.add(innerCourses);
  // Repeated ribs draw the eye into the darkness.
  for (const z of [-8.2, -12.0, -16.2]) { const rib = gothicRing(2.34, .18, spring + .04, base, z, z - .26, innerStone, Math.round(-z * 9)); rib.position.x = doorX; interior.add(rib); }
  const woodPieces = [];
  for (let row = 0; row < 6; row++) for (const side of [-1, 1]) {
    const bench = new THREE.Group();
    const x = side * 1.20, z = -row * 1.53;
    const pieces = [[0, .70, 0, 1.72, .13, .57], [0, 1.1, -.23, 1.72, .64, .10]];
    for (const e of [-.67, .67]) { pieces.push([e, .38, 0, .09, .71, .40]); pieces.push([e, .93, -.26, .085, 1.30, .13]); }
    pieces.forEach(p => {
      const mesh = shadowMesh(new THREE.Mesh(wornBox(p[3], p[4], p[5], .018, row * 33 + woodPieces.length), woodMat)); mesh.position.set(p[0], p[1], p[2]); bench.add(mesh); woodPieces.push(mesh);
    });
    bench.position.set(doorX + x, base, -8.6 + z);
    bench.rotation.y = (random() - .5) * .052;
    bench.rotation.z = row === 4 && side === -1 ? -.032 : (random() - .5) * .008;
    interior.add(bench);
  }
  // Iron cross, altar and candlesticks.
  const iron = new THREE.MeshStandardMaterial({ color: 0x191914, metalness: .68, roughness: .62 });
  const brass = new THREE.MeshStandardMaterial({ color: 0x665037, metalness: .72, roughness: .38 });
  const crossV = new THREE.Mesh(new THREE.BoxGeometry(.075, 1.5, .085), iron); crossV.position.set(doorX + .95, base + 2.55, -18.72); interior.add(crossV);
  const crossH = new THREE.Mesh(new THREE.BoxGeometry(.88, .065, .085), iron); crossH.position.set(doorX + .95, base + 2.83, -18.70); interior.add(crossH);
  const altar = shadowMesh(new THREE.Mesh(wornBox(3.0, 1.04, .84, .05, 53), darkStone)); altar.position.set(doorX, base + .52, -17.4); interior.add(altar);
  const flames = [], candleLights = [];
  function candle(x, y, z, height = .85) {
    const wax = new THREE.MeshStandardMaterial({ color: 0xb8a583, roughness: .86 });
    const basecup = new THREE.Mesh(new THREE.CylinderGeometry(.17, .23, .07, 14), brass); basecup.position.set(x, y, z); interior.add(basecup);
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(.036, .052, height, 10), brass); stick.position.set(x, y + height / 2, z); interior.add(stick);
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(.15, .07, .10, 14), brass); bowl.position.set(x, y + height, z); interior.add(bowl);
    const c = new THREE.Mesh(new THREE.CylinderGeometry(.065, .075, .43, 12), wax); c.position.set(x, y + height + .25, z); interior.add(c);
    const flameMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      uniforms: { uTime: { value: 0 }, uPower: { value: .4 } },
      vertexShader: 'varying vec2 vUv; uniform float uTime; void main(){vUv=uv; vec3 p=position; p.x+=sin(uTime*5.0+position.y*9.0)*0.022*uv.y; gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0);}',
      fragmentShader: 'varying vec2 vUv; uniform float uTime; uniform float uPower; void main(){vec2 p=vUv-vec2(.5,.28); p.x+=sin(vUv.y*8.0-uTime*5.2)*.036*vUv.y; float body=1.0-smoothstep(.08,.25,length(p*vec2(1.6,1.0))); float a=body*smoothstep(0.,.12,vUv.y)*(1.-smoothstep(.65,1.,vUv.y)); vec3 c=mix(vec3(1.,.18,.015),vec3(1.,.88,.40),smoothstep(.0,.35,body)); gl_FragColor=vec4(c*(1.7+uPower*1.4),a*(.48+uPower*.52));}'
    });
    const flame = new THREE.Mesh(new THREE.PlaneGeometry(.24, .54), flameMat); flame.position.set(x, y + height + .52, z + .10); interior.add(flame); flames.push(flame);
    const light = new THREE.PointLight(0xffad61, 9, 13, 2); light.position.set(x, y + height + .62, z + .2); interior.add(light); candleLights.push(light);
  }
  candle(doorX, base + .78, -15.9, 1.62); candle(doorX - 1.0, base + 1.1, -17.3, .60); candle(doorX + 1.0, base + 1.1, -17.3, .60);
  const interiorFill = new THREE.PointLight(0xe0ae7a, 13, 16, 2);
  interiorFill.position.set(doorX - .6, base + 3.25, -11.4); scene.add(interiorFill);
  const spill = new THREE.PointLight(0xffaa61, 32, 14, 2); spill.position.set(doorX, base + 2.8, -6.45); scene.add(spill);
  return { group, stairInfo, interior, flames, candleLights, spill, interiorFill, facade, facadeCount: blocks.length, sideCourseCount: sideBlocks.length, roofForm: 'broken-pitched', door: V(doorX, base + 2.1, -6.0), doorBase: V(doorX, base, -5.8) };
}
