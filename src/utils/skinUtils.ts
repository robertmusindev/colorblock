import * as THREE from 'three';

/**
 * Centralized skin application utility.
 * The GLB model has 3 nodes: Leg_S (left leg), body, Leg_R (right leg).
 * All skin textures and materials are applied here to avoid duplication.
 */

export interface SkinTextures {
  default: THREE.Texture;
  israel: THREE.Texture;
  robsbagliato: THREE.Texture;
  skin3?: THREE.Texture;
  skin4?: THREE.Texture;
}

/**
 * Apply a skin to a cloned GLB model.
 * Call this inside useMemo when creating the clone.
 */
export function applySkinToModel(
  clone: THREE.Group,
  skinId: string,
  textures: SkinTextures
): void {
  clone.traverse((node) => {
    if (node instanceof THREE.Mesh) {
      const mat = new THREE.MeshStandardMaterial();

      if (skinId === 'skin_special_israel') {
        textures.israel.flipY = false;
        textures.israel.colorSpace = THREE.SRGBColorSpace;
        mat.map = textures.israel;
      } else if (skinId === 'skin_robsbagliato') {
        textures.robsbagliato.flipY = false;
        textures.robsbagliato.colorSpace = THREE.SRGBColorSpace;
        mat.map = textures.robsbagliato;
      } else if (skinId === 'skin3' && textures.skin3) {
        textures.skin3.flipY = false;
        textures.skin3.colorSpace = THREE.SRGBColorSpace;
        mat.map = textures.skin3;
      } else if (skinId === 'skin4' && textures.skin4) {
        textures.skin4.flipY = false;
        textures.skin4.colorSpace = THREE.SRGBColorSpace;
        mat.map = textures.skin4;
      } else if (skinId === 'skin_epic') {
        mat.color.set('#ffd700');
        mat.metalness = 0.8;
        mat.roughness = 0.1;
      } else if (skinId === 'skin_solid') {
        mat.color.set('#4cc9f0');
      } else if (skinId === 'skin_pattern') {
        mat.color.set('#3a0ca3');
      } else if (skinId === 'skin_legendary') {
        mat.color.set('#ffffff');
      } else {
        // Default skin
        textures.default.flipY = false;
        textures.default.colorSpace = THREE.SRGBColorSpace;
        mat.map = textures.default;
      }

      mat.needsUpdate = true;
      node.material = mat;
    }
  });
}

/**
 * Apply a color-based skin (for bots) with a custom color.
 */
export function applySkinToModelWithColor(
  clone: THREE.Group,
  skinId: string,
  textures: SkinTextures,
  customColor: string
): void {
  clone.traverse((node) => {
    if (node instanceof THREE.Mesh) {
      const mat = new THREE.MeshStandardMaterial();

      if (skinId === 'skin_solid') {
        mat.color.set(customColor);
      } else if (skinId === 'skin_special_israel') {
        textures.israel.flipY = false;
        textures.israel.colorSpace = THREE.SRGBColorSpace;
        mat.map = textures.israel;
      } else if (skinId === 'skin_robsbagliato') {
        textures.robsbagliato.flipY = false;
        textures.robsbagliato.colorSpace = THREE.SRGBColorSpace;
        mat.map = textures.robsbagliato;
      } else if (skinId === 'skin3' && textures.skin3) {
        textures.skin3.flipY = false;
        textures.skin3.colorSpace = THREE.SRGBColorSpace;
        mat.map = textures.skin3;
      } else if (skinId === 'skin4' && textures.skin4) {
        textures.skin4.flipY = false;
        textures.skin4.colorSpace = THREE.SRGBColorSpace;
        mat.map = textures.skin4;
      } else if (skinId === 'skin_epic') {
        mat.color.set('#ffd700');
        mat.metalness = 0.8;
        mat.roughness = 0.1;
      } else if (skinId === 'skin_pattern') {
        mat.color.set('#3a0ca3');
      } else if (skinId === 'skin_legendary') {
        mat.color.set('#ffffff');
      } else {
        textures.default.flipY = false;
        textures.default.colorSpace = THREE.SRGBColorSpace;
        mat.map = textures.default;
      }

      mat.needsUpdate = true;
      node.material = mat;
    }
  });
}

/**
 * Apply rainbow effect for legendary skin. Call from useFrame.
 */
export function updateLegendaryRainbow(clone: THREE.Group, elapsedTime: number, offset = 0): void {
  const hue = (elapsedTime * 0.5 + offset) % 1;
  const rainbowColor = new THREE.Color().setHSL(hue, 0.8, 0.5);
  clone.traverse((node) => {
    if (node instanceof THREE.Mesh) {
      (node.material as THREE.MeshStandardMaterial).color.copy(rainbowColor);
    }
  });
}

/**
 * Find the leg nodes by their actual GLB names.
 * The model has: Leg_S (left/sinistro), body, Leg_R (right/destro).
 */
export function findLegNodes(clone: THREE.Group): {
  legL: THREE.Object3D | null;
  legR: THREE.Object3D | null;
  body: THREE.Object3D | null;
} {
  let legL: THREE.Object3D | null = null;
  let legR: THREE.Object3D | null = null;
  let body: THREE.Object3D | null = null;

  clone.traverse((node) => {
    if (node.name === 'Leg_S') legL = node;
    if (node.name === 'Leg_R') legR = node;
    if (node.name === 'Monitor' || node.name === 'body') body = node;
  });

  return { legL, legR, body };
}
