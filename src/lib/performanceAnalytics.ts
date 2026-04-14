/**
 * Performance analytics service — frontend-only port of the FastAPI backend.
 *
 * Sources ported:
 *   canvas-fastapi/app/routers/performance.py   (grade helpers, course_grades)
 *   canvas-fastapi/app/routers/quizzes.py        (quiz_student_results)
 *   canvas-fastapi/app/lib/tutor_grades.py       (fetch_course_list_for_grid)
 *   canvas-fastapi/app/lib/quiz_normalize.py     (normalize, filter, transcript)
 *   canvas-fastapi/app/lib/course_insights.py    (load_course_insights)
 *
 * All Canvas API calls go through the existing proxy via canvasGetAllPages() /
 * canvasApiFetchMultiParam() from ./canvas.ts — no new proxy routes needed.
 */

import { canvasApiFetchMultiParam, canvasGetAllPages } from "./canvas";
import type {
  AssignmentGradeRow,
  AssignmentGroupSlim,
  CourseGradesPayload,
  CourseGridItem,
  CourseInsightsPayload,
  EnrollmentSlim,
  GradeBlock,
  NormalizedQuizQuestion,
  QuizRowSummary,
  ScoreStatisticSlim,
  SubmissionComment,
} from "@/types/performanceAnalytics";
// aiService is imported lazily inside loadCourseInsights to avoid circular dependency
// (aiService imports types from performanceAnalytics at type level only)

// ── Internal helpers ──────────────────────────────────────────────────────────

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function coalesce<T>(...vals: (T | null | undefined)[]): T | null {
  for (const v of vals) {
    if (v !== null && v !== undefined && v !== ("" as unknown)) return v;
  }
  return null;
}

function mergeGradeBlocks(
  primary: Record<string, unknown>,
  secondary: Record<string, unknown>
): Record<string, unknown> {
  const keys = new Set([...Object.keys(primary), ...Object.keys(secondary)]);
  const out: Record<string, unknown> = {};
  for (const k of keys) {
    out[k] = coalesce(primary[k], secondary[k]);
  }
  return out;
}

// ── Canvas response projectors (port of performance.py helpers) ───────────────

function activeStudentEnrollment(
  course: Record<string, unknown>
): Record<string, unknown> | null {
  const enrollments = course["enrollments"];
  if (!Array.isArray(enrollments)) return null;
  for (const e of enrollments) {
    if (!isRecord(e)) continue;
    const t = e["type"];
    if (t !== "StudentEnrollment" && t !== "student") continue;
    const state = e["enrollment_state"];
    if (state !== undefined && state !== null && state !== "active") continue;
    return e;
  }
  return null;
}

function gradeBlock(enr: Record<string, unknown> | null): GradeBlock {
  if (!enr) return {};
  const g = isRecord(enr["grades"]) ? (enr["grades"] as Record<string, unknown>) : {};
  return {
    current_score: (g["current_score"] as number | null) ?? null,
    final_score: (g["final_score"] as number | null) ?? null,
    current_grade: (g["current_grade"] as string | null) ?? null,
    final_grade: (g["final_grade"] as string | null) ?? null,
    current_points: (g["current_points"] as number | null) ?? null,
    unposted_current_score: (g["unposted_current_score"] as number | null) ?? null,
    unposted_final_score: (g["unposted_final_score"] as number | null) ?? null,
    unposted_current_grade: (g["unposted_current_grade"] as string | null) ?? null,
    unposted_final_grade: (g["unposted_final_grade"] as string | null) ?? null,
    computed_current_score: (enr["computed_current_score"] as number | null) ?? null,
    computed_final_score: (enr["computed_final_score"] as number | null) ?? null,
    computed_current_grade: (enr["computed_current_grade"] as string | null) ?? null,
    computed_final_grade: (enr["computed_final_grade"] as string | null) ?? null,
  };
}

