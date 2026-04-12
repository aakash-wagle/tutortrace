"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import AppShell from "@/components/AppShell";
import { StudyOwl } from "@/components/StudyOwl";
import { useGamification } from "@/contexts/GamificationContext";
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
  const [newBadge, setNewBadge] = useState<BadgeDef | null>(null);
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
        setNewBadge(def);
        setTimeout(() => setNewBadge(null), 3500);
      }
    }
    prevBadgeCount.current = unlockedBadges.length;
  }, [unlockedBadges, isLoaded]);

  const unlocked = unlockedBadges.length;
  const total = BADGE_DEFS.length;
  const progress = (unlocked / total) * 100;

  return (
    <AppShell>
      {/* New badge celebration overlay */}
      <AnimatePresence>
        {newBadge && (
          <motion.div
            initial={{ opacity: 0, y: -60, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -60, scale: 0.8 }}
            transition={{ type: "spring", stiffness: 300, damping: 22 }}
            className="fixed left-1/2 top-20 z-[9999] flex min-w-[260px] -translate-x-1/2 items-center gap-3 rounded-xl border-2 border-foreground bg-background p-4 shadow-neo"
          >
            <span className="text-4xl">{newBadge.icon}</span>
            <div>
              <p className="text-sm font-bold leading-tight">Badge Unlocked!</p>
              <p className="text-xs text-muted-foreground">{newBadge.name}</p>
            </div>
            <StudyOwl mood="celebrating" size="sm" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
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

      {/* Badge grid */}
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
    </AppShell>
  );
}
