/**
 * Fill the doc 17 stop/go table from M11 hallway-test logs (doc 17 "Stop/go criteria").
 *
 *   pnpm research:stopgo p1-good=log1.json p1-window=log2.json p1-mouse=log3.json p2-good=... [--tti 2.9] [--out note.md]
 *
 * Label = <participant>-<anything>; "window" in the label marks the backlit session. The condition (gesture |
 * mouse) comes from the log itself. Each log is scored on its FIRST run (events before the first scene_reset).
 * `--tti` is the time to first interaction in seconds, measured separately (M9 measured 2.9 s at 10 Mbps).
 * Rows with no matching log print "not measured", never Go.
 */
import { readFileSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { LogEvent } from "@grasp/types";
import { falseStartRate } from "../../packages/learning/src/logger";

type Verdict = "Go" | "Tune" | "Stop" | "not measured";
type Session = {
  label: string;
  participant: string;
  window: boolean;
  condition: string;
  firstTry: number;
  completed: number;
  tasks: number;
  seconds: number | null;
  frameP95: number | null;
  inferenceP95: number | null;
  paths: Set<string>;
  placesWhileLost: number;
  events: LogEvent[];
};

const root = resolve(import.meta.dirname, "../..");
const args = process.argv.slice(2);
const opt = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args.splice(i, 2)[1] : undefined;
};
const tti = opt("--tti");
const out = opt("--out");
if (args.length === 0) {
  console.error("usage: pnpm research:stopgo <label=log.json>... [--tti seconds] [--out note.md]");
  process.exit(1);
}

function score(label: string, file: string): Session {
  const all = (JSON.parse(readFileSync(file, "utf8")) as LogEvent[]).sort((a, b) => a.seq - b.seq);
  const reset = all.findIndex((e) => e.type === "scene_reset");
  const run = reset >= 0 ? all.slice(0, reset) : all;
  const taskIds = [...new Set(run.filter((e) => e.type === "task_start").map((e) => String(e.payload.taskId)))];
  const attempts = run.filter((e) => e.type === "task_attempt");
  const firstTry = taskIds.filter((id) => attempts.find((a) => a.payload.taskId === id)?.payload.correct === true).length;
  const ends = run.filter((e) => e.type === "task_end");
  const completed = ends.filter((e) => e.payload.outcome === "correct").length;
  const start = run.find((e) => e.type === "task_start")?.t;
  const finish = ends.length === taskIds.length && ends.length ? ends.at(-1)!.t : undefined;

  const perf = all.filter((e) => e.type === "perf_sample");
  const max = (k: string) => {
    const xs = perf.map((e) => e.payload[k]).filter((v): v is number => typeof v === "number");
    return xs.length ? Math.max(...xs) : null;
  };

  // A place while tracking is lost (before tracking_regained or the lost release) is a scene bug.
  let lost = false;
  let placesWhileLost = 0;
  for (const e of all) {
    if (e.type === "tracking_lost") lost = true;
    else if (e.type === "tracking_regained" || (e.type === "grab_end" && e.payload.reason === "lost")) lost = false;
    else if (e.type === "place" && lost) placesWhileLost++;
  }

  return {
    label,
    participant: label.split("-")[0]!,
    window: /window/i.test(label),
    condition: all[0]?.condition ?? "?",
    firstTry,
    completed,
    tasks: taskIds.length,
    seconds: start !== undefined && finish !== undefined ? (finish - start) / 1000 : null,
    frameP95: max("frameMsP95"),
    inferenceP95: max("inferenceMsP95"),
    paths: new Set(perf.map((e) => String(e.payload.path))),
    placesWhileLost,
    events: all,
  };
}

const sessions = args.map((a) => {
  const [label, file] = a.includes("=") ? [a.slice(0, a.indexOf("=")), a.slice(a.indexOf("=") + 1)] : [a, a];
  return score(label!, file!);
});
const gesture = sessions.filter((s) => s.condition === "gesture");
const fmt = (s: Session) => `${s.participant}: ${s.firstTry}/${s.tasks} first try, ${s.seconds === null ? "not finished" : `${s.seconds.toFixed(0)} s`}`;

