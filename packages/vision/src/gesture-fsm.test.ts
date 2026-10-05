import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { InteractionEvent } from "@grasp/types";
import { describe, expect, it } from "vitest";
import { GestureFsm, type GestureFeatures } from "./gesture-fsm";

const FRAME_MS = 1000 / 30;

/** An open hand (or pinching one, by pinchDist) at `cursor`. */
function hand(pinchDist: number, cursor = { x: 0.5, y: 0.5 }): GestureFeatures {
  return {
    handSize: 0.2,
    pinchDist,
    extended: { index: true, middle: true, ring: true, pinky: true },
    extendedCount: 4,
    thumbExtended: true,
    cursor,
    palmCenter: { x: 0.5, y: 0.5, z: 0 },
    presence: 0.9,
  };
}

type Frame = GestureFeatures | null;

/** Replays frames at 30 fps, answering every frame with the given hover result (M3 stub: grabbable). */
function replay(frames: Frame[], opts: { fsm?: GestureFsm; grabbable?: (i: number) => boolean | null } = {}) {
  const fsm = opts.fsm ?? new GestureFsm();
  const events: InteractionEvent[] = [];
  frames.forEach((f, i) => {
    const t = i * FRAME_MS;
    const g = opts.grabbable ? opts.grabbable(i) : true;
    if (g !== null) fsm.onHoverResult({ type: "hover_result", hoveredId: g ? "aorta" : "septum", isGrabbable: g, t });
    events.push(...fsm.step(f, t));
  });
  return { fsm, events, types: events.map((e) => e.type).filter((x) => x !== "cursor") };
}

const repeat = <T,>(n: number, f: T): T[] => Array.from({ length: n }, () => f);
const open = (n: number) => repeat(n, hand(1.0));
const pinched = (n: number, d = 0.15) => repeat(n, hand(d));

describe("GestureFsm", () => {
  it("needs 3 frames of hand before leaving NO_HAND, then emits neutral cursor events", () => {
    const { fsm, events } = replay(open(4));
    expect(events.map((e) => e.type)).toEqual(["cursor", "cursor"]);
    expect(fsm.state).toBe("IDLE");
  });

  it("debounces pinch: one frame below the enter threshold does not grab", () => {
    const { types } = replay([...open(5), hand(0.2), ...open(5)]);
    expect(types).toEqual([]);
  });

  it("grabs after 2 pinch frames and releases only after 2 frames above the exit threshold", () => {
    // 0.30 and 0.38 sit between enter (0.25) and exit (0.40): hysteresis keeps the grab
    const { types, fsm } = replay([...open(5), ...pinched(3), hand(0.3), hand(0.38), hand(0.45), hand(0.3), hand(0.45), hand(0.5)]);
    expect(types).toEqual(["grab_start", "grab_end"]);
    expect(fsm.state).toBe("IDLE");
  });

  it("does not flicker: noise across the enter threshold never grabs, noise below exit never releases", () => {
    const aroundEnter = Array.from({ length: 40 }, (_, i) => hand(i % 2 ? 0.24 : 0.27));
    expect(replay([...open(5), ...aroundEnter]).types).toEqual([]);

    const belowExit = Array.from({ length: 40 }, (_, i) => hand(i % 2 ? 0.2 : 0.39));
    expect(replay([...open(5), ...pinched(2), ...belowExit]).types).toEqual(["grab_start"]);
  });

  it("enters DRAGGING after the cursor moves 0.01 and emits grab_move with a dead-zoned zHint", () => {
    const moving = Array.from({ length: 5 }, (_, i) => hand(0.15, { x: 0.5 + i * 0.01, y: 0.5 }));
    const { types, events, fsm } = replay([...open(5), ...moving]);
    expect(types[0]).toBe("grab_start");
    expect(types.filter((t) => t === "grab_move").length).toBeGreaterThan(0);
    expect(fsm.state).toBe("DRAGGING");
    const move = events.find((e) => e.type === "grab_move");
    expect(move && "zHintDelta" in move && move.zHintDelta).toBe(0);
  });

  it("covering the camera mid-pinch: tracking_lost after 500 ms, grab_end lost after the 1 s grace", () => {
    const { types, events, fsm } = replay([...open(5), ...pinched(3), ...repeat(60, null)]);
    expect(types).toEqual(["grab_start", "tracking_lost", "grab_end"]);
    const lostAt = events.find((e) => e.type === "tracking_lost")!.t! - events.find((e) => e.type === "grab_start")!.t!;
    expect(lostAt).toBeGreaterThan(500);
    const end = events.find((e) => e.type === "grab_end");
    expect(end && "reason" in end && end.reason).toBe("lost");
    expect(fsm.state).toBe("NO_HAND");
  });

  it("regaining the hand within the grace period resumes the drag", () => {
    const { types, fsm } = replay([...open(5), ...pinched(3), ...repeat(20, null), ...pinched(3)]);
    expect(types).toEqual(["grab_start", "tracking_lost", "tracking_regained", "grab_move", "grab_move", "grab_move"]);
    expect(fsm.state).toBe("DRAGGING");
  });

  it("refuses a pinch over a non-grabbable component until the pinch is released", () => {
    // non-grabbable for the first 12 frames, grabbable after; the pinch is held throughout
    const frames = [...open(5), ...pinched(15), ...open(3), ...pinched(3)];
    const { types } = replay(frames, { grabbable: (i) => i >= 12 });
    expect(types).toEqual(["grab_start"]);
    expect(types).toHaveLength(1);
  });

  it("waits instead of grabbing when the main thread has not answered", () => {
    const { types } = replay([...open(5), ...pinched(5)], { grabbable: () => null });
    expect(types).toEqual([]);
  });
});

