import * as THREE from 'three';
import './styles/main.css';
import { WORLD_CONFIG } from './config/farmConfig';
import { InteractableTarget } from './types';
import { CollisionSystem } from './world/CollisionSystem';
import { SkyAndLighting } from './world/SkyAndLighting';
import { FarmWorld } from './world/FarmWorld';
import { WorldEnhancer } from './world/WorldEnhancer';
import { ParticleSystem } from './effects/ParticleSystem';
import { PostEffects } from './effects/PostEffects';
import { modelLibrary } from './assets/modelLoader';
import { GardenSystem } from './farming/GardenSystem';
import { AnimalSystem } from './animals/AnimalSystem';
import { PlayerController } from './player/PlayerController';
import { Viewmodel } from './player/Viewmodel';
import { InventorySystem } from './game/InventorySystem';
import { TaskSystem } from './game/TaskSystem';
import { SoundManager } from './audio/SoundManager';
import { UIManager } from './ui/UIManager';

class CozyFarmGame {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;

  private collisions = new CollisionSystem();
  private inventory = new InventorySystem();
  private tasks = new TaskSystem();
  private sound = new SoundManager();

  private sky: SkyAndLighting;
  private particles: ParticleSystem;
  private postEffects: PostEffects;
  private world: FarmWorld;
  private worldEnhancer: WorldEnhancer;
  private garden: GardenSystem;
  private animals: AnimalSystem;
  private viewmodel: Viewmodel;
  private player: PlayerController;
  private ui: UIManager;

  private worldInteractables: InteractableTarget[] = [];
  private clock = new THREE.Clock();
  private elapsed = 0;

