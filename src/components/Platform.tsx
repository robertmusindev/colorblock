import { InstancedRigidBodies, RapierRigidBody, InstancedRigidBodyProps } from '@react-three/rapier';
import { useGameStore, COLORS } from '../store';
import { useMemo, useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Coin } from './Coin';



const GRID_SIZE = 20;
const TOTAL_BLOCKS = GRID_SIZE * GRID_SIZE;

// Texture 16×16 pixel art: bevel + ombre + noise. NearestFilter = pixel croccanti.
function makeBlockTexture() {
  const s = 16;
  const c = document.createElement('canvas');
  c.width = s; c.height = s;
  const ctx = c.getContext('2d')!;

  // Base bianca (verrà moltiplicata dal colore istanza)
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, s, s);

  // Highlight top/left (bevel leggero)
  ctx.fillStyle = 'rgba(255,255,255,0.30)';
  ctx.fillRect(0, 0, s, 1);
  ctx.fillRect(0, 0, 1, s);

  // Shadow bottom/right (bevel morbido)
  ctx.fillStyle = 'rgba(0,0,0,0.20)';
  ctx.fillRect(0, s - 1, s, 1);
  ctx.fillRect(s - 1, 0, 1, s);

  // Pixel noise minimo — appena percettibile
  ctx.fillStyle = 'rgba(0,0,0,0.05)';
  [[4,4],[9,6],[12,9],[6,11],[10,13],[13,5],[8,8]].forEach(([x,y]) => {
    ctx.fillRect(x, y, 1, 1);
  });

  const tex = new THREE.CanvasTexture(c);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

const BLOCK_TEXTURE = makeBlockTexture();

export function Platform() {
  const gridColors = useGameStore(state => state.gridColors);
  const gameState = useGameStore(state => state.gameState);
  const gameMode = useGameStore(state => state.gameMode);
  const targetColor = useGameStore(state => state.targetColor);
  const hoveredBlockIndex = useGameStore(state => state.hoveredBlockIndex);
  const roundsSurvived = useGameStore(state => state.roundsSurvived);
  const isPaused = useGameStore(state => state.isPaused);
  const gameId = useGameStore(state => state.gameId);
  
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const rigidBodiesRef = useRef<RapierRigidBody[]>(null);

  const targetColorIndex = targetColor ? COLORS.findIndex(c => c.name === targetColor.name) : -1;
  const isElimination = gameState === 'elimination';
  const isGameover = gameState === 'gameover';



  // Prepare instances data
  const instances = useMemo(() => {
    const inst: InstancedRigidBodyProps[] = [];
    for (let i = 0; i < TOTAL_BLOCKS; i++) {
      const x = (i % GRID_SIZE) - 9.5;
      const z = Math.floor(i / GRID_SIZE) - 9.5;
      inst.push({
        key: i,
        position: [x * 2, -0.5, z * 2],
        type: "kinematicPosition",
        colliders: "cuboid"
      });
    }
    return inst;
  }, []);

  // 1a. Physics Update (classic): solo in modalità classic
  useEffect(() => {
    if (!rigidBodiesRef.current || gameMode === 'parkour') return;

    gridColors.forEach((colorIndex, i) => {
      const body = rigidBodiesRef.current![i];
      if (!body) return;

      const isTarget = colorIndex === targetColorIndex;
      const shouldHide = (isElimination || isGameover) && !isTarget;

      if (shouldHide) {
        body.setBodyType(2, true);
        const x = (i % GRID_SIZE) - 9.5;
        const z = Math.floor(i / GRID_SIZE) - 9.5;
        body.setTranslation({ x: x * 2, y: -100, z: z * 2 }, true);
      } else {
        body.setBodyType(2, true);
        const x = (i % GRID_SIZE) - 9.5;
        const z = Math.floor(i / GRID_SIZE) - 9.5;
        body.wakeUp();
        body.setTranslation({ x: x * 2, y: -0.5, z: z * 2 }, true);
        body.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
        body.setLinvel({ x: 0, y: 0, z: 0 }, true);
        body.setAngvel({ x: 0, y: 0, z: 0 }, true);
      }
    });
  }, [roundsSurvived, isElimination, isGameover, targetColorIndex, gameMode]);



  // 2. Visuals Update: Run on color changes or hover
  useEffect(() => {
    if (!meshRef.current) return;

    const tempColor = new THREE.Color();
    
    gridColors.forEach((colorIndex, i) => {
      // Update Visuals (Colors)
      const colorHex = COLORS[colorIndex].hex;
      tempColor.set(colorHex);
      
      // Hover effect: Only touch color, don't touch physics!
      if (i === hoveredBlockIndex) {
        tempColor.multiplyScalar(1.4); // Subtle highlight
      }
      
      meshRef.current?.setColorAt(i, tempColor);
    });

    meshRef.current.instanceColor!.needsUpdate = true;
    
    // Senior Dev Tip: Manually compute bounding sphere to prevent the mesh 
    // from disappearing if Three.js box culling gets confused by physics moves.
    meshRef.current.computeBoundingSphere();
  }, [gridColors, hoveredBlockIndex]);



  return (
    <group>
      <InstancedRigidBodies
        ref={rigidBodiesRef}
        instances={instances}
        colliders="cuboid"
      >
        <instancedMesh
          ref={meshRef}
          args={[undefined, undefined, TOTAL_BLOCKS]}
          castShadow
          receiveShadow={false}
          frustumCulled={false}
        >
          <boxGeometry args={[1.95, 1, 1.95]} />
          <meshStandardMaterial map={BLOCK_TEXTURE} roughness={0.9} />
        </instancedMesh>
      </InstancedRigidBodies>
      
      {useGameStore.getState().spawnedCoins.map(idx => (
        <Coin key={`coin-${idx}`} index={idx} />
      ))}
    </group>
  );
}