function placementRow(list: Session[], limitS: number): [Verdict, string] {
  if (!list.length) return ["not measured", "no log"];
  const detail = list.map(fmt).join("; ");
  if (list.some((s) => s.firstTry <= 1)) return ["Stop", detail];
  if (list.every((s) => s.firstTry === 3 && s.seconds !== null && s.seconds <= limitS)) return ["Go", detail];
  return ["Tune", detail];
}

const rows: [string, Verdict, string][] = [];
rows.push(["Three placements, first try, gesture, good light", ...placementRow(gesture.filter((s) => !s.window), 120)]);
rows.push(["Same, window behind the participant", ...placementRow(gesture.filter((s) => s.window), 180)]);
{
  const mouse = sessions.filter((s) => s.condition === "mouse");
  const detail = mouse.map((s) => `${s.participant}: ${s.completed}/${s.tasks} placed`).join("; ");
  rows.push([
    "Three placements, mouse path",
    !mouse.length ? "not measured" : mouse.every((s) => s.completed === 3) ? "Go" : "Tune",
    (detail || "no log") + (mouse.some((s) => s.completed < 3) ? " (a mouse failure is a scene bug: fix it)" : ""),
  ]);
}
{
  const xs = gesture.map((s) => s.frameP95).filter((v): v is number => v !== null);
  const m = xs.length ? Math.max(...xs) : null;
  rows.push([
    "frameMsP95 (worst 5 s sample)",
    m === null ? "not measured" : m <= 33 ? "Go" : m <= 50 ? "Tune" : "Stop",
    m === null ? "no perf_sample" : `${m} ms (integrated GPU required for the real verdict)`,
  ]);
}
{
  const xs = gesture.map((s) => s.inferenceP95).filter((v): v is number => v !== null);
  const m = xs.length ? Math.max(...xs) : null;
  const fallback = gesture.some((s) => s.paths.has("main_thread_fallback"));
  rows.push([
    "inferenceMsP95, worker path (worst 5 s sample)",
    m === null ? "not measured" : fallback ? "Stop" : m <= 33 ? "Go" : m <= 45 ? "Tune" : "Stop",
    m === null ? "no perf_sample" : `${m} ms${fallback ? "; fallback path seen" : ", worker path"}`,
  ]);
}
{
  const pooled = falseStartRate(gesture.flatMap((s) => s.events));
  rows.push([
    "Pinch false-start rate (pooled, gesture)",
    pooled.rate === null ? "not measured" : pooled.rate < 0.1 ? "Go" : pooled.rate <= 0.2 ? "Tune" : "Stop",
    pooled.rate === null ? "no grabs" : `${pooled.falseStarts}/${pooled.grabs} = ${(pooled.rate * 100).toFixed(0)}% (never moved)`,
  ]);
}
{
  const n = sessions.reduce((t, s) => t + s.placesWhileLost, 0);
  rows.push(["place emitted during tracking_lost", gesture.length ? (n === 0 ? "Go" : "Stop") : "not measured", `${n} occurrence(s)`]);
}
{
  const mb = statSync(join(root, "models/heart_v1/heart.glb")).size / 1e6;
  const t = tti === undefined ? null : Number(tti);
  rows.push([
    "GLB size, time to first interaction",
    t === null ? "not measured" : mb < 5 && t <= 5 ? "Go" : mb <= 8 && t <= 8 ? "Tune" : "Stop",
    `${mb.toFixed(2)} MB, ${t === null ? "pass --tti <s>" : `${t} s`}`,
  ]);
}

const count = (v: Verdict) => rows.filter((r) => r[1] === v).length;
const decision = count("Stop")
  ? "STOP or pivot: a Stop row puts the gesture modality at risk (doc 17 decision rule)"
  : count("not measured")
    ? "INCOMPLETE: some rows are not measured yet"
    : count("Tune") <= 2
      ? "GATE PASSES if this is after one tuning pass: all Go, or at most two Tune"
      : "TUNE and retest: more than two rows in Tune";

const md = [
  "| Criterion | Verdict | Measured |",
  "|---|---|---|",
  ...rows.map(([c, v, d]) => `| ${c} | **${v}** | ${d} |`),
  "",
  `Sessions: ${sessions.map((s) => `${s.label} (${s.condition}${s.window ? ", window" : ""})`).join(", ")}`,
  "",
  `Decision: ${decision}`,
].join("\n");
console.log(md);
if (out) {
  writeFileSync(out, `${md}\n`);
  console.log(`\nwrote ${out}`);
}
