import * as THREE from 'three';
import { ITEMS } from '../config/farmConfig';
import { modelLibrary, ModelKey } from '../assets/modelLoader';
import { ItemId } from '../types';

type SwingKind = 'none' | 'hoe' | 'water' | 'plant' | 'feed' | 'harvest';

function paintSeedPacketTexture(label: string, accent: string, bg: string): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 160;
  c.height = 200;
  const ctx = c.getContext('2d')!;

  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 160, 200);

  ctx.fillStyle = accent;
  ctx.fillRect(0, 0, 160, 46);

  ctx.strokeStyle = '#9c7144';
  ctx.lineWidth = 8;
  ctx.strokeRect(4, 4, 152, 192);

  ctx.fillStyle = '#fffdf7';
  ctx.beginPath();
  ctx.arc(80, 110, 42, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = accent;
  ctx.lineWidth = 5;
  ctx.stroke();

  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.arc(80, 116, 20, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#5da950';
  ctx.beginPath();
  ctx.ellipse(72, 92, 10, 6, -0.5, 0, Math.PI * 2);
  ctx.ellipse(88, 92, 10, 6, 0.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.font = '800 20px "Trebuchet MS", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, 80, 25, 138);

  ctx.fillStyle = '#6b4728';
  ctx.font = '800 16px "Trebuchet MS", sans-serif';
  ctx.fillText('SEEDS', 80, 173);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class Viewmodel {
  public root = new THREE.Group();
  private itemHolder = new THREE.Group();
  private currentItemId: ItemId | null = null;
  private meshes = new Map<string, THREE.Group>();

  private swingKind: SwingKind = 'none';
  private swingProgress = 1;
  private equipPop = 1;

  constructor(camera: THREE.Camera) {
    this.root.position.set(0.37, -0.34, -0.66);
    this.root.add(this.itemHolder);
    camera.add(this.root);

    this.buildModels();
    this.setItem('hoe');
  }

  private buildModels(): void {
    // 1. Handcrafted Rustic Garden Hoe (leather grip wrap + brass ferrule + sculpted beveled forged blade!)
    const hoe = new THREE.Group();
    const woodMat = new THREE.MeshStandardMaterial({ color: '#c48652', roughness: 0.78 });
    const leatherMat = new THREE.MeshStandardMaterial({ color: '#7a4a2b', roughness: 0.88 });
    const brassRingMat = new THREE.MeshStandardMaterial({ color: '#e6be63', roughness: 0.32, metalness: 0.48 });
    const ironMat = new THREE.MeshStandardMaterial({ color: '#7e8e9e', roughness: 0.36, metalness: 0.45 });
    const edgeMat = new THREE.MeshStandardMaterial({ color: '#dce6f0', roughness: 0.22, metalness: 0.62 });

    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.021, 0.58, 12), woodMat);
    handle.position.y = 0.02;
    hoe.add(handle);

    // Leather grip bands at bottom of handle
    for (let g = 0; g < 3; g++) {
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.026, 12), leatherMat);
      band.position.y = -0.18 + g * 0.04;
      hoe.add(band);
    }
    const pommel = new THREE.Mesh(new THREE.SphereGeometry(0.023, 10, 8), leatherMat);
    pommel.position.y = -0.27;
    hoe.add(pommel);

    // Brass ferrule ring + forged tapered socket collar
    const ferrule = new THREE.Mesh(new THREE.CylinderGeometry(0.021, 0.02, 0.028, 12), brassRingMat);
    ferrule.position.y = 0.255;
    hoe.add(ferrule);

    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.022, 0.062, 12), ironMat);
    collar.position.y = 0.298;
    hoe.add(collar);
    const topCap = new THREE.Mesh(new THREE.SphereGeometry(0.024, 10, 6), ironMat);
    topCap.scale.set(1, 0.45, 1);
    topCap.position.y = 0.328;
    hoe.add(topCap);

    // Curved forged iron tang + beveled trapezoidal digging blade (ExtrudeGeometry!)
    const tang = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.014, 0.085, 8), ironMat);
    tang.rotation.x = Math.PI / 2 - 0.32;
    tang.position.set(0, 0.298, -0.044);
    hoe.add(tang);

    const bladeShape = new THREE.Shape();
    bladeShape.moveTo(-0.036, 0);
    bladeShape.lineTo(0.036, 0);
    bladeShape.lineTo(0.064, -0.135);
    bladeShape.quadraticCurveTo(0, -0.15, -0.064, -0.135);
    bladeShape.closePath();
    const bladeGeo = new THREE.ExtrudeGeometry(bladeShape, {
      depth: 0.012,
      bevelEnabled: true,
      bevelThickness: 0.004,
      bevelSize: 0.004,
      bevelSegments: 2,
    });
    bladeGeo.center();
    const blade = new THREE.Mesh(bladeGeo, ironMat);
    blade.rotation.x = -Math.PI / 2 + 0.56;
    blade.position.set(0, 0.258, -0.112);
    hoe.add(blade);

    const sharpEdge = new THREE.Mesh(new THREE.BoxGeometry(0.122, 0.008, 0.02), edgeMat);
    sharpEdge.rotation.x = 0.56;
    sharpEdge.position.set(0, 0.214, -0.168);
    hoe.add(sharpEdge);

    hoe.rotation.set(0.42, -0.56, 0.28);
    hoe.position.set(0.02, -0.04, 0);
    this.meshes.set('hoe', hoe);

    // 2. Vintage Pastel Enamel Watering Can (dual handles, brass rose, visible water & daisy decal!)
    const can = new THREE.Group();
    const canMat = new THREE.MeshStandardMaterial({ color: '#74c5f2', roughness: 0.32, metalness: 0.12 });
    const trimMat = new THREE.MeshStandardMaterial({ color: '#4d99c7', roughness: 0.38, metalness: 0.18 });
    const brassMat = new THREE.MeshStandardMaterial({ color: '#f2ca66', roughness: 0.28, metalness: 0.45 });

    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.092, 0.118, 0.195, 16), canMat);
    can.add(body);
    const baseRim = new THREE.Mesh(new THREE.TorusGeometry(0.116, 0.011, 6, 16), trimMat);
    baseRim.rotation.x = Math.PI / 2;
    baseRim.position.y = -0.092;
    can.add(baseRim);
    const topRim = new THREE.Mesh(new THREE.TorusGeometry(0.093, 0.012, 6, 16), trimMat);
    topRim.rotation.x = Math.PI / 2;
    topRim.position.y = 0.096;
    can.add(topRim);

    // Shimmering water surface visible inside the watering can!
    const innerWater = new THREE.Mesh(
      new THREE.CircleGeometry(0.086, 14),
      new THREE.MeshStandardMaterial({ color: '#a5ebff', emissive: '#3899cc', emissiveIntensity: 0.2, roughness: 0.12 })
    );
    innerWater.rotation.x = -Math.PI / 2;
    innerWater.position.y = 0.065;
    can.add(innerWater);

    // Top arched handle + rear pouring grip
    const topHandle = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.011, 7, 14, Math.PI), trimMat);
    topHandle.position.set(0, 0.09, 0.01);
    topHandle.rotation.y = Math.PI / 2;
    can.add(topHandle);
    const rearGrip = new THREE.Mesh(new THREE.TorusGeometry(0.072, 0.011, 7, 14, Math.PI * 1.1), trimMat);
    rearGrip.rotation.y = Math.PI / 2;
    rearGrip.rotation.x = 0.25;
    rearGrip.position.set(0, 0.0, 0.105);
    can.add(rearGrip);

    // Tapered spout + brass sprinkler rose
    const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.032, 0.25, 10), canMat);
    spout.position.set(0, 0.042, -0.17);
    spout.rotation.x = -0.96;
    can.add(spout);
    const rose = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.02, 0.046, 12), brassMat);
    rose.position.set(0, 0.115, -0.278);
    rose.rotation.x = -0.96;
    can.add(rose);
    const roseCap = new THREE.Mesh(
      new THREE.CircleGeometry(0.046, 12),
      new THREE.MeshStandardMaterial({ color: '#c99b38', roughness: 0.4, metalness: 0.4 })
    );
    roseCap.position.set(0, 0.128, -0.296);
    roseCap.rotation.x = -0.96 - Math.PI / 2;
    can.add(roseCap);

    // Cute miniature daisy emblem painted on the side of the watering can
    const daisy = new THREE.Group();
    daisy.position.set(-0.102, 0.0, 0.02);
    daisy.rotation.y = -Math.PI / 2;
    for (let p = 0; p < 5; p++) {
      const a = (p / 5) * Math.PI * 2;
      const pet = new THREE.Mesh(
        new THREE.SphereGeometry(0.015, 6, 5),
        new THREE.MeshStandardMaterial({ color: '#fffdf5', roughness: 0.5 })
      );
      pet.scale.set(1, 1, 0.35);
      pet.position.set(Math.cos(a) * 0.02, Math.sin(a) * 0.02, 0);
      daisy.add(pet);
    }
    const dCen = new THREE.Mesh(
      new THREE.SphereGeometry(0.012, 6, 5),
      new THREE.MeshStandardMaterial({ color: '#ffd954', roughness: 0.4 })
    );
    dCen.position.z = 0.004;
    daisy.add(dCen);
    can.add(daisy);

    can.rotation.set(0.18, -0.35, 0.08);
    this.meshes.set('watering_can', can);

    // 3. Hand-Painted Seed Packets
    const seedSpecs: [ItemId, string, string][] = [
      ['seed_carrot', 'CARROT', '#fbf0d8'],
      ['seed_radish', 'RADISH', '#fdeaf0'],
      ['seed_tomato', 'TOMATO', '#fdede8'],
      ['seed_pumpkin', 'PUMPKIN', '#fdf2df'],
    ];
    for (const [id, label, bg] of seedSpecs) {
      const pouch = new THREE.Group();
      const faceTex = paintSeedPacketTexture(label, ITEMS[id].accentColor, bg);
      const faceMat = new THREE.MeshStandardMaterial({ map: faceTex, roughness: 0.78 });
      const sideMat = new THREE.MeshStandardMaterial({ color: bg, roughness: 0.85 });
      const bag = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.19, 0.028), [
        sideMat,
        sideMat,
        sideMat,
        sideMat,
        faceMat,
        faceMat,
      ]);
      pouch.add(bag);
      // 3D crimped paper top seal strip on each seed packet!
      const seal = new THREE.Mesh(new THREE.BoxGeometry(0.154, 0.016, 0.032), sideMat);
      seal.position.y = 0.098;
      pouch.add(seal);
      pouch.rotation.set(-0.14, -0.42, 0.12);
      pouch.position.set(-0.02, 0.02, 0.02);
      this.meshes.set(id, pouch);
    }

    // 4. Woven Animal Feed Basket with arched wooden handle, ribbed staves & golden kernels!
    const feed = new THREE.Group();
    const bowlMat = new THREE.MeshStandardMaterial({ color: '#c98c55', roughness: 0.82 });
    const rimMat = new THREE.MeshStandardMaterial({ color: '#9c6334', roughness: 0.86 });
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.128, 0.086, 0.1, 14), bowlMat);
    feed.add(bowl);
    const bowlRim = new THREE.Mesh(new THREE.TorusGeometry(0.126, 0.014, 6, 16), rimMat);
    bowlRim.rotation.x = Math.PI / 2;
    bowlRim.position.y = 0.048;
    feed.add(bowlRim);
    const midBand = new THREE.Mesh(new THREE.TorusGeometry(0.106, 0.008, 6, 16), rimMat);
    midBand.rotation.x = Math.PI / 2;
    midBand.position.y = 0.0;
    feed.add(midBand);
    const basketHandle = new THREE.Mesh(new THREE.TorusGeometry(0.124, 0.011, 7, 16, Math.PI), rimMat);
    basketHandle.position.y = 0.048;
    basketHandle.rotation.y = Math.PI / 2;
    feed.add(basketHandle);
    const grain = new THREE.Mesh(
      new THREE.SphereGeometry(0.116, 12, 8),
      new THREE.MeshStandardMaterial({ color: '#f5cf64', roughness: 0.78 })
    );
    grain.scale.set(1, 0.56, 1);
    grain.position.y = 0.036;
    feed.add(grain);
    // Individual golden kernels scattered on top
    const kMat = new THREE.MeshStandardMaterial({ color: '#ffe585', roughness: 0.65 });
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * Math.PI * 2;
      const r = 0.04 + (k % 3) * 0.025;
      const kernel = new THREE.Mesh(new THREE.SphereGeometry(0.018, 6, 5), kMat);
      kernel.position.set(Math.cos(a) * r, 0.082 + (k % 2) * 0.014, Math.sin(a) * r);
      feed.add(kernel);
    }
    feed.rotation.set(0.32, -0.25, 0.06);
    this.meshes.set('animal_feed', feed);

    // 5. Harvested Crops & Animal Products (initial procedural models, upgraded to Kenney GLBs when loaded!)
    this.buildHarvestHoldModels();
  }

  private buildHarvestHoldModels(): void {
    const makeGenericOrb = (color: string, scale: [number, number, number], topperColor?: string) => {
      const g = new THREE.Group();
      const m = new THREE.Mesh(
        new THREE.SphereGeometry(0.105, 10, 8),
        new THREE.MeshStandardMaterial({ color, roughness: 0.52 })
      );
      m.scale.set(...scale);
      g.add(m);
      if (topperColor) {
        const top = new THREE.Mesh(
          new THREE.ConeGeometry(0.055, 0.12, 6),
          new THREE.MeshStandardMaterial({ color: topperColor, roughness: 0.7 })
        );
        top.position.y = 0.12;
        g.add(top);
      }
      return g;
    };

    const glbMap: [ItemId, ModelKey, number][] = [
      ['crop_carrot', 'food_carrot', 0.24],
      ['crop_radish', 'food_radish', 0.22],
      ['crop_tomato', 'food_tomato', 0.18],
      ['crop_pumpkin', 'food_pumpkin', 0.22],
      ['prod_egg', 'food_egg', 0.18],
    ];

    for (const [id, key, height] of glbMap) {
      const loaded = modelLibrary.cloneGrounded(key, height, { castShadow: false, receiveShadow: false });
      if (loaded) {
        loaded.position.y = -height * 0.45;
        loaded.rotation.set(0.2, -0.4, 0.1);
        this.meshes.set(id, loaded);
      } else if (!this.meshes.has(id)) {
        const fallback =
          id === 'crop_carrot'
            ? makeGenericOrb('#f48a3b', [0.68, 1.32, 0.68], '#5ea850')
            : id === 'crop_radish'
              ? makeGenericOrb('#e9668d', [1.0, 0.92, 1.0], '#5ea850')
              : id === 'crop_tomato'
                ? makeGenericOrb('#ee5847', [1.04, 0.94, 1.04], '#4e9c46')
                : id === 'crop_pumpkin'
                  ? makeGenericOrb('#ec902e', [1.24, 0.86, 1.24], '#5b8f44')
                  : makeGenericOrb('#fff1d2', [0.85, 1.18, 0.85]);
        this.meshes.set(id, fallback);
      }
    }

    if (!this.meshes.has('prod_wool')) {
      const wool = new THREE.Group();
      const wm = new THREE.MeshStandardMaterial({ color: '#fffbf0', roughness: 0.9 });
      for (const [x, y, z, r] of [[0, 0, 0, 0.08], [0.05, 0.03, 0.02, 0.06], [-0.05, 0.02, -0.02, 0.06], [0, -0.04, 0.04, 0.055]] as [number, number, number, number][]) {
        const p = new THREE.Mesh(new THREE.SphereGeometry(r, 8, 6), wm);
        p.position.set(x, y, z);
        wool.add(p);
      }
      this.meshes.set('prod_wool', wool);
    }

    if (!this.meshes.has('prod_truffle')) {
      this.meshes.set('prod_truffle', makeGenericOrb('#8c6244', [1.04, 0.82, 0.96]));
    }

    if (!this.meshes.has('prod_milk')) {
      const milk = new THREE.Group();
      const glassMat = new THREE.MeshStandardMaterial({ color: '#f7fcff', roughness: 0.16, metalness: 0.08 });
      const bottle = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.072, 0.18, 12), glassMat);
      milk.add(bottle);
      const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.045, 0.055, 12), glassMat);
      neck.position.y = 0.11;
      milk.add(neck);
      const cap = new THREE.Mesh(
        new THREE.CylinderGeometry(0.044, 0.044, 0.032, 12),
        new THREE.MeshStandardMaterial({ color: '#ea7567', roughness: 0.55 })
      );
      cap.position.y = 0.145;
      milk.add(cap);
      const labelBand = new THREE.Mesh(
        new THREE.CylinderGeometry(0.066, 0.071, 0.065, 12),
        new THREE.MeshStandardMaterial({ color: '#9cd7fa', roughness: 0.65 })
      );
      labelBand.position.y = -0.015;
      milk.add(labelBand);
      this.meshes.set('prod_milk', milk);
    }
  }

  public refreshLoadedModels(): void {
    this.buildHarvestHoldModels();
    const cur = this.currentItemId;
    if (cur) {
      this.currentItemId = null;
      this.setItem(cur);
    }
  }

  public setItem(id: ItemId): void {
    if (this.currentItemId === id) return;
    this.currentItemId = id;
    while (this.itemHolder.children.length > 0) {
      this.itemHolder.remove(this.itemHolder.children[0]);
    }
    const model = this.meshes.get(id) ?? this.meshes.get('hoe');
    if (model) {
      this.itemHolder.add(model);
    }
    this.equipPop = 0;
  }

  public triggerAction(kind: Exclude<SwingKind, 'none'>): void {
    this.swingKind = kind;
    this.swingProgress = 0;
  }

  public update(dt: number, elapsed: number, moveSpeedFactor: number): void {
    if (this.equipPop < 1) {
      this.equipPop = Math.min(1, this.equipPop + dt * 5.2);
    }
    const equipY = (1 - this.equipPop) * -0.16;

    const bobX = Math.cos(elapsed * 7.5) * 0.015 * moveSpeedFactor;
    const bobY = Math.abs(Math.sin(elapsed * 7.5)) * 0.018 * moveSpeedFactor + Math.sin(elapsed * 2.1) * 0.004;

    let animX = 0;
    let animY = 0;
    let animZ = 0;
    let rotX = 0;
    let rotZ = 0;

    if (this.swingProgress < 1) {
      const speed = this.swingKind === 'water' ? 2.2 : 3.6;
      this.swingProgress = Math.min(1, this.swingProgress + dt * speed);
      const s = Math.sin(this.swingProgress * Math.PI);

      if (this.swingKind === 'hoe') {
        rotX = -s * 0.95;
        animY = -s * 0.08;
        animZ = -s * 0.12;
      } else if (this.swingKind === 'water') {
        rotX = -s * 0.65;
        rotZ = s * 0.25;
        animZ = -s * 0.14;
      } else if (this.swingKind === 'plant' || this.swingKind === 'feed') {
        rotX = -s * 0.45;
        animZ = -s * 0.18;
        animY = s * 0.05;
      } else if (this.swingKind === 'harvest') {
        animZ = -s * 0.14;
        animY = s * 0.09;
      }
    }

    this.root.position.set(0.37 + bobX + animX, -0.34 + bobY + equipY + animY, -0.66 + animZ);
    this.itemHolder.rotation.set(rotX, 0, rotZ);
  }
}
