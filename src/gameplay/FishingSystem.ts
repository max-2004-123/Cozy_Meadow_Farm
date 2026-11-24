import * as THREE from 'three';
import { ITEMS, WORLD_CONFIG } from '../config/farmConfig';
import { ParticleSystem } from '../effects/ParticleSystem';
import { SoundManager } from '../audio/SoundManager';
import { InventorySystem } from '../game/InventorySystem';
import { TaskSystem } from '../game/TaskSystem';
import { InteractionInfo, ItemId } from '../types';

type FishingPhase = 'idle' | 'waiting' | 'biting';

export class FishingSystem {
  public group = new THREE.Group();
  private phase: FishingPhase = 'idle';
  private activeWater: 'pond' | 'lake' = 'pond';
  private timer = 0;

  private bobber = new THREE.Group();
  private bobberPos = new THREE.Vector3();
  private lineMesh: THREE.Line;
  private lineGeo: THREE.BufferGeometry;

  private jumpingFish = new THREE.Group();
  private jumpStart = new THREE.Vector3();
  private jumpEnd = new THREE.Vector3();
  private jumpT = 1;

  constructor(
    scene: THREE.Scene,
    private inventory: InventorySystem,
    private particles: ParticleSystem,
    private sound: SoundManager,
    private tasks: TaskSystem,
    private callbacks: {
      onToast: (text: string, tone?: 'default' | 'success' | 'info' | 'celebrate') => void;
      onToolSwing: (action: 'hoe' | 'water' | 'plant' | 'feed' | 'harvest') => void;
    }
  ) {
    // 3D Red-and-white Fishing Bobber
    const topHalf = new THREE.Mesh(
      new THREE.SphereGeometry(0.11, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: '#eb5546', roughness: 0.35 })
    );
    const botHalf = new THREE.Mesh(
      new THREE.SphereGeometry(0.11, 10, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.35 })
    );
    const pin = new THREE.Mesh(
      new THREE.CylinderGeometry(0.015, 0.015, 0.28, 6),
      new THREE.MeshStandardMaterial({ color: '#ffe578', roughness: 0.4 })
    );
    pin.position.y = 0.08;
    this.bobber.add(topHalf, botHalf, pin);
    this.bobber.visible = false;
    this.group.add(this.bobber);

    // 3D Fishing Line connecting rod tip to bobber
    this.lineGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(),
      new THREE.Vector3(),
      new THREE.Vector3(),
    ]);
    this.lineMesh = new THREE.Line(
      this.lineGeo,
      new THREE.LineBasicMaterial({ color: '#eefaff', transparent: true, opacity: 0.85 })
    );
    this.lineMesh.visible = false;
    this.group.add(this.lineMesh);

    // 3D Jumping Catch Fish animation mesh
    const fishMat = new THREE.MeshStandardMaterial({ color: '#f5b84c', roughness: 0.3 });
    const fBody = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), fishMat);
    fBody.scale.set(1.8, 0.72, 0.52);
    const fTail = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.22, 6), fishMat);
    fTail.rotation.z = Math.PI / 2;
    fTail.position.x = -0.28;
    this.jumpingFish.add(fBody, fTail);
    this.jumpingFish.visible = false;
    this.group.add(this.jumpingFish);

    scene.add(this.group);
  }

  public isActive(): boolean {
    return this.phase !== 'idle';
  }

  public getNearbyWater(playerPos: THREE.Vector3): 'pond' | 'lake' | null {
    const pondDx = (playerPos.x - WORLD_CONFIG.pondCenter.x) / (WORLD_CONFIG.pondRadiusX + 4.5);
    const pondDz = (playerPos.z - WORLD_CONFIG.pondCenter.z) / (WORLD_CONFIG.pondRadiusZ + 4.5);
    if (pondDx * pondDx + pondDz * pondDz <= 1.0) return 'pond';

    const lakeDx = (playerPos.x - WORLD_CONFIG.lakeCenter.x) / (WORLD_CONFIG.lakeRadiusX + 5.5);
    const lakeDz = (playerPos.z - WORLD_CONFIG.lakeCenter.z) / (WORLD_CONFIG.lakeRadiusZ + 5.5);
    if (lakeDx * lakeDx + lakeDz * lakeDz <= 1.0) return 'lake';

    return null;
  }

  public getHudInfo(playerPos: THREE.Vector3): InteractionInfo | null {
    if (this.inventory.getSelectedItemId() !== 'fishing_rod') return null;

    if (this.phase === 'biting') {
      return {
        id: 'fishing_bite',
        title: '🐟 Fish On The Line!',
        subtitle: this.activeWater === 'lake' ? 'A lively Emerald Lake fish is biting!' : 'A Duck Pond fish is biting!',
        actionText: 'REEL IN NOW! (Click / E)',
        canAct: true,
        iconId: 'fishing_rod',
        badge: { text: 'BITE!', tone: 'happy' },
      };
    }

    if (this.phase === 'waiting') {
      return {
        id: 'fishing_waiting',
        title: this.activeWater === 'lake' ? 'Fishing at Emerald Lake' : 'Fishing at Duck Pond',
        subtitle: 'Watch the red bobber closely for a splash & bite...',
        actionText: 'Reel Line Back Early',
        canAct: true,
        iconId: 'fishing_rod',
        badge: { text: 'Waiting...', tone: 'info' },
      };
    }

    const near = this.getNearbyWater(playerPos);
    if (near) {
      return {
        id: 'fishing_ready',
        title: near === 'lake' ? 'Emerald Lake Fishing Spot' : 'Duck Pond Fishing Spot',
        subtitle:
          near === 'lake'
            ? 'Deep emerald waters home to Trout, Silver Salmon & rare Starlight Koi!'
            : 'Peaceful farm pond home to Golden Carp & River Trout!',
        actionText: 'Cast Fishing Line (Click / E)',
        canAct: true,
        iconId: 'fishing_rod',
        badge: { text: 'Fishing Ready', tone: 'good' },
      };
    }
    return null;
  }

  public tryCastOrReel(playerPos: THREE.Vector3, camera: THREE.Camera): boolean {
    if (this.inventory.getSelectedItemId() !== 'fishing_rod') return false;

    if (this.phase === 'waiting') {
      this.cancel();
      this.callbacks.onToast('Reeled the line back in early.', 'info');
      return true;
    }

    if (this.phase === 'biting') {
      this.completeCatch(playerPos);
      return true;
    }

    const near = this.getNearbyWater(playerPos);
    if (!near) return false;

    // Cast bobber forward onto the water surface!
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    forward.y = 0;
    if (forward.lengthSq() < 0.001) forward.set(0, 0, -1);
    forward.normalize();

    const target = playerPos.clone().addScaledVector(forward, 5.2);
    const center = near === 'lake' ? WORLD_CONFIG.lakeCenter : WORLD_CONFIG.pondCenter;
    const rx = (near === 'lake' ? WORLD_CONFIG.lakeRadiusX : WORLD_CONFIG.pondRadiusX) * 0.78;
    const rz = (near === 'lake' ? WORLD_CONFIG.lakeRadiusZ : WORLD_CONFIG.pondRadiusZ) * 0.78;

    // Clamp bobber neatly inside the water body so it always lands in water!
    const nx = (target.x - center.x) / rx;
    const nz = (target.z - center.z) / rz;
    const normLen = Math.hypot(nx, nz);
    if (normLen > 1) {
      target.x = center.x + (nx / normLen) * rx;
      target.z = center.z + (nz / normLen) * rz;
    }

    this.bobberPos.set(target.x, 0.16, target.z);
    this.bobber.position.copy(this.bobberPos);
    this.bobber.visible = true;
    this.lineMesh.visible = true;
    this.activeWater = near;
    this.phase = 'waiting';
    this.timer = 2.0 + Math.random() * 2.2;

    this.particles.spawnWaterSplash(this.bobberPos, 12);
    this.sound.playWater();
    this.callbacks.onToolSwing('water');
    return true;
  }

  private completeCatch(playerPos: THREE.Vector3): void {
    const roll = Math.random();
    let fishId: ItemId = 'fish_carp';
    if (this.activeWater === 'lake') {
      if (roll < 0.18) fishId = 'fish_koi';
      else if (roll < 0.56) fishId = 'fish_salmon';
      else fishId = 'fish_trout';
    } else {
      fishId = roll < 0.62 ? 'fish_carp' : 'fish_trout';
    }

    this.inventory.addItem(fishId, 1);
    this.tasks.complete('quest_fish');

    // Launch celebratory jumping fish arc toward player!
    this.jumpStart.copy(this.bobberPos);
    this.jumpEnd.copy(playerPos).setY(1.25);
    this.jumpT = 0;
    this.jumpingFish.visible = true;

    this.particles.spawnWaterSplash(this.bobberPos, 20);
    this.particles.spawnSparkles(this.bobberPos.clone().add(new THREE.Vector3(0, 0.6, 0)), 14);
    this.sound.playTaskComplete();
    this.callbacks.onToolSwing('harvest');
    this.callbacks.onToast(`🐟 Caught a fresh ${ITEMS[fishId].name}!`, 'celebrate');

    this.cancel();
  }

  public cancel(): void {
    this.phase = 'idle';
    this.bobber.visible = false;
    this.lineMesh.visible = false;
  }

  public update(dt: number, elapsed: number, playerPos: THREE.Vector3, camera: THREE.Camera): void {
    // Animate caught jumping fish arc
    if (this.jumpT < 1) {
      this.jumpT = Math.min(1, this.jumpT + dt * 2.1);
      const p = new THREE.Vector3().lerpVectors(this.jumpStart, this.jumpEnd, this.jumpT);
      p.y += Math.sin(this.jumpT * Math.PI) * 2.1;
      this.jumpingFish.position.copy(p);
      this.jumpingFish.rotation.z = Math.sin(elapsed * 22) * 0.5;
      this.jumpingFish.rotation.y += dt * 8;
      if (this.jumpT >= 1) this.jumpingFish.visible = false;
    }

    if (this.phase === 'idle') return;

    // Retract if player unequips fishing rod or walks away
    if (this.inventory.getSelectedItemId() !== 'fishing_rod' || !this.getNearbyWater(playerPos)) {
      this.cancel();
      return;
    }

    this.timer -= dt;

    if (this.phase === 'waiting') {
      this.bobber.position.set(
        this.bobberPos.x,
        this.bobberPos.y + Math.sin(elapsed * 3.8) * 0.03,
        this.bobberPos.z
      );
      if (this.timer <= 0) {
        this.phase = 'biting';
        this.timer = 3.2; // Generous cozy catch window
        this.particles.spawnWaterSplash(this.bobberPos, 18);
        this.sound.playCollectProduct();
        this.callbacks.onToast('🐟 BITE! Click or press E NOW to reel in!', 'success');
      }
    } else if (this.phase === 'biting') {
      this.bobber.position.set(
        this.bobberPos.x + Math.sin(elapsed * 24) * 0.05,
        this.bobberPos.y - 0.09 + Math.sin(elapsed * 18) * 0.05,
        this.bobberPos.z + Math.cos(elapsed * 20) * 0.05
      );
      if (this.timer <= 0) {
        this.cancel();
        this.callbacks.onToast('The fish slipped away — cast again!', 'info');
      }
    }

    // Update curved fishing line from rod tip (right-front of camera) to bobber
    const rodTip = new THREE.Vector3(0.36, -0.05, -1.15).applyMatrix4(camera.matrixWorld);
    const mid = new THREE.Vector3().lerpVectors(rodTip, this.bobber.position, 0.5);
    mid.y -= this.phase === 'biting' ? 0.05 : 0.35;
    this.lineGeo.setFromPoints([rodTip, mid, this.bobber.position.clone()]);
  }
}
