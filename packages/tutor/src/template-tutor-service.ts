import type { Component, Lesson, ModelManifest, Socket, Task, TutorRequest, TutorResponse } from "@grasp/types";
import { MAX_HINT_CHARS } from "./constants";
import { parseTutorResponse } from "./response-schema";
import {
  HINT_FALLBACK,
  MISTAKE_TEMPLATES,
  NARROW_CLAUSES,
  PLACEHOLDER_RE,
  REVEAL_TEMPLATES,
  SEQUENCE_START_TEMPLATE,
  fillTemplate,
  type NarrowKey,
  type Placeholder,
} from "./templates";
import type { TutorService } from "./tutor-service";

export type TemplateTutorServiceOptions = {
  /** Loaded by the caller from @grasp/content by req.lessonId; the request never supplies vocabulary. */
  manifest: ModelManifest;
  lesson: Lesson;
};

/**
 * MVP TutorService: deterministic templates resolved from manifest data
 * (doc 07 "The template tutor"). Pure, no I/O. It runs inside the /api/tutor
 * route handler, which validates the request, enforces the call caps, writes
 * the ai_interactions row, and returns the response. summarise (optional, V1)
 * is not implemented here.
 *
 * The task is always the lesson's own (looked up by req.task.id), never the
 * request body's copy, so a forged prompt or expect cannot reach the text.
 * Every response goes through parseTutorResponse and the guardrail check; a
 * throw means the route serves the static hint (status fallback_invalid).
 *
 * Invariants: never grades, never sees video or landmarks, never names a
 * component outside the manifest, identical output for identical requests.
 */
export class TemplateTutorService implements TutorService {
  private readonly manifest: ModelManifest;
  private readonly lesson: Lesson;

  constructor(options: TemplateTutorServiceOptions) {
    this.manifest = options.manifest;
    this.lesson = options.lesson;
  }

  /** Return the authored hint at req.hintLevel, or HINT_FALLBACK for tutor: true without text. */
  async hint(req: TutorRequest): Promise<TutorResponse> {
    const task = this.task(req.task.id);
    const h = task.hints.find((x) => x.level === req.hintLevel);
    const text = h?.text ?? fillTemplate(HINT_FALLBACK, { prompt: task.prompt });
    return this.finish({ kind: "hint", text, referencedComponentIds: [], highlight: h?.highlight ?? [], revealsAnswer: req.hintLevel === 3 });
  }

  /** Body for what the learner did; level 2 adds a narrowing clause, level 3 the reveal sentence and highlight. */
  async explainMistake(req: TutorRequest): Promise<TutorResponse> {
    const ev = req.evaluation;
    if (!ev || ev.outcome === "correct") throw new Error("explainMistake needs an incorrect or partial evaluation");
    const task = this.task(req.task.id);
    const level = req.hintLevel;
    const sel = this.component(ev.actual.componentId);
    const { exp, socket, stepNo } = this.expected(task, ev.stepNo);
    const prior = task.type === "sequence" && stepNo > 1 ? this.component(task.expect.steps[stepNo - 2]!.componentId) : undefined;

    // In a place partial the part is right and only the socket is the answer, so naming the part reveals nothing.
    const answerIsPart = !(task.type === "place" && ev.outcome === "partial");
    // A description that names the answer would leak it below level 3 (doc 07 worked example 5).
    const leaks = answerIsPart && sel.description.toLowerCase().includes(exp.name.toLowerCase());
    const values: Partial<Record<Placeholder, string>> = {
      selectedName: sel.name,
      selectedDescription: level < 3 && leaks ? "" : sel.description,
      prompt: task.prompt,
      stepNo: String(stepNo),
      ...(prior && { priorStepName: prior.name }),
      ...(task.type === "compare" && { attribute: task.expect.attribute.replaceAll("_", " ") }),
      ...(ev.actual.socketId && { socketRegion: this.region(this.socket(ev.actual.socketId)) }),
    };

    const body = task.type === "sequence" && stepNo === 1 ? SEQUENCE_START_TEMPLATE : MISTAKE_TEMPLATES[task.type][ev.outcome];
    const parts = [fillTemplate(body, values)];
    if (level === 2) {
      // Sequence narrows from the last right step ("follow the flow one step on"); the tag contrast is always the chosen part's.
      const from = prior ?? sel;
      const tags = tagContrast(sel, exp);
      const key = relationKey(from, exp) ?? (tags ? "tag_contrast" : "none");
      parts.push(fillTemplate(NARROW_CLAUSES[key], { ...values, ...tags, selectedName: from.name }));
    }
    const refs = [sel.id, ...(prior ? [prior.id] : [])];
    let highlight: string[] = [];
    if (level === 3) {
      parts.push(fillTemplate(REVEAL_TEMPLATES[task.type], { ...values, expectedName: exp.name, ...(socket && { restRegion: this.region(socket) }) }));
      refs.push(exp.id);
      highlight = [exp.id];
    }
    const text = parts.join(" ").replace(/\s+/g, " ").trim();
    const res = this.finish({ kind: "explain_mistake", text, referencedComponentIds: [...new Set(refs)], highlight, revealsAnswer: level === 3 });
    if (level < 3) {
      if (res.revealsAnswer || res.highlight.length) throw new Error("reveal below level 3");
      // The quoted task prompt may name the answer; the learner is already reading it.
      const own = res.text.replaceAll(task.prompt, "").toLowerCase();
      if (answerIsPart && own.includes(exp.name.toLowerCase())) throw new Error(`names ${exp.id} below level 3`);
    }
    return res;
  }

