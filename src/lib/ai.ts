import { GoogleGenerativeAI, GenerativeModel } from "@google/generative-ai";

const MODEL_CHAIN = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-2.0-flash-lite"];

function getGenAI(): GoogleGenerativeAI | null {
  const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
  if (!apiKey) return null;
  return new GoogleGenerativeAI(apiKey);
}

async function generateWithFallback(
  genAI: GoogleGenerativeAI,
  prompt: string
): Promise<string> {
  let lastError: Error | null = null;

  for (const modelName of MODEL_CHAIN) {
    try {
      const model: GenerativeModel = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent(prompt);
      return result.response.text();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      const is429 = lastError.message.includes("429") || lastError.message.includes("Too Many Requests");
      const is404 = lastError.message.includes("404") || lastError.message.includes("Not Found");
      if (is429 || is404) {
        console.warn(`Model ${modelName} unavailable (${is429 ? "rate limited" : "not found"}), trying next...`);
        continue;
      }
      throw lastError;
    }
  }

  throw lastError || new Error("All Gemini models exhausted");
}

// ===================== Rubric Check =====================

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

export async function runRubricCheck(
  req: RubricCheckRequest
): Promise<RubricCheckResponse> {
  const genAI = getGenAI();
  if (!genAI) {
    console.warn("GOOGLE_GEMINI_API_KEY not set — returning mock rubric check");
    const mock = getMockRubricCheck(req);
    mock.isMock = true;
    return mock;
  }

  try {
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
- If no student text is provided, give guidance on what each criterion expects and how to meet it.

Respond ONLY with valid JSON in exactly this format (no markdown fences):
{
  "summary": "1-2 sentence overview of the assignment expectations and key focus areas",
  "criteria": [
    {
      "name": "criterion name matching the rubric",
      "status": "strong|gaps|missing",
      "evidence": "specific evidence or detailed guidance for this criterion",
      "suggestions": ["actionable suggestion 1", "actionable suggestion 2"]
    }
  ],
  "nextSteps": ["prioritized step 1", "prioritized step 2", "prioritized step 3"],
  "sourcesUsed": ["assignment rubric"]
}`;

    const text = await generateWithFallback(genAI, prompt);

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("Gemini rubric check: no JSON found in response:", text.slice(0, 200));
      throw new Error("No JSON in Gemini response");
    }

    const parsed = JSON.parse(jsonMatch[0]) as RubricCheckResponse;
    parsed.isMock = false;
    return parsed;
  } catch (error) {
    console.error("Gemini rubric check failed:", error);
    throw error;
  }
}

// ===================== Flashcard Generation =====================

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

export async function generateFlashcards(
  req: GenerateFlashcardsRequest
): Promise<GenerateFlashcardsResponse> {
  const genAI = getGenAI();
  if (!genAI) {
    console.warn("GOOGLE_GEMINI_API_KEY not set — returning mock flashcards");
    return { cards: getMockFlashcards(req), isMock: true };
  }

  try {
    const maxCards = req.maxCards || 15;

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
- Vary question styles: "What is…", "How does… differ from…", "Explain why…", "What happens when…", "Give an example of…"
- Questions must be answerable from the source content — do not invent facts

Respond ONLY with a valid JSON array (no markdown fences, no surrounding text):
[
  {
    "front": "What is...?",
    "back": "It is...",
    "hint": "Think about...",
    "difficulty": "medium"
  }
]`;

    const text = await generateWithFallback(genAI, prompt);

    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.error("Gemini flashcard generation: no JSON array found:", text.slice(0, 200));
      throw new Error("No JSON array in Gemini response");
    }

    const cards = JSON.parse(jsonMatch[0]) as FlashcardItem[];
    const validCards = cards.filter(
      (c) => c.front && c.back && typeof c.front === "string" && typeof c.back === "string"
    );

    if (validCards.length === 0) throw new Error("Gemini returned no valid flashcards");

    return { cards: validCards, isMock: false };
  } catch (error) {
    console.error("Gemini flashcard generation failed:", error);
    throw error;
  }
}

