// Shared PBR materials
import * as THREE from 'three';
import { noiseTex } from './textures.js';

const P = (o) => new THREE.MeshPhysicalMaterial(o);
const S = (o) => new THREE.MeshStandardMaterial(o);
const flake = noiseTex(256, 60, 128, 5); flake.repeat.set(8, 8);

export const M = {
  // deep grey-blue metallic paint (Delphin / Lachssilber-ish) with clearcoat
  paint: P({ color: 0x2c3442, metalness: 0.55, roughness: 0.38, clearcoat: 1.0, clearcoatRoughness: 0.06,
    roughnessMap: flake, envMapIntensity: 1.1 }),
  trimBlack: S({ color: 0x0d0e10, roughness: 0.55, metalness: 0.1 }),
  plasticBlack: S({ color: 0x15161a, roughness: 0.7, metalness: 0.0 }),
  rubber: S({ color: 0x0b0b0b, roughness: 0.85 }),
  chrome: S({ color: 0xffffff, metalness: 1.0, roughness: 0.08 }),
  alloy: P({ color: 0xd2d6da, metalness: 1.0, roughness: 0.22, clearcoat: 0.6, clearcoatRoughness: 0.15 }),
  alloyDark: S({ color: 0x8f959b, metalness: 1.0, roughness: 0.35 }),
  glass: P({ color: 0x0f1418, metalness: 0.0, roughness: 0.03, transparent: true, opacity: 0.55,
    clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 1.6, depthWrite: false }),
  lensGlass: P({ color: 0xe8eef2, metalness: 0.0, roughness: 0.04, transparent: true, opacity: 0.32,
    clearcoat: 1, envMapIntensity: 2.0, depthWrite: false }),
  reflector: S({ color: 0xe9ecef, metalness: 1.0, roughness: 0.14 }),
  amber: P({ color: 0xff8a1e, roughness: 0.2, emissive: 0x6a2c00, emissiveIntensity: 0.6, transparent: true, opacity: 0.92 }),
  tailRed: P({ color: 0x8a0c0c, roughness: 0.15, emissive: 0x300000, clearcoat: 1 }),
  underbody: S({ color: 0x24262a, roughness: 0.85, metalness: 0.2 }),
  steelDark: S({ color: 0x3a3d42, roughness: 0.5, metalness: 0.8 }),
  exhaust: S({ color: 0x5d5650, roughness: 0.6, metalness: 0.7 }),
  leather: S({ color: 0x1b1c1f, roughness: 0.62 }),
  cloth: S({ color: 0x2a2c33, roughness: 0.95 }),
  carpet: S({ color: 0x18191c, roughness: 1.0 }),
  dash: S({ color: 0x121315, roughness: 0.75 }),
  liftBlue: P({ color: 0x0f4fb8, roughness: 0.32, metalness: 0.25, clearcoat: 0.6, clearcoatRoughness: 0.2 }),
  liftSteel: S({ color: 0x6e737a, roughness: 0.4, metalness: 0.85 }),
  padRubber: S({ color: 0x141414, roughness: 0.9 }),
  yellow: S({ color: 0xf2c218, roughness: 0.5 }),
  cabinet: P({ color: 0x1d1f23, roughness: 0.35, metalness: 0.5, clearcoat: 0.4 }),
  cabinetRed: P({ color: 0x8e1616, roughness: 0.35, metalness: 0.4, clearcoat: 0.4 }),
  shelf: S({ color: 0x23262b, roughness: 0.55, metalness: 0.6 }),
  shelfBeam: S({ color: 0x2a5a9e, roughness: 0.45, metalness: 0.5 }),
  tire: S({ color: 0x121212, roughness: 0.88 }),
  wood: S({ color: 0xb08d5f, roughness: 0.85 }),
  cardboard: S({ color: 0xb9946a, roughness: 0.95 }),
  white: S({ color: 0xe9e6df, roughness: 0.6 }),
  engineBlock: S({ color: 0x7d7f80, roughness: 0.55, metalness: 0.6 }),
  engineCover: P({ color: 0x9a9fa5, roughness: 0.3, metalness: 0.9, clearcoat: 0.3 }),
  copper: S({ color: 0xb06a3c, roughness: 0.35, metalness: 1.0 }),
  frameWhite: S({ color: 0xeeeeea, roughness: 0.5, metalness: 0.2 }),
};
