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
    const woodMat = new THREE.MeshStandardMaterial({
      map: this.textures.woodWarm,
      bumpMap: this.textures.woodBump,
      bumpScale: 0.03,
      roughness: 0.8,
    });
    const lightWood = new THREE.MeshStandardMaterial({
      map: this.textures.woodLight,
      bumpMap: this.textures.woodBump,
      bumpScale: 0.025,
      roughness: 0.78,
    });
    const ironMat = new THREE.MeshStandardMaterial({ color: '#3b4046', metalness: 0.58, roughness: 0.4 });
    const brassMat = new THREE.MeshStandardMaterial({ color: '#ecc35e', metalness: 0.65, roughness: 0.28 });
    const copperMat = new THREE.MeshStandardMaterial({ color: '#d47c4a', metalness: 0.62, roughness: 0.3 });
    const ceramicMat = new THREE.MeshStandardMaterial({ color: '#fff9ed', roughness: 0.25 });
    const lampGlowMat = new THREE.MeshStandardMaterial({
      color: '#fff4c2',
      emissive: '#ffb845',
      emissiveIntensity: 0.9,
      roughness: 0.2,
    });
    const accentMat = new THREE.MeshStandardMaterial({ color: STYLE_PALETTES[0].accent, roughness: 0.78 });
    const clothMat = new THREE.MeshStandardMaterial({ color: STYLE_PALETTES[0].cloth, roughness: 0.82 });
    const accents: THREE.Mesh[] = [];

    // Lathe-turned wooden table/bed leg profile!
    const lathePts = [
      new THREE.Vector2(0.035, 0),
      new THREE.Vector2(0.055, 0.08),
      new THREE.Vector2(0.038, 0.16),
      new THREE.Vector2(0.058, 0.42),
      new THREE.Vector2(0.042, 0.62),
      new THREE.Vector2(0.055, 0.76),
    ];
    const turnedLegGeo = new THREE.LatheGeometry(lathePts, 10);

    if (kind === 'bed') {
      // Sculpted Oak Four-Poster Canopy Bed + Draped Valance + Bedside Nightstand & Lamp!
      const frame = new THREE.Mesh(new THREE.BoxGeometry(1.44, 0.26, 2.04), woodMat);
      frame.position.y = 0.28;
      root.add(frame);
      for (const sx of [-0.67, 0.67]) {
        for (const sz of [-0.96, 0.96]) {
          const post = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.058, 1.88, 10), woodMat);
          post.position.set(sx, 0.94, sz);
          root.add(post);
          const finial = new THREE.Mesh(new THREE.SphereGeometry(0.072, 10, 8), brassMat);
          finial.position.set(sx, 1.92, sz);
          root.add(finial);
        }
      }
      // Canopy rails & draped fabric valance
      for (const sx of [-0.67, 0.67]) {
        const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.96, 8), woodMat);
        rail.rotation.x = Math.PI / 2;
        rail.position.set(sx, 1.82, 0);
        root.add(rail);
      }
      for (const sz of [-0.96, 0.96]) {
        const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.38, 8), woodMat);
        rail.rotation.z = Math.PI / 2;
        rail.position.set(0, 1.82, sz);
        root.add(rail);
      }
      const canopyTop = new THREE.Mesh(new THREE.BoxGeometry(1.36, 0.05, 1.92), clothMat.clone());
      canopyTop.position.set(0, 1.86, 0);
      root.add(canopyTop);
      accents.push(canopyTop);

      // Arched headboard
      const hb = new THREE.Mesh(new THREE.BoxGeometry(1.34, 0.68, 0.1), lightWood);
      hb.position.set(0, 0.72, -0.96);
      root.add(hb);
      const hbArch = new THREE.Mesh(new THREE.CylinderGeometry(0.66, 0.66, 0.1, 14, 1, false, 0, Math.PI), lightWood);
      hbArch.rotation.z = Math.PI / 2;
      hbArch.rotation.y = Math.PI / 2;
      hbArch.scale.set(1, 1, 0.42);
      hbArch.position.set(0, 1.04, -0.96);
      root.add(hbArch);

      // Plush rounded mattress, folded quilted comforter & dual pillows!
      const mattress = new THREE.Mesh(new THREE.BoxGeometry(1.32, 0.24, 1.88), ceramicMat);
      mattress.position.y = 0.5;
      root.add(mattress);
      const quilt = new THREE.Mesh(new THREE.BoxGeometry(1.38, 0.16, 1.24), accentMat.clone());
      quilt.position.set(0, 0.61, 0.3);
      root.add(quilt);
      accents.push(quilt);
      const fold = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 1.24, 6, 10), clothMat.clone());
      fold.rotation.z = Math.PI / 2;
      fold.position.set(0, 0.68, -0.28);
      root.add(fold);
      accents.push(fold);
      for (const px of [-0.32, 0.32]) {
        const pillow = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.34, 6, 10), ceramicMat);
        pillow.rotation.z = Math.PI / 2;
        pillow.scale.set(1, 0.68, 1.1);
        pillow.position.set(px, 0.68, -0.66);
        root.add(pillow);
      }

      // Bedside Nightstand with warm miniature Oil Lamp!
      const ns = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.56, 0.44), lightWood);
      ns.position.set(1.02, 0.28, -0.72);
      root.add(ns);
      const nsKnob = new THREE.Mesh(new THREE.SphereGeometry(0.03, 7, 6), brassMat);
      nsKnob.position.set(1.02, 0.36, -0.49);
      root.add(nsKnob);
      const lampBase = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 0.12, 10), brassMat);
      lampBase.position.set(1.02, 0.62, -0.72);
      root.add(lampBase);
      const lampGlobe = new THREE.Mesh(new THREE.SphereGeometry(0.085, 10, 8), lampGlowMat);
      lampGlobe.scale.set(1, 1.35, 1);
      lampGlobe.position.set(1.02, 0.76, -0.72);
      root.add(lampGlobe);
    } else if (kind === 'dining_table') {
      // Turned-Leg Farmhouse Dining Table + Tea Service + Spindle-Back Cushioned Chairs!
      const top = new THREE.Mesh(new THREE.BoxGeometry(1.82, 0.09, 1.18), lightWood);
      top.position.y = 0.78;
      root.add(top);
      const apron = new THREE.Mesh(new THREE.BoxGeometry(1.62, 0.12, 0.98), woodMat);
      apron.position.y = 0.7;
      root.add(apron);
      for (const sx of [-0.74, 0.74]) {
        for (const sz of [-0.44, 0.44]) {
          const leg = new THREE.Mesh(turnedLegGeo, woodMat);
          leg.position.set(sx, 0, sz);
          root.add(leg);
        }
      }
      const runner = new THREE.Mesh(new THREE.BoxGeometry(1.84, 0.02, 0.38), accentMat.clone());
      runner.position.y = 0.83;
      root.add(runner);
      accents.push(runner);

      // Ceramic Teapot + 2 Teacups + Fruit Bowl!
      const potBody = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 10), ceramicMat);
      potBody.scale.set(1, 0.85, 1);
      potBody.position.set(-0.35, 0.93, 0);
      root.add(potBody);
      const potLid = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), brassMat);
      potLid.position.set(-0.35, 1.04, 0);
      root.add(potLid);
      const potSpout = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.03, 0.14, 7), ceramicMat);
      potSpout.rotation.z = -0.75;
      potSpout.position.set(-0.22, 0.95, 0);
      root.add(potSpout);
      for (const [cx, cz] of [[0.38, 0.18], [0.42, -0.18]] as [number, number][]) {
        const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.04, 0.08, 10), ceramicMat);
        cup.position.set(cx, 0.88, cz);
        root.add(cup);
      }
      const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.11, 0.11, 14), clothMat.clone());
      bowl.position.set(0.06, 0.89, 0);
      root.add(bowl);
      accents.push(bowl);
      const fruitCols = ['#eb5c4a', '#f5a638', '#78c456'];
      for (let f = 0; f < 3; f++) {
        const fr = new THREE.Mesh(
          new THREE.SphereGeometry(0.065, 8, 6),
          new THREE.MeshStandardMaterial({ color: fruitCols[f], roughness: 0.45 })
        );
        fr.position.set(0.06 + (f - 1) * 0.075, 0.96, (f % 2 - 0.5) * 0.06);
        root.add(fr);
      }

      // 2 Spindle-Back Cushioned Farmhouse Chairs
      for (const cz of [-0.74, 0.74]) {
        const dir = Math.sign(cz);
        const seat = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.06, 0.46), woodMat);
        seat.position.set(0, 0.45, cz);
        root.add(seat);
        const cushion = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.055, 0.4), clothMat.clone());
        cushion.position.set(0, 0.5, cz);
        root.add(cushion);
        accents.push(cushion);
        for (const lx of [-0.19, 0.19]) {
          for (const lz of [-0.18, 0.18]) {
            const cLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.02, 0.45, 7), woodMat);
            cLeg.position.set(lx, 0.225, cz + lz);
            root.add(cLeg);
          }
        }
        const topRail = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.08, 0.055), woodMat);
        topRail.position.set(0, 0.96, cz + dir * 0.21);
        root.add(topRail);
        for (let sp = -0.18; sp <= 0.19; sp += 0.09) {
          const spindle = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.48, 6), lightWood);
          spindle.position.set(sp, 0.71, cz + dir * 0.21);
          root.add(spindle);
        }
      }
    } else if (kind === 'bookshelf') {
      // Crown-Molded Storybook Bookcase with varied tilted volumes, potted plant & brass candle!
      const back = new THREE.Mesh(new THREE.BoxGeometry(1.54, 2.04, 0.06), woodMat);
      back.position.set(0, 1.02, -0.2);
      root.add(back);
      for (const sx of [-0.74, 0.74]) {
        const side = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.04, 0.46), woodMat);
        side.position.set(sx, 1.02, 0);
        root.add(side);
      }
      const cornice = new THREE.Mesh(new THREE.BoxGeometry(1.68, 0.12, 0.54), woodMat);
      cornice.position.set(0, 2.08, 0.02);
      root.add(cornice);

      const bookCols = ['#e06d58', '#5fa896', '#edb945', '#7487c2', '#d4749d', '#7db35d'];
      for (let row = 0; row < 4; row++) {
        const shelf = new THREE.Mesh(new THREE.BoxGeometry(1.44, 0.055, 0.44), lightWood);
        shelf.position.set(0, 0.22 + row * 0.46, 0.01);
        root.add(shelf);
        for (let b = 0; b < 7; b++) {
          const h = 0.26 + ((row * 3 + b) % 3) * 0.045;
          const bk = new THREE.Mesh(
            new THREE.BoxGeometry(0.14, h, 0.28),
            new THREE.MeshStandardMaterial({ color: bookCols[(row * 2 + b) % bookCols.length], roughness: 0.65 })
          );
          const tilt = b === 6 ? 0.22 : 0;
          bk.position.set(-0.54 + b * 0.175, 0.25 + row * 0.46 + h * 0.5, 0.06);
          bk.rotation.z = tilt;
          root.add(bk);
          if (b === 0) accents.push(bk);
        }
      }
      // Potted plant & glowing brass candle on top of bookcase
      const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.09, 0.18, 10), copperMat);
      pot.position.set(-0.46, 2.22, 0);
      root.add(pot);
      const plant = new THREE.Mesh(
        new THREE.DodecahedronGeometry(0.15, 1),
        new THREE.MeshStandardMaterial({ color: '#5fa851', roughness: 0.8 })
      );
      plant.position.set(-0.46, 2.38, 0);
      root.add(plant);
      const candleHolder = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.06, 10), brassMat);
      candleHolder.position.set(0.45, 2.17, 0);
      root.add(candleHolder);
      const candle = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.2, 8), ceramicMat);
      candle.position.set(0.45, 2.29, 0);
      root.add(candle);
      const flame = new THREE.Mesh(new THREE.SphereGeometry(0.032, 6, 6), lampGlowMat);
      flame.scale.set(0.7, 1.4, 0.7);
      flame.position.set(0.45, 2.42, 0);
      root.add(flame);
    } else if (kind === 'hearth_lounge') {
      // Braided Concentric Oval Rug + Plush Winged Armchair with Rolled Armrests + Ottoman!
      const rugOuter = new THREE.Mesh(new THREE.CylinderGeometry(1.12, 1.12, 0.025, 28), accentMat.clone());
      rugOuter.scale.set(1.12, 1, 0.86);
      rugOuter.position.y = 0.015;
      root.add(rugOuter);
      accents.push(rugOuter);
      const rugInner = new THREE.Mesh(new THREE.CylinderGeometry(0.76, 0.76, 0.03, 24), clothMat.clone());
      rugInner.scale.set(1.12, 1, 0.86);
      rugInner.position.y = 0.02;
      root.add(rugInner);
      accents.push(rugInner);

      // Winged Plush Armchair with turned wooden legs & rolled armrests
      for (const lx of [-0.34, 0.34]) {
        for (const lz of [-0.32, 0.32]) {
          const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.022, 0.24, 8), woodMat);
          leg.position.set(lx, 0.12, lz);
          root.add(leg);
        }
      }
      const seatCushion = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.42, 6, 10), clothMat.clone());
      seatCushion.rotation.z = Math.PI / 2;
      seatCushion.scale.set(0.75, 1, 1.45);
      seatCushion.position.set(0, 0.36, 0.02);
      root.add(seatCushion);
      accents.push(seatCushion);

      const backCushion = new THREE.Mesh(new THREE.CapsuleGeometry(0.24, 0.44, 6, 10), accentMat.clone());
      backCushion.rotation.z = Math.PI / 2;
      backCushion.scale.set(1.55, 1, 0.52);
      backCushion.position.set(0, 0.74, -0.32);
      root.add(backCushion);
      accents.push(backCushion);

      for (const side of [-1, 1]) {
        const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.56, 6, 10), accentMat.clone());
        arm.rotation.x = Math.PI / 2;
        arm.position.set(side * 0.44, 0.54, 0.02);
        root.add(arm);
        accents.push(arm);
      }

      // Cozy matching Ottoman Footstool!
      const otto = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.26, 0.2, 14), clothMat.clone());
      otto.position.set(0, 0.24, 0.86);
      root.add(otto);
      accents.push(otto);
      for (let l = 0; l < 4; l++) {
        const a = (l / 4) * Math.PI * 2 + 0.4;
        const oLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.016, 0.16, 6), woodMat);
        oLeg.position.set(Math.cos(a) * 0.18, 0.08, 0.86 + Math.sin(a) * 0.18);
        root.add(oLeg);
      }
    } else if (kind === 'kitchen_stove') {
      // Paneled Farmhouse Kitchen Counter + Cast-Iron Woodstove + Stovepipe + Copper Kettle!
      const counter = new THREE.Mesh(new THREE.BoxGeometry(1.24, 0.88, 0.74), lightWood);
      counter.position.set(0.36, 0.44, 0);
      root.add(counter);
      const counterTop = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.07, 0.8), woodMat);
      counterTop.position.set(0.36, 0.9, 0);
      root.add(counterTop);
      for (const dx of [0.06, 0.66]) {
        const panel = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.62, 0.04), woodMat);
        panel.position.set(dx, 0.42, 0.37);
        root.add(panel);
        const knob = new THREE.Mesh(new THREE.SphereGeometry(0.028, 7, 6), brassMat);
        knob.position.set(dx + 0.16, 0.52, 0.4);
        root.add(knob);
      }
      // Wooden cutting board + veggies
      const board = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.03, 0.32), woodMat);
      board.position.set(0.42, 0.95, 0.05);
      root.add(board);
      const cloth = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.03, 0.48), clothMat.clone());
      cloth.position.set(-0.02, 0.94, 0.04);
      root.add(cloth);
      accents.push(cloth);

      // Cast-iron woodstove with glowing firebox grate + vertical iron stovepipe + sculpted copper kettle!
      const stove = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.86, 0.76), ironMat);
      stove.position.set(-0.62, 0.48, 0);
      root.add(stove);
      const firebox = new THREE.Mesh(
        new THREE.BoxGeometry(0.36, 0.24, 0.05),
        new THREE.MeshStandardMaterial({ color: '#ff8533', emissive: '#ff5e1a', emissiveIntensity: 1.1 })
      );
      firebox.position.set(-0.62, 0.48, 0.37);
      root.add(firebox);
      const stovepipe = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.105, 2.9, 10), ironMat);
      stovepipe.position.set(-0.62, 2.32, -0.22);
      root.add(stovepipe);

      // Copper kettle with spout & arched handle
      const kettle = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 10), copperMat);
      kettle.scale.set(1, 0.82, 1);
      kettle.position.set(-0.56, 1.03, 0.12);
      root.add(kettle);
      const kHandle = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.016, 6, 14, Math.PI), ironMat);
      kHandle.position.set(-0.56, 1.08, 0.12);
      root.add(kHandle);
      const kSpout = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.032, 0.14, 7), copperMat);
      kSpout.rotation.z = -0.82;
      kSpout.position.set(-0.42, 1.06, 0.12);
      root.add(kSpout);
    } else if (kind === 'workbench') {
      // Heavy Craftsman Workbench + Tool Pegboard with 3D Handsaw & Mallet + Bench Vise!
      const benchTop = new THREE.Mesh(new THREE.BoxGeometry(2.02, 0.12, 0.9), lightWood);
      benchTop.position.y = 0.86;
      root.add(benchTop);
      const lowerShelf = new THREE.Mesh(new THREE.BoxGeometry(1.78, 0.07, 0.72), woodMat);
      lowerShelf.position.y = 0.28;
      root.add(lowerShelf);
      for (const sx of [-0.88, 0.88]) {
        for (const sz of [-0.36, 0.36]) {
          const leg = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.86, 0.12), woodMat);
          leg.position.set(sx, 0.43, sz);
          root.add(leg);
        }
      }
      // Pegboard backboard with mounted handsaw & wooden mallet
      const pegboard = new THREE.Mesh(new THREE.BoxGeometry(1.92, 0.92, 0.06), woodMat);
      pegboard.position.set(0, 1.38, -0.42);
      root.add(pegboard);
      const sawBlade = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.13, 0.015), ironMat);
      sawBlade.position.set(-0.32, 1.48, -0.37);
      root.add(sawBlade);
      const sawHandle = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.022, 6, 10), lightWood);
      sawHandle.position.set(-0.62, 1.48, -0.36);
      root.add(sawHandle);
      const malletHead = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.18, 8), lightWood);
      malletHead.rotation.z = Math.PI / 2;
      malletHead.position.set(0.35, 1.56, -0.36);
      root.add(malletHead);
      const malletStick = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.022, 0.32, 7), woodMat);
      malletStick.position.set(0.35, 1.38, -0.36);
      root.add(malletStick);

      const toolbox = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.24, 0.32), accentMat.clone());
      toolbox.position.set(-0.56, 1.04, 0.05);
      root.add(toolbox);
      accents.push(toolbox);
      const vise = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.2, 0.28), ironMat);
      vise.position.set(0.78, 0.94, 0.38);
      root.add(vise);
      const viseBar = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.32, 6), brassMat);
      viseBar.rotation.z = Math.PI / 2;
      viseBar.position.set(0.78, 0.9, 0.56);
      root.add(viseBar);
    } else if (kind === 'dairy_press') {
      // Artisan Butter Churn with iron hoops & plunger + Waxed Cheese Wheels + Milk Bottles!
      const stand = new THREE.Mesh(new THREE.BoxGeometry(1.72, 0.84, 0.84), woodMat);
      stand.position.y = 0.42;
      root.add(stand);
      const standTop = new THREE.Mesh(new THREE.BoxGeometry(1.78, 0.07, 0.9), lightWood);
      standTop.position.y = 0.86;
      root.add(standTop);

      const churn = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.29, 0.72, 14), lightWood);
      churn.position.set(-0.44, 1.24, 0);
      root.add(churn);
      for (const hy of [1.04, 1.44]) {
        const hoop = new THREE.Mesh(new THREE.TorusGeometry(hy > 1.2 ? 0.24 : 0.275, 0.018, 6, 18), ironMat);
        hoop.rotation.x = Math.PI / 2;
        hoop.position.set(-0.44, hy, 0);
        root.add(hoop);
      }
      const plunger = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.52, 8), woodMat);
      plunger.position.set(-0.44, 1.78, 0);
      root.add(plunger);

      // Aged Cheese Wheel with missing cut wedge + Ceramic Milk Jugs
      const cheeseWheel = new THREE.Mesh(
        new THREE.CylinderGeometry(0.28, 0.28, 0.18, 18, 1, false, 0, Math.PI * 1.72),
        clothMat.clone()
      );
      cheeseWheel.position.set(0.22, 0.99, 0.08);
      root.add(cheeseWheel);
      accents.push(cheeseWheel);
      for (const mz of [-0.18, 0.12]) {
        const bottle = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.075, 0.26, 10), ceramicMat);
        bottle.position.set(0.68, 1.03, mz);
        root.add(bottle);
        const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.04, 8), accentMat.clone());
        cap.position.set(0.68, 1.18, mz);
        root.add(cap);
        accents.push(cap);
      }
    } else if (kind === 'trophy_rack') {
      // Carved Hunter & Angler Trophy Wall: Multi-Tine Stag Antlers + Mounted Golden Carp Plaque!
      const plaque = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.45, 0.14), woodMat);
      plaque.position.set(0, 1.62, -0.15);
      root.add(plaque);
      const shield = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.3, 0.1, 8), accentMat.clone());
      shield.rotation.x = Math.PI / 2;
      shield.position.set(-0.48, 1.72, -0.04);
      root.add(shield);
      accents.push(shield);

      // Branching multi-tine antler trophy!
      const antlerMat = new THREE.MeshStandardMaterial({ color: '#ead9bc', roughness: 0.7 });
      for (const side of [-1, 1]) {
        const mainBeam = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.045, 0.68, 7), antlerMat);
        mainBeam.position.set(-0.48 + side * 0.28, 1.92, 0.08);
        mainBeam.rotation.z = -side * 0.72;
        root.add(mainBeam);
        for (const [tx, ty, rot] of [[0.22, 0.14, 0.15], [0.42, 0.24, -0.25]] as [number, number, number][]) {
          const tine = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.024, 0.24, 6), antlerMat);
          tine.position.set(-0.48 + side * tx, 1.88 + ty, 0.1);
          tine.rotation.z = side * rot;
          root.add(tine);
        }
      }

      // Mounted Golden Carp Fishing Trophy on right plaque!
      const fishPlaque = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.08, 16), lightWood);
      fishPlaque.rotation.x = Math.PI / 2;
      fishPlaque.scale.set(1.45, 1, 0.75);
      fishPlaque.position.set(0.52, 1.62, -0.05);
      root.add(fishPlaque);
      const carpMat = new THREE.MeshStandardMaterial({ color: '#f5b84c', roughness: 0.28, metalness: 0.25 });
      const carpBody = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 8), carpMat);
      carpBody.scale.set(2.1, 0.85, 0.45);
      carpBody.position.set(0.5, 1.62, 0.04);
      root.add(carpBody);
      const carpTail = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.22, 6), carpMat);
      carpTail.rotation.z = Math.PI / 2;
      carpTail.position.set(0.84, 1.62, 0.04);
      root.add(carpTail);

      const shelf = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.11, 0.48), lightWood);
      shelf.position.set(0, 0.85, 0.06);
      root.add(shelf);
      const lantern = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.085, 0.24, 6), lampGlowMat);
      lantern.position.set(0.65, 1.03, 0.08);
      root.add(lantern);
    } else if (kind === 'barn_loft') {
      // Twine-Banded Golden Hay Bales + Iron-Bracketed Crate + Barn Oil Lantern!
      const hayMat = new THREE.MeshStandardMaterial({ map: this.textures.hayGolden, roughness: 0.94 });
      const twineMat = new THREE.MeshStandardMaterial({ color: '#9c6832', roughness: 0.9 });
      for (const [hx, hy, hz] of [[-0.46, 0.35, -0.25], [0.46, 0.35, -0.25], [0, 1.02, -0.25]] as [number, number, number][]) {
        const bale = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.66, 0.78), hayMat);
        bale.position.set(hx, hy, hz);
        root.add(bale);
        for (const tx of [-0.24, 0.24]) {
          const band = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.68, 0.8), twineMat);
          band.position.set(hx + tx, hy, hz);
          root.add(band);
        }
      }
      const crate = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.64, 0.74), accentMat.clone());
      crate.position.set(-0.36, 0.33, 0.48);
      root.add(crate);
      accents.push(crate);
      const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.085, 0.24, 6), lampGlowMat);
      lamp.position.set(-0.36, 0.77, 0.48);
      root.add(lamp);
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