function gradingPeriodStats(enr: Record<string, unknown> | null): Record<string, unknown> {
  if (!enr) return {};
  return {
    has_grading_periods: enr["has_grading_periods"] ?? null,
    current_grading_period_title: enr["current_grading_period_title"] ?? null,
    current_grading_period_id: enr["current_grading_period_id"] ?? null,
    current_period_computed_current_score: enr["current_period_computed_current_score"] ?? null,
    current_period_computed_final_score: enr["current_period_computed_final_score"] ?? null,
    current_period_computed_current_grade: enr["current_period_computed_current_grade"] ?? null,
    current_period_computed_final_grade: enr["current_period_computed_final_grade"] ?? null,
  };
}

function activityStats(enr: Record<string, unknown> | null): Record<string, unknown> {
  if (!enr) return {};
  return {
    last_activity_at: enr["last_activity_at"] ?? null,
    last_attended_at: enr["last_attended_at"] ?? null,
    total_activity_time: enr["total_activity_time"] ?? null,
  };
}

function projectScoreStatistics(raw: unknown): ScoreStatisticSlim | null {
  if (!isRecord(raw)) return null;
  return {
    min: (raw["min"] as number | null) ?? null,
    max: (raw["max"] as number | null) ?? null,
    mean: (raw["mean"] as number | null) ?? null,
    median: (raw["median"] as number | null) ?? null,
    upper_q: (raw["upper_q"] as number | null) ?? null,
    lower_q: (raw["lower_q"] as number | null) ?? null,
  };
}

function projectSubmissionComments(sub: Record<string, unknown>): SubmissionComment[] {
  const raw = sub["submission_comments"];
  if (!Array.isArray(raw)) return [];
  const out: SubmissionComment[] = [];
  for (const c of raw) {
    if (!isRecord(c)) continue;
    const auth = isRecord(c["author"]) ? c["author"] : null;
    let display = c["author_name"] as string | null | undefined;
    if (display == null && auth) {
      display = auth["display_name"] as string | null;
    }
    out.push({
      id: c["id"] as number | string | undefined,
      author_display_name: display ?? null,
      comment: c["comment"] as string | null,
      created_at: c["created_at"] as string | null,
      edited_at: c["edited_at"] as string | null,
    });
  }
  return out;
}

function projectEnrollmentSlim(enr: Record<string, unknown> | null): EnrollmentSlim | null {
  if (!enr) return null;
  return {
    enrollment_id: enr["id"] as number | string | null,
    enrollment_state: enr["enrollment_state"] as string | null,
    type: enr["type"] as string | null,
    role: enr["role"] as string | null,
    grades: gradeBlock(enr),
    grading_period: gradingPeriodStats(enr),
    activity: activityStats(enr),
  };
}

function projectAssignmentGroupSlim(g: Record<string, unknown>): AssignmentGroupSlim {
  return {
    id: g["id"] as number | string | undefined,
    name: g["name"] as string | null,
    group_weight: g["group_weight"] as number | null,
    position: g["position"] as number | null,
    rules: g["rules"],
  };
}

// ── Course list (port of tutor_grades.py:fetch_course_list_for_grid) ──────────

async function enrollmentGradeBlocksByCourseId(
  userId: string
): Promise<Map<string, Record<string, unknown>>> {
  const out = new Map<string, Record<string, unknown>>();
  try {
    const params = new URLSearchParams();
    params.append("include[]", "grades");
    params.append("state[]", "active");
    const rows = await canvasGetAllPages(
      userId,
      "/users/self/enrollments",
      params
    );
    for (const row of rows) {
      if (!isRecord(row)) continue;
      const state = row["enrollment_state"];
      if (state !== undefined && state !== null && state !== "active") continue;
      const t = row["type"];
      if (t !== "StudentEnrollment" && t !== "student") continue;
      const cid = row["course_id"];
      if (cid == null) continue;
      out.set(String(cid), gradeBlock(row) as unknown as Record<string, unknown>);
    }
  } catch {
    // non-fatal
  }
  return out;
}

