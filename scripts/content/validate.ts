/**
 * Content validator (doc 10 "Authoring workflow"; lesson-schema skill section 8). Run by CI as `pnpm content:validate`.
 * Zod-parses every manifest and lesson under content/, then runs the lesson-schema section 8 checklist:
 * cross-references (component, socket, objective ids), task rules, narration length, and for each manifest
 * whose GLB exists under models/<id>/<file>: size, triangle count, and node names against component and socket ids.
 */
import { existsSync, readFileSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Lesson, ModelManifest } from "@grasp/types";
import { LessonSchema, ModelManifestSchema } from "../../packages/content/src/schemas";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

async function listJson(dir: string, recursive: boolean): Promise<string[]> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const out: string[] = [];
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (recursive) out.push(...(await listJson(path, true)));
    } else if (entry.isFile() && entry.name.endsWith(".json")) {
      out.push(path);
    }
  }
  return out.sort();
}

let failures = 0;
const fail = (rel: string, msg: string) => {
  console.error(`FAIL ${rel}: ${msg}`);
  failures += 1;
};

const MAX_GLB_BYTES = 5 * 1024 * 1024;
const MAX_TRIANGLES = 150_000;
const MAX_NARRATION = 220;

async function readJson(file: string): Promise<unknown> {
  return JSON.parse(await readFile(file, "utf8"));
}

function checkManifest(m: ModelManifest, rel: string): void {
  const components = new Set(m.components.map((c) => c.id));
  const sockets = new Set(m.sockets.map((s) => s.id));
  for (const s of m.sockets) {
    for (const id of s.accepts) if (!components.has(id)) fail(rel, `${s.id} accepts unknown component ${id}`);
  }
  for (const c of m.components) {
    if (c.restSocketId && !sockets.has(c.restSocketId)) fail(rel, `${c.id}.restSocketId ${c.restSocketId} is not a socket`);
    for (const r of c.relations ?? []) if (!components.has(r.target)) fail(rel, `${c.id} relation to unknown ${r.target}`);
  }
  for (const h of m.hotspots) if (!components.has(h.componentId)) fail(rel, `${h.id} on unknown component ${h.componentId}`);
  for (const [pose, parts] of Object.entries(m.poses)) {
    for (const id of Object.keys(parts)) if (!components.has(id)) fail(rel, `pose ${pose} moves unknown component ${id}`);
  }

  const glb = join(root, "models", m.id, m.file);
  if (!existsSync(glb)) return console.log(`         (no GLB at models/${m.id}/${m.file}; GLB checks skipped)`);
  const buf = readFileSync(glb);
  if (buf.length > MAX_GLB_BYTES) fail(rel, `GLB is ${(buf.length / 1e6).toFixed(1)} MB (max 5 MB)`);
  const g = JSON.parse(buf.toString("utf8", 20, 20 + buf.readUInt32LE(12))) as {
    nodes: { name?: string; mesh?: number }[];
    meshes: { primitives: { indices?: number; attributes: { POSITION: number } }[] }[];
    accessors: { count: number }[];
  };
  const tris = g.meshes.reduce(
    (t, mesh) => t + mesh.primitives.reduce((n, p) => n + g.accessors[p.indices ?? p.attributes.POSITION]!.count / 3, 0),
    0,
  );
  if (tris > MAX_TRIANGLES) fail(rel, `GLB has ${Math.round(tris)} triangles (max ${MAX_TRIANGLES})`);
  const meshNames = new Set(g.nodes.filter((n) => n.mesh !== undefined).map((n) => n.name));
  const nodeNames = new Set(g.nodes.map((n) => n.name));
  for (const id of components) if (!meshNames.has(id)) fail(rel, `component ${id} has no mesh node of that name in the GLB`);
  for (const id of sockets) if (!nodeNames.has(id)) fail(rel, `socket ${id} has no node of that name in the GLB`);
  console.log(`         GLB ${(buf.length / 1e6).toFixed(2)} MB, ${Math.round(tris).toLocaleString()} triangles, node names match`);
}

