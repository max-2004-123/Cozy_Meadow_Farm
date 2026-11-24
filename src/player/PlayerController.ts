import * as THREE from 'three';
import { WORLD_CONFIG } from '../config/farmConfig';
import { InteractableTarget } from '../types';
import { CollisionSystem } from '../world/CollisionSystem';
import { SoundManager } from '../audio/SoundManager';

const SENSITIVITY_STORAGE_KEY = 'sunnybrook_mouse_sensitivity';
const MIN_PITCH = -1.18; // ~ -67.6 deg (easily looks down at soil plots & chickens without floor-pole lock)
const MAX_PITCH = 1.22;  // ~ +70 deg

export class PlayerController {
  public position = new THREE.Vector3(
    WORLD_CONFIG.spawnPos.x,
    WORLD_CONFIG.spawnPos.y,
    WORLD_CONFIG.spawnPos.z
  );
  public yaw = WORLD_CONFIG.spawnYaw;
  public pitch = -0.06;
  private targetYaw = WORLD_CONFIG.spawnYaw;
  private targetPitch = -0.06;

  public isLocked = false;
  public isSprinting = false;
  public moveSpeedFactor = 0;
  public sensitivityMultiplier = 1.0;

  private eyeHeight = WORLD_CONFIG.spawnPos.y;
  private velY = 0;
  private isGrounded = true;
  private walkDist = 0;
  private stepDist = 0;
  private keys = new Set<string>();
  private allowGameplay = false;
  private lockTimestamp = 0;

  // Bulletproof pointer drag-look + short-click fallback when pointer lock isn't engaged
  private activePointerId: number | null = null;
  private pointerButton = -1;
  private dragStartX = 0;
  private dragStartY = 0;
  private lastDragX = 0;
  private lastDragY = 0;
  private draggedDistance = 0;

  private raycaster = new THREE.Raycaster();
  private screenCenter = new THREE.Vector2(0, 0);
  public currentTarget: InteractableTarget | null = null;

  private onLockChange?: (locked: boolean) => void;
  private onInteract?: () => void;

  constructor(
    private camera: THREE.PerspectiveCamera,
    private domElement: HTMLElement,
    private collisions: CollisionSystem,
    private sound: SoundManager,
    callbacks: {
      onLockChange?: (locked: boolean) => void;
      onInteract?: () => void;
    }
  ) {
    this.onLockChange = callbacks.onLockChange;
    this.onInteract = callbacks.onInteract;
    this.sensitivityMultiplier = this.loadSavedSensitivity();
    this.camera.rotation.order = 'YXZ';
    this.syncCamera(0);
    this.bindEvents();
  }

  private loadSavedSensitivity(): number {
    try {
      const raw = localStorage.getItem(SENSITIVITY_STORAGE_KEY);
      if (raw) {
        const parsed = parseFloat(raw);
        if (Number.isFinite(parsed)) {
          return THREE.MathUtils.clamp(parsed, 0.2, 2.0);
        }
      }
    } catch {
      // Ignore storage restrictions
    }
    return 1.0;
  }

  public setSensitivity(mult: number): void {
    this.sensitivityMultiplier = THREE.MathUtils.clamp(mult, 0.2, 2.0);
    try {
      localStorage.setItem(SENSITIVITY_STORAGE_KEY, this.sensitivityMultiplier.toFixed(2));
    } catch {
      // Ignore storage restrictions
    }
  }

  public recenterView(): void {
    this.pitch = -0.06;
    this.targetPitch = -0.06;
  }