export async function fetchCourseListForGrid(userId: string): Promise<CourseGridItem[]> {
  const params = new URLSearchParams();
  params.append("enrollment_state", "active");
  params.append("enrollment_type", "student");
  params.append("include[]", "total_scores");
  params.append("include[]", "current_grading_period_scores");
  params.append("include[]", "term");
  params.append("include[]", "enrollments");
  params.append("per_page", "50");

  const [courses, enrollGrades] = await Promise.all([
    canvasGetAllPages(userId, "/courses", params),
    enrollmentGradeBlocksByCourseId(userId),
  ]);

  const out: CourseGridItem[] = [];
  for (const raw of courses) {
    if (!isRecord(raw)) continue;
    const enr = activeStudentEnrollment(raw);
    if (!enr) continue;

    const cid = String(enr["course_id"] ?? raw["id"] ?? "");
    if (!cid) continue;

    const term = isRecord(raw["term"]) ? raw["term"] : null;
    const termName = term ? String(term["name"] ?? "") || null : null;

    const fromCourse = isRecord(enr) ? (gradeBlock(enr) as unknown as Record<string, unknown>) : {};
    const fromEnroll = enrollGrades.get(cid) ?? {};
    const g = mergeGradeBlocks(fromCourse, fromEnroll);

    const gp = isRecord(enr["grading_period"]) ? (enr["grading_period"] as Record<string, unknown>) : {};

    out.push({
      id: raw["id"] as string | number,
      name: (raw["name"] as string) ?? "Course",
      course_code: raw["course_code"] as string | null,
      term: termName,
      current_score: coalesce(
        g["current_score"] as number | null,
        g["computed_current_score"] as number | null,
        g["unposted_current_score"] as number | null,
        gp["current_period_computed_current_score"] as number | null
      ),
      final_score: coalesce(
        g["final_score"] as number | null,
        g["computed_final_score"] as number | null,
        g["unposted_final_score"] as number | null,
        gp["current_period_computed_final_score"] as number | null
      ),
      current_grade: coalesce(
        g["current_grade"] as string | null,
        g["computed_current_grade"] as string | null,
        g["unposted_current_grade"] as string | null,
        gp["current_period_computed_current_grade"] as string | null
      ),
      final_grade: coalesce(
        g["final_grade"] as string | null,
        g["computed_final_grade"] as string | null,
        g["unposted_final_grade"] as string | null,
        gp["current_period_computed_final_grade"] as string | null
      ),
    });
  }
  return out;
}

// ── Course grades (port of performance.py:course_grades) ─────────────────────

