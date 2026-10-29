import { loadLesson } from "@grasp/content";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LessonClient } from "./lesson-client";

type LessonPageProps = { params: Promise<{ lessonId: string }> };

export const metadata: Metadata = { title: "Lesson · Grasp" };

/**
 * The learning environment (doc 11): LessonScene from @grasp/scene, the engine from @grasp/learning, and the HUD.
 * Next 16: `params` is a Promise and must be awaited. `?input=mouse` selects the mouse condition.
 */
export default async function LessonPage({ params }: LessonPageProps) {
  const { lessonId } = await params;
  try {
    loadLesson(lessonId);
  } catch {
    notFound();
  }
  return <LessonClient lessonId={lessonId} />;
}
