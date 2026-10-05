import { describe, it, expect } from "vitest";
import type { SceneEvent } from "@grasp/types";
import { countsAsAttempt } from "./counts-as-attempt.js";

describe("countsAsAttempt", () => {
  it("never counts a drop caused by tracking loss", () => {
    const event = { type: "drop", componentId: "aorta", cause: "lost" } as SceneEvent;
    expect(countsAsAttempt(event)).toBe(false);
  });

  it("counts a drop caused by a deliberate release", () => {
    const event = { type: "drop", componentId: "aorta", cause: "release" } as SceneEvent;
    expect(countsAsAttempt(event)).toBe(true);
  });

  it("counts a place", () => {
    const event = { type: "place", componentId: "aorta", socketId: "socket_aorta" } as SceneEvent;
    expect(countsAsAttempt(event)).toBe(true);
  });
});
