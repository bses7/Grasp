import { create } from "zustand";

/**
 * sceneStore (docs/03 "State management"): SceneState (hovered, grabbed,
 * socket occupancy, camera) and tracking status. Updated per event.
 *
 * Per-frame data (cursor position, grabbed pose) must NOT live in rendered
 * state: the budget is 30 fps combined MediaPipe + R3F (locked position 6).
 * Writers use `useSceneStore.setState` from the worker message handler and
 * readers that need per-frame values use a transient subscription:
 *
 *   useEffect(() => useSceneStore.subscribe(s => { ref.current = s.cursor }), [])
 *
 * The placeholder `SceneState` below is replaced by the type from
 * @grasp/types (r3f-interaction section 11) at Phase D M6.
 */
export type TrackingStatus = "no_hand" | "tracking" | "low_confidence" | "lost";

export type SceneState = {
  modelId: string | null;
  hoveredComponentId: string | null;
  grabbedComponentId: string | null;
  occupancy: Record<string, string | null>; // socketId -> componentId
  tracking: TrackingStatus;
  setTracking: (tracking: TrackingStatus) => void;
};

export const useSceneStore = create<SceneState>()((set) => ({
  modelId: null,
  hoveredComponentId: null,
  grabbedComponentId: null,
  occupancy: {},
  tracking: "no_hand",
  setTracking: (tracking) => set({ tracking }),
}));
