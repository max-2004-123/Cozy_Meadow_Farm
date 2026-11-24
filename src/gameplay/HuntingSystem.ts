import * as THREE from 'three';
import { ITEMS } from '../config/farmConfig';
import { ParticleSystem } from '../effects/ParticleSystem';
import { SoundManager } from '../audio/SoundManager';
import { InventorySystem } from '../game/InventorySystem';
import { TaskSystem } from '../game/TaskSystem';
import { ArcheryTargetSpot } from '../world/WildernessExpansion';
import { ItemId } from '../types';

type WildSpecies = 'rabbit' | 'deer' | 'boar';

interface WildGame {
  species: WildSpecies;
  name: string;
  group: THREE.Group;
  legs: THREE.Object3D[];
  home: THREE.Vector3;
  roamRadius: number;
  target: THREE.Vector3;
  hitRadius: number;
  hitCenterY: number;
  speed: number;
  alive: boolean;
  respawnTimer: number;
  phase: number;
}

interface FlyingArrow {
  mesh: THREE.Group;
  vel: THREE.Vector3;
  life: number;
  stuck: boolean;
}

export class HuntingSystem {
  public group = new THREE.Group();
  private animals: WildGame[] = [];
  private arrows: FlyingArrow[] = [];
  private shootCooldown = 0;

  constructor(
    scene: THREE.Scene,
    private inventory: InventorySystem,
    private particles: ParticleSystem,
    private sound: SoundManager,
    private tasks: TaskSystem,
    private archeryTargets: ArcheryTargetSpot[],
    private callbacks: {
      onToast: (text: string, tone?: 'default' | 'success' | 'info' | 'celebrate') => void;
      onToolSwing: (action: 'hoe' | 'water' | 'plant' | 'feed' | 'harvest') => void;
    }
  ) {
    this.spawnWildGame();
    scene.add(this.group);
  }

  private spawnWildGame(): void {
    const specs: [WildSpecies, string, number, number, number][] = [
      // West Pine Forest Hunting Grounds
      ['rabbit', 'Woodland Rabbit', -36, -4, 8],
      ['rabbit', 'Meadow Cottontail', -48, 8, 9],
      ['rabbit', 'Pine Hopper', -58, -14, 10],
      ['deer', 'Forest Stag', -52, -26, 12],
      ['deer', 'Golden Buck', -64, 14, 12],
      ['boar', 'Forest Boar', -44, 22, 10],
      // East Golden Birch Meadow Hunting Grounds
      ['rabbit', 'Birch Rabbit', 36, -6, 8],
      ['rabbit', 'Clover Hare', 48, 12, 9],
      ['deer', 'Highland Stag', 56, -22, 12],
      ['deer', 'Sunlit Deer', 62, 6, 12],
      ['boar', 'Highland Boar', 44, -30, 10],
    ];

    specs.forEach(([species, name, x, z, roam], idx) => {
      const { group, legs, hitRadius, hitCenterY, speed } = this.createWildModel(species, idx);
      group.position.set(x, 0, z);
      this.group.add(group);
      this.animals.push({
        species,
        name,
        group,
        legs,
        home: new THREE.Vector3(x, 0, z),
        roamRadius: roam,
        target: new THREE.Vector3(x + 2, 0, z - 2),
        hitRadius,
        hitCenterY,
        speed,
        alive: true,
        respawnTimer: 0,
        phase: idx * 1.3,
      });
    });
  }

