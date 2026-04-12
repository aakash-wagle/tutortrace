import { useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import {
  ClipboardList,
  CalendarDays,
  Clock,
  GraduationCap,
  Sparkles,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Circle,
  Zap,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AnimatedCardList, AnimatedCard } from "@/components/AnimatedCardList";
import { StudyOwl } from "@/components/StudyOwl";
import { useGamification } from "@/contexts/GamificationContext";
import { syncCanvasDataToDexie } from "@/lib/canvas-sync";
import { db } from "@/lib/db";
import {
  generateTimeBlocks,
  getTodayBlocks,
  formatBlockTime,
  type TimeBlock,
} from "@/lib/scheduleEngine";
import { useMorningBriefing } from "@/hooks/useMorningBriefing";
import { cn } from "@/lib/utils";

// ── Helpers ──────────────────────────────────────────────────────────────────

const courseColors = [
  "#7B1FA2", "#00838F", "#1565C0", "#2E7D32",
  "#E65100", "#AD1457", "#4527A0", "#00695C",
];

function getCourseColor(courseId: number | string): string {
  const idx = typeof courseId === "number" ? courseId : parseInt(String(courseId), 10);
  return courseColors[Math.abs(idx) % courseColors.length];
}

function formatDue(dateStr: string | null): string {
  if (!dateStr) return "No due date";
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = d.getTime() - now.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  if (diffMs < 0) return "Past due";
  if (diffHours < 24) {
    const h = Math.floor(diffHours);
    return h <= 1 ? "Due in less than an hour" : `Due in ${h} hours`;
  }
  if (diffDays < 7) {
    return `Due ${d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}`;
  }
  return `Due ${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
}

const PRIORITY_COLORS: Record<string, string> = {
  critical: "border-destructive bg-destructive/10 text-destructive",
  high: "border-orange-500 bg-orange-500/10 text-orange-700 dark:text-orange-400",
  medium: "border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  low: "border-primary bg-primary/10 text-primary",
};

// ── Morning Briefing Panel ────────────────────────────────────────────────────

function MorningBriefingPanel({
  todayBlocks,
  displayName,
}: {
  todayBlocks: TimeBlock[];
  displayName?: string;
}) {
  const { briefing, isLoading, error, provider, retry } = useMorningBriefing(
    todayBlocks,
    displayName
  );

  return (
    <Card className="relative overflow-hidden border-2 border-primary/20 shadow-neo-sm h-full">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5" />
      <CardContent className="relative p-5">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-primary">
            <Sparkles className="h-5 w-5 text-accent" />
            <span className="text-base">Morning Briefing</span>
          </div>
          {provider && (
            <Badge
              variant="outline"
              className="border-primary/20 font-mono text-[10px] uppercase tracking-wider"
            >
              {provider === "groq" ? "Online AI" : "Local AI"}
            </Badge>
          )}
        </div>

        {isLoading && (
          <div className="space-y-2 pb-1">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-[92%]" />
            <Skeleton className="h-4 w-[96%]" />
            <Skeleton className="h-4 w-[75%]" />
          </div>
        )}

        {!isLoading && error && !briefing && (
          <div className="flex flex-col items-center py-4 text-center">
            <AlertCircle className="mb-2 h-7 w-7 text-destructive opacity-80" />
            <p className="mb-3 text-xs text-muted-foreground">{error}</p>
            <Button variant="outline" size="sm" onClick={retry} className="border-2">
              <RefreshCw className="mr-2 h-3 w-3" />
              Retry
            </Button>
          </div>
        )}

        {!isLoading && briefing && (
          <p className="text-sm leading-relaxed text-foreground/90 font-medium">
            {briefing}
          </p>
        )}

        {todayBlocks.length === 0 && !isLoading && (
          <div className="mt-3 rounded-xl border border-dashed border-primary/20 p-3 text-center">
            <p className="text-xs text-muted-foreground">
              No sessions scheduled today.{" "}
              <button
                onClick={() => {
                  /* navigate to /weekly-planner handled in parent */
                }}
                className="font-semibold text-primary underline underline-offset-2"
              >
                View Week Planner
              </button>
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Today's Schedule Panel ────────────────────────────────────────────────────

function TodaySchedulePanel({
  todayBlocks,
  courseMap,
  onToggle,
  isLoading,
}: {
  todayBlocks: TimeBlock[];
  courseMap: Map<number, { courseCode: string; name: string }>;
  onToggle: (block: TimeBlock) => void;
  isLoading: boolean;
}) {
  const navigate = useNavigate();

  return (
    <Card className="border-2 shadow-neo-sm h-full">
      <CardContent className="p-5">
        <div className="mb-4 flex items-center gap-2">
          <CalendarDays className="h-5 w-5 text-foreground" />
          <h2 className="text-base font-bold">Today&apos;s Schedule</h2>
          {todayBlocks.length > 0 && (
            <Badge className="ml-auto border-0 bg-primary/10 text-primary text-xs font-semibold">
              {todayBlocks.filter((b) => b.completed).length}/{todayBlocks.length}
            </Badge>
          )}
        </div>

        {isLoading && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex gap-3">
                <Skeleton className="h-8 w-20 flex-shrink-0 rounded-md" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!isLoading && todayBlocks.length === 0 && (
          <div className="py-6 text-center">
            <p className="mb-3 text-sm text-muted-foreground">
              No sessions scheduled for today.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="border-2"
              onClick={() => navigate("/weekly-planner")}
            >
              Open Week Planner
            </Button>
          </div>
        )}

        <div className="space-y-2">
          {todayBlocks.map((block) => {
            const course = courseMap.get(block.courseId);
            const colorClass = PRIORITY_COLORS[block.priority] ?? PRIORITY_COLORS.medium;

            return (
              <div
                key={block.id}
                className={cn(
                  "relative flex items-center gap-3 rounded-xl border-2 p-3 transition-all",
                  block.completed
                    ? "border-muted bg-muted/30 opacity-60"
                    : "border-border bg-card hover:-translate-y-0.5 hover:shadow-neo-sm"
                )}
              >
                {/* Priority accent stripe */}
                {!block.completed && (
                  <div
                    className={cn(
                      "absolute left-0 top-0 bottom-0 w-1 rounded-l-xl opacity-60",
                      block.priority === "critical" && "bg-destructive",
                      block.priority === "high" && "bg-orange-500",
                      block.priority === "medium" && "bg-amber-500",
                      block.priority === "low" && "bg-primary"
                    )}
                  />
                )}

                <div className="w-[68px] flex-shrink-0 pl-2">
                  <span
                    className={cn(
                      "font-mono text-[11px] font-semibold leading-none",
                      block.completed ? "text-muted-foreground" : "text-foreground"
                    )}
                  >
                    {formatBlockTime(block)}
                  </span>
                </div>

                <div className="min-w-0 flex-1">
                  <p
                    className={cn(
                      "truncate text-xs font-bold leading-tight",
                      block.completed && "line-through text-muted-foreground"
                    )}
                  >
                    {block.assignmentName}
                  </p>
                  <div className="mt-0.5 flex min-w-0 items-center gap-1.5">
                    <Badge
                      className={cn(
                        "h-4 min-w-0 border-0 text-[10px]",
                        block.completed ? "bg-muted text-muted-foreground" : colorClass
                      )}
                      title={course?.courseCode || "Course"}
                    >
                      <span className="truncate">
                        {course?.courseCode || "Course"}
                      </span>
                    </Badge>
                    <span className="flex-shrink-0 text-[10px] text-muted-foreground">
                      {block.durationMinutes}m
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => onToggle(block)}
                  aria-label={block.completed ? "Mark incomplete" : "Mark complete"}
                  className="flex-shrink-0 rounded-full p-1 transition-colors hover:bg-muted"
                >
                  {block.completed ? (
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                  ) : (
                    <Circle className="h-5 w-5 text-muted-foreground hover:text-primary" />
                  )}
                </button>
              </div>
            );
          })}
        </div>

        {todayBlocks.length > 0 && (
          <Button
            variant="outline"
            className="mt-4 w-full border-2"
            onClick={() => navigate("/weekly-planner")}
          >
            View Full Week
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function TodayPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { unlockBadge, logActivity, userId, isLoaded } = useGamification();

  useEffect(() => {
    if (searchParams.get("firstLogin") === "true" && userId) {
      unlockBadge("first_login");
      logActivity("login");
      syncCanvasDataToDexie(userId);
      const next = new URLSearchParams(searchParams);
      next.delete("firstLogin");
      setSearchParams(next, { replace: true });
    }
  }, [userId, searchParams, unlockBadge, logActivity, setSearchParams]);

  const now = new Date().toISOString();

  const assignments = useLiveQuery(
    () => (userId ? db.assignments.where("userId").equals(userId).toArray() : []),
    [userId]
  );

  const courses = useLiveQuery(
    () => (userId ? db.courses.where("userId").equals(userId).toArray() : []),
    [userId]
  );

  const schedules = useLiveQuery(
    () => (userId ? db.schedules.where("userId").equals(userId).toArray() : []),
    [userId]
  );

  const user = useLiveQuery(
    () => (userId ? db.users.get(userId) : undefined),
    [userId]
  );

  const courseMap = useMemo(
    () => new Map((courses ?? []).map((c) => [c.id, c])),
    [courses]
  );

  // ── Schedule computation ───────────────────────────────────────────────────

  const allBlocks = useMemo(() => {
    if (!assignments) return [];
    const completedSet = new Set(
      (schedules ?? []).filter((s) => s.completed).map((s) => s.id)
    );
    return generateTimeBlocks(assignments, completedSet);
  }, [assignments, schedules]);

  const todayBlocks = useMemo(() => getTodayBlocks(allBlocks), [allBlocks]);

  // ── Toggle schedule block completion ──────────────────────────────────────

  const toggleComplete = async (block: TimeBlock) => {
    if (!userId) return;
    const newVal = !block.completed;
    try {
      const existing = await db.schedules.get(block.id);
      if (existing) {
        await db.schedules.update(block.id, { completed: newVal, updatedAt: Date.now() });
      } else {
        await db.schedules.put({ ...block, userId, completed: newVal, updatedAt: Date.now() });
      }
    } catch (err) {
      console.error("Failed to update schedule block:", err);
    }
  };

  // ── Derived ────────────────────────────────────────────────────────────────

  const upcomingAssignments = (assignments ?? [])
    .filter((a) => a.dueAt && a.dueAt > now && a.workflowState === "published")
    .sort((a, b) => (a.dueAt ?? "").localeCompare(b.dueAt ?? ""))
    .slice(0, 6);

  const isLoading = !isLoaded || assignments === undefined;

  return (
    <div>
      {/* Top 3-column grid */}
      <div className="mb-5 grid grid-cols-1 gap-5 lg:grid-cols-[1fr_1fr_340px]">

        {/* ── Column 1: Due Soon ─────────────────────────────────────────── */}
        <Card className="border-2 shadow-neo-sm">
          <CardContent className="p-5">
            <div className="mb-4 flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-foreground" />
              <h2 className="text-base font-bold">Due Soon</h2>
              {upcomingAssignments.length > 0 && (
                <Badge className="ml-auto border-0 bg-blue-100 text-blue-800 text-xs font-semibold">
                  {upcomingAssignments.length}
                </Badge>
              )}
            </div>

            {isLoading && [1, 2, 3].map((i) => (
              <div key={i} className="mb-4 space-y-1">
                <Skeleton className="h-5 w-4/5" />
                <Skeleton className="h-4 w-2/5" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            ))}

            {!isLoading && upcomingAssignments.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No upcoming assignments. You&apos;re all caught up!
              </p>
            )}

            <AnimatedCardList>
              {upcomingAssignments.map((a, i) => {
                const course = courseMap.get(a.courseId);
                const dueText = formatDue(a.dueAt);
                const isPastDue = dueText === "Past due";

                return (
                  <AnimatedCard key={a.id}>
                    <div
                      onClick={() =>
                        navigate(`/courses/${a.courseId}/assignments/${a.id}/coach`)
                      }
                      className={cn(
                        "-mx-1 cursor-pointer rounded-xl p-3 transition-colors hover:bg-muted",
                        i < upcomingAssignments.length - 1 && "mb-3 border-b border-border/30 pb-3"
                      )}
                    >
                      <p className="mb-1.5 text-sm font-semibold leading-tight">{a.name}</p>
                      <div className="mb-1 flex flex-wrap items-center gap-1.5">
                        <Badge
                          className="h-5 border-0 text-[11px] font-medium text-white"
                          style={{ backgroundColor: getCourseColor(a.courseId) }}
                          title={course?.courseCode || `Course ${a.courseId}`}
                        >
                          <span className="truncate max-w-[140px]">
                            {course?.courseCode || `Course ${a.courseId}`}
                          </span>
                        </Badge>
                        {a.pointsPossible > 0 && (
                          <Badge className="h-5 border-0 bg-blue-100 text-blue-800 text-[11px]">
                            {a.pointsPossible} pts
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock
                          className={cn(
                            "h-3 w-3",
                            isPastDue ? "text-destructive" : "text-muted-foreground"
                          )}
                        />
                        <span
                          className={cn(
                            "text-xs",
                            isPastDue ? "font-semibold text-destructive" : "text-muted-foreground"
                          )}
                        >
                          {dueText}
                        </span>
                      </div>
                    </div>
                  </AnimatedCard>
                );
              })}
            </AnimatedCardList>

            {upcomingAssignments.length > 0 && (
              <Button className="mt-4 w-full" onClick={() => navigate("/coach")}>
                Open Assignment Coach
              </Button>
            )}
          </CardContent>
        </Card>

        {/* ── Column 2: Morning Briefing ─────────────────────────────────── */}
        <MorningBriefingPanel
          todayBlocks={todayBlocks}
          displayName={user?.displayName}
        />

        {/* ── Column 3: Today's Schedule ─────────────────────────────────── */}
        <TodaySchedulePanel
          todayBlocks={todayBlocks}
          courseMap={courseMap}
          onToggle={toggleComplete}
          isLoading={isLoading}
        />
      </div>

      {/* ── Bottom row ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {/* Quick Actions */}
        <Card className="border-2 shadow-neo-sm">
          <CardContent className="p-5">
            <div className="mb-4 flex items-center gap-2">
              <Zap className="h-5 w-5 text-foreground" />
              <h2 className="text-base font-bold">Quick Actions</h2>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Button
                variant="outline"
                className="border-2 py-5"
                onClick={() => navigate("/courses")}
              >
                My Courses
              </Button>
              <Button
                variant="outline"
                className="border-2 py-5"
                onClick={() => navigate("/grades")}
              >
                View Grades
              </Button>
              <Button
                variant="outline"
                className="border-2 py-5"
                onClick={() => navigate("/flashcards")}
              >
                Flashcards
              </Button>
              <Button
                variant="outline"
                className="border-2 py-5"
                onClick={() => navigate("/messages")}
              >
                Messages
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* My Courses */}
        <Card className="border-2 shadow-neo-sm">
          <CardContent className="p-5">
            <h2 className="mb-4 text-base font-bold">My Courses</h2>
            {!courses && [1, 2, 3].map((i) => (
              <Skeleton key={i} className="mb-2 h-5 w-4/5" />
            ))}
            {(courses ?? []).slice(0, 5).map((c) => (
              <div
                key={c.id}
                onClick={() => navigate(`/courses/${c.id}`)}
                className="mb-1 flex cursor-pointer items-center gap-3 rounded-lg p-2 transition-colors hover:bg-muted"
              >
                <GraduationCap
                  className="h-4 w-4 flex-shrink-0"
                  style={{ color: getCourseColor(c.id) }}
                />
                <p className="min-w-0 flex-1 truncate text-sm font-semibold">
                  {c.courseCode || c.name}
                </p>
              </div>
            ))}
            {courses && courses.length > 5 && (
              <Button
                variant="ghost"
                size="sm"
                className="mt-1 text-xs"
                onClick={() => navigate("/courses")}
              >
                View all {courses.length} courses
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      {/* StudyOwl mascot */}
      <div className="pointer-events-none fixed bottom-6 right-6 z-[1200]">
        <StudyOwl mood="default" size="sm" />
      </div>
    </div>
  );
}
