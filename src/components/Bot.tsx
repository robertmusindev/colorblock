import { useFrame } from '@react-three/fiber';
import { Billboard, Text, useGLTF, useTexture } from '@react-three/drei';
import { RigidBody, CapsuleCollider, useRapier } from '@react-three/rapier';
import { useRef, useMemo, useState, useEffect } from 'react';
import * as THREE from 'three';
import { useGameStore, COLORS } from '../store';
import { DustParticles } from '../utils/DustParticles';
import { applySkinToModelWithColor, updateLegendaryRainbow, findLegNodes } from '../utils/skinUtils';

const SPEED = 9.5;
const JUMP_FORCE = 8;

const _direction = new THREE.Vector3();
const _currentVelocity = new THREE.Vector3();
const _targetQuaternion = new THREE.Quaternion();
const _upVector = new THREE.Vector3(0, 1, 0);
const _scaleVector = new THREE.Vector3();

// Per-bot personality traits (seeded by id for consistency)
interface BotPersonality {
  speed: number;        // 0.7-1.0 of base speed
  jumpFrequency: number; // How often they jump (seconds between jumps)
  jumpVariation: number; // How much jump height varies
  reactionSpeed: number; // How fast they react (0.1-1.0s delay)
  mistakeChance: number; // Chance of going to wrong block (0.05-0.25)
  fidgety: number;      // How much they move while waiting (0-1)
  lookAroundSpeed: number; // How fast they rotate to look around
}

function createPersonality(id: number): BotPersonality {
  // Deterministic pseudo-random based on id
  const seed = (id * 7919 + 104729) % 1000 / 1000;
  const seed2 = (id * 6271 + 54013) % 1000 / 1000;
  const seed3 = (id * 3571 + 17389) % 1000 / 1000;
  
  return {
    speed: 0.7 + seed * 0.3,
    jumpFrequency: 1.5 + seed2 * 3.0,  // Jump every 1.5-4.5 seconds
    jumpVariation: 0.6 + seed3 * 0.4,   // Jump height 60-100% of max
    reactionSpeed: 0.1 + seed * 0.8,     // React in 0.1-0.9s
    mistakeChance: 0.05 + seed2 * 0.2,   // 5-25% mistake rate
    fidgety: seed3,                       // How much they move while idle
    lookAroundSpeed: 0.5 + seed * 1.5    // rotation speed
  };
}

