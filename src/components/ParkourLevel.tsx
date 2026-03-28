/**
 * ParkourLevel.tsx
 * Level-based parkour mode with third-person camera (reuses Player.tsx).
 * 15 hand-crafted levels with increasing difficulty.
 *
 * Goal detection: player collides with a sensor on the gold finish platform.
 */

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Billboard, Text } from '@react-three/drei';
import { RigidBody, CuboidCollider } from '@react-three/rapier';
import * as THREE from 'three';
import { useGameStore, GadgetType } from '../store';

// ─── Gadget definitions (shared with App.tsx via export) ──────────────────

export const GADGET_DEFS: Record<GadgetType, { emoji: string; color: string; label: string; duration: number }> = {
  doubleJump: { emoji: '👟', color: '#00aaff', label: 'DOUBLE JUMP', duration: 30 },
  speedBoost:  { emoji: '⚡', color: '#ffee00', label: 'SPEED BOOST',  duration: 20 },
  highJump:    { emoji: '🚀', color: '#00ff88', label: 'HIGH JUMP',    duration: 20 },
};

// ─── Coin positions per level — Y = platform_y + 1.1 ─────────────────────
// formula: platform top surface = platform_y + 0.25, coin center at + 0.85 above → +1.1 total

const LEVEL_COINS: [number, number, number][][] = [
  // coin_y = platform_y + 1.1  (platform top + 0.25 + coin height ~0.85)
  [[-2,  1.6, -28], [ 2,  2.6, -52], [ 0,  3.6, -76]],  // L1  static tutorial
  [[ 2,  1.1, -16], [ 3,  2.1, -58], [-2,  2.6, -70]],  // L2  SB mandatory
  [[ 0,  1.1, -16], [-3,  1.6, -28], [ 0,  7.6, -52]],  // L3  DJ mandatory
  [[ 2,  1.1, -16], [-2,  1.6, -28], [ 3,  9.1, -52]],  // L4  HJ mandatory
  [[ 0,  1.1, -16], [ 3,  1.6, -28], [ 3,  2.1, -70]],  // L5  disapp + SB
  [[ 4,  1.6, -28], [-3,  6.6, -52], [ 0,  8.1, -76]],  // L6  movH + DJ
  [[ 3,  2.1, -28], [ 0,  9.6, -52], [-3, 10.1, -64]],  // L7  rotating + HJ
  [[ 0,  1.1, -16], [-3,  1.6, -40], [-3,  2.1, -70]],  // L8  disapp chains + SB
  [[ 0,  1.1, -16], [ 3,  2.1, -40], [ 0,  9.1, -52]],  // L9  fast movers + HJ
  [[ 3,  1.6, -28], [ 0,  2.1, -52], [ 3,  6.6, -64]],  // L10 rotating + DJ
  [[ 2,  1.1, -16], [ 3,  1.6, -46], [ 0,  6.6, -70]],  // L11 SB + DJ
  [[ 3,  1.6, -28], [ 0,  2.1, -58], [ 3,  9.1, -70]],  // L12 SB + HJ
  [[ 0,  1.1, -16], [ 3,  2.1, -58], [ 0,  7.1, -82]],  // L13 disapp + SB + DJ
  [[ 3,  1.6, -28], [ 0,  6.6, -52], [ 0, 14.1, -88]],  // L14 DJ + HJ
  [[ 3,  1.6, -28], [ 0,  2.1, -58], [ 0, 15.1, -118]], // L15 all gadgets
];

// ─── Gadget positions per level ────────────────────────────────────────────

interface LevelGadget { pos: [number, number, number]; type: GadgetType; }

const LEVEL_GADGETS: LevelGadget[][] = [
  // Gadget y = platform_y + 1.1  (floats just above the platform surface)
  // Each gadget sits on the LAST reachable platform before a physically-impossible gap/height.
  // Without the gadget the player CANNOT proceed; with it they can.
  [],  // L1 — tutorial, no gadgets
  [{ pos: [ 0,  2.1, -40], type: 'speedBoost' }],                                                                            // L2  SB: 18m gap (normal 14.4m < 18m)
  [{ pos: [ 3,  3.1, -40], type: 'doubleJump' }],                                                                            // L3  DJ: +4.5m rise (normal 3.6m < 4.5m)
  [{ pos: [ 0,  2.1, -40], type: 'highJump'   }],                                                                            // L4  HJ: +7m rise (DJ 6.39m < 7m)
  [{ pos: [ 0,  2.1, -52], type: 'speedBoost' }],                                                                            // L5  SB: 18m gap
  [{ pos: [ 0,  2.1, -40], type: 'doubleJump' }],                                                                            // L6  DJ: +4.5m rise
  [{ pos: [-3,  2.6, -40], type: 'highJump'   }],                                                                            // L7  HJ: +7m rise
  [{ pos: [ 0,  2.1, -52], type: 'speedBoost' }],                                                                            // L8  SB: 18m gap
  [{ pos: [ 3,  2.1, -40], type: 'highJump'   }],                                                                            // L9  HJ: +7m rise
  [{ pos: [ 0,  2.1, -52], type: 'doubleJump' }],                                                                            // L10 DJ: +4.5m rise
  [{ pos: [-2,  1.6, -28], type: 'speedBoost' }, { pos: [-2,  2.1, -58], type: 'doubleJump' }],                             // L11 SB then DJ
  [{ pos: [ 3,  1.6, -28], type: 'speedBoost' }, { pos: [ 0,  2.1, -58], type: 'highJump'   }],                             // L12 SB then HJ
  [{ pos: [-3,  2.1, -40], type: 'speedBoost' }, { pos: [-3,  2.6, -70], type: 'doubleJump' }],                             // L13 SB then DJ
  [{ pos: [-3,  2.1, -40], type: 'doubleJump' }, { pos: [-3,  7.1, -76], type: 'highJump'   }],                             // L14 DJ then HJ
  [{ pos: [-3,  2.1, -40], type: 'speedBoost' }, { pos: [ 3,  2.6, -70], type: 'doubleJump' }, { pos: [ 3, 8.1, -106], type: 'highJump' }], // L15 all three
];

