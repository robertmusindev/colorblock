import { useRef, useEffect, useMemo, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Billboard, Text, useGLTF, useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { applySkinToModel, updateLegendaryRainbow, findLegNodes } from '../utils/skinUtils';

interface NetworkPlayerProps {
  id: string;
  name: string;
  position: [number, number, number];
  rotation?: [number, number, number];
  isEliminated?: boolean;
  skinId?: string;
}

// Pre-allocate to avoid GC in useFrame
const _targetQuat = new THREE.Quaternion();
const _euler = new THREE.Euler();
const _prevPos = new THREE.Vector3();

export function NetworkPlayer({ id, name, position, rotation, isEliminated, skinId }: NetworkPlayerProps) {
  const group = useRef<THREE.Group>(null);
  const legLRef = useRef<THREE.Object3D | null>(null);
  const legRRef = useRef<THREE.Object3D | null>(null);
  
  // Create a ThreeJS Vector3 interpolation target to smooth movement
  const targetPosition = useRef(new THREE.Vector3(...position));
  const hasInitialized = useRef(false);
  
  // Track falling state for elimination animation
  const isFalling = useRef(false);
  const fallVelocity = useRef(0);
  const walkTime = useRef(0);

  // Snap to real position on mount: read buffer first (more current than Zustand presence pos)
  // This prevents the [0,5,0] ghost-slide that happens when Zustand never carries live movement.
  useEffect(() => {
    const buffer = (window as any).remotePlayerBuffer;
    const snapPos = (buffer && buffer[id]?.position) ? buffer[id].position : position;
    targetPosition.current.set(snapPos[0], snapPos[1], snapPos[2]);
    if (group.current) group.current.position.copy(targetPosition.current);
    hasInitialized.current = true;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const { scene } = useGLTF(import.meta.env.BASE_URL + 'asset3d/charactert.glb');
  const textures = useTexture({
    default: import.meta.env.BASE_URL + 'texture/TEST_Material.002_BaseColor.png',
    israel: import.meta.env.BASE_URL + 'skins/israel_skin.png',
    robsbagliato: import.meta.env.BASE_URL + 'texture/robsbagliato.png',
  });

  const [currentSkin, setCurrentSkin] = (useState as any)(skinId || 'default_skin');

  const clone = useMemo(() => {
    const c = scene.clone();
    
    // Apply skin using centralized utility
    applySkinToModel(c, currentSkin, textures);
    
    // Find leg nodes by actual GLB names
    const { legL, legR } = findLegNodes(c);
    legLRef.current = legL;
    legRRef.current = legR;
    
    return c;
  }, [scene, textures, currentSkin]);

  useFrame((state, delta) => {
    if (!group.current) return;

    if (isEliminated) {
        if (!isFalling.current) {
            isFalling.current = true;
        }
        fallVelocity.current += 9.8 * delta * 2;
        group.current.position.y -= fallVelocity.current * delta;
        group.current.rotation.x += delta;
        group.current.rotation.z += delta * 0.5;
        return;
    }

    // Optimized: Read from non-reactive buffer
    const buffer = (window as any).remotePlayerBuffer;
    if (buffer && buffer[id]) {
      const b = buffer[id];
      // Skip stale data (player likely disconnected if >2s without update)
      if ((Date.now() - b.timestamp) <= 2000) {
        targetPosition.current.set(b.position[0], b.position[1], b.position[2]);

        if (b.skinId && b.skinId !== currentSkin) {
          setCurrentSkin(b.skinId);
        }

        _euler.set(b.rotation[0], b.rotation[1], b.rotation[2], 'XYZ');
        _targetQuat.setFromEuler(_euler);
        group.current.quaternion.slerp(_targetQuat, 1 - Math.exp(-15 * delta));
      }
    }

    // Rainbow effect for Legendary Skin
    if (currentSkin === 'skin_legendary') {
      updateLegendaryRainbow(clone, state.clock.elapsedTime);
    }

    const lerpFactor = 1 - Math.exp(-12 * delta);
    _prevPos.copy(group.current.position);
    group.current.position.lerp(targetPosition.current, lerpFactor);

    const distanceMoved = _prevPos.distanceTo(group.current.position);
    const legL = legLRef.current;
    const legR = legRRef.current;
    
    if (distanceMoved > 0.05) {
      walkTime.current += delta * (distanceMoved / delta) * 0.5;
      const swingAmplitude = Math.min(0.7, distanceMoved * 8);
      
      // Natural walk: Leg_S and Leg_R in opposite phase  
      if (legL) {
        legL.rotation.x = THREE.MathUtils.lerp(
          legL.rotation.x,
          Math.sin(walkTime.current) * swingAmplitude,
          1 - Math.exp(-20 * delta)
        );
      }
      if (legR) {
        legR.rotation.x = THREE.MathUtils.lerp(
          legR.rotation.x,
          Math.sin(walkTime.current + Math.PI) * swingAmplitude,
          1 - Math.exp(-20 * delta)
        );
      }
    } else {
      // Return to neutral
      if (legL) legL.rotation.x = THREE.MathUtils.lerp(legL.rotation.x, 0, 1 - Math.exp(-15 * delta));
      if (legR) legR.rotation.x = THREE.MathUtils.lerp(legR.rotation.x, 0, 1 - Math.exp(-15 * delta));
      walkTime.current = 0;
    }
  });

  return (
    <group ref={group}>
      {/* Name Tag */}
      {(!isEliminated || group.current?.position.y > -5) && (
        <Billboard position={[0, 2.5, 0]}>
          <Text fontSize={0.4} color="white" outlineWidth={0.05} outlineColor="black" fontWeight="bold">
            {name}
          </Text>
        </Billboard>
      )}

      {/* 3D Model Avatar for Network Players */}
      <group position={[0, -0.9, 0]}>
        <primitive object={clone} />
      </group>
    </group>
  );
}
