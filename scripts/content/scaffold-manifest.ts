/**
 * Scaffold or refresh a model manifest from a GLB (doc 10 "Authoring workflow", doc 17 M9).
 *
 *   pnpm content:scaffold models/<modelId>/<file>.glb [--prune]
 *
 * Reads the GLB's JSON chunk only (no geometry decode) and merges into content/models/<modelId>.json:
 * - every `socket_<componentId>` node becomes a Socket whose transform is that node's (the assembled pose);
 *   an existing socket keeps its authored radius, accepts and visual;
 * - a mesh node with a matching socket becomes a Component; an existing component keeps every authored field;
 * - any other mesh node is scenery (rendered, never interactable) and is only reported.
 * Components or sockets the manifest names but the GLB lacks are reported; `--prune` removes them, with the
 * hotspots and relations that point at them. The output still needs an author's pass (names, descriptions).
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import type { Component, ModelManifest, Socket, Vec3 } from "@grasp/types";

const args = process.argv.slice(2);
const glbPath = args.find((a) => a.endsWith(".glb"));
const prune = args.includes("--prune");
if (!glbPath) {
  console.error("usage: pnpm content:scaffold models/<modelId>/<file>.glb [--prune]");
  process.exit(1);
}

type GltfNode = { name?: string; mesh?: number; translation?: number[]; rotation?: number[]; children?: number[] };

const buf = readFileSync(glbPath);
if (buf.toString("ascii", 0, 4) !== "glTF") throw new Error(`${glbPath} is not a .glb`);
const gltf = JSON.parse(buf.toString("utf8", 20, 20 + buf.readUInt32LE(12))) as { nodes: GltfNode[] };

// Only root-level nodes are supported: their local transform is the model-space transform.
const childIds = new Set(gltf.nodes.flatMap((n) => n.children ?? []));
const roots = gltf.nodes.filter((_, i) => !childIds.has(i));
const nested = gltf.nodes.filter((n, i) => childIds.has(i) && n.name);
if (nested.length) console.warn(`warning: nested nodes ignored (flatten in Blender): ${nested.map((n) => n.name).join(", ")}`);

const round = (n: number) => Math.round(n * 1000) / 1000 + 0;
const vec = (v: number[] | undefined): Vec3 => [round(v?.[0] ?? 0), round(v?.[1] ?? 0), round(v?.[2] ?? 0)];
/** Quaternion [x, y, z, w] to Euler XYZ radians, the order three.js uses for Object3D.rotation. */
function euler(q: number[] | undefined): Vec3 {
  const [x, y, z, w] = q ?? [0, 0, 0, 1];
  const m11 = 1 - 2 * (y * y + z * z), m12 = 2 * (x * y - z * w), m13 = 2 * (x * z + y * w);
  const m22 = 1 - 2 * (x * x + z * z), m23 = 2 * (y * z - x * w), m32 = 2 * (y * z + x * w), m33 = 1 - 2 * (x * x + y * y);
  const ey = Math.asin(Math.max(-1, Math.min(1, m13)));
  const ex = Math.abs(m13) < 0.9999999 ? Math.atan2(-m23, m33) : Math.atan2(m32, m22);
  const ez = Math.abs(m13) < 0.9999999 ? Math.atan2(-m12, m11) : 0;
  return [round(ex), round(ey), round(ez)];
}

const socketNodes = roots.filter((n) => n.name?.startsWith("socket_"));
const meshNodes = roots.filter((n) => n.mesh !== undefined && n.name);
const socketed = new Set(socketNodes.map((n) => n.name!.slice("socket_".length)));

const modelId = basename(dirname(resolve(glbPath)));
const manifestPath = join("content", "models", `${modelId}.json`);
const existing: Partial<ModelManifest> = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, "utf8")) : {};
const oldComponents = new Map((existing.components ?? []).map((c) => [c.id, c]));
const oldSockets = new Map((existing.sockets ?? []).map((s) => [s.id, s]));

