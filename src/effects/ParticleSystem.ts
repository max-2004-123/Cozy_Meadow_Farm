import * as THREE from 'three';

type ParticleKind = 'water' | 'soil' | 'heart' | 'sparkle' | 'smoke' | 'crumb';

interface Particle {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  age: number;
  maxAge: number;
  gravity: number;
  startScale: number;
  endScale: number;
  spin: number;
  kind: ParticleKind;
}

interface AmbientFloat {
  mesh: THREE.Mesh;
  basePos: THREE.Vector3;
  phase: number;
  radius: number;
  speed: number;
}

export class ParticleSystem {
  private group = new THREE.Group();
  private particles: Particle[] = [];

  private sphereGeo = new THREE.SphereGeometry(0.08, 7, 6);
  private boxGeo = new THREE.DodecahedronGeometry(0.075, 0);
  private heartGeo: THREE.ExtrudeGeometry;
  private starGeo = new THREE.OctahedronGeometry(0.09, 0);

  private waterMat = new THREE.MeshStandardMaterial({
    color: '#7cd8ff',
    emissive: '#3a9fd1',
    emissiveIntensity: 0.45,
    roughness: 0.15,
  });
  private soilMat = new THREE.MeshStandardMaterial({ color: '#8a5d3b', roughness: 0.95 });
  private crumbMat = new THREE.MeshStandardMaterial({ color: '#f3cb62', roughness: 0.8 });
  private heartMat = new THREE.MeshStandardMaterial({
    color: '#ff7ca8',
    emissive: '#ff528a',
    emissiveIntensity: 0.55,
    roughness: 0.35,
  });
  private sparkleMat = new THREE.MeshStandardMaterial({
    color: '#ffe885',
    emissive: '#ffd24d',
    emissiveIntensity: 1.25,
    roughness: 0.2,
  });
  private smokeMat = new THREE.MeshStandardMaterial({
    color: '#fff9f2',
    roughness: 1,
    transparent: true,
    opacity: 0.65,
  });

  // Glowing evening fireflies
  private fireflies: AmbientFloat[] = [];
  private fireflyMat = new THREE.MeshBasicMaterial({
    color: '#fff3a3',
    transparent: true,
    opacity: 0,
  });

  // Daytime sunlit golden dust motes
  private sunMotes: AmbientFloat[] = [];
  private sunMoteMat = new THREE.MeshBasicMaterial({
    color: '#fff4c4',
    transparent: true,
    opacity: 0.65,
  });

  // Drifting pastel cherry blossom petals!
  private petals: { mesh: THREE.Mesh; origin: THREE.Vector3; age: number; life: number; sway: number }[] = [];
  private petalMat = new THREE.MeshStandardMaterial({
    color: '#ffb7cf',
    emissive: '#ff8fb3',
    emissiveIntensity: 0.18,
    roughness: 0.5,
    side: THREE.DoubleSide,
  });

  constructor(scene: THREE.Scene) {
    const shape = new THREE.Shape();
    shape.moveTo(0, -0.1);
    shape.bezierCurveTo(0.14, 0.02, 0.16, 0.16, 0.06, 0.18);
    shape.bezierCurveTo(0.02, 0.19, 0, 0.14, 0, 0.12);
    shape.bezierCurveTo(0, 0.14, -0.02, 0.19, -0.06, 0.18);
    shape.bezierCurveTo(-0.16, 0.16, -0.14, 0.02, 0, -0.1);
    this.heartGeo = new THREE.ExtrudeGeometry(shape, {
      depth: 0.05,
      bevelEnabled: true,
      bevelThickness: 0.02,
      bevelSize: 0.015,
      bevelSegments: 2,
    });
    this.heartGeo.center();

    this.initFireflies();
    this.initSunMotes();
    this.initBlossomPetals();
    scene.add(this.group);
  }

