"use client";

/**
 * DOM cursor ring (28 px hollow in IDLE, 20 px with dot in HOVER, filled disc
 * while DRAGGING, dwell ring 36 px over 600 ms; docs/11 cursor states).
 * Position is written per frame to a ref from a transient sceneStore
 * subscription, never through React state (locked position 6).
 * TODO Phase D M2 (One-Euro and cursor).
 */
export function CursorOverlay() {
  return <div data-todo="hud/cursor-overlay: Phase D M2" aria-hidden="true" />;
}
