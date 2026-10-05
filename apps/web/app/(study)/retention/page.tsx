/** Retention session (+7 days), keyed by the participant's printed session code. */
export default function RetentionPage() {
  return (
    <main className="mx-auto max-w-2xl p-8" data-theme="light">
      <h1 className="text-3xl font-semibold">Retention test</h1>
      <p className="mt-4 text-sm">
        TODO Phase E (docs/03 session lifecycle, docs/14): enter session code,
        GET /api/session/:code, then redirect to /test/retention.
      </p>
    </main>
  );
}
