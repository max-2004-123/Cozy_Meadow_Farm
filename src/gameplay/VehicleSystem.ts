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
    const bodyMat = new THREE.MeshStandardMaterial({ color: '#6ec4b4', roughness: 0.36, metalness: 0.14 });
    const creamMat = new THREE.MeshStandardMaterial({ color: '#fff6e0', roughness: 0.42 });
    const darkTrim = new THREE.MeshStandardMaterial({ color: '#3b4248', roughness: 0.55, metalness: 0.45 });
    const chromeMat = new THREE.MeshStandardMaterial({ color: '#dce6ee', roughness: 0.22, metalness: 0.72 });
    const woodBedMat = new THREE.MeshStandardMaterial({ color: '#b57b45', roughness: 0.85 });
    const seatMat = new THREE.MeshStandardMaterial({ color: '#a8693c', roughness: 0.82 });
    const glassMat = new THREE.MeshStandardMaterial({
      color: '#bfe8ff',
      transparent: true,
      opacity: 0.42,
      roughness: 0.1,
      metalness: 0.2,
    });
    const tireMat = new THREE.MeshStandardMaterial({ color: '#2b2d30', roughness: 0.9 });
    const tailLightMat = new THREE.MeshStandardMaterial({
      color: '#f04e42',
      emissive: '#c92a22',
      emissiveIntensity: 0.45,
      roughness: 0.3,
    });
    this.headlightGlowMat = new THREE.MeshStandardMaterial({
      color: '#fff6c7',
      emissive: '#ffd26b',
      emissiveIntensity: 0.35,
      roughness: 0.2,
    });
    this.sky.registerGlowMaterial(this.headlightGlowMat);

    // Local +Z is FRONT of the truck!
    // Lower chassis frame
    const chassis = new THREE.Mesh(new THREE.BoxGeometry(1.72, 0.28, 3.95), darkTrim);
    chassis.position.set(0, 0.48, 0);
    chassis.castShadow = true;
    this.truck.add(chassis);

    // Front hood & rounded nose (+Z)
    const hood = new THREE.Mesh(new THREE.BoxGeometry(1.74, 0.62, 1.38), bodyMat);
    hood.position.set(0, 0.92, 1.24);
    hood.castShadow = true;
    hood.receiveShadow = true;
    this.truck.add(hood);

    // Chrome front grille & bumpers
    const grille = new THREE.Mesh(new THREE.BoxGeometry(1.22, 0.38, 0.08), chromeMat);
    grille.position.set(0, 0.88, 1.94);
    this.truck.add(grille);
    const frontBumper = new THREE.Mesh(new THREE.BoxGeometry(1.88, 0.18, 0.22), chromeMat);
    frontBumper.position.set(0, 0.56, 2.02);
    this.truck.add(frontBumper);
    const rearBumper = new THREE.Mesh(new THREE.BoxGeometry(1.88, 0.18, 0.2), chromeMat);
    rearBumper.position.set(0, 0.56, -2.02);
    this.truck.add(rearBumper);

    // Twin round Headlights + real headlight beams!
    for (const sx of [-0.66, 0.66]) {
      const hl = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.1, 12), this.headlightGlowMat);
      hl.rotation.x = Math.PI / 2;
      hl.position.set(sx, 0.92, 1.94);
      this.truck.add(hl);
      const bezel = new THREE.Mesh(new THREE.TorusGeometry(0.145, 0.025, 6, 12), chromeMat);
      bezel.position.set(sx, 0.92, 1.98);
      this.truck.add(bezel);
    }
    const beam = new THREE.PointLight('#ffe7a8', 0, 22, 1.4);
    beam.position.set(0, 1.15, 3.2);
    this.truck.add(beam);
    this.headlightBeams.push(beam);

    // Open-air cozy Cab (dashboard, windshield frame, roof canopy & bench seat)
    const dash = new THREE.Mesh(new THREE.BoxGeometry(1.68, 0.45, 0.42), creamMat);
    dash.position.set(0, 1.05, 0.42);
    this.truck.add(dash);

    // Windshield frame & clear glass
    for (const sx of [-0.82, 0.82]) {
      const aPillar = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.86, 0.1), creamMat);
      aPillar.position.set(sx, 1.62, 0.54);
      aPillar.rotation.x = -0.18;
      this.truck.add(aPillar);
      const bPillar = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.88, 0.12), creamMat);
      bPillar.position.set(sx, 1.62, -0.32);
      this.truck.add(bPillar);
      // Low side doors
      const sideDoor = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.62, 0.94), bodyMat);
      sideDoor.position.set(sx, 0.92, 0.12);
      sideDoor.castShadow = true;
      this.truck.add(sideDoor);
    }
    const windshield = new THREE.Mesh(new THREE.BoxGeometry(1.56, 0.72, 0.04), glassMat);
    windshield.position.set(0, 1.6, 0.54);
    windshield.rotation.x = -0.18;
    this.truck.add(windshield);

    // Cream rounded cab roof
    const roof = new THREE.Mesh(new THREE.BoxGeometry(1.76, 0.12, 1.16), creamMat);
    roof.position.set(0, 2.04, 0.08);
    roof.castShadow = true;
    this.truck.add(roof);

    // Cab rear bulkhead + cozy tan leather bench seat
    const cabBack = new THREE.Mesh(new THREE.BoxGeometry(1.68, 0.78, 0.12), bodyMat);
    cabBack.position.set(0, 1.0, -0.36);
    this.truck.add(cabBack);
    const seatBase = new THREE.Mesh(new THREE.BoxGeometry(1.48, 0.22, 0.58), seatMat);
    seatBase.position.set(0, 0.86, -0.02);
    this.truck.add(seatBase);
    const seatBack = new THREE.Mesh(new THREE.BoxGeometry(1.48, 0.54, 0.16), seatMat);
    seatBack.position.set(0, 1.18, -0.25);
    this.truck.add(seatBack);

    // Interactive Steering Wheel (turns smoothly with A/D!)
    const steerCol = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.036, 0.42, 8), darkTrim);
    steerCol.rotation.x = Math.PI / 2 - 0.55;
    steerCol.position.set(0.36, 1.16, 0.34);
    this.truck.add(steerCol);

    this.steeringWheel.position.set(0.36, 1.28, 0.18);
    this.steeringWheel.rotation.x = -0.55;
    const wheelRing = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.024, 7, 16), seatMat);
    this.steeringWheel.add(wheelRing);
    for (let s = 0; s < 3; s++) {
      const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.18, 0.02), chromeMat);
      const a = (s / 3) * Math.PI * 2;
      spoke.position.set(Math.sin(a) * 0.09, Math.cos(a) * 0.09, 0);
      spoke.rotation.z = -a;
      this.steeringWheel.add(spoke);
    }
    this.truck.add(this.steeringWheel);

    // Rear Pickup Cargo Bed with wooden side rails & cozy farm cargo!
    const bedFloor = new THREE.Mesh(new THREE.BoxGeometry(1.66, 0.12, 1.56), woodBedMat);
    bedFloor.position.set(0, 0.66, -1.2);
    bedFloor.receiveShadow = true;
    this.truck.add(bedFloor);
    for (const sx of [-0.82, 0.82]) {
      const bedSide = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.54, 1.58), bodyMat);
      bedSide.position.set(sx, 0.94, -1.2);
      bedSide.castShadow = true;
      this.truck.add(bedSide);
      // Rustic wooden stake rails along pickup bed!
      const topRail = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.09, 1.54), woodBedMat);
      topRail.position.set(sx, 1.38, -1.2);
      this.truck.add(topRail);
      for (const rz of [-0.58, -1.2, -1.82]) {
        const stake = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.32, 0.07), woodBedMat);
        stake.position.set(sx, 1.24, rz);
        this.truck.add(stake);
      }
    }
    const tailgate = new THREE.Mesh(new THREE.BoxGeometry(1.74, 0.54, 0.12), bodyMat);
    tailgate.position.set(0, 0.94, -1.96);
    tailgate.castShadow = true;
    this.truck.add(tailgate);

    // Red tail lights
    for (const sx of [-0.68, 0.68]) {
      const tl = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.14, 0.08), tailLightMat);
      tl.position.set(sx, 0.92, -2.01);
      this.truck.add(tl);
    }

    // Cozy farm crate riding in the truck bed
    const cargoCrate = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.48, 0.62), woodBedMat);
    cargoCrate.position.set(-0.34, 0.96, -1.32);
    cargoCrate.rotation.y = 0.12;
    cargoCrate.castShadow = true;
    this.truck.add(cargoCrate);

    // 4 Chunky Treaded Wheels (Front two steer, all 4 spin!)
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
      const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.32, 16), tireMat);
      tire.rotation.z = Math.PI / 2;
      tire.castShadow = true;
      spinGroup.add(tire);
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.34, 10), creamMat);
      hub.rotation.z = Math.PI / 2;
      spinGroup.add(hub);
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.36, 8), chromeMat);
      cap.rotation.z = Math.PI / 2;
      spinGroup.add(cap);
      // Visual lug bar so wheel rotation is super obvious!
      const lug = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.28, 0.05), darkTrim);
      spinGroup.add(lug);

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
    dynamicColliders?: { x: number; z: number; radius: number }[]
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
      boost = isKeyDown('ShiftLeft') || isKeyDown('ShiftRight');
      brake = isKeyDown('Space');

      if (brake && this.hornCooldown <= 0) {
        this.sound.playHorn();
        this.hornCooldown = 0.75;
      }
    }

    const maxFwd = boost ? 21.0 : 15.5;
    const maxRev = -7.5;
    const accel = boost ? 22.0 : 15.0;

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
