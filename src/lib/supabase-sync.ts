import { createClient } from "@supabase/supabase-js";
import { db } from "./dexie";
import { computeLevel } from "./gamification";

// ── Supabase client (anon key — safe for browser) ────────────────────────────

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

// Guard: Supabase is optional. If env vars are missing the sync is a no-op.
function getClient() {
  if (!supabaseUrl || !supabaseAnonKey) return null;
  return createClient(supabaseUrl, supabaseAnonKey);
}

// ── Gamification upsert ───────────────────────────────────────────────────────

export async function syncGamificationToSupabase(userId: string): Promise<void> {
  const supabase = getClient();
  if (!supabase) return;

  try {
    const row = await db.gamification.get(userId);
    if (!row) return;

    await supabase.from("gamification").upsert(
      {
        user_id: userId,
        xp: row.xp,
        level: row.level,
        coins: row.coins,
        streak: row.streak,
        longest_streak: row.longestStreak,
        last_activity_date: row.lastActivityDate,
        updated_at: new Date(row.updatedAt).toISOString(),
      },
      { onConflict: "user_id" }
    );
  } catch {
    // Background sync — swallow errors silently
  }
}

// ── XP events push ────────────────────────────────────────────────────────────

export async function syncUnsyncedXPEvents(userId: string): Promise<void> {
  const supabase = getClient();
  if (!supabase) return;

  try {
    const events = await db.xpEvents
      .where("userId")
      .equals(userId)
      .filter((e) => !e.synced)
      .toArray();

    if (events.length === 0) return;

    const rows = events.map((e) => ({
      user_id: e.userId,
      source: e.source,
      amount: e.amount,
      metadata: e.metadata ? JSON.parse(e.metadata) : null,
      created_at: new Date(e.createdAt).toISOString(),
    }));

    const { error } = await supabase.from("xp_events").insert(rows);
    if (!error) {
      await Promise.all(
        events
          .filter((e) => e.id !== undefined)
          .map((e) => db.xpEvents.update(e.id!, { synced: true }))
      );
    }
  } catch {
    // Background sync — swallow errors silently
  }
}

// ── Badge push ────────────────────────────────────────────────────────────────

export async function syncUnsyncedBadges(userId: string): Promise<void> {
  const supabase = getClient();
  if (!supabase) return;

  try {
    const badges = await db.badges
      .where("userId")
      .equals(userId)
      .filter((b) => !b.synced)
      .toArray();

    if (badges.length === 0) return;

    const rows = badges.map((b) => ({
      id: b.id,
      user_id: b.userId,
      unlocked_at: new Date(b.unlockedAt).toISOString(),
    }));

    const { error } = await supabase
      .from("badges")
      .upsert(rows, { onConflict: "id,user_id" });

    if (!error) {
      await Promise.all(
        badges.map((b) => db.badges.update([b.id, b.userId], { synced: true }))
      );
    }
  } catch {
    // Background sync — swallow errors silently
  }
}

// ── Pull remote + merge ───────────────────────────────────────────────────────

export async function pullRemoteGamification(userId: string): Promise<void> {
  const supabase = getClient();
  if (!supabase) return;

  try {
    const { data } = await supabase
      .from("gamification")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (!data) return;

    const local = await db.gamification.get(userId);

    const mergedXP = Math.max(local?.xp ?? 0, data.xp ?? 0);
    const mergedStreak = Math.max(local?.streak ?? 0, data.streak ?? 0);
    const mergedLongest = Math.max(
      local?.longestStreak ?? 0,
      data.longest_streak ?? 0
    );

    await db.gamification.put({
      userId,
      xp: mergedXP,
      level: computeLevel(mergedXP),
      coins: Math.max(local?.coins ?? 0, data.coins ?? 0),
      streak: mergedStreak,
      longestStreak: mergedLongest,
      lastActivityDate: local?.lastActivityDate ?? data.last_activity_date ?? null,
      updatedAt: Date.now(),
    });

    // Merge remote badges
    const { data: remoteBadges } = await supabase
      .from("badges")
      .select("id, unlocked_at")
      .eq("user_id", userId);

    if (remoteBadges) {
      for (const rb of remoteBadges) {
        const existing = await db.badges.get([rb.id, userId]);
        if (!existing) {
          await db.badges.put({
            id: rb.id,
            userId,
            unlockedAt: new Date(rb.unlocked_at).getTime(),
            synced: true,
          });
        }
      }
    }
  } catch {
    // Background sync — swallow errors silently
  }
}

// ── User upsert ───────────────────────────────────────────────────────────────

export async function syncUserToSupabase(
  userId: string,
  displayName: string,
  avatarUrl?: string
): Promise<void> {
  const supabase = getClient();
  if (!supabase) return;

  try {
    await supabase.from("users").upsert(
      { id: userId, display_name: displayName, avatar_url: avatarUrl ?? null },
      { onConflict: "id" }
    );
  } catch {
    // Background sync — swallow errors silently
  }
}
