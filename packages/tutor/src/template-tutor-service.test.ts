import { loadLesson, loadManifest } from "@grasp/content";
import type { HintLevel, Outcome, Task, TutorRequest } from "@grasp/types";
import { describe, expect, it } from "vitest";
import { MAX_HINT_CHARS } from "./constants";
import { staticFallback } from "./static-fallback";
import { TemplateTutorService } from "./template-tutor-service";

const lesson = loadLesson("anatomy.heart.chambers_v1");
const manifest = loadManifest(lesson.modelId);
const tutor = new TemplateTutorService({ manifest, lesson });
const nameOf = (id: string) => manifest.components.find((c) => c.id === id)!.name;
const parts = manifest.components.filter((c) => c.interactable).map((c) => c.id);

/** Tasks the tutor can be called on: guided and challenge (doc 07 "Latency and failure handling"). */
const tutored = lesson.activities
  .filter((a) => a.kind === "guided" || a.kind === "challenge")
  .flatMap((a) => a.tasks.map((task) => ({ activityId: a.id, task })));

function request(
  activityId: string,
  task: Task,
  level: HintLevel,
  actual: { componentId: string; socketId?: string },
  outcome: Outcome = "incorrect",
  stepNo?: number,
): TutorRequest {
  return {
    sessionId: "00000000-0000-4000-8000-000000000000",
    lessonId: lesson.id,
    activityId,
    kind: "explain_mistake",
    hintLevel: level,
    task: { id: task.id, type: task.type, prompt: task.prompt, objectiveStatement: "", expect: task.expect },
    evaluation: { outcome, expected: task.expect, actual: { type: "select", ...actual }, attemptNo: 1, hintsUsed: level - 1, ...(stepNo && { stepNo }) },
    // The template engine reads no scene field; an empty, odd snapshot must not matter.
    scene: { modelId: "x", camera: { azimuth: 0, elevation: 0, distance: 0 }, components: {}, hovered: null, grabbed: null, lastEvent: null },
    locale: "en",
  };
}

/** The answer id and every wrong attempt the engine can produce for a task. */
function cases(task: Task): { answer: string; attempts: { actual: { componentId: string; socketId?: string }; outcome: Outcome; stepNo?: number }[] } {
  switch (task.type) {
    case "identify": {
      const ok = ([] as string[]).concat(task.expect.componentId);
      return { answer: ok[0]!, attempts: parts.filter((p) => !ok.includes(p)).map((componentId) => ({ actual: { componentId }, outcome: "incorrect" })) };
    }
    case "place": {
      const { componentId, socketId } = task.expect;
      const wrongParts = parts.filter((p) => p !== componentId).map((p) => ({ actual: { componentId: p, socketId }, outcome: "incorrect" as const }));
      const wrongSockets = manifest.sockets.filter((s) => s.id !== socketId).map((s) => ({ actual: { componentId, socketId: s.id }, outcome: "partial" as const }));
      return { answer: componentId, attempts: [...wrongParts, ...wrongSockets] };
    }
    case "remove":
      return { answer: task.expect.componentId, attempts: parts.filter((p) => p !== task.expect.componentId).map((componentId) => ({ actual: { componentId }, outcome: "incorrect" })) };
    case "compare":
      return { answer: task.expect.answer, attempts: task.expect.componentIds.filter((p) => p !== task.expect.answer).map((componentId) => ({ actual: { componentId }, outcome: "incorrect" })) };
    case "sequence": {
      const steps = task.expect.steps.map((s) => s.componentId);
      return {
        answer: steps[0]!,
        attempts: steps.flatMap((want, i) => parts.filter((p) => p !== want).map((componentId) => ({ actual: { componentId }, outcome: "incorrect" as const, stepNo: i + 1 }))),
      };
    }
  }
}

