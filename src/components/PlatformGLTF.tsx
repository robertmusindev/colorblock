import { useGLTF } from '@react-three/drei';
import { RigidBody } from '@react-three/rapier';

// Esempio di come caricare un GLB esterno per la piattaforma.
// Per usarlo, sostituisci <Platform /> con <PlatformGLTF /> in Game.tsx
// e assicurati di avere un file 'platform.glb' nella cartella public.

export function PlatformGLTF() {
  // const { nodes, materials } = useGLTF('/platform.glb') as any;
  // 
  // Ritorna la struttura mappando i materiali
  // Esempio:
  // return (
  //   <group>
  //     {Object.keys(nodes).map((key) => {
  //       const node = nodes[key];
  //       if (node.isMesh) {
  //         return (
  //           <RigidBody key={key} type="fixed" colliders="trimesh">
  //             <mesh geometry={node.geometry} material={materials[node.material.name]} />
  //           </RigidBody>
  //         );
  //       }
  //       return null;
  //     })}
  //   </group>
  // );
  return null;
}

// useGLTF.preload('/platform.glb');
