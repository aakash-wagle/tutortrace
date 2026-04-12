import { useState, useMemo, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import {
  ArrowLeft, ExternalLink, CheckCircle2, Clock, Loader2, ChevronDown
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { useGamification } from "@/contexts/GamificationContext";
import {
  runAssignmentCoachAll,
  type RubricCheckResponse,
  type ExplainAssignmentResponse,
  type StudyPlanResponse,
} from "@/lib/aiService";
import { canvasApiFetch } from "@/lib/canvas";
import { db } from "@/lib/db";

interface RubricRating { description: string; points: number }
interface RubricCriterion { id: string; description: string; points: number; ratings?: RubricRating[] }

interface CanvasAssignment {
  id: number;
  name: string;
  description: string | null;
  due_at: string | null;
  points_possible: number;
  course_id: number;
  html_url: string;
  submission_types: string[];
  rubric?: RubricCriterion[];
}

const statusStyles = {
  strong: { bg: "bg-green-50 border-green-300", text: "text-green-800", badge: "bg-green-100 text-green-800", label: "Strong" },
  gaps: { bg: "bg-amber-50 border-amber-300", text: "text-amber-800", badge: "bg-amber-100 text-amber-800", label: "Some gaps" },
  missing: { bg: "bg-red-50 border-red-300", text: "text-red-800", badge: "bg-red-100 text-red-800", label: "Needs attention" },
};

function RubricAccordion({ rubric }: { rubric: RubricCriterion[] }) {
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  return (
    <div className="space-y-1">
      {rubric.map((r, i) => (
        <div key={i} className="overflow-hidden rounded-xl border-2 border-border">
          <button
            className="flex w-full items-center justify-between p-3 text-left transition-colors hover:bg-muted"
            onClick={() => setOpenIdx(openIdx === i ? null : i)}
          >
            <span className="text-sm font-semibold">{r.description} ({r.points} pts)</span>
            <ChevronDown className={`h-4 w-4 flex-shrink-0 transition-transform ${openIdx === i ? "rotate-180" : ""}`} />
          </button>
          {openIdx === i && r.ratings && (
            <div className="border-t border-border bg-muted/50 px-3 pb-3 pt-2">
              {r.ratings.map((rt, j) => (
                <p key={j} className="mb-1 text-xs">
                  <strong>{rt.points} pts</strong> — {rt.description}
                </p>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default function AssignmentCoachPage() {
  const { courseId, assignmentId } = useParams<{ courseId: string; assignmentId: string }>();
  const navigate = useNavigate();
  const { addXP, logActivity, unlockBadge, userId } = useGamification();

  const [assignment, setAssignment] = useState<CanvasAssignment | null>(null);
  const [assignmentLoading, setAssignmentLoading] = useState(true);

  const course = useLiveQuery(
    () => courseId ? db.courses.get(parseInt(courseId, 10)) : undefined,
    [courseId]
  );

  // Fetch full assignment from Canvas (needs rubric data not stored in Dexie)
  useEffect(() => {
    if (!userId || !courseId || !assignmentId) return;
    setAssignmentLoading(true);
    canvasApiFetch(userId, `/courses/${courseId}/assignments/${assignmentId}`)
      .then((res) => res.json())
      .then((data: CanvasAssignment) => setAssignment(data))
      .catch(() => setAssignment(null))
      .finally(() => setAssignmentLoading(false));
  }, [userId, courseId, assignmentId]);

  useEffect(() => {
    addXP("COACH_OPEN");
    logActivity("assignment_view");
    unlockBadge("first_coach_use");
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [rubricResult, setRubricResult] = useState<RubricCheckResponse | null>(null);
  const [explainResult, setExplainResult] = useState<ExplainAssignmentResponse | null>(null);
  const [planResult, setPlanResult] = useState<StudyPlanResponse | null>(null);
  const [loadingAi, setLoadingAi] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [activeMode, setActiveMode] = useState("rubric-check");

  const descriptionText = useMemo(() => {
    if (!assignment?.description) return "";
    return assignment.description.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  }, [assignment]);

  const requirements = useMemo(() => {
    if (!descriptionText) return [];
    return descriptionText.split(/[.!?]+/).filter((s) => s.trim().length > 10).slice(0, 6).map((s) => s.trim());
  }, [descriptionText]);

  const getRubricCriteria = useCallback(() =>
    assignment?.rubric?.map((r) => ({
      name: r.description,
      points: r.points,
      description: r.ratings?.map((rt) => `${rt.description} (${rt.points} pts)`).join("; ") || r.description,
    })) ||
    requirements.map((r, i) => ({
      name: `Requirement ${i + 1}`,
      points: assignment ? assignment.points_possible / Math.max(requirements.length, 1) : 0,
      description: r,
    })),
  [assignment, requirements]);

  const hasResults = rubricResult && explainResult && planResult;

  /** Single LLM call that populates all three tabs at once. */
  const handleAnalyzeAll = useCallback(async () => {
    if (!assignment) return;
    setLoadingAi(true);
    setAiError(null);
    setRubricResult(null);
    setExplainResult(null);
    setPlanResult(null);
    try {
      const data = await runAssignmentCoachAll({
        assignmentTitle: assignment.name,
        description: descriptionText,
        rubricCriteria: getRubricCriteria(),
        pointsPossible: assignment.points_possible,
        requirements: requirements.length > 0 ? requirements : [descriptionText.slice(0, 500)],
        dueAt: assignment.due_at,
      });
      setRubricResult(data.rubricCheck);
      setExplainResult(data.explain);
      setPlanResult(data.studyPlan);
      await addXP("RUBRIC_CHECK");
      await unlockBadge("rubric_runner");
    } catch (e) {
      setAiError(e instanceof Error ? e.message : "AI analysis failed. Please try again.");
    }
    setLoadingAi(false);
  }, [assignment, descriptionText, requirements, getRubricCriteria, addXP, unlockBadge]);

  if (assignmentLoading) {
    return (
      <div className="p-4">
        <Skeleton className="mb-3 h-8 w-3/5" />
        <Skeleton className="mb-2 h-5 w-2/5" />
        <Skeleton className="h-48 rounded-xl" />
      </div>
    );
  }

  if (!assignment) {
    return (
      <div className="py-16 text-center">
        <p className="mb-4 text-base font-semibold">Assignment not found</p>
        <Button onClick={() => navigate(-1)}>Go Back</Button>
      </div>
    );
  }

  const isPastDue = assignment.due_at ? new Date(assignment.due_at) < new Date() : false;
  const modeChips = [
    { key: "rubric-check", label: "Rubric Check" },
    { key: "explain", label: "Explain" },
    { key: "plan", label: "Study Plan" },
  ];

  return (
    <div className="grid min-h-[calc(100vh-108px)] grid-cols-1 gap-4 lg:grid-cols-[360px_1fr]">
      {/* LEFT: Assignment Details */}
      <div className="lg:max-h-[calc(100vh-108px)] lg:overflow-auto">
        <div className="mb-3 flex items-center gap-2">
          <button
            onClick={() => navigate(`/courses/${courseId}`)}
            className="rounded-lg p-1.5 transition-colors hover:bg-muted"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <span className="text-xs text-muted-foreground">{course?.courseCode || `Course ${courseId}`}</span>
        </div>

        <h1 className="mb-3 text-xl font-bold leading-tight">{assignment.name}</h1>

        <div className="mb-3 flex flex-wrap gap-2">
          {assignment.due_at && (
            <Badge
              className={`h-6 border-0 text-[11px] font-medium ${
                isPastDue ? "bg-red-100 text-red-800" : "bg-green-100 text-green-800"
              }`}
            >
              <Clock className="mr-1 h-3 w-3" />
              {new Date(assignment.due_at).toLocaleDateString("en-US", {
                weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
              })}
            </Badge>
          )}
          <Badge className="h-6 border-0 bg-blue-100 text-[11px] text-blue-800">
            {assignment.points_possible} points
          </Badge>
          {assignment.submission_types?.map((t) => (
            <Badge key={t} variant="outline" className="h-6 text-[11px]">
              {t.replace(/_/g, " ")}
            </Badge>
          ))}
        </div>

        {assignment.html_url && (
          <a
            href={assignment.html_url}
            target="_blank"
            rel="noopener noreferrer"
            className="mb-3 inline-flex items-center gap-1.5 rounded-xl border-2 border-border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted"
          >
            <ExternalLink className="h-3.5 w-3.5" /> Open in Canvas
          </a>
        )}

        {descriptionText && (
          <div className="mb-4">
            <p className="mb-1.5 text-xs font-semibold">Description</p>
            <p className="text-xs leading-relaxed text-muted-foreground">
              {descriptionText.length > 600 ? descriptionText.slice(0, 600) + "..." : descriptionText}
            </p>
          </div>
        )}

        {assignment.rubric && assignment.rubric.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-semibold">Rubric</p>
            <RubricAccordion rubric={assignment.rubric} />
          </div>
        )}
      </div>

      {/* RIGHT: AI Coach */}
      <Card className="flex flex-col overflow-hidden border-2">
        <CardContent className="flex-1 overflow-auto p-5">
          {/* Mode tabs */}
          <div className="mb-5 flex flex-wrap gap-2">
            {modeChips.map((m) => (
              <button
                key={m.key}
                onClick={() => { setAiError(null); setActiveMode(m.key); }}
                className={`rounded-xl border-2 px-3 py-1 text-sm font-medium transition-colors ${
                  activeMode === m.key
                    ? "border-foreground bg-muted"
                    : "border-border hover:bg-muted/50"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          {aiError && (
            <div className="mb-4 rounded-xl border-2 border-red-300 bg-red-50 p-3 text-xs text-red-800">
              {aiError}
            </div>
          )}

          {/* Single entry point — loads all tabs in one call */}
          {!hasResults && (
            <div>
              <h2 className="mb-1 text-base font-bold">AI Assignment Coach</h2>
              <p className="mb-4 text-sm leading-relaxed text-muted-foreground">
                Analyze this assignment once to get a rubric check, plain-language explanation, and a personalized study plan — all in one go.
              </p>
              <Button className="w-full" onClick={handleAnalyzeAll} disabled={loadingAi}>
                {loadingAi ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Analyzing…</> : "Analyze Assignment"}
              </Button>
              {loadingAi && <Progress value={undefined} className="mt-2 h-1.5 animate-pulse" />}
            </div>
          )}

          {/* Rubric Check */}
          {activeMode === "rubric-check" && hasResults && rubricResult && (
            <div>
              {rubricResult.isMock && (
                <div className="mb-3 rounded-xl border-2 border-blue-200 bg-blue-50 p-3 text-xs text-blue-800">
                  Using sample analysis. Configure <code>VITE_LLM_BASE_URL</code> and <code>VITE_LLM_MODEL</code> for AI-powered feedback.
                </div>
              )}
              <h2 className="mb-1 text-base font-bold">Analysis Results</h2>
              {rubricResult.summary && (
                <p className="mb-4 text-sm leading-relaxed text-muted-foreground">{rubricResult.summary}</p>
              )}
              {rubricResult.criteria.map((c, i) => {
                const s = statusStyles[c.status];
                return (
                  <Card key={i} className="mb-3 border-2">
                    <CardContent className="p-3">
                      <div className="mb-1.5 flex items-center gap-2">
                        <p className="text-sm font-bold">{c.name}</p>
                        <Badge className={`h-5 border-0 text-[11px] font-semibold ${s.badge}`}>{s.label}</Badge>
                      </div>
                      <div className={`mb-2 rounded-lg border-l-4 p-2.5 ${s.bg}`}>
                        <p className={`text-xs italic leading-relaxed ${s.text}`}>{c.evidence}</p>
                      </div>
                      {c.suggestions.length > 0 && (
                        <ul className="mt-1 list-disc pl-4">
                          {c.suggestions.map((sug, j) => (
                            <li key={j} className="text-xs leading-relaxed">{sug}</li>
                          ))}
                        </ul>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
              {rubricResult.nextSteps.length > 0 && (
                <div className="mt-3">
                  <p className="mb-1.5 text-sm font-bold">Next Steps</p>
                  <ol className="list-decimal pl-5">
                    {rubricResult.nextSteps.map((step, i) => (
                      <li key={i} className="mb-1 text-sm leading-relaxed">{step}</li>
                    ))}
                  </ol>
                </div>
              )}
              <Button variant="outline" className="mt-4 w-full border-2" onClick={handleAnalyzeAll} disabled={loadingAi}>
                {loadingAi ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Analyzing…</> : "Re-analyze"}
              </Button>
            </div>
          )}

          {/* Explain */}
          {activeMode === "explain" && hasResults && explainResult && (
            <div>
              <h2 className="mb-4 text-base font-bold">Assignment Explained</h2>
              {explainResult.isMock && (
                <div className="mb-3 rounded-xl border-2 border-blue-200 bg-blue-50 p-3 text-xs text-blue-800">
                  Using sample explanation. Configure <code>VITE_LLM_BASE_URL</code> and <code>VITE_LLM_MODEL</code> for AI content.
                </div>
              )}
              <div className="mb-5 rounded-xl border-2 border-foreground bg-muted p-4 shadow-neo-brown">
                <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-accent">TL;DR</p>
                <p className="text-sm leading-relaxed">{explainResult.tldr}</p>
              </div>
              <p className="mb-2 text-sm font-bold">What You Need to Do</p>
              <div className="mb-4 space-y-2">
                {explainResult.keyRequirements.map((req, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-accent" />
                    <p className="text-sm leading-relaxed">{req}</p>
                  </div>
                ))}
              </div>
              {explainResult.commonMistakes.length > 0 && (
                <>
                  <p className="mb-2 text-sm font-bold">Common Mistakes to Avoid</p>
                  <div className="space-y-2">
                    {explainResult.commonMistakes.map((m, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <span className="flex-shrink-0 text-sm">⚠️</span>
                        <p className="text-sm leading-relaxed">{m}</p>
                      </div>
                    ))}
                  </div>
                </>
              )}
              <Button variant="outline" size="sm" className="mt-4 border-2" onClick={handleAnalyzeAll} disabled={loadingAi}>
                {loadingAi ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Analyzing…</> : "Re-analyze"}
              </Button>
            </div>
          )}

          {/* Study Plan */}
          {activeMode === "plan" && hasResults && planResult && (
            <div>
              <h2 className="mb-4 text-base font-bold">Study Plan</h2>
              {planResult.isMock && (
                <div className="mb-3 rounded-xl border-2 border-blue-200 bg-blue-50 p-3 text-xs text-blue-800">
                  Using sample plan. Configure <code>VITE_LLM_BASE_URL</code> and <code>VITE_LLM_MODEL</code> for a personalized plan.
                </div>
              )}
              <div className="mb-4 inline-flex items-center gap-1.5 rounded-xl border-2 border-border bg-muted px-3 py-1.5">
                <Clock className="h-4 w-4 text-accent" />
                <span className="text-sm font-semibold">Est. {planResult.totalEstimatedHours}h total</span>
              </div>
              {planResult.steps.map((step, i) => (
                <div key={i} className="mb-3 flex gap-3 rounded-xl border-2 border-border bg-muted/50 p-3">
                  <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-foreground text-xs font-bold text-background">
                    {i + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="mb-0.5 flex items-start justify-between gap-2">
                      <p className="text-sm font-bold">{step.title}</p>
                      <span className="flex-shrink-0 text-xs text-muted-foreground">~{step.estimatedMinutes}m</span>
                    </div>
                    <p className="text-xs leading-relaxed text-muted-foreground">{step.description}</p>
                  </div>
                </div>
              ))}
              <Button variant="outline" size="sm" className="mt-2 border-2" onClick={handleAnalyzeAll} disabled={loadingAi}>
                {loadingAi ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Analyzing…</> : "Re-analyze"}
              </Button>
            </div>
          )}

          <p className="mt-6 text-xs text-muted-foreground">
            AI analysis is for guidance only. Always review your work independently.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
