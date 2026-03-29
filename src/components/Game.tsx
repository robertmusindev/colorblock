import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Physics, CuboidCollider, RigidBody } from '@react-three/rapier';
import { useMemo, useRef, useState, useEffect } from 'react';
import { Platform } from './Platform';
import { Player } from './Player';
import { Bot } from './Bot';
import { NetworkPlayer } from './NetworkPlayer';
import { ParkourLevel } from './ParkourLevel';
import { GhettoLevel } from './GhettoLevel';
import { useGameStore, BOT_NAMES } from '../store';
import { useMultiplayerStore } from '../store/multiplayer';
import { ghettoPlayerPosRef, ghettoPlayerForwardRef, ghettoShootTriggerRef, cameraShakeRef } from '../utils/ghetto-refs';

import { uiRefs } from '../utils/ui-refs';

// Texture stella pixelata con glow: croce pixelata + alone morbido radiale
function makeStarTexture(size: number) {
  const c = document.createElement('canvas');
  c.width = size; c.height = size;
  const ctx = c.getContext('2d')!;
  const m = size / 2;

  // Glow radiale morbido
  const glow = ctx.createRadialGradient(m, m, 0, m, m, m * 0.9);
  glow.addColorStop(0,   'rgba(255,255,255,0.55)');
  glow.addColorStop(0.3, 'rgba(200,220,255,0.20)');
  glow.addColorStop(1,   'rgba(0,0,0,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, size, size);

  // Croce pixelata sopra il glow
  ctx.fillStyle = '#ffffff';
  const t = Math.max(1, Math.floor(size / 16));  // spessore braccio
  ctx.fillRect(m - t, 0, t * 2, size);   // verticale
  ctx.fillRect(0, m - t, size, t * 2);   // orizzontale
  ctx.fillRect(m - t * 2, m - t * 2, t * 4, t * 4); // centro più spesso

  // Diagonali leggere
  ctx.globalAlpha = 0.3;
  ctx.fillRect(m - t * 3, m - t * 3, t * 2, t * 2);
  ctx.fillRect(m + t,     m - t * 3, t * 2, t * 2);
  ctx.fillRect(m - t * 3, m + t,     t * 2, t * 2);
  ctx.fillRect(m + t,     m + t,     t * 2, t * 2);

  const tex = new THREE.CanvasTexture(c);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  return tex;
}

function StarField() {
  // Due layer: grandi (poche) + piccole (tante)
  const bigTex   = useMemo(() => makeStarTexture(32), []);
  const smallTex = useMemo(() => makeStarTexture(16), []);

  const { bigPos, bigCount, smallPos, smallCount } = useMemo(() => {
    const BIG = 60, SMALL = 150;
    const bp = new Float32Array(BIG * 3);
    const sp = new Float32Array(SMALL * 3);
    const place = (arr: Float32Array, i: number, r: number) => {
      const theta = Math.random() * Math.PI * 2;
      const phi   = Math.acos(2 * Math.random() - 1);
      arr[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
      arr[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      arr[i * 3 + 2] = r * Math.cos(phi);
    };
    for (let i = 0; i < BIG;   i++) place(bp, i, 180);
    for (let i = 0; i < SMALL; i++) place(sp, i, 200);
    return { bigPos: bp, bigCount: BIG, smallPos: sp, smallCount: SMALL };
  }, []);

  const groupRef = useRef<THREE.Group>(null);
  useFrame((state, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.008;
      // Follow camera so stars are always visible even when camera moves far from origin
      groupRef.current.position.copy(state.camera.position);
    }
  });

  const matProps = { transparent: true, depthWrite: false, sizeAttenuation: false, opacity: 0.5 } as const;

  return (
    <group ref={groupRef}>
      {/* Stelle grandi */}
      <points>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" array={bigPos} count={bigCount} itemSize={3} />
        </bufferGeometry>
        <pointsMaterial map={bigTex} alphaMap={bigTex} alphaTest={0.02} size={16} color="#ffffff" {...matProps} />
      </points>
      {/* Stelle piccole */}
      <points>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" array={smallPos} count={smallCount} itemSize={3} />
        </bufferGeometry>
        <pointsMaterial map={smallTex} alphaMap={smallTex} alphaTest={0.02} size={6} color="#ccd8ff" opacity={0.35} transparent depthWrite={false} sizeAttenuation={false} />
      </points>
    </group>
  );
}

function GameLogic() {
  const tick = useGameStore(state => state.tick);
  const tickParkour = useGameStore(state => state.tickParkour);
  const tickGhetto = useGameStore(state => state.tickGhetto);
  const gameMode = useGameStore(state => state.gameMode);
  const maxTime = useGameStore(state => state.maxTime);

  useFrame((state, delta) => {
    if (gameMode === 'ghetto') {
      tickGhetto(delta);
    } else if (gameMode === 'parkour') {
      tickParkour(delta);
    } else {
      tick(delta);
    }

    // Update Timer UI Refs (High Performance, No React Re-render for the whole App)
    const gameState = useGameStore.getState().gameState;
    if (uiRefs.timerBar || uiRefs.timerText) {
      if (gameState === 'playing' || gameState === 'elimination') {
        let timeLeft, maxTimeVal;
        if (gameMode === 'parkour') {
          timeLeft = useGameStore.getState().parkourTime;
          maxTimeVal = useGameStore.getState().maxParkourTime;
        } else {
          timeLeft = useGameStore.getState().timeLeft;
          maxTimeVal = maxTime;
        }
        const progress = Math.max(0, timeLeft / maxTimeVal) * 100;

        if (uiRefs.timerBar) {
          uiRefs.timerBar.style.width = `${progress}%`;
          if (timeLeft < maxTimeVal * 0.2) {
            uiRefs.timerBar.style.backgroundColor = '#ef4444';
          } else if (timeLeft < maxTimeVal * 0.5) {
            uiRefs.timerBar.style.backgroundColor = '#eab308';
          } else {
            uiRefs.timerBar.style.backgroundColor = '#22c55e';
          }
        }
        if (uiRefs.timerText) {
          uiRefs.timerText.innerText = gameState === 'playing' ? `${timeLeft.toFixed(1)}s` : '0.0s';
        }
        if (uiRefs.stopwatch && gameMode === 'parkour') {
          const elapsed = maxTimeVal - timeLeft;
          const mins = Math.floor(elapsed / 60);
          const secs = elapsed % 60;
          uiRefs.stopwatch.innerText = mins > 0
            ? `${mins}:${secs.toFixed(0).padStart(2, '0')}`
            : `${secs.toFixed(1)}s`;
        }
        if (uiRefs.parkourVignette) {
          if (gameMode === 'parkour' && gameState === 'playing') {
            const ratio = timeLeft / maxTimeVal;
            if (ratio < 0.10) {
              // Critical: flicker via CSS animation
              uiRefs.parkourVignette.style.animation = 'vignetteFlicker 0.45s ease-in-out infinite';
              uiRefs.parkourVignette.style.opacity = '0.55';
            } else if (ratio < 0.25) {
              uiRefs.parkourVignette.style.animation = '';
              uiRefs.parkourVignette.style.opacity = String(((0.25 - ratio) / 0.25 * 0.50).toFixed(3));
            } else {
              uiRefs.parkourVignette.style.animation = '';
              uiRefs.parkourVignette.style.opacity = '0';
            }
          } else {
            uiRefs.parkourVignette.style.animation = '';
            uiRefs.parkourVignette.style.opacity = '0';
          }
        }
      }
    }
  });
  return null;
}

// Standalone floor for the ghetto arena — lives OUTSIDE GhettoLevel so it can be
// mounted during the loading screen (2 s before startGhettoGame fires), giving Rapier
// plenty of time to register the collider before the player spawns.
function GhettoFloor() {
  return (
    <RigidBody type="fixed" colliders={false}>
      <CuboidCollider args={[50, 0.25, 50]} position={[0, -0.25, 0]} />
    </RigidBody>
  );
}

function MenuCamera() {
  useFrame((state) => {
    const time = state.clock.getElapsedTime();
    const radius = 25;
    state.camera.position.x = Math.sin(time * 0.2) * radius;
    state.camera.position.z = Math.cos(time * 0.2) * radius;
    state.camera.position.y = 15;
    state.camera.lookAt(0, 0, 0);
  });
  return null;
}

export function Game() {
  const gameState    = useGameStore(state => state.gameState);
  const gameMode     = useGameStore(state => state.gameMode);
  const gameId       = useGameStore(state => state.gameId);
  const parkourLevel = useGameStore(state => state.parkourLevel);
  const ghettoWave   = useGameStore(state => state.ghettoWave);
  const ghettoRoom   = useGameStore(state => state.ghettoRoom);
  const aliveBots    = useGameStore(state => state.aliveBots);

  const lobbyId      = useMultiplayerStore(state => state.lobbyId);
  const players      = useMultiplayerStore(state => state.players);
  const myPlayerId   = useMultiplayerStore(state => state.myPlayerId);

  const remotePlayers = players.filter(p => p.id !== myPlayerId);

  const ghettoFloorPrimed = useGameStore(state => state.ghettoFloorPrimed);
  const isGhettoActive  = gameMode === 'ghetto' && gameState === 'playing';
  // Reset camera shake when ghetto mode is not active (carries no state between games)
  if (!isGhettoActive) cameraShakeRef.current = 0;
  const isParkourActive = gameMode === 'parkour' &&
    (gameState === 'playing' || gameState === 'levelcomplete');

  // Delay player spawn so the arena floor collider (which was primed during loading) is
  // definitely active before the player's first physics tick.  500 ms is enough because
  // the floor RigidBody was mounted 2 s earlier via primeGhettoFloor().
  const [ghettoPlayerReady, setGhettoPlayerReady] = useState(false);
  useEffect(() => {
    if (!isGhettoActive) { setGhettoPlayerReady(false); return; }
    const t = setTimeout(() => setGhettoPlayerReady(true), 500);
    return () => clearTimeout(t);
  }, [isGhettoActive, gameId]);

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      {/* Vignette overlay */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 10 }}>
        <div style={{
          position: 'absolute', inset: 0,
          background: 'radial-gradient(ellipse at 50% 50%, transparent 55%, rgba(0,0,0,0.55) 100%)',
        }} />
      </div>

      <Canvas
        shadows
        dpr={[1, 1.5]}
        frameloop="always"
        camera={{ position: [0, 10, 15], fov: 50, far: 500 }}
        gl={{ antialias: true, toneMapping: THREE.NoToneMapping }}
      >
        <GameLogic />
        <color attach="background" args={['#000008']} />
        <StarField />
        {!isGhettoActive && <ambientLight intensity={1.2} color="#ffffff" />}
        {!isGhettoActive && (
          <directionalLight
            castShadow
            position={[30, 50, 20]}
            intensity={2.5}
            shadow-mapSize={[512, 512]}
            shadow-camera-left={-40}
            shadow-camera-right={40}
            shadow-camera-top={40}
            shadow-camera-bottom={-40}
            shadow-bias={-0.0001}
          />
        )}

        <Physics gravity={[0, -20, 0]} timeStep="vary">
          {/* Ghetto floor is mounted as soon as loading starts (2 s before game begins)
              so Rapier has plenty of time to register the collider — see primeGhettoFloor() */}
          {ghettoFloorPrimed && <GhettoFloor />}

          {isGhettoActive ? (
            /* ── Ghetto mode: arena + enemies ── */
            <>
              <GhettoLevel
                key={`ghetto-${gameId}-wave-${ghettoWave}-room-${ghettoRoom}`}
                playerPosRef={ghettoPlayerPosRef}
                playerForwardRef={ghettoPlayerForwardRef}
                shootTriggerRef={ghettoShootTriggerRef}
                playerReady={ghettoPlayerReady}
                roomIndex={ghettoRoom}
              />
              {/* Player mounts 500ms after game starts — floor was already primed 2 s earlier */}
              {ghettoPlayerReady && <Player key={`player-ghetto-${gameId}`} />}
            </>
          ) : isParkourActive ? (
            /* ── Parkour mode: level platforms + same third-person player ── */
            <>
              <ParkourLevel key={`parkour-${parkourLevel}`} />
              <Player key={`player-${gameId}`} />
            </>
          ) : (
            /* ── Classic / third-person ── */
            <>
              <Platform />
              {(gameState === 'playing' || gameState === 'elimination') && (
                <>
                  <Player key={`player-${gameId}`} />

                  {/* AI Bots (singleplayer only) */}
                  {!lobbyId && aliveBots.map(id => (
                    <Bot key={`bot-${gameId}-${id}`} id={id} name={BOT_NAMES[id]} />
                  ))}
                </>
              )}

              {/* Realtime network players — outside the playing guard so they are never
                  unmounted mid-session (prevents re-snap to [0,5,0] each round).
                  Safe: lobbyId is null during menu/singleplayer, so nothing renders. */}
              {lobbyId && remotePlayers.map(p => (
                <NetworkPlayer
                  key={`net-${p.id}`}
                  id={p.id}
                  name={p.name}
                  position={p.position || [0, 5, 0]}
                  rotation={p.rotation}
                  isEliminated={p.isEliminated}
                  skinId={p.skinId}
                />
              ))}
            </>
          )}
        </Physics>

        {/* Menu / gameover camera fly-around */}
        {(gameState === 'menu' || gameState === 'gameover') && <MenuCamera />}
      </Canvas>
    </div>
  );
}
