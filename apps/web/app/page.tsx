import Link from "next/link";

/** Landing page. Links into the participant flow; consent comes before camera. */
export default function HomePage() {
  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="text-4xl font-semibold">Grasp</h1>
      <p className="mt-4 text-text-muted">
        Learn the human heart by moving its parts with your hands.
      </p>
      <p className="mt-6">
        <Link href="/consent" className="text-accent underline">
          Start: read the consent form
        </Link>
      </p>
      <p className="mt-8 text-sm text-text-muted">
        TODO Phase D M0 (docs/17): this page becomes the prototype scene entry.
      </p>
    </main>
  );
}
