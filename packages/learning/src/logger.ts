/**
 * Session event log in the research LogEvent shape (research-protocol section 4, doc 14 section 6.1, doc 17 M10).
 * Pure: the app feeds it interaction, scene and engine events; it never sees landmarks, frames or positions.
 * Every payload value is a scalar (LogPayloadValue), so no payload can carry a coordinate stream.
 */
import type { LogEvent, LogEventType, LogPayload, StudyCondition } from "@grasp/types";

/** grab_start without a grab_move within this many ms counts as a false start (doc 15 challenge 10). */
export const FALSE_START_MS = 300;

type Cursor = { x: number; y: number };

type OpenGrab = {
  componentId: string | null;
  t: number;
  last: Cursor;
  path: number;
  zAbs: number;
  firstMoveT: number | null;
};

export class SessionLogger {
  readonly events: LogEvent[] = [];
  private seq = 0;
  private grab: OpenGrab | null = null;
  private lostAt: number | null = null;

  /**
   * @param t0 the session start on the same clock as every `now` passed later (performance.now)
   * @param sink optional extra consumer per event (the network LogBuffer at Phase 4)
   */
  constructor(
    readonly sessionId: string,
    readonly condition: StudyCondition,
    private readonly t0: number,
    private readonly sink?: (e: LogEvent) => void,
  ) {}

  log(type: LogEventType, payload: LogPayload, now: number): LogEvent {
    const e: LogEvent = { sessionId: this.sessionId, condition: this.condition, seq: this.seq++, t: Math.round(now - this.t0), type, payload };
    this.events.push(e);
    this.sink?.(e);
    return e;
  }

  /** `componentId` is what the scene grabbed (null: empty space, i.e. orbit or a miss). */
  grabStart(componentId: string | null, cursor: Cursor, now: number): void {
    this.grab = { componentId, t: now, last: cursor, path: 0, zAbs: 0, firstMoveT: null };
    this.log("grab_start", { componentId }, now);
  }

  /** Accumulates per drag; logged once as grab_move_summary on grab_end, never per frame. */
  grabMove(cursor: Cursor, zHintDelta: number, now: number): void {
    const g = this.grab;
    if (!g) return;
    g.path += Math.hypot(cursor.x - g.last.x, cursor.y - g.last.y);
    g.zAbs += Math.abs(zHintDelta);
    g.last = cursor;
    g.firstMoveT ??= now;
  }

  grabEnd(reason: "release" | "lost", now: number): void {
    const g = this.grab;
    if (!g) return;
    this.grab = null;
    this.log("grab_end", { componentId: g.componentId, reason }, now);
    this.log(
      "grab_move_summary",
      {
        componentId: g.componentId,
        durationMs: Math.round(now - g.t),
        pathLengthNorm: Math.round(g.path * 1e4) / 1e4,
        zHintAbsSum: Math.round(g.zAbs * 1e4) / 1e4,
        // Additive to doc 14's contract (M10): makes the false-start rate computable.
        firstMoveMs: g.firstMoveT === null ? null : Math.round(g.firstMoveT - g.t),
      },
      now,
    );
  }

  trackingLost(now: number): void {
    this.lostAt = now;
    this.log("tracking_lost", {}, now);
  }

  trackingRegained(now: number): void {
    this.log("tracking_regained", { durationMs: this.lostAt === null ? null : Math.round(now - this.lostAt) }, now);
    this.lostAt = null;
  }
}

/**
 * False-start rate (doc 14 section 2.1): closed grabs whose drag had no move within FALSE_START_MS.
 * Both counts come from grab_move_summary, so a grab still open when the log ends counts in neither.
 * Gesture condition only; a deliberate pinch-to-select (identify tasks, Phase 4) also never moves.
 */
export function falseStartRate(events: readonly LogEvent[]): { grabs: number; falseStarts: number; rate: number | null } {
  const summaries = events.filter((e) => e.type === "grab_move_summary");
  const grabs = summaries.length;
  const falseStarts = summaries.filter((e) => {
    const first = e.payload.firstMoveMs;
    return first === null || (typeof first === "number" && first > FALSE_START_MS);
  }).length;
  return { grabs, falseStarts, rate: grabs ? falseStarts / grabs : null };
}
