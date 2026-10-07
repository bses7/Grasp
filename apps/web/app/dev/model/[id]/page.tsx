import { loadManifest, MANIFEST_IDS } from "@grasp/content";
import { notFound } from "next/navigation";
import { ReviewClient } from "./review-client";

type DevModelPageProps = { params: Promise<{ id: string }> };

/**
 * Content review page for a model manifest (docs/10 authoring workflow, doc 17 M9).
 * Excluded from production by the redirect in next.config.ts.
 */
export default async function DevModelPage({ params }: DevModelPageProps) {
  const { id } = await params;
  if (!MANIFEST_IDS.includes(id)) notFound();
  const manifest = loadManifest(id);
  return (
    <ReviewClient
      modelId={id}
      components={manifest.components.map((c) => ({ id: c.id, name: c.name }))}
    />
  );
}