  public requestLock(): void {
    this.sound.init();
    if (document.pointerLockElement === this.domElement) return;
    if (typeof this.domElement.requestPointerLock !== 'function') return;

    try {
      // Request unadjustedMovement on Chromium to avoid Windows OS acceleration & warp-jump spikes
      const fn = this.domElement.requestPointerLock as (opts?: { unadjustedMovement?: boolean }) => Promise<void> | void;
      const res = fn.call(this.domElement, { unadjustedMovement: true });
      if (res && typeof res.catch === 'function') {
        res.catch(() => {
          // Retry standard pointer lock if unadjustedMovement is unsupported; silently fall back to drag-look if blocked
          try {
            const fallback = this.domElement.requestPointerLock() as unknown as Promise<void> | undefined;
            fallback?.catch?.(() => {});
          } catch {
            // Drag-look fallback stays active
          }
        });
      }
    } catch {
      try {
        const fallback = this.domElement.requestPointerLock() as unknown as Promise<void> | undefined;
        fallback?.catch?.(() => {});
      } catch {
        // Drag-look fallback stays active
      }
    }
  }

  public releaseLock(): void {
    if (document.pointerLockElement === this.domElement) {
      document.exitPointerLock?.();
    }
  }

  private isInteractiveHudElement(target: EventTarget | null): boolean {
    if (!(target instanceof Element)) return false;
    return Boolean(target.closest('button, input, .hotbar, .time-pill, .modal-card'));
  }

  private bindEvents(): void {
    document.addEventListener('pointerlockchange', () => {
      const wasLocked = this.isLocked;
      this.isLocked = document.pointerLockElement === this.domElement;
      if (this.isLocked) {
        this.lockTimestamp = performance.now();
        this.activePointerId = null;
      } else {
        this.keys.clear();
      }
      if (wasLocked !== this.isLocked) {
        this.onLockChange?.(this.isLocked);
      }
    });

    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      if (this.allowGameplay && e.code === 'KeyE') {
        this.sound.init();
        this.onInteract?.();
      }
      if (this.allowGameplay && e.code === 'KeyC') {
        this.recenterView();
      }
      if (this.allowGameplay && e.code === 'Space' && this.isGrounded) {
        this.velY = 5.4;
        this.isGrounded = false;
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
    });

    window.addEventListener('blur', () => {
      this.keys.clear();
      this.activePointerId = null;
    });

    // Pointer-lock mouse look: crisp 1:1 immediate tracking (zero lag behind mouse!)
    document.addEventListener('mousemove', (e) => {
      if (!this.isLocked || !this.allowGameplay) return;

      // Ignore the single spurious jump fired immediately when pointer lock engages
      if (performance.now() - this.lockTimestamp < 50) return;

      const mx = e.movementX;
      const my = e.movementY;

      // Only reject true OS cursor-warp anomalies (> 450px in one event), never normal fast flicks!
      if (Math.abs(mx) > 450 || Math.abs(my) > 450) return;

      const clampedX = THREE.MathUtils.clamp(mx, -240, 240);
      const clampedY = THREE.MathUtils.clamp(my, -240, 240);
      const sensitivity = 0.0018 * this.sensitivityMultiplier;

      this.yaw -= clampedX * sensitivity;
      this.pitch = THREE.MathUtils.clamp(
        this.pitch - clampedY * sensitivity,
        MIN_PITCH,
        MAX_PITCH
      );
      this.targetYaw = this.yaw;
      this.targetPitch = this.pitch;
      this.camera.rotation.y = this.yaw;
      this.camera.rotation.x = this.pitch;
    });

    // Unified Pointer events for unlocked drag-look & interaction (never gets trapped at bottom edge or over HUD!)
    window.addEventListener('pointerdown', (e) => {
      if (!this.allowGameplay) return;
      if (this.isInteractiveHudElement(e.target)) return;
      this.sound.init();

      if (this.isLocked) {
        if (e.button === 0) {
          this.onInteract?.();
        }
        return;
      }

      if (e.button === 0 || e.button === 2) {
        // Attempt pointer lock cleanly on left-click into the canvas; if blocked, drag-look handles it seamlessly
        if (e.button === 0 && e.target === this.domElement) {
          this.requestLock();
        }
        this.activePointerId = e.pointerId;
        this.pointerButton = e.button;
        this.dragStartX = e.clientX;
        this.dragStartY = e.clientY;
        this.lastDragX = e.clientX;
        this.lastDragY = e.clientY;
        this.draggedDistance = 0;
        try {
          this.domElement.setPointerCapture?.(e.pointerId);
        } catch {
          // Ignore if capture isn't permitted
        }
      }
    });

