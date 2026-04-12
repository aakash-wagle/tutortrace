import {
  computeLevel,
  xpToNextLevel,
  xpProgressPercent,
  computeStreakUpdate,
  checkStreakBadges,
  isSameDay,
  isYesterday,
  BADGE_DEFS,
  XP_RULES,
  XP_PER_LEVEL,
} from "@/lib/gamification";

// ── computeLevel ─────────────────────────────────────────────────────────────

describe("computeLevel", () => {
  it("starts at level 1 with 0 XP", () => {
    expect(computeLevel(0)).toBe(1);
  });

  it("stays level 1 at 499 XP", () => {
    expect(computeLevel(499)).toBe(1);
  });

  it("reaches level 2 at exactly 500 XP", () => {
    expect(computeLevel(500)).toBe(2);
  });

  it("reaches level 3 at exactly 1000 XP", () => {
    expect(computeLevel(1000)).toBe(3);
  });

  it("correctly computes high levels", () => {
    expect(computeLevel(5000)).toBe(11);
  });
});

// ── xpToNextLevel ─────────────────────────────────────────────────────────────

describe("xpToNextLevel", () => {
  it("returns XP_PER_LEVEL when at 0 XP", () => {
    expect(xpToNextLevel(0)).toBe(XP_PER_LEVEL);
  });

  it("returns 1 when one XP short of next level", () => {
    expect(xpToNextLevel(499)).toBe(1);
  });

  it("returns XP_PER_LEVEL immediately after leveling up", () => {
    expect(xpToNextLevel(500)).toBe(XP_PER_LEVEL);
  });
});

// ── xpProgressPercent ─────────────────────────────────────────────────────────

describe("xpProgressPercent", () => {
  it("returns 0 at 0 XP", () => {
    expect(xpProgressPercent(0)).toBe(0);
  });

  it("returns 50 at 250 XP (halfway to first level)", () => {
    expect(xpProgressPercent(250)).toBe(50);
  });

  it("returns 0 again immediately after leveling up", () => {
    expect(xpProgressPercent(500)).toBe(0);
  });

  it("returns 100 just before the next level", () => {
    // 499/500 * 100 = 99.8
    expect(xpProgressPercent(499)).toBeCloseTo(99.8, 1);
  });
});

// ── isSameDay ────────────────────────────────────────────────────────────────

describe("isSameDay", () => {
  it("returns true for same day different times", () => {
    const a = new Date("2024-01-15T09:00:00");
    const b = new Date("2024-01-15T22:00:00");
    expect(isSameDay(a, b)).toBe(true);
  });

  it("returns false for different days", () => {
    const a = new Date("2024-01-15");
    const b = new Date("2024-01-16");
    expect(isSameDay(a, b)).toBe(false);
  });
});

// ── isYesterday ───────────────────────────────────────────────────────────────

describe("isYesterday", () => {
  it("returns true when date is the day before reference", () => {
    const reference = new Date("2024-01-15");
    const yesterday = new Date("2024-01-14");
    expect(isYesterday(yesterday, reference)).toBe(true);
  });

  it("returns false for same day", () => {
    const reference = new Date("2024-01-15");
    expect(isYesterday(reference, reference)).toBe(false);
  });

  it("returns false for two days ago", () => {
    const reference = new Date("2024-01-15");
    const twoDaysAgo = new Date("2024-01-13");
    expect(isYesterday(twoDaysAgo, reference)).toBe(false);
  });
});

// ── computeStreakUpdate ───────────────────────────────────────────────────────

describe("computeStreakUpdate", () => {
  // Use noon to avoid UTC vs local midnight timezone issues
  const today = new Date("2024-03-15T12:00:00");

  it("starts streak at 1 for first activity (null lastDate)", () => {
    const { newStreak, streakBroken } = computeStreakUpdate(0, null, today);
    expect(newStreak).toBe(1);
    expect(streakBroken).toBe(false);
  });

  it("does not increment streak if already logged today", () => {
    const { newStreak, streakBroken } = computeStreakUpdate(5, "2024-03-15", today);
    expect(newStreak).toBe(5);
    expect(streakBroken).toBe(false);
  });

  it("increments streak for consecutive days", () => {
    const { newStreak, streakBroken } = computeStreakUpdate(5, "2024-03-14", today);
    expect(newStreak).toBe(6);
    expect(streakBroken).toBe(false);
  });

  it("resets streak to 1 after a gap", () => {
    const { newStreak, streakBroken } = computeStreakUpdate(14, "2024-03-13", today);
    expect(newStreak).toBe(1);
    expect(streakBroken).toBe(true);
  });

  it("resets streak after a long gap", () => {
    const { newStreak, streakBroken } = computeStreakUpdate(30, "2024-01-01", today);
    expect(newStreak).toBe(1);
    expect(streakBroken).toBe(true);
  });
});

// ── checkStreakBadges ─────────────────────────────────────────────────────────

describe("checkStreakBadges", () => {
  it("returns empty array for streak of 1", () => {
    expect(checkStreakBadges(1)).toHaveLength(0);
  });

  it("awards streak_3 at 3 days", () => {
    expect(checkStreakBadges(3)).toContain("streak_3");
  });

  it("awards streak_3 and streak_7 at 7 days", () => {
    const badges = checkStreakBadges(7);
    expect(badges).toContain("streak_3");
    expect(badges).toContain("streak_7");
  });

  it("awards all streak badges at 30 days", () => {
    const badges = checkStreakBadges(30);
    expect(badges).toContain("streak_3");
    expect(badges).toContain("streak_7");
    expect(badges).toContain("streak_14");
    expect(badges).toContain("streak_30");
  });
});

// ── BADGE_DEFS ────────────────────────────────────────────────────────────────

describe("BADGE_DEFS", () => {
  it("has exactly 15 badge definitions", () => {
    expect(BADGE_DEFS).toHaveLength(15);
  });

  it("all badges have required fields", () => {
    BADGE_DEFS.forEach((b) => {
      expect(b.id).toBeTruthy();
      expect(b.name).toBeTruthy();
      expect(b.description).toBeTruthy();
      expect(b.icon).toBeTruthy();
      expect(typeof b.xpReward).toBe("number");
      expect(b.xpReward).toBeGreaterThanOrEqual(0);
      expect(typeof b.coinReward).toBe("number");
      expect(b.coinReward).toBeGreaterThanOrEqual(0);
    });
  });

  it("has unique badge IDs", () => {
    const ids = BADGE_DEFS.map((b) => b.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });
});

// ── XP_RULES ─────────────────────────────────────────────────────────────────

describe("XP_RULES", () => {
  it("all XP values are positive integers", () => {
    Object.values(XP_RULES).forEach((v) => {
      expect(v).toBeGreaterThan(0);
      expect(Number.isInteger(v)).toBe(true);
    });
  });

  it("streak milestone XP is greater than daily streak XP", () => {
    expect(XP_RULES.STREAK_MILESTONE_7).toBeGreaterThan(XP_RULES.STREAK_DAILY);
    expect(XP_RULES.STREAK_MILESTONE_30).toBeGreaterThan(XP_RULES.STREAK_MILESTONE_7);
  });
});
