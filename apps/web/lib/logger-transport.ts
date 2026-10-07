/**
 * Transport for research LogEvents (docs/03 data flow step 10; research-protocol
 * section 4). The buffer and consent gate live in @grasp/learning (logger);
 * this file only moves batches to POST /api/events.
 *
 * Rules fixed by the docs:
 * - Batch every 10 s or 50 events, whichever first.
 * - `navigator.sendBeacon` on pagehide/unload so the last batch survives.
 * - Drop everything when sessionStore.consent.logging is false.
 * - Never carries landmarks or video; LogEvent is interaction and learning data only.
 *
 * TODO Phase D, doc 13 Phase 4 (network logging): implement. M10 ships the in-memory SessionLogger and a JSON
 * download instead; this transport is what Phase 4 plugs into LogBuffer. The prototype milestone downloads the
 * buffer as JSON and only doc 13 Phase 4 turns on the network path.
 */
export type LoggerTransport = {
  enqueue(event: unknown): void;
  flush(): Promise<void>;
};

export function createLoggerTransport(): LoggerTransport {
  return {
    enqueue() {
      /* no-op until M10 */
    },
    async flush() {
      /* no-op until M10 */
    },
  };
}
