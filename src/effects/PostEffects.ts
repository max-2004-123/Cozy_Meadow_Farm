import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

const CozyGradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uSunScreenPos: { value: new THREE.Vector2(0.5, 0.7) },
    uSunGlow: { value: 0.25 },
    uSunColor: { value: new THREE.Color('#ffe5a8') },
    uWarmth: { value: 0.08 },
    uNightFactor: { value: 0.0 },
    uVignette: { value: 0.22 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform vec2 uSunScreenPos;
    uniform float uSunGlow;
    uniform vec3 uSunColor;
    uniform float uWarmth;
    uniform float uNightFactor;
    uniform float uVignette;
    varying vec2 vUv;

    void main() {
      vec4 texel = texture2D(tDiffuse, vUv);
      vec3 col = texel.rgb;

      // Subtle storybook contrast & shadow tint (keeps shadows deep & colors juicy!)
      float luma = dot(col, vec3(0.299, 0.587, 0.114));
      vec3 dayShadowTint = vec3(0.01, 0.006, 0.016);
      vec3 nightShadowTint = vec3(0.004, 0.01, 0.026);
      vec3 shadowTint = mix(dayShadowTint, nightShadowTint, uNightFactor);
      col += shadowTint * smoothstep(0.35, 0.0, luma);

      // Gentle pastel saturation boost so meadow greens & flowers pop vibrantly!
      float sat = mix(1.12, 1.06, uNightFactor);
      col = mix(vec3(luma), col, sat);

      // Gentle golden-hour warmth
      vec3 warmGrade = vec3(1.0 + uWarmth * 0.32, 1.0 + uWarmth * 0.1, 1.0 - uWarmth * 0.16);
      vec3 nightGrade = vec3(0.92, 0.96, 1.08);
      col *= mix(warmGrade, nightGrade, uNightFactor * 0.72);

      // Soft atmospheric sun-bloom veil when looking toward the sun
      if (uSunGlow > 0.005) {
        vec2 aspectUv = vUv - uSunScreenPos;
        aspectUv.x *= 1.45;
        float d = length(aspectUv);
        float radial = exp(-d * 3.2) * 0.14 + exp(-d * 8.5) * 0.18;
        col += uSunColor * radial * uSunGlow;
      }

      // Very soft storybook edge vignette
      vec2 centered = vUv - 0.5;
      float vig = 1.0 - dot(centered, centered) * uVignette * 1.75;
      col *= clamp(vig, 0.78, 1.0);

      gl_FragColor = vec4(col, texel.a);
    }
  `,
};

export class PostEffects {
  private composer: EffectComposer;
  private bloomPass: UnrealBloomPass;
  private gradePass: ShaderPass;
  public enabled = true;

  private projVec = new THREE.Vector3();
  private camDir = new THREE.Vector3();
  private toSun = new THREE.Vector3();

  constructor(
    private renderer: THREE.WebGLRenderer,
    private scene: THREE.Scene,
    private camera: THREE.PerspectiveCamera
  ) {
    const size = new THREE.Vector2();
    renderer.getSize(size);

    const isMobile =
      'ontouchstart' in window ||
      navigator.maxTouchPoints > 0 ||
      window.matchMedia('(pointer: coarse)').matches;

    this.composer = new EffectComposer(renderer);
    this.composer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.0 : 1.25));
    this.composer.setSize(size.x, size.y);
    // Default off on mobile touch devices for silky 60fps (can still toggle ON in ⚙️ menu!)
    if (isMobile) {
      this.enabled = false;
    }

    const renderPass = new RenderPass(scene, camera);
    this.composer.addPass(renderPass);

    // Half-resolution HDR-only velvety bloom (cuts GPU fillrate by ~75% while staying soft & dreamy!)
    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(Math.max(1, Math.floor(size.x * 0.5)), Math.max(1, Math.floor(size.y * 0.5))),
      0.22, // strength
      0.45, // radius
      1.06  // threshold
    );
    this.composer.addPass(this.bloomPass);

    // Custom cozy storybook color grading + sun lens warmth + gentle vignette
    this.gradePass = new ShaderPass(CozyGradeShader);
    this.composer.addPass(this.gradePass);

    // Proper sRGB + ACES tone mapping output pass
    const outputPass = new OutputPass();
    this.composer.addPass(outputPass);
  }

  public setSize(width: number, height: number): void {
    this.composer.setSize(width, height);
    this.bloomPass.resolution.set(Math.max(1, Math.floor(width * 0.5)), Math.max(1, Math.floor(height * 0.5)));
  }

  public update(
    sunWorldPos: THREE.Vector3,
    sunColor: THREE.Color,
    nightFactor: number,
    sunsetFactor: number
  ): void {
    // Bloom stays crisp by day and becomes warm & magical around lanterns/windows/fireflies at sunset & night!
    this.bloomPass.strength = THREE.MathUtils.lerp(0.2, 0.42, Math.max(nightFactor * 0.95, sunsetFactor * 0.65));
    this.bloomPass.threshold = THREE.MathUtils.lerp(1.08, 0.92, nightFactor);

    // Project sun to screen space for subtle soft lens glow when gazing near the sun
    this.camera.getWorldDirection(this.camDir);
    this.toSun.copy(sunWorldPos).sub(this.camera.position).normalize();
    const facingDot = this.camDir.dot(this.toSun);

    if (facingDot > 0.25 && sunWorldPos.y > -8) {
      this.projVec.copy(sunWorldPos).project(this.camera);
      this.gradePass.uniforms.uSunScreenPos.value.set(
        this.projVec.x * 0.5 + 0.5,
        this.projVec.y * 0.5 + 0.5
      );
      const visibility = THREE.MathUtils.smoothstep(facingDot, 0.25, 0.96) * (1 - nightFactor * 0.85);
      this.gradePass.uniforms.uSunGlow.value = visibility * (0.48 + sunsetFactor * 0.45);
    } else {
      this.gradePass.uniforms.uSunGlow.value = 0;
    }

    this.gradePass.uniforms.uSunColor.value.copy(sunColor);
    this.gradePass.uniforms.uWarmth.value = 0.08 + sunsetFactor * 0.22;
    this.gradePass.uniforms.uNightFactor.value = nightFactor;
  }

  public render(): void {
    if (this.enabled) {
      this.composer.render();
    } else {
      this.renderer.render(this.scene, this.camera);
    }
  }
}
