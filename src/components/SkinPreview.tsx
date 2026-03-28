import { useGLTF, useTexture } from '@react-three/drei';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { applySkinToModel, updateLegendaryRainbow, findLegNodes } from '../utils/skinUtils';

interface SkinPreviewProps {
  skinId: string;
}

export function SkinPreview({ skinId }: SkinPreviewProps) {
  const { scene } = useGLTF(import.meta.env.BASE_URL + 'asset3d/charactert.glb');
  const textures = useTexture({
    default: import.meta.env.BASE_URL + 'texture/TEST_Material.002_BaseColor.png',
    israel: import.meta.env.BASE_URL + 'skins/israel_skin.png',
    robsbagliato: import.meta.env.BASE_URL + 'texture/robsbagliato.png',
  });

  const legLRef = useRef<THREE.Object3D | null>(null);
  const legRRef = useRef<THREE.Object3D | null>(null);
  const walkTime = useRef(0);

  const clone = useMemo(() => {
    const c = scene.clone();
    applySkinToModel(c, skinId, textures);
    
    const { legL, legR } = findLegNodes(c);
    legLRef.current = legL;
    legRRef.current = legR;
    
    return c;
  }, [scene, textures, skinId]);

  useFrame((state, delta) => {
    if (skinId === 'skin_legendary') {
      updateLegendaryRainbow(clone, state.clock.elapsedTime);
    }
    
    // Idle animation for preview: gentle leg sway
    walkTime.current += delta;
    const sway = Math.sin(walkTime.current * 1.5) * 0.15;
    if (legLRef.current) legLRef.current.rotation.x = sway;
    if (legRRef.current) legRRef.current.rotation.x = -sway;
  });

  return (
    <group rotation={[0, Math.PI, 0]} position={[0, -1, 0]}>
      <primitive object={clone} />
    </group>
  );
}

useGLTF.preload(import.meta.env.BASE_URL + 'asset3d/charactert.glb');
