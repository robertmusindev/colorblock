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
  [[0, 1.1, -12],  [0, 3.1, -40],  [0, 5.1, -60]],   // L1
  [[0, 1.1, -8],   [4, 1.6, -20],  [0, 3.1, -56]],   // L2
  [[0, 1.1, -8],   [3, 3.1, -20],  [0, 5.1, -44]],   // L3
  [[0, 1.1, -8],   [3, 1.6, -24],  [-3, 3.6, -60]],  // L4
  [[0, 1.1, -8],   [0, 1.6, -22],  [0, 2.6, -42]],   // L5
  [[4, 1.6, -14],  [0, 3.1, -32],  [-3, 5.1, -56]],  // L6
  [[0, 1.1, -8],   [4, 3.1, -28],  [-3, 4.6, -40]],  // L7
  [[0, 1.1, -8],   [0, 2.1, -31],  [-4, 3.1, -51]],  // L8
  [[3, 2.1, -20],  [0, 3.6, -38],  [0, 5.1, -56]],   // L9
  [[0, 1.1, -8],   [-4, 2.1, -28], [0, 4.6, -54]],   // L10
  [[0, 1.1, -8],   [0, 3.1, -32],  [0, 6.1, -62]],   // L11
  [[0, 1.1, -8],   [4, 2.1, -32],  [-4, 3.1, -48]],  // L12
  [[0, 1.1, -8],   [0, 2.1, -26],  [-3, 4.6, -58]],  // L13
  [[-3, 2.1, -20], [4, 4.1, -46],  [0, 6.1, -70]],   // L14
  [[-4, 3.1, -26], [5, 5.6, -56],  [0, 8.1, -86]],   // L15
];

// ─── Gadget positions per level ────────────────────────────────────────────

interface LevelGadget { pos: [number, number, number]; type: GadgetType; }

