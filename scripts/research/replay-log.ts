/**
 * Re-grade a downloaded session log (doc 17 M10 acceptance).
 *
 *   pnpm research:replay <grasp-log-*.json> [lessonId]     (lessonId defaults to anatomy.heart.prototype_v0)
 *
 * 1. Every payload value is a scalar, and no key names a landmark, frame, image or position.
 * 2. A fresh TaskRunner fed only the logged select / place / drop events (restarting at each scene_reset)
 *    reproduces every logged task_attempt, in order: taskId, attemptNo, correct, partial, score.
 * 3. The false-start rate (grab_start with no grab_move within 300 ms) is computable.
 * Exits 1 if check 1 or 2 fails.
 */
import { readFileSync } from "node:fs";
import type { LogEvent, SceneEvent } from "@grasp/types";
import { loadLesson } from "../../packages/content/src/loaders";
import { falseStartRate, TaskRunner } from "../../packages/learning/src/index";

const [file, lessonId = "anatomy.heart.prototype_v0"] = process.argv.slice(2);
if (!file) {
  console.error("usage: pnpm research:replay <grasp-log-*.json> [lessonId]");
  process.exit(1);
}
const events = (JSON.parse(readFileSync(file, "utf8")) as LogEvent[]).sort((a, b) => a.seq - b.seq);
const lesson = loadLesson(lessonId);
let problems = 0;

// 1. Payload shape.
const BANNED = /landmark|frame|image|pixel|video|position|^x$|^y$|^z$/i;
for (const e of events) {
  for (const [k, v] of Object.entries(e.payload)) {
    if (v !== null && typeof v === "object") (problems++, console.error(`seq ${e.seq} ${e.type}.${k}: not a scalar`));
    if (BANNED.test(k)) (problems++, console.error(`seq ${e.seq} ${e.type}.${k}: forbidden key`));
  }
}

// 2. Replay the engine on the logged scene events.
const fresh = () => {
  const r = new TaskRunner(lesson, { sessionId: "replay", lessonHash: "replay" });
  r.start(0);
  return r;
};
let runner = fresh();
const expected: { taskId: string; attemptNo: number; correct: boolean; partial: boolean; score: number }[] = [];
let matched = 0;

function toSceneEvent(e: LogEvent): SceneEvent | null {
  const p = e.payload;
  if (e.type === "place") return { type: "place", componentId: String(p.componentId), socketId: String(p.socketId), t: e.t };
  if (e.type === "drop") return { type: "drop", componentId: String(p.componentId), position: [0, 0, 0], cause: p.cause === "lost" ? "lost" : "release", t: e.t };
  if (e.type === "select" && typeof p.componentId === "string") return { type: "select", componentId: p.componentId, method: p.method as "grab" | "dwell" | "click", t: e.t };
  return null;
}

for (const e of events) {
  if (e.type === "scene_reset") runner = fresh();
  const se = toSceneEvent(e);
  if (se) {
    const v = runner.onSceneEvent(se);
    if (v) expected.push({ taskId: v.task.id, attemptNo: v.attemptNo, correct: v.result.correct, partial: v.result.partial, score: v.result.score });
  }
  if (e.type === "task_attempt") {
    const want = expected.shift();
    const got = { taskId: e.payload.taskId, attemptNo: e.payload.attemptNo, correct: e.payload.correct, partial: e.payload.partial, score: e.payload.score };
    if (want && JSON.stringify(want) === JSON.stringify(got)) matched++;
    else (problems++, console.error(`seq ${e.seq} task_attempt ${JSON.stringify(got)} but replay gives ${JSON.stringify(want ?? "nothing")}`));
  }
}
for (const extra of expected) (problems++, console.error(`replay graded ${JSON.stringify(extra)} with no logged task_attempt`));

// 3. False starts.
const fs = falseStartRate(events);
const counts = events.reduce<Record<string, number>>((c, e) => ((c[e.type] = (c[e.type] ?? 0) + 1), c), {});
console.log(`${events.length} events (${events[0]?.condition ?? "?"}, session ${events[0]?.sessionId.slice(0, 8) ?? "?"}): ${Object.entries(counts).map(([k, n]) => `${k} ${n}`).join(", ")}`);
console.log(`task_attempt recomputed from scene events: ${matched}/${counts.task_attempt ?? 0}`);
console.log(
  events[0]?.condition === "gesture"
    ? `false starts: ${fs.falseStarts}/${fs.grabs} closed grabs${fs.rate === null ? "" : ` (${(fs.rate * 100).toFixed(1)}%)`}`
    : "false starts: n/a (gesture condition only; a mouse click on a part never moves)",
);
console.log(problems ? `${problems} problem(s)` : "OK: payloads are scalar-only and every attempt replays");
process.exit(problems ? 1 : 0);
