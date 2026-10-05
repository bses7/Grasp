/**
 * SceneState snapshot and diff, doc 05 sections 4 and 9 (M7, M10).
 * SceneState is the only scene information that leaves the browser (to the
 * tutor route) and what the research logger samples at 1 Hz. Positions are
 * rounded to 0.1 scene units; no pixels, no landmarks.
 */
import type { SceneState } from "@grasp/types";
import type { Camera, Object3D } from "three";
import type { SocketOccupancy } from "./sockets";

export type SnapshotInput = {
  modelId: string;
  camera: Camera;
  components: ReadonlyMap<string, Object3D>;
  occupancy: SocketOccupancy;
  hovered: string | null;
  grabbed: string | null;
  lastEvent: SceneState["lastEvent"];
};

/** Build a compact, JSON-serialisable snapshot from live scene refs. */
export function snapshotSceneState(_input: SnapshotInput): SceneState {
  throw new Error("TODO Phase D: snapshotSceneState (doc 05, M7)");
}

/** Keys of SceneState that changed between two snapshots; empty when equal. */
export type SceneStateDiff = {
  changed: (keyof SceneState)[];
  components: string[];
};

/** Cheap diff so the store updates only on discrete events, never per frame. */
export function diffSceneState(_a: SceneState, _b: SceneState): SceneStateDiff {
  throw new Error("TODO Phase D: diffSceneState (doc 05, M7)");
}
