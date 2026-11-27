import * as THREE from 'three';
import { rng, hash, shadowMesh, wornBox } from './materials.js';

function softNoise(x) { const i = Math.floor(x), f = x - i, s = f * f * (3 - 2 * f); return THREE.MathUtils.lerp(hash(i), hash(i + 1), s); }

export function buildLandscape(scene, materials, architecture) {
  const random = rng(2063); const group = new THREE.Group(); group.name = '山谷与废墟台地'; scene.add(group);
  const terrain = new THREE.PlaneGeometry(330, 360, 130, 140); terrain.rotateX(-Math.PI / 2); terrain.translate(-65, 0, -110);
  const p = terrain.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i);
    const local = (hash(x * .1, z * .11) - .5) * .23 + (hash(x * .36, z * .39) - .5) * .1;
    let y = -.12 + local;
    if (x < -6.4) y -= Math.pow((-6.4 - x) * .075, 1.32) * 2.3;
    if (z < -7) y -= Math.pow((-z - 7) * .047, 1.48) * 2.5;
    if (x > 14 && z < 0) y += (x - 14) * .1;
    p.setY(i, y);
  }
  terrain.computeVertexNormals(); const ground = shadowMesh(new THREE.Mesh(terrain, materials.earthMat), false, true); group.add(ground);
  // A narrow, ruined parapet gives the elevated forecourt its boundary.
  const wall = new THREE.Group(); wall.name = '坍塌的台地矮墙'; group.add(wall);
  for (let i = 0; i < 13; i++) {
    if (i === 1 || i === 9) continue;
    const x = -13.8 + i * .66 + Math.sin(i * 1.81) * .17, z = -2.0 + Math.sin(i * .46) * .63 + Math.sin(i * 1.7) * .20;
    for (let row = 0; row < 2 + (i > 7 ? 1 : 0); row++) {
      const b = shadowMesh(new THREE.Mesh(wornBox(.70 + random() * .10, .32, .65, .045, 500 + i * 5 + row), materials.darkStone));
      b.position.set(x + (row % 2) * .04, .30 + row * .30, z + (random() - .5) * .13); b.rotation.y = (random() - .5) * .20; wall.add(b);
    }
  }
  for (let i = 0; i < 5; i++) {
    if (i === 2) continue;
    const b = shadowMesh(new THREE.Mesh(wornBox(.65, .38, .70, .075, i + 994), materials.darkStone));
    b.position.set(-7.05 + Math.sin(i * 1.3) * .30, .20 + (i % 2) * .24, -1.20 + i * .90);
    b.rotation.set((random() - .5) * .10, (random() - .5) * .38, (random() - .5) * .18); wall.add(b);
  }
  // Lake: animated geometrical water with soft, horizontally broken sun reflections.
  const lakeMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uSun: { value: new THREE.Vector3(-90, -10, -240) } },
    vertexShader: `varying vec3 vWorld; varying vec2 vUv; uniform float uTime; void main(){vec3 p=position;p.z+=sin(p.x*.31+uTime*.24)*.018;vec4 w=modelMatrix*vec4(p,1.);vWorld=w.xyz;vUv=uv;gl_Position=projectionMatrix*viewMatrix*w;}`,
    fragmentShader: `varying vec3 vWorld; varying vec2 vUv; uniform float uTime;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123);}
      float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
      float fbm(vec2 p){float f=0.,a=.5;for(int i=0;i<4;i++){f+=a*noise(p);p=mat2(1.73,1.12,-1.12,1.73)*p+7.1;a*=.5;}return f;}
      void main(){
        vec2 q=vWorld.xz;
        float warp=fbm(q*vec2(.065,.10)+vec2(uTime*.009,0.));
        float reflectionAxis=-11.8+q.y*.496;
        float band=exp(-pow((q.x-reflectionAxis)/15.0,2.0));
        float broken=fbm(q*vec2(.11,.46)+warp*2.8);
        float streak=noise(q*vec2(.72,6.2)+vec2(warp*3.0,uTime*.025));
        float fine=noise(q*vec2(1.8,13.0)+warp*4.0);
        float glint=band*smoothstep(.43,.67,broken)*smoothstep(.52,.74,streak+fine*.25);
        vec3 c=mix(vec3(.074,.052,.043),vec3(.22,.128,.072),.18+warp*.35);
        c+=vec3(1.85,.92,.30)*glint*2.35;
        float edge=smoothstep(0.,.12,vUv.x)*(1.-smoothstep(.88,1.,vUv.x))*smoothstep(0.,.12,vUv.y)*(1.-smoothstep(.88,1.,vUv.y));
        gl_FragColor=vec4(c,edge*.90);
      }`, side: THREE.DoubleSide, transparent: true, depthWrite: false
  });
  const lake = new THREE.Mesh(new THREE.PlaneGeometry(180, 80, 88, 24), lakeMat); lake.rotation.x = -Math.PI / 2; lake.position.set(-90, 1.40, -245); group.add(lake);
  const ridges = [];
  const ridgeSpecs = [
    { z: -100, base: -10, height: 8.4, color: 0x554b43, alpha: 1 },
    { z: -148, base: -14, height: 14.4, color: 0x725d55, alpha: 1 },
    { z: -215, base: -16, height: 21.0, color: 0x8e7066, alpha: 1 },
    { z: -305, base: -21, height: 28, color: 0xaa877a, alpha: 1 },
    { z: -420, base: -24, height: 36, color: 0xc09a89, alpha: 1 }
  ];
  ridgeSpecs.forEach((r, j) => {
    const pos = [], cols = [], indices = []; const c = new THREE.Color(r.color), d = c.clone().multiplyScalar(.57);
    const count = 140;
    for (let i = 0; i < count; i++) {
      const x = -440 + i * 5.2;
      const n = softNoise(i * .16 + j * 23) * .52 + softNoise(i * .40 + j * 12) * .22 + softNoise(i * .83 + j * 31) * .12;
      const h = r.base + r.height * (.3 + n) + Math.sin(i * .055 + j) * r.height * .25;
      pos.push(x, r.base - 60, r.z, x, h, r.z + Math.sin(i * .3) * 2.0); cols.push(d.r, d.g, d.b, c.r, c.g, c.b);
      if (i < count - 1) { const k = i * 2; indices.push(k, k + 1, k + 3, k, k + 3, k + 2); }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3)); g.setIndex(indices); g.computeVertexNormals();
    const mesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, fog: false, side: THREE.DoubleSide })); mesh.name = `远山层次 ${j + 1}`; group.add(mesh); ridges.push(mesh);
  });
  // Angular pieces of fallen masonry and gravel, merged as instances.
  const rubbleGeo = new THREE.DodecahedronGeometry(1, 0); const rubble = new THREE.InstancedMesh(rubbleGeo, materials.darkStone, 460);
  const dummy = new THREE.Object3D(), tint = new THREE.Color();
  for (let i = 0; i < 460; i++) {
    let x, z, y;
    if (i < 200) { x = -13.5 + random() * 19; z = -3 + random() * 18; y = -.015; }
    else {
      x = -6.1 + random() * 16; z = -5.8 + random() * 16.6;
      const steps = architecture.stairInfo.steps;
      const step = steps.find(s => z <= s.zFront && z >= s.zBack) || steps[z > steps[0].zFront ? 0 : steps.length - 1];
      x = Math.max(step.xMin + .05, Math.min(step.xMax - .05, x)); y = step.top + .015;
    }
    const s = .018 + random() ** 3 * .16; dummy.position.set(x, y + s * .24, z); dummy.scale.set(s * (1 + random()), s * (.3 + random() * .4), s); dummy.rotation.set(random() * 3, random() * 6, random() * 3); dummy.updateMatrix(); rubble.setMatrixAt(i, dummy.matrix);
    tint.setHSL(.1, .07 + random() * .08, .36 + random() * .25); rubble.setColorAt(i, tint);
  }
  shadowMesh(rubble, true, true); group.add(rubble);
  return { group, lakeMat, ground, terrain };
}
