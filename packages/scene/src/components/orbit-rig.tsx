/**
 * Whole-model orbit rig (doc 05 section 3.3; Phase 4, after the prototype).
 * About 40 lines of azimuth/elevation/distance around the model centre, driven
 * by grab_start with no hit, mouse drag on empty space, or arrows with nothing
 * grabbed. Preferred over feeding synthetic pointer events to Drei OrbitControls,
 * which fights real pointer input in the mouse condition.
 * Dolly (distance) is disabled when studyParity is set.
 */
import type { SceneState } from "@grasp/types";

export type OrbitPose = SceneState["camera"];

export type OrbitRigProps = {
  initial: OrbitPose;
  /** Model centre the camera looks at and orbits around. */
  target: [number, number, number];
  enabled: boolean;
  allowDolly: boolean;
  onPoseChange?: (pose: OrbitPose) => void;
};

export function OrbitRig(_props: OrbitRigProps) {
  throw new Error("TODO Phase D: OrbitRig (doc 05, Phase 4)");
}
