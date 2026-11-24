import * as THREE from 'three';
import { FarmTextures } from '../assets/textures';
import { CollisionSystem } from './CollisionSystem';

export type BiomeId = 'farm' | 'lake' | 'pine_forest' | 'birch_meadow' | 'alpine_north' | 'deep_west' | 'autumn_east' | 'blossom_south';

interface WorldChunk {
  cx: number;
  cz: number;
  group: THREE.Group;
  centerX: number;
  centerZ: number;
}

const CHUNK_SIZE = 60;
const ACTIVE_RADIUS_CHUNKS = 2; // Loads 5×5 = 25 chunks around player (~150m radius)

// Simple deterministic hash so every chunk generates identically & quickly
function hash2(x: number, z: number, seed: number): number {
  const n = Math.sin(x * 127.1 + z * 311.7 + seed * 74.7) * 43758.5453123;
  return n - Math.floor(n);
}

export class OpenWorldChunks {
  public group = new THREE.Group();
  private chunks = new Map<string, WorldChunk>();
  private lastPlayerChunkX = Number.NaN;
  private lastPlayerChunkZ = Number.NaN;

  // Shared geometries & materials across ALL open-world chunks (ultra-low memory & draw calls!)
  private trunkGeo = new THREE.CylinderGeometry(0.24, 0.38, 2.4, 7);
  private pineConeGeo = new THREE.ConeGeometry(1.75, 4.6, 7);
  private canopyGeo = new THREE.IcosahedronGeometry(1.8, 1);
  private rockGeo = new THREE.DodecahedronGeometry(1.0, 1);
  private flowerGeo = new THREE.CylinderGeometry(0.18, 0.06, 0.32, 6);