  private initFireflies(): void {
    const geo = new THREE.SphereGeometry(0.068, 6, 5);
    const centers = [
      new THREE.Vector3(-5.5, 1.3, -15.5),
      new THREE.Vector3(-9.0, 1.2, 7.0),
      new THREE.Vector3(9.5, 1.4, 8.0),
      new THREE.Vector3(-12.0, 1.5, -13.0),
      new THREE.Vector3(2.0, 1.3, -12.0),
    ];

    for (let i = 0; i < 42; i++) {
      const c = centers[i % centers.length];
      const basePos = new THREE.Vector3(
        c.x + (Math.random() - 0.5) * 12,
        0.65 + Math.random() * 2.1,
        c.z + (Math.random() - 0.5) * 12
      );
      const mesh = new THREE.Mesh(geo, this.fireflyMat);
      mesh.position.copy(basePos);
      this.group.add(mesh);
      this.fireflies.push({
        mesh,
        basePos,
        phase: Math.random() * Math.PI * 2,
        radius: 0.55 + Math.random() * 1.1,
        speed: 0.65 + Math.random() * 0.4,
      });
    }
  }

  private initSunMotes(): void {
    const geo = new THREE.SphereGeometry(0.036, 5, 4);
    for (let i = 0; i < 55; i++) {
      const basePos = new THREE.Vector3(
        (Math.random() - 0.5) * 44,
        0.9 + Math.random() * 4.5,
        -18 + Math.random() * 40
      );
      const mesh = new THREE.Mesh(geo, this.sunMoteMat);
      mesh.position.copy(basePos);
      this.group.add(mesh);
      this.sunMotes.push({
        mesh,
        basePos,
        phase: Math.random() * Math.PI * 2,
        radius: 0.8 + Math.random() * 1.4,
        speed: 0.35 + Math.random() * 0.3,
      });
    }
  }

  private initBlossomPetals(): void {
    const petalGeo = new THREE.PlaneGeometry(0.09, 0.06);
    const blossomCenters = [
      new THREE.Vector3(-10.5, 4.4, 21.5),
      new THREE.Vector3(-17.2, 4.4, -16.2),
      new THREE.Vector3(1.8, 4.5, -25.2),
      new THREE.Vector3(-24.2, 4.8, -5.5),
    ];
    for (let i = 0; i < 36; i++) {
      const origin = blossomCenters[i % blossomCenters.length].clone().add(
        new THREE.Vector3((Math.random() - 0.5) * 4.5, Math.random() * 1.4, (Math.random() - 0.5) * 4.5)
      );
      const mesh = new THREE.Mesh(petalGeo, this.petalMat);
      this.group.add(mesh);
      const life = 5.5 + Math.random() * 3.5;
      this.petals.push({
        mesh,
        origin,
        age: Math.random() * life,
        life,
        sway: Math.random() * Math.PI * 2,
      });
    }
  }