export async function fetchCourseGradesPayload(
  userId: string,
  courseId: string
): Promise<CourseGradesPayload> {
  const cid = courseId;

  // enrollment for this course
  async function enrollmentForCourse(): Promise<Record<string, unknown> | null> {
    try {
      const params = new URLSearchParams();
      params.append("include[]", "grades");
      params.append("state[]", "active");
      const rows = await canvasGetAllPages(userId, "/users/self/enrollments", params);
      for (const row of rows) {
        if (!isRecord(row)) continue;
        if (row["enrollment_state"] !== undefined && row["enrollment_state"] !== null && row["enrollment_state"] !== "active") continue;
        const rcid = row["course_id"];
        if (String(rcid) === String(cid)) return row;
      }
    } catch {
      // ignore
    }
    return null;
  }

  async function safeAssignmentGroups(): Promise<unknown[]> {
    try {
      return await canvasGetAllPages(userId, `/courses/${cid}/assignment_groups`);
    } catch {
      return [];
    }
  }

  async function assignmentsWithFallback(): Promise<unknown[]> {
    const tries = [
      ["submission", "submission_comments", "score_statistics"],
      ["submission", "submission_comments"],
      ["submission"],
    ];
    for (const inc of tries) {
      try {
        const params = new URLSearchParams();
        for (const i of inc) params.append("include[]", i);
        return await canvasGetAllPages(userId, `/courses/${cid}/assignments`, params);
      } catch {
        continue;
      }
    }
    return [];
  }

  async function getSelf(): Promise<Record<string, unknown>> {
    try {
      const res = await canvasApiFetchMultiParam(userId, "/users/self");
      if (res.ok) return (await res.json()) as Record<string, unknown>;
    } catch {
      // ignore
    }
    return {};
  }

  const [selfUser, enrollment, groups, assignments] = await Promise.all([
    getSelf(),
    enrollmentForCourse(),
    safeAssignmentGroups(),
    assignmentsWithFallback(),
  ]);

  const groupNames = new Map<unknown, string | null>();
  const slimGroups: AssignmentGroupSlim[] = [];
  for (const g of groups) {
    if (isRecord(g) && g["id"] != null) {
      groupNames.set(g["id"], g["name"] as string | null);
      slimGroups.push(projectAssignmentGroupSlim(g));
    }
  }

  const grades: AssignmentGradeRow[] = [];
  for (const a of assignments) {
    if (!isRecord(a)) continue;
    const sub = isRecord(a["submission"]) ? (a["submission"] as Record<string, unknown>) : {};
    const gid = a["assignment_group_id"];
    grades.push({
      assignment_id: a["id"] as number | string | null,
      name: a["name"] as string | null,
      assignment_group_id: gid as number | string | null,
      assignment_group_name: groupNames.get(gid) ?? null,
      points_possible: a["points_possible"] as number | null,
      grading_type: a["grading_type"] as string | null,
      due_at: a["due_at"] as string | null,
      score: sub["score"] as number | null,
      grade: sub["grade"] as string | null,
      submitted_at: sub["submitted_at"] as string | null,
      graded_at: sub["graded_at"] as string | null,
      posted_at: sub["posted_at"] as string | null,
      workflow_state: sub["workflow_state"] as string | null,
      late: sub["late"] as boolean | null,
      missing: sub["missing"] as boolean | null,
      excused: sub["excused"] as boolean | null,
      attempt: sub["attempt"] as number | null,
      points_deducted: sub["points_deducted"] as number | null,
      late_policy_status: sub["late_policy_status"] as string | null,
      seconds_late: sub["seconds_late"] as number | null,
      comments: projectSubmissionComments(sub),
      score_statistics: projectScoreStatistics(a["score_statistics"]),
    });
  }

  return {
    course_id: cid,
    user_id: (selfUser["id"] as number | string | null) ?? null,
    enrollment: projectEnrollmentSlim(enrollment),
    assignment_groups: slimGroups,
    grades,
  };
}

// ── LLM grades summary (port of tutor_grades.py:format_grades_summary_for_llm) ─

export function formatGradesSummaryForLlm(gradesPayload: CourseGradesPayload): string {
  const rows = Array.isArray(gradesPayload.grades) ? gradesPayload.grades : [];
  const lines: string[] = [];

  for (const r of rows) {
    if (!r) continue;
    const name = String(r.name ?? "").trim().slice(0, 220);
    const score = r.score;
    const pp = r.points_possible;
    const stats = r.score_statistics ?? null;
    const mean = stats?.mean ?? null;
    const median = stats?.median ?? null;

    let stuPct = "";
    if (typeof score === "number" && typeof pp === "number" && pp > 0) {
      stuPct = ((score / pp) * 100).toFixed(1);
    }
    let classPct = "";
    if (typeof mean === "number" && typeof pp === "number" && pp > 0) {
      classPct = ((mean / pp) * 100).toFixed(1);
    }
    let diff = "";
    if (stuPct && classPct) {
      diff = (parseFloat(stuPct) - parseFloat(classPct)).toFixed(1);
    }

    lines.push(
      `- ${name || "(unnamed)"}: your_score=${score ?? "n/a"}, ` +
        `max_pts=${pp ?? "n/a"}, your_pct=${stuPct || "n/a"}, ` +
        `class_mean_pts=${mean ?? "n/a"}, ` +
        `class_mean_pct=${classPct || "n/a"}, you_minus_class_pct=${diff || "n/a"}, ` +
        `class_median_pts=${median ?? "n/a"}`
    );
  }

  const enr = gradesPayload.enrollment ?? null;
  const g = (enr?.grades) ?? null;
  if (g) {
    lines.unshift(
      `Course enrollment summary: ` +
        `current_score=${g.current_score ?? "n/a"}, ` +
        `final_score=${g.final_score ?? "n/a"}, ` +
        `current_grade=${g.current_grade ?? "n/a"}, ` +
        `final_grade=${g.final_grade ?? "n/a"}`
    );
  }

  return lines.join("\n");
}

