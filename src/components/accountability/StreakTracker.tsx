"use client";

import { Flame, Trophy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { StreakData } from "@/hooks/useAccountability";

interface Props {
  streak: StreakData;
}

function fmtTime(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

export default function StreakTracker({ streak }: Props) {
  const isAtRisk = streak.secondsRemaining <= 7200;

  return (
    <Card
      className={cn(
        "border-2",
        isAtRisk ? "border-amber-300" : "border-green-300"
      )}
    >
      <CardContent className="p-6">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Flame
              className={cn("h-5 w-5", isAtRisk ? "text-orange-600" : "text-green-700")}
            />
            <h3 className="text-base font-bold">Daily Streak</h3>
          </div>
          <Badge
            variant="outline"
            className={cn(
              "font-bold text-xs",
              isAtRisk
                ? "border-amber-300 bg-amber-50 text-amber-800"
                : "border-green-300 bg-green-50 text-green-800"
            )}
          >
            {isAtRisk ? "At Risk" : "Safe"}
          </Badge>
        </div>

        {/* Main counter */}
        <div
          className={cn(
            "mb-4 flex items-baseline justify-center gap-2 rounded-xl border px-6 py-4",
            isAtRisk ? "bg-amber-50 border-amber-200" : "bg-green-50 border-green-200"
          )}
        >
          <span
            className={cn(
              "text-5xl font-extrabold leading-none tracking-tight",
              isAtRisk ? "text-orange-700" : "text-green-800"
            )}
          >
            {streak.current}
          </span>
          <span
            className={cn(
              "text-sm font-semibold",
              isAtRisk ? "text-orange-600" : "text-green-700"
            )}
          >
            {streak.current === 1 ? "Day" : "Days"} Consistent
          </span>
        </div>

        {/* Stats row */}
        <div className="flex gap-3">
          <div
            className={cn(
              "flex-1 rounded-xl p-3 text-center",
              isAtRisk ? "bg-amber-50" : "bg-muted"
            )}
          >
            {isAtRisk ? (
              <>
                <p className="font-mono text-lg font-extrabold leading-tight text-orange-700" suppressHydrationWarning>
                  {fmtTime(streak.secondsRemaining)}
                </p>
                <p className="text-[11px] font-semibold text-orange-600">Streak expires in</p>
              </>
            ) : (
              <>
                <p className="font-mono text-lg font-extrabold leading-tight text-foreground" suppressHydrationWarning>
                  {fmtTime(streak.secondsRemaining)}
                </p>
                <p className="text-[11px] text-muted-foreground">Time remaining today</p>
              </>
            )}
          </div>
          <div className="flex-1 rounded-xl bg-muted p-3 text-center">
            <div className="flex items-center justify-center gap-1">
              <Trophy className="h-4 w-4 text-yellow-600" />
              <span className="text-lg font-extrabold leading-tight text-foreground">
                {streak.longest}
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground">Personal best</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
