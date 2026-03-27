import { useState, useRef, useEffect, useCallback } from 'react';
import { useFrame } from '@react-three/fiber';
import { RigidBody, CuboidCollider, useRapier } from '@react-three/rapier';
import * as THREE from 'three';
import { useGameStore } from '../store';
import { GhettoEnemy, type EnemyType } from './GhettoEnemy';
import { audio } from '../utils/audio';
import { cameraShakeRef, ghettoDamageFlashRef, ghettoNearStationRef, ghettoInteractTriggerRef, ghettoTeleportRef } from '../utils/ghetto-refs';
import type { ghettoPlayerPosRef, ghettoPlayerForwardRef, ghettoShootTriggerRef } from '../utils/ghetto-refs';

interface EnemyData {
  id: number;
  spawnPos: [number, number, number];
  enemyType: EnemyType;
  hpRef: { current: number };
  speedOverride: number;
  maxHPScaled: number;
}

interface AmmoPickup {
  id: number;
  pos: [number, number, number];
}

interface GhettoLevelProps {
  playerPosRef: typeof ghettoPlayerPosRef;
  playerForwardRef: typeof ghettoPlayerForwardRef;
  shootTriggerRef: typeof ghettoShootTriggerRef;
  playerReady: boolean;
  roomIndex: 0 | 1;
}

function deg2rad(deg: number) { return (deg * Math.PI) / 180; }

// HP per enemy type
const TYPE_HP: Record<EnemyType, number> = {
  standard: 2, runner: 1, tank: 5, explosive: 1, elite: 3,
};

// Points earned per kill
const TYPE_POINTS: Record<EnemyType, number> = {
  standard: 100, runner: 50, tank: 500, explosive: 100, elite: 300,
};

// Wall buy station positions (x, z, facing: 'n'|'s'|'e'|'w')
const BUY_STATIONS: { x: number; z: number; facing: 'n'|'s'|'e'|'w' }[] = [
  { x:  0,  z: -24, facing: 's' },  // south wall interior
  { x: 24,  z:   0, facing: 'w' },  // east wall interior
  { x:  0,  z:  24, facing: 'n' },  // north wall interior
  { x:-24,  z:   0, facing: 'e' },  // west wall interior
];
const SHOTGUN_STATIONS: { x: number; z: number; facing: 'n'|'s'|'e'|'w' }[] = [
  { x: -28, z: 10, facing: 'e' },
  { x:  28, z:-10, facing: 'w' },
];
const MACHINEGUN_STATIONS: { x: number; z: number; facing: 'n'|'s'|'e'|'w' }[] = [
  { x:  0, z: -22, facing: 's' },
  { x:  0, z:  22, facing: 'n' },
];
const M16_COST = 500;
const M16_AMMO_COST = 150;
const DOOR1_COST = 750;

// Room 2 — industrial factory (80×80)
const SPAWN_PORTALS_R2: [number, number, number][] = [
  [-28,0.5,-38],[-14,0.5,-39],[0,0.5,-37],[14,0.5,-39],[28,0.5,-38],[-6,0.5,-36],
  [-22,0.5,38],[-6,0.5,39],[6,0.5,37],[22,0.5,39],[0,0.5,36],
  [38,0.5,-22],[39,0.5,-5],[38,0.5,10],[39,0.5,26],
  [-38,0.5,-22],[-39,0.5,-5],[-38,0.5,10],[-39,0.5,26],
  [-34,0.5,-34],[34,0.5,-34],[-34,0.5,34],[34,0.5,34],
  [0,0.5,-15],[-18,0.5,0],[18,0.5,0],[0,0.5,15],[-10,0.5,-28],[10,0.5,28],
];
const FIRE_BARREL_POSITIONS_R2: [number,number,number][] = [
  [-20,0,-18],[22,0,-12],[-8,0,8],[18,0,20],[0,0,-28],
];
const BUY_STATIONS_R2: { x: number; z: number; facing: 'n'|'s'|'e'|'w' }[] = [
  { x:  0, z: -32, facing: 's' },
  { x: 32, z:  0,  facing: 'w' },
  { x:  0, z:  32, facing: 'n' },
  { x:-32, z:  0,  facing: 'e' },
];
const SHOTGUN_STATIONS_R2: { x: number; z: number; facing: 'n'|'s'|'e'|'w' }[] = [
  { x: -35, z: 15, facing: 'e' },
  { x:  35, z:-15, facing: 'w' },
];
const MACHINEGUN_STATIONS_R2: { x: number; z: number; facing: 'n'|'s'|'e'|'w' }[] = [
  { x:  0, z: -28, facing: 's' },
  { x:  0, z:  28, facing: 'n' },
];

// ── Map positions ─────────────────────────────────────────────────────────────
const LAMP_POSITIONS: [number, number, number][] = [
  [-27, 0, -27], [27, 0, -27], [-27, 0, 27], [27, 0, 27],
];
const DUMPSTERS: [number, number, number][] = [
  [-18, 0.75, -16], [17, 0.75, -18], [-16, 0.75, 18], [18, 0.75, 15],
  [-22, 0.75,   4], [20, 0.75,   8],
];
const CRATES: [number, number, number][] = [
  [10, 0.5, -20], [-11, 0.5, 20], [20, 0.5, 6],
  [-6, 0.5, -14], [ 6, 0.5, 15], [-24, 0.5, -10],
  [24, 0.5, -10], [-4, 0.5,  0], [4, 0.5, -4],
];
const FIRE_BARREL_POSITIONS: [number, number, number][] = [
  [-14, 0, -9], [5, 0, 3], [16, 0, 16], [-20, 0, 8],
];
const BARRIERS: { pos: [number,number,number]; along: 'x'|'z' }[] = [
  { pos: [0,  0.5, 12], along: 'x' },
  { pos: [-7, 0.5,-12], along: 'x' },
  { pos: [10, 0.5,  6], along: 'z' },
  { pos: [-12,0.5, 14], along: 'z' },
];

// Shared basic materials
const MAT_ASPHALT   = new THREE.MeshBasicMaterial({ color: '#1e1e1e' });
const MAT_STRIPE    = new THREE.MeshBasicMaterial({ color: '#3a3a3a' });
const MAT_WALL      = new THREE.MeshBasicMaterial({ color: '#3a2a18' });
const MAT_BARRIER   = new THREE.MeshBasicMaterial({ color: '#404040' });
const MAT_BAR_TOP   = new THREE.MeshBasicMaterial({ color: '#cc8800' });
const MAT_BLACK     = new THREE.MeshBasicMaterial({ color: '#111111' });
const MAT_LAMP_BODY = new THREE.MeshBasicMaterial({ color: '#2a2a2a' });
const MAT_LAMP_GLOW = new THREE.MeshBasicMaterial({ color: '#ffee88' });
const MAT_PLANK     = new THREE.MeshBasicMaterial({ color: '#362a1e' });

// Floating ammo pickup
function AmmoPickupMesh({ pos }: { pos: [number, number, number] }) {
  const groupRef = useRef<THREE.Group>(null);
  const baseY = pos[1];
  useFrame((state) => {
    if (!groupRef.current) return;
    groupRef.current.position.y = baseY + Math.sin(state.clock.elapsedTime * 2.5) * 0.18;
    groupRef.current.rotation.y = state.clock.elapsedTime * 2.2;
  });
  return (
    <group ref={groupRef} position={pos}>
      <mesh>
        <boxGeometry args={[0.32, 0.32, 0.32]} />
        <meshStandardMaterial color="#ffee00" emissive="#ffaa00" emissiveIntensity={3.5} metalness={0.7} roughness={0.1} />
      </mesh>
      <mesh><boxGeometry args={[0.38, 0.10, 0.10]} /><meshBasicMaterial color="#222200" /></mesh>
      <mesh><boxGeometry args={[0.10, 0.38, 0.10]} /><meshBasicMaterial color="#222200" /></mesh>
    </group>
  );
}

