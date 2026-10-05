import { describe, expect, it } from "vitest";
import type { Viewport } from "./coords";

describe("coords scaffold", () => {
  it("Viewport is constructible", () => {
    const viewport: Viewport = {
      videoAspect: 16 / 9,
      canvasAspect: 4 / 3,
      mirrored: true,
      reachScale: 1.0,
    };
    expect(viewport.mirrored).toBe(true);
    expect(true).toBe(true);
  });
});
