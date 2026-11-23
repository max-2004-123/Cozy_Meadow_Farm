import * as THREE from 'three';
import { getFarmTextures, FarmTextures } from '../assets/textures';
import { modelLibrary, ModelKey } from '../assets/modelLoader';
import { CROPS, ITEMS } from '../config/farmConfig';
import { CropType, InteractableTarget, InteractionInfo, SoilState } from '../types';
import { InventorySystem } from '../game/InventorySystem';
import { ParticleSystem } from '../effects/ParticleSystem';
import { SoundManager } from '../audio/SoundManager';
import { TaskSystem } from '../game/TaskSystem';

interface SoilPlot {
  id: string;
  index: number;
  group: THREE.Group;
  position: THREE.Vector3;
  soilMesh: THREE.Mesh;
  soilMat: THREE.MeshStandardMaterial;
  furrowGroup: THREE.Group;
  furrowMat: THREE.MeshStandardMaterial;
  highlightMesh: THREE.Mesh;
  cropHolder: THREE.Group;
  markerStake: THREE.Group;
  markerBadgeMat: THREE.MeshStandardMaterial;
  state: SoilState;
  moisture: number; // 0..1 (> 0.05 means watered & growing)
  cropType: CropType | null;
  stage: number; // 0..3
  stageTimer: number;
  popAnim: number; // 0..1 bounce when planted or leveling up
  ripeSparkleTimer: number;
}

export class GardenSystem {
  public group = new THREE.Group();
  public interactables: InteractableTarget[] = [];

  private textures: FarmTextures;
  private plots: SoilPlot[] = [];
  private hoveredPlotId: string | null = null;

  private dryTint = new THREE.Color('#ffffff');
  private wetTint = new THREE.Color('#6b4d38');

  private onToast: (text: string, tone?: 'default' | 'success' | 'info' | 'celebrate') => void;
  private onToolSwing: (action: 'hoe' | 'water' | 'plant' | 'harvest') => void;

  constructor(
    scene: THREE.Scene,
    private inventory: InventorySystem,
    private particles: ParticleSystem,
    private sound: SoundManager,
    private tasks: TaskSystem,
    callbacks: {
      onToast: (text: string, tone?: 'default' | 'success' | 'info' | 'celebrate') => void;
      onToolSwing: (action: 'hoe' | 'water' | 'plant' | 'harvest') => void;
    }
  ) {
    this.textures = getFarmTextures();
    this.onToast = callbacks.onToast;
    this.onToolSwing = callbacks.onToolSwing;

    this.buildPlots();
    scene.add(this.group);
  }

