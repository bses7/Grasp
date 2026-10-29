import Link from "next/link";

/** Landing page: one card on the sage backdrop (doc 11). Links into the participant flow; consent comes before camera. */
export default function HomePage() {
  return (
    <main className="grid min-h-screen place-items-center px-4">
      <div className="card max-w-xl p-8 text-center">
        <h1 className="font-display text-[40px] leading-[48px] font-extrabold">Grasp</h1>
        <p className="mt-3 text-text-muted">Learn the human heart by moving its parts with your hands.</p>
        <Link href="/consent" className="btn mt-6">
          Start: read the consent form
        </Link>
        {process.env.NODE_ENV !== "production" && (
          <p className="mt-6 text-sm text-text-muted">
            Developer: <Link href="/prototype" className="underline">prototype scene</Link> (docs/17).
          </p>
        )}
      </div>
    </main>
  );
}
