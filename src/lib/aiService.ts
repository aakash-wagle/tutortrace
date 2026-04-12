// ── LiteLLM AI Service ────────────────────────────────────────────────────────
// Replaces the server-side @google/generative-ai SDK.
// Calls LiteLLM's OpenAI-compatible /chat/completions endpoint.
// All function signatures are identical to the old ai.ts so pages need no changes.

const LITELLM_BASE = (import.meta as unknown as { env: Record<string, string> }).env
  ?.VITE_LITELLM_BASE_URL;
const LITELLM_KEY = (import.meta as unknown as { env: Record<string, string> }).env
  ?.VITE_LITELLM_API_KEY ?? "";

async function callLiteLLM(
  prompt: string,
  model = "gemini-2.5-flash"
): Promise<string> {
  if (!LITELLM_BASE) {
    throw new Error("VITE_LITELLM_BASE_URL not configured");
  }

  const res = await fetch(`${LITELLM_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${LITELLM_KEY}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
    }),
  });

  if (!res.ok) {
    throw new Error(`LiteLLM error: ${res.status} ${res.statusText}`);
  }

  const data = (await res.json()) as {
    choices: { message: { content: string } }[];
  };
  return data.choices[0].message.content;
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

// ── Rubric Check ──────────────────────────────────────────────────────────────

export async function runRubricCheck(
  req: RubricCheckRequest
): Promise<RubricCheckResponse> {
  if (!LITELLM_BASE) {
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
    const text = await callLiteLLM(prompt);
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
  if (!LITELLM_BASE) {
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
    const text = await callLiteLLM(prompt);
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
  if (!LITELLM_BASE) {
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
    const text = await callLiteLLM(prompt);
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
  if (!LITELLM_BASE) {
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
    const text = await callLiteLLM(prompt);
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON in response");
    const parsed = JSON.parse(jsonMatch[0]) as StudyPlanResponse;
    parsed.isMock = false;
    return parsed;
  } catch {
    return getMockStudyPlan();
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
