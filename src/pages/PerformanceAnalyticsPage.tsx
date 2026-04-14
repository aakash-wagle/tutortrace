import { useState, useEffect, useCallback } from "react";
import {
  TrendingUp,
  ChevronLeft,
  AlertCircle,
  BookOpen,
  Brain,
  BarChart2,
  CheckCircle2,
  XCircle,
  Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useGamification } from "@/contexts/GamificationContext";
import { db } from "@/lib/db";
import {
  fetchCourseListForGrid,
  fetchCourseGradesPayload,
  loadCourseInsights,
  formatGradesSummaryForLlm,
} from "@/lib/performanceAnalytics";
import { isAiConfigured } from "@/lib/aiService";
import type {
  CourseGridItem,
  CourseGradesPayload,
  CourseInsightsPayload,
  AssignmentGradeRow,
} from "@/types/performanceAnalytics";

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatPct(v: number | null | undefined): string {
  if (v == null) return "—";
  return `${v.toFixed(1)}%`;
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString();
  } catch {
    return iso;
  }
}

function classMeanDisplay(row: AssignmentGradeRow): string {
  const m = row.score_statistics?.mean;
  if (typeof m !== "number") return "—";
  const pp = row.points_possible;
  if (typeof pp === "number" && pp > 0 && Number.isFinite(m))
    return `${((m / pp) * 100).toFixed(0)}%`;
  return String(m);
}

function vsClassDisplay(row: AssignmentGradeRow): string {
  const m = row.score_statistics?.mean;
  const sc = row.score;
  const pp = row.points_possible;
  if (
    typeof m !== "number" ||
    typeof sc !== "number" ||
    typeof pp !== "number" ||
    pp <= 0
  )
    return "—";
  const d = ((sc - m) / pp) * 100;
  const sign = d >= 0 ? "+" : "";
  return `${sign}${d.toFixed(0)}%`;
}