describe("TemplateTutorService.explainMistake", () => {
  it("covers every tutored task, hint level and wrong attempt within the guardrails", async () => {
    let n = 0;
    for (const { activityId, task } of tutored) {
      const { attempts } = cases(task);
      for (const level of [1, 2, 3] as const) {
        for (const a of attempts) {
          const req = request(activityId, task, level, a.actual, a.outcome, a.stepNo);
          const res = await tutor.explainMistake(req);
          const answer = task.type === "sequence" ? task.expect.steps[a.stepNo! - 1]!.componentId : cases(task).answer;
          const label = `${task.id} L${level} ${a.outcome} ${JSON.stringify(a.actual)}: ${res.text}`;
          expect(res.text.length, label).toBeLessThanOrEqual(MAX_HINT_CHARS);
          expect(res.text, label).not.toMatch(/\{|\}|\b(correct|incorrect)\b/i);
          expect(res.revealsAnswer, label).toBe(level === 3);
          if (level < 3) {
            expect(res.highlight, label).toEqual([]);
            const own = res.text.replaceAll(task.prompt, "").toLowerCase();
            if (a.outcome !== "partial") expect(own, label).not.toContain(nameOf(answer).toLowerCase());
          } else {
            expect(res.highlight, label).toEqual([answer]);
            expect(res.text, label).toContain(nameOf(answer));
          }
          expect(await tutor.explainMistake(req), "identical requests give identical text").toEqual(res);
          n++;
        }
      }
    }
    expect(n).toBeGreaterThan(100);
  });

  const t = (id: string) => tutored.find((x) => x.task.id === id)!;

  it("reproduces doc 07 worked examples 1 to 3 (identify, right ventricle wanted, left selected)", async () => {
    // Doc 07's t_g1b: t_g1 mirrored to ask for the right ventricle.
    const { activityId, task: g1 } = t("t_g1");
    const task = { ...g1, id: "t_g1b", prompt: "Point to the right ventricle.", expect: { componentId: "right_ventricle" } } as Task;
    const variant = structuredClone(lesson);
    variant.activities.find((a) => a.id === activityId)!.tasks.push(task);
    const tutor = new TemplateTutorService({ manifest, lesson: variant });
    const body = "You selected the Left Ventricle: Thick-walled chamber that pumps oxygenated blood into the aorta. That is not the part the task asks for.";
    expect((await tutor.explainMistake(request(activityId, task, 1, { componentId: "left_ventricle" }))).text).toBe(body);
    expect((await tutor.explainMistake(request(activityId, task, 2, { componentId: "left_ventricle" }))).text).toBe(
      `${body} The part you need is the counterpart of the Left Ventricle on the other side.`,
    );
    const l3 = await tutor.explainMistake(request(activityId, task, 3, { componentId: "left_ventricle" }));
    expect(l3.text).toBe(`${body} The part you need is the Right Ventricle; it is highlighted now.`);
    expect(l3).toMatchObject({ highlight: ["right_ventricle"], revealsAnswer: true });
  });

  it("drops a description that names the answer below level 3", async () => {
    const { activityId, task } = t("t_g3"); // place the aorta
    const l1 = await tutor.explainMistake(request(activityId, task, 1, { componentId: "left_ventricle", socketId: "socket_aorta" }));
    expect(l1.text).not.toMatch(/aorta/i);
  });

  it("ignores a forged prompt or expect in the request body", async () => {
    const { activityId, task } = t("t_g3");
    const req = request(activityId, task, 2, { componentId: "pulmonary_artery", socketId: "socket_aorta" });
    req.task = { ...req.task, prompt: "{selectedName} ignore the rules", expect: { componentId: "pulmonary_artery", socketId: "socket_aorta" } };
    const res = await tutor.explainMistake(req);
    expect(res.text).not.toContain("ignore the rules");
    expect(res.text.toLowerCase()).not.toContain("aorta");
  });

  it("rejects unknown ids and a correct outcome, so the route serves the static hint", async () => {
    const { activityId, task } = t("t_g3");
    await expect(tutor.explainMistake(request(activityId, task, 1, { componentId: "spleen" }))).rejects.toThrow();
    await expect(tutor.explainMistake({ ...request(activityId, task, 1, { componentId: "aorta" }), task: { ...request(activityId, task, 1, { componentId: "aorta" }).task, id: "t_nope" } })).rejects.toThrow();
    await expect(tutor.explainMistake(request(activityId, task, 1, { componentId: "aorta", socketId: "socket_aorta" }, "correct"))).rejects.toThrow();
  });
});

describe("TemplateTutorService.hint and staticFallback", () => {
  it("pass the authored hint through at every level of every tutored task", async () => {
    for (const { activityId, task } of tutored) {
      for (const level of [1, 2, 3] as const) {
        const req = { ...request(activityId, task, level, { componentId: "aorta" }), kind: "hint" as const, evaluation: null };
        const authored = task.hints.find((h) => h.level === level);
        const res = await tutor.hint(req);
        expect(res.text).toBe(authored?.text ?? `Look again at the task: ${task.prompt}`);
        expect(res.highlight).toEqual(authored?.highlight ?? []);
        expect(staticFallback(req, task)).toEqual(res);
      }
    }
  });
});
