import { useFrame } from '@react-three/fiber';
import { Billboard, Text, useGLTF, useTexture } from '@react-three/drei';
import { RigidBody, CapsuleCollider, BallCollider } from '@react-three/rapier';
import { useRef, useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import { useGameStore } from '../store';
import { useProfileStore } from '../store/profile';
import { useMultiplayerStore } from '../store/multiplayer';
import { audio } from '../utils/audio';
import { DustParticles } from '../utils/DustParticles';
import { CloudTrail } from '../utils/CloudTrail';
import { applySkinToModel, updateLegendaryRainbow, findLegNodes } from '../utils/skinUtils';
import { ghettoPlayerPosRef, ghettoPlayerForwardRef, ghettoShootTriggerRef, cameraShakeRef, ghettoInteractTriggerRef, ghettoTeleportRef } from '../utils/ghetto-refs';

const SPEED = 12;
const JUMP_FORCE = 8;

// Optimization: Pre-allocate objects for useFrame inside module scope to prevent Garbage Collection stutters
const _direction = new THREE.Vector3();
const _frontVector = new THREE.Vector3();
const _sideVector = new THREE.Vector3();
const _currentVelocity = new THREE.Vector3();
const _targetQuaternion = new THREE.Quaternion();
const _upVector = new THREE.Vector3(0, 1, 0);
const _idealPos = new THREE.Vector3();
const _scaleVector = new THREE.Vector3();
const _cameraLookAt = new THREE.Vector3();
const _cameraLookAtTarget = new THREE.Vector3();

// Ghetto aim / bullet pre-allocated vectors
const _groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const _aimPoint = new THREE.Vector3();
const _muzzleOffset = new THREE.Vector3();
const _bulletDelta = new THREE.Vector3();

interface BulletState {
  mesh: THREE.Mesh;
  active: boolean;
  pos: THREE.Vector3;
  dir: THREE.Vector3;
  dist: number;
}

export function Player() {
  const bodyRef = useRef<any>(null);
  const avatarRef = useRef<THREE.Group>(null);
  const visualRef = useRef<THREE.Group>(null); // Separato per animazioni visive
  const legLRef = useRef<THREE.Object3D | null>(null);
  const legRRef = useRef<THREE.Object3D | null>(null);
  const bodyNodeRef = useRef<THREE.Object3D | null>(null);
  const footstepTimer = useRef(0);
  const walkTime = useRef(0);
  const networkSyncTimer = useRef(0);
  const idleTime = useRef(0);
  const jumpStartTime = useRef(0);
  const lastGroundedTime = useRef(0);
  const dustEmitCooldown = useRef(0);
  const dustActiveRef = useRef(false);
  
  // Animation state
  const animationState = useRef<'idle' | 'running' | 'jumping' | 'falling' | 'landing' | 'celebrating'>('idle');
  const jumpVelocityY = useRef(0);
  
  // Current position and state for effects
  const currentPosRef = useRef<[number, number, number]>([0, 0, 0]);
  const currentVelRef = useRef<[number, number, number]>([0, 0, 0]);
  const currentIsGroundedRef = useRef(false);
  const currentSpeedRef = useRef(0);
  const cloudActiveRef = useRef(false);
  const prevYRef          = useRef(5);
  const prevVelYRef       = useRef(0);    // vel.y from previous frame for landing detection
  const coyoteTimeRef     = useRef(0);    // Grace period after leaving ground (allows late jumps)
  const jumpBufferRef     = useRef(0);    // Buffer: jump pressed just before landing
  const airJumpsRef       = useRef(0);    // Air jumps used (for double jump gadget)
  const blockGroundedRef  = useRef(false); // True after jump — clears only on real landing (velocity snap)
  const jumpCooldownRef   = useRef(0);    // Minimum time between jumps to prevent spam

  // Ghetto mode refs
  const gameModeRef = useRef<string>('classic');
  const stainPool = useRef<THREE.Mesh[]>([]);
  const stainIndex = useRef(0);
  const stainTimer = useRef(0);
  const stainsGroupRef = useRef<THREE.Group>(null);

  // Ghetto bullets + aim + fx
  const bulletGroupRef  = useRef<THREE.Group>(null);
  const aimIndicatorRef = useRef<THREE.Mesh>(null);
  const bulletPool      = useRef<BulletState[]>([]);
  const bulletPoolReady = useRef(false);
  const muzzleFlashRef  = useRef<THREE.PointLight | null>(null);
  // M16 auto-fire state
  const isMouseHeldRef   = useRef(false);
  const lastAutoFireRef  = useRef(0);         // elapsed time of last auto-fire shot
  const fireBulletRef    = useRef<(() => void) | null>(null); // set inside useEffect, read by useFrame

  // Use ref instead of useState to prevent continuous re-rendering
  const keys = useRef({ forward: false, backward: false, left: false, right: false, jump: false, jumpHandled: false });
  
  const playerDied            = useGameStore(state => state.playerDied);
  const activeGadgets         = useGameStore(state => state.activeGadgets);
  const playerSpeedMultiplier = useGameStore(state => state.playerSpeedMultiplier);
  const gameState = useGameStore(state => state.gameState);
  const gameMode = useGameStore(state => state.gameMode);
  const parkourJumpForce = useGameStore(state => state.parkourJumpForce);
  const username = useGameStore(state => state.username) || 'Guest';
  
  const lobbyId = useMultiplayerStore(state => state.lobbyId);
  const broadcastMovement = useMultiplayerStore(state => state.broadcastMovement);
  const equippedSkin = useProfileStore(state => state.profile?.equipped_skin || 'default_skin');
  const equippedHat  = useProfileStore(state => state.profile?.equipped_hat || null);

  useEffect(() => {
    audio.preloadMachinegunSfx(import.meta.env.BASE_URL + 'sfx/Minigun Sound Test (SFM) (mp3cut.net).mp3');
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent scrolling with spacebar
      if (e.code === 'Space') e.preventDefault();
      switch (e.code) {
        case 'KeyW': case 'ArrowUp': keys.current.forward = true; break;
        case 'KeyS': case 'ArrowDown': keys.current.backward = true; break;
        case 'KeyA': case 'ArrowLeft': keys.current.left = true; break;
        case 'KeyD': case 'ArrowRight': keys.current.right = true; break;
        case 'Space': keys.current.jump = true; if (!e.repeat) jumpBufferRef.current = 0.15; break;
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      switch (e.code) {
        case 'KeyW': case 'ArrowUp': keys.current.forward = false; break;
        case 'KeyS': case 'ArrowDown': keys.current.backward = false; break;
        case 'KeyA': case 'ArrowLeft': keys.current.left = false; break;
        case 'KeyD': case 'ArrowRight': keys.current.right = false; break;
        case 'Space': 
          keys.current.jump = false; 
          keys.current.jumpHandled = false; // Reset ability to jump when key is released
          break;
      }
    };
    // Ghetto mode: fire visual bullet
    const fireBullet = () => {
      if (!avatarRef.current || !bulletGroupRef.current || !bodyRef.current) return;
      const bullet = bulletPool.current.find(b => !b.active);
      if (!bullet) return;
      const p = bodyRef.current.translation();
      // Muzzle local position relative to avatarRef (avatar is at [0,-0.9,0] from body)
      _muzzleOffset.set(0.35, 0.5 - 0.9, -0.22).applyQuaternion(avatarRef.current.quaternion);
      bullet.pos.set(p.x + _muzzleOffset.x, p.y + _muzzleOffset.y, p.z + _muzzleOffset.z);
      bullet.dir.copy(ghettoPlayerForwardRef.current);
      bullet.dist = 0;
      bullet.active = true;
      bullet.mesh.position.copy(bullet.pos);
      bullet.mesh.visible = true;
      bullet.mesh.rotation.set(0, Math.atan2(bullet.dir.x, bullet.dir.z), 0);
      // Screen shake + muzzle flash on fire
      cameraShakeRef.current = Math.max(cameraShakeRef.current, 0.09);
      if (muzzleFlashRef.current) muzzleFlashRef.current.intensity = 16;
    };
    fireBulletRef.current = fireBullet;

    // Helper: can fire with current weapon?
    const canFire = () => {
      const s = useGameStore.getState();
      if (s.ghettoWeapon === 'm16') return s.ghettoM16Ammo > 0;
      if (s.ghettoWeapon === 'shotgun') return s.ghettoShotgunAmmo > 0;
      if (s.ghettoWeapon === 'machinegun') return s.ghettoMachinegunAmmo > 0;
      return s.ghettoAmmo > 0;
    };

    // Ghetto mode: shoot on E key (pistol single-shot only)
    const handleGhettoKey = (e: KeyboardEvent) => {
      if (gameModeRef.current !== 'ghetto') return;
      if (useGameStore.getState().gameState !== 'playing') return;
      if (e.code === 'KeyE') {
        if (canFire()) fireBullet();
        ghettoShootTriggerRef.current?.();
      } else if (e.code === 'KeyF') {
        ghettoInteractTriggerRef.current?.();
      } else if (e.code === 'Digit1') {
        useGameStore.getState().ghettoSetWeapon('pistol');
      } else if (e.code === 'Digit2') {
        useGameStore.getState().ghettoSetWeapon('m16');
      } else if (e.code === 'Digit3') {
        useGameStore.getState().ghettoSetWeapon('shotgun');
      } else if (e.code === 'Digit4') {
        useGameStore.getState().ghettoSetWeapon('machinegun');
      }
    };
    // Ghetto mode: shoot on left click
    const handleMouseDown = (e: MouseEvent) => {
      if (e.button === 0 && gameModeRef.current === 'ghetto') {
        if (useGameStore.getState().gameState !== 'playing') return;
        isMouseHeldRef.current = true;
        const weapon = useGameStore.getState().ghettoWeapon;
        if (weapon === 'machinegun') {
          // Machinegun: start looped sound + auto-fire in useFrame
          audio.startMachinegunLoop();
        } else if (weapon !== 'm16') {
          // Pistol / shotgun: single shot per click
          if (canFire()) fireBullet();
          ghettoShootTriggerRef.current?.();
        }
        // M16: handled in useFrame auto-fire loop
      }
    };
    const handleMouseUp = (e: MouseEvent) => {
      if (e.button === 0) {
        isMouseHeldRef.current = false;
        audio.stopMachinegunLoop();
      }
    };

    window.addEventListener('keydown', handleKeyDown, { passive: false });
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('keydown', handleGhettoKey);
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('keydown', handleGhettoKey);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  // Keep gameModeRef in sync
  useEffect(() => { gameModeRef.current = gameMode; }, [gameMode]);

  // Rescue player if stuck inside a spawning block at round start
  useEffect(() => {
    if (gameState !== 'playing' || gameMode !== 'classic') return;
    // Wait one physics frame for blocks to settle, then check player position
    const id = setTimeout(() => {
      if (!bodyRef.current) return;
      const pos = bodyRef.current.translation();
      const vel = bodyRef.current.linvel();
      // Only rescue if nearly stationary vertically — freely falling players have vel.y << -3
      if (pos.y < 0.5 && vel.y > -3) {
        bodyRef.current.setTranslation({ x: pos.x, y: 3.0, z: pos.z }, true);
        bodyRef.current.setLinvel({ x: 0, y: 0, z: 0 }, true);
      }
    }, 80);
    return () => clearTimeout(id);
  }, [gameState, gameMode]);

  // Initialize floor stain pool for ghetto mode
  useEffect(() => {
    if (gameMode !== 'ghetto' || !stainsGroupRef.current) return;
    stainPool.current = [];
    stainIndex.current = 0;
    const geom = new THREE.PlaneGeometry(1, 1);
    for (let i = 0; i < 40; i++) {
      const mesh = new THREE.Mesh(
        geom,
        new THREE.MeshBasicMaterial({ color: '#4a5a1a', transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide })
      );
      mesh.rotation.x = -Math.PI / 2;
      const s = 0.35 + (i % 7) * 0.06;
      mesh.scale.set(s, s * (0.6 + (i % 5) * 0.1), 1);
      mesh.visible = false;
      mesh.position.y = 0.02;
      stainsGroupRef.current.add(mesh);
      stainPool.current.push(mesh);
    }
    return () => {
      stainPool.current = [];
    };
  }, [gameMode]);

  // Initialize bullet pool for ghetto mode
  useEffect(() => {
    if (gameMode !== 'ghetto' || bulletPoolReady.current) return;
    bulletPoolReady.current = true;
    bulletPool.current = [];
    const geom = new THREE.BoxGeometry(0.07, 0.07, 0.48);
    const mat = new THREE.MeshBasicMaterial({ color: '#ffaa00' });
    for (let i = 0; i < 12; i++) {
      const mesh = new THREE.Mesh(geom, mat);
      mesh.visible = false;
      bulletGroupRef.current?.add(mesh);
      bulletPool.current.push({ mesh, active: false, pos: new THREE.Vector3(), dir: new THREE.Vector3(), dist: 0 });
    }
    return () => {
      bulletPoolReady.current = false;
      bulletPool.current = [];
    };
  }, [gameMode]);

  const { scene } = useGLTF(import.meta.env.BASE_URL + 'asset3d/charactert.glb');
  const { scene: shotgunScene } = useGLTF(import.meta.env.BASE_URL + 'asset3d/shotgun1.glb');
  const { scene: machinegunScene } = useGLTF(import.meta.env.BASE_URL + 'asset3d/machinegun.glb');
  const textures = useTexture({
    default: import.meta.env.BASE_URL + 'texture/TEST_Material.002_BaseColor.png',
    israel: import.meta.env.BASE_URL + 'skins/israel_skin.png',
    robsbagliato: import.meta.env.BASE_URL + 'texture/robsbagliato.png',
    skin3: import.meta.env.BASE_URL + 'texture/skin3.png',
    skin4: import.meta.env.BASE_URL + 'texture/skin4.png',
  });
  const shotgunTex = useTexture(import.meta.env.BASE_URL + 'texture/shotgun.png');
  const machinegunTex = useTexture(import.meta.env.BASE_URL + 'texture/Machinegun_t.png');
  const { scene: hatScene }   = useGLTF(import.meta.env.BASE_URL + 'asset3d/paperhead.glb');
  const hatTex                = useTexture(import.meta.env.BASE_URL + 'texture/cap1.png');
  const { scene: happyScene } = useGLTF(import.meta.env.BASE_URL + 'asset3d/happy.glb');
  const happyTex              = useTexture(import.meta.env.BASE_URL + 'texture/cap3.png');

  const shotgunMesh = useMemo(() => {
    const c = shotgunScene.clone();
    const tex = shotgunTex.clone();
    tex.flipY = false;
    c.traverse(child => {
      if ((child as THREE.Mesh).isMesh) {
        (child as THREE.Mesh).material = new THREE.MeshStandardMaterial({ map: tex, metalness: 0.8, roughness: 0.3 });
      }
    });
    return c;
  }, [shotgunScene, shotgunTex]);

  const machinegunMesh = useMemo(() => {
    const c = machinegunScene.clone();
    const tex = machinegunTex.clone();
    tex.flipY = false;
    c.traverse(child => {
      if ((child as THREE.Mesh).isMesh) {
        (child as THREE.Mesh).material = new THREE.MeshStandardMaterial({ map: tex, metalness: 0.8, roughness: 0.3 });
      }
    });
    return c;
  }, [machinegunScene, machinegunTex]);

  const hatMesh = useMemo(() => {
    const c = hatScene.clone();
    const tex = hatTex.clone();
    tex.flipY = false;
    c.traverse(child => {
      if ((child as THREE.Mesh).isMesh) {
        (child as THREE.Mesh).material = new THREE.MeshStandardMaterial({ map: tex });
      }
    });
    return c;
  }, [hatScene, hatTex]);

  const happyMesh = useMemo(() => {
    const c = happyScene.clone();
    const tex = happyTex.clone();
    tex.flipY = false;
    c.traverse(child => {
      if ((child as THREE.Mesh).isMesh) {
        (child as THREE.Mesh).material = new THREE.MeshStandardMaterial({ map: tex });
      }
    });
    return c;
  }, [happyScene, happyTex]);

  const ghettoWeapon = useGameStore(state => state.ghettoWeapon);

  const clone = useMemo(() => {
    const c = scene.clone();
    
    // Apply skin using centralized utility
    applySkinToModel(c, equippedSkin, textures);
    
    // Find leg nodes by actual GLB names: Leg_S (left), Leg_R (right), body
    const { legL, legR, body } = findLegNodes(c);
    legLRef.current = legL;
    legRRef.current = legR;
    bodyNodeRef.current = body;
    
    return c;
  }, [scene, textures, equippedSkin]);

  useFrame((state, delta) => {
    if (!bodyRef.current) return;

    const position = bodyRef.current.translation();
    const pos = { x: position.x, y: position.y, z: position.z };
    
    // Broadcast movement to network at ~15fps (every 0.066s)
    if (lobbyId && avatarRef.current) {
      networkSyncTimer.current += delta;
      if (networkSyncTimer.current > 0.066) {
         const avatarRot = avatarRef.current.rotation;
         broadcastMovement([pos.x, pos.y, pos.z], [avatarRot.x, avatarRot.y, avatarRot.z], equippedSkin);
         networkSyncTimer.current = 0;
      }
    }

    if (pos.y < -10) {
      playerDied();
      return;
    }

    const velocity = bodyRef.current.linvel();
    const vel = { x: velocity.x, y: velocity.y, z: velocity.z };
    
    _frontVector.set(0, 0, (keys.current.backward ? 1 : 0) - (keys.current.forward ? 1 : 0));
    _sideVector.set((keys.current.left ? 1 : 0) - (keys.current.right ? 1 : 0), 0, 0);

    const hasDoubleJump = activeGadgets.some(g => g.type === 'doubleJump');
    const hasSpeedBoost = activeGadgets.some(g => g.type === 'speedBoost');
    const hasHighJump   = activeGadgets.some(g => g.type === 'highJump');
    const effectiveSpeed = SPEED * playerSpeedMultiplier * (hasSpeedBoost ? 1.5 : 1);

    _direction.subVectors(_frontVector, _sideVector).normalize().multiplyScalar(effectiveSpeed);

    // Ground check
    const yDiff    = Math.abs(pos.y - prevYRef.current);
    const prevVelY = prevVelYRef.current;
    prevVelYRef.current = vel.y;
    prevYRef.current    = pos.y;
    // Clear blockGrounded when we detect a real landing: was falling AND velocity snapped to near-zero
    // Threshold -0.3 (not -1.0) so short/tap jumps also clear it on landing
    if (blockGroundedRef.current && prevVelY < -0.3 && Math.abs(vel.y) < 0.5) {
      blockGroundedRef.current = false;
    }
    // rawGrounded: stable vertical velocity AND not mid-jump (blockGrounded guards the apex)
    const rawGrounded = !blockGroundedRef.current && Math.abs(vel.y) < 0.8 && yDiff < 0.15;

    // Coyote time: 80ms grace period after leaving ground to allow late jumps
    if (rawGrounded) {
      coyoteTimeRef.current = 0.08;
    } else {
      coyoteTimeRef.current = Math.max(0, coyoteTimeRef.current - delta);
    }
    const isGrounded = rawGrounded || coyoteTimeRef.current > 0;
    
    // Update refs for effects
    currentPosRef.current = [pos.x, pos.y, pos.z];
    currentIsGroundedRef.current = isGrounded;
    currentSpeedRef.current = _currentVelocity.length();
    currentVelRef.current = [vel.x, vel.y, vel.z];
    dustActiveRef.current = animationState.current === 'running' && isGrounded;
    // Cloud trail attivo quando il player si muove (ground o air)
    const horizontalSpeed = Math.sqrt(vel.x * vel.x + vel.z * vel.z);
    cloudActiveRef.current = horizontalSpeed > 2.0;

    // Update animation state
    const speed = _currentVelocity.length();
    
    // Hero animation trigger (victory celebration)
    if (gameState === 'victory' && animationState.current !== 'celebrating') {
      animationState.current = 'celebrating';
      jumpStartTime.current = state.clock.elapsedTime;
    } else if (gameState !== 'victory' && animationState.current === 'celebrating') {
      animationState.current = 'idle';
    }
    
    if (isGrounded) {
      lastGroundedTime.current = state.clock.elapsedTime;
      if (speed > 0.5 && animationState.current !== 'celebrating') {
        animationState.current = 'running';
      } else if (animationState.current !== 'celebrating') {
        animationState.current = 'idle';
      }
      if (jumpStartTime.current > 0 && state.clock.elapsedTime - jumpStartTime.current > 0.1) {
        // Just landed after a jump
        animationState.current = 'landing';
        setTimeout(() => {
          if (animationState.current === 'landing') {
            animationState.current = speed > 0.5 ? 'running' : 'idle';
          }
        }, 200);
      }
    } else {
      if (vel.y > 0.5 && animationState.current !== 'celebrating') {
        animationState.current = 'jumping';
        jumpStartTime.current = state.clock.elapsedTime;
      } else if (vel.y < -0.5 && animationState.current !== 'celebrating') {
        animationState.current = 'falling';
      }
    }

    // Update jump velocity for animation
    jumpVelocityY.current = vel.y;

    // Inertia & Aerial Control
    _currentVelocity.set(vel.x, 0, vel.z);
    
    // Snappier on ground, slightly floatier in air but still highly controllable
    // Frame-rate independent lerp
    const controlFactor = isGrounded ? 1 - Math.exp(-25 * delta) : 1 - Math.exp(-5 * delta);
    _currentVelocity.lerp(_direction, controlFactor);
    bodyRef.current.setLinvel({ x: _currentVelocity.x, y: vel.y, z: _currentVelocity.z }, true);

    // Avatar rotation
    if (gameMode === 'ghetto') {
      // Mouse-based aiming: raycast pointer → ground plane → face that point
      state.raycaster.setFromCamera(state.pointer, state.camera);
      if (state.raycaster.ray.intersectPlane(_groundPlane, _aimPoint)) {
        const dx = _aimPoint.x - pos.x;
        const dz = _aimPoint.z - pos.z;
        if (dx * dx + dz * dz > 0.09 && avatarRef.current) {
          const aimAngle = Math.atan2(dx, dz) + Math.PI;
          _targetQuaternion.setFromAxisAngle(_upVector, aimAngle);
          avatarRef.current.quaternion.slerp(_targetQuaternion, 1 - Math.exp(-22 * delta));
        }
        // Update aim indicator
        if (aimIndicatorRef.current) {
          aimIndicatorRef.current.position.set(_aimPoint.x, 0.03, _aimPoint.z);
          aimIndicatorRef.current.visible = true;
        }
      }
    } else if (_direction.lengthSq() > 0.1 && avatarRef.current) {
      const targetAngle = Math.atan2(_direction.x, _direction.z) + Math.PI;
      _targetQuaternion.setFromAxisAngle(_upVector, targetAngle);
      avatarRef.current.quaternion.slerp(_targetQuaternion, 1 - Math.exp(-15 * delta));
    }

    // Squash and stretch - apply to avatarRef for overall scaling
    if (avatarRef.current) {
      const yVel = vel.y;
      if (!isGrounded) {
        // Stretching while falling/jumping
        const stretch = Math.max(0.7, Math.min(1.3, 1 + yVel * 0.04));
        const squash = 1 / Math.sqrt(stretch);
        _scaleVector.set(squash, stretch, squash);
        avatarRef.current.scale.lerp(_scaleVector, 1 - Math.exp(-20 * delta));
      } else {
        // Squashing when landing or running
        _scaleVector.set(1, 1, 1);
        avatarRef.current.scale.lerp(_scaleVector, 1 - Math.exp(-15 * delta));
      }
    }

    // Rainbow effect for Legendary Skin
    if (equippedSkin === 'skin_legendary') {
      updateLegendaryRainbow(clone, state.clock.elapsedTime);
    }

    // Enhanced Animation System using actual GLB node names
    const currentSpeed = _currentVelocity.length();
    const legL = legLRef.current;
    const legR = legRRef.current;
    
    // IDLE ANIMATION — hero idle: grounded, subtle breath + weight shift
    if (animationState.current === 'idle') {
      idleTime.current += delta;
      const t = idleTime.current;

      // Breathing: visible but not floating
      const breath = Math.sin(t * 1.35) * 0.030;
      // Weight shift: side lean
      const weightShift = Math.sin(t * 0.55) * 0.08;
      // Chest rock forward/back
      const chestRock = Math.sin(t * 1.35 + 0.4) * 0.05;

      if (visualRef.current) {
        visualRef.current.position.y = breath;
        visualRef.current.rotation.z = THREE.MathUtils.lerp(
          visualRef.current.rotation.z, weightShift, 1 - Math.exp(-3 * delta));
        visualRef.current.rotation.x = THREE.MathUtils.lerp(
          visualRef.current.rotation.x, chestRock, 1 - Math.exp(-3 * delta));
      }

      // Legs: alternate press matching weight shift
      const legPress = Math.sin(t * 0.55) * 0.14;
      if (legL) legL.rotation.x = THREE.MathUtils.lerp(legL.rotation.x,  legPress, 1 - Math.exp(-5 * delta));
      if (legR) legR.rotation.x = THREE.MathUtils.lerp(legR.rotation.x, -legPress, 1 - Math.exp(-5 * delta));
    } else {
      // Reset idle time when not idle
      idleTime.current = 0;
      if (visualRef.current) {
        visualRef.current.position.y = 0;
        visualRef.current.rotation.z = 0;
        visualRef.current.rotation.x = 0;
        visualRef.current.rotation.y = 0;
      }
    }
    
    // RUNNING ANIMATION - Natural walk cycle: one leg forward, the other back
    if (isGrounded && currentSpeed > 0.5) {
      walkTime.current += delta * currentSpeed * 1.5;
      
      // Natural walking swing amplitude scales with speed
      const swingAmplitude = Math.min(0.8, currentSpeed * 0.12);
      const bodyBob = Math.abs(Math.sin(walkTime.current * 2)) * 0.08;
      
      // Body bobbing while running
      if (visualRef.current) {
        visualRef.current.position.y = bodyBob;
        // Lean forward while running
        visualRef.current.rotation.x = THREE.MathUtils.lerp(
          visualRef.current.rotation.x,
          Math.PI * 0.05,
          1 - Math.exp(-10 * delta)
        );
      }
      
      // Natural walk: Leg_S (left) and Leg_R (right) swing in opposite phase
      if (legL) {
        const leftSwing = Math.sin(walkTime.current * 2) * swingAmplitude;
        legL.rotation.x = THREE.MathUtils.lerp(
          legL.rotation.x,
          leftSwing,
          1 - Math.exp(-20 * delta)
        );
      }
      if (legR) {
        // Opposite phase to left leg (Math.PI offset)
        const rightSwing = Math.sin(walkTime.current * 2 + Math.PI) * swingAmplitude;
        legR.rotation.x = THREE.MathUtils.lerp(
          legR.rotation.x,
          rightSwing,
          1 - Math.exp(-20 * delta)
        );
      }
    } 
    // JUMPING ANIMATION
    else if (animationState.current === 'jumping' || animationState.current === 'falling') {
      const jumpProgress = Math.min(1, (state.clock.elapsedTime - jumpStartTime.current) / 0.5);
      
      // Jump anticipation (crouch before jump)
      if (jumpProgress < 0.1 && avatarRef.current) {
        avatarRef.current.scale.y = THREE.MathUtils.lerp(avatarRef.current.scale.y, 0.7, 1 - Math.exp(-30 * delta));
      }
      
      // In-air pose: legs tucked slightly
      if (jumpProgress > 0.1 && jumpProgress < 0.8) {
        if (legL) {
          legL.rotation.x = THREE.MathUtils.lerp(legL.rotation.x, Math.PI * 0.15, 1 - Math.exp(-10 * delta));
        }
        if (legR) {
          legR.rotation.x = THREE.MathUtils.lerp(legR.rotation.x, Math.PI * 0.15, 1 - Math.exp(-10 * delta));
        }
      }
      
      // Prepare for landing
      if (jumpProgress > 0.8 && animationState.current === 'falling') {
        if (legL) {
          legL.rotation.x = THREE.MathUtils.lerp(legL.rotation.x, 0, 1 - Math.exp(-15 * delta));
        }
        if (legR) {
          legR.rotation.x = THREE.MathUtils.lerp(legR.rotation.x, 0, 1 - Math.exp(-15 * delta));
        }
      }
    }
    // LANDING ANIMATION
    else if (animationState.current === 'landing') {
      // Squash effect on landing
      if (avatarRef.current) {
        avatarRef.current.scale.y = THREE.MathUtils.lerp(avatarRef.current.scale.y, 0.8, 1 - Math.exp(-25 * delta));
        avatarRef.current.scale.x = THREE.MathUtils.lerp(avatarRef.current.scale.x, 1.2, 1 - Math.exp(-25 * delta));
        avatarRef.current.scale.z = THREE.MathUtils.lerp(avatarRef.current.scale.z, 1.2, 1 - Math.exp(-25 * delta));
      }
    }
    // CELEBRATING ANIMATION (Hero Animation)
    else if (animationState.current === 'celebrating') {
      const celebrateTime = state.clock.elapsedTime - jumpStartTime.current;
      
      // Jumping in celebration
      if (avatarRef.current && isGrounded && celebrateTime % 2 < 1.5) {
        // Jump every 2 seconds
        bodyRef.current.setLinvel({ x: 0, y: JUMP_FORCE * 0.8, z: 0 }, true);
      }
      
      // Victory pose: legs slightly apart
      if (legL) {
        legL.rotation.x = THREE.MathUtils.lerp(legL.rotation.x, Math.PI * 0.1, 1 - Math.exp(-10 * delta));
      }
      if (legR) {
        legR.rotation.x = THREE.MathUtils.lerp(legR.rotation.x, -Math.PI * 0.1, 1 - Math.exp(-10 * delta));
      }
      
      // Spin slowly in celebration
      if (avatarRef.current) {
        avatarRef.current.rotation.y += delta * 1.5;
        // Bounce effect
        avatarRef.current.position.y = -0.9 + Math.sin(celebrateTime * 3) * 0.1;
      }
    }
    // RESET TO NEUTRAL — solo se non siamo in idle (il blocco idle gestisce se stesso)
    else if (animationState.current !== 'idle') {
      if (visualRef.current) {
        visualRef.current.position.y = 0;
        visualRef.current.rotation.x = THREE.MathUtils.lerp(visualRef.current.rotation.x, 0, 1 - Math.exp(-15 * delta));
        visualRef.current.rotation.z = THREE.MathUtils.lerp(visualRef.current.rotation.z, 0, 1 - Math.exp(-15 * delta));
      }
      if (avatarRef.current) {
        avatarRef.current.scale.set(1, 1, 1);
      }
      if (legL) legL.rotation.x = THREE.MathUtils.lerp(legL.rotation.x, 0, 1 - Math.exp(-15 * delta));
      if (legR) legR.rotation.x = THREE.MathUtils.lerp(legR.rotation.x, 0, 1 - Math.exp(-15 * delta));
      walkTime.current = 0;
    }

    // Hovered block
    const col = Math.floor((pos.x + 20) / 2);
    const row = Math.floor((pos.z + 20) / 2);
    if (col >= 0 && col < 20 && row >= 0 && row < 20) {
      const index = row * 20 + col;
      useGameStore.getState().setHoveredBlock(index);
    } else {
      useGameStore.getState().setHoveredBlock(-1);
    }

    // Footstep sound
    if (isGrounded && _currentVelocity.lengthSq() > 0.1) {
      footstepTimer.current += delta;
      if (footstepTimer.current > 0.25) {
        audio.playFootstepSound();
        footstepTimer.current = 0;
      }
    } else {
      footstepTimer.current = 0;
    }

    // Jump logic
    const baseJumpForce    = gameMode === 'parkour' ? parkourJumpForce : JUMP_FORCE;
    const currentJumpForce = baseJumpForce * (hasHighJump ? 1.6 : 1);

    // Tick jump buffer and cooldown down
    jumpBufferRef.current  = Math.max(0, jumpBufferRef.current  - delta);
    jumpCooldownRef.current = Math.max(0, jumpCooldownRef.current - delta);

    // Reset air jumps only on confirmed ground contact (not during coyote window)
    if (rawGrounded) airJumpsRef.current = 0;

    const wantsJump    = jumpBufferRef.current > 0 && !keys.current.jumpHandled && jumpCooldownRef.current <= 0;
    const canAirJump   = wantsJump && !isGrounded && hasDoubleJump && airJumpsRef.current < 1;

    if (wantsJump && (isGrounded || canAirJump)) {
      if (isGrounded) coyoteTimeRef.current = 0;
      const force = isGrounded ? currentJumpForce : currentJumpForce * 0.88;
      bodyRef.current.setLinvel({ x: _currentVelocity.x, y: force, z: _currentVelocity.z }, true);
      audio.playJumpSound();
      if (!isGrounded) airJumpsRef.current++;
      jumpBufferRef.current  = 0;
      jumpCooldownRef.current = 0.4; // 400ms minimum between jumps
      blockGroundedRef.current = true; // Block grounded until confirmed landing (vel snap)
      if (avatarRef.current) avatarRef.current.scale.set(1.4, 0.6, 1.4);
      keys.current.jumpHandled = true;
    } else if (!keys.current.jump && vel.y > 0 && !isGrounded) {
      // Variable jump height: release key early to cut upward velocity
      bodyRef.current.setLinvel({ x: _currentVelocity.x, y: vel.y * 0.8, z: _currentVelocity.z }, true);
    }

    // Ghetto mode: export player pos/forward + spawn floor stains + move bullets
    if (gameMode === 'ghetto') {
      ghettoPlayerPosRef.current.set(pos.x, pos.y, pos.z);
      if (avatarRef.current) {
        const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(avatarRef.current.quaternion);
        ghettoPlayerForwardRef.current.copy(fwd);
      }
      // M16 / Machinegun auto-fire while mouse held
      const autoWeapon = useGameStore.getState().ghettoWeapon;
      if (isMouseHeldRef.current && (autoWeapon === 'm16' || autoWeapon === 'machinegun')) {
        if (useGameStore.getState().gameState === 'playing') {
          lastAutoFireRef.current += delta;
          const interval = autoWeapon === 'machinegun' ? 0.1 : 0.125;
          if (lastAutoFireRef.current >= interval) {
            lastAutoFireRef.current = 0;
            const hasAmmo = autoWeapon === 'machinegun'
              ? useGameStore.getState().ghettoMachinegunAmmo > 0
              : useGameStore.getState().ghettoM16Ammo > 0;
            if (hasAmmo) fireBulletRef.current?.();
            ghettoShootTriggerRef.current?.();
          }
        }
      } else if (!isMouseHeldRef.current) {
        lastAutoFireRef.current = 0;
      }
      // Apply teleport if requested by room transition
      if (ghettoTeleportRef.current && bodyRef.current) {
        const t = ghettoTeleportRef.current;
        bodyRef.current.setTranslation({ x: t.x, y: t.y, z: t.z }, true);
        bodyRef.current.setLinvel({ x: 0, y: 0, z: 0 }, true);
        ghettoTeleportRef.current = null;
      }
      // Update active bullets
      const BULLET_SPEED = 48;
      for (const b of bulletPool.current) {
        if (!b.active) continue;
        _bulletDelta.copy(b.dir).multiplyScalar(BULLET_SPEED * delta);
        b.pos.add(_bulletDelta);
        b.dist += BULLET_SPEED * delta;
        b.mesh.position.copy(b.pos);
        if (b.dist > 24) {
          b.active = false;
          b.mesh.visible = false;
        }
      }
      // Floor stains: spawn every 0.5s while moving on ground
      if (isGrounded && _currentVelocity.lengthSq() > 0.5) {
        stainTimer.current += delta;
        if (stainTimer.current > 0.48) {
          stainTimer.current = 0;
          const pool = stainPool.current;
          if (pool.length > 0) {
            const idx = stainIndex.current % pool.length;
            stainIndex.current++;
            const mesh = pool[idx];
            mesh.position.set(pos.x + (Math.random() - 0.5) * 0.4, 0.02, pos.z + (Math.random() - 0.5) * 0.4);
            mesh.visible = true;
            (mesh.material as THREE.MeshBasicMaterial).opacity = 0.45 + Math.random() * 0.25;
          }
        }
      } else {
        stainTimer.current = 0;
      }
    }

    // Camera follow — smooth position + smooth lookAt per evitare jitter in parkour
    const camZ = gameMode === 'ghetto' ? 18 : 15;
    const camY = gameMode === 'ghetto' ? 12 : 10;
    _idealPos.set(pos.x, pos.y + camY, pos.z + camZ);
    const camAlpha = 1 - Math.exp(-8 * delta);
    state.camera.position.lerp(_idealPos, camAlpha);
    _cameraLookAtTarget.set(pos.x, pos.y + 0.5, pos.z);
    _cameraLookAt.lerp(_cameraLookAtTarget, camAlpha);
    state.camera.lookAt(_cameraLookAt.x, _cameraLookAt.y, _cameraLookAt.z);

    // Ghetto screen shake (applied after camera is set, decays over ~0.3s)
    if (gameMode === 'ghetto' && cameraShakeRef.current > 0) {
      state.camera.position.x += (Math.random() - 0.5) * cameraShakeRef.current * 1.4;
      state.camera.position.y += (Math.random() - 0.5) * cameraShakeRef.current * 0.7;
      cameraShakeRef.current   = Math.max(0, cameraShakeRef.current - delta * 3.5);
    }
    // Muzzle flash decay
    if (muzzleFlashRef.current && muzzleFlashRef.current.intensity > 1.2) {
      muzzleFlashRef.current.intensity = Math.max(1.2, muzzleFlashRef.current.intensity - delta * 90);
    }
  });

  return (
    <>
    {/* Floor stains — at world coordinates (outside RigidBody so they stay fixed on floor) */}
    {gameMode === 'ghetto' && <group ref={stainsGroupRef} />}
    {/* Bullet pool group — world-space bullets */}
    {gameMode === 'ghetto' && <group ref={bulletGroupRef} />}
    {/* Aim indicator ring on ground */}
    {gameMode === 'ghetto' && (
      <mesh ref={aimIndicatorRef} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
        <ringGeometry args={[0.18, 0.3, 24]} />
        <meshBasicMaterial color="#ff3366" transparent opacity={0.85} depthWrite={false} />
      </mesh>
    )}
    <RigidBody ref={bodyRef} ccd={true} colliders={false} position={gameMode === 'ghetto' ? [0, 10, 0] : [1, 5, 1]} enabledRotations={[false, false, false]}>
      <CapsuleCollider args={[0.5, 0.5]} friction={0} restitution={0} />
      {equippedHat === 'hat_paperhead' && <BallCollider args={[0.28]} position={[0, 0.88, 0]} />}
      {equippedHat === 'hat_happy'     && <BallCollider args={[0.22]} position={[0, 0.95, 0]} />}
      {/* 3D Model Avatar - Physics group stays fixed */}
      {/* Luce warm intorno al player — lo stacca dallo sfondo */}
      <pointLight color="#ffe8a0" intensity={6} distance={5} decay={2} />
      {/* Cerchio indicatore sul terreno */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.88, 0]}>
        <ringGeometry args={[0.45, 0.62, 32]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.55} depthWrite={false} />
      </mesh>

      <group ref={avatarRef} position={[0, -0.9, 0]}>
        {/* Visual group for animations only - separate from physics */}
        <group ref={visualRef}>
          <primitive object={clone} />
          {equippedHat === 'hat_paperhead' && <primitive object={hatMesh} />}
          {equippedHat === 'hat_happy'     && <primitive object={happyMesh} />}
        </group>
        {/* Ghetto mode: pistol (pistol or m16 equipped) */}
        {gameMode === 'ghetto' && ghettoWeapon !== 'shotgun' && (
          <group position={[0.0, 0.52, -0.32]} rotation={[0.08, 0, 0]}>
            {/* Barrel */}
            <mesh castShadow>
              <boxGeometry args={[0.10, 0.10, 0.58]} />
              <meshStandardMaterial color="#111111" metalness={0.95} roughness={0.12} emissive="#222222" emissiveIntensity={0.4} />
            </mesh>
            {/* Slide */}
            <mesh position={[0, 0.07, 0.02]} castShadow>
              <boxGeometry args={[0.085, 0.065, 0.50]} />
              <meshStandardMaterial color="#2a2a2a" metalness={0.97} roughness={0.06} />
            </mesh>
            {/* Grip */}
            <mesh position={[0, -0.17, 0.16]} rotation={[0.35, 0, 0]} castShadow>
              <boxGeometry args={[0.09, 0.30, 0.13]} />
              <meshStandardMaterial color="#1a0e05" roughness={0.78} />
            </mesh>
            {/* Trigger guard */}
            <mesh position={[0, -0.09, 0.04]}>
              <boxGeometry args={[0.07, 0.04, 0.18]} />
              <meshStandardMaterial color="#222222" metalness={0.9} roughness={0.15} />
            </mesh>
            {/* Muzzle flash point light — boosted to 16 on shoot, decays in useFrame */}
            <pointLight ref={muzzleFlashRef} color="#ff8800" intensity={1.2} distance={3} decay={2} position={[0, 0, -0.32]} />
          </group>
        )}
        {/* Ghetto mode: shotgun GLB model */}
        {gameMode === 'ghetto' && ghettoWeapon === 'shotgun' && (
          <group>
            <primitive object={shotgunMesh} scale={[1, 1, 1]} />
            <pointLight ref={muzzleFlashRef} color="#ff8800" intensity={1.2} distance={3} decay={2} position={[0, 0, -0.42]} />
          </group>
        )}
        {/* Ghetto mode: machinegun GLB model */}
        {gameMode === 'ghetto' && ghettoWeapon === 'machinegun' && (
          <group>
            <primitive object={machinegunMesh} scale={[1, 1, 1]} />
            <pointLight ref={muzzleFlashRef} color="#ffaa00" intensity={1.0} distance={3} decay={2} position={[0, 0, -0.5]} />
          </group>
        )}
      </group>

      {/* Dust particles effect */}
      <DustParticles
        positionRef={currentPosRef}
        activeRef={dustActiveRef}
        intensity={currentSpeedRef.current / SPEED}
        maxParticles={15}
      />
      {/* Cloud trail VFX — nuvole rilasciate durante il movimento */}
      <CloudTrail
        positionRef={currentPosRef}
        velocityRef={currentVelRef}
        activeRef={cloudActiveRef}
        intensity={Math.min(1, currentSpeedRef.current / SPEED)}
        maxParticles={20}
        baseScale={0.55}
        maxOpacity={0.6}
      />
      {/* Name Tag */}
      <Billboard position={[0, 2.8, 0]}>
        <Text fontSize={0.4} color="white" outlineWidth={0.05} outlineColor="black" fontWeight="bold">
          {username}
        </Text>
      </Billboard>
    </RigidBody>
    </>
  );
}
