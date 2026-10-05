/**
 * ARIA live region for feedback and hint announcements (docs/11 accessibility;
 * docs/03 Zustand checklist point 4). Outcomes are announced on discrete
 * events only, never per frame.
 * TODO Phase D M8 (place check and feedback): announce EvaluationResult text.
 */
export function LiveRegion({ politeness = "polite" }: { politeness?: "polite" | "assertive" }) {
  return (
    <div
      role="status"
      aria-live={politeness}
      aria-atomic="true"
      data-todo="ui/live-region: Phase D M8"
    />
  );
}