export function Bot({ id, name }: { id: number; name: string }) {
  const bodyRef = useRef<any>(null);
  const avatarRef = useRef<THREE.Group>(null);
  const legLRef = useRef<THREE.Object3D | null>(null);
  const legRRef = useRef<THREE.Object3D | null>(null);
  const walkTime = useRef(Math.random() * 10);
  const idleTime = useRef(0);
  const jumpStartTime = useRef(0);
  const lastGroundedTime = useRef(0);
  const lastJumpTime = useRef(0);
  
  // Human-like timing
  const hesitationTimer = useRef(0);  // Pause before acting
  const directionChangeTimer = useRef(0); // Occasional direction wobble  
  const lookTimer = useRef(Math.random() * 5); // Look around randomly
  
  const animationState = useRef<'idle' | 'running' | 'jumping' | 'falling' | 'landing' | 'celebrating'>('idle');
  const jumpVelocityY = useRef(0);
  
  const currentPosRef = useRef<[number, number, number]>([0, 0, 0]);
  const currentIsGroundedRef = useRef(false);
  const currentSpeedRef = useRef(0);
  const dustActiveRef = useRef(false);
  
  const visualRef = useRef<THREE.Group>(null);
  
  // Per-bot personality
  const personality = useMemo(() => createPersonality(id), [id]);
  
  const [reactionTimer, setReactionTimer] = useState(personality.reactionSpeed);
  const [aiState, setAiState] = useState<'idle' | 'wandering' | 'seeking' | 'waiting' | 'hesitating'>('wandering');
  const [wanderTarget, setWanderTarget] = useState<{x: number, z: number} | null>(null);

  const { world } = useRapier();
  const gameState = useGameStore(state => state.gameState);
  const targetColor = useGameStore(state => state.targetColor);
  const gridColors = useGameStore(state => state.gridColors);
  const eliminateBot = useGameStore(state => state.eliminateBot);
  const targetBlockRef = useRef<{x: number, z: number} | null>(null);

  const torsoColor = useMemo(() => {
    const colors = ['#e74c3c', '#2ecc71', '#9b59b6', '#f1c40f', '#e67e22', '#1abc9c', '#e84393', '#00b894', '#fdcb6e', '#6c5ce7', '#ff7675'];
    return colors[id % colors.length];
  }, [id]);

  const botSkin = useMemo(() => {
    const skins = ['default_skin', 'skin_solid', 'skin_pattern', 'skin_epic', 'skin_legendary'];
    if (Math.random() < 0.4) return 'default_skin';
    return skins[id % skins.length];
  }, [id]);

  const startPos = useMemo(() => {
    return [
      (Math.random() - 0.5) * 15,
      5.5 + Math.random() * 2,
      (Math.random() - 0.5) * 15
    ] as [number, number, number];
  }, []);

  // AI Logic calculation
  useEffect(() => {
    if (gameState === 'playing' && targetColor) {
      const targetColorIndex = COLORS.findIndex(c => c.name === targetColor.name);
      let closestDist = Infinity;
      let bestBlock: {x: number, z: number} | null = null;
      
      const currentPos = bodyRef.current?.translation() || { x: 0, z: 0 };

      gridColors.forEach((colorIndex, i) => {
        if (colorIndex === targetColorIndex) {
          const bx = (i % 20) - 9.5;
          const bz = Math.floor(i / 20) - 9.5;
          const dist = Math.sqrt(Math.pow(bx * 2 - currentPos.x, 2) + Math.pow(bz * 2 - currentPos.z, 2));
          const randomizedDist = dist + (id % 5); 
          if (randomizedDist < closestDist) {
            closestDist = randomizedDist;
            bestBlock = { x: bx * 2, z: bz * 2 };
          }
        }
      });
      
      if (bestBlock) {
        if (Math.random() < personality.mistakeChance) {
          const rIdx = Math.floor(Math.random() * 400);
          const rx = (rIdx % 20) - 9.5;
          const rz = Math.floor(rIdx / 20) - 9.5;
          targetBlockRef.current = { x: rx * 2, z: rz * 2 };
        } else {
          targetBlockRef.current = { 
            x: bestBlock.x + (Math.random() * 0.8 - 0.4), 
            z: bestBlock.z + (Math.random() * 0.8 - 0.4) 
          };
        }
      }
    } else {
      targetBlockRef.current = null;
    }
  }, [gameState, targetColor, gridColors, id, personality.mistakeChance]);

  const { scene } = useGLTF(import.meta.env.BASE_URL + 'asset3d/charactert.glb');
  const textures = useTexture({
    default: import.meta.env.BASE_URL + 'texture/TEST_Material.002_BaseColor.png',
    israel: import.meta.env.BASE_URL + 'skins/israel_skin.png',
    robsbagliato: import.meta.env.BASE_URL + 'texture/robsbagliato.png',
  });

  const clone = useMemo(() => {
    const c = scene.clone();
    applySkinToModelWithColor(c, botSkin, textures, torsoColor);
    const { legL, legR } = findLegNodes(c);
    legLRef.current = legL;
    legRRef.current = legR;
    return c;
  }, [scene, textures, botSkin, torsoColor]);

  // Helper: human-like jump with varied height and squash
  const doJump = (vel: {x: number, y: number, z: number}, isGrounded: boolean, forceFactor = 1.0) => {
    if (!isGrounded || !bodyRef.current) return;
    
    const now = Date.now() / 1000;
    if (now - lastJumpTime.current < 0.4) return; // Prevent spam jumps
    
    const jumpHeight = JUMP_FORCE * personality.jumpVariation * forceFactor;
    // Add slight random variation so each jump feels different
    const variation = 0.85 + Math.random() * 0.3;
    
    bodyRef.current.setLinvel({ 
      x: vel.x * 0.8, // Slightly reduce horizontal momentum on jump
      y: jumpHeight * variation, 
      z: vel.z * 0.8
    }, true);
    
    // Squash before jump
    if (avatarRef.current) {
      avatarRef.current.scale.set(1.3, 0.65, 1.3);
    }
    
    lastJumpTime.current = now;
  };

  useFrame((state, delta) => {
    if (!bodyRef.current) return;

    const position = bodyRef.current.translation();
    const pos = { x: position.x, y: position.y, z: position.z };
    
    if (pos.y < -10) {
      eliminateBot(id);
      return;
    }

    const velocity = bodyRef.current.linvel();
    const vel = { x: velocity.x, y: velocity.y, z: velocity.z };
    const isGrounded = pos.y <= 1.2 && Math.abs(vel.y) < 2.0;
    
    currentPosRef.current = [pos.x, pos.y, pos.z];
    currentIsGroundedRef.current = isGrounded;
    currentSpeedRef.current = _currentVelocity.length();
    dustActiveRef.current = animationState.current === 'running' && isGrounded;
    
    // Update animation state
    const moveSpeed = _currentVelocity.length();
    if (isGrounded) {
      lastGroundedTime.current = state.clock.elapsedTime;
      if (moveSpeed > 0.5) {
        animationState.current = 'running';
      } else {
        animationState.current = 'idle';
      }
      if (jumpStartTime.current > 0 && state.clock.elapsedTime - jumpStartTime.current > 0.1) {
        animationState.current = 'landing';
        setTimeout(() => {
          if (animationState.current === 'landing') {
            animationState.current = moveSpeed > 0.5 ? 'running' : 'idle';
          }
        }, 200);
      }
    } else {
      if (vel.y > 0.5) {
        animationState.current = 'jumping';
        jumpStartTime.current = state.clock.elapsedTime;
      } else if (vel.y < -0.5) {
        animationState.current = 'falling';
      }
    }
    jumpVelocityY.current = vel.y;
    
    // === ENHANCED HUMAN-LIKE AI ===
    _direction.set(0, 0, 0);
    
    // Update look-around timer (bots rotate head/orientation while idle)
    lookTimer.current += delta;

    if (gameState === 'playing' && targetColor) {
      
      if (aiState === 'wandering' || aiState === 'idle') {
        // Human-like hesitation: don't react immediately
        if (reactionTimer > 0) {
          setReactionTimer(prev => Math.max(0, prev - delta));
          
          // While hesitating, look around confused (human behavior)
          if (avatarRef.current) {
            const lookAngle = Math.sin(lookTimer.current * personality.lookAroundSpeed) * Math.PI * 0.3;
            _targetQuaternion.setFromAxisAngle(_upVector, lookAngle);
            avatarRef.current.quaternion.slerp(_targetQuaternion, 1 - Math.exp(-5 * delta));
          }
          
          // Fidgety bots move slightly while thinking
          if (personality.fidgety > 0.5 && Math.random() < personality.fidgety * delta * 2) {
            _direction.set(
              (Math.random() - 0.5) * SPEED * 0.3,
              0,
              (Math.random() - 0.5) * SPEED * 0.3
            );
          }
          
          // Some bots jump while confused/panicking
          if (Math.random() < 0.02 * delta * 60 && isGrounded) {
            doJump(vel, isGrounded, 0.7);
          }
        } else {
          // Brief hesitation moment before seeking (human-like "oh I need to go!")
          setAiState('hesitating');
          hesitationTimer.current = 0.1 + Math.random() * 0.3;
        }
        
      } else if (aiState === 'hesitating') {
        // Short pause before actually running
        hesitationTimer.current -= delta;
        if (hesitationTimer.current <= 0) {
          setAiState('seeking');
        }
        
      } else if (aiState === 'seeking' && targetBlockRef.current) {
        const dx = targetBlockRef.current.x - pos.x;
        const dz = targetBlockRef.current.z - pos.z;
        const distToTarget = Math.sqrt(dx * dx + dz * dz);
        
        if (distToTarget > 0.8) {
          // Move towards target with personality speed
          const currentSpeed = SPEED * personality.speed;
          
          // Add slight direction wobble for natural path (not perfectly straight)
          directionChangeTimer.current += delta;
          const wobbleX = Math.sin(directionChangeTimer.current * 2 + id) * 0.15;
          const wobbleZ = Math.cos(directionChangeTimer.current * 1.5 + id * 2) * 0.15;
          
          _direction.set(dx + wobbleX, 0, dz + wobbleZ).normalize().multiplyScalar(currentSpeed);
          
          // Jump while running — varied frequency per bot personality
          const timeSinceLastJump = state.clock.elapsedTime - lastJumpTime.current;
          if (timeSinceLastJump > personality.jumpFrequency && isGrounded) {
            // Some jumps are bigger than others
            const jumpPower = 0.7 + Math.random() * 0.5;
            doJump(vel, isGrounded, jumpPower);
          }
          
          // Running jump when far away (human-like sprint+jump)
          if (distToTarget > 5 && Math.random() < 0.8 * delta && isGrounded && timeSinceLastJump > 1.0) {
            doJump(vel, isGrounded, 0.9);
          }
          
        } else {
          // Arrived at target block
          setAiState('waiting');
          // Happy jump upon arrival
          if (isGrounded) {
            doJump(vel, isGrounded, 0.6);
          }
        }
        
      } else if (aiState === 'waiting' && targetBlockRef.current) {
        const dx = targetBlockRef.current.x - pos.x;
        const dz = targetBlockRef.current.z - pos.z;
        const distToTarget = Math.sqrt(dx * dx + dz * dz);
        
        if (distToTarget > 1.2) {
          // Drifted off target, go back
          setAiState('seeking');
        } else {
          // Waiting on block — fidget behavior
          // Small excited hops while waiting
          const hopChance = personality.fidgety > 0.5 ? 2.0 : 0.8;
          if (Math.random() < hopChance * delta && isGrounded) {
            doJump(vel, isGrounded, 0.4 + Math.random() * 0.3); // Small hops
          }
          
          // Look around nervously — gentle oscillation only, no movement conflict
          if (avatarRef.current) {
            const nervousLook = Math.sin(state.clock.elapsedTime * 1.5 + id) * Math.PI * 0.25;
            _targetQuaternion.setFromAxisAngle(_upVector, nervousLook);
            avatarRef.current.quaternion.slerp(_targetQuaternion, 1 - Math.exp(-2 * delta));
          }
        }
      }
      
    } else if (gameState === 'elimination' || gameState === 'gameover' || gameState === 'victory') {
      if (aiState !== 'idle') {
        setAiState('idle');
        targetBlockRef.current = null;
        setWanderTarget(null);
        setReactionTimer(personality.reactionSpeed);
      }
      
      // Panic/celebrate with jumps — vary by personality
      const panicJumpRate = gameState === 'victory' ? 0.5 : 0.2;
      if (Math.random() < panicJumpRate * delta && isGrounded) {
        doJump(vel, isGrounded, 0.5 + Math.random() * 0.5);
      }
      
      // Look around during elimination
      if (avatarRef.current) {
        const panicLook = Math.sin(state.clock.elapsedTime * 2.5 + id * 1.7) * Math.PI * 0.4;
        _targetQuaternion.setFromAxisAngle(_upVector, panicLook);
        avatarRef.current.quaternion.slerp(_targetQuaternion, 1 - Math.exp(-3 * delta));
      }
      
    } else {
      // Waiting lobby / between rounds — wandering behavior
      if (aiState !== 'wandering') {
        setAiState('wandering');
        targetBlockRef.current = null;
        setWanderTarget(null);
      }
      
      // Pick new wander targets naturally
      if (!wanderTarget || Math.random() < 0.3 * delta) {
        setWanderTarget({
          x: Math.max(-18, Math.min(18, pos.x + (Math.random() - 0.5) * 12)),
          z: Math.max(-18, Math.min(18, pos.z + (Math.random() - 0.5) * 12))
        });
      }

      if (wanderTarget) {
        const dx = wanderTarget.x - pos.x;
        const dz = wanderTarget.z - pos.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        
        if (dist > 1.0) {
          // Wander at varied speeds
          const wanderSpeed = SPEED * 0.3 * personality.speed;
          _direction.set(dx, 0, dz).normalize().multiplyScalar(wanderSpeed);
        } else {
          // Reached wander point, pick a new one eventually
          setWanderTarget(null);
        }
      }

      // Random playful jumps while wandering (more frequent, varied heights)
      const timeSinceJump = state.clock.elapsedTime - lastJumpTime.current;
      if (timeSinceJump > personality.jumpFrequency * 0.8 && isGrounded && Math.random() < 0.3 * delta) {
        doJump(vel, isGrounded, 0.5 + Math.random() * 0.5);
      }
      
      // Sometimes stop and look around
      if (Math.random() < 0.1 * delta && avatarRef.current) {
        const randomLook = (Math.random() - 0.5) * Math.PI;
        _targetQuaternion.setFromAxisAngle(_upVector, randomLook);
        avatarRef.current.quaternion.slerp(_targetQuaternion, 1 - Math.exp(-2 * delta));
      }
    }

    // Re-read y velocity AFTER AI logic so doJump() calls are not overwritten
    const currentYVel = bodyRef.current.linvel().y;
    _currentVelocity.set(vel.x, 0, vel.z);
    const controlFactor = isGrounded ? 1 - Math.exp(-25 * delta) : 1 - Math.exp(-5 * delta);
    _currentVelocity.lerp(_direction, controlFactor);
    bodyRef.current.setLinvel({ x: _currentVelocity.x, y: currentYVel, z: _currentVelocity.z }, true);

    // Rotation — face movement direction
    if (_direction.lengthSq() > 0.1 && avatarRef.current) {
      const targetAngle = Math.atan2(_direction.x, _direction.z) + Math.PI;
      _targetQuaternion.setFromAxisAngle(_upVector, targetAngle);
      avatarRef.current.quaternion.slerp(_targetQuaternion, 1 - Math.exp(-10 * delta));
    }

    // Squash and stretch
    if (avatarRef.current) {
      const yVel = vel.y;
      if (!isGrounded) {
        const stretch = Math.max(0.7, Math.min(1.3, 1 + yVel * 0.04));
        const squash = 1 / Math.sqrt(stretch);
        _scaleVector.set(squash, stretch, squash);
        avatarRef.current.scale.lerp(_scaleVector, 1 - Math.exp(-20 * delta));
      } else {
        _scaleVector.set(1, 1, 1);
        avatarRef.current.scale.lerp(_scaleVector, 1 - Math.exp(-15 * delta));
      }
    }

    // Rainbow effect for Legendary Skin
    if (botSkin === 'skin_legendary') {
      updateLegendaryRainbow(clone, state.clock.elapsedTime, id * 0.1);
    }

    // === ANIMATION SYSTEM ===
    const botSpeed = _currentVelocity.length();
    const legL = legLRef.current;
    const legR = legRRef.current;
    
    // IDLE ANIMATION
    if (animationState.current === 'idle') {
      idleTime.current += delta;
      
      const breath = Math.sin(idleTime.current * 2) * 0.02;
      const sway = Math.sin(idleTime.current * 0.5 + id) * 0.03;
      
      if (visualRef.current) {
        visualRef.current.position.y = breath;
        visualRef.current.rotation.z = sway;
      }
      
      if (legL) legL.rotation.x = THREE.MathUtils.lerp(legL.rotation.x, 0, 1 - Math.exp(-5 * delta));
      if (legR) legR.rotation.x = THREE.MathUtils.lerp(legR.rotation.x, 0, 1 - Math.exp(-5 * delta));
    } else {
      idleTime.current = 0;
      if (visualRef.current) {
        visualRef.current.position.y = 0;
        visualRef.current.rotation.z = 0;
        visualRef.current.rotation.x = 0;
        visualRef.current.rotation.y = 0;
      }
    }
    
    // RUNNING ANIMATION
    if (isGrounded && botSpeed > 0.5) {
      walkTime.current += delta * botSpeed * 1.5;
      
      const swingAmplitude = Math.min(0.8, botSpeed * 0.12);
      const bodyBob = Math.abs(Math.sin(walkTime.current * 2)) * 0.08;
      
      if (visualRef.current) {
        visualRef.current.position.y = bodyBob;
        visualRef.current.rotation.x = THREE.MathUtils.lerp(
          visualRef.current.rotation.x,
          Math.PI * 0.05,
          1 - Math.exp(-10 * delta)
        );
      }
      
      if (legL) {
        const leftSwing = Math.sin(walkTime.current * 2) * swingAmplitude;
        legL.rotation.x = THREE.MathUtils.lerp(legL.rotation.x, leftSwing, 1 - Math.exp(-20 * delta));
      }
      if (legR) {
        const rightSwing = Math.sin(walkTime.current * 2 + Math.PI) * swingAmplitude;
        legR.rotation.x = THREE.MathUtils.lerp(legR.rotation.x, rightSwing, 1 - Math.exp(-20 * delta));
      }
    } 
    // JUMPING ANIMATION
    else if (animationState.current === 'jumping' || animationState.current === 'falling') {
      const jumpProgress = Math.min(1, (state.clock.elapsedTime - jumpStartTime.current) / 0.5);
      
      if (jumpProgress < 0.1 && avatarRef.current) {
        avatarRef.current.scale.y = THREE.MathUtils.lerp(avatarRef.current.scale.y, 0.7, 1 - Math.exp(-30 * delta));
      }
      
      if (jumpProgress > 0.1 && jumpProgress < 0.8) {
        if (legL) legL.rotation.x = THREE.MathUtils.lerp(legL.rotation.x, Math.PI * 0.15, 1 - Math.exp(-10 * delta));
        if (legR) legR.rotation.x = THREE.MathUtils.lerp(legR.rotation.x, Math.PI * 0.15, 1 - Math.exp(-10 * delta));
      }
      
      if (jumpProgress > 0.8 && animationState.current === 'falling') {
        if (legL) legL.rotation.x = THREE.MathUtils.lerp(legL.rotation.x, 0, 1 - Math.exp(-15 * delta));
        if (legR) legR.rotation.x = THREE.MathUtils.lerp(legR.rotation.x, 0, 1 - Math.exp(-15 * delta));
      }
    }
    // LANDING ANIMATION
    else if (animationState.current === 'landing') {
      if (avatarRef.current) {
        avatarRef.current.scale.y = THREE.MathUtils.lerp(avatarRef.current.scale.y, 0.8, 1 - Math.exp(-25 * delta));
        avatarRef.current.scale.x = THREE.MathUtils.lerp(avatarRef.current.scale.x, 1.2, 1 - Math.exp(-25 * delta));
        avatarRef.current.scale.z = THREE.MathUtils.lerp(avatarRef.current.scale.z, 1.2, 1 - Math.exp(-25 * delta));
      }
    }
    // RESET TO NEUTRAL
    else {
      if (avatarRef.current) {
        avatarRef.current.rotation.x = THREE.MathUtils.lerp(avatarRef.current.rotation.x, 0, 1 - Math.exp(-15 * delta));
        avatarRef.current.rotation.z = THREE.MathUtils.lerp(avatarRef.current.rotation.z, 0, 1 - Math.exp(-15 * delta));
        avatarRef.current.scale.set(1, 1, 1);
      }
      
      if (legL) legL.rotation.x = THREE.MathUtils.lerp(legL.rotation.x, 0, 1 - Math.exp(-15 * delta));
      if (legR) legR.rotation.x = THREE.MathUtils.lerp(legR.rotation.x, 0, 1 - Math.exp(-15 * delta));
      walkTime.current = 0;
    }
  });

  return (
    <RigidBody ref={bodyRef} ccd={true} colliders={false} position={startPos} enabledRotations={[false, false, false]}>
      <CapsuleCollider args={[0.5, 0.5]} friction={0} />
      <group ref={avatarRef} position={[0, -0.9, 0]}>
        <group ref={visualRef}>
          <primitive object={clone} />
        </group>
      </group>
      {/* Subtle dust particles for bots */}
      <DustParticles
        positionRef={currentPosRef}
        activeRef={dustActiveRef}
        intensity={currentSpeedRef.current / SPEED}
        maxParticles={8}
      />
      <Billboard position={[0, 2.8, 0]}>
        <Text fontSize={0.3} color="#eee" outlineWidth={0.04} outlineColor="black" fontWeight="bold">
          {name}
        </Text>
      </Billboard>
    </RigidBody>
  );
}
