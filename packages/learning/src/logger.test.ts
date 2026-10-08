import type { LogEvent } from "@grasp/types";
import { describe, expect, it } from "vitest";
import { LogBuffer } from "./log-buffer";
import { falseStartRate, SessionLogger } from "./logger";

const T0 = 1000;

describe("SessionLogger", () => {
  it("stamps session, condition, a monotonic seq and ms since session start", () => {
    const log = new SessionLogger("s-1", "gesture", T0);
    log.log("task_start", { taskId: "t_p1" }, T0 + 12.4);
    const e = log.log("hand_count", { n: 1 }, T0 + 50);
    expect(log.events[0]).toMatchObject({ sessionId: "s-1", condition: "gesture", seq: 0, t: 12 });
    expect(e).toMatchObject({ seq: 1, t: 50 });
  });

  it("summarises a drag once, on grab_end, with path length, z-hint and time to first move", () => {
    const log = new SessionLogger("s", "gesture", 0);
    log.grabStart("aorta", { x: 0.1, y: 0.5 }, 100);
    log.grabMove({ x: 0.4, y: 0.5 }, 0.05, 150);
    log.grabMove({ x: 0.4, y: 0.9 }, -0.05, 200);
    log.grabEnd("release", 400);
    expect(log.events.map((e) => e.type)).toEqual(["grab_start", "grab_end", "grab_move_summary"]);
    expect(log.events[2]!.payload).toEqual({
      componentId: "aorta",
      durationMs: 300,
      pathLengthNorm: 0.7,
      zHintAbsSum: 0.1,
      firstMoveMs: 50,
    });
  });

  it("logs tracking_regained with how long tracking was lost", () => {
    const log = new SessionLogger("s", "gesture", 0);
    log.trackingLost(1000);
    log.trackingRegained(1650);
    expect(log.events[1]!.payload).toEqual({ durationMs: 650 });
  });

  it("never puts an array or object in a payload", () => {
    const log = new SessionLogger("s", "mouse", 0);
    log.grabStart(null, { x: 0, y: 0 }, 0);
    log.grabMove({ x: 1, y: 1 }, 0, 10);
    log.grabEnd("lost", 20);
    for (const e of log.events) for (const v of Object.values(e.payload)) expect(v === null || typeof v !== "object").toBe(true);
  });
});

describe("falseStartRate", () => {
  it("counts only drags that never moved; a late first move is still a deliberate drag", () => {
    const log = new SessionLogger("s", "gesture", 0);
    log.grabStart("aorta", { x: 0, y: 0 }, 0);
    log.grabMove({ x: 0.1, y: 0 }, 0, 100); // moved at 100 ms: a real drag
    log.grabEnd("release", 500);
    log.grabStart(null, { x: 0, y: 0 }, 1000);
    log.grabEnd("release", 1100); // never moved: false start
    log.grabStart("aorta", { x: 0, y: 0 }, 2000);
    log.grabMove({ x: 0.1, y: 0 }, 0, 2400); // first move at 400 ms after a pause: a real drag
    log.grabEnd("release", 2600);
    expect(falseStartRate(log.events)).toEqual({ grabs: 3, falseStarts: 1, rate: 1 / 3 });
  });

  it("leaves a grab ended by tracking loss out of both counts (failure state 5, not a misread pinch)", () => {
    const log = new SessionLogger("s", "gesture", 0);
    log.grabStart("aorta", { x: 0, y: 0 }, 0);
    log.trackingLost(600);
    log.grabEnd("lost", 1600); // camera covered before the hand moved
    log.grabStart("aorta", { x: 0, y: 0 }, 2000);
    log.grabEnd("release", 2100); // a real false start
    expect(falseStartRate(log.events)).toEqual({ grabs: 1, falseStarts: 1, rate: 1 });
  });

  it("leaves a grab still open at the end of the log out of both counts", () => {
    const log = new SessionLogger("s", "gesture", 0);
    log.grabStart("aorta", { x: 0, y: 0 }, 0);
    log.grabMove({ x: 0.1, y: 0 }, 0, 50);
    log.grabEnd("release", 200);
    log.grabStart("aorta", { x: 0, y: 0 }, 1000); // tab closed mid-drag: no grab_end, no summary
    expect(falseStartRate(log.events)).toEqual({ grabs: 1, falseStarts: 0, rate: 0 });
  });
});

describe("LogBuffer", () => {
  const event = (seq: number): LogEvent => ({ sessionId: "s", condition: "mouse", seq, t: seq, type: "hand_count", payload: { n: 1 } });

  it("drops everything without consent and flushes batches to the transport", async () => {
    let consent = false;
    const sent: LogEvent[][] = [];
    const buf = new LogBuffer(async (b) => void sent.push(b), () => consent);
    buf.push(event(0));
    expect(buf.size).toBe(0);
    consent = true;
    buf.push(event(1));
    buf.push(event(2));
    await buf.flush();
    expect(sent).toEqual([[event(1), event(2)]]);
    expect(buf.size).toBe(0);
  });

  it("keeps the batch when the transport fails", async () => {
    const buf = new LogBuffer(async () => Promise.reject(new Error("offline")), () => true);
    buf.push(event(0));
    await expect(buf.flush()).rejects.toThrow("offline");
    expect(buf.size).toBe(1);
  });
});