// ─── Types ─────────────────────────────────────────────────────────────────

interface StaticPlatform {
  kind: 'static';
  pos: [number, number, number];
  size?: [number, number, number]; // default [2, 0.5, 2]
  color?: string;
}

interface MovingPlatform {
  kind: 'movingH' | 'movingV';
  pos: [number, number, number];
  size?: [number, number, number];
  color?: string;
  amplitude: number;
  speed: number;
  offset?: number;
}

interface DisappearingPlatform {
  kind: 'disappearing';
  pos: [number, number, number];
  size?: [number, number, number];
  color?: string;
  onTime: number;
  offTime: number;
  offset?: number;
}

interface RotatingObstacle {
  kind: 'rotating';
  pos: [number, number, number];
  size?: [number, number, number];
  color?: string;
  speed: number;
}

interface GoalPlatform {
  kind: 'goal';
  pos: [number, number, number];
  size?: [number, number, number];
}

type LevelElement = StaticPlatform | MovingPlatform | DisappearingPlatform | RotatingObstacle | GoalPlatform;

// ─── Helper: generate a "spawn island" ────────────────────────────────────
function spawnIsland(color: string = '#4a90d9'): LevelElement[] {
  return [
    // Main large platform
    { kind: 'static', pos: [0, 0, 0], size: [10, 1, 10], color },
    // Corner pillars
    { kind: 'static', pos: [-4, 0.5, -4], size: [1.5, 1.5, 1.5], color: '#3a7bc8' },
    { kind: 'static', pos: [4, 0.5, -4], size: [1.5, 1.5, 1.5], color: '#3a7bc8' },
    { kind: 'static', pos: [-4, 0.5, 4], size: [1.5, 1.5, 1.5], color: '#3a7bc8' },
    { kind: 'static', pos: [4, 0.5, 4], size: [1.5, 1.5, 1.5], color: '#3a7bc8' },
    // Edge trim
    { kind: 'static', pos: [0, 0.6, -4.5], size: [10, 0.3, 0.6], color: '#ffd700' },
    { kind: 'static', pos: [0, 0.6, 4.5], size: [10, 0.3, 0.6], color: '#ffd700' },
    { kind: 'static', pos: [-4.5, 0.6, 0], size: [0.6, 0.3, 10], color: '#ffd700' },
    { kind: 'static', pos: [4.5, 0.6, 0], size: [0.6, 0.3, 10], color: '#ffd700' },
  ];
}

