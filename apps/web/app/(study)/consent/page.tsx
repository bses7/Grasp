import type { Metadata } from "next";
import { ConsentForm } from "@/components/screens/consent-form";

export const metadata: Metadata = { title: "Consent · Grasp" };

/** Consent before camera (doc 14 section 7); light theme because this is a text screen (docs/11). */
export default function ConsentPage() {
  return (
    <main className="min-h-screen px-4 py-8 text-text">
      <div className="card mx-auto max-w-2xl p-8">
        <ConsentForm />
      </div>
    </main>
  );
}
