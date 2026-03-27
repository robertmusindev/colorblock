import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { RigidBody, CuboidCollider } from '@react-three/rapier';
import { useGameStore } from '../store';

export function Coin({ index }: { index: number }) {
  const meshRef = useRef<any>(null);
  const collectCoin = useGameStore(state => state.collectCoin);
  
  const x = (index % 20) - 9.5;
  const z = Math.floor(index / 20) - 9.5;

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += 0.05;
      meshRef.current.position.y = 0.5 + Math.sin(state.clock.elapsedTime * 2) * 0.1;
    }
  });

  return (
    <RigidBody
      type="fixed"
      colliders={false}
      position={[x * 2, 0.5, z * 2]}
      sensor
      onIntersectionEnter={() => {
        collectCoin(index);
      }}
    >
      <CuboidCollider args={[0.5, 0.5, 0.5]} sensor />
      <mesh ref={meshRef} castShadow>
        <cylinderGeometry args={[0.4, 0.4, 0.1, 16]} />
        <meshStandardMaterial 
          color="#fbbf24" 
          metalness={0.8} 
          roughness={0.2} 
          emissive="#fbbf24"
          emissiveIntensity={0.5}
        />
      </mesh>
      
      {/* Decorative glow */}
      <pointLight color="#fbbf24" intensity={0.5} distance={2} />
    </RigidBody>
  );
}
