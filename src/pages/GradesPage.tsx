import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { BarChart2, GraduationCap, Sparkles, RefreshCw, AlertCircle, ChevronDown, ChevronUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useGamification } from "@/contexts/GamificationContext";
import { db } from "@/lib/db";
import { canvasApiFetchMultiParam } from "@/lib/canvas";
import { SKILL_PERFORMANCE } from "@/ai/skills";
import { callSkill, stripThinkTags, isSkillAiConfigured } from "@/ai/router";
import { cn } from "@/lib/utils";

interface GradeData {
  id: number;
  name: string;
  course_code: string;
  term: string | null;
  current_score: number | null;
  final_score: number | null;
  current_grade: string | null;
  final_grade: string | null;
  hide_final_grades: boolean;
}

function getGradeColor(score: number | null): string {
  if (score === null) return "#9E9E9E";
  if (score >= 90) return "#2E7D32";
  if (score >= 80) return "#1565C0";
  if (score >= 70) return "#E65100";
  if (score >= 60) return "#EF6C00";
  return "#C62828";
}

function getLetterGrade(score: number | null, grade: string | null): string {
  if (grade) return grade;
  if (score === null) return "N/A";
  if (score >= 93) return "A";
  if (score >= 90) return "A-";
  if (score >= 87) return "B+";
  if (score >= 83) return "B";
  if (score >= 80) return "B-";
  if (score >= 77) return "C+";
  if (score >= 73) return "C";
  if (score >= 70) return "C-";
  if (score >= 67) return "D+";
  if (score >= 60) return "D";
  return "F";
}

// ── AI Performance Coach Card ─────────────────────────────────────────────────

