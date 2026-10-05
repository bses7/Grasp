/**
 * Mouse input source for the research control condition and the accessibility fallback.
 * Emits the identical `InteractionEvent` stream as the gesture path so `packages/scene`
 * and `packages/learning` never branch on condition (locked position 8; doc 17 M5).
 * Mapping: pointerdown = grab_start, pointermove while down = grab_move (zHintDelta 0),
 * pointerup = grab_end { reason: "release" }, pointermove while up = cursor.
 * Never emits tracking_lost, tracking_regained, or cv_status.
 */

import type { InteractionEvent } from "@grasp/types";

export type MouseAdapterHandle = {
  /** Remove listeners. */
  dispose(): void;
};

/**
 * Attach pointer listeners to the render canvas and translate them to interaction events.
 * Cursor coordinates are normalized 0..1 over the canvas, matching the gesture cursor;
 * the coordinate chain in packages/scene treats both identically.
 */
export function createMouseAdapter(
  canvas: HTMLCanvasElement,
  onEvent: (event: InteractionEvent) => void,
): MouseAdapterHandle {
  void canvas;
  void onEvent;
  throw new Error("TODO Phase D: createMouseAdapter (doc 04, M5)");
}