// Wall buy station — weapon purchase panel mounted on the interior wall
function WallBuyStation({ x, z, facing, isOwned, weaponType = 'm16' }: { x: number; z: number; facing: 'n'|'s'|'e'|'w'; isOwned: boolean; weaponType?: 'm16' | 'shotgun' | 'machinegun' }) {
  const glowRef = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (!glowRef.current) return;
    const mat = glowRef.current.material as THREE.MeshBasicMaterial;
    mat.opacity = 0.55 + Math.sin(state.clock.elapsedTime * 3) * 0.25;
  });

  // Orient the sign to face inward
  const rotY = facing === 'n' ? Math.PI : facing === 's' ? 0 : facing === 'e' ? -Math.PI / 2 : Math.PI / 2;
  const wallOffset = 0.05;
  const px = facing === 'e' ? x - wallOffset : facing === 'w' ? x + wallOffset : x;
  const pz = facing === 'n' ? z + wallOffset : facing === 's' ? z - wallOffset : z;
  const color = isOwned ? '#00ffcc' : '#ffcc00';

  return (
    <group position={[px, 1.3, pz]} rotation={[0, rotY, 0]}>
      {/* Back plate */}
      <mesh>
        <boxGeometry args={[1.1, 0.7, 0.04]} />
        <meshBasicMaterial color="#0a0a1a" />
      </mesh>
      {/* Glowing border */}
      <mesh ref={glowRef}>
        <boxGeometry args={[1.16, 0.76, 0.02]} />
        <meshBasicMaterial color={color} transparent opacity={0.6} depthWrite={false} />
      </mesh>
      {weaponType === 'm16' ? (
        <>
          {/* M16 silhouette — barrel */}
          <mesh position={[0.1, 0.06, 0.04]}><boxGeometry args={[0.65, 0.06, 0.02]} /><meshBasicMaterial color={color} /></mesh>
          {/* M16 silhouette — body */}
          <mesh position={[-0.08, -0.02, 0.04]}><boxGeometry args={[0.38, 0.13, 0.02]} /><meshBasicMaterial color={color} /></mesh>
          {/* M16 silhouette — stock */}
          <mesh position={[-0.29, -0.06, 0.04]}><boxGeometry args={[0.14, 0.09, 0.02]} /><meshBasicMaterial color={color} /></mesh>
          {/* M16 silhouette — magazine */}
          <mesh position={[-0.05, -0.12, 0.04]}><boxGeometry args={[0.08, 0.14, 0.02]} /><meshBasicMaterial color={color} /></mesh>
        </>
      ) : (
        <>
          {/* Shotgun silhouette — long barrel */}
          <mesh position={[0.12, 0.08, 0.04]}><boxGeometry args={[0.72, 0.07, 0.02]} /><meshBasicMaterial color={color} /></mesh>
          {/* Shotgun silhouette — body/pump */}
          <mesh position={[-0.05, -0.01, 0.04]}><boxGeometry args={[0.28, 0.14, 0.02]} /><meshBasicMaterial color={color} /></mesh>
          {/* Shotgun silhouette — stock */}
          <mesh position={[-0.26, -0.07, 0.04]}><boxGeometry args={[0.16, 0.11, 0.02]} /><meshBasicMaterial color={color} /></mesh>
          {/* Shotgun silhouette — pump grip */}
          <mesh position={[0.06, -0.10, 0.04]}><boxGeometry args={[0.15, 0.07, 0.02]} /><meshBasicMaterial color={color} /></mesh>
        </>
      )}
      {/* Price label stripe */}
      <mesh position={[0, -0.26, 0.04]}>
        <boxGeometry args={[1.0, 0.14, 0.01]} />
        <meshBasicMaterial color={isOwned ? '#003322' : '#1a1100'} />
      </mesh>
      {/* Point light glow */}
      <pointLight color={color} intensity={1.8} distance={4} decay={2} position={[0, 0, 0.2]} />
    </group>
  );
}

function HangingLight({ pos }: { pos: [number,number,number] }) {
  const groupRef = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (!groupRef.current) return;
    const t = state.clock.elapsedTime;
    groupRef.current.rotation.z = Math.sin(t * 0.65 + pos[0] * 0.31) * 0.055;
    groupRef.current.rotation.x = Math.sin(t * 0.48 + pos[2] * 0.24) * 0.038;
  });
  return (
    <group ref={groupRef} position={pos}>
      <mesh position={[0, 0.3, 0]}><boxGeometry args={[0.06, 0.6, 0.06]} /><meshBasicMaterial color="#333333" /></mesh>
      <mesh position={[0, -0.05, 0]}><cylinderGeometry args={[0.38, 0.28, 0.22, 8]} /><meshBasicMaterial color="#2a2a2a" /></mesh>
      <mesh position={[0, -0.28, 0]}><sphereGeometry args={[0.14, 6, 6]} /><meshBasicMaterial color="#aaddff" /></mesh>
      <pointLight position={[0, -0.4, 0]} color="#88aaee" intensity={18} distance={28} decay={2} />
    </group>
  );
}
function IndustrialPillar({ pos }: { pos: [number,number,number] }) {
  return (
    <group position={pos}>
      <RigidBody type="fixed" colliders={false}>
        <mesh position={[0, 2.5, 0]}><boxGeometry args={[1.4, 5, 1.4]} /><meshBasicMaterial color="#252525" /></mesh>
        <mesh position={[0, 0.25, 0]}><boxGeometry args={[1.5, 0.28, 1.5]} /><meshBasicMaterial color="#1a1a00" /></mesh>
        <mesh position={[0, 4.85, 0]}><boxGeometry args={[1.5, 0.28, 1.5]} /><meshBasicMaterial color="#1a1a00" /></mesh>
        <CuboidCollider args={[0.7, 2.5, 0.7]} position={[0, 2.5, 0]} />
      </RigidBody>
    </group>
  );
}
function Machinery({ pos, size, color = '#1a1a2a' }: { pos:[number,number,number]; size:[number,number,number]; color?: string }) {
  const [sx,sy,sz] = size;
  return (
    <group position={pos}>
      <RigidBody type="fixed" colliders={false}>
        <mesh position={[0, sy/2, 0]}>
          <boxGeometry args={size} />
          <meshStandardMaterial color={color} metalness={0.7} roughness={0.4} />
        </mesh>
        <mesh position={[0, sy+0.22, 0]}><boxGeometry args={[sx*0.55, 0.44, sz*0.55]} /><meshBasicMaterial color="#2a2a3a" /></mesh>
        <mesh position={[sx/2-0.1, sy*0.7, sz/2+0.06]}><boxGeometry args={[0.18, 0.18, 0.1]} /><meshBasicMaterial color="#cc2200" /></mesh>
        <CuboidCollider args={[sx/2, sy/2, sz/2]} position={[0, sy/2, 0]} />
      </RigidBody>
    </group>
  );
}
function StorageRack({ pos, len, rotY = 0 }: { pos:[number,number,number]; len: number; rotY?: number }) {
  return (
    <group position={pos} rotation={[0, rotY, 0]}>
      <RigidBody type="fixed" colliders={false}>
        <mesh position={[0, 1.5, 0]}><boxGeometry args={[len, 3.0, 0.38]} /><meshBasicMaterial color="#1c2a1c" /></mesh>
        {[0.6, 1.5, 2.4].map((y, i) => (
          <mesh key={i} position={[0, y, 0.12]}><boxGeometry args={[len, 0.1, 0.62]} /><meshBasicMaterial color="#253525" /></mesh>
        ))}
        <CuboidCollider args={[len/2, 1.5, 0.19]} position={[0, 1.5, 0]} />
      </RigidBody>
    </group>
  );
}

// ── Room 2 animated props ──────────────────────────────────────────────────

/** Spinning ceiling ventilation fan */
function CeilingFan({ pos }: { pos: [number, number, number] }) {
  const bladeRef = useRef<THREE.Group>(null);
  useFrame((_, delta) => {
    if (bladeRef.current) bladeRef.current.rotation.y += delta * 4.8;
  });
  return (
    <group position={pos}>
      <mesh><cylinderGeometry args={[0.06, 0.06, 0.8, 6]} /><meshBasicMaterial color="#222222" /></mesh>
      <mesh position={[0, -0.5, 0]}><cylinderGeometry args={[0.22, 0.22, 0.18, 8]} /><meshBasicMaterial color="#333333" /></mesh>
      <group ref={bladeRef} position={[0, -0.5, 0]}>
        {[0, Math.PI / 2, Math.PI, (Math.PI * 3) / 2].map((rot, i) => (
          <mesh key={i} rotation={[0, rot, 0]} position={[0.85, 0, 0]}>
            <boxGeometry args={[1.5, 0.05, 0.42]} />
            <meshBasicMaterial color="#1a2222" />
          </mesh>
        ))}
      </group>
    </group>
  );
}

/** Spinning warning siren beacon */
function WarningSiren({ pos, color = '#ff2200' }: { pos: [number, number, number]; color?: string }) {
  const beamRef  = useRef<THREE.Group>(null);
  const lightRef = useRef<THREE.PointLight>(null);
  useFrame((state, delta) => {
    if (beamRef.current) beamRef.current.rotation.y += delta * 5.2;
    if (lightRef.current) lightRef.current.intensity = 5 + Math.sin(state.clock.elapsedTime * 9) * 2.5;
  });
  return (
    <group position={pos}>
      <mesh><cylinderGeometry args={[0.18, 0.18, 0.14, 8]} /><meshBasicMaterial color="#111111" /></mesh>
      <group ref={beamRef}>
        <mesh position={[0.55, 0.1, 0]}>
          <boxGeometry args={[1.1, 0.1, 0.16]} />
          <meshBasicMaterial color={color} transparent opacity={0.85} depthWrite={false} />
        </mesh>
      </group>
      <pointLight ref={lightRef} color={color} intensity={5} distance={14} decay={2} />
    </group>
  );
}

