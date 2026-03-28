import { useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';

interface CloudPuff {
  sprite: THREE.Sprite;
  mat: THREE.SpriteMaterial;
  life: number;
  maxLife: number;
  initialScale: number;
  // World-space coordinates (compensate for parent RigidBody movement)
  wx: number; wy: number; wz: number;
  vx: number; vy: number; vz: number;
  inUse: boolean;
}

export interface DustParticlesProps {
  positionRef: { current: [number, number, number] };
  activeRef: { current: boolean };
  intensity?: number;
  maxParticles?: number;
}

export function DustParticles({
  positionRef,
  activeRef,
  intensity = 1.0,
  maxParticles = 14,
}: DustParticlesProps) {
  const groupRef = useRef<THREE.Group>(null);
  const pool = useRef<CloudPuff[]>([]);
  const lastEmissionTime = useRef(0);

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
        color: new THREE.Color(0xffffff),
        opacity: 0,
      });
      const sprite = new THREE.Sprite(mat);
      sprite.visible = false;
      group.add(sprite);
      pool.current.push({
        sprite, mat,
        life: 0, maxLife: 1, initialScale: 1,
        wx: 0, wy: 0, wz: 0,
        vx: 0, vy: 0, vz: 0,
        inUse: false,
      });
    }

    return () => {
      pool.current.forEach(p => p.mat.dispose());
      pool.current = [];
    };
  }, [maxParticles, texture]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;

    const pr = positionRef.current;

    // Emissione
    if (activeRef.current) {
      const now = Date.now();
      const interval = Math.max(55, 160 - intensity * 100);
      if (now - lastEmissionTime.current > interval) {
        const slot = pool.current.find(p => !p.inUse);
        if (slot) {
          lastEmissionTime.current = now;
          const s = 0.35 + Math.random() * 0.30;

          slot.inUse = true;
          slot.life = 1.0;
          slot.maxLife = 0.45 + Math.random() * 0.30;
          slot.initialScale = s;

          // Spawn in world space at player feet
          slot.wx = pr[0] + (Math.random() - 0.5) * 0.5;
          slot.wy = pr[1] - 0.7;
          slot.wz = pr[2] + (Math.random() - 0.5) * 0.5;

          slot.vx = (Math.random() - 0.5) * 0.6;
          slot.vy = Math.random() * 0.7 + 0.2;
          slot.vz = (Math.random() - 0.5) * 0.6;

          slot.mat.opacity = 0.85;
          slot.sprite.visible = true;
        }
      }
    }

    // Aggiornamento puffs
    for (const puff of pool.current) {
      if (!puff.inUse) continue;

      puff.life -= delta / puff.maxLife;

      if (puff.life <= 0) {
        puff.inUse = false;
        puff.sprite.visible = false;
        continue;
      }

      // Aggiorna coordinate world-space
      puff.wx += puff.vx * delta;
      puff.wy += puff.vy * delta;
      puff.wz += puff.vz * delta;

      puff.vx *= Math.exp(-3.5 * delta);
      puff.vz *= Math.exp(-3.5 * delta);
      puff.vy -= 0.25 * delta; // lieve gravity

      // Converti in local-space rispetto al parent (RigidBody)
      // così le particelle restano nella posizione world dove sono nate
      puff.sprite.position.set(
        puff.wx - pr[0],
        puff.wy - pr[1],
        puff.wz - pr[2]
      );

      // Rimpicciolisci linearmente, fade quadratico per dissolvenza morbida
      const t = puff.life;
      const s = puff.initialScale * t;
      puff.sprite.scale.set(s, s, 1);
      puff.mat.opacity = t * t * 0.80;
    }
  });

  return <group ref={groupRef} />;
}
