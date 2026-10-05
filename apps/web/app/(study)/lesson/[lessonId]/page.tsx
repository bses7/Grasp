type LessonPageProps = { params: Promise<{ lessonId: string }> };

/**
 * The lesson environment: LessonScene from @grasp/scene plus the HUD.
 * Next 16: `params` is a Promise and must be awaited.
 */
export default async function LessonPage({ params }: LessonPageProps) {
  const { lessonId } = await params;
  return (
    <main className="h-screen p-8">
      <h1 className="text-3xl font-semibold">Lesson: {lessonId}</h1>
      <p className="mt-4 text-sm text-text-muted">
        TODO Phase D M7-M8 (docs/17): mount LessonScene, HUD, and the learning
        engine for lesson anatomy.heart.chambers_v1.
      </p>
    </main>
  );
}
