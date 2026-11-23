import * as THREE from 'three';
import { getFarmTextures, FarmTextures } from '../assets/textures';
import { modelLibrary } from '../assets/modelLoader';
import { AnimalSpawnSpec, INITIAL_ANIMALS, ITEMS, WORLD_CONFIG } from '../config/farmConfig';
import { AnimalSpecies, InteractableTarget, InteractionInfo, ItemId } from '../types';
import { InventorySystem } from '../game/InventorySystem';
import { ParticleSystem } from '../effects/ParticleSystem';
import { SoundManager } from '../audio/SoundManager';
import { TaskSystem } from '../game/TaskSystem';

type AnimalState = 'idle' | 'wander' | 'approach_food' | 'eating' | 'happy';

interface FoodPile {
  id: number;
  mesh: THREE.Group;
  position: THREE.Vector3;
  claimedBy: string | null;
  remaining: number; // 1 -> 0 while eaten
}

interface CollectibleDrop {
  id: string;
  itemId: ItemId;
  name: string;
  mesh: THREE.Group;
  position: THREE.Vector3;
  age: number;
}

interface FarmAnimal {
  id: string;
  spec: AnimalSpawnSpec;
  root: THREE.Group;
  bodyGroup: THREE.Group;
  headGroup: THREE.Group;
  legs: THREE.Object3D[];
  tail?: THREE.Object3D;
  wings?: THREE.Object3D[];
  hitMesh: THREE.Mesh;
  readyHalo: THREE.Mesh;
  glbHolder: THREE.Group;
  usesGlb: boolean;
  mixer: THREE.AnimationMixer | null;
  actions: Partial<Record<'idle' | 'walk' | 'eat' | 'happy', THREE.AnimationAction>>;
  currentActionKey: 'idle' | 'walk' | 'eat' | 'happy' | null;

  position: THREE.Vector3;
  yaw: number;
  collisionRadius: number;
  state: AnimalState;
  stateTimer: number;
  wanderTarget: THREE.Vector3;
  targetFood: FoodPile | null;

  walkCycle: number;
  happyTimer: number; // > 0 means recently fed & happy
  hopAnim: number; // 0..1 joyful jump
  productReadyOnAnimal: boolean; // For Cows (Milk) and Sheep (Wool)
  soundCooldown: number;
  ambientSoundTimer: number;
  speed: number;
  bodyHeight: number;
}

export class AnimalSystem {
  public group = new THREE.Group();
  public interactables: InteractableTarget[] = [];

  private textures: FarmTextures;
  private animals: FarmAnimal[] = [];
  private foodPiles: FoodPile[] = [];
  private drops: CollectibleDrop[] = [];
  private nextFoodId = 1;
  private nextDropId = 1;

  private onToast: (text: string, tone?: 'default' | 'success' | 'info' | 'celebrate') => void;
  private onToolSwing: (action: 'feed' | 'harvest') => void;

  constructor(
    scene: THREE.Scene,
    private inventory: InventorySystem,
    private particles: ParticleSystem,
    private sound: SoundManager,
    private tasks: TaskSystem,
    callbacks: {
      onToast: (text: string, tone?: 'default' | 'success' | 'info' | 'celebrate') => void;
      onToolSwing: (action: 'feed' | 'harvest') => void;
    }
  ) {
    this.textures = getFarmTextures();
    this.onToast = callbacks.onToast;
    this.onToolSwing = callbacks.onToolSwing;

    for (let i = 0; i < INITIAL_ANIMALS.length; i++) {
      this.spawnAnimal(INITIAL_ANIMALS[i], i);
    }

    scene.add(this.group);
  }

  private addCuteEyes(parent: THREE.Object3D, positions: [number, number, number][], radius = 0.042): void {
    const darkMat = new THREE.MeshStandardMaterial({ color: '#241a16', roughness: 0.15 });
    const glintMat = new THREE.MeshBasicMaterial({ color: '#ffffff' });
    const blushMat = new THREE.MeshStandardMaterial({ color: '#ff9eb8', roughness: 0.7 });

    for (const [ex, ey, ez] of positions) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(radius, 8, 6), darkMat);
      eye.position.set(ex, ey, ez);
      parent.add(eye);

      const glint = new THREE.Mesh(new THREE.SphereGeometry(radius * 0.38, 6, 5), glintMat);
      glint.position.set(ex + radius * 0.35, ey + radius * 0.32, ez + (ez >= 0 ? radius * 0.55 : -radius * 0.55));
      parent.add(glint);

