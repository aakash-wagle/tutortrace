// ── AI completions ────────────────────────────────────────────────────────────
// Single path: OpenAI-compatible API (Groq, LiteLLM, OpenRouter, etc.).
// Set VITE_LLM_BASE_URL, VITE_LLM_MODEL, and optional VITE_LLM_API_KEY. Upstream provider keys live on the gateway.

import type { CustomCourseOutput, CustomCourseUserInput, ChapterSection, CustomChapterType } from "@/types/customCourse";

const env = (import.meta as unknown as { env: Record<string, string> }).env;

const LLM_BASE = env?.VITE_LLM_BASE_URL?.trim();
const LLM_KEY = env?.VITE_LLM_API_KEY ?? "";
/** Set in .env.local — LiteLLM model id (e.g. gemini/gemini-2.5-flash, gpt-4o-mini). No default in code. */
const LLM_MODEL = env?.VITE_LLM_MODEL?.trim() ?? "";

/** Default 4096 keeps prompt + max_tokens under Groq on-demand ~6K TPM ceilings; raise in .env for paid tiers. */
const LLM_CHAPTER_MAX_TOKENS = Math.min(
  65_536,
  Math.max(
    512,
    parseInt(env?.VITE_LLM_CHAPTER_MAX_TOKENS ?? "4096", 10) || 4096
  )
);

/** Chapter generation asks for JSON object shape via OpenAI response_format (disable if your gateway rejects it). */
const LLM_JSON_CHAPTERS = env?.VITE_LLM_JSON_CHAPTERS !== "false";

/** True when the SPA can call the configured LLM gateway (base URL + model id). */
export const isAiConfigured = !!(LLM_BASE && LLM_MODEL);

type Message = { role: "system" | "user" | "assistant"; content: string };

type CompletionOptions = {
  maxOutputTokens?: number;
  /** OpenAI-compatible response_format json_object (used for chapter JSON). */
  jsonObjectResponse?: boolean;
};

/** Same-origin path (e.g. /api/llm/v1) or absolute URL; adds http:// if user wrote host:port only. */
function resolveLlmBaseUrl(base: string): string {
  const b = base.trim();
  if (!b) return b;
  if (b.startsWith("/")) return b;
  if (/^https?:\/\//i.test(b)) return b;
  if (/^[\w.-]+:\d+/i.test(b)) return `http://${b}`;
  return b;
}

async function completion(
  promptOrMessages: string | Message[],
  model?: string,
  opts?: CompletionOptions
): Promise<string> {
  const messages: Message[] =
    typeof promptOrMessages === "string"
      ? [{ role: "user", content: promptOrMessages }]
      : promptOrMessages;

  if (!LLM_BASE) {
    throw new Error(
      "No LLM gateway configured. Set VITE_LLM_BASE_URL (e.g. http://localhost:4000/v1) and optional VITE_LLM_API_KEY in .env.local — then restart Vite."
    );
  }

  const modelId = (model ?? LLM_MODEL).trim();
  if (!modelId) {
    throw new Error(
      "No LLM model configured. Set VITE_LLM_MODEL in .env.local (e.g. openai/gpt-oss-20b or llama-3.1-8b-instant) — then restart Vite."
    );
  }

  const baseResolved = resolveLlmBaseUrl(LLM_BASE);
  const url = `${baseResolved.replace(/\/$/, "")}/chat/completions`;

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(LLM_KEY ? { Authorization: `Bearer ${LLM_KEY}` } : {}),
      },
      body: JSON.stringify({
        model: modelId,
        messages,
        temperature: 0.7,
        ...(opts?.maxOutputTokens ? { max_tokens: opts.maxOutputTokens } : {}),
        ...(opts?.jsonObjectResponse ? { response_format: { type: "json_object" } } : {}),
      }),
    });
  } catch (e) {
    const msg = errorMessage(e);
    const hint =
      " Often: wrong/missing http(s) in VITE_LLM_BASE_URL, LiteLLM not running, mixed content (https page → http API), or CORS. For local LiteLLM + dev server, use LLM_PROXY_TARGET + VITE_LLM_BASE_URL=/api/llm/v1 (see .env.local.example).";
    throw new Error(`${msg} (${url})${hint}`);
  }

  if (!res.ok) {
    let detail = "";
    try {
      detail = (await res.text()).slice(0, 400);
    } catch {
      /* ignore */
    }
    let err = `LLM error: ${res.status} ${res.statusText}${detail ? ` — ${detail}` : ""} (${url})`;
    if (res.status === 413 || /rate_limit_exceeded|tokens per minute/i.test(detail)) {
      err += ` — For Groq on-demand/low TPM: lower VITE_LLM_CHAPTER_MAX_TOKENS (e.g. 2048), shorten course text, or upgrade at https://console.groq.com/settings/billing`;
    }
    throw new Error(err);
  }

  const data = (await res.json()) as {
    choices: { message: { content: string } }[];
  };
  return data.choices[0].message.content;
}

