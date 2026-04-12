// ── Hybrid AI "Morning Briefing" Pipeline ────────────────────────────────────
// Routes to Groq (online) or local transformers.js / template (offline).
// System prompt sourced from the centralized skill registry (SKILL_MORNING_ANCHOR).

import { useState, useEffect, useCallback } from "react";
import type { TimeBlock } from "@/lib/scheduleEngine";
import { SKILL_MORNING_ANCHOR } from "@/ai/skills";

// ── Types ────────────────────────────────────────────────────────────────────

export interface BriefingState {
  briefing: string | null;
  isLoading: boolean;
  error: string | null;
  provider: "groq" | "local" | null;
  retry: () => void;
}

// ── Env ──────────────────────────────────────────────────────────────────────

const env = (import.meta as unknown as { env: Record<string, string> }).env;
const LLM_BASE = env?.VITE_LLM_BASE_URL?.trim();
const LLM_KEY = env?.VITE_LLM_API_KEY ?? "";
const LLM_MODEL = env?.VITE_LLM_MODEL?.trim() ?? "";

// ── Online: Groq via LiteLLM proxy ──────────────────────────────────────────

function resolveLlmBaseUrl(base: string): string {
  const b = base.trim();
  if (!b) return b;
  if (b.startsWith("/")) return b;
  if (/^https?:\/\//i.test(b)) return b;
  if (/^[\w.-]+:\d+/i.test(b)) return `http://${b}`;
  return b;
}

async function callGroq(todaySchedule: TimeBlock[], displayName?: string): Promise<string> {
  if (!LLM_BASE || !LLM_MODEL) {
    throw new Error("LLM not configured");
  }

  const baseResolved = resolveLlmBaseUrl(LLM_BASE);
  const url = `${baseResolved.replace(/\/$/, "")}/chat/completions`;

  const userContent = JSON.stringify({
    studentName: displayName?.split(" ")[0] || "friend",
    schedule: todaySchedule,
  });

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(LLM_KEY ? { Authorization: `Bearer ${LLM_KEY}` } : {}),
    },
    body: JSON.stringify({
      model: LLM_MODEL,
      messages: [
        { role: "system", content: SKILL_MORNING_ANCHOR },
        { role: "user", content: userContent },
      ],
      temperature: 0.7,
      max_tokens: 300,
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`LLM error: ${res.status} ${detail.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    choices: { message: { content: string } }[];
  };
  return data.choices[0].message.content;
}

// ── Offline: Local transformers.js fallback ──────────────────────────────────

let localPipeline: unknown = null;
let pipelineLoading = false;

async function callLocalModel(todaySchedule: TimeBlock[], displayName?: string): Promise<string> {
  try {
    if (!localPipeline && !pipelineLoading) {
      pipelineLoading = true;
      const { pipeline } = await import(
        /* @vite-ignore */ "@huggingface/transformers"
      );
      localPipeline = await pipeline("text-generation", "Xenova/LaMini-Flan-T5-248M", {
        device: "auto" as never,
      });
      pipelineLoading = false;
    }

    if (!localPipeline) {
      throw new Error("Local model is still loading...");
    }

    const firstName = displayName?.split(" ")[0] || "friend";
    const prompt = `${SKILL_MORNING_ANCHOR}\n\nStudent name: ${firstName}\nSchedule: ${JSON.stringify(todaySchedule)}`;
    const result = await (localPipeline as CallableFunction)(prompt, {
      max_new_tokens: 200,
      temperature: 0.7,
    });

    if (Array.isArray(result) && result[0]?.generated_text) {
      return result[0].generated_text as string;
    }

    return String(result);
  } catch {
    return generateTemplateBriefing(todaySchedule, displayName);
  }
}

/** Deterministic fallback when no AI provider is available. */
function generateTemplateBriefing(blocks: TimeBlock[], displayName?: string): string {
  const firstName = displayName?.split(" ")[0] || null;
  const greeting = firstName ? `Good morning, ${firstName}!` : "Good morning!";

  if (blocks.length === 0) {
    return `${greeting} You have a free afternoon today — no study sessions scheduled. This is a great time to review past material, organize your notes, or simply take a well-deserved break. You've got this!`;
  }

  const taskList = blocks
    .map((b) => b.assignmentName)
    .filter((v, i, a) => a.indexOf(v) === i);

  const criticalCount = blocks.filter((b) => b.priority === "critical").length;
  const totalMinutes = blocks.reduce((s, b) => s + b.durationMinutes, 0);
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  const timeStr = hours > 0 ? `${hours}h ${mins}m` : `${mins} minutes`;

  let text = `${greeting} `;
  if (criticalCount > 0) {
    text += `You have ${criticalCount} high-priority ${criticalCount === 1 ? "task" : "tasks"} today — let's tackle ${criticalCount === 1 ? "it" : "them"} first! `;
  } else {
    text += "Today's looking productive and manageable. ";
  }

  text += `You have ${blocks.length} study ${blocks.length === 1 ? "session" : "sessions"} lined up (about ${timeStr} total), covering: ${taskList.join(", ")}. `;
  text += "Consistent progress beats perfection — take breaks between sessions, stay hydrated, and you'll crush it today!";

  return text;
}

// ── Main Hook ────────────────────────────────────────────────────────────────

export function useMorningBriefing(
  todayBlocks: TimeBlock[],
  displayName?: string
): BriefingState {
  const [briefing, setBriefing] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [provider, setProvider] = useState<"groq" | "local" | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const fetchBriefing = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const isOnline = navigator.onLine;

      if (isOnline && LLM_BASE && LLM_MODEL) {
        try {
          const result = await callGroq(todayBlocks, displayName);
          setBriefing(result);
          setProvider("groq");
          setIsLoading(false);
          return;
        } catch (onlineErr) {
          console.warn("Online LLM failed, falling back to local:", onlineErr);
        }
      }

      setProvider("local");
      const result = await callLocalModel(todayBlocks, displayName);
      setBriefing(result);
    } catch (err) {
      console.error("Morning briefing failed:", err);
      setError(
        err instanceof Error ? err.message : "Failed to generate briefing"
      );
      setBriefing(generateTemplateBriefing(todayBlocks, displayName));
      setProvider("local");
    } finally {
      setIsLoading(false);
    }
  }, [todayBlocks, displayName, retryCount]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (todayBlocks !== undefined) {
      fetchBriefing();
    }
  }, [fetchBriefing, todayBlocks]);

  const retry = useCallback(() => {
    setRetryCount((c) => c + 1);
  }, []);

  return { briefing, isLoading, error, provider, retry };
}
