import * as THREE from 'three';
import { FarmTextures } from '../assets/textures';
import { ParticleSystem } from '../effects/ParticleSystem';
import { SoundManager } from '../audio/SoundManager';
import { InventorySystem } from '../game/InventorySystem';
import { TaskSystem } from '../game/TaskSystem';
import { InteractableTarget } from '../types';

type FurnitureKind =
  | 'bed'
  | 'dining_table'
  | 'bookshelf'
  | 'hearth_lounge'
  | 'kitchen_stove'
  | 'workbench'
  | 'dairy_press'
  | 'trophy_rack'
  | 'barn_loft';

interface BuildSlot {
  id: string;
  title: string;
  subtitle: string;
  kind: FurnitureKind;
  cost: number;
  parent: THREE.Group;
  anchor: THREE.Group;
  blueprintGroup: THREE.Group;
  builtGroup: THREE.Group;
  accentMeshes: THREE.Mesh[];
  built: boolean;
  styleIndex: number;
}

const STYLE_PALETTES = [
  { name: 'Classic Oak', accent: '#e88b76', cloth: '#f5d284' },
  { name: 'Pastel Meadow', accent: '#79bd9a', cloth: '#a8d8ea' },
  { name: 'Berry Blossom', accent: '#e47fa3', cloth: '#f7c5d8' },
];

export class BuildingInteriors {
  public interactables: InteractableTarget[] = [];

  private farmhouseOpen = false;
  private farmhouseAngle = 0;
  private barnOpen = false;
  private barnAngle = 0;

  private slots: BuildSlot[] = [];
  private builtCount = 0;
  private hearthFlames: THREE.Mesh[] = [];
  private hearthLight?: THREE.PointLight;
  private houseCeilingLight?: THREE.PointLight;
  private barnCeilingLight?: THREE.PointLight;
  private houseInteriorRoot = new THREE.Group();
  private barnInteriorRoot = new THREE.Group();

  constructor(
    private farmhouseGroup: THREE.Group,
    private farmhouseDoorPivot: THREE.Group,
    private barnGroup: THREE.Group,
    private barnDoorLeftPivot: THREE.Group,
    private barnDoorRightPivot: THREE.Group,
    private textures: FarmTextures,
    private inventory: InventorySystem,
    private particles: ParticleSystem,
    private sound: SoundManager,
    private tasks: TaskSystem,
    private callbacks: {
      onToast: (text: string, tone?: 'default' | 'success' | 'info' | 'celebrate') => void;
      onSleepMorning: () => void;
    }
  ) {
    this.setupDoors();
    this.buildFarmhouseInteriorBase();
    this.buildBarnInteriorBase();
    this.setupInteriorBuildSlots();
  }

  private setupDoors(): void {
    // Farmhouse Front Door interactable
    this.interactables.push({
      id: 'door_farmhouse',
      object: this.farmhouseDoorPivot,
      maxDistance: 4.0,
      getInfo: () => ({
        id: 'door_farmhouse',
        title: 'Farmhouse Front Door',
        subtitle: this.farmhouseOpen
          ? 'Step inside to furnish your cozy home!'
          : 'Open the door to enter & build inside the Farmhouse',
        actionText: this.farmhouseOpen ? 'Close Farmhouse Door' : 'Open Farmhouse Door',
        canAct: true,
        iconId: 'door',
        badge: { text: this.farmhouseOpen ? 'Open' : 'Walk-In Interior', tone: 'good' },
      }),
      interact: () => {
        this.farmhouseOpen = !this.farmhouseOpen;
        this.sound.playPop();
        return true;
      },
    });

    // Red Barn Double Doors interactable (both leaves toggle together!)
    const barnDoorHandler = (id: string, target: THREE.Object3D): InteractableTarget => ({
      id,
      object: target,
      maxDistance: 4.8,
      getInfo: () => ({
        id,
        title: 'Red Barn Double Doors',
        subtitle: this.barnOpen
          ? 'Step inside to build your workshop & trophy hall!'
          : 'Swing open the barn doors to enter & build inside',
        actionText: this.barnOpen ? 'Close Barn Doors' : 'Open Barn Doors',
        canAct: true,
        iconId: 'door',
        badge: { text: this.barnOpen ? 'Open' : 'Walk-In Interior', tone: 'good' },
      }),
      interact: () => {
        this.barnOpen = !this.barnOpen;
        this.sound.playPop();
        return true;
      },
    });
    this.interactables.push(
      barnDoorHandler('door_barn_left', this.barnDoorLeftPivot),
      barnDoorHandler('door_barn_right', this.barnDoorRightPivot)
    );
  }