  private trunkMat: THREE.MeshStandardMaterial;
  private pineMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.9, flatShading: true });
  private canopyMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.86, flatShading: true });
  private rockMat = new THREE.MeshStandardMaterial({ color: '#9c978d', roughness: 0.92, flatShading: true });
  private flowerMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.65 });

  constructor(
    scene: THREE.Scene,
    private textures: FarmTextures,
    private collisions: CollisionSystem
  ) {
    this.trunkMat = new THREE.MeshStandardMaterial({ map: this.textures.woodWarm, roughness: 0.92 });
    this.buildOpenWorldLandmarks();
    scene.add(this.group);
  }

  /**
   * Returns a human-friendly region label & icon for the player's current open-world location!
   */
  public getRegionLabel(x: number, z: number): string {
    if (Math.abs(x) <= 28 && z >= -26 && z <= 26) return '🏡 Sunnybrook Farm';
    if (x >= -32 && x <= 22 && z <= -34 && z >= -78) return '🌊 Emerald Lake';
    if (z < -80) return '🏔️ Alpine Highlands';
    if (z > 185 && Math.abs(x) < 55) return '🗼 Southern Lighthouse Cove';
    if (z > 55) return '🌸 Blossom Coast';
    if (x < -80) return '🌲 Deep Redwood Forest';
    if (x < -28) return '🏹 Whispering Pine Forest';
    if (x > 80) return '🍂 Golden Autumn Plains';
    if (x > 28) return '🌳 Birch Highland Meadow';
    return '🌼 Sunnybrook Valley';
  }

  private getBiome(wx: number, wz: number): BiomeId {
    if (wz < -82) return 'alpine_north';
    if (wz > 58) return 'blossom_south';
    if (wx < -82) return 'deep_west';
    if (wx > 82) return 'autumn_east';
    return 'farm';
  }

  private isInsideCoreArea(wx: number, wz: number): boolean {
    // Keep the handcrafted core farm + lake + hunting clearings completely untouched!
    if (wx > -80 && wx < 80 && wz > -82 && wz < 54) return true;
    // Keep the Southern Scenic Highway clear (x in [-7, 7], z in [24, 215])
    if (Math.abs(wx) < 8.5 && wz > 22 && wz < 220) return true;
    // Keep landmark plazas clear
    if (Math.hypot(wx - 0, wz + 155) < 16) return true; // North Watchtower
    if (Math.hypot(wx + 155, wz + 20) < 16) return true; // West Forester Outpost
    if (Math.hypot(wx - 155, wz - 10) < 16) return true; // East Autumn Rest Stop
    if (Math.hypot(wx - 0, wz - 225) < 28) return true; // South Lighthouse Cove
    return false;
  }

  private buildChunk(cx: number, cz: number): WorldChunk {
    const group = new THREE.Group();
    const minX = cx * CHUNK_SIZE;
    const minZ = cz * CHUNK_SIZE;
    const centerX = minX + CHUNK_SIZE * 0.5;
    const centerZ = minZ + CHUNK_SIZE * 0.5;

    // Skip generating trees/rocks for chunks completely outside the [-290, 290] playable valley
    if (Math.abs(centerX) > 310 || Math.abs(centerZ) > 310) {
      return { cx, cz, group, centerX, centerZ };
    }

    const pineTransforms: { x: number; z: number; s: number; col: string }[] = [];
    const broadTransforms: { x: number; z: number; s: number; col: string }[] = [];
    const rockTransforms: { x: number; z: number; s: number; rot: number }[] = [];
    const flowerTransforms: { x: number; z: number; col: string }[] = [];

    // 14 deterministic tree candidates + 6 rocks + 18 flowers per 60x60m chunk!
    for (let i = 0; i < 14; i++) {
      const wx = minX + hash2(cx, cz, i * 3 + 1) * CHUNK_SIZE;
      const wz = minZ + hash2(cx, cz, i * 3 + 2) * CHUNK_SIZE;
      if (this.isInsideCoreArea(wx, wz)) continue;
      if (Math.abs(wx) > 286 || Math.abs(wz) > 286) continue;

      const biome = this.getBiome(wx, wz);
      const s = 1.05 + hash2(cx, cz, i * 3 + 3) * 0.75;
      const rVal = hash2(cx, cz, i * 7 + 9);

      if (biome === 'alpine_north') {
        pineTransforms.push({ x: wx, z: wz, s: s * 1.15, col: rVal > 0.5 ? '#3a7545' : '#4a8a52' });
      } else if (biome === 'deep_west') {
        pineTransforms.push({ x: wx, z: wz, s: s * 1.28, col: rVal > 0.4 ? '#356b40' : '#4b8248' });
      } else if (biome === 'autumn_east') {
        const cols = ['#e8a838', '#e07a38', '#d95d43', '#8bc255'];
        broadTransforms.push({ x: wx, z: wz, s, col: cols[Math.floor(rVal * cols.length)] });
      } else if (biome === 'blossom_south') {
        const cols = ['#f7aec5', '#f9c2d4', '#76bf5e', '#86cc6c'];
        broadTransforms.push({ x: wx, z: wz, s, col: cols[Math.floor(rVal * cols.length)] });
      }
      this.collisions.addCircle(wx, wz, 0.62 * s);
    }

    for (let i = 0; i < 6; i++) {
      const wx = minX + hash2(cx, cz, 100 + i * 3) * CHUNK_SIZE;
      const wz = minZ + hash2(cx, cz, 101 + i * 3) * CHUNK_SIZE;
      if (this.isInsideCoreArea(wx, wz)) continue;
      if (Math.abs(wx) > 286 || Math.abs(wz) > 286) continue;
      const s = 0.8 + hash2(cx, cz, 102 + i * 3) * 1.3;
      rockTransforms.push({ x: wx, z: wz, s, rot: i * 1.2 });
      if (s > 1.05) this.collisions.addCircle(wx, wz, s * 0.85);
    }

    const flCols = ['#fff8e8', '#ff94b8', '#ffe066', '#9ddbff', '#cfa8ff'];
    for (let i = 0; i < 18; i++) {
      const wx = minX + hash2(cx, cz, 200 + i * 3) * CHUNK_SIZE;
      const wz = minZ + hash2(cx, cz, 201 + i * 3) * CHUNK_SIZE;
      if (this.isInsideCoreArea(wx, wz)) continue;
      if (Math.abs(wx) > 286 || Math.abs(wz) > 286) continue;
      flowerTransforms.push({ x: wx, z: wz, col: flCols[i % flCols.length] });
    }

    const dummy = new THREE.Object3D();
    const tmpCol = new THREE.Color();

    // Batch trunks + pine cones + broadleaf canopies into tiny InstancedMesh draw calls!
    const totalTrees = pineTransforms.length + broadTransforms.length;
    if (totalTrees > 0) {
      const trunks = new THREE.InstancedMesh(this.trunkGeo, this.trunkMat, totalTrees);
      let idx = 0;
      for (const t of pineTransforms) {
        dummy.position.set(t.x, 1.2 * t.s, t.z);
        dummy.rotation.set(0, t.x, 0);
        dummy.scale.set(t.s, t.s, t.s);
        dummy.updateMatrix();
        trunks.setMatrixAt(idx++, dummy.matrix);
      }
      for (const t of broadTransforms) {
        dummy.position.set(t.x, 1.2 * t.s, t.z);
        dummy.rotation.set(0, t.z, 0);
        dummy.scale.set(t.s, t.s, t.s);
        dummy.updateMatrix();
        trunks.setMatrixAt(idx++, dummy.matrix);
      }
      trunks.instanceMatrix.needsUpdate = true;
      group.add(trunks);
    }

    if (pineTransforms.length > 0) {
      const pines = new THREE.InstancedMesh(this.pineConeGeo, this.pineMat, pineTransforms.length);
      pineTransforms.forEach((t, i) => {
        dummy.position.set(t.x, 4.1 * t.s, t.z);
        dummy.rotation.set(0, i * 0.7, 0);
        dummy.scale.set(t.s, t.s, t.s);
        dummy.updateMatrix();
        pines.setMatrixAt(i, dummy.matrix);
        pines.setColorAt(i, tmpCol.set(t.col));
      });
      pines.instanceMatrix.needsUpdate = true;
      if (pines.instanceColor) pines.instanceColor.needsUpdate = true;
      group.add(pines);
    }

    if (broadTransforms.length > 0) {
      const canopies = new THREE.InstancedMesh(this.canopyGeo, this.canopyMat, broadTransforms.length);
      broadTransforms.forEach((t, i) => {
        dummy.position.set(t.x, 3.6 * t.s, t.z);
        dummy.rotation.set(0, i * 0.9, 0);
        dummy.scale.set(t.s * 1.15, t.s * 0.9, t.s * 1.15);
        dummy.updateMatrix();
        canopies.setMatrixAt(i, dummy.matrix);
        canopies.setColorAt(i, tmpCol.set(t.col));
      });
      canopies.instanceMatrix.needsUpdate = true;
      if (canopies.instanceColor) canopies.instanceColor.needsUpdate = true;
      group.add(canopies);
    }

    if (rockTransforms.length > 0) {
      const rocks = new THREE.InstancedMesh(this.rockGeo, this.rockMat, rockTransforms.length);
      rockTransforms.forEach((r, i) => {
        dummy.position.set(r.x, r.s * 0.35, r.z);
        dummy.rotation.set(0.2, r.rot, 0.1);
        dummy.scale.set(r.s * 1.25, r.s * 0.68, r.s);
        dummy.updateMatrix();
        rocks.setMatrixAt(i, dummy.matrix);
      });
      rocks.instanceMatrix.needsUpdate = true;
      group.add(rocks);
    }

    if (flowerTransforms.length > 0) {
      const flowers = new THREE.InstancedMesh(this.flowerGeo, this.flowerMat, flowerTransforms.length);
      flowerTransforms.forEach((f, i) => {
        dummy.position.set(f.x, 0.16, f.z);
        dummy.rotation.set(0, i, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        flowers.setMatrixAt(i, dummy.matrix);
        flowers.setColorAt(i, tmpCol.set(f.col));
      });
      flowers.instanceMatrix.needsUpdate = true;
      if (flowers.instanceColor) flowers.instanceColor.needsUpdate = true;
      group.add(flowers);
    }

    this.group.add(group);
    return { cx, cz, group, centerX, centerZ };
  }

  /**
   * 4 Scenic Open-World Destination Landmarks to drive to & discover!
   */
  private buildOpenWorldLandmarks(): void {
    const woodMat = new THREE.MeshStandardMaterial({ map: this.textures.woodWarm, roughness: 0.86 });
    const lightWood = new THREE.MeshStandardMaterial({ map: this.textures.woodLight, roughness: 0.84 });
    const stoneMat = new THREE.MeshStandardMaterial({ map: this.textures.stoneWall, roughness: 0.92 });
    const roofMat = new THREE.MeshStandardMaterial({ map: this.textures.roofTerracotta, roughness: 0.82 });
    const whiteMat = new THREE.MeshStandardMaterial({ color: '#fff9ed', roughness: 0.72 });
    const redMat = new THREE.MeshStandardMaterial({ color: '#d95345', roughness: 0.75 });
    const glowMat = new THREE.MeshStandardMaterial({
      color: '#fff6c7',
      emissive: '#ffcf66',
      emissiveIntensity: 1.4,
      roughness: 0.2,
    });

    // 1. Southern Scenic Dirt Country Road from Farm Gate (z=26) to Lighthouse Cove (z=205)
    const roadMat = new THREE.MeshStandardMaterial({ color: '#c4a478', roughness: 0.95 });
    const road = new THREE.Mesh(new THREE.PlaneGeometry(7.2, 180), roadMat);
    road.rotation.x = -Math.PI / 2;
    road.position.set(0, 0.03, 116);
    road.receiveShadow = true;
    this.group.add(road);

    // 2. Southern Seaside Lighthouse & Ocean Cove at (0, 0, 225)!
    const lh = new THREE.Group();
    lh.position.set(0, 0, 225);
    const coveWater = new THREE.Mesh(
      new THREE.CircleGeometry(42, 32),
      new THREE.MeshStandardMaterial({ color: '#399ed4', roughness: 0.16, metalness: 0.12 })
    );
    coveWater.rotation.x = -Math.PI / 2;
    coveWater.position.set(0, 0.08, 36);
    lh.add(coveWater);

    const lhBase = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 4.0, 2.0, 14), stoneMat);
    lhBase.position.y = 1.0;
    lh.add(lhBase);
    for (let s = 0; s < 5; s++) {
      const band = new THREE.Mesh(
        new THREE.CylinderGeometry(2.8 - s * 0.25, 3.05 - s * 0.25, 2.8, 14),
        s % 2 === 0 ? whiteMat : redMat
      );
      band.position.y = 3.4 + s * 2.8;
      lh.add(band);
    }
    const beacon = new THREE.Mesh(new THREE.CylinderGeometry(1.45, 1.45, 2.2, 12), glowMat);
    beacon.position.y = 17.2;
    lh.add(beacon);
    const lhCap = new THREE.Mesh(new THREE.ConeGeometry(2.1, 2.6, 12), redMat);
    lhCap.position.y = 19.6;
    lh.add(lhCap);
    this.group.add(lh);
    this.collisions.addCircle(0, 225, 4.2);

    // 3. Northern Alpine Timber Watchtower at (0, 0, -155)!
    const tower = new THREE.Group();
    tower.position.set(0, 0, -155);
    for (const sx of [-2.4, 2.4]) {
      for (const sz of [-2.4, 2.4]) {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 12, 8), woodMat);
        leg.position.set(sx, 6, sz);
        tower.add(leg);
        this.collisions.addCircle(sx, -155 + sz, 0.5);
      }
    }
    const deck = new THREE.Mesh(new THREE.BoxGeometry(6.2, 0.35, 6.2), lightWood);
    deck.position.y = 10.2;
    tower.add(deck);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(4.6, 3.2, 4.6), woodMat);
    cabin.position.y = 11.9;
    tower.add(cabin);
    const tRoof = new THREE.Mesh(new THREE.ConeGeometry(4.6, 2.8, 4), roofMat);
    tRoof.rotation.y = Math.PI / 4;
    tRoof.position.y = 14.9;
    tower.add(tRoof);
    const tLantern = new THREE.Mesh(new THREE.SphereGeometry(0.45, 8, 6), glowMat);
    tLantern.position.y = 16.5;
    tower.add(tLantern);
    this.group.add(tower);

    // 4. West Forester Outpost Cabin at (-155, 0, -20) & East Autumn Rest Pavilion at (155, 0, 10)
    const addOutpost = (ox: number, oz: number, rotY: number) => {
      const g = new THREE.Group();
      g.position.set(ox, 0, oz);
      g.rotation.y = rotY;
      const body = new THREE.Mesh(new THREE.BoxGeometry(6.5, 3.8, 5.2), woodMat);
      body.position.y = 1.9;
      g.add(body);
      const roof = new THREE.Mesh(new THREE.ConeGeometry(5.4, 2.8, 4), roofMat);
      roof.rotation.y = Math.PI / 4;
      roof.position.y = 5.1;
      g.add(roof);
      const win = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.2, 5.35), glowMat);
      win.position.set(0, 2.1, 0);
      g.add(win);
      this.group.add(g);
      this.collisions.addCircle(ox, oz, 4.2);
    };
    addOutpost(-155, -20, 0.4);
    addOutpost(155, 10, -0.35);
  }

  public update(playerPos: THREE.Vector3): void {
    const pcx = Math.floor(playerPos.x / CHUNK_SIZE);
    const pcZ = Math.floor(playerPos.z / CHUNK_SIZE);

    if (pcx === this.lastPlayerChunkX && pcZ === this.lastPlayerChunkZ) return;
    this.lastPlayerChunkX = pcx;
    this.lastPlayerChunkZ = pcZ;

    // Hide chunks outside active streaming radius, lazily build & reveal chunks inside!
    for (const chunk of this.chunks.values()) {
      const active =
        Math.abs(chunk.cx - pcx) <= ACTIVE_RADIUS_CHUNKS &&
        Math.abs(chunk.cz - pcZ) <= ACTIVE_RADIUS_CHUNKS;
      chunk.group.visible = active;
    }

    for (let dx = -ACTIVE_RADIUS_CHUNKS; dx <= ACTIVE_RADIUS_CHUNKS; dx++) {
      for (let dz = -ACTIVE_RADIUS_CHUNKS; dz <= ACTIVE_RADIUS_CHUNKS; dz++) {
        const cx = pcx + dx;
        const cz = pcZ + dz;
        const key = `${cx},${cz}`;
        let chunk = this.chunks.get(key);
        if (!chunk) {
          chunk = this.buildChunk(cx, cz);
          this.chunks.set(key, chunk);
        }
        chunk.group.visible = true;
      }
    }
  }
}
