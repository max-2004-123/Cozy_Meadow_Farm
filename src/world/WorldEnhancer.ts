import * as THREE from 'three';
import { modelLibrary, ModelKey } from '../assets/modelLoader';
import { WORLD_CONFIG } from '../config/farmConfig';
import { CollisionSystem } from './CollisionSystem';

export interface TreeSpot {
  x: number;
  z: number;
  scale: number;
  paletteIdx: number; // 3 = cherry blossom!
}

export class WorldEnhancer {
  public group = new THREE.Group();
  private bobbingBoat: THREE.Object3D | null = null;
  private boatBaseY = 0.105;

  constructor(scene: THREE.Scene, private collisions: CollisionSystem) {
    scene.add(this.group);
  }

  /**
   * Mounts preloaded CC0 Quaternius & Kenney GLB models seamlessly into Sunnybrook Farm,
   * hiding placeholder trees once sculpted branched trees are ready.
   */
  public mountLoadedModels(
    treeSpots: TreeSpot[],
    placeholderTreesGroup: THREE.Group,
    propSlots?: {
      waterBarrel: THREE.Object3D;
      supplyCrate: THREE.Object3D;
      marketStand: THREE.Object3D;
    }
  ): void {
    // 1. Upgrade trees to sculpted multi-branch Quaternius trees (with pastel cherry-blossom variants!)
    let mountedTrees = 0;
    const greenKeys: ModelKey[] = ['tree_common_1', 'tree_common_2', 'tree_common_3', 'tree_birch_1'];

    treeSpots.forEach((spot, i) => {
      const isBlossom = spot.paletteIdx === 3;
      const isPondWillow = i === 11 || i === 12; // Trees framing the Duck Pond!
      const key: ModelKey = isPondWillow
        ? 'tree_willow_1'
        : isBlossom
          ? (i % 2 === 0 ? 'tree_common_2' : 'tree_common_1')
          : greenKeys[i % greenKeys.length];

      const targetH = (isPondWillow ? 6.4 : 5.6) * spot.scale;
      const tintColor = isBlossom
        ? '#f7aec5'
        : isPondWillow
          ? '#7cc76d'
          : i % 3 === 0
            ? '#6ec05e'
            : i % 3 === 1
              ? '#82cb68'
              : '#5eb058';

      const tree = modelLibrary.cloneGrounded(key, targetH, {
        tintColor,
        // Only tint foliage/leaf materials — preserve natural warm wood bark on trunks!
        tintPredicate: (name, color) => {
          const lower = name.toLowerCase();
          if (lower.includes('bark') || lower.includes('wood') || lower.includes('trunk')) return false;
          if (lower.includes('leaf') || lower.includes('leaves') || lower.includes('green') || lower.includes('foliage')) {
            return true;
          }
          // Fallback heuristic: green-dominant colors are foliage
          return color.g > color.r * 1.05 && color.g > color.b * 0.95;
        },
      });

      if (tree) {
        tree.position.set(spot.x, 0, spot.z);
        tree.rotation.y = (spot.x * 1.7 + spot.z * 2.3) % (Math.PI * 2);
        this.group.add(tree);
        mountedTrees++;
      }
    });

    if (mountedTrees > 0) {
      placeholderTreesGroup.visible = false;
    }

    // 2. Storybook Village & Farm Landmark Props (Quaternius CC0 + Kenney CC0)
    const placeProp = (
      key: ModelKey,
      x: number,
      y: number,
      z: number,
      height: number,
      rotY = 0,
      colRadius = 0
    ): THREE.Group | null => {
      const m = modelLibrary.cloneGrounded(key, height);
      if (!m) return null;
      m.position.set(x, y, z);
      m.rotation.y = rotY;
      this.group.add(m);
      if (colRadius > 0) {
        this.collisions.addCircle(x, z, colRadius);
      }
      return m;
    };

    // Charming Stone Wishing Well between the Farmhouse and Crossroads!
    placeProp('well', -8.8, 0, -5.8, 2.8, 0.45, 0.95);

    // Rustic Wooden Farm Cart parked near the Red Barn!
    placeProp('cart', 10.6, 0, -7.8, 1.55, 0.72, 1.15);

    // Cozy Wooden Bench overlooking the Duck Pond!
    placeProp('bench', -1.8, 0, -13.9, 0.88, -0.58, 0.65);

    // Firewood log stack neatly tucked beside the Farmhouse!
    placeProp('log_stack', -15.4, 0, -1.6, 0.92, 0.35, 0.75);

    // Open grain sack tucked neatly beside the Supply Crate (clear of garden fence) & Chicken Coop
    placeProp('bag_open', WORLD_CONFIG.supplyCratePos.x - 0.05, 0, WORLD_CONFIG.supplyCratePos.z - 0.88, 0.68, 0.4);
    placeProp('bag_open', 12.6, 0, 12.2, 0.66, -0.5);

    // Extra rustic oak barrel, crate cluster & sculpted Quaternius haystacks near barn/pasture (clear of barn ladder & windmill knoll!)
    placeProp('barrel', 12.2, 0, -3.2, 0.95, 0.2, 0.5);
    placeProp('crate', 11.3, 0, -3.7, 0.85, 0.4, 0.55);
    placeProp('hay_stack', 10.0, 0, -5.0, 1.35, 0.5, 0.85);
    placeProp('hay_stack', 21.6, 0, -1.0, 1.4, -0.4, 0.85);
    placeProp('hay_stack', 19.6, 0, -13.6, 1.45, 0.9, 0.85);

    // Cozy Scenic Wooden Gazebo tucked in the blossom grove overlooking the Duck Pond!
    placeProp('gazebo', -14.6, 0, -13.6, 3.8, 0.42, 1.75);

    // Upgrade interactive Water Barrel, Supply Crate, and Market Stand with sculpted Quaternius & Kenney 3D models!
    if (propSlots) {
      const swapVisual = (container: THREE.Object3D, replacement: THREE.Object3D) => {
        for (const child of container.children) {
          if (!child.userData.keepOnSwap) {
            child.visible = false;
          }
        }
        container.add(replacement);
      };

      // 1. Sculpted Oak Rainwater Barrel with raised open oak lip, sparkling clear water & wooden dipper ladle!
      const glbBarrel = modelLibrary.cloneGrounded('barrel', 1.08);
      if (glbBarrel) {
        const rimMat = new THREE.MeshStandardMaterial({ color: '#5c3c24', roughness: 0.86 });
        const barrelRim = new THREE.Mesh(new THREE.TorusGeometry(0.325, 0.036, 8, 24), rimMat);
        barrelRim.rotation.x = Math.PI / 2;
        barrelRim.position.y = 1.096;
        barrelRim.castShadow = true;
        glbBarrel.add(barrelRim);

        const waterDisc = new THREE.Mesh(
          new THREE.CircleGeometry(0.315, 24),
          new THREE.MeshStandardMaterial({
            color: '#7fe6ff',
            emissive: '#35a6db',
            emissiveIntensity: 0.24,
            roughness: 0.08,
            metalness: 0.1,
          })
        );
        waterDisc.rotation.x = -Math.PI / 2;
        waterDisc.position.y = 1.09;
        glbBarrel.add(waterDisc);

        // Little wooden water dipper ladle resting across the oak rim!
        const ladleWood = new THREE.MeshStandardMaterial({ color: '#b57b45', roughness: 0.82 });
        const ladleHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.02, 0.48, 6), ladleWood);
        ladleHandle.rotation.z = Math.PI / 2 - 0.12;
        ladleHandle.rotation.y = 0.5;
        ladleHandle.position.set(0.08, 1.135, 0.04);
        glbBarrel.add(ladleHandle);
        const ladleCup = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.055, 0.085, 8), ladleWood);
        ladleCup.position.set(-0.11, 1.11, -0.06);
        glbBarrel.add(ladleCup);

        swapVisual(propSlots.waterBarrel, glbBarrel);
      }

      // 2. Sculpted Wooden Supply Crate with peeking colorful seed packets!
      const glbCrate = modelLibrary.cloneGrounded('crate', 0.92);
      if (glbCrate) {
        const sackColors = ['#f5d47a', '#f59e56', '#ee7d9c', '#82c96e'];
        for (let i = 0; i < 4; i++) {
          const pouch = new THREE.Mesh(
            new THREE.BoxGeometry(0.22, 0.3, 0.12),
            new THREE.MeshStandardMaterial({ color: sackColors[i], roughness: 0.78 })
          );
          pouch.position.set(-0.28 + i * 0.18, 0.98, (i % 2 - 0.5) * 0.18);
          pouch.rotation.z = (i - 1.5) * 0.14;
          pouch.castShadow = true;
          glbCrate.add(pouch);
        }
        swapVisual(propSlots.supplyCrate, glbCrate);
      }

      // 3. Sculpted Quaternius Market Stand stocked with real Kenney 3D produce!
      const glbStand = modelLibrary.cloneGrounded('market_stand', 2.65);
      if (glbStand) {
        const produce: [ModelKey, number, number, number, number][] = [
          ['food_pumpkin', -0.58, 0.92, 0.12, 0.42],
          ['food_carrot', -0.12, 0.92, 0.18, 0.34],
          ['food_radish', 0.18, 0.92, 0.12, 0.32],
          ['food_tomato', 0.48, 0.92, 0.16, 0.28],
          ['food_egg', 0.72, 0.92, 0.08, 0.26],
        ];
        for (const [k, px, py, pz, ph] of produce) {
          const m = modelLibrary.cloneGrounded(k, ph);
          if (m) {
            m.position.set(px, py, pz);
            m.rotation.y = px * 2.5;
            glbStand.add(m);
          }
        }
        swapVisual(propSlots.marketStand, glbStand);
      }
    }

    // Moored Wooden Rowboat gently bobbing on the Duck Pond + Fishing Rod on the Dock!
    const pondX = WORLD_CONFIG.pondCenter.x;
    const pondZ = WORLD_CONFIG.pondCenter.z;
    const boat = placeProp('boat', pondX + 3.4, this.boatBaseY, pondZ + 1.8, 0.78, -2.35);
    if (boat) this.bobbingBoat = boat;

    const rod = placeProp('fishing_rod', pondX + 0.9, 0.4, pondZ + WORLD_CONFIG.pondRadiusZ - 1.55, 1.85, 0.4);
    if (rod) {
      rod.rotation.x = -0.52;
    }

    // 3. Detailed Nature Accents (Mossy boulders, berry bushes, toadstool mushrooms, stumps & sculpted wildflowers!)
    const mossRocks: [number, number, number, number][] = [
      [-13.5, -15.2, 0.9, 0.4],
      [-11.8, -19.8, 1.05, 1.2],
      [1.4, -18.2, 0.85, 2.1],
      [8.6, -16.4, 1.1, 0.7],
      [-21.2, 14.5, 0.95, 1.6],
      [21.6, 15.8, 0.9, 2.4],
    ];
    mossRocks.forEach(([x, z, h, rot], idx) => {
      placeProp(idx % 2 === 0 ? 'rock_moss_1' : 'rock_moss_2', x, 0, z, h, rot, 0.55);
    });

    const berryBushes: [number, number, number][] = [
      [-17.8, 9.6, 1.05],
      [-15.8, 1.8, 0.95],
      [-15.8, -11.8, 1.1],
      [4.0, -14.2, 1.0],
      [24.2, 6.2, 1.15],
      [-6.8, 19.8, 1.0],
      [7.2, 19.6, 1.05],
    ];
    for (const [bx, bz, bh] of berryBushes) {
      placeProp('bush_berries', bx, 0, bz, bh, bx * 0.7);
    }

    // Cute red-spotted storybook mushrooms tucked near tree roots & pond!
    const mushrooms: [number, number][] = [
      [-10.1, 20.6],
      [10.2, 20.4],
      [-16.4, -15.2],
      [-11.0, -16.8],
      [1.2, -23.6],
      [-14.8, 12.6],
      [23.8, -12.6],
    ];
    for (const [mx, mz] of mushrooms) {
      placeProp('mushroom_red', mx, 0, mz, 0.42, mx * 1.5);
    }

    // Mossy woodland stump & log near the pond grove
    placeProp('stump_moss', -12.2, 0, -13.6, 0.72, 0.4, 0.5);
    placeProp('log_moss', 3.4, 0, -21.2, 0.65, 0.95, 0.7);

    // Sculpted Kenney & Quaternius wildflower clusters enriching the entrance, paths, garden & farmhouse!
    const flowerKeys: ModelKey[] = ['flower_purple', 'flower_red', 'flower_yellow', 'flowers_quaternius'];
    const wildflowerSpots: [number, number][] = [
      [-3.1, 21.6], [3.1, 21.8], [-3.3, 19.8], [3.3, 19.9],
      [-3.2, 16.4], [3.1, 16.2], [-3.0, 13.8], [3.0, 14.0],
      [-3.1, 11.0], [3.0, 4.4], [-3.2, 1.8], [3.1, 1.5],
      [-6.2, 1.4], [-10.0, 1.4], [-15.4, 6.2], [-15.4, 9.8],
      [-11.8, -4.6], [-11.0, -7.8], [-7.2, -8.5], [-3.2, -10.4],
      [-8.6, -12.8], [-1.2, -15.2], [5.8, -10.8], [9.4, -12.2],
      [4.2, 14.5], [9.2, 14.6], [16.5, 14.5], [22.4, 14.4],
    ];
    wildflowerSpots.forEach(([fx, fz], idx) => {
      const k = flowerKeys[idx % flowerKeys.length];
      placeProp(k, fx, 0, fz, k === 'flowers_quaternius' ? 0.52 : 0.44, idx * 1.1);
    });
  }

  public update(elapsed: number): void {
    if (this.bobbingBoat) {
      this.bobbingBoat.position.y = this.boatBaseY + Math.sin(elapsed * 1.65) * 0.035;
      this.bobbingBoat.rotation.z = Math.sin(elapsed * 1.2) * 0.035;
      this.bobbingBoat.rotation.x = Math.cos(elapsed * 1.05) * 0.025;
    }
  }
}