// ─── Level Definitions ─────────────────────────────────────────────────────
//
// Physics recap (SPEED=12, parkourJumpForce=12, gravity=20 m/s²):
//   Normal same-height max distance : 14.4 m  →  safe gap 12 m cc (10 m clear)
//   Speed Boost (×1.5)  max distance: 21.6 m  →  mandatory gap 18 m cc (16 m clear)
//   Normal max height               :  3.6 m
//   Double Jump max height          :  6.39 m →  mandatory Δh = +4.5 m (normal can't reach)
//   High Jump (×1.6) max height     :  9.22 m →  mandatory Δh = +7 m   (DJ can't reach)
//
// Spawn island: center [0,0,0], back edge z=−5.  First platform at z=−16 → 10 m clear.
// Gadget platform size [3,0.5,3]; gadget floats at platform_y + 1.1.
// Mandatory target platform size [3,0.5,3] for landing safety.
//
const LEVELS: LevelElement[][] = [
  // ═══════════════════════════════════════════
  // LEVEL 1 — Tutorial: static, 10 m clear gaps, gentle slope
  // All gaps ≤ 12 m cc — reachable with a normal jump, can't skip two at once.
  // ═══════════════════════════════════════════
  [
    ...spawnIsland(),
    { kind: 'static', pos: [ 2,  0,   -16] },           // 10 m clear from spawn
    { kind: 'static', pos: [-2,  0.5, -28] },           // 12 m cc
    { kind: 'static', pos: [ 0,  1,   -40] },           // 12 m cc
    { kind: 'static', pos: [ 2,  1.5, -52] },           // 12 m cc
    { kind: 'static', pos: [-2,  2,   -64] },           // 12 m cc
    { kind: 'static', pos: [ 0,  2.5, -76] },           // 12 m cc
    { kind: 'goal',   pos: [ 0,  3,   -90], size: [4, 0.5, 4] },
  ],

  // ═══════════════════════════════════════════
  // LEVEL 2 — Speed Boost mandatory
  // SB gap: 18 m cc (normal max 14.4 m < 18 m → impossible; SB 21.6 m ✓)
  // ═══════════════════════════════════════════
  [
    ...spawnIsland(),
    { kind: 'static',  pos: [ 2,   0,   -16] },          // 10 m clear from spawn
    { kind: 'static',  pos: [-2,   0.5, -28] },          // 12 m cc
    // ▼ Gadget platform (SB) — must collect before attempting next gap
    { kind: 'static',  pos: [ 0,   1,   -40], size: [3, 0.5, 3] },  // 12 m cc
    // ▼ 18 m gap — impossible without Speed Boost
    { kind: 'static',  pos: [ 3,   1,   -58] },          // 18 m cc
    { kind: 'static',  pos: [-2,   1.5, -70] },          // 12 m cc
    { kind: 'goal',    pos: [ 0,   2,   -84], size: [4, 0.5, 4] },
  ],

  // ═══════════════════════════════════════════
  // LEVEL 3 — Vertical movers + Double Jump mandatory
  // DJ gap: +4.5 m rise (normal max height 3.6 m < 4.5 m → impossible; DJ 6.39 m ✓)
  // ═══════════════════════════════════════════
  [
    ...spawnIsland(),
    { kind: 'static',  pos: [ 0,   0,   -16] },
    { kind: 'movingV', pos: [-3,   0.5, -28], amplitude: 1.5, speed: 0.8 },  // 12 m cc
    // ▼ Gadget platform (DJ)
    { kind: 'static',  pos: [ 3,   2,   -40], size: [3, 0.5, 3] },           // 12 m cc
    // ▼ +4.5 m rise — impossible without Double Jump
    { kind: 'static',  pos: [ 0,   6.5, -52], size: [3, 0.5, 3] },           // 12 m cc, Δy +4.5
    { kind: 'static',  pos: [-2,   7,   -64] },                               // 12 m cc
    { kind: 'goal',    pos: [ 0,   7.5, -78], size: [4, 0.5, 4] },
  ],

  // ═══════════════════════════════════════════
  // LEVEL 4 — High Jump mandatory
  // HJ gap: +7 m rise (normal 3.6 m, DJ 6.39 m — both < 7 m; HJ 9.22 m ✓)
  // ═══════════════════════════════════════════
  [
    ...spawnIsland(),
    { kind: 'static',  pos: [ 2,   0,   -16] },
    { kind: 'static',  pos: [-2,   0.5, -28] },          // 12 m cc
    // ▼ Gadget platform (HJ)
    { kind: 'static',  pos: [ 0,   1,   -40], size: [3, 0.5, 3] },  // 12 m cc
    // ▼ +7 m rise — impossible even with Double Jump
    { kind: 'static',  pos: [ 3,   8,   -52], size: [3, 0.5, 3] },  // 12 m cc, Δy +7
    { kind: 'static',  pos: [-2,   8.5, -64] },                      // 12 m cc
    { kind: 'goal',    pos: [ 0,   9,   -78], size: [4, 0.5, 4] },
  ],

  // ═══════════════════════════════════════════
  // LEVEL 5 — Disappearing platforms + Speed Boost mandatory
  // ═══════════════════════════════════════════
  [
    ...spawnIsland(),
    { kind: 'static',       pos: [ 0,   0,   -16] },
    { kind: 'disappearing', pos: [ 3,   0.5, -28], onTime: 2.5, offTime: 1.5 },              // 12 m cc
    { kind: 'disappearing', pos: [-3,   0.5, -40], onTime: 2.5, offTime: 1.5, offset: 1.0 }, // 12 m cc
    // ▼ Gadget platform (SB)
    { kind: 'static',       pos: [ 0,   1,   -52], size: [3, 0.5, 3] },                      // 12 m cc
    // ▼ 18 m gap
    { kind: 'static',       pos: [ 3,   1,   -70] },                                          // 18 m cc
    { kind: 'disappearing', pos: [-3,   1.5, -82], onTime: 2.0, offTime: 2.0 },              // 12 m cc
    { kind: 'goal',         pos: [ 0,   2,   -96], size: [4, 0.5, 4] },
  ],

  // ═══════════════════════════════════════════
  // LEVEL 6 — Moving platforms + Double Jump mandatory
  // ═══════════════════════════════════════════
  [
    ...spawnIsland('#3d7aa0'),
    { kind: 'movingH', pos: [ 0,   0,   -16], amplitude: 4, speed: 1.2 },
    { kind: 'static',  pos: [ 4,   0.5, -28] },          // 12 m cc
    // ▼ Gadget platform (DJ)
    { kind: 'static',  pos: [ 0,   1,   -40], size: [3, 0.5, 3] },  // 12 m cc
    // ▼ +4.5 m rise
    { kind: 'static',  pos: [-3,   5.5, -52], size: [3, 0.5, 3] },  // 12 m cc, Δy +4.5
    { kind: 'movingV', pos: [ 3,   6,   -64], amplitude: 2, speed: 1.0 },  // 12 m cc
    { kind: 'static',  pos: [ 0,   7,   -76] },                      // 12 m cc
    { kind: 'goal',    pos: [ 0,   7.5, -90], size: [4, 0.5, 4] },
  ],

  // ═══════════════════════════════════════════
  // LEVEL 7 — Rotating obstacles + High Jump mandatory
  // ═══════════════════════════════════════════
  [
    ...spawnIsland('#3d7aa0'),
    { kind: 'static',   pos: [ 0,   0,   -16], size: [4, 0.5, 4] },
    { kind: 'rotating', pos: [ 0,   1.8, -16], size: [8, 0.6, 1], speed: 1.5, color: '#ff4444' },
    { kind: 'static',   pos: [ 3,   1,   -28] },         // 12 m cc
    // ▼ Gadget platform (HJ)
    { kind: 'static',   pos: [-3,   1.5, -40], size: [3, 0.5, 3] },  // 12 m cc
    // ▼ +7 m rise
    { kind: 'static',   pos: [ 0,   8.5, -52], size: [3, 0.5, 3] },  // 12 m cc, Δy +7
    { kind: 'static',   pos: [-3,   9,   -64] },                      // 12 m cc
    { kind: 'goal',     pos: [ 0,   9.5, -78], size: [4, 0.5, 4] },
  ],

  // ═══════════════════════════════════════════
  // LEVEL 8 — Disappearing chains + Speed Boost mandatory
  // ═══════════════════════════════════════════
  [
    ...spawnIsland('#3d7aa0'),
    { kind: 'disappearing', pos: [ 0,   0,   -16], onTime: 2.5, offTime: 1.5 },
    { kind: 'disappearing', pos: [ 3,   0,   -28], onTime: 2.5, offTime: 1.5, offset: 0.5 }, // 12 m cc
    { kind: 'disappearing', pos: [-3,   0.5, -40], onTime: 2.0, offTime: 1.5, offset: 1.0 }, // 12 m cc
    // ▼ Gadget platform (SB)
    { kind: 'static',       pos: [ 0,   1,   -52], size: [3, 0.5, 3] },                      // 12 m cc
    // ▼ 18 m gap
    { kind: 'static',       pos: [-3,   1,   -70] },                                          // 18 m cc
    { kind: 'disappearing', pos: [ 3,   1.5, -82], onTime: 1.8, offTime: 1.5, offset: 0.3 }, // 12 m cc
    { kind: 'goal',         pos: [ 0,   2,   -96], size: [4, 0.5, 4] },
  ],

  // ═══════════════════════════════════════════
  // LEVEL 9 — Fast horizontal movers + High Jump mandatory
  // ═══════════════════════════════════════════
  [
    ...spawnIsland('#2e6691'),
    { kind: 'movingH', pos: [ 0,   0,   -16], amplitude: 4, speed: 2.0 },
    { kind: 'movingH', pos: [ 0,   0.5, -28], amplitude: 5, speed: 2.2, offset: Math.PI }, // 12 m cc
    // ▼ Gadget platform (HJ)
    { kind: 'static',  pos: [ 3,   1,   -40], size: [3, 0.5, 3] },           // 12 m cc
    // ▼ +7 m rise
    { kind: 'static',  pos: [ 0,   8,   -52], size: [3, 0.5, 3] },           // 12 m cc, Δy +7
    { kind: 'movingH', pos: [ 0,   8.5, -64], amplitude: 3, speed: 1.8 },    // 12 m cc
    { kind: 'goal',    pos: [ 0,   9,   -78], size: [4, 0.5, 4] },
  ],

  // ═══════════════════════════════════════════
  // LEVEL 10 — Rotating + Disappearing + Double Jump mandatory
  // ═══════════════════════════════════════════
  [
    ...spawnIsland('#2e6691'),
    { kind: 'static',       pos: [ 0,   0,   -16], size: [4, 0.5, 4] },
    { kind: 'rotating',     pos: [ 0,   1.8, -16], size: [9, 0.6, 1], speed: 1.8, color: '#ff4444' },
    { kind: 'disappearing', pos: [ 3,   0.5, -28], onTime: 1.8, offTime: 1.5 },              // 12 m cc
    { kind: 'movingV',      pos: [-3,   0.5, -40], amplitude: 2, speed: 1.2 },               // 12 m cc
    // ▼ Gadget platform (DJ)
    { kind: 'static',       pos: [ 0,   1,   -52], size: [3, 0.5, 3] },                      // 12 m cc
    // ▼ +4.5 m rise
    { kind: 'static',       pos: [ 3,   5.5, -64], size: [3, 0.5, 3] },                      // 12 m cc, Δy +4.5
    { kind: 'static',       pos: [-3,   6,   -76] },                                          // 12 m cc
    { kind: 'goal',         pos: [ 0,   6.5, -90], size: [4, 0.5, 4] },
  ],

  // ═══════════════════════════════════════════
  // LEVEL 11 — Speed Boost then Double Jump (two mandatory sections in sequence)
  // ═══════════════════════════════════════════
  [
    ...spawnIsland('#2e6691'),
    { kind: 'static',  pos: [ 2,   0,   -16] },
    // ▼ Gadget platform (SB) — 18 m gap coming
    { kind: 'static',  pos: [-2,   0.5, -28], size: [3, 0.5, 3] },  // 12 m cc
    // ▼ 18 m gap
    { kind: 'static',  pos: [ 3,   0.5, -46] },                      // 18 m cc
    // ▼ Gadget platform (DJ) — +4.5 m rise coming
    { kind: 'static',  pos: [-2,   1,   -58], size: [3, 0.5, 3] },  // 12 m cc
    // ▼ +4.5 m rise
    { kind: 'static',  pos: [ 0,   5.5, -70], size: [3, 0.5, 3] },  // 12 m cc, Δy +4.5
    { kind: 'static',  pos: [ 2,   6,   -82] },                      // 12 m cc
    { kind: 'goal',    pos: [ 0,   6.5, -96], size: [4, 0.5, 4] },
  ],

  // ═══════════════════════════════════════════
  // LEVEL 12 — Rotating spinners + Speed Boost then High Jump
  // ═══════════════════════════════════════════
  [
    ...spawnIsland('#254f7a'),
    { kind: 'static',   pos: [ 0,   0,   -16], size: [4, 0.5, 4] },
    { kind: 'rotating', pos: [ 0,   1.8, -16], size: [9, 0.6, 1], speed: 2.0, color: '#ff4444' },
    // ▼ Gadget platform (SB) — 18 m gap coming
    { kind: 'static',   pos: [ 3,   0.5, -28], size: [3, 0.5, 3] },           // 12 m cc
    // ▼ 18 m gap → rotating arena on landing
    { kind: 'static',   pos: [-3,   0.5, -46], size: [4, 0.5, 4] },           // 18 m cc
    { kind: 'rotating', pos: [-3,   2.3, -46], size: [9, 0.6, 1], speed: 2.3, color: '#ff4444' },
    // ▼ Gadget platform (HJ) — +7 m rise coming
    { kind: 'static',   pos: [ 0,   1,   -58], size: [3, 0.5, 3] },           // 12 m cc
    // ▼ +7 m rise
    { kind: 'static',   pos: [ 3,   8,   -70], size: [3, 0.5, 3] },           // 12 m cc, Δy +7
    { kind: 'static',   pos: [-2,   8.5, -82] },                               // 12 m cc
    { kind: 'goal',     pos: [ 0,   9,   -96], size: [4, 0.5, 4] },
  ],

  // ═══════════════════════════════════════════
  // LEVEL 13 — Disappearing + rotating + Speed Boost then Double Jump
  // ═══════════════════════════════════════════
  [
    ...spawnIsland('#254f7a'),
    { kind: 'disappearing', pos: [ 0,   0,   -16], onTime: 2.0, offTime: 1.5 },
    { kind: 'disappearing', pos: [ 3,   0.5, -28], onTime: 2.0, offTime: 1.5, offset: 0.7 }, // 12 m cc
    // ▼ Gadget platform (SB) — 18 m gap coming
    { kind: 'static',       pos: [-3,   1,   -40], size: [3, 0.5, 3] },                      // 12 m cc
    // ▼ 18 m gap → rotating arena
    { kind: 'static',       pos: [ 3,   1,   -58], size: [4, 0.5, 4] },                      // 18 m cc
    { kind: 'rotating',     pos: [ 3,   2.8, -58], size: [9, 0.6, 1], speed: 2.2, color: '#ff4444' },
    // ▼ Gadget platform (DJ) — +4.5 m rise coming
    { kind: 'static',       pos: [-3,   1.5, -70], size: [3, 0.5, 3] },                      // 12 m cc
    // ▼ +4.5 m rise
    { kind: 'static',       pos: [ 0,   6,   -82], size: [3, 0.5, 3] },                      // 12 m cc, Δy +4.5
    { kind: 'static',       pos: [ 2,   6.5, -94] },                                          // 12 m cc
    { kind: 'goal',         pos: [ 0,   7,  -108], size: [4, 0.5, 4] },
  ],

  // ═══════════════════════════════════════════
  // LEVEL 14 — Chaos: Double Jump then High Jump
  // ═══════════════════════════════════════════
  [
    ...spawnIsland('#254f7a'),
    { kind: 'movingH',      pos: [ 0,   0,   -16], amplitude: 4, speed: 2.0 },
    { kind: 'disappearing', pos: [ 3,   0.5, -28], onTime: 1.5, offTime: 1.5 },              // 12 m cc
    // ▼ Gadget platform (DJ) — +4.5 m rise coming
    { kind: 'static',       pos: [-3,   1,   -40], size: [3, 0.5, 3] },                      // 12 m cc
    // ▼ +4.5 m rise
    { kind: 'static',       pos: [ 0,   5.5, -52], size: [3, 0.5, 3] },                      // 12 m cc, Δy +4.5
    { kind: 'movingV',      pos: [ 3,   5.5, -64], amplitude: 2.5, speed: 1.5 },             // 12 m cc
    // ▼ Gadget platform (HJ) — +7 m rise coming
    { kind: 'static',       pos: [-3,   6,   -76], size: [3, 0.5, 3] },                      // 12 m cc
    // ▼ +7 m rise  (DJ max 6.39 m < 7 m → impossible without HJ)
    { kind: 'static',       pos: [ 0,   13,  -88], size: [3, 0.5, 3] },                      // 12 m cc, Δy +7
    { kind: 'disappearing', pos: [ 2,  13.5, -100], onTime: 1.5, offTime: 1.5 },             // 12 m cc
    { kind: 'goal',         pos: [ 0,  14,  -114], size: [4, 0.5, 4] },
  ],

  // ═══════════════════════════════════════════
  // LEVEL 15 — FINAL: Speed Boost + Double Jump + High Jump (all three gadgets)
  // ═══════════════════════════════════════════
  [
    ...spawnIsland('#1c3d5c'),
    { kind: 'movingH',      pos: [ 0,   0,    -16], amplitude: 5, speed: 2.2 },
    { kind: 'disappearing', pos: [ 3,   0.5,  -28], onTime: 1.5, offTime: 1.2 },               // 12 m cc
    // ▼ Gadget platform (SB) — 18 m gap coming
    { kind: 'static',       pos: [-3,   1,    -40], size: [3, 0.5, 3] },                        // 12 m cc
    // ▼ 18 m gap → rotating arena
    { kind: 'static',       pos: [ 0,   1,    -58], size: [4, 0.5, 4] },                        // 18 m cc
    { kind: 'rotating',     pos: [ 0,   2.8,  -58], size: [9, 0.6, 1], speed: 2.5, color: '#ff4444' },
    // ▼ Gadget platform (DJ) — +4.5 m rise coming
    { kind: 'static',       pos: [ 3,   1.5,  -70], size: [3, 0.5, 3] },                        // 12 m cc
    // ▼ +4.5 m rise
    { kind: 'static',       pos: [-3,   6,    -82], size: [3, 0.5, 3] },                        // 12 m cc, Δy +4.5
    { kind: 'movingV',      pos: [ 0,   6.5,  -94], amplitude: 2, speed: 2.0 },                 // 12 m cc
    // ▼ Gadget platform (HJ) — +7 m rise coming
    { kind: 'static',       pos: [ 3,   7,   -106], size: [3, 0.5, 3] },                        // 12 m cc
    // ▼ +7 m rise  (impossible without HJ)
    { kind: 'static',       pos: [ 0,   14,  -118], size: [3, 0.5, 3] },                        // 12 m cc, Δy +7
    { kind: 'disappearing', pos: [ 3,  14.5, -130], onTime: 1.2, offTime: 1.2 },               // 12 m cc
    { kind: 'movingH',      pos: [ 0,   15,  -142], amplitude: 4, speed: 2.5 },                 // 12 m cc
    { kind: 'goal',         pos: [ 0,   15.5,-156], size: [5, 0.5, 5] },
  ],
];