/** Sparks cascading from a broken overhead pipe */
function SparkEmitter({ pos }: { pos: [number, number, number] }) {
  const groupRef = useRef<THREE.Group>(null);
  const SPARKS = 18;
  const timers  = useRef(Array.from({ length: SPARKS }, () => Math.random() * 1.2));
  const offsets = useRef(Array.from({ length: SPARKS }, () => ({
    vx: (Math.random() - 0.5) * 1.4, vy: -2.2 - Math.random() * 1.6,
    vz: (Math.random() - 0.5) * 1.4, life: 0.5 + Math.random() * 0.9,
  })));
  useFrame((_, delta) => {
    if (!groupRef.current) return;
    const meshes = groupRef.current.children as THREE.Mesh[];
    for (let i = 0; i < SPARKS; i++) {
      timers.current[i] -= delta;
      const o = offsets.current[i];
      if (timers.current[i] <= 0) {
        o.vx = (Math.random() - 0.5) * 1.4; o.vy = -2.2 - Math.random() * 1.6;
        o.vz = (Math.random() - 0.5) * 1.4; o.life = 0.5 + Math.random() * 0.9;
        timers.current[i] = o.life;
        meshes[i].position.set(0, 0, 0);
      } else {
        const p = 1 - timers.current[i] / o.life;
        meshes[i].position.set(o.vx * p * o.life, o.vy * p * o.life, o.vz * p * o.life);
        (meshes[i].material as THREE.MeshBasicMaterial).opacity = Math.max(0, 1 - p * 1.1);
      }
    }
  });
  return (
    <group position={pos}>
      <group ref={groupRef}>
        {Array.from({ length: SPARKS }, (_, i) => (
          <mesh key={i}>
            <boxGeometry args={[0.055, 0.055, 0.055]} />
            <meshBasicMaterial color="#ffcc22" transparent opacity={1} depthWrite={false} />
          </mesh>
        ))}
      </group>
      {/* Broken pipe reaching ceiling */}
      <mesh position={[0, 0.65, 0]}><boxGeometry args={[0.18, 1.3, 0.18]} /><meshBasicMaterial color="#2a2a2a" /></mesh>
      <pointLight color="#ffaa33" intensity={4} distance={6} decay={2} />
    </group>
  );
}

/** Pulsing neon accent strip mounted on wall */
function NeonStrip({ pos, rotY = 0, len, color }: { pos: [number,number,number]; rotY?: number; len: number; color: string }) {
  const meshRef  = useRef<THREE.Mesh>(null);
  const lightRef = useRef<THREE.PointLight>(null);
  useFrame((state) => {
    const flicker = 0.65 + Math.abs(Math.sin(state.clock.elapsedTime * 3.8 + pos[0] * 0.4)) * 0.35;
    if (meshRef.current)  (meshRef.current.material  as THREE.MeshBasicMaterial).opacity = flicker;
    if (lightRef.current)  lightRef.current.intensity = flicker * 5;
  });
  return (
    <group position={pos} rotation={[0, rotY, 0]}>
      <mesh ref={meshRef}>
        <boxGeometry args={[len, 0.07, 0.05]} />
        <meshBasicMaterial color={color} transparent opacity={0.8} depthWrite={false} />
      </mesh>
      <pointLight ref={lightRef} color={color} intensity={5} distance={12} decay={2} />
    </group>
  );
}

const MAT_DOOR_LOCKED   = new THREE.MeshStandardMaterial({ color: '#2a1010', metalness: 0.85, roughness: 0.3 });
const MAT_DOOR_UNLOCKED = new THREE.MeshStandardMaterial({ color: '#102a14', metalness: 0.85, roughness: 0.3 });

function RoomDoor({ unlocked, cost }: { unlocked: boolean; cost: number }) {
  const slideRef  = useRef(0);
  const doorMeshRef = useRef<THREE.Mesh>(null);
  const doorBarRef  = useRef<THREE.Group>(null);
  const lightRef    = useRef<THREE.PointLight>(null);

  useFrame((_, delta) => {
    slideRef.current = unlocked
      ? Math.min(1, slideRef.current + delta * 2.2)
      : Math.max(0, slideRef.current - delta * 2.2);

    const y = slideRef.current * 4.2;
    if (doorMeshRef.current) doorMeshRef.current.position.y = 1.75 + y;
    if (doorBarRef.current)  doorBarRef.current.position.y  = y;
    if (lightRef.current) lightRef.current.color.set(unlocked ? '#00ff55' : '#ff3300');
  });

  return (
    <group position={[0, 0, -30.4]}>
      {/* Frame — left post */}
      <mesh position={[-2.3, 1.75, 0]}><boxGeometry args={[0.44, 3.8, 0.7]} /><meshBasicMaterial color="#1a1a1a" /></mesh>
      {/* Frame — right post */}
      <mesh position={[ 2.3, 1.75, 0]}><boxGeometry args={[0.44, 3.8, 0.7]} /><meshBasicMaterial color="#1a1a1a" /></mesh>
      {/* Frame — top bar */}
      <mesh position={[0, 3.75, 0]}><boxGeometry args={[5.2, 0.5, 0.7]} /><meshBasicMaterial color="#1a1a1a" /></mesh>

      {/* Door panel (slides up when open) */}
      <mesh ref={doorMeshRef} position={[0, 1.75, 0]} material={unlocked ? MAT_DOOR_UNLOCKED : MAT_DOOR_LOCKED}>
        <boxGeometry args={[3.8, 3.5, 0.28]} />
      </mesh>

      {/* Gate bars overlay (visual detail, slides with door) */}
      <group ref={doorBarRef}>
        {[-1.2, -0.4, 0.4, 1.2].map((x, i) => (
          <mesh key={i} position={[x, 1.75, 0.16]}>
            <boxGeometry args={[0.1, 3.4, 0.1]} />
            <meshBasicMaterial color={unlocked ? '#00cc44' : '#aa2200'} />
          </mesh>
        ))}
      </group>

      {/* Status light */}
      <pointLight ref={lightRef} color={unlocked ? '#00ff55' : '#ff3300'} intensity={4} distance={7} position={[0, 3.2, 0.5]} />
      <mesh position={[0, 3.2, 0.42]}><sphereGeometry args={[0.14, 6, 6]} /><meshBasicMaterial color={unlocked ? '#00ff55' : '#ff3300'} /></mesh>

      {/* Physics blocker — only when locked */}
      {!unlocked && (
        <RigidBody type="fixed" colliders={false}>
          <CuboidCollider args={[1.9, 1.75, 0.15]} position={[0, 1.75, 0]} />
        </RigidBody>
      )}
    </group>
  );
}

// Fire barrel — red metallic with warning stripes + pulsing danger ring
// isHit: barrel exploded, show charred remains only
interface FireBarrelProps {
  pos: [number, number, number];
  flameRef: React.RefObject<THREE.Mesh | null>;
  alertRef: React.RefObject<THREE.Mesh | null>;
  isHit: boolean;
}
function FireBarrel({ pos, flameRef, alertRef, isHit }: FireBarrelProps) {
  return (
    <group position={pos}>
      <RigidBody type="fixed" colliders={false}>
        <mesh>
          <boxGeometry args={[0.58, 0.92, 0.58]} />
          <meshStandardMaterial
            color={isHit ? '#1a0f0f' : '#9e1500'}
            roughness={isHit ? 0.95 : 0.55}
            metalness={isHit ? 0.1 : 0.55}
            emissive={isHit ? '#000000' : '#2a0000'}
            emissiveIntensity={isHit ? 0 : 0.4}
          />
        </mesh>
        <CuboidCollider args={[0.29, 0.46, 0.29]} />
      </RigidBody>

      {!isHit ? (
        <>
          {/* Warning stripes — 3 yellow/black bands around barrel */}
          {([0.28, 0.06, -0.16] as number[]).map((y, i) => (
            <mesh key={i} position={[0, y + 0.46, 0]}>
              <boxGeometry args={[0.60, 0.11, 0.60]} />
              <meshBasicMaterial color={i % 2 === 0 ? '#ffee00' : '#111111'} />
            </mesh>
          ))}
          {/* Danger indicator — glowing yellow sphere cap on top */}
          <mesh position={[0, 1.05, 0]}>
            <sphereGeometry args={[0.12, 6, 6]} />
            <meshStandardMaterial color="#ffee00" emissive="#ffdd00" emissiveIntensity={6} />
          </mesh>
          {/* Pulsing alert ring on ground (animated from GhettoLevel useFrame) */}
          <mesh ref={alertRef} position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.80, 1.05, 24]} />
            <meshBasicMaterial color="#ff4400" transparent opacity={0.5} depthWrite={false} side={THREE.DoubleSide} />
          </mesh>
          {/* Flames */}
          <mesh ref={flameRef} position={[0, 0.76, 0]}>
            <boxGeometry args={[0.46, 0.55, 0.46]} />
            <meshStandardMaterial color="#ff4400" emissive="#ff2200" emissiveIntensity={3.5} transparent opacity={0.85} />
          </mesh>
          <mesh position={[0, 1.02, 0]}>
            <boxGeometry args={[0.30, 0.38, 0.30]} />
            <meshStandardMaterial color="#ff8800" emissive="#ffcc00" emissiveIntensity={4} transparent opacity={0.65} />
          </mesh>
          <pointLight position={[0, 1.3, 0]} color="#ff5500" intensity={7} distance={6} decay={2} />
        </>
      ) : (
        /* Charred barrel after explosion — just a dark scorched cylinder */
        <mesh position={[0, 0.3, 0]}>
          <boxGeometry args={[0.55, 0.6, 0.55]} />
          <meshBasicMaterial color="#0a0808" />
        </mesh>
      )}
    </group>
  );
}

