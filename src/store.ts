import { create } from 'zustand';
import { audio } from './utils/audio';
import { useMultiplayerStore } from './store/multiplayer';

export const COLORS = [
  { name: 'red', hex: '#FF0000' },
  { name: 'orange', hex: '#FF4500' },
  { name: 'amber', hex: '#FFA500' },
  { name: 'yellow', hex: '#FFFF00' },
  { name: 'lime', hex: '#80C000' },
  { name: 'teal', hex: '#009688' },
  { name: 'cyan', hex: '#0070C0' },
  { name: 'blue', hex: '#002094' },
  { name: 'purple', hex: '#4B0082' },
  { name: 'magenta', hex: '#C00070' }
];

export const BOT_NAMES = ['Astro', 'Turbo', 'Neon', 'Pixels', 'Blitz', 'Dash', 'Zenith', 'Nova', 'Echo', 'Vortex', 'Pulse'];

type GameState = 'menu' | 'waiting' | 'playing' | 'elimination' | 'gameover' | 'victory' | 'levelcomplete';
type GameMode = 'classic' | 'parkour' | 'ghetto' | 'testing';
export type GadgetType = 'doubleJump' | 'speedBoost' | 'highJump';
export interface ActiveGadget { type: GadgetType; timeLeft: number; }

const PARKOUR_MAX_LEVEL = 15;

interface GameStore {
  gameId: number;
  gameState: GameState;
  gameMode: GameMode;
  isPaused: boolean;
  username: string;
  targetColor: typeof COLORS[0] | null;
  timeLeft: number;
  maxTime: number;
  roundsSurvived: number;
  gridColors: number[];
  playerSpeedMultiplier: number;
  hoveredBlockIndex: number;
  aliveBots: number[];
  sessionCoins: number;
  spawnedCoins: number[];
  // Parkour mode (level-based)
  parkourTime: number;
  maxParkourTime: number;
  parkourLevel: number;
  parkourJumpForce: number;
  collectedParkourCoins: number[];
  activeGadgets: ActiveGadget[];

  setUsername: (name: string) => void;
  setHoveredBlock: (index: number) => void;
  startGame: () => void;
  startTesting: () => void;
  startRound: () => void;
  collectCoin: (index: number) => void;

  // Network sync methods
  networkStartGame: (seed: number) => void;
  networkStartRound: (roundData: { seed: number, targetIndex: number, timeLimit: number, roundsSurvived: number }) => void;
  networkEliminatePlayer: (playerId: string) => void;

  togglePause: () => void;
  tick: (delta: number) => void;
  eliminate: () => void;
  playerDied: () => void;
  eliminateBot: (id: number) => void;

  // ── Ghetto mode state ──────────────────────────────────────────────────────
  ghettoHP: number;
  ghettoMaxHP: number;
  ghettoRegenTimer: number;   // countdown seconds until next +1 HP (0 = not regenerating)
  ghettoAmmo: number;
  ghettoMaxAmmo: number;
  ghettoWave: number;
  ghettoMaxWave: number;
  ghettoEnemiesAlive: number;
  ghettoScore: number;
  ghettoPoints: number;        // kill-earn currency for wall buys
  ghettoWeapon: 'pistol' | 'm16' | 'shotgun' | 'machinegun';
  ghettoOwnedWeapons: Array<'pistol' | 'm16' | 'shotgun' | 'machinegun'>;
  ghettoM16Ammo: number;
  ghettoMaxM16Ammo: number;
  ghettoShotgunAmmo: number;
  ghettoMaxShotgunAmmo: number;
  ghettoMachinegunAmmo: number;
  ghettoMaxMachinegunAmmo: number;

  ghettoFloorPrimed: boolean;  // true while loading screen shows + entire game session
  ghettoRoom: 0 | 1;
  ghettoDoor1Unlocked: boolean;

