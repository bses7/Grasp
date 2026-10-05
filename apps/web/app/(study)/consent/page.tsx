import { ConsentForm } from "@/components/screens/consent-form";

/** Consent before camera; light theme because this is a text screen (docs/11). */
export default function ConsentPage() {
  return (
    <main className="mx-auto max-w-2xl p-8" data-theme="light">
      <h1 className="text-3xl font-semibold">Consent</h1>
      <p className="mt-4 text-sm">
        TODO Phase D, doc 13 Phase 4 (research-protocol consent flow): render the
        consent text, record consent version, then POST /api/session.
      </p>
      <ConsentForm />
    </main>
  );
}
