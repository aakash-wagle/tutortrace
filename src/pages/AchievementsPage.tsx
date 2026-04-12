"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, Sparkles, Zap } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { StudyOwl } from "@/components/StudyOwl";
import { useGamification } from "@/contexts/GamificationContext";
import { useAchievementToast } from "@/hooks/useAchievementToast";
import { BADGE_DEFS, BadgeDef } from "@/lib/gamification";

const containerVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
};

const badgeVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.92 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: "spring" as const, stiffness: 300, damping: 22 },
  },
};

function BadgeCard({ def, unlocked }: { def: BadgeDef; unlocked: boolean }) {
  return (
    <motion.div
      variants={badgeVariants}
      whileHover={{ scale: 1.04, y: -4 }}
      transition={{ type: "spring", stiffness: 300, damping: 18 }}
    >
      <Card
        className={`relative h-full overflow-hidden transition-all ${
          unlocked
            ? "border-2 border-foreground shadow-neo-brown opacity-100"
            : "border border-dashed border-border opacity-45 grayscale-[0.7]"
        }`}
      >
        {!unlocked && (
          <span className="absolute right-2 top-2 text-sm opacity-60">🔒</span>
        )}
        <CardContent className="p-4 text-center">
          <p className="mb-2 text-4xl leading-none">{def.icon}</p>
          <p className="mb-1 text-xs font-bold leading-tight">{def.name}</p>
          <p className="text-[11px] leading-snug text-muted-foreground">{def.description}</p>
          {unlocked && (
            <div className="mt-3 flex flex-wrap justify-center gap-1">
              <Badge className="h-5 border-0 bg-muted text-[10px] font-bold text-foreground">
                +{def.xpReward} XP
              </Badge>
              {def.coinReward > 0 && (
                <Badge className="h-5 border-0 bg-accent/20 text-[10px] font-bold text-accent-foreground">
                  +{def.coinReward} 🪙
                </Badge>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

export default function AchievementsPage() {
  const { unlockedBadges, xp, level, coins, isLoaded, logActivity } = useGamification();
  const { triggerAchievement, lastMessage, isGenerating } = useAchievementToast();

  const [celebrationBadge, setCelebrationBadge] = useState<BadgeDef | null>(null);
  const [aiCelebrationText, setAiCelebrationText] = useState<string | null>(null);
  const prevBadgeCount = useRef(0);

  useEffect(() => {
    logActivity("achievements_view");
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!isLoaded) return;

    if (unlockedBadges.length > prevBadgeCount.current && prevBadgeCount.current > 0) {
      const latestId = unlockedBadges[unlockedBadges.length - 1];
      const def = BADGE_DEFS.find((b) => b.id === latestId);

      if (def) {
        setCelebrationBadge(def);
        setAiCelebrationText(null);

        // Fire the AI hype generator and capture the response for the overlay
        triggerAchievement({ type: "badge", value: def.name }).then((msg) => {
          setAiCelebrationText(msg.message);
        });

        setTimeout(() => {
          setCelebrationBadge(null);
          setAiCelebrationText(null);
        }, 6000);
      }
    }

    prevBadgeCount.current = unlockedBadges.length;
  }, [unlockedBadges, isLoaded, triggerAchievement]);

  const unlocked = unlockedBadges.length;
  const total = BADGE_DEFS.length;
  const progress = (unlocked / total) * 100;

  return (
    <>
      {/* ── Badge unlock celebration overlay ─────────────────────────────── */}
      <AnimatePresence>
        {celebrationBadge && (
          <motion.div
            initial={{ opacity: 0, y: -60, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -60, scale: 0.8 }}
            transition={{ type: "spring", stiffness: 300, damping: 22 }}
            className="fixed left-1/2 top-20 z-[9999] flex min-w-[300px] max-w-[420px] -translate-x-1/2 items-start gap-3 rounded-2xl border-2 border-foreground bg-background p-5 shadow-neo"
          >
            <span className="text-4xl leading-none">{celebrationBadge.icon}</span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1">
                <p className="text-sm font-bold leading-tight">Badge Unlocked!</p>
                {isGenerating && (
                  <span className="flex h-4 w-4 items-center justify-center">
                    <span className="h-2.5 w-2.5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  </span>
                )}
              </div>
              <p className="text-xs font-semibold text-primary">{celebrationBadge.name}</p>
              {aiCelebrationText ? (
                <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                  {aiCelebrationText}
                </p>
              ) : (
                <p className="mt-1 text-xs text-muted-foreground">
                  {celebrationBadge.description}
                </p>
              )}
            </div>
            <StudyOwl mood="celebrating" size="sm" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-0.5 flex items-center gap-2">
            <Trophy className="h-7 w-7 text-foreground" />
            <h1 className="text-2xl font-bold tracking-tight">Achievements</h1>
          </div>
          <p className="mb-3 text-sm text-muted-foreground">
            {unlocked} / {total} badges unlocked
          </p>
          <div className="w-60">
            <Progress value={progress} className="h-2" />
          </div>
        </div>

        {/* Stats */}
        <div className="flex gap-3">
          {[
            { label: "Level", value: level, emoji: "⭐" },
            { label: "Total XP", value: xp, emoji: "✨" },
            { label: "Coins", value: coins, emoji: "🪙" },
          ].map((stat) => (
            <div
              key={stat.label}
              className="min-w-[70px] rounded-xl border-2 border-foreground px-3 py-2 text-center shadow-neo-brown"
            >
              <p className="text-xl leading-none">{stat.emoji}</p>
              <p className="text-base font-bold">{stat.value}</p>
              <p className="text-[11px] text-muted-foreground">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Last AI message ───────────────────────────────────────────────── */}
      {lastMessage && (
        <Card className="relative mb-6 overflow-hidden border-2 border-primary/20 shadow-neo-sm">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5" />
          <CardContent className="relative flex items-start gap-3 p-4">
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10">
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="mb-0.5 flex items-center gap-2">
                <p className="text-xs font-bold">Latest Achievement Message</p>
                <Badge className="h-4 border-0 bg-primary/10 text-[10px] font-bold text-primary">
                  AI
                </Badge>
              </div>
              <p className="text-sm leading-relaxed text-foreground/90">{lastMessage.message}</p>
              {lastMessage.badge_label && (
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Achievement: {lastMessage.badge_label}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Badge grid ───────────────────────────────────────────────────── */}
      <div className="mb-4 flex items-center gap-2">
        <Zap className="h-4 w-4 text-muted-foreground" />
        <p className="text-sm font-bold">Badge Collection</p>
        <Badge variant="outline" className="ml-auto text-xs">
          {unlocked}/{total}
        </Badge>
      </div>

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-4"
      >
        {BADGE_DEFS.map((def) => (
          <BadgeCard
            key={def.id}
            def={def}
            unlocked={unlockedBadges.includes(def.id)}
          />
        ))}
      </motion.div>
    </>
  );
}
