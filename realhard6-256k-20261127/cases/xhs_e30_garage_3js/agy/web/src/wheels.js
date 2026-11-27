import * as THREE from 'three';

/**
 * Builds shared geometries & materials for 16" BBS RS silver basketweave mesh wheels
 * and standalone workshop radial tires.
 */
export function createWheelFactory(detailTextures) {
  const { roundelTex, tireTreadTex } = detailTextures;

  // Materials
  const tireSideMat = new THREE.MeshStandardMaterial({
    color: 0x1b1d20,
    roughness: 0.78,
    metalness: 0.05,
  });

  const tireTreadMat = new THREE.MeshStandardMaterial({
    map: tireTreadTex,
    bumpMap: tireTreadTex,
    bumpScale: 0.008,
    color: 0xffffff,
    roughness: 0.82,
    metalness: 0.04,
  });

  // High-polish machined aluminum outer dish lip
  const polishedLipMat = new THREE.MeshPhysicalMaterial({
    color: 0xeaf0f6,
    metalness: 0.96,
    roughness: 0.08,
    clearcoat: 0.5,
    clearcoatRoughness: 0.06,
    envMapIntensity: 1.55,
  });

  // Bright silver metallic painted BBS basketweave center
  const silverMeshMat = new THREE.MeshPhysicalMaterial({
    color: 0xd6dce4,
    metalness: 0.86,
    roughness: 0.20,
    clearcoat: 0.35,
    clearcoatRoughness: 0.15,
    envMapIntensity: 1.35,
  });

  const darkBarrelMat = new THREE.MeshStandardMaterial({
    color: 0x2a2e34,
    metalness: 0.65,
    roughness: 0.45,
  });

  const brakeDiscMat = new THREE.MeshStandardMaterial({
    color: 0x7d828a,
    metalness: 0.85,
    roughness: 0.32,
  });

  const caliperMat = new THREE.MeshStandardMaterial({
    color: 0x3b4048,
    metalness: 0.55,
    roughness: 0.48,
  });

  const roundelMat = new THREE.MeshStandardMaterial({
    map: roundelTex,
    roughness: 0.22,
    metalness: 0.35,
  });

  // 1. Lathed tire carcass profile (revolved around Y, then rotated X +90° -> axis along Z)
  // Outer radius = 0.308 m, rim bead = 0.206 m, width = 0.215 m (z from -0.107 to +0.107)
  const tirePts = [
    new THREE.Vector2(0.205, -0.098),
    new THREE.Vector2(0.232, -0.106),
    new THREE.Vector2(0.276, -0.108),
    new THREE.Vector2(0.302, -0.094),
    new THREE.Vector2(0.308, -0.072),
    new THREE.Vector2(0.308, +0.072),
    new THREE.Vector2(0.302, +0.094),
    new THREE.Vector2(0.276, +0.108),
    new THREE.Vector2(0.232, +0.106),
    new THREE.Vector2(0.205, +0.098),
  ];
  const tireCarcassGeo = new THREE.LatheGeometry(tirePts, 56);
  tireCarcassGeo.rotateX(Math.PI * 0.5);

  // Outer tread belt sleeve for crisp circumferential tread grooves
  const treadBeltGeo = new THREE.CylinderGeometry(0.3086, 0.3086, 0.148, 56, 1, true);
  treadBeltGeo.rotateX(Math.PI * 0.5);

  // Sidewall raised subtle ring rib
  const sidewallRibGeo = new THREE.TorusGeometry(0.258, 0.0028, 8, 56);

  // 2. Stepped polished BBS RS deep-dish lip (z from +0.042 out to +0.102)
  const lipPts = [
    new THREE.Vector2(0.168, +0.036),
    new THREE.Vector2(0.175, +0.042),
    new THREE.Vector2(0.178, +0.062),
    new THREE.Vector2(0.192, +0.066),
    new THREE.Vector2(0.196, +0.088),
    new THREE.Vector2(0.211, +0.096),
    new THREE.Vector2(0.213, +0.102),
    new THREE.Vector2(0.205, +0.103),
    new THREE.Vector2(0.198, +0.096),
  ];
  const lipGeo = new THREE.LatheGeometry(lipPts, 56);
  lipGeo.rotateX(Math.PI * 0.5);

  // Inner dark wheel barrel
  const barrelGeo = new THREE.CylinderGeometry(0.192, 0.192, 0.185, 40, 1, true);
  barrelGeo.rotateX(Math.PI * 0.5);

  // Center waffle plate & hub ring
  const waffleRingGeo = new THREE.RingGeometry(0.045, 0.084, 36);
  const outerMeshRingGeo = new THREE.TorusGeometry(0.171, 0.0065, 10, 48);
  const hexNutGeo = new THREE.CylinderGeometry(0.036, 0.041, 0.024, 6);
  hexNutGeo.rotateX(Math.PI * 0.5);
  const capDiscGeo = new THREE.CircleGeometry(0.026, 28);

  // Individual spoke & assembly bolt geometries
  const spokeLen = 0.108;
  const spokeGeo = new THREE.BoxGeometry(0.0082, spokeLen, 0.0095);
  const rimBoltGeo = new THREE.CylinderGeometry(0.0028, 0.0028, 0.006, 6);
  rimBoltGeo.rotateX(Math.PI * 0.5);

  // Brake disc & caliper
  const rotorGeo = new THREE.CylinderGeometry(0.148, 0.148, 0.018, 36);
  rotorGeo.rotateX(Math.PI * 0.5);
  const caliperGeo = new THREE.BoxGeometry(0.068, 0.115, 0.052);

  /**
   * Creates a complete mounted 16" BBS RS wheel + tire assembly.
   * Outer dish faces +Z by default (flip rotation.y = Math.PI for left -Z side of car).
   */
  function createBBSWheel({ includeBrakes = true } = {}) {
    const group = new THREE.Group();

    // Tire carcass + grooved tread sleeve
    const carcass = new THREE.Mesh(tireCarcassGeo, tireSideMat);
    carcass.castShadow = true;
    carcass.receiveShadow = true;
    group.add(carcass);

    const tread = new THREE.Mesh(treadBeltGeo, tireTreadMat);
    tread.castShadow = true;
    group.add(tread);

    const ribOut = new THREE.Mesh(sidewallRibGeo, tireSideMat);
    ribOut.position.z = 0.1065;
    group.add(ribOut);

    // Inner wheel barrel
    const barrel = new THREE.Mesh(barrelGeo, darkBarrelMat);
    barrel.position.z = 0.0;
    group.add(barrel);

    // Stepped polished aluminum outer dish
    const lip = new THREE.Mesh(lipGeo, polishedLipMat);
    lip.castShadow = true;
    group.add(lip);

    // Basketweave center hub + 32 interwoven cross-spokes
    const centerGroup = new THREE.Group();
    centerGroup.position.z = 0.052;

    const waffle = new THREE.Mesh(waffleRingGeo, silverMeshMat);
    waffle.position.z = 0.008;
    centerGroup.add(waffle);

    const meshPerimeter = new THREE.Mesh(outerMeshRingGeo, silverMeshMat);
    meshPerimeter.position.z = -0.004;
    centerGroup.add(meshPerimeter);

    // 16 pairs of cross-woven Y/lattice spokes (32 spokes total)
    const numPairs = 16;
    for (let i = 0; i < numPairs; i++) {
      const baseAngle = (i / numPairs) * Math.PI * 2;
      for (const dir of [-1, 1]) {
        const sp = new THREE.Mesh(spokeGeo, silverMeshMat);
        const rMid = 0.123;
        const offsetAng = baseAngle + dir * 0.075;
        sp.position.set(
          Math.cos(offsetAng) * rMid,
          Math.sin(offsetAng) * rMid,
          dir * 0.0022
        );
        // Lean tangentially by ~26° to weave into true BBS cross-mesh diamonds!
        sp.rotation.z = offsetAng - Math.PI * 0.5 + dir * 0.44;
        // Subtle dish concavity tilt
        sp.rotation.x = 0.08;
        centerGroup.add(sp);
      }
    }

    // 24 perimeter 3-piece assembly bolts
    for (let b = 0; b < 24; b++) {
      const ba = (b / 24) * Math.PI * 2;
      const bolt = new THREE.Mesh(rimBoltGeo, polishedLipMat);
      bolt.position.set(Math.cos(ba) * 0.172, Math.sin(ba) * 0.172, 0.003);
      centerGroup.add(bolt);
    }

    // Central BBS hex nut + BMW Roundel emblem cap
    const hexNut = new THREE.Mesh(hexNutGeo, polishedLipMat);
    hexNut.position.z = 0.015;
    centerGroup.add(hexNut);

    const cap = new THREE.Mesh(capDiscGeo, roundelMat);
    cap.position.z = 0.0278;
    centerGroup.add(cap);

    group.add(centerGroup);

    // Brake disc & caliper tucked behind the spokes
    if (includeBrakes) {
      const brakeGroup = new THREE.Group();
      brakeGroup.position.z = 0.012;
      const rotor = new THREE.Mesh(rotorGeo, brakeDiscMat);
      brakeGroup.add(rotor);

      const caliper = new THREE.Mesh(caliperGeo, caliperMat);
      caliper.position.set(-0.105, 0.035, 0.008);
      caliper.rotation.z = -0.32;
      brakeGroup.add(caliper);
      group.add(brakeGroup);
    }

    return group;
  }

  // Hollow unmounted radial tire for workshop tire rack
  const hollowTirePts = [
    new THREE.Vector2(0.205, +0.068),
    new THREE.Vector2(0.205, -0.098),
    new THREE.Vector2(0.236, -0.108),
    new THREE.Vector2(0.282, -0.108),
    new THREE.Vector2(0.308, -0.075),
    new THREE.Vector2(0.308, +0.075),
    new THREE.Vector2(0.282, +0.108),
    new THREE.Vector2(0.236, +0.108),
    new THREE.Vector2(0.205, +0.098),
    new THREE.Vector2(0.205, -0.068),
  ];
  const unmountedGeo = new THREE.LatheGeometry(hollowTirePts, 40);
  unmountedGeo.rotateX(Math.PI * 0.5);

  function createUnmountedTire() {
    const g = new THREE.Group();
    const carcass = new THREE.Mesh(unmountedGeo, tireSideMat);
    carcass.castShadow = true;
    carcass.receiveShadow = true;
    g.add(carcass);
    const tread = new THREE.Mesh(treadBeltGeo, tireTreadMat);
    tread.castShadow = true;
    tread.receiveShadow = true;
    g.add(tread);
    return g;
  }

  return {
    createBBSWheel,
    createUnmountedTire,
    polishedLipMat,
    silverMeshMat,
  };
}
