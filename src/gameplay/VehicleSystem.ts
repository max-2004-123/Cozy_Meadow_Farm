import * as THREE from 'three';
import { CollisionSystem } from '../world/CollisionSystem';
import { SkyAndLighting } from '../world/SkyAndLighting';
import { SoundManager } from '../audio/SoundManager';
import { ParticleSystem } from '../effects/ParticleSystem';
import { InteractableTarget, InteractionInfo } from '../types';

export class VehicleSystem {
  public group = new THREE.Group();
  public interactables: InteractableTarget[] = [];
  public isDriving = false;

  private truck = new THREE.Group();
  private steeringWheel = new THREE.Group();
  private speedNeedle?: THREE.Mesh;
  private frontWheelPivots: THREE.Group[] = [];
  private wheelMeshes: THREE.Object3D[] = [];
  private headlightBeams: THREE.PointLight[] = [];
  private headlightGlowMat!: THREE.MeshStandardMaterial;

  public position = new THREE.Vector3(5.6, 0, 15.8);
  public heading = Math.PI; // Facing North (-Z) along the main farm avenue!
  public speed = 0; // m/s
  private steerAngle = 0;
  private wheelSpin = 0;
  private hornCooldown = 0;
  private dustTimer = 0;

  constructor(
    scene: THREE.Scene,
    private collisions: CollisionSystem,
    private sky: SkyAndLighting,
    private sound: SoundManager,
    private particles: ParticleSystem,
    private callbacks: {
      onToast: (text: string, tone?: 'default' | 'success' | 'info' | 'celebrate') => void;
      onDriveStateChange: (driving: boolean) => void;
    }
  ) {
    this.buildPickupTruck();
    this.truck.position.copy(this.position);
    this.truck.rotation.y = this.heading;
    this.group.add(this.truck);
    scene.add(this.group);

    this.interactables.push({
      id: 'farm_pickup_truck',
      object: this.truck,
      maxDistance: 4.8,
      getInfo: () => ({
        id: 'farm_pickup_truck',
        title: 'Sunnybrook Farm Pickup',
        subtitle: 'Vintage mint-teal truck — cruise to Emerald Lake & Pine Forest!',
        actionText: 'Hop In & Drive (Click / E / F)',
        canAct: true,
        iconId: 'truck',
        badge: { text: 'Drivable Vehicle', tone: 'good' },
      }),
      interact: () => {
        this.enterTruck();
        return true;
      },
    });
  }