function AiCoachCard({ grades, avgScore }: { grades: GradeData[]; avgScore: number | null }) {
  const [report, setReport] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const generate = useCallback(async () => {
    setIsGenerating(true);
    setError(null);
    setExpanded(true);

    const coursesForPrompt = grades
      .filter((g) => g.current_score !== null)
      .map((g) => ({
        name: g.name,
        course_code: g.course_code,
        current_score: g.current_score,
        letter: getLetterGrade(g.current_score, g.current_grade),
      }));

    const userContent = JSON.stringify({
      courses: coursesForPrompt,
      overall_average: avgScore !== null ? parseFloat(avgScore.toFixed(1)) : null,
    });

    try {
      const raw = await callSkill(SKILL_PERFORMANCE, userContent, { maxTokens: 600 });
      setReport(stripThinkTags(raw));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate report");
    } finally {
      setIsGenerating(false);
    }
  }, [grades, avgScore]);

  if (!isSkillAiConfigured) return null;

  return (
    <Card className="relative mb-6 overflow-hidden border-2 border-primary/25 shadow-neo-sm">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-purple-500/5" />
      <CardContent className="relative p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-primary/20 bg-primary/10">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-bold">AI Performance Coach</p>
              <p className="text-xs text-muted-foreground">
                Personalized insight powered by your grade data
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {report && (
              <button
                onClick={() => setExpanded((v) => !v)}
                className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                {expanded ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </button>
            )}
            <Button
              size="sm"
              onClick={generate}
              disabled={isGenerating || grades.filter((g) => g.current_score !== null).length === 0}
              className="border-2"
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  Analyzing…
                </>
              ) : report ? (
                "Regenerate"
              ) : (
                "Generate Report"
              )}
            </Button>
          </div>
        </div>

        {/* Report content */}
        {(expanded || !report) && (
          <>
            {isGenerating && (
              <div className="mt-5 space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-[94%]" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-[88%]" />
                <Skeleton className="h-4 w-[96%]" />
                <Skeleton className="h-4 w-[70%]" />
              </div>
            )}

            {!isGenerating && error && (
              <div className="mt-4 flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4">
                <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-destructive" />
                <p className="text-xs text-destructive">{error}</p>
              </div>
            )}

            {!isGenerating && report && (
              <div className="mt-5 space-y-3 border-t border-border/40 pt-5">
                {report
                  .split(/\n{2,}/)
                  .filter((p) => p.trim().length > 0)
                  .map((paragraph, idx) => (
                    <p
                      key={idx}
                      className={cn(
                        "text-sm leading-relaxed",
                        idx === 0 && "font-medium text-foreground",
                        idx > 0 && "text-foreground/85"
                      )}
                    >
                      {paragraph.trim()}
                    </p>
                  ))}
                <p className="text-[11px] text-muted-foreground pt-1">
                  Generated by AI · Not a substitute for your teacher&apos;s feedback
                </p>
              </div>
            )}

            {!isGenerating && !report && !error && (
              <p className="mt-4 text-xs text-muted-foreground">
                Click &ldquo;Generate Report&rdquo; to get a personalized, empathetic performance
                summary based on your current grades.
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function GradesPage() {
  const navigate = useNavigate();
  const { userId, isLoaded } = useGamification();
  const [grades, setGrades] = useState<GradeData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchGrades() {
      if (!isLoaded || !userId) return;
      setIsLoading(true);

      try {
        const user = await db.users.get(userId);
        if (!user || user.isDemo) {
          setGrades([]);
          setIsLoading(false);
          return;
        }

        const params = new URLSearchParams();
        params.append("enrollment_state", "active");
        params.append("enrollment_type", "student");
        params.append("include[]", "total_scores");
        params.append("include[]", "current_grading_period_scores");
        params.append("include[]", "term");
        params.append("per_page", "50");

        const res = await canvasApiFetchMultiParam(userId, "/courses", params);
        if (!res.ok) {
          setGrades([]);
          setIsLoading(false);
          return;
        }

        const courses = (await res.json()) as {
          id: number;
          name: string;
          course_code: string;
          enrollments?: {
            type: string;
            computed_current_score: number | null;
            computed_final_score: number | null;
            computed_current_grade: string | null;
            computed_final_grade: string | null;
          }[];
          term?: { name: string };
          hide_final_grades?: boolean;
        }[];

        const gradesData = courses.map((c) => {
          const studentEnrollment = c.enrollments?.find((e) => e.type === "student");
          return {
            id: c.id,
            name: c.name,
            course_code: c.course_code,
            term: c.term?.name || null,
            current_score: studentEnrollment?.computed_current_score ?? null,
            final_score: studentEnrollment?.computed_final_score ?? null,
            current_grade: studentEnrollment?.computed_current_grade ?? null,
            final_grade: studentEnrollment?.computed_final_grade ?? null,
            hide_final_grades: c.hide_final_grades || false,
          };
        });

        setGrades(gradesData);
      } catch (err) {
        console.error("Failed to fetch grades", err);
      } finally {
        setIsLoading(false);
      }
    }

    fetchGrades();
  }, [userId, isLoaded]);

  const courseGrades = grades || [];
  const coursesWithScores = courseGrades.filter((c) => c.current_score !== null);
  const avgScore =
    coursesWithScores.length > 0
      ? coursesWithScores.reduce((sum, c) => sum + (c.current_score || 0), 0) /
        coursesWithScores.length
      : null;

  return (
    <div>
      <div className="mb-0.5 flex items-center gap-2">
        <BarChart2 className="h-7 w-7 text-foreground" />
        <h1 className="text-2xl font-bold tracking-tight">Grades</h1>
      </div>
      <p className="mb-6 text-sm text-muted-foreground">
        Your academic performance across courses
      </p>

      {isLoading && (
        <div>
          <Card className="mb-5 border-2 shadow-neo-sm">
            <CardContent className="p-6">
              <Skeleton className="mb-2 h-4 w-2/5" />
              <Skeleton className="h-12 w-1/5" />
            </CardContent>
          </Card>
          {[1, 2, 3].map((i) => (
            <Card key={i} className="mb-3 border-2 shadow-neo-sm">
              <CardContent className="p-5">
                <Skeleton className="mb-1 h-5 w-3/5" />
                <Skeleton className="mb-3 h-4 w-2/5" />
                <Skeleton className="h-2 w-full rounded-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {!isLoading && courseGrades.length === 0 && (
        <Card className="border-2 text-center shadow-neo-sm">
          <CardContent className="p-10">
            <GraduationCap className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
            <h3 className="mb-1 text-base font-bold">No grade data available</h3>
            <p className="text-sm text-muted-foreground">
              Connect your Canvas account and enroll in courses to see your grades here.
            </p>
          </CardContent>
        </Card>
      )}

      {!isLoading && courseGrades.length > 0 && (
        <>
          {/* ── AI Coach Card ──────────────────────────────────────────────── */}
          <AiCoachCard grades={courseGrades} avgScore={avgScore} />

          {/* ── Overall Average ────────────────────────────────────────────── */}
          {avgScore !== null && (
            <Card className="mb-6 border-2 shadow-neo-sm">
              <CardContent className="p-6">
                <div className="flex items-center gap-6">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                      Overall Average
                    </p>
                    <p
                      className="text-5xl font-extrabold leading-tight tracking-tight"
                      style={{ color: getGradeColor(avgScore) }}
                    >
                      {avgScore.toFixed(1)}%
                    </p>
                  </div>
                  <div className="flex-1">
                    <p className="mb-2 text-sm text-muted-foreground">
                      Across {coursesWithScores.length} course
                      {coursesWithScores.length !== 1 ? "s" : ""} with posted grades
                    </p>
                    <Progress value={Math.min(avgScore, 100)} className="h-2.5" />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ── Course rows ────────────────────────────────────────────────── */}
          {courseGrades.map((course) => {
            const score = course.current_score;
            const letter = getLetterGrade(score, course.current_grade);
            const color = getGradeColor(score);

            return (
              <Card
                key={course.id}
                className="mb-3 cursor-pointer border-2 transition-all hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-neo-sm"
                onClick={() => navigate(`/courses/${course.id}`)}
              >
                <CardContent className="p-5">
                  <div className="flex items-center gap-4">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold">{course.course_code}</p>
                      <p className="mb-1 truncate text-xs text-muted-foreground">
                        {course.name}
                      </p>
                      {course.term && (
                        <p className="mb-2 text-xs text-muted-foreground">{course.term}</p>
                      )}
                      {score !== null && (
                        <Progress value={Math.min(score, 100)} className="h-1.5" />
                      )}
                    </div>

                    <div className="min-w-[64px] flex-shrink-0 text-center">
                      {course.hide_final_grades ? (
                        <p className="text-xs text-muted-foreground">Hidden</p>
                      ) : score !== null ? (
                        <>
                          <p
                            className="text-2xl font-extrabold leading-tight"
                            style={{ color }}
                          >
                            {letter}
                          </p>
                          <p className="text-xs text-muted-foreground">{score.toFixed(1)}%</p>
                        </>
                      ) : (
                        <Badge variant="outline" className="text-xs">
                          No grade
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </>
      )}
    </div>
  );
}
