import type { LogEvent } from "@grasp/types";

/** Batch cadence agreed in docs/03 step 10: every 10 s or 50 events, plus `sendBeacon` on unload. */
export const FLUSH_INTERVAL_MS = 10_000;
export const FLUSH_BATCH_SIZE = 50;

/**
 * The transport is injected by `apps/web/lib/logger-transport.ts`; this package
 * never imports `fetch` or `navigator.sendBeacon` (docs/16 boundary rule).
 */
export type LogTransport = (events: LogEvent[]) => Promise<void>;

/**
 * In-memory `LogEvent` buffer (research-protocol §4).
 *
 * - `push` appends an event; when `consent()` is false the event is dropped,
 *   never queued (docs/03: the logger drops everything without logging consent).
 * - `flush` hands the queued events to the transport and clears the queue.
 *   Timer and unload hooks live in apps/web, which calls `flush` on its own schedule.
 * - Never stores video, images, or raw landmark streams; only the event types
 *   enumerated in `LogEvent["type"]`.
 *
 * Phase D (M8).
 */
export class LogBuffer {
  private readonly queue: LogEvent[] = [];

  constructor(
    private readonly transport: LogTransport,
    private readonly consent: () => boolean,
  ) {}

  push(event: LogEvent): void {
    void event;
    void this.queue;
    void this.consent;
    throw new Error("TODO Phase D: LogBuffer.push (doc 06, M8)");
  }

  async flush(): Promise<void> {
    void this.transport;
    throw new Error("TODO Phase D: LogBuffer.flush (doc 06, M8)");
  }

  get size(): number {
    return this.queue.length;
  }
}