// ── Retry helper for rate-limit errors ───────────────────────────────────────

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

function errorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "object" && e !== null && "message" in e) {
    const m = (e as { message: unknown }).message;
    if (typeof m === "string") return m;
  }
  try {
    return JSON.stringify(e);
  } catch {
    return String(e);
  }
}

/** Gemini often embeds `Please retry in 6.12s` in the error body. */
function retryAfterMsFromMessage(msg: string): number | null {
  const m = msg.match(/Please retry in ([\d.]+)\s*s\b/i);
  if (!m) return null;
  const sec = parseFloat(m[1]);
  if (!Number.isFinite(sec) || sec < 0) return null;
  return Math.ceil(sec * 1000) + Math.floor(Math.random() * 400);
}

function isRetryable(e: unknown): boolean {
  const msg = errorMessage(e);
  if (/429|503|quota|rate limit|overloaded|unavailable|resource_exhausted/i.test(msg)) return true;
  // Truncated or sloppy JSON from the model — worth one regeneration
  if (
    /unterminated string|unexpected end of json|expected .* after json|json\.parse|syntaxerror/i.test(
      msg
    )
  ) {
    return true;
  }
  return false;
}

/** Hard auth / billing — not fixed by backoff (Gemini still suggests retry for many 429s). */
function isLikelyNonRetryableQuota(msg: string): boolean {
  if (/Please retry in/i.test(msg)) return false;
  return /billing has not been enabled|API keys are not supported|API_KEY_INVALID/i.test(msg);
}

async function withRetries<T>(run: () => Promise<T>, attempts = 3): Promise<T> {
  let last: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await run();
    } catch (e) {
      last = e;
      const msg = errorMessage(e);
      if (isLikelyNonRetryableQuota(msg) || !isRetryable(e) || i === attempts - 1) {
        if (/quota|429|rate limit/i.test(msg) && e instanceof Error && !/VITE_LLM_BASE_URL/.test(e.message)) {
          e.message = `${e.message} — Tip: check VITE_LLM_MODEL / LiteLLM routing and upstream provider quotas.`;
        }
        throw e;
      }
      const fromApi = retryAfterMsFromMessage(msg);
      const backoff = fromApi ?? 2000 * (i + 1) + Math.floor(Math.random() * 800);
      await sleep(Math.min(Math.max(backoff, 1500), 90_000));
    }
  }
  throw last;
}

// ── JSON extraction helper ────────────────────────────────────────────────────

function extractJson(text: string): string {
  // Strip possible markdown fences
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) return fenced[1].trim();
  // Fall back to first JSON object or array
  const obj = text.match(/\{[\s\S]*\}/);
  const arr = text.match(/\[[\s\S]*\]/);
  if (obj && arr) {
    return obj.index! < arr.index! ? obj[0] : arr[0];
  }
  return (obj ?? arr)?.[0] ?? text;
}

