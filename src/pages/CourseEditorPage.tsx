import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { motion } from "framer-motion";
import { ChevronLeft, BookOpen, Wand2, CheckCircle2, Clock, Layers, Video, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import ChapterList from "@/components/my-courses/ChapterList";
import { db } from "@/lib/db";
import { customCourseRepo } from "@/lib/customCourseRepository";
import { generateChapterContent } from "@/lib/aiService";
import { searchYoutubeVideo } from "@/lib/youtubeService";

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

/** Pause between chapters so Gemini / YouTube quotas are not hit all at once. */
const CHAPTER_STAGGER_MS = Math.max(
  0,
  parseInt(
    (import.meta as unknown as { env: Record<string, string> }).env?.VITE_CHAPTER_GEN_DELAY_MS ?? "7500",
    10
  ) || 0
);

export default function CourseEditorPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [generatedCount, setGeneratedCount] = useState(0);
  const [genLabel, setGenLabel] = useState("");
  const [lastError, setLastError] = useState<string | null>(null);
  const [runTotal, setRunTotal] = useState(0);

  const course = useLiveQuery(
    () => (courseId ? db.customCourses.get(courseId) : undefined),
    [courseId]
  );

  const existingChapters = useLiveQuery(
    () => (courseId ? customCourseRepo.getChapters(courseId) : Promise.resolve([])),
    [courseId]
  );

  const outlineChapterCount = course?.courseOutput?.chapters?.length ?? 0;
  const savedChapterCount = existingChapters?.length ?? 0;
  const coursePublished = course?.isPublished;

  // Fix isPublished when it was set incorrectly (e.g. old parallel generator).
  useEffect(() => {
    if (!courseId || existingChapters === undefined || !course) return;
    if (outlineChapterCount === 0) return;
    const done = savedChapterCount === outlineChapterCount;
    if (done === coursePublished) return;
    void customCourseRepo.update(courseId, { isPublished: done });
  }, [courseId, course, outlineChapterCount, savedChapterCount, coursePublished, existingChapters]);

  if (course === undefined) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 rounded-full border-4 border-accent border-t-transparent animate-spin" />
      </div>
    );
  }

  if (course === null) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground">Course not found.</p>
        <Button variant="link" onClick={() => navigate("/my-courses")}>Back to My Courses</Button>
      </div>
    );
  }

  const chapters = course.courseOutput?.chapters ?? [];
  const generatedIds = (existingChapters ?? []).map((c) => c.chapterId);
  const includeVideo = course.isVideo === "Yes";
  const missingIndices = chapters.map((_, i) => i).filter((i) => !generatedIds.includes(i));
  const allChaptersHaveContent = chapters.length > 0 && missingIndices.length === 0;

  const syncPublishedFlag = async () => {
    if (!courseId) return;
    const rows = await customCourseRepo.getChapters(courseId);
    const done = chapters.length > 0 && rows.length === chapters.length;
    await customCourseRepo.update(courseId, { isPublished: done });
  };

  /** Generate one chapter at a time, with optional delay between calls (reduces 429s). */
  const runChapterGeneration = async (indices: number[]) => {
    if (!courseId || indices.length === 0) return;
    setGenerating(true);
    setLastError(null);
    setProgress(0);
    setGeneratedCount(0);
    setGenLabel("");
    setRunTotal(indices.length);

    let completed = 0;
    const total = indices.length;

    try {
      for (let step = 0; step < indices.length; step++) {
        const index = indices[step];
        const chapter = chapters[index];
        if (!chapter) continue;

        setGenLabel(`Chapter ${index + 1}: ${chapter.chapter_name}`);
        try {
          const [content, videoId] = await Promise.all([
            generateChapterContent(course.courseName, chapter, includeVideo),
            includeVideo ? searchYoutubeVideo(`${course.courseName} ${chapter.chapter_name}`) : Promise.resolve(""),
          ]);
          await customCourseRepo.insertChapter({
            courseId,
            chapterId: index,
            content,
            videoId: videoId ?? "",
            updatedAt: Date.now(),
          });
        } catch (err) {
          console.error(`Chapter ${index} failed:`, err);
          const msg = err instanceof Error ? err.message : String(err);
          setLastError(msg);
          break;
        }

        completed += 1;
        setGeneratedCount(completed);
        setProgress(Math.round((completed / total) * 100));

        if (step < indices.length - 1 && CHAPTER_STAGGER_MS > 0) {
          setGenLabel(`Waiting ${Math.round(CHAPTER_STAGGER_MS / 1000)}s before next chapter (rate limits)…`);
          await sleep(CHAPTER_STAGGER_MS);
        }
      }

      await syncPublishedFlag();
    } finally {
      setGenerating(false);
      setGenLabel("");
    }
  };

  const handleGenerateMissing = () => runChapterGeneration(missingIndices);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link to="/my-courses" className="hover:text-foreground transition-colors flex items-center gap-1">
          <ChevronLeft className="h-4 w-4" /> My Courses
        </Link>
        <span>/</span>
        <span className="text-foreground font-medium truncate">{course.courseName}</span>
      </nav>

      {/* Course info */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-xl border-2 border-border bg-card p-6 shadow-neo-sm"
      >
        <h1 className="text-xl font-bold text-foreground mb-2">{course.courseName}</h1>
        <p className="text-sm text-muted-foreground mb-4">{course.courseOutput?.description}</p>
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" className="gap-1 text-xs border-accent/40 text-accent bg-accent/5">
            {course.category}
          </Badge>
          <Badge variant="outline" className="gap-1 text-xs">
            <Layers className="h-3 w-3" /> {chapters.length} chapters
          </Badge>
          <Badge variant="outline" className="gap-1 text-xs">
            <Clock className="h-3 w-3" /> {course.courseOutput?.duration}
          </Badge>
          <Badge variant="outline" className="gap-1 text-xs">
            {course.level}
          </Badge>
          <Badge variant="outline" className="gap-1 text-xs">
            <Video className="h-3 w-3" /> Videos: {course.isVideo}
          </Badge>
        </div>
      </motion.div>

      {/* Partial / missing chapters (rate limits, retries, or old parallel runs) */}
      {!allChaptersHaveContent && chapters.length > 0 && (
        <div className="rounded-xl border-2 border-amber-500/60 bg-amber-50 px-5 py-4 shadow-neo-sm space-y-3">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-amber-900">
                {generatedIds.length} of {chapters.length} chapters have lesson content
              </p>
              <p className="text-xs text-amber-800/90 mt-1 leading-relaxed">
                Chapters are generated <strong>one at a time</strong>
                {CHAPTER_STAGGER_MS > 0
                  ? ` with a ${Math.round(CHAPTER_STAGGER_MS / 1000)}s pause between calls`
                  : ""}{" "}
                to avoid API rate limits. You can come back anytime and generate the rest.
                {course.isPublished && (
                  <span className="block mt-1">
                    This course was marked ready before every chapter finished — use the button below to fill gaps.
                  </span>
                )}
              </p>
            </div>
          </div>
          {lastError && (
            <p className="text-xs text-destructive font-medium rounded-lg bg-white/80 border border-destructive/20 px-3 py-2">
              {lastError}
            </p>
          )}
          {generating ? (
            <div className="space-y-2">
              <Progress value={progress} className="h-2" />
              <p className="text-xs text-muted-foreground">
                {generatedCount} of {runTotal} in this run
                {genLabel ? ` — ${genLabel}` : ""}
              </p>
            </div>
          ) : (
            <Button
              onClick={handleGenerateMissing}
              className="bg-accent text-accent-foreground hover:bg-accent/90 gap-2"
            >
              <Wand2 className="h-4 w-4" />
              {generatedIds.length === 0 ? "Generate all chapters" : "Generate missing chapters"}
            </Button>
          )}
        </div>
      )}

      {/* Fully ready */}
      {allChaptersHaveContent && course.isPublished && (
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-xl border-2 border-green-500 bg-green-50 px-5 py-4 shadow-neo-sm"
        >
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
            <div>
              <p className="text-sm font-bold text-green-800">Course is ready!</p>
              <p className="text-xs text-green-700">All {chapters.length} chapters have lesson content.</p>
            </div>
          </div>
          <Button
            onClick={() => navigate(`/my-courses/${courseId}/learn`)}
            className="bg-accent text-accent-foreground hover:bg-accent/90 gap-2 w-full sm:w-auto"
          >
            <BookOpen className="h-4 w-4" />
            Start Learning
          </Button>
        </motion.div>
      )}

      {/* All content saved but publish flag out of sync (repair) */}
      {allChaptersHaveContent && !course.isPublished && (
        <div className="rounded-xl border-2 border-border bg-card p-4 shadow-neo-sm flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">All chapters are saved. Mark the course ready to learn.</p>
          <Button
            variant="outline"
            onClick={() => courseId && customCourseRepo.update(courseId, { isPublished: true })}
          >
            Mark ready
          </Button>
        </div>
      )}

      {/* Chapter list */}
      <div className="rounded-xl border-2 border-border bg-card p-6 shadow-neo-sm">
        <h2 className="text-base font-bold text-foreground mb-4">
          Chapters <span className="text-muted-foreground font-normal text-sm">({chapters.length})</span>
        </h2>
        <ChapterList chapters={chapters} generatedChapterIds={generatedIds} />
      </div>
    </div>
  );
}
