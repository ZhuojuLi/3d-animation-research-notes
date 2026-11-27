import * as THREE from 'three';

/**
 * Builds the working Ravaglioli Blue Two-Post Asymmetric Lift:
 * - Two heavy cobalt-blue H/box steel columns anchored to the concrete floor
 * - Vertical Ravaglioli branding, safety decals, control switches, hoses, rubber door guards
 * - Sliding lift carriages, hydraulic cylinder rams, and 4 two-stage telescoping swing arms
 *   with threaded round rubber jacking pads aligned to the BMW E30's factory sill jack points.
 */
export function createTwoPostLift({ liftDecals }) {
  const root = new THREE.Group();
  const { logoTex, safetyTex } = liftDecals;

  // Authentic Ravaglioli industrial cobalt blue painted steel
  const liftBlueMat = new THREE.MeshPhysicalMaterial({
    color: 0x0c4c8a,
    metalness: 0.42,
    roughness: 0.34,
    clearcoat: 0.30,
    clearcoatRoughness: 0.25,
    envMapIntensity: 1.15,
  });

  const liftDarkBlueMat = new THREE.MeshStandardMaterial({
    color: 0x083461,
    metalness: 0.50,
    roughness: 0.48,
  });

  const steelMat = new THREE.MeshStandardMaterial({
    color: 0xb8c0ca,
    metalness: 0.88,
    roughness: 0.22,
  });

  const darkRubberMat = new THREE.MeshStandardMaterial({
    color: 0x17191c,
    roughness: 0.85,
    metalness: 0.06,
  });

  const yellowBoxMat = new THREE.MeshStandardMaterial({
    color: 0xdca61e,
    roughness: 0.42,
    metalness: 0.15,
  });

  const POST_H = 4.12;
  // Calibrated post positions straddling the E30 (matching reference-0.png framing & door walkway!)
  const NEAR_POST = { x: -0.68, z: +1.58 }; // Right (+Z) post -> stands cleanly at x≈3..8% with full Ravaglioli text!
  const FAR_POST  = { x: +0.66, z: -1.66 }; // Left (-Z) post -> stands behind front-left fender (x≈51.5%)

  function buildColumn(pos, isNear) {
    const colGroup = new THREE.Group();
    colGroup.position.set(pos.x, 0, pos.z);

    // Heavy floor baseplate + 8 anchor bolts + gusset ribs
    const basePlate = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.028, 0.54), liftBlueMat);
    basePlate.position.y = 0.014;
    basePlate.receiveShadow = true;
    basePlate.castShadow = true;
    colGroup.add(basePlate);

    for (const bx of [-0.21, 0.21]) {
      for (const bz of [-0.22, -0.07, 0.07, 0.22]) {
        const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.032, 6), steelMat);
        bolt.position.set(bx, 0.03, bz);
        colGroup.add(bolt);
      }
    }

    // Main C-channel column flanges & outer web (open toward car interior so carriage slides inside!)
    const inDir = isNear ? -1 : 1; // direction toward car centerline Z=0
    const backWeb = new THREE.Mesh(new THREE.BoxGeometry(0.25, POST_H, 0.045), liftBlueMat);
    backWeb.position.set(0, POST_H * 0.5, -inDir * 0.115);
    backWeb.castShadow = true;
    backWeb.receiveShadow = true;
    colGroup.add(backWeb);

    for (const fx of [-0.105, 0.105]) {
      const flange = new THREE.Mesh(new THREE.BoxGeometry(0.045, POST_H, 0.27), liftBlueMat);
      flange.position.set(fx, POST_H * 0.5, 0);
      flange.castShadow = true;
      flange.receiveShadow = true;
      colGroup.add(flange);

      // Triangular base gusset plate
      const gusset = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.28, 0.16), liftBlueMat);
      gusset.position.set(fx, 0.14, -inDir * 0.16);
      gusset.rotation.x = inDir * 0.35;
      colGroup.add(gusset);
    }

    // Inner hydraulic cylinder barrel & chrome piston rod
    const cylBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, 2.05, 16), liftDarkBlueMat);
    cylBarrel.position.set(0, 1.05, -inDir * 0.03);
    colGroup.add(cylBarrel);

    const cylRod = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 1.95, 16), steelMat);
    cylRod.position.set(0, 2.15, -inDir * 0.03);
    colGroup.add(cylRod);

    // Black rubber door-guard bumper strip on inner face of column
    const doorGuard = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.58, 0.032), darkRubberMat);
    doorGuard.position.set(0, 0.78, inDir * 0.14);
    colGroup.add(doorGuard);

    if (isNear) {
      // Ravaglioli vertical logo & stacked safety warning placards on the camera-facing (+X) flange!
      const logoPlane = new THREE.Mesh(
        new THREE.PlaneGeometry(0.14, 0.56),
        new THREE.MeshStandardMaterial({ map: logoTex, roughness: 0.35, metalness: 0.2 })
      );
      // Place on outer +X/+Z corner web facing camera:
      // Let's add a solid front cover strip across X=+0.128 so the column face looks wide & clean like ref!
      const frontFacePlate = new THREE.Mesh(new THREE.BoxGeometry(0.018, POST_H, 0.265), liftBlueMat);
      frontFacePlate.position.set(0.122, POST_H * 0.5, 0);
      frontFacePlate.castShadow = true;
      colGroup.add(frontFacePlate);

      logoPlane.position.set(0.133, 2.22, 0.01);
      logoPlane.rotation.y = Math.PI * 0.5;
      colGroup.add(logoPlane);

      const safetyPlane = new THREE.Mesh(
        new THREE.PlaneGeometry(0.155, 0.42),
        new THREE.MeshStandardMaterial({ map: safetyTex, roughness: 0.38 })
      );
      safetyPlane.position.set(0.133, 1.58, 0.01);
      safetyPlane.rotation.y = Math.PI * 0.5;
      colGroup.add(safetyPlane);

      // Control lever box & hydraulic hoses on outer (-X / +Z) side (left edge of reference-0.png!)
      const ctrlBox = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.34, 0.16), darkRubberMat);
      ctrlBox.position.set(-0.16, 1.62, 0.14);
      colGroup.add(ctrlBox);

      const lever = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.24, 10), steelMat);
      lever.position.set(-0.18, 1.82, 0.18);
      lever.rotation.z = 0.45;
      colGroup.add(lever);

      const hosePipe = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, POST_H - 0.3, 10), darkRubberMat);
      hosePipe.position.set(-0.14, POST_H * 0.5, 0.12);
      colGroup.add(hosePipe);
    } else {
      // Far column accessories: yellow rotary power switch box, motor housing, coiled air hose (x≈53..56% in ref!)
      const motorUnit = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.095, 0.48, 16), darkRubberMat);
      motorUnit.position.set(0.18, 2.42, -0.05);
      colGroup.add(motorUnit);

      const switchBox = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.18, 0.12), yellowBoxMat);
      switchBox.position.set(0.17, 1.88, 0.06);
      colGroup.add(switchBox);

      // Coiled hose/cable loops hanging beside far post
      for (let c = 0; c < 3; c++) {
        const loop = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.012, 8, 24), darkRubberMat);
        loop.position.set(0.21, 1.98 - c * 0.06, -0.06);
        loop.rotation.y = 0.4;
        colGroup.add(loop);
      }
    }

    root.add(colGroup);
    return { colGroup, cylRod };
  }

  const nearCol = buildColumn(NEAR_POST, true);
  const farCol = buildColumn(FAR_POST, false);

  // Overhead synchronization cable bridge connecting the two column tops
  {
    const p0 = new THREE.Vector3(NEAR_POST.x, POST_H - 0.05, NEAR_POST.z);
    const p1 = new THREE.Vector3(FAR_POST.x, POST_H - 0.05, FAR_POST.z);
    const span = p0.distanceTo(p1);
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.11, span + 0.30), liftBlueMat);
    bridge.position.copy(p0).add(p1).multiplyScalar(0.5);
    bridge.lookAt(p1);
    root.add(bridge);
  }

  // ============================================================================
  // MOVING LIFT CARRIAGES & 4 TELESCOPING SWING ARMS
  // ============================================================================
  const carriageNear = new THREE.Group();
  const carriageFar = new THREE.Group();
  root.add(carriageNear, carriageFar);

  function populateCarriage(cGroup, postPos, isNear) {
    const inDir = isNear ? -1 : 1;
    // Heavy sliding carriage yoke inside column
    const yoke = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.56, 0.24), liftBlueMat);
    yoke.position.set(postPos.x, 0.36, postPos.z + inDir * 0.06);
    yoke.castShadow = true;
    cGroup.add(yoke);

    // Lower swing-arm hinge bracket ears
    const ear = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.11, 0.18), liftBlueMat);
    ear.position.set(postPos.x, 0.125, postPos.z + inDir * 0.16);
    ear.castShadow = true;
    cGroup.add(ear);
  }

  populateCarriage(carriageNear, NEAR_POST, true);
  populateCarriage(carriageFar, FAR_POST, false);

  /**
   * Builds a two-stage telescoping heavy steel swing arm from (startX, startZ) to car jack pad (padX, padZ)
   */
  function buildSwingArm(parentGroup, startX, startZ, padX, padZ) {
    const armGroup = new THREE.Group();
    const dx = padX - startX;
    const dz = padZ - startZ;
    const totalLen = Math.hypot(dx, dz);
    const yaw = Math.atan2(dx, dz); // aligns +Z with (dx, dz)

    armGroup.position.set(startX, 0.105, startZ);
    armGroup.rotation.y = yaw;

    // Hinge pin cylinder
    const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.14, 14), steelMat);
    pin.position.y = 0.02;
    armGroup.add(pin);

    // Outer thick blue box tube (62% of reach)
    const outerLen = totalLen * 0.62;
    const outerTube = new THREE.Mesh(new THREE.BoxGeometry(0.115, 0.082, outerLen), liftBlueMat);
    outerTube.position.set(0, 0.0, outerLen * 0.5);
    outerTube.castShadow = true;
    outerTube.receiveShadow = true;
    armGroup.add(outerTube);

    // Inner telescoping stage tube (remaining reach)
    const innerLen = totalLen * 0.48;
    const innerTube = new THREE.Mesh(new THREE.BoxGeometry(0.086, 0.062, innerLen), liftBlueMat);
    innerTube.position.set(0, -0.004, totalLen - innerLen * 0.5);
    innerTube.castShadow = true;
    innerTube.receiveShadow = true;
    armGroup.add(innerTube);

    // Threaded steel screw adapter + round black rubber jacking pad at tip (totalLen)
    const screw = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.055, 12), steelMat);
    screw.position.set(0, 0.036, totalLen);
    armGroup.add(screw);

    const rubberPad = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.068, 0.026, 20), darkRubberMat);
    rubberPad.position.set(0, 0.062, totalLen);
    rubberPad.castShadow = true;
    armGroup.add(rubberPad);

    parentGroup.add(armGroup);
    return armGroup;
  }

  // Near (+Z) Front & Rear Swing Arms -> Car Right Sill Jack Points (+0.78, +0.68) and (-0.78, +0.68)
  buildSwingArm(carriageNear, NEAR_POST.x + 0.08, NEAR_POST.z - 0.16, +0.78, +0.68);
  buildSwingArm(carriageNear, NEAR_POST.x - 0.08, NEAR_POST.z - 0.16, -0.78, +0.68);

  // Far (-Z) Front & Rear Swing Arms -> Car Left Sill Jack Points (+0.78, -0.68) and (-0.78, -0.68)
  buildSwingArm(carriageFar, FAR_POST.x + 0.08, FAR_POST.z + 0.16, +0.78, -0.68);
  buildSwingArm(carriageFar, FAR_POST.x - 0.08, FAR_POST.z + 0.16, -0.78, -0.68);

  function setLiftHeight(h) {
    carriageNear.position.y = h;
    carriageFar.position.y = h;
    nearCol.cylRod.position.y = 2.15 + h * 0.5;
    farCol.cylRod.position.y = 2.15 + h * 0.5;
  }

  setLiftHeight(0);

  return {
    root,
    setLiftHeight,
  };
}
