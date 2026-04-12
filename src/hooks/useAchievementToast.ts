// ── Achievement Toast Hook ────────────────────────────────────────────────────
// Calls SKILL_GAMIFICATION to generate an AI hype message when a milestone
// is reached, then surfaces it as a Sonner toast notification.
// Falls back to a deterministic message when the LLM is offline or slow.

import { useState, useCallback } from "react";
import { toast } from "sonner";
import { SKILL_GAMIFICATION } from "@/ai/skills";
import { callSkill, parseSkillJson, isSkillAiConfigured } from "@/ai/router";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AchievementMilestone {
  /** Category of the achievement, e.g. "streak", "deck_complete", "badge". */
  type: "streak" | "deck_complete" | "badge" | "level_up" | string;
  /** The specific value, e.g. streak count or badge name. */
  value: number | string;
}

interface GamificationMessage {
  message: string;
  badge_label: string;
}

export interface AchievementToastState {
  /** Trigger an achievement toast — calls AI and shows via Sonner. */
  triggerAchievement: (milestone: AchievementMilestone) => Promise<GamificationMessage>;
  /** The most recently generated message (null until first trigger). */
  lastMessage: GamificationMessage | null;
  /** Whether an AI call is in flight. */
  isGenerating: boolean;
}

// ── Deterministic fallbacks ───────────────────────────────────────────────────

const FALLBACK_MESSAGES: Record<string, (value: number | string) => GamificationMessage> = {
  streak: (v) => ({
    message: `${v} days straight — that kind of consistency is exactly what separates people who talk about it from people who do it. The streak lives on.`,
    badge_label: `${v}-Day Streak`,
  }),
  deck_complete: (v) => ({
    message: `You just finished the entire "${v}" deck — every card flipped, every concept faced head-on. That's what preparation actually looks like.`,
    badge_label: "Deck Master",
  }),
  badge: (v) => ({
    message: `"${v}" badge unlocked — you earned this one through real work, not luck. Add it to the collection.`,
    badge_label: String(v),
  }),
  level_up: (v) => ({
    message: `Level ${v} — the XP is just proof of the hours you've already put in. Now let's see what level ${v} can do.`,
    badge_label: `Level ${v}`,
  }),
};

function getFallback(milestone: AchievementMilestone): GamificationMessage {
  const factory = FALLBACK_MESSAGES[milestone.type];
  if (factory) return factory(milestone.value);
  return {
    message: `Milestone hit: ${milestone.type} — ${milestone.value}. That's real, measurable progress right there.`,
    badge_label: String(milestone.value),
  };
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useAchievementToast(): AchievementToastState {
  const [lastMessage, setLastMessage] = useState<GamificationMessage | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const triggerAchievement = useCallback(
    async (milestone: AchievementMilestone): Promise<GamificationMessage> => {
      const fallback = getFallback(milestone);

      if (!isSkillAiConfigured) {
        setLastMessage(fallback);
        toast(fallback.message, {
          description: `Achievement: ${fallback.badge_label}`,
          duration: 5000,
        });
        return fallback;
      }

      setIsGenerating(true);

      // Show an optimistic toast immediately with the fallback text
      // so the user gets instant feedback while the AI call is in flight
      const toastId = toast.loading("Generating your achievement message…", { duration: 8000 });

      try {
        const userContent = JSON.stringify({
          milestone_type: milestone.type,
          milestone_value: milestone.value,
        });

        const raw = await callSkill(SKILL_GAMIFICATION, userContent, {
          maxTokens: 150,
          temperature: 0.85,
        });
        const parsed = parseSkillJson<GamificationMessage>(raw);

        toast.dismiss(toastId);
        toast.success(parsed.message, {
          description: `Achievement: ${parsed.badge_label}`,
          duration: 5500,
        });

        setLastMessage(parsed);
        return parsed;
      } catch {
        toast.dismiss(toastId);
        toast(fallback.message, {
          description: `Achievement: ${fallback.badge_label}`,
          duration: 5000,
        });
        setLastMessage(fallback);
        return fallback;
      } finally {
        setIsGenerating(false);
      }
    },
    []
  );

  return { triggerAchievement, lastMessage, isGenerating };
}
