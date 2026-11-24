import * as THREE from 'three';
import { TimeOfDayInfo } from '../types';

interface SkyPalette {
  t: number;
  top: THREE.Color;
  horizon: THREE.Color;
  fog: THREE.Color;
  sunColor: THREE.Color;
  sunIntensity: number;
  hemiSky: THREE.Color;
  hemiGround: THREE.Color;
  hemiIntensity: number;
  nightFactor: number;
  sunsetFactor: number;
}

const SKY_KEYFRAMES: SkyPalette[] = [
  {
    t: 0.0,
    top: new THREE.Color('#101938'),
    horizon: new THREE.Color('#223463'),
    fog: new THREE.Color('#1b2a52'),
    sunColor: new THREE.Color('#9abaff'),
    sunIntensity: 0.34,
    hemiSky: new THREE.Color('#3e5a99'),
    hemiGround: new THREE.Color('#1d2736'),
    hemiIntensity: 0.44,
    nightFactor: 1.0,
    sunsetFactor: 0.0,
  },
  {
    t: 0.21,
    top: new THREE.Color('#3c528f'),
    horizon: new THREE.Color('#f7a889'),
    fog: new THREE.Color('#e0a392'),
    sunColor: new THREE.Color('#ffb985'),
    sunIntensity: 0.8,
    hemiSky: new THREE.Color('#95a8db'),
    hemiGround: new THREE.Color('#6b5e54'),
    hemiIntensity: 0.76,
    nightFactor: 0.52,
    sunsetFactor: 0.72,
  },
  {
    t: 0.27,
    top: new THREE.Color('#5cb4f2'),
    horizon: new THREE.Color('#ffe2c4'),
    fog: new THREE.Color('#f8e6ce'),
    sunColor: new THREE.Color('#ffe0a8'),
    sunIntensity: 1.38,
    hemiSky: new THREE.Color('#b8e2ff'),
    hemiGround: new THREE.Color('#92ad70'),
    hemiIntensity: 0.9,
    nightFactor: 0.1,
    sunsetFactor: 0.4,
  },
  {
    t: 0.39,
    top: new THREE.Color('#3fa4f5'),
    horizon: new THREE.Color('#d4f2ff'),
    fog: new THREE.Color('#d0f0ff'),
    sunColor: new THREE.Color('#fff5d6'),
    sunIntensity: 1.65,
    hemiSky: new THREE.Color('#ace2ff'),
    hemiGround: new THREE.Color('#8ebb6a'),
    hemiIntensity: 0.98,
    nightFactor: 0.0,
    sunsetFactor: 0.08,
  },
  {
    t: 0.52,
    top: new THREE.Color('#369bf2'),
    horizon: new THREE.Color('#cceeff'),
    fog: new THREE.Color('#c8ecff'),
    sunColor: new THREE.Color('#fff9e5'),
    sunIntensity: 1.72,
    hemiSky: new THREE.Color('#b6e8ff'),
    hemiGround: new THREE.Color('#92c06f'),
    hemiIntensity: 1.02,
    nightFactor: 0.0,
    sunsetFactor: 0.0,
  },
  {
    t: 0.67,
    top: new THREE.Color('#509be8'),
    horizon: new THREE.Color('#ffe4b8'),
    fog: new THREE.Color('#f7e4c2'),
    sunColor: new THREE.Color('#ffdea0'),
    sunIntensity: 1.54,
    hemiSky: new THREE.Color('#b9daf9'),
    hemiGround: new THREE.Color('#9cae65'),
    hemiIntensity: 0.94,
    nightFactor: 0.05,
    sunsetFactor: 0.42,
  },
  {
    t: 0.77,
    top: new THREE.Color('#6662b5'),
    horizon: new THREE.Color('#ff9a70'),
    fog: new THREE.Color('#f29c7d'),
    sunColor: new THREE.Color('#ff965a'),
    sunIntensity: 1.18,
    hemiSky: new THREE.Color('#cc96ba'),
    hemiGround: new THREE.Color('#785e4d'),
    hemiIntensity: 0.82,
    nightFactor: 0.42,
    sunsetFactor: 1.0,
  },
  {
    t: 0.84,
    top: new THREE.Color('#253366'),
    horizon: new THREE.Color('#6c5991'),
    fog: new THREE.Color('#474578'),
    sunColor: new THREE.Color('#b8caff'),
    sunIntensity: 0.54,
    hemiSky: new THREE.Color('#6677b0'),
    hemiGround: new THREE.Color('#383e56'),
    hemiIntensity: 0.65,
    nightFactor: 0.85,
    sunsetFactor: 0.25,
  },
  {
    t: 1.0,
    top: new THREE.Color('#101938'),
    horizon: new THREE.Color('#223463'),
    fog: new THREE.Color('#1b2a52'),
    sunColor: new THREE.Color('#9abaff'),
    sunIntensity: 0.34,
    hemiSky: new THREE.Color('#3e5a99'),
    hemiGround: new THREE.Color('#1d2736'),
    hemiIntensity: 0.44,
    nightFactor: 1.0,
    sunsetFactor: 0.0,
  },
];

