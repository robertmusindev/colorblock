import { useFrame } from '@react-three/fiber';
import { useGLTF, useTexture } from '@react-three/drei';
import { RigidBody, CapsuleCollider } from '@react-three/rapier';
import { useRef, useMemo, useState, useEffect } from 'react';
import * as THREE from 'three';
import { applySkinToModelWithColor, findLegNodes } from '../utils/skinUtils';

export type EnemyType = 'standard' | 'runner' | 'tank' | 'explosive' | 'elite';

const CORPSE_LIFE  = 3.2;
const SHRINK_START = 2.7;

// Per-type config: all numeric values in one place
const TYPE_CFG: Record<EnemyType, {
  speed:    number;
  scale:    number;
  color:    string;
  capH:     number;  // CapsuleCollider half-height
  capR:     number;  // CapsuleCollider radius
  atkDmg:   number;
  atkRange: number;
  atkCd:    number;
}> = {
  standard: { speed: 3.8, scale: 1.00, color: '#cc2200', capH: 0.50, capR: 0.40, atkDmg: 1, atkRange: 1.6, atkCd: 1.0  },
  runner:   { speed: 7.2, scale: 0.72, color: '#ff5500', capH: 0.36, capR: 0.28, atkDmg: 1, atkRange: 1.4, atkCd: 0.75 },
  tank:     { speed: 2.4, scale: 1.38, color: '#336600', capH: 0.66, capR: 0.52, atkDmg: 2, atkRange: 1.8, atkCd: 1.4  },
  explosive:{ speed: 3.2, scale: 0.90, color: '#cc5500', capH: 0.44, capR: 0.34, atkDmg: 1, atkRange: 1.5, atkCd: 1.1  },
  elite:    { speed: 3.8, scale: 1.55, color: '#6600cc', capH: 0.68, capR: 0.52, atkDmg: 1, atkRange: 1.9, atkCd: 0.65 },
};

const _targetQuaternion = new THREE.Quaternion();
const _up = new THREE.Vector3(0, 1, 0);

interface GhettoEnemyProps {
  id: number;
  spawnPos: [number, number, number];
  playerPosRef: { current: THREE.Vector3 };
  onPositionUpdate: (id: number, pos: THREE.Vector3) => void;
  isKilled: boolean;
  isFlashing: boolean;
  enemyType: EnemyType;
  onAttackPlayer: (id: number, damage: number) => void;
  onRegisterKnockback: (id: number, fn: () => void) => void;
  onUnregisterKnockback: (id: number) => void;
  onExplosiveDeath?: (pos: THREE.Vector3) => void;
  maxHP: number;
  hpRef: { current: number };
  speedOverride?: number;
}