/**
 * Recorded fixtures (doc 17 M3): the developer's own feature sequences, saved from /prototype with
 * "Save features". Features only, never landmarks. Each file may carry an `expect` block.
 */
type Fixture = {
  note?: string;
  frames: { t: number; f: Omit<GestureFeatures, "palmCenter"> | null }[];
  expect?: { grabPairs?: number; tolerance?: number; lostRelease?: boolean };
};

const FIXTURES = join(import.meta.dirname, "..", "fixtures");
const files = (() => {
  try {
    return readdirSync(FIXTURES).filter((f) => f.endsWith(".json"));
  } catch {
    return [];
  }
})();

describe.runIf(files.length > 0)("GestureFsm recorded fixtures", () => {
  it.each(files)("%s replays with a valid event order", (file) => {
    const fx = JSON.parse(readFileSync(join(FIXTURES, file), "utf8")) as Fixture;
    const fsm = new GestureFsm();
    const events: InteractionEvent[] = [];
    for (const { t, f } of fx.frames) {
      fsm.onHoverResult({ type: "hover_result", hoveredId: null, isGrabbable: true, t });
      events.push(...fsm.step(f && { ...f, palmCenter: { x: 0, y: 0, z: 0 } }, t));
    }

    // Grabs never nest, every grab_end closes a grab, and lost is followed by regained or a lost release.
    let grabbing = false;
    let lost = false;
    for (const e of events) {
      if (e.type === "grab_start") (expect(grabbing).toBe(false), (grabbing = true));
      if (e.type === "grab_end") (expect(grabbing).toBe(true), (grabbing = false), (lost = false));
      if (e.type === "tracking_lost") (expect(grabbing).toBe(true), (lost = true));
      if (e.type === "tracking_regained") (expect(lost).toBe(true), (lost = false));
    }

    const ends = events.filter((e) => e.type === "grab_end");
    if (fx.expect?.grabPairs !== undefined) {
      const tol = fx.expect.tolerance ?? 0;
      expect(Math.abs(ends.length - fx.expect.grabPairs)).toBeLessThanOrEqual(tol);
    }
    if (fx.expect?.lostRelease) {
      expect(ends.some((e) => "reason" in e && e.reason === "lost")).toBe(true);
    }
  });
});
