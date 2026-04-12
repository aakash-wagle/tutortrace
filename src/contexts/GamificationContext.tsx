"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  ReactNode,
} from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import {
  computeLevel,
  xpProgressPercent,
  xpToNextLevel,
  XP_RULES,
  XPSource,
  BadgeId,
  BADGE_DEFS,
  BadgeDef,
  computeStreakUpdate,
  checkStreakBadges,
  todayString,
  getNightOwlBadge,
  getEarlyBirdBadge,
} from "@/lib/gamification";

// ── Types ────────────────────────────────────────────────────────────────────

export interface GamificationState {
  xp: number;
  level: number;
  xpProgress: number; // 0–100 for progress bar
  xpToNext: number;
  coins: number;
  streak: number;
  longestStreak: number;
  unlockedBadges: BadgeId[];
  badgeDefs: BadgeDef[];
  isLoaded: boolean;
  userId: string | null;
  addXP: (source: XPSource, metadata?: object) => Promise<void>;
  addCoins: (amount: number) => Promise<void>;
  logActivity: (type: string, bloomLevel?: string) => Promise<void>;
  unlockBadge: (id: BadgeId) => Promise<void>;
}

const defaultState: GamificationState = {
  xp: 0,
  level: 1,
  xpProgress: 0,
  xpToNext: XP_RULES.LOGIN,
  coins: 0,
  streak: 0,
  longestStreak: 0,
  unlockedBadges: [],
  badgeDefs: BADGE_DEFS,
  isLoaded: false,
  userId: null,
  addXP: async () => {},
  addCoins: async () => {},
  logActivity: async () => {},
  unlockBadge: async () => {},
};

const GamificationContext = createContext<GamificationState>(defaultState);

// ── Provider ─────────────────────────────────────────────────────────────────