// ─── Static Platform ──────────────────────────────────────────────────────

function StaticBlock({ pos, size = [2, 0.5, 2], color = '#607d8b' }: {
  pos: [number, number, number];
  size?: [number, number, number];
  color?: string;
}) {
  return (
    <RigidBody type="fixed" position={pos} colliders={false}>
      <CuboidCollider args={[size[0] / 2, size[1] / 2, size[2] / 2]} />
      <mesh castShadow receiveShadow>
        <boxGeometry args={size} />
        <meshStandardMaterial color={color} roughness={0.8} metalness={0.1} />
      </mesh>
    </RigidBody>
  );
}

// ─── Moving Platform (Horizontal / Vertical) ─────────────────────────────

function MovingBlock({ pos, size = [2, 0.5, 2], color = '#55aaff', amplitude, speed, direction, phaseOffset = 0 }: {
  pos: [number, number, number];
  size?: [number, number, number];
  color?: string;
  amplitude: number;
  speed: number;
  direction: 'x' | 'y';
  phaseOffset?: number;
}) {
  const bodyRef = useRef<any>(null);

  useFrame((state) => {
    if (!bodyRef.current) return;
    const t = state.clock.elapsedTime * speed + phaseOffset;
    const offset = Math.sin(t) * amplitude;

    if (direction === 'x') {
      bodyRef.current.setNextKinematicTranslation({
        x: pos[0] + offset,
        y: pos[1],
        z: pos[2],
      });
    } else {
      bodyRef.current.setNextKinematicTranslation({
        x: pos[0],
        y: pos[1] + offset,
        z: pos[2],
      });
    }
  });

  return (
    <RigidBody ref={bodyRef} type="kinematicPosition" position={pos} colliders={false}>
      <CuboidCollider args={[size[0] / 2, size[1] / 2, size[2] / 2]} />
      <mesh castShadow receiveShadow>
        <boxGeometry args={size} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.3}
          roughness={0.5}
          metalness={0.2}
        />
      </mesh>
    </RigidBody>
  );
}

