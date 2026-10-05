/**
 * Engine → scene command interface, doc 05 section 4.
 * Commands carry no lesson logic; the engine decides when to issue them.
 * Every command calls invalidate() to wake the demand frameloop.
 */
import type { SceneCommand } from "@grasp/types";

/** Handle used by the engine (through apps/web) to drive a mounted LessonScene. */
export type SceneHandle = {
  apply(cmd: SceneCommand): void;
};

export function applySceneCommand(cmd: SceneCommand): void {
  switch (cmd.type) {
    case "setPose":
      // tween every component to manifest.poses[name] (M9)
      throw new Error("TODO Phase D: setPose (doc 05, M9)");
    case "highlight":
      // emissive pulse at 1 Hz for durationMs on the listed ids (M6)
      throw new Error("TODO Phase D: highlight (doc 05, M6)");
    case "cameraTo":
      // camera tween to frame a componentId or hotspotId (M9)
      throw new Error("TODO Phase D: cameraTo (doc 05, M9)");
    case "setSocketVisual":
      // ghost | ring | none for one socket: handled inside LessonScene's apply(), never reaches here
      throw new Error("setSocketVisual is applied by LessonScene");
    case "setVisible":
      // show only the listed component ids (M9)
      throw new Error("TODO Phase D: setVisible (doc 05, M9)");
    case "reset":
      // tween to the activity's initial snapshot over RESET_TWEEN_MS (M8)
      throw new Error("TODO Phase D: reset (doc 05, M8)");
    case "playAnimation":
      // V1: AnimationMixer clip named in manifest.animations
      throw new Error("TODO Phase D: playAnimation (doc 05, V1)");
    default: {
      const unreachable: never = cmd;
      throw new Error(`Unknown scene command: ${String(unreachable)}`);
    }
  }
}