// ===================== Assignment Explain =====================

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

export async function explainAssignment(
  req: ExplainAssignmentRequest
): Promise<ExplainAssignmentResponse> {
  const genAI = getGenAI();
  if (!genAI) {
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

  try {
    const rubricBlock = req.rubricCriteria
      .map((c) => `- ${c.name} (${c.points} pts): ${c.description}`)
      .join("\n");

    const prompt = `You are a friendly teaching assistant. In plain, simple language, explain what this assignment is asking for so a student fully understands what to do.

ASSIGNMENT: ${req.assignmentTitle}
DESCRIPTION: ${req.description?.slice(0, 2000) || "No description provided"}
RUBRIC:
${rubricBlock}

Respond ONLY with valid JSON (no markdown fences):
{
  "tldr": "1-2 sentence plain-English summary of what this assignment is asking",
  "keyRequirements": ["specific thing the assignment requires", "another requirement", "..."],
  "commonMistakes": ["mistake students often make on assignments like this", "..."]
}`;

    const text = await generateWithFallback(genAI, prompt);
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON in response");

    const parsed = JSON.parse(jsonMatch[0]) as ExplainAssignmentResponse;
    parsed.isMock = false;
    return parsed;
  } catch {
    return {
      tldr: `"${req.assignmentTitle}" requires you to address ${req.rubricCriteria.length} criteria worth ${req.pointsPossible} points.`,
      keyRequirements: req.rubricCriteria.map((c) => `${c.name}: ${c.description.slice(0, 80)}`),
      commonMistakes: ["Not addressing every criterion", "Skipping the rubric review before submission"],
      isMock: true,
    };
  }
}

// ===================== Study Plan Generator =====================

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

export async function generateStudyPlan(
  req: StudyPlanRequest
): Promise<StudyPlanResponse> {
  const genAI = getGenAI();

  if (!genAI) {
    const mockSteps: StudyPlanStep[] = [
      { title: "Read the assignment prompt", description: "Carefully read through the full assignment requirements, rubric, and any provided materials.", estimatedMinutes: 15 },
      { title: "Research and gather sources", description: "Find relevant sources, take notes, and organize your research by rubric criterion.", estimatedMinutes: 60 },
      { title: "Create an outline", description: "Structure your response to address each rubric criterion in order of point value.", estimatedMinutes: 20 },
      { title: "Draft your response", description: "Write a complete first draft following your outline.", estimatedMinutes: 90 },
      { title: "Self-review with rubric", description: "Check each criterion against your draft and add missing elements.", estimatedMinutes: 20 },
      { title: "Revise and polish", description: "Fix grammar, clarity, and formatting. Read aloud to catch awkward phrasing.", estimatedMinutes: 30 },
      { title: "Final submission", description: "Submit on time and confirm the submission was received.", estimatedMinutes: 5 },
    ];
    return { steps: mockSteps, totalEstimatedHours: Math.round(mockSteps.reduce((s, x) => s + x.estimatedMinutes, 0) / 60 * 10) / 10, isMock: true };
  }

  try {
    const rubricBlock = req.rubricCriteria
      .map((c) => `- ${c.name} (${c.points} pts)`)
      .join("\n");
    const dueInfo = req.dueAt
      ? `Due: ${new Date(req.dueAt).toLocaleDateString()}`
      : "No due date provided";

    const prompt = `You are an academic coach. Generate a structured, step-by-step study plan for a student working on this assignment.

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

Generate 6-9 concrete, actionable steps. Time estimates should be realistic for a college student.`;

    const text = await generateWithFallback(genAI, prompt);
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON in response");

    const parsed = JSON.parse(jsonMatch[0]) as StudyPlanResponse;
    parsed.isMock = false;
    return parsed;
  } catch {
    const fallbackSteps: StudyPlanStep[] = [
      { title: "Read the assignment", description: "Understand the full requirements and rubric.", estimatedMinutes: 15 },
      { title: "Plan your approach", description: "Outline how you will address each criterion.", estimatedMinutes: 20 },
      { title: "Write the draft", description: "Complete a full first draft.", estimatedMinutes: 90 },
      { title: "Review and submit", description: "Check against the rubric and submit.", estimatedMinutes: 25 },
    ];
    return { steps: fallbackSteps, totalEstimatedHours: 2.5, isMock: true };
  }
}

// ===================== Mock Fallbacks =====================

function getMockFlashcards(req: GenerateFlashcardsRequest): FlashcardItem[] {
  const topics = req.title.split(/\s+/).filter((w) => w.length > 3);
  const mainTopic = topics.slice(0, 3).join(" ") || "this topic";

  return [
    {
      front: `What is the primary focus of ${mainTopic}?`,
      back: `${mainTopic} focuses on understanding the fundamental concepts and their applications in the field.`,
      hint: "Think about the core definition",
      difficulty: "easy",
    },
    {
      front: `Name three key components of ${mainTopic}.`,
      back: "1. Theoretical foundations\n2. Practical applications\n3. Critical analysis methods",
      hint: "Consider the main building blocks",
      difficulty: "medium",
    },
    {
      front: `How does ${mainTopic} differ from related fields?`,
      back: `It differs primarily in its approach to methodology and its emphasis on empirical evidence versus theoretical reasoning.`,
      hint: "Compare approaches and methods",
      difficulty: "hard",
    },
    {
      front: `What are the key terms associated with ${mainTopic}?`,
      back: "Key terms include: hypothesis, methodology, analysis, synthesis, evaluation, and application.",
      hint: "Think about academic vocabulary",
      difficulty: "easy",
    },
    {
      front: `Describe the historical development of ${mainTopic}.`,
      back: "It evolved from early theoretical work through several paradigm shifts to its current interdisciplinary form.",
      hint: "Consider the timeline",
      difficulty: "medium",
    },
    {
      front: `What is the significance of evidence-based reasoning in ${mainTopic}?`,
      back: "Evidence-based reasoning ensures conclusions are grounded in observable data rather than assumptions.",
      hint: "Why does evidence matter?",
      difficulty: "medium",
    },
    {
      front: `Give an example of how ${mainTopic} applies in practice.`,
      back: "In practice, it can be applied using systematic analysis and structured decision-making frameworks.",
      hint: "Think about real-world scenarios",
      difficulty: "hard",
    },
    {
      front: `What are common misconceptions about ${mainTopic}?`,
      back: "Common misconceptions include oversimplifying complex relationships and confusing correlation with causation.",
      hint: "What do people often get wrong?",
      difficulty: "medium",
    },
  ];
}

function getMockRubricCheck(req: RubricCheckRequest): RubricCheckResponse {
  return {
    summary: `Analysis of "${req.assignmentTitle}": review each rubric criterion below for targeted guidance on what the assignment expects and how to earn full marks.`,
    criteria: req.rubricCriteria.map((c, i) => ({
      name: c.name,
      status: (["strong", "gaps", "missing"] as const)[i % 3],
      evidence:
        i % 3 === 0
          ? `This criterion (${c.name}) expects a clear demonstration of understanding. Based on the rubric description, focus on: ${c.description.slice(0, 100)}`
          : i % 3 === 1
            ? `Some gaps may exist here. The rubric specifically looks for: ${c.description.slice(0, 100)}`
            : `This area needs attention. Review what ${c.name} requires: ${c.description.slice(0, 100)}`,
      suggestions: [
        `Carefully review the ${c.name} criterion and ensure your work addresses: ${c.description.slice(0, 80)}`,
        `Allocate time proportional to its weight (${c.points} pts) in your preparation`,
      ],
    })),
    nextSteps: [
      "Read each rubric criterion carefully and note what specific evidence is expected",
      "Outline your approach before starting to ensure all criteria are covered",
      "Review your work against the rubric point-by-point before submitting",
    ],
    sourcesUsed: ["Assignment rubric"],
    isMock: true,
  };
}