function AbandonedCar({ pos, rotY = 0 }: { pos: [number, number, number]; rotY?: number }) {
  return (
    <group position={pos} rotation={[0, rotY, 0]}>
      <RigidBody type="fixed" colliders={false}>
        <mesh position={[0, 0.6, 0]}>
          <boxGeometry args={[4.2, 1.1, 2.0]} />
          <meshStandardMaterial color="#2a2a3a" roughness={0.85} metalness={0.35} />
        </mesh>
        <mesh position={[-0.4, 1.38, 0]}>
          <boxGeometry args={[2.0, 0.82, 1.75]} />
          <meshStandardMaterial color="#222230" roughness={0.9} metalness={0.3} />
        </mesh>
        <mesh position={[0.6, 1.38, 0]}>
          <boxGeometry args={[0.08, 0.6, 1.5]} />
          <meshBasicMaterial color="#111122" />
        </mesh>
        {([-1.5, 1.5] as number[]).map(wx =>
          [-0.88, 0.88].map(wz => (
            <mesh key={`${wx}-${wz}`} position={[wx, 0.28, wz]}>
              <boxGeometry args={[0.55, 0.56, 0.38]} />
              <meshBasicMaterial color="#111111" />
            </mesh>
          ))
        )}
        {/* Single hull covers the full car volume — no overlapping edges to trap player */}
        <CuboidCollider args={[2.1, 0.9, 1.0]} position={[0, 0.9, 0]} />
      </RigidBody>
    </group>
  );
}

function Building({ pos, size, color = '#2a2218' }: { pos: [number,number,number]; size: [number,number,number]; color?: string }) {
  const [sx, sy, sz] = size;
  const windows: [number, number, number][] = [];
  for (let row = 0; row < Math.floor(sy / 1.5); row++) {
    for (let col = 0; col < Math.floor(sx / 2.5); col++) {
      windows.push([-sx / 2 + 1.2 + col * 2.5, 1.0 + row * 1.5, sz / 2 + 0.04]);
    }
  }
  return (
    <group position={pos}>
      <RigidBody type="fixed" colliders={false}>
        <mesh position={[0, sy / 2, 0]}>
          <boxGeometry args={size} />
          <meshStandardMaterial color={color} roughness={0.95} />
        </mesh>
        <CuboidCollider args={[sx / 2, sy / 2, sz / 2]} position={[0, sy / 2, 0]} />
      </RigidBody>
      {windows.map((wp, i) => (
        <mesh key={i} position={wp}>
          <boxGeometry args={[0.75, 0.65, 0.06]} />
          <meshBasicMaterial color="#334455" />
        </mesh>
      ))}
    </group>
  );
}

// 24 spawn portals — perimeter entry points (walls, corners, alley shadows, mid-wall alcoves)
// Enemies emerge from these fixed points like zombies bursting through the environment
const SPAWN_PORTALS: [number, number, number][] = [
  // North wall — 6 gaps
  [-20, 0.5, -28], [-10, 0.5, -29], [0, 0.5, -27], [10, 0.5, -29], [20, 0.5, -28], [-5, 0.5, -26],
  // South wall — 5 gaps
  [-18, 0.5, 28], [-6, 0.5, 29], [6, 0.5, 27], [18, 0.5, 29], [0, 0.5, 26],
  // East wall — 4 gaps
  [28, 0.5, -18], [29, 0.5, -5], [28, 0.5, 8], [29, 0.5, 20],
  // West wall — 4 gaps
  [-28, 0.5, -15], [-29, 0.5, 0], [-28, 0.5, 12], [-29, 0.5, 22],
  // Corner alley shadows — diagonals
  [-26, 0.5, -25], [26, 0.5, -25], [-26, 0.5, 25], [26, 0.5, 25],
  // Mid-wall alcoves — extra variety
  [0, 0.5, -23], [0, 0.5, 23], [-24, 0.5, 0], [24, 0.5, 0],
];

// Build enemy list for a wave, assigning them to random portal positions
function buildWave(wave: number, startId: number, portals: [number,number,number][]): EnemyData[] {
  const eliteCount     = wave <= 1 ? 0 : wave <= 3 ? 1 : wave <= 6 ? 2 : 3;
  const runnerCount    = wave <= 2 ? 0 : wave <= 5 ? 1 : wave <= 8 ? 2 : 3;
  const tankCount      = wave <= 3 ? 0 : wave <= 6 ? 1 : 2;
  const explosiveCount = wave <= 4 ? 0 : wave <= 7 ? 1 : 2;
  const standardCount  = Math.max(1, wave * 3 - eliteCount - runnerCount - tankCount - explosiveCount);

  const types: EnemyType[] = [
    ...Array<EnemyType>(standardCount).fill('standard'),
    ...Array<EnemyType>(eliteCount).fill('elite'),
    ...Array<EnemyType>(runnerCount).fill('runner'),
    ...Array<EnemyType>(tankCount).fill('tank'),
    ...Array<EnemyType>(explosiveCount).fill('explosive'),
  ];
  // Shuffle enemy types
  for (let i = types.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [types[i], types[j]] = [types[j], types[i]];
  }

  // Shuffle portal indices so enemies spread across the map
  const portalIndices = Array.from({ length: portals.length }, (_, k) => k);
  for (let i = portalIndices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [portalIndices[i], portalIndices[j]] = [portalIndices[j], portalIndices[i]];
  }

  let id = startId;
  return types.map((enemyType, i) => ({
    id: id++,
    spawnPos: portals[portalIndices[i % portals.length]],
    enemyType,
    hpRef: { current: TYPE_HP[enemyType] }, // placeholder — overwritten in wave useEffect
    speedOverride: 0,                         // placeholder — overwritten in wave useEffect
    maxHPScaled: TYPE_HP[enemyType],          // placeholder — overwritten in wave useEffect
  }));
}

