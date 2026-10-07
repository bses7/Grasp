"use client";

/**
 * Pick a local .glb, see every part, click to isolate it, and map each GLB part to a manifest component id
 * (or leave it as scenery). The mapping downloads as <modelId>.mapping.json for the M9 rename step.
 * Nothing is uploaded: the file is parsed in the browser.
 */
import { ModelReviewCanvas, parseGlb } from "@grasp/scene";
import { DRACO_DECODER_URL } from "@grasp/vision";
import { useState } from "react";
import { downloadJson } from "@/lib/download";

type Props = { modelId: string; components: { id: string; name: string }[] };
type Loaded = { file: string; mb: number } & Awaited<ReturnType<typeof parseGlb>>;

export function ReviewClient({ modelId, components }: Props) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});

  async function open(file: File) {
    setError("");
    try {
      const { scene, parts } = await parseGlb(await file.arrayBuffer(), DRACO_DECODER_URL);
      setLoaded({ file: file.name, mb: file.size / 1e6, scene, parts });
      setSelected(null);
      setMapping({});
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  const mapped = Object.fromEntries(Object.entries(mapping).filter(([, v]) => v));
  const used = new Set(Object.values(mapped));
  const tris = loaded?.parts.reduce((s, p) => s + p.triangles, 0) ?? 0;

  function download() {
    const body = { modelId, sourceFile: loaded?.file, parts: mapped, scenery: loaded?.parts.map((p) => p.name).filter((n) => !mapped[n]) };
    downloadJson(`${modelId}.mapping.json`, body, 2);
  }

  return (
    <main className="grid h-screen grid-cols-[1fr_32rem]">
      <div className="relative min-h-0 bg-black">
        {loaded ? (
          <ModelReviewCanvas scene={loaded.scene} parts={loaded.parts} selected={selected} onSelect={setSelected} />
        ) : (
          <p className="p-8 text-text-muted">Choose a .glb file to review (for example content/source/heart_candidates/human_heart.glb).</p>
        )}
      </div>
      <aside className="flex min-h-0 flex-col gap-3 overflow-y-auto p-4 text-sm">
        <h1 className="text-xl font-semibold">Model review: {modelId}</h1>
        <input type="file" accept=".glb" aria-label="GLB file" onChange={(e) => e.target.files?.[0] && open(e.target.files[0])} />
        {error && <p className="text-error">{error}</p>}
        {loaded && (
          <>
            <p className="font-mono text-xs text-text-muted">
              {loaded.file}: {loaded.mb.toFixed(1)} MB, {loaded.parts.length} parts, {tris.toLocaleString()} triangles
              (budget: ≤ 5 MB compressed, ≤ 150k triangles)
            </p>
            <p className="text-xs text-text-muted">
              Click a row or a part in the view to isolate it; click empty space to show all. Drag to orbit, scroll to zoom.
            </p>
            <table className="w-full border-collapse font-mono text-xs">
              <thead>
                <tr className="text-left text-text-muted">
                  <th className="py-1">part</th>
                  <th>tris</th>
                  <th>size</th>
                  <th>component</th>
                </tr>
              </thead>
              <tbody>
                {loaded.parts.map((p) => (
                  <tr
                    key={p.object.uuid}
                    className={`cursor-pointer border-t border-white/10 ${selected === p.name ? "bg-accent/20" : ""}`}
                    onClick={() => setSelected(selected === p.name ? null : p.name)}
                  >
                    <td className="py-1 pr-2 break-all" title={p.materialName}>
                      {p.name}
                    </td>
                    <td className="pr-2">{p.triangles.toLocaleString()}</td>
                    <td className="pr-2 whitespace-nowrap">{p.size.map((v) => v.toPrecision(2)).join("×")}</td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <select
                        aria-label={`component for ${p.name}`}
                        className="bg-surface"
                        value={mapping[p.name] ?? ""}
                        onChange={(e) => setMapping((m) => ({ ...m, [p.name]: e.target.value }))}
                      >
                        <option value="">(scenery)</option>
                        {components.map((c) => (
                          <option key={c.id} value={c.id} disabled={used.has(c.id) && mapping[p.name] !== c.id}>
                            {c.id}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-xs text-text-muted">
              Not found in this file:{" "}
              {components
                .filter((c) => !used.has(c.id))
                .map((c) => c.id)
                .join(", ") || "none"}
            </p>
            <button type="button" className="self-start rounded bg-accent px-3 py-1 text-bg" onClick={download}>
              Download {modelId}.mapping.json
            </button>
          </>
        )}
      </aside>
    </main>
  );
}