  private buildFarmhouseInteriorBase(): void {
    const stoneMat = new THREE.MeshStandardMaterial({
      map: this.textures.stoneWall,
      bumpMap: this.textures.stoneBump,
      bumpScale: 0.05,
      roughness: 0.9,
    });
    const woodMat = new THREE.MeshStandardMaterial({ map: this.textures.woodWarm, roughness: 0.85 });

    // Cozy Stone Fireplace Hearth on West back wall (local -X = -3.55, z = 0)
    const hearth = new THREE.Group();
    hearth.position.set(-3.52, 0.14, 0);

    const hearthBase = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.18, 2.2), stoneMat);
    hearthBase.position.y = 0.09;
    hearth.add(hearthBase);
    for (const sz of [-0.75, 0.75]) {
      const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.72, 1.55, 0.52), stoneMat);
      pillar.position.set(-0.04, 0.85, sz);
      hearth.add(pillar);
    }
    const mantel = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.18, 2.15), woodMat);
    mantel.position.set(0.02, 1.66, 0);
    hearth.add(mantel);
    const chimneyBreast = new THREE.Mesh(new THREE.BoxGeometry(0.7, 2.9, 1.45), stoneMat);
    chimneyBreast.position.set(-0.08, 3.1, 0);
    hearth.add(chimneyBreast);
    const fireboxBack = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 1.35, 1.05),
      new THREE.MeshStandardMaterial({ color: '#2b201b', roughness: 0.98 })
    );
    fireboxBack.position.set(-0.28, 0.78, 0);
    hearth.add(fireboxBack);

    const flameCols = ['#ff7c2b', '#ffc447', '#fff2a6'];
    for (let i = 0; i < 3; i++) {
      const fl = new THREE.Mesh(
        new THREE.ConeGeometry(0.18 - i * 0.035, 0.55 - i * 0.1, 6),
        new THREE.MeshBasicMaterial({ color: flameCols[i] })
      );
      fl.position.set(-0.04, 0.42, (i - 1) * 0.16);
      hearth.add(fl);
      this.hearthFlames.push(fl);
    }

    this.hearthLight = new THREE.PointLight('#ffaa55', 2.4, 14, 1.4);
    this.hearthLight.position.set(0.55, 1.25, 0);
    hearth.add(this.hearthLight);
    this.houseInteriorRoot.add(hearth);

    // Warm Farmhouse ceiling lamp
    this.houseCeilingLight = new THREE.PointLight('#ffe0a8', 1.4, 14, 1.4);
    this.houseCeilingLight.position.set(0.5, 3.9, 0);
    this.houseInteriorRoot.add(this.houseCeilingLight);
    this.farmhouseGroup.add(this.houseInteriorRoot);
  }

  private buildBarnInteriorBase(): void {
    const woodMat = new THREE.MeshStandardMaterial({ map: this.textures.woodWarm, roughness: 0.88 });
    // Cozy warm barn hanging ceiling light
    this.barnCeilingLight = new THREE.PointLight('#ffdca0', 1.7, 16, 1.4);
    this.barnCeilingLight.position.set(0, 4.1, 0);
    this.barnInteriorRoot.add(this.barnCeilingLight);

    // Warm glowing lantern globe hanging from central rafter
    const globe = new THREE.Mesh(
      new THREE.SphereGeometry(0.2, 8, 6),
      new THREE.MeshStandardMaterial({ color: '#fff3c4', emissive: '#ffbd55', emissiveIntensity: 0.8 })
    );
    globe.position.set(0, 4.28, 0);
    this.barnInteriorRoot.add(globe);

    // Rustic timber support posts along interior corners
    for (const sx of [-3.95, 3.95]) {
      for (const sz of [-3.05, 0, 3.05]) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.24, 4.5, 0.24), woodMat);
        post.position.set(sx, 2.3, sz);
        this.barnInteriorRoot.add(post);
      }
    }
    this.barnGroup.add(this.barnInteriorRoot);
  }

  private setupInteriorBuildSlots(): void {
    const specs: {
      id: string;
      title: string;
      subtitle: string;
      kind: FurnitureKind;
      cost: number;
      parent: THREE.Group;
      pos: [number, number, number];
      rotY: number;
      padW: number;
      padD: number;
    }[] = [
      // Farmhouse Interior (5 buildable spots!)
      {
        id: 'build_house_bed',
        title: 'Oak Canopy Bed',
        subtitle: 'Cozy quilted bed — sleep to skip to sunny morning!',
        kind: 'bed',
        cost: 15,
        parent: this.farmhouseGroup,
        pos: [-2.1, 0.14, -2.15],
        rotY: Math.PI / 2,
        padW: 1.5,
        padD: 2.1,
      },
      {
        id: 'build_house_table',
        title: 'Farmhouse Dining Table',
        subtitle: 'Hearty oak table with chairs & fresh fruit bowl',
        kind: 'dining_table',
        cost: 12,
        parent: this.farmhouseGroup,
        pos: [1.5, 0.14, 1.85],
        rotY: 0,
        padW: 1.9,
        padD: 1.35,
      },
      {
        id: 'build_house_bookshelf',
        title: 'Storybook Bookshelf',
        subtitle: 'Tall wooden bookcase packed with colorful volumes',
        kind: 'bookshelf',
        cost: 10,
        parent: this.farmhouseGroup,
        pos: [-1.8, 0.14, 2.7],
        rotY: Math.PI,
        padW: 1.6,
        padD: 0.65,
      },
      {
        id: 'build_house_lounge',
        title: 'Hearth Rug & Armchair',
        subtitle: 'Woven rug & plush reading chair by the fireplace',
        kind: 'hearth_lounge',
        cost: 10,
        parent: this.farmhouseGroup,
        pos: [-1.35, 0.14, 0],
        rotY: -Math.PI / 2,
        padW: 1.65,
        padD: 1.85,
      },
      {
        id: 'build_house_kitchen',
        title: 'Farmhouse Kitchen Counter',
        subtitle: 'Warm timber counter with cast-iron kettle & stove',
        kind: 'kitchen_stove',
        cost: 15,
        parent: this.farmhouseGroup,
        pos: [1.75, 0.14, -2.55],
        rotY: 0,
        padW: 2.1,
        padD: 0.8,
      },
      // Red Barn Interior (4 buildable spots!)
      {
        id: 'build_barn_workbench',
        title: 'Craftsman Workbench',
        subtitle: 'Sturdy timber workshop bench with tools & vise',
        kind: 'workbench',
        cost: 15,
        parent: this.barnGroup,
        pos: [-3.1, 0.12, -2.2],
        rotY: Math.PI / 2,
        padW: 2.1,
        padD: 1.0,
      },
      {
        id: 'build_barn_dairy',
        title: 'Artisan Dairy Press',
        subtitle: 'Wooden butter churn & cheese aging shelves',
        kind: 'dairy_press',
        cost: 15,
        parent: this.barnGroup,
        pos: [3.0, 0.12, -2.1],
        rotY: -Math.PI / 2,
        padW: 1.8,
        padD: 1.0,
      },
      {
        id: 'build_barn_trophy',
        title: 'Hunter & Angler Trophy Rack',
        subtitle: 'Timber display wall for woodland antlers & prized fish',
        kind: 'trophy_rack',
        cost: 18,
        parent: this.barnGroup,
        pos: [0, 0.12, -2.9],
        rotY: 0,
        padW: 2.4,
        padD: 0.8,
      },
      {
        id: 'build_barn_loft',
        title: 'Golden Hay & Crate Storage',
        subtitle: 'Neat stacked golden hay bales & lantern crates',
        kind: 'barn_loft',
        cost: 10,
        parent: this.barnGroup,
        pos: [2.8, 0.12, 1.4],
        rotY: -Math.PI / 2,
        padW: 1.8,
        padD: 1.6,
      },
    ];

    for (const s of specs) {
      const anchor = new THREE.Group();
      anchor.position.set(...s.pos);
      anchor.rotation.y = s.rotY;

      // Glowing golden Blueprint Pad shown before construction!
      const blueprintGroup = new THREE.Group();
      const pad = new THREE.Mesh(
        new THREE.BoxGeometry(s.padW, 0.05, s.padD),
        new THREE.MeshStandardMaterial({
          color: '#ffe07d',
          emissive: '#f5b83d',
          emissiveIntensity: 0.45,
          transparent: true,
          opacity: 0.72,
          roughness: 0.4,
        })
      );
      pad.position.y = 0.03;
      blueprintGroup.add(pad);

      // Floating dashed-feel wireframe box preview
      const wire = new THREE.LineSegments(
        new THREE.EdgesGeometry(new THREE.BoxGeometry(s.padW * 0.92, 0.95, s.padD * 0.92)),
        new THREE.LineBasicMaterial({ color: '#fff3ba', transparent: true, opacity: 0.85 })
      );
      wire.position.y = 0.52;
      blueprintGroup.add(wire);
      anchor.add(blueprintGroup);

      const builtGroup = new THREE.Group();
      builtGroup.visible = false;
      const accentMeshes = this.populateFurnitureMesh(builtGroup, s.kind);
      anchor.add(builtGroup);

      const interiorParent = s.parent === this.farmhouseGroup ? this.houseInteriorRoot : this.barnInteriorRoot;
      interiorParent.add(anchor);

      const slot: BuildSlot = {
        id: s.id,
        title: s.title,
        subtitle: s.subtitle,
        kind: s.kind,
        cost: s.cost,
        parent: s.parent,
        anchor,
        blueprintGroup,
        builtGroup,
        accentMeshes,
        built: false,
        styleIndex: 0,
      };
      this.slots.push(slot);

      this.interactables.push({
        id: s.id,
        object: anchor,
        maxDistance: 4.2,
        getInfo: () => {
          if (!slot.built) {
            const effectiveCost = this.builtCount === 0 ? 0 : slot.cost;
            const canAfford = this.inventory.coins >= effectiveCost;
            return {
              id: slot.id,
              title: `Blueprint: ${slot.title}`,
              subtitle: slot.subtitle,
              actionText:
                effectiveCost === 0
                  ? `Build ${slot.title} (FREE First Build!)`
                  : canAfford
                    ? `Build ${slot.title} (${effectiveCost} Coins)`
                    : `Need ${effectiveCost} Coins (Sell crops/fish/game!)`,
              canAct: canAfford,
              iconId: 'hammer',
              badge: {
                text: effectiveCost === 0 ? 'Free Starter Build' : `${effectiveCost} Coins`,
                tone: canAfford ? 'good' : 'warn',
              },
            };
          }
          if (slot.kind === 'bed') {
            return {
              id: slot.id,
              title: slot.title,
              subtitle: 'Rest peacefully until a fresh golden morning',
              actionText: 'Sleep Until Morning (6:30 AM)',
              canAct: true,
              iconId: 'moon',
              badge: { text: 'Cozy Bed', tone: 'happy' },
            };
          }
          const nextStyle = STYLE_PALETTES[(slot.styleIndex + 1) % STYLE_PALETTES.length].name;
          return {
            id: slot.id,
            title: slot.title,
            subtitle: `Style: ${STYLE_PALETTES[slot.styleIndex].name}`,
            actionText: `Restyle to ${nextStyle}`,
            canAct: true,
            iconId: 'sparkle',
            badge: { text: 'Built', tone: 'good' },
          };
        },
        interact: () => this.interactSlot(slot),
      });
    }
  }

  private interactSlot(slot: BuildSlot): boolean {
    const worldPos = new THREE.Vector3();
    slot.anchor.getWorldPosition(worldPos);
    worldPos.y += 0.85;

    if (!slot.built) {
      const effectiveCost = this.builtCount === 0 ? 0 : slot.cost;
      if (effectiveCost > 0 && !this.inventory.spendCoins(effectiveCost)) {
        this.callbacks.onToast(`Need ${effectiveCost} Coins to build ${slot.title}!`, 'info');
        return false;
      }
      slot.built = true;
      this.builtCount++;
      slot.blueprintGroup.visible = false;
      slot.builtGroup.visible = true;
      this.particles.spawnSparkles(worldPos, 18);
      this.sound.playTaskComplete();
      this.tasks.complete('quest_build');
      this.callbacks.onToast(
        effectiveCost === 0
          ? `🔨 Built ${slot.title} (Free First Build)!`
          : `🔨 Built ${slot.title} (-${effectiveCost} Coins)!`,
        'celebrate'
      );
      return true;
    }

    if (slot.kind === 'bed') {
      this.callbacks.onSleepMorning();
      this.particles.spawnSparkles(worldPos, 14);
      this.sound.playTaskComplete();
      this.callbacks.onToast('☀️ Slept soundly until a bright new morning!', 'celebrate');
      return true;
    }

    // Cycle cozy color style!
    slot.styleIndex = (slot.styleIndex + 1) % STYLE_PALETTES.length;
    const pal = STYLE_PALETTES[slot.styleIndex];
    slot.accentMeshes.forEach((m, i) => {
      const mat = m.material as THREE.MeshStandardMaterial;
      mat.color.set(i % 2 === 0 ? pal.accent : pal.cloth);
    });
    this.particles.spawnSparkles(worldPos, 10);
    this.sound.playPop();
    this.callbacks.onToast(`✨ Restyled ${slot.title} to ${pal.name}!`, 'success');
    return true;
  }

  private populateFurnitureMesh(root: THREE.Group, kind: FurnitureKind): THREE.Mesh[] {
    const woodMat = new THREE.MeshStandardMaterial({ map: this.textures.woodWarm, roughness: 0.84 });
    const lightWood = new THREE.MeshStandardMaterial({ map: this.textures.woodLight, roughness: 0.82 });
    const ironMat = new THREE.MeshStandardMaterial({ color: '#474c52', metalness: 0.5, roughness: 0.45 });
    const accentMat = new THREE.MeshStandardMaterial({ color: STYLE_PALETTES[0].accent, roughness: 0.8 });
    const clothMat = new THREE.MeshStandardMaterial({ color: STYLE_PALETTES[0].cloth, roughness: 0.84 });
    const accents: THREE.Mesh[] = [];

    if (kind === 'bed') {
      const frame = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.36, 2.02), woodMat);
      frame.position.y = 0.28;
      root.add(frame);
      for (const sx of [-0.66, 0.66]) {
        for (const sz of [-0.96, 0.96]) {
          const post = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.06, 1.55, 8), woodMat);
          post.position.set(sx, 0.78, sz);
          root.add(post);
        }
      }
      const mattress = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.24, 1.88), new THREE.MeshStandardMaterial({ color: '#fffaf0', roughness: 0.9 }));
      mattress.position.y = 0.52;
      root.add(mattress);
      const quilt = new THREE.Mesh(new THREE.BoxGeometry(1.34, 0.14, 1.25), accentMat.clone());
      quilt.position.set(0, 0.62, 0.28);
      root.add(quilt);
      accents.push(quilt);
      const pillow = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.16, 0.42), clothMat.clone());
      pillow.position.set(0, 0.68, -0.62);
      root.add(pillow);
      accents.push(pillow);
    } else if (kind === 'dining_table') {
      const top = new THREE.Mesh(new THREE.BoxGeometry(1.78, 0.1, 1.15), lightWood);
      top.position.y = 0.78;
      root.add(top);
      for (const sx of [-0.76, 0.76]) {
        for (const sz of [-0.46, 0.46]) {
          const leg = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.78, 0.1), woodMat);
          leg.position.set(sx, 0.39, sz);
          root.add(leg);
        }
      }
      const runner = new THREE.Mesh(new THREE.BoxGeometry(1.65, 0.02, 0.38), accentMat.clone());
      runner.position.y = 0.84;
      root.add(runner);
      accents.push(runner);
      // 2 tucked wooden chairs
      for (const cz of [-0.72, 0.72]) {
        const seat = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.07, 0.44), woodMat);
        seat.position.set(0, 0.46, cz);
        root.add(seat);
        const back = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.52, 0.07), woodMat);
        back.position.set(0, 0.72, cz + (cz > 0 ? 0.2 : -0.2));
        root.add(back);
      }
      const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.12, 0.12, 10), clothMat.clone());
      bowl.position.set(0, 0.9, 0);
      root.add(bowl);
      accents.push(bowl);
    } else if (kind === 'bookshelf') {
      const caseBack = new THREE.Mesh(new THREE.BoxGeometry(1.52, 2.05, 0.46), woodMat);
      caseBack.position.y = 1.02;
      root.add(caseBack);
      const bookCols = ['#e87461', '#69b3a2', '#f2c14e', '#7e90c9', '#d97fa8'];
      for (let row = 0; row < 4; row++) {
        const shelf = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.06, 0.48), lightWood);
        shelf.position.set(0, 0.35 + row * 0.45, 0.04);
        root.add(shelf);
        for (let b = 0; b < 6; b++) {
          const bk = new THREE.Mesh(
            new THREE.BoxGeometry(0.16, 0.28 + (b % 2) * 0.05, 0.28),
            new THREE.MeshStandardMaterial({ color: bookCols[(row + b) % bookCols.length], roughness: 0.7 })
          );
          bk.position.set(-0.52 + b * 0.21, 0.52 + row * 0.45, 0.12);
          root.add(bk);
          if (b === 0) accents.push(bk);
        }
      }
    } else if (kind === 'hearth_lounge') {
      const rug = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.05, 0.03, 20), accentMat.clone());
      rug.scale.set(1.1, 1, 0.85);
      rug.position.y = 0.02;
      root.add(rug);
      accents.push(rug);
      const chairSeat = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.36, 0.82), clothMat.clone());
      chairSeat.position.set(0, 0.32, 0);
      root.add(chairSeat);
      accents.push(chairSeat);
      const chairBack = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.72, 0.2), accentMat.clone());
      chairBack.position.set(0, 0.68, -0.34);
      root.add(chairBack);
      accents.push(chairBack);
    } else if (kind === 'kitchen_stove') {
      const counter = new THREE.Mesh(new THREE.BoxGeometry(1.98, 0.88, 0.74), lightWood);
      counter.position.y = 0.44;
      root.add(counter);
      const stove = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.92, 0.76), ironMat);
      stove.position.set(-0.56, 0.46, 0);
      root.add(stove);
      const kettle = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), accentMat.clone());
      kettle.position.set(-0.56, 1.04, 0);
      root.add(kettle);
      accents.push(kettle);
      const cloth = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.04, 0.55), clothMat.clone());
      cloth.position.set(0.45, 0.9, 0);
      root.add(cloth);
      accents.push(cloth);
    } else if (kind === 'workbench') {
      const benchTop = new THREE.Mesh(new THREE.BoxGeometry(1.98, 0.14, 0.88), lightWood);
      benchTop.position.y = 0.86;
      root.add(benchTop);
      for (const sx of [-0.86, 0.86]) {
        for (const sz of [-0.34, 0.34]) {
          const leg = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.86, 0.12), woodMat);
          leg.position.set(sx, 0.43, sz);
          root.add(leg);
        }
      }
      const toolbox = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.26, 0.32), accentMat.clone());
      toolbox.position.set(-0.52, 1.06, -0.1);
      root.add(toolbox);
      accents.push(toolbox);
      const vise = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.2, 0.26), ironMat);
      vise.position.set(0.75, 0.96, 0.34);
      root.add(vise);
    } else if (kind === 'dairy_press') {
      const stand = new THREE.Mesh(new THREE.BoxGeometry(1.65, 0.85, 0.82), woodMat);
      stand.position.y = 0.42;
      root.add(stand);
      const churn = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.3, 0.72, 12), lightWood);
      churn.position.set(-0.42, 1.18, 0);
      root.add(churn);
      const cheeseWheel = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.18, 14), clothMat.clone());
      cheeseWheel.position.set(0.38, 0.96, 0);
      root.add(cheeseWheel);
      accents.push(cheeseWheel);
    } else if (kind === 'trophy_rack') {
      const plaque = new THREE.Mesh(new THREE.BoxGeometry(2.1, 1.25, 0.16), woodMat);
      plaque.position.set(0, 1.55, -0.15);
      root.add(plaque);
      const shield = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.3, 0.1, 6), accentMat.clone());
      shield.rotation.x = Math.PI / 2;
      shield.position.set(0, 1.62, -0.02);
      root.add(shield);
      accents.push(shield);
      // Sculpted decorative antler trophy mounted on shield!
      const antlerMat = new THREE.MeshStandardMaterial({ color: '#e6d4b5', roughness: 0.75 });
      for (const side of [-1, 1]) {
        const horn = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.055, 0.75, 6), antlerMat);
        horn.position.set(side * 0.34, 1.85, 0.08);
        horn.rotation.z = -side * 0.68;
        root.add(horn);
      }
      const shelf = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.12, 0.48), lightWood);
      shelf.position.set(0, 0.85, 0.06);
      root.add(shelf);
    } else if (kind === 'barn_loft') {
      const hayMat = new THREE.MeshStandardMaterial({ map: this.textures.hayGolden, roughness: 0.94 });
      for (const [hx, hy, hz] of [[-0.45, 0.38, -0.25], [0.45, 0.38, -0.25], [0, 1.08, -0.25]] as [number, number, number][]) {
        const bale = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.68, 0.78), hayMat);
        bale.position.set(hx, hy, hz);
        root.add(bale);
      }
      const crate = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.65, 0.75), accentMat.clone());
      crate.position.set(-0.35, 0.34, 0.48);
      root.add(crate);
      accents.push(crate);
    }

    return accents;
  }

  public update(dt: number, elapsed: number, playerPos: THREE.Vector3): void {
    // Interior Culling: hide & pause interior furniture/lights when player is far from each building!
    const nearHouse = Math.hypot(playerPos.x + 18.5, playerPos.z + 6.5) < 19.0;
    const nearBarn = Math.hypot(playerPos.x - 18.5, playerPos.z + 7.2) < 19.0;

    this.houseInteriorRoot.visible = nearHouse;
    this.barnInteriorRoot.visible = nearBarn;
    if (this.houseCeilingLight) this.houseCeilingLight.intensity = nearHouse ? 1.4 : 0;
    if (this.barnCeilingLight) this.barnCeilingLight.intensity = nearBarn ? 1.7 : 0;

    // Smooth swinging Farmhouse & Red Barn doors!
    const targetHouseAngle = this.farmhouseOpen ? 1.82 : 0;
    this.farmhouseAngle = THREE.MathUtils.lerp(this.farmhouseAngle, targetHouseAngle, Math.min(1, dt * 7));
    this.farmhouseDoorPivot.rotation.y = this.farmhouseAngle;

    const targetBarnAngle = this.barnOpen ? 1.95 : 0;
    this.barnAngle = THREE.MathUtils.lerp(this.barnAngle, targetBarnAngle, Math.min(1, dt * 6));
    this.barnDoorLeftPivot.rotation.y = -this.barnAngle;
    this.barnDoorRightPivot.rotation.y = this.barnAngle;

    // Gentle pulse on unbuilt golden interior blueprint pads (only when nearby!)
    if (nearHouse || nearBarn) {
      for (let i = 0; i < this.slots.length; i++) {
        const s = this.slots[i];
        if (!s.built) {
          s.blueprintGroup.position.y = Math.sin(elapsed * 2.8 + i) * 0.025;
        }
      }
    }

    // Crackling Farmhouse hearth flames (only when near Farmhouse!)
    if (nearHouse) {
      for (let i = 0; i < this.hearthFlames.length; i++) {
        const f = this.hearthFlames[i];
        f.scale.y = 0.85 + Math.sin(elapsed * 15 + i * 2.1) * 0.24;
      }
      if (this.hearthLight) {
        this.hearthLight.intensity = 2.2 + Math.sin(elapsed * 12) * 0.3;
      }
    } else if (this.hearthLight) {
      this.hearthLight.intensity = 0;
    }
  }
}