function checkLesson(l: Lesson, rel: string, manifests: Map<string, ModelManifest>): void {
  const m = manifests.get(l.modelId);
  if (!m) return fail(rel, `modelId ${l.modelId} has no manifest`);
  const components = new Set(m.components.map((c) => c.id));
  const socketById = new Map(m.sockets.map((s) => [s.id, s]));
  const objectives = new Set(l.objectives.map((o) => o.id));
  const taught = new Set<string>();
  const comp = (task: string, id: string) => components.has(id) || fail(rel, `${task}: unknown component ${id}`);

  if (l.estimatedMinutes < 5 || l.estimatedMinutes > 20) fail(rel, `estimatedMinutes ${l.estimatedMinutes} outside 5-20`);
  for (const a of l.activities) {
    for (const card of a.narration ?? []) if (card.length > MAX_NARRATION) fail(rel, `${a.id}: narration card over ${MAX_NARRATION} chars`);
    for (const t of a.tasks) {
      if (!objectives.has(t.objectiveId)) fail(rel, `${t.id}: unknown objective ${t.objectiveId}`);
      if (a.kind !== "introduction") taught.add(t.objectiveId);
      if (a.kind === "assessment" && (t.hints.length > 0 || t.maxAttempts !== 1)) fail(rel, `${t.id}: assessment tasks need hints [] and maxAttempts 1`);
      for (const h of t.hints) {
        if (h.tutor && !h.text && !h.highlight) fail(rel, `${t.id}: tutor hint needs text or highlight as fallback`);
        for (const id of h.highlight ?? []) if (!components.has(id)) fail(rel, `${t.id}: hint ${h.level} highlights ${id}, not a component id`);
      }
      switch (t.type) {
        case "identify":
          for (const id of ([] as string[]).concat(t.expect.componentId)) comp(t.id, id);
          break;
        case "place": {
          comp(t.id, t.expect.componentId);
          const s = socketById.get(t.expect.socketId);
          if (!s) fail(rel, `${t.id}: unknown socket ${t.expect.socketId}`);
          else if (!s.accepts.includes(t.expect.componentId)) fail(rel, `${t.id}: ${s.id} does not accept ${t.expect.componentId}`);
          break;
        }
        case "remove":
          comp(t.id, t.expect.componentId);
          if (!socketById.has(t.expect.awayFromSocketId)) fail(rel, `${t.id}: unknown socket ${t.expect.awayFromSocketId}`);
          break;
        case "sequence":
          if (t.expect.steps.length < 2) fail(rel, `${t.id}: sequence needs at least 2 steps`);
          for (const st of t.expect.steps) {
            comp(t.id, st.componentId);
            if (st.socketId && !socketById.has(st.socketId)) fail(rel, `${t.id}: unknown socket ${st.socketId}`);
          }
          break;
        case "compare":
          t.expect.componentIds.forEach((id) => comp(t.id, id));
          if (!t.expect.componentIds.includes(t.expect.answer)) fail(rel, `${t.id}: compare answer is not one of the two ids`);
          break;
      }
    }
  }
  for (const o of objectives) if (!taught.has(o)) fail(rel, `objective ${o} has no task outside the introduction`);
}

async function main(): Promise<void> {
  const manifestFiles = await listJson(join(root, "content", "models"), false);
  const lessonFiles = await listJson(join(root, "content", "lessons"), true);
  const manifests = new Map<string, ModelManifest>();
  const rel = (f: string) => relative(root, f).replace(/\\/g, "/");

  for (const file of manifestFiles) {
    const parsed = ModelManifestSchema.safeParse(await readJson(file));
    if (!parsed.success) {
      fail(rel(file), parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
      continue;
    }
    console.log(`manifest ${parsed.data.id}  (${rel(file)})`);
    manifests.set(parsed.data.id, parsed.data);
    checkManifest(parsed.data, rel(file));
  }
  for (const file of lessonFiles) {
    const parsed = LessonSchema.safeParse(await readJson(file));
    if (!parsed.success) {
      fail(rel(file), parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
      continue;
    }
    console.log(`lesson   ${parsed.data.id}  (${rel(file)})`);
    checkLesson(parsed.data, rel(file), manifests);
  }
  console.log(`${manifestFiles.length} manifest(s), ${lessonFiles.length} lesson(s), ${failures} failure(s)`);
  process.exit(failures > 0 ? 1 : 0);
}

void main();
