import * as THREE from 'three';
import { FarmTextures } from '../assets/textures';
import { CollisionSystem } from './CollisionSystem';

interface Honeybee {
  group: THREE.Group;
  leftWing: THREE.Mesh;
  rightWing: THREE.Mesh;
  center: THREE.Vector3;
  phase: number;
  radius: number;
  speed: number;
}

export class CozyDetails {
  public group = new THREE.Group();
  private bees: Honeybee[] = [];
  private waterTroughSurface?: THREE.Mesh;

  constructor(
    scene: THREE.Scene,
    private textures: FarmTextures,
    private collisions: CollisionSystem
  ) {
    this.buildGardenTrellisArbor();
    this.buildWheelbarrow();
    this.buildBeeApiary();
    this.buildStoneWaterTrough();
    this.buildHillsideGroves();

    scene.add(this.group);
  }

  /**
   * Sculpted curved wooden lattice trellis arbor framing the Vegetable Garden entrance!
   */
  private buildGardenTrellisArbor(): void {
    const arbor = new THREE.Group();
    arbor.position.set(-4.35, 0, 7.0);
    arbor.rotation.y = Math.PI / 2;

    const woodMat = new THREE.MeshStandardMaterial({
      map: this.textures.woodWarm,
      bumpMap: this.textures.woodBump,
      bumpScale: 0.035,
      roughness: 0.85,
    });
    const trimMat = new THREE.MeshStandardMaterial({
      map: this.textures.woodLight,
      roughness: 0.84,
    });
    const leafMat = new THREE.MeshStandardMaterial({ color: '#5fa851', roughness: 0.8 });
    const bloomColors = ['#ff9ab8', '#ffe378', '#c6a8ff', '#fff9eb'];
    const bloomMats = bloomColors.map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.52 }));

    const halfW = 1.68;
    const postH = 2.42;

    // 4 trellis posts (2 front, 2 back) with side lattice crossbars
    for (const sx of [-halfW, halfW]) {
      for (const sz of [-0.36, 0.36]) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.14, postH, 0.14), woodMat);
        post.position.set(sx, postH * 0.5, sz);
        post.castShadow = true;
        post.receiveShadow = true;
        arbor.add(post);
      }
      // Side lattice rungs between the front/back posts
      for (let y = 0.45; y <= 2.2; y += 0.36) {
        const rung = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.78), trimMat);
        rung.position.set(sx, y, 0);
        arbor.add(rung);
      }
      // Keep tiny post footprint out of player collision path while leaving wide 3.1m walkway!
      this.collisions.addCircle(-4.35, 7.0 + sx, 0.22);
    }

    // Smooth curved overhead wooden arch ribs (TubeGeometry!)
    for (const sz of [-0.36, 0.36]) {
      const archCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-halfW, postH, sz),
        new THREE.Vector3(-halfW * 0.65, postH + 0.65, sz),
        new THREE.Vector3(0, postH + 0.88, sz),
        new THREE.Vector3(halfW * 0.65, postH + 0.65, sz),
        new THREE.Vector3(halfW, postH, sz),
      ]);
      const archTube = new THREE.Mesh(new THREE.TubeGeometry(archCurve, 18, 0.075, 7, false), woodMat);
      archTube.castShadow = true;
      arbor.add(archTube);
    }

    // Overhead pergola cross-slats + lush climbing pastel flowers!
    const archSamples = 9;
    for (let i = 0; i <= archSamples; i++) {
      const t = i / archSamples;
      const x = THREE.MathUtils.lerp(-halfW, halfW, t);
      const y = postH + Math.sin(t * Math.PI) * 0.88;
      const slat = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.07, 0.96), trimMat);
      slat.position.set(x, y + 0.04, 0);
      slat.rotation.z = Math.cos(t * Math.PI) * 0.48;
      slat.castShadow = true;
      arbor.add(slat);

      // Vine foliage & pastel flowers draped along the arbor
      for (let k = 0; k < 2; k++) {
        const leaf = new THREE.Mesh(new THREE.DodecahedronGeometry(0.14, 0), leafMat);
        leaf.scale.set(1.2, 0.65, 1.0);
        leaf.position.set(x + (k - 0.5) * 0.14, y + 0.11, (k - 0.5) * 0.65);
        arbor.add(leaf);
        if ((i + k) % 2 === 0) {
          const bloom = new THREE.Mesh(
            new THREE.DodecahedronGeometry(0.085, 0),
            bloomMats[(i + k) % bloomMats.length]
          );
          bloom.position.set(x + (k - 0.5) * 0.12, y + 0.19, (k - 0.5) * 0.72);
          arbor.add(bloom);
        }
      }
    }

    this.group.add(arbor);
  }

  /**
   * Handcrafted rustic wooden wheelbarrow filled with rich soil & mini garden shovel!
   */
  private buildWheelbarrow(): void {
    const wb = new THREE.Group();
    wb.position.set(-11.8, 0, 1.0);
    wb.rotation.y = 0.22;

    const woodMat = new THREE.MeshStandardMaterial({
      map: this.textures.woodLight,
      bumpMap: this.textures.woodBump,
      bumpScale: 0.03,
      roughness: 0.84,
    });
    const darkWoodMat = new THREE.MeshStandardMaterial({ map: this.textures.woodWarm, roughness: 0.86 });
    const ironMat = new THREE.MeshStandardMaterial({ color: '#535c66', metalness: 0.48, roughness: 0.44 });
    const soilMat = new THREE.MeshStandardMaterial({ map: this.textures.soilWet, roughness: 0.92 });

    // Spoked front wheel with iron rim!
    const wheel = new THREE.Group();
    wheel.position.set(0.74, 0.29, 0);
    const tire = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.045, 8, 18), ironMat);
    tire.castShadow = true;
    wheel.add(tire);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.035, 7, 16), darkWoodMat);
    wheel.add(rim);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.12, 8), ironMat);
    hub.rotation.x = Math.PI / 2;
    wheel.add(hub);
    for (let s = 0; s < 6; s++) {
      const spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.44, 6), darkWoodMat);
      spoke.rotation.z = (s / 6) * Math.PI;
      wheel.add(spoke);
    }
    wb.add(wheel);

    // Two long ergonomic shafts + rear support legs
    for (const sz of [-0.26, 0.26]) {
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.032, 1.72, 7), darkWoodMat);
      shaft.rotation.z = Math.PI / 2 - 0.14;
      shaft.position.set(-0.08, 0.42, sz);
      shaft.castShadow = true;
      wb.add(shaft);

      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.44, 0.06), ironMat);
      leg.position.set(-0.34, 0.22, sz);
      leg.rotation.z = -0.14;
      leg.castShadow = true;
      wb.add(leg);
    }

    // Slanted wooden hopper tray
    const tray = new THREE.Group();
    tray.position.set(0.06, 0.58, 0);
    tray.rotation.z = -0.08;

    const floor = new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.06, 0.56), woodMat);
    floor.castShadow = true;
    tray.add(floor);

    for (const side of [-1, 1]) {
      const sideWall = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.34, 0.055), woodMat);
      sideWall.position.set(0, 0.18, side * 0.3);
      sideWall.rotation.x = side * 0.2;
      sideWall.castShadow = true;
      tray.add(sideWall);
    }
    const frontWall = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.36, 0.64), woodMat);
    frontWall.position.set(0.45, 0.19, 0);
    frontWall.rotation.z = -0.25;
    frontWall.castShadow = true;
    tray.add(frontWall);
    const backWall = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.32, 0.62), woodMat);
    backWall.position.set(-0.42, 0.17, 0);
    backWall.rotation.z = 0.18;
    backWall.castShadow = true;
    tray.add(backWall);

    // Rich dark compost soil mound inside the wheelbarrow
    const mound = new THREE.Mesh(new THREE.SphereGeometry(0.36, 10, 8), soilMat);
    mound.scale.set(1.15, 0.52, 0.85);
    mound.position.set(0.02, 0.22, 0);
    tray.add(mound);

    // Mini hand trowel resting in the soil
    const tHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.025, 0.28, 7), darkWoodMat);
    tHandle.position.set(-0.14, 0.42, 0.08);
    tHandle.rotation.z = 0.65;
    tray.add(tHandle);
    const tBlade = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.18, 6), ironMat);
    tBlade.position.set(-0.02, 0.32, 0.08);
    tBlade.rotation.z = -Math.PI / 2 - 0.65;
    tray.add(tBlade);

    wb.add(tray);
    this.group.add(wb);
    this.collisions.addCircle(-11.8, 1.0, 0.72);
  }

  /**
   * Charming Pastel Wooden Beehive Apiary with gently orbiting striped honeybees!
   */
  private buildBeeApiary(): void {
    const apiary = new THREE.Group();
    apiary.position.set(-17.0, 0, 12.6);
    apiary.rotation.y = 0.55;

    const standWood = new THREE.MeshStandardMaterial({ map: this.textures.woodWarm, roughness: 0.86 });
    const hiveCream = new THREE.MeshStandardMaterial({ color: '#fff3d4', roughness: 0.8 });
    const hiveHoney = new THREE.MeshStandardMaterial({ color: '#f7d88b', roughness: 0.8 });
    const roofMat = new THREE.MeshStandardMaterial({ map: this.textures.roofTerracotta, roughness: 0.82 });
    const darkSlot = new THREE.MeshStandardMaterial({ color: '#452c1b', roughness: 0.9 });

    const placeHive = (ox: number, oz: number, rotY: number, tintAlt: boolean) => {
      const h = new THREE.Group();
      h.position.set(ox, 0, oz);
      h.rotation.y = rotY;

      // 4 sturdy wooden legs
      for (const lx of [-0.34, 0.34]) {
        for (const lz of [-0.34, 0.34]) {
          const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.35, 0.08), standWood);
          leg.position.set(lx, 0.175, lz);
          h.add(leg);
        }
      }
      const baseBoard = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.07, 0.96), standWood);
      baseBoard.position.set(0, 0.38, 0.05);
      baseBoard.castShadow = true;
      h.add(baseBoard);

      // Two stacked Langstroth wooden hive boxes with grip cleats & entrance slit
      const boxMat = tintAlt ? hiveHoney : hiveCream;
      for (const by of [0.64, 1.06]) {
        const box = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.4, 0.76), boxMat);
        box.position.y = by;
        box.castShadow = true;
        box.receiveShadow = true;
        h.add(box);
        const rim = new THREE.Mesh(new THREE.BoxGeometry(0.81, 0.05, 0.81), standWood);
        rim.position.y = by - 0.19;
        h.add(rim);
      }

      const slot = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.07, 0.05), darkSlot);
      slot.position.set(0, 0.46, 0.38);
      h.add(slot);

      // Sloped peaked miniature roof
      for (const side of [-1, 1]) {
        const slope = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.07, 0.94), roofMat);
        slope.position.set(side * 0.24, 1.44, 0);
        slope.rotation.z = -side * 0.42;
        slope.castShadow = true;
        h.add(slope);
      }
      apiary.add(h);
    };

    placeHive(-0.62, 0, 0.12, false);
    placeHive(0.65, 0.15, -0.18, true);

    this.group.add(apiary);
    this.collisions.addRotatedBox(-17.0, 12.6, 2.3, 1.25, 0.55);

    // 6 Adorable tiny striped honeybees buzzing gently near the hives!
    const yellowMat = new THREE.MeshStandardMaterial({ color: '#ffd84d', roughness: 0.5 });
    const stripeMat = new THREE.MeshStandardMaterial({ color: '#3b291d', roughness: 0.6 });
    const wingMat = new THREE.MeshBasicMaterial({
      color: '#ffffff',
      transparent: true,
      opacity: 0.75,
      side: THREE.DoubleSide,
    });

    for (let i = 0; i < 6; i++) {
      const bee = new THREE.Group();
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.045, 7, 6), yellowMat);
      body.scale.set(1.35, 0.92, 0.92);
      bee.add(body);
      const stripe = new THREE.Mesh(new THREE.CylinderGeometry(0.044, 0.044, 0.028, 7), stripeMat);
      stripe.rotation.z = Math.PI / 2;
      bee.add(stripe);

      const wingGeo = new THREE.CircleGeometry(0.036, 6);
      const leftWing = new THREE.Mesh(wingGeo, wingMat);
      leftWing.position.set(0, 0.04, 0.032);
      const rightWing = new THREE.Mesh(wingGeo, wingMat);
      rightWing.position.set(0, 0.04, -0.032);
      bee.add(leftWing, rightWing);

      this.group.add(bee);
      this.bees.push({
        group: bee,
        leftWing,
        rightWing,
        center: new THREE.Vector3(-16.8 + (i % 2) * 0.9, 1.15 + (i % 3) * 0.28, 12.6),
        phase: i * 1.15,
        radius: 0.85 + (i % 3) * 0.35,
        speed: 1.65 + (i % 2) * 0.45,
      });
    }
  }

  /**
   * Carved Stone Animal Watering Trough with clear shimmering water beside the hay manger!
   */
  private buildStoneWaterTrough(): void {
    const trough = new THREE.Group();
    trough.position.set(18.6, 0, 0.85);
    trough.rotation.y = -0.15;

    const stoneMat = new THREE.MeshStandardMaterial({
      map: this.textures.stoneWall,
      bumpMap: this.textures.stoneBump,
      bumpScale: 0.055,
      roughness: 0.9,
    });
    const waterMat = new THREE.MeshStandardMaterial({
      map: this.textures.waterRipple,
      color: '#7eddf8',
      roughness: 0.12,
      metalness: 0.1,
    });

    // Hollow stone trough walls + stone feet
    for (const fx of [-0.72, 0.72]) {
      const foot = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.22, 0.82), stoneMat);
      foot.position.set(fx, 0.11, 0);
      foot.castShadow = true;
      trough.add(foot);
    }
    const bottom = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.16, 0.92), stoneMat);
    bottom.position.y = 0.28;
    bottom.castShadow = true;
    trough.add(bottom);
    for (const sz of [-0.4, 0.4]) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.48, 0.14), stoneMat);
      wall.position.set(0, 0.54, sz);
      wall.castShadow = true;
      wall.receiveShadow = true;
      trough.add(wall);
    }
    for (const sx of [-0.88, 0.88]) {
      const endWall = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.48, 0.8), stoneMat);
      endWall.position.set(sx, 0.54, 0);
      endWall.castShadow = true;
      trough.add(endWall);
    }

    const water = new THREE.Mesh(new THREE.PlaneGeometry(1.62, 0.68), waterMat);
    water.rotation.x = -Math.PI / 2;
    water.position.y = 0.68;
    trough.add(water);
    this.waterTroughSurface = water;

    this.group.add(trough);
    this.collisions.addBox(18.6, 0.85, 2.05, 1.05);
  }

  /**
   * Distant hillside stylized pine & cypress silhouettes adding rich pastoral valley depth!
   */
  private buildHillsideGroves(): void {
    const trunkMat = new THREE.MeshStandardMaterial({ color: '#7a5233', roughness: 0.94 });
    const pineMats = [
      new THREE.MeshStandardMaterial({ color: '#5c9c56', roughness: 0.92, flatShading: true }),
      new THREE.MeshStandardMaterial({ color: '#69ab5d', roughness: 0.92, flatShading: true }),
      new THREE.MeshStandardMaterial({ color: '#4f8c54', roughness: 0.92, flatShading: true }),
    ];

    const addPine = (x: number, y: number, z: number, scale: number, idx: number) => {
      const p = new THREE.Group();
      p.position.set(x, y, z);
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18 * scale, 0.28 * scale, 1.4 * scale, 6), trunkMat);
      trunk.position.y = 0.65 * scale;
      p.add(trunk);

      const mat = pineMats[idx % pineMats.length];
      for (let tier = 0; tier < 3; tier++) {
        const cone = new THREE.Mesh(
          new THREE.ConeGeometry((1.35 - tier * 0.3) * scale, (1.9 - tier * 0.2) * scale, 7),
          mat
        );
        cone.position.y = (1.85 + tier * 1.05) * scale;
        p.add(cone);
      }
      this.group.add(p);
    };

    // Place scenic pine clusters cleanly around the outer valley ring (radius 44..52, grounded at y=0)
    const groveAngles = [0.22, 0.42, 0.95, 1.18, 1.85, 2.15, 2.75, 3.45, 3.92, 4.48, 5.15, 5.68];
    groveAngles.forEach((baseA, gIdx) => {
      for (let k = 0; k < 3; k++) {
        const a = baseA + (k - 1) * 0.085;
        const r = 43 + (k % 2) * 5.5 + (gIdx % 2) * 2.5;
        const s = 1.45 + ((gIdx + k) % 3) * 0.35;
        addPine(Math.cos(a) * r, -0.05, Math.sin(a) * r, s, gIdx + k);
      }
    });
  }

  public update(elapsed: number, nightFactor: number): void {
    const showBees = nightFactor < 0.55;
    for (const b of this.bees) {
      b.group.visible = showBees;
      if (!showBees) continue;
      const t = elapsed * b.speed + b.phase;
      b.group.position.set(
        b.center.x + Math.cos(t) * b.radius,
        b.center.y + Math.sin(t * 2.3) * 0.22,
        b.center.z + Math.sin(t * 1.4) * (b.radius * 0.72)
      );
      b.group.rotation.y = -t;
      const flap = Math.sin(elapsed * 42 + b.phase) * 0.7;
      b.leftWing.rotation.x = flap;
      b.rightWing.rotation.x = -flap;
    }

    if (this.waterTroughSurface) {
      this.waterTroughSurface.position.y = 0.675 + Math.sin(elapsed * 2.1) * 0.008;
    }
  }
}