export function GamificationProvider({ children }: { children: ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null);

  // Resolve userId from Dexie once on mount (replaces old fetch('/api/auth/session'))
  useEffect(() => {
    db.users
      .toCollection()
      .first()
      .then((user) => {
        if (user) setUserId(user.id);
      })
      .catch(() => {});
  }, []);

  // Live query: gamification singleton
  const gamification = useLiveQuery(
    () => (userId ? db.gamification.get(userId) : undefined),
    [userId]
  );

  // Live query: unlocked badges
  const badgeRows = useLiveQuery(
    () =>
      userId
        ? db.badges.where("userId").equals(userId).toArray()
        : [],
    [userId]
  );

  const unlockedBadges: BadgeId[] = (badgeRows ?? []).map(
    (b) => b.id as BadgeId
  );

  // ── Helpers ────────────────────────────────────────────────────────────────

  const ensureGamificationRow = useCallback(
    async (uid: string) => {
      const existing = await db.gamification.get(uid);
      if (!existing) {
        await db.gamification.put({
          userId: uid,
          xp: 0,
          level: 1,
          coins: 100, // starter coins
          streak: 0,
          longestStreak: 0,
          lastActivityDate: null,
          updatedAt: Date.now(),
        });
      }
    },
    []
  );

  // ── unlockBadge ────────────────────────────────────────────────────────────

  const unlockBadge = useCallback(
    async (id: BadgeId) => {
      if (!userId) return;
      await ensureGamificationRow(userId);

      const existing = await db.badges.get([id, userId]);
      if (existing) return; // idempotent

      const def = BADGE_DEFS.find((b) => b.id === id);
      if (!def) return;

      await db.badges.put({ id, userId, unlockedAt: Date.now(), synced: false });

      // Award XP + coins for the badge
      await db.gamification.where("userId").equals(userId).modify((row) => {
        row.xp += def.xpReward;
        row.level = computeLevel(row.xp);
        row.coins += def.coinReward;
        row.updatedAt = Date.now();
      });
    },
    [userId, ensureGamificationRow]
  );

  // ── addXP ──────────────────────────────────────────────────────────────────

  const addXP = useCallback(
    async (source: XPSource, metadata?: object) => {
      if (!userId) return;
      await ensureGamificationRow(userId);

      const amount = XP_RULES[source];
      const now = Date.now();

      await db.xpEvents.add({
        userId,
        source,
        amount,
        metadata: metadata ? JSON.stringify(metadata) : undefined,
        createdAt: now,
        synced: false,
      });

      await db.gamification.where("userId").equals(userId).modify((row) => {
        row.xp += amount;
        row.level = computeLevel(row.xp);
        row.updatedAt = now;
      });
    },
    [userId, ensureGamificationRow]
  );

  // ── addCoins ───────────────────────────────────────────────────────────────

  const addCoins = useCallback(
    async (amount: number) => {
      if (!userId) return;
      await ensureGamificationRow(userId);

      await db.gamification.where("userId").equals(userId).modify((row) => {
        row.coins += amount;
        row.updatedAt = Date.now();
      });

      // Check coin_saver badge
      const current = await db.gamification.get(userId);
      if ((current?.coins ?? 0) >= 500) {
        await unlockBadge("coin_saver");
      }
    },
    [userId, ensureGamificationRow, unlockBadge]
  );

  // ── logActivity ────────────────────────────────────────────────────────────

  const logActivity = useCallback(
    async (type: string, bloomLevel?: string) => {
      if (!userId) return;
      await ensureGamificationRow(userId);

      const today = todayString();
      await db.activityLog.add({
        userId,
        date: today,
        activityType: type,
        bloomLevel,
        xpEarned: XP_RULES.STREAK_DAILY,
        synced: false,
      });

      // Update streak
      const row = await db.gamification.get(userId);
      const { newStreak, streakBroken } = computeStreakUpdate(
        row?.streak ?? 0,
        row?.lastActivityDate ?? null
      );
      const newLongest = Math.max(row?.longestStreak ?? 0, newStreak);

      await db.gamification.where("userId").equals(userId).modify((g) => {
        // Only increment XP if this is first activity of the day
        const isNewDay = g.lastActivityDate !== today;
        if (isNewDay) {
          g.xp += XP_RULES.STREAK_DAILY;
          g.level = computeLevel(g.xp);
        }
        g.streak = newStreak;
        g.longestStreak = newLongest;
        g.lastActivityDate = today;
        g.updatedAt = Date.now();
      });

      // Check streak badges
      const streakBadges = checkStreakBadges(newStreak);
      for (const b of streakBadges) await unlockBadge(b);

      // Milestone XP bonuses
      if (!streakBroken && newStreak === 7) await addXP("STREAK_MILESTONE_7");
      if (!streakBroken && newStreak === 30) await addXP("STREAK_MILESTONE_30");

      // Time-of-day badges
      const nightBadge = getNightOwlBadge();
      if (nightBadge) await unlockBadge(nightBadge);
      const earlyBadge = getEarlyBirdBadge();
      if (earlyBadge) await unlockBadge(earlyBadge);
    },
    [userId, ensureGamificationRow, unlockBadge, addXP]
  );

  // ── Derived state ──────────────────────────────────────────────────────────

  const xp = gamification?.xp ?? 0;
  const level = gamification?.level ?? 1;
  const coins = gamification?.coins ?? 0;
  const streak = gamification?.streak ?? 0;
  const longestStreak = gamification?.longestStreak ?? 0;
  const isLoaded = userId !== null && gamification !== undefined;

  return (
    <GamificationContext.Provider
      value={{
        xp,
        level,
        xpProgress: xpProgressPercent(xp),
        xpToNext: xpToNextLevel(xp),
        coins,
        streak,
        longestStreak,
        unlockedBadges,
        badgeDefs: BADGE_DEFS,
        isLoaded,
        userId,
        addXP,
        addCoins,
        logActivity,
        unlockBadge,
      }}
    >
      {children}
    </GamificationContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useGamification(): GamificationState {
  return useContext(GamificationContext);
}
