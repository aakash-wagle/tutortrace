"use client";

import { CheckCircle2, AlertTriangle, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CommitmentStatus } from "@/hooks/useAccountability";

interface Props {
  status: CommitmentStatus;
  monitorName: string | null;
  streakCount: number;
}

const CONFIG: Record<
  CommitmentStatus,
  {
    icon: React.ReactNode;
    label: string;
    sublabel: (p: Props) => string;
    classes: string;
  }
> = {
  good_standing: {
    icon: <CheckCircle2 className="h-5 w-5 text-green-700" />,
    label: "In Good Standing",
    sublabel: (p) =>
      `${p.streakCount}-day streak active${p.monitorName ? ` · Monitored by ${p.monitorName}` : ""}`,
    classes: "bg-green-50 border-green-200 text-green-900",
  },
  at_risk: {
    icon: <AlertTriangle className="h-5 w-5 text-amber-700" />,
    label: "Commitment At Risk",
    sublabel: () => "Complete a task before the deadline to maintain your streak.",
    classes: "bg-amber-50 border-amber-200 text-amber-900",
  },
  breached: {
    icon: <AlertCircle className="h-5 w-5 text-red-700" />,
    label: "Commitment Breach — Monitor Notified",
    sublabel: (p) =>
      `${p.monitorName || "Your monitor"} has been sent a notification. Rebuild your streak today.`,
    classes: "bg-red-50 border-red-200 text-red-900",
  },
};

export default function StatusBanner({ status, monitorName, streakCount }: Props) {
  const c = CONFIG[status];
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-xl border-2 px-5 py-3",
        c.classes
      )}
    >
      <div className="flex-shrink-0">{c.icon}</div>
      <div className="flex-1">
        <p className="text-sm font-bold leading-tight">{c.label}</p>
        <p className="mt-0.5 text-xs opacity-85">
          {c.sublabel({ status, monitorName, streakCount })}
        </p>
      </div>
    </div>
  );
}
