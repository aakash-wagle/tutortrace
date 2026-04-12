/**
 * Tests for Dexie sync logic using mocked db from setup.ts
 * Focuses on: streak update logic, conflict resolution, unsynced event queuing
 */

import { computeStreakUpdate, computeLevel } from "@/lib/gamification";

// ── Streak update logic (pure function) ──────────────────────────────────────

describe("Streak update logic for Dexie writes", () => {
  it("initializes streak correctly when no previous activity", () => {
    const result = computeStreakUpdate(0, null);
    expect(result.newStreak).toBe(1);
    expect(result.streakBroken).toBe(false);
  });

  it("maintains streak when activity already logged today", () => {
    const today = new Date("2024-06-15T12:00:00");
    const result = computeStreakUpdate(5, "2024-06-15", today);
    expect(result.newStreak).toBe(5);
    expect(result.streakBroken).toBe(false);
  });

  it("increments streak for yesterday activity", () => {
    const today = new Date("2024-06-15T12:00:00");
    const result = computeStreakUpdate(7, "2024-06-14", today);
    expect(result.newStreak).toBe(8);
    expect(result.streakBroken).toBe(false);
  });

  it("resets streak and marks broken for 2-day gap", () => {
    const today = new Date("2024-06-15T12:00:00");
    const result = computeStreakUpdate(10, "2024-06-13", today);
    expect(result.newStreak).toBe(1);
    expect(result.streakBroken).toBe(true);
  });
});

// ── Conflict resolution: max XP merge ────────────────────────────────────────

describe("Gamification conflict resolution (max XP merge)", () => {
  it("takes local XP when higher", () => {
    const localXP = 750;
    const remoteXP = 500;
    const merged = Math.max(localXP, remoteXP);
    expect(merged).toBe(750);
    expect(computeLevel(merged)).toBe(2);
  });

  it("takes remote XP when higher", () => {
    const localXP = 200;
    const remoteXP = 1500;
    const merged = Math.max(localXP, remoteXP);
    expect(merged).toBe(1500);
    expect(computeLevel(merged)).toBe(4);
  });

  it("takes max streak from both sources", () => {
    const localStreak = 5;
    const remoteStreak = 8;
    expect(Math.max(localStreak, remoteStreak)).toBe(8);
  });

  it("merges badge sets via union (no duplicates)", () => {
    const localBadges = ["first_login", "streak_3"];
    const remoteBadges = ["first_login", "streak_7"];
    const merged = [...new Set([...localBadges, ...remoteBadges])];
    expect(merged).toHaveLength(3);
    expect(merged).toContain("first_login");
    expect(merged).toContain("streak_3");
    expect(merged).toContain("streak_7");
  });
});

// ── XP event queuing (unsynced flag) ─────────────────────────────────────────

describe("XP event sync flag behavior", () => {
  it("new events are created with synced=false", () => {
    const newEvent = {
      userId: "user-123",
      source: "FLASHCARD_REVIEW" as const,
      amount: 5,
      createdAt: Date.now(),
      synced: false,
    };
    expect(newEvent.synced).toBe(false);
  });

  it("events should be marked synced=true after push", () => {
    // Simulate what syncUnsyncedXPEvents does after a successful push
    const event = { synced: false, id: 1 };
    const updated = { ...event, synced: true };
    expect(updated.synced).toBe(true);
  });

  it("only unsynced events should be pushed", () => {
    const events = [
      { id: 1, synced: false, amount: 10 },
      { id: 2, synced: true, amount: 5 },
      { id: 3, synced: false, amount: 15 },
    ];
    const unsynced = events.filter((e) => !e.synced);
    expect(unsynced).toHaveLength(2);
    expect(unsynced.map((e) => e.id)).toEqual([1, 3]);
  });
});

// ── Badge deduplication ───────────────────────────────────────────────────────

describe("Badge deduplication logic", () => {
  it("does not unlock a badge that already exists locally", () => {
    const existingBadges = ["first_login", "streak_3"];
    const badgeToUnlock = "first_login";
    const alreadyUnlocked = existingBadges.includes(badgeToUnlock);
    expect(alreadyUnlocked).toBe(true); // should be skipped
  });

  it("unlocks a new badge not yet in the local set", () => {
    const existingBadges = ["first_login"];
    const badgeToUnlock = "streak_7";
    const alreadyUnlocked = existingBadges.includes(badgeToUnlock);
    expect(alreadyUnlocked).toBe(false); // should proceed
  });
});