// ─── Disappearing Platform ────────────────────────────────────────────────

function DisappearingBlock({ pos, size = [2, 0.5, 2], color = '#aa55ff', onTime, offTime, offset = 0 }: {
  pos: [number, number, number];
  size?: [number, number, number];
  color?: string;
  onTime: number;
  offTime: number;
  offset?: number;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const bodyRef = useRef<any>(null);
  const cycle = onTime + offTime;

  useFrame((state) => {
    const t = (state.clock.elapsedTime + offset) % cycle;
    const isVisible = t < onTime;

    if (meshRef.current) meshRef.current.visible = isVisible;
    if (bodyRef.current) bodyRef.current.setEnabled(isVisible);
  });

  return (
    <RigidBody ref={bodyRef} type="fixed" position={pos} colliders={false}>
      <CuboidCollider args={[size[0] / 2, size[1] / 2, size[2] / 2]} />
      <mesh ref={meshRef} castShadow receiveShadow>
        <boxGeometry args={size} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.5}
          transparent
          opacity={0.85}
          roughness={0.4}
        />
      </mesh>
    </RigidBody>
  );
}

// ─── Rotating Obstacle ────────────────────────────────────────────────────

function RotatingBlock({ pos, size = [6, 0.6, 1], color = '#ff4444', speed }: {
  pos: [number, number, number];
  size?: [number, number, number];
  color?: string;
  speed: number;
}) {
  const bodyRef = useRef<any>(null);
  const quat = useRef(new THREE.Quaternion());

  useFrame((state) => {
    if (!bodyRef.current) return;
    const angle = state.clock.elapsedTime * speed;
    quat.current.setFromAxisAngle(new THREE.Vector3(0, 1, 0), angle);
    bodyRef.current.setNextKinematicTranslation({ x: pos[0], y: pos[1], z: pos[2] });
    bodyRef.current.setNextKinematicRotation({
      x: quat.current.x,
      y: quat.current.y,
      z: quat.current.z,
      w: quat.current.w,
    });
  });

  return (
    <RigidBody ref={bodyRef} type="kinematicPosition" position={pos} colliders={false}>
      <CuboidCollider args={[size[0] / 2, size[1] / 2, size[2] / 2]} />
      <mesh castShadow receiveShadow>
        <boxGeometry args={size} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.6}
          roughness={0.3}
          metalness={0.3}
        />
      </mesh>
    </RigidBody>
  );
}