  // Ghetto mode actions
  primeGhettoFloor: () => void;
  startGhettoGame: () => void;
  tickGhetto: (delta: number) => void;
  resetGhettoGame: () => void;
  ghettoShoot: () => boolean;
  ghettoAddAmmo: (amount: number) => void;
  ghettoAddPoints: (amount: number) => void;
  ghettoAcquireM16: () => boolean;   // returns false if not enough points
  ghettoAcquireShotgun: () => boolean;
  ghettoAcquireMachinegun: () => boolean;
  ghettoSetWeapon: (w: 'pistol' | 'm16' | 'shotgun' | 'machinegun') => void;
  ghettoAddM16Ammo: (amount: number) => void;
  ghettoAddShotgunAmmo: (amount: number) => void;
  ghettoAddMachinegunAmmo: (amount: number) => void;
  ghettoEnemyKilled: (points: number) => void;
  ghettoDamagePlayer: (amount: number) => void;
  ghettoWaveComplete: () => void;
  ghettoUnlockDoor1: () => boolean;
  ghettoSetRoom: (r: 0 | 1) => void;
  ghettoSetEnemiesAlive: (n: number) => void;

  // Parkour mode actions
  setGameMode: (mode: GameMode) => void;
  startParkourGame: () => void;
  restartParkourLevel: () => void;
  tickParkour: (delta: number) => void;
  completeParkourLevel: () => void;
  resetParkourGame: () => void;
  collectParkourCoin: (index: number) => void;
  collectGadget: (type: GadgetType, duration: number) => void;
}

// Simple deterministic random number generator for synchronized grids
const sfc32 = (a: number, b: number, c: number, d: number) => {
    return function() {
      a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
      var t = (a + b) | 0;
      a = b ^ b >>> 9;
      b = c + (c << 3) | 0;
      c = (c << 21 | c >>> 11);
      d = d + 1 | 0;
      t = t + d | 0;
      c = c + t | 0;
      return (t >>> 0) / 4294967296;
    }
};

let prng = Math.random;

// Organic cluster grid generation — seed-flood-fill + noise (Block Party style)
function generateGrid(rng: () => number, targetIndex: number): number[] {
  const SIZE = 20;
  const nColors = COLORS.length;
  const r = (n: number) => Math.floor(rng() * n);
  const otherColors = Array.from({ length: nColors }, (_, i) => i).filter(i => i !== targetIndex);

  const grid = new Array(SIZE * SIZE).fill(-1); // -1 = unfilled

  // Step 1: Plant 12-16 seeds of random non-safe colors
  const numSeeds = 12 + r(5);
  const queue: number[] = [];
  for (let s = 0; s < numSeeds; s++) {
    const pos = r(SIZE * SIZE);
    grid[pos] = otherColors[r(otherColors.length)];
    queue.push(pos);
  }

  // Step 2: BFS flood-fill expansion — each cell has 80% chance to spread to empty neighbors
  let head = 0;
  while (head < queue.length) {
    const idx = queue[head++];
    const x = idx % SIZE;
    const z = Math.floor(idx / SIZE);
    const color = grid[idx];
    const neighbors = [
      x > 0       ? idx - 1    : -1,
      x < SIZE-1  ? idx + 1    : -1,
      z > 0       ? idx - SIZE : -1,
      z < SIZE-1  ? idx + SIZE : -1,
    ];
    for (const n of neighbors) {
      if (n === -1 || grid[n] !== -1) continue;
      if (rng() < 0.80) { grid[n] = color; queue.push(n); }
    }
  }

  // Step 3: Fill any cells still empty (BFS rejections) with a neighbor's color or random
  for (let i = 0; i < SIZE * SIZE; i++) {
    if (grid[i] !== -1) continue;
    const x = i % SIZE;
    const z = Math.floor(i / SIZE);
    const filled = [
      x > 0       ? i - 1    : -1,
      x < SIZE-1  ? i + 1    : -1,
      z > 0       ? i - SIZE : -1,
      z < SIZE-1  ? i + SIZE : -1,
    ].filter(n => n !== -1 && grid[n] !== -1 && grid[n] !== targetIndex);
    grid[i] = filled.length > 0 ? grid[filled[r(filled.length)]] : otherColors[r(otherColors.length)];
  }

  // Step 4: ~20% random noise — scatter isolated cells with different colors
  const noiseCount = Math.floor(SIZE * SIZE * 0.20);
  for (let n = 0; n < noiseCount; n++) {
    grid[r(SIZE * SIZE)] = otherColors[r(otherColors.length)];
  }

  // Step 5: Place safe color in exactly 3 small islands, one per quadrant (forced spread)
  const quadrantOrigins: [number, number][] = [[0, 0], [10, 0], [0, 10], [10, 10]];
  const safeCount = 3;
  for (let q = 0; q < safeCount; q++) {
    const [qx, qz] = quadrantOrigins[q];
    const ox = qx + r(8);
    const oz = qz + r(8);
    const w = 2 + r(2); // 2–3 cells
    const h = 2 + r(2);
    for (let dz = 0; dz < h; dz++) for (let dx = 0; dx < w; dx++) {
      const cx = Math.min(ox + dx, SIZE - 1);
      const cz = Math.min(oz + dz, SIZE - 1);
      grid[cz * SIZE + cx] = targetIndex;
    }
  }

  return grid;
}

