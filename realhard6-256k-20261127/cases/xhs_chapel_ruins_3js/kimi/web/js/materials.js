import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export function rng(seed = 1) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}
const fract = x => x - Math.floor(x);
export const hash = (x, y = 0, z = 0) => fract(Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453123);
function noise(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y); const fx = x - ix, fy = y - iy;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const a = hash(ix, iy), b = hash(ix + 1, iy), c = hash(ix, iy + 1), d = hash(ix + 1, iy + 1);
  return THREE.MathUtils.lerp(THREE.MathUtils.lerp(a, b, u), THREE.MathUtils.lerp(c, d, u), v);
}
function fbm(x, y) { let n = 0, a = .5; for (let i = 0; i < 5; i++) { n += noise(x, y) * a; x = x * 2.03 + 13.1; y = y * 2.03 - 9.3; a *= .5; } return n; }

function texturePair(kind, size = 512) {
  const albedo = document.createElement('canvas'); albedo.width = albedo.height = size;
  const bump = document.createElement('canvas'); bump.width = bump.height = size;
  const a = albedo.getContext('2d').createImageData(size, size), b = bump.getContext('2d').createImageData(size, size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = x / size, v = y / size; let r, g, bl, h;
    const big = fbm(u * 8.1, v * 8.1), mid = fbm(u * 38, v * 38), fine = noise(u * 260, v * 260);
    if (kind === 'stone') {
      const pores = hash(x, y) > .972 ? -.16 : 0;
      const crackN = Math.abs(noise(u * 14 + big * 2, v * 16) - .5);
      const crack = crackN < .007 ? -.20 * (1 - crackN / .007) : 0;
      const mineral = noise(u * 91 + mid * 4, v * 87 - big * 3);
      const tone = (big - .5) * 40 + (mid - .5) * 31 + (fine - .5) * 20 + (mineral - .5) * 13 + pores * 100 + crack * 110;
      r = 142 + tone; g = 133 + tone * .96; bl = 117 + tone * .86;
      const lichen = fbm(u * 19 + 13, v * 19 + 7);
      if (lichen > .565) { const q = Math.min(.9, (lichen - .565) * 7); r = THREE.MathUtils.lerp(r, 169 + fine * 23, q); g = THREE.MathUtils.lerp(g, 170 + fine * 22, q); bl = THREE.MathUtils.lerp(bl, 155 + fine * 18, q); }
      const moss = fbm(u * 9 - 5, v * 8 + 23);
      if (moss > .68) { const q = Math.min(.58, (moss - .67) * 4); r = THREE.MathUtils.lerp(r, 57, q); g = THREE.MathUtils.lerp(g, 64, q); bl = THREE.MathUtils.lerp(bl, 38, q); }
      h = 117 + (mid - .5) * 35 + (fine - .5) * 25 + pores * 90 + crack * 80;
    } else if (kind === 'earth') {
      const grit = hash(x, y) > .91 ? 35 : 0;
      const tone = (big - .5) * 48 + (mid - .5) * 27 + (fine - .5) * 35 + grit;
      r = 75 + tone; g = 66 + tone * .90; bl = 52 + tone * .71; h = 105 + (mid - .5) * 55 + fine * 55;
    } else if (kind === 'wood') {
      const lines = Math.sin((u + noise(u * 4, v * 3) * .022) * 210 + Math.sin(v * 10) * 2);
      const knot = fbm(u * 9, v * 3);
      const t = lines * 8 + (big - .5) * 35 + knot * 10 + (fine - .5) * 14;
      r = 43 + t; g = 32 + t * .7; bl = 23 + t * .49; h = 115 + lines * 22 + (mid - .5) * 23;
    } else {
      const line = Math.sin(u * 130 + noise(u * 9, v * 7) * 8) * 14;
      const t = (big - .5) * 48 + (mid - .5) * 30 + line + (fine - .5) * 15;
      r = 68 + t; g = 59 + t * .87; bl = 46 + t * .67; h = 100 + (mid - .5) * 35 + line * 2;
    }
    const i = (y * size + x) * 4;
    a.data[i] = r; a.data[i + 1] = g; a.data[i + 2] = bl; a.data[i + 3] = 255;
    b.data[i] = b.data[i + 1] = b.data[i + 2] = h; b.data[i + 3] = 255;
  }
  albedo.getContext('2d').putImageData(a, 0, 0); bump.getContext('2d').putImageData(b, 0, 0);
  const map = new THREE.CanvasTexture(albedo), bumpMap = new THREE.CanvasTexture(bump);
  map.colorSpace = THREE.SRGBColorSpace;
  for (const t of [map, bumpMap]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; }
  return { map, bumpMap };
}

