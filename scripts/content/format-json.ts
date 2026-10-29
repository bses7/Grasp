/**
 * Content JSON style: 2-space indent, but any array or object that fits in ~100 columns stays on one line,
 * the way manifests and lessons are written by hand. Used by the scaffold script, and runnable on files:
 *
 *   pnpm content:format content/lessons/anatomy/heart/chambers_v1.json [more files...]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export function formatJson(v: unknown, indent = ""): string {
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
    ? v.map((x) => inner + formatJson(x, inner))
    : Object.entries(v).map(([k, x]) => `${inner}${JSON.stringify(k)}: ${formatJson(x, inner)}`);
  return Array.isArray(v) ? `[\n${lines.join(",\n")}\n${indent}]` : `{\n${lines.join(",\n")}\n${indent}}`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  for (const file of process.argv.slice(2)) {
    writeFileSync(file, `${formatJson(JSON.parse(readFileSync(file, "utf8")))}\n`);
    console.log(`formatted ${file}`);
  }
}