// ── Main component ────────────────────────────────────────────────────────────
export function GhettoLevel({ playerPosRef, playerForwardRef, shootTriggerRef, playerReady, roomIndex }: GhettoLevelProps) {
  const { rapier, world } = useRapier();
  const ghettoWave         = useGameStore(state => state.ghettoWave);
  const ghettoShoot        = useGameStore(state => state.ghettoShoot);
  const ghettoAddAmmo      = useGameStore(state => state.ghettoAddAmmo);
  const ghettoEnemyKilled  = useGameStore(state => state.ghettoEnemyKilled);
  const ghettoDamagePlayer = useGameStore(state => state.ghettoDamagePlayer);
  const ghettoAcquireM16      = useGameStore(state => state.ghettoAcquireM16);
  const ghettoAcquireShotgun    = useGameStore(state => state.ghettoAcquireShotgun);
  const ghettoAcquireMachinegun = useGameStore(state => state.ghettoAcquireMachinegun);
  const ghettoOwnedWeapons    = useGameStore(state => state.ghettoOwnedWeapons);
  const ghettoWeapon          = useGameStore(state => state.ghettoWeapon);
  const ghettoDoor1Unlocked = useGameStore(state => state.ghettoDoor1Unlocked);
  const ghettoUnlockDoor1   = useGameStore(state => state.ghettoUnlockDoor1);
  const ghettoSetRoom       = useGameStore(state => state.ghettoSetRoom);
  const ghettoSetEnemiesAlive = useGameStore(state => state.ghettoSetEnemiesAlive);

  const PORTALS   = roomIndex === 0 ? SPAWN_PORTALS  : SPAWN_PORTALS_R2;
  const BARRELS   = roomIndex === 0 ? FIRE_BARREL_POSITIONS : FIRE_BARREL_POSITIONS_R2;
  const STATIONS  = roomIndex === 0 ? BUY_STATIONS   : BUY_STATIONS_R2;
  const SG_STATIONS = roomIndex === 0 ? SHOTGUN_STATIONS : SHOTGUN_STATIONS_R2;
  const MG_STATIONS = roomIndex === 0 ? MACHINEGUN_STATIONS : MACHINEGUN_STATIONS_R2;

  const [enemies, setEnemies]                 = useState<EnemyData[]>([]);
  const [killedEnemies, setKilledEnemies]     = useState<Set<number>>(new Set());
  const [flashingEnemies, setFlashingEnemies] = useState<Set<number>>(new Set());
  const [ammoPickups, setAmmoPickups]         = useState<AmmoPickup[]>([]);
  const [hitBarrels, setHitBarrels]           = useState<Set<number>>(new Set());

  const nextIdRef        = useRef(0);
  const enemyWorldPosMap = useRef<Map<number, THREE.Vector3>>(new Map());
  const enemyHPMap       = useRef<Map<number, number>>(new Map());
  const enemyHPRefMap    = useRef<Map<number, { current: number }>>(new Map());
  const enemyTypeMap     = useRef<Map<number, EnemyType>>(new Map());
  const ammoPickupsRef   = useRef<AmmoPickup[]>([]);
  const ammoPickupIdRef  = useRef(0);
  const flashTimersRef   = useRef<Map<number, number>>(new Map());
  const killedEnemiesRef = useRef<Set<number>>(new Set());
  const hitBarrelsRef    = useRef<Set<number>>(new Set());
  const oobTimerRef      = useRef(0); // out-of-bounds safety check timer

  // Knockback map: id → impulse function
  const knockbackMap = useRef<Map<number, () => void>>(new Map());
  const registerKnockback   = useCallback((id: number, fn: () => void) => { knockbackMap.current.set(id, fn); }, []);
  const unregisterKnockback = useCallback((id: number) => { knockbackMap.current.delete(id); }, []);

  // Explosion visual pool — imperative for performance
  const explosionGroupRef  = useRef<THREE.Group>(null);
  const explosionPool      = useRef<THREE.Mesh[]>([]);
  const explosionTimers    = useRef<number[]>([]);
  const explosionMaxScale  = useRef<number[]>([]);

  useEffect(() => {
    if (!explosionGroupRef.current) return;
    const geom = new THREE.SphereGeometry(1, 8, 8);
    for (let i = 0; i < 8; i++) {
      const mat  = new THREE.MeshBasicMaterial({ color: '#ff4400', transparent: true, opacity: 0, depthWrite: false });
      const mesh = new THREE.Mesh(geom, mat);
      mesh.visible = false;
      explosionGroupRef.current.add(mesh);
      explosionPool.current.push(mesh);
      explosionTimers.current.push(0);
      explosionMaxScale.current.push(7);
    }
  }, []);

  const spawnExplosion = useCallback((pos: THREE.Vector3, maxScale = 7, color = '#ff4400') => {
    cameraShakeRef.current = Math.max(cameraShakeRef.current, 0.38);
    const idx = explosionTimers.current.findIndex(t => t <= 0);
    if (idx < 0) return;
    const mesh = explosionPool.current[idx];
    mesh.position.set(pos.x, pos.y + 0.6, pos.z);
    mesh.scale.setScalar(0.2);
    mesh.visible = true;
    (mesh.material as THREE.MeshBasicMaterial).color.set(color);
    (mesh.material as THREE.MeshBasicMaterial).opacity = 0.85;
    explosionTimers.current[idx] = 0.55;
    explosionMaxScale.current[idx] = maxScale;
  }, []);

  // Flame + alert ring refs — all barrels animated in one useFrame (5 covers both rooms)
  const flameRefObjects = useRef(
    Array.from({ length: 5 }, () => ({ current: null as THREE.Mesh | null }))
  );
  const alertRefObjects = useRef(
    Array.from({ length: 5 }, () => ({ current: null as THREE.Mesh | null }))
  );

  // Spawn enemies for this wave — only once the player is physically in the scene
  useEffect(() => {
    if (!playerReady) return;

    const newEnemies = buildWave(ghettoWave, nextIdRef.current, PORTALS);
    nextIdRef.current += newEnemies.length;

    enemyWorldPosMap.current.clear();
    enemyHPMap.current.clear();
    enemyHPRefMap.current.clear();
    enemyTypeMap.current.clear();

    // Wave scaling: HP grows 25% per wave, speed grows 5% per wave (capped at +60%)
    const hpScale    = 1 + (ghettoWave - 1) * 0.25;
    const spdMult    = Math.min(1.6, 1 + (ghettoWave - 1) * 0.06);

    newEnemies.forEach(e => {
      const hp = Math.ceil(TYPE_HP[e.enemyType] * hpScale);
      enemyHPMap.current.set(e.id, hp);
      enemyTypeMap.current.set(e.id, e.enemyType);
      const ref = { current: hp };
      enemyHPRefMap.current.set(e.id, ref);
      e.hpRef = ref;
      e.maxHPScaled = hp;
      // Speed override computed from base config × wave multiplier
      const baseSpd = { standard: 3.8, runner: 7.2, tank: 2.4, explosive: 3.2, elite: 3.8 }[e.enemyType];
      e.speedOverride = baseSpd * spdMult;
    });

    const emptySet = new Set<number>();
    killedEnemiesRef.current = emptySet;
    setKilledEnemies(emptySet);
    setFlashingEnemies(new Set());
    setEnemies(newEnemies);
    ghettoSetEnemiesAlive(newEnemies.length);
    ammoPickupsRef.current = [];
    setAmmoPickups([]);
    flashTimersRef.current.clear();
    hitBarrelsRef.current = new Set();
    setHitBarrels(new Set());

    // Ground flash at each spawn portal — like zombies bursting through the earth
    newEnemies.forEach(e => {
      spawnExplosion(new THREE.Vector3(e.spawnPos[0], 0.3, e.spawnPos[2]), 2.2, '#cc1100');
    });
  }, [ghettoWave, playerReady]);

  // Per-frame: pickups + flash timers + barrel flame + explosion animation
  useFrame((state, delta) => {
    // Buy station proximity check — update global ref read by App.tsx HUD
    const pp = playerPosRef.current;
    let nearStation: string | null = null;
    for (const s of STATIONS) {
      const dx = pp.x - s.x; const dz = pp.z - s.z;
      if (dx * dx + dz * dz < 9) { nearStation = 'm16'; break; }
    }
    if (!nearStation) {
      for (const s of SG_STATIONS) {
        const dx = pp.x - s.x; const dz = pp.z - s.z;
        if (dx * dx + dz * dz < 9) { nearStation = 'shotgun'; break; }
      }
    }
    if (!nearStation) {
      for (const s of MG_STATIONS) {
        const dx = pp.x - s.x; const dz = pp.z - s.z;
        if (dx * dx + dz * dz < 9) { nearStation = 'machinegun'; break; }
      }
    }
    // Room 1 door proximity
    if (roomIndex === 0 && !nearStation) {
      const ddx = pp.x; const ddz = pp.z + 29;
      if (ddx * ddx + ddz * ddz < 16) {
        nearStation = ghettoDoor1Unlocked ? 'door_open' : 'door_locked';
      }
    }
    ghettoNearStationRef.current = nearStation;

    // Walk-through: player crossed north wall through the open door
    if (roomIndex === 0 && ghettoDoor1Unlocked && pp.z < -31.5 && Math.abs(pp.x) < 2.5) {
      ghettoTeleportRef.current = { x: 0, y: 2, z: 33 };
      ghettoSetRoom(1);
    }

    // Ammo pickup collection
    if (ammoPickupsRef.current.length > 0) {
      const pp = playerPosRef.current;
      const before = ammoPickupsRef.current.length;
      ammoPickupsRef.current = ammoPickupsRef.current.filter(p => {
        const dx = pp.x - p.pos[0]; const dz = pp.z - p.pos[2];
        if (dx * dx + dz * dz < 2.25) { ghettoAddAmmo(10); audio.playAmmoPickup(); return false; }
        return true;
      });
      if (ammoPickupsRef.current.length !== before) setAmmoPickups([...ammoPickupsRef.current]);
    }

    // Flash timers
    if (flashTimersRef.current.size > 0) {
      let changed = false;
      flashTimersRef.current.forEach((t, id) => {
        const nt = t - delta;
        if (nt <= 0) { flashTimersRef.current.delete(id); changed = true; }
        else flashTimersRef.current.set(id, nt);
      });
      if (changed) setFlashingEnemies(new Set(flashTimersRef.current.keys()));
    }

    // Barrel flame + alert ring animation (all in one hook)
    const t = state.clock.elapsedTime;
    for (let i = 0; i < flameRefObjects.current.length; i++) {
      if (hitBarrelsRef.current.has(i)) continue;
      const flame = flameRefObjects.current[i];
      if (flame.current) {
        flame.current.scale.setScalar(0.85 + Math.sin(t * 9 + i * 1.3) * 0.12);
        (flame.current.material as THREE.MeshStandardMaterial).emissiveIntensity = 3.5 + Math.sin(t * 7 + i) * 1.2;
      }
      const ring = alertRefObjects.current[i];
      if (ring.current) {
        // Pulse opacity + scale for warning effect
        (ring.current.material as THREE.MeshBasicMaterial).opacity = 0.25 + Math.abs(Math.sin(t * 2.8 + i * 0.9)) * 0.45;
        const s = 1 + Math.sin(t * 2.2 + i) * 0.12;
        ring.current.scale.set(s, s, 1);
      }
    }

    // Out-of-bounds safety check — every 2.5s, force-kill enemies outside the arena
    // This prevents "1 enemy alive but invisible" softlock when physics flings an enemy out
    oobTimerRef.current += delta;
    if (oobTimerRef.current >= 2.5) {
      oobTimerRef.current = 0;
      enemyWorldPosMap.current.forEach((ePos, id) => {
        if (killedEnemiesRef.current.has(id)) return;
        if (ePos.y < -4 || Math.abs(ePos.x) > 32 || Math.abs(ePos.z) > 32) {
          autoKillOOB(id);
        }
      });
    }

    // Explosion pool animation
    for (let i = 0; i < explosionPool.current.length; i++) {
      if (explosionTimers.current[i] <= 0) continue;
      explosionTimers.current[i] -= delta;
      const mesh = explosionPool.current[i];
      const progress = 1 - Math.max(0, explosionTimers.current[i]) / 0.55;
      mesh.scale.setScalar(0.2 + progress * explosionMaxScale.current[i]);
      (mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.85 * (1 - progress * 1.35));
      if (explosionTimers.current[i] <= 0) mesh.visible = false;
    }
  });

  // updateEnemyPos: reuse Vector3 to avoid GC pressure
  const updateEnemyPos = useCallback((id: number, pos: THREE.Vector3) => {
    let stored = enemyWorldPosMap.current.get(id);
    if (!stored) { stored = new THREE.Vector3(); enemyWorldPosMap.current.set(id, stored); }
    stored.copy(pos);
  }, []);

  const handleEnemyAttack = useCallback((_id: number, damage: number) => {
    ghettoDamagePlayer(damage);
    cameraShakeRef.current     = Math.max(cameraShakeRef.current, 0.45);
    ghettoDamageFlashRef.current = 1.0;
  }, [ghettoDamagePlayer]);

  // Force-kill an enemy that went out of bounds so the wave counter stays correct
  const autoKillOOB = useCallback((enemyId: number) => {
    if (killedEnemiesRef.current.has(enemyId)) return;
    enemyHPMap.current.delete(enemyId);
    const next = new Set([...killedEnemiesRef.current, enemyId]);
    killedEnemiesRef.current = next;
    setKilledEnemies(next);
    ghettoEnemyKilled(0);
  }, [ghettoEnemyKilled]);

  const handleEnemyHit = useCallback((enemyId: number, damage = 1) => {
    const currentHP = enemyHPMap.current.get(enemyId) ?? 1;
    const newHP = currentHP - damage;
    audio.playBulletImpact();

    // Always apply knockback on hit
    knockbackMap.current.get(enemyId)?.();

    // Update the live HP ref so the enemy's health bar re-renders correctly
    const hpRef = enemyHPRefMap.current.get(enemyId);
    if (hpRef) hpRef.current = Math.max(0, newHP);

    if (newHP <= 0) {
      enemyHPMap.current.delete(enemyId);
      const next = new Set([...killedEnemiesRef.current, enemyId]);
      killedEnemiesRef.current = next;
      setKilledEnemies(next);
      const pts = TYPE_POINTS[enemyTypeMap.current.get(enemyId) ?? 'standard'];
      ghettoEnemyKilled(pts);
      // ~40% ammo drop
      const ePos = enemyWorldPosMap.current.get(enemyId);
      if (ePos && Math.random() < 0.40) {
        const pickup: AmmoPickup = { id: ammoPickupIdRef.current++, pos: [ePos.x, 0.5, ePos.z] };
        ammoPickupsRef.current = [...ammoPickupsRef.current, pickup];
        setAmmoPickups([...ammoPickupsRef.current]);
      }
    } else {
      enemyHPMap.current.set(enemyId, newHP);
      flashTimersRef.current.set(enemyId, 0.25);
      setFlashingEnemies(new Set(flashTimersRef.current.keys()));
    }
  }, [ghettoEnemyKilled]);

  // Explosive enemy death — area blast
  const handleExplosiveDeath = useCallback((deathPos: THREE.Vector3) => {
    audio.playExplosion();
    spawnExplosion(deathPos, 8, '#ff6600');

    // Damage enemies in radius 5.5
    enemyWorldPosMap.current.forEach((ePos, id) => {
      if (killedEnemiesRef.current.has(id)) return;
      if (deathPos.distanceTo(ePos) < 5.5) handleEnemyHit(id);
    });

    // Damage player if too close
    if (deathPos.distanceTo(playerPosRef.current) < 4.5) {
      ghettoDamagePlayer(2);
      cameraShakeRef.current       = Math.max(cameraShakeRef.current, 0.5);
      ghettoDamageFlashRef.current = 1.0;
    }
  }, [spawnExplosion, handleEnemyHit, ghettoDamagePlayer, playerPosRef]);

  // Barrel explosion — area blast larger than enemy
  const explodeBarrel = useCallback((barrelIdx: number) => {
    const bPos = BARRELS[barrelIdx];
    const bVec = new THREE.Vector3(bPos[0], bPos[1] + 0.5, bPos[2]);

    hitBarrelsRef.current = new Set([...hitBarrelsRef.current, barrelIdx]);
    setHitBarrels(new Set(hitBarrelsRef.current));

    audio.playExplosion();
    spawnExplosion(bVec, 11, '#ff4400');
    // Second ring
    spawnExplosion(bVec, 7, '#ffaa00');

    // Damage enemies in radius 7
    enemyWorldPosMap.current.forEach((ePos, id) => {
      if (killedEnemiesRef.current.has(id)) return;
      if (bVec.distanceTo(ePos) < 7) handleEnemyHit(id);
    });

    // Damage player if too close
    if (bVec.distanceTo(playerPosRef.current) < 5) {
      ghettoDamagePlayer(2);
      cameraShakeRef.current       = Math.max(cameraShakeRef.current, 0.55);
      ghettoDamageFlashRef.current = 1.0;
    }
  }, [spawnExplosion, handleEnemyHit, ghettoDamagePlayer, playerPosRef]);

  // LOS check: cast a horizontal ray from just in front of the player toward the target.
  // Returns true if no STATIC obstacle (wall/building/car) is blocking the path.
  // Dynamic bodies (enemies) are excluded from the filter so their capsules never block shots.
  const hasLOS = useCallback((from: THREE.Vector3, toX: number, toZ: number, dist: number): boolean => {
    if (dist < 0.5) return true;
    const dx = (toX - from.x) / dist;
    const dz = (toZ - from.z) / dist;
    const ray = new rapier.Ray(
      { x: from.x + dx * 0.9, y: from.y + 0.8, z: from.z + dz * 0.9 },
      { x: dx, y: 0, z: dz },
    );
    const maxToi = Math.max(0.1, dist - 1.2);
    // Only block on fixed/static bodies — dynamic enemy capsules are ignored
    const hit = world.castRay(ray, maxToi, false, undefined, undefined, undefined, undefined,
      (collider: any) => { const rb = collider.parent(); return rb !== null && rb.isFixed(); }
    );
    return hit === null;
  }, [rapier, world]);

  // handleShoot: wider cone + longer range + LOS raycast to block wall-penetrating shots
  const handleShoot = useCallback(() => {
    const fired = ghettoShoot();
    if (!fired) return;

    const playerPos = playerPosRef.current;
    const forward   = playerForwardRef.current;
    const weapon    = useGameStore.getState().ghettoWeapon;
    const isShotgun = weapon === 'shotgun';
    const isMachinegun = weapon === 'machinegun';

    const CONE_TAN  = isShotgun ? Math.tan(deg2rad(45)) : Math.tan(deg2rad(30));
    const MAX_RANGE = isShotgun ? 14 : 22;
    const shotDamage = weapon === 'm16' ? 2 : isShotgun ? 4 : isMachinegun ? 3 : 1;

    // Shotgun: extra camera shake
    if (isShotgun) cameraShakeRef.current = Math.max(cameraShakeRef.current, 0.22);

    let closestDist = Infinity;
    let closestId: number | null = null;

    enemyWorldPosMap.current.forEach((ePos, id) => {
      if (killedEnemiesRef.current.has(id)) return;
      _toEnemy.subVectors(ePos, playerPos);
      const dist = _toEnemy.length();
      if (dist > MAX_RANGE) return;
      const dot = _toEnemy.normalize().dot(forward);
      if (dot <= 0) return;
      const sinAngle = Math.sqrt(Math.max(0, 1 - dot * dot));
      if (sinAngle / dot > CONE_TAN) return;
      if (!hasLOS(playerPos, ePos.x, ePos.z, dist)) return;
      if (dist < closestDist) { closestDist = dist; closestId = id; }
    });

    if (closestId !== null) {
      handleEnemyHit(closestId, shotDamage);
      return;
    }

    // Check barrels — wide cone (they're big static targets) + LOS
    const BARREL_CONE_TAN = Math.tan(deg2rad(isShotgun ? 50 : 42));
    for (let bi = 0; bi < BARRELS.length; bi++) {
      if (hitBarrelsRef.current.has(bi)) continue;
      const bp = BARRELS[bi];
      _toEnemy.set(bp[0] - playerPos.x, 0, bp[2] - playerPos.z);
      const dist = _toEnemy.length();
      if (dist > MAX_RANGE) continue;
      const dot = _toEnemy.normalize().dot(forward);
      if (dot <= 0) continue;
      const sinAngle = Math.sqrt(Math.max(0, 1 - dot * dot));
      if (sinAngle / dot > BARREL_CONE_TAN) continue;
      if (!hasLOS(playerPos, bp[0], bp[2], dist)) continue;
      explodeBarrel(bi);
      break;
    }
  }, [ghettoShoot, playerPosRef, playerForwardRef, handleEnemyHit, explodeBarrel, hasLOS]);

  // Buy station interact handler — registered to the global interact ref
  const handleInteract = useCallback(() => {
    const near = ghettoNearStationRef.current;
    if (near === 'm16') {
      const success = ghettoAcquireM16();
      if (success) audio.playAmmoPickup();
    } else if (near === 'shotgun') {
      const success = ghettoAcquireShotgun();
      if (success) audio.playAmmoPickup();
    } else if (near === 'machinegun') {
      const success = ghettoAcquireMachinegun();
      if (success) audio.playAmmoPickup();
    } else if (near === 'door_locked') {
      const success = ghettoUnlockDoor1();
      if (success) audio.playAmmoPickup();
    }
  }, [ghettoAcquireM16, ghettoAcquireShotgun, ghettoAcquireMachinegun, ghettoUnlockDoor1]);

  useEffect(() => {
    shootTriggerRef.current = handleShoot;
    ghettoInteractTriggerRef.current = handleInteract;
    return () => {
      shootTriggerRef.current = null;
      ghettoInteractTriggerRef.current = null;
    };
  }, [shootTriggerRef, handleShoot, handleInteract]);

  return (
    <>
      {/* Explosion pool — purely imperative, no React state */}
      <group ref={explosionGroupRef} />

      {/* ── Room-conditional geometry ── */}
      {roomIndex === 0 ? (
        <>
          {/* === ROOM 1 GEOMETRY === */}
          {/* Lighting */}
          <ambientLight intensity={1.4} color="#ffffff" />
          <ambientLight intensity={0.5} color="#ffcc88" />
          <directionalLight position={[10, 20, 10]} intensity={2.4} color="#ffe8cc" />
          <pointLight position={[0, 12, 0]} intensity={7} color="#ffbb55" distance={50} decay={1.4} />
          <pointLight position={[-20, 7, 20]} intensity={3} color="#ffaa44" distance={32} decay={2} />
          <pointLight position={[ 20, 7,-20]} intensity={3} color="#ffcc66" distance={32} decay={2} />

          {/* Street lamps */}
          {LAMP_POSITIONS.map((pos, i) => (
            <group key={`lamp-${i}`} position={pos}>
              <mesh position={[0, 1.8, 0]}>
                <boxGeometry args={[0.16, 3.6, 0.16]} />
                <primitive object={MAT_LAMP_BODY} attach="material" />
              </mesh>
              <mesh position={[0.6, 3.5, 0]}>
                <boxGeometry args={[1.0, 0.12, 0.12]} />
                <primitive object={MAT_LAMP_BODY} attach="material" />
              </mesh>
              <mesh position={[1.1, 3.35, 0]}>
                <sphereGeometry args={[0.22, 6, 6]} />
                <primitive object={MAT_LAMP_GLOW} attach="material" />
              </mesh>
              <pointLight position={[1.1, 3.35, 0]} intensity={8} color="#ffcc44" distance={20} decay={2} />
            </group>
          ))}

          {/* Arena floor — 60×60 (visual only; collider is in GhettoFloor inside Game.tsx) */}
          <mesh position={[0, -0.25, 0]}>
            <boxGeometry args={[60, 0.5, 60]} />
            <primitive object={MAT_ASPHALT} attach="material" />
          </mesh>
          {[-12, 0, 12].map((x, i) => (
            <mesh key={i} position={[x, 0.0, 0]}>
              <boxGeometry args={[0.18, 0.01, 38]} />
              <primitive object={MAT_STRIPE} attach="material" />
            </mesh>
          ))}

          {/* Room 1 walls — north wall split to make room for door */}
          {[
            { pos: [-16.2, 2.5, -30.4] as [number,number,number], size: [28.4, 5, 0.8] as [number,number,number] },
            { pos: [ 16.2, 2.5, -30.4] as [number,number,number], size: [28.4, 5, 0.8] as [number,number,number] },
            { pos: [0, 2.5,  30.4] as [number,number,number], size: [60.8, 5, 0.8] as [number,number,number] },
            { pos: [-30.4, 2.5, 0] as [number,number,number], size: [0.8, 5, 60]   as [number,number,number] },
            { pos: [ 30.4, 2.5, 0] as [number,number,number], size: [0.8, 5, 60]   as [number,number,number] },
          ].map(({ pos, size }, i) => (
            <RigidBody key={`wall-${i}`} type="fixed" colliders={false} position={pos}>
              <mesh><boxGeometry args={size} /><primitive object={MAT_WALL} attach="material" /></mesh>
              <CuboidCollider args={[size[0]/2, size[1]/2, size[2]/2]} />
            </RigidBody>
          ))}
          <RoomDoor unlocked={ghettoDoor1Unlocked} cost={DOOR1_COST} />

          {/* Buildings */}
          <Building pos={[-20, 0, -20]} size={[10, 6, 8]} color="#2a2218" />
          <Building pos={[ 20, 0, -22]} size={[ 8, 5, 7]} color="#28201a" />
          <Building pos={[ 22, 0,  20]} size={[ 6, 4, 5]} color="#1e1e2a" />

          {/* Abandoned cars */}
          <AbandonedCar pos={[-9,  0, 7]}  rotY={0.15} />
          <AbandonedCar pos={[12,  0, -7]} rotY={-0.2} />
          <AbandonedCar pos={[-16, 0, -5]} rotY={1.57} />

          {/* Concrete barriers */}
          {BARRIERS.map(({ pos, along }, i) => {
            const sx = along === 'x' ? 7 : 0.8;
            const sz = along === 'z' ? 5 : 0.8;
            return (
              <RigidBody key={`bar-${i}`} type="fixed" colliders={false} position={pos}>
                <mesh><boxGeometry args={[sx, 1, sz]} /><primitive object={MAT_BARRIER} attach="material" /></mesh>
                <mesh position={[0, 0.55, 0]}><boxGeometry args={[sx, 0.12, sz]} /><primitive object={MAT_BAR_TOP} attach="material" /></mesh>
                <CuboidCollider args={[sx/2, 0.5, sz/2]} />
              </RigidBody>
            );
          })}

          {/* Dumpsters */}
          {DUMPSTERS.map((pos, i) => (
            <RigidBody key={`dump-${i}`} type="fixed" colliders={false} position={pos}>
              <mesh>
                <boxGeometry args={[2.2, 1.5, 1.1]} />
                <meshStandardMaterial color={i % 2 === 0 ? '#1a3a1a' : '#2a1a08'} roughness={0.9} />
              </mesh>
              <mesh position={[0, 0.82, 0]}><boxGeometry args={[2.2, 0.12, 1.1]} /><primitive object={MAT_BLACK} attach="material" /></mesh>
              <CuboidCollider args={[1.1, 0.75, 0.55]} />
            </RigidBody>
          ))}

          {/* Crates */}
          {CRATES.map((pos, i) => (
            <RigidBody key={`crate-${i}`} type="fixed" colliders={false} position={pos}>
              <mesh><boxGeometry args={[1, 1, 1]} /><meshStandardMaterial color="#4a3a2a" roughness={0.85} /></mesh>
              <mesh position={[0, 0, 0.51]}><boxGeometry args={[1, 0.08, 0.02]} /><primitive object={MAT_PLANK} attach="material" /></mesh>
              <CuboidCollider args={[0.5, 0.5, 0.5]} />
            </RigidBody>
          ))}
        </>
      ) : (
        <>
          {/* === ROOM 2 GEOMETRY — Industrial Factory (Enhanced) === */}

          {/* ── Lighting — bright industrial fill + colored accent fills ── */}
          <ambientLight intensity={2.5} color="#99aabb" />
          <ambientLight intensity={0.8} color="#445533" />
          <directionalLight position={[15, 25, 10]} intensity={3.5} color="#ddeeff" />
          {/* Central overhead fill */}
          <pointLight position={[0, 8, 0]} intensity={22} color="#aabbcc" distance={70} decay={1.3} />
          {/* Corner fills */}
          <pointLight position={[-25, 6, -25]} intensity={12} color="#5577aa" distance={40} decay={2} />
          <pointLight position={[ 25, 6,  25]} intensity={12} color="#4466bb" distance={40} decay={2} />
          <pointLight position={[-25, 6,  25]} intensity={10} color="#226633" distance={35} decay={2} />
          <pointLight position={[ 25, 6, -25]} intensity={10} color="#442255" distance={35} decay={2} />

          {/* Overhead hanging industrial lights — denser grid, now swaying */}
          {[
            [-22,7,-22],[-8,7,-22],[8,7,-22],[22,7,-22],
            [-22,7,-8],[0,7,-8],[22,7,-8],
            [-22,7,8],[0,7,8],[22,7,8],
            [-22,7,22],[-8,7,22],[8,7,22],[22,7,22],
          ].map((p, i) => (
            <HangingLight key={i} pos={p as [number,number,number]} />
          ))}

          {/* Floor — slightly brighter concrete */}
          <mesh position={[0,-0.25,0]}><boxGeometry args={[82,0.5,82]} /><meshBasicMaterial color="#272727" /></mesh>
          {/* Floor warning stripes */}
          {[[-25,0,-8],[-25,0,8],[25,0,-8],[25,0,8]].map((p,i) => (
            <mesh key={i} position={p as [number,number,number]}>
              <boxGeometry args={[0.22, 0.01, 20]} />
              <meshBasicMaterial color="#554400" />
            </mesh>
          ))}
          {/* Hazard chevrons near machinery */}
          {[[-26,0,-24],[24,0,-20],[-24,0,16],[22,0,21]].map((p,i) => (
            <mesh key={i} position={p as [number,number,number]} rotation={[0, i * Math.PI/4, 0]}>
              <boxGeometry args={[0.18, 0.01, 6]} />
              <meshBasicMaterial color={i % 2 === 0 ? '#ffcc00' : '#111111'} />
            </mesh>
          ))}

          {/* Concrete pillars */}
          {[[-20,0,-20],[0,0,-20],[20,0,-20],[-20,0,0],[20,0,0],[-20,0,20],[0,0,20],[20,0,20]].map((p,i) => (
            <IndustrialPillar key={i} pos={p as [number,number,number]} />
          ))}

          {/* Warning siren beacons on top of pillars — rotating lights */}
          <WarningSiren pos={[-20, 5.3, -20]} color="#ff2200" />
          <WarningSiren pos={[ 20, 5.3,  20]} color="#ff6600" />
          <WarningSiren pos={[-20, 5.3,  20]} color="#ff2200" />
          <WarningSiren pos={[ 20, 5.3, -20]} color="#ffaa00" />

          {/* Ceiling fans — industrial ventilation */}
          <CeilingFan pos={[-10, 7.4, -10]} />
          <CeilingFan pos={[ 10, 7.4,  10]} />
          <CeilingFan pos={[ 10, 7.4, -10]} />
          <CeilingFan pos={[-10, 7.4,  10]} />

          {/* Spark emitters — broken overhead pipes */}
          <SparkEmitter pos={[-12, 6.2, -30]} />
          <SparkEmitter pos={[ 30, 5.8,   8]} />
          <SparkEmitter pos={[-28, 5.2,  -8]} />

          {/* Neon accent strips — cyan north, orange south, red east, yellow west */}
          <NeonStrip pos={[-15, 2.2, -40.8]} len={12} color="#00ddff" />
          <NeonStrip pos={[ 15, 2.2, -40.8]} len={12} color="#00ddff" />
          <NeonStrip pos={[-15, 2.2,  40.8]} len={12} color="#ff6600" />
          <NeonStrip pos={[ 15, 2.2,  40.8]} len={12} color="#ff6600" />
          <NeonStrip pos={[ 40.8, 2.2, -15]} len={12} color="#ff2244" rotY={Math.PI / 2} />
          <NeonStrip pos={[ 40.8, 2.2,  15]} len={12} color="#ff2244" rotY={Math.PI / 2} />
          <NeonStrip pos={[-40.8, 2.2, -15]} len={12} color="#ffcc00" rotY={Math.PI / 2} />
          <NeonStrip pos={[-40.8, 2.2,  15]} len={12} color="#ffcc00" rotY={Math.PI / 2} />

          {/* Heavy machinery */}
          <Machinery pos={[-30,0,-26]} size={[8,4,5]} color="#18181e" />
          <Machinery pos={[28,0,-22]}  size={[6,3.5,6]} color="#1c1a10" />
          <Machinery pos={[-28,0,18]}  size={[5,3,8]}   color="#181e18" />
          <Machinery pos={[26,0,23]}   size={[7,4,5]}   color="#1e1818" />

          {/* Storage racks */}
          <StorageRack pos={[0,0,-34]} len={14} />
          <StorageRack pos={[-36,0,0]} len={12} rotY={Math.PI/2} />
          <StorageRack pos={[0,0,34]}  len={14} />
          <StorageRack pos={[36,0,0]}  len={12} rotY={Math.PI/2} />

          {/* Metal crates */}
          {[[10,0.5,-30],[-8,0.5,-28],[26,0.5,5],[-24,0.5,-8],[6,0.5,28],[-16,0.5,28],[18,0.5,-8],[-10,0.5,12],[22,0.5,14],[3,0.5,-8]].map((p,i)=>(
            <RigidBody key={`r2crate-${i}`} type="fixed" colliders={false} position={p as [number,number,number]}>
              <mesh><boxGeometry args={[1,1,1]} /><meshStandardMaterial color="#2a3a2a" roughness={0.85} /></mesh>
              <CuboidCollider args={[0.5,0.5,0.5]} />
            </RigidBody>
          ))}

          {/* Entry portal — glowing gateway from Room 1 */}
          <group position={[0,0,36]}>
            <mesh><boxGeometry args={[4.2,4,0.2]} /><meshBasicMaterial color="#002211" transparent opacity={0.7} /></mesh>
            <mesh position={[0,0,0.12]}><boxGeometry args={[4.4, 4.2, 0.05]} /><meshBasicMaterial color="#00ff88" transparent opacity={0.12} depthWrite={false} /></mesh>
            <pointLight color="#00ff88" intensity={10} distance={12} />
          </group>

          {/* Room 2 walls (80×80) — slightly brighter */}
          {[
            { pos: [0, 2.5, -41.4] as [number,number,number], size: [82.8, 5, 0.8] as [number,number,number] },
            { pos: [0, 2.5,  41.4] as [number,number,number], size: [82.8, 5, 0.8] as [number,number,number] },
            { pos: [-41.4, 2.5, 0] as [number,number,number], size: [0.8, 5, 82]   as [number,number,number] },
            { pos: [ 41.4, 2.5, 0] as [number,number,number], size: [0.8, 5, 82]   as [number,number,number] },
          ].map(({ pos, size }, i) => (
            <RigidBody key={`r2wall-${i}`} type="fixed" colliders={false} position={pos}>
              <mesh><boxGeometry args={size} /><meshBasicMaterial color="#303028" /></mesh>
              <CuboidCollider args={[size[0]/2, size[1]/2, size[2]/2]} />
            </RigidBody>
          ))}
        </>
      )}

      {/* ── Fire barrels — explosive tactical elements ── */}
      {BARRELS.map((pos, i) => (
        <FireBarrel
          key={`fire-${i}`}
          pos={pos}
          flameRef={flameRefObjects.current[i]}
          alertRef={alertRefObjects.current[i]}
          isHit={hitBarrels.has(i)}
        />
      ))}

      {/* ── Wall buy stations — M16 ── */}
      {STATIONS.map((s, i) => (
        <WallBuyStation key={`buy-${i}`} x={s.x} z={s.z} facing={s.facing} isOwned={ghettoOwnedWeapons.includes('m16')} weaponType="m16" />
      ))}
      {/* ── Wall buy stations — Shotgun ── */}
      {SG_STATIONS.map((s, i) => (
        <WallBuyStation key={`sg-${i}`} x={s.x} z={s.z} facing={s.facing} isOwned={ghettoOwnedWeapons.includes('shotgun')} weaponType="shotgun" />
      ))}
      {/* ── Wall buy stations — Machinegun ── */}
      {MG_STATIONS.map((s, i) => (
        <WallBuyStation key={`mg-${i}`} x={s.x} z={s.z} facing={s.facing} isOwned={ghettoOwnedWeapons.includes('machinegun')} weaponType="machinegun" />
      ))}

      {/* ── Ammo pickups ── */}
      {ammoPickups.map(pickup => (
        <AmmoPickupMesh key={pickup.id} pos={pickup.pos} />
      ))}

      {/* ── Enemies ── */}
      {enemies.map(e => (
        <GhettoEnemy
          key={e.id}
          id={e.id}
          spawnPos={e.spawnPos}
          playerPosRef={playerPosRef}
          onPositionUpdate={updateEnemyPos}
          isKilled={killedEnemies.has(e.id)}
          isFlashing={flashingEnemies.has(e.id)}
          enemyType={e.enemyType}
          onAttackPlayer={handleEnemyAttack}
          onRegisterKnockback={registerKnockback}
          onUnregisterKnockback={unregisterKnockback}
          onExplosiveDeath={handleExplosiveDeath}
          maxHP={e.maxHPScaled}
          hpRef={e.hpRef}
          speedOverride={e.speedOverride}
        />
      ))}
    </>
  );
}

// Module-scope pre-allocated vector for handleShoot
const _toEnemy = new THREE.Vector3();
