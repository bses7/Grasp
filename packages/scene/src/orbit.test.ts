import { describe, expect, it } from "vitest";
import { cameraPosition, dolly, lerpPose, orbitFrom, poseFacing } from "./orbit";

describe("orbit", () => {
  const front = { azimuth: 0, elevation: 0, distance: 30 };

  it("turns 90 degrees per half canvas width and clamps elevation", () => {
    expect(orbitFrom(front, { x: 0, y: 0 }, { x: 1, y: 0 }).azimuth).toBe(-90);
    expect(orbitFrom(front, { x: 0, y: 0 }, { x: 0, y: -2 }).elevation).toBe(80);
  });

  it("faces a point from outside, round-tripping through cameraPosition", () => {
    const p = poseFacing([10, 5, 0], 30);
    const [x, y, z] = cameraPosition(p);
    expect(x).toBeGreaterThan(0);
    expect(y).toBeGreaterThan(0);
    expect(Math.abs(z)).toBeLessThan(1e-9);
    expect(Math.hypot(x, y, z)).toBeCloseTo(30);
  });

  it("takes the short way round and clamps dolly", () => {
    expect(lerpPose({ ...front, azimuth: 170 }, { ...front, azimuth: -170 }, 0.5).azimuth).toBeCloseTo(180);
    expect(dolly(front, 100).distance).toBe(80);
  });
});