// World-space weathering stays continuous across separate blocks and instances.
export function ageStone(material, amount = 1) {
  material.onBeforeCompile = shader => {
    shader.uniforms.uAgeAmount = { value: amount };
    shader.vertexShader = 'varying vec3 vAgeWorld;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <worldpos_vertex>', `
      #include <worldpos_vertex>
      vec4 agePosition = vec4(transformed, 1.0);
      #ifdef USE_INSTANCING
        agePosition = instanceMatrix * agePosition;
      #endif
      vAgeWorld = (modelMatrix * agePosition).xyz;
    `);
    shader.fragmentShader = `
      varying vec3 vAgeWorld;
      uniform float uAgeAmount;
      float ageHash(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
      float ageNoise(vec3 p){
        vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
        return mix(mix(mix(ageHash(i),ageHash(i+vec3(1,0,0)),f.x),mix(ageHash(i+vec3(0,1,0)),ageHash(i+vec3(1,1,0)),f.x),f.y),mix(mix(ageHash(i+vec3(0,0,1)),ageHash(i+vec3(1,0,1)),f.x),mix(ageHash(i+vec3(0,1,1)),ageHash(i+vec3(1,1,1)),f.x),f.y),f.z);
      }
      float ageFbm(vec3 p){float f=0.,a=.5;for(int i=0;i<4;i++){f+=a*ageNoise(p);p=p*2.06+vec3(3.8,1.9,7.1);a*=.5;}return f;}
    ` + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `
      #include <color_fragment>
      vec3 ap=vAgeWorld*vec3(1.35,1.7,1.5);
      float broad=ageFbm(ap*.58);
      float grit=ageHash(floor(vAgeWorld*96.));
      float channels=ageNoise(vec3(vAgeWorld.x*10.5,vAgeWorld.y*.42,vAgeWorld.z*9.2));
      float streak=pow(smoothstep(.50,.82,channels),2.2);
      float rain=streak*smoothstep(.28,.79,ageFbm(ap*.41+7.3));
      float lime=smoothstep(.62,.82,ageFbm(ap*1.1+16.4));
      float lichen=smoothstep(.66,.78,ageFbm(ap*3.6+vec3(13.,7.,4.)));
      diffuseColor.rgb*=1.-uAgeAmount*(.035+.10*broad+.13*rain);
      diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.25,.242,.202),lime*.25*uAgeAmount);
      diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.135,.148,.102),lichen*.25*uAgeAmount);
      float crustRaw=ageFbm(vAgeWorld*vec3(3.8,4.4,3.6)+vec3(2.1,8.7,1.3));
      float crustBreak=ageNoise(vAgeWorld*21.0);
      float crust=smoothstep(.56,.67,crustRaw)*smoothstep(.30,.74,crustBreak);
      diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.29,.28,.238),crust*.30*uAgeAmount);
      float pepper=ageHash(floor(vAgeWorld*145.));
      diffuseColor.rgb*=.93+grit*.045+pepper*.025;
    `);
  };
  material.customProgramCacheKey = () => `world-stone-age-${amount}`;
  return material;
}

export function createMaterials() {
  const stone = texturePair('stone'), earth = texturePair('earth'), wood = texturePair('wood'), bark = texturePair('bark');
  stone.map.repeat.set(1.25, 1.0); stone.bumpMap.repeat.copy(stone.map.repeat);
  earth.map.repeat.set(13, 13); earth.bumpMap.repeat.copy(earth.map.repeat);
  wood.map.repeat.set(1, 2); wood.bumpMap.repeat.copy(wood.map.repeat);
  bark.map.repeat.set(3, 5); bark.bumpMap.repeat.copy(bark.map.repeat);
  const stoneMat = new THREE.MeshStandardMaterial({ ...stone, color: 0xd8d0c5, roughness: .98, bumpScale: .052 });
  const darkStone = stoneMat.clone(); darkStone.color.set(0xb8afa2); darkStone.bumpScale = .048;
  const innerStone = stoneMat.clone(); innerStone.color.set(0x514a41); innerStone.bumpScale = .045;
  const mortar = new THREE.MeshStandardMaterial({ ...stone, color: 0x82796b, roughness: 1, bumpScale: .050 });
  const stepMat = stoneMat.clone(); stepMat.color.set(0xc9bfb0); stepMat.bumpScale = .050;
  const earthMat = new THREE.MeshStandardMaterial({ ...earth, roughness: 1, bumpScale: .21, color: 0x878078 });
  const woodMat = new THREE.MeshStandardMaterial({ ...wood, roughness: .92, bumpScale: .085, color: 0x726250 });
  const barkMat = new THREE.MeshStandardMaterial({ ...bark, roughness: 1, bumpScale: .11, color: 0x65604b });
  const crackMat = new THREE.MeshStandardMaterial({ color: 0x4a4033, roughness: 1, transparent: true, opacity: .72, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
  ageStone(stoneMat, .90);
  ageStone(darkStone, 1.12);
  ageStone(innerStone, .62);
  ageStone(mortar, .8);
  ageStone(stepMat, 1.08);
  return { stoneMat, darkStone, innerStone, mortar, stepMat, earthMat, woodMat, barkMat, crackMat, textures: { stone, earth, wood, bark } };
}

export function worldUV(geometry, scale = .65, seed = 1) {
  const p = geometry.attributes.position;
  if (!geometry.attributes.normal) geometry.computeVertexNormals();
  const n = geometry.attributes.normal, uv = new Float32Array(p.count * 2);
  const ox = hash(seed, 4.7) * 9.7, oy = hash(seed, 9.1) * 8.3;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const nx = Math.abs(n.getX(i)), ny = Math.abs(n.getY(i)), nz = Math.abs(n.getZ(i));
    let u, v;
    if (ny >= nx && ny >= nz) { u = x; v = z; }
    else if (nx >= nz) { u = z; v = y; }
    else { u = x; v = y; }
    uv[i * 2] = u * scale + ox; uv[i * 2 + 1] = v * scale + oy;
  }
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return geometry;
}

export function wornBox(w, h, d, radius = .04, seed = 1) {
  const g = new RoundedBoxGeometry(w, h, d, 2, Math.min(radius, w / 4, h / 4, d / 4));
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    p.setXYZ(i, x + (hash(x * 13, y * 17, seed) - .5) * radius * .45,
      y + (hash(y * 19, z * 11, seed + 1) - .5) * radius * .36,
      z + (hash(z * 15, x * 9, seed + 2) - .5) * radius * .45);
  }
  g.computeVertexNormals(); return worldUV(g, .65, seed);
}

export function shadowMesh(mesh, cast = true, receive = true) { mesh.castShadow = cast; mesh.receiveShadow = receive; return mesh; }
