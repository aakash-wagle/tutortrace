"use client";

import { Target } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

import { useAccountability } from "@/hooks/useAccountability";
import StatusBanner from "@/components/accountability/StatusBanner";
import NudgeAlert from "@/components/accountability/NudgeAlert";
import CommitmentContract from "@/components/accountability/CommitmentContract";
import StreakTracker from "@/components/accountability/StreakTracker";
import StreakHeatMap from "@/components/accountability/StreakHeatMap";
import BloomRadar from "@/components/accountability/BloomRadar";
import StreakImpactLabel from "@/components/accountability/StreakImpactLabel";

const SAMPLE_TASKS = [
  { name: "Lab 5 — Memory Allocation Diagnostics", course: "CMPSC 132", weight: 2, due: "Tomorrow" },
  { name: "Midterm Review Flashcards", course: "CSE 586", weight: 1, due: "Today" },
  { name: "Synthesis Essay: Vision Architectures", course: "CSE 586", weight: 3, due: "Mar 5" },
  { name: "Module 6 Checkpoint", course: "CMPSC 132", weight: 1, due: "Mar 3" },
];

export default function AccountabilityPage() {
  const {
    monitor,
    commitmentStatus,
    streak,
    bloom,
    totalProgressionPoints,
    setMonitor,
    clearMonitor,
  } = useAccountability();

  const isAtRisk = streak.secondsRemaining <= 7200;

  return (
    <div>
      {/* Header */}
      <div className="mb-0.5 flex items-center gap-2">
        <Target className="h-7 w-7 text-foreground" />
        <h1 className="text-2xl font-bold tracking-tight">Accountability</h1>
      </div>
      <p className="mb-6 text-sm text-muted-foreground">
        Track consistency, manage commitments, and measure learning depth.
      </p>

      {/* Status Banner */}
      <div className="mb-4">
        <StatusBanner
          status={commitmentStatus}
          monitorName={monitor?.name ?? null}
          streakCount={streak.current}
        />
      </div>

      {/* Nudge Alert */}
      <NudgeAlert
        secondsRemaining={streak.secondsRemaining}
        streakCount={streak.current}
        visible={isAtRisk && !!monitor}
      />

      {/* Top row: Streak + Contract */}
      <div className="mb-5 grid grid-cols-1 gap-5 md:grid-cols-2">
        <StreakTracker streak={streak} />
        <CommitmentContract
          monitor={monitor}
          onSave={setMonitor}
          onClear={clearMonitor}
        />
      </div>

      {/* Heat Map */}
      <div className="mb-5">
        <StreakHeatMap heatMap={streak.heatMap} />
      </div>

      {/* Bloom's Taxonomy */}
      <div className="mb-5">
        <BloomRadar bloom={bloom} totalPoints={totalProgressionPoints} />
      </div>

      {/* Streak-linked tasks */}
      <Card className="border-2">
        <CardContent className="p-5">
          <h2 className="text-base font-bold">Upcoming Tasks — Streak Impact</h2>
          <p className="mb-4 mt-0.5 text-xs text-muted-foreground">
            Completing any of these counts toward today&apos;s streak and learning progression.
          </p>
          <Separator className="mb-4" />

          {SAMPLE_TASKS.map((t, i) => (
            <div
              key={i}
              className={`flex items-center gap-4 py-3 ${
                i < SAMPLE_TASKS.length - 1 ? "border-b border-border" : ""
              }`}
            >
              <div className="flex-1">
                <p className="mb-1 text-sm font-semibold">{t.name}</p>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge className="h-5 border-0 bg-muted text-[11px] font-semibold text-muted-foreground">
                    {t.course}
                  </Badge>
                  <span className="text-xs text-muted-foreground">Due {t.due}</span>
                  <StreakImpactLabel weight={t.weight} />
                </div>
              </div>
              <Badge
                className={`h-5 border-0 text-[11px] font-semibold ${
                  t.weight >= 3
                    ? "bg-purple-100 text-purple-800"
                    : t.weight >= 2
                    ? "bg-cyan-100 text-cyan-800"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {t.weight >= 3 ? "Synthesis" : t.weight >= 2 ? "Analysis" : "Foundational"}
              </Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
