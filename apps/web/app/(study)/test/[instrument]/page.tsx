type TestPageProps = { params: Promise<{ instrument: string }> };

/**
 * Study instruments: pre, post, sus, tlx, satisfaction (docs/14; forms live in
 * content/instruments/). Next 16: `params` is a Promise.
 */
export default async function TestPage({ params }: TestPageProps) {
  const { instrument } = await params;
  return (
    <main className="mx-auto max-w-2xl p-8" data-theme="light">
      <h1 className="text-3xl font-semibold">Instrument: {instrument}</h1>
      <p className="mt-4 text-sm">
        TODO Phase E (docs/14 instruments): render the form JSON and write
        instrument_responses rows.
      </p>
    </main>
  );
}
