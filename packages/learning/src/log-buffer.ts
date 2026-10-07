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
 * M10 implements the buffer; the network transport behind it is doc 13 Phase 4 (the prototype downloads).
 */
export class LogBuffer {
  private readonly queue: LogEvent[] = [];

  constructor(
    private readonly transport: LogTransport,
    private readonly consent: () => boolean,
  ) {}

  push(event: LogEvent): void {
    if (!this.consent()) return;
    this.queue.push(event);
  }

  async flush(): Promise<void> {
    if (this.queue.length === 0) return;
    const batch = this.queue.splice(0, this.queue.length);
    try {
      await this.transport(batch);
    } catch (err) {
      this.queue.unshift(...batch); // keep them for the next flush; nothing is lost on a failed POST
      throw err;
    }
  }

  get size(): number {
    return this.queue.length;
  }
}
