import * as THREE from 'three';
import { getFarmTextures, FarmTextures } from '../assets/textures';
import { WORLD_CONFIG } from '../config/farmConfig';
import { CollisionSystem } from './CollisionSystem';
import { SkyAndLighting } from './SkyAndLighting';
import { ParticleSystem } from '../effects/ParticleSystem';
import { TreeSpot } from './WorldEnhancer';

interface Butterfly {
  group: THREE.Group;
  leftWing: THREE.Mesh;
  rightWing: THREE.Mesh;
  center: THREE.Vector3;
  phase: number;
  radius: number;
  speed: number;
}

interface PondDuck {
  group: THREE.Group;
  angle: number;
  radiusX: number;
  radiusZ: number;
  speed: number;
}

export class FarmWorld {
  public group = new THREE.Group();
  public waterBarrelMesh!: THREE.Object3D;
  public pondRefillMesh!: THREE.Object3D;
  public supplyCrateMesh!: THREE.Object3D;
  public marketStandMesh!: THREE.Object3D;
  public farmhouseGroup!: THREE.Group;
  public farmhouseDoorPivot!: THREE.Group;
  public barnGroup!: THREE.Group;
  public barnDoorLeftPivot!: THREE.Group;
  public barnDoorRightPivot!: THREE.Group;
  public placeholderTreesGroup = new THREE.Group();
  public treeSpots: TreeSpot[] = [];

  private textures: FarmTextures;
  private windmillBlades!: THREE.Group;
  private barnWeathervane?: THREE.Group;
  private pondWaterMesh!: THREE.Mesh;
  private pondWaterMat?: THREE.ShaderMaterial;
  private flowerClusters: { group: THREE.Object3D; phase: number; baseRotZ: number }[] = [];
  private butterflies: Butterfly[] = [];
  private pondDucks: PondDuck[] = [];
  private chimneyTip = new THREE.Vector3();
  private smokeTimer = 0;

  constructor(
    scene: THREE.Scene,
    private collisions: CollisionSystem,
    private sky: SkyAndLighting,
    private particles: ParticleSystem
  ) {
    this.textures = getFarmTextures();
    this.collisions.setWorldBounds(
      WORLD_CONFIG.worldBounds.minX,
      WORLD_CONFIG.worldBounds.maxX,
      WORLD_CONFIG.worldBounds.minZ,
      WORLD_CONFIG.worldBounds.maxZ
    );

    this.buildGroundAndPaths();
    this.buildDistantHills();
    this.buildEntranceGate();
    this.buildFarmhouse();
    this.buildBarn();
    this.buildWindmill();
    this.buildDuckPond();
    this.buildFencesAndSigns();
    this.buildGardenProps();
    this.buildPastureProps();
    this.buildHayBales();
    this.buildTreesAndBushes();
    this.buildFlowersAndGrass();
    this.buildLanterns();
    this.buildButterflies();

    scene.add(this.group);
  }

