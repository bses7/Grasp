import type { TutorRequest, TutorResponse } from "@grasp/types";
import type { TutorService } from "./tutor-service.js";

export type RemoteTutorServiceOptions = {
  /** Base URL of the Python service, from TUTOR_SERVICE_URL in the caller's environment. */
  baseUrl: string;
};

/**
 * V1/Future seam for a Python tutor service (doc 16 "The services seam",
 * doc 03 "The seam for a Python service"). The route handler selects this
 * implementation when TUTOR_SERVICE_URL is set, LocalModelTutorService when
 * TUTOR_LOCAL_URL is set, and TemplateTutorService otherwise. Same
 * TutorRequest in, same validated TutorResponse out.
 *
 * Not implemented in MVP. Locked position 1: a second deployable is justified
 * only by custom gesture-model training or Python-only inference. Whatever
 * runs behind it must also be free and self-hosted (project rule: no paid or
 * usage-billed services).
 */
export class RemoteTutorService implements TutorService {
  private readonly baseUrl: string;

  constructor(options: RemoteTutorServiceOptions) {
    this.baseUrl = options.baseUrl;
  }

  async hint(req: TutorRequest): Promise<TutorResponse> {
    void req;
    void this.baseUrl;
    throw new Error("TODO V1: RemoteTutorService.hint (doc 16, services seam)");
  }

  async explainMistake(req: TutorRequest): Promise<TutorResponse> {
    void req;
    throw new Error("TODO V1: RemoteTutorService.explainMistake (doc 16, services seam)");
  }
}