function assignmentStatus(row: AssignmentGradeRow): string {
  const parts: string[] = [];
  if (row.workflow_state) parts.push(String(row.workflow_state));
  if (row.attempt != null) parts.push(`attempt ${row.attempt}`);
  if (row.missing) parts.push("missing");
  if (row.late) parts.push("late");
  if (row.excused) parts.push("excused");
  if (row.seconds_late != null && row.seconds_late > 0)
    parts.push(`${Math.round(row.seconds_late / 60)}m late`);
  return parts.length ? parts.join(" · ") : "—";
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ClassComparisonSummary({ rows }: { rows: AssignmentGradeRow[] }) {
  const comparable = rows.filter(
    (r) =>
      typeof r.score_statistics?.mean === "number" &&
      typeof r.points_possible === "number" &&
      r.points_possible > 0 &&
      typeof r.score === "number"
  );
  if (rows.length === 0) return null;
  if (comparable.length === 0) {
    return (
      <p className="mt-3 rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">Class comparison: </span>
        Canvas did not return class score statistics for these items (common when
        an assignment is still open, has few grades, or the course hides
        distribution data).
      </p>
    );
  }
  let sumYou = 0;
  let sumClass = 0;
  for (const r of comparable) {
    const pp = r.points_possible as number;
    const mean = r.score_statistics!.mean as number;
    const sc = r.score as number;
    sumYou += (sc / pp) * 100;
    sumClass += (mean / pp) * 100;
  }
  const avgYou = sumYou / comparable.length;
  const avgClass = sumClass / comparable.length;
  const delta = avgYou - avgClass;
  const sign = delta >= 0 ? "+" : "";
  return (
    <p className="mt-3 rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
      <span className="font-medium text-foreground">Class comparison: </span>
      Across {comparable.length} graded assignment
      {comparable.length === 1 ? "" : "s"} with published stats, your average is{" "}
      <span className="font-mono font-medium text-foreground">
        {avgYou.toFixed(0)}%
      </span>{" "}
      vs class mean{" "}
      <span className="font-mono font-medium text-foreground">
        {avgClass.toFixed(0)}%
      </span>{" "}
      (
      <span
        className={delta >= 0 ? "text-green-600 dark:text-green-400" : "text-orange-500"}
      >
        {sign}
        {delta.toFixed(0)}% vs class mean
      </span>
      ).
    </p>
  );
}

function GradesTable({ grades }: { grades: AssignmentGradeRow[] }) {
  if (grades.length === 0) {
    return (
      <p className="mt-2 text-sm text-muted-foreground">No assignment data returned.</p>
    );
  }
  return (
    <div className="mt-3 overflow-x-auto">
      <table className="w-full min-w-[800px] text-left text-xs">
        <thead>
          <tr className="border-b-2 border-border text-muted-foreground">
            {[
              "Assignment",
              "Group",
              "Score",
              "/ Pts",
              "Class mean",
              "vs class",
              "Grade",
              "Submitted",
              "Status",
            ].map((h) => (
              <th key={h} className="py-2 pr-3 font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {grades.map((row) => (
            <tr
              key={String(row.assignment_id ?? row.name)}
              className="border-b border-border/50 hover:bg-muted/30"
            >
              <td className="max-w-[200px] py-2 pr-3 align-top">
                <div className="font-medium text-foreground" title={row.name ?? ""}>
                  {row.name ?? "—"}
                </div>
                {row.due_at && (
                  <div className="text-muted-foreground">Due {formatDate(row.due_at)}</div>
                )}
                {row.points_deducted != null && row.points_deducted !== 0 && (
                  <div className="text-orange-500">−{row.points_deducted} pts (policy)</div>
                )}
                {row.comments && row.comments.length > 0 && (
                  <details className="mt-1">
                    <summary className="cursor-pointer text-accent font-medium list-none">
                      {row.comments.length} comment{row.comments.length === 1 ? "" : "s"}
                    </summary>
                    <ul className="mt-1 space-y-1 border-t border-border/50 pt-1">
                      {row.comments.map((c, ci) => (
                        <li
                          key={ci}
                          className="rounded border border-border/50 bg-muted/50 px-2 py-1"
                        >
                          <span className="font-medium text-foreground">
                            {c.author_display_name ?? "Unknown"}
                          </span>
                          {c.created_at && (
                            <span className="ml-1 text-muted-foreground">
                              {formatDate(c.created_at)}
                            </span>
                          )}
                          {c.comment && (
                            <div className="mt-0.5 whitespace-pre-wrap text-muted-foreground">
                              {c.comment}
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </td>
              <td className="py-2 pr-3 align-top text-muted-foreground">
                {row.assignment_group_name ?? "—"}
              </td>
              <td className="py-2 pr-3 align-top font-mono">{row.score ?? "—"}</td>
              <td className="py-2 pr-3 align-top font-mono">{row.points_possible ?? "—"}</td>
              <td className="py-2 pr-3 align-top font-mono">{classMeanDisplay(row)}</td>
              <td className="py-2 pr-3 align-top font-mono">
                <span
                  className={
                    vsClassDisplay(row).startsWith("+")
                      ? "text-green-600 dark:text-green-400"
                      : vsClassDisplay(row).startsWith("-")
                        ? "text-orange-500"
                        : "text-muted-foreground"
                  }
                >
                  {vsClassDisplay(row)}
                </span>
              </td>
              <td className="py-2 pr-3 align-top font-mono">{row.grade ?? "—"}</td>
              <td className="py-2 pr-3 align-top text-muted-foreground">
                {formatDate(row.submitted_at)}
              </td>
              <td className="py-2 align-top text-muted-foreground">
                {assignmentStatus(row)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function QuizTable({ insights }: { insights: CourseInsightsPayload }) {
  if (insights.quizzes.length === 0) {
    return (
      <p className="mt-2 text-sm text-muted-foreground">
        {insights.fetchError
          ? insights.fetchError
          : "No classic quizzes found for this course."}
      </p>
    );
  }
  return (
    <div className="mt-3 overflow-x-auto">
      <table className="w-full text-left text-xs">
        <thead>
          <tr className="border-b-2 border-border text-muted-foreground">
            {["Quiz", "Score", "Out of", "Questions"].map((h) => (
              <th key={h} className="py-2 pr-4 font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {insights.quizzes.map((q) => (
            <tr
              key={String(q.quizId ?? q.title)}
              className="border-b border-border/50 hover:bg-muted/30"
            >
              <td className="py-2 pr-4">
                <div className="font-medium text-foreground">{q.title}</div>
                {q.note && <div className="text-muted-foreground">{q.note}</div>}
                {q.error && <div className="text-orange-400">{q.error}</div>}
              </td>
              <td className="py-2 pr-4 font-mono">{q.score ?? "—"}</td>
              <td className="py-2 pr-4 font-mono">{q.pointsPossible ?? "—"}</td>
              <td className="py-2 font-mono">{q.questionCount}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function InsightsSection({ insights }: { insights: CourseInsightsPayload }) {
  if (!isAiConfigured) {
    return (
      <p className="mt-3 rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
        Configure <code className="text-xs">VITE_LLM_BASE_URL</code> and{" "}
        <code className="text-xs">VITE_LLM_MODEL</code> in{" "}
        <code className="text-xs">.env.local</code> to enable AI quiz insights.
      </p>
    );
  }
  if (insights.fetchError) {
    return (
      <div className="mt-3 flex items-start gap-2 rounded-lg border border-orange-200 bg-orange-50 dark:border-orange-900/50 dark:bg-orange-950/30 px-3 py-2 text-sm text-orange-700 dark:text-orange-200">
        <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
        <span>{insights.fetchError}</span>
      </div>
    );
  }
  if (insights.skipReason) {
    return (
      <p className="mt-3 text-sm text-muted-foreground">{insights.skipReason}</p>
    );
  }
  if (insights.llmError) {
    return (
      <div className="mt-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-950/30 px-3 py-2 text-sm text-red-700 dark:text-red-200">
        <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
        <span>LLM error: {insights.llmError}</span>
      </div>
    );
  }
  if (!insights.insights) {
    return (
      <p className="mt-3 text-sm text-muted-foreground">
        No insights available yet.
      </p>
    );
  }

  const { overview, weak_areas, strong_areas, study_recommendations } =
    insights.insights;

  return (
    <div className="mt-4 space-y-4 text-sm leading-relaxed">
      {overview && <p className="text-foreground">{overview}</p>}

      {weak_areas.length > 0 && (
        <div>
          <h4 className="mb-2 flex items-center gap-1.5 font-semibold text-orange-600 dark:text-orange-400">
            <XCircle className="h-4 w-4" /> Weak areas
          </h4>
          <ul className="space-y-2">
            {weak_areas.map((w, i) => (
              <li key={i} className="rounded-lg border border-border bg-muted/40 px-3 py-2">
                <span className="font-medium text-foreground">{w.topic}</span>
                {w.evidence && (
                  <span className="mt-0.5 block text-muted-foreground">{w.evidence}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {strong_areas.length > 0 && (
        <div>
          <h4 className="mb-2 flex items-center gap-1.5 font-semibold text-green-600 dark:text-green-400">
            <CheckCircle2 className="h-4 w-4" /> Strong areas
          </h4>
          <ul className="space-y-2">
            {strong_areas.map((w, i) => (
              <li key={i} className="rounded-lg border border-border bg-muted/40 px-3 py-2">
                <span className="font-medium text-foreground">{w.topic}</span>
                {w.evidence && (
                  <span className="mt-0.5 block text-muted-foreground">{w.evidence}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {study_recommendations.length > 0 && (
        <div>
          <h4 className="mb-2 font-semibold text-accent">Recommendations</h4>
          <ul className="list-inside list-disc space-y-1 text-muted-foreground">
            {study_recommendations.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function StudyRoadmapSection({ insights }: { insights: CourseInsightsPayload }) {
  if (!isAiConfigured) return null;

  if (insights.studyPlanError) {
    return (
      <div className="mt-3 flex items-start gap-2 rounded-lg border border-orange-200 bg-orange-50 dark:border-orange-900/50 dark:bg-orange-950/30 px-3 py-2 text-sm text-orange-700 dark:text-orange-200">
        <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
        <span>{insights.studyPlanError}</span>
      </div>
    );
  }
  if (!insights.studyPlan) {
    return (
      <p className="mt-3 text-sm text-muted-foreground">
        No grade data was available to build a study roadmap.
      </p>
    );
  }

  const { compare_to_class, path_to_grade, study_next } = insights.studyPlan;

  return (
    <div className="mt-4 space-y-3 text-sm leading-relaxed">
      {compare_to_class && (
        <div className="rounded-xl border border-border bg-muted/30 p-4">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Compared to the class
          </h4>
          <p className="mt-2 text-foreground">{compare_to_class}</p>
        </div>
      )}
      {path_to_grade && (
        <div className="rounded-xl border border-border bg-muted/30 p-4">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Path forward
          </h4>
          <p className="mt-2 text-foreground">{path_to_grade}</p>
        </div>
      )}
      {study_next.length > 0 && (
        <div>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Study next
          </h4>
          <ul className="list-inside list-disc space-y-1 text-muted-foreground">
            {study_next.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ── Course detail view ────────────────────────────────────────────────────────

type DetailState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "done"; grades: CourseGradesPayload; insights: CourseInsightsPayload };

function CourseDetail({
  userId,
  course,
  onBack,
}: {
  userId: string;
  course: CourseGridItem;
  onBack: () => void;
}) {
  const [detail, setDetail] = useState<DetailState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setDetail({ status: "loading" });
      try {
        const [grades] = await Promise.all([
          fetchCourseGradesPayload(userId, String(course.id)),
        ]);
        const gradesSummary = formatGradesSummaryForLlm(grades);
        const studentId = String(grades.user_id ?? userId);
        const insights = await loadCourseInsights(
          userId,
          String(course.id),
          studentId,
          gradesSummary
        );
        if (!cancelled) setDetail({ status: "done", grades, insights });
      } catch (e) {
        if (!cancelled) setDetail({ status: "error", message: String(e) });
      }
    })();
    return () => { cancelled = true; };
  }, [userId, course.id]);

  return (
    <div>
      <button
        type="button"
        onClick={onBack}
        className="mb-5 flex items-center gap-1.5 rounded-lg border-2 border-border px-4 py-2 text-sm font-medium text-foreground transition-all hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-neo-sm"
      >
        <ChevronLeft className="h-4 w-4" />
        All courses
      </button>

      <div className="mb-1 flex items-center gap-2">
        <TrendingUp className="h-6 w-6 text-foreground" />
        <h2 className="text-xl font-bold">{course.name}</h2>
      </div>
      {course.course_code && (
        <p className="mb-1 font-mono text-xs text-muted-foreground">{course.course_code}</p>
      )}
      {course.term && (
        <p className="mb-4 text-xs text-muted-foreground">{course.term}</p>
      )}

      {detail.status === "loading" && (
        <div className="space-y-3">
          <Card className="border-2 shadow-neo-sm">
            <CardContent className="p-5">
              <Skeleton className="mb-2 h-4 w-1/3" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="mt-1 h-3 w-4/5" />
            </CardContent>
          </Card>
          {[1, 2].map((i) => (
            <Card key={i} className="border-2 shadow-neo-sm">
              <CardContent className="p-5">
                <Skeleton className="mb-2 h-4 w-1/4" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="mt-1 h-3 w-3/5" />
              </CardContent>
            </Card>
          ))}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading grades and generating AI insights…
          </div>
        </div>
      )}

      {detail.status === "error" && (
        <Card className="border-2 border-red-200 dark:border-red-900/50 shadow-neo-sm">
          <CardContent className="p-5">
            <div className="flex items-start gap-2 text-sm text-red-600 dark:text-red-400">
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <span>{detail.message}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {detail.status === "done" && (
        <div className="space-y-4">
          {/* Enrollment summary */}
          {detail.grades.enrollment && (
            <Card className="border-2 shadow-neo-sm">
              <CardHeader className="pb-2 pt-4">
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Enrollment
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-4">
                <div className="flex flex-wrap gap-2 text-xs">
                  {[
                    ["State", detail.grades.enrollment.enrollment_state],
                    ["Type", detail.grades.enrollment.type],
                    ["Role", detail.grades.enrollment.role],
                  ].map(([k, v]) =>
                    v ? (
                      <span
                        key={k}
                        className="rounded-md bg-muted px-2 py-1 font-mono"
                      >
                        <span className="font-semibold text-foreground">{k}:</span>{" "}
                        {v}
                      </span>
                    ) : null
                  )}
                </div>
                {detail.grades.enrollment.grades && (
                  <div className="mt-2 flex flex-wrap gap-2 text-xs">
                    {([
                      ["Current score", detail.grades.enrollment.grades.current_score],
                      ["Final score", detail.grades.enrollment.grades.final_score],
                      ["Current grade", detail.grades.enrollment.grades.current_grade],
                      ["Final grade", detail.grades.enrollment.grades.final_grade],
                    ] as [string, number | string | null | undefined][]).map(([k, v]) =>
                      v != null ? (
                        <span
                          key={k}
                          className="rounded-md bg-muted px-2 py-1 font-mono"
                        >
                          <span className="font-semibold text-foreground">{k}:</span>{" "}
                          {typeof v === "number" ? formatPct(v) : v}
                        </span>
                      ) : null
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Assignment grades */}
          <Card className="border-2 shadow-neo-sm">
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <BarChart2 className="h-4 w-4" />
                Assignment grades
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-4">
              <ClassComparisonSummary rows={detail.grades.grades ?? []} />
              <GradesTable grades={detail.grades.grades ?? []} />
            </CardContent>
          </Card>

          {/* Quizzes — hidden when Canvas returns 404 (quizzes disabled for course) */}
          {!detail.insights.quizzesUnavailable && (
            <Card className="border-2 shadow-neo-sm">
              <CardHeader className="pb-2 pt-4">
                <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                  <BookOpen className="h-4 w-4" />
                  Quiz scores
                  <Badge variant="outline" className="ml-auto text-xs font-normal">
                    Classic quizzes only
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-4">
                <QuizTable insights={detail.insights} />
              </CardContent>
            </Card>
          )}

          {/* AI quiz insights — hidden when quizzes are unavailable for this course */}
          {!detail.insights.quizzesUnavailable && (
            <Card className="border-2 shadow-neo-sm">
              <CardHeader className="pb-2 pt-4">
                <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                  <Brain className="h-4 w-4" />
                  AI quiz insights
                  {detail.insights.llmCalled ? (
                    <Badge className="ml-auto bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300 text-xs font-normal">
                      LLM called
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="ml-auto text-xs font-normal text-muted-foreground">
                      Not called
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-4">
                <InsightsSection insights={detail.insights} />
              </CardContent>
            </Card>
          )}

          {/* Study roadmap */}
          {isAiConfigured && (
            <Card className="border-2 shadow-neo-sm">
              <CardHeader className="pb-2 pt-4">
                <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                  <TrendingUp className="h-4 w-4" />
                  Study roadmap
                  {detail.insights.studyPlanLlmCalled && (
                    <Badge className="ml-auto bg-accent/20 text-accent text-xs font-normal">
                      AI generated
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-4">
                <StudyRoadmapSection insights={detail.insights} />
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function PerformanceAnalyticsPage() {
  const { userId, isLoaded } = useGamification();

  const [courses, setCourses] = useState<CourseGridItem[]>([]);
  const [gridLoading, setGridLoading] = useState(false);
  const [gridError, setGridError] = useState<string | null>(null);
  const [isDemo, setIsDemo] = useState(false);

  const [selectedCourse, setSelectedCourse] = useState<CourseGridItem | null>(null);

  const loadCourses = useCallback(async (uid: string) => {
    setGridLoading(true);
    setGridError(null);
    try {
      const items = await fetchCourseListForGrid(uid);
      setCourses(items);
    } catch (e) {
      setGridError(String(e));
    } finally {
      setGridLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isLoaded || !userId) return;
    (async () => {
      const user = await db.users.get(userId);
      if (user?.isDemo) {
        setIsDemo(true);
        return;
      }
      await loadCourses(userId);
    })();
  }, [isLoaded, userId, loadCourses]);

  // ── Render ───────────────────────────────────────────────────────────────

  if (!isLoaded) {
    return (
      <div>
        <Skeleton className="mb-2 h-8 w-48" />
        <Skeleton className="mb-6 h-4 w-80" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-36 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (selectedCourse && userId) {
    return (
      <CourseDetail
        userId={userId}
        course={selectedCourse}
        onBack={() => setSelectedCourse(null)}
      />
    );
  }

  return (
    <div>
      <div className="mb-0.5 flex items-center gap-2">
        <TrendingUp className="h-7 w-7 text-foreground" />
        <h1 className="text-2xl font-bold tracking-tight">Performance Analytics</h1>
      </div>
      <p className="mb-6 text-sm text-muted-foreground">
        Grades, quiz scores, and AI-powered study insights for your courses
      </p>

      {isDemo && (
        <Card className="border-2 shadow-neo-sm">
          <CardContent className="p-6 text-center">
            <TrendingUp className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
            <p className="text-sm font-medium">Not available in demo mode</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Connect a real Canvas account to see performance analytics.
            </p>
          </CardContent>
        </Card>
      )}

      {!isDemo && gridLoading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-36 rounded-xl" />
          ))}
        </div>
      )}

      {!isDemo && gridError && (
        <Card className="border-2 border-orange-200 dark:border-orange-900/50 shadow-neo-sm">
          <CardContent className="p-5">
            <div className="flex items-start gap-2 text-sm text-orange-700 dark:text-orange-300">
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <span>{gridError}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {!isDemo && !gridLoading && !gridError && courses.length === 0 && (
        <Card className="border-2 text-center shadow-neo-sm">
          <CardContent className="p-10">
            <TrendingUp className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
            <h3 className="mb-1 text-base font-bold">No active enrollments found</h3>
            <p className="text-sm text-muted-foreground">
              Make sure your Canvas token is connected and you are enrolled in active
              student courses.
            </p>
          </CardContent>
        </Card>
      )}

      {!isDemo && !gridLoading && courses.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((c) => (
            <button
              key={String(c.id)}
              type="button"
              onClick={() => setSelectedCourse(c)}
              className="rounded-xl border-2 border-border bg-card p-5 text-left shadow-neo-sm transition-all hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-neo"
            >
              <h2 className="text-base font-bold leading-snug text-foreground line-clamp-2">
                {c.name}
              </h2>
              {c.course_code && (
                <p className="mt-1 font-mono text-xs text-muted-foreground">
                  {c.course_code}
                </p>
              )}
              {c.term && (
                <p className="mt-1 text-xs text-muted-foreground">{c.term}</p>
              )}
              <div className="mt-3 flex flex-wrap gap-2 font-mono text-xs text-muted-foreground">
                <span>
                  Current: {formatPct(c.current_score)}
                  {c.current_grade ? ` (${c.current_grade})` : ""}
                </span>
                <span>
                  Final: {formatPct(c.final_score)}
                  {c.final_grade ? ` (${c.final_grade})` : ""}
                </span>
              </div>
              <p className="mt-3 text-xs font-semibold text-accent">
                View analytics →
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
