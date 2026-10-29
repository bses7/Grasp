"use client";

/**
 * Hand-state chip, top right (doc 11 "Hand-state HUD"): mirrors the worker's gesture FSM one-to-one, plus the
 * HUD-derived ORBIT. While cv_status is low_confidence the glyph dims to 50% and the chip turns warn-tracking;
 * the HUD applies no threshold of its own (doc 04 owns the presence floor).
 */
import type { CvStatus as CvStatusMessage } from "@grasp/types";

export type HandState = "NO_HAND" | "IDLE" | "HOVER" | "GRABBING" | "DRAGGING" | "ORBIT" | "LOST";

const VIEW: Record<HandState, { glyph: string; text: string }> = {
  NO_HAND: { glyph: "", text: "Looking for your hand" },
  IDLE: { glyph: "✋", text: "Hand seen" },
  HOVER: { glyph: "☝", text: "Pointing" },
  GRABBING: { glyph: "🤏", text: "Pinching" },
  DRAGGING: { glyph: "🤏", text: "Moving" },
  ORBIT: { glyph: "🤏", text: "Turning the model" },
  LOST: { glyph: "⚠", text: "Lost your hand" },
};

export function CvStatus({ state, cv }: { state: HandState; cv: CvStatusMessage | null }) {
  const warn = state === "LOST" || cv?.state === "low_confidence";
  const v = VIEW[state];
  return (
    <div
      role="status"
      // Surface pill; the ring carries the state with the glyph and text (amber-ink, never warn, as text).
      className={`flex items-center gap-2 rounded-full border-2 bg-surface px-3 py-1 text-sm font-semibold ${
        warn ? "border-warn-tracking text-amber-ink" : state === "NO_HAND" ? "border-dashed border-text-muted text-text-muted" : "border-success text-text"
      }`}
    >
      <span aria-hidden className={`text-lg leading-none ${cv?.state === "low_confidence" ? "opacity-50" : ""}`}>
        {v.glyph || "◌"}
      </span>
      {cv?.state === "low_confidence" && state !== "LOST" ? "Hard to see your hand" : v.text}
    </div>
  );
}
