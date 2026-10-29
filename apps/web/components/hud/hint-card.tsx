"use client";

/**
 * Hint button and hint card, right gutter (doc 11 "Components": Hint button, Hint card; "hint shown" feedback row).
 * The button pulses for 3 s after an incorrect attempt or 15 s idle (failure states 4 and 6) and is absent in
 * assessment. The card tags "Hint n of 3" and shows filled versus hollow level bars, so colour is never the only
 * cue. No cost text: displaying hintPenalty is an open question for doc 06. highlight and cameraTo are scene
 * commands the page issues.
 */
import type { Hint } from "@grasp/types";

export type HintCardProps = {
  /** Levels the task authors; 0 hides the button. */
  levels: number;
  used: number;
  hint: Hint | null;
  pulse: boolean;
  onRequest: () => void;
};

export function HintCard({ levels, used, hint, pulse, onRequest }: HintCardProps) {
  if (levels === 0) return null;
  const left = levels - used;
  return (
    <div className="flex w-[300px] flex-col items-end gap-2">
      <button
        type="button"
        onClick={onRequest}
        disabled={left <= 0}
        aria-label={`Hint, ${left} left`}
        // Remount on each pulse so the 3-cycle animation replays.
        key={pulse ? "pulse" : "still"}
        className={`btn btn-ghost ${pulse && left > 0 ? "pulse3" : ""}`}
      >
        <svg aria-hidden width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
          <path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z" />
        </svg>
        Hint
      </button>
      <span className="rounded-full bg-surface px-2 text-xs text-text-muted">
        {left} {left === 1 ? "hint" : "hints"} left
      </span>
      {hint?.text && (
        <section role="status" className="card w-full p-4">
          <p className="text-xs font-semibold tracking-widest text-amber-ink uppercase">
            Hint {hint.level} of {levels}
          </p>
          <div aria-hidden className="mt-1.5 mb-2 flex gap-1">
            {Array.from({ length: levels }, (_, i) => (
              <span key={i} className={`h-1.5 w-7 rounded-full ${i < hint.level ? "bg-partial" : "border-[1.5px] border-text-muted"}`} />
            ))}
          </div>
          <p className="text-base">{hint.text}</p>
        </section>
      )}
    </div>
  );
}
