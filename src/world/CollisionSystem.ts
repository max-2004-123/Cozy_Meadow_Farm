import * as THREE from 'three';

export interface BoxCollider {
  type: 'box';
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface CircleCollider {
  type: 'circle';
  x: number;
  z: number;
  radius: number;
}

export interface RotatedBoxCollider {
  type: 'rbox';
  cx: number;
  cz: number;
  halfW: number;
  halfD: number;
  cos: number;
  sin: number;
}

export type Collider = BoxCollider | CircleCollider | RotatedBoxCollider;

export class CollisionSystem {
  private colliders: Collider[] = [];
  private bounds = { minX: -34, maxX: 34, minZ: -31, maxZ: 28 };

  public setWorldBounds(minX: number, maxX: number, minZ: number, maxZ: number): void {
    this.bounds = { minX, maxX, minZ, maxZ };
  }

  public addBox(cx: number, cz: number, width: number, depth: number): void {
    this.colliders.push({
      type: 'box',
      minX: cx - width * 0.5,
      maxX: cx + width * 0.5,
      minZ: cz - depth * 0.5,
      maxZ: cz + depth * 0.5,
    });
  }

  public addRotatedBox(cx: number, cz: number, width: number, depth: number, yaw: number): void {
    this.colliders.push({
      type: 'rbox',
      cx,
      cz,
      halfW: width * 0.5,
      halfD: depth * 0.5,
      cos: Math.cos(-yaw),
      sin: Math.sin(-yaw),
    });
  }

  public addCircle(x: number, z: number, radius: number): void {
    this.colliders.push({ type: 'circle', x, z, radius });
  }

  public addFenceSegment(x1: number, z1: number, x2: number, z2: number, thickness = 0.42): void {
    const dx = x2 - x1;
    const dz = z2 - z1;
    const length = Math.hypot(dx, dz);
    if (length < 0.05) return;
    const cx = (x1 + x2) * 0.5;
    const cz = (z1 + z2) * 0.5;
    const yaw = Math.atan2(dx, dz);
    this.addRotatedBox(cx, cz, thickness, length, yaw);
  }

  public resolvePosition(
    pos: THREE.Vector3,
    playerRadius = 0.48,
    dynamicCircles?: { x: number; z: number; radius: number }[]
  ): void {
    // Clamp to valley perimeter
    pos.x = Math.max(this.bounds.minX + playerRadius, Math.min(this.bounds.maxX - playerRadius, pos.x));
    pos.z = Math.max(this.bounds.minZ + playerRadius, Math.min(this.bounds.maxZ - playerRadius, pos.z));

    // Multiple iterations ensure corner sliding never clips
    for (let iter = 0; iter < 3; iter++) {
      // Resolve moving animal colliders so player & animals never walk through each other!
      if (dynamicCircles) {
        for (const dyn of dynamicCircles) {
          const dx = pos.x - dyn.x;
          const dz = pos.z - dyn.z;
          const minDist = dyn.radius + playerRadius;
          const distSq = dx * dx + dz * dz;
          if (distSq < minDist * minDist) {
            const dist = Math.sqrt(distSq) || 0.0001;
            const push = minDist - dist;
            pos.x += (dx / dist) * push;
            pos.z += (dz / dist) * push;
          }
        }
      }

      for (const col of this.colliders) {
        if (col.type === 'circle') {
          const dx = pos.x - col.x;
          const dz = pos.z - col.z;
          const minDist = col.radius + playerRadius;
          const distSq = dx * dx + dz * dz;
          if (distSq < minDist * minDist) {
            const dist = Math.sqrt(distSq) || 0.0001;
            const push = minDist - dist;
            pos.x += (dx / dist) * push;
            pos.z += (dz / dist) * push;
          }
        } else if (col.type === 'box') {
          const closestX = Math.max(col.minX, Math.min(pos.x, col.maxX));
          const closestZ = Math.max(col.minZ, Math.min(pos.z, col.maxZ));
          const dx = pos.x - closestX;
          const dz = pos.z - closestZ;
          const distSq = dx * dx + dz * dz;

          if (distSq < playerRadius * playerRadius) {
            if (distSq > 1e-6) {
              const dist = Math.sqrt(distSq);
              const push = playerRadius - dist;
              pos.x += (dx / dist) * push;
              pos.z += (dz / dist) * push;
            } else {
              // Center is inside box; push out along nearest edge
              const penLeft = Math.abs(pos.x - col.minX);
              const penRight = Math.abs(col.maxX - pos.x);
              const penTop = Math.abs(pos.z - col.minZ);
              const penBottom = Math.abs(col.maxZ - pos.z);
              const m = Math.min(penLeft, penRight, penTop, penBottom);
              if (m === penLeft) pos.x = col.minX - playerRadius;
              else if (m === penRight) pos.x = col.maxX + playerRadius;
              else if (m === penTop) pos.z = col.minZ - playerRadius;
              else pos.z = col.maxZ + playerRadius;
            }
          }
        } else if (col.type === 'rbox') {
          const relX = pos.x - col.cx;
          const relZ = pos.z - col.cz;
          const localX = relX * col.cos - relZ * col.sin;
          const localZ = relX * col.sin + relZ * col.cos;

          const clampedX = Math.max(-col.halfW, Math.min(localX, col.halfW));
          const clampedZ = Math.max(-col.halfD, Math.min(localZ, col.halfD));
          const dx = localX - clampedX;
          const dz = localZ - clampedZ;
          const distSq = dx * dx + dz * dz;

          if (distSq < playerRadius * playerRadius) {
            let pushLX = 0;
            let pushLZ = 0;
            if (distSq > 1e-6) {
              const dist = Math.sqrt(distSq);
              const push = playerRadius - dist;
              pushLX = (dx / dist) * push;
              pushLZ = (dz / dist) * push;
            } else {
              const px = col.halfW - Math.abs(localX);
              const pz = col.halfD - Math.abs(localZ);
              if (px < pz) pushLX = (localX >= 0 ? 1 : -1) * (px + playerRadius);
              else pushLZ = (localZ >= 0 ? 1 : -1) * (pz + playerRadius);
            }
            // Rotate push back to world space (inverse rotation: cos, -sin)
            pos.x += pushLX * col.cos + pushLZ * col.sin;
            pos.z += -pushLX * col.sin + pushLZ * col.cos;
          }
        }
      }
    }
  }
}