export function GhettoEnemy({
  id, spawnPos, playerPosRef, onPositionUpdate,
  isKilled, isFlashing, enemyType,
  onAttackPlayer, onRegisterKnockback, onUnregisterKnockback,
  onExplosiveDeath, maxHP, hpRef, speedOverride,
}: GhettoEnemyProps) {
  const cfg = TYPE_CFG[enemyType];
  const speed = speedOverride ?? cfg.speed;

  const bodyRef      = useRef<any>(null);
  const avatarRef    = useRef<THREE.Group>(null);
  const flashMeshRef = useRef<THREE.Mesh>(null);
  const legLRef      = useRef<THREE.Object3D | null>(null);
  const legRRef      = useRef<THREE.Object3D | null>(null);

  const walkTimer      = useRef(Math.random() * 10);
  const attackCooldown = useRef(0);
  const hitFlashRef    = useRef(0);

  const barGroupRef = useRef<THREE.Group>(null);
  const barFgRef    = useRef<THREE.Mesh>(null);
  const introTimer  = useRef(0.85);          // rise-up animation countdown

  const isDeadRef     = useRef(false);
  const deathProgress = useRef(0);
  const deathElapsed  = useRef(0);

  // Position-based stuck detection
  const posCheckTimer = useRef(Math.random() * 0.35); // stagger so enemies don't all check at once
  const prevPosX      = useRef(0);
  const prevPosZ      = useRef(0);
  const escapeAngle   = useRef<number | null>(null);
  const escapeTimer   = useRef(0);
  const escapeSide    = useRef<1 | -1>(Math.random() > 0.5 ? 1 : -1);

  const [shouldRender, setShouldRender] = useState(true);

  const { scene } = useGLTF(import.meta.env.BASE_URL + 'asset3d/charactert.glb');
  const textures = useTexture({
    default:      import.meta.env.BASE_URL + 'texture/TEST_Material.002_BaseColor.png',
    israel:       import.meta.env.BASE_URL + 'skins/israel_skin.png',
    robsbagliato: import.meta.env.BASE_URL + 'texture/robsbagliato.png',
  });

  const clone = useMemo(() => {
    const c = scene.clone();
    applySkinToModelWithColor(c, 'skin_solid', textures, cfg.color);
    const { legL, legR } = findLegNodes(c);
    legLRef.current = legL;
    legRRef.current = legR;
    return c;
  }, [scene, textures, cfg.color]);

  // ── Knockback registration ────────────────────────────────────────────────
  useEffect(() => {
    onRegisterKnockback(id, () => {
      if (!bodyRef.current || isDeadRef.current) return;
      const pp = playerPosRef.current;
      const p  = bodyRef.current.translation();
      const dx = p.x - pp.x;
      const dz = p.z - pp.z;
      const len = Math.sqrt(dx * dx + dz * dz) || 1;
      bodyRef.current.applyImpulse({ x: (dx / len) * 10, y: 1.8, z: (dz / len) * 10 }, true);
    });
    return () => onUnregisterKnockback(id);
  }, [id, onRegisterKnockback, onUnregisterKnockback, playerPosRef]);

  // ── Death trigger ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isKilled || isDeadRef.current) return;
    isDeadRef.current = true;
    if (bodyRef.current) {
      bodyRef.current.setLinvel({ x: 0, y: 0, z: 0 }, true);
      bodyRef.current.setEnabled(false);
    }
    // Explosive: notify parent of death position for area blast
    if (enemyType === 'explosive' && onExplosiveDeath && bodyRef.current) {
      const p = bodyRef.current.translation();
      onExplosiveDeath(new THREE.Vector3(p.x, p.y, p.z));
    }
    const t = setTimeout(() => setShouldRender(false), CORPSE_LIFE * 1000);
    return () => clearTimeout(t);
  }, [isKilled, enemyType, onExplosiveDeath]);

  // ── Flash trigger ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (isFlashing) hitFlashRef.current = 0.28;
  }, [isFlashing]);

  const avatarBaseY = -(cfg.capH + 0.4);

  // ── Per-frame ──────────────────────────────────────────────────────────────
  useFrame((state, delta) => {
    if (!bodyRef.current) return;

    // DEAD: fall + shrink + hide bar
    if (isDeadRef.current) {
      deathElapsed.current += delta;
      deathProgress.current = Math.min(1, deathProgress.current + delta * 3.5);
      if (avatarRef.current) {
        avatarRef.current.rotation.x = -(Math.PI / 2) * deathProgress.current;
        avatarRef.current.position.y = -cfg.capH - deathProgress.current * 0.3;
        if (deathElapsed.current > SHRINK_START) {
          const t = Math.min(1, (deathElapsed.current - SHRINK_START) / (CORPSE_LIFE - SHRINK_START));
          avatarRef.current.scale.setScalar(cfg.scale * Math.max(0, 1 - t * t));
        }
      }
      if (barGroupRef.current) barGroupRef.current.visible = false;
      return;
    }

    // INTRO: rise from the ground (zombie emerging from earth)
    if (introTimer.current > 0) {
      introTimer.current = Math.max(0, introTimer.current - delta);
      const progress = 1 - introTimer.current / 0.85; // 0 → 1
      if (avatarRef.current) {
        avatarRef.current.position.y = avatarBaseY - 1.5 * (1 - progress);
      }
      if (barGroupRef.current) {
        barGroupRef.current.visible = true;
        barGroupRef.current.quaternion.copy(state.camera.quaternion);
      }
      return; // no movement or attacks during intro
    }

    // HIT FLASH
    if (hitFlashRef.current > 0) {
      hitFlashRef.current = Math.max(0, hitFlashRef.current - delta);
      if (flashMeshRef.current) {
        (flashMeshRef.current.material as THREE.MeshBasicMaterial).opacity =
          (hitFlashRef.current / 0.28) * 0.55;
        flashMeshRef.current.visible = hitFlashRef.current > 0;
      }
    } else if (flashMeshRef.current?.visible) {
      flashMeshRef.current.visible = false;
    }

    // HEALTH BAR — billboard + hp color
    if (barGroupRef.current) {
      barGroupRef.current.visible = true;
      barGroupRef.current.quaternion.copy(state.camera.quaternion);
      if (barFgRef.current) {
        const frac = Math.max(0.001, hpRef.current / maxHP);
        barFgRef.current.scale.x = frac;
        barFgRef.current.position.x = -0.425 * (1 - frac); // left-align
      }
    }

    // NORMAL LOGIC
    const pos = bodyRef.current.translation();
    onPositionUpdate(id, _posVec.set(pos.x, pos.y, pos.z));

    const playerPos = playerPosRef.current;
    const dx   = playerPos.x - pos.x;
    const dz   = playerPos.z - pos.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    // Attack
    attackCooldown.current = Math.max(0, attackCooldown.current - delta);
    if (dist < cfg.atkRange && attackCooldown.current <= 0) {
      onAttackPlayer(id, cfg.atkDmg);
      attackCooldown.current = cfg.atkCd;
    }

    if (dist > 1.2) {
      // ── Position-based stuck detection ───────────────────────────────────
      posCheckTimer.current += delta;
      if (posCheckTimer.current >= 0.35) {
        const movedSq = (pos.x - prevPosX.current) ** 2 + (pos.z - prevPosZ.current) ** 2;
        if (movedSq < 0.18 * 0.18) {
          const base = Math.atan2(dx, dz);
          escapeAngle.current = base + escapeSide.current * (Math.PI / 2);
          escapeTimer.current = 1.1;
          escapeSide.current  = escapeSide.current === 1 ? -1 : 1;
        }
        prevPosX.current      = pos.x;
        prevPosZ.current      = pos.z;
        posCheckTimer.current = 0;
      }

      if (escapeTimer.current > 0) escapeTimer.current -= delta;
      else escapeAngle.current = null;

      const moveX = escapeAngle.current !== null ? Math.sin(escapeAngle.current) : dx / dist;
      const moveZ = escapeAngle.current !== null ? Math.cos(escapeAngle.current) : dz / dist;
      // ─────────────────────────────────────────────────────────────────────

      bodyRef.current.setLinvel({ x: moveX * speed, y: bodyRef.current.linvel().y, z: moveZ * speed }, true);
      _targetQuaternion.setFromAxisAngle(_up, Math.atan2(moveX, moveZ) + Math.PI);
      if (avatarRef.current) {
        avatarRef.current.quaternion.slerp(_targetQuaternion, 1 - Math.exp(-14 * delta));
      }
      walkTimer.current += delta * 4;
      if (legLRef.current) legLRef.current.rotation.x = Math.sin(walkTimer.current * 2) * 0.65;
      if (legRRef.current) legRRef.current.rotation.x = Math.sin(walkTimer.current * 2 + Math.PI) * 0.65;
    } else {
      bodyRef.current.setLinvel({ x: 0, y: bodyRef.current.linvel().y, z: 0 }, true);
      if (legLRef.current) legLRef.current.rotation.x = Math.sin(walkTimer.current * 1.2) * 0.12;
      if (legRRef.current) legRRef.current.rotation.x = Math.sin(walkTimer.current * 1.2 + Math.PI) * 0.12;
      walkTimer.current += delta;
    }
  });

  if (!shouldRender) return null;

  const flashRadius = cfg.scale * 0.72;

  return (
    <RigidBody
      ref={bodyRef}
      type="dynamic"
      colliders={false}
      position={spawnPos}
      enabledRotations={[false, false, false]}
      linearDamping={4}
    >
      <CapsuleCollider args={[cfg.capH, cfg.capR]} />

      <group ref={avatarRef} position={[0, avatarBaseY, 0]}>
        <group scale={cfg.scale}>
          <primitive object={clone} />

          {/* Hit flash sphere */}
          <mesh ref={flashMeshRef} visible={false}>
            <sphereGeometry args={[flashRadius, 8, 8]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={0} depthWrite={false} />
          </mesh>

          {/* Tank: armour plate overlay */}
          {enemyType === 'tank' && (
            <mesh position={[0, 0.9, 0]}>
              <boxGeometry args={[0.9, 1.2, 0.55]} />
              <meshBasicMaterial color="#1a3300" transparent opacity={0.6} />
            </mesh>
          )}

          {/* Explosive: orange pulsing glow ring */}
          {enemyType === 'explosive' && (
            <mesh position={[0, 0.8, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <ringGeometry args={[0.38, 0.52, 20]} />
              <meshBasicMaterial color="#ff6600" transparent opacity={0.75} side={THREE.DoubleSide} />
            </mesh>
          )}
        </group>

        {/* Elite crown rings */}
        {enemyType === 'elite' && (
          <group position={[0, 3.2, 0]}>
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <ringGeometry args={[0.28, 0.44, 20]} />
              <meshBasicMaterial color="#cc00ff" transparent opacity={0.92} side={THREE.DoubleSide} />
            </mesh>
            <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0.18, 0]}>
              <ringGeometry args={[0.18, 0.28, 20]} />
              <meshBasicMaterial color="#ff44ff" transparent opacity={0.7} side={THREE.DoubleSide} />
            </mesh>
          </group>
        )}
      </group>

      {enemyType === 'elite'    && <pointLight color="#9900ee" intensity={4} distance={5} decay={2} />}
      {enemyType === 'explosive' && <pointLight color="#ff5500" intensity={3} distance={4} decay={2} />}

      {/* Health bar — billboard facing camera, updated imperatively in useFrame */}
      <group ref={barGroupRef} position={[0, cfg.capH + 1.9, 0]}>
        {/* Outer border */}
        <mesh>
          <boxGeometry args={[0.95, 0.155, 0.01]} />
          <meshBasicMaterial color="#000000" depthWrite={false} transparent opacity={0.7} />
        </mesh>
        {/* Background */}
        <mesh position={[0, 0, 0.002]}>
          <boxGeometry args={[0.87, 0.105, 0.01]} />
          <meshBasicMaterial color="#1a1a1a" depthWrite={false} transparent opacity={0.85} />
        </mesh>
        {/* Foreground HP bar — scale.x driven imperatively */}
        <mesh ref={barFgRef} position={[0, 0, 0.004]}>
          <boxGeometry args={[0.85, 0.09, 0.01]} />
          <meshBasicMaterial color="#cc1111" depthWrite={false} transparent opacity={0.95} />
        </mesh>
      </group>
    </RigidBody>
  );
}

// Module-scope pre-allocated vector — avoids per-frame allocation in onPositionUpdate
const _posVec = new THREE.Vector3();
