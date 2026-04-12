"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/dexie";
import { useGamification } from "@/contexts/GamificationContext";
import { BLOOM_WEIGHTS } from "@/lib/gamification";

// ── Types ────────────────────────────────────────────────────────────────────

export interface MonitorInfo {
  name: string;
  email: string;
  pledge: string;
  createdAt: string;
}

export type CommitmentStatus = "good_standing" | "at_risk" | "breached";

export interface StreakData {
  current: number;
  longest: number;
  /** ISO timestamp of last activity */
  lastActivity: string;
  /** Seconds remaining until streak resets (midnight countdown) */
  secondsRemaining: number;
  /** Heat-map grid: last 16 weeks × 7 days, value = activity count that day */
  heatMap: { date: string; count: number }[];
}

export type BloomLevel =
  | "knowledge"
  | "comprehension"
  | "application"
  | "analysis"
  | "synthesis"
  | "evaluation";

export interface BloomProgress {
  level: BloomLevel;
  label: string;
  points: number;
  maxPoints: number;
  weight: number;
}

export interface AccountabilityState {
  monitor: MonitorInfo | null;
  commitmentStatus: CommitmentStatus;
  streak: StreakData;
  bloom: BloomProgress[];
  totalProgressionPoints: number;
  setMonitor: (m: MonitorInfo) => void;
  clearMonitor: () => void;
  logActivity: (bloomLevel: BloomLevel) => void;
}

// ── Bloom labels ──────────────────────────────────────────────────────────────

const BLOOM_LABELS: Record<BloomLevel, string> = {
  knowledge: "Knowledge",
  comprehension: "Comprehension",
  application: "Application",
  analysis: "Analysis",
  synthesis: "Synthesis",
  evaluation: "Evaluation",
};

const BLOOM_LEVELS: BloomLevel[] = [
  "knowledge",
  "comprehension",
  "application",
  "analysis",
  "synthesis",
  "evaluation",
];

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useAccountability(): AccountabilityState {
  const { userId, streak: gamStreak, longestStreak, logActivity: gamLogActivity } =
    useGamification();

  // Live queries from Dexie
  const commitmentRow = useLiveQuery(
    () => (userId ? db.commitments.get(userId) : undefined),
    [userId]
  );

  const gamificationRow = useLiveQuery(
    () => (userId ? db.gamification.get(userId) : undefined),
    [userId]
  );

  // Activity log for heatmap (last 16 weeks = 112 days)
  const activityLogs = useLiveQuery(async () => {
    if (!userId) return [];
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 112);
    const cutoffStr = cutoff.toISOString().slice(0, 10);
    return db.activityLog
      .where("userId")
      .equals(userId)
      .filter((a) => a.date >= cutoffStr)
      .toArray();
  }, [userId]);

  // Bloom points from activity log
  const bloomLogs = useLiveQuery(async () => {
    if (!userId) return [];
    return db.activityLog
      .where("userId")
      .equals(userId)
      .filter((a) => !!a.bloomLevel)
      .toArray();
  }, [userId]);

  // ── Countdown timer ────────────────────────────────────────────────────────

  const deadline = useMemo(() => {
    const d = new Date();
    d.setHours(23, 59, 59, 999);
    return d.getTime();
  }, []);

  const [secondsRemaining, setSecondsRemaining] = useState(() =>
    Math.max(0, Math.floor((deadline - Date.now()) / 1000))
  );

  useEffect(() => {
    const iv = setInterval(() => {
      setSecondsRemaining(Math.max(0, Math.floor((deadline - Date.now()) / 1000)));
    }, 1000);
    return () => clearInterval(iv);
  }, [deadline]);

  // ── Heat map: group activityLogs by date ──────────────────────────────────

  const heatMap = useMemo((): { date: string; count: number }[] => {
    const today = new Date();
    const cells: { date: string; count: number }[] = [];
    const grouped: Record<string, number> = {};

    for (const log of activityLogs ?? []) {
      grouped[log.date] = (grouped[log.date] ?? 0) + 1;
    }

    for (let i = 112; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const iso = d.toISOString().slice(0, 10);
      cells.push({ date: iso, count: grouped[iso] ?? 0 });
    }
    return cells;
  }, [activityLogs]);

  // ── Bloom progress: aggregate from activity log ────────────────────────────

  const bloom = useMemo((): BloomProgress[] => {
    const counts: Record<BloomLevel, number> = {
      knowledge: 0,
      comprehension: 0,
      application: 0,
      analysis: 0,
      synthesis: 0,
      evaluation: 0,
    };

    for (const log of bloomLogs ?? []) {
      const lvl = log.bloomLevel as BloomLevel;
      if (lvl && counts[lvl] !== undefined) counts[lvl]++;
    }

    return BLOOM_LEVELS.map((level) => ({
      level,
      label: BLOOM_LABELS[level],
      points: Math.min(counts[level], 50),
      maxPoints: 50,
      weight: BLOOM_WEIGHTS[level],
    }));
  }, [bloomLogs]);

  // ── Monitor read/write ─────────────────────────────────────────────────────

  const monitor: MonitorInfo | null = commitmentRow
    ? {
        name: commitmentRow.monitorName,
        email: commitmentRow.monitorEmail,
        pledge: commitmentRow.pledge,
        createdAt: new Date(commitmentRow.createdAt).toISOString(),
      }
    : null;

  const setMonitor = useCallback(
    async (m: MonitorInfo) => {
      if (!userId) return;
      await db.commitments.put({
        userId,
        monitorName: m.name,
        monitorEmail: m.email,
        pledge: m.pledge,
        createdAt: Date.now(),
      });
    },
    [userId]
  );

  const clearMonitor = useCallback(async () => {
    if (!userId) return;
    await db.commitments.delete(userId);
  }, [userId]);

  // ── logActivity — delegates to GamificationContext ─────────────────────────

  const logActivity = useCallback(
    (level: BloomLevel) => {
      gamLogActivity("accountability_activity", level);
    },
    [gamLogActivity]
  );

  // ── Derived values ─────────────────────────────────────────────────────────

  const streakCount = gamificationRow?.streak ?? gamStreak ?? 0;
  const longestCount = gamificationRow?.longestStreak ?? longestStreak ?? 0;
  const lastActivityDate = gamificationRow?.lastActivityDate ?? null;
  const isAtRisk = secondsRemaining <= 7200;

  const commitmentStatus: CommitmentStatus =
    !monitor ? "good_standing" : isAtRisk ? "at_risk" : "good_standing";

  const streak: StreakData = {
    current: streakCount,
    longest: longestCount,
    lastActivity: lastActivityDate
      ? `${lastActivityDate}T00:00:00.000Z`
      : new Date().toISOString(),
    secondsRemaining,
    heatMap,
  };

  const totalProgressionPoints = bloom.reduce(
    (sum, b) => sum + b.points * b.weight,
    0
  );

  return {
    monitor,
    commitmentStatus,
    streak,
    bloom,
    totalProgressionPoints,
    setMonitor,
    clearMonitor,
    logActivity,
  };
}
