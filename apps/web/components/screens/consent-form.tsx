"use client";

/**
 * Consent form (doc 14 section 7, research-protocol consent skeleton): the versioned consent text, agreement to take
 * part, a separate opt-in for the event log, and the researcher-entered session code. Agreeing creates the session
 * and its consent record (POST /api/session), then opens the lesson in the condition the code encodes. Declining
 * ends on a plain exit screen; nothing is stored. The camera is only requested on the lesson page, after this.
 */
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ApiError, createSession } from "@/lib/api-client";
import { CONSENT_TEXT, CONSENT_TITLE, CONSENT_VERSION, parseAssignmentCode } from "@/lib/consent";

const LESSON_ID = "anatomy.heart.chambers_v1";

export function ConsentForm() {
  const router = useRouter();
  const [agree, setAgree] = useState(false);
  const [logging, setLogging] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [declined, setDeclined] = useState(false);

  if (declined) {
    return (
      <section>
        <h1 className="font-display text-[28px] leading-9 font-bold">Thank you</h1>
        <p className="mt-4">You did not agree to take part, so the lesson will not start and nothing was recorded. You can close this page.</p>
      </section>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const assignment = parseAssignmentCode(code);
    if (!assignment) return setError("That session code is not valid. Ask the researcher to check it.");
    setBusy(true);
    setError(null);
    try {
      const s = await createSession({ sessionId: crypto.randomUUID(), lessonId: LESSON_ID, assignmentCode: code, consent: { version: CONSENT_VERSION, logging } });
      try {
        // The lesson page resumes by cookie, then by this key; the flag lets it run unsaved if the database drops later.
        localStorage.setItem(`grasp.session.${LESSON_ID}.${s.condition}`, s.sessionId);
        sessionStorage.setItem("grasp.consent", CONSENT_VERSION);
        sessionStorage.setItem("grasp.consent.logging", logging ? "1" : "0");
      } catch {
        /* private mode: the cookie alone carries the session */
      }
      router.push(`/lesson/${LESSON_ID}${s.condition === "mouse" ? "?input=mouse" : ""}`);
    } catch (err) {
      setBusy(false);
      setError(
        err instanceof ApiError && err.status === 409
          ? "This session code was already used. Ask the researcher for the next one."
          : "Your consent could not be recorded right now, so the lesson cannot start. Please tell the researcher.",
      );
    }
  };

  return (
    <form onSubmit={submit}>
      <h1 className="font-display text-[28px] leading-9 font-bold">{CONSENT_TITLE}</h1>
      {CONSENT_TEXT.map((p) => (
        <p key={p} className="mt-4">
          {p}
        </p>
      ))}
      <p className="mt-4 text-sm text-text-muted">Consent version {CONSENT_VERSION}. The researcher has a paper copy for you to keep.</p>

      <label className="mt-6 flex items-start gap-3">
        <input type="checkbox" className="mt-1 size-5" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
        <span>I have read the above and agree to take part.</span>
      </label>
      <label className="mt-3 flex items-start gap-3">
        <input type="checkbox" className="mt-1 size-5" checked={logging} onChange={(e) => setLogging(e.target.checked)} />
        <span>I agree that a log of my actions in the lesson is recorded (optional; no video or images).</span>
      </label>

      <label className="mt-6 block">
        <span className="text-sm font-semibold">Session code (entered by the researcher)</span>
        <input
          className="mt-1 block w-40 rounded border border-text-muted bg-surface px-3 py-2 font-mono uppercase"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          autoComplete="off"
          spellCheck={false}
          required
        />
      </label>

      {error && (
        <p role="alert" className="mt-4 text-error">
          {error}
        </p>
      )}

      <div className="mt-6 flex gap-3">
        <button type="submit" disabled={!agree || busy} className="btn">
          {busy ? "Starting…" : "I agree, start"}
        </button>
        <button type="button" onClick={() => setDeclined(true)} className="btn btn-ghost">
          I do not agree
        </button>
      </div>
    </form>
  );
}