// ── Quiz student results (port of quizzes.py:quiz_student_results) ────────────

function pickSubmission(
  quiz: Record<string, unknown>,
  subs: Record<string, unknown>[],
  userId: string
): Record<string, unknown> | null {
  const mine = subs.filter((s) => String(s["user_id"]) === String(userId));
  if (!mine.length) return null;
  const complete = mine.filter((s) => s["workflow_state"] === "complete");
  const pool = complete.length ? complete : mine;
  const policy = String(quiz["scoring_policy"] ?? "keep_latest").toLowerCase();
  if (policy === "keep_highest") {
    return pool.reduce((best, s) => {
      const sc = typeof s["score"] === "number" ? s["score"] : -Infinity;
      const bestSc = typeof best["score"] === "number" ? best["score"] : -Infinity;
      const att = Number(s["attempt"] ?? 0);
      const bestAtt = Number(best["attempt"] ?? 0);
      return sc > bestSc || (sc === bestSc && att > bestAtt) ? s : best;
    });
  }
  return pool.reduce((best, s) => {
    const att = Number(s["attempt"] ?? 0);
    const bestAtt = Number(best["attempt"] ?? 0);
    const fin = String(s["finished_at"] ?? "");
    const bestFin = String(best["finished_at"] ?? "");
    return att > bestAtt || (att === bestAtt && fin > bestFin) ? s : best;
  });
}

async function listQuizSubmissions(
  userId: string,
  courseId: string,
  quizId: unknown
): Promise<Record<string, unknown>[]> {
  try {
    const params = new URLSearchParams();
    params.append("include[]", "submission");
    params.append("include[]", "quiz");
    const res = await canvasApiFetchMultiParam(
      userId,
      `/courses/${courseId}/quizzes/${String(quizId)}/submissions`,
      params
    );
    if (!res.ok) return [];
    const data = (await res.json()) as unknown;
    if (!isRecord(data)) return [];
    const arr = data["quiz_submissions"];
    return Array.isArray(arr) ? (arr.filter(isRecord) as Record<string, unknown>[]) : [];
  } catch {
    return [];
  }
}

async function listSubmissionQuestions(
  userId: string,
  quizSubmissionId: unknown
): Promise<Record<string, unknown>[]> {
  try {
    const params = new URLSearchParams();
    params.append("include[]", "quiz_question");
    const res = await canvasApiFetchMultiParam(
      userId,
      `/quiz_submissions/${String(quizSubmissionId)}/questions`,
      params
    );
    if (!res.ok) return [];
    const data = (await res.json()) as unknown;
    if (!isRecord(data)) return [];
    const arr = data["quiz_submission_questions"];
    return Array.isArray(arr) ? (arr.filter(isRecord) as Record<string, unknown>[]) : [];
  } catch {
    return [];
  }
}

async function quizQuestionBanks(
  userId: string,
  courseId: string,
  quizId: unknown
): Promise<[Map<unknown, Record<string, unknown>>, Map<number, Record<string, unknown>>]> {
  const byId = new Map<unknown, Record<string, unknown>>();
  const byPos = new Map<number, Record<string, unknown>>();
  try {
    const rows = await canvasGetAllPages(
      userId,
      `/courses/${courseId}/quizzes/${String(quizId)}/questions`
    );
    for (const item of rows) {
      if (!isRecord(item)) continue;
      if (item["id"] != null) byId.set(item["id"], item);
      const pos = item["position"];
      if (typeof pos === "number") byPos.set(Math.floor(pos), item);
      else if (typeof pos === "string" && /^\d+$/.test(pos.trim())) byPos.set(parseInt(pos), item);
    }
  } catch {
    // non-fatal
  }
  return [byId, byPos];
}

function pointsOnQuestion(qsq: Record<string, unknown>): number | null {
  for (const k of ["points", "points_awarded", "score", "user_correct_points"]) {
    const v = qsq[k];
    if (typeof v === "number") return v;
  }
  return null;
}

