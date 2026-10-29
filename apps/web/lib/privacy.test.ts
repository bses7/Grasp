/**
 * Privacy invariants (doc 12 A20, doc 14 section 7, doc 15 "Live video stream"): nothing that leaves the page
 * carries image data or landmark arrays, and nothing is sent without logging consent.
 * 1. Static: only the known files call the network; no source can capture or store video (IndexedDB,
 *    MediaRecorder, canvas export).
 * 2. Dynamic: a scripted lesson's events go through the real logger and transport with fetch and sendBeacon
 *    intercepted; every body is JSON text whose values are scalars, with no landmark-like key or number array.
 * ponytail: the full-page Playwright interception of a live lesson (apps/web/e2e) is V1; (1) covers the code
 * paths that page could take.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { SessionLogger } from "@grasp/learning";
import { afterEach, describe, expect, it, vi } from "vitest";
import { postAttempts } from "./api-client";
import { createLoggerTransport } from "./logger-transport";

const ROOT = join(__dirname, "../../..");

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    const p = join(dir, d.name);
    if (d.isDirectory()) return ["node_modules", ".next", "fixtures"].includes(d.name) ? [] : sources(p);
    return /\.tsx?$/.test(d.name) && !/\.test\.tsx?$/.test(d.name) ? [p] : [];
  });
}

/** Every file allowed to call the network, and why. */
const NETWORK_ALLOWED = new Set([
  "apps/web/lib/api-client.ts", // session, attempts, withdrawal
  "apps/web/lib/logger-transport.ts", // the research event log
  "apps/web/app/(study)/lesson/[lessonId]/lesson-client.tsx", // sendBeacon of unsaved attempts on page close
  "packages/scene/src/components/lesson-scene.tsx", // GET of the model GLB
]);

describe("privacy: static", () => {
  const files = [...sources(join(ROOT, "apps/web")), ...sources(join(ROOT, "packages"))].map((f) => ({
    path: relative(ROOT, f).replaceAll("\\", "/"),
    text: readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, ""), // code, not comments
  }));

  it("only the known files call fetch, sendBeacon, XMLHttpRequest or WebSocket", () => {
    const callers = files.filter((f) => /\bfetch\(|sendBeacon\(|XMLHttpRequest|new WebSocket/.test(f.text)).map((f) => f.path);
    expect(callers.filter((p) => !NETWORK_ALLOWED.has(p))).toEqual([]);
  });

  it("no code can record, export or store camera frames", () => {
    const hits = files.filter((f) => /indexedDB|MediaRecorder|captureStream|toDataURL|toBlob|convertToBlob/.test(f.text)).map((f) => f.path);
    expect(hits).toEqual([]);
  });
});

describe("privacy: what leaves the page", () => {
  const bodies: { url: string; body: unknown }[] = [];
  vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
    bodies.push({ url, body: init?.body });
    return new Response(null, { status: 204 });
  });
  vi.stubGlobal("navigator", { sendBeacon: (url: string, body: unknown) => (bodies.push({ url, body }), true) });
  vi.stubGlobal("addEventListener", () => {});
  vi.stubGlobal("removeEventListener", () => {});
  afterEach(() => void (bodies.length = 0));

  /** A drag with a cursor stream, tracking loss and the usual engine events. */
  function lesson(consent: boolean) {
    const transport = createLoggerTransport(() => consent);
    const log = new SessionLogger("00000000-0000-4000-8000-000000000000", "gesture", 0, (e) => transport.enqueue(e));
    log.log("device_info", { cameraWidth: 640, cameraHeight: 480, gpu: true }, 0);
    log.log("task_start", { taskId: "t1" }, 10);
    log.grabStart("left_ventricle", { x: 0.1, y: 0.2 }, 100);
    for (let i = 0; i < 60; i++) log.grabMove({ x: 0.1 + i / 100, y: 0.2 + i / 200 }, 0.01, 100 + i * 33);
    log.trackingLost(2200);
    log.trackingRegained(2600);
    log.grabEnd("release", 2700);
    log.log("place", { componentId: "left_ventricle", socketId: "socket_lv" }, 2700);
    transport.dispose(); // beacons what is left
    return transport;
  }

  const LANDMARKISH = /landmark|frame$|image|pixel|video|^(x|y|z|position|cursor)$/i;
  function check(value: unknown, path: string): void {
    if (Array.isArray(value)) {
      expect(value.some((v) => typeof v === "number"), `${path} holds a number array`).toBe(false);
      value.forEach((v, i) => check(v, `${path}[${i}]`));
    } else if (value && typeof value === "object") {
      for (const [k, v] of Object.entries(value)) {
        expect(LANDMARKISH.test(k), `${path}.${k} is a forbidden key`).toBe(false);
        check(v, `${path}.${k}`);
      }
    }
  }

  it("sends only scalar JSON text, with no landmark or cursor stream", async () => {
    lesson(true);
    await postAttempts([]);
    expect(bodies.some((b) => b.url === "/api/events")).toBe(true);
    for (const { url, body } of bodies) {
      expect(typeof body, `${url} body`).toBe("string");
      const json = JSON.parse(body as string);
      check(json, url);
      if (url === "/api/events") for (const e of json) for (const v of Object.values(e.payload)) expect(v === null || typeof v !== "object").toBe(true);
    }
  });

  it("sends no events without logging consent", () => {
    lesson(false);
    expect(bodies.filter((b) => b.url === "/api/events")).toEqual([]);
  });
});
