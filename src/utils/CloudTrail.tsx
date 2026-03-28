import { useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';

/**
 * CloudTrail — Nuvole VFX che il player rilascia quando è in movimento.
 * Pool di sprites con texture cloud_vfx.png, spawn dietro al player
 * nella direzione opposta al moto, animazione 60fps frame-independent.
 */

interface CloudPuff {
  sprite: THREE.Sprite;
  mat: THREE.SpriteMaterial;
  life: number;
  maxLife: number;
  initialScale: number;
  targetScale: number;
  // World-space position (compensata rispetto al parent RigidBody)
  wx: number; wy: number; wz: number;
  vx: number; vy: number; vz: number;
  rotSpeed: number;
  inUse: boolean;
}

export interface CloudTrailProps {
  positionRef: { current: [number, number, number] };
  velocityRef: { current: [number, number, number] };
  activeRef: { current: boolean };
  /** 0..1, controlla frequenza e dimensione */
  intensity?: number;
  maxParticles?: number;
  /** Colore tinta delle nuvole (default bianco) */
  color?: THREE.ColorRepresentation;
  /** Scala base delle nuvole */
  baseScale?: number;
  /** Opacità massima */
  maxOpacity?: number;
}

// Pre-allocated temp vectors
const _spawnOffset = new THREE.Vector3();

export function CloudTrail({
  positionRef,
  velocityRef,
  activeRef,
  intensity = 1.0,
  maxParticles = 20,
  color = 0xffffff,
  baseScale = 0.6,
  maxOpacity = 0.7,
}: CloudTrailProps) {
  const groupRef = useRef<THREE.Group>(null);
  const pool = useRef<CloudPuff[]>([]);
  const lastEmitTime = useRef(0);

  const texture = useTexture(import.meta.env.BASE_URL + 'texture/cloud_vfx.png');

  useEffect(() => {
    if (!groupRef.current) return;
    const group = groupRef.current;

    for (let i = 0; i < maxParticles; i++) {
      const mat = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        depthWrite: false,
        alphaTest: 0.01,
        blending: THREE.NormalBlending,
        color: new THREE.Color(color),
        opacity: 0,
      });
      const sprite = new THREE.Sprite(mat);
      sprite.visible = false;
      sprite.renderOrder = -1; // Render behind player
      group.add(sprite);
      pool.current.push({
        sprite, mat,
        life: 0, maxLife: 1,
        initialScale: 1, targetScale: 1.5,
        wx: 0, wy: 0, wz: 0,
        vx: 0, vy: 0, vz: 0,
        rotSpeed: 0,
        inUse: false,
      });
    }

    return () => {
      pool.current.forEach(p => {
        p.mat.dispose();
      });
      pool.current = [];
    };
  }, [maxParticles, texture, color]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;

    const pr = positionRef.current;
    const vr = velocityRef.current;

    // --- Emissione ---
    if (activeRef.current && intensity > 0.05) {
      const now = performance.now();
      // Intervallo inversamente proporzionale a intensity: più veloce = più nuvole
      const interval = Math.max(40, 180 - intensity * 140); // 40ms–180ms
      if (now - lastEmitTime.current > interval) {
        const slot = pool.current.find(p => !p.inUse);
        if (slot) {
          lastEmitTime.current = now;

          // Spawn dietro al player (direzione opposta alla velocity)
          const vLen = Math.sqrt(vr[0] * vr[0] + vr[2] * vr[2]);
          if (vLen > 0.1) {
            _spawnOffset.set(-vr[0] / vLen, 0, -vr[2] / vLen);
          } else {
            _spawnOffset.set(0, 0, 0);
          }

          const s = baseScale * (0.5 + Math.random() * 0.5) * (0.6 + intensity * 0.4);

          slot.inUse = true;
          slot.life = 1.0;
          slot.maxLife = 0.5 + Math.random() * 0.4; // 0.5s–0.9s
          slot.initialScale = s * 0.4; // Parte piccola
          slot.targetScale = s * 1.8; // Cresce

          // Posizione: ai piedi del player, leggermente dietro
          slot.wx = pr[0] + _spawnOffset.x * 0.4 + (Math.random() - 0.5) * 0.4;
          slot.wy = pr[1] - 0.6 + Math.random() * 0.2;
          slot.wz = pr[2] + _spawnOffset.z * 0.4 + (Math.random() - 0.5) * 0.4;

          // Velocità: leggero drift verso l'alto e dietro
          slot.vx = _spawnOffset.x * 0.8 + (Math.random() - 0.5) * 0.4;
          slot.vy = 0.3 + Math.random() * 0.5;
          slot.vz = _spawnOffset.z * 0.8 + (Math.random() - 0.5) * 0.4;

          slot.rotSpeed = (Math.random() - 0.5) * 2;

          slot.mat.opacity = maxOpacity * 0.9;
          slot.sprite.visible = true;
        }
      }
    }

    // --- Aggiornamento particelle ---
    for (const puff of pool.current) {
      if (!puff.inUse) continue;

      puff.life -= delta / puff.maxLife;

      if (puff.life <= 0) {
        puff.inUse = false;
        puff.sprite.visible = false;
        continue;
      }

      // Aggiorna posizione world-space
      puff.wx += puff.vx * delta;
      puff.wy += puff.vy * delta;
      puff.wz += puff.vz * delta;

      // Damping (rallentamento graduale)
      const drag = Math.exp(-2.5 * delta);
      puff.vx *= drag;
      puff.vz *= drag;
      puff.vy -= 0.15 * delta; // Leggera gravità

      // Converti in local-space del parent (RigidBody)
      puff.sprite.position.set(
        puff.wx - pr[0],
        puff.wy - pr[1],
        puff.wz - pr[2],
      );

      // Scale: grow in → shrink out (ease in-out)
      const t = puff.life; // 1→0
      const progress = 1 - t;
      let scale: number;
      if (progress < 0.3) {
        // Grow fase (0→0.3)
        const growT = progress / 0.3;
        scale = THREE.MathUtils.lerp(puff.initialScale, puff.targetScale, growT * growT);
      } else {
        // Shrink fase (0.3→1.0)
        const shrinkT = (progress - 0.3) / 0.7;
        scale = THREE.MathUtils.lerp(puff.targetScale, puff.initialScale * 0.3, shrinkT);
      }
      puff.sprite.scale.set(scale, scale, 1);

      // Rotazione sprite
      puff.sprite.material.rotation += puff.rotSpeed * delta;

      // Opacity: fade in veloce → fade out morbido
      let opacity: number;
      if (progress < 0.15) {
        opacity = (progress / 0.15) * maxOpacity;
      } else {
        opacity = t * t * maxOpacity; // Quadratic fade out
      }
      puff.mat.opacity = opacity;
    }
  });

  return <group ref={groupRef} />;
}
