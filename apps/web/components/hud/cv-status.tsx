"use client";

/**
 * Tracking status chip: "Looking for hand", "Hand seen", "Lost your hand",
 * low-confidence dimming (docs/11 HUD, cv_status channel from docs/04).
 * Reads sceneStore.tracking; never applies its own confidence threshold.
 * TODO Phase D M3 (HUD glyph) and doc 13 Phase 4 (failure states 1, 2, 5).
 */
export function CvStatus() {
  return <div data-todo="hud/cv-status: Phase D M3" />;
}
