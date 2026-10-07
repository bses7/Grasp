"use client";

/**
 * Instruction line plus the outcome of the last attempt (doc 11 "Feedback" and its vocabulary table).
 * Outcome is always icon shape + text + colour, never colour alone: check in a circle (success),
 * half-filled circle (partial), cross in a circle (error), never a large red X.
 * The engine decides the outcome; this card only shows it.
 */
import type { Outcome } from "@grasp/types";

export type FeedbackCardProps = {
  prompt: string | null;
  attempt: { n: number; max: number } | null;
  feedback: { outcome: Outcome; text: string } | null;
};

const ROLE: Record<Outcome, { color: string; label: string }> = {
  correct: { color: "var(--success)", label: "Correct" },
  partial: { color: "var(--partial)", label: "Partly right" },
  incorrect: { color: "var(--error)", label: "Not quite" },
};

function OutcomeIcon({ outcome }: { outcome: Outcome }) {
  const c = ROLE[outcome].color;
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden fill="none" stroke={c} strokeWidth="2.5">
      <circle cx="12" cy="12" r="10" />
      {outcome === "correct" && <path d="M7 12.5l3.2 3.2L17 9" strokeLinecap="round" strokeLinejoin="round" />}
      {outcome === "partial" && <path d="M12 2a10 10 0 0 1 0 20z" fill={c} stroke="none" />}
      {outcome === "incorrect" && <path d="M8.5 8.5l7 7M15.5 8.5l-7 7" strokeLinecap="round" />}
    </svg>
  );
}

export function FeedbackCard({ prompt, attempt, feedback }: FeedbackCardProps) {
  return (
    <div className="pointer-events-none absolute top-3 left-1/2 w-[min(36rem,90%)] -translate-x-1/2 rounded-lg bg-black/70 px-4 py-3 text-white shadow-lg">
      <p className="text-base">{prompt ?? "All parts placed. Lesson complete."}</p>
      {attempt && (
        <p className="mt-1 font-mono text-xs text-white/70">
          attempt {Math.min(attempt.n + 1, attempt.max)} of {attempt.max}
        </p>
      )}
      <div role="status" aria-live="polite" className="mt-2 min-h-6">
        {feedback && (
          <p className="flex items-center gap-2 text-sm" style={{ color: ROLE[feedback.outcome].color }}>
            <OutcomeIcon outcome={feedback.outcome} />
            <span>
              <b>{ROLE[feedback.outcome].label}.</b> <span className="text-white">{feedback.text}</span>
            </span>
          </p>
        )}
      </div>
    </div>
  );
}
