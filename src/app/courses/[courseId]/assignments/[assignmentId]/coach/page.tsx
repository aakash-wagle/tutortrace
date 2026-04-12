"use client";

import { use, useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import {
  ArrowLeft, ExternalLink, CheckCircle2, Clock, Loader2, ChevronDown
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { useGamification } from "@/contexts/GamificationContext";
import type { ExplainAssignmentResponse, StudyPlanResponse } from "@/lib/ai";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface RubricResult {
  name: string;
  status: "strong" | "gaps" | "missing";
  evidence: string;
  suggestions: string[];
}

interface RubricCheckData {
  summary: string;
  criteria: RubricResult[];
  nextSteps: string[];
  isMock?: boolean;
  error?: string;
}

interface Assignment {
  id: number;
  name: string;
  description: string | null;
  due_at: string | null;
  points_possible: number;
  course_id: number;
  html_url: string;
  submission_types: string[];
  rubric?: {
    id: string;
    description: string;
    points: number;
    ratings?: { description: string; points: number }[];
  }[];
}

interface Course {
  id: number;
  name: string;
  course_code: string;
}

const statusStyles = {
  strong: { bg: "bg-green-50 border-green-300", text: "text-green-800", badge: "bg-green-100 text-green-800", label: "Strong" },
  gaps: { bg: "bg-amber-50 border-amber-300", text: "text-amber-800", badge: "bg-amber-100 text-amber-800", label: "Some gaps" },
  missing: { bg: "bg-red-50 border-red-300", text: "text-red-800", badge: "bg-red-100 text-red-800", label: "Needs attention" },
};

function RubricAccordion({ rubric }: { rubric: NonNullable<Assignment["rubric"]> }) {
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

export default function CoachPage({
  params,
}: {
  params: Promise<{ courseId: string; assignmentId: string }>;
}) {
  const { courseId, assignmentId } = use(params);
  const router = useRouter();
  const { addXP, logActivity, unlockBadge } = useGamification();

  const { data: assignment, isLoading: assignmentLoading } = useSWR<Assignment>(
    `/api/canvas/courses/${courseId}/assignments/${assignmentId}`,
    fetcher
  );
  const { data: courses } = useSWR<Course[]>("/api/canvas/courses", fetcher);
  const { data: aiStatus } = useSWR<{ configured: boolean }>("/api/ai/status", fetcher);

  const course = courses?.find((c) => String(c.id) === courseId);

  const [rubricResult, setRubricResult] = useState<RubricCheckData | null>(null);
  const [explainResult, setExplainResult] = useState<ExplainAssignmentResponse | null>(null);
  const [planResult, setPlanResult] = useState<StudyPlanResponse | null>(null);
  const [loadingAi, setLoadingAi] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [activeMode, setActiveMode] = useState("rubric-check");

  useEffect(() => {
    addXP("COACH_OPEN");
    logActivity("assignment_view");
    unlockBadge("first_coach_use");
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const descriptionText = useMemo(() => {
    if (!assignment?.description) return "";
    return assignment.description.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  }, [assignment]);

  const requirements = useMemo(() => {
    if (!descriptionText) return [];
    return descriptionText.split(/[.!?]+/).filter((s) => s.trim().length > 10).slice(0, 6).map((s) => s.trim());
  }, [descriptionText]);

  const getRubricCriteria = () =>
    assignment?.rubric?.map((r) => ({
      name: r.description,
      points: r.points,
      description: r.ratings?.map((rt) => `${rt.description} (${rt.points} pts)`).join("; ") || r.description,
    })) ||
    requirements.map((r, i) => ({
      name: `Requirement ${i + 1}`,
      points: assignment ? assignment.points_possible / Math.max(requirements.length, 1) : 0,
      description: r,
    }));

  const runRubricCheck = async () => {
    if (!assignment) return;
    setLoadingAi(true);
    setAiError(null);
    try {
      const res = await fetch("/api/ai/rubric-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignmentTitle: assignment.name,
          requirements: requirements.length > 0 ? requirements : [descriptionText.slice(0, 500)],
          rubricCriteria: getRubricCriteria(),
        }),
      });
      const data = await res.json();
      if (!res.ok) { setAiError(data.error || "AI analysis failed."); }
      else { setRubricResult(data); await addXP("RUBRIC_CHECK"); await unlockBadge("rubric_runner"); }
    } catch { setAiError("Network error. Please check your connection and try again."); }
    setLoadingAi(false);
  };

  const runExplain = async () => {
    if (!assignment || explainResult) return;
    setLoadingAi(true);
    setAiError(null);
    try {
      const res = await fetch("/api/ai/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignmentTitle: assignment.name,
          description: descriptionText,
          rubricCriteria: getRubricCriteria(),
          pointsPossible: assignment.points_possible,
        }),
      });
      const data = await res.json();
      if (!res.ok) setAiError(data.error || "Failed to explain assignment.");
      else setExplainResult(data);
    } catch { setAiError("Network error. Please try again."); }
    setLoadingAi(false);
  };

  const runStudyPlan = async () => {
    if (!assignment || planResult) return;
    setLoadingAi(true);
    setAiError(null);
    try {
      const res = await fetch("/api/ai/study-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignmentTitle: assignment.name,
          dueAt: assignment.due_at,
          pointsPossible: assignment.points_possible,
          rubricCriteria: getRubricCriteria(),
        }),
      });
      const data = await res.json();
      if (!res.ok) setAiError(data.error || "Failed to generate study plan.");
      else setPlanResult(data);
    } catch { setAiError("Network error. Please try again."); }
    setLoadingAi(false);
  };

  useEffect(() => {
    if (activeMode === "explain" && !explainResult) runExplain();
    if (activeMode === "plan" && !planResult) runStudyPlan();
  }, [activeMode]); // eslint-disable-line react-hooks/exhaustive-deps

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
        <Button onClick={() => router.back()}>Go Back</Button>
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
            onClick={() => router.push(`/courses/${courseId}`)}
            className="rounded-lg p-1.5 transition-colors hover:bg-muted"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <span className="text-xs text-muted-foreground">{course?.course_code || `Course ${courseId}`}</span>
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

          {/* Rubric Check */}
          {activeMode === "rubric-check" && !rubricResult && (
            <div>
              <h2 className="mb-1 text-base font-bold">AI Rubric Check</h2>
              {aiStatus && !aiStatus.configured && (
                <div className="mb-3 rounded-xl border-2 border-amber-300 bg-amber-50 p-3 text-xs text-amber-800">
                  Gemini API key not configured. Add <code>GOOGLE_GEMINI_API_KEY</code> to{" "}
                  <code>.env.local</code> for real AI analysis.
                </div>
              )}
              <p className="mb-4 text-sm leading-relaxed text-muted-foreground">
                Get AI-powered analysis of what this assignment expects and how to earn full marks on every rubric criterion.
              </p>
              <Button className="w-full" onClick={runRubricCheck} disabled={loadingAi}>
                {loadingAi ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Analyzing...</> : "Run Rubric Check"}
              </Button>
              {loadingAi && <Progress value={undefined} className="mt-2 h-1.5 animate-pulse" />}
            </div>
          )}

          {activeMode === "rubric-check" && rubricResult && (
            <div>
              {rubricResult.isMock && (
                <div className="mb-3 rounded-xl border-2 border-blue-200 bg-blue-50 p-3 text-xs text-blue-800">
                  Using sample analysis. Add a Gemini API key in <code>.env.local</code> for real AI-powered feedback.
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
                          {c.suggestions.map((s, j) => (
                            <li key={j} className="text-xs leading-relaxed">{s}</li>
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
              <Button variant="outline" className="mt-4 w-full border-2" onClick={() => setRubricResult(null)}>
                Run Again
              </Button>
            </div>
          )}

          {/* Explain */}
          {activeMode === "explain" && (
            <div>
              <h2 className="mb-4 text-base font-bold">Assignment Explained</h2>
              {loadingAi && !explainResult && (
                <div>
                  <Progress value={undefined} className="mb-3 h-1.5 animate-pulse" />
                  <p className="text-sm text-muted-foreground">Generating plain-language explanation…</p>
                </div>
              )}
              {explainResult && (
                <div>
                  {explainResult.isMock && (
                    <div className="mb-3 rounded-xl border-2 border-blue-200 bg-blue-50 p-3 text-xs text-blue-800">
                      Using sample explanation. Add a Gemini API key for AI-generated content.
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
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-4 border-2"
                    onClick={() => { setExplainResult(null); runExplain(); }}
                  >
                    Regenerate
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Study Plan */}
          {activeMode === "plan" && (
            <div>
              <h2 className="mb-4 text-base font-bold">Study Plan</h2>
              {loadingAi && !planResult && (
                <div>
                  <Progress value={undefined} className="mb-3 h-1.5 animate-pulse" />
                  <p className="text-sm text-muted-foreground">Generating your personalized study plan…</p>
                </div>
              )}
              {planResult && (
                <div>
                  {planResult.isMock && (
                    <div className="mb-3 rounded-xl border-2 border-blue-200 bg-blue-50 p-3 text-xs text-blue-800">
                      Using sample plan. Add a Gemini API key for a personalized study plan.
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
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2 border-2"
                    onClick={() => { setPlanResult(null); runStudyPlan(); }}
                  >
                    Regenerate
                  </Button>
                </div>
              )}
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