  private buildPickupTruck(): void {
    const bodyMat = new THREE.MeshStandardMaterial({ color: '#64bfb0', roughness: 0.3, metalness: 0.18 });
    const bodyAccent = new THREE.MeshStandardMaterial({ color: '#4da395', roughness: 0.36, metalness: 0.16 });
    const creamMat = new THREE.MeshStandardMaterial({ color: '#fff7e4', roughness: 0.38, metalness: 0.08 });
    const darkTrim = new THREE.MeshStandardMaterial({ color: '#333a40', roughness: 0.52, metalness: 0.48 });
    const chromeMat = new THREE.MeshStandardMaterial({ color: '#e4eef5', roughness: 0.18, metalness: 0.82 });
    const brassMat = new THREE.MeshStandardMaterial({ color: '#f0c85e', roughness: 0.28, metalness: 0.65 });
    const woodBedMat = new THREE.MeshStandardMaterial({ color: '#b57942', roughness: 0.82 });
    const darkWoodMat = new THREE.MeshStandardMaterial({ color: '#7d4d27', roughness: 0.78 });
    const seatMat = new THREE.MeshStandardMaterial({ color: '#a86438', roughness: 0.76 });
    const glassMat = new THREE.MeshStandardMaterial({
      color: '#c4ecff',
      transparent: true,
      opacity: 0.38,
      roughness: 0.08,
      metalness: 0.22,
    });
    const tireMat = new THREE.MeshStandardMaterial({ color: '#24272b', roughness: 0.88 });
    const tailLightMat = new THREE.MeshStandardMaterial({
      color: '#f24b3f',
      emissive: '#d62820',
      emissiveIntensity: 0.55,
      roughness: 0.25,
    });
    const amberMat = new THREE.MeshStandardMaterial({
      color: '#ffb738',
      emissive: '#e88b1a',
      emissiveIntensity: 0.35,
      roughness: 0.25,
    });
    this.headlightGlowMat = new THREE.MeshStandardMaterial({
      color: '#fff8d1',
      emissive: '#ffd573',
      emissiveIntensity: 0.42,
      roughness: 0.16,
    });
    this.sky.registerGlowMaterial(this.headlightGlowMat);

    // Local +Z is FRONT of the truck!
    // 1. Undercarriage chassis, leaf-spring axles & dual chrome exhaust pipes
    const chassis = new THREE.Mesh(new THREE.BoxGeometry(1.58, 0.22, 3.92), darkTrim);
    chassis.position.set(0, 0.45, 0);
    chassis.castShadow = true;
    this.truck.add(chassis);
    for (const az of [1.22, -1.22]) {
      const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.82, 8), darkTrim);
      axle.rotation.z = Math.PI / 2;
      axle.position.set(0, 0.42, az);
      this.truck.add(axle);
    }
    for (const ex of [-0.46, 0.46]) {
      const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.048, 0.72, 8), chromeMat);
      pipe.rotation.x = Math.PI / 2;
      pipe.position.set(ex, 0.36, -1.96);
      this.truck.add(pipe);
    }

    // 2. Sculpted Beveled Vintage Hood (ExtrudeGeometry with curved nose profile!)
    const hoodProfile = new THREE.Shape();
    hoodProfile.moveTo(0.52, 0.62);
    hoodProfile.lineTo(1.88, 0.62);
    hoodProfile.quadraticCurveTo(2.04, 0.64, 2.02, 0.88);
    hoodProfile.quadraticCurveTo(1.98, 1.18, 1.65, 1.24);
    hoodProfile.lineTo(0.52, 1.28);
    hoodProfile.closePath();
    const hoodGeo = new THREE.ExtrudeGeometry(hoodProfile, {
      depth: 1.46,
      bevelEnabled: true,
      bevelThickness: 0.1,
      bevelSize: 0.08,
      bevelSegments: 3,
    });
    hoodGeo.rotateY(-Math.PI / 2);
    hoodGeo.translate(0.73, 0, 0);
    const hood = new THREE.Mesh(hoodGeo, bodyMat);
    hood.castShadow = true;
    hood.receiveShadow = true;
    this.truck.add(hood);

    // Chrome center hood ridge trim & golden hood ornament
    const hoodStrip = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.035, 1.28), chromeMat);
    hoodStrip.position.set(0, 1.33, 1.22);
    hoodStrip.rotation.x = 0.035;
    this.truck.add(hoodStrip);
    const ornament = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.16, 6), brassMat);
    ornament.rotation.x = Math.PI / 2 - 0.25;
    ornament.position.set(0, 1.32, 1.82);
    this.truck.add(ornament);

    // Sculpted Curved Wheel-Arch Fenders & Side Running Boards!
    for (const sx of [-0.88, 0.88]) {
      for (const fz of [1.22, -1.22]) {
        const arch = new THREE.Mesh(new THREE.TorusGeometry(0.49, 0.125, 8, 16, Math.PI), bodyAccent);
        arch.rotation.y = Math.PI / 2;
        arch.position.set(sx, 0.54, fz);
        arch.castShadow = true;
        this.truck.add(arch);
      }
      // Side running board step between front & rear fenders
      const step = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.07, 1.42), darkTrim);
      step.position.set(sx * 1.02, 0.44, 0.0);
      step.castShadow = true;
      this.truck.add(step);
      const stepTrim = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.05, 1.44), chromeMat);
      stepTrim.position.set(sx * 1.15, 0.44, 0.0);
      this.truck.add(stepTrim);
    }

    // 3. Recessed Vintage Slatted Radiator Grille + Curved Chrome Bumpers + Bumperettes!
    const grilleBack = new THREE.Mesh(new THREE.BoxGeometry(1.18, 0.42, 0.06), darkTrim);
    grilleBack.position.set(0, 0.88, 2.02);
    this.truck.add(grilleBack);
    const grilleSurround = new THREE.Mesh(new THREE.BoxGeometry(1.26, 0.48, 0.05), chromeMat);
    grilleSurround.position.set(0, 0.88, 2.0);
    this.truck.add(grilleSurround);
    for (let g = -3; g <= 3; g++) {
      const slat = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.4, 6), chromeMat);
      slat.position.set(g * 0.155, 0.88, 2.06);
      this.truck.add(slat);
    }
    const midBar = new THREE.Mesh(new THREE.BoxGeometry(1.24, 0.045, 0.05), chromeMat);
    midBar.position.set(0, 0.88, 2.07);
    this.truck.add(midBar);

    // Front & Rear Chrome Bumpers with vertical bumper guards
    const frontBumper = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 1.76, 6, 10), chromeMat);
    frontBumper.rotation.z = Math.PI / 2;
    frontBumper.position.set(0, 0.54, 2.14);
    this.truck.add(frontBumper);
    for (const bx of [-0.52, 0.52]) {
      const guard = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.18, 5, 8), chromeMat);
      guard.position.set(bx, 0.58, 2.18);
      this.truck.add(guard);
    }
    const rearBumper = new THREE.Mesh(new THREE.CapsuleGeometry(0.085, 1.74, 6, 10), chromeMat);
    rearBumper.rotation.z = Math.PI / 2;
    rearBumper.position.set(0, 0.54, -2.06);
    this.truck.add(rearBumper);

    // Twin chrome-housing Headlights + Amber turn signals + Night Beam
    for (const sx of [-0.74, 0.74]) {
      const pod = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.15, 0.22, 14), bodyMat);
      pod.rotation.x = Math.PI / 2;
      pod.position.set(sx, 0.96, 1.92);
      this.truck.add(pod);
      const hl = new THREE.Mesh(new THREE.SphereGeometry(0.135, 12, 8), this.headlightGlowMat);
      hl.scale.set(1, 1, 0.45);
      hl.position.set(sx, 0.96, 2.03);
      this.truck.add(hl);
      const bezel = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.025, 7, 16), chromeMat);
      bezel.position.set(sx, 0.96, 2.03);
      this.truck.add(bezel);
      const turn = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), amberMat);
      turn.scale.set(1.2, 0.75, 0.5);
      turn.position.set(sx * 0.96, 0.74, 2.05);
      this.truck.add(turn);
    }
    const beam = new THREE.PointLight('#ffe8ad', 0, 24, 1.35);
    beam.position.set(0, 1.15, 3.35);
    this.truck.add(beam);
    this.headlightBeams.push(beam);

    // 4. Sculpted Cab, Curved Roof Canopy, Chrome Side Mirrors & Rich 1st-Person Dashboard!
    const dash = new THREE.Mesh(new THREE.BoxGeometry(1.66, 0.46, 0.44), creamMat);
    dash.position.set(0, 1.05, 0.44);
    this.truck.add(dash);
    const dashWood = new THREE.Mesh(new THREE.BoxGeometry(1.62, 0.16, 0.05), darkWoodMat);
    dashWood.position.set(0, 1.16, 0.22);
    this.truck.add(dashWood);

    // Twin Analog Dashboard Gauges (Speedometer + Fuel) with real rotating speed needle!
    const dialMat = new THREE.MeshStandardMaterial({ color: '#fffdf2', emissive: '#ffebad', emissiveIntensity: 0.25 });
    const needleMat = new THREE.MeshStandardMaterial({ color: '#e6493e', roughness: 0.4 });
    for (const [gx, isSpeedo] of [[0.46, true], [0.24, false]] as [number, boolean][]) {
      const bezel = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.012, 6, 16), chromeMat);
      bezel.position.set(gx, 1.16, 0.19);
      this.truck.add(bezel);
      const face = new THREE.Mesh(new THREE.CircleGeometry(0.07, 14), dialMat);
      face.rotation.y = Math.PI;
      face.position.set(gx, 1.16, 0.192);
      this.truck.add(face);
      const needle = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.058, 0.01), needleMat);
      needle.position.set(gx, 1.16, 0.186);
      needle.rotation.z = isSpeedo ? 1.8 : -0.6;
      this.truck.add(needle);
      if (isSpeedo) this.speedNeedle = needle;
    }

    // Floor Gearshift Lever with polished wood knob
    const shifter = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.02, 0.56, 8), chromeMat);
    shifter.position.set(-0.04, 0.94, 0.28);
    shifter.rotation.x = -0.22;
    this.truck.add(shifter);
    const shiftKnob = new THREE.Mesh(new THREE.SphereGeometry(0.042, 10, 8), darkWoodMat);
    shiftKnob.position.set(-0.04, 1.22, 0.21);
    this.truck.add(shiftKnob);

    // Windshield pillars, curved roof canopy, chrome door handles & exterior wing mirrors!
    for (const sx of [-0.82, 0.82]) {
      const aPillar = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.048, 0.9, 8), creamMat);
      aPillar.position.set(sx, 1.62, 0.52);
      aPillar.rotation.x = -0.22;
      this.truck.add(aPillar);
      const bPillar = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.9, 0.16), bodyMat);
      bPillar.position.set(sx, 1.62, -0.34);
      this.truck.add(bPillar);
      const sideDoor = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.66, 0.94), bodyMat);
      sideDoor.position.set(sx, 0.93, 0.1);
      sideDoor.castShadow = true;
      this.truck.add(sideDoor);
      const doorStripe = new THREE.Mesh(new THREE.BoxGeometry(0.135, 0.045, 0.9), chromeMat);
      doorStripe.position.set(sx, 1.06, 0.1);
      this.truck.add(doorStripe);
      const handle = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.04, 0.16), chromeMat);
      handle.position.set(sx + Math.sign(sx) * 0.075, 1.12, -0.14);
      this.truck.add(handle);

      // Exterior Chrome Side Mirror on angled arm
      const mArm = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.26, 6), chromeMat);
      mArm.rotation.z = Math.PI / 2;
      mArm.position.set(sx + Math.sign(sx) * 0.14, 1.38, 0.44);
      this.truck.add(mArm);
      const mHead = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.035, 12), chromeMat);
      mHead.rotation.x = Math.PI / 2;
      mHead.position.set(sx + Math.sign(sx) * 0.26, 1.4, 0.44);
      this.truck.add(mHead);
    }

    const windshield = new THREE.Mesh(new THREE.BoxGeometry(1.58, 0.74, 0.04), glassMat);
    windshield.position.set(0, 1.6, 0.52);
    windshield.rotation.x = -0.22;
    this.truck.add(windshield);
    // Interior rear-view mirror
    const rvMirror = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.075, 0.03), darkTrim);
    rvMirror.position.set(0, 1.9, 0.42);
    this.truck.add(rvMirror);

    // Sculpted Beveled Vintage Cab Roof (ExtrudeGeometry!)
    const roofShape = new THREE.Shape();
    roofShape.moveTo(-0.82, -0.52);
    roofShape.lineTo(0.82, -0.52);
    roofShape.lineTo(0.82, 0.52);
    roofShape.lineTo(-0.82, 0.52);
    roofShape.closePath();
    const roofGeo = new THREE.ExtrudeGeometry(roofShape, {
      depth: 0.08,
      bevelEnabled: true,
      bevelThickness: 0.06,
      bevelSize: 0.07,
      bevelSegments: 3,
    });
    roofGeo.rotateX(Math.PI / 2);
    const roof = new THREE.Mesh(roofGeo, creamMat);
    roof.position.set(0, 2.08, 0.06);
    roof.castShadow = true;
    this.truck.add(roof);

    // Cab rear bulkhead + tufted leather bench seat with rounded bolsters!
    const cabBack = new THREE.Mesh(new THREE.BoxGeometry(1.66, 0.82, 0.14), bodyMat);
    cabBack.position.set(0, 1.0, -0.36);
    this.truck.add(cabBack);
    const seatBase = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 1.16, 6, 10), seatMat);
    seatBase.rotation.z = Math.PI / 2;
    seatBase.scale.set(0.65, 1, 1.15);
    seatBase.position.set(0, 0.86, -0.02);
    this.truck.add(seatBase);
    const seatBack = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 1.16, 6, 10), seatMat);
    seatBack.rotation.z = Math.PI / 2;
    seatBack.scale.set(1.25, 1, 0.55);
    seatBack.position.set(0, 1.2, -0.24);
    this.truck.add(seatBack);

    // Interactive 3-Spoke Leather-Wrapped Steering Wheel with Chrome Horn Button!
    const steerCol = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.038, 0.42, 10), darkTrim);
    steerCol.rotation.x = Math.PI / 2 - 0.55;
    steerCol.position.set(0.36, 1.16, 0.34);
    this.truck.add(steerCol);

    this.steeringWheel.position.set(0.36, 1.28, 0.18);
    this.steeringWheel.rotation.x = -0.55;
    const wheelRing = new THREE.Mesh(new THREE.TorusGeometry(0.195, 0.024, 10, 24), darkWoodMat);
    this.steeringWheel.add(wheelRing);
    const hornCap = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.03, 12), chromeMat);
    hornCap.rotation.x = Math.PI / 2;
    this.steeringWheel.add(hornCap);
    for (let s = 0; s < 3; s++) {
      const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.18, 0.02), chromeMat);
      const a = (s / 3) * Math.PI * 2;
      spoke.position.set(Math.sin(a) * 0.095, Math.cos(a) * 0.095, 0);
      spoke.rotation.z = -a;
      this.steeringWheel.add(spoke);
    }
    this.truck.add(this.steeringWheel);

    // 5. Rear Pickup Cargo Bed with wooden rails, spare tire & cozy cargo!
    const bedFloor = new THREE.Mesh(new THREE.BoxGeometry(1.66, 0.12, 1.56), woodBedMat);
    bedFloor.position.set(0, 0.66, -1.2);
    bedFloor.receiveShadow = true;
    this.truck.add(bedFloor);
    for (const sx of [-0.82, 0.82]) {
      const bedSide = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.56, 1.58), bodyMat);
      bedSide.position.set(sx, 0.94, -1.2);
      bedSide.castShadow = true;
      this.truck.add(bedSide);
      const sideTrim = new THREE.Mesh(new THREE.BoxGeometry(0.145, 0.045, 1.54), chromeMat);
      sideTrim.position.set(sx, 1.06, -1.2);
      this.truck.add(sideTrim);
      for (const ry of [1.34, 1.56]) {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.08, 1.54), woodBedMat);
        rail.position.set(sx, ry, -1.2);
        this.truck.add(rail);
      }
      for (const rz of [-0.58, -1.2, -1.82]) {
        const stake = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.48, 0.075), darkWoodMat);
        stake.position.set(sx, 1.38, rz);
        this.truck.add(stake);
      }
    }
    const tailgate = new THREE.Mesh(new THREE.BoxGeometry(1.74, 0.56, 0.13), bodyMat);
    tailgate.position.set(0, 0.94, -1.96);
    tailgate.castShadow = true;
    this.truck.add(tailgate);
    // Rear chrome-bezel tail lights
    for (const sx of [-0.68, 0.68]) {
      const tl = new THREE.Mesh(new THREE.CapsuleGeometry(0.065, 0.12, 5, 8), tailLightMat);
      tl.position.set(sx, 0.94, -2.02);
      this.truck.add(tl);
    }

    // Upright Spare Tire + Wooden Cargo Crate inside the Pickup Bed!
    const spareTire = new THREE.Mesh(new THREE.TorusGeometry(0.31, 0.11, 10, 18), tireMat);
    spareTire.position.set(0.42, 1.06, -0.62);
    this.truck.add(spareTire);
    const cargoCrate = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.48, 0.62), woodBedMat);
    cargoCrate.position.set(-0.34, 0.96, -1.36);
    cargoCrate.rotation.y = 0.12;
    cargoCrate.castShadow = true;
    this.truck.add(cargoCrate);

    // 6. Sculpted Rounded Torus Tires with 5-Spoke Vintage Steel Rims & Chrome Hubcaps!
    const wheelSpecs: [number, number, boolean][] = [
      [-0.92, 1.22, true],
      [0.92, 1.22, true],
      [-0.92, -1.22, false],
      [0.92, -1.22, false],
    ];
    for (const [wx, wz, isFront] of wheelSpecs) {
      const pivot = new THREE.Group();
      pivot.position.set(wx, 0.42, wz);

      const spinGroup = new THREE.Group();
      // Rounded pneumatic tire sidewall (TorusGeometry) + solid inner rim!
      const tireTorus = new THREE.Mesh(new THREE.TorusGeometry(0.31, 0.125, 12, 22), tireMat);
      tireTorus.rotation.y = Math.PI / 2;
      tireTorus.castShadow = true;
      spinGroup.add(tireTorus);

      const rimDrum = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.2, 14), creamMat);
      rimDrum.rotation.z = Math.PI / 2;
      spinGroup.add(rimDrum);

      const hubCap = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 8), chromeMat);
      hubCap.scale.set(0.45, 1, 1);
      hubCap.position.x = Math.sign(wx) * 0.1;
      spinGroup.add(hubCap);

      // 5 steel lug spokes so tire rotation looks super crisp!
      for (let s = 0; s < 5; s++) {
        const a = (s / 5) * Math.PI * 2;
        const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.045, 0.045), darkTrim);
        spoke.position.set(0, Math.cos(a) * 0.17, Math.sin(a) * 0.17);
        spinGroup.add(spoke);
      }

      pivot.add(spinGroup);
      this.truck.add(pivot);
      this.wheelMeshes.push(spinGroup);
      if (isFront) this.frontWheelPivots.push(pivot);
    }
  }

  public enterTruck(): void {
    if (this.isDriving) return;
    this.isDriving = true;
    this.sound.playHorn();
    this.callbacks.onDriveStateChange(true);
    this.callbacks.onToast('🛻 Hopped in the Farm Pickup! WASD to drive, Space to honk, E/F to exit.', 'celebrate');
  }

  public exitTruck(playerPos: THREE.Vector3): void {
    if (!this.isDriving) return;
    this.isDriving = false;
    this.speed = 0;

    // Place player safely beside the driver-side (+X local) door
    const sideDir = new THREE.Vector3(Math.cos(this.heading), 0, -Math.sin(this.heading));
    const exitPos = this.position.clone().addScaledVector(sideDir, 2.2);
    exitPos.y = 1.72;
    this.collisions.resolvePosition(exitPos, 0.5);
    playerPos.copy(exitPos);

    this.sound.playPop();
    this.callbacks.onDriveStateChange(false);
    this.callbacks.onToast('Parked the Farm Pickup Truck.', 'info');
  }

  public getDrivingHudInfo(): InteractionInfo | null {
    if (!this.isDriving) return null;
    const kmh = Math.round(Math.abs(this.speed) * 3.6);
    return {
      id: 'driving_truck',
      title: `Sunnybrook Pickup • ${kmh} km/h`,
      subtitle: 'WASD Drive • Shift Boost • Space Horn • Mouse Look',
      actionText: 'Exit Truck (Press E or F)',
      canAct: true,
      iconId: 'truck',
      badge: { text: kmh > 45 ? 'Cruising!' : 'Driving', tone: 'happy' },
    };
  }

  public getDynamicCollider(): { x: number; z: number; radius: number } | null {
    if (this.isDriving) return null;
    return { x: this.position.x, z: this.position.z, radius: 1.65 };
  }

  public update(
    dt: number,
    nightFactor: number,
    allowInput: boolean,
    isKeyDown: (code: string) => boolean,
    playerPos: THREE.Vector3,
    dynamicColliders?: { x: number; z: number; radius: number }[],
    virtualInput?: { moveX: number; moveY: number; sprint: boolean; brakeOrJumpHeld: boolean }
  ): number {
    if (this.hornCooldown > 0) this.hornCooldown = Math.max(0, this.hornCooldown - dt);

    // Night headlights automatically illuminate ahead when driving or at night!
    const headIntensity = this.isDriving ? 2.6 + nightFactor * 2.4 : nightFactor * 1.4;
    for (const l of this.headlightBeams) {
      l.intensity = headIntensity;
    }

    if (!this.isDriving) {
      // Gentle coast to stop if parked
      if (Math.abs(this.speed) > 0.05) {
        this.speed *= Math.max(0, 1 - dt * 5);
      } else {
        this.speed = 0;
      }
      return 0;
    }

    let throttle = 0;
    let steerInput = 0;
    let boost = false;
    let brake = false;

    if (allowInput) {
      if (isKeyDown('KeyW') || isKeyDown('ArrowUp')) throttle += 1;
      if (isKeyDown('KeyS') || isKeyDown('ArrowDown')) throttle -= 1;
      if (isKeyDown('KeyA') || isKeyDown('ArrowLeft')) steerInput += 1;
      if (isKeyDown('KeyD') || isKeyDown('ArrowRight')) steerInput -= 1;
      if (virtualInput) {
        throttle += virtualInput.moveY;
        steerInput -= virtualInput.moveX;
      }
      throttle = THREE.MathUtils.clamp(throttle, -1, 1);
      steerInput = THREE.MathUtils.clamp(steerInput, -1, 1);
      boost = isKeyDown('ShiftLeft') || isKeyDown('ShiftRight') || Boolean(virtualInput?.sprint);
      brake = isKeyDown('Space') || Boolean(virtualInput?.brakeOrJumpHeld);

      if (brake && this.hornCooldown <= 0) {
        this.sound.playHorn();
        this.hornCooldown = 0.75;
      }
    }

    const maxFwd = boost ? 26.0 : 18.0;
    const maxRev = -8.5;
    const accel = boost ? 26.0 : 17.5;

    if (brake) {
      this.speed *= Math.max(0, 1 - dt * 8.5);
    } else if (throttle > 0) {
      this.speed = Math.min(maxFwd, this.speed + accel * dt);
    } else if (throttle < 0) {
      this.speed = Math.max(maxRev, this.speed - accel * 1.15 * dt);
    } else {
      this.speed *= Math.max(0, 1 - dt * 2.6);
      if (Math.abs(this.speed) < 0.08) this.speed = 0;
    }

    // Smooth steering angle & realistic turning when moving
    const targetSteer = steerInput * 0.52;
    this.steerAngle = THREE.MathUtils.lerp(this.steerAngle, targetSteer, Math.min(1, dt * 10));
    let deltaHeading = 0;
    if (Math.abs(this.speed) > 0.25) {
      const turnDir = this.speed >= 0 ? 1 : -1;
      const speedTurnFactor = Math.min(1, Math.abs(this.speed) / 4.5);
      deltaHeading = this.steerAngle * 2.6 * speedTurnFactor * turnDir * dt;
      this.heading += deltaHeading;
    }

    // Move truck forward along local +Z vector (sin(heading), cos(heading))
    const prevX = this.position.x;
    const prevZ = this.position.z;
    this.position.x += Math.sin(this.heading) * this.speed * dt;
    this.position.z += Math.cos(this.heading) * this.speed * dt;
    this.collisions.resolvePosition(this.position, 1.55, dynamicColliders);

    // Damp speed if collided with an obstacle
    const actualDist = Math.hypot(this.position.x - prevX, this.position.z - prevZ);
    const expectedDist = Math.abs(this.speed * dt);
    if (expectedDist > 0.02 && actualDist < expectedDist * 0.4) {
      this.speed *= 0.35;
    }

    // Animate truck transform, front wheel steering, steering wheel & tire spin!
    this.truck.position.copy(this.position);
    this.truck.rotation.y = this.heading;
    this.steeringWheel.rotation.z = -this.steerAngle * 3.2;
    if (this.speedNeedle) {
      this.speedNeedle.rotation.z = 1.8 - Math.min(1, Math.abs(this.speed) / 21) * 3.6;
    }
    for (const piv of this.frontWheelPivots) {
      piv.rotation.y = this.steerAngle * 0.85;
    }
    this.wheelSpin += (this.speed * dt) / 0.42;
    for (const w of this.wheelMeshes) {
      w.rotation.x = this.wheelSpin;
    }

    // Cozy dust puffs behind rear tires when driving briskly
    if (Math.abs(this.speed) > 4.5) {
      this.dustTimer += dt;
      if (this.dustTimer > 0.14) {
        this.dustTimer = 0;
        const rearPos = this.position
          .clone()
          .add(new THREE.Vector3(-Math.sin(this.heading) * 1.9, 0.25, -Math.cos(this.heading) * 1.9));
        this.particles.spawnChimneySmoke(rearPos);
      }
    }

    // Seat player camera cleanly inside the driver cab!
    const seatLocal = new THREE.Vector3(0.32, 1.78, -0.05);
    seatLocal.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.heading);
    playerPos.copy(this.position).add(seatLocal);
    return deltaHeading;
  }
}
