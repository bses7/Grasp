/**
 * One shared Raycaster on the interactable layer, doc 05 sections 2 and 3.1 (M6).
 * Raycast at most once per frame; budget 1 ms (doc 05 section 10).
 */
import type { Camera, Intersection, Object3D } from "three";
import type { Ndc } from "./coords";

/** Three.js layer index reserved for interactable meshes and hotspot markers. */
export const INTERACTABLE_LAYER = 1;

export type InteractableHit = {
  /** Set when the first hit's ancestor carries userData.componentId. */
  componentId: string | null;
  /** Set when the first hit's ancestor carries userData.hotspotId. */
  hotspotId: string | null;
  /** True when the manifest marks the component grabbable; feeds hover_result. */
  isGrabbable: boolean;
  intersection: Intersection | null;
};

export type InteractableRaycaster = {
  /** Returns the first hit with a componentId or hotspotId ancestor, else nulls. */
  hit(ndc: Ndc, camera: Camera, interactables: Object3D[]): InteractableHit;
};

export function createInteractableRaycaster(): InteractableRaycaster {
  throw new Error("TODO Phase D: createInteractableRaycaster (doc 05, M6)");
}
