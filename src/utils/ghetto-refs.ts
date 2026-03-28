import * as THREE from 'three';

/** Player world position — written by Player.tsx every frame in ghetto mode */
export const ghettoPlayerPosRef: { current: THREE.Vector3 } = { current: new THREE.Vector3() };

/** Player forward direction — written by Player.tsx every frame in ghetto mode */
export const ghettoPlayerForwardRef: { current: THREE.Vector3 } = { current: new THREE.Vector3(0, 0, -1) };

/** Set by GhettoLevel on mount; called by Player on E-key or LMB in ghetto mode */
export const ghettoShootTriggerRef: { current: (() => void) | null } = { current: null };

/** Camera shake intensity — set by GhettoLevel on explosions/hits, decays in Player useFrame */
export const cameraShakeRef: { current: number } = { current: 0 };

/** Damage vignette flash (0–1) — set on player hit, decays in App.tsx rAF loop */
export const ghettoDamageFlashRef: { current: number } = { current: 0 };

/** Set by GhettoLevel when a buy station is in range; null = none nearby */
export const ghettoNearStationRef: { current: string | null } = { current: null };

/** Set by GhettoLevel on mount; called by Player on F key to interact with buy station */
export const ghettoInteractTriggerRef: { current: (() => void) | null } = { current: null };

/** Written by GhettoLevel when player walks through an unlocked door; applied by Player useFrame */
export const ghettoTeleportRef: { current: { x: number; y: number; z: number } | null } = { current: null };