const title = (id: string) => id.split("_").map((w) => w[0]!.toUpperCase() + w.slice(1)).join(" ");

const components: Component[] = meshNodes
  .filter((n) => socketed.has(n.name!) || oldComponents.has(n.name!))
  .map(
    (n) =>
      oldComponents.get(n.name!) ?? {
        id: n.name!,
        name: title(n.name!),
        type: "TODO",
        interactable: true,
        grabbable: true,
        highlightable: true,
        description: "TODO: one factual sentence; the tutor may quote it.",
        tags: [],
        restSocketId: `socket_${n.name}`,
      },
  );

const sockets: Socket[] = socketNodes.map((n) => {
  const old = oldSockets.get(n.name!);
  const transform = { position: vec(n.translation), rotation: euler(n.rotation) };
  return old ? { ...old, transform } : { id: n.name!, transform, radius: 1.5, accepts: [n.name!.slice(7)], visual: "ghost" };
});

const inGlb = new Set(components.map((c) => c.id));
const missingComponents = [...oldComponents.keys()].filter((id) => !meshNodes.some((n) => n.name === id));
const missingSockets = [...oldSockets.keys()].filter((id) => !socketNodes.some((n) => n.name === id));
const scenery = meshNodes.map((n) => n.name!).filter((name) => !inGlb.has(name));

const keep = prune ? components : [...components, ...missingComponents.map((id) => oldComponents.get(id)!)];
const keepIds = new Set(keep.map((c) => c.id));
const manifest = {
  ...existing,
  id: existing.id ?? modelId,
  subject: existing.subject ?? "TODO",
  file: basename(glbPath),
  units: existing.units ?? "cm",
  defaultCamera: existing.defaultCamera ?? { azimuth: 0, elevation: 0, distance: 30 },
  components: keep.map((c) => (prune && c.relations ? { ...c, relations: c.relations.filter((r) => keepIds.has(r.target)) } : c)),
  sockets: prune ? sockets : [...sockets, ...missingSockets.map((id) => oldSockets.get(id)!)],
  hotspots: (existing.hotspots ?? []).filter((h) => !prune || keepIds.has(h.componentId)),
  poses: Object.fromEntries(
    Object.entries(existing.poses ?? { assembled: {} }).map(([pose, parts]) => [
      pose,
      prune ? Object.fromEntries(Object.entries(parts).filter(([id]) => keepIds.has(id))) : parts,
    ]),
  ),
};

/** Like JSON.stringify(v, null, 2), but any array or object that fits in ~100 columns stays on one line. */
function format(v: unknown, indent = ""): string {
  const inline = (x: unknown): string =>
    Array.isArray(x)
      ? `[${x.map(inline).join(", ")}]`
      : x && typeof x === "object"
        ? Object.keys(x).length
          ? `{ ${Object.entries(x).map(([k, y]) => `${JSON.stringify(k)}: ${inline(y)}`).join(", ")} }`
          : "{}"
        : JSON.stringify(x);
  const one = inline(v);
  if (!v || typeof v !== "object" || indent.length + one.length <= 100) return one;
  const inner = `${indent}  `;
  const lines = Array.isArray(v)
    ? v.map((x) => inner + format(x, inner))
    : Object.entries(v).map(([k, x]) => `${inner}${JSON.stringify(k)}: ${format(x, inner)}`);
  return Array.isArray(v) ? `[\n${lines.join(",\n")}\n${indent}]` : `{\n${lines.join(",\n")}\n${indent}}`;
}

writeFileSync(manifestPath, `${format(manifest)}\n`);
console.log(`wrote ${manifestPath}: ${manifest.components.length} components, ${manifest.sockets.length} sockets`);
console.log(`scenery (rendered, not interactable): ${scenery.join(", ") || "none"}`);
if (missingComponents.length || missingSockets.length) {
  console.log(
    `${prune ? "pruned" : "NOT IN GLB (re-run with --prune to remove)"}: ${[...missingComponents, ...missingSockets].join(", ")}`,
  );
}
