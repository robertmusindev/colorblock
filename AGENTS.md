# AGENTS.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview

"Color Block Party" — a 3D browser mini-game where players must run to the correct colored block on a 20×20 grid before time expires. Non-target blocks fall away each round. Supports singleplayer (vs 11 AI bots) and multiplayer (via Supabase Realtime). Includes auth, user profiles, an in-game economy (Party Blocks / PB currency), and i18n (English, Italian, Russian).

## Build and Dev Commands

- `npm install` — install dependencies
- `npm run dev` — start Vite dev server on port 3000
- `npm run build` — production build to `dist/`
- `npm run lint` — typecheck with `tsc --noEmit`
- `npm run clean` — remove `dist/`
- `npm run preview` — preview production build

There are no test scripts configured. There is no ESLint config; the only lint step is the TypeScript compiler.

## Environment Variables

Copy `.env.example` to `.env`. Required variables:

- `GEMINI_API_KEY` — exposed to client via `process.env.GEMINI_API_KEY` (Vite define)
- `VITE_SUPABASE_URL` — Supabase project URL (accessed via `import.meta.env`)
- `VITE_SUPABASE_ANON_KEY` — Supabase anonymous key

## Architecture

### Tech Stack

- **React 19 + TypeScript** with Vite 6 (ESM, `"type": "module"`)
- **3D engine**: react-three-fiber (Three.js), react-three-drei (helpers), react-three-rapier (Rapier physics)
- **State**: Zustand stores (no Redux, no Context)
- **Styling**: Tailwind CSS v4 (via `@tailwindcss/vite` plugin, imported as `@import "tailwindcss"` in `index.css`)
- **Animations**: Framer Motion for UI, procedural animation in `useFrame` for 3D
- **Backend**: Supabase (auth, Postgres, Realtime channels, Storage)

### Path Alias

`@` maps to the project root (configured in both `tsconfig.json` and `vite.config.ts`).

### State Management (Zustand Stores)

All game state lives in Zustand stores under `src/store/` and `src/store.ts`:

- **`src/store.ts`** (`useGameStore`) — core game loop: game state machine (`menu → waiting → playing → elimination → gameover/victory`), round timer, grid colors, bot tracking, coin economy. Contains a deterministic PRNG (`sfc32`) used to synchronize grid generation across multiplayer clients via shared seeds.
- **`src/store/auth.ts`** (`useAuthStore`) — Supabase auth session management.
- **`src/store/multiplayer.ts`** (`useMultiplayerStore`) — lobby creation/joining, Supabase Realtime channel management (presence for player list, broadcast for movement/round sync/eliminations). Host-authoritative: only the host advances rounds.
- **`src/store/profile.ts`** (`useProfileStore`) — persistent player profile (coins, level, inventory, missions), synced to Supabase `profiles` table. Includes shop items and mission progression.
- **`src/store/i18n.ts`** (`useI18nStore`) — translation dictionary with `t(key)` accessor. Language stored in localStorage.

### 3D Scene (`src/components/`)

- **`Game.tsx`** — Canvas root. Sets up Physics world, lighting, Sky/Environment. Conditionally renders Player, Bots (singleplayer), or NetworkPlayers (multiplayer). `GameLogic` component drives the timer via `useFrame`.
- **`Platform.tsx`** — 400 instanced rigid bodies (20×20 grid). Updates block physics types (kinematic ↔ dynamic) and instance colors each round. Non-target blocks switch to dynamic to fall during elimination.
- **`Player.tsx`** — local player with capsule collider, WASD/Arrow + Space controls, procedural walk animation, camera follow, footstep sounds, and network position broadcast (~15Hz).
- **`Bot.tsx`** — AI opponents with a state machine (`idle → wandering → seeking → waiting`). Each bot has a reaction delay and an ~18% chance per round of targeting the wrong block.
- **`NetworkPlayer.tsx`** — interpolated remote player representation (lerped position, slerped rotation) for multiplayer.
- **`Coin.tsx`** — collectible coins spawned on target-color blocks each round using sensor colliders.

### Audio (`src/utils/audio.ts`)

All audio is synthesized at runtime via the Web Audio API — there are no audio files. The `AudioController` singleton provides methods for music (beat loop), jump, footstep, elimination, round-start, game-over, and coin sounds.

### UI Conventions

- Display fonts: "Luckiest Guy" (headings), "Nunito"/"Poppins" (body) — loaded via Google Fonts in `index.html`.
- Heavy use of Tailwind utility classes with a cartoonish, bold aesthetic (thick borders, drop shadows, animated gradients).
- Icons from `lucide-react`.
- `canvas-confetti` for celebration effects.

## Key Patterns

- **Frame-rate independent math**: all `useFrame` lerps use `1 - Math.exp(-speed * delta)` rather than fixed factors.
- **GC prevention in render loops**: THREE.js temp objects (`Vector3`, `Quaternion`) are allocated at module scope, not inside `useFrame`.
- **Multiplayer sync model**: host generates seeds and broadcasts round data; clients use the same deterministic PRNG to produce identical grids.
- **Supabase retry wrapper**: `withRetry()` in multiplayer store handles cold-start failures on free-tier Supabase.
