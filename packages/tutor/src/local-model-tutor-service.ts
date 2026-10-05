import type { TutorRequest, TutorResponse } from "@grasp/types";
import type { TutorService } from "./tutor-service.js";

export type LocalModelTutorServiceOptions = {
  /** Base URL of the local model server, from TUTOR_LOCAL_URL in the caller's environment. Never a hosted host. */
  baseUrl: string;
  /** The local model's own identifier string, recorded as ai_interactions.engine = "local:<name>". */
  modelName: string;
};

/**
 * V1 TutorService backed by an open-weights model running on the lab laptop
 * (doc 07 "Tutor engine"). The /api/tutor route selects this engine only when
 * TUTOR_LOCAL_URL is set, which applies only to an app instance running on the
 * lab laptop that also runs the model; the hosted deployment always uses
 * TemplateTutorService. summarise (optional, V1) may be added here once gated.
 *
 * Gate before any study use (doc 07 "Tutor engine", measurement gate):
 * p95 hint latency under HINT_LATENCY_BUDGET_MS with MediaPipe and R3F live,
 * p5 frame rate at or above 30 fps, 100 percent guardrail pass on a 50-call
 * sample, and identical text for identical requests at temperature 0.
 *
 * Shape: one fetch to baseUrl with the messages from buildLocalModelMessages,
 * timeout HINT_LATENCY_BUDGET_MS, no retry; reply through parseTutorResponse
 * plus the text scans in doc 07 "Guardrails" (local model row). Any failure
 * rejects so the HUD keeps the static hint. No vendor-specific fields.
 */
export class LocalModelTutorService implements TutorService {
  private readonly baseUrl: string;
  private readonly modelName: string;

  constructor(options: LocalModelTutorServiceOptions) {
    this.baseUrl = options.baseUrl;
    this.modelName = options.modelName;
  }

  /** Engine label for the ai_interactions row. */
  get engine(): `local:${string}` {
    return `local:${this.modelName}`;
  }

  async hint(req: TutorRequest): Promise<TutorResponse> {
    void req;
    void this.baseUrl;
    throw new Error("TODO V1: LocalModelTutorService.hint (doc 07, Tutor engine gate)");
  }

  async explainMistake(req: TutorRequest): Promise<TutorResponse> {
    void req;
    throw new Error("TODO V1: LocalModelTutorService.explainMistake (doc 07, Tutor engine gate)");
  }
}
