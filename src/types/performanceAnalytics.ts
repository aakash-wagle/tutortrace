// ── Grade block types ─────────────────────────────────────────────────────────

export type GradeBlock = {
  current_score?: number | null;
  final_score?: number | null;
  current_grade?: string | null;
  final_grade?: string | null;
  current_points?: number | null;
  computed_current_score?: number | null;
  computed_final_score?: number | null;
  computed_current_grade?: string | null;
  computed_final_grade?: string | null;
  unposted_current_score?: number | null;
  unposted_final_score?: number | null;
  unposted_current_grade?: string | null;
  unposted_final_grade?: string | null;
  [key: string]: unknown;
};

export type GradesOverviewRow = {
  course_id?: number | string;
  course_code?: string | null;
  name?: string | null;
  term?: string | null;
  enrollment_state?: string | null;
  grades?: GradeBlock;
  grading_period?: Record<string, unknown>;
  activity?: Record<string, unknown>;
  hide_final_grades?: boolean;
};

export type EnrollmentSlim = {
  enrollment_id?: number | string | null;
  enrollment_state?: string | null;
  type?: string | null;
  role?: string | null;
  grades?: GradeBlock;
  grading_period?: Record<string, unknown>;
  activity?: Record<string, unknown>;
};

export type AssignmentGroupSlim = {
  id?: number | string;
  name?: string | null;
  group_weight?: number | null;
  position?: number | null;
  rules?: unknown;
};

export type SubmissionComment = {
  id?: number | string;
  author_display_name?: string | null;
  comment?: string | null;
  created_at?: string | null;
  edited_at?: string | null;
};

export type ScoreStatisticSlim = {
  min?: number | null;
  max?: number | null;
  mean?: number | null;
  median?: number | null;
  upper_q?: number | null;
  lower_q?: number | null;
};

export type AssignmentGradeRow = {
  assignment_id?: number | string | null;
  name?: string | null;
  assignment_group_id?: number | string | null;
  assignment_group_name?: string | null;
  points_possible?: number | null;
  grading_type?: string | null;
  due_at?: string | null;
  score?: number | null;
  grade?: string | null;
  submitted_at?: string | null;
  graded_at?: string | null;
  posted_at?: string | null;
  workflow_state?: string | null;
  late?: boolean | null;
  missing?: boolean | null;
  excused?: boolean | null;
  attempt?: number | null;
  points_deducted?: number | null;
  late_policy_status?: string | null;
  seconds_late?: number | null;
  comments?: SubmissionComment[];
  score_statistics?: ScoreStatisticSlim | null;
};

export type CourseGradesPayload = {
  course_id?: string;
  user_id?: number | string | null;
  enrollment?: EnrollmentSlim | null;
  assignment_groups?: AssignmentGroupSlim[];
  grades?: AssignmentGradeRow[];
};

// ── Course list types ─────────────────────────────────────────────────────────

export type CourseGridItem = {
  id: string | number;
  name: string;
  course_code?: string | null;
  term?: string | null;
  current_score?: number | null;
  final_score?: number | null;
  current_grade?: string | null;
  final_grade?: string | null;
};

// ── Quiz and insights types ───────────────────────────────────────────────────

export type NormalizedQuizQuestion = {
  quizId: string | number | null;
  quizTitle: string;
  position: number;
  questionText: string;
  correct: boolean | null;
  studentResponse: unknown;
  pointsEarned: number | null;
  pointsPossible: number | null;
};

export type QuizRowSummary = {
  quizId: string | number | null;
  title: string;
  score: number | null;
  pointsPossible: number | null;
  questionCount: number;
  note?: string | null;
  error?: string | null;
};

export type QuizInsights = {
  overview: string;
  weak_areas: { topic: string; evidence: string }[];
  strong_areas: { topic: string; evidence: string }[];
  study_recommendations: string[];
};

export type StudyPlanFromGrades = {
  compare_to_class: string;
  path_to_grade: string;
  study_next: string[];
};

export type CourseInsightsPayload = {
  courseId: string;
  studentId: string;
  source: "canvas_quizzes";
  quizzes: QuizRowSummary[];
  questions: NormalizedQuizQuestion[];
  /** True when Canvas returned 404 for /quizzes (quizzes disabled for this course). */
  quizzesUnavailable?: boolean;
  llmCalled: boolean;
  insights: QuizInsights | null;
  skipReason?: string | null;
  fetchError?: string | null;
  llmError?: string | null;
  studyPlan?: StudyPlanFromGrades | null;
  studyPlanLlmCalled?: boolean;
  studyPlanError?: string | null;
};

// ── Combined analytics response ───────────────────────────────────────────────

export type CourseAnalyticsResult = {
  courseId: string;
  grades: CourseGradesPayload;
  insights: CourseInsightsPayload;
};