function studentResponse(qsq: Record<string, unknown>): unknown {
  for (const k of ["answer", "answers", "text"]) {
    if (qsq[k] !== undefined && qsq[k] !== null) return qsq[k];
  }
  return null;
}

function shapeQuestion(
  qsq: Record<string, unknown>,
  index: number,
  bankById: Map<unknown, Record<string, unknown>>,
  bankByPos: Map<number, Record<string, unknown>>
): Record<string, unknown> {
  const embed = isRecord(qsq["quiz_question"]) ? qsq["quiz_question"] : {};
  const qid = (embed as Record<string, unknown>)["id"] ?? qsq["quiz_question_id"] ?? qsq["question_id"];

  let bank: Record<string, unknown> = {};
  if (qid != null && bankById.has(qid)) {
    bank = { ...bankById.get(qid)! };
  } else {
    const pos = qsq["position"];
    if (typeof pos === "number") bank = { ...(bankByPos.get(Math.floor(pos)) ?? {}) };
    else if (typeof pos === "string" && /^\d+$/.test(pos.trim())) bank = { ...(bankByPos.get(parseInt(pos)) ?? {}) };
    else if (bankByPos.has(index)) bank = { ...bankByPos.get(index)! };
  }

  const merged: Record<string, unknown> = { ...bank, ...(embed as Record<string, unknown>) };
  for (const k of ["question_text", "question_name", "name", "question_type", "points_possible"]) {
    if (merged[k] == null && qsq[k] != null) merged[k] = qsq[k];
  }

  const pp = merged["points_possible"] ?? qsq["points_possible"];
  const posRaw = qsq["position"];
  const position =
    typeof posRaw === "number"
      ? Math.floor(posRaw)
      : typeof posRaw === "string" && /^\d+$/.test(posRaw.trim())
        ? parseInt(posRaw)
        : index;

  return {
    position,
    quiz_submission_question_id: qsq["id"],
    quiz_question_id: qid ?? merged["id"],
    question_type: merged["question_type"] ?? qsq["question_type"],
    question_name: merged["question_name"] ?? merged["name"],
    question_text: merged["question_text"],
    points_possible: pp,
    points_earned: pointsOnQuestion(qsq),
    student_response: studentResponse(qsq),
    correct: qsq["correct"],
    partially_correct: qsq["partially_correct"],
    flagged: qsq["flagged"],
  };
}

async function fetchQuizStudentResults(
  userId: string,
  courseId: string,
  studentId: string
): Promise<{ quizzes: Record<string, unknown>[] }> {
  let quizzesRaw: unknown[];
  try {
    quizzesRaw = await canvasGetAllPages(userId, `/courses/${courseId}/quizzes`);
  } catch (e) {
    throw new Error(`Failed to load quizzes: ${String(e)}`);
  }

  const quizzes = quizzesRaw
    .filter(isRecord)
    .filter((q) => q["published"] !== false)
    .slice(0, 40);

  const sem = createSemaphore(5);

  const results = await Promise.all(
    quizzes.map(async (qz) => {
      const qid = qz["id"];
      const out: Record<string, unknown> = {
        quiz_id: qid,
        title: qz["title"],
        quiz_type: qz["quiz_type"],
        points_possible: qz["points_possible"],
        published: qz["published"],
        scoring_policy: qz["scoring_policy"],
        student_id: studentId,
        submission: null,
        score: null,
        questions: [],
        error: null,
      };
      await sem.acquire();
      try {
        const subs = await listQuizSubmissions(userId, courseId, qid);
        const chosen = pickSubmission(qz, subs, studentId);
        if (!chosen) {
          out["note"] = "no_submission";
          return out;
        }
        out["submission"] = {
          quiz_submission_id: chosen["id"],
          attempt: chosen["attempt"],
          workflow_state: chosen["workflow_state"],
          finished_at: chosen["finished_at"],
          score: chosen["score"],
          kept_score: chosen["kept_score"],
          fudge_points: chosen["fudge_points"],
        };
        const sc = chosen["score"];
        if (typeof sc === "number") out["score"] = sc;
        const qsid = chosen["id"];
        if (qsid == null) {
          out["note"] = "no_quiz_submission_id";
          return out;
        }
        const [qrows, [bankById, bankByPos]] = await Promise.all([
          listSubmissionQuestions(userId, qsid),
          quizQuestionBanks(userId, courseId, qid),
        ]);
        out["questions"] = qrows.map((r, i) => shapeQuestion(r, i + 1, bankById, bankByPos));
      } catch (e) {
        out["error"] = { detail: String(e) };
      } finally {
        sem.release();
      }
      return out;
    })
  );

  return { quizzes: results };
}

