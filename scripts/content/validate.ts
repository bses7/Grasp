/**
 * Content validator (doc 10 "Authoring workflow"; lesson-schema skill section 8). Run by CI as `pnpm content:validate`.
 * Phase C: loads every manifest and lesson JSON under content/ and prints their ids, so the path is exercised.
 * Phase D adds the Zod parse from @grasp/content and the cross-reference checklist (socket ids, objectives,
 * GLB mesh names, narration length). Zero files is not an error: content/ is authored by another agent in parallel.
 */
import { readdir, readFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

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

async function checkFile(file: string, kind: string): Promise<void> {
  const rel = relative(root, file).replace(/\\/g, "/");
  try {
    const data = JSON.parse(await readFile(file, "utf8")) as { id?: unknown };
    if (typeof data.id !== "string" || data.id.length === 0) {
      console.error(`FAIL ${rel}: missing string "id"`);
      failures += 1;
      return;
    }
    console.log(`${kind} ${data.id}  (${rel})`);
  } catch (err) {
    console.error(`FAIL ${rel}: ${(err as Error).message}`);
    failures += 1;
  }
}

async function main(): Promise<void> {
  const manifests = await listJson(join(root, "content", "models"), false);
  const lessons = await listJson(join(root, "content", "lessons"), true);
  for (const file of manifests) await checkFile(file, "manifest");
  for (const file of lessons) await checkFile(file, "lesson  ");
  console.log(`${manifests.length} manifest(s), ${lessons.length} lesson(s), ${failures} failure(s)`);
  console.log("TODO Phase D: Zod parse and the lesson-schema section 8 cross-reference checklist (doc 10)");
  process.exit(failures > 0 ? 1 : 0);
}

void main();
