import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { ChevronLeft, ChevronRight, BookOpen } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import ChapterContent from "@/components/my-courses/ChapterContent";
import ChapterList from "@/components/my-courses/ChapterList";
import { db } from "@/lib/db";
import { customCourseRepo } from "@/lib/customCourseRepository";

export default function CourseLearnPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const [activeChapter, setActiveChapter] = useState(0);

  const course = useLiveQuery(
    () => (courseId ? db.customCourses.get(courseId) : undefined),
    [courseId]
  );

  const chapters = useLiveQuery(
    () => (courseId ? customCourseRepo.getChapters(courseId) : Promise.resolve([])),
    [courseId]
  );

  if (course === undefined || chapters === undefined) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 rounded-full border-4 border-accent border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!course) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground">Course not found.</p>
        <Button variant="link" onClick={() => navigate("/my-courses")}>Back to My Courses</Button>
      </div>
    );
  }

  const courseChapters = course.courseOutput?.chapters ?? [];
  const activeChapterData = chapters.find((c) => c.chapterId === activeChapter);
  const generatedIds = chapters.map((c) => c.chapterId);

  return (
    <div className="flex gap-0 -m-6 min-h-[calc(100vh-60px)]">
      {/* Sidebar */}
      <aside className="w-72 flex-shrink-0 border-r-2 border-border bg-sidebar flex flex-col">
        {/* Sidebar header */}
        <div className="p-4 border-b-2 border-border">
          <Link
            to={`/my-courses/${courseId}`}
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 mb-2 transition-colors"
          >
            <ChevronLeft className="h-3.5 w-3.5" /> Back to Editor
          </Link>
          <div className="flex items-start gap-2">
            <BookOpen className="h-4 w-4 text-accent mt-0.5 flex-shrink-0" />
            <h2 className="text-sm font-bold text-foreground leading-snug">{course.courseName}</h2>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {activeChapter + 1} of {courseChapters.length} chapters
          </p>
        </div>

        {/* Chapter list */}
        <ScrollArea className="flex-1 p-3">
          <ChapterList
            chapters={courseChapters}
            activeIndex={activeChapter}
            onSelect={setActiveChapter}
            generatedChapterIds={generatedIds}
          />
        </ScrollArea>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto p-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeChapter}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.18 }}
          >
            {activeChapterData ? (
              <ChapterContent
                chapter={activeChapterData}
                chapterName={courseChapters[activeChapter]?.chapter_name ?? ""}
                chapterDescription={courseChapters[activeChapter]?.description ?? ""}
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-64 text-center">
                <p className="text-muted-foreground text-sm">
                  Content for this chapter hasn't been generated yet.
                </p>
                <Button
                  variant="link"
                  onClick={() => navigate(`/my-courses/${courseId}`)}
                >
                  Open editor to generate missing chapters
                </Button>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Prev/Next navigation */}
        {courseChapters.length > 1 && (
          <div className="flex justify-between mt-8 pt-6 border-t-2 border-border">
            <Button
              variant="outline"
              disabled={activeChapter === 0}
              onClick={() => setActiveChapter((c) => c - 1)}
            >
              <ChevronLeft className="h-4 w-4 mr-1" /> Previous
            </Button>
            <Button
              variant="outline"
              disabled={activeChapter === courseChapters.length - 1}
              onClick={() => setActiveChapter((c) => c + 1)}
            >
              Next <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}
