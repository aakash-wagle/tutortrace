// Pure gamification engine — no I/O, fully testable

// ── XP Rules ────────────────────────────────────────────────────────────────

export const XP_RULES = {
  LOGIN: 10,
  FLASHCARD_REVIEW: 5,
  DECK_COMPLETE: 25,
  COACH_OPEN: 10,
  RUBRIC_CHECK: 20,
  STREAK_DAILY: 15,
  STREAK_MILESTONE_7: 50,
  STREAK_MILESTONE_30: 200,
} as const;

export type XPSource = keyof typeof XP_RULES;

export const XP_PER_LEVEL = 500;

export function computeLevel(xp: number): number {
  return Math.floor(xp / XP_PER_LEVEL) + 1;
}

export function xpToNextLevel(xp: number): number {
  return XP_PER_LEVEL - (xp % XP_PER_LEVEL);
}

export function xpProgressPercent(xp: number): number {
  return ((xp % XP_PER_LEVEL) / XP_PER_LEVEL) * 100;
}

// ── Badge definitions ────────────────────────────────────────────────────────

export type BadgeId =
  | "first_login"
  | "streak_3"
  | "streak_7"
  | "streak_14"
  | "streak_30"
  | "first_flashcard_deck"
  | "flashcard_master"
  | "first_coach_use"
  | "rubric_runner"
  | "night_owl"
  | "early_bird"
  | "bloom_knowledge"
  | "bloom_synthesis"
  | "course_explorer"
  | "coin_saver";

export interface BadgeDef {
  id: BadgeId;
  name: string;
  description: string;
  icon: string; // emoji
  xpReward: number;
  coinReward: number;
}

export const BADGE_DEFS: BadgeDef[] = [
  {
    id: "first_login",
    name: "First Steps",
    description: "Logged in for the first time",
    icon: "🎉",
    xpReward: 50,
    coinReward: 20,
  },
  {
    id: "streak_3",
    name: "3-Day Streak",
    description: "Maintained a 3-day study streak",
    icon: "🔥",
    xpReward: 30,
    coinReward: 15,
  },
  {
    id: "streak_7",
    name: "Week Warrior",
    description: "Maintained a 7-day study streak",
    icon: "⚡",
    xpReward: 75,
    coinReward: 40,
  },
  {
    id: "streak_14",
    name: "Fortnight Grind",
    description: "14 days of consistent studying",
    icon: "💪",
    xpReward: 150,
    coinReward: 75,
  },
  {
    id: "streak_30",
    name: "Monthly Legend",
    description: "30-day unbroken study streak",
    icon: "👑",
    xpReward: 500,
    coinReward: 200,
  },
  {
    id: "first_flashcard_deck",
    name: "Deck Builder",
    description: "Created your first flashcard deck",
    icon: "📚",
    xpReward: 40,
    coinReward: 20,
  },
  {
    id: "flashcard_master",
    name: "Flashcard Master",
    description: "Reviewed 100 flashcards",
    icon: "🃏",
    xpReward: 100,
    coinReward: 50,
  },
  {
    id: "first_coach_use",
    name: "Coach Student",
    description: "Opened Assignment Coach for the first time",
    icon: "🎓",
    xpReward: 30,
    coinReward: 15,
  },
  {
    id: "rubric_runner",
    name: "Rubric Pro",
    description: "Ran 5 rubric checks",
    icon: "✅",
    xpReward: 60,
    coinReward: 30,
  },
  {
    id: "night_owl",
    name: "Night Owl",
    description: "Studied after 10pm",
    icon: "🦉",
    xpReward: 25,
    coinReward: 10,
  },
  {
    id: "early_bird",
    name: "Early Bird",
    description: "Studied before 7am",
    icon: "🌅",
    xpReward: 25,
    coinReward: 10,
  },
  {
    id: "bloom_knowledge",
    name: "Knowledge Seeker",
    description: "Reached 40 Knowledge points",
    icon: "💡",
    xpReward: 40,
    coinReward: 20,
  },
  {
    id: "bloom_synthesis",
    name: "Synthesizer",
    description: "Reached 20 Synthesis points",
    icon: "🧩",
    xpReward: 80,
    coinReward: 40,
  },
  {
    id: "course_explorer",
    name: "Course Explorer",
    description: "Viewed 5 or more courses",
    icon: "🗺️",
    xpReward: 35,
    coinReward: 15,
  },
  {
    id: "coin_saver",
    name: "Coin Collector",
    description: "Earned 500 coins total",
    icon: "🪙",
    xpReward: 50,
    coinReward: 0,
  },
];

// ── Streak logic ─────────────────────────────────────────────────────────────

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function isYesterday(date: Date, reference: Date): boolean {
  const yesterday = new Date(reference);
  yesterday.setDate(yesterday.getDate() - 1);
  return isSameDay(date, yesterday);
}

export function computeStreakUpdate(
  current: number,
  lastActivityDate: string | null,
  today: Date = new Date()
): { newStreak: number; streakBroken: boolean } {
  if (!lastActivityDate) return { newStreak: 1, streakBroken: false };
  // Parse as noon local time to avoid UTC midnight TZ issues
  const last = new Date(lastActivityDate + "T12:00:00");
  if (isSameDay(last, today)) return { newStreak: current, streakBroken: false };
  if (isYesterday(last, today)) return { newStreak: current + 1, streakBroken: false };
  return { newStreak: 1, streakBroken: true };
}

export function checkStreakBadges(streak: number): BadgeId[] {
  const badges: BadgeId[] = [];
  if (streak >= 3) badges.push("streak_3");
  if (streak >= 7) badges.push("streak_7");
  if (streak >= 14) badges.push("streak_14");
  if (streak >= 30) badges.push("streak_30");
  return badges;
}

export function todayString(): string {
  return new Date().toISOString().slice(0, 10);
}

// ── Bloom taxonomy weights ────────────────────────────────────────────────────

export const BLOOM_WEIGHTS: Record<string, number> = {
  knowledge: 1,
  comprehension: 1,
  application: 1.5,
  analysis: 2,
  synthesis: 3,
  evaluation: 3,
};

// ── Time-of-day badge checks ──────────────────────────────────────────────────

export function getNightOwlBadge(): BadgeId | null {
  const h = new Date().getHours();
  return h >= 22 ? "night_owl" : null;
}

export function getEarlyBirdBadge(): BadgeId | null {
  const h = new Date().getHours();
  return h < 7 ? "early_bird" : null;
}