    window.addEventListener('pointermove', (e) => {
      if (this.isLocked || !this.allowGameplay) return;
      if (this.activePointerId !== e.pointerId) return;

      const dx = e.clientX - this.lastDragX;
      const dy = e.clientY - this.lastDragY;
      this.lastDragX = e.clientX;
      this.lastDragY = e.clientY;
      this.draggedDistance += Math.hypot(dx, dy);

      const clampedDx = THREE.MathUtils.clamp(dx, -240, 240);
      const clampedDy = THREE.MathUtils.clamp(dy, -240, 240);
      const dragSensitivity = 0.0038 * this.sensitivityMultiplier;

      this.yaw -= clampedDx * dragSensitivity;
      this.pitch = THREE.MathUtils.clamp(
        this.pitch - clampedDy * dragSensitivity,
        MIN_PITCH,
        MAX_PITCH
      );
      this.targetYaw = this.yaw;
      this.targetPitch = this.pitch;
      this.camera.rotation.y = this.yaw;
      this.camera.rotation.x = this.pitch;
    });

    const endDrag = (e: PointerEvent) => {
      if (this.activePointerId !== e.pointerId) return;
      const wasLeftClick = this.pointerButton === 0 && e.button === 0;
      const dist = Math.hypot(e.clientX - this.dragStartX, e.clientY - this.dragStartY);
      const isShortClick = this.draggedDistance < 8 && dist < 8;

      try {
        if (this.domElement.hasPointerCapture?.(e.pointerId)) {
          this.domElement.releasePointerCapture(e.pointerId);
        }
      } catch {
        // Ignore
      }
      this.activePointerId = null;
      this.pointerButton = -1;

      if (this.allowGameplay && !this.isLocked && wasLeftClick && isShortClick) {
        this.onInteract?.();
      }
    };

    window.addEventListener('pointerup', endDrag);
    window.addEventListener('pointercancel', endDrag);