// Simple semaphore for concurrency limiting
function createSemaphore(maxConcurrent: number) {
  let active = 0;
  const queue: (() => void)[] = [];

  function tryNext() {
    if (active < maxConcurrent && queue.length) {
      active++;
      queue.shift()!();
    }
  }

  return {
    acquire(): Promise<void> {
      return new Promise((resolve) => {
        queue.push(resolve);
        tryNext();
      });
    },
    release() {
      active--;
      tryNext();
    },
  };
}

// ── Quiz normalization (port of quiz_normalize.py) ────────────────────────────

function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function summarizeResponse(val: unknown): string {
  if (val == null) return "";
  const s = typeof val === "string" ? val : JSON.stringify(val);
  return stripHtml(s).slice(0, 300);
}

export function normalizeCanvasQuizzes(data: { quizzes?: unknown[] }): {
  summaries: QuizRowSummary[];
  questions: NormalizedQuizQuestion[];
} {
  const summaries: QuizRowSummary[] = [];
  const questions: NormalizedQuizQuestion[] = [];
  const rawList = Array.isArray(data.quizzes) ? data.quizzes : [];

  for (const raw of rawList) {
    if (!isRecord(raw)) continue;
    const qid = (raw["quiz_id"] ?? raw["id"]) as string | number | null;
    const title = String(raw["title"] ?? "Quiz");
    const qs = Array.isArray(raw["questions"]) ? raw["questions"] : [];
    const err = raw["error"];
    const errS = isRecord(err) ? JSON.stringify(err) : typeof err === "string" ? err : null;

    summaries.push({
      quizId: qid,
      title,
      score: typeof raw["score"] === "number" ? raw["score"] : null,
      pointsPossible: typeof raw["points_possible"] === "number" ? raw["points_possible"] : null,
      questionCount: qs.length,
      note: typeof raw["note"] === "string" ? raw["note"] : null,
      error: errS,
    });

    let pos = 0;
    for (const q of qs) {
      if (!isRecord(q)) continue;
      pos++;
      const text = stripHtml(String(q["question_text"] ?? q["question_name"] ?? ""));
      let correct: boolean | null = null;
      if (typeof q["correct"] === "boolean") correct = q["correct"];
      else if (typeof q["is_correct"] === "boolean") correct = q["is_correct"];

      let pe: number | null = null;
      for (const k of ["points_earned", "points"]) {
        if (typeof q[k] === "number") { pe = q[k] as number; break; }
      }

      const ppRaw = q["points_possible"];
      const pp = typeof ppRaw === "number" ? ppRaw : null;
      const posRaw = q["position"];
      const position = typeof posRaw === "number" ? Math.floor(posRaw) : typeof posRaw === "string" && /^\d+$/.test(posRaw) ? parseInt(posRaw) : pos;
      const sr = q["student_response"] ?? q["answer"] ?? null;

      questions.push({
        quizId: qid,
        quizTitle: title,
        position,
        questionText: text,
        correct,
        studentResponse: sr,
        pointsEarned: pe,
        pointsPossible: pp,
      });
    }
  }

  return { summaries, questions };
}

export function filterAnalyzableQuestions(
  questions: NormalizedQuizQuestion[]
): NormalizedQuizQuestion[] {
  return questions.filter((q) => {
    const hasText = String(q.questionText ?? "").trim().length > 0;
    const hasSignal =
      q.correct !== null || q.studentResponse !== null || q.pointsEarned !== null;
    return hasText || hasSignal;
  });
}

