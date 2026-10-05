/**
 * Coordinate chain, doc 05 section 2 (M6).
 * cursor (mirrored, normalized video coords) → cover-fit onto canvas → clamp → NDC.
 * Mirroring (u = 1 - x) is done by the CV layer; this file assumes an already
 * mirrored cursor. See doc 05 open question 2.
 */
import type { InteractionEvent } from "@grasp/types";

/** The cursor shape carried by cursor/hover/grab_* interaction events. */
export type Cursor = Extract<InteractionEvent, { cursor: unknown }>["cursor"];

export type Ndc = { x: number; y: number };

/**
 * Geometry needed to map a camera-frame cursor onto the 3D canvas.
 * The video is scaled to cover the canvas (like `object-fit: cover`) and the
 * excess is cropped so motion stays isotropic and every canvas pixel is reachable.
 */
export type Viewport = {
  /** Video frame aspect, width / height (16/9 for the 640x360 CV frame). */
  videoAspect: number;
  /** Canvas aspect, width / height. */
  canvasAspect: number;
  /** True when the preview is drawn with scaleX(-1) and the cursor is already mirrored. */
  mirrored: boolean;
  /** Central-region magnification; 1.0 means the whole frame maps to the canvas. */
  reachScale: number;
};

/** Cover-fit the cursor onto the canvas and clamp to 0..1. */
export function coverFit(_cursor: Cursor, _viewport: Viewport): { u: number; v: number } {
  throw new Error("TODO Phase D: coverFit (doc 05, M6)");
}

/** Full chain: cover-fit, clamp, then ndc.x = 2u - 1, ndc.y = 1 - 2v. */
export function landmarkToNdc(_cursor: Cursor, _viewport: Viewport): Ndc {
  throw new Error("TODO Phase D: landmarkToNdc (doc 05, M6)");
}