  constructor() {
    const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.96;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(64, window.innerWidth / window.innerHeight, 0.18, 260);
    this.scene.add(this.camera);

    // Core world & dreamy post-processing lighting systems
    this.sky = new SkyAndLighting(this.scene, this.renderer);
    this.particles = new ParticleSystem(this.scene);
    this.postEffects = new PostEffects(this.renderer, this.scene, this.camera);
    this.world = new FarmWorld(this.scene, this.collisions, this.sky, this.particles);
    this.worldEnhancer = new WorldEnhancer(this.scene, this.collisions);

    this.viewmodel = new Viewmodel(this.camera);

    // UI setup
    this.ui = new UIManager(this.inventory, this.tasks, {
      onPlayClick: () => {
        this.sound.init();
        this.player.requestLock();
      },
      onToggleSpeed: () => {
        this.sky.timeSpeedMultiplier = this.sky.timeSpeedMultiplier === 1 ? 5 : 1;
        this.ui.showToast(
          this.sky.timeSpeedMultiplier === 1 ? 'Time speed: Normal (1×)' : 'Time speed: Brisk Breeze (5×)',
          'info'
        );
      },
      onToggleMute: () => {
        this.sound.init();
        this.sound.setMuted(!this.sound.muted);
        this.ui.updateAudioButtons(this.sound.muted, this.sound.musicEnabled);
      },
      onToggleMusic: () => {
        this.sound.init();
        this.sound.setMusicEnabled(!this.sound.musicEnabled);
        this.ui.updateAudioButtons(this.sound.muted, this.sound.musicEnabled);
      },
      onToggleVfx: () => {
        this.postEffects.enabled = !this.postEffects.enabled;
        this.ui.updateVfxButton(this.postEffects.enabled);
      },
      onSensitivityChange: (value) => {
        this.player.setSensitivity(value);
      },
      onTimePreset: (preset) => {
        this.sky.setTimePreset(preset);
        this.ui.showToast(`Time set to ${preset.charAt(0).toUpperCase() + preset.slice(1)}!`, 'info');
      },
      onSelectHotbar: (idx) => {
        this.inventory.selectSlot(idx);
      },
      onEquipFromBag: (id) => {
        this.inventory.equipItem(id);
      },
      onInventoryOpenChange: (open) => {
        if (open) {
          this.player.releaseLock();
        }
      },
    });

    // Gameplay systems
    this.garden = new GardenSystem(this.scene, this.inventory, this.particles, this.sound, this.tasks, {
      onToast: (t, tone) => this.ui.showToast(t, tone),
      onToolSwing: (action) => this.viewmodel.triggerAction(action),
    });

    this.animals = new AnimalSystem(this.scene, this.inventory, this.particles, this.sound, this.tasks, {
      onToast: (t, tone) => this.ui.showToast(t, tone),
      onToolSwing: (action) => this.viewmodel.triggerAction(action),
    });

    this.setupWorldInteractables();

    // First-person player controller
    this.player = new PlayerController(this.camera, canvas, this.collisions, this.sound, {
      onLockChange: (locked) => {
        if (!locked && !this.ui.isInventoryOpen) {
          this.ui.setMenuVisible(true);
        } else if (locked) {
          this.ui.setMenuVisible(false);
        }
      },
      onInteract: () => {
        if (this.player.currentTarget) {
          this.player.currentTarget.interact();
        }
      },
    });
    this.ui.syncSensitivity(this.player.sensitivityMultiplier);

    // Sync HUD & Viewmodel on inventory/task updates
    this.inventory.onChange(() => {
      this.ui.renderHotbar();
      this.viewmodel.setItem(this.inventory.getSelectedItemId());
    });

    this.tasks.onChange((completedTask, tutorialJustFinished) => {
      this.ui.renderTasks();
      this.sound.playTaskComplete();
      if (tutorialJustFinished) {
        this.ui.showToast('🎉 Tutorial Complete! Welcome to Sunnybrook Farm!', 'celebrate');
      } else if (completedTask) {
        this.ui.showToast(`✓ Completed: ${completedTask.title}`, 'success');
      }
    });

    this.bindGlobalShortcuts();
    window.addEventListener('resize', () => this.onResize());

    // Expose tiny helper for debugging/inspection if needed
    (window as unknown as { __farmGame?: CozyFarmGame }).__farmGame = this;

    // Preload all local CC0 Quaternius & Kenney GLB models asynchronously, then upgrade scene cleanly!
    void modelLibrary.preloadAll().then(() => {
      this.worldEnhancer.mountLoadedModels(this.world.treeSpots, this.world.placeholderTreesGroup, {
        waterBarrel: this.world.waterBarrelMesh,
        supplyCrate: this.world.supplyCrateMesh,
        marketStand: this.world.marketStandMesh,
      });
      this.garden.refreshLoadedModels();
      this.animals.refreshLoadedModels();
      this.viewmodel.refreshLoadedModels();
    });

    this.animate();
  }

