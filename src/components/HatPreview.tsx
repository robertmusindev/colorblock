import { useGLTF, useTexture } from '@react-three/drei';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { applySkinToModel, findLegNodes } from '../utils/skinUtils';

// All hat assets loaded upfront (hooks must be called unconditionally)
function HatScene({ hatId }: { hatId: string }) {
  const base = import.meta.env.BASE_URL;

  const { scene: charScene }      = useGLTF(base + 'asset3d/charactert.glb');
  const { scene: paperheadScene } = useGLTF(base + 'asset3d/paperhead.glb');
  const { scene: happyScene }     = useGLTF(base + 'asset3d/happy.glb');
  const { scene: coneScene }      = useGLTF(base + 'asset3d/cone2.glb');
  const { scene: bourgeoisScene } = useGLTF(base + 'asset3d/Bourgeois_hat.glb');
  const { scene: hornsScene }     = useGLTF(base + 'asset3d/horns.glb');

  const charTex      = useTexture(base + 'texture/TEST_Material.002_BaseColor.png');
  const paperheadTex = useTexture(base + 'texture/cap1.png');
  const happyTex     = useTexture(base + 'texture/cap3.png');
  const coneTex      = useTexture(base + 'texture/cono.png');
  const bourgeoisTex = useTexture(base + 'texture/borghesehat.png');
  const hornsTex     = useTexture(base + 'texture/horns.png');

  const groupRef = useRef<THREE.Group>(null);
  const legLRef  = useRef<THREE.Object3D | null>(null);
  const legRRef  = useRef<THREE.Object3D | null>(null);
  const walkTime = useRef(0);

  const charClone = useMemo(() => {
    const c = charScene.clone();
    const fakeTex = charTex.clone();
    fakeTex.flipY = false;
    fakeTex.colorSpace = THREE.SRGBColorSpace;
    applySkinToModel(c, 'default_skin', {
      default: fakeTex,
      israel: fakeTex,
      robsbagliato: fakeTex,
    });
    const { legL, legR } = findLegNodes(c);
    legLRef.current = legL;
    legRRef.current = legR;
    return c;
  }, [charScene, charTex]);

  function makeHatClone(scene: THREE.Group, tex: THREE.Texture) {
    const c = scene.clone();
    const t = tex.clone();
    t.flipY = false;
    t.colorSpace = THREE.SRGBColorSpace;
    c.traverse(child => {
      if ((child as THREE.Mesh).isMesh) {
        (child as THREE.Mesh).material = new THREE.MeshStandardMaterial({ map: t });
      }
    });
    return c;
  }

  const hatClones = useMemo(() => ({
    hat_paperhead: makeHatClone(paperheadScene, paperheadTex),
    hat_happy:     makeHatClone(happyScene,     happyTex),
    hat_cone:      makeHatClone(coneScene,      coneTex),
    hat_bourgeois: makeHatClone(bourgeoisScene, bourgeoisTex),
    hat_horns:     makeHatClone(hornsScene,     hornsTex),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [paperheadScene, paperheadTex, happyScene, happyTex, coneScene, coneTex, bourgeoisScene, bourgeoisTex, hornsScene, hornsTex]);

  useFrame((_, delta) => {
    if (groupRef.current) groupRef.current.rotation.y += delta * 0.9;
    walkTime.current += delta;
    const sway = Math.sin(walkTime.current * 1.5) * 0.15;
    if (legLRef.current) legLRef.current.rotation.x = sway;
    if (legRRef.current) legRRef.current.rotation.x = -sway;
  });

  const activeHat = hatClones[hatId as keyof typeof hatClones] ?? null;

  return (
    <group ref={groupRef} rotation={[0, Math.PI, 0]} position={[0, -1, 0]}>
      <primitive object={charClone} />
      {activeHat && <primitive object={activeHat} />}
    </group>
  );
}

export function HatPreview({ hatId }: { hatId: string }) {
  return <HatScene hatId={hatId} />;
}

// Preload all hat GLBs
useGLTF.preload(import.meta.env.BASE_URL + 'asset3d/paperhead.glb');
useGLTF.preload(import.meta.env.BASE_URL + 'asset3d/happy.glb');
useGLTF.preload(import.meta.env.BASE_URL + 'asset3d/cone2.glb');
useGLTF.preload(import.meta.env.BASE_URL + 'asset3d/Bourgeois_hat.glb');
useGLTF.preload(import.meta.env.BASE_URL + 'asset3d/horns.glb');