  private buildPlots(): void {
    const woodMat = new THREE.MeshStandardMaterial({
      map: this.textures.woodLight,
      bumpMap: this.textures.woodBump,
      bumpScale: 0.03,
      roughness: 0.86,
    });
    const postMat = new THREE.MeshStandardMaterial({
      map: this.textures.woodWarm,
      bumpMap: this.textures.woodBump,
      bumpScale: 0.035,
      roughness: 0.88,
    });
    const coords: [number, number][] = [
      // East bed (closest to entrance path!)
      [-5.6, 9.4], [-7.6, 9.4],
      [-5.6, 7.0], [-7.6, 7.0],
      [-5.6, 4.6], [-7.6, 4.6],
      // West bed
      [-10.5, 9.4], [-12.5, 9.4],
      [-10.5, 7.0], [-12.5, 7.0],
      [-10.5, 4.6], [-12.5, 4.6],
    ];

    coords.forEach(([x, z], idx) => {
      const plotGroup = new THREE.Group();
      plotGroup.position.set(x, 0, z);

      // Cute rustic low wooden raised-bed border planks
      const borderH = 0.14;
      const borderT = 0.1;
      const size = 1.72;
      for (const side of [-1, 1]) {
        const barX = new THREE.Mesh(new THREE.BoxGeometry(size + borderT, borderH, borderT), woodMat);
        barX.position.set(0, borderH * 0.5, side * size * 0.5);
        barX.castShadow = true;
        barX.receiveShadow = true;
        plotGroup.add(barX);

        const barZ = new THREE.Mesh(new THREE.BoxGeometry(borderT, borderH, size - borderT), woodMat);
        barZ.position.set(side * size * 0.5, borderH * 0.5, 0);
        barZ.castShadow = true;
        barZ.receiveShadow = true;
        plotGroup.add(barZ);
      }
      // Chunky notched corner posts with beveled pyramid caps on all 4 corners of every raised bed!
      for (const cx of [-1, 1]) {
        for (const cz of [-1, 1]) {
          const cPost = new THREE.Mesh(new THREE.BoxGeometry(0.145, 0.24, 0.145), postMat);
          cPost.position.set(cx * size * 0.5, 0.12, cz * size * 0.5);
          cPost.castShadow = true;
          plotGroup.add(cPost);
          const cCap = new THREE.Mesh(new THREE.ConeGeometry(0.105, 0.06, 4), postMat);
          cCap.rotation.y = Math.PI / 4;
          cCap.position.set(cx * size * 0.5, 0.268, cz * size * 0.5);
          plotGroup.add(cCap);
        }
      }

      // Cute miniature wooden crop-marker stake (pops up automatically once a seed is planted!)
      const markerStake = new THREE.Group();
      markerStake.position.set(0.66, 0.08, 0.66);
      markerStake.rotation.y = -0.55;
      markerStake.visible = false;
      const mStem = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.42, 0.03), postMat);
      mStem.position.y = 0.21;
      mStem.castShadow = true;
      markerStake.add(mStem);
      const mBoard = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.16, 0.035), woodMat);
      mBoard.position.set(0, 0.41, 0);
      mBoard.rotation.x = -0.22;
      mBoard.castShadow = true;
      markerStake.add(mBoard);
      const markerBadgeMat = new THREE.MeshStandardMaterial({ color: '#f28b42', roughness: 0.55 });
      const mBadge = new THREE.Mesh(new THREE.SphereGeometry(0.052, 8, 6), markerBadgeMat);
      mBadge.scale.set(1.15, 0.9, 0.42);
      mBadge.position.set(0, 0.41, 0.024);
      markerStake.add(mBadge);
      plotGroup.add(markerStake);

      // Soil bed slab
      const soilMat = new THREE.MeshStandardMaterial({
        map: this.textures.soilUntilled,
        bumpMap: this.textures.soilBump,
        bumpScale: 0.04,
        roughness: 0.94,
      });
      const soilMesh = new THREE.Mesh(new THREE.BoxGeometry(size - 0.1, 0.11, size - 0.1), soilMat);
      soilMesh.position.y = 0.06;
      soilMesh.receiveShadow = true;
      plotGroup.add(soilMesh);

      // Sculpted 3D soil furrow ridges (shown once tilled!)
      const furrowMat = new THREE.MeshStandardMaterial({
        map: this.textures.soilDry,
        bumpMap: this.textures.soilBump,
        bumpScale: 0.065,
        roughness: 0.92,
      });
      const furrowGroup = new THREE.Group();
      furrowGroup.visible = false;
      for (let r = -2; r <= 2; r++) {
        const ridge = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.14, size - 0.24, 6), furrowMat);
        ridge.rotation.z = Math.PI / 2;
        ridge.scale.set(1, 1, 0.72);
        ridge.position.set(0, 0.115, r * 0.29);
        ridge.receiveShadow = true;
        furrowGroup.add(ridge);
      }
      plotGroup.add(furrowGroup);

      // Soft golden highlight outline when player aims at this plot
      const highlightMesh = new THREE.Mesh(
        new THREE.RingGeometry(0.95, 1.07, 4),
        new THREE.MeshBasicMaterial({
          color: '#fff2a6',
          transparent: true,
          opacity: 0.85,
          side: THREE.DoubleSide,
          depthWrite: false,
          polygonOffset: true,
          polygonOffsetFactor: -2,
          polygonOffsetUnits: -2,
        })
      );
      highlightMesh.rotation.x = -Math.PI / 2;
      highlightMesh.rotation.z = Math.PI / 4;
      highlightMesh.scale.set(1.24, 1.24, 1);
      highlightMesh.position.y = 0.185;
      highlightMesh.visible = false;
      plotGroup.add(highlightMesh);

      // Invisible generous raycast box so pointing at plot or crop is always effortless
      const hitBox = new THREE.Mesh(
        new THREE.BoxGeometry(1.78, 0.85, 1.78),
        new THREE.MeshBasicMaterial({ visible: false })
      );
      hitBox.position.y = 0.4;
      plotGroup.add(hitBox);

      const cropHolder = new THREE.Group();
      cropHolder.position.y = 0.14;
      plotGroup.add(cropHolder);

      this.group.add(plotGroup);

      const plot: SoilPlot = {
        id: `plot_${idx}`,
        index: idx,
        group: plotGroup,
        position: new THREE.Vector3(x, 0, z),
        soilMesh,
        soilMat,
        furrowGroup,
        furrowMat,
        highlightMesh,
        cropHolder,
        markerStake,
        markerBadgeMat,
        state: 'untilled',
        moisture: 0,
        cropType: null,
        stage: 0,
        stageTimer: 0,
        popAnim: 1,
        ripeSparkleTimer: Math.random() * 2,
      };

      // Pre-prepare a welcoming starter layout!
      if (idx === 0 || idx === 1) {
        // Two tilled plots ready right by the entrance so tutorial planting is effortless
        this.applyPlotTilled(plot, false);
      } else if (idx === 10) {
        // One growing carrot plot in the back bed
        this.applyPlotTilled(plot, false);
        plot.cropType = 'carrot';
        plot.stage = 2;
        plot.moisture = 0.7;
        this.rebuildCropVisual(plot);
        this.syncSoilAppearance(plot);
      } else if (idx === 11) {
        // One ripe radish plot so the garden immediately looks lively & harvestable
        this.applyPlotTilled(plot, false);
        plot.cropType = 'radish';
        plot.stage = 3;
        plot.moisture = 0.35;
        this.rebuildCropVisual(plot);
        this.syncSoilAppearance(plot);
      }

      this.plots.push(plot);

      this.interactables.push({
        id: plot.id,
        object: hitBox,
        maxDistance: 4.4,
        getInfo: () => this.getPlotInfo(plot),
        interact: () => this.interactWithPlot(plot),
      });
    });
  }

  public setHoveredTarget(id: string | null): void {
    this.hoveredPlotId = id;
    for (const p of this.plots) {
      p.highlightMesh.visible = p.id === id;
    }
  }

  private getPlotInfo(plot: SoilPlot): InteractionInfo {
    const heldId = this.inventory.getSelectedItemId();
    const heldItem = ITEMS[heldId];

    // 1. Untilled plot
    if (plot.state === 'untilled') {
      if (heldId === 'hoe') {
        return {
          id: plot.id,
          title: 'Garden Soil Plot',
          subtitle: 'Untilled meadow earth',
          actionText: 'Till Soil',
          canAct: true,
          iconId: 'hoe',
          badge: { text: 'Untilled', tone: 'info' },
        };
      }
      return {
        id: plot.id,
        title: 'Garden Soil Plot',
        subtitle: 'Untilled meadow earth',
        actionText: 'Equip Garden Hoe [1] to till',
        hintText: 'Press 1 or scroll to select the Hoe',
        canAct: false,
        iconId: 'hoe',
        badge: { text: 'Needs Tilling', tone: 'warn' },
      };
    }

    // 2. Tilled & empty plot
    if (!plot.cropType) {
      if (heldItem.category === 'seed') {
        const qty = this.inventory.getCount(heldId);
        if (qty > 0) {
          return {
            id: plot.id,
            title: 'Tilled Soil Plot',
            subtitle: plot.moisture > 0.08 ? 'Moist & ready for seeds' : 'Soft furrowed soil',
            actionText: `Plant ${heldItem.name}`,
            canAct: true,
            iconId: heldId,
            moisture: plot.moisture,
            badge: { text: plot.moisture > 0.08 ? 'Moist' : 'Ready to Plant', tone: 'good' },
          };
        }
        return {
          id: plot.id,
          title: 'Tilled Soil Plot',
          subtitle: `Out of ${heldItem.name}`,
          actionText: 'Restock at the Seed Crate nearby!',
          canAct: false,
          iconId: heldId,
          badge: { text: 'No Seeds', tone: 'warn' },
        };
      }

      if (heldId === 'watering_can') {
        const canWater = this.inventory.hasWater();
        return {
          id: plot.id,
          title: 'Tilled Soil Plot',
          subtitle: 'Empty soil bed',
          actionText: canWater ? 'Water Soil' : 'Watering Can empty — refill at Barrel or Pond',
          hintText: 'Tip: Select Seeds [3-6] to plant a crop here!',
          canAct: canWater,
          iconId: 'watering_can',
          moisture: plot.moisture,
          badge: { text: plot.moisture > 0.08 ? 'Moist' : 'Dry', tone: plot.moisture > 0.08 ? 'good' : 'info' },
        };
      }

      return {
        id: plot.id,
        title: 'Tilled Soil Plot',
        subtitle: 'Ready for planting!',
        actionText: 'Select Seeds [3-6] to plant',
        hintText: '3: Carrot • 4: Radish • 5: Tomato • 6: Pumpkin',
        canAct: false,
        iconId: 'seed_carrot',
        moisture: plot.moisture,
        badge: { text: 'Ready to Plant', tone: 'good' },
      };
    }

    // 3. Planted Crop!
    const def = CROPS[plot.cropType];
    const totalProgress =
      plot.stage >= def.totalStages
        ? 1
        : (plot.stage + Math.min(1, plot.stageTimer / def.stageDuration)) / def.totalStages;
    const stageNames = ['Planted Seed', 'Tiny Sprout', 'Growing Lush', 'Ripe & Ready!'];
    const stageLabel = `${stageNames[plot.stage]} (Stage ${plot.stage}/${def.totalStages})`;

    // Ripe crops can ALWAYS be harvested with any held item!
    if (plot.stage >= def.totalStages) {
      return {
        id: plot.id,
        title: def.name,
        subtitle: 'Plump, sweet, and ready to pick!',
        actionText: `Harvest ${def.name}`,
        canAct: true,
        iconId: def.harvestId,
        progress: 1,
        progressLabel: stageLabel,
        moisture: plot.moisture,
        badge: { text: 'Ready to Harvest!', tone: 'happy' },
      };
    }

    // Growing crop
    const isWet = plot.moisture > 0.06;
    if (heldId === 'watering_can') {
      const hasWater = this.inventory.hasWater();
      return {
        id: plot.id,
        title: def.name,
        subtitle: isWet ? 'Soil is moist — growing nicely!' : 'Soil is dry — water to help it grow!',
        actionText: hasWater
          ? isWet
            ? 'Top Up Water'
            : 'Water Crop'
          : 'Can empty — refill at Water Barrel or Pond!',
        canAct: hasWater,
        iconId: 'watering_can',
        progress: totalProgress,
        progressLabel: stageLabel,
        moisture: plot.moisture,
        badge: isWet
          ? { text: 'Growing • Moist', tone: 'good' }
          : { text: 'Needs Water', tone: 'warn' },
      };
    }

    return {
      id: plot.id,
      title: def.name,
      subtitle: isWet ? 'Growing happily in moist soil!' : 'Needs water to keep growing',
      actionText: isWet ? 'Growing... check back soon!' : 'Equip Watering Can [2] to water',
      hintText: isWet ? `Progress: ${Math.round(totalProgress * 100)}%` : 'Press 2 for Watering Can',
      canAct: false,
      iconId: def.harvestId,
      progress: totalProgress,
      progressLabel: stageLabel,
      moisture: plot.moisture,
      badge: isWet
        ? { text: 'Growing • Moist', tone: 'good' }
        : { text: 'Needs Water', tone: 'warn' },
    };
  }

  private interactWithPlot(plot: SoilPlot): boolean {
    const heldId = this.inventory.getSelectedItemId();
    const heldItem = ITEMS[heldId];

    // Harvest ripe crops regardless of held slot!
    if (plot.cropType && plot.stage >= CROPS[plot.cropType].totalStages) {
      const def = CROPS[plot.cropType];
      this.inventory.addItem(def.harvestId, def.harvestYield);
      let bonusText = '';
      if (Math.random() <= def.bonusSeedChance) {
        this.inventory.addItem(def.seedId, 1);
        bonusText = ' (+1 seed)';
      }

      plot.cropType = null;
      plot.stage = 0;
      plot.stageTimer = 0;
      this.clearCropVisual(plot);

      this.particles.spawnSparkles(plot.position.clone().add(new THREE.Vector3(0, 0.35, 0)), 14);
      this.sound.playHarvest();
      this.onToolSwing('harvest');
      this.tasks.complete('quest_harvest');
      this.onToast(`Harvested ${def.harvestYield}x ${def.name}!${bonusText}`, 'success');
      return true;
    }

    // Till untilled plot with Hoe
    if (plot.state === 'untilled') {
      if (heldId !== 'hoe') {
        this.onToast('Select your Garden Hoe [1] to till the soil first!', 'info');
        return false;
      }
      this.applyPlotTilled(plot, true);
      this.particles.spawnSoilBurst(plot.position, 16);
      this.sound.playTill();
      this.onToolSwing('hoe');
      return true;
    }

    // Plant seed into empty tilled plot
    if (!plot.cropType && heldItem.category === 'seed' && heldItem.cropType) {
      if (!this.inventory.consumeItem(heldId, 1)) {
        this.onToast('Out of those seeds! Grab free seeds at the Supply Crate.', 'info');
        return false;
      }
      plot.cropType = heldItem.cropType;
      plot.stage = 0;
      plot.stageTimer = 0;
      plot.popAnim = 0;
      this.rebuildCropVisual(plot);
      this.particles.spawnFeedCrumbs(plot.position.clone().add(new THREE.Vector3(0, 0.15, 0)), 8);
      this.sound.playPlant();
      this.onToolSwing('plant');
      this.tasks.complete('tut_plant');
      this.onToast(`Planted ${CROPS[heldItem.cropType].name}! Now water it with [2].`, 'default');
      return true;
    }

    // Water tilled plot (empty or planted) with Watering Can
    if (heldId === 'watering_can') {
      if (!this.inventory.useWater()) {
        this.onToast('Watering Can is empty! Refill at the Water Barrel or Pond.', 'info');
        return false;
      }
      plot.moisture = 1.0;
      this.syncSoilAppearance(plot);
      this.particles.spawnWaterSplash(plot.position.clone().add(new THREE.Vector3(0, 0.12, 0)), 22);
      this.sound.playWater();
      this.onToolSwing('water');
      if (plot.cropType) {
        this.tasks.complete('tut_water');
      }
      return true;
    }

    return false;
  }

  private applyPlotTilled(plot: SoilPlot, animate: boolean): void {
    plot.state = 'tilled';
    plot.furrowGroup.visible = true;
    this.syncSoilAppearance(plot);
    if (animate) {
      plot.furrowGroup.scale.set(1, 0.25, 1);
      plot.popAnim = 0;
    }
  }

  private syncSoilAppearance(plot: SoilPlot): void {
    if (plot.state === 'untilled') {
      plot.soilMat.map = this.textures.soilUntilled;
      plot.soilMat.color.set('#ffffff');
      plot.soilMat.roughness = 0.94;
      plot.soilMat.needsUpdate = true;
      return;
    }

    const wet = plot.moisture;
    const useWetMap = wet > 0.22;
    const targetTex = useWetMap ? this.textures.soilWet : this.textures.soilDry;
    if (plot.soilMat.map !== targetTex) {
      plot.soilMat.map = targetTex;
      plot.furrowMat.map = targetTex;
      plot.soilMat.needsUpdate = true;
      plot.furrowMat.needsUpdate = true;
    }

    // Smooth color & specular wetness interpolation for rich visual feedback!
    const darkFactor = Math.min(1, wet * 1.15);
    plot.soilMat.color.copy(this.dryTint).lerp(this.wetTint, useWetMap ? darkFactor * 0.25 : darkFactor * 0.5);
    plot.furrowMat.color.copy(plot.soilMat.color);
    const rough = THREE.MathUtils.lerp(0.94, 0.36, darkFactor);
    plot.soilMat.roughness = rough;
    plot.furrowMat.roughness = rough;
  }

  private clearCropVisual(plot: SoilPlot): void {
    while (plot.cropHolder.children.length > 0) {
      plot.cropHolder.remove(plot.cropHolder.children[0]);
    }
    plot.markerStake.visible = false;
  }

  public refreshLoadedModels(): void {
    for (const plot of this.plots) {
      if (plot.cropType) {
        this.rebuildCropVisual(plot);
      }
    }
  }

  private rebuildCropVisual(plot: SoilPlot): void {
    this.clearCropVisual(plot);
    if (!plot.cropType) return;

    plot.markerStake.visible = true;
    plot.markerBadgeMat.color.set(CROPS[plot.cropType].accentColor);

    const stage = plot.stage;
    const glbStage = Math.min(4, stage + 1) as 1 | 2 | 3 | 4;
    const glbKey = `crop_${plot.cropType}_${glbStage}` as ModelKey;

    // Height curve across the 4 visible stages for Quaternius sculpted 3D crops!
    const heightMap: Record<CropType, [number, number, number, number]> = {
      carrot: [0.16, 0.28, 0.42, 0.56],
      radish: [0.15, 0.26, 0.38, 0.52],
      tomato: [0.18, 0.38, 0.62, 0.86],
      pumpkin: [0.16, 0.3, 0.46, 0.62],
    };
    const targetH = heightMap[plot.cropType][stage] ?? 0.4;
    const offsets: [number, number][] =
      plot.cropType === 'pumpkin' && stage >= 2
        ? [[0, 0]]
        : [
            [-0.4, -0.38],
            [0.38, -0.36],
            [-0.36, 0.38],
            [0.4, 0.36],
          ];

    // Prefer our high-detail CC0 Quaternius GLB crop models when preloaded!
    const probe = modelLibrary.cloneGrounded(glbKey, targetH);
    if (probe) {
      offsets.forEach(([ox, oz], i) => {
        const inst = i === 0 ? probe : modelLibrary.cloneGrounded(glbKey, targetH)!;
        inst.position.set(ox, 0.01, oz);
        inst.rotation.y = (plot.index * 1.3 + i * 1.57) % (Math.PI * 2);
        plot.cropHolder.add(inst);
      });
      return;
    }

    // Graceful procedural fallback while GLBs stream in
    const leafBright = new THREE.MeshStandardMaterial({ color: '#6ec45a', roughness: 0.72 });
    const leafDark = new THREE.MeshStandardMaterial({ color: '#4ea145', roughness: 0.78 });
    const seedMat = new THREE.MeshStandardMaterial({ color: '#e6d09c', roughness: 0.85 });
    const moundMat = new THREE.MeshStandardMaterial({ color: '#6a462c', roughness: 0.94 });

    // Stage 0: Cute freshly planted seed mounds
    if (stage === 0) {
      for (const [ox, oz] of offsets) {
        const mound = new THREE.Mesh(new THREE.SphereGeometry(0.14, 7, 5), moundMat);
        mound.scale.set(1.2, 0.45, 1.2);
        mound.position.set(ox, 0.03, oz);
        plot.cropHolder.add(mound);

        const seed = new THREE.Mesh(new THREE.SphereGeometry(0.055, 6, 5), seedMat);
        seed.scale.set(1.2, 0.75, 0.85);
        seed.position.set(ox, 0.08, oz);
        plot.cropHolder.add(seed);
      }
      return;
    }

    // Stage 1: Adorable twin rounded baby sprouts
    if (stage === 1) {
      for (const [ox, oz] of offsets) {
        const sprout = new THREE.Group();
        sprout.position.set(ox, 0.02, oz);
        sprout.rotation.y = ox * 3 + oz * 2;
        const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.03, 0.22, 6), leafDark);
        stem.position.y = 0.11;
        sprout.add(stem);

        for (const side of [-1, 1]) {
          const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.1, 7, 5), leafBright);
          leaf.scale.set(1.35, 0.45, 0.78);
          leaf.position.set(side * 0.11, 0.22, 0);
          leaf.rotation.z = side * 0.38;
          sprout.add(leaf);
        }
        plot.cropHolder.add(sprout);
      }
      return;
    }

    // Stage 2 (Growing) & Stage 3 (Ripe & Plump!)
    if (plot.cropType === 'carrot') {
      const carrotMat = new THREE.MeshStandardMaterial({ color: '#f58838', roughness: 0.6 });
      for (const [ox, oz] of offsets) {
        const plant = new THREE.Group();
        plant.position.set(ox, 0.02, oz);

        // Feathery leafy crown
        const frondCount = stage === 3 ? 6 : 4;
        const frondH = stage === 3 ? 0.44 : 0.32;
        for (let f = 0; f < frondCount; f++) {
          const a = (f / frondCount) * Math.PI * 2;
          const frond = new THREE.Mesh(new THREE.ConeGeometry(0.075, frondH, 5), f % 2 === 0 ? leafBright : leafDark);
          frond.position.set(Math.cos(a) * 0.08, frondH * 0.55 + (stage === 3 ? 0.1 : 0), Math.sin(a) * 0.08);
          frond.rotation.z = -Math.cos(a) * 0.42;
          frond.rotation.x = Math.sin(a) * 0.42;
          frond.castShadow = true;
          plant.add(frond);
        }

        if (stage === 3) {
          // Plump orange carrot shoulder peeking cleanly above the dirt!
          const root = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.34, 8), carrotMat);
          root.rotation.x = Math.PI;
          root.position.y = 0.08;
          root.castShadow = true;
          plant.add(root);
          const cap = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), carrotMat);
          cap.scale.set(1, 0.55, 1);
          cap.position.y = 0.22;
          plant.add(cap);
        }
        plot.cropHolder.add(plant);
      }
    } else if (plot.cropType === 'radish') {
      const bulbMat = new THREE.MeshStandardMaterial({ color: '#ea658c', roughness: 0.55 });
      for (const [ox, oz] of offsets) {
        const plant = new THREE.Group();
        plant.position.set(ox, 0.02, oz);

        // Broad leafy rosette
        const leaves = stage === 3 ? 5 : 4;
        for (let l = 0; l < leaves; l++) {
          const a = (l / leaves) * Math.PI * 2;
          const leaf = new THREE.Mesh(new THREE.SphereGeometry(stage === 3 ? 0.14 : 0.11, 7, 5), leafBright);
          leaf.scale.set(1.3, 0.32, 0.85);
          leaf.position.set(Math.cos(a) * 0.16, stage === 3 ? 0.28 : 0.18, Math.sin(a) * 0.16);
          leaf.rotation.y = -a;
          leaf.rotation.z = 0.38;
          leaf.castShadow = true;
          plant.add(leaf);
        }

        if (stage === 3) {
          const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.18, 9, 8), bulbMat);
          bulb.scale.set(1.05, 0.92, 1.05);
          bulb.position.y = 0.14;
          bulb.castShadow = true;
          plant.add(bulb);
        }
        plot.cropHolder.add(plant);
      }
    } else if (plot.cropType === 'tomato') {
      const stakeMat = new THREE.MeshStandardMaterial({ color: '#b88252', roughness: 0.9 });
      const tomatoMat = new THREE.MeshStandardMaterial({ color: '#f05545', roughness: 0.35 });
      const greenBudMat = new THREE.MeshStandardMaterial({ color: '#a5db6b', roughness: 0.55 });
      for (const [ox, oz] of offsets) {
        const plant = new THREE.Group();
        plant.position.set(ox, 0.02, oz);

        const stake = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.03, stage === 3 ? 0.86 : 0.62, 5), stakeMat);
        stake.position.y = stage === 3 ? 0.43 : 0.31;
        stake.castShadow = true;
        plant.add(stake);

        const puffCount = stage === 3 ? 4 : 3;
        for (let p = 0; p < puffCount; p++) {
          const bush = new THREE.Mesh(new THREE.IcosahedronGeometry(stage === 3 ? 0.2 : 0.15, 1), p % 2 ? leafDark : leafBright);
          bush.position.set((p % 2 - 0.5) * 0.12, 0.24 + p * 0.15, ((p + 1) % 2 - 0.5) * 0.12);
          bush.castShadow = true;
          plant.add(bush);
        }

        // Cute hanging tomatoes (green in stage 2, bright glossy red in stage 3!)
        const fruitMat = stage === 3 ? tomatoMat : greenBudMat;
        const fruitR = stage === 3 ? 0.095 : 0.06;
        for (let f = 0; f < 4; f++) {
          const a = f * 1.55 + ox;
          const fruit = new THREE.Mesh(new THREE.SphereGeometry(fruitR, 8, 7), fruitMat);
          fruit.position.set(Math.cos(a) * 0.2, 0.28 + f * 0.12, Math.sin(a) * 0.2);
          fruit.castShadow = true;
          plant.add(fruit);
        }
        plot.cropHolder.add(plant);
      }
    } else if (plot.cropType === 'pumpkin') {
      const pumpkinMat = new THREE.MeshStandardMaterial({ color: '#f09330', roughness: 0.58 });
      const unripeMat = new THREE.MeshStandardMaterial({ color: '#8ac25b', roughness: 0.7 });
      const vineGroup = new THREE.Group();

      // Broad trailing pumpkin leaves
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.24, 7, 5), i % 2 === 0 ? leafBright : leafDark);
        leaf.scale.set(1.25, 0.25, 1.0);
        leaf.position.set(Math.cos(a) * 0.48, 0.09, Math.sin(a) * 0.48);
        leaf.rotation.y = -a;
        leaf.castShadow = true;
        vineGroup.add(leaf);
      }

      // Ribbed plump storybook pumpkin in the center!
      const pRadius = stage === 3 ? 0.36 : 0.2;
      const mat = stage === 3 ? pumpkinMat : unripeMat;
      for (let r = 0; r < 6; r++) {
        const a = (r / 6) * Math.PI * 2;
        const rib = new THREE.Mesh(new THREE.SphereGeometry(pRadius * 0.72, 8, 7), mat);
        rib.scale.set(0.85, 0.82, 0.85);
        rib.position.set(Math.cos(a) * pRadius * 0.35, pRadius * 0.76, Math.sin(a) * pRadius * 0.35);
        rib.castShadow = true;
        vineGroup.add(rib);
      }
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.06, 0.22, 6), leafDark);
      stem.position.set(0.03, pRadius * 1.48, 0);
      stem.rotation.z = -0.25;
      vineGroup.add(stem);

      plot.cropHolder.add(vineGroup);
    }
  }

  public update(dt: number, elapsed: number): void {
    for (const plot of this.plots) {
      // Elastic pop-in scale animation on plant/grow/till
      if (plot.popAnim < 1) {
        plot.popAnim = Math.min(1, plot.popAnim + dt * 2.8);
        const overshoot = 1 + Math.sin(plot.popAnim * Math.PI) * 0.22;
        const s = THREE.MathUtils.lerp(0.25, 1.0, plot.popAnim) * overshoot;
        plot.cropHolder.scale.setScalar(s);
        plot.furrowGroup.scale.set(1, Math.min(1, 0.25 + plot.popAnim * 0.75), 1);
      } else {
        plot.cropHolder.scale.setScalar(1);
        plot.furrowGroup.scale.set(1, 1, 1);
      }

      // Gentle breeze sway on growing plants
      if (plot.cropType && plot.stage >= 1) {
        plot.cropHolder.rotation.z = Math.sin(elapsed * 2.0 + plot.index * 0.9) * 0.04;
      }

      // Moisture drying & crop growth simulation
      if (plot.moisture > 0) {
        // Slowly evaporates (~26 seconds from full wet to dry)
        plot.moisture = Math.max(0, plot.moisture - dt * 0.038);
        this.syncSoilAppearance(plot);
      }

      if (plot.cropType) {
        const def = CROPS[plot.cropType];
        if (plot.stage < def.totalStages) {
          // Crops grow fast when soil is moist, very slowly when dry so watering visibly matters!
          const growthRate = plot.moisture > 0.06 ? 1.0 : 0.0;
          plot.stageTimer += dt * growthRate;
          if (plot.stageTimer >= def.stageDuration) {
            plot.stageTimer = 0;
            plot.stage += 1;
            plot.popAnim = 0;
            this.rebuildCropVisual(plot);
            this.particles.spawnSparkles(plot.position.clone().add(new THREE.Vector3(0, 0.4, 0)), 8);
            if (plot.stage >= def.totalStages) {
              this.sound.playCropRipe();
            }
          }
        } else {
          // Subtle golden sparkle reminder above ripe crops
          plot.ripeSparkleTimer -= dt;
          if (plot.ripeSparkleTimer <= 0) {
            plot.ripeSparkleTimer = 2.2 + Math.random() * 1.5;
            this.particles.spawnSparkles(plot.position.clone().add(new THREE.Vector3(0, 0.45, 0)), 2);
          }
        }
      }
    }
  }
}
