/**
 * Keyboard map, doc 05 section 7. LessonScene implements the M5 subset (Tab, Space/Enter, arrows)
 * by synthesizing the same InteractionEvents the mouse and gesture paths send, so the scene has one
 * code path. The mouse itself is `createMouseAdapter` in @grasp/vision. Remaining keys arrive with
 * their features (reset M8, dolly and explode Phase 4, rotate V1).
 */

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