    this.domElement.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  public update(
    dt: number,
    elapsed: number,
    allowMovement: boolean,
    interactables: InteractableTarget[],
    dynamicColliders?: { x: number; z: number; radius: number }[]
  ): void {
    this.allowGameplay = allowMovement;

    let moveForward = 0;
    let moveRight = 0;

    if (allowMovement) {
      if (this.keys.has('KeyW')) moveForward += 1;
      if (this.keys.has('KeyS')) moveForward -= 1;
      if (this.keys.has('KeyD')) moveRight += 1;
      if (this.keys.has('KeyA')) moveRight -= 1;

      // Direct keyboard camera look (yaw + pitch)
      const keyLookSpeed = 1.9 * Math.max(0.55, Math.min(1.5, this.sensitivityMultiplier));
      if (this.keys.has('ArrowLeft')) this.yaw += dt * keyLookSpeed;
      if (this.keys.has('ArrowRight')) this.yaw -= dt * keyLookSpeed;
      if (this.keys.has('ArrowUp')) {
        this.pitch = THREE.MathUtils.clamp(this.pitch + dt * keyLookSpeed * 0.78, MIN_PITCH, MAX_PITCH);
      }
      if (this.keys.has('ArrowDown')) {
        this.pitch = THREE.MathUtils.clamp(this.pitch - dt * keyLookSpeed * 0.78, MIN_PITCH, MAX_PITCH);
      }
      this.targetYaw = this.yaw;
      this.targetPitch = this.pitch;
    }

    const inputLen = Math.hypot(moveForward, moveRight);
    this.isSprinting = allowMovement && (this.keys.has('ShiftLeft') || this.keys.has('ShiftRight')) && inputLen > 0;
    const baseSpeed = this.isSprinting ? 7.4 : 4.65;

    if (inputLen > 0) {
      const nf = moveForward / inputLen;
      const nr = moveRight / inputLen;
      const sinY = Math.sin(this.yaw);
      const cosY = Math.cos(this.yaw);

      const dx = (-sinY * nf + cosY * nr) * baseSpeed * dt;
      const dz = (-cosY * nf - sinY * nr) * baseSpeed * dt;
      const prevX = this.position.x;
      const prevZ = this.position.z;

      this.position.x += dx;
      this.position.z += dz;
      this.collisions.resolvePosition(this.position, 0.48, dynamicColliders);

      const moved = Math.hypot(this.position.x - prevX, this.position.z - prevZ);
      this.moveSpeedFactor = THREE.MathUtils.lerp(
        this.moveSpeedFactor,
        Math.min(1.25, moved / (4.65 * dt + 0.0001)),
        Math.min(1, dt * 10)
      );

      if (this.isGrounded && moved > 0.001) {
        this.walkDist += moved;
        this.stepDist += moved;
        const stride = this.isSprinting ? 2.15 : 1.75;
        if (this.stepDist >= stride) {
          this.stepDist = 0;
          this.sound.playFootstep(this.isSprinting);
        }
      }
    } else {
      // Even while standing still, resolve against moving animals so none can clip into the player!
      if (dynamicColliders && dynamicColliders.length > 0) {
        this.collisions.resolvePosition(this.position, 0.48, dynamicColliders);
      }
      this.moveSpeedFactor = THREE.MathUtils.lerp(this.moveSpeedFactor, 0, Math.min(1, dt * 10));
    }

    if (!this.isGrounded) {
      this.velY -= 16.5 * dt;
      this.position.y += this.velY * dt;
      if (this.position.y <= this.eyeHeight) {
        this.position.y = this.eyeHeight;
        this.velY = 0;
        this.isGrounded = true;
      }
    }

    const targetFov = this.isSprinting ? 69 : 64;
    if (Math.abs(this.camera.fov - targetFov) > 0.05) {
      this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, targetFov, Math.min(1, dt * 7));
      this.camera.updateProjectionMatrix();
    }

    this.syncCamera(elapsed);
    this.updateRaycast(interactables);
  }

  private syncCamera(elapsed: number): void {
    const bobOffset =
      this.isGrounded && this.moveSpeedFactor > 0.05
        ? Math.sin(this.walkDist * 2.8) * 0.048 * Math.min(1, this.moveSpeedFactor)
        : Math.sin(elapsed * 1.5) * 0.006;

    this.camera.position.set(this.position.x, this.position.y + bobOffset, this.position.z);
    this.camera.rotation.y = this.yaw;
    this.camera.rotation.x = this.pitch;
  }

  private updateRaycast(interactables: InteractableTarget[]): void {
    this.raycaster.setFromCamera(this.screenCenter, this.camera);
    this.raycaster.far = 5.4;

    const objects: THREE.Object3D[] = [];
    const map = new Map<THREE.Object3D, InteractableTarget>();
    const tmpPos = new THREE.Vector3();
    for (const target of interactables) {
      // Fast squared-distance pre-filter: skip raycasting anything far from the player!
      if (!target.object.visible) continue;
      target.object.getWorldPosition(tmpPos);
      const maxCheck = target.maxDistance + 3.2;
      if (tmpPos.distanceToSquared(this.position) > maxCheck * maxCheck) continue;
      objects.push(target.object);
      map.set(target.object, target);
    }
    if (objects.length === 0) {
      this.currentTarget = null;
      return;
    }

    const hits = this.raycaster.intersectObjects(objects, true);
    let found: InteractableTarget | null = null;
    for (const hit of hits) {
      let obj: THREE.Object3D | null = hit.object;
      while (obj && !map.has(obj)) {
        obj = obj.parent;
      }
      if (obj) {
        const candidate = map.get(obj)!;
        if (hit.distance <= candidate.maxDistance) {
          found = candidate;
          break;
        }
      }
    }
    this.currentTarget = found;
  }
}
