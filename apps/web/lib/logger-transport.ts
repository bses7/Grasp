/**
 * Moves research LogEvents to POST /api/events (doc 03 data flow step 10; research-protocol §4).
 * The buffer and consent gate live in @grasp/learning (LogBuffer); this file only does the network part:
 * - flush every FLUSH_INTERVAL_MS or once FLUSH_BATCH_SIZE events are queued, in batches of at most 50;
 * - on pagehide, `navigator.sendBeacon` sends what is left so the last batch survives a closed tab;
 * - a failed POST keeps the events queued (LogBuffer re-queues them) and the next tick retries; the server
 *   ignores duplicates by (sessionId, seq). A 403 (session withdrawn or not this cookie's) drops the batch:
 *   retrying could never succeed.
 * Never carries landmarks or video: LogEvent payloads are scalars.
 */
import { FLUSH_BATCH_SIZE, FLUSH_INTERVAL_MS, LogBuffer } from "@grasp/learning";
import type { LogEvent } from "@grasp/types";

const URL = "/api/events";

async function post(events: LogEvent[]): Promise<void> {
  for (let i = 0; i < events.length; i += FLUSH_BATCH_SIZE) {
    const res = await fetch(URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(events.slice(i, i + FLUSH_BATCH_SIZE)),
      // A batch in flight at pagehide is no longer queued, so the beacon cannot resend it; keepalive lets it
      // finish after unload (a reload used to lose it, leaving a seq gap the metrics script flags).
      keepalive: true,
    });
    if (res.status === 403) return;
    if (!res.ok) throw new Error(`POST ${URL}: ${res.status}`);
  }
}

export type LoggerTransport = {
  /** Feed every logged event here (SessionLogger's sink). */
  enqueue(event: LogEvent): void;
  flush(): Promise<void>;
  /** Stop the timer and beacon whatever is still queued. */
  dispose(): void;
};

/** `consent` gates every event (doc 03: the logger drops everything without logging consent; step 4.6). */
export function createLoggerTransport(consent: () => boolean = () => true): LoggerTransport {
  const buffer = new LogBuffer(post, consent);
  let flushing = false;
  const flush = async () => {
    if (flushing) return;
    flushing = true;
    try {
      await buffer.flush();
    } catch {
      /* kept queued; retried next tick */
    } finally {
      flushing = false;
    }
  };
  const beacon = () => {
    const events = buffer.drain();
    for (let i = 0; i < events.length; i += FLUSH_BATCH_SIZE) {
      navigator.sendBeacon(URL, JSON.stringify(events.slice(i, i + FLUSH_BATCH_SIZE)));
    }
  };
  const timer = setInterval(flush, FLUSH_INTERVAL_MS);
  addEventListener("pagehide", beacon);
  return {
    enqueue(e) {
      buffer.push(e);
      if (buffer.size >= FLUSH_BATCH_SIZE) void flush();
    },
    flush,
    dispose() {
      clearInterval(timer);
      removeEventListener("pagehide", beacon);
      beacon();
    },
  };
}
