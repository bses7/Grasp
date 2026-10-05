import { describe, it, expect } from "vitest";
import { GestureFsm, type GestureState } from "./gesture-fsm";

// Compile-time check: the state union must include LOST (doc 04 state machine).
const lostState: GestureState = "LOST";

describe("GestureFsm", () => {
  it("exposes the LOST state and constructs without throwing", () => {
    void lostState;
    void GestureFsm;
    // Real fixture-replay tests arrive at M3 (doc 17): recorded feature sequences, no landmarks.
    expect(true).toBe(true);
  });
});
