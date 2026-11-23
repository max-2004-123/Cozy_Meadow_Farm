import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';

export type ModelKey =
  | 'crop_carrot_1' | 'crop_carrot_2' | 'crop_carrot_3' | 'crop_carrot_4'
  | 'crop_radish_1' | 'crop_radish_2' | 'crop_radish_3' | 'crop_radish_4'
  | 'crop_tomato_1' | 'crop_tomato_2' | 'crop_tomato_3' | 'crop_tomato_4'
  | 'crop_pumpkin_1' | 'crop_pumpkin_2' | 'crop_pumpkin_3' | 'crop_pumpkin_4'
  | 'tree_common_1' | 'tree_common_2' | 'tree_common_3' | 'tree_birch_1' | 'tree_willow_1'
  | 'flowers_quaternius' | 'lilypad' | 'bush_berries' | 'rock_moss_1' | 'rock_moss_2'
  | 'stump_moss' | 'log_moss'
  | 'flower_purple' | 'flower_red' | 'flower_yellow' | 'mushroom_red'
  | 'well' | 'cart' | 'market_stand' | 'barrel' | 'crate' | 'bench' | 'bag_open'
  | 'boat' | 'fishing_rod' | 'log_stack' | 'hay_stack' | 'gazebo' | 'fence_seg'
  | 'food_carrot' | 'food_radish' | 'food_tomato' | 'food_pumpkin' | 'food_egg'
  | 'animal_cow' | 'animal_chicken' | 'animal_pig';

const MODEL_PATHS: Record<ModelKey, string> = {
  crop_carrot_1: './models/crops/Carrot_1.glb',
  crop_carrot_2: './models/crops/Carrot_2.glb',
  crop_carrot_3: './models/crops/Carrot_3.glb',
  crop_carrot_4: './models/crops/Carrot_4.glb',
  crop_radish_1: './models/crops/Beet_1.glb',
  crop_radish_2: './models/crops/Beet_2.glb',
  crop_radish_3: './models/crops/Beet_3.glb',
  crop_radish_4: './models/crops/Beet_4.glb',
  crop_tomato_1: './models/crops/Tomato_1.glb',
  crop_tomato_2: './models/crops/Tomato_2.glb',
  crop_tomato_3: './models/crops/Tomato_3.glb',
  crop_tomato_4: './models/crops/Tomato_4.glb',
  crop_pumpkin_1: './models/crops/Pumpkin_1.glb',
  crop_pumpkin_2: './models/crops/Pumpkin_2.glb',
  crop_pumpkin_3: './models/crops/Pumpkin_3.glb',
  crop_pumpkin_4: './models/crops/Pumpkin_4.glb',

  tree_common_1: './models/nature/CommonTree_1.glb',
  tree_common_2: './models/nature/CommonTree_2.glb',
  tree_common_3: './models/nature/CommonTree_3.glb',
  tree_birch_1: './models/nature/BirchTree_1.glb',
  tree_willow_1: './models/nature/Willow_1.glb',
  flowers_quaternius: './models/nature/Flowers.glb',
  lilypad: './models/nature/Lilypad.glb',
  bush_berries: './models/nature/BushBerries_1.glb',
  rock_moss_1: './models/nature/Rock_Moss_1.glb',
  rock_moss_2: './models/nature/Rock_Moss_2.glb',
  stump_moss: './models/nature/TreeStump_Moss.glb',
  log_moss: './models/nature/WoodLog_Moss.glb',
  flower_purple: './models/nature/flower_purple.glb',
  flower_red: './models/nature/flower_red.glb',
  flower_yellow: './models/nature/flower_yellow.glb',
  mushroom_red: './models/nature/mushroom_red.glb',

  well: './models/props/Well.glb',
  cart: './models/props/Cart.glb',
  market_stand: './models/props/MarketStand_1.glb',
  barrel: './models/props/Barrel.glb',
  crate: './models/props/Crate.glb',
  bench: './models/props/Bench_1.glb',
  bag_open: './models/props/Bag_Open.glb',
  boat: './models/props/Boat.glb',
  fishing_rod: './models/props/FishingRod.glb',
  log_stack: './models/props/log_stack.glb',
  hay_stack: './models/props/Hay.glb',
  gazebo: './models/props/Gazebo.glb',
  fence_seg: './models/props/Fence.glb',

  food_carrot: './models/food/carrot.glb',
  food_radish: './models/food/radish.glb',
  food_tomato: './models/food/tomato.glb',
  food_pumpkin: './models/food/pumpkin.glb',
  food_egg: './models/food/egg.glb',

  animal_cow: './models/animals/Cow.glb',
  animal_chicken: './models/animals/chicken_oga.glb',
  animal_pig: './models/animals/pig_oga.glb',
};

interface CachedModel {
  scene: THREE.Group;
  animations: THREE.AnimationClip[];
  size: THREE.Vector3;
  center: THREE.Vector3;
  minY: number;
}

class ModelLibrary {
  private loader = new GLTFLoader();
  private cache = new Map<ModelKey, CachedModel>();
  private loading = new Map<ModelKey, Promise<CachedModel | null>>();

