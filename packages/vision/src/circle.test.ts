import { describe, expect, it } from "vitest";
import { CircleDetector } from "./circle";

const FRAME_MS = 1000 / 30;
/** Cursor on a circle of radius r (frame heights) around the centre, `turns` turns over `ms`. */
function path(turns: number, ms: number, r = 0.1, dir = 1) {
  const n = Math.round(ms / FRAME_MS);
  return Array.from({ length: n }, (_, i) => {
    const a = (dir * 2 * Math.PI * turns * i) / n;
    return { x: 0.5 + (r * Math.cos(a)) / (16 / 9), y: 0.5 + r * Math.sin(a) };
  });
}
const run = (pts: { x: number; y: number }[], d = new CircleDetector()) => pts.map((p, i) => d.step(p, i * FRAME_MS)).filter(Boolean);

describe("CircleDetector", () => {
  it("fires once on two quick circles, with the direction", () => {
    expect(run(path(2.2, 2000))).toEqual([{ type: "spell_circle", clockwise: true, t: expect.any(Number) }]);
    expect(run(path(2.2, 2000, 0.1, -1))[0]).toMatchObject({ clockwise: false });
  });

  it("ignores one circle, a slow circle, a tiny circle and a straight line", () => {
    expect(run(path(1, 1500))).toEqual([]);
    expect(run(path(2.2, 6000))).toEqual([]);
    expect(run(path(2.2, 2000, 0.01))).toEqual([]);
    expect(run(Array.from({ length: 60 }, (_, i) => ({ x: 0.2 + i * 0.01, y: 0.5 })))).toEqual([]);
  });
});