// ─── Goal Platform ────────────────────────────────────────────────────────

function GoalBlock({ pos, size = [4, 0.5, 4] }: {
  pos: [number, number, number];
  size?: [number, number, number];
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const completeParkourLevel = useGameStore(s => s.completeParkourLevel);
  const gameState = useGameStore(s => s.gameState);
  const triggered = useRef(false);

  // Pulsing gold glow
  useFrame((state) => {
    if (!meshRef.current) return;
    const mat = meshRef.current.material as THREE.MeshStandardMaterial;
    mat.emissiveIntensity = 0.5 + Math.sin(state.clock.elapsedTime * 3) * 0.3;
  });

  return (
    <>
      <RigidBody type="fixed" position={pos} colliders={false}>
        <CuboidCollider args={[size[0] / 2, size[1] / 2, size[2] / 2]} />
        <mesh ref={meshRef} castShadow receiveShadow>
          <boxGeometry args={size} />
          <meshStandardMaterial
            color="#ffd700"
            emissive="#ffd700"
            emissiveIntensity={0.5}
            roughness={0.2}
            metalness={0.6}
          />
        </mesh>
        {/* Goal glow ring */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, size[1] / 2 + 0.01, 0]}>
          <ringGeometry args={[size[0] / 2 - 0.3, size[0] / 2, 32]} />
          <meshBasicMaterial color="#ffd700" transparent opacity={0.6} />
        </mesh>
      </RigidBody>

      {/* Sensor collider slightly above the goal to detect player arrival */}
      <RigidBody
        type="fixed"
        position={[pos[0], pos[1] + size[1] / 2 + 0.5, pos[2]]}
        colliders={false}
        sensor
        onIntersectionEnter={() => {
          if (!triggered.current && gameState === 'playing') {
            triggered.current = true;
            completeParkourLevel();
          }
        }}
      >
        <CuboidCollider args={[size[0] / 2 - 0.2, 0.5, size[2] / 2 - 0.2]} sensor />
      </RigidBody>

      {/* Floating glow light */}
      <pointLight position={[pos[0], pos[1] + 3, pos[2]]} color="#ffd700" intensity={8} distance={10} decay={2} />
    </>
  );
}