export function buildQuestionTranscript(questions: NormalizedQuizQuestion[]): string {
  const blocks: string[] = [];
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const stem = q.questionText || "(no question text)";
    const corrStr =
      q.correct === null ? "unknown" : q.correct ? "correct" : "incorrect";
    const ptsStr =
      q.pointsEarned !== null && q.pointsPossible !== null
        ? `${q.pointsEarned}/${q.pointsPossible} pts`
        : "pts n/a";
    const resp = summarizeResponse(q.studentResponse);
    const lines = [
      `--- Q${i + 1} (quiz: ${q.quizTitle}) ---`,
      `Stem: ${stem}`,
      `Result: ${corrStr}; ${ptsStr}`,
    ];
    if (resp) lines.push(`Student response: ${resp}`);
    blocks.push(lines.join("\n"));
  }
  return blocks.join("\n\n");
}

function quizWeakHint(analyzable: NormalizedQuizQuestion[]): string {
  const stems: string[] = [];
  for (const q of analyzable) {
    if (q.correct === false) {
      const t = String(q.questionText ?? "").trim().slice(0, 100);
      if (t) stems.push(t);
    }
  }
  return stems.slice(0, 12).join(" · ");
}

// ── Course insights orchestration (port of course_insights.py) ────────────────

export async function loadCourseInsights(
  userId: string,
  courseId: string,
  studentId: string,
  gradesSummary: string
): Promise<CourseInsightsPayload> {
  // Lazy import to avoid circular dependency (aiService imports types from this file)
  const { generateQuizInsights, generateStudyPlanFromGrades } = await import("./aiService");

  // Attempt to fetch quizzes — a 404 means quizzes are disabled for this course,
  // which is normal. We still want to generate the study plan from grades.
  let quizFetchError: string | null = null;
  let summaries: QuizRowSummary[] = [];
  let questions: NormalizedQuizQuestion[] = [];

  try {
    const quizData = await fetchQuizStudentResults(userId, courseId, studentId);
    const normalized = normalizeCanvasQuizzes(quizData);
    summaries = normalized.summaries;
    questions = normalized.questions;
  } catch (e) {
    quizFetchError = String(e);
  }

  const quizzesUnavailable = quizFetchError !== null;
  const analyzable = filterAnalyzableQuestions(questions);
  const hint = quizWeakHint(analyzable);

  type InsightResult = { insights: import("@/types/performanceAnalytics").QuizInsights | null; called: boolean; skip?: string; err?: string };
  type PlanResult = { plan: import("@/types/performanceAnalytics").StudyPlanFromGrades | null; called: boolean; err?: string };

  const [quizResult, planResult] = await Promise.all([
    (async (): Promise<InsightResult> => {
      if (quizzesUnavailable) {
        return { insights: null, called: false };
      }
      if (!analyzable.length) {
        return { insights: null, called: false, skip: "No quiz questions with enough detail to analyze — LLM was not called." };
      }
      try {
        const transcript = buildQuestionTranscript(analyzable);
        const ins = await generateQuizInsights(courseId, studentId, transcript);
        return { insights: ins, called: true };
      } catch (e) {
        return { insights: null, called: false, err: String(e) };
      }
    })(),
    (async (): Promise<PlanResult> => {
      const g = (gradesSummary ?? "").trim();
      if (!g) return { plan: null, called: false };
      try {
        const p = await generateStudyPlanFromGrades(courseId, studentId, g, hint);
        return { plan: p, called: true };
      } catch (e) {
        return { plan: null, called: true, err: String(e) };
      }
    })(),
  ]);

  return {
    courseId,
    studentId,
    source: "canvas_quizzes",
    quizzes: summaries,
    questions,
    quizzesUnavailable,
    llmCalled: quizResult.called,
    insights: quizResult.insights ?? null,
    skipReason: quizResult.skip ?? null,
    llmError: quizResult.err ?? null,
    studyPlan: planResult.plan ?? null,
    studyPlanLlmCalled: planResult.called,
    studyPlanError: planResult.err ?? null,
  };
}
