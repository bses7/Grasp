/**
 * Copies self-hosted runtime assets into apps/web/public (docs/15 "Dependency pinning", doc 17 M0):
 *   - MediaPipe WASM from the installed @mediapipe/tasks-vision  -> public/mediapipe/<version>/wasm/
 *   - hand_landmarker.task, downloaded once from its pinned URL -> public/mediapipe/<version>/
 *   - Draco decoder from the installed three                    -> public/draco/
 *   - compressed models from models/<id>/*.glb                  -> public/models/<id>/
 * Idempotent: skips the download when the file exists. Runs before `pnpm dev` and `pnpm build`,
 * so the app itself never fetches from a third-party origin at runtime.
 */
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  HAND_LANDMARKER_TASK_SOURCE,
  MEDIAPIPE_VERSION,
} from "../../packages/vision/src/assets";

const root = resolve(import.meta.dirname, "../..");
const pub = join(root, "apps/web/public");

/** pnpm links each workspace package's own dependencies under its node_modules. */
function packageDir(fromPackage: string, name: string): string {
  const dir = join(root, fromPackage, "node_modules", name);
  if (!existsSync(dir)) throw new Error(`${name} not installed under ${fromPackage}; run pnpm install`);
  return dir;
}

// MediaPipe: resolve from packages/vision, not the root, because drei pulls in an older copy.
const mpDir = packageDir("packages/vision", "@mediapipe/tasks-vision");
const installed = JSON.parse(readFileSync(join(mpDir, "package.json"), "utf8")).version;
if (installed !== MEDIAPIPE_VERSION) {
  throw new Error(
    `@mediapipe/tasks-vision ${installed} is installed but packages/vision/src/assets.ts pins ${MEDIAPIPE_VERSION}; update both together`,
  );
}
const mpOut = join(pub, "mediapipe", MEDIAPIPE_VERSION);
cpSync(join(mpDir, "wasm"), join(mpOut, "wasm"), { recursive: true });

const taskPath = join(mpOut, "hand_landmarker.task");
if (!existsSync(taskPath)) {
  const res = await fetch(HAND_LANDMARKER_TASK_SOURCE);
  if (!res.ok) throw new Error(`hand_landmarker.task download failed: HTTP ${res.status}`);
  writeFileSync(taskPath, Buffer.from(await res.arrayBuffer()));
  console.log(`downloaded ${HAND_LANDMARKER_TASK_SOURCE}`);
}

const dracoSrc = join(packageDir("packages/scene", "three"), "examples/jsm/libs/draco/gltf");
mkdirSync(join(pub, "draco"), { recursive: true });
for (const f of ["draco_decoder.js", "draco_decoder.wasm", "draco_wasm_wrapper.js"]) {
  cpSync(join(dracoSrc, f), join(pub, "draco", f));
}

// Compressed models: models/<id>/*.glb (committed) -> public/models/<id>/ (served at NEXT_PUBLIC_ASSET_BASE_URL).
const models: string[] = [];
for (const id of readdirSync(join(root, "models"), { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name)) {
  for (const f of readdirSync(join(root, "models", id)).filter((f) => f.endsWith(".glb"))) {
    mkdirSync(join(pub, "models", id), { recursive: true });
    cpSync(join(root, "models", id, f), join(pub, "models", id, f));
    models.push(`${id}/${f}`);
  }
}

console.log(`assets synced: mediapipe ${MEDIAPIPE_VERSION}, draco, models ${models.join(", ") || "(none)"}`);