  private setupWorldInteractables(): void {
    // 1. Garden Watering Barrel (Refill Watering Can)
    this.worldInteractables.push({
      id: 'water_barrel',
      object: this.world.waterBarrelMesh,
      maxDistance: 4.2,
      getInfo: () => {
        const full = this.inventory.waterLevel >= 100;
        return {
          id: 'water_barrel',
          title: 'Rainwater Barrel',
          subtitle: 'Cool clear garden water',
          actionText: full ? 'Watering Can is already full!' : 'Refill Watering Can to 100%',
          canAct: !full,
          iconId: 'water',
          badge: { text: full ? 'Full' : 'Refill Station', tone: full ? 'good' : 'info' },
        };
      },
      interact: () => {
        if (this.inventory.refillWater()) {
          this.particles.spawnWaterSplash(
            new THREE.Vector3(WORLD_CONFIG.waterBarrelPos.x, 1.05, WORLD_CONFIG.waterBarrelPos.z),
            16
          );
          this.sound.playWater();
          this.viewmodel.triggerAction('water');
          this.ui.showToast('Refilled Watering Can to 100%!', 'success');
          return true;
        }
        this.ui.showToast('Your Watering Can is already brimming full!', 'info');
        return false;
      },
    });

    // 2. Duck Pond Dock (Refill Watering Can at the Pond!)
    this.worldInteractables.push({
      id: 'pond_refill',
      object: this.world.pondRefillMesh,
      maxDistance: 4.5,
      getInfo: () => {
        const full = this.inventory.waterLevel >= 100;
        return {
          id: 'pond_refill',
          title: 'Sparkling Duck Pond',
          subtitle: 'Clear spring water by the wooden dock',
          actionText: full ? 'Watering Can is already full!' : 'Dip & Refill Watering Can',
          canAct: !full,
          iconId: 'water',
          badge: { text: 'Fresh Pond Water', tone: 'info' },
        };
      },
      interact: () => {
        if (this.inventory.refillWater()) {
          this.particles.spawnWaterSplash(
            new THREE.Vector3(WORLD_CONFIG.pondCenter.x, 0.25, WORLD_CONFIG.pondCenter.z + 3.8),
            20
          );
          this.sound.playWater();
          this.viewmodel.triggerAction('water');
          this.ui.showToast('Refilled Watering Can from the Duck Pond!', 'success');
          return true;
        }
        this.ui.showToast('Your Watering Can is already full!', 'info');
        return false;
      },
    });

    // 3. Seed & Feed Supply Crate (Never run out of seeds or animal feed!)
    this.worldInteractables.push({
      id: 'supply_crate',
      object: this.world.supplyCrateMesh,
      maxDistance: 4.2,
      getInfo: () => ({
        id: 'supply_crate',
        title: 'Farm Supply Crate',
        subtitle: 'Fresh seed pouches & golden animal feed',
        actionText: 'Restock Seeds & Animal Feed',
        canAct: true,
        iconId: 'crate',
        badge: { text: 'Free Supplies', tone: 'good' },
      }),
      interact: () => {
        const res = this.inventory.restockSupplies();
        if (res.addedAnything) {
          this.particles.spawnSparkles(
            new THREE.Vector3(WORLD_CONFIG.supplyCratePos.x, 0.9, WORLD_CONFIG.supplyCratePos.z),
            12
          );
          this.sound.playCollectProduct();
          this.viewmodel.triggerAction('harvest');
          this.ui.showToast(res.summary, 'success');
        } else {
          this.ui.showToast(res.summary, 'info');
        }
        return true;
      },
    });

    // 4. Cozy Market Farm Stand (Sell harvested crops & animal products!)
    this.worldInteractables.push({
      id: 'market_stand',
      object: this.world.marketStandMesh,
      maxDistance: 4.4,
      getInfo: () => {
        const val = this.inventory.getTotalSellableValue();
        return {
          id: 'market_stand',
          title: 'Sunnybrook Market Stand',
          subtitle:
            val.totalItems > 0
              ? `Ready to ship ${val.totalItems} fresh goods for ${val.totalCoins} coins!`
              : 'Harvest vegetables or collect eggs & milk to sell here!',
          actionText:
            val.totalItems > 0
              ? `Sell All Harvest (+${val.totalCoins} Coins)`
              : 'No harvested goods yet',
          canAct: val.totalItems > 0,
          iconId: 'basket',
          badge: {
            text: val.totalItems > 0 ? `${val.totalItems} Goods Ready` : 'Farm Stand',
            tone: val.totalItems > 0 ? 'happy' : 'info',
          },
        };
      },
      interact: () => {
        const sold = this.inventory.sellAllGoods();
        if (sold.itemsSold > 0) {
          this.particles.spawnSparkles(
            new THREE.Vector3(WORLD_CONFIG.marketStandPos.x, 1.3, WORLD_CONFIG.marketStandPos.z),
            16
          );
          this.sound.playTaskComplete();
          this.viewmodel.triggerAction('harvest');
          this.ui.showToast(`Sold ${sold.itemsSold} farm goods for +${sold.earned} Coins!`, 'celebrate');
          return true;
        }
        this.ui.showToast('Harvest crops or collect animal gifts first to sell!', 'info');
        return false;
      },
    });
  }