  private buildGroundAndPaths(): void {
    // Unified single-mesh meadow + cobblestone path + mud wallow terrain!
    // Blending everything in one MeshStandardMaterial guarantees ZERO coplanar Z-fighting / floor flickering!
    const groundGeo = new THREE.CircleGeometry(260, 84);
    const groundMat = new THREE.MeshStandardMaterial({
      map: this.textures.grass,
      roughness: 0.94,
      metalness: 0.0,
    });

    const pebbleTex = this.textures.pebblePath;
    const maskTex = this.textures.worldPathMask;
    groundMat.onBeforeCompile = (shader) => {
      shader.uniforms.uPebbleMap = { value: pebbleTex };
      shader.uniforms.uPathMask = { value: maskTex };

      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          `#include <common>
           varying vec3 vTerrainWorldPos;`
        )
        .replace(
          '#include <worldpos_vertex>',
          `#include <worldpos_vertex>
           vTerrainWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;`
        );

      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
           uniform sampler2D uPebbleMap;
           uniform sampler2D uPathMask;
           varying vec3 vTerrainWorldPos;`
        )
        .replace(
          '#include <map_fragment>',
          `#include <map_fragment>
           vec2 maskUv = (vTerrainWorldPos.xz + 42.0) / 84.0;
           if (maskUv.x > 0.0 && maskUv.x < 1.0 && maskUv.y > 0.0 && maskUv.y < 1.0) {
             // CanvasTexture has flipY=true by default, so invert Y to match world +Z downward on canvas
             vec4 splat = texture2D(uPathMask, vec2(maskUv.x, 1.0 - maskUv.y));
             vec3 sandyEdge = vec3(0.64, 0.50, 0.31);
             vec3 mudColor = vec3(0.32, 0.19, 0.11);
             vec3 pebble = texture2D(uPebbleMap, vTerrainWorldPos.xz * 0.28).rgb;

             // Soft organic feathered grass -> sandy shoulder -> crisp cobblestone path
             diffuseColor.rgb = mix(diffuseColor.rgb, sandyEdge, smoothstep(0.08, 0.78, splat.g) * 0.55);
             diffuseColor.rgb = mix(diffuseColor.rgb, pebble, smoothstep(0.18, 0.72, splat.r));
             diffuseColor.rgb = mix(diffuseColor.rgb, mudColor, smoothstep(0.15, 0.75, splat.b) * 0.88);
           }`
        );
    };

    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.group.add(ground);

    // Subtle soft pastel grassy knoll under the windmill (compact & clear of the Red Barn!)
    const knollGeo = new THREE.CylinderGeometry(4.8, 7.5, 1.1, 20);
    const knollMat = new THREE.MeshStandardMaterial({
      color: '#91cb6c',
      roughness: 0.95,
    });
    const knoll = new THREE.Mesh(knollGeo, knollMat);
    knoll.position.set(15.5, 0.45, -21.0);
    knoll.receiveShadow = true;
    this.group.add(knoll);
  }

  private buildDistantHills(): void {
    // Inner lush green rolling hills
    const hillGeo = new THREE.SphereGeometry(1, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.52);
    const innerColors = ['#88c469', '#7eb963', '#96cf74', '#81bc68'];
    const outerColors = ['#7eb786', '#89bea0', '#96c4b5', '#87ba9d'];

    const hillCount = 26;
    for (let i = 0; i < hillCount; i++) {
      const angle = (i / hillCount) * Math.PI * 2 + (i % 2) * 0.08;
      const dist = 108 + (i % 3) * 16;
      const rx = 24 + (i % 4) * 7.5;
      const ry = 10.5 + (i % 5) * 3.5;
      const rz = 20 + ((i + 1) % 3) * 6.5;
      const mat = new THREE.MeshStandardMaterial({
        color: innerColors[i % innerColors.length],
        roughness: 0.96,
        flatShading: true,
      });
      const hill = new THREE.Mesh(hillGeo, mat);
      hill.scale.set(rx, ry, rz);
      hill.position.set(Math.cos(angle) * dist, -0.6, Math.sin(angle) * dist);
      hill.rotation.y = angle;
      hill.receiveShadow = true;
      this.group.add(hill);
    }

    // Outer storybook misty distant ridge ring
    const farCount = 22;
    for (let i = 0; i < farCount; i++) {
      const angle = (i / farCount) * Math.PI * 2 + 0.18;
      const dist = 158 + (i % 3) * 20;
      const rx = 34 + (i % 3) * 10;
      const ry = 20 + (i % 4) * 7;
      const rz = 30 + (i % 2) * 8;
      const mat = new THREE.MeshStandardMaterial({
        color: outerColors[i % outerColors.length],
        roughness: 0.98,
        flatShading: true,
      });
      const hill = new THREE.Mesh(hillGeo, mat);
      hill.scale.set(rx, ry, rz);
      hill.position.set(Math.cos(angle) * dist, -1.2, Math.sin(angle) * dist);
      this.group.add(hill);
    }
  }

  private buildEntranceGate(): void {
    const gate = new THREE.Group();
    gate.position.set(0, 0, 18.5);

    const postMat = new THREE.MeshStandardMaterial({ map: this.textures.woodWarm, roughness: 0.88 });
    const trimMat = new THREE.MeshStandardMaterial({ map: this.textures.woodLight, roughness: 0.85 });
    const capMat = new THREE.MeshStandardMaterial({ color: '#d97656', roughness: 0.8 });

    // Two chunky warm wooden arch posts with carved stone plinth bases!
    const plinthMat = new THREE.MeshStandardMaterial({
      map: this.textures.stoneWall,
      bumpMap: this.textures.stoneBump,
      bumpScale: 0.05,
      roughness: 0.9,
    });
    for (const side of [-1, 1]) {
      const plinth = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.42, 0.42, 8), plinthMat);
      plinth.position.set(side * 2.55, 0.21, 0);
      plinth.castShadow = true;
      plinth.receiveShadow = true;
      gate.add(plinth);

      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.28, 3.8, 10), postMat);
      post.position.set(side * 2.55, 1.9, 0);
      post.castShadow = true;
      post.receiveShadow = true;
      gate.add(post);

      // Decorative rounded cap
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.32, 10, 8), capMat);
      cap.scale.set(1, 0.72, 1);
      cap.position.set(side * 2.55, 3.88, 0);
      cap.castShadow = true;
      gate.add(cap);

      // Angled timber brace
      const brace = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.9, 0.16), trimMat);
      brace.position.set(side * 2.15, 3.18, 0);
      brace.rotation.z = side * 0.75;
      brace.castShadow = true;
      gate.add(brace);

      // Cute wooden flower planter box beside each gate post
      const box = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.55, 0.65), trimMat);
      box.position.set(side * 3.35, 0.28, 0.35);
      box.castShadow = true;
      box.receiveShadow = true;
      gate.add(box);
      const dirt = new THREE.Mesh(
        new THREE.BoxGeometry(0.95, 0.1, 0.5),
        new THREE.MeshStandardMaterial({ color: '#7a5233', roughness: 0.95 })
      );
      dirt.position.set(side * 3.35, 0.53, 0.35);
      gate.add(dirt);
      this.addMiniatureFlowers(gate, side * 3.35, 0.58, 0.35, 6);

      this.collisions.addCircle(side * 2.55, 18.5, 0.42);
    }

    // Top crossbeam
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 5.7, 10), postMat);
    beam.rotation.z = Math.PI / 2;
    beam.position.set(0, 3.58, 0);
    beam.castShadow = true;
    gate.add(beam);

    // Little peaked awning roof over the sign
    const roofL = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.12, 0.68), capMat);
    roofL.position.set(0, 3.86, 0.22);
    roofL.rotation.x = 0.35;
    roofL.castShadow = true;
    gate.add(roofL);
    const roofR = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.12, 0.68), capMat);
    roofR.position.set(0, 3.86, -0.22);
    roofR.rotation.x = -0.35;
    roofR.castShadow = true;
    gate.add(roofR);

    // Hanging painted wooden Sunnybrook Farm sign with wrought-iron chains
    const chainMat = new THREE.MeshStandardMaterial({ color: '#4d4743', roughness: 0.45, metalness: 0.55 });
    for (const sx of [-1.1, 1.1]) {
      const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.36, 6), chainMat);
      chain.position.set(sx, 3.45, 0);
      gate.add(chain);
    }

    const signGeo = new THREE.BoxGeometry(2.9, 1.05, 0.12);
    const signFaceMat = new THREE.MeshStandardMaterial({ map: this.textures.signSunnybrook, roughness: 0.8 });
    const signEdgeMat = new THREE.MeshStandardMaterial({ color: '#9c6334', roughness: 0.85 });
    const sign = new THREE.Mesh(signGeo, [
      signEdgeMat,
      signEdgeMat,
      signEdgeMat,
      signEdgeMat,
      signFaceMat,
      signFaceMat,
    ]);
    sign.position.set(0, 3.04, 0);
    sign.castShadow = true;
    gate.add(sign);

    // Climbing pastel rose vines twining up both entrance gate posts!
    const vineMat = new THREE.MeshStandardMaterial({ color: '#589c4d', roughness: 0.8 });
    const roseMat = new THREE.MeshStandardMaterial({ color: '#ff8fb3', roughness: 0.5 });
    const roseCreamMat = new THREE.MeshStandardMaterial({ color: '#ffe599', roughness: 0.5 });
    for (const side of [-1, 1]) {
      for (let v = 0; v < 12; v++) {
        const t = v / 11;
        const ang = t * Math.PI * 3.4 + (side > 0 ? 0 : Math.PI);
        const y = 0.55 + t * 2.85;
        const lx = side * 2.55 + Math.cos(ang) * 0.28;
        const lz = Math.sin(ang) * 0.28;
        const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.11, 6, 5), vineMat);
        leaf.scale.set(1.2, 0.65, 0.9);
        leaf.position.set(lx, y, lz);
        gate.add(leaf);
        if (v % 2 === 1) {
          const rose = new THREE.Mesh(new THREE.DodecahedronGeometry(0.085, 0), v % 4 === 1 ? roseMat : roseCreamMat);
          rose.position.set(lx * 1.01, y + 0.04, lz + (lz >= 0 ? 0.05 : -0.05));
          gate.add(rose);
        }
      }
    }

    this.group.add(gate);
  }

  private buildFarmhouse(): void {
    const house = new THREE.Group();
    house.position.set(-18.5, 0, -6.5);
    house.rotation.y = 0.35;

    const stoneMat = new THREE.MeshStandardMaterial({
      map: this.textures.stoneWall,
      bumpMap: this.textures.stoneBump,
      bumpScale: 0.055,
      roughness: 0.92,
    });
    const plasterMat = new THREE.MeshStandardMaterial({ map: this.textures.plasterCream, roughness: 0.88 });
    const woodMat = new THREE.MeshStandardMaterial({
      map: this.textures.woodWarm,
      bumpMap: this.textures.woodBump,
      bumpScale: 0.035,
      roughness: 0.85,
    });
    const woodLightMat = new THREE.MeshStandardMaterial({
      map: this.textures.woodLight,
      bumpMap: this.textures.woodBump,
      bumpScale: 0.03,
      roughness: 0.85,
    });
    const roofMat = new THREE.MeshStandardMaterial({
      map: this.textures.roofTerracotta,
      bumpMap: this.textures.roofBump,
      bumpScale: 0.06,
      roughness: 0.8,
    });
    const shutterMat = new THREE.MeshStandardMaterial({ color: '#78b594', roughness: 0.8 });
    const windowGlowMat = new THREE.MeshStandardMaterial({
      color: '#ffeaa7',
      emissive: '#ffbd59',
      emissiveIntensity: 0.15,
      roughness: 0.25,
    });
    this.sky.registerGlowMaterial(windowGlowMat);

    // Walk-in Interior Wooden Plank Floor + Hollow Exterior Walls with Front Doorway Cutout!
    const interiorFloor = new THREE.Mesh(new THREE.BoxGeometry(8.2, 0.14, 6.6), woodLightMat);
    interiorFloor.position.set(0, 0.07, 0);
    interiorFloor.receiveShadow = true;
    house.add(interiorFloor);

    // Exterior stone skirting (3 solid sides + split front flanking the doorway)
    const addHouseWall = (lx: number, ly: number, lz: number, w: number, h: number, d: number, mat: THREE.Material) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      m.position.set(lx, ly, lz);
      m.castShadow = true;
      m.receiveShadow = true;
      house.add(m);
    };
    // Back (-X), North (-Z), South (+Z) walls
    addHouseWall(-4.08, 2.45, 0, 0.28, 4.9, 6.8, plasterMat);
    addHouseWall(0, 2.45, -3.28, 8.4, 4.9, 0.28, plasterMat);
    addHouseWall(0, 2.45, 3.28, 8.4, 4.9, 0.28, plasterMat);
    // Front (+X) wall split cleanly around doorway (z in [-0.74, +0.74], height 2.62)
    addHouseWall(4.08, 2.45, -2.07, 0.28, 4.9, 2.66, plasterMat);
    addHouseWall(4.08, 2.45, 2.07, 0.28, 4.9, 2.66, plasterMat);
    addHouseWall(4.08, 3.76, 0, 0.28, 2.28, 1.56, plasterMat);

    // Exterior stone foundation skirting along sides & back
    addHouseWall(-4.26, 0.34, 0, 0.22, 0.68, 7.1, stoneMat);
    addHouseWall(0, 0.34, -3.46, 8.6, 0.68, 0.22, stoneMat);
    addHouseWall(0, 0.34, 3.46, 8.6, 0.68, 0.22, stoneMat);

    // Interior ceiling & exposed timber rafters!
    const ceiling = new THREE.Mesh(new THREE.BoxGeometry(8.2, 0.14, 6.6), woodLightMat);
    ceiling.position.set(0, 4.68, 0);
    house.add(ceiling);
    for (let rx = -3.0; rx <= 3.1; rx += 1.5) {
      const rafter = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.22, 6.5), woodMat);
      rafter.position.set(rx, 4.54, 0);
      house.add(rafter);
    }

    // Half-timber corner posts, alternating stone corner quoins & cross beams
    for (const sx of [-4.22, 4.22]) {
      for (const sz of [-3.42, 3.42]) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.28, 4.3, 0.28), woodMat);
        post.position.set(sx, 2.9, sz);
        post.castShadow = true;
        house.add(post);
        // Sculpted alternating stone corner quoins for storybook cottage craftsmanship!
        for (let q = 0; q < 5; q++) {
          const longX = q % 2 === 0;
          const quoin = new THREE.Mesh(
            new THREE.BoxGeometry(longX ? 0.56 : 0.34, 0.44, longX ? 0.34 : 0.56),
            stoneMat
          );
          quoin.position.set(sx * 0.99, 1.15 + q * 0.72, sz * 0.99);
          quoin.castShadow = true;
          house.add(quoin);
        }
      }
    }
    const trimBelt = new THREE.Mesh(new THREE.BoxGeometry(8.62, 0.22, 7.02), woodMat);
    trimBelt.position.y = 4.95;
    house.add(trimBelt);

    // Storybook pitched gable roof (2 sloping planes + triangular gable walls)
    const gableShape = new THREE.Shape();
    gableShape.moveTo(-4.2, 0);
    gableShape.lineTo(4.2, 0);
    gableShape.lineTo(0, 3.2);
    gableShape.closePath();
    const gableGeo = new THREE.ExtrudeGeometry(gableShape, { depth: 6.8, bevelEnabled: false });
    gableGeo.center();
    const gable = new THREE.Mesh(gableGeo, plasterMat);
    gable.position.set(0, 6.58, 0);
    gable.castShadow = true;
    house.add(gable);

    // Sloped shingled roof slabs
    const roofSlopeGeo = new THREE.BoxGeometry(5.9, 0.28, 8.2);
    const leftRoof = new THREE.Mesh(roofSlopeGeo, roofMat);
    leftRoof.position.set(-2.35, 6.45, 0);
    leftRoof.rotation.z = 0.65;
    leftRoof.castShadow = true;
    leftRoof.receiveShadow = true;
    house.add(leftRoof);

    const rightRoof = new THREE.Mesh(roofSlopeGeo, roofMat);
    rightRoof.position.set(2.35, 6.45, 0);
    rightRoof.rotation.z = -0.65;
    rightRoof.castShadow = true;
    rightRoof.receiveShadow = true;
    house.add(rightRoof);

    // Roof ridge beam + carved storybook apex finial + charming front pitched dormer window!
    const ridge = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 8.3, 8), woodMat);
    ridge.rotation.x = Math.PI / 2;
    ridge.position.set(0, 8.26, 0);
    house.add(ridge);
    for (const fz of [-4.12, 4.12]) {
      const finial = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.56, 7), woodMat);
      finial.position.set(0, 8.58, fz);
      house.add(finial);
    }

    // Cute Storybook Roof Dormer facing +X toward the garden!
    const dormer = new THREE.Group();
    dormer.position.set(2.35, 6.2, 0);
    const dormerBox = new THREE.Mesh(new THREE.BoxGeometry(1.75, 1.35, 1.65), plasterMat);
    dormerBox.castShadow = true;
    dormer.add(dormerBox);
    const dRoofL = new THREE.Mesh(new THREE.BoxGeometry(2.05, 0.14, 1.25), roofMat);
    dRoofL.position.set(0.05, 0.92, -0.45);
    dRoofL.rotation.x = -0.58;
    dRoofL.castShadow = true;
    dormer.add(dRoofL);
    const dRoofR = new THREE.Mesh(new THREE.BoxGeometry(2.05, 0.14, 1.25), roofMat);
    dRoofR.position.set(0.05, 0.92, 0.45);
    dRoofR.rotation.x = 0.58;
    dRoofR.castShadow = true;
    dormer.add(dRoofR);
    const dPane = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.85, 0.95), windowGlowMat);
    dPane.position.set(0.86, 0.05, 0);
    dormer.add(dPane);
    const dMullV = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.92, 0.07), woodMat);
    dMullV.position.set(0.87, 0.05, 0);
    dormer.add(dMullV);
    const dMullH = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.07, 1.0), woodMat);
    dMullH.position.set(0.87, 0.05, 0);
    dormer.add(dMullH);
    house.add(dormer);

    // Cozy Front Porch (low smooth walk-in deck facing +X toward farm plaza)
    const porchFloor = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.22, 6.6), woodLightMat);
    porchFloor.position.set(5.2, 0.11, 0);
    porchFloor.castShadow = true;
    porchFloor.receiveShadow = true;
    house.add(porchFloor);

    // Front porch threshold step
    const step1 = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.14, 2.2), stoneMat);
    step1.position.set(6.55, 0.07, 0);
    step1.receiveShadow = true;
    house.add(step1);

    // Porch roof awning
    const porchRoof = new THREE.Mesh(new THREE.BoxGeometry(2.9, 0.18, 6.9), roofMat);
    porchRoof.position.set(5.35, 3.65, 0);
    porchRoof.rotation.z = -0.26;
    porchRoof.castShadow = true;
    house.add(porchRoof);

    // Porch columns, angled timber knee-braces, rails & turned baluster spindles!
    for (const pz of [-2.95, -1.25, 1.25, 2.95]) {
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 2.9, 8), woodMat);
      col.position.set(6.15, 2.05, pz);
      col.castShadow = true;
      house.add(col);
      // Angled carpentry knee-brace supporting the porch eaves
      const brace = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.62, 0.1), woodMat);
      brace.position.set(5.92, 3.12, pz);
      brace.rotation.z = -0.78;
      house.add(brace);
    }
    for (const segZ of [-2.1, 2.1]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.12, 1.75), woodLightMat);
      rail.position.set(6.15, 1.48, segZ);
      house.add(rail);
      for (let sp = -0.65; sp <= 0.66; sp += 0.32) {
        const spindle = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.036, 0.82, 6), woodLightMat);
        spindle.position.set(6.15, 1.05, segZ + sp);
        house.add(spindle);
      }
    }

    // Cozy Porch Wooden Bench with pastel cushion + Woven Welcome Doormat + Hanging Flower Baskets!
    const bench = new THREE.Group();
    bench.position.set(4.85, 0.46, -2.0);
    bench.add(new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.1, 1.55), woodMat));
    const benchBack = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.58, 1.55), woodMat);
    benchBack.position.set(-0.28, 0.32, 0);
    bench.add(benchBack);
    const cushion = new THREE.Mesh(
      new THREE.BoxGeometry(0.52, 0.12, 1.38),
      new THREE.MeshStandardMaterial({ color: '#f29cb0', roughness: 0.85 })
    );
    cushion.position.set(0.02, 0.11, 0);
    bench.add(cushion);
    house.add(bench);

    const doormat = new THREE.Mesh(
      new THREE.BoxGeometry(0.75, 0.03, 1.2),
      new THREE.MeshStandardMaterial({ color: '#c48f56', roughness: 0.96 })
    );
    doormat.position.set(5.05, 0.23, 0);
    house.add(doormat);

    // Hanging terracotta flower baskets under porch eaves
    const potMat = new THREE.MeshStandardMaterial({ color: '#cc6e4e', roughness: 0.82 });
    for (const hz of [-2.1, 2.1]) {
      const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.55, 5), woodMat);
      rope.position.set(6.1, 3.02, hz);
      house.add(rope);
      const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.15, 0.24, 10), potMat);
      pot.position.set(6.1, 2.66, hz);
      house.add(pot);
      this.addMiniatureFlowers(house, 6.1, 2.74, hz, 4);
    }

    // Interactive Hinged Front Door (swings open so player can walk right inside the Farmhouse!)
    const doorIronMat = new THREE.MeshStandardMaterial({ color: '#47403b', metalness: 0.45, roughness: 0.5 });
    // Fixed doorway jamb frame
    for (const jz of [-0.74, 0.74]) {
      const jamb = new THREE.Mesh(new THREE.BoxGeometry(0.32, 2.66, 0.12), woodLightMat);
      jamb.position.set(4.12, 1.33, jz);
      house.add(jamb);
    }
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.14, 1.62), woodLightMat);
    lintel.position.set(4.12, 2.64, 0);
    house.add(lintel);

    const doorPivot = new THREE.Group();
    doorPivot.position.set(4.18, 0.14, -0.68);
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.14, 2.46, 1.36), woodMat);
    door.position.set(0, 1.23, 0.68);
    door.castShadow = true;
    doorPivot.add(door);

    const doorWindow = new THREE.Mesh(new THREE.CircleGeometry(0.22, 14), windowGlowMat);
    doorWindow.rotation.y = Math.PI / 2;
    doorWindow.position.set(0.08, 1.92, 0.68);
    doorPivot.add(doorWindow);
    const doorWinRing = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.035, 7, 16), woodLightMat);
    doorWinRing.rotation.y = Math.PI / 2;
    doorWinRing.position.set(0.085, 1.92, 0.68);
    doorPivot.add(doorWinRing);
    const doorWinMullV = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.44, 0.032), woodLightMat);
    doorWinMullV.position.set(0.09, 1.92, 0.68);
    doorPivot.add(doorWinMullV);
    const doorWinMullH = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.032, 0.44), woodLightMat);
    doorWinMullH.position.set(0.09, 1.92, 0.68);
    doorPivot.add(doorWinMullH);

    // Wrought-iron strap hinges
    for (const hy of [0.68, 1.96]) {
      const hinge = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.09, 0.42), doorIronMat);
      hinge.position.set(0.08, hy, 0.28);
      doorPivot.add(hinge);
    }
    // Cozy pastel wreath on the front door!
    const wreath = new THREE.Mesh(
      new THREE.TorusGeometry(0.24, 0.06, 7, 14),
      new THREE.MeshStandardMaterial({ color: '#5fa652', roughness: 0.8 })
    );
    wreath.rotation.y = Math.PI / 2;
    wreath.position.set(0.09, 1.38, 0.68);
    doorPivot.add(wreath);
    for (let b = 0; b < 5; b++) {
      const a = (b / 5) * Math.PI * 2;
      const berry = new THREE.Mesh(
        new THREE.SphereGeometry(0.045, 6, 5),
        new THREE.MeshStandardMaterial({ color: b % 2 === 0 ? '#ff8fb3' : '#ffe066', roughness: 0.5 })
      );
      berry.position.set(0.125, 1.38 + Math.sin(a) * 0.24, 0.68 + Math.cos(a) * 0.24);
      doorPivot.add(berry);
    }
    const knob = new THREE.Mesh(
      new THREE.SphereGeometry(0.075, 8, 8),
      new THREE.MeshStandardMaterial({ color: '#f2c96b', metalness: 0.4, roughness: 0.3 })
    );
    knob.position.set(0.09, 1.28, 1.16);
    doorPivot.add(knob);
    const innerKnob = knob.clone();
    innerKnob.position.set(-0.09, 1.28, 1.16);
    doorPivot.add(innerKnob);

    house.add(doorPivot);
    this.farmhouseDoorPivot = doorPivot;
    this.farmhouseGroup = house;

    // Helper for cozy shuttered glowing windows + window flower boxes
    const addWindow = (x: number, y: number, z: number, rotY: number) => {
      const wg = new THREE.Group();
      wg.position.set(x, y, z);
      wg.rotation.y = rotY;

      const frame = new THREE.Mesh(new THREE.BoxGeometry(1.36, 1.36, 0.14), woodMat);
      wg.add(frame);
      const pane = new THREE.Mesh(new THREE.BoxGeometry(1.08, 1.08, 0.16), windowGlowMat);
      wg.add(pane);
      // Window mullions
      wg.add(new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.12, 0.2), woodMat));
      wg.add(new THREE.Mesh(new THREE.BoxGeometry(1.12, 0.08, 0.2), woodMat));
      // Pastel sage shutters
      for (const s of [-0.88, 0.88]) {
        const sh = new THREE.Mesh(new THREE.BoxGeometry(0.42, 1.32, 0.09), shutterMat);
        sh.position.set(s, 0, 0.04);
        wg.add(sh);
      }
      // Window flower planter
      const sill = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.26, 0.38), woodLightMat);
      sill.position.set(0, -0.78, 0.18);
      wg.add(sill);
      this.addMiniatureFlowers(wg, 0, -0.62, 0.2, 5);
      house.add(wg);
    };

    // Front (+X), South (+Z), North (-Z) windows + Attic round window
    addWindow(4.24, 2.55, -2.05, Math.PI / 2);
    addWindow(4.24, 2.55, 2.05, Math.PI / 2);
    addWindow(-1.8, 2.55, 3.44, 0);
    addWindow(1.8, 2.55, 3.44, 0);
    addWindow(0, 2.55, -3.44, Math.PI);

    // Round storybook attic window on +Z gable
    const roundFrame = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.09, 8, 18), woodMat);
    roundFrame.position.set(0, 6.2, 3.44);
    house.add(roundFrame);
    const roundGlass = new THREE.Mesh(new THREE.CircleGeometry(0.58, 16), windowGlowMat);
    roundGlass.position.set(0, 6.2, 3.45);
    house.add(roundGlass);

    // Stone chimney with stepped crown & terracotta clay chimney pots!
    const chimney = new THREE.Mesh(new THREE.BoxGeometry(1.15, 3.6, 1.15), stoneMat);
    chimney.position.set(-1.9, 7.6, -1.6);
    chimney.castShadow = true;
    house.add(chimney);
    const chimneyCap = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.24, 1.42), stoneMat);
    chimneyCap.position.set(-1.9, 9.48, -1.6);
    house.add(chimneyCap);
    for (const czOff of [-0.26, 0.26]) {
      const clayPot = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.42, 8), roofMat);
      clayPot.position.set(-1.9, 9.78, -1.6 + czOff);
      house.add(clayPot);
    }

    // Hanging wrought-iron porch lantern + warm glow halo sprite
    const porchLampChain = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.34, 6), doorIronMat);
    porchLampChain.position.set(5.45, 3.42, 0);
    house.add(porchLampChain);
    const porchLampCap = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.14, 6), doorIronMat);
    porchLampCap.position.set(5.45, 3.24, 0);
    house.add(porchLampCap);
    const porchLampGlass = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.085, 0.22, 6), windowGlowMat);
    porchLampGlass.position.set(5.45, 3.09, 0);
    house.add(porchLampGlass);
    const porchLampTray = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.06, 0.05, 6), doorIronMat);
    porchLampTray.position.set(5.45, 2.96, 0);
    house.add(porchLampTray);
    const porchHalo = this.sky.createLanternHaloSprite(2.2);
    porchHalo.position.set(5.45, 3.09, 0);
    house.add(porchHalo);

    const porchLight = new THREE.PointLight('#ffcf86', 0, 15, 1.5);
    porchLight.position.set(5.45, 2.9, 0);
    house.add(porchLight);
    this.sky.registerNightLight(porchLight);

    // Cute pastel sky-blue wooden mailbox next to house path
    const mbPost = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, 1.25, 8), woodMat);
    mbPost.position.set(7.6, 0.62, 2.1);
    mbPost.castShadow = true;
    house.add(mbPost);
    const mbBox = new THREE.Mesh(
      new THREE.CylinderGeometry(0.24, 0.24, 0.62, 10),
      new THREE.MeshStandardMaterial({ color: '#7bc3e6', roughness: 0.65 })
    );
    mbBox.rotation.z = Math.PI / 2;
    mbBox.position.set(7.65, 1.3, 2.1);
    mbBox.castShadow = true;
    house.add(mbBox);
    const mbFlag = new THREE.Mesh(
      new THREE.BoxGeometry(0.05, 0.28, 0.08),
      new THREE.MeshStandardMaterial({ color: '#eb6456', roughness: 0.6 })
    );
    mbFlag.position.set(7.72, 1.46, 2.34);
    house.add(mbFlag);

    this.group.add(house);

    // Compute world position of chimney tip for smoke
    house.updateMatrixWorld(true);
    this.chimneyTip.set(-1.9, 9.7, -1.6).applyMatrix4(house.matrixWorld);

    // Per-wall colliders leaving the front doorway (local +X, z in [-0.74, +0.74]) 100% walk-in!
    const addHouseCol = (lx: number, lz: number, w: number, d: number) => {
      const wp = new THREE.Vector3(lx, 0, lz).applyMatrix4(house.matrixWorld);
      this.collisions.addRotatedBox(wp.x, wp.z, w, d, -house.rotation.y);
    };
    addHouseCol(-4.15, 0, 0.55, 6.9);    // Back wall
    addHouseCol(0, -3.35, 8.5, 0.55);    // North wall
    addHouseCol(0, 3.35, 8.5, 0.55);     // South wall
    addHouseCol(4.12, -2.1, 0.45, 2.55); // Front-left wall
    addHouseCol(4.12, 2.1, 0.45, 2.55);  // Front-right wall
    addHouseCol(6.15, -2.1, 0.35, 1.8);  // Porch left rail
    addHouseCol(6.15, 2.1, 0.35, 1.8);   // Porch right rail
  }

  private buildBarn(): void {
    const barn = new THREE.Group();
    barn.position.set(18.5, 0, -7.2);
    barn.rotation.y = -0.22;

    const redMat = new THREE.MeshStandardMaterial({
      map: this.textures.barnRed,
      bumpMap: this.textures.woodBump,
      bumpScale: 0.04,
      roughness: 0.86,
    });
    const creamMat = new THREE.MeshStandardMaterial({ color: '#fff4df', roughness: 0.84 });
    const roofMat = new THREE.MeshStandardMaterial({
      color: '#8f5241',
      bumpMap: this.textures.roofBump,
      bumpScale: 0.055,
      roughness: 0.85,
    });
    const stoneMat = new THREE.MeshStandardMaterial({
      map: this.textures.stoneWall,
      bumpMap: this.textures.stoneBump,
      bumpScale: 0.055,
      roughness: 0.92,
    });
    const hayMat = new THREE.MeshStandardMaterial({ map: this.textures.hayGolden, roughness: 0.94 });
    const loftGlow = new THREE.MeshStandardMaterial({
      color: '#ffe8a3',
      emissive: '#ffb84d',
      emissiveIntensity: 0.15,
      roughness: 0.3,
    });
    this.sky.registerGlowMaterial(loftGlow);

    // Walk-in Barn Plank Floor + Hollow Exterior Red Barn Walls with Wide Double-Door Cutout!
    const barnFloorMat = new THREE.MeshStandardMaterial({ map: this.textures.woodWarm, roughness: 0.9 });
    const barnFloor = new THREE.Mesh(new THREE.BoxGeometry(9.0, 0.12, 7.2), barnFloorMat);
    barnFloor.position.set(0, 0.06, 0);
    barnFloor.receiveShadow = true;
    barn.add(barnFloor);

    const addBarnWall = (lx: number, ly: number, lz: number, w: number, h: number, d: number, mat: THREE.Material) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      m.position.set(lx, ly, lz);
      m.castShadow = true;
      m.receiveShadow = true;
      barn.add(m);
    };
    // Back (-Z), Left (-X), Right (+X) walls
    addBarnWall(0, 2.45, -3.56, 9.2, 4.9, 0.28, redMat);
    addBarnWall(-4.46, 2.45, 0, 0.28, 4.9, 7.4, redMat);
    addBarnWall(4.46, 2.45, 0, 0.28, 4.9, 7.4, redMat);
    // Front (+Z) wall split cleanly around wide 3.44m double barn doorway (x in [-1.72, +1.72], height 3.48)
    addBarnWall(-3.16, 2.45, 3.56, 2.88, 4.9, 0.28, redMat);
    addBarnWall(3.16, 2.45, 3.56, 2.88, 4.9, 0.28, redMat);
    addBarnWall(0, 4.19, 3.56, 3.52, 1.42, 0.28, redMat);

    // Exterior stone skirting on sides & back
    addBarnWall(0, 0.28, -3.76, 9.5, 0.56, 0.22, stoneMat);
    addBarnWall(-4.66, 0.28, 0, 0.22, 0.56, 7.7, stoneMat);
    addBarnWall(4.66, 0.28, 0, 0.22, 0.56, 7.7, stoneMat);

    // Interior timber hayloft beams & rafters
    for (let bz = -2.4; bz <= 2.5; bz += 1.6) {
      const beam = new THREE.Mesh(new THREE.BoxGeometry(8.9, 0.22, 0.22), barnFloorMat);
      beam.position.set(0, 4.58, bz);
      barn.add(beam);
    }

    // Classic Gambrel / storybook pitched barn roof
    const gableShape = new THREE.Shape();
    gableShape.moveTo(-4.6, 0);
    gableShape.lineTo(4.6, 0);
    gableShape.lineTo(3.1, 2.15);
    gableShape.lineTo(0, 3.35);
    gableShape.lineTo(-3.1, 2.15);
    gableShape.closePath();
    const gableGeo = new THREE.ExtrudeGeometry(gableShape, { depth: 7.4, bevelEnabled: false });
    gableGeo.center();
    const gable = new THREE.Mesh(gableGeo, redMat);
    gable.position.set(0, 6.45, 0);
    gable.castShadow = true;
    barn.add(gable);

    // 4 Gambrel roof slopes
    const lowerSlopeGeo = new THREE.BoxGeometry(2.85, 0.24, 8.3);
    const upperSlopeGeo = new THREE.BoxGeometry(3.65, 0.24, 8.3);
    for (const side of [-1, 1]) {
      const lower = new THREE.Mesh(lowerSlopeGeo, roofMat);
      lower.position.set(side * 4.02, 5.88, 0);
      lower.rotation.z = -side * 0.96;
      lower.castShadow = true;
      barn.add(lower);

      const upper = new THREE.Mesh(upperSlopeGeo, roofMat);
      upper.position.set(side * 1.65, 7.62, 0);
      upper.rotation.z = -side * 0.37;
      upper.castShadow = true;
      barn.add(upper);
    }

    // Cream corner trims
    for (const sx of [-4.62, 4.62]) {
      for (const sz of [-3.72, 3.72]) {
        const trim = new THREE.Mesh(new THREE.BoxGeometry(0.24, 4.5, 0.24), creamMat);
        trim.position.set(sx, 2.65, sz);
        barn.add(trim);
      }
    }

    // Iconic Hinged X-braced Double Barn Doors on front (+Z) — swing wide open to walk inside!
    const buildBarnDoorLeaf = (side: -1 | 1): THREE.Group => {
      const pivot = new THREE.Group();
      pivot.position.set(side * 1.72, 0.12, 3.7);
      const offsetX = -side * 0.86;

      const doorFrame = new THREE.Mesh(new THREE.BoxGeometry(1.72, 3.32, 0.14), redMat);
      doorFrame.position.set(offsetX, 1.66, 0);
      doorFrame.castShadow = true;
      pivot.add(doorFrame);

      const topBar = new THREE.Mesh(new THREE.BoxGeometry(1.74, 0.15, 0.2), creamMat);
      topBar.position.set(offsetX, 3.24, 0);
      pivot.add(topBar);
      const botBar = new THREE.Mesh(new THREE.BoxGeometry(1.74, 0.15, 0.2), creamMat);
      botBar.position.set(offsetX, 0.08, 0);
      pivot.add(botBar);
      for (const bx of [-0.8, 0.8]) {
        const vBar = new THREE.Mesh(new THREE.BoxGeometry(0.14, 3.3, 0.2), creamMat);
        vBar.position.set(offsetX + bx, 1.66, 0);
        pivot.add(vBar);
      }
      for (const diag of [-1, 1]) {
        const xBar = new THREE.Mesh(new THREE.BoxGeometry(0.13, 3.3, 0.18), creamMat);
        xBar.position.set(offsetX, 1.66, 0);
        xBar.rotation.z = diag * 0.47;
        pivot.add(xBar);
      }
      barn.add(pivot);
      return pivot;
    };
    this.barnDoorLeftPivot = buildBarnDoorLeaf(-1);
    this.barnDoorRightPivot = buildBarnDoorLeaf(1);
    this.barnGroup = barn;

    // Open hayloft window + swung-open timber shutters + protruding hay + pulley wheel & rope!
    const loftWindow = new THREE.Mesh(new THREE.BoxGeometry(1.7, 1.5, 0.2), loftGlow);
    loftWindow.position.set(0, 5.8, 3.72);
    barn.add(loftWindow);
    const loftBorder = new THREE.Mesh(new THREE.BoxGeometry(1.94, 0.18, 0.26), creamMat);
    loftBorder.position.set(0, 5.02, 3.76);
    barn.add(loftBorder);
    for (const side of [-1, 1]) {
      const shutter = new THREE.Mesh(new THREE.BoxGeometry(0.82, 1.48, 0.1), redMat);
      shutter.position.set(side * 1.24, 5.8, 3.92);
      shutter.rotation.y = -side * 0.45;
      shutter.castShadow = true;
      barn.add(shutter);
    }
    const loftHay = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.62, 0.8), hayMat);
    loftHay.position.set(0, 5.38, 3.85);
    barn.add(loftHay);
    const hoistBeam = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.24, 1.75), creamMat);
    hoistBeam.position.set(0, 7.9, 4.35);
    barn.add(hoistBeam);
    // Hanging pulley wheel & hemp rope beneath the hayloft hoist beam!
    const pulleyIron = new THREE.MeshStandardMaterial({ color: '#4d4743', metalness: 0.45, roughness: 0.5 });
    const ropeMat = new THREE.MeshStandardMaterial({ color: '#d4b379', roughness: 0.92 });
    const pulley = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.1, 10), pulleyIron);
    pulley.rotation.z = Math.PI / 2;
    pulley.position.set(0, 7.62, 4.95);
    barn.add(pulley);
    const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.65, 6), ropeMat);
    rope.position.set(0, 6.75, 4.95);
    barn.add(rope);
    const hook = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.024, 6, 10, Math.PI * 1.35), pulleyIron);
    hook.position.set(0, 5.86, 4.95);
    hook.rotation.z = Math.PI * 0.7;
    barn.add(hook);

    // Side glowing windows
    for (const sx of [-4.64, 4.64]) {
      for (const sz of [-1.4, 1.4]) {
        const win = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.15, 1.15), loftGlow);
        win.position.set(sx, 2.7, sz);
        barn.add(win);
        const frame = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.32, 0.14), creamMat);
        frame.position.set(sx, 2.7, sz);
        barn.add(frame);
      }
    }

    // Iconic Rooftop Cupola + Rotating Golden Weathervane!
    const cupola = new THREE.Group();
    cupola.position.set(0, 8.2, 0);
    const cupBase = new THREE.Mesh(new THREE.BoxGeometry(1.65, 1.15, 1.65), creamMat);
    cupBase.castShadow = true;
    cupola.add(cupBase);
    const cupRoof = new THREE.Mesh(new THREE.ConeGeometry(1.38, 1.05, 4), roofMat);
    cupRoof.rotation.y = Math.PI / 4;
    cupRoof.position.y = 1.05;
    cupRoof.castShadow = true;
    cupola.add(cupRoof);

    const goldMat = new THREE.MeshStandardMaterial({ color: '#f3ca59', metalness: 0.45, roughness: 0.3 });
    const vaneMast = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 1.15, 7), goldMat);
    vaneMast.position.y = 1.85;
    cupola.add(vaneMast);

    this.barnWeathervane = new THREE.Group();
    this.barnWeathervane.position.y = 2.38;
    const arrowShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.25, 6), goldMat);
    arrowShaft.rotation.z = Math.PI / 2;
    this.barnWeathervane.add(arrowShaft);
    const arrowTip = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.28, 6), goldMat);
    arrowTip.rotation.z = -Math.PI / 2;
    arrowTip.position.x = 0.65;
    this.barnWeathervane.add(arrowTip);
    const roosterBody = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), goldMat);
    roosterBody.scale.set(1.25, 0.9, 0.45);
    roosterBody.position.set(-0.05, 0.16, 0);
    this.barnWeathervane.add(roosterBody);
    cupola.add(this.barnWeathervane);
    barn.add(cupola);

    // Rustic wooden ladder leaning beside barn doors + shiny creamery milk cans + 10-spoke leaning wagon wheel!
    const ladderWood = new THREE.MeshStandardMaterial({
      map: this.textures.woodWarm,
      bumpMap: this.textures.woodBump,
      bumpScale: 0.035,
      roughness: 0.85,
    });
    const ladder = new THREE.Group();
    ladder.position.set(-3.55, 0.3, 4.1);
    ladder.rotation.x = -0.22;
    for (const lx of [-0.26, 0.26]) {
      const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 4.2, 6), ladderWood);
      rail.position.set(lx, 2.0, 0);
      rail.castShadow = true;
      ladder.add(rail);
    }
    for (let r = 0; r < 8; r++) {
      const rung = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.56, 6), ladderWood);
      rung.rotation.z = Math.PI / 2;
      rung.position.set(0, 0.45 + r * 0.46, 0);
      ladder.add(rung);
    }
    barn.add(ladder);

    const steelMat = new THREE.MeshStandardMaterial({ color: '#d7e2ea', metalness: 0.52, roughness: 0.28 });
    for (const [mx, mz] of [[-2.35, 4.12], [-2.76, 4.35]] as [number, number][]) {
      const canBody = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.55, 10), steelMat);
      canBody.position.set(mx, 0.55, mz);
      canBody.castShadow = true;
      barn.add(canBody);
      const canNeck = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.16, 0.16, 10), steelMat);
      canNeck.position.set(mx, 0.9, mz);
      barn.add(canNeck);
    }

    // Classic 10-spoke wooden wagon wheel leaning crisply against the front-right red barn planks!
    const wagonWheel = new THREE.Group();
    wagonWheel.position.set(3.15, 0.78, 3.98);
    wagonWheel.rotation.x = -0.18;
    const wheelIron = new THREE.MeshStandardMaterial({ color: '#4f555c', metalness: 0.45, roughness: 0.5 });
    const wRim = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.065, 8, 22), ladderWood);
    wRim.castShadow = true;
    wagonWheel.add(wRim);
    const wTire = new THREE.Mesh(new THREE.TorusGeometry(0.77, 0.024, 6, 22), wheelIron);
    wagonWheel.add(wTire);
    const wHub = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.15, 0.24, 10), ladderWood);
    wHub.rotation.x = Math.PI / 2;
    wHub.castShadow = true;
    wagonWheel.add(wHub);
    const wHubBand = new THREE.Mesh(new THREE.TorusGeometry(0.145, 0.02, 6, 12), wheelIron);
    wagonWheel.add(wHubBand);
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.034, 1.38, 6), ladderWood);
      spoke.rotation.z = a;
      spoke.castShadow = true;
      wagonWheel.add(spoke);
    }
    barn.add(wagonWheel);

    // Warm barn exterior night light + lantern lamp + glowing halo sprite!
    const barnLamp = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 6), loftGlow);
    barnLamp.position.set(0, 4.45, 4.05);
    barn.add(barnLamp);
    const barnHalo = this.sky.createLanternHaloSprite(2.4);
    barnHalo.position.set(0, 4.45, 4.05);
    barn.add(barnHalo);

    const barnLight = new THREE.PointLight('#ffd08a', 0, 16, 1.5);
    barnLight.position.set(0, 4.4, 4.6);
    barn.add(barnLight);
    this.sky.registerNightLight(barnLight);

    this.group.add(barn);
    barn.updateMatrixWorld(true);
    // Per-wall colliders leaving the wide front double doorway (x in [-1.72, +1.72]) 100% walk-in!
    const addBarnCol = (lx: number, lz: number, w: number, d: number) => {
      const wp = new THREE.Vector3(lx, 0, lz).applyMatrix4(barn.matrixWorld);
      this.collisions.addRotatedBox(wp.x, wp.z, w, d, -barn.rotation.y);
    };
    addBarnCol(0, -3.65, 9.4, 0.55);    // Back wall
    addBarnCol(-4.55, 0, 0.55, 7.6);    // Left wall
    addBarnCol(4.55, 0, 0.55, 7.6);     // Right wall
    addBarnCol(-3.2, 3.65, 2.85, 0.5);  // Front-left wall
    addBarnCol(3.2, 3.65, 2.85, 0.5);   // Front-right wall
  }

  private buildWindmill(): void {
    const mill = new THREE.Group();
    mill.position.set(15.5, 0.94, -21.0);
    mill.rotation.y = -0.45;

    const stoneMat = new THREE.MeshStandardMaterial({
      map: this.textures.stoneWall,
      bumpMap: this.textures.stoneBump,
      bumpScale: 0.06,
      roughness: 0.9,
    });
    const plasterMat = new THREE.MeshStandardMaterial({ map: this.textures.plasterCream, roughness: 0.88 });
    const roofMat = new THREE.MeshStandardMaterial({
      map: this.textures.roofTerracotta,
      bumpMap: this.textures.roofBump,
      bumpScale: 0.055,
      roughness: 0.82,
    });
    const woodMat = new THREE.MeshStandardMaterial({
      map: this.textures.woodWarm,
      bumpMap: this.textures.woodBump,
      bumpScale: 0.035,
      roughness: 0.85,
    });
    const sailClothMat = new THREE.MeshStandardMaterial({
      color: '#fff9eb',
      roughness: 0.82,
      side: THREE.DoubleSide,
    });
    const windowGlow = new THREE.MeshStandardMaterial({
      color: '#ffeaa7',
      emissive: '#ffbd59',
      emissiveIntensity: 0.15,
    });
    this.sky.registerGlowMaterial(windowGlow);

    // Stone lower base + 4 chamfered stone buttresses for architectural silhouette!
    const lowerTower = new THREE.Mesh(new THREE.CylinderGeometry(2.7, 3.4, 4.2, 12), stoneMat);
    lowerTower.position.y = 2.1;
    lowerTower.castShadow = true;
    lowerTower.receiveShadow = true;
    mill.add(lowerTower);
    for (let b = 0; b < 4; b++) {
      const a = b * Math.PI * 0.5 + Math.PI * 0.25;
      const buttress = new THREE.Mesh(new THREE.BoxGeometry(0.85, 3.6, 1.15), stoneMat);
      buttress.position.set(Math.cos(a) * 3.05, 1.75, Math.sin(a) * 3.05);
      buttress.rotation.y = -a + Math.PI * 0.5;
      buttress.rotation.x = 0.14;
      buttress.castShadow = true;
      mill.add(buttress);
    }

    // Cream plaster upper tower
    const upperTower = new THREE.Mesh(new THREE.CylinderGeometry(2.05, 2.7, 5.6, 12), plasterMat);
    upperTower.position.y = 7.0;
    upperTower.castShadow = true;
    upperTower.receiveShadow = true;
    mill.add(upperTower);

    // Wrap-around wooden gallery deck with support corbels, X-braced rails & wrapping exterior stairs!
    const deck = new THREE.Mesh(new THREE.CylinderGeometry(3.28, 3.28, 0.25, 14), woodMat);
    deck.position.y = 4.25;
    deck.castShadow = true;
    mill.add(deck);
    const railRing = new THREE.Mesh(new THREE.TorusGeometry(3.16, 0.08, 6, 18), woodMat);
    railRing.rotation.x = Math.PI / 2;
    railRing.position.y = 5.05;
    mill.add(railRing);
    const midRailRing = new THREE.Mesh(new THREE.TorusGeometry(3.16, 0.055, 6, 18), woodMat);
    midRailRing.rotation.x = Math.PI / 2;
    midRailRing.position.y = 4.66;
    mill.add(midRailRing);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.065, 0.88, 6), woodMat);
      post.position.set(Math.cos(a) * 3.16, 4.66, Math.sin(a) * 3.16);
      mill.add(post);
      // Angled timber corbel supporting the balcony from below
      const corbel = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.82, 0.16), woodMat);
      corbel.position.set(Math.cos(a) * 2.86, 3.84, Math.sin(a) * 2.86);
      corbel.rotation.y = -a + Math.PI / 2;
      corbel.rotation.x = 0.55;
      mill.add(corbel);
    }

    // Exterior wrapping wooden staircase climbing gracefully up the visible right flank to the gallery!
    const stairRailPts: THREE.Vector3[] = [];
    for (let st = 0; st < 11; st++) {
      const t = st / 10;
      const ang = 0.52 - t * 1.35;
      const r = 3.72 - t * 0.30;
      const sy = 0.32 + t * 3.88;
      const step = new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.14, 0.44), woodMat);
      step.position.set(Math.cos(ang) * r, sy, Math.sin(ang) * r);
      step.rotation.y = -ang;
      step.castShadow = true;
      mill.add(step);
      const outerR = r + 0.42;
      stairRailPts.push(new THREE.Vector3(Math.cos(ang) * outerR, sy + 0.84, Math.sin(ang) * outerR));
      if (st % 2 === 0) {
        const sPost = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.048, 0.88, 6), woodMat);
        sPost.position.set(Math.cos(ang) * outerR, sy + 0.42, Math.sin(ang) * outerR);
        mill.add(sPost);
      }
    }
    const stairRailCurve = new THREE.CatmullRomCurve3(stairRailPts);
    const stairRail = new THREE.Mesh(new THREE.TubeGeometry(stairRailCurve, 18, 0.045, 6, false), woodMat);
    stairRail.castShadow = true;
    mill.add(stairRail);

    // Conical terracotta roof cap + shiny brass finial spire!
    const cap = new THREE.Mesh(new THREE.ConeGeometry(2.6, 3.1, 14), roofMat);
    cap.position.y = 11.35;
    cap.castShadow = true;
    mill.add(cap);
    const finialMat = new THREE.MeshStandardMaterial({ color: '#f4ca5c', metalness: 0.45, roughness: 0.3 });
    const finialPole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.09, 1.15, 8), finialMat);
    finialPole.position.y = 13.3;
    mill.add(finialPole);
    const finialOrb = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), finialMat);
    finialOrb.position.y = 13.85;
    mill.add(finialOrb);

    // Projecting arched stone portal porch & recessed wooden door (sits cleanly proud of sloped stone base!)
    const portalSurround = new THREE.Mesh(new THREE.BoxGeometry(1.78, 2.2, 1.05), stoneMat);
    portalSurround.position.set(0, 1.1, 3.16);
    portalSurround.castShadow = true;
    portalSurround.receiveShadow = true;
    mill.add(portalSurround);
    const doorArch = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.18, 8, 16, Math.PI), stoneMat);
    doorArch.scale.set(1, 1, 1.65);
    doorArch.position.set(0, 2.02, 3.48);
    mill.add(doorArch);
    const door = new THREE.Mesh(new THREE.BoxGeometry(1.22, 2.06, 0.16), woodMat);
    door.position.set(0, 1.04, 3.68);
    mill.add(door);
    const doorIron = new THREE.MeshStandardMaterial({ color: '#47403b', metalness: 0.45, roughness: 0.5 });
    for (const hy of [0.55, 1.55]) {
      const hinge = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.09, 0.04), doorIron);
      hinge.position.set(-0.36, hy, 3.77);
      mill.add(hinge);
    }
    const doorRing = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.022, 6, 12), finialMat);
    doorRing.position.set(0.36, 1.05, 3.78);
    mill.add(doorRing);
    const millStep = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.22, 0.78), stoneMat);
    millStep.position.set(0, 0.11, 3.96);
    millStep.receiveShadow = true;
    mill.add(millStep);

    const winFrame = new THREE.Mesh(new THREE.BoxGeometry(1.15, 1.25, 0.2), woodMat);
    winFrame.position.set(0, 6.7, 2.38);
    mill.add(winFrame);
    const win = new THREE.Mesh(new THREE.BoxGeometry(0.92, 1.02, 0.25), windowGlow);
    win.position.set(0, 6.7, 2.41);
    mill.add(win);
    const winBox = new THREE.Mesh(new THREE.BoxGeometry(1.22, 0.24, 0.36), woodMat);
    winBox.position.set(0, 6.02, 2.55);
    mill.add(winBox);
    this.addMiniatureFlowers(mill, 0, 6.16, 2.56, 4);

    // Rotating hub with sculpted brass hub cap & 4 storybook cloth sails
    const hub = new THREE.Group();
    hub.position.set(0, 8.75, 2.38);

    const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.38, 0.9, 10), woodMat);
    axle.rotation.x = Math.PI / 2;
    hub.add(axle);
    const hubCap = new THREE.Mesh(new THREE.SphereGeometry(0.36, 10, 8), finialMat);
    hubCap.scale.set(1, 1, 0.55);
    hubCap.position.z = 0.45;
    hub.add(hubCap);

    this.windmillBlades = new THREE.Group();
    for (let i = 0; i < 4; i++) {
      const blade = new THREE.Group();
      blade.rotation.z = (i * Math.PI) / 2;

      const spar = new THREE.Mesh(new THREE.BoxGeometry(0.18, 5.4, 0.14), woodMat);
      spar.position.set(0, 2.7, 0.25);
      spar.castShadow = true;
      blade.add(spar);

      const sail = new THREE.Mesh(new THREE.BoxGeometry(1.22, 4.15, 0.05), sailClothMat);
      sail.position.set(0.66, 3.15, 0.26);
      sail.rotation.y = 0.14;
      sail.castShadow = true;
      blade.add(sail);

      // Lattice crossbars across sail
      for (let r = 1.4; r <= 4.9; r += 0.85) {
        const rib = new THREE.Mesh(new THREE.BoxGeometry(1.26, 0.08, 0.09), woodMat);
        rib.position.set(0.66, r, 0.28);
        blade.add(rib);
      }

      this.windmillBlades.add(blade);
    }
    hub.add(this.windmillBlades);
    mill.add(hub);

    this.group.add(mill);
    // Solid circular collider covering the grassy knoll so the player never clips inside the hill mesh!
    this.collisions.addCircle(15.5, -21.0, 6.7);
  }

  private buildDuckPond(): void {
    const cx = WORLD_CONFIG.pondCenter.x;
    const cz = WORLD_CONFIG.pondCenter.z;
    const rx = WORLD_CONFIG.pondRadiusX;
    const rz = WORLD_CONFIG.pondRadiusZ;

    const pondGroup = new THREE.Group();
    pondGroup.position.set(cx, 0, cz);

    // Sandy pebble shoreline collar (sits cleanly beneath water surface with zero poke-through!)
    const rimMat = new THREE.MeshStandardMaterial({
      color: '#dec79e',
      roughness: 0.92,
    });
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(1, 1.06, 0.08, 28), rimMat);
    rim.scale.set(rx + 0.75, 1, rz + 0.75);
    rim.position.y = 0.02;
    rim.receiveShadow = true;
    pondGroup.add(rim);

    // Custom Stylized Animated Pond Water Shader (turquoise-to-cerulean depth + caustic ripples + shore foam + sun glints!)
    this.pondWaterMat = new THREE.ShaderMaterial({
      transparent: true,
      uniforms: {
        uTime: { value: 0 },
        uShallowColor: { value: new THREE.Color('#7de4f5') },
        uDeepColor: { value: new THREE.Color('#3ca4d9') },
        uFoamColor: { value: new THREE.Color('#e8fbff') },
        uSunColor: { value: new THREE.Color('#fff7d6') },
        uNightFactor: { value: 0 },
      },
      vertexShader: /* glsl */ `
        uniform float uTime;
        varying vec2 vUv;
        varying vec2 vLocalPos;
        void main() {
          vUv = uv;
          vLocalPos = position.xz;
          vec3 p = position;
          p.y += sin(position.x * 6.5 + uTime * 1.8) * 0.014 + cos(position.z * 7.2 - uTime * 1.4) * 0.014;
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
        varying vec2 vUv;
        varying vec2 vLocalPos;

        void main() {
          float dist = length(vLocalPos);
          // Depth gradient from shallow sandy shore to calm deeper center
          vec3 water = mix(uDeepColor, uShallowColor, smoothstep(0.18, 0.95, dist));

          // Animated dual-layer stylized caustic wave bands
          float w1 = sin(vLocalPos.x * 16.0 + uTime * 1.35 + sin(vLocalPos.y * 9.0 + uTime * 0.7));
          float w2 = cos(vLocalPos.y * 14.0 - uTime * 1.1 + cos(vLocalPos.x * 11.0 - uTime * 0.9));
          float caustic = smoothstep(0.62, 0.98, (w1 + w2) * 0.5 + 0.5);
          water = mix(water, uFoamColor, caustic * 0.22 * (1.0 - uNightFactor * 0.55));

          // Soft pulsing animated shoreline foam ring
          float foamWave = 0.025 * sin(atan(vLocalPos.y, vLocalPos.x) * 10.0 + uTime * 1.9);
          float shoreFoam = smoothstep(0.84 + foamWave, 0.96 + foamWave, dist);
          water = mix(water, uFoamColor, shoreFoam * 0.68);

          // Twinkling sun specular sparkles on the water surface!
          float sp1 = sin(vLocalPos.x * 34.0 + uTime * 2.6) * cos(vLocalPos.y * 31.0 - uTime * 2.1);
          float sp2 = sin((vLocalPos.x + vLocalPos.y) * 26.0 - uTime * 1.9);
          float glint = pow(max(0.0, sp1 * sp2), 5.0);
          water += uSunColor * glint * mix(1.35, 0.6, uNightFactor);

          // Gentle evening sky reflection tint
          water = mix(water, water * vec3(0.45, 0.55, 0.85), uNightFactor * 0.72);
          gl_FragColor = vec4(water, 0.91);
        }
      `,
    });
    const waterGeo = new THREE.CircleGeometry(1, 36);
    waterGeo.rotateX(-Math.PI / 2);
    const water = new THREE.Mesh(waterGeo, this.pondWaterMat);
    water.scale.set(rx, 1, rz);
    water.position.y = 0.145;
    pondGroup.add(water);
    this.pondWaterMesh = water;

    // Smooth rounded river rocks around the bank (leaving gap at South for dock)
    const rockColors = ['#c9c2b8', '#b8b2a7', '#d8d2c7', '#aba69e'];
    const rockGeo = new THREE.DodecahedronGeometry(0.55, 1);
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      // Leave clean opening around South dock (a near PI/2)
      if (Math.abs(Math.sin(a) - 1) < 0.09 && Math.cos(a) > -0.35 && Math.cos(a) < 0.35) continue;
      const mat = new THREE.MeshStandardMaterial({
        color: rockColors[i % rockColors.length],
        roughness: 0.86,
        flatShading: true,
      });
      const rock = new THREE.Mesh(rockGeo, mat);
      const s = 0.65 + (i % 4) * 0.25;
      rock.scale.set(s * 1.25, s * 0.62, s);
      rock.position.set(Math.cos(a) * (rx + 0.2), 0.18, Math.sin(a) * (rz + 0.2));
      rock.rotation.set(i * 0.3, i * 0.8, 0);
      rock.castShadow = true;
      rock.receiveShadow = true;
      pondGroup.add(rock);
    }

    // Cattails along the edges
    const stemMat = new THREE.MeshStandardMaterial({ color: '#6ba353', roughness: 0.85 });
    const headMat = new THREE.MeshStandardMaterial({ color: '#804c33', roughness: 0.9 });
    const cattailAngles = [0.25, 0.45, 2.3, 2.55, 3.6, 3.85, 5.4, 5.75];
    for (const a of cattailAngles) {
      for (let k = 0; k < 3; k++) {
        const jitter = (k - 1) * 0.12;
        const px = Math.cos(a + jitter) * (rx - 0.15);
        const pz = Math.sin(a + jitter) * (rz - 0.15);
        const h = 1.0 + (k % 2) * 0.32;
        const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, h, 5), stemMat);
        stalk.position.set(px, h * 0.5, pz);
        stalk.rotation.z = (k - 1) * 0.09;
        pondGroup.add(stalk);

        const head = new THREE.Mesh(new THREE.CapsuleGeometry(0.065, 0.22, 4, 6), headMat);
        head.position.set(px + (k - 1) * 0.05, h - 0.16, pz);
        pondGroup.add(head);
      }
    }

    // Lily pads & pastel pink lotus flowers
    const padMat = new THREE.MeshStandardMaterial({ color: '#69b85c', roughness: 0.72 });
    const lotusMat = new THREE.MeshStandardMaterial({ color: '#ffa8c5', roughness: 0.55 });
    const lilySpots: [number, number, boolean][] = [
      [-2.6, -1.2, true],
      [-1.8, -1.8, false],
      [2.8, -0.8, true],
      [3.5, 0.4, false],
      [-3.4, 1.4, true],
      [1.2, -2.5, false],
    ];
    for (const [lx, lz, hasFlower] of lilySpots) {
      const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.48, 0.04, 12, 1, false, 0, Math.PI * 1.82), padMat);
      pad.position.set(lx, 0.205, lz);
      pad.rotation.y = lx * 1.3;
      pondGroup.add(pad);
      if (hasFlower) {
        const flower = new THREE.Group();
        flower.position.set(lx, 0.265, lz);
        // Two-tiered 10-petal sculpted storybook lotus bloom!
        for (let p = 0; p < 6; p++) {
          const petal = new THREE.Mesh(new THREE.SphereGeometry(0.11, 6, 5), lotusMat);
          const ang = (p / 6) * Math.PI * 2;
          petal.scale.set(1.25, 0.48, 0.72);
          petal.position.set(Math.cos(ang) * 0.14, 0.02, Math.sin(ang) * 0.14);
          petal.rotation.y = -ang;
          flower.add(petal);
        }
        for (let p = 0; p < 4; p++) {
          const innerPetal = new THREE.Mesh(new THREE.SphereGeometry(0.085, 6, 5), lotusMat);
          const ang = (p / 4) * Math.PI * 2 + 0.4;
          innerPetal.scale.set(1.0, 0.65, 0.65);
          innerPetal.position.set(Math.cos(ang) * 0.075, 0.055, Math.sin(ang) * 0.075);
          innerPetal.rotation.y = -ang;
          flower.add(innerPetal);
        }
        const center = new THREE.Mesh(
          new THREE.SphereGeometry(0.075, 6, 5),
          new THREE.MeshStandardMaterial({ color: '#ffe169', roughness: 0.5 })
        );
        center.position.y = 0.065;
        flower.add(center);
        pondGroup.add(flower);
      }
    }

    // Cozy Wooden Fishing/Watering Dock with coiled mooring ropes & floating fishing bobber!
    const woodMat = new THREE.MeshStandardMaterial({
      map: this.textures.woodLight,
      bumpMap: this.textures.woodBump,
      bumpScale: 0.03,
      roughness: 0.85,
    });
    const postMat = new THREE.MeshStandardMaterial({ map: this.textures.woodWarm, roughness: 0.88 });
    const ropeMat = new THREE.MeshStandardMaterial({ color: '#d6b67c', roughness: 0.92 });
    const dock = new THREE.Group();
    dock.position.set(0, 0, rz + 0.1);
    for (let p = 0; p < 7; p++) {
      const plank = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.14, 0.36), woodMat);
      plank.position.set(0, 0.34, 0.65 - p * 0.42);
      plank.castShadow = true;
      plank.receiveShadow = true;
      dock.add(plank);
    }
    for (const sx of [-0.95, 0.95]) {
      for (const sz of [0.45, -1.75]) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.115, 0.98, 8), postMat);
        post.position.set(sx, 0.4, sz);
        post.castShadow = true;
        dock.add(post);
        // Coiled hemp mooring rope around front dock pilings!
        if (sz < 0) {
          for (let r = 0; r < 3; r++) {
            const coil = new THREE.Mesh(new THREE.TorusGeometry(0.115, 0.022, 6, 12), ropeMat);
            coil.rotation.x = Math.PI / 2;
            coil.position.set(sx, 0.58 + r * 0.042, sz);
            dock.add(coil);
          }
        }
      }
    }
    // Red-and-white floating fishing bobber near the dock fishing rod!
    const bobber = new THREE.Group();
    bobber.position.set(1.55, 0.175, -2.55);
    bobber.add(
      new THREE.Mesh(
        new THREE.SphereGeometry(0.075, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2),
        new THREE.MeshStandardMaterial({ color: '#eb5546', roughness: 0.35 })
      )
    );
    bobber.add(
      new THREE.Mesh(
        new THREE.SphereGeometry(0.075, 8, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2),
        new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.35 })
      )
    );
    dock.add(bobber);
    pondGroup.add(dock);

    // Invisible interaction target at end of dock for refilling watering can at the pond!
    const refillHit = new THREE.Mesh(
      new THREE.BoxGeometry(2.8, 1.4, 2.8),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    refillHit.position.set(0, 0.45, rz - 1.6);
    pondGroup.add(refillHit);
    this.pondRefillMesh = refillHit;

    // 2 Cute bobbing Pond Ducks + an adorable tiny yellow baby duckling trailing behind!
    const duckSpecs: [string, number, number, number, number, number][] = [
      ['#fff6de', 0, 2.3, 1.5, 0.28, 1.0],
      ['#ffe270', -0.34, 2.3, 1.5, 0.28, 0.56], // Baby duckling following right behind mother duck!
      ['#ffdd6e', Math.PI, 3.4, 2.2, 0.34, 0.95],
    ];
    for (const [color, angle, dRx, dRz, spd, scale] of duckSpecs) {
      const duck = this.createCuteDuck(color);
      duck.scale.setScalar(scale);
      pondGroup.add(duck);
      this.pondDucks.push({ group: duck, angle, radiusX: dRx, radiusZ: dRz, speed: spd });
    }

    this.group.add(pondGroup);

    // Keep player from walking into the deep center of the pond (still letting them stand cleanly on the dock!)
    this.collisions.addCircle(cx - 2.6, cz - 0.5, 3.6);
    this.collisions.addCircle(cx + 2.6, cz - 0.5, 3.6);
    this.collisions.addCircle(cx, cz - 1.8, 3.3);
  }

  private createCuteDuck(bodyColor: string): THREE.Group {
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.75 });
    const beakMat = new THREE.MeshStandardMaterial({ color: '#f59238', roughness: 0.6 });
    const eyeMat = new THREE.MeshStandardMaterial({ color: '#2b211c', roughness: 0.2 });

    const body = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 10), mat);
    body.scale.set(1.28, 0.82, 0.95);
    body.position.y = 0.2;
    body.castShadow = true;
    g.add(body);

    // Folded duck wings & upturned tail feather!
    for (const side of [-1, 1]) {
      const wing = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), mat);
      wing.scale.set(1.3, 0.62, 0.35);
      wing.position.set(-0.02, 0.22, side * 0.22);
      g.add(wing);
    }
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.2, 6), mat);
    tail.position.set(-0.32, 0.3, 0);
    tail.rotation.z = 0.85;
    g.add(tail);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 8), mat);
    head.position.set(0.22, 0.42, 0);
    head.castShadow = true;
    g.add(head);

    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.065, 0.16, 6), beakMat);
    beak.rotation.z = -Math.PI / 2;
    beak.position.set(0.39, 0.4, 0);
    g.add(beak);

    for (const sz of [-0.11, 0.11]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.028, 6, 6), eyeMat);
      eye.position.set(0.3, 0.46, sz);
      g.add(eye);
    }
    return g;
  }

  private buildFencesAndSigns(): void {
    const postMat = new THREE.MeshStandardMaterial({ map: this.textures.woodWarm, roughness: 0.88 });
    const railMat = new THREE.MeshStandardMaterial({ map: this.textures.woodLight, roughness: 0.86 });

    const addFenceRun = (x1: number, z1: number, x2: number, z2: number, height = 1.08, addCol = true) => {
      const dx = x2 - x1;
      const dz = z2 - z1;
      const len = Math.hypot(dx, dz);
      const count = Math.max(2, Math.round(len / 2.2) + 1);
      const yaw = Math.atan2(dx, dz);

      for (let i = 0; i < count; i++) {
        const t = i / (count - 1);
        const px = x1 + dx * t;
        const pz = z1 + dz * t;
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.115, height, 7), postMat);
        post.position.set(px, height * 0.5, pz);
        post.rotation.z = ((i % 3) - 1) * 0.025;
        post.castShadow = true;
        post.receiveShadow = true;
        this.group.add(post);

        // Beveled pyramidal wooden post cap on every fence post!
        const cap = new THREE.Mesh(new THREE.ConeGeometry(0.125, 0.11, 4), postMat);
        cap.rotation.y = Math.PI / 4;
        cap.position.set(px, height + 0.055, pz);
        cap.castShadow = true;
        this.group.add(cap);
      }

      // Two warm horizontal rails
      for (const ry of [height * 0.36, height * 0.74]) {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.13, len), railMat);
        rail.position.set((x1 + x2) * 0.5, ry, (z1 + z2) * 0.5);
        rail.rotation.y = yaw;
        rail.castShadow = true;
        this.group.add(rail);
      }

      if (addCol) {
        this.collisions.addFenceSegment(x1, z1, x2, z2, 0.42);
      }
    };

    // 1. Entrance front fence (leaving welcoming gateway at X in [-2.6, 2.6])
    addFenceRun(-26, 18.5, -2.9, 18.5);
    addFenceRun(2.9, 18.5, 26, 18.5);
    // Side cozy meadow boundary fences (with wide West & East wilderness trail gateways at Z in [-3.5, 3.5]!)
    addFenceRun(-26, 18.5, -26, 3.5);
    addFenceRun(-26, -3.5, -26, -24);
    addFenceRun(26, 18.5, 26, 3.5);
    addFenceRun(26, -3.5, 26, -24);

    // 2. Vegetable Garden low cozy border fences (open East entrance & North opening)
    addFenceRun(-14.6, 11.8, -4.4, 11.8, 0.85);
    addFenceRun(-14.6, 11.8, -14.6, 2.2, 0.85);
    addFenceRun(-14.6, 2.2, -10.5, 2.2, 0.85);
    addFenceRun(-7.4, 2.2, -4.4, 2.2, 0.85);

    // 3. Animal Pasture Paddock fences (wide walk-in gateway on West side Z in [5.0, 9.6])
    addFenceRun(4.3, -1.6, 4.3, 5.0, 1.05);
    addFenceRun(4.3, 9.6, 4.3, 13.8, 1.05);
    addFenceRun(4.3, 13.8, 23.4, 13.8, 1.05);
    addFenceRun(23.4, 13.8, 23.4, -1.6, 1.05);
    addFenceRun(4.3, -1.6, 13.6, -1.6, 1.05);

    // Welcoming half-open hinged wooden pasture gate swung cleanly inward!
    const gateLeaf = new THREE.Group();
    gateLeaf.position.set(4.3, 0, 5.0);
    gateLeaf.rotation.y = -0.85; // Swung nicely open inside the pasture, leaving wide walkway!
    for (const ry of [0.38, 0.78]) {
      const r = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 1.55), railMat);
      r.position.set(0, ry, 0.78);
      r.castShadow = true;
      gateLeaf.add(r);
    }
    const gDiag = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.1, 1.65), railMat);
    gDiag.position.set(0, 0.58, 0.78);
    gDiag.rotation.x = 0.25;
    gateLeaf.add(gDiag);
    const gEnd = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.92, 0.1), postMat);
    gEnd.position.set(0, 0.52, 1.54);
    gateLeaf.add(gEnd);
    this.group.add(gateLeaf);

    // Cute wooden directional signs for Garden & Animal Pasture (positioned cleanly clear of fence posts!)
    this.addSignPost(-3.9, 13.0, 0.25, this.textures.signGarden);
    this.addSignPost(3.35, 11.4, -0.32, this.textures.signAnimals);
  }

  private addSignPost(x: number, z: number, rotY: number, tex: THREE.CanvasTexture): void {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = rotY;
    const postMat = new THREE.MeshStandardMaterial({ map: this.textures.woodWarm, roughness: 0.88 });
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 1.45, 7), postMat);
    post.position.y = 0.72;
    post.castShadow = true;
    g.add(post);

    const faceMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.78 });
    const board = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.56, 0.08), [
      postMat,
      postMat,
      postMat,
      postMat,
      faceMat,
      faceMat,
    ]);
    board.position.y = 1.38;
    board.castShadow = true;
    g.add(board);
    this.group.add(g);
  }

  private buildGardenProps(): void {
    const woodMat = new THREE.MeshStandardMaterial({ map: this.textures.woodWarm, roughness: 0.86 });
    const woodLight = new THREE.MeshStandardMaterial({ map: this.textures.woodLight, roughness: 0.84 });
    const metalMat = new THREE.MeshStandardMaterial({ color: '#6b757f', metalness: 0.35, roughness: 0.55 });

    // 1. Watering Barrel (Interactive Water Refill Station!)
    const barrelGroup = new THREE.Group();
    barrelGroup.position.set(WORLD_CONFIG.waterBarrelPos.x, 0, WORLD_CONFIG.waterBarrelPos.z);

    const barrelBody = new THREE.Mesh(new THREE.CylinderGeometry(0.56, 0.48, 1.05, 12), woodMat);
    barrelBody.position.y = 0.52;
    barrelBody.castShadow = true;
    barrelBody.receiveShadow = true;
    barrelGroup.add(barrelBody);

    for (const hy of [0.25, 0.82]) {
      const hoop = new THREE.Mesh(new THREE.TorusGeometry(hy > 0.5 ? 0.54 : 0.51, 0.032, 6, 16), metalMat);
      hoop.rotation.x = Math.PI / 2;
      hoop.position.y = hy;
      barrelGroup.add(hoop);
    }

    const barrelWater = new THREE.Mesh(
      new THREE.CylinderGeometry(0.5, 0.5, 0.05, 12),
      new THREE.MeshStandardMaterial({
        map: this.textures.waterRipple,
        color: '#7ed9f7',
        roughness: 0.12,
      })
    );
    barrelWater.position.y = 1.01;
    barrelGroup.add(barrelWater);

    this.group.add(barrelGroup);
    this.waterBarrelMesh = barrelGroup;
    this.collisions.addCircle(WORLD_CONFIG.waterBarrelPos.x, WORLD_CONFIG.waterBarrelPos.z, 0.65);

    // 2. Seed & Feed Supply Crate (Free Cozy Restock!)
    const crateGroup = new THREE.Group();
    crateGroup.position.set(WORLD_CONFIG.supplyCratePos.x, 0, WORLD_CONFIG.supplyCratePos.z);

    const crateBox = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.78, 0.9), woodLight);
    crateBox.position.y = 0.39;
    crateBox.castShadow = true;
    crateBox.receiveShadow = true;
    crateGroup.add(crateBox);

    // Colorful seed pouches & grain sack tucked inside
    const sackColors = ['#f5d47a', '#f59e56', '#ee7d9c', '#82c96e'];
    for (let i = 0; i < 4; i++) {
      const pouch = new THREE.Mesh(
        new THREE.BoxGeometry(0.24, 0.34, 0.16),
        new THREE.MeshStandardMaterial({ color: sackColors[i], roughness: 0.8 })
      );
      pouch.position.set(-0.34 + i * 0.22, 0.82, (i % 2 - 0.5) * 0.22);
      pouch.rotation.z = (i - 1.5) * 0.12;
      pouch.castShadow = true;
      crateGroup.add(pouch);
    }

    this.group.add(crateGroup);
    this.supplyCrateMesh = crateGroup;
    this.collisions.addBox(WORLD_CONFIG.supplyCratePos.x, WORLD_CONFIG.supplyCratePos.z, 1.25, 1.0);

    // 3. Cozy Market Farm Stand (Sell Harvested Crops & Products!)
    const stand = new THREE.Group();
    stand.position.set(WORLD_CONFIG.marketStandPos.x, 0, WORLD_CONFIG.marketStandPos.z);
    stand.rotation.y = 0.55;

    const counter = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.92, 1.05), woodLight);
    counter.position.y = 0.46;
    counter.castShadow = true;
    counter.receiveShadow = true;
    stand.add(counter);

    for (const sx of [-0.95, 0.95]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.25, 7), woodMat);
      post.position.set(sx, 1.12, -0.4);
      post.castShadow = true;
      stand.add(post);
    }

    // Pastel coral & cream striped canopy awning
    for (let s = 0; s < 5; s++) {
      const stripe = new THREE.Mesh(
        new THREE.BoxGeometry(0.46, 0.08, 1.38),
        new THREE.MeshStandardMaterial({ color: s % 2 === 0 ? '#ea7764' : '#fff7e6', roughness: 0.78 })
      );
      stripe.position.set(-0.92 + s * 0.46, 2.22, 0.04);
      stripe.rotation.x = 0.24;
      stripe.castShadow = true;
      stand.add(stripe);
    }

    // Wicker harvest basket on counter
    const basket = new THREE.Mesh(
      new THREE.CylinderGeometry(0.36, 0.26, 0.34, 10),
      new THREE.MeshStandardMaterial({ color: '#d89b5a', roughness: 0.88 })
    );
    basket.position.set(0, 1.08, 0.05);
    basket.castShadow = true;
    stand.add(basket);
    // Decorative produce inside basket
    const fruitColors = ['#f28b42', '#e95a4b', '#e4698a', '#f5d469'];
    for (let f = 0; f < 4; f++) {
      const orb = new THREE.Mesh(
        new THREE.SphereGeometry(0.11, 7, 6),
        new THREE.MeshStandardMaterial({ color: fruitColors[f], roughness: 0.65 })
      );
      orb.position.set(Math.cos(f * 1.6) * 0.13, 1.24, 0.05 + Math.sin(f * 1.6) * 0.12);
      stand.add(orb);
    }

    this.group.add(stand);
    this.marketStandMesh = stand;
    this.collisions.addRotatedBox(WORLD_CONFIG.marketStandPos.x, WORLD_CONFIG.marketStandPos.z, 2.2, 1.2, 0.55);

    // 4. Adorable Smiling Scarecrow watching over the garden!
    const scarecrow = new THREE.Group();
    scarecrow.position.set(-14.0, 0, 7.0);
    scarecrow.rotation.y = Math.PI / 2;

    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 2.35, 7), woodMat);
    pole.position.y = 1.18;
    pole.castShadow = true;
    scarecrow.add(pole);

    const arms = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.65, 7), woodMat);
    arms.rotation.z = Math.PI / 2;
    arms.position.y = 1.62;
    arms.castShadow = true;
    scarecrow.add(arms);

    const shirt = new THREE.Mesh(
      new THREE.CylinderGeometry(0.24, 0.35, 0.85, 8),
      new THREE.MeshStandardMaterial({ color: '#79b791', roughness: 0.88 })
    );
    shirt.position.y = 1.48;
    shirt.castShadow = true;
    scarecrow.add(shirt);

    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.28, 10, 8),
      new THREE.MeshStandardMaterial({ color: '#f3d49b', roughness: 0.9 })
    );
    head.position.y = 2.08;
    head.castShadow = true;
    scarecrow.add(head);

    // Straw sunhat
    const hatMat = new THREE.MeshStandardMaterial({ map: this.textures.hayGolden, roughness: 0.9 });
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.56, 0.58, 0.06, 12), hatMat);
    brim.position.y = 2.3;
    brim.rotation.z = 0.08;
    brim.castShadow = true;
    scarecrow.add(brim);
    const crown = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.44, 10), hatMat);
    crown.position.set(-0.02, 2.52, 0);
    crown.rotation.z = 0.08;
    crown.castShadow = true;
    scarecrow.add(crown);

    // Cute scarecrow button eyes, triangle patch nose, cozy red bandana & perched bluebird!
    const btnMat = new THREE.MeshStandardMaterial({ color: '#3b2a22', roughness: 0.4 });
    for (const bx of [-0.1, 0.1]) {
      const eye = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.03, 8), btnMat);
      eye.rotation.x = Math.PI / 2;
      eye.position.set(bx, 2.13, 0.25);
      scarecrow.add(eye);
    }
    const patchNose = new THREE.Mesh(
      new THREE.ConeGeometry(0.045, 0.09, 4),
      new THREE.MeshStandardMaterial({ color: '#eb7d44', roughness: 0.7 })
    );
    patchNose.rotation.x = Math.PI / 2;
    patchNose.position.set(0, 2.04, 0.27);
    scarecrow.add(patchNose);

    const bandana = new THREE.Mesh(
      new THREE.ConeGeometry(0.28, 0.34, 4),
      new THREE.MeshStandardMaterial({ color: '#e35d52', roughness: 0.8 })
    );
    bandana.rotation.x = Math.PI;
    bandana.position.set(0, 1.78, 0.12);
    scarecrow.add(bandana);

    // Tiny sky-blue songbird perched cheerfully on the scarecrow's arm!
    const birdMat = new THREE.MeshStandardMaterial({ color: '#6fc7f5', roughness: 0.55 });
    const bird = new THREE.Group();
    bird.position.set(0.62, 1.72, 0);
    const bBody = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), birdMat);
    bBody.scale.set(1.2, 0.9, 0.9);
    bird.add(bBody);
    const bHead = new THREE.Mesh(new THREE.SphereGeometry(0.055, 7, 6), birdMat);
    bHead.position.set(-0.06, 0.06, 0.03);
    bird.add(bHead);
    const bBeak = new THREE.Mesh(
      new THREE.ConeGeometry(0.02, 0.05, 5),
      new THREE.MeshStandardMaterial({ color: '#f5b041', roughness: 0.5 })
    );
    bBeak.rotation.z = Math.PI / 2;
    bBeak.position.set(-0.12, 0.055, 0.03);
    bird.add(bBeak);
    scarecrow.add(bird);

    this.group.add(scarecrow);
  }

  private buildPastureProps(): void {
    const woodMat = new THREE.MeshStandardMaterial({ map: this.textures.woodWarm, roughness: 0.86 });
    const woodLight = new THREE.MeshStandardMaterial({ map: this.textures.woodLight, roughness: 0.84 });
    const roofMat = new THREE.MeshStandardMaterial({ map: this.textures.roofTerracotta, roughness: 0.82 });
    const hayMat = new THREE.MeshStandardMaterial({ map: this.textures.hayGolden, roughness: 0.92 });

    // 1. Storybook A-Frame Wooden Chicken Coop with arched hen door, straw bedding, side nesting box & cleated ramp!
    const coop = new THREE.Group();
    coop.position.set(11.2, 0, 12.1);
    coop.rotation.y = Math.PI + 0.15;

    for (const sx of [-0.74, 0.74]) {
      for (const sz of [-0.54, 0.54]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.48, 0.13), woodMat);
        leg.position.set(sx, 0.24, sz);
        leg.castShadow = true;
        coop.add(leg);
      }
    }
    const coopBody = new THREE.Mesh(new THREE.BoxGeometry(1.78, 1.06, 1.32), woodLight);
    coopBody.position.y = 0.94;
    coopBody.castShadow = true;
    coopBody.receiveShadow = true;
    coop.add(coopBody);

    // Side hinged egg-laying nesting box + warm pitched lid!
    const nestBox = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.54, 0.88), woodMat);
    nestBox.position.set(1.12, 0.78, 0);
    nestBox.castShadow = true;
    coop.add(nestBox);
    const nestLid = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.08, 0.94), roofMat);
    nestLid.position.set(1.14, 1.1, 0);
    nestLid.rotation.z = -0.32;
    coop.add(nestLid);

    // Dark recessed hen doorway + cozy golden straw peeking out
    const henDoor = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.62, 0.08),
      new THREE.MeshStandardMaterial({ color: '#3b2517', roughness: 0.95 })
    );
    henDoor.position.set(0, 0.76, 0.65);
    coop.add(henDoor);
    const doorArch = new THREE.Mesh(new THREE.TorusGeometry(0.27, 0.055, 6, 10, Math.PI), woodMat);
    doorArch.position.set(0, 1.04, 0.67);
    coop.add(doorArch);
    const coopStraw = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.12, 0.24), hayMat);
    coopStraw.position.set(0, 0.48, 0.68);
    coop.add(coopStraw);

    // Gable roof slopes + timber ridge cap
    const coopRoofL = new THREE.Mesh(new THREE.BoxGeometry(1.26, 0.13, 1.62), roofMat);
    coopRoofL.position.set(-0.5, 1.72, 0);
    coopRoofL.rotation.z = 0.56;
    coopRoofL.castShadow = true;
    coop.add(coopRoofL);
    const coopRoofR = new THREE.Mesh(new THREE.BoxGeometry(1.26, 0.13, 1.62), roofMat);
    coopRoofR.position.set(0.5, 1.72, 0);
    coopRoofR.rotation.z = -0.56;
    coopRoofR.castShadow = true;
    coop.add(coopRoofR);
    const coopRidge = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.66, 7), woodMat);
    coopRidge.rotation.x = Math.PI / 2;
    coopRidge.position.set(0, 2.04, 0);
    coop.add(coopRidge);

    // Cleated chicken ramp ladder!
    const rampGroup = new THREE.Group();
    rampGroup.position.set(0, 0.26, 0.98);
    rampGroup.rotation.x = 0.48;
    const ramp = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.07, 0.96), woodMat);
    ramp.castShadow = true;
    rampGroup.add(ramp);
    for (let cl = -0.34; cl <= 0.35; cl += 0.17) {
      const cleat = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.04, 0.045), woodLight);
      cleat.position.set(0, 0.05, cl);
      rampGroup.add(cleat);
    }
    coop.add(rampGroup);

    this.group.add(coop);
    this.collisions.addBox(11.2, 12.1, 2.1, 1.5);

    // 2. Authentic V-Shaped Timber Hay Manger on Crossed X-Legs overflowing with golden hay!
    const trough = new THREE.Group();
    trough.position.set(15.2, 0, 0.6);
    for (const lx of [-1.05, 1.05]) {
      for (const tilt of [-0.42, 0.42]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.85, 0.12), woodMat);
        leg.position.set(lx, 0.38, 0);
        leg.rotation.x = tilt;
        leg.castShadow = true;
        trough.add(leg);
      }
    }
    for (const side of [-1, 1]) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(2.68, 0.56, 0.09), woodLight);
      wall.position.set(0, 0.52, side * 0.28);
      wall.rotation.x = side * 0.38;
      wall.castShadow = true;
      wall.receiveShadow = true;
      trough.add(wall);
    }
    const endGeo = new THREE.BoxGeometry(0.09, 0.5, 0.68);
    for (const ex of [-1.3, 1.3]) {
      const end = new THREE.Mesh(endGeo, woodMat);
      end.position.set(ex, 0.52, 0);
      trough.add(end);
    }
    const feedFill = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 2.0, 6, 10), hayMat);
    feedFill.rotation.z = Math.PI / 2;
    feedFill.scale.set(0.85, 1, 1.08);
    feedFill.position.y = 0.66;
    feedFill.castShadow = true;
    trough.add(feedFill);

    this.group.add(trough);
    this.collisions.addBox(15.2, 0.6, 2.7, 0.95);
  }

  private buildHayBales(): void {
    const hayMat = new THREE.MeshStandardMaterial({ map: this.textures.hayGolden, roughness: 0.95 });
    const twineMat = new THREE.MeshStandardMaterial({ color: '#a8763e', roughness: 0.9 });

    const addRoundBale = (x: number, y: number, z: number, rotY: number) => {
      const g = new THREE.Group();
      g.position.set(x, y + 0.68, z);
      g.rotation.y = rotY;
      const cyl = new THREE.Mesh(new THREE.CylinderGeometry(0.68, 0.68, 1.25, 12), hayMat);
      cyl.rotation.z = Math.PI / 2;
      cyl.castShadow = true;
      cyl.receiveShadow = true;
      g.add(cyl);
      for (const sx of [-0.36, 0.36]) {
        const band = new THREE.Mesh(new THREE.TorusGeometry(0.69, 0.025, 6, 16), twineMat);
        band.rotation.y = Math.PI / 2;
        band.position.x = sx;
        g.add(band);
      }
      this.group.add(g);
      if (y < 0.2) this.collisions.addCircle(x, z, 0.8);
    };

    const addRectBale = (x: number, y: number, z: number, rotY: number) => {
      const g = new THREE.Group();
      g.position.set(x, y + 0.38, z);
      g.rotation.y = rotY;
      const box = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.74, 0.82), hayMat);
      box.castShadow = true;
      box.receiveShadow = true;
      g.add(box);
      this.group.add(g);
      if (y < 0.2) this.collisions.addCircle(x, z, 0.72);
    };

    // Clustered cozily near barn, pasture, and windmill
    addRoundBale(21.4, 0, 1.4, 0.4);
    addRoundBale(21.8, 0, 3.0, 0.2);
    addRoundBale(21.5, 1.2, 2.2, 0.3);
    addRoundBale(11.4, 0, -4.6, 0.8);
    addRoundBale(12.9, 0, -5.2, 0.6);
    addRoundBale(22.2, 0, -14.0, 0.5);
    addRoundBale(20.6, 0, -14.8, 1.1);

    addRectBale(6.2, 0, 12.2, 0.2);
    addRectBale(7.4, 0, 12.4, -0.15);
    addRectBale(6.8, 0.74, 12.3, 0.1);
    addRectBale(-13.8, 0, 13.4, 0.4);
  }

  private buildTreesAndBushes(): void {
    const trunkMat = new THREE.MeshStandardMaterial({ map: this.textures.woodWarm, roughness: 0.92 });
    const foliageMats = [
      new THREE.MeshStandardMaterial({ color: '#70b85c', roughness: 0.85, flatShading: true }),
      new THREE.MeshStandardMaterial({ color: '#84c966', roughness: 0.85, flatShading: true }),
      new THREE.MeshStandardMaterial({ color: '#5fa658', roughness: 0.85, flatShading: true }),
      new THREE.MeshStandardMaterial({ color: '#f7b2c7', roughness: 0.82, flatShading: true }), // Pastel cherry blossom!
    ];
    const puffGeo = new THREE.IcosahedronGeometry(1, 1);

    const addStylizedTree = (x: number, z: number, scale: number, paletteIdx: number) => {
      const tree = new THREE.Group();
      tree.position.set(x, 0, z);
      tree.rotation.y = (x * 1.7 + z * 2.3) % (Math.PI * 2);

      // Slightly curved tapered warm bark trunk
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.24 * scale, 0.42 * scale, 2.6 * scale, 8), trunkMat);
      trunk.position.y = 1.28 * scale;
      trunk.rotation.z = 0.05;
      trunk.castShadow = true;
      trunk.receiveShadow = true;
      tree.add(trunk);

      const leafMat = foliageMats[paletteIdx % foliageMats.length];
      const puffs: [number, number, number, number][] = [
        [0, 3.3, 0, 1.65],
        [-0.9, 2.75, 0.55, 1.15],
        [0.95, 2.8, -0.35, 1.2],
        [0.15, 2.85, 0.95, 1.05],
        [-0.25, 4.15, -0.2, 1.1],
      ];
      for (const [px, py, pz, pr] of puffs) {
        const puff = new THREE.Mesh(puffGeo, leafMat);
        puff.position.set(px * scale, py * scale, pz * scale);
        puff.scale.set(pr * scale, pr * 0.88 * scale, pr * scale);
        puff.castShadow = true;
        puff.receiveShadow = true;
        tree.add(puff);
      }

      this.placeholderTreesGroup.add(tree);
      if (Math.abs(x) < 33 && Math.abs(z) < 31) {
        this.collisions.addCircle(x, z, 0.58 * scale);
      }
    };

    const treeSpots: [number, number, number, number][] = [
      // Framing entrance warmly
      [-10.5, 21.5, 1.15, 3], // Blossom tree left of entrance
      [11.0, 21.2, 1.2, 0],
      [-19.5, 20.5, 1.35, 1],
      [20.2, 20.8, 1.3, 2],
      // Around farmhouse & west meadow
      [-26.5, 12.0, 1.4, 0],
      [-27.0, 3.0, 1.3, 1],
      [-26.2, -5.5, 1.45, 3], // Blossom behind house
      [-24.5, -14.5, 1.35, 0],
      [-17.2, -16.2, 1.15, 3], // Blossom between house & pond
      [-16.0, 14.2, 1.1, 1],
      // Scenic grove around Duck Pond
      [-14.8, -22.5, 1.3, 2],
      [-7.5, -26.8, 1.35, 0],
      [1.8, -25.2, 1.25, 3], // Blossom by pond & windmill
      [4.5, -16.5, 1.0, 1],
      // Framing Barn & Windmill
      [25.5, -14.5, 1.35, 0],
      [26.0, -2.5, 1.25, 2],
      [26.5, 8.5, 1.35, 1],
      [26.2, 16.5, 1.2, 3],
      [24.0, -25.5, 1.4, 0],
      [9.5, -28.0, 1.35, 2],
      // Distant valley trees on inner hillsides
      [-34, -22, 1.6, 1],
      [-35, 6, 1.5, 2],
      [34, -18, 1.6, 0],
      [35, 4, 1.5, 1],
      [32, 18, 1.5, 2],
      [-32, 22, 1.5, 0],
    ];

    for (const [x, z, s, p] of treeSpots) {
      this.treeSpots.push({ x, z, scale: s, paletteIdx: p });
      addStylizedTree(x, z, s, p);
    }
    this.group.add(this.placeholderTreesGroup);

    // Soft rounded pastel meadow bushes tucked by fences & buildings
    const bushMat = new THREE.MeshStandardMaterial({ color: '#78bf60', roughness: 0.88, flatShading: true });
    const berryMat = new THREE.MeshStandardMaterial({ color: '#ff8da8', roughness: 0.55 });
    const bushSpots: [number, number, number][] = [
      [-5.6, 18.0, 0.9],
      [5.8, 18.0, 0.95],
      [-14.2, 1.4, 0.8],
      [-14.2, -2.4, 0.85],
      [12.8, -2.2, 0.9],
      [23.2, 14.5, 0.95],
      [-12.2, -17.0, 1.0],
      [2.2, -19.5, 0.9],
    ];
    for (const [bx, bz, bs] of bushSpots) {
      const bush = new THREE.Group();
      bush.position.set(bx, 0, bz);
      for (let k = 0; k < 3; k++) {
        const m = new THREE.Mesh(puffGeo, bushMat);
        m.scale.setScalar((0.55 + k * 0.12) * bs);
        m.position.set((k - 1) * 0.38 * bs, 0.35 * bs, (k % 2) * 0.2 * bs);
        m.castShadow = true;
        bush.add(m);
      }
      // Cute pink flower buds on bush
      for (let b = 0; b < 4; b++) {
        const bud = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 5), berryMat);
        bud.position.set((b - 1.5) * 0.25 * bs, 0.65 * bs, (b % 2 - 0.5) * 0.3 * bs);
        bush.add(bud);
      }
      this.group.add(bush);
    }
  }

  private addMiniatureFlowers(parent: THREE.Group, cx: number, y: number, cz: number, count: number): void {
    const colors = ['#fffdf2', '#ff92b4', '#ffd85e', '#b99cff', '#8fd6ff'];
    const stemMat = new THREE.MeshStandardMaterial({ color: '#5fa853', roughness: 0.85 });
    for (let i = 0; i < count; i++) {
      const ox = ((i / Math.max(1, count - 1)) - 0.5) * 0.78;
      const oz = ((i % 2) - 0.5) * 0.2;
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.018, 0.2, 5), stemMat);
      stem.position.set(cx + ox, y + 0.08, cz + oz);
      parent.add(stem);

      const bloom = new THREE.Mesh(
        new THREE.SphereGeometry(0.075, 6, 5),
        new THREE.MeshStandardMaterial({ color: colors[i % colors.length], roughness: 0.55 })
      );
      bloom.scale.set(1.2, 0.65, 1.2);
      bloom.position.set(cx + ox, y + 0.2, cz + oz);
      parent.add(bloom);
    }
  }

  private buildFlowersAndGrass(): void {
    // Sculpted 5-petal storybook blossoms + tall cheerful Golden Sunflowers!
    const petalColors = ['#fffdf5', '#ff94b8', '#ffe066', '#c4a6ff', '#8ad8ff', '#ffad7a'];
    const centerMat = new THREE.MeshStandardMaterial({ color: '#ffd449', roughness: 0.48 });
    const darkCenterMat = new THREE.MeshStandardMaterial({ color: '#6b4226', roughness: 0.85 });
    const sunPetalMat = new THREE.MeshStandardMaterial({ color: '#ffcf40', roughness: 0.55 });
    const stemMat = new THREE.MeshStandardMaterial({ color: '#5da64f', roughness: 0.84 });
    const leafGeo = new THREE.SphereGeometry(0.08, 6, 5);
    const petalGeo = new THREE.SphereGeometry(0.068, 6, 5);
    const centerGeo = new THREE.SphereGeometry(0.048, 6, 5);

    const petalMats = petalColors.map(
      (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.56 })
    );

    const createFlowerPatch = (x: number, z: number, seed: number) => {
      const cluster = new THREE.Group();
      cluster.position.set(x, 0, z);
      const stems = 3 + (seed % 2);
      const mat = petalMats[seed % petalMats.length];

      for (let i = 0; i < stems; i++) {
        const ang = (i / stems) * Math.PI * 2 + seed;
        const rad = 0.14 + (i % 2) * 0.14;
        const h = 0.28 + ((seed + i) % 3) * 0.08;
        const fx = Math.cos(ang) * rad;
        const fz = Math.sin(ang) * rad;

        const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.022, h, 5), stemMat);
        stem.position.set(fx, h * 0.5, fz);
        cluster.add(stem);

        // True 5-petal sculpted blossom!
        const head = new THREE.Group();
        head.position.set(fx, h + 0.015, fz);
        head.rotation.y = seed + i;
        for (let p = 0; p < 5; p++) {
          const pa = (p / 5) * Math.PI * 2;
          const petal = new THREE.Mesh(petalGeo, mat);
          petal.scale.set(1.25, 0.36, 0.78);
          petal.position.set(Math.cos(pa) * 0.082, 0, Math.sin(pa) * 0.082);
          petal.rotation.y = -pa;
          petal.rotation.z = -0.18;
          head.add(petal);
        }
        const dot = new THREE.Mesh(centerGeo, centerMat);
        dot.scale.set(1, 0.72, 1);
        dot.position.y = 0.018;
        head.add(dot);
        cluster.add(head);
      }

      // Soft curved basal leaves
      for (let b = 0; b < 3; b++) {
        const ba = (b / 3) * Math.PI * 2 + seed;
        const blade = new THREE.Mesh(leafGeo, stemMat);
        blade.scale.set(1.5, 0.28, 0.75);
        blade.position.set(Math.cos(ba) * 0.16, 0.07, Math.sin(ba) * 0.16);
        blade.rotation.y = -ba;
        blade.rotation.z = 0.25;
        cluster.add(blade);
      }

      this.group.add(cluster);
      this.flowerClusters.push({
        group: cluster,
        phase: seed * 0.73,
        baseRotZ: ((seed % 5) - 2) * 0.03,
      });
    };

    // Tall cheerful Golden Sunflowers along the entrance fence & farmhouse!
    const addSunflower = (x: number, z: number, height: number, yaw: number) => {
      const sf = new THREE.Group();
      sf.position.set(x, 0, z);
      sf.rotation.y = yaw;

      const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.046, height, 6), stemMat);
      stalk.position.y = height * 0.5;
      stalk.castShadow = true;
      sf.add(stalk);

      for (const ly of [height * 0.38, height * 0.64]) {
        const side = ly > height * 0.5 ? 1 : -1;
        const leaf = new THREE.Mesh(leafGeo, stemMat);
        leaf.scale.set(2.2, 0.35, 1.4);
        leaf.position.set(side * 0.18, ly, 0);
        leaf.rotation.z = side * 0.4;
        sf.add(leaf);
      }

      const head = new THREE.Group();
      head.position.set(0, height + 0.04, 0.05);
      head.rotation.x = 0.28;
      const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.16, 0.07, 10), darkCenterMat);
      disc.rotation.x = Math.PI / 2;
      head.add(disc);
      for (let p = 0; p < 10; p++) {
        const a = (p / 10) * Math.PI * 2;
        const pet = new THREE.Mesh(petalGeo, sunPetalMat);
        pet.scale.set(1.65, 0.85, 0.35);
        pet.position.set(Math.cos(a) * 0.24, Math.sin(a) * 0.24, -0.01);
        pet.rotation.z = a;
        head.add(pet);
      }
      sf.add(head);
      this.group.add(sf);
      this.flowerClusters.push({ group: sf, phase: x * 0.5 + z * 0.3, baseRotZ: 0 });
    };

    const sunflowerSpots: [number, number, number, number][] = [
      [-4.6, 17.8, 1.38, 0.15],
      [-5.4, 17.9, 1.18, -0.1],
      [4.7, 17.8, 1.42, -0.2],
      [5.5, 17.9, 1.22, 0.12],
      [-13.8, -2.1, 1.32, 0.8],
      [-14.5, -1.6, 1.15, 0.6],
      [-14.8, 10.6, 1.28, 1.4],
      [-14.8, 3.8, 1.35, 1.3],
    ];
    for (const [sx, sz, sh, sy] of sunflowerSpots) {
      addSunflower(sx, sz, sh, sy);
    }

    let seed = 1;
    // Line both sides of the main entrance path!
    for (let z = 24.5; z >= -8.0; z -= 2.1) {
      if (Math.abs(z - 18.5) < 1.2) continue;
      if (z > 4.8 && z < 9.5) continue; // Keep garden/pasture crossroads open
      createFlowerPatch(-2.55 - (seed % 3) * 0.25, z, seed++);
      createFlowerPatch(2.55 + (seed % 3) * 0.25, z + 0.6, seed++);
    }

    // Flower borders along entrance fence, garden perimeter, farmhouse & pond
    const scenicSpots: [number, number][] = [
      [-6.5, 17.5], [-9.2, 17.4], [-12.5, 17.6], [6.8, 17.5], [10.0, 17.4], [13.5, 17.6],
      [-15.2, 11.5], [-15.2, 8.2], [-15.2, 4.5], [-12.5, 12.6], [-8.8, 12.6],
      [-10.2, -1.6], [-13.0, -2.8], [-12.4, -7.8], [-11.5, -10.4],
      [-1.5, -12.6], [-8.8, -13.4], [-11.6, -15.4], [0.8, -15.8], [2.4, -18.5],
      [6.8, -11.8], [10.4, -13.6], [13.2, -15.6], [5.8, -2.5], [10.2, -2.4],
      [3.2, 13.8], [7.8, 14.5], [14.5, 14.6], [19.8, 14.5],
      [-5.5, 16.2], [-2.8, 15.2], [3.5, 15.5], [5.0, 11.8],
    ];
    for (const [fx, fz] of scenicSpots) {
      createFlowerPatch(fx, fz, seed++);
    }
  }

  private buildLanterns(): void {
    // Sculpted wrought-iron curved shepherd's-hook lantern posts with hexagonal glass cages & stone plinths!
    const postMat = new THREE.MeshStandardMaterial({
      map: this.textures.woodWarm,
      bumpMap: this.textures.woodBump,
      bumpScale: 0.035,
      roughness: 0.86,
    });
    const stoneMat = new THREE.MeshStandardMaterial({ map: this.textures.stoneWall, roughness: 0.9 });
    const ironMat = new THREE.MeshStandardMaterial({ color: '#453e3a', roughness: 0.52, metalness: 0.45 });
    const glassMat = new THREE.MeshStandardMaterial({
      color: '#fff4c9',
      emissive: '#ffbe55',
      emissiveIntensity: 0.15,
      roughness: 0.22,
    });
    this.sky.registerGlowMaterial(glassMat);

    const hookCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 2.28, 0),
      new THREE.Vector3(0.06, 2.52, 0),
      new THREE.Vector3(0.28, 2.56, 0),
      new THREE.Vector3(0.38, 2.38, 0),
    ]);
    const hookGeo = new THREE.TubeGeometry(hookCurve, 12, 0.024, 6, false);

    const lanternSpots: [number, number, boolean][] = [
      [-2.9, 17.2, true],
      [2.9, 17.2, true],
      [-3.5, 3.6, true],
      [3.7, 5.1, true],
      [-3.25, -12.8, true],
      [-12.8, -4.6, false],
      [11.2, -11.5, false],
    ];

    for (const [lx, lz, addPointLight] of lanternSpots) {
      const g = new THREE.Group();
      g.position.set(lx, 0, lz);
      if (lx > 0) g.rotation.y = Math.PI; // Hook curves warmly inward toward the path!

      const plinth = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.23, 0.34, 8), stoneMat);
      plinth.position.y = 0.17;
      plinth.castShadow = true;
      g.add(plinth);

      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.092, 2.15, 8), postMat);
      post.position.y = 1.25;
      post.castShadow = true;
      g.add(post);

      const ironCollar = new THREE.Mesh(new THREE.CylinderGeometry(0.088, 0.088, 0.12, 8), ironMat);
      ironCollar.position.y = 2.26;
      g.add(ironCollar);

      const hook = new THREE.Mesh(hookGeo, ironMat);
      hook.castShadow = true;
      g.add(hook);

      // Hexagonal chamfered lantern housing + vertical corner bars + peaked roof cap!
      const lxPos = 0.38;
      const lyPos = 2.04;
      const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.135, 0.105, 0.32, 6), glassMat);
      glass.position.set(lxPos, lyPos, 0);
      g.add(glass);

      const botTray = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.08, 0.07, 6), ironMat);
      botTray.position.set(lxPos, lyPos - 0.18, 0);
      g.add(botTray);

      const cap = new THREE.Mesh(new THREE.ConeGeometry(0.21, 0.18, 6), ironMat);
      cap.position.set(lxPos, lyPos + 0.24, 0);
      g.add(cap);

      for (let s = 0; s < 6; s++) {
        const a = (s / 6) * Math.PI * 2;
        const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.34, 5), ironMat);
        strut.position.set(lxPos + Math.cos(a) * 0.13, lyPos, Math.sin(a) * 0.13);
        g.add(strut);
      }

      // Volumetric warm glow halo sprite for twilight & starry nights!
      const halo = this.sky.createLanternHaloSprite(1.95);
      halo.position.set(lxPos, lyPos, 0);
      g.add(halo);

      if (addPointLight) {
        const pl = new THREE.PointLight('#ffcb77', 0, 14, 1.55);
        pl.position.set(lxPos, lyPos - 0.04, 0);
        g.add(pl);
        this.sky.registerNightLight(pl);
      }

      this.group.add(g);
    }
  }

  private buildButterflies(): void {
    const wingColors = ['#ffe578', '#ffa8cf', '#9ce0ff', '#d6b3ff'];
    const wingGeo = new THREE.CircleGeometry(0.068, 7);
    const bodyMat = new THREE.MeshBasicMaterial({ color: '#594235' });
    const centers = [
      new THREE.Vector3(-8.5, 1.55, 7.2),
      new THREE.Vector3(-3.0, 1.65, 14.5),
      new THREE.Vector3(3.0, 1.6, 11.2),
      new THREE.Vector3(-5.0, 1.65, -13.5),
      new THREE.Vector3(8.5, 1.65, 9.5),
    ];

    for (let i = 0; i < centers.length; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: wingColors[i % wingColors.length],
        side: THREE.DoubleSide,
      });
      const group = new THREE.Group();
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.09, 5), bodyMat);
      body.rotation.x = Math.PI / 2;
      group.add(body);
      const leftWing = new THREE.Mesh(wingGeo, mat);
      leftWing.position.x = -0.042;
      const rightWing = new THREE.Mesh(wingGeo, mat);
      rightWing.position.x = 0.042;
      group.add(leftWing, rightWing);
      this.group.add(group);
      this.butterflies.push({
        group,
        leftWing,
        rightWing,
        center: centers[i],
        phase: i * 1.4,
        radius: 1.6 + (i % 2) * 0.9,
        speed: 0.7 + i * 0.08,
      });
    }
  }

  public update(dt: number, elapsed: number, nightFactor: number): void {
    // Rotate windmill sails smoothly in the countryside breeze
    if (this.windmillBlades) {
      this.windmillBlades.rotation.z -= dt * 0.55;
    }

    // Gentle sway on barn rooftop golden rooster weathervane!
    if (this.barnWeathervane) {
      this.barnWeathervane.rotation.y = Math.sin(elapsed * 0.45) * 0.65 + Math.sin(elapsed * 0.17) * 0.4;
    }

    // Custom stylized animated Duck Pond shader uniforms!
    this.textures.waterRipple.offset.x = elapsed * 0.032;
    this.textures.waterRipple.offset.y = Math.sin(elapsed * 0.25) * 0.08;
    if (this.pondWaterMat) {
      this.pondWaterMat.uniforms.uTime.value = elapsed;
      this.pondWaterMat.uniforms.uNightFactor.value = nightFactor;
      this.pondWaterMat.uniforms.uSunColor.value.copy(this.sky.currentSunColor);
    }

    // Gentle duck swimming loops
    for (const d of this.pondDucks) {
      d.angle += d.speed * dt;
      const nx = Math.cos(d.angle) * d.radiusX;
      const nz = Math.sin(d.angle) * d.radiusZ;
      const dx = -Math.sin(d.angle) * d.radiusX;
      const dz = Math.cos(d.angle) * d.radiusZ;
      d.group.position.set(nx, 0.065 + Math.sin(elapsed * 3.0 + d.angle) * 0.025, nz);
      d.group.rotation.y = Math.atan2(-dz, dx);
    }

    // Flower wind sway
    for (const f of this.flowerClusters) {
      f.group.rotation.z = f.baseRotZ + Math.sin(elapsed * 1.85 + f.phase) * 0.075;
    }

    // Daytime butterflies flutter peacefully (rest at night)
    const showButterflies = nightFactor < 0.6;
    for (const b of this.butterflies) {
      b.group.visible = showButterflies;
      if (!showButterflies) continue;
      const t = elapsed * b.speed + b.phase;
      const x = b.center.x + Math.sin(t) * b.radius;
      const z = b.center.z + Math.sin(t * 2) * (b.radius * 0.55);
      const y = b.center.y + Math.sin(t * 2.7) * 0.32;
      b.group.position.set(x, y, z);
      b.group.rotation.y = Math.atan2(Math.cos(t) * b.radius, Math.cos(t * 2) * b.radius);
      const flap = Math.sin(elapsed * 14 + b.phase) * 0.85;
      b.leftWing.rotation.y = flap;
      b.rightWing.rotation.y = -flap;
    }

    // Cozy farmhouse chimney smoke puffs
    this.smokeTimer += dt;
    if (this.smokeTimer > 0.72) {
      this.smokeTimer = 0;
      this.particles.spawnChimneySmoke(this.chimneyTip);
    }
  }
}
