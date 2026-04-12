"use client";

import { BellRing } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

interface Props {
  secondsRemaining: number;
  streakCount: number;
  visible: boolean;
}

function fmtTime(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

export default function NudgeAlert({ secondsRemaining, streakCount, visible }: Props) {
  const router = useRouter();

  if (!visible) return null;

  return (
    <div className="mb-5 flex items-center gap-4 rounded-xl border-2 border-amber-200 bg-amber-50 px-5 py-4">
      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-amber-100">
        <BellRing className="h-5 w-5 text-orange-600" />
      </div>
      <div className="flex-1">
        <p className="text-sm font-bold text-orange-700">
          Your {streakCount}-day streak is expiring
        </p>
        <p className="mt-0.5 text-xs text-orange-800">
          Complete any study task in the next{" "}
          <span className="font-mono font-bold text-sm">{fmtTime(secondsRemaining)}</span>{" "}
          to stay on track. Your accountability monitor will be notified if the streak breaks.
        </p>
      </div>
      <Button
        size="sm"
        onClick={() => router.push("/coach")}
        className="flex-shrink-0 bg-orange-600 text-white hover:bg-orange-700"
      >
        Study Now
      </Button>
    </div>
  );
}
