// ── TutorTrace Skill AI Router ────────────────────────────────────────────────
// Centralized hybrid AI dispatcher for all skill-based LLM calls.
// Online path: Groq via LiteLLM proxy (VITE_LLM_BASE_URL + VITE_LLM_MODEL).
// All skill callers use this module for consistent parsing and error handling.

const env = (import.meta as unknown as { env: Record<string, string> }).env;
const LLM_BASE = env?.VITE_LLM_BASE_URL?.trim();
const LLM_KEY = env?.VITE_LLM_API_KEY ?? "";
const LLM_MODEL = env?.VITE_LLM_MODEL?.trim() ?? "";

/** True when the LLM gateway is configured and skill calls can be made. */
export const isSkillAiConfigured = !!(LLM_BASE && LLM_MODEL);

/** Resolve base URL — mirrors logic in aiService.ts for consistency. */
function resolveBase(base: string): string {
  const b = base.trim();
  if (!b) return b;
  if (b.startsWith("/")) return b;
  if (/^https?:\/\//i.test(b)) return b;
  if (/^[\w.-]+:\d+/i.test(b)) return `http://${b}`;
  return b;
}

// ── Parsing utilities ─────────────────────────────────────────────────────────

/**
 * Strip <think>…</think> blocks from LLM output.
 * Handles multiline content, optional whitespace, and nested/malformed tags.
 */
export function stripThinkTags(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
}

/**
 * Robustly extract and parse a JSON object or array from raw LLM output.
 * Handles: bare JSON, markdown ```json fences, and leading/trailing prose.
 * Throws a descriptive error if no valid JSON can be found.
 */
export function parseSkillJson<T>(raw: string): T {
  // 1. Strip think blocks first so prose doesn't confuse the JSON search
  const cleaned = stripThinkTags(raw);

  // 2. Try to extract from a markdown code fence  ```json … ``` or ``` … ```
  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch) {
    try {
      return JSON.parse(fenceMatch[1].trim()) as T;
    } catch {
      // fall through to next strategy
    }
  }

  // 3. Grab the first {...} or [...] block (greedy innermost won't work; use outermost)
  const objMatch = cleaned.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
  if (objMatch) {
    try {
      return JSON.parse(objMatch[1]) as T;
    } catch {
      // fall through
    }
  }

  // 4. Last resort: attempt to parse the whole cleaned string
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    throw new Error(
      `Skill router: could not extract valid JSON from LLM output.\n\nPreview: ${cleaned.slice(0, 400)}`
    );
  }
}

// ── Core skill invocation ─────────────────────────────────────────────────────

export interface SkillCallOptions {
  /** Max output tokens. Default: 1024. */
  maxTokens?: number;
  /** Sampling temperature. Default: 0.7. */
  temperature?: number;
}

/**
 * Send a skill system prompt + user content to the configured LLM gateway.
 * Returns the raw text response.
 *
 * Apply `stripThinkTags(result)` for prose outputs.
 * Apply `parseSkillJson<T>(result)` for JSON schema outputs.
 *
 * @throws if LLM is not configured or the gateway returns a non-2xx status.
 */
export async function callSkill(
  systemPrompt: string,
  userContent: string,
  opts?: SkillCallOptions
): Promise<string> {
  if (!LLM_BASE || !LLM_MODEL) {
    throw new Error(
      "Skill router: LLM not configured. Set VITE_LLM_BASE_URL and VITE_LLM_MODEL in .env.local."
    );
  }

  const url = `${resolveBase(LLM_BASE).replace(/\/$/, "")}/chat/completions`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(LLM_KEY ? { Authorization: `Bearer ${LLM_KEY}` } : {}),
    },
    body: JSON.stringify({
      model: LLM_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
      temperature: opts?.temperature ?? 0.7,
      max_tokens: opts?.maxTokens ?? 1024,
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(
      `Skill router: LLM gateway returned ${res.status} — ${detail.slice(0, 300)}`
    );
  }

  const data = (await res.json()) as {
    choices: { message: { content: string } }[];
  };
  return data.choices[0]?.message?.content ?? "";
}
