/**
 * One shared Raycaster on the interactable layer, doc 05 sections 2 and 3.1 (M5 grab, M6 hover).
 * Raycast at most once per frame; budget 1 ms (doc 05 section 10).
 */
import { Raycaster, Vector2, type Camera, type Intersection, type Object3D } from "three";
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
  const raycaster = new Raycaster();
  raycaster.layers.set(INTERACTABLE_LAYER);
  const ndcVec = new Vector2();
  const none: InteractableHit = { componentId: null, hotspotId: null, isGrabbable: false, intersection: null };

  return {
    hit(ndc, camera, interactables) {
      raycaster.setFromCamera(ndcVec.set(ndc.x, ndc.y), camera);
      for (const intersection of raycaster.intersectObjects(interactables, true)) {
        for (let o: Object3D | null = intersection.object; o; o = o.parent) {
          const { componentId, hotspotId, grabbable } = o.userData as {
            componentId?: string;
            hotspotId?: string;
            grabbable?: boolean;
          };
          if (componentId) return { componentId, hotspotId: null, isGrabbable: !!grabbable, intersection };
          if (hotspotId) return { componentId: null, hotspotId, isGrabbable: false, intersection };
        }
      }
      return none;
    },
  };
}