  private bindGlobalShortcuts(): void {
    window.addEventListener('keydown', (e) => {
      if (e.code >= 'Digit1' && e.code <= 'Digit9') {
        const idx = parseInt(e.code.replace('Digit', ''), 10) - 1;
        this.inventory.selectSlot(idx);
      } else if (e.code === 'KeyI' || e.code === 'Tab') {
        e.preventDefault();
        if (!this.ui.isMenuVisible) {
          this.ui.toggleInventory();
        }
      } else if (e.code === 'KeyM') {
        this.sound.init();
        this.sound.setMuted(!this.sound.muted);
        this.ui.updateAudioButtons(this.sound.muted, this.sound.musicEnabled);
      } else if (e.code === 'KeyT') {
        this.sky.timeSpeedMultiplier = this.sky.timeSpeedMultiplier === 1 ? 5 : 1;
        this.ui.showToast(
          this.sky.timeSpeedMultiplier === 1 ? 'Time speed: Normal (1×)' : 'Time speed: Brisk Breeze (5×)',
          'info'
        );
      } else if (e.code === 'Escape' || e.code === 'KeyP') {
        if (this.ui.isInventoryOpen) {
          this.ui.setInventoryOpen(false);
        } else if (!this.player.isLocked) {
          this.ui.setMenuVisible(!this.ui.isMenuVisible);
        }
      }
    });

    window.addEventListener(
      'wheel',
      (e) => {
        if (this.ui.isMenuVisible || this.ui.isInventoryOpen) return;
        this.inventory.stepSlot(e.deltaY > 0 ? 1 : -1);
      },
      { passive: true }
    );
  }

  private onResize(): void {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.postEffects.setSize(window.innerWidth, window.innerHeight);
  }

  private animate = (): void => {
    requestAnimationFrame(this.animate);
    const dt = Math.min(0.05, this.clock.getDelta());
    this.elapsed += dt;

    this.sky.update(dt, this.elapsed);
    this.world.update(dt, this.elapsed, this.sky.nightFactor);
    this.worldEnhancer.update(this.elapsed);
    this.garden.update(dt, this.elapsed);
    this.animals.update(dt, this.elapsed, this.player.position);
    this.particles.update(dt, this.elapsed, this.sky.nightFactor);

    const allInteractables: InteractableTarget[] = [
      ...this.garden.interactables,
      ...this.animals.interactables,
      ...this.worldInteractables,
    ];

    const allowMove = !this.ui.isMenuVisible && !this.ui.isInventoryOpen;
    this.player.update(dt, this.elapsed, allowMove, allInteractables, this.animals.getDynamicColliders());
    this.viewmodel.update(dt, this.elapsed, this.player.moveSpeedFactor);

    // Highlight hovered garden plot & show center interaction card
    const target = this.player.currentTarget;
    this.garden.setHoveredTarget(target && target.id.startsWith('plot_') ? target.id : null);
    this.ui.updateInteraction(target ? target.getInfo() : null);

    // Update time HUD & spatial soundscape
    this.ui.updateTime(this.sky.getTimeInfo(), this.sky.timeSpeedMultiplier);
    const distToPond = Math.hypot(
      this.player.position.x - WORLD_CONFIG.pondCenter.x,
      this.player.position.z - WORLD_CONFIG.pondCenter.z
    );
    this.sound.update(dt, this.elapsed, this.sky.nightFactor, distToPond);

    // Dreamy Bloom + Sun Lens Glow + Cozy Color Grading post-processing render!
    this.postEffects.update(
      this.sky.sunWorldPos,
      this.sky.currentSunColor,
      this.sky.nightFactor,
      this.sky.sunsetFactor
    );
    this.postEffects.render();
  };
}

new CozyFarmGame();
