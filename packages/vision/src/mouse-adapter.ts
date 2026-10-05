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
  let down = false;
  const cursorOf = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)),
      y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)),
    };
  };

  const onDown = (e: PointerEvent) => {
    if (e.button !== 0 || down) return;
    down = true;
    canvas.setPointerCapture(e.pointerId); // keep receiving moves when the pointer leaves the canvas mid-drag
    onEvent({ type: "grab_start", cursor: cursorOf(e), t: e.timeStamp });
  };
  const onMove = (e: PointerEvent) => {
    onEvent(
      down
        ? { type: "grab_move", cursor: cursorOf(e), zHintDelta: 0, t: e.timeStamp }
        : { type: "cursor", cursor: cursorOf(e), t: e.timeStamp },
    );
  };
  const onUp = (e: PointerEvent) => {
    if (!down) return;
    down = false;
    onEvent({ type: "grab_end", cursor: cursorOf(e), reason: "release", t: e.timeStamp });
  };

  canvas.addEventListener("pointerdown", onDown);
  canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerup", onUp);
  canvas.addEventListener("pointercancel", onUp);
  return {
    dispose() {
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
    },
  };
}