function createSoftHaloTexture(innerHex: string, midHex: string): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext('2d')!;
  const grad = ctx.createRadialGradient(64, 64, 2, 64, 64, 62);
  grad.addColorStop(0, innerHex);
  grad.addColorStop(0.35, midHex);
  grad.addColorStop(1, 'rgba(255, 220, 140, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class SkyAndLighting {
  private scene: THREE.Scene;
  private skyMesh!: THREE.Mesh;
  private skyMat: THREE.ShaderMaterial;
  private sunLight: THREE.DirectionalLight;
  private hemiLight: THREE.HemisphereLight;
  private fillLight: THREE.DirectionalLight;
  private sunMesh: THREE.Mesh;
  private sunHalo: THREE.Sprite;
  private moonMesh: THREE.Mesh;
  private stars: THREE.Points;
  private starMat: THREE.PointsMaterial;
  private cloudMat!: THREE.MeshStandardMaterial;
  private clouds: { group: THREE.Group; speed: number; angle: number; radius: number; y: number }[] = [];

  // Volumetric-style soft sunlight shafts (God Rays!)
  private sunShaftGroup = new THREE.Group();
  private sunShaftMat!: THREE.ShaderMaterial;
  private sunShafts: { mesh: THREE.Mesh; baseX: number; baseZ: number; phase: number }[] = [];

  private lanternLights: { light: THREE.PointLight; phase: number }[] = [];
  private lanternHalos: THREE.Sprite[] = [];
  private glowMaterials: THREE.MeshStandardMaterial[] = [];
  private lanternHaloTex: THREE.CanvasTexture;

  public normalizedTime = 0.385;
  public day = 1;
  public dayDurationSeconds = 260;
  public timeSpeedMultiplier = 1;
  public nightFactor = 0;
  public sunsetFactor = 0.08;
  public sunWorldPos = new THREE.Vector3(60, 80, -48);
  public currentSunColor = new THREE.Color('#fff5d6');

  private tempTop = new THREE.Color();
  private tempHorizon = new THREE.Color();
  private tempFog = new THREE.Color();
  private tempHemiSky = new THREE.Color();
  private tempHemiGround = new THREE.Color();

  constructor(scene: THREE.Scene, renderer?: THREE.WebGLRenderer) {
    this.scene = scene;
    this.lanternHaloTex = createSoftHaloTexture('rgba(255, 244, 196, 0.95)', 'rgba(255, 198, 102, 0.38)');

    // Optional soft procedural hemisphere sky/meadow environment map for rich specular reflections
    if (renderer) {
      this.setupSoftEnvironment(renderer);
    }

    // 1. Custom Gradient Storybook Sky Dome (follows camera position so it NEVER clips anywhere in the 600m world!)
    const skyGeo = new THREE.SphereGeometry(420, 28, 18);
    this.skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        uTopColor: { value: new THREE.Color('#3fa4f5') },
        uHorizonColor: { value: new THREE.Color('#d4f2ff') },
        uBottomColor: { value: new THREE.Color('#b6e0b8') },
        uSunDir: { value: new THREE.Vector3(0.4, 0.7, -0.4).normalize() },
        uSunColor: { value: new THREE.Color('#fff5d6') },
        uScatterStrength: { value: 0.42 },
      },
      vertexShader: `
        varying vec3 vWorldPos;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldPos = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: `
        uniform vec3 uTopColor;
        uniform vec3 uHorizonColor;
        uniform vec3 uBottomColor;
        uniform vec3 uSunDir;
        uniform vec3 uSunColor;
        uniform float uScatterStrength;
        varying vec3 vWorldPos;
        void main() {
          vec3 dir = normalize(vWorldPos);
          float h = dir.y;
          vec3 col = mix(uHorizonColor, uTopColor, pow(max(h, 0.0), 0.56));
          col = mix(col, uBottomColor, smoothstep(0.0, -0.22, h));
          // Soft atmospheric Mie-style solar halo scatter in the sky
          float sunAmt = max(dot(dir, normalize(uSunDir)), 0.0);
          col += uSunColor * (pow(sunAmt, 8.0) * 0.34 + pow(sunAmt, 42.0) * 0.5) * uScatterStrength;
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });
    this.skyMesh = new THREE.Mesh(skyGeo, this.skyMat);
    scene.add(this.skyMesh);

    // 2. Soft open-world horizon fog (blends distant streaming chunks seamlessly!)
    scene.fog = new THREE.Fog('#d0f0ff', 95, 340);

    // 3. Primary Sun / Moon Directional Light with crisp shadows (tuned resolution for smooth 60fps!)
    const isMobile =
      'ontouchstart' in window ||
      navigator.maxTouchPoints > 0 ||
      window.matchMedia('(pointer: coarse)').matches;
    const shadowRes = isMobile ? 1024 : 1536;
    this.sunLight = new THREE.DirectionalLight('#fff5d6', 1.65);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.set(shadowRes, shadowRes);
    this.sunLight.shadow.camera.near = 6;
    this.sunLight.shadow.camera.far = 128;
    const d = 40;
    this.sunLight.shadow.camera.left = -d;
    this.sunLight.shadow.camera.right = d;
    this.sunLight.shadow.camera.top = d;
    this.sunLight.shadow.camera.bottom = -d;
    this.sunLight.shadow.bias = -0.0004;
    this.sunLight.shadow.normalBias = 0.025;
    scene.add(this.sunLight);
    scene.add(this.sunLight.target);

    // Warm pastel sky/grass HemisphereLight
    this.hemiLight = new THREE.HemisphereLight('#ace2ff', '#8ebb6a', 0.98);
    scene.add(this.hemiLight);

    // Warm rim bounce light for lush stylized depth
    this.fillLight = new THREE.DirectionalLight('#ffe4c4', 0.34);
    this.fillLight.position.set(-28, 16, 26);
    scene.add(this.fillLight);

    // 4. Radiant Sun disc + soft sprite flare & Moon
    this.sunMesh = new THREE.Mesh(
      new THREE.SphereGeometry(7.0, 18, 16),
      new THREE.MeshBasicMaterial({ color: '#fffbe0', fog: false })
    );
    const sunFlareTex = createSoftHaloTexture('rgba(255, 252, 224, 0.95)', 'rgba(255, 224, 145, 0.32)');
    this.sunHalo = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: sunFlareTex,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        fog: false,
      })
    );
    this.sunHalo.scale.set(44, 44, 1);
    this.sunMesh.add(this.sunHalo);
    scene.add(this.sunMesh);

    this.moonMesh = new THREE.Mesh(
      new THREE.SphereGeometry(5.6, 16, 16),
      new THREE.MeshBasicMaterial({ color: '#fff6d6', fog: false })
    );
    const moonHalo = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: createSoftHaloTexture('rgba(220, 236, 255, 0.72)', 'rgba(155, 195, 255, 0.18)'),
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        fog: false,
      })
    );
    moonHalo.scale.set(28, 28, 1);
    this.moonMesh.add(moonHalo);
    scene.add(this.moonMesh);

    // 5. Twinkling Starfield
    const starCount = 420;
    const starPos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(0.14 + Math.random() * 0.86);
      const r = 188;
      starPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      starPos[i * 3 + 1] = r * Math.cos(phi);
      starPos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    this.starMat = new THREE.PointsMaterial({
      color: '#fffbe6',
      size: 2.1,
      transparent: true,
      opacity: 0,
      fog: false,
    });
    this.stars = new THREE.Points(starGeo, this.starMat);
    scene.add(this.stars);

    // 6. Puffy Storybook Clouds & Volumetric-style Sun Shafts (God Rays!)
    this.createClouds();
    this.createVolumetricSunShafts();
    this.applyLighting(0);
  }

  private setupSoftEnvironment(renderer: THREE.WebGLRenderer): void {
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envScene = new THREE.Scene();
    const envGeo = new THREE.SphereGeometry(20, 16, 12);
    const envMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      vertexShader: `
        varying vec3 vPos;
        void main() { vPos = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
      `,
      fragmentShader: `
        varying vec3 vPos;
        void main() {
          float h = normalize(vPos).y;
          vec3 sky = mix(vec3(0.84, 0.94, 1.0), vec3(0.45, 0.76, 0.98), clamp(h, 0.0, 1.0));
          vec3 ground = vec3(0.58, 0.72, 0.44);
          vec3 col = mix(ground, sky, smoothstep(-0.15, 0.25, h));
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });
    envScene.add(new THREE.Mesh(envGeo, envMat));
    const rt = pmrem.fromScene(envScene, 0.04);
    this.scene.environment = rt.texture;
    this.scene.environmentIntensity = 0.22;
    pmrem.dispose();
    envGeo.dispose();
    envMat.dispose();
  }

  private createClouds(): void {
    this.cloudMat = new THREE.MeshStandardMaterial({
      color: '#ffffff',
      roughness: 0.94,
      emissive: '#fff4e3',
      emissiveIntensity: 0.14,
      fog: false,
    });
    const puffGeo = new THREE.IcosahedronGeometry(1, 1);

    for (let i = 0; i < 16; i++) {
      const group = new THREE.Group();
      const puffCount = 3 + (i % 3);
      for (let p = 0; p < puffCount; p++) {
        const puff = new THREE.Mesh(puffGeo, this.cloudMat);
        const s = 3.2 + Math.random() * 2.8;
        puff.scale.set(s * 1.45, s * 0.78, s * 1.05);
        puff.position.set(
          (p - (puffCount - 1) * 0.5) * 4.2,
          (Math.random() - 0.3) * 1.3,
          (Math.random() - 0.5) * 2.2
        );
        group.add(puff);
      }
      const angle = (i / 16) * Math.PI * 2 + Math.random() * 0.3;
      const radius = 58 + Math.random() * 68;
      const y = 34 + Math.random() * 20;
      group.position.set(Math.cos(angle) * radius, y, Math.sin(angle) * radius);
      this.scene.add(group);
      this.clouds.push({
        group,
        speed: 0.008 + Math.random() * 0.007,
        angle,
        radius,
        y,
      });
    }
  }

  private createVolumetricSunShafts(): void {
    this.sunShaftMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uColor: { value: new THREE.Color('#fff2c2') },
        uOpacity: { value: 0.1 },
        uTime: { value: 0 },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        uniform float uOpacity;
        uniform float uTime;
        varying vec2 vUv;
        void main() {
          // Soft horizontal beam center + smooth vertical fade at both top & ground
          float horiz = sin(vUv.x * 3.14159265);
          horiz = pow(max(horiz, 0.0), 2.1);
          float vert = smoothstep(0.0, 0.32, vUv.y) * smoothstep(1.0, 0.18, vUv.y);
          float shimmer = 0.86 + 0.14 * sin(vUv.x * 9.0 + uTime * 0.65);
          float alpha = horiz * vert * shimmer * uOpacity;
          gl_FragColor = vec4(uColor, alpha);
        }
      `,
    });

    const shaftSpots: [number, number, number, number][] = [
      [0, 14.5, 4.2, 20],      // Entrance lane golden shaft
      [-9.0, 7.2, 5.2, 22],    // Vegetable Garden sunbeam
      [11.5, 7.5, 5.4, 22],    // Animal Pasture sunbeam
      [-5.5, -16.5, 5.8, 24],  // Duck Pond shimmering beam
      [-13.5, -3.5, 4.6, 21],  // Farmhouse porch light shaft
      [14.5, -15.5, 5.2, 23],  // Windmill & Barn light shaft
    ];

    shaftSpots.forEach(([x, z, w, h], idx) => {
      // Lift cleanly above ground (y = h*0.5 + 0.6) so transparent shafts never slice or flicker against the floor!
      const planeGeo = new THREE.PlaneGeometry(w, h);
      const shaftA = new THREE.Mesh(planeGeo, this.sunShaftMat);
      shaftA.position.set(x, h * 0.5 + 0.6, z);
      shaftA.renderOrder = 2;
      const shaftB = new THREE.Mesh(planeGeo, this.sunShaftMat);
      shaftB.rotation.y = Math.PI * 0.5;
      shaftB.renderOrder = 2;
      shaftA.add(shaftB);
      this.sunShaftGroup.add(shaftA);
      this.sunShafts.push({ mesh: shaftA, baseX: x, baseZ: z, phase: idx * 1.1 });
    });

    this.scene.add(this.sunShaftGroup);
  }

  public registerNightLight(light: THREE.PointLight): void {
    light.intensity = 0;
    this.lanternLights.push({ light, phase: this.lanternLights.length * 1.7 });
  }

  public createLanternHaloSprite(scale = 1.65): THREE.Sprite {
    const mat = new THREE.SpriteMaterial({
      map: this.lanternHaloTex,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(scale, scale, 1);
    this.lanternHalos.push(sprite);
    return sprite;
  }

  public registerGlowMaterial(mat: THREE.MeshStandardMaterial): void {
    this.glowMaterials.push(mat);
  }

  public setTimePreset(preset: 'morning' | 'noon' | 'sunset' | 'night'): void {
    const map: Record<typeof preset, number> = {
      morning: 0.36,
      noon: 0.52,
      sunset: 0.765,
      night: 0.93,
    };
    this.normalizedTime = map[preset];
    this.applyLighting(0);
  }

  public getTimeInfo(): TimeOfDayInfo {
    const totalMinutes = Math.floor(this.normalizedTime * 24 * 60);
    const hours24 = Math.floor(totalMinutes / 60) % 24;
    const minutes = totalMinutes % 60;
    const suffix = hours24 >= 12 ? 'PM' : 'AM';
    const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
    const formattedTime = `${hours12}:${minutes.toString().padStart(2, '0')} ${suffix}`;

    let phase: TimeOfDayInfo['phase'] = 'Morning';
    if (hours24 >= 5 && hours24 < 7) phase = 'Dawn';
    else if (hours24 >= 7 && hours24 < 12) phase = 'Morning';
    else if (hours24 >= 12 && hours24 < 17) phase = 'Afternoon';
    else if (hours24 >= 17 && hours24 < 19) phase = 'Sunset';
    else if (hours24 >= 19 && hours24 < 21) phase = 'Twilight';
    else phase = 'Night';

    return {
      day: this.day,
      normalizedTime: this.normalizedTime,
      hours: hours24,
      minutes,
      formattedTime,
      phase,
      isNight: this.nightFactor > 0.55,
    };
  }

  public update(dt: number, elapsed: number, camPos?: THREE.Vector3): void {
    if (camPos && this.skyMesh) {
      this.skyMesh.position.set(camPos.x, 0, camPos.z);
    }
    this.normalizedTime += (dt * this.timeSpeedMultiplier) / this.dayDurationSeconds;
    if (this.normalizedTime >= 1) {
      this.normalizedTime -= 1;
      this.day += 1;
    }

    for (const c of this.clouds) {
      c.angle += c.speed * dt;
      c.group.position.set(
        Math.cos(c.angle) * c.radius,
        c.y + Math.sin(elapsed * 0.25 + c.angle) * 0.6,
        Math.sin(c.angle) * c.radius
      );
      c.group.lookAt(0, c.y, 0);
    }

    this.applyLighting(elapsed);
  }

  private applyLighting(elapsed: number): void {
    const t = this.normalizedTime;
    let a = SKY_KEYFRAMES[0];
    let b = SKY_KEYFRAMES[SKY_KEYFRAMES.length - 1];
    for (let i = 0; i < SKY_KEYFRAMES.length - 1; i++) {
      if (t >= SKY_KEYFRAMES[i].t && t <= SKY_KEYFRAMES[i + 1].t) {
        a = SKY_KEYFRAMES[i];
        b = SKY_KEYFRAMES[i + 1];
        break;
      }
    }
    const span = Math.max(0.0001, b.t - a.t);
    const f = (t - a.t) / span;

    this.tempTop.copy(a.top).lerp(b.top, f);
    this.tempHorizon.copy(a.horizon).lerp(b.horizon, f);
    this.tempFog.copy(a.fog).lerp(b.fog, f);
    this.currentSunColor.copy(a.sunColor).lerp(b.sunColor, f);
    this.tempHemiSky.copy(a.hemiSky).lerp(b.hemiSky, f);
    this.tempHemiGround.copy(a.hemiGround).lerp(b.hemiGround, f);

    const sunIntensity = THREE.MathUtils.lerp(a.sunIntensity, b.sunIntensity, f);
    const hemiIntensity = THREE.MathUtils.lerp(a.hemiIntensity, b.hemiIntensity, f);
    this.nightFactor = THREE.MathUtils.lerp(a.nightFactor, b.nightFactor, f);
    this.sunsetFactor = THREE.MathUtils.lerp(a.sunsetFactor, b.sunsetFactor, f);

    // Sun & Moon celestial arc
    const sunAngle = (t - 0.25) * Math.PI * 2;
    const skyR = 165;
    const sunX = Math.cos(sunAngle) * skyR;
    const sunY = Math.sin(sunAngle) * skyR;
    const sunZ = -48;

    this.sunWorldPos.set(sunX, sunY, sunZ);
    this.sunMesh.position.copy(this.sunWorldPos);
    this.sunMesh.visible = sunY > -18;
    this.sunHalo.material.opacity = Math.max(0, 1 - this.nightFactor * 1.1);

    const moonX = -sunX;
    const moonY = -sunY;
    const moonZ = 42;
    this.moonMesh.position.set(moonX, moonY, moonZ);
    this.moonMesh.visible = moonY > -15;

    // Update sky shader + atmospheric sun scatter
    this.skyMat.uniforms.uTopColor.value.copy(this.tempTop);
    this.skyMat.uniforms.uHorizonColor.value.copy(this.tempHorizon);
    this.skyMat.uniforms.uBottomColor.value.copy(this.tempFog);
    this.skyMat.uniforms.uSunDir.value.copy(this.sunWorldPos).normalize();
    this.skyMat.uniforms.uSunColor.value.copy(this.currentSunColor);
    this.skyMat.uniforms.uScatterStrength.value = (1 - this.nightFactor * 0.9) * (0.38 + this.sunsetFactor * 0.55);

    if (this.scene.fog instanceof THREE.Fog) {
      this.scene.fog.color.copy(this.tempFog);
    }

    // Shadow-casting directional light
    const lightDist = 52;
    if (sunY >= -4) {
      const elev = Math.max(0.24, Math.sin(sunAngle));
      this.sunLight.position.set(Math.cos(sunAngle) * lightDist, elev * lightDist, -22);
    } else {
      const moonElev = Math.max(0.28, -Math.sin(sunAngle));
      this.sunLight.position.set(-Math.cos(sunAngle) * lightDist, moonElev * lightDist, 20);
    }

    this.sunLight.color.copy(this.currentSunColor);
    this.sunLight.intensity = sunIntensity;
    this.hemiLight.color.copy(this.tempHemiSky);
    this.hemiLight.groundColor.copy(this.tempHemiGround);
    this.hemiLight.intensity = hemiIntensity * 0.84;
    this.fillLight.intensity = 0.24 * (1 - this.nightFactor * 0.78);
    // Crucial: scale IBL environment reflection down dramatically at dusk/night for rich starry contrast!
    this.scene.environmentIntensity = THREE.MathUtils.lerp(0.22, 0.03, this.nightFactor);

    // Tint clouds smoothly from sunlit white -> warm apricot sunset -> soft twilight blue-indigo at night!
    if (this.cloudMat) {
      this.cloudMat.color
        .set('#ffffff')
        .lerp(new THREE.Color('#ffd3b6'), this.sunsetFactor * 0.65)
        .lerp(new THREE.Color('#475c8f'), this.nightFactor * 0.85);
      this.cloudMat.emissiveIntensity = 0.12 * (1 - this.nightFactor * 0.9);
    }

    // Volumetric sun shafts lean smoothly along sun angle!
    this.sunShaftMat.uniforms.uTime.value = elapsed;
    this.sunShaftMat.uniforms.uColor.value.copy(this.currentSunColor);
    const rayStrength =
      this.nightFactor > 0.65
        ? 0.032 // subtle silver moonbeams at night
        : 0.06 + this.sunsetFactor * 0.07; // crisp warm golden god rays without washing out contrast!
    this.sunShaftMat.uniforms.uOpacity.value = rayStrength;
    const leanZ = THREE.MathUtils.clamp(-Math.cos(sunAngle) * 0.42, -0.45, 0.45);
    for (const s of this.sunShafts) {
      s.mesh.rotation.z = leanZ;
      s.mesh.rotation.x = 0.14;
      s.mesh.position.x = s.baseX + Math.sin(elapsed * 0.18 + s.phase) * 0.5;
    }

    // Twinkling stars
    this.starMat.opacity = Math.max(0, (this.nightFactor - 0.32) * 1.45);
    this.stars.rotation.y = t * 0.6;

    // Warm lanterns, glowing sprites & farmhouse windows with cozy gentle flicker!
    const lampStrength = THREE.MathUtils.smoothstep(this.nightFactor, 0.22, 0.68);
    for (const entry of this.lanternLights) {
      const flicker = 0.92 + 0.08 * Math.sin(elapsed * 5.2 + entry.phase) + 0.04 * Math.sin(elapsed * 11.7 + entry.phase);
      entry.light.intensity = lampStrength * 5.2 * flicker;
    }
    for (const halo of this.lanternHalos) {
      halo.material.opacity = lampStrength * 0.68;
    }
    for (const mat of this.glowMaterials) {
      mat.emissiveIntensity = 0.12 + lampStrength * 2.4;
    }
  }
}