/** Slice one `{ ... }` from `start` with string/escape awareness (avoids greedy-regex eating junk). */
function sliceBalancedObject(text: string, start: number): string | null {
  if (start < 0 || start >= text.length || text[start] !== "{") return null;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (inString) {
      if (c === "\\") escape = true;
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') {
      inString = true;
      continue;
    }
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

/** Slice one `[ ... ]` from `start` with string/escape awareness. */
function sliceBalancedArray(text: string, start: number): string | null {
  if (start < 0 || start >= text.length || text[start] !== "[") return null;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (inString) {
      if (c === "\\") escape = true;
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') {
      inString = true;
      continue;
    }
    if (c === "[") depth++;
    else if (c === "]") {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

/** Prefer `{ "sections": ... }` via brace matching; avoids invalid trailing `+---+` etc. */
function extractChapterJsonPayload(raw: string): string {
  const text = raw.trim().replace(/^\uFEFF/, "");
  // Use the LAST fenced block — thinking tokens may produce earlier fences
  const fencedMatches = [...text.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi)];
  const fenced = fencedMatches.length > 0 ? fencedMatches[fencedMatches.length - 1] : null;
  if (fenced) {
    const inner = fenced[1].trim();
    const arrInner = inner.indexOf("[");
    if (arrInner >= 0) {
      const slice = sliceBalancedArray(inner, arrInner);
      if (slice) return slice;
    }
    const fromInner = tryChapterPayloadFromObjectScan(inner);
    if (fromInner) return fromInner;
  }
  const trimStart = text.trimStart();
  if (trimStart.startsWith("[")) {
    const arrAt = text.indexOf("[");
    const slice = sliceBalancedArray(text, arrAt);
    if (slice) return slice;
  }
  const anchored = tryChapterPayloadFromObjectScan(text);
  if (anchored) return anchored;
  return extractJson(text);
}

function tryChapterPayloadFromObjectScan(text: string): string | null {
  // Use lastIndexOf so thinking-token preamble (which may contain "sections") is ignored
  // in favour of the final answer at the end of the text.
  const keyIdx = text.lastIndexOf('"sections"');
  if (keyIdx >= 0) {
    const start = text.lastIndexOf("{", keyIdx);
    if (start >= 0) {
      const slice = sliceBalancedObject(text, start);
      if (slice) return slice;
    }
  }
  // Fall back: try the last { in the text
  const last = text.lastIndexOf("{");
  if (last >= 0) {
    const slice = sliceBalancedObject(text, last);
    if (slice) return slice;
  }
  // Last resort: first {
  const first = text.indexOf("{");
  if (first >= 0) {
    const slice = sliceBalancedObject(text, first);
    if (slice) return slice;
  }
  return null;
}

// ── Course Layout Generation ──────────────────────────────────────────────────

const LAYOUT_SYSTEM = `You are a course curriculum designer. Reply with JSON only — no markdown fences, no extra text.
Output shape: { "category": string, "topic": string, "description": string, "level": string, "duration": string, "chapters": [ { "chapter_name": string, "description": string, "duration": string } ] }`;

export async function generateCourseLayout(
  userInput: CustomCourseUserInput
): Promise<CustomCourseOutput> {
  const wantsVideo = userInput.video?.trim().toLowerCase() === "yes";
  const videoNote = wantsVideo
    ? "Chapter descriptions may briefly note what a video would reinforce (videos will be attached later)."
    : "This course has NO video supplements. Chapter descriptions must outline substantial written lesson content so each chapter is self-contained.";

  const prompt = `Generate a course tutorial with the following details. Include a field name and description, along with chapter names and durations.
Category: '${userInput.category}'
Topic: '${userInput.topic}'
Description: '${userInput.description ?? ""}'
Level: '${userInput.difficulty}'
Duration: '${userInput.duration}'
Number of chapters: ${userInput.totalChapters}
${videoNote}
Reply as JSON per the system instruction.`;

  const text = await withRetries(() =>
    completion(
      [
        { role: "system", content: LAYOUT_SYSTEM },
        { role: "user", content: prompt },
      ]
    )
  );

  return JSON.parse(extractJson(text)) as CustomCourseOutput;
}

// ── Chapter Content Generation ────────────────────────────────────────────────

const CHAPTERS_SYSTEM_VIDEO = `JSON only, one object: {"sections":[{"title":"...","explanation":"..."}]} .
Optional per section: "code_examples":[{ "code": "actual source here" }] only when you have real, non-trivial code (≥2 lines). If a section has no code, omit "code_examples" entirely — never send empty strings or placeholder entries.
2–4 sections. explanation: Markdown (##, bullets, **bold**), complements a future video, max ~900 chars each.
Valid JSON: escape " as \\"; use \\n for newlines inside strings; no pipe or +---+ tables.`;

const CHAPTERS_SYSTEM_TEXT = `JSON only, one object: {"sections":[{"title":"...","explanation":"..."}]} .
Optional per section: "code_examples":[{ "code": "actual source here" }] only when you have real, non-trivial code (≥2 lines). If a section has no code, omit "code_examples" entirely — never send empty strings or placeholder entries.
2–4 sections; no video. explanation: Markdown (##/###, bullets, **bold**), max ~900 chars each.
Valid JSON: escape " as \\"; use \\n for newlines inside strings; no pipe or +---+ tables.`;

export async function generateChapterContent(
  courseName: string,
  chapter: CustomChapterType,
  includeVideo: boolean
): Promise<ChapterSection[]> {
  const system = includeVideo ? CHAPTERS_SYSTEM_VIDEO : CHAPTERS_SYSTEM_TEXT;
  const videoNote = includeVideo
    ? "Follow the system JSON shape; keep total output concise for token limits."
    : "Follow the system JSON shape; keep total output concise for token limits.";

  const prompt = `Topic: ${courseName}, Chapter: ${chapter.chapter_name}. Chapter overview: ${chapter.description ?? ""}. ${videoNote}`;

  return withRetries(async () => {
    const text = await completion(
      [
        { role: "system", content: system },
        { role: "user", content: prompt },
      ],
      undefined,
      {
        maxOutputTokens: LLM_CHAPTER_MAX_TOKENS,
        jsonObjectResponse: LLM_JSON_CHAPTERS,
      }
    );
    return parseChapterSectionsJson(text);
  });
}

/** Parse model output into chapter sections (supports legacy raw array or { sections }). */
function parseChapterSectionsJson(text: string): ChapterSection[] {
  let raw: unknown;
  const payload = extractChapterJsonPayload(text);
  try {
    raw = JSON.parse(payload);
  } catch (e) {
    const hint =
      e instanceof Error
        ? `${e.message} — Adjust VITE_LLM_CHAPTER_MAX_TOKENS (lower for Groq free/on-demand TPM), or VITE_LLM_JSON_CHAPTERS=false if your gateway rejects json_object mode.`
        : String(e);
    throw new Error(hint);
  }
  if (Array.isArray(raw)) {
    return normalizeChapterSections(raw as ChapterSection[]);
  }
  if (raw && typeof raw === "object" && "sections" in raw && Array.isArray((raw as { sections: unknown }).sections)) {
    return normalizeChapterSections((raw as { sections: ChapterSection[] }).sections);
  }
  throw new Error('Expected a JSON array of sections or an object with a "sections" array.');
}

function normalizeChapterSections(sections: ChapterSection[]): ChapterSection[] {
  return sections.map((s) => {
    const filtered = s.code_examples?.filter((c) => typeof c.code === "string" && c.code.trim().length > 0);
    const { code_examples: _, ...rest } = s;
    return filtered?.length ? { ...rest, code_examples: filtered } : { ...rest };
  });
}

// ── Types (re-exported for page compatibility) ─────────────────────────────────

export interface RubricCheckRequest {
  assignmentTitle: string;
  requirements?: string[];
  rubricCriteria: { name: string; points: number; description: string }[];
  studentText?: string;
  citations?: string[];
}

export interface CriterionResult {
  name: string;
  status: "strong" | "gaps" | "missing";
  evidence: string;
  suggestions: string[];
}

export interface RubricCheckResponse {
  summary: string;
  criteria: CriterionResult[];
  nextSteps: string[];
  sourcesUsed: string[];
  isMock?: boolean;
}

export interface FlashcardItem {
  front: string;
  back: string;
  hint?: string;
  difficulty: "easy" | "medium" | "hard";
}

export interface GenerateFlashcardsRequest {
  title: string;
  content: string;
  maxCards?: number;
}

export interface GenerateFlashcardsResponse {
  cards: FlashcardItem[];
  isMock: boolean;
}

export interface ExplainAssignmentRequest {
  assignmentTitle: string;
  description: string;
  rubricCriteria: { name: string; points: number; description: string }[];
  pointsPossible: number;
}

export interface ExplainAssignmentResponse {
  tldr: string;
  keyRequirements: string[];
  commonMistakes: string[];
  isMock?: boolean;
}

export interface StudyPlanRequest {
  assignmentTitle: string;
  dueAt: string | null;
  pointsPossible: number;
  rubricCriteria: { name: string; points: number }[];
}

export interface StudyPlanStep {
  title: string;
  description: string;
  estimatedMinutes: number;
}

export interface StudyPlanResponse {
  steps: StudyPlanStep[];
  totalEstimatedHours: number;
  isMock?: boolean;
}

export interface AssignmentCoachAllRequest {
  assignmentTitle: string;
  description: string;
  rubricCriteria: { name: string; points: number; description: string }[];
  pointsPossible: number;
  requirements?: string[];
  dueAt?: string | null;
}

export interface AssignmentCoachAllResult {
  rubricCheck: RubricCheckResponse;
  explain: ExplainAssignmentResponse;
  studyPlan: StudyPlanResponse;
}

// ── Rubric Check ──────────────────────────────────────────────────────────────

export async function runRubricCheck(
  req: RubricCheckRequest
): Promise<RubricCheckResponse> {
  if (!isAiConfigured) {
    const mock = getMockRubricCheck(req);
    mock.isMock = true;
    return mock;
  }

  const rubricBlock = req.rubricCriteria
    .map((c) => `- ${c.name} (${c.points} pts): ${c.description}`)
    .join("\n");

  const prompt = `You are an expert academic coach. A student needs guidance on the following assignment.

ASSIGNMENT TITLE: ${req.assignmentTitle}
${req.requirements?.length ? `\nREQUIREMENTS:\n${req.requirements.map((r) => `- ${r}`).join("\n")}` : ""}

RUBRIC CRITERIA:
${rubricBlock}

${req.studentText ? `STUDENT'S CURRENT WORK:\n${req.studentText.slice(0, 4000)}` : "NOTE: The student has not submitted text yet. Provide proactive guidance on how to approach each rubric criterion to earn full marks."}
${req.citations?.length ? `\nCITATIONS PROVIDED: ${req.citations.join(", ")}` : ""}

INSTRUCTIONS:
Analyze the assignment against its rubric criteria and provide structured feedback.
- For each criterion, assess whether the student's approach would be "strong", has "gaps", or is "missing".
- Provide specific, actionable evidence and suggestions.

Respond ONLY with valid JSON in exactly this format (no markdown fences):
{
  "summary": "1-2 sentence overview",
  "criteria": [
    {
      "name": "criterion name",
      "status": "strong|gaps|missing",
      "evidence": "specific evidence or guidance",
      "suggestions": ["actionable suggestion 1", "actionable suggestion 2"]
    }
  ],
  "nextSteps": ["prioritized step 1", "prioritized step 2", "prioritized step 3"],
  "sourcesUsed": ["assignment rubric"]
}`;

  try {
    const text = await completion(prompt);
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON in LiteLLM response");
    const parsed = JSON.parse(jsonMatch[0]) as RubricCheckResponse;
    parsed.isMock = false;
    return parsed;
  } catch (error) {
    console.error("runRubricCheck failed, using mock:", error);
    const mock = getMockRubricCheck(req);
    mock.isMock = true;
    return mock;
  }
}

// ── Flashcard Generation ───────────────────────────────────────────────────────

export async function generateFlashcards(
  req: GenerateFlashcardsRequest
): Promise<GenerateFlashcardsResponse> {
  if (!isAiConfigured) {
    return { cards: getMockFlashcards(req), isMock: true };
  }

  const maxCards = req.maxCards ?? 15;

  const prompt = `You are an expert academic tutor creating study flashcards for a college student.

TOPIC: ${req.title}

SOURCE CONTENT:
${req.content.slice(0, 15000)}

INSTRUCTIONS:
Generate exactly ${maxCards} high-quality flashcards from the source content above.

Requirements:
- Each card's "front" should be a clear, specific question or prompt
- Each card's "back" should be a concise, accurate answer
- Include a brief "hint" that nudges toward the answer without giving it away
- Rate each card's difficulty: "easy" (recall/definition), "medium" (understanding/application), "hard" (analysis/synthesis)
- Cover: key definitions, important concepts, relationships between ideas, formulas, procedures, and real-world applications
- Questions must be answerable from the source content

Respond ONLY with a valid JSON array (no markdown fences):
[
  {
    "front": "What is...?",
    "back": "It is...",
    "hint": "Think about...",
    "difficulty": "medium"
  }
]`;

  try {
    const text = await completion(prompt);
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error("No JSON array in LiteLLM response");
    const cards = JSON.parse(jsonMatch[0]) as FlashcardItem[];
    const validCards = cards.filter(
      (c) => c.front && c.back && typeof c.front === "string"
    );
    if (validCards.length === 0) throw new Error("No valid flashcards returned");
    return { cards: validCards, isMock: false };
  } catch (error) {
    console.error("generateFlashcards failed, using mock:", error);
    return { cards: getMockFlashcards(req), isMock: true };
  }
}

// ── Assignment Explainer ────────────────────────────────────────────────────────

export async function explainAssignment(
  req: ExplainAssignmentRequest
): Promise<ExplainAssignmentResponse> {
  if (!isAiConfigured) {
    return {
      tldr: `"${req.assignmentTitle}" asks you to demonstrate understanding through ${req.rubricCriteria.length} assessed areas worth ${req.pointsPossible} points total.`,
      keyRequirements: req.rubricCriteria.map(
        (c) => `${c.name} (${c.points} pts): ${c.description.slice(0, 80)}`
      ),
      commonMistakes: [
        "Not addressing every rubric criterion explicitly",
        "Spending too much time on lower-weight criteria",
        "Submitting without reviewing against the rubric",
      ],
      isMock: true,
    };
  }

  const rubricBlock = req.rubricCriteria
    .map((c) => `- ${c.name} (${c.points} pts): ${c.description}`)
    .join("\n");

  const prompt = `You are a friendly teaching assistant. In plain, simple language, explain what this assignment is asking for.

ASSIGNMENT: ${req.assignmentTitle}
DESCRIPTION: ${req.description?.slice(0, 2000) || "No description provided"}
RUBRIC:
${rubricBlock}

Respond ONLY with valid JSON (no markdown fences):
{
  "tldr": "1-2 sentence plain-English summary",
  "keyRequirements": ["requirement 1", "requirement 2"],
  "commonMistakes": ["mistake 1", "mistake 2"]
}`;

  try {
    const text = await completion(prompt);
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON in response");
    const parsed = JSON.parse(jsonMatch[0]) as ExplainAssignmentResponse;
    parsed.isMock = false;
    return parsed;
  } catch {
    return {
      tldr: `"${req.assignmentTitle}" requires you to address ${req.rubricCriteria.length} criteria worth ${req.pointsPossible} points.`,
      keyRequirements: req.rubricCriteria.map(
        (c) => `${c.name}: ${c.description.slice(0, 80)}`
      ),
      commonMistakes: [
        "Not addressing every criterion",
        "Skipping the rubric review before submission",
      ],
      isMock: true,
    };
  }
}

// ── Study Plan Generator ───────────────────────────────────────────────────────

export async function generateStudyPlan(
  req: StudyPlanRequest
): Promise<StudyPlanResponse> {
  if (!isAiConfigured) {
    return getMockStudyPlan();
  }

  const rubricBlock = req.rubricCriteria
    .map((c) => `- ${c.name} (${c.points} pts)`)
    .join("\n");
  const dueInfo = req.dueAt
    ? `Due: ${new Date(req.dueAt).toLocaleDateString()}`
    : "No due date provided";

  const prompt = `You are an academic coach. Generate a structured, step-by-step study plan.

ASSIGNMENT: ${req.assignmentTitle}
${dueInfo}
WORTH: ${req.pointsPossible} points
RUBRIC AREAS:
${rubricBlock}

Respond ONLY with valid JSON (no markdown fences):
{
  "steps": [
    {
      "title": "Short step name",
      "description": "What to do in this step",
      "estimatedMinutes": 30
    }
  ],
  "totalEstimatedHours": 2.5
}

Generate 6-9 concrete, actionable steps with realistic time estimates.`;

  try {
    const text = await completion(prompt);
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON in response");
    const parsed = JSON.parse(jsonMatch[0]) as StudyPlanResponse;
    parsed.isMock = false;
    return parsed;
  } catch {
    return getMockStudyPlan();
  }
}

// ── Combined Assignment Coach (single LLM call) ───────────────────────────────

export async function runAssignmentCoachAll(
  req: AssignmentCoachAllRequest
): Promise<AssignmentCoachAllResult> {
  if (!isAiConfigured) {
    return {
      rubricCheck: { ...getMockRubricCheck({ assignmentTitle: req.assignmentTitle, rubricCriteria: req.rubricCriteria }), isMock: true },
      explain: {
        tldr: `"${req.assignmentTitle}" asks you to demonstrate understanding through ${req.rubricCriteria.length} assessed areas worth ${req.pointsPossible} points total.`,
        keyRequirements: req.rubricCriteria.map((c) => `${c.name} (${c.points} pts): ${c.description.slice(0, 80)}`),
        commonMistakes: ["Not addressing every rubric criterion explicitly", "Spending too much time on lower-weight criteria", "Submitting without reviewing against the rubric"],
        isMock: true,
      },
      studyPlan: getMockStudyPlan(),
    };
  }

  const rubricBlock = req.rubricCriteria.map((c) => `- ${c.name} (${c.points} pts): ${c.description}`).join("\n");
  const dueInfo = req.dueAt ? `Due: ${new Date(req.dueAt).toLocaleDateString()}` : "No due date provided";

  const prompt = `You are an academic coach. Analyze this assignment and return ONE JSON object with exactly three keys: "rubricCheck", "explain", and "studyPlan".

ASSIGNMENT: ${req.assignmentTitle}
DESCRIPTION: ${req.description?.slice(0, 2000) || "No description provided"}
${req.requirements?.length ? `\nREQUIREMENTS:\n${req.requirements.map((r) => `- ${r}`).join("\n")}` : ""}
${dueInfo}
WORTH: ${req.pointsPossible} points
RUBRIC:
${rubricBlock}

Respond ONLY with valid JSON (no markdown fences) matching this exact shape:
{
  "rubricCheck": {
    "summary": "1-2 sentence overview",
    "criteria": [{ "name": "criterion name", "status": "strong|gaps|missing", "evidence": "specific guidance", "suggestions": ["action 1", "action 2"] }],
    "nextSteps": ["step 1", "step 2", "step 3"],
    "sourcesUsed": ["assignment rubric"]
  },
  "explain": {
    "tldr": "1-2 sentence plain-English summary",
    "keyRequirements": ["requirement 1", "requirement 2"],
    "commonMistakes": ["mistake 1", "mistake 2"]
  },
  "studyPlan": {
    "steps": [{ "title": "Short step name", "description": "What to do", "estimatedMinutes": 30 }],
    "totalEstimatedHours": 2.5
  }
}`;

  try {
    const text = await completion(prompt);
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON in response");
    const parsed = JSON.parse(jsonMatch[0]) as AssignmentCoachAllResult;
    parsed.rubricCheck.isMock = false;
    parsed.explain.isMock = false;
    parsed.studyPlan.isMock = false;
    return parsed;
  } catch (error) {
    console.error("runAssignmentCoachAll failed:", error);
    throw error;
  }
}

// ── Mock Fallbacks ─────────────────────────────────────────────────────────────

function getMockFlashcards(req: GenerateFlashcardsRequest): FlashcardItem[] {
  const topics = req.title.split(/\s+/).filter((w) => w.length > 3);
  const mainTopic = topics.slice(0, 3).join(" ") || "this topic";
  return [
    { front: `What is the primary focus of ${mainTopic}?`, back: `${mainTopic} focuses on understanding the fundamental concepts and their applications.`, hint: "Think about the core definition", difficulty: "easy" },
    { front: `Name three key components of ${mainTopic}.`, back: "1. Theoretical foundations\n2. Practical applications\n3. Critical analysis methods", hint: "Consider the main building blocks", difficulty: "medium" },
    { front: `How does ${mainTopic} differ from related fields?`, back: "It differs primarily in its approach to methodology and emphasis on empirical evidence.", hint: "Compare approaches and methods", difficulty: "hard" },
    { front: `What are the key terms associated with ${mainTopic}?`, back: "Key terms include: hypothesis, methodology, analysis, synthesis, evaluation, and application.", hint: "Think about academic vocabulary", difficulty: "easy" },
    { front: `Describe the historical development of ${mainTopic}.`, back: "It evolved from early theoretical work through several paradigm shifts to its current interdisciplinary form.", hint: "Consider the timeline", difficulty: "medium" },
    { front: `What is the significance of evidence-based reasoning in ${mainTopic}?`, back: "Evidence-based reasoning ensures conclusions are grounded in observable data.", hint: "Why does evidence matter?", difficulty: "medium" },
    { front: `Give an example of how ${mainTopic} applies in practice.`, back: "In practice, it can be applied using systematic analysis and structured decision-making frameworks.", hint: "Think about real-world scenarios", difficulty: "hard" },
    { front: `What are common misconceptions about ${mainTopic}?`, back: "Common misconceptions include oversimplifying complex relationships and confusing correlation with causation.", hint: "What do people often get wrong?", difficulty: "medium" },
  ];
}

function getMockRubricCheck(req: RubricCheckRequest): RubricCheckResponse {
  return {
    summary: `Analysis of "${req.assignmentTitle}": review each rubric criterion below for targeted guidance.`,
    criteria: req.rubricCriteria.map((c, i) => ({
      name: c.name,
      status: (["strong", "gaps", "missing"] as const)[i % 3],
      evidence: `This criterion expects: ${c.description.slice(0, 100)}`,
      suggestions: [
        `Address the ${c.name} criterion explicitly`,
        `Allocate time proportional to its weight (${c.points} pts)`,
      ],
    })),
    nextSteps: [
      "Read each rubric criterion carefully",
      "Outline your approach before starting",
      "Review your work against the rubric before submitting",
    ],
    sourcesUsed: ["Assignment rubric"],
    isMock: true,
  };
}

function getMockStudyPlan(): StudyPlanResponse {
  const steps: StudyPlanStep[] = [
    { title: "Read the assignment prompt", description: "Carefully read through the full requirements, rubric, and any provided materials.", estimatedMinutes: 15 },
    { title: "Research and gather sources", description: "Find relevant sources, take notes, and organize by rubric criterion.", estimatedMinutes: 60 },
    { title: "Create an outline", description: "Structure your response to address each rubric criterion in order of point value.", estimatedMinutes: 20 },
    { title: "Draft your response", description: "Write a complete first draft following your outline.", estimatedMinutes: 90 },
    { title: "Self-review with rubric", description: "Check each criterion against your draft and add missing elements.", estimatedMinutes: 20 },
    { title: "Revise and polish", description: "Fix grammar, clarity, and formatting.", estimatedMinutes: 30 },
    { title: "Final submission", description: "Submit on time and confirm receipt.", estimatedMinutes: 5 },
  ];
  const total = steps.reduce((s, x) => s + x.estimatedMinutes, 0);
  return { steps, totalEstimatedHours: Math.round((total / 60) * 10) / 10, isMock: true };
}
