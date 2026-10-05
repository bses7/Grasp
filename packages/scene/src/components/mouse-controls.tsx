/**
 * Mouse and keyboard equivalents, doc 05 section 7 (M5).
 * Both input modes produce the same InteractionEvent stream through the
 * InputSource adapter in apps/web; the scene has one code path. This file owns
 * the key map and the in-canvas focus handling (Tab order follows
 * manifest.components; announcements go through the HUD live region).
 */
import type { InteractionEvent } from "@grasp/types";

/** Keyboard bindings. Values are KeyboardEvent.key or "wheel". */
export const KEY_MAP = {
  cancelGrab: ["Escape"], // settle in place → drop with cause "release"
  select: ["Enter"], // on focused component or hotspot
  grabToggle: [" ", "Enter"], // Space grabs; Space or Enter again releases
  focusNext: ["Tab"],
  focusPrev: ["Shift+Tab"],
  moveLeft: ["ArrowLeft"],
  moveRight: ["ArrowRight"],
  moveUp: ["ArrowUp"],
  moveDown: ["ArrowDown"],
  zHintForward: ["PageUp"],
  zHintBack: ["PageDown"],
  stepMultiplier: ["Shift"], // ×4 on arrows and PageUp/PageDown
  dollyIn: ["+", "="],
  dollyOut: ["-"],
  dollyWheel: ["wheel"], // disabled under studyParity
  reset: ["r", "R"],
  explode: ["x", "X"],
  rotateComponentLeft: ["q", "Q"], // V1 with wrist_rotate
  rotateComponentRight: ["e", "E"], // V1 with wrist_rotate
} as const;

export type KeyAction = keyof typeof KEY_MAP;

export type MouseControlsProps = {
  /** Ordered ids for Tab focus; from manifest.components then hotspots. */
  focusOrder: readonly string[];
  enabled: boolean;
  allowDolly: boolean;
  /** Emits the identical events the gesture path emits. */
  onInteractionEvent: (event: InteractionEvent) => void;
};

export function MouseControls(_props: MouseControlsProps) {
  throw new Error("TODO Phase D: MouseControls (doc 05, M5)");
}
