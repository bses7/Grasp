import type { CvStatus } from "@grasp/types";
import { describe, expect, it } from "vitest";
import { CvStatusTracker, type CvStatusInput } from "./cv-status";

const FRAME_MS = 1000 / 30;
const okHand: CvStatusInput = { handCount: 1, primaryBoxFrac: 0.2, presence: 0.9, luminance: 120, fsmState: "IDLE" };

/** Feed `input` for `ms` starting at `from`; returns emitted statuses. */
function run(tr: CvStatusTracker, input: CvStatusInput, from: number, ms: number): CvStatus[] {
  const out: CvStatus[] = [];
  for (let t = from; t < from + ms; t += FRAME_MS) {
    const s = tr.update(input, t);
    if (s) out.push(s);
  }
  return out;
}

describe("CvStatusTracker", () => {
  it("reports ok immediately and no_hand only after 500 ms", () => {
    const tr = new CvStatusTracker();
    expect(run(tr, okHand, 0, 1000).map((s) => s.state)).toEqual(["ok"]);
    const gone = run(tr, { ...okHand, handCount: 0, primaryBoxFrac: null, presence: 0 }, 1000, 1000);
    expect(gone).toHaveLength(1);
    expect(gone[0]!.state).toBe("no_hand");
  });

  it("needs 1 s of a small hand box for hand_too_far, with the move_closer hint", () => {
    const tr = new CvStatusTracker();
    run(tr, okHand, 0, 500);
    const far = run(tr, { ...okHand, primaryBoxFrac: 0.05 }, 500, 1500);
    expect(far).toHaveLength(1);
    expect(far[0]).toMatchObject({ state: "hand_too_far", hint: "move_closer" });
  });

  it("reports tracking_lost as soon as the FSM is LOST", () => {
    const tr = new CvStatusTracker();
    run(tr, okHand, 0, 500);
    const lost = run(tr, { ...okHand, handCount: 0, primaryBoxFrac: null, presence: 0, fsmState: "LOST" }, 500, 300);
    expect(lost[0]!.state).toBe("tracking_lost");
  });

  it("flags a flickering hand in a dark frame as low_confidence", () => {
    const tr = new CvStatusTracker();
    const out: CvStatus[] = [];
    for (let i = 0; i < 60; i++) {
      const present = i % 6 < 3;
      const s = tr.update(
        { ...okHand, handCount: present ? 1 : 0, presence: present ? 0.65 : 0, luminance: 20 },
        i * FRAME_MS,
      );
      if (s) out.push(s);
    }
    expect(out.at(-1)).toMatchObject({ state: "low_confidence", hint: "face_the_light" });
  });

  it("adds show_one_hand after 3 s of two hands and rate-limits to 250 ms", () => {
    const tr = new CvStatusTracker();
    const out = run(tr, { ...okHand, handCount: 2 }, 0, 3500);
    expect(out.map((s) => s.hint)).toEqual([undefined, "show_one_hand"]);
    // a change inside 250 ms of the last emission is held back until the interval passes
    expect(tr.update({ ...okHand, fsmState: "LOST" }, 3600)?.state).toBe("tracking_lost");
    expect(tr.update(okHand, 3700)).toBeNull();
    expect(tr.update(okHand, 3900)?.state).toBe("ok");
  });
});
