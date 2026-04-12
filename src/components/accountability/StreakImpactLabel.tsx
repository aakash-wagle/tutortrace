"use client";

import { Flame } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  taskName?: string;
  weight?: number;
}

export default function StreakImpactLabel({ weight = 1 }: Props) {
  const msg =
    weight >= 3
      ? "High-impact: contributes 3× to your progression"
      : weight >= 2
        ? "Completing this maintains your streak (+2× progress)"
        : "Completing this maintains your streak";

  const classes =
    weight >= 3
      ? "bg-purple-50 border-purple-300 text-purple-800"
      : weight >= 2
        ? "bg-cyan-50 border-cyan-300 text-cyan-800"
        : "bg-green-50 border-green-300 text-green-800";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[11px] font-semibold",
        classes
      )}
    >
      <Flame className="h-3 w-3" />
      {msg}
    </span>
  );
}
