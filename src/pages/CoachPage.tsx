import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import {
  BookOpen,
  Clock,
  Sparkles,
  RefreshCw,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  GraduationCap,
  Map as MapIcon,
  ArrowRight,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useGamification } from "@/contexts/GamificationContext";
import { db } from "@/lib/db";
import { SKILL_COLLEGE_PLAN } from "@/ai/skills";
import { callSkill, stripThinkTags, parseSkillJson, isSkillAiConfigured } from "@/ai/router";
import { cn } from "@/lib/utils";

// ── College Plan Types ────────────────────────────────────────────────────────

interface RoadmapYear {
  grade: number;
  focus_subjects: string[];
  skills_to_build: string[];
  recommended_activities: string[];
  milestone: string;
}

interface CollegePlanResult {
  career: string;
  career_domain: string;
  disclaimer: string;
  four_year_roadmap: RoadmapYear[];
  alternative_pathway: {
    description: string;
    key_steps: string[];
  };
  encouragement: string;
}

// ── College Plan Card ─────────────────────────────────────────────────────────

function CollegePlanCard() {
  const [career, setCareer] = useState("");
  const [grade, setGrade] = useState("10");
  const [plan, setPlan] = useState<CollegePlanResult | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(true);
  const [showAlt, setShowAlt] = useState(false);

  const generate = useCallback(async () => {
    if (!career.trim()) return;
    setIsGenerating(true);
    setError(null);
    setPlan(null);

    const userContent = JSON.stringify({
      dream_career: career.trim(),
      current_grade: parseInt(grade, 10),
    });

    try {
      const raw = await callSkill(SKILL_COLLEGE_PLAN, userContent, { maxTokens: 1800 });
      const cleaned = stripThinkTags(raw);
      const parsed = parseSkillJson<CollegePlanResult>(cleaned);
      setPlan(parsed);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate plan");
    } finally {
      setIsGenerating(false);
    }
  }, [career, grade]);

  if (!isSkillAiConfigured) return null;

  return (
    <Card className="relative mb-6 overflow-hidden border-2 border-primary/20 shadow-neo-sm">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-blue-500/5" />
      <CardContent className="relative p-6">
        {/* Header */}
        <div className="mb-5 flex items-start justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-primary/20 bg-primary/10">
              <MapIcon className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-bold">College &amp; Career Planner</p>
              <p className="text-xs text-muted-foreground">
                AI-guided roadmap from your current grade to your dream career
              </p>
            </div>
          </div>
          {plan && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="flex-shrink-0 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted"
            >
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          )}
        </div>

        {/* Input form */}
        {(!plan || expanded) && (
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">
                Dream Career
              </label>
              <input
                type="text"
                value={career}
                onChange={(e) => setCareer(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && generate()}
                placeholder="e.g. Software Engineer, Marine Biologist, Nurse..."
                className="w-full rounded-xl border-2 border-border bg-background px-3.5 py-2.5 text-sm font-medium placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none transition-colors"
              />
            </div>
            <div className="w-full sm:w-36">
              <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">
                Current Grade
              </label>
              <select
                value={grade}
                onChange={(e) => setGrade(e.target.value)}
                className="w-full rounded-xl border-2 border-border bg-background px-3.5 py-2.5 text-sm font-medium focus:border-primary focus:outline-none transition-colors"
              >
                <option value="9">9th Grade</option>
                <option value="10">10th Grade</option>
                <option value="11">11th Grade</option>
                <option value="12">12th Grade</option>
              </select>
            </div>
            <Button
              onClick={generate}
              disabled={isGenerating || !career.trim()}
              className="h-[42px] flex-shrink-0 border-2"
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  Planning…
                </>
              ) : (
                <>
                  <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                  Build My Plan
                </>
              )}
            </Button>
          </div>
        )}

        {/* Loading */}
        {isGenerating && (
          <div className="space-y-3 pt-2">
            <Skeleton className="h-4 w-full" />
            <div className="grid grid-cols-4 gap-3">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-28 rounded-xl" />
              ))}
            </div>
          </div>
        )}

        {/* Error */}
        {!isGenerating && error && (
          <div className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-destructive" />
            <p className="text-xs text-destructive">{error}</p>
          </div>
        )}

        {/* Plan result */}
        {!isGenerating && plan && expanded && (
          <div className="space-y-5 border-t border-border/40 pt-5">
            {/* Career + domain */}
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="border-0 bg-primary/10 text-primary text-xs font-bold">
                {plan.career}
              </Badge>
              <Badge variant="outline" className="text-xs">
                {plan.career_domain}
              </Badge>
            </div>

            {/* Encouragement */}
            <p className="rounded-xl border-2 border-primary/15 bg-primary/5 px-4 py-3 text-sm font-medium leading-relaxed text-foreground/90">
              {plan.encouragement}
            </p>

            {/* 4-year roadmap */}
            <div>
              <div className="mb-3 flex items-center gap-1.5">
                <GraduationCap className="h-4 w-4 text-muted-foreground" />
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  4-Year College Track
                </p>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {plan.four_year_roadmap.map((year) => (
                  <div
                    key={year.grade}
                    className="rounded-xl border-2 border-border bg-muted/30 p-4 space-y-2"
                  >
                    <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                      Grade {year.grade}
                    </p>
                    <p className="text-xs font-semibold leading-snug text-foreground">
                      {year.milestone}
                    </p>
                    <div className="space-y-1">
                      {year.focus_subjects.map((s, i) => (
                        <div key={i} className="flex items-center gap-1.5">
                          <div className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary" />
                          <p className="text-[11px] text-muted-foreground leading-snug">{s}</p>
                        </div>
                      ))}
                    </div>
                    {year.recommended_activities.slice(0, 2).map((act, i) => (
                      <div key={i} className="flex items-start gap-1.5">
                        <ArrowRight className="mt-0.5 h-3 w-3 flex-shrink-0 text-primary/60" />
                        <p className="text-[11px] text-muted-foreground leading-snug">{act}</p>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>

            {/* Alternative pathway */}
            <div>
              <button
                onClick={() => setShowAlt((v) => !v)}
                className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
              >
                {showAlt ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                Alternative Pathway
              </button>
              {showAlt && (
                <div className="mt-3 rounded-xl border-2 border-dashed border-border p-4">
                  <p className="mb-3 text-sm text-foreground/80 leading-relaxed">
                    {plan.alternative_pathway.description}
                  </p>
                  <div className="space-y-1.5">
                    {plan.alternative_pathway.key_steps.map((step, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <span className="mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-bold">
                          {i + 1}
                        </span>
                        <p className="text-xs text-muted-foreground leading-snug">{step}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Disclaimer */}
            <p className="text-[11px] text-muted-foreground/70 italic border-t border-border/30 pt-3">
              {plan.disclaimer}
            </p>
          </div>
        )}

        {!isGenerating && !plan && !error && (
          <p className="text-xs text-muted-foreground">
            Enter your dream career above and get a year-by-year academic roadmap — both
            college and alternative pathways included.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function CoachPage() {
  const navigate = useNavigate();
  const { userId, isLoaded } = useGamification();

  const assignments = useLiveQuery(
    () =>
      userId ? db.assignments.where("userId").equals(userId).toArray() : [],
    [userId]
  );

  const courses = useLiveQuery(
    () => (userId ? db.courses.where("userId").equals(userId).toArray() : []),
    [userId]
  );

  const courseMap = new Map((courses ?? []).map((c) => [c.id, c] as [number, typeof c]));

  const now = new Date().toISOString();
  const upcomingAssignments = (assignments ?? [])
    .filter((a) => a.dueAt && a.dueAt >= now && a.workflowState === "published")
    .sort((a, b) => (a.dueAt ?? "").localeCompare(b.dueAt ?? ""));

  const isLoading = !isLoaded || assignments === undefined;

  return (
    <div>
      <div className="mb-0.5 flex items-center gap-2">
        <BookOpen className="h-7 w-7 text-foreground" />
        <h1 className="text-2xl font-bold tracking-tight">Assignment Coach</h1>
      </div>
      <p className="mb-6 text-sm text-muted-foreground">
        AI guidance for your assignments — and a roadmap to your dream career
      </p>

      {/* ── College Plan Card ──────────────────────────────────────────────── */}
      <CollegePlanCard />

      {/* ── Assignment list ────────────────────────────────────────────────── */}
      <div className="mb-3 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-muted-foreground" />
        <p className="text-sm font-bold">Upcoming Assignments</p>
      </div>

      {isLoading &&
        [1, 2, 3, 4].map((i) => (
          <Card key={i} className="mb-3 border-2">
            <CardContent className="p-5">
              <Skeleton className="mb-1 h-5 w-1/2" />
              <Skeleton className="h-4 w-1/3" />
            </CardContent>
          </Card>
        ))}

      {upcomingAssignments.map((a) => {
        const course = courseMap.get(a.courseId);
        return (
          <Card
            key={a.id}
            className="mb-3 cursor-pointer border-2 transition-all hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-neo-sm"
            onClick={() => navigate(`/courses/${a.courseId}/assignments/${a.id}/coach`)}
          >
            <CardContent className={cn("flex items-center gap-4 p-5")}>
              <div className="min-w-0 flex-1">
                <p className="mb-1.5 text-sm font-semibold leading-tight">{a.name}</p>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="border-0 bg-purple-700 text-white text-[11px]">
                    {course?.courseCode || "Course"}
                  </Badge>
                  {a.dueAt && (
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">
                        {new Date(a.dueAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    </div>
                  )}
                  {a.pointsPossible > 0 && (
                    <span className="text-xs text-muted-foreground">{a.pointsPossible} pts</span>
                  )}
                </div>
              </div>
              <Button variant="outline" size="sm" className="flex-shrink-0 border-2">
                Open Coach
              </Button>
            </CardContent>
          </Card>
        );
      })}

      {!isLoading && upcomingAssignments.length === 0 && (
        <Card className="border-2 text-center">
          <CardContent className="p-8">
            <p className="text-sm text-muted-foreground">
              No upcoming assignments found. Check back later!
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