      const cheek = new THREE.Mesh(new THREE.SphereGeometry(radius * 0.62, 6, 5), blushMat);
      cheek.scale.set(0.55, 0.35, 0.35);
      cheek.position.set(ex - radius * 0.2, ey - radius * 0.95, ez * 0.94);
      parent.add(cheek);
    }
  }

  private buildChickenModel(variant: number): {
    bodyGroup: THREE.Group;
    headGroup: THREE.Group;
    legs: THREE.Object3D[];
    wings: THREE.Object3D[];
    hitSize: [number, number, number];
    height: number;
  } {
    const featherColors = ['#fffaf0', '#f9d89c', '#f3c19d'];
    const bodyMat = new THREE.MeshStandardMaterial({ color: featherColors[variant % 3], roughness: 0.82 });
    const combMat = new THREE.MeshStandardMaterial({ color: '#ea5c52', roughness: 0.55 });
    const beakMat = new THREE.MeshStandardMaterial({ color: '#f59e3d', roughness: 0.55 });

    const bodyGroup = new THREE.Group();

    // Plump oval feathered body with warm cream chest highlight
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.32, 14, 12), bodyMat);
    body.scale.set(1.24, 0.96, 0.96);
    body.position.y = 0.44;
    body.castShadow = true;
    bodyGroup.add(body);

    // 3-feather scalloped fan tail!
    for (let f = -1; f <= 1; f++) {
      const feather = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.3, 8), bodyMat);
      feather.scale.set(0.7, 1, 1.15);
      feather.position.set(-0.34, 0.56 + (f === 0 ? 0.04 : 0), f * 0.085);
      feather.rotation.z = 0.72 + Math.abs(f) * 0.12;
      feather.rotation.x = f * 0.28;
      feather.castShadow = true;
      bodyGroup.add(feather);
    }

    // Layered flapping cute wings with feather-tip accent
    const wings: THREE.Object3D[] = [];
    for (const side of [-1, 1]) {
      const wingPivot = new THREE.Group();
      wingPivot.position.set(0, 0.48, side * 0.28);
      const wing = new THREE.Mesh(new THREE.SphereGeometry(0.19, 10, 8), bodyMat);
      wing.scale.set(1.28, 0.72, 0.34);
      wing.position.set(-0.02, -0.05, side * 0.04);
      wing.castShadow = true;
      wingPivot.add(wing);
      const wingTip = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6), bodyMat);
      wingTip.scale.set(1.15, 0.55, 0.28);
      wingTip.position.set(-0.14, -0.09, side * 0.055);
      wingPivot.add(wingTip);
      bodyGroup.add(wingPivot);
      wings.push(wingPivot);
    }

    // Head group with tapered neck collar & scalloped red comb
    const headGroup = new THREE.Group();
    headGroup.position.set(0.28, 0.68, 0);
    const neckRuff = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.2, 0.16, 10), bodyMat);
    neckRuff.position.set(-0.04, -0.1, 0);
    headGroup.add(neckRuff);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10), bodyMat);
    head.castShadow = true;
    headGroup.add(head);

    // Red scalloped comb & wattle
    for (let c = 0; c < 3; c++) {
      const bump = new THREE.Mesh(new THREE.SphereGeometry(0.055, 6, 5), combMat);
      bump.position.set(0.05 - c * 0.065, 0.2 + (c === 1 ? 0.025 : 0), 0);
      headGroup.add(bump);
    }
    const wattle = new THREE.Mesh(new THREE.SphereGeometry(0.045, 6, 5), combMat);
    wattle.position.set(0.17, -0.09, 0);
    headGroup.add(wattle);

    // Bright orange beak
    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.065, 0.16, 6), beakMat);
    beak.rotation.z = -Math.PI / 2;
    beak.position.set(0.24, -0.02, 0);
    headGroup.add(beak);

    this.addCuteEyes(headGroup, [[0.12, 0.05, 0.15], [0.12, 0.05, -0.15]], 0.036);
    bodyGroup.add(headGroup);

    // Stubby 3-toed orange chicken feet!
    const legs: THREE.Object3D[] = [];
    for (const side of [-1, 1]) {
      const leg = new THREE.Group();
      leg.position.set(0, 0.24, side * 0.12);
      const shin = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.025, 0.22, 7), beakMat);
      shin.position.y = -0.11;
      leg.add(shin);
      for (const toeAng of [-0.42, 0, 0.42]) {
        const toe = new THREE.Mesh(new THREE.CapsuleGeometry(0.014, 0.08, 4, 5), beakMat);
        toe.rotation.z = Math.PI / 2;
        toe.rotation.y = toeAng;
        toe.position.set(0.045, -0.22, Math.sin(toeAng) * 0.035);
        leg.add(toe);
      }
      bodyGroup.add(leg);
      legs.push(leg);
    }

    return { bodyGroup, headGroup, legs, wings, hitSize: [1.1, 1.15, 1.0], height: 0.95 };
  }

  private buildCowModel(variant: number): {
    bodyGroup: THREE.Group;
    headGroup: THREE.Group;
    legs: THREE.Object3D[];
    tail: THREE.Object3D;
    hitSize: [number, number, number];
    height: number;
  } {
    const coatTex = variant % 2 === 0 ? this.textures.cowSpots : this.textures.cowSpotsBrown;
    const coatMat = new THREE.MeshStandardMaterial({ map: coatTex, roughness: 0.85 });
    const whiteMat = new THREE.MeshStandardMaterial({ color: '#fff9ef', roughness: 0.85 });
    const snoutMat = new THREE.MeshStandardMaterial({ color: '#f9b7c4', roughness: 0.72 });
    const hornMat = new THREE.MeshStandardMaterial({ color: '#f0dfba', roughness: 0.7 });
    const hoofMat = new THREE.MeshStandardMaterial({ color: '#594840', roughness: 0.85 });
    const bellMat = new THREE.MeshStandardMaterial({ color: '#f5c74d', metalness: 0.35, roughness: 0.35 });

    const bodyGroup = new THREE.Group();

    // Chubby rounded capsule torso
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.56, 0.82, 8, 12), coatMat);
    torso.rotation.z = Math.PI / 2;
    torso.position.y = 1.08;
    torso.castShadow = true;
    torso.receiveShadow = true;
    bodyGroup.add(torso);

    // Cute pink udder underneath
    const udder = new THREE.Mesh(new THREE.SphereGeometry(0.24, 8, 6), snoutMat);
    udder.scale.set(1.0, 0.75, 0.9);
    udder.position.set(-0.2, 0.56, 0);
    bodyGroup.add(udder);

    // Tapered organic neck connecting torso to head + golden cowbell collar!
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.44, 0.56, 12), coatMat);
    neck.position.set(0.68, 1.24, 0);
    neck.rotation.z = -0.58;
    neck.castShadow = true;
    bodyGroup.add(neck);

    const collar = new THREE.Mesh(
      new THREE.TorusGeometry(0.35, 0.048, 8, 16),
      new THREE.MeshStandardMaterial({ color: '#e66c5c', roughness: 0.65 })
    );
    collar.rotation.y = Math.PI / 2;
    collar.position.set(0.7, 1.15, 0);
    bodyGroup.add(collar);
    const bell = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.17, 10), bellMat);
    bell.position.set(0.78, 0.76, 0);
    bodyGroup.add(bell);
    const clapper = new THREE.Mesh(new THREE.SphereGeometry(0.04, 7, 6), bellMat);
    clapper.position.set(0.78, 0.66, 0);
    bodyGroup.add(clapper);

    // Sculpted Head with fluffy hair tuft & two-stage curved ivory horns!
    const headGroup = new THREE.Group();
    headGroup.position.set(0.98, 1.4, 0);
    const cranium = new THREE.Mesh(new THREE.SphereGeometry(0.38, 12, 10), whiteMat);
    cranium.scale.set(1.14, 0.96, 0.95);
    cranium.castShadow = true;
    headGroup.add(cranium);

    // Cute soft hair tuft between the horns
    const hairTuft = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), coatMat);
    hairTuft.scale.set(1.1, 0.75, 1.0);
    hairTuft.position.set(0.12, 0.34, 0);
    headGroup.add(hairTuft);

    // Oversized cute pastel pink muzzle
    const muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.27, 10, 8), snoutMat);
    muzzle.scale.set(0.92, 0.74, 1.12);
    muzzle.position.set(0.32, -0.09, 0);
    muzzle.castShadow = true;
    headGroup.add(muzzle);

    // Nostrils
    const nostrilMat = new THREE.MeshStandardMaterial({ color: '#c47182', roughness: 0.7 });
    for (const sz of [-0.11, 0.11]) {
      const nos = new THREE.Mesh(new THREE.SphereGeometry(0.036, 6, 5), nostrilMat);
      nos.position.set(0.55, -0.07, sz);
      headGroup.add(nos);
    }

    // Little curved cream horns & floppy ears
    for (const side of [-1, 1]) {
      const horn = new THREE.Mesh(new THREE.ConeGeometry(0.065, 0.24, 7), hornMat);
      horn.position.set(0.04, 0.36, side * 0.22);
      horn.rotation.x = side * 0.35;
      horn.rotation.z = -0.25;
      headGroup.add(horn);

      const ear = new THREE.Mesh(new THREE.SphereGeometry(0.15, 7, 5), coatMat);
      ear.scale.set(0.65, 0.45, 1.35);
      ear.position.set(-0.02, 0.14, side * 0.42);
      ear.rotation.x = side * 0.35;
      headGroup.add(ear);
    }

    this.addCuteEyes(headGroup, [[0.24, 0.1, 0.27], [0.24, 0.1, -0.27]], 0.055);
    bodyGroup.add(headGroup);

    // Swishing tail
    const tail = new THREE.Group();
    tail.position.set(-0.92, 1.24, 0);
    const tailRod = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.025, 0.56, 6), whiteMat);
    tailRod.position.y = -0.26;
    tailRod.rotation.z = -0.22;
    tail.add(tailRod);
    const tuft = new THREE.Mesh(new THREE.SphereGeometry(0.085, 7, 6), hoofMat);
    tuft.position.set(-0.08, -0.55, 0);
    tail.add(tuft);
    bodyGroup.add(tail);

    // 4 Stubby sturdy legs
    const legs: THREE.Object3D[] = [];
    const legCoords: [number, number][] = [
      [0.48, 0.28], [0.48, -0.28], [-0.48, 0.28], [-0.48, -0.28],
    ];
    for (const [lx, lz] of legCoords) {
      const leg = new THREE.Group();
      leg.position.set(lx, 0.62, lz);
      const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.1, 0.5, 8), whiteMat);
      upper.position.y = -0.25;
      upper.castShadow = true;
      leg.add(upper);
      const hoof = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.115, 0.14, 8), hoofMat);
      hoof.position.y = -0.55;
      leg.add(hoof);
      bodyGroup.add(leg);
      legs.push(leg);
    }

    return { bodyGroup, headGroup, legs, tail, hitSize: [2.2, 1.9, 1.4], height: 1.78 };
  }

  private buildSheepModel(variant: number): {
    bodyGroup: THREE.Group;
    headGroup: THREE.Group;
    legs: THREE.Object3D[];
    hitSize: [number, number, number];
    height: number;
  } {
    const woolMat = new THREE.MeshStandardMaterial({
      map: this.textures.woolFluff,
      color: variant % 2 === 0 ? '#fffaf0' : '#f7ead5',
      roughness: 0.94,
    });
    const faceMat = new THREE.MeshStandardMaterial({ color: '#5c493e', roughness: 0.85 });

    const bodyGroup = new THREE.Group();

    // Lush 11-puff multi-layered cloud-like wool coat!
    const woolWarmMat = new THREE.MeshStandardMaterial({
      map: this.textures.woolFluff,
      color: variant % 2 === 0 ? '#f6ebd7' : '#efe0c8',
      roughness: 0.95,
    });
    const puffOffsets: [number, number, number, number, boolean][] = [
      [0, 0.82, 0, 0.48, false],
      [0.26, 0.86, 0.16, 0.34, false],
      [0.26, 0.86, -0.16, 0.34, false],
      [-0.28, 0.84, 0.15, 0.36, true],
      [-0.28, 0.84, -0.15, 0.36, true],
      [0.02, 1.1, 0, 0.36, false],
      [0.22, 1.04, 0, 0.28, false],
      [-0.22, 1.04, 0, 0.3, true],
      [0, 0.84, 0.34, 0.28, false],
      [0, 0.84, -0.34, 0.28, false],
      [-0.5, 0.84, 0, 0.23, false],
    ];
    for (const [px, py, pz, pr, alt] of puffOffsets) {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(pr, 10, 8), alt ? woolWarmMat : woolMat);
      puff.position.set(px, py, pz);
      puff.castShadow = true;
      puff.receiveShadow = true;
      bodyGroup.add(puff);
    }

    // Cute pastel ribbon collar + dainty golden sheep bell!
    const ribbonColor = variant % 2 === 0 ? '#7ec8f2' : '#f79ab8';
    const sheepCollar = new THREE.Mesh(
      new THREE.TorusGeometry(0.24, 0.036, 7, 14),
      new THREE.MeshStandardMaterial({ color: ribbonColor, roughness: 0.65 })
    );
    sheepCollar.rotation.y = Math.PI / 2;
    sheepCollar.position.set(0.45, 0.94, 0);
    bodyGroup.add(sheepCollar);
    const sheepBell = new THREE.Mesh(
      new THREE.SphereGeometry(0.065, 8, 6),
      new THREE.MeshStandardMaterial({ color: '#f5cb52', metalness: 0.45, roughness: 0.3 })
    );
    sheepBell.position.set(0.51, 0.69, 0);
    bodyGroup.add(sheepBell);

    // Cute warm-cocoa face + curled wool bangs & rosy inner ears!
    const headGroup = new THREE.Group();
    headGroup.position.set(0.62, 1.02, 0);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 10), faceMat);
    head.scale.set(1.12, 0.95, 0.92);
    head.castShadow = true;
    headGroup.add(head);

    const woolCrown = new THREE.Mesh(new THREE.SphereGeometry(0.2, 9, 7), woolMat);
    woolCrown.position.set(-0.02, 0.21, 0);
    headGroup.add(woolCrown);
    const woolBang = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6), woolMat);
    woolBang.position.set(0.13, 0.18, 0.05);
    headGroup.add(woolBang);

    const innerEarMat = new THREE.MeshStandardMaterial({ color: '#e8a2ad', roughness: 0.75 });
    const noseMat = new THREE.MeshStandardMaterial({ color: '#e8a2ad', roughness: 0.65 });
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.055, 7, 6), noseMat);
    nose.scale.set(0.65, 0.75, 1.15);
    nose.position.set(0.28, -0.05, 0);
    headGroup.add(nose);

    for (const side of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), faceMat);
      ear.scale.set(0.62, 0.44, 1.4);
      ear.position.set(-0.04, 0.06, side * 0.28);
      ear.rotation.x = side * 0.45;
      headGroup.add(ear);
      const inner = new THREE.Mesh(new THREE.SphereGeometry(0.075, 7, 5), innerEarMat);
      inner.scale.set(0.5, 0.3, 1.1);
      inner.position.set(0.0, 0.04, side * 0.29);
      inner.rotation.x = side * 0.45;
      headGroup.add(inner);
    }

    this.addCuteEyes(headGroup, [[0.18, 0.06, 0.17], [0.18, 0.06, -0.17]], 0.042);
    bodyGroup.add(headGroup);

    // 4 cute dark hooves
    const legs: THREE.Object3D[] = [];
    const legCoords: [number, number][] = [
      [0.28, 0.2], [0.28, -0.2], [-0.28, 0.2], [-0.28, -0.2],
    ];
    for (const [lx, lz] of legCoords) {
      const leg = new THREE.Group();
      leg.position.set(lx, 0.44, lz);
      const shin = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.065, 0.44, 7), faceMat);
      shin.position.y = -0.22;
      shin.castShadow = true;
      leg.add(shin);
      bodyGroup.add(leg);
      legs.push(leg);
    }

    return { bodyGroup, headGroup, legs, hitSize: [1.55, 1.45, 1.2], height: 1.38 };
  }

  private buildPigModel(variant: number): {
    bodyGroup: THREE.Group;
    headGroup: THREE.Group;
    legs: THREE.Object3D[];
    tail: THREE.Object3D;
    hitSize: [number, number, number];
    height: number;
  } {
    const pinkMat = new THREE.MeshStandardMaterial({
      color: variant % 2 === 0 ? '#f9b3be' : '#f4a3b5',
      roughness: 0.72,
    });
    const snoutMat = new THREE.MeshStandardMaterial({ color: '#f28fa3', roughness: 0.68 });
    const hoofMat = new THREE.MeshStandardMaterial({ color: '#7d5b54', roughness: 0.8 });

    const bodyGroup = new THREE.Group();

    // Round rosy piglet body
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.38, 0.46, 8, 10), pinkMat);
    torso.rotation.z = Math.PI / 2;
    torso.position.y = 0.62;
    torso.castShadow = true;
    torso.receiveShadow = true;
    bodyGroup.add(torso);

    // Head with cute upturned oval snout & floppy ears
    const headGroup = new THREE.Group();
    headGroup.position.set(0.56, 0.78, 0);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), pinkMat);
    head.castShadow = true;
    headGroup.add(head);

    const snout = new THREE.Mesh(new THREE.CylinderGeometry(0.135, 0.148, 0.16, 12), snoutMat);
    snout.rotation.z = Math.PI / 2;
    snout.scale.set(0.86, 1, 1.18);
    snout.position.set(0.28, -0.04, 0);
    headGroup.add(snout);
    const snoutRim = new THREE.Mesh(new THREE.TorusGeometry(0.132, 0.022, 6, 14), snoutMat);
    snoutRim.rotation.y = Math.PI / 2;
    snoutRim.scale.set(1.16, 0.85, 1);
    snoutRim.position.set(0.355, -0.04, 0);
    headGroup.add(snoutRim);

    const nosMat = new THREE.MeshStandardMaterial({ color: '#8f4759', roughness: 0.7 });
    for (const sz of [-0.055, 0.055]) {
      const nos = new THREE.Mesh(new THREE.SphereGeometry(0.026, 6, 5), nosMat);
      nos.position.set(0.365, -0.04, sz);
      headGroup.add(nos);
    }

    for (const side of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.24, 7), pinkMat);
      ear.position.set(0.04, 0.25, side * 0.21);
      ear.rotation.z = -0.62;
      ear.rotation.x = side * 0.42;
      headGroup.add(ear);
      const innerEar = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.15, 6), snoutMat);
      innerEar.position.set(0.08, 0.23, side * 0.2);
      innerEar.rotation.z = -0.62;
      innerEar.rotation.x = side * 0.42;
      headGroup.add(innerEar);
    }

    this.addCuteEyes(headGroup, [[0.19, 0.08, 0.2], [0.19, 0.08, -0.2]], 0.042);
    bodyGroup.add(headGroup);

    // True double-loop corkscrew curly pig tail!
    const tail = new THREE.Group();
    tail.position.set(-0.56, 0.72, 0);
    const curl1 = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.024, 7, 14, Math.PI * 1.65), snoutMat);
    curl1.position.set(-0.06, 0.02, 0);
    tail.add(curl1);
    const curl2 = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.02, 6, 12, Math.PI * 1.5), snoutMat);
    curl2.position.set(-0.12, 0.05, 0.025);
    curl2.rotation.y = 0.5;
    tail.add(curl2);
    bodyGroup.add(tail);

    // 4 stubby legs
    const legs: THREE.Object3D[] = [];
    const legCoords: [number, number][] = [
      [0.26, 0.2], [0.26, -0.2], [-0.26, 0.2], [-0.26, -0.2],
    ];
    for (const [lx, lz] of legCoords) {
      const leg = new THREE.Group();
      leg.position.set(lx, 0.32, lz);
      const shin = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.065, 0.24, 7), pinkMat);
      shin.position.y = -0.12;
      shin.castShadow = true;
      leg.add(shin);
      const hoof = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.072, 0.08, 7), hoofMat);
      hoof.position.y = -0.28;
      leg.add(hoof);
      bodyGroup.add(leg);
      legs.push(leg);
    }

    return { bodyGroup, headGroup, legs, tail, hitSize: [1.45, 1.2, 1.1], height: 1.1 };
  }

  private spawnAnimal(spec: AnimalSpawnSpec, idx: number): void {
    const root = new THREE.Group();
    root.position.set(spec.x, 0, spec.z);

    let built: {
      bodyGroup: THREE.Group;
      headGroup: THREE.Group;
      legs: THREE.Object3D[];
      tail?: THREE.Object3D;
      wings?: THREE.Object3D[];
      hitSize: [number, number, number];
      height: number;
    };

    if (spec.species === 'chicken') built = this.buildChickenModel(spec.variant);
    else if (spec.species === 'cow') built = this.buildCowModel(spec.variant);
    else if (spec.species === 'sheep') built = this.buildSheepModel(spec.variant);
    else built = this.buildPigModel(spec.variant);

    root.add(built.bodyGroup);

    // Holder for upgraded skeletal-animated GLB animal models!
    const glbHolder = new THREE.Group();
    root.add(glbHolder);

    // Soft glowing golden indicator ring on ground when cow/sheep is ready to harvest!
    const readyHalo = new THREE.Mesh(
      new THREE.RingGeometry(0.65, 0.84, 18),
      new THREE.MeshBasicMaterial({
        color: '#ffe880',
        transparent: true,
        opacity: 0.78,
        side: THREE.DoubleSide,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
      })
    );
    readyHalo.rotation.x = -Math.PI / 2;
    readyHalo.position.y = 0.06;
    readyHalo.visible = false;
    root.add(readyHalo);

    // Generous invisible raycast collider so looking at cute moving animals feels snappy
    const hitMesh = new THREE.Mesh(
      new THREE.BoxGeometry(built.hitSize[0], built.hitSize[1], built.hitSize[2]),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    hitMesh.position.y = built.hitSize[1] * 0.5;
    root.add(hitMesh);

    this.group.add(root);

    const speedMap: Record<AnimalSpecies, number> = {
      chicken: 1.85,
      cow: 1.25,
      sheep: 1.45,
      pig: 1.65,
    };

    const radiusMap: Record<AnimalSpecies, number> = {
      chicken: 0.38,
      cow: 0.96,
      sheep: 0.64,
      pig: 0.58,
    };

    const animal: FarmAnimal = {
      id: `animal_${idx}_${spec.name.toLowerCase()}`,
      spec,
      root,
      bodyGroup: built.bodyGroup,
      headGroup: built.headGroup,
      legs: built.legs,
      tail: built.tail,
      wings: built.wings,
      hitMesh,
      readyHalo,
      glbHolder,
      usesGlb: false,
      mixer: null,
      actions: {},
      currentActionKey: null,
      position: new THREE.Vector3(spec.x, 0, spec.z),
      yaw: Math.random() * Math.PI * 2,
      collisionRadius: radiusMap[spec.species],
      state: 'idle',
      stateTimer: 1.5 + Math.random() * 2.5,
      wanderTarget: new THREE.Vector3(spec.x, 0, spec.z),
      targetFood: null,
      walkCycle: Math.random() * Math.PI * 2,
      happyTimer: 0,
      hopAnim: 0,
      productReadyOnAnimal: false,
      soundCooldown: 0,
      ambientSoundTimer: 6 + Math.random() * 14,
      speed: speedMap[spec.species],
      bodyHeight: built.height,
    };

    root.rotation.y = animal.yaw;
    this.animals.push(animal);

    this.interactables.push({
      id: animal.id,
      object: hitMesh,
      maxDistance: 4.5,
      getInfo: () => this.getAnimalInfo(animal),
      interact: () => this.interactWithAnimal(animal),
    });
  }

  private getSpeciesLabel(species: AnimalSpecies): string {
    return species.charAt(0).toUpperCase() + species.slice(1);
  }

  private getAnimalInfo(animal: FarmAnimal): InteractionInfo {
    const heldId = this.inventory.getSelectedItemId();
    const speciesLabel = this.getSpeciesLabel(animal.spec.species);
    const isHappy = animal.happyTimer > 0;

    // 1. Cow or Sheep has product ready directly on them!
    if (animal.productReadyOnAnimal) {
      const verb = animal.spec.species === 'cow' ? 'Milk' : 'Brush & Collect';
      return {
        id: animal.id,
        title: `${animal.spec.name} (${speciesLabel})`,
        subtitle: `Happy & ready to share ${animal.spec.productName}!`,
        actionText: `${verb} ${animal.spec.productName}`,
        canAct: true,
        iconId: animal.spec.productId,
        badge: { text: `${animal.spec.productName} Ready!`, tone: 'happy' },
      };
    }

    // 2. Currently eating
    if (animal.state === 'eating' || animal.state === 'approach_food') {
      return {
        id: animal.id,
        title: `${animal.spec.name} (${speciesLabel})`,
        subtitle: 'Happily munching golden animal feed!',
        actionText: `Pet ${animal.spec.name}`,
        canAct: true,
        iconId: 'heart',
        badge: { text: 'Munching!', tone: 'good' },
      };
    }

    // 3. Player holding Animal Feed
    if (heldId === 'animal_feed') {
      const qty = this.inventory.getCount('animal_feed');
      if (qty > 0) {
        return {
          id: animal.id,
          title: `${animal.spec.name} (${speciesLabel})`,
          subtitle: isHappy ? 'Content & cheerful, still loves treats!' : 'Hungry for some golden grain!',
          actionText: `Feed ${animal.spec.name}`,
          canAct: true,
          iconId: 'animal_feed',
          badge: isHappy
            ? { text: 'Happy ♥', tone: 'happy' }
            : { text: 'Hungry', tone: 'warn' },
        };
      }
      return {
        id: animal.id,
        title: `${animal.spec.name} (${speciesLabel})`,
        subtitle: 'Out of Animal Feed — restock at the Garden Supply Crate!',
        actionText: `Pet ${animal.spec.name}`,
        canAct: true,
        iconId: 'heart',
        badge: { text: 'No Feed', tone: 'warn' },
      };
    }

    // 4. Not holding feed — can always pet them!
    return {
      id: animal.id,
      title: `${animal.spec.name} (${speciesLabel})`,
      subtitle: isHappy
        ? 'Feeling loved and cozy!'
        : 'Hold Animal Feed [7] to feed for farm products',
      actionText: `Pet ${animal.spec.name}`,
      hintText: isHappy ? undefined : 'Press 7 for Animal Feed',
      canAct: true,
      iconId: 'heart',
      badge: isHappy
        ? { text: 'Happy ♥', tone: 'happy' }
        : { text: 'Hungry • Needs Feed', tone: 'info' },
    };
  }

  private interactWithAnimal(animal: FarmAnimal): boolean {
    // 1. Collect Milk from Cow or Wool from Sheep!
    if (animal.productReadyOnAnimal) {
      animal.productReadyOnAnimal = false;
      animal.readyHalo.visible = false;
      animal.hopAnim = 1.0;

      this.inventory.addItem(animal.spec.productId, 1);
      this.particles.spawnSparkles(animal.position.clone().add(new THREE.Vector3(0, animal.bodyHeight, 0)), 12);
      this.particles.spawnHearts(animal.position.clone().add(new THREE.Vector3(0, animal.bodyHeight + 0.1, 0)), 3);
      this.sound.playCollectProduct();
      this.sound.playAnimalSound(animal.spec.species);
      this.onToolSwing('harvest');

      if (animal.spec.species === 'cow') this.tasks.complete('quest_milk');
      if (animal.spec.species === 'sheep') this.tasks.complete('quest_friends');

      this.onToast(`Collected ${animal.spec.productName} from ${animal.spec.name}!`, 'success');
      return true;
    }

    // 2. Feed with Animal Feed!
    const heldId = this.inventory.getSelectedItemId();
    if (heldId === 'animal_feed' && this.inventory.getCount('animal_feed') > 0 && animal.state !== 'eating') {
      this.inventory.consumeItem('animal_feed', 1);
      // Drop a cute visible 3D food pile slightly in front of the animal so it visibly trots over and eats!
      const forward = new THREE.Vector3(Math.cos(animal.yaw), 0, -Math.sin(animal.yaw));
      const dropPos = animal.position.clone().addScaledVector(forward, 1.05);
      this.clampToPasture(dropPos);

      const pile = this.spawnFoodPile(dropPos, animal.id);
      animal.targetFood = pile;
      animal.state = 'approach_food';
      animal.stateTimer = 8.0;

      this.particles.spawnFeedCrumbs(dropPos.clone().add(new THREE.Vector3(0, 0.15, 0)), 12);
      this.sound.playPlant();
      this.sound.playAnimalSound(animal.spec.species);
      this.onToolSwing('feed');

      if (animal.spec.species === 'chicken') {
        this.tasks.complete('tut_chicken');
      }
      this.onToast(`Tossed golden feed for ${animal.spec.name}!`, 'default');
      return true;
    }

    // 3. Otherwise Pet the adorable animal!
    animal.hopAnim = 1.0;
    this.particles.spawnHearts(animal.position.clone().add(new THREE.Vector3(0, animal.bodyHeight + 0.1, 0)), 4);
    this.sound.playAnimalSound(animal.spec.species);
    this.onToast(`${animal.spec.name} loves the gentle pets! ♥`, 'default');
    return true;
  }

  private spawnFoodPile(pos: THREE.Vector3, claimedBy: string | null): FoodPile {
    const g = new THREE.Group();
    g.position.copy(pos);

    const grainMat = new THREE.MeshStandardMaterial({ color: '#f3cb5b', roughness: 0.85 });
    const seedMat = new THREE.MeshStandardMaterial({ color: '#d99e32', roughness: 0.82 });

    const mound = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.18, 9), grainMat);
    mound.position.y = 0.09;
    mound.castShadow = true;
    g.add(mound);

    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const bit = new THREE.Mesh(new THREE.SphereGeometry(0.055, 6, 5), i % 2 === 0 ? grainMat : seedMat);
      bit.position.set(Math.cos(a) * 0.17, 0.05, Math.sin(a) * 0.17);
      g.add(bit);
    }

    this.group.add(g);
    const pile: FoodPile = {
      id: this.nextFoodId++,
      mesh: g,
      position: pos.clone(),
      claimedBy,
      remaining: 1.0,
    };
    this.foodPiles.push(pile);
    return pile;
  }

  private spawnProductDrop(animal: FarmAnimal): void {
    // Limit clutter if player hasn't collected yet
    const existingForSpecies = this.drops.filter((d) => d.itemId === animal.spec.productId);
    if (existingForSpecies.length >= 4) return;

    const dropPos = animal.position.clone().add(new THREE.Vector3(
      (Math.random() - 0.5) * 0.8,
      0,
      (Math.random() - 0.5) * 0.8
    ));
    this.clampToPasture(dropPos);

    const g = new THREE.Group();
    g.position.copy(dropPos);

    if (animal.spec.productId === 'prod_egg') {
      // Cute tiny straw nest + warm speckled egg!
      const nest = new THREE.Mesh(
        new THREE.TorusGeometry(0.21, 0.065, 6, 12),
        new THREE.MeshStandardMaterial({ map: this.textures.hayGolden, roughness: 0.95 })
      );
      nest.rotation.x = Math.PI / 2;
      nest.position.y = 0.06;
      g.add(nest);

      const egg = new THREE.Mesh(
        new THREE.SphereGeometry(0.14, 10, 8),
        new THREE.MeshStandardMaterial({ color: '#fff3d6', roughness: 0.4 })
      );
      egg.scale.set(0.88, 1.22, 0.88);
      egg.position.y = 0.17;
      egg.castShadow = true;
      g.add(egg);
    } else {
      // Cozy woodland truffle with sparkle halo!
      const truffle = new THREE.Mesh(
        new THREE.DodecahedronGeometry(0.16, 1),
        new THREE.MeshStandardMaterial({ color: '#8a5f42', roughness: 0.78 })
      );
      truffle.scale.set(1.1, 0.82, 1.0);
      truffle.position.y = 0.14;
      truffle.castShadow = true;
      g.add(truffle);
    }

    // Gentle glowing ring underneath so drops are easy and inviting to spot!
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.26, 0.34, 16),
      new THREE.MeshBasicMaterial({
        color: '#ffe57f',
        transparent: true,
        opacity: 0.85,
        side: THREE.DoubleSide,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
      })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.05;
    g.add(ring);

    // Generous pickup hit box
    const hit = new THREE.Mesh(
      new THREE.BoxGeometry(0.95, 0.85, 0.95),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    hit.position.y = 0.35;
    g.add(hit);

    this.group.add(g);

    const dropId = `drop_${this.nextDropId++}`;
    const drop: CollectibleDrop = {
      id: dropId,
      itemId: animal.spec.productId,
      name: animal.spec.productName,
      mesh: g,
      position: dropPos,
      age: 0,
    };
    this.drops.push(drop);

    const interactable: InteractableTarget = {
      id: dropId,
      object: hit,
      maxDistance: 4.2,
      getInfo: () => ({
        id: dropId,
        title: drop.name,
        subtitle: `Gift from a happy ${animal.spec.species}!`,
        actionText: `Collect ${drop.name}`,
        canAct: true,
        iconId: drop.itemId,
        badge: { text: 'Fresh Farm Gift', tone: 'happy' },
      }),
      interact: () => {
        this.collectDrop(drop);
        return true;
      },
    };
    this.interactables.push(interactable);
  }

  private collectDrop(drop: CollectibleDrop): void {
    const idx = this.drops.indexOf(drop);
    if (idx === -1) return;
    this.drops.splice(idx, 1);
    this.group.remove(drop.mesh);

    const iIdx = this.interactables.findIndex((t) => t.id === drop.id);
    if (iIdx !== -1) this.interactables.splice(iIdx, 1);

    this.inventory.addItem(drop.itemId, 1);
    this.particles.spawnSparkles(drop.position.clone().add(new THREE.Vector3(0, 0.25, 0)), 10);
    this.sound.playCollectProduct();
    this.onToolSwing('harvest');

    if (drop.itemId === 'prod_egg') this.tasks.complete('quest_egg');
    if (drop.itemId === 'prod_truffle') this.tasks.complete('quest_friends');

    this.onToast(`Collected ${drop.name}!`, 'success');
  }

  private finishEating(animal: FarmAnimal): void {
    // Remove finished food pile
    if (animal.targetFood) {
      const idx = this.foodPiles.indexOf(animal.targetFood);
      if (idx !== -1) {
        this.group.remove(animal.targetFood.mesh);
        this.foodPiles.splice(idx, 1);
      }
      animal.targetFood = null;
    }

    animal.state = 'happy';
    animal.stateTimer = 2.4;
    animal.happyTimer = 42; // Stays blissfully happy for 42s
    animal.hopAnim = 1.0;

    // Joyful heart burst + happy animal reaction sound!
    this.particles.spawnHearts(
      animal.position.clone().add(new THREE.Vector3(0, animal.bodyHeight + 0.15, 0)),
      6
    );
    this.sound.playHappyChime();
    this.sound.playAnimalSound(animal.spec.species);

    // Produce species product!
    if (animal.spec.species === 'chicken' || animal.spec.species === 'pig') {
      this.spawnProductDrop(animal);
      this.onToast(
        animal.spec.species === 'chicken'
          ? `${animal.spec.name} is happy and laid a Fresh Egg!`
          : `${animal.spec.name} is delighted and found a Meadow Truffle!`,
        'success'
      );
    } else {
      animal.productReadyOnAnimal = true;
      animal.readyHalo.visible = true;
      this.onToast(
        `${animal.spec.name} is super happy! Interact to collect ${animal.spec.productName}.`,
        'success'
      );
    }
  }

  private clampToPasture(v: THREE.Vector3): void {
    const b = WORLD_CONFIG.pastureBounds;
    v.x = Math.max(b.minX, Math.min(b.maxX, v.x));
    v.z = Math.max(b.minZ, Math.min(b.maxZ, v.z));
    // Keep slightly clear of chicken coop (11.2, 12.1) & trough (15.2, 0.6)
    const coopDist = Math.hypot(v.x - 11.2, v.z - 12.1);
    if (coopDist < 1.8) {
      v.z = Math.min(v.z, 10.2);
    }
    const troughDist = Math.hypot(v.x - 15.2, v.z - 0.6);
    if (troughDist < 2.0) {
      v.z = Math.max(v.z, 2.2);
    }
  }

  private pickWanderPoint(animal: FarmAnimal): THREE.Vector3 {
    const b = WORLD_CONFIG.pastureBounds;
    // Keep each species loosely near its favorite cozy pasture zone
    let cx = animal.spec.x;
    let cz = animal.spec.z;
    const spread = animal.spec.species === 'chicken' ? 4.2 : 5.4;
    const target = new THREE.Vector3(
      cx + (Math.random() - 0.5) * spread * 2,
      0,
      cz + (Math.random() - 0.5) * spread * 2
    );
    target.x = Math.max(b.minX + 0.8, Math.min(b.maxX - 0.8, target.x));
    target.z = Math.max(b.minZ + 0.8, Math.min(b.maxZ - 0.8, target.z));
    this.clampToPasture(target);
    return target;
  }

  private moveToward(animal: FarmAnimal, target: THREE.Vector3, speedMult: number, dt: number): number {
    const dx = target.x - animal.position.x;
    const dz = target.z - animal.position.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.05) return dist;

    // Our animal models face +X in local space, so yaw = atan2(-dz, dx)
    const targetYaw = Math.atan2(-dz, dx);
    let diff = targetYaw - animal.yaw;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    animal.yaw += diff * Math.min(1, dt * 6.5);

    const step = Math.min(dist, animal.speed * speedMult * dt);
    animal.position.x += (dx / dist) * step;
    animal.position.z += (dz / dist) * step;
    this.clampToPasture(animal.position);
    animal.walkCycle += dt * (animal.spec.species === 'chicken' ? 11.5 : 7.8) * speedMult;
    return dist;
  }

  public getDynamicColliders(): { x: number; z: number; radius: number }[] {
    return this.animals.map((a) => ({
      x: a.position.x,
      z: a.position.z,
      radius: a.collisionRadius,
    }));
  }

  /**
   * Upgrades cows, chickens, and pigs to high-detail CC0 GLB models with real skeletal animations
   * once local models finish preloading.
   */
  public refreshLoadedModels(): void {
    for (const animal of this.animals) {
      if (animal.usesGlb) continue;

      if (animal.spec.species === 'cow') {
        const isCaramel = animal.spec.variant % 2 === 1;
        const built = modelLibrary.cloneAnimatedGrounded('animal_cow', 1.72, {
          rotateY: Math.PI / 2, // Align Quaternius +Z forward to our +X forward controller
          materialOverride: (mat) => {
            mat.roughness = 0.78;
            mat.metalness = 0.05;
            if (mat.name === 'Main') {
              // Bella: classic Holstein charcoal-cream; Clover: warm butterscotch caramel!
              mat.color.set(isCaramel ? '#b57b4c' : '#fff8ec');
              if (!isCaramel) {
                mat.map = this.textures.cowSpots;
                mat.needsUpdate = true;
              }
            } else if (mat.name === 'Main_Light') {
              mat.color.set('#fff9ef');
            } else if (mat.name === 'Muzzle') {
              mat.color.set('#f8b4c2');
            } else if (mat.name === 'Horns') {
              mat.color.set('#f0dfba');
            }
          },
        });

        if (built) {
          animal.glbHolder.add(built.group);
          animal.bodyGroup.visible = false;
          animal.usesGlb = true;
          animal.mixer = built.mixer;

          const findClip = (keyword: string) =>
            built.clips.find((c) => c.name.toLowerCase().includes(keyword.toLowerCase()));
          const idleClip = findClip('|idle') ?? built.clips[0];
          const walkClip = findClip('walk');
          const eatClip = findClip('eating');
          const happyClip = findClip('jump_toidle') ?? findClip('gallop_jump') ?? idleClip;

          if (idleClip) animal.actions.idle = built.mixer.clipAction(idleClip);
          if (walkClip) animal.actions.walk = built.mixer.clipAction(walkClip);
          if (eatClip) animal.actions.eat = built.mixer.clipAction(eatClip);
          if (happyClip) animal.actions.happy = built.mixer.clipAction(happyClip);
          this.playAnimalClip(animal, 'idle');
        }
      } else if (animal.spec.species === 'chicken') {
        const featherTones = ['#fff8eb', '#f7d894', '#ebb48d'];
        const tone = featherTones[animal.spec.variant % featherTones.length];
        const built = modelLibrary.cloneAnimatedGrounded('animal_chicken', 0.78, {
          rotateY: Math.PI / 2,
          materialOverride: (mat) => {
            mat.roughness = 0.8;
            mat.metalness = 0.02;
            if (mat.name === 'Chicken') mat.color.set(tone);
            else if (mat.name === 'Comb') mat.color.set('#e8564d');
            else mat.color.set('#f5a13d');
          },
        });

        if (built) {
          animal.glbHolder.add(built.group);
          animal.bodyGroup.visible = false;
          animal.usesGlb = true;
          animal.mixer = built.mixer;

          const byName = (n: string) => built.clips.find((c) => c.name.toLowerCase() === n.toLowerCase());
          const idleClip = byName('Idle') ?? byName('Stand') ?? built.clips[0];
          const walkClip = byName('Walk');
          const eatClip = byName('Eating') ?? byName('Pecking1');
          const happyClip = byName('Pecking2') ?? idleClip;

          if (idleClip) animal.actions.idle = built.mixer.clipAction(idleClip);
          if (walkClip) animal.actions.walk = built.mixer.clipAction(walkClip);
          if (eatClip) animal.actions.eat = built.mixer.clipAction(eatClip);
          if (happyClip) animal.actions.happy = built.mixer.clipAction(happyClip);
          this.playAnimalClip(animal, 'idle');
        }
      } else if (animal.spec.species === 'pig') {
        const skinHex = animal.spec.variant % 2 === 0 ? '#f9b5c1' : '#f4a3b5';
        const snoutHex = '#f28fa3';
        const pigModel = modelLibrary.cloneGrounded('animal_pig', 0.96);
        if (pigModel) {
          pigModel.rotation.y = Math.PI / 2;
          pigModel.traverse((child) => {
            if (child instanceof THREE.Mesh) {
              const mats = Array.isArray(child.material) ? child.material : [child.material];
              mats.forEach((m) => {
                if (m instanceof THREE.MeshStandardMaterial) {
                  m.roughness = 0.72;
                  if (m.name.toLowerCase().includes('piel')) m.color.set(skinHex);
                  else if (m.name.toLowerCase().includes('rosita')) m.color.set(snoutHex);
                }
              });
            }
          });
          animal.glbHolder.add(pigModel);
          animal.bodyGroup.visible = false;
          animal.usesGlb = true;
        }
      }
    }
  }

  private playAnimalClip(animal: FarmAnimal, key: 'idle' | 'walk' | 'eat' | 'happy'): void {
    if (!animal.mixer || animal.currentActionKey === key) return;
    const next = animal.actions[key] ?? animal.actions.idle;
    if (!next) return;
    const prev = animal.currentActionKey ? animal.actions[animal.currentActionKey] : undefined;
    next.reset().fadeIn(0.24).play();
    if (prev && prev !== next) {
      prev.fadeOut(0.24);
    }
    animal.currentActionKey = key;
  }

  public update(dt: number, elapsed: number, playerPos: THREE.Vector3): void {
    const playerHoldingFeed =
      this.inventory.getSelectedItemId() === 'animal_feed' &&
      this.inventory.getCount('animal_feed') > 0;

    // Gentle bob on collectible drops
    for (const d of this.drops) {
      d.age += dt;
      d.mesh.position.y = Math.sin(elapsed * 2.8 + d.age) * 0.035;
    }

    for (const animal of this.animals) {
      animal.happyTimer = Math.max(0, animal.happyTimer - dt);
      animal.soundCooldown = Math.max(0, animal.soundCooldown - dt);

      // Occasional soft background farm animal sound when player is near pasture
      animal.ambientSoundTimer -= dt;
      if (animal.ambientSoundTimer <= 0) {
        animal.ambientSoundTimer = 11 + Math.random() * 16;
        const pDist = animal.position.distanceTo(playerPos);
        if (pDist < 22) {
          this.sound.playAnimalSound(animal.spec.species, Math.max(0.18, 1 - pDist / 24));
        }
      }

      let isMoving = false;
      let headPitch = 0;

      if (animal.state === 'approach_food' && animal.targetFood) {
        const dist = this.moveToward(animal, animal.targetFood.position, 1.35, dt);
        isMoving = true;
        if (dist < 0.78) {
          animal.state = 'eating';
          animal.stateTimer = 2.1;
        }
      } else if (animal.state === 'eating') {
        animal.stateTimer -= dt;
        headPitch = -0.52 + Math.sin(elapsed * 14) * 0.16;
        if (animal.targetFood) {
          animal.targetFood.remaining = Math.max(0.15, animal.stateTimer / 2.1);
          animal.targetFood.mesh.scale.setScalar(animal.targetFood.remaining);
        }
        if (Math.random() < dt * 4.5) {
          this.particles.spawnFeedCrumbs(animal.position.clone().add(new THREE.Vector3(0, 0.2, 0)), 2);
        }
        if (animal.stateTimer <= 0) {
          this.finishEating(animal);
        }
      } else if (animal.state === 'happy') {
        animal.stateTimer -= dt;
        animal.yaw += Math.sin(elapsed * 9) * dt * 2.0;
        if (animal.stateTimer <= 0) {
          animal.state = 'idle';
          animal.stateTimer = 2.0 + Math.random() * 2.0;
        }
      } else {
        // Notice player holding Animal Feed! Walk eagerly toward the player, stopping politely outside personal space!
        const distToPlayer = Math.hypot(
          playerPos.x - animal.position.x,
          playerPos.z - animal.position.z
        );
        const politeStopDist = animal.collisionRadius + 1.55;
        const playerNearPasture =
          playerPos.x >= WORLD_CONFIG.pastureBounds.minX - 2.5 &&
          playerPos.x <= WORLD_CONFIG.pastureBounds.maxX + 2.5 &&
          playerPos.z >= WORLD_CONFIG.pastureBounds.minZ - 2.5 &&
          playerPos.z <= WORLD_CONFIG.pastureBounds.maxZ + 2.5;

        if (playerHoldingFeed && playerNearPasture && distToPlayer < 8.5 && animal.happyTimer <= 10) {
          if (distToPlayer > politeStopDist) {
            const desired = playerPos.clone();
            this.clampToPasture(desired);
            const rem = this.moveToward(animal, desired, 1.12, dt);
            isMoving = rem > 0.25;
          } else {
            const targetYaw = Math.atan2(-(playerPos.z - animal.position.z), playerPos.x - animal.position.x);
            let diff = targetYaw - animal.yaw;
            while (diff > Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;
            animal.yaw += diff * Math.min(1, dt * 6);
            headPitch = 0.14;
          }
        } else if (animal.state === 'wander') {
          const dist = this.moveToward(animal, animal.wanderTarget, 0.85, dt);
          isMoving = true;
          animal.stateTimer -= dt;
          if (dist < 0.45 || animal.stateTimer <= 0) {
            animal.state = 'idle';
            animal.stateTimer = 2.2 + Math.random() * 3.5;
          }
        } else {
          animal.stateTimer -= dt;
          headPitch = Math.sin(elapsed * 1.6 + animal.walkCycle) > 0.45 ? -0.32 : 0.04;
          if (animal.stateTimer <= 0) {
            animal.wanderTarget = this.pickWanderPoint(animal);
            animal.state = 'wander';
            animal.stateTimer = 4.5 + Math.random() * 3.5;
          }
        }
      }

      // Soft animal-to-animal personal space separation
      for (const other of this.animals) {
        if (other === animal) continue;
        const dx = animal.position.x - other.position.x;
        const dz = animal.position.z - other.position.z;
        const minSep = animal.collisionRadius + other.collisionRadius + 0.25;
        const dSq = dx * dx + dz * dz;
        if (dSq < minSep * minSep && dSq > 0.0001) {
          const d = Math.sqrt(dSq);
          const push = (minSep - d) * dt * 2.2;
          animal.position.x += (dx / d) * push;
          animal.position.z += (dz / d) * push;
          this.clampToPasture(animal.position);
        }
      }

      // SOLID Animal ↔ Player separation! Prevents cows, sheep, pigs, or chickens from EVER walking through the player!
      {
        const dx = animal.position.x - playerPos.x;
        const dz = animal.position.z - playerPos.z;
        const minPlayerSep = animal.collisionRadius + 0.56;
        const dSq = dx * dx + dz * dz;
        if (dSq < minPlayerSep * minPlayerSep) {
          const d = Math.sqrt(dSq) || 0.0001;
          const push = minPlayerSep - d;
          animal.position.x += (dx / d) * push;
          animal.position.z += (dz / d) * push;
          this.clampToPasture(animal.position);
          // If blocked while wandering, gently pick a new open spot around the player
          if (animal.state === 'wander') {
            animal.wanderTarget = this.pickWanderPoint(animal);
          }
        }
      }

      // Apply joyful hop bounce animation!
      let hopY = 0;
      if (animal.hopAnim > 0) {
        animal.hopAnim = Math.max(0, animal.hopAnim - dt * 2.1);
        hopY = Math.sin(animal.hopAnim * Math.PI) * 0.44;
      }

      if (animal.usesGlb) {
        // Drive skeletal AnimationMixer if rigged (Cows & Chickens!)
        if (animal.mixer) {
          const desiredClip: 'idle' | 'walk' | 'eat' | 'happy' =
            animal.state === 'eating'
              ? 'eat'
              : animal.state === 'happy' || animal.hopAnim > 0.25
                ? 'happy'
                : isMoving
                  ? 'walk'
                  : 'idle';
          this.playAnimalClip(animal, desiredClip);
          animal.mixer.update(dt);
          animal.glbHolder.position.y = animal.spec.species === 'cow' ? hopY * 0.45 : hopY;
        } else {
          // Sculpted static GLB (Pig): lively waddle-roll + bounce + eating head-dip!
          const waddle = isMoving ? Math.sin(animal.walkCycle) * 0.09 : 0;
          const walkBob = isMoving ? Math.abs(Math.sin(animal.walkCycle)) * 0.065 : 0;
          const eatDip = animal.state === 'eating' ? -0.22 + Math.sin(elapsed * 13) * 0.08 : 0;
          animal.glbHolder.position.y = walkBob + hopY;
          animal.glbHolder.rotation.x = waddle;
          animal.glbHolder.rotation.z = THREE.MathUtils.lerp(animal.glbHolder.rotation.z, eatDip, Math.min(1, dt * 8));
        }
      } else {
        // Procedural articulated rigs (Cloud Sheep + fallback while GLBs stream)
        const strideAmp = isMoving ? 0.48 : 0;
        animal.legs.forEach((leg, i) => {
          const sign = i % 2 === 0 ? 1 : -1;
          leg.rotation.z = Math.sin(animal.walkCycle) * strideAmp * sign;
        });

        if (animal.wings) {
          const flap =
            animal.hopAnim > 0 || animal.state === 'happy'
              ? Math.sin(elapsed * 22) * 0.65
              : isMoving
                ? Math.sin(animal.walkCycle) * 0.16
                : 0;
          animal.wings[0].rotation.x = flap;
          animal.wings[1].rotation.x = -flap;
        }

        if (animal.tail) {
          animal.tail.rotation.x = Math.sin(elapsed * (animal.happyTimer > 0 ? 10 : 3.5)) * 0.25;
        }

        const walkBob = isMoving ? Math.abs(Math.sin(animal.walkCycle)) * 0.065 : 0;
        animal.bodyGroup.position.y = walkBob + hopY;
        animal.headGroup.rotation.z = THREE.MathUtils.lerp(animal.headGroup.rotation.z, headPitch, Math.min(1, dt * 8));
      }

      // Pulse ready halo gently
      if (animal.readyHalo.visible) {
        const s = 1 + Math.sin(elapsed * 4) * 0.08;
        animal.readyHalo.scale.setScalar(s);
      }

      animal.root.position.copy(animal.position);
      animal.root.rotation.y = animal.yaw;
    }
  }
}
