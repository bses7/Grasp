type DevModelPageProps = { params: Promise<{ id: string }> };

/**
 * Content review page for a model manifest (docs/10 authoring workflow).
 * Excluded from production by the redirect in next.config.ts.
 */
export default async function DevModelPage({ params }: DevModelPageProps) {
  const { id } = await params;
  return (
    <main className="h-screen p-8">
      <h1 className="text-3xl font-semibold">Model review: {id}</h1>
      <p className="mt-4 text-sm text-text-muted">
        TODO Phase D M9 (docs/10, docs/17): load models/{id}.json, list
        components, sockets, hotspots and poses next to the rendered GLB.
      </p>
    </main>
  );
}