  public preloadAll(): Promise<void> {
    const keys = Object.keys(MODEL_PATHS) as ModelKey[];
    return Promise.all(keys.map((k) => this.load(k))).then(() => undefined);
  }

  public load(key: ModelKey): Promise<CachedModel | null> {
    const cached = this.cache.get(key);
    if (cached) return Promise.resolve(cached);

    const existing = this.loading.get(key);
    if (existing) return existing;

    const url = MODEL_PATHS[key];
    const promise = new Promise<CachedModel | null>((resolve) => {
      this.loader.load(
        url,
        (gltf) => {
          const root = gltf.scene;
          root.traverse((child) => {
            if (child instanceof THREE.Mesh) {
              child.castShadow = true;
              child.receiveShadow = true;
              const mats = Array.isArray(child.material) ? child.material : [child.material];
              for (const m of mats) {
                if (m instanceof THREE.MeshStandardMaterial) {
                  m.roughness = Math.max(m.roughness, 0.72);
                  m.metalness = Math.min(m.metalness, 0.14);
                  m.envMapIntensity = 0.65;
                }
              }
            }
          });
          root.updateMatrixWorld(true);
          const box = new THREE.Box3().setFromObject(root);
          const size = new THREE.Vector3();
          const center = new THREE.Vector3();
          box.getSize(size);
          box.getCenter(center);

          const entry: CachedModel = {
            scene: root,
            animations: gltf.animations ?? [],
            size,
            center,
            minY: box.min.y,
          };
          this.cache.set(key, entry);
          resolve(entry);
        },
        undefined,
        () => resolve(null)
      );
    });
    this.loading.set(key, promise);
    return promise;
  }

  public cloneGrounded(
    key: ModelKey,
    targetHeight: number,
    options?: {
      tintColor?: string;
      tintPredicate?: (matName: string, color: THREE.Color) => boolean;
      castShadow?: boolean;
      receiveShadow?: boolean;
    }
  ): THREE.Group | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const wrapper = new THREE.Group();
    const clone = entry.scene.clone(true);
    const scale = entry.size.y > 0.0001 ? targetHeight / entry.size.y : 1;

    clone.scale.setScalar(scale);
    clone.position.set(
      -entry.center.x * scale,
      -entry.minY * scale,
      -entry.center.z * scale
    );

    if (options) {
      const tint = options.tintColor ? new THREE.Color(options.tintColor) : null;
      clone.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          if (typeof options.castShadow === 'boolean') child.castShadow = options.castShadow;
          if (typeof options.receiveShadow === 'boolean') child.receiveShadow = options.receiveShadow;
          if (tint) {
            const origMat = child.material;
            if (Array.isArray(origMat)) {
              child.material = origMat.map((m) => this.maybeTintMaterial(m, tint, options.tintPredicate));
            } else {
              child.material = this.maybeTintMaterial(origMat, tint, options.tintPredicate);
            }
          }
        }
      });
    }

    wrapper.add(clone);
    return wrapper;
  }

  /**
   * Properly clones rigged/skinned GLB models via SkeletonUtils.clone() so each instance
   * drives its own independent AnimationMixer cleanly!
   */
  public cloneAnimatedGrounded(
    key: ModelKey,
    targetHeight: number,
    options?: {
      rotateY?: number;
      materialOverride?: (mat: THREE.MeshStandardMaterial) => void;
    }
  ): { group: THREE.Group; mixer: THREE.AnimationMixer; clips: THREE.AnimationClip[] } | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const cloned = SkeletonUtils.clone(entry.scene) as THREE.Group;
    const scale = entry.size.y > 0.0001 ? targetHeight / entry.size.y : 1;

    cloned.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        child.frustumCulled = false; // SkinnedMesh bounding spheres can lag behind animated bone transforms
        if (options?.materialOverride) {
          if (Array.isArray(child.material)) {
            child.material = child.material.map((m) => {
              if (m instanceof THREE.MeshStandardMaterial) {
                const c = m.clone();
                options.materialOverride!(c);
                return c;
              }
              return m;
            });
          } else if (child.material instanceof THREE.MeshStandardMaterial) {
            const c = child.material.clone();
            options.materialOverride(c);
            child.material = c;
          }
        }
      }
    });

    const align = new THREE.Group();
    cloned.scale.setScalar(scale);
    cloned.position.set(
      -entry.center.x * scale,
      -entry.minY * scale,
      -entry.center.z * scale
    );
    align.add(cloned);
    if (options?.rotateY) {
      align.rotation.y = options.rotateY;
    }

    const wrapper = new THREE.Group();
    wrapper.add(align);

    const mixer = new THREE.AnimationMixer(cloned);
    return { group: wrapper, mixer, clips: entry.animations };
  }

  private maybeTintMaterial(
    mat: THREE.Material,
    tint: THREE.Color,
    predicate?: (name: string, color: THREE.Color) => boolean
  ): THREE.Material {
    if (!(mat instanceof THREE.MeshStandardMaterial)) return mat;
    const match = predicate ? predicate(mat.name, mat.color) : true;
    if (!match) return mat;
    const copy = mat.clone();
    copy.color.copy(tint);
    return copy;
  }
}

export const modelLibrary = new ModelLibrary();