  private createWildModel(species: WildSpecies, idx: number): {
    group: THREE.Group;
    legs: THREE.Object3D[];
    hitRadius: number;
    hitCenterY: number;
    speed: number;
  } {
    const g = new THREE.Group();
    const legs: THREE.Object3D[] = [];
    const eyeMat = new THREE.MeshStandardMaterial({ color: '#241b16', roughness: 0.25 });

    if (species === 'rabbit') {
      const furMat = new THREE.MeshStandardMaterial({
        color: idx % 2 === 0 ? '#c9a07a' : '#e6d5bf',
        roughness: 0.88,
      });
      const whiteMat = new THREE.MeshStandardMaterial({ color: '#fffbf2', roughness: 0.9 });
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 8), furMat);
      body.scale.set(1.25, 0.92, 0.9);
      body.position.set(0, 0.28, 0);
      body.castShadow = true;
      g.add(body);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 9, 7), furMat);
      head.position.set(0.24, 0.42, 0);
      head.castShadow = true;
      g.add(head);
      for (const sz of [-0.06, 0.06]) {
        const ear = new THREE.Mesh(new THREE.CapsuleGeometry(0.032, 0.18, 4, 6), furMat);
        ear.position.set(0.22, 0.62, sz);
        ear.rotation.z = -0.18;
        g.add(ear);
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.022, 6, 5), eyeMat);
        eye.position.set(0.35, 0.46, sz * 1.4);
        g.add(eye);
      }
      const tail = new THREE.Mesh(new THREE.SphereGeometry(0.085, 7, 6), whiteMat);
      tail.position.set(-0.28, 0.28, 0);
      g.add(tail);
      return { group: g, legs, hitRadius: 0.95, hitCenterY: 0.4, speed: 2.3 };
    }

    if (species === 'deer') {
      const coatMat = new THREE.MeshStandardMaterial({
        color: idx % 2 === 0 ? '#bd7f4a' : '#a86b3c',
        roughness: 0.85,
      });
      const spotMat = new THREE.MeshStandardMaterial({ color: '#f7ead4', roughness: 0.85 });
      const antlerMat = new THREE.MeshStandardMaterial({ color: '#e6d6b8', roughness: 0.72 });

      const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 0.75, 6, 10), coatMat);
      body.rotation.z = Math.PI / 2;
      body.position.set(0, 1.05, 0);
      body.castShadow = true;
      g.add(body);
      // Soft fawn spots on back
      for (const [sx, sz] of [[-0.18, 0.24], [0.1, -0.24], [0.0, 0.26], [-0.25, -0.22]] as [number, number][]) {
        const sp = new THREE.Mesh(new THREE.SphereGeometry(0.055, 6, 5), spotMat);
        sp.position.set(sx, 1.18, sz);
        g.add(sp);
      }
      const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 0.62, 8), coatMat);
      neck.position.set(0.48, 1.38, 0);
      neck.rotation.z = -0.35;
      neck.castShadow = true;
      g.add(neck);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 9, 7), coatMat);
      head.scale.set(1.35, 0.92, 0.86);
      head.position.set(0.68, 1.66, 0);
      head.castShadow = true;
      g.add(head);
      // Proud branching antlers
      for (const side of [-1, 1]) {
        const mainAntler = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.032, 0.56, 6), antlerMat);
        mainAntler.position.set(0.62, 1.98, side * 0.14);
        mainAntler.rotation.x = side * 0.35;
        mainAntler.rotation.z = 0.22;
        g.add(mainAntler);
        const tine = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.022, 0.26, 5), antlerMat);
        tine.position.set(0.68, 2.02, side * 0.24);
        tine.rotation.z = -0.5;
        g.add(tine);
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.026, 6, 5), eyeMat);
        eye.position.set(0.8, 1.7, side * 0.13);
        g.add(eye);
      }
      for (const lx of [-0.36, 0.36]) {
        for (const lz of [-0.15, 0.15]) {
          const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.042, 0.95, 7), coatMat);
          leg.position.set(lx, 0.48, lz);
          leg.castShadow = true;
          g.add(leg);
          legs.push(leg);
        }
      }
      return { group: g, legs, hitRadius: 1.35, hitCenterY: 1.15, speed: 2.7 };
    }

    // Wild Forest Boar
    const boarMat = new THREE.MeshStandardMaterial({ color: '#6b4938', roughness: 0.92 });
    const tuskMat = new THREE.MeshStandardMaterial({ color: '#fff7e6', roughness: 0.5 });
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.42, 10, 8), boarMat);
    body.scale.set(1.38, 0.96, 0.9);
    body.position.set(0, 0.58, 0);
    body.castShadow = true;
    g.add(body);
    const snout = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 0.26, 8), boarMat);
    snout.rotation.z = -Math.PI / 2;
    snout.position.set(0.58, 0.56, 0);
    g.add(snout);
    for (const side of [-1, 1]) {
      const tusk = new THREE.Mesh(new THREE.ConeGeometry(0.032, 0.18, 6), tuskMat);
      tusk.position.set(0.62, 0.55, side * 0.13);
      tusk.rotation.z = -0.5;
      tusk.rotation.x = side * 0.3;
      g.add(tusk);
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.028, 6, 5), eyeMat);
      eye.position.set(0.46, 0.72, side * 0.22);
      g.add(eye);
    }
    for (const lx of [-0.28, 0.28]) {
      for (const lz of [-0.18, 0.18]) {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.055, 0.46, 7), boarMat);
        leg.position.set(lx, 0.23, lz);
        leg.castShadow = true;
        g.add(leg);
        legs.push(leg);
      }
    }
    return { group: g, legs, hitRadius: 1.25, hitCenterY: 0.6, speed: 2.1 };
  }

  public tryShoot(camera: THREE.Camera): boolean {
    if (this.inventory.getSelectedItemId() !== 'hunting_bow') return false;
    if (this.shootCooldown > 0) return true;
    this.shootCooldown = 0.42;

    const arrow = new THREE.Group();
    const shaft = new THREE.Mesh(
      new THREE.CylinderGeometry(0.014, 0.014, 0.85, 6),
      new THREE.MeshStandardMaterial({ color: '#b57b42', roughness: 0.78 })
    );
    shaft.rotation.x = Math.PI / 2;
    arrow.add(shaft);
    const tip = new THREE.Mesh(
      new THREE.ConeGeometry(0.036, 0.12, 5),
      new THREE.MeshStandardMaterial({ color: '#dce6f0', metalness: 0.55, roughness: 0.28 })
    );
    tip.rotation.x = -Math.PI / 2;
    tip.position.z = -0.46;
    arrow.add(tip);
    const fletch = new THREE.Mesh(
      new THREE.BoxGeometry(0.09, 0.035, 0.15),
      new THREE.MeshStandardMaterial({ color: '#eb5846', roughness: 0.65 })
    );
    fletch.position.z = 0.36;
    arrow.add(fletch);

    const origin = new THREE.Vector3();
    camera.getWorldPosition(origin);
    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion).normalize();
    arrow.position.copy(origin).addScaledVector(dir, 0.85);
    arrow.lookAt(arrow.position.clone().add(dir));

    this.group.add(arrow);
    this.arrows.push({
      mesh: arrow,
      vel: dir.multiplyScalar(36),
      life: 4.5,
      stuck: false,
    });

    this.sound.playPop();
    this.callbacks.onToolSwing('hoe');
    return true;
  }

  private awardHuntLoot(animal: WildGame): void {
    animal.alive = false;
    animal.group.visible = false;
    animal.respawnTimer = 14 + Math.random() * 8;

    const pos = animal.group.position.clone().add(new THREE.Vector3(0, animal.hitCenterY, 0));
    this.particles.spawnSparkles(pos, 18);
    this.sound.playTaskComplete();
    this.tasks.complete('quest_hunt');

    let lootId: ItemId = 'hunt_pelt';
    let qty = 1;
    if (animal.species === 'rabbit') {
      lootId = Math.random() < 0.6 ? 'hunt_pelt' : 'hunt_meat';
    } else if (animal.species === 'deer') {
      lootId = Math.random() < 0.38 ? 'hunt_antler' : 'hunt_venison';
    } else {
      lootId = 'hunt_meat';
      qty = 2;
    }

    this.inventory.addItem(lootId, qty);
    this.callbacks.onToast(
      `🏹 Hunted ${animal.name}! Collected ${ITEMS[lootId].name}${qty > 1 ? ` ×${qty}` : ''}!`,
      'celebrate'
    );
  }

  public update(dt: number, elapsed: number, playerPos: THREE.Vector3): void {
    if (this.shootCooldown > 0) this.shootCooldown = Math.max(0, this.shootCooldown - dt);

    // Update wild forest animals
    for (const a of this.animals) {
      if (!a.alive) {
        a.respawnTimer -= dt;
        if (a.respawnTimer <= 0) {
          const ang = Math.random() * Math.PI * 2;
          const r = Math.random() * a.roamRadius * 0.7;
          a.group.position.set(a.home.x + Math.cos(ang) * r, 0, a.home.z + Math.sin(ang) * r);
          a.group.visible = true;
          a.alive = true;
        }
        continue;
      }

      // Distance Culling: hide & pause wild animals far outside the player's view range (> 68m)
      const distPlayer = a.group.position.distanceTo(playerPos);
      if (distPlayer > 68) {
        a.group.visible = false;
        continue;
      }
      a.group.visible = true;

      // Gently trot away if player gets very close
      if (distPlayer < 7.5) {
        const away = a.group.position.clone().sub(playerPos).setY(0);
        if (away.lengthSq() > 0.01) {
          away.normalize().multiplyScalar(8);
          a.target.copy(a.home).add(away.clampLength(0, a.roamRadius));
        }
      } else if (a.group.position.distanceTo(a.target) < 1.2) {
        const ang = Math.random() * Math.PI * 2;
        const r = 2 + Math.random() * a.roamRadius;
        a.target.set(a.home.x + Math.cos(ang) * r, 0, a.home.z + Math.sin(ang) * r);
      }

      const toTarget = a.target.clone().sub(a.group.position).setY(0);
      const dist = toTarget.length();
      if (dist > 0.2) {
        const spd = distPlayer < 7.5 ? a.speed * 1.45 : a.speed;
        toTarget.normalize();
        a.group.position.addScaledVector(toTarget, Math.min(dist, spd * dt));
        const targetYaw = Math.atan2(-toTarget.z, toTarget.x);
        a.group.rotation.y = targetYaw;

        if (a.species === 'rabbit') {
          a.group.position.y = Math.abs(Math.sin(elapsed * 8.5 + a.phase)) * 0.24;
        } else {
          const swing = Math.sin(elapsed * 8.5 + a.phase) * 0.42;
          a.legs.forEach((leg, i) => {
            leg.rotation.z = i % 2 === 0 ? swing : -swing;
          });
        }
      }
    }

    // Update flying arrows & check hits on wild animals or archery targets
    for (let i = this.arrows.length - 1; i >= 0; i--) {
      const ar = this.arrows[i];
      ar.life -= dt;
      if (ar.life <= 0) {
        this.group.remove(ar.mesh);
        this.arrows.splice(i, 1);
        continue;
      }
      if (ar.stuck) continue;

      ar.vel.y -= 4.8 * dt;
      ar.mesh.position.addScaledVector(ar.vel, dt);
      ar.mesh.lookAt(ar.mesh.position.clone().add(ar.vel));

      // Ground stick
      if (ar.mesh.position.y <= 0.08) {
        ar.mesh.position.y = 0.08;
        ar.stuck = true;
        ar.life = Math.min(ar.life, 2.5);
        continue;
      }

      // Check wild animal hits
      let hit = false;
      for (const a of this.animals) {
        if (!a.alive) continue;
        const center = a.group.position.clone().setY(a.hitCenterY);
        if (ar.mesh.position.distanceTo(center) <= a.hitRadius) {
          this.awardHuntLoot(a);
          this.group.remove(ar.mesh);
          this.arrows.splice(i, 1);
          hit = true;
          break;
        }
      }
      if (hit) continue;

      // Check archery practice target hits!
      for (const t of this.archeryTargets) {
        if (ar.mesh.position.distanceTo(t.center) <= t.radius) {
          ar.stuck = true;
          ar.life = Math.min(ar.life, 4.0);
          this.particles.spawnSparkles(ar.mesh.position, 14);
          this.sound.playCollectProduct();
          this.inventory.addCoins(5);
          this.callbacks.onToast('🎯 Bullseye on the Archery Target! (+5 Coins)', 'success');
          break;
        }
      }
    }
  }
}