// ─── Gadget Item ──────────────────────────────────────────────────────────

function GadgetItem({ pos, type }: { pos: [number, number, number]; type: GadgetType }) {
  const meshRef  = useRef<THREE.Mesh>(null);
  const collected = useRef(false);
  const collectGadget = useGameStore(s => s.collectGadget);
  const def = GADGET_DEFS[type];

  useFrame((state) => {
    if (!meshRef.current || collected.current) return;
    const t = state.clock.elapsedTime;
    meshRef.current.rotation.y = t * 1.8;
    meshRef.current.position.y = pos[1] + Math.sin(t * 2.2 + pos[0]) * 0.18;
    const mat = meshRef.current.material as THREE.MeshStandardMaterial;
    mat.emissiveIntensity = 0.6 + Math.sin(t * 4) * 0.3;
  });

  return (
    <RigidBody
      type="fixed"
      position={pos}
      colliders={false}
      sensor
      onIntersectionEnter={() => {
        if (!collected.current) {
          collected.current = true;
          collectGadget(type, def.duration);
          if (meshRef.current) meshRef.current.visible = false;
        }
      }}
    >
      <CuboidCollider args={[0.45, 0.45, 0.45]} sensor />
      <mesh ref={meshRef} castShadow>
        <dodecahedronGeometry args={[0.38, 0]} />
        <meshStandardMaterial
          color={def.color}
          emissive={def.color}
          emissiveIntensity={0.7}
          metalness={0.5}
          roughness={0.2}
        />
      </mesh>
      {/* Label */}
      <Billboard position={[0, 0.9, 0]}>
        <Text fontSize={0.45} anchorX="center" anchorY="middle">
          {def.emoji}
        </Text>
      </Billboard>
      <pointLight color={def.color} intensity={5} distance={4} decay={2} />
    </RigidBody>
  );
}