  public spawnWaterSplash(pos: THREE.Vector3, count = 18): void {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spd = 0.6 + Math.random() * 1.5;
      this.addParticle({
        geo: this.sphereGeo,
        mat: this.waterMat,
        pos: pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.55, 0.35 + Math.random() * 0.3, (Math.random() - 0.5) * 0.55)),
        vel: new THREE.Vector3(Math.cos(angle) * spd, 1.1 + Math.random() * 1.4, Math.sin(angle) * spd),
        maxAge: 0.45 + Math.random() * 0.3,
        gravity: 5.8,
        startScale: 0.8 + Math.random() * 0.5,
        endScale: 0.15,
        spin: 2,
        kind: 'water',
      });
    }
  }

  public spawnSoilBurst(pos: THREE.Vector3, count = 14): void {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spd = 0.5 + Math.random() * 1.6;
      this.addParticle({
        geo: this.boxGeo,
        mat: this.soilMat,
        pos: pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.8, 0.15, (Math.random() - 0.5) * 0.8)),
        vel: new THREE.Vector3(Math.cos(angle) * spd, 1.5 + Math.random() * 1.4, Math.sin(angle) * spd),
        maxAge: 0.5 + Math.random() * 0.35,
        gravity: 6.5,
        startScale: 0.9 + Math.random() * 0.6,
        endScale: 0.1,
        spin: 6,
        kind: 'soil',
      });
    }
  }

  public spawnFeedCrumbs(pos: THREE.Vector3, count = 10): void {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spd = 0.4 + Math.random() * 1.1;
      this.addParticle({
        geo: this.boxGeo,
        mat: this.crumbMat,
        pos: pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.3, 0.18, (Math.random() - 0.5) * 0.3)),
        vel: new THREE.Vector3(Math.cos(angle) * spd, 1.1 + Math.random() * 0.9, Math.sin(angle) * spd),
        maxAge: 0.4 + Math.random() * 0.25,
        gravity: 5.2,
        startScale: 0.65,
        endScale: 0.1,
        spin: 5,
        kind: 'crumb',
      });
    }
  }

  public spawnHearts(pos: THREE.Vector3, count = 5): void {
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.4;
      this.addParticle({
        geo: this.heartGeo,
        mat: this.heartMat,
        pos: pos.clone().add(new THREE.Vector3(Math.cos(angle) * 0.25, 0.3 + Math.random() * 0.25, Math.sin(angle) * 0.25)),
        vel: new THREE.Vector3(Math.cos(angle) * 0.35, 1.1 + Math.random() * 0.5, Math.sin(angle) * 0.35),
        maxAge: 1.15 + Math.random() * 0.35,
        gravity: -0.35,
        startScale: 0.6 + Math.random() * 0.3,
        endScale: 1.25,
        spin: 2.2,
        kind: 'heart',
      });
    }
  }

  public spawnSparkles(pos: THREE.Vector3, count = 12): void {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spd = 0.45 + Math.random() * 1.2;
      this.addParticle({
        geo: this.starGeo,
        mat: this.sparkleMat,
        pos: pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.6, 0.25 + Math.random() * 0.4, (Math.random() - 0.5) * 0.6)),
        vel: new THREE.Vector3(Math.cos(angle) * spd, 1.2 + Math.random() * 1.1, Math.sin(angle) * spd),
        maxAge: 0.7 + Math.random() * 0.4,
        gravity: 1.2,
        startScale: 1.0,
        endScale: 0.05,
        spin: 7,
        kind: 'sparkle',
      });
    }
  }

  public spawnChimneySmoke(pos: THREE.Vector3): void {
    const mat = this.smokeMat.clone();
    this.addParticle({
      geo: this.sphereGeo,
      mat,
      pos: pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.25, 0, (Math.random() - 0.5) * 0.25)),
      vel: new THREE.Vector3(0.32 + Math.random() * 0.18, 0.95 + Math.random() * 0.35, -0.15 + Math.random() * 0.2),
      maxAge: 3.6 + Math.random() * 1.0,
      gravity: -0.05,
      startScale: 2.2,
      endScale: 6.4,
      spin: 0.6,
      kind: 'smoke',
    });
  }

  private addParticle(opts: {
    geo: THREE.BufferGeometry;
    mat: THREE.Material;
    pos: THREE.Vector3;
    vel: THREE.Vector3;
    maxAge: number;
    gravity: number;
    startScale: number;
    endScale: number;
    spin: number;
    kind: ParticleKind;
  }): void {
    if (this.particles.length > 260) {
      const oldest = this.particles.shift();
      if (oldest) {
        this.group.remove(oldest.mesh);
        if (oldest.kind === 'smoke') (oldest.mesh.material as THREE.Material).dispose();
      }
    }
    const mesh = new THREE.Mesh(opts.geo, opts.mat);
    mesh.position.copy(opts.pos);
    mesh.scale.setScalar(opts.startScale);
    this.group.add(mesh);
    this.particles.push({
      mesh,
      vel: opts.vel,
      age: 0,
      maxAge: opts.maxAge,
      gravity: opts.gravity,
      startScale: opts.startScale,
      endScale: opts.endScale,
      spin: opts.spin,
      kind: opts.kind,
    });
  }

  public update(dt: number, elapsed: number, nightFactor: number): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.age += dt;
      if (p.age >= p.maxAge) {
        this.group.remove(p.mesh);
        if (p.kind === 'smoke') (p.mesh.material as THREE.Material).dispose();
        this.particles.splice(i, 1);
        continue;
      }

      const t = p.age / p.maxAge;
      p.vel.y -= p.gravity * dt;
      p.mesh.position.addScaledVector(p.vel, dt);

      if (p.kind === 'water' || p.kind === 'soil' || p.kind === 'crumb') {
        if (p.mesh.position.y < 0.05) {
          p.mesh.position.y = 0.05;
          p.vel.y *= -0.25;
          p.vel.x *= 0.6;
          p.vel.z *= 0.6;
        }
      }

      const scale = p.startScale + (p.endScale - p.startScale) * t;
      if (p.kind === 'heart') {
        const s = t < 0.2 ? scale * (t / 0.2) : t > 0.78 ? scale * (1 - (t - 0.78) / 0.22) : scale;
        p.mesh.scale.setScalar(Math.max(0.01, s));
      } else {
        p.mesh.scale.setScalar(Math.max(0.01, scale));
      }

      if (p.kind === 'smoke') {
        const mat = p.mesh.material as THREE.MeshStandardMaterial;
        mat.opacity = Math.max(0, 0.55 * (1 - t));
      }

      p.mesh.rotation.y += p.spin * dt;
      if (p.kind !== 'heart') {
        p.mesh.rotation.x += p.spin * 0.5 * dt;
      }
    }

    // Glowing evening fireflies
    this.fireflyMat.opacity = Math.max(0, Math.min(0.98, (nightFactor - 0.2) * 1.45));
    if (this.fireflyMat.opacity > 0.02) {
      for (const f of this.fireflies) {
        const t = elapsed * f.speed + f.phase;
        f.mesh.position.x = f.basePos.x + Math.sin(t) * f.radius;
        f.mesh.position.y = f.basePos.y + Math.sin(t * 1.7 + 1.2) * 0.35;
        f.mesh.position.z = f.basePos.z + Math.cos(t * 0.9) * f.radius;
        const pulse = 0.65 + 0.55 * Math.sin(elapsed * 3.8 + f.phase * 2);
        f.mesh.scale.setScalar(pulse);
      }
    }

    // Daytime golden sunlit dust motes
    this.sunMoteMat.opacity = Math.max(0, (1 - nightFactor * 1.25) * 0.62);
    if (this.sunMoteMat.opacity > 0.02) {
      for (const m of this.sunMotes) {
        const t = elapsed * m.speed + m.phase;
        m.mesh.position.x = m.basePos.x + Math.sin(t) * m.radius;
        m.mesh.position.y = m.basePos.y + Math.sin(t * 1.3 + 0.7) * 0.45;
        m.mesh.position.z = m.basePos.z + Math.cos(t * 0.85) * m.radius;
      }
    }

    // Drifting pastel cherry blossom petals
    for (const pt of this.petals) {
      pt.age += dt;
      if (pt.age >= pt.life) pt.age -= pt.life;
      const f = pt.age / pt.life;
      pt.mesh.position.set(
        pt.origin.x + f * 3.4 + Math.sin(elapsed * 1.4 + pt.sway) * 0.65,
        Math.max(0.06, pt.origin.y * (1 - f * 0.96)),
        pt.origin.z + f * 1.6 + Math.cos(elapsed * 1.1 + pt.sway) * 0.55
      );
      pt.mesh.rotation.set(elapsed * 1.3 + pt.sway, elapsed * 1.8, Math.sin(elapsed * 2 + pt.sway));
    }
  }
}
