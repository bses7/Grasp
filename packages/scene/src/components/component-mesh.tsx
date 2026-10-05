/**
 * One interactable component mesh (M5 primitives, M9 GLB nodes).
 * Sets userData.componentId, joins INTERACTABLE_LAYER, swaps emissive on
 * hover and hint pulse. Per-frame pose lives on the Object3D ref, never in state.
 */
import type { ModelManifest } from "@grasp/types";

export type ComponentMeshProps = {
  component: ModelManifest["components"][number];
  /** GLB node name equals component.id (doc 05 section 8). */
  node?: unknown;
  hovered: boolean;
  pulsing: boolean;
  visible: boolean;
  highlightColor?: string;
};

export function ComponentMesh(_props: ComponentMeshProps) {
  throw new Error("TODO Phase D: ComponentMesh (doc 05, M5)");
}