export const useGameStore = create<GameStore>((set, get) => ({
  gameId: 0,
  gameState: 'menu',
  gameMode: 'classic',
  isPaused: false,
  username: '',
  targetColor: null,
  timeLeft: 0,
  maxTime: 5,
  roundsSurvived: 0,
  gridColors: Array.from({ length: 400 }, () => Math.floor(Math.random() * COLORS.length)),
  playerSpeedMultiplier: 1,
  hoveredBlockIndex: -1,
  aliveBots: [],
  sessionCoins: 0,
  spawnedCoins: [],
  // Parkour mode defaults
  parkourTime: 60,
  maxParkourTime: 60,
  parkourLevel: 1,
  parkourJumpForce: 12,
  collectedParkourCoins: [],
  activeGadgets: [],
  // Ghetto defaults
  ghettoFloorPrimed: false,
  ghettoRoom: 0 as 0 | 1,
  ghettoDoor1Unlocked: false,
  ghettoHP: 3,
  ghettoMaxHP: 3,
  ghettoRegenTimer: 0,
  ghettoAmmo: 30,
  ghettoMaxAmmo: 30,
  ghettoWave: 1,
  ghettoMaxWave: 10,
  ghettoEnemiesAlive: 0,
  ghettoScore: 0,
  ghettoPoints: 0,
  ghettoWeapon: 'pistol' as const,
  ghettoOwnedWeapons: ['pistol'] as Array<'pistol' | 'm16' | 'shotgun' | 'machinegun'>,
  ghettoM16Ammo: 0,
  ghettoMaxM16Ammo: 90,
  ghettoShotgunAmmo: 0,
  ghettoMaxShotgunAmmo: 24,
  ghettoMachinegunAmmo: 0,
  ghettoMaxMachinegunAmmo: 200,

  setUsername: (name: string) => set({ username: name }),
  setHoveredBlock: (index: number) => {
    if (get().hoveredBlockIndex === index) return;
    set({ hoveredBlockIndex: index });
  },

  startGame: () => {
    const { isHost, channel, lobbyId } = useMultiplayerStore.getState();
    const isMultiplayer = !!lobbyId;

    if (isMultiplayer && !isHost) return;

    const seed = Math.floor(Math.random() * 1000000);

    if (isMultiplayer && channel) {
      channel.send({
        type: 'broadcast',
        event: 'start_game',
        payload: { seed }
      });
    }

    get().networkStartGame(seed);
  },

  networkStartGame: (seed: number) => {
    prng = sfc32(seed, seed ^ 0xDEADBEEF, seed ^ 0xBAADF00D, seed ^ 0x01234567);
    audio.init();
    audio.startMusic();
    const isMultiplayer = !!useMultiplayerStore.getState().lobbyId;

    set(state => ({
      gameId: state.gameId + 1,
      roundsSurvived: 0,
      playerSpeedMultiplier: 1,
      gameState: 'waiting',
      isPaused: false,
      sessionCoins: 0,
      spawnedCoins: [],
      aliveBots: isMultiplayer ? [] : Array.from({ length: 11 }, (_, i) => i)
    }));

    if (!isMultiplayer || useMultiplayerStore.getState().isHost) {
        get().startRound();
    }
  },

  startRound: () => {
    const { isHost, channel, lobbyId } = useMultiplayerStore.getState();
    const isMultiplayer = !!lobbyId;

    if (isMultiplayer && !isHost) return;

    const seed = Math.floor(Math.random() * 1000000);
    const targetIndex = Math.floor(Math.random() * COLORS.length);
    const rounds = get().roundsSurvived;
    const timeForRound = Math.max(1.5, 5 - rounds * 0.2);

    if (isMultiplayer && channel) {
      channel.send({
        type: 'broadcast',
        event: 'start_round',
        payload: { seed, targetIndex, timeLimit: timeForRound, roundsSurvived: rounds }
      });
    }

    get().networkStartRound({ seed, targetIndex, timeLimit: timeForRound, roundsSurvived: rounds });
  },

  networkStartRound: ({ seed, targetIndex, timeLimit, roundsSurvived }) => {
    prng = sfc32(seed, seed ^ 0xDEADBEEF, seed ^ 0xBAADF00D, seed ^ 0x01234567);
    const newGrid = generateGrid(prng, targetIndex);

    audio.setMusicSpeed(1 + roundsSurvived * 0.05);

    set({
      gameState: 'playing',
      gridColors: newGrid,
      targetColor: COLORS[targetIndex],
      timeLeft: timeLimit,
      maxTime: timeLimit,
      roundsSurvived: roundsSurvived,
      playerSpeedMultiplier: roundsSurvived >= 10 ? 1.2 : 1,
      spawnedCoins: (() => {
        const potentialIndices = newGrid.map((c, i) => c === targetIndex ? i : -1).filter(i => i !== -1);
        const count = Math.floor(prng() * 3) + 1;
        const coins: number[] = [];
        for(let i=0; i<count && potentialIndices.length > 0; i++) {
          const randIdx = Math.floor(prng() * potentialIndices.length);
          coins.push(potentialIndices.splice(randIdx, 1)[0]);
        }
        return coins;
      })()
    });

    audio.playRoundStartSound();
  },

  startTesting: () => {
    audio.init();
    set(state => ({
      gameId: state.gameId + 1,
      gameMode: 'testing',
      gameState: 'playing',
      isPaused: false,
    }));
  },

  togglePause: () => set(state => ({ isPaused: !state.isPaused })),

  tick: (delta: number) => {
    const { gameState, timeLeft, gameMode } = get();
    if (gameMode === 'testing') return; // no timer in testing mode
    if (gameState === 'playing') {
      const newTime = timeLeft - delta;
      if (newTime <= 0) {
        get().eliminate();
      } else {
        set({ timeLeft: newTime });
      }
    }
  },

  eliminate: () => {
    const { lobbyId, broadcastElimination } = useMultiplayerStore.getState();

    set({ gameState: 'elimination', timeLeft: 0 });
    audio.playEliminationSound();

    if (lobbyId) {
       broadcastElimination();
    }

    setTimeout(() => {
      if (get().gameState === 'elimination') {
        const { isHost, lobbyId } = useMultiplayerStore.getState();
        if (!lobbyId) {
            set((state) => ({ roundsSurvived: state.roundsSurvived + 1 }));
            get().startRound();
        } else if (isHost) {
            setTimeout(() => {
              set((state) => ({ roundsSurvived: state.roundsSurvived + 1 }));
              get().startRound();
            }, 1000);
        }
      }
    }, 3000);
  },

  networkEliminatePlayer: (_playerId: string) => {
    // Handled via multiplayer store
  },

  playerDied: () => {
    if (get().gameState !== 'gameover') {
      const { gameMode, roundsSurvived, sessionCoins, parkourLevel } = get();
      set({ gameState: 'gameover', activeGadgets: [] });
      audio.stopMusic();
      audio.playGameOverSound();

      import('./store/profile').then(m => {
        const { ghettoWave, ghettoScore } = get();
        m.useProfileStore.getState().addReward(
          gameMode === 'ghetto' ? ghettoWave : gameMode === 'parkour' ? parkourLevel : roundsSurvived,
          false,
          gameMode === 'parkour' ? sessionCoins : sessionCoins
        );
      });
    }
  },

  eliminateBot: (id: number) => {
    const newAliveBots = get().aliveBots.filter(botId => botId !== id);
    set({ aliveBots: newAliveBots });

    if (newAliveBots.length === 0 && get().gameState !== 'gameover' && get().gameState !== 'victory') {
      setTimeout(() => {
        if (get().gameState !== 'gameover') {
          const rounds = get().roundsSurvived;
          set({ gameState: 'victory', timeLeft: 0 });
          audio.stopMusic();

          import('./store/profile').then(m => {
            const coins = get().sessionCoins;
            m.useProfileStore.getState().addReward(rounds, true, coins);
          });
        }
      }, 1000);
    }
  },

  collectCoin: (index: number) => {
    audio.playCoinCollectSound();
    set(state => ({
      sessionCoins: state.sessionCoins + 1,
      spawnedCoins: state.spawnedCoins.filter(i => i !== index)
    }));
  },

  // ─── Ghetto mode ──────────────────────────────────────────────────────

  primeGhettoFloor: () => set({ ghettoFloorPrimed: true }),

  startGhettoGame: () => {
    audio.init();
    audio.stopMusic();   // ensure clean restart (idempotent)
    audio.startMusic();
    set(state => ({
      gameId: state.gameId + 1,
      gameMode: 'ghetto',
      gameState: 'playing',
      isPaused: false,
      ghettoHP: 3,
      ghettoMaxHP: 3,
      ghettoRegenTimer: 0,
      ghettoAmmo: 30,
      ghettoMaxAmmo: 30,
      ghettoWave: 1,
      ghettoMaxWave: 10,
      ghettoEnemiesAlive: 3,
      ghettoScore: 0,
      ghettoPoints: 0,
      ghettoWeapon: 'machinegun' as const,
      ghettoOwnedWeapons: ['pistol', 'machinegun'] as Array<'pistol' | 'm16' | 'shotgun' | 'machinegun'>,
      ghettoM16Ammo: 0,
      ghettoShotgunAmmo: 0,
      ghettoMachinegunAmmo: 40,
      ghettoRoom: 0 as 0 | 1,
      ghettoDoor1Unlocked: false,
      activeGadgets: [],
      sessionCoins: 0,
      spawnedCoins: [],
      aliveBots: [],
      targetColor: null,
      timeLeft: 0,
      roundsSurvived: 0,
      parkourLevel: 1,
    }));
    audio.playWaveStart();
  },

  tickGhetto: (delta: number) => {
    const { ghettoHP, ghettoMaxHP, ghettoRegenTimer, gameState } = get();
    if (gameState !== 'playing' || ghettoHP >= ghettoMaxHP) return;
    const newTimer = ghettoRegenTimer - delta;
    if (newTimer <= 0) {
      // Regen 1 HP, restart timer for the next point (if still not full)
      const regenHP = ghettoHP + 1;
      set({ ghettoHP: regenHP, ghettoRegenTimer: regenHP < ghettoMaxHP ? 6 : 0 });
    } else {
      set({ ghettoRegenTimer: newTimer });
    }
  },

  resetGhettoGame: () => {
    audio.stopMusic();
    set({
      gameState: 'menu',
      gameMode: 'classic',  // return to default mode so HUD resets correctly
      ghettoFloorPrimed: false,
      ghettoHP: 3,
      ghettoRegenTimer: 0,
      ghettoAmmo: 30,
      ghettoWave: 1,
      ghettoEnemiesAlive: 0,
      ghettoScore: 0,
      ghettoPoints: 0,
      ghettoWeapon: 'pistol' as const,
      ghettoOwnedWeapons: ['pistol'] as Array<'pistol' | 'm16' | 'shotgun' | 'machinegun'>,
      ghettoM16Ammo: 0,
      ghettoShotgunAmmo: 0,
      ghettoMachinegunAmmo: 0,
      ghettoRoom: 0 as 0 | 1,
      ghettoDoor1Unlocked: false,
      targetColor: null,
    });
  },

  ghettoShoot: () => {
    const { ghettoWeapon, ghettoAmmo, ghettoM16Ammo, ghettoShotgunAmmo, ghettoMachinegunAmmo } = get();
    if (ghettoWeapon === 'm16') {
      if (ghettoM16Ammo <= 0) { audio.playEmptyGun(); return false; }
      audio.playGunshot();
      set({ ghettoM16Ammo: ghettoM16Ammo - 1 });
    } else if (ghettoWeapon === 'shotgun') {
      if (ghettoShotgunAmmo <= 0) { audio.playEmptyGun(); return false; }
      audio.playGunshot();
      set({ ghettoShotgunAmmo: ghettoShotgunAmmo - 1 });
    } else if (ghettoWeapon === 'machinegun') {
      if (ghettoMachinegunAmmo <= 0) { audio.playEmptyGun(); return false; }
      set({ ghettoMachinegunAmmo: ghettoMachinegunAmmo - 1 });
    } else {
      if (ghettoAmmo <= 0) { audio.playEmptyGun(); return false; }
      audio.playGunshot();
      set({ ghettoAmmo: ghettoAmmo - 1 });
    }
    return true;
  },
  ghettoAddAmmo: (amount: number) => {
    const { ghettoWeapon, ghettoAmmo, ghettoMaxAmmo, ghettoM16Ammo, ghettoMaxM16Ammo, ghettoShotgunAmmo, ghettoMaxShotgunAmmo, ghettoMachinegunAmmo, ghettoMaxMachinegunAmmo } = get();
    if (ghettoWeapon === 'm16') {
      set({ ghettoM16Ammo: Math.min(ghettoM16Ammo + amount, ghettoMaxM16Ammo) });
    } else if (ghettoWeapon === 'shotgun') {
      set({ ghettoShotgunAmmo: Math.min(ghettoShotgunAmmo + amount, ghettoMaxShotgunAmmo) });
    } else if (ghettoWeapon === 'machinegun') {
      set({ ghettoMachinegunAmmo: Math.min(ghettoMachinegunAmmo + amount, ghettoMaxMachinegunAmmo) });
    } else {
      set({ ghettoAmmo: Math.min(ghettoAmmo + amount, ghettoMaxAmmo) });
    }
  },
  ghettoAddPoints: (amount: number) => {
    set(state => ({ ghettoPoints: state.ghettoPoints + amount }));
  },
  ghettoAcquireM16: () => {
    const { ghettoPoints, ghettoOwnedWeapons, ghettoM16Ammo, ghettoMaxM16Ammo } = get();
    if (ghettoOwnedWeapons.includes('m16')) {
      // Already have M16 — buy ammo refill (150 pts)
      if (ghettoPoints < 150) return false;
      set({ ghettoPoints: ghettoPoints - 150, ghettoM16Ammo: Math.min(ghettoM16Ammo + 30, ghettoMaxM16Ammo) });
      return true;
    }
    if (ghettoPoints < 500) return false;
    set({
      ghettoPoints: ghettoPoints - 500,
      ghettoWeapon: 'm16',
      ghettoOwnedWeapons: [...ghettoOwnedWeapons, 'm16'],
      ghettoM16Ammo: 30,
    });
    return true;
  },
  ghettoSetWeapon: (w: 'pistol' | 'm16' | 'shotgun' | 'machinegun') => {
    if (!get().ghettoOwnedWeapons.includes(w)) return;
    set({ ghettoWeapon: w });
  },
  ghettoAddM16Ammo: (amount: number) => {
    set(state => ({ ghettoM16Ammo: Math.min(state.ghettoM16Ammo + amount, state.ghettoMaxM16Ammo) }));
  },
  ghettoAddShotgunAmmo: (amount: number) => {
    set(state => ({ ghettoShotgunAmmo: Math.min(state.ghettoShotgunAmmo + amount, state.ghettoMaxShotgunAmmo) }));
  },
  ghettoAddMachinegunAmmo: (amount: number) => {
    set(state => ({ ghettoMachinegunAmmo: Math.min(state.ghettoMachinegunAmmo + amount, state.ghettoMaxMachinegunAmmo) }));
  },
  ghettoAcquireMachinegun: () => {
    const { ghettoPoints, ghettoOwnedWeapons, ghettoMachinegunAmmo, ghettoMaxMachinegunAmmo } = get();
    if (ghettoOwnedWeapons.includes('machinegun')) {
      if (ghettoPoints < 250) return false;
      set({ ghettoPoints: ghettoPoints - 250, ghettoMachinegunAmmo: Math.min(ghettoMachinegunAmmo + 40, ghettoMaxMachinegunAmmo) });
      return true;
    }
    if (ghettoPoints < 1000) return false;
    set({
      ghettoPoints: ghettoPoints - 1000,
      ghettoWeapon: 'machinegun',
      ghettoOwnedWeapons: [...ghettoOwnedWeapons, 'machinegun'],
      ghettoMachinegunAmmo: 40,
    });
    return true;
  },
  ghettoAcquireShotgun: () => {
    const { ghettoPoints, ghettoOwnedWeapons, ghettoShotgunAmmo, ghettoMaxShotgunAmmo } = get();
    if (ghettoOwnedWeapons.includes('shotgun')) {
      if (ghettoPoints < 200) return false;
      set({ ghettoPoints: ghettoPoints - 200, ghettoShotgunAmmo: Math.min(ghettoShotgunAmmo + 8, ghettoMaxShotgunAmmo) });
      return true;
    }
    if (ghettoPoints < 800) return false;
    set({
      ghettoPoints: ghettoPoints - 800,
      ghettoWeapon: 'shotgun',
      ghettoOwnedWeapons: [...ghettoOwnedWeapons, 'shotgun'],
      ghettoShotgunAmmo: 8,
    });
    return true;
  },

  ghettoSetEnemiesAlive: (n: number) => set({ ghettoEnemiesAlive: n }),
  ghettoUnlockDoor1: () => {
    const { ghettoPoints, ghettoDoor1Unlocked } = get();
    if (ghettoDoor1Unlocked) return true;
    if (ghettoPoints < 750) return false;
    set({ ghettoDoor1Unlocked: true, ghettoPoints: ghettoPoints - 750 });
    return true;
  },
  ghettoSetRoom: (r: 0 | 1) => set({ ghettoRoom: r }),

  ghettoEnemyKilled: (points: number) => {
    const { ghettoEnemiesAlive, ghettoScore } = get();
    audio.playEnemyDeath();
    const newAlive = Math.max(0, ghettoEnemiesAlive - 1);
    set({ ghettoEnemiesAlive: newAlive, ghettoScore: ghettoScore + 1, ghettoPoints: get().ghettoPoints + points });
    if (newAlive <= 0) {
      get().ghettoWaveComplete();
    }
  },

  ghettoDamagePlayer: (amount: number) => {
    if (get().gameState !== 'playing') return;
    const newHP = get().ghettoHP - amount;
    if (newHP <= 0) {
      set({ ghettoHP: 0, ghettoRegenTimer: 0 });
      // Record waves survived before dying (wave N = currently fighting → N-1 fully cleared)
      const wavesSurvived = Math.max(0, get().ghettoWave - 1);
      import('./store/profile').then(m => {
        m.useProfileStore.getState().recordGhettoWaves(wavesSurvived);
      });
      get().playerDied();
    } else {
      // Damage resets the regen countdown to 6s
      set({ ghettoHP: newHP, ghettoRegenTimer: 6 });
    }
  },

  ghettoWaveComplete: () => {
    const { ghettoWave, ghettoMaxWave, ghettoScore } = get();
    if (ghettoWave >= ghettoMaxWave) {
      set({ gameState: 'victory' });
      audio.stopMusic();
      import('./store/profile').then(m => {
        m.useProfileStore.getState().addReward(ghettoWave, true, ghettoScore);
        m.useProfileStore.getState().recordGhettoWaves(ghettoWave); // cleared all waves
      });
      return;
    }
    const nextWave = ghettoWave + 1;
    set({ ghettoWave: nextWave, ghettoEnemiesAlive: nextWave * 3 });
    audio.playWaveStart();
  },

  // ─── Parkour mode ─────────────────────────────────────────────────────

  setGameMode: (mode: GameMode) => set({ gameMode: mode }),

  startParkourGame: () => {
    audio.init();
    audio.startMusic();

    const timeLimits = [75, 85, 90, 95, 100, 105, 110, 115, 120, 125, 130, 135, 140, 150, 180];

    set(state => ({
      gameId: state.gameId + 1,
      gameMode: 'parkour',
      gameState: 'playing',
      parkourLevel: 1,
      parkourTime: timeLimits[0],
      maxParkourTime: timeLimits[0],
      parkourJumpForce: 12,
      collectedParkourCoins: [],
      activeGadgets: [],
      sessionCoins: 0,
      spawnedCoins: [],
      aliveBots: [],
      isPaused: false,
      playerSpeedMultiplier: 1,
      targetColor: null,
      timeLeft: 0,
      maxTime: 0,
      roundsSurvived: 0,
      gridColors: Array.from({ length: 400 }, () => 0),
    }));
  },

  restartParkourLevel: () => {
    const timeLimits = [75, 85, 90, 95, 100, 105, 110, 115, 120, 125, 130, 135, 140, 150, 180];
    const { parkourLevel } = get();
    const timeForLevel = timeLimits[parkourLevel - 1] ?? 60;
    set(state => ({
      gameId: state.gameId + 1,
      gameState: 'playing',
      parkourTime: timeForLevel,
      maxParkourTime: timeForLevel,
      collectedParkourCoins: [],
      activeGadgets: [],
      sessionCoins: 0,
      spawnedCoins: [],
    }));
  },

  tickParkour: (delta: number) => {
    const state = get();
    const { gameState, gameMode, parkourTime } = state;
    if (gameState !== 'playing' || gameMode !== 'parkour') return;

    const newTime = parkourTime - delta;
    if (newTime <= 0) {
      set({ gameState: 'gameover', parkourTime: 0, activeGadgets: [] });
      audio.stopMusic();
      audio.playGameOverSound();
      import('./store/profile').then(m => {
        m.useProfileStore.getState().addReward(0, false, 0);
      });
    } else {
      // Tick active gadgets
      set({
        parkourTime: newTime,
        activeGadgets: state.activeGadgets
          .map(g => ({ ...g, timeLeft: g.timeLeft - delta }))
          .filter(g => g.timeLeft > 0),
      });
    }
  },

  completeParkourLevel: () => {
    const { parkourLevel, parkourTime, maxParkourTime } = get();
    audio.playRoundStartSound();

    // Capture elapsed time NOW, before any state reset
    const elapsed = maxParkourTime - parkourTime;

    // Save personal best immediately (both localStorage + Supabase for logged-in users)
    if (elapsed > 0) {
      try {
        const key = `pkPB_${parkourLevel}`;
        const prev = localStorage.getItem(key);
        if (!prev || elapsed < parseFloat(prev)) {
          localStorage.setItem(key, elapsed.toFixed(2));
        }
      } catch {}
      import('./store/profile').then(m => {
        m.useProfileStore.getState().saveParkourRecord(parkourLevel, elapsed);
      });
    }

    if (parkourLevel >= PARKOUR_MAX_LEVEL) {
      set({ gameState: 'victory', activeGadgets: [] });
      audio.stopMusic();
      import('./store/profile').then(m => {
        m.useProfileStore.getState().addReward(parkourLevel, true, 0);
      });
      return;
    }

    set({ gameState: 'levelcomplete' });

    const timeLimits = [75, 85, 90, 95, 100, 105, 110, 115, 120, 125, 130, 135, 140, 150, 180];
    const nextLevel = parkourLevel + 1;

    setTimeout(() => {
      if (get().gameState !== 'levelcomplete') return;
      set(state => ({
        gameId: state.gameId + 1,
        gameState: 'playing',
        parkourLevel: nextLevel,
        parkourTime: timeLimits[nextLevel - 1] ?? 120,
        maxParkourTime: timeLimits[nextLevel - 1] ?? 120,
        collectedParkourCoins: [],
        activeGadgets: [],
      }));
    }, 2500);
  },

  resetParkourGame: () => {
    set({
      gameState: 'menu',
      parkourTime: 60,
      maxParkourTime: 60,
      parkourLevel: 1,
      parkourJumpForce: 12,
      collectedParkourCoins: [],
      activeGadgets: [],
      sessionCoins: 0,
      spawnedCoins: [],
    });
  },

  collectParkourCoin: (index: number) => {
    if (get().collectedParkourCoins.includes(index)) return;
    audio.playCoinCollectSound();
    set(state => ({
      collectedParkourCoins: [...state.collectedParkourCoins, index],
      sessionCoins: state.sessionCoins + 1,
    }));
  },

  collectGadget: (type: GadgetType, duration: number) => {
    audio.playGadgetCollectSound();
    set(state => ({
      // Replace existing gadget of same type or add new
      activeGadgets: [
        ...state.activeGadgets.filter(g => g.type !== type),
        { type, timeLeft: duration },
      ],
    }));
  },
}));
