// ── Deterministic Scheduling Engine ──────────────────────────────────────────
// Takes upcoming Canvas deadlines, estimates study time, and packs them into
// available afternoon/evening slots (4:00 PM – 8:00 PM).

import type { DexieAssignment } from "./db";

// ── Types ────────────────────────────────────────────────────────────────────

export interface TimeBlock {
  id: string;
  assignmentId: number;
  assignmentName: string;
  courseId: number;
  date: string; // YYYY-MM-DD
  startHour: number; // 24h (e.g. 16 = 4 PM)
  startMinute: number;
  durationMinutes: number;
  priority: "critical" | "high" | "medium" | "low";
  dueAt: string | null;
  pointsPossible: number;
  completed: boolean;
}

// ── Config ───────────────────────────────────────────────────────────────────

/** Daily planning window: 4:00 PM to 8:00 PM (240 minutes). */
const SLOT_START_HOUR = 16;
const SLOT_END_HOUR = 20;
const SLOT_CAPACITY_MINUTES = (SLOT_END_HOUR - SLOT_START_HOUR) * 60;

/** Minimum and maximum block sizes. */
const MIN_BLOCK_MINUTES = 25; // Pomodoro-length minimum
const MAX_BLOCK_MINUTES = 90;

// ── Helpers ──────────────────────────────────────────────────────────────────

function startOfDay(d: Date): Date {
  const s = new Date(d);
  s.setHours(0, 0, 0, 0);
  return s;
}

function toDateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function diffDays(a: Date, b: Date): number {
  return Math.ceil(
    (startOfDay(b).getTime() - startOfDay(a).getTime()) / (1000 * 60 * 60 * 24)
  );
}

/** Estimate study minutes from assignment weight + urgency. */
function estimateStudyMinutes(
  pointsPossible: number,
  daysUntilDue: number
): number {
  // Base: roughly 3 minutes per point, clamped
  let base = Math.round(pointsPossible * 3);
  if (base < MIN_BLOCK_MINUTES) base = MIN_BLOCK_MINUTES;
  if (base > 180) base = 180; // cap at 3 hours total

  // If due very soon, frontload (give more time today)
  if (daysUntilDue <= 1) return Math.min(base, MAX_BLOCK_MINUTES * 2);
  if (daysUntilDue <= 3) return Math.min(Math.round(base * 0.6), MAX_BLOCK_MINUTES);

  // Spread across available days
  const sessionsNeeded = Math.max(1, Math.ceil(base / MAX_BLOCK_MINUTES));
  const daysAvailable = Math.min(daysUntilDue, 7);
  return Math.min(
    Math.round(base / Math.min(sessionsNeeded, daysAvailable)),
    MAX_BLOCK_MINUTES
  );
}

function getPriority(
  daysUntilDue: number,
  pointsPossible: number
): TimeBlock["priority"] {
  if (daysUntilDue <= 1) return "critical";
  if (daysUntilDue <= 3 || pointsPossible >= 50) return "high";
  if (daysUntilDue <= 7) return "medium";
  return "low";
}

// ── Main Algorithm ───────────────────────────────────────────────────────────

/**
 * Generates time-blocked study sessions for the next 7 days from a list
 * of upcoming assignments. Blocks are packed into 4–8 PM daily windows.
 */
export function generateTimeBlocks(
  assignments: DexieAssignment[],
  existingCompleted?: Set<string>
): TimeBlock[] {
  const now = new Date();
  const today = startOfDay(now);
  const blocks: TimeBlock[] = [];

  // Filter to upcoming, published assignments with due dates
  const upcoming = assignments
    .filter(
      (a) =>
        a.dueAt &&
        new Date(a.dueAt) > now &&
        a.workflowState === "published"
    )
    .sort((a, b) => (a.dueAt ?? "").localeCompare(b.dueAt ?? ""));

  // Build a daily capacity tracker for 7 days
  const dayCapacity: Record<string, number> = {};
  const daySlotCursor: Record<string, number> = {}; // minutes past SLOT_START_HOUR
  for (let d = 0; d < 7; d++) {
    const date = new Date(today);
    date.setDate(date.getDate() + d);
    const key = toDateKey(date);
    dayCapacity[key] = SLOT_CAPACITY_MINUTES;
    daySlotCursor[key] = 0;
  }

  for (const assignment of upcoming) {
    const dueDate = new Date(assignment.dueAt!);
    const daysUntilDue = diffDays(now, dueDate);
    if (daysUntilDue > 14) continue; // skip far-future items

    const totalStudyMin = estimateStudyMinutes(
      assignment.pointsPossible,
      daysUntilDue
    );
    const priority = getPriority(daysUntilDue, assignment.pointsPossible);

    // Determine which days to schedule (spread across days before due)
    const schedDays = Math.min(
      Math.ceil(totalStudyMin / MAX_BLOCK_MINUTES),
      Math.min(daysUntilDue, 7)
    );
    const perSession = Math.max(
      MIN_BLOCK_MINUTES,
      Math.round(totalStudyMin / schedDays)
    );

    for (let s = 0; s < schedDays; s++) {
      // Pick the day: start from today, but avoid scheduling past due date
      const dayOffset = Math.min(s, daysUntilDue - 1);
      const schedDate = new Date(today);
      schedDate.setDate(schedDate.getDate() + dayOffset);
      const dateKey = toDateKey(schedDate);

      if (!(dateKey in dayCapacity)) continue;
      if (dayCapacity[dateKey] < MIN_BLOCK_MINUTES) continue;

      const duration = Math.min(perSession, dayCapacity[dateKey]);
      const cursor = daySlotCursor[dateKey];

      const startHour = SLOT_START_HOUR + Math.floor(cursor / 60);
      const startMinute = cursor % 60;

      const blockId = `${assignment.id}-${dateKey}-${s}`;

      blocks.push({
        id: blockId,
        assignmentId: assignment.id,
        assignmentName: assignment.name,
        courseId: assignment.courseId,
        date: dateKey,
        startHour,
        startMinute,
        durationMinutes: duration,
        priority,
        dueAt: assignment.dueAt,
        pointsPossible: assignment.pointsPossible,
        completed: existingCompleted?.has(blockId) ?? false,
      });

      dayCapacity[dateKey] -= duration;
      daySlotCursor[dateKey] += duration;
    }
  }

  // Sort by date, then start time
  blocks.sort((a, b) => {
    const dc = a.date.localeCompare(b.date);
    if (dc !== 0) return dc;
    const ha = a.startHour * 60 + a.startMinute;
    const hb = b.startHour * 60 + b.startMinute;
    return ha - hb;
  });

  return blocks;
}

/**
 * Returns today's blocks from a full schedule for the Morning Briefing.
 */
export function getTodayBlocks(blocks: TimeBlock[]): TimeBlock[] {
  const todayKey = toDateKey(new Date());
  return blocks.filter((b) => b.date === todayKey);
}

/**
 * Format a time block for display: "4:00 PM – 5:30 PM"
 */
export function formatBlockTime(block: TimeBlock): string {
  const start = block.startHour * 60 + block.startMinute;
  const end = start + block.durationMinutes;

  const fmt = (mins: number) => {
    const h24 = Math.floor(mins / 60);
    const m = mins % 60;
    const h12 = h24 > 12 ? h24 - 12 : h24 === 0 ? 12 : h24;
    const ampm = h24 >= 12 ? "PM" : "AM";
    return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
  };

  return `${fmt(start)} – ${fmt(end)}`;
}
