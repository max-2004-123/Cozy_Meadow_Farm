import * as THREE from 'three';
import { FarmTextures } from '../assets/textures';
import { modelLibrary, ModelKey } from '../assets/modelLoader';
import { WORLD_CONFIG } from '../config/farmConfig';
import { CollisionSystem } from './CollisionSystem';
import { SkyAndLighting } from './SkyAndLighting';

interface SwimmingFish {
  group: THREE.Group;
  tail: THREE.Mesh;
  centerX: number;
  centerZ: number;
  rx: number;
  rz: number;
  angle: number;
  speed: number;
}

export interface ArcheryTargetSpot {
  center: THREE.Vector3;
  radius: number;
  mesh: THREE.Group;
}

function makeTrailSignTexture(title: string, subtitle: string): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 200;
  const ctx = c.getContext('2d')!;

  ctx.fillStyle = '#c88c53';
  ctx.fillRect(0, 0, 512, 200);
  ctx.fillStyle = '#b47840';
  for (let y = 0; y < 200; y += 26) {
    ctx.fillRect(0, y, 512, 4);
  }
  ctx.strokeStyle = '#6f4522';
  ctx.lineWidth = 14;
  ctx.strokeRect(7, 7, 498, 186);

  ctx.fillStyle = '#fff9ec';
  ctx.font = '800 44px "Trebuchet MS", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(title, 256, 78);

  ctx.fillStyle = '#ffe5a3';
  ctx.font = '700 28px "Trebuchet MS", sans-serif';
  ctx.fillText(subtitle, 256, 138);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class WildernessExpansion {
  public group = new THREE.Group();
  public lakeFishingSpot!: THREE.Object3D;
  public archeryTargets: ArcheryTargetSpot[] = [];

  private lakeZone = new THREE.Group();
  private westForestZone = new THREE.Group();
  private eastMeadowZone = new THREE.Group();
  private placeholderBirches = new THREE.Group();
  private birchCoords: [number, number, number][] = [];
  private forestGlbSpots: [number, number, number][] = [];

  private lakeWaterMat?: THREE.ShaderMaterial;
  private fishList: SwimmingFish[] = [];
  private fireFlames: THREE.Mesh[] = [];
  private campfireLight?: THREE.PointLight;

  constructor(
    scene: THREE.Scene,
    private textures: FarmTextures,
    private collisions: CollisionSystem,
    private sky: SkyAndLighting
  ) {
    this.group.add(this.lakeZone, this.westForestZone, this.eastMeadowZone);
    this.buildEmeraldLake();
    this.buildWestPineForest();
    this.buildEastBirchMeadow();
    this.buildTrailSigns();

    scene.add(this.group);
  }

  private buildEmeraldLake(): void {
    const cx = WORLD_CONFIG.lakeCenter.x;
    const cz = WORLD_CONFIG.lakeCenter.z;
    const rx = WORLD_CONFIG.lakeRadiusX;
    const rz = WORLD_CONFIG.lakeRadiusZ;

    const lakeGroup = new THREE.Group();
    lakeGroup.position.set(cx, 0, cz);

    // Sandy-pebble shoreline collar
    const rim = new THREE.Mesh(
      new THREE.CylinderGeometry(1, 1.05, 0.08, 40),
      new THREE.MeshStandardMaterial({ color: '#dcc59b', roughness: 0.92 })
    );
    rim.scale.set(rx + 1.4, 1, rz + 1.2);
    rim.position.y = 0.02;
    rim.receiveShadow = true;
    lakeGroup.add(rim);

    // Custom Animated Emerald-Cerulean Lake Water Shader
    this.lakeWaterMat = new THREE.ShaderMaterial({
      transparent: true,
      uniforms: {
        uTime: { value: 0 },
        uShallowColor: { value: new THREE.Color('#6fe0d8') },
        uDeepColor: { value: new THREE.Color('#2782b8') },
        uFoamColor: { value: new THREE.Color('#e8fbff') },
        uSunColor: { value: new THREE.Color('#fff6d2') },
        uNightFactor: { value: 0 },
      },
      vertexShader: /* glsl */ `
        uniform float uTime;
        varying vec2 vLocalPos;
        void main() {
          vLocalPos = position.xz;
          vec3 p = position;
          p.y += sin(position.x * 11.0 + uTime * 1.6) * 0.018 + cos(position.z * 9.5 - uTime * 1.3) * 0.018;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        uniform vec3 uShallowColor;
        uniform vec3 uDeepColor;
        uniform vec3 uFoamColor;
        uniform vec3 uSunColor;
        uniform float uNightFactor;
        varying vec2 vLocalPos;
        void main() {
          float dist = length(vLocalPos);
          vec3 water = mix(uDeepColor, uShallowColor, smoothstep(0.15, 0.96, dist));
          float w1 = sin(vLocalPos.x * 24.0 + uTime * 1.3 + sin(vLocalPos.y * 14.0 + uTime * 0.6));
          float w2 = cos(vLocalPos.y * 20.0 - uTime * 1.1 + cos(vLocalPos.x * 16.0 - uTime * 0.8));
          float caustic = smoothstep(0.6, 0.98, (w1 + w2) * 0.5 + 0.5);
          water = mix(water, uFoamColor, caustic * 0.2 * (1.0 - uNightFactor * 0.55));
          float foamWave = 0.02 * sin(atan(vLocalPos.y, vLocalPos.x) * 14.0 + uTime * 1.7);
          float shoreFoam = smoothstep(0.86 + foamWave, 0.97 + foamWave, dist);
          water = mix(water, uFoamColor, shoreFoam * 0.65);
          float sp1 = sin(vLocalPos.x * 42.0 + uTime * 2.4) * cos(vLocalPos.y * 38.0 - uTime * 2.0);
          float sp2 = sin((vLocalPos.x + vLocalPos.y) * 32.0 - uTime * 1.7);
          float glint = pow(max(0.0, sp1 * sp2), 5.0);
          water += uSunColor * glint * mix(1.3, 0.55, uNightFactor);
          water = mix(water, water * vec3(0.45, 0.56, 0.86), uNightFactor * 0.72);
          gl_FragColor = vec4(water, 0.91);
        }
      `,
    });

    const waterGeo = new THREE.CircleGeometry(1, 48);
    waterGeo.rotateX(-Math.PI / 2);
    const water = new THREE.Mesh(waterGeo, this.lakeWaterMat);
    water.scale.set(rx, 1, rz);
    water.position.y = 0.145;
    lakeGroup.add(water);

    // River boulders & cattails framing Emerald Lake (leaving wide opening at South for the pier)
    const rockColors = ['#bdb7ac', '#aba59a', '#cfc9be', '#9f9a90'];
    const rockGeo = new THREE.DodecahedronGeometry(0.95, 1);
    for (let i = 0; i < 36; i++) {
      const a = (i / 36) * Math.PI * 2;
      if (Math.sin(a) > 0.84 && Math.abs(Math.cos(a)) < 0.32) continue;
      const mat = new THREE.MeshStandardMaterial({
        color: rockColors[i % rockColors.length],
        roughness: 0.88,
        flatShading: true,
      });
      const rock = new THREE.Mesh(rockGeo, mat);
      const s = 0.75 + (i % 4) * 0.35;
      rock.scale.set(s * 1.3, s * 0.65, s);
      rock.position.set(Math.cos(a) * (rx + 0.5), 0.25, Math.sin(a) * (rz + 0.45));
      rock.rotation.set(i * 0.2, i * 0.9, 0);
      rock.castShadow = true;
      rock.receiveShadow = true;
      lakeGroup.add(rock);
    }

    // Lush lakeside cattail reed clusters
    const stemMat = new THREE.MeshStandardMaterial({ color: '#5f9c4b', roughness: 0.86 });
    const headMat = new THREE.MeshStandardMaterial({ color: '#78462d', roughness: 0.9 });
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2 + 0.15;
      if (Math.sin(a) > 0.82 && Math.abs(Math.cos(a)) < 0.28) continue;
      for (let k = 0; k < 3; k++) {
        const px = Math.cos(a + k * 0.04) * (rx - 0.5);
        const pz = Math.sin(a + k * 0.04) * (rz - 0.4);
        const h = 1.2 + (k % 2) * 0.35;
        const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.045, h, 5), stemMat);
        stalk.position.set(px, h * 0.5, pz);
        lakeGroup.add(stalk);
        const head = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.24, 4, 6), headMat);
        head.position.set(px, h - 0.16, pz);
        lakeGroup.add(head);
      }
    }

    // Long Grand Wooden Fishing Pier extending out from the South shore!
    const woodMat = new THREE.MeshStandardMaterial({
      map: this.textures.woodLight,
      bumpMap: this.textures.woodBump,
      bumpScale: 0.03,
      roughness: 0.85,
    });
    const postMat = new THREE.MeshStandardMaterial({ map: this.textures.woodWarm, roughness: 0.88 });
    const ropeMat = new THREE.MeshStandardMaterial({ color: '#d6b67c', roughness: 0.92 });
    const pier = new THREE.Group();
    pier.position.set(0, 0, rz + 1.2);
    for (let p = 0; p < 16; p++) {
      const plank = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.16, 0.42), woodMat);
      plank.position.set(0, 0.38, 1.0 - p * 0.48);
      plank.castShadow = true;
      plank.receiveShadow = true;
      pier.add(plank);
    }
    for (const sx of [-1.32, 1.32]) {
      for (const sz of [0.8, -1.8, -4.4, -6.2]) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 1.12, 8), postMat);
        post.position.set(sx, 0.46, sz);
        post.castShadow = true;
        pier.add(post);
        if (sz < -5) {
          for (let r = 0; r < 3; r++) {
            const coil = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.024, 6, 12), ropeMat);
            coil.rotation.x = Math.PI / 2;
            coil.position.set(sx, 0.68 + r * 0.045, sz);
            pier.add(coil);
          }
        }
      }
    }
    // Warm Pier Lantern at end of the Fishing Pier
    const ironMat = new THREE.MeshStandardMaterial({ color: '#453e3a', roughness: 0.5, metalness: 0.45 });
    const glassMat = new THREE.MeshStandardMaterial({
      color: '#fff4c9',
      emissive: '#ffbe55',
      emissiveIntensity: 0.25,
      roughness: 0.22,
    });
    this.sky.registerGlowMaterial(glassMat);
    const lPost = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.085, 2.2, 7), postMat);
    lPost.position.set(1.32, 1.48, -6.2);
    pier.add(lPost);
    const lGlass = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.1, 0.3, 6), glassMat);
    lGlass.position.set(1.32, 2.48, -6.2);
    pier.add(lGlass);
    const lCap = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.16, 6), ironMat);
    lCap.position.set(1.32, 2.7, -6.2);
    pier.add(lCap);
    const lHalo = this.sky.createLanternHaloSprite(2.5);
    lHalo.position.set(1.32, 2.48, -6.2);
    pier.add(lHalo);

    // Bait crate on the pier
    const baitCrate = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.52, 0.52), postMat);
    baitCrate.position.set(-1.0, 0.7, -4.8);
    baitCrate.rotation.y = 0.25;
    baitCrate.castShadow = true;
    pier.add(baitCrate);

    lakeGroup.add(pier);

    // Invisible fishing interaction zone right at the end of the Emerald Lake pier!
    const fishHit = new THREE.Mesh(
      new THREE.BoxGeometry(4.4, 1.8, 4.4),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    fishHit.position.set(0, 0.65, rz - 5.4);
    lakeGroup.add(fishHit);
    this.lakeFishingSpot = fishHit;

    // 7 Visible 3D Swimming Fish circling gracefully beneath the clear lake surface!
    const fishPalette = ['#f7b84b', '#63bca8', '#ee8373', '#ff7fa8', '#f5c768', '#75ccba', '#f08c7a'];
    for (let i = 0; i < 7; i++) {
      const fg = new THREE.Group();
      const bodyMat = new THREE.MeshStandardMaterial({ color: fishPalette[i % fishPalette.length], roughness: 0.35 });
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), bodyMat);
      body.scale.set(1.85, 0.72, 0.52);
      fg.add(body);
      const tail = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.28, 5), bodyMat);
      tail.rotation.z = Math.PI / 2;
      tail.position.x = -0.36;
      fg.add(tail);
      lakeGroup.add(fg);
      this.fishList.push({
        group: fg,
        tail,
        centerX: ((i % 3) - 1) * 7.2,
        centerZ: -1.5 + (i % 2) * 3.8,
        rx: 3.2 + (i % 3) * 1.4,
        rz: 2.2 + (i % 2) * 1.3,
        angle: i * 1.1,
        speed: 0.45 + (i % 3) * 0.14,
      });
    }

    this.lakeZone.add(lakeGroup);

    // Colliders keeping player out of deep lake water while letting them walk all the way onto the pier!
    this.collisions.addCircle(cx - 12.0, cz, 8.8);
    this.collisions.addCircle(cx + 12.0, cz, 8.8);
    this.collisions.addCircle(cx, cz - 4.8, 7.6);
    this.collisions.addCircle(cx - 5.5, cz + 2.2, 4.0);
    this.collisions.addCircle(cx + 5.5, cz + 2.2, 4.0);
  }

  private buildWestPineForest(): void {
    const trunkMat = new THREE.MeshStandardMaterial({ map: this.textures.woodWarm, roughness: 0.94 });
    const pineMats = [
      new THREE.MeshStandardMaterial({ color: '#4d8f4b', roughness: 0.9, flatShading: true }),
      new THREE.MeshStandardMaterial({ color: '#5c9f52', roughness: 0.9, flatShading: true }),
      new THREE.MeshStandardMaterial({ color: '#3f7d47', roughness: 0.9, flatShading: true }),
    ];
    const rockMat = new THREE.MeshStandardMaterial({ color: '#9c988f', roughness: 0.9, flatShading: true });
    const mossMat = new THREE.MeshStandardMaterial({ color: '#6ba854', roughness: 0.9 });

    const addPine = (x: number, z: number, s: number, idx: number) => {
      const p = new THREE.Group();
      p.position.set(x, 0, z);
      const nearFarm = Math.abs(x) < 48 && Math.abs(z) < 30;
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22 * s, 0.34 * s, 2.2 * s, 7), trunkMat);
      trunk.position.y = 1.1 * s;
      trunk.castShadow = nearFarm;
      p.add(trunk);
      const mat = pineMats[idx % pineMats.length];
      for (let tier = 0; tier < 3; tier++) {
        const cone = new THREE.Mesh(
          new THREE.ConeGeometry((1.65 - tier * 0.36) * s, (2.4 - tier * 0.22) * s, 8),
          mat
        );
        cone.position.y = (2.6 + tier * 1.45) * s;
        cone.castShadow = nearFarm;
        cone.receiveShadow = nearFarm;
        p.add(cone);
      }
      this.westForestZone.add(p);
      this.collisions.addCircle(x, z, 0.55 * s);
    };

    // Deterministic forest layout with natural hunting clearings
    const pineSpots: [number, number, number][] = [
      [-33, -10, 1.3], [-36, -18, 1.5], [-40, -26, 1.4], [-34, -36, 1.55], [-42, -44, 1.6],
      [-48, -32, 1.35], [-54, -22, 1.5], [-58, -38, 1.65], [-66, -28, 1.5], [-72, -16, 1.6],
      [-64, -10, 1.45], [-56, -8, 1.3], [-48, -14, 1.4], [-38, 10, 1.35], [-34, 20, 1.5],
      [-42, 26, 1.45], [-50, 18, 1.55], [-56, 8, 1.4], [-64, 4, 1.5], [-72, 12, 1.65],
      [-66, 22, 1.5], [-58, 30, 1.55], [-46, 36, 1.45], [-32, 34, 1.35], [-74, -4, 1.55],
      [-68, -42, 1.6], [-52, -48, 1.5], [-38, -54, 1.45], [-34, -44, 1.35], [-44, 12, 1.25],
      [-62, -20, 1.35], [-70, 2, 1.4], [-52, 4, 1.3], [-60, 16, 1.45], [-36, 4, 1.2],
    ];
    pineSpots.forEach(([x, z, s], i) => addPine(x, z, s, i));

    // Mossy forest boulders
    const boulders: [number, number, number][] = [
      [-39, -6, 1.2], [-51, -18, 1.5], [-62, -4, 1.4], [-47, 15, 1.3], [-58, 22, 1.6], [-41, -30, 1.4],
    ];
    for (const [bx, bz, bs] of boulders) {
      const b = new THREE.Mesh(new THREE.DodecahedronGeometry(bs, 1), rockMat);
      b.scale.set(1.25, 0.72, 1.0);
      b.position.set(bx, bs * 0.35, bz);
      b.castShadow = true;
      b.receiveShadow = true;
      this.westForestZone.add(b);
      const cap = new THREE.Mesh(new THREE.SphereGeometry(bs * 0.85, 7, 5), mossMat);
      cap.scale.set(1.1, 0.32, 0.9);
      cap.position.set(bx, bs * 0.7, bz);
      this.westForestZone.add(cap);
      this.collisions.addCircle(bx, bz, bs * 0.95);
    }

    // Cozy Hunter's Campfire Clearing at (-44, 0, -2) with tent, stone fire ring, log bench & archery target!
    const camp = new THREE.Group();
    camp.position.set(-44, 0, -2);

    // Stone fire ring + glowing embers + animated flames
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const st = new THREE.Mesh(new THREE.DodecahedronGeometry(0.18, 0), rockMat);
      st.position.set(Math.cos(a) * 0.72, 0.14, Math.sin(a) * 0.72);
      camp.add(st);
    }
    const logMat = new THREE.MeshStandardMaterial({ color: '#4d3221', roughness: 0.95 });
    for (let l = 0; l < 3; l++) {
      const log = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, 0.9, 6), logMat);
      log.rotation.z = Math.PI / 2;
      log.rotation.y = (l / 3) * Math.PI;
      log.position.y = 0.12;
      camp.add(log);
    }
    const flameColors = ['#ff8533', '#ffc247', '#fff099'];
    for (let f = 0; f < 3; f++) {
      const flame = new THREE.Mesh(
        new THREE.ConeGeometry(0.22 - f * 0.04, 0.65 - f * 0.12, 6),
        new THREE.MeshBasicMaterial({ color: flameColors[f] })
      );
      flame.position.set((f - 1) * 0.1, 0.36 + f * 0.06, (f % 2 - 0.5) * 0.08);
      camp.add(flame);
      this.fireFlames.push(flame);
    }
    this.campfireLight = new THREE.PointLight('#ff9b42', 1.8, 18, 1.5);
    this.campfireLight.position.set(0, 1.2, 0);
    camp.add(this.campfireLight);

    // Sitting log bench
    const benchLog = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.26, 2.2, 8), trunkMat);
    benchLog.rotation.z = Math.PI / 2;
    benchLog.position.set(0, 0.24, 2.1);
    benchLog.castShadow = true;
    camp.add(benchLog);

    // Canvas A-frame Hunter's Tent
    const tentCanvas = new THREE.MeshStandardMaterial({ color: '#e8d6b3', roughness: 0.88, side: THREE.DoubleSide });
    const tentGroup = new THREE.Group();
    tentGroup.position.set(-3.4, 0, -2.6);
    tentGroup.rotation.y = 0.65;
    for (const side of [-1, 1]) {
      const flap = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.08, 3.0), tentCanvas);
      flap.position.set(side * 0.85, 1.05, 0);
      flap.rotation.z = -side * 0.78;
      flap.castShadow = true;
      tentGroup.add(flap);
    }
    camp.add(tentGroup);
    this.collisions.addCircle(-47.4, -4.6, 1.7);
    this.collisions.addCircle(-44, -2, 0.95);

    this.westForestZone.add(camp);

    // Archery Practice Target at Forest Camp (cleanly clear of boulders!)
    this.addArcheryTarget(-36.5, -1.2, 0.55, this.westForestZone);
  }

  private buildEastBirchMeadow(): void {
    const birchTrunk = new THREE.MeshStandardMaterial({ color: '#f0ece1', roughness: 0.85 });
    const leafMats = [
      new THREE.MeshStandardMaterial({ color: '#8ac959', roughness: 0.85, flatShading: true }),
      new THREE.MeshStandardMaterial({ color: '#e6be53', roughness: 0.85, flatShading: true }),
      new THREE.MeshStandardMaterial({ color: '#73b856', roughness: 0.85, flatShading: true }),
    ];
    const puffGeo = new THREE.IcosahedronGeometry(1, 1);

    const birchSpots: [number, number, number][] = [
      [33, -10, 1.25], [38, -20, 1.4], [46, -28, 1.35], [56, -34, 1.5], [66, -26, 1.45],
      [72, -14, 1.5], [64, -4, 1.35], [54, 4, 1.4], [44, 10, 1.3], [36, 18, 1.4],
      [48, 22, 1.5], [60, 18, 1.45], [70, 10, 1.55], [66, 26, 1.4], [52, 32, 1.45],
      [38, 32, 1.35], [40, -38, 1.5], [32, -46, 1.45], [52, -46, 1.55], [68, -40, 1.5],
      [74, -2, 1.4], [58, -18, 1.3], [46, -6, 1.25], [34, 12, 1.2], [72, 22, 1.45],
    ];
    this.eastMeadowZone.add(this.placeholderBirches);
    birchSpots.forEach(([x, z, s], idx) => {
      this.birchCoords.push([x, z, s]);
      const t = new THREE.Group();
      t.position.set(x, 0, z);
      const nearFarm = Math.abs(x) < 48 && Math.abs(z) < 30;
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18 * s, 0.28 * s, 2.8 * s, 7), birchTrunk);
      trunk.position.y = 1.4 * s;
      trunk.castShadow = nearFarm;
      t.add(trunk);
      const lm = leafMats[idx % leafMats.length];
      for (const [px, py, pz, pr] of [[0, 3.4, 0, 1.5], [-0.85, 2.9, 0.4, 1.05], [0.85, 2.95, -0.35, 1.1]] as [number, number, number, number][]) {
        const puff = new THREE.Mesh(puffGeo, lm);
        puff.position.set(px * s, py * s, pz * s);
        puff.scale.set(pr * s, pr * 0.86 * s, pr * s);
        puff.castShadow = nearFarm;
        t.add(puff);
      }
      this.placeholderBirches.add(t);
      this.collisions.addCircle(x, z, 0.48 * s);
    });

    // Ancient Mossy Standing Stone Ring in the East Highland Meadow at (52, 0, -14)
    const stoneMat = new THREE.MeshStandardMaterial({
      map: this.textures.stoneWall,
      bumpMap: this.textures.stoneBump,
      bumpScale: 0.06,
      roughness: 0.92,
    });
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const sx = 52 + Math.cos(a) * 4.5;
      const sz = -14 + Math.sin(a) * 4.5;
      const h = 2.6 + (i % 3) * 0.7;
      const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.95, h, 0.65), stoneMat);
      pillar.position.set(sx, h * 0.5, sz);
      pillar.rotation.y = -a + Math.PI / 2;
      pillar.rotation.z = ((i % 2) - 0.5) * 0.08;
      pillar.castShadow = true;
      pillar.receiveShadow = true;
      this.eastMeadowZone.add(pillar);
      this.collisions.addCircle(sx, sz, 0.65);
    }

    // Second Archery Practice Target in the East Birch Meadow
    this.addArcheryTarget(37.5, 2.5, -0.55, this.eastMeadowZone);
  }

  private addArcheryTarget(x: number, z: number, rotY: number, parent: THREE.Group): void {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = rotY;
    const woodMat = new THREE.MeshStandardMaterial({ map: this.textures.woodWarm, roughness: 0.88 });
    // Tripod legs
    for (const [lx, lz, rx, rz] of [[-0.45, 0.1, 0.1, -0.18], [0.45, 0.1, 0.1, 0.18], [0, -0.45, -0.35, 0]] as [number, number, number, number][]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 1.75, 6), woodMat);
      leg.position.set(lx, 0.82, lz);
      leg.rotation.set(rx, 0, rz);
      leg.castShadow = true;
      g.add(leg);
    }
    const hayDisc = new THREE.Mesh(
      new THREE.CylinderGeometry(0.62, 0.62, 0.2, 16),
      new THREE.MeshStandardMaterial({ map: this.textures.hayGolden, roughness: 0.92 })
    );
    hayDisc.rotation.x = Math.PI / 2;
    hayDisc.position.set(0, 1.32, 0.08);
    hayDisc.castShadow = true;
    g.add(hayDisc);

    // Painted bullseye rings (front & back)
    const rings: [number, string, number][] = [
      [0.54, '#fff8eb', 0.19],
      [0.39, '#4ea8de', 0.2],
      [0.24, '#e95a4b', 0.21],
      [0.11, '#ffd449', 0.22],
    ];
    for (const [rad, col, zOff] of rings) {
      const r = new THREE.Mesh(new THREE.CircleGeometry(rad, 16), new THREE.MeshStandardMaterial({ color: col, roughness: 0.6 }));
      r.position.set(0, 1.32, zOff);
      g.add(r);
    }

    parent.add(g);
    this.collisions.addCircle(x, z, 0.65);
    this.archeryTargets.push({
      center: new THREE.Vector3(x, 1.32, z),
      radius: 0.72,
      mesh: g,
    });
  }

  private buildTrailSigns(): void {
    const postMat = new THREE.MeshStandardMaterial({ map: this.textures.woodWarm, roughness: 0.88 });
    const addSign = (x: number, z: number, rotY: number, title: string, sub: string) => {
      const g = new THREE.Group();
      g.position.set(x, 0, z);
      g.rotation.y = rotY;
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 1.85, 7), postMat);
      post.position.y = 0.92;
      post.castShadow = true;
      g.add(post);
      const faceMat = new THREE.MeshStandardMaterial({ map: makeTrailSignTexture(title, sub), roughness: 0.78 });
      const board = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.72, 0.1), [
        postMat, postMat, postMat, postMat, faceMat, faceMat,
      ]);
      board.position.y = 1.65;
      board.castShadow = true;
      g.add(board);
      this.group.add(g);
    };

    addSign(-25.5, 4.6, Math.PI / 2 - 0.18, 'PINE FOREST', 'West Trail • Hunting');
    addSign(25.5, 4.6, -Math.PI / 2 + 0.18, 'BIRCH MEADOW', 'East Trail • Hunting');
    addSign(-2.4, -31.0, 0.2, 'EMERALD LAKE', 'North Pier • Fishing');
  }

  /**
   * Upgrades expanded wilderness zones with high-detail Quaternius CC0 .glb trees, mossy rocks, logs & props!
   */
  public mountLoadedModels(): void {
    const foliagePredicate = (name: string, color: THREE.Color) => {
      const lower = name.toLowerCase();
      if (lower.includes('bark') || lower.includes('wood') || lower.includes('trunk')) return false;
      if (lower.includes('leaf') || lower.includes('leaves') || lower.includes('green') || lower.includes('foliage')) return true;
      return color.g > color.r * 1.05 && color.g > color.b * 0.95;
    };

    // 1. Replace ALL 25 East Birch Meadow placeholder trees with sculpted Quaternius Birch & Oak GLB trees!
    let mountedBirches = 0;
    const meadowTints = ['#86c95b', '#ecc454', '#6fb858', '#f2b84b'];
    const meadowKeys: ModelKey[] = ['tree_birch_1', 'tree_common_1', 'tree_birch_1', 'tree_common_2'];
    this.birchCoords.forEach(([x, z, s], idx) => {
      const nearFarm = Math.abs(x) < 48 && Math.abs(z) < 30;
      const tree = modelLibrary.cloneGrounded(meadowKeys[idx % meadowKeys.length], 5.6 * s, {
        tintColor: meadowTints[idx % meadowTints.length],
        tintPredicate: foliagePredicate,
        castShadow: nearFarm,
        receiveShadow: nearFarm,
      });
      if (tree) {
        tree.position.set(x, 0, z);
        tree.rotation.y = (x * 1.3 + z * 2.1) % (Math.PI * 2);
        this.eastMeadowZone.add(tree);
        mountedBirches++;
      }
    });
    if (mountedBirches > 0) {
      this.placeholderBirches.visible = false;
    }

    // 2. Enrich Pine Forest with sculpted Quaternius broadleaf trees, mossy stumps, logs, berry bushes & mushrooms!
    const forestAccents: [ModelKey, number, number, number, number][] = [
      ['tree_common_3', -31, -4, 6.4, 0.5],
      ['tree_common_2', -45, -18, 7.2, 1.4],
      ['tree_common_1', -55, 2, 6.8, 2.2],
      ['tree_common_3', -40, 16, 6.6, 0.9],
      ['stump_moss', -41.5, -0.5, 0.85, 0.6],
      ['log_moss', -46.2, 1.4, 0.78, 1.1],
      ['rock_moss_1', -49.0, -5.5, 1.45, 0.8],
      ['rock_moss_2', -35.0, -12.0, 1.35, 2.1],
      ['bush_berries', -42.5, -5.2, 1.15, 0.3],
      ['bush_berries', -37.2, 4.2, 1.05, 1.5],
      ['mushroom_red', -41.0, 0.2, 0.48, 0.4],
      ['mushroom_red', -45.5, 2.1, 0.45, 1.7],
      ['log_stack', -42.2, -3.4, 0.85, 0.9],
    ];
    for (const [key, x, z, h, rot] of forestAccents) {
      const m = modelLibrary.cloneGrounded(key, h, {
        tintColor: key.startsWith('tree_') ? '#4c944c' : undefined,
        tintPredicate: key.startsWith('tree_') ? foliagePredicate : undefined,
        castShadow: Math.abs(x) < 48,
      });
      if (m) {
        m.position.set(x, 0, z);
        m.rotation.y = rot;
        this.westForestZone.add(m);
      }
    }

    // 3. Enrich Emerald Lake shoreline with weeping willow trees, moored wooden rowboat & mossy lakeside boulders!
    const lakeProps: [ModelKey, number, number, number, number, number][] = [
      ['tree_willow_1', -25.5, -45.0, 7.4, 0.4, 0],
      ['tree_willow_1', 14.5, -46.0, 7.2, 1.9, 0],
      ['boat', -1.8, -44.2, 0.82, -2.1, 0.1],
      ['barrel', -7.1, -43.2, 0.95, 0.4, 0.46],
      ['rock_moss_1', -18.0, -42.5, 1.35, 0.7, 0],
      ['rock_moss_2', 8.5, -43.0, 1.25, 1.8, 0],
      ['bush_berries', -11.5, -40.2, 1.05, 0.6, 0],
      ['bush_berries', 1.2, -40.4, 1.05, 2.0, 0],
    ];
    for (const [key, x, z, h, rot, y] of lakeProps) {
      const m = modelLibrary.cloneGrounded(key, h, {
        tintColor: key === 'tree_willow_1' ? '#6cc268' : undefined,
        tintPredicate: key === 'tree_willow_1' ? foliagePredicate : undefined,
        castShadow: false,
      });
      if (m) {
        m.position.set(x, y, z);
        m.rotation.y = rot;
        this.lakeZone.add(m);
      }
    }
    void this.forestGlbSpots;
  }

  public update(dt: number, elapsed: number, nightFactor: number, playerPos: THREE.Vector3): void {
    // Spatial Zone Culling: only render & animate wilderness zones near the player's region!
    const showLake = playerPos.z < 12;
    const showWest = playerPos.x < 12;
    const showEast = playerPos.x > -12;

    this.lakeZone.visible = showLake;
    this.westForestZone.visible = showWest;
    this.eastMeadowZone.visible = showEast;

    if (showLake) {
      if (this.lakeWaterMat) {
        this.lakeWaterMat.uniforms.uTime.value = elapsed;
        this.lakeWaterMat.uniforms.uNightFactor.value = nightFactor;
        this.lakeWaterMat.uniforms.uSunColor.value.copy(this.sky.currentSunColor);
      }

      // Swimming fish in Emerald Lake
      for (const f of this.fishList) {
        f.angle += f.speed * dt;
        const x = f.centerX + Math.cos(f.angle) * f.rx;
        const z = f.centerZ + Math.sin(f.angle) * f.rz;
        const dx = -Math.sin(f.angle) * f.rx;
        const dz = Math.cos(f.angle) * f.rz;
        f.group.position.set(x, 0.08 + Math.sin(elapsed * 2.5 + f.angle) * 0.02, z);
        f.group.rotation.y = Math.atan2(-dz, dx);
        f.tail.rotation.y = Math.sin(elapsed * 11.0 + f.angle) * 0.42;
      }
    }

    // Crackling hunter campfire flicker (only when West Forest is active)
    if (showWest) {
      for (let i = 0; i < this.fireFlames.length; i++) {
        const fl = this.fireFlames[i];
        fl.scale.y = 0.85 + Math.sin(elapsed * 14 + i * 2.1) * 0.24;
        fl.scale.x = 0.9 + Math.cos(elapsed * 11 + i) * 0.12;
      }
      if (this.campfireLight) {
        this.campfireLight.intensity = 1.6 + nightFactor * 2.2 + Math.sin(elapsed * 13) * 0.35;
      }
    } else if (this.campfireLight) {
      this.campfireLight.intensity = 0;
    }
  }
}
