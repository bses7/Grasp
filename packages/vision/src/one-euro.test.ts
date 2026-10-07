import { describe, expect, it } from "vitest";
import { VISION_CONSTANTS } from "./constants";
import { JitterMeter } from "./jitter";
import { handSize, Landmark, pinchDist, palmCenter, type Point3 } from "./landmarks";
import { LandmarkSmoother, OneEuroFilter } from "./one-euro";

const FRAME_MS = 1000 / 30;
const rms = (xs: number[]) => Math.sqrt(xs.reduce((s, x) => s + x * x, 0) / xs.length);

describe("OneEuroFilter", () => {
  it("passes the first sample through and ignores repeated timestamps", () => {
    const f = new OneEuroFilter();
    expect(f.filter(0.5, 0)).toBe(0.5);
    expect(f.filter(0.9, 0)).toBe(0.5);
  });

  it("suppresses jitter at rest", () => {
    const f = new OneEuroFilter(VISION_CONSTANTS.ONE_EURO_CURSOR);
    const out: number[] = [];
    for (let i = 0; i < 90; i++) out.push(f.filter(0.5 + (i % 2 ? 0.004 : -0.004), i * FRAME_MS) - 0.5);
    // raw RMS is 0.004; after settling the filtered signal must be several times quieter
    expect(rms(out.slice(30))).toBeLessThan(0.0015);
  });

  it("follows a fast move without trailing", () => {
    const f = new OneEuroFilter(VISION_CONSTANTS.ONE_EURO_CURSOR);
    let y = 0;
    // sweep 0 -> 1 in one second, then hold
    for (let i = 0; i <= 30; i++) y = f.filter(i / 30, i * FRAME_MS);
    expect(1 - y).toBeLessThan(0.1); // at most 10% of the sweep behind at the end of the move
    for (let i = 31; i <= 45; i++) y = f.filter(1, i * FRAME_MS);
    expect(y).toBeLessThanOrEqual(1); // no overshoot
    expect(1 - y).toBeLessThan(0.01);
  });

  it("forgets history on reset", () => {
    const f = new OneEuroFilter();
    f.filter(0, 0);
    f.reset();
    expect(f.filter(1, 10)).toBe(1);
  });
});

describe("LandmarkSmoother", () => {
  it("keeps extra fields and smooths every coordinate", () => {
    const s = new LandmarkSmoother();
    const hand = Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.5, z: 0, visibility: 1 }));
    s.filter(hand, 0);
    const out = s.filter(hand.map((p) => ({ ...p, x: 0.6 })), FRAME_MS);
    expect(out).toHaveLength(21);
    expect(out[0]!.visibility).toBe(1);
    expect(out[0]!.x).toBeGreaterThan(0.5);
    expect(out[0]!.x).toBeLessThan(0.6);
  });
});

describe("features", () => {
  const hand: Point3[] = Array.from({ length: 21 }, () => ({ x: 0, y: 0, z: 0 }));
  hand[Landmark.MIDDLE_MCP] = { x: 0, y: 0.2, z: 0 };
  hand[Landmark.THUMB_TIP] = { x: 0.03, y: 0.3, z: 0 };
  hand[Landmark.INDEX_TIP] = { x: 0.07, y: 0.3, z: 0 };

  it("normalizes pinch distance by hand size", () => {
    expect(handSize(hand)).toBeCloseTo(0.2);
    expect(pinchDist(hand)).toBeCloseTo(0.2); // 0.04 / 0.2
  });

  it("averages the wrist and four MCPs for the palm centre", () => {
    expect(palmCenter(hand).y).toBeCloseTo(0.04);
  });
});

describe("JitterMeter", () => {
  it("reports RMS deviation at rest and nothing while moving", () => {
    const still = new JitterMeter();
    let j: number | null = null;
    for (let i = 0; i < 40; i++) j = still.push(0.5 + (i % 2 ? 0.003 : -0.003), 0.5, i * FRAME_MS);
    expect(j).toBeCloseTo(0.003, 4);

    const moving = new JitterMeter();
    for (let i = 0; i < 40; i++) j = moving.push(i * 0.01, 0.5, i * FRAME_MS);
    expect(j).toBeNull();
  });
});

describe("FeatureExtractor cursor", () => {
  /** Open hand with thumb and index tips 0.1 apart; `indexCurled` folds the index tip back toward the wrist. */
  function handWith(indexCurled: boolean) {
    const l: Point3[] = Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.8, z: 0 }));
    l[Landmark.MIDDLE_MCP] = { x: 0.5, y: 0.6, z: 0 };
    l[Landmark.INDEX_PIP] = { x: 0.45, y: 0.5, z: 0 };
    l[Landmark.INDEX_TIP] = indexCurled ? { x: 0.45, y: 0.55, z: 0 } : { x: 0.45, y: 0.4, z: 0 };
    l[Landmark.THUMB_TIP] = indexCurled ? { x: 0.4, y: 0.55, z: 0 } : { x: 0.35, y: 0.45, z: 0 };
    return l;
  }

  it("does not jump to the palm when the index curls as a pinch closes", async () => {
    const { FeatureExtractor } = await import("./features");
    const { pinchMidpoint } = await import("./landmarks");
    const open = handWith(false);
    const curling = handWith(true);
    // The old rule moved the cursor from the index tip to the palm centre (y ≈ 0.8) here.
    for (const l of [open, curling]) {
      const fx = new FeatureExtractor();
      const { features } = fx.extract(l, 1, 0);
      const mid = pinchMidpoint(l);
      expect(features.cursor.x).toBeCloseTo(1 - mid.x); // mirrored
      expect(features.cursor.y).toBeCloseTo(mid.y);
    }
    const fx = new FeatureExtractor();
    expect(fx.extract(open, 1, 0).features.extended.index).toBe(true);
    expect(new FeatureExtractor().extract(curling, 1, 0).features.extended.index).toBe(false);
  });
});