// ─── Parkour Coin ─────────────────────────────────────────────────────────

function ParkourCoin({ pos, index }: { pos: [number, number, number]; index: number }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const collected = useRef(false);
  const collectParkourCoin = useGameStore(s => s.collectParkourCoin);
  const collectedCoins = useGameStore(s => s.collectedParkourCoins);

  // Hide if already collected
  const isCollected = collectedCoins.includes(index);

  useFrame((state) => {
    if (!meshRef.current || isCollected) return;
    meshRef.current.rotation.y = state.clock.elapsedTime * 2.5;
    meshRef.current.position.y = pos[1] + Math.sin(state.clock.elapsedTime * 2 + index) * 0.15;
  });

  if (isCollected) return null;

  return (
    <RigidBody
      type="fixed"
      position={pos}
      colliders={false}
      sensor
      onIntersectionEnter={() => {
        if (!collected.current) {
          collected.current = true;
          collectParkourCoin(index);
        }
      }}
    >
      <CuboidCollider args={[0.35, 0.35, 0.35]} sensor />
      <mesh ref={meshRef} castShadow>
        <cylinderGeometry args={[0.32, 0.32, 0.12, 16]} />
        <meshStandardMaterial
          color="#ffd700"
          emissive="#ffaa00"
          emissiveIntensity={0.8}
          metalness={0.9}
          roughness={0.1}
        />
      </mesh>
      <pointLight color="#ffd700" intensity={3} distance={3} decay={2} />
    </RigidBody>
  );
}

// ─── Main ParkourLevel Component ──────────────────────────────────────────

export function ParkourLevel() {
  const parkourLevel = useGameStore(s => s.parkourLevel);
  const levelIdx = Math.max(0, Math.min(parkourLevel - 1, LEVELS.length - 1));
  const elements = LEVELS[levelIdx];
  const coins = LEVEL_COINS[levelIdx] ?? [];
  const gadgets = LEVEL_GADGETS[levelIdx] ?? [];

  return (
    <>
      {elements.map((el, i) => {
        switch (el.kind) {
          case 'static':
            return <StaticBlock key={i} pos={el.pos} size={el.size} color={el.color} />;
          case 'movingH':
            return <MovingBlock key={i} pos={el.pos} size={el.size} color={el.color} amplitude={el.amplitude} speed={el.speed} direction="x" phaseOffset={el.offset} />;
          case 'movingV':
            return <MovingBlock key={i} pos={el.pos} size={el.size} color={el.color} amplitude={el.amplitude} speed={el.speed} direction="y" phaseOffset={el.offset} />;
          case 'disappearing':
            return <DisappearingBlock key={i} pos={el.pos} size={el.size} color={el.color} onTime={el.onTime} offTime={el.offTime} offset={el.offset} />;
          case 'rotating':
            return <RotatingBlock key={i} pos={el.pos} size={el.size} color={el.color} speed={el.speed} />;
          case 'goal':
            return <GoalBlock key={i} pos={el.pos} size={el.size} />;
          default:
            return null;
        }
      })}
      {coins.map((pos, i) => (
        <ParkourCoin key={`coin-${i}`} pos={pos} index={i} />
      ))}
      {gadgets.map((g, i) => (
        <GadgetItem key={`gadget-${i}`} pos={g.pos} type={g.type} />
      ))}
    </>
  );
}
