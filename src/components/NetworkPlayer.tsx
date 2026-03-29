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
const _prevNetPos = new THREE.Vector3(); // previous network-received position (for velocity)

export function NetworkPlayer({ id, name, position, rotation, isEliminated, skinId }: NetworkPlayerProps) {
  const group = useRef<THREE.Group>(null);
  const legLRef = useRef<THREE.Object3D | null>(null);
  const legRRef = useRef<THREE.Object3D | null>(null);

  const targetPosition = useRef(new THREE.Vector3(...position));
  const hasInitialized = useRef(false);

  // Smoothed speed estimation from network deltas (not per-frame lerp delta)
  const smoothedSpeed = useRef(0);
  const lastNetworkPosRef = useRef(new THREE.Vector3(...position));
  const lastNetworkTimeRef = useRef(Date.now());

  // Track falling state for elimination animation
  const isFalling = useRef(false);
  const fallVelocity = useRef(0);
  const walkTime = useRef(0);

  // Snap immediately on mount: read buffer first (more current than Zustand presence pos)
  // This prevents the [0,5,0] ghost-slide since Zustand never carries live movement data.
  useEffect(() => {
    const buffer = (window as any).remotePlayerBuffer;
    const b = buffer?.[id];
    const snapPos = b?.position ?? position;
    targetPosition.current.set(snapPos[0], snapPos[1], snapPos[2]);
    lastNetworkPosRef.current.set(snapPos[0], snapPos[1], snapPos[2]);
    if (group.current) {
      group.current.position.copy(targetPosition.current);
      // Also snap rotation from buffer so the model faces the right direction immediately
      if (b?.rotation) {
        _euler.set(b.rotation[0], b.rotation[1], b.rotation[2], 'XYZ');
        _targetQuat.setFromEuler(_euler);
        group.current.quaternion.copy(_targetQuat);
      }
    }
    hasInitialized.current = true;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const { scene } = useGLTF(import.meta.env.BASE_URL + 'asset3d/charactert.glb');
  const textures = useTexture({
    default:      import.meta.env.BASE_URL + 'texture/TEST_Material.002_BaseColor.png',
    israel:       import.meta.env.BASE_URL + 'skins/israel_skin.png',
    robsbagliato: import.meta.env.BASE_URL + 'texture/robsbagliato.png',
    skin3:        import.meta.env.BASE_URL + 'texture/skin3.png',
    skin4:        import.meta.env.BASE_URL + 'texture/skin4.png',
  });

  const [currentSkin, setCurrentSkin] = (useState as any)(skinId || 'default_skin');

  const clone = useMemo(() => {
    const c = scene.clone();
    applySkinToModel(c, currentSkin, textures);
    const { legL, legR } = findLegNodes(c);
    legLRef.current = legL;
    legRRef.current = legR;
    return c;
  }, [scene, textures, currentSkin]);

  useFrame((state, delta) => {
    if (!group.current) return;

    if (isEliminated) {
      if (!isFalling.current) isFalling.current = true;
      fallVelocity.current += 9.8 * delta * 2;
      group.current.position.y -= fallVelocity.current * delta;
      group.current.rotation.x += delta;
      group.current.rotation.z += delta * 0.5;
      return;
    }

    // Read from non-reactive buffer
    const buffer = (window as any).remotePlayerBuffer;
    if (buffer && buffer[id]) {
      const b = buffer[id];
      const age = Date.now() - b.timestamp;

      // Skip stale data (player likely disconnected if >2.5s without update)
      if (age <= 2500) {
        const nx = b.position[0], ny = b.position[1], nz = b.position[2];
        const prevNet = lastNetworkPosRef.current;

        // Update smoothed speed estimate whenever the buffer holds a NEW packet
        // (detected by checking if network position changed since last read)
        if (nx !== prevNet.x || ny !== prevNet.y || nz !== prevNet.z) {
          const dt = Math.max(0.001, (Date.now() - lastNetworkTimeRef.current) / 1000);
          _prevNetPos.set(nx - prevNet.x, ny - prevNet.y, nz - prevNet.z);
          const rawSpeed = _prevNetPos.length() / dt;
          // Exponential smoothing to avoid jitter from occasional large deltas
          smoothedSpeed.current = smoothedSpeed.current * 0.6 + rawSpeed * 0.4;

          lastNetworkPosRef.current.set(nx, ny, nz);
          lastNetworkTimeRef.current = Date.now();
        }

        targetPosition.current.set(nx, ny, nz);

        if (b.skinId && b.skinId !== currentSkin) {
          setCurrentSkin(b.skinId);
        }

        _euler.set(b.rotation[0], b.rotation[1], b.rotation[2], 'XYZ');
        _targetQuat.setFromEuler(_euler);
        group.current.quaternion.slerp(_targetQuat, 1 - Math.exp(-15 * delta));
      } else {
        // Data went stale — player stopped moving or disconnected
        smoothedSpeed.current *= 0.9; // decay speed so legs return to idle
      }
    }

    // Rainbow effect for Legendary Skin
    if (currentSkin === 'skin_legendary') {
      updateLegendaryRainbow(clone, state.clock.elapsedTime);
    }

    // Position interpolation
    group.current.position.lerp(targetPosition.current, 1 - Math.exp(-12 * delta));

    // --- Animation driven by smoothed network speed (not per-frame lerp delta) ---
    const speed = smoothedSpeed.current;
    const legL = legLRef.current;
    const legR = legRRef.current;

    if (speed > 0.8) {
      // Running: speed-scaled walk cycle
      walkTime.current += delta * Math.min(speed, 14) * 0.5;
      const swingAmplitude = Math.min(0.75, speed * 0.065);

      if (legL) {
        legL.rotation.x = THREE.MathUtils.lerp(
          legL.rotation.x,
          Math.sin(walkTime.current) * swingAmplitude,
          1 - Math.exp(-18 * delta)
        );
      }
      if (legR) {
        legR.rotation.x = THREE.MathUtils.lerp(
          legR.rotation.x,
          Math.sin(walkTime.current + Math.PI) * swingAmplitude,
          1 - Math.exp(-18 * delta)
        );
      }
    } else {
      // Idle: smooth legs back to neutral
      smoothedSpeed.current = Math.max(0, smoothedSpeed.current - delta * 8);
      if (legL) legL.rotation.x = THREE.MathUtils.lerp(legL.rotation.x, 0, 1 - Math.exp(-12 * delta));
      if (legR) legR.rotation.x = THREE.MathUtils.lerp(legR.rotation.x, 0, 1 - Math.exp(-12 * delta));
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

      {/* 3D Model Avatar */}
      <group position={[0, -0.9, 0]}>
        <primitive object={clone} />
      </group>
    </group>
  );
}