const LEVEL_GADGETS: LevelGadget[][] = [
  [],  // L1 – tutorial, no gadgets
  [{ pos: [5, 1.9, -20],  type: 'speedBoost'  }],                                               // L2
  [{ pos: [3, 3.4, -16],  type: 'doubleJump'  }],                                               // L3 ★ shortcut available
  [{ pos: [3, 1.9, -24],  type: 'highJump'    }],                                               // L4
  [{ pos: [1, 1.9, -22],  type: 'speedBoost'  }],                                               // L5
  [{ pos: [5, 1.9, -14],  type: 'doubleJump'  }],                                               // L6
  [{ pos: [5, 3.4, -28],  type: 'doubleJump'  }],                                               // L7 ★ shortcut available
  [{ pos: [1, 2.4, -31],  type: 'speedBoost'  }],                                               // L8
  [{ pos: [4, 2.4, -20],  type: 'highJump'    }],                                               // L9
  [{ pos: [-5, 2.4, -28], type: 'doubleJump'  }],                                               // L10
  [{ pos: [1, 3.4, -32],  type: 'doubleJump'  }],                                               // L11 ★ shortcut available
  [{ pos: [5, 2.4, -32],  type: 'highJump'    }, { pos: [-5, 3.4, -48], type: 'speedBoost' }], // L12
  [{ pos: [1, 2.4, -26],  type: 'speedBoost'  }, { pos: [-2, 4.9, -58], type: 'doubleJump' }], // L13
  [{ pos: [-2, 2.4, -20], type: 'doubleJump'  }, { pos: [5, 4.4, -46],  type: 'highJump'   }], // L14
  [{ pos: [-3, 3.4, -26], type: 'doubleJump'  }, { pos: [6, 5.9, -56],  type: 'speedBoost' }, { pos: [1, 8.4, -86], type: 'highJump' }], // L15
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
const LEVELS: LevelElement[][] = [
  // ═══════════════════════════════════════════
  // LEVEL 1 — Tutorial: Simple gaps, static
  // ═══════════════════════════════════════════
  [
    ...spawnIsland(),
    { kind: 'static', pos: [0, 0, -8] },
    { kind: 'static', pos: [0, 0, -12] },
    { kind: 'static', pos: [3, 0.5, -16] },
    { kind: 'static', pos: [3, 0.5, -20] },
    { kind: 'static', pos: [0, 1, -24] },
    { kind: 'static', pos: [-3, 1, -28] },
    { kind: 'static', pos: [-3, 1.5, -32] },
    { kind: 'static', pos: [0, 2, -36] },
    { kind: 'static', pos: [0, 2, -40] },
    { kind: 'static', pos: [3, 2.5, -44] },
    { kind: 'static', pos: [3, 3, -48] },
    { kind: 'static', pos: [0, 3, -52] },
    { kind: 'static', pos: [-3, 3.5, -56] },
    { kind: 'static', pos: [0, 4, -60] },
    { kind: 'goal', pos: [0, 4, -66], size: [4, 0.5, 4] },
  ],

  // ═══════════════════════════════════════════
  // LEVEL 2 — Intro horizontal movers
  // ═══════════════════════════════════════════
  [
    ...spawnIsland(),
    { kind: 'static', pos: [0, 0, -8] },
    { kind: 'movingH', pos: [0, 0, -14], amplitude: 4, speed: 1.0 },
    { kind: 'static', pos: [4, 0.5, -20] },
    { kind: 'movingH', pos: [0, 0.5, -26], amplitude: 5, speed: 1.2, offset: 1 },
    { kind: 'static', pos: [-4, 1, -32] },
    { kind: 'movingH', pos: [0, 1, -38], amplitude: 4, speed: 1.4 },
    { kind: 'static', pos: [0, 1.5, -44], size: [3, 0.5, 3] },
    { kind: 'movingH', pos: [0, 1.5, -50], amplitude: 5, speed: 1.0 },
    { kind: 'static', pos: [0, 2, -56] },
    { kind: 'goal', pos: [0, 2, -62], size: [4, 0.5, 4] },
  ],

  // ═══════════════════════════════════════════
  // LEVEL 3 — Vertical movers  ★ DJ shortcut
  // ═══════════════════════════════════════════
  [
    ...spawnIsland(),
    { kind: 'static', pos: [0, 0, -8] },
    { kind: 'movingV', pos: [0, 1, -14], amplitude: 2, speed: 0.8 },
    { kind: 'static', pos: [3, 2, -20] },
    // ★ Double-jump shortcut: jump from [3,2,-20] → land here → fall to [0,3,-32]
    { kind: 'static', pos: [0, 6.5, -26], size: [3, 0.5, 3], color: '#00aaff' },
    { kind: 'movingV', pos: [-3, 2, -26], amplitude: 2.5, speed: 1.0 },
    { kind: 'static', pos: [0, 3, -32] },
    { kind: 'movingV', pos: [3, 3, -38], amplitude: 3, speed: 0.7, offset: 1 },
    { kind: 'static', pos: [0, 4, -44] },
    { kind: 'movingV', pos: [0, 4, -50], amplitude: 2, speed: 1.2 },
    { kind: 'goal', pos: [0, 5, -56], size: [4, 0.5, 4] },
  ],

  // ═══════════════════════════════════════════
  // LEVEL 4 — Disappearing platforms
  // ═══════════════════════════════════════════
  [
    ...spawnIsland(),
    { kind: 'static', pos: [0, 0, -8] },
    { kind: 'disappearing', pos: [0, 0, -14], onTime: 2.5, offTime: 1.5 },
    { kind: 'disappearing', pos: [0, 0, -18], onTime: 2.5, offTime: 1.5, offset: 1.0 },
    { kind: 'static', pos: [3, 0.5, -24] },
    { kind: 'disappearing', pos: [0, 0.5, -30], onTime: 2.0, offTime: 2.0 },
    { kind: 'disappearing', pos: [-3, 1, -36], onTime: 2.0, offTime: 2.0, offset: 1.0 },
    { kind: 'static', pos: [0, 1.5, -42] },
    { kind: 'disappearing', pos: [3, 1.5, -48], onTime: 1.8, offTime: 1.8, offset: 0.5 },
    { kind: 'disappearing', pos: [0, 2, -54], onTime: 1.8, offTime: 1.8, offset: 1.5 },
    { kind: 'static', pos: [-3, 2.5, -60] },
    { kind: 'goal', pos: [0, 3, -66], size: [4, 0.5, 4] },
  ],

  // ═══════════════════════════════════════════
  // LEVEL 5 — Rotating obstacles intro
  // ═══════════════════════════════════════════
  [
    ...spawnIsland(),
    { kind: 'static', pos: [0, 0, -8] },
    { kind: 'static', pos: [0, 0, -14], size: [4, 0.5, 4] },
    { kind: 'rotating', pos: [0, 1.8, -14], size: [8, 0.6, 1], speed: 1.2, color: '#ff4444' },
    { kind: 'static', pos: [0, 0.5, -22] },
    { kind: 'movingH', pos: [0, 0.5, -28], amplitude: 4, speed: 1.4 },
    { kind: 'static', pos: [3, 1, -34], size: [3, 0.5, 3] },
    { kind: 'rotating', pos: [3, 2.5, -34], size: [6, 0.6, 1], speed: 1.5, color: '#ff4444' },
    { kind: 'static', pos: [0, 1.5, -42] },
    { kind: 'goal', pos: [0, 2, -48], size: [4, 0.5, 4] },
  ],

  // ═══════════════════════════════════════════
  // LEVEL 6 — Mixed movers + disappearing
  // ═══════════════════════════════════════════
  [
    ...spawnIsland('#3d7aa0'),
    { kind: 'movingH', pos: [0, 0, -8], amplitude: 3, speed: 1.2 },
    { kind: 'static', pos: [4, 0.5, -14] },
    { kind: 'disappearing', pos: [0, 0.5, -20], onTime: 2, offTime: 1.5 },
    { kind: 'movingV', pos: [-3, 1, -26], amplitude: 2, speed: 1.0 },
    { kind: 'static', pos: [0, 2, -32] },
    { kind: 'movingH', pos: [0, 2, -38], amplitude: 5, speed: 1.5 },
    { kind: 'disappearing', pos: [3, 2.5, -44], onTime: 1.8, offTime: 1.8, offset: 0.5 },
    { kind: 'movingV', pos: [0, 3, -50], amplitude: 2.5, speed: 1.2 },
    { kind: 'static', pos: [-3, 4, -56] },
    { kind: 'goal', pos: [0, 4, -62], size: [4, 0.5, 4] },
  ],

  // ═══════════════════════════════════════════
  // LEVEL 7 — Rotating + vertical  ★ DJ shortcut
  // ═══════════════════════════════════════════
  [
    ...spawnIsland('#3d7aa0'),
    { kind: 'static', pos: [0, 0, -8] },
    { kind: 'static', pos: [0, 0, -14], size: [4, 0.5, 4] },
    { kind: 'rotating', pos: [0, 1.8, -14], size: [8, 0.6, 1], speed: 1.5, color: '#ff4444' },
    { kind: 'movingV', pos: [0, 1, -22], amplitude: 2.5, speed: 1.0 },
    { kind: 'static', pos: [4, 2, -28] },
    { kind: 'rotating', pos: [4, 3.5, -28], size: [6, 0.6, 1], speed: 2.0, color: '#ff4444' },
    // ★ Double-jump shortcut: [4,2,-28] → [4,7,-34] → land on [-3,3.5,-40]
    { kind: 'static', pos: [4, 7, -34], size: [3, 0.5, 3], color: '#00aaff' },
    { kind: 'movingV', pos: [0, 2.5, -34], amplitude: 3, speed: 0.8 },
    { kind: 'static', pos: [-3, 3.5, -40] },
    { kind: 'movingH', pos: [0, 3.5, -46], amplitude: 4, speed: 1.5 },
    { kind: 'static', pos: [0, 4, -52] },
    { kind: 'goal', pos: [0, 4.5, -58], size: [4, 0.5, 4] },
  ],

  // ═══════════════════════════════════════════
  // LEVEL 8 — Disappearing chains
  // ═══════════════════════════════════════════
  [
    ...spawnIsland('#3d7aa0'),
    { kind: 'static', pos: [0, 0, -8] },
    { kind: 'disappearing', pos: [0, 0, -13], onTime: 2.0, offTime: 1.5 },
    { kind: 'disappearing', pos: [3, 0, -17], onTime: 2.0, offTime: 1.5, offset: 0.5 },
    { kind: 'disappearing', pos: [0, 0.5, -21], onTime: 2.0, offTime: 1.5, offset: 1.0 },
    { kind: 'disappearing', pos: [-3, 0.5, -25], onTime: 2.0, offTime: 1.5, offset: 1.5 },
    { kind: 'static', pos: [0, 1, -31], size: [3, 0.5, 3] },
    { kind: 'disappearing', pos: [0, 1, -37], onTime: 1.5, offTime: 1.5 },
    { kind: 'disappearing', pos: [4, 1.5, -41], onTime: 1.5, offTime: 1.5, offset: 0.7 },
    { kind: 'disappearing', pos: [0, 1.5, -45], onTime: 1.5, offTime: 1.5, offset: 1.4 },
    { kind: 'static', pos: [-4, 2, -51] },
    { kind: 'movingH', pos: [0, 2.5, -57], amplitude: 4, speed: 1.2 },
    { kind: 'goal', pos: [0, 3, -63], size: [4, 0.5, 4] },
  ],

  // ═══════════════════════════════════════════
  // LEVEL 9 — Speed movers
  // ═══════════════════════════════════════════
  [
    ...spawnIsland('#2e6691'),
    { kind: 'movingH', pos: [0, 0, -8], amplitude: 3, speed: 1.8 },
    { kind: 'movingH', pos: [0, 0.5, -14], amplitude: 4, speed: 2.0, offset: 1 },
    { kind: 'static', pos: [3, 1, -20] },
    { kind: 'movingV', pos: [0, 1.5, -26], amplitude: 3, speed: 1.5 },
    { kind: 'movingH', pos: [-3, 2, -32], amplitude: 5, speed: 2.2 },
    { kind: 'static', pos: [0, 2.5, -38], size: [2.5, 0.5, 2.5] },
    { kind: 'movingH', pos: [0, 3, -44], amplitude: 4, speed: 2.0, offset: 2 },
    { kind: 'movingV', pos: [3, 3, -50], amplitude: 2.5, speed: 1.8 },
    { kind: 'static', pos: [0, 4, -56] },
    { kind: 'goal', pos: [0, 4, -62], size: [4, 0.5, 4] },
  ],

  // ═══════════════════════════════════════════
  // LEVEL 10 — Gauntlet: rotating + disappear
  // ═══════════════════════════════════════════
  [
    ...spawnIsland('#2e6691'),
    { kind: 'static', pos: [0, 0, -8] },
    { kind: 'static', pos: [0, 0, -14], size: [5, 0.5, 5] },
    { kind: 'rotating', pos: [0, 2, -14], size: [10, 0.6, 1], speed: 1.8, color: '#ff4444' },
    { kind: 'disappearing', pos: [0, 0.5, -22], onTime: 1.8, offTime: 1.5 },
    { kind: 'static', pos: [-4, 1, -28] },
    { kind: 'rotating', pos: [-4, 2.5, -28], size: [6, 0.6, 1], speed: 2.0, color: '#ff4444' },
    { kind: 'disappearing', pos: [0, 1.5, -34], onTime: 1.5, offTime: 1.5, offset: 0.5 },
    { kind: 'movingV', pos: [3, 2, -40], amplitude: 2, speed: 1.5 },
    { kind: 'static', pos: [0, 3, -46], size: [3, 0.5, 3] },
    { kind: 'rotating', pos: [0, 4.5, -46], size: [8, 0.6, 1], speed: 2.2, color: '#ff4444' },
    { kind: 'static', pos: [0, 3.5, -54] },
    { kind: 'goal', pos: [0, 4, -60], size: [4, 0.5, 4] },
  ],

  // ═══════════════════════════════════════════
  // LEVEL 11 — Zigzag movers  ★ DJ shortcut
  // ═══════════════════════════════════════════
  [
    ...spawnIsland('#2e6691'),
    { kind: 'movingH', pos: [0, 0, -8], amplitude: 5, speed: 1.5 },
    { kind: 'movingH', pos: [0, 0.5, -14], amplitude: 5, speed: 1.5, offset: Math.PI },
    { kind: 'movingH', pos: [0, 1, -20], amplitude: 5, speed: 1.8 },
    { kind: 'movingH', pos: [0, 1.5, -26], amplitude: 5, speed: 1.8, offset: Math.PI },
    { kind: 'static', pos: [0, 2, -32], size: [2.5, 0.5, 2.5] },
    // ★ Double-jump shortcut: [0,2,-32] → [0,7,-38] → bypasses the hard movingV+H section
    { kind: 'static', pos: [0, 7, -38], size: [3, 0.5, 3], color: '#00aaff' },
    { kind: 'movingV', pos: [0, 2.5, -38], amplitude: 3, speed: 1.2 },
    { kind: 'movingH', pos: [0, 3.5, -44], amplitude: 4, speed: 2.0 },
    { kind: 'disappearing', pos: [0, 4, -50], onTime: 1.5, offTime: 1.5 },
    { kind: 'movingH', pos: [0, 4.5, -56], amplitude: 4, speed: 2.0, offset: 1 },
    { kind: 'goal', pos: [0, 5, -62], size: [4, 0.5, 4] },
  ],

  // ═══════════════════════════════════════════
  // LEVEL 12 — Triple spinner
  // ═══════════════════════════════════════════
  [
    ...spawnIsland('#254f7a'),
    { kind: 'static', pos: [0, 0, -8] },
    { kind: 'static', pos: [0, 0, -16], size: [5, 0.5, 5] },
    { kind: 'rotating', pos: [0, 2, -16], size: [10, 0.6, 1], speed: 2.0, color: '#ff4444' },
    { kind: 'movingH', pos: [0, 0.5, -24], amplitude: 5, speed: 1.8 },
    { kind: 'static', pos: [4, 1, -32], size: [4, 0.5, 4] },
    { kind: 'rotating', pos: [4, 2.5, -32], size: [8, 0.6, 1], speed: 2.3, color: '#ff4444' },
    { kind: 'disappearing', pos: [0, 1.5, -40], onTime: 1.5, offTime: 1.2 },
    { kind: 'static', pos: [-4, 2, -48], size: [4, 0.5, 4] },
    { kind: 'rotating', pos: [-4, 3.5, -48], size: [8, 0.6, 1], speed: 2.5, color: '#ff4444' },
    { kind: 'movingV', pos: [0, 3, -56], amplitude: 2, speed: 1.5 },
    { kind: 'goal', pos: [0, 4, -62], size: [4, 0.5, 4] },
  ],

  // ═══════════════════════════════════════════
  // LEVEL 13 — Disappearing maze
  // ═══════════════════════════════════════════
  [
    ...spawnIsland('#254f7a'),
    { kind: 'disappearing', pos: [0, 0, -8], onTime: 1.5, offTime: 1.2 },
    { kind: 'disappearing', pos: [3, 0, -12], onTime: 1.5, offTime: 1.2, offset: 0.4 },
    { kind: 'disappearing', pos: [0, 0.5, -16], onTime: 1.5, offTime: 1.2, offset: 0.8 },
    { kind: 'disappearing', pos: [-3, 0.5, -20], onTime: 1.5, offTime: 1.2, offset: 1.2 },
    { kind: 'static', pos: [0, 1, -26], size: [2.5, 0.5, 2.5] },
    { kind: 'disappearing', pos: [4, 1, -32], onTime: 1.2, offTime: 1.2, offset: 0 },
    { kind: 'disappearing', pos: [0, 1.5, -36], onTime: 1.2, offTime: 1.2, offset: 0.4 },
    { kind: 'disappearing', pos: [-4, 2, -40], onTime: 1.2, offTime: 1.2, offset: 0.8 },
    { kind: 'disappearing', pos: [0, 2, -44], onTime: 1.2, offTime: 1.2, offset: 1.2 },
    { kind: 'disappearing', pos: [3, 2.5, -48], onTime: 1.0, offTime: 1.0, offset: 0.3 },
    { kind: 'disappearing', pos: [0, 3, -52], onTime: 1.0, offTime: 1.0, offset: 0.6 },
    { kind: 'static', pos: [-3, 3.5, -58] },
    { kind: 'goal', pos: [0, 4, -64], size: [4, 0.5, 4] },
  ],

  // ═══════════════════════════════════════════
  // LEVEL 14 — Chaos mix
  // ═══════════════════════════════════════════
  [
    ...spawnIsland('#254f7a'),
    { kind: 'movingH', pos: [0, 0, -8], amplitude: 4, speed: 2.0 },
    { kind: 'disappearing', pos: [4, 0.5, -14], onTime: 1.3, offTime: 1.3 },
    { kind: 'static', pos: [-3, 1, -20], size: [3, 0.5, 3] },
    { kind: 'rotating', pos: [-3, 2.5, -20], size: [7, 0.6, 1], speed: 2.2, color: '#ff4444' },
    { kind: 'movingV', pos: [2, 1.5, -28], amplitude: 3, speed: 1.5 },
    { kind: 'disappearing', pos: [-2, 2, -34], onTime: 1.2, offTime: 1.3, offset: 0.5 },
    { kind: 'movingH', pos: [0, 2.5, -40], amplitude: 5, speed: 2.2 },
    { kind: 'static', pos: [4, 3, -46], size: [2.5, 0.5, 2.5] },
    { kind: 'rotating', pos: [4, 4.5, -46], size: [6, 0.6, 1], speed: 2.5, color: '#ff4444' },
    { kind: 'movingV', pos: [0, 3.5, -52], amplitude: 2.5, speed: 2.0 },
    { kind: 'disappearing', pos: [-3, 4, -58], onTime: 1.0, offTime: 1.0 },
    { kind: 'movingH', pos: [0, 4.5, -64], amplitude: 4, speed: 2.5 },
    { kind: 'goal', pos: [0, 5, -70], size: [4, 0.5, 4] },
  ],

  // ═══════════════════════════════════════════
  // LEVEL 15 — FINAL: Ultimate gauntlet
  // ═══════════════════════════════════════════
  [
    ...spawnIsland('#1c3d5c'),
    { kind: 'movingH', pos: [0, 0, -8], amplitude: 4, speed: 2.0 },
    { kind: 'disappearing', pos: [4, 0.5, -14], onTime: 1.2, offTime: 1.2 },
    { kind: 'movingV', pos: [0, 1, -20], amplitude: 3, speed: 1.8 },
    { kind: 'static', pos: [-4, 2, -26], size: [3, 0.5, 3] },
    { kind: 'rotating', pos: [-4, 3.5, -26], size: [7, 0.6, 1], speed: 2.5, color: '#ff4444' },
    { kind: 'movingH', pos: [2, 2, -34], amplitude: 6, speed: 2.2 },
    { kind: 'disappearing', pos: [-3, 2.5, -40], onTime: 1.0, offTime: 1.0 },
    { kind: 'disappearing', pos: [3, 3, -44], onTime: 1.0, offTime: 1.0, offset: 0.5 },
    { kind: 'movingV', pos: [0, 3.5, -50], amplitude: 3.5, speed: 1.5 },
    { kind: 'static', pos: [5, 4.5, -56], size: [2.5, 0.5, 2.5] },
    { kind: 'rotating', pos: [5, 6, -56], size: [8, 0.6, 1], speed: 2.8, color: '#ff4444' },
    { kind: 'movingH', pos: [0, 5, -62], amplitude: 5, speed: 2.5, offset: 1 },
    { kind: 'disappearing', pos: [-4, 5.5, -68], onTime: 0.9, offTime: 1.1, offset: 0.3 },
    { kind: 'movingV', pos: [0, 6, -74], amplitude: 2, speed: 2.5 },
    { kind: 'movingH', pos: [0, 6.5, -80], amplitude: 5, speed: 2.8 },
    { kind: 'static', pos: [0, 7, -86], size: [3, 0.5, 3] },
    { kind: 'disappearing', pos: [0, 7, -92], onTime: 0.8, offTime: 1.0 },
    { kind: 'static', pos: [0, 7.5, -98] },
    { kind: 'goal', pos: [0, 8, -104], size: [5, 0.5, 5] },
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