  /** Truncate, schema-check, and reject unresolved placeholders or ids outside the manifest (doc 07 "Guardrails"). */
  private finish(raw: TutorResponse): TutorResponse {
    const res = parseTutorResponse({ ...raw, text: truncate(raw.text) });
    if (res.text.match(PLACEHOLDER_RE)) throw new Error(`unresolved placeholder in "${res.text}"`);
    const ids = new Set(this.manifest.components.map((c) => c.id));
    for (const id of [...res.referencedComponentIds, ...res.highlight]) if (!ids.has(id)) throw new Error(`unknown component ${id}`);
    return res;
  }

  private task(id: string): Task {
    const t = this.lesson.activities.flatMap((a) => a.tasks).find((x) => x.id === id);
    if (!t) throw new Error(`unknown task ${id}`);
    return t;
  }

  private component(id: string | undefined): Component {
    const c = this.manifest.components.find((x) => x.id === id);
    if (!c) throw new Error(`unknown component ${id}`);
    return c;
  }

  private socket(id: string): Socket {
    const s = this.manifest.sockets.find((x) => x.id === id);
    if (!s) throw new Error(`unknown socket ${id}`);
    return s;
  }

  /** The answer component, its socket for place and remove, and the step number for sequence (1-based). */
  private expected(task: Task, stepNo = 1): { exp: Component; socket?: Socket; stepNo: number } {
    switch (task.type) {
      case "identify": {
        const ids = task.expect.componentId;
        return { exp: this.component(Array.isArray(ids) ? ids[0] : ids), stepNo };
      }
      case "place":
        return { exp: this.component(task.expect.componentId), socket: this.socket(task.expect.socketId), stepNo };
      case "remove":
        return { exp: this.component(task.expect.componentId), stepNo };
      case "compare":
        return { exp: this.component(task.expect.answer), stepNo };
      case "sequence": {
        const step = task.expect.steps[stepNo - 1] ?? task.expect.steps[0]!;
        return { exp: this.component(step.componentId), stepNo: task.expect.steps[stepNo - 1] ? stepNo : 1 };
      }
    }
  }

  /**
   * "upper patient's left" from the socket position (doc 07 placeholders): manifests are authored in anterior
   * view, so +x is the patient's left and +y superior.
   */
  private region(s: Socket): string {
    const [x, y] = s.transform.position;
    return `${y >= 0 ? "upper" : "lower"} ${x >= 0 ? "patient's left" : "patient's right"} region`;
  }
}

/** First manifest relation from `from` to `to` (connects_to in either direction), or null. */
function relationKey(from: Component, to: Component): NarrowKey | null {
  const has = (c: Component, type: string, target: string) => c.relations?.some((r) => r.type === type && r.target === target);
  if (has(from, "opposite_of", to.id) || has(to, "opposite_of", from.id)) return "opposite_of";
  if (has(from, "connects_to", to.id)) return "connects_to";
  if (has(to, "connects_to", from.id)) return "connects_from";
  if (has(from, "contains", to.id)) return "contains";
  return null;
}

/** First tag only on the chosen part and first tag only on the answer, underscores to spaces; null when either is missing. */
function tagContrast(a: Component, b: Component): { selectedTag: string; expectedTag: string } | null {
  const sa = a.tags.find((t) => !b.tags.includes(t));
  const eb = b.tags.find((t) => !a.tags.includes(t));
  return sa && eb ? { selectedTag: sa.replaceAll("_", " "), expectedTag: eb.replaceAll("_", " ") } : null;
}

/** Cap at MAX_HINT_CHARS, cutting at the last sentence end that fits. */
function truncate(text: string): string {
  if (text.length <= MAX_HINT_CHARS) return text;
  const cut = text.slice(0, MAX_HINT_CHARS);
  const end = cut.lastIndexOf(". ");
  return end > 0 ? cut.slice(0, end + 1) : cut;
}
