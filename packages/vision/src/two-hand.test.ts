import { describe, expect, it } from "vitest";
import type { GestureFeatures } from "./gesture-fsm";
import { TwoHandGesture } from "./two-hand";

const pinch = (x: number, y = 0.5, pinchDist = 0.1) => ({ pinchDist, cursor: { x, y } }) as GestureFeatures;
const run = (g: TwoHandGesture, frames: [number, number, number?][], overModel: boolean) =>
  frames.flatMap(([ax, bx, by], i) => g.step(pinch(ax), pinch(bx, by ?? 0.5), overModel, i) ?? []);

describe("TwoHandGesture", () => {
  it("zooms over the model: hands apart brings the camera closer", () => {
    const ev = run(new TwoHandGesture(), [[0.4, 0.6], [0.4, 0.6], [0.3, 0.7]], true);
    expect(ev).toMatchObject([{ type: "model_zoom", t: 2 }]);
    expect(ev[0]!.type === "model_zoom" && ev[0]!.factor).toBeCloseTo(0.5);
  });

  it("spreads the parts on empty space in proportion to the separation, and closes them again", () => {
    const ev = run(new TwoHandGesture(), [[0.4, 0.6], [0.4, 0.6], [0.35, 0.65], [0.3, 0.7], [0.4, 0.6]], false);
    const deltas = ev.map((e) => (e.type === "model_explode" ? e.delta : NaN));
    expect(deltas.map((x) => Math.round(x * 100) / 100)).toEqual([0.5, 0.5, -1]); // 0.2 -> 0.4 apart is +1
  });

  it("rolls when the hands twist, in both modes", () => {
    const ev = run(new TwoHandGesture(), [[0.4, 0.6], [0.4, 0.6], [0.4, 0.6, 0.6]], true);
    expect(ev[0]).toMatchObject({ type: "model_turn", dx: 0, dy: 0 });
    expect(ev[0]!.type === "model_turn" && ev[0]!.roll).toBeGreaterThan(0);
  });

  it("is not a two-hand gesture unless both hands pinch", () => {
    const g = new TwoHandGesture();
    expect(g.step(pinch(0.4), pinch(0.6, 0.5, 0.9), true, 0)).toBeNull();
    expect(g.step(pinch(0.4), null, true, 1)).toBeNull();
    expect(g.active).toBe(false);
  });
});
