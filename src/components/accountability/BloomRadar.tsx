"use client";

import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { BloomProgress } from "@/hooks/useAccountability";

interface Props {
  bloom: BloomProgress[];
  totalPoints: number;
}

const TIER_COLORS: Record<string, string> = {
  knowledge: "#8B6F5E",
  comprehension: "#A68B7B",
  application: "#D4A44A",
  analysis: "#00838F",
  synthesis: "#6B9E6B",
  evaluation: "#7B1FA2",
};

const TIER_BG: Record<string, string> = {
  knowledge: "#F5F0ED",
  comprehension: "#F5F0ED",
  application: "#FFF8E8",
  analysis: "#E0F7FA",
  synthesis: "#E8F5E8",
  evaluation: "#F3E5F5",
};

function RadarChart({ bloom }: { bloom: BloomProgress[] }) {
  const size = 220;
  const cx = size / 2;
  const cy = size / 2;
  const maxR = 85;
  const levels = 5;

  const points = bloom.map((b, i) => {
    const angle = (Math.PI * 2 * i) / bloom.length - Math.PI / 2;
    const ratio = b.points / b.maxPoints;
    const r = ratio * maxR;
    return {
      x: cx + r * Math.cos(angle),
      y: cy + r * Math.sin(angle),
      labelX: cx + (maxR + 22) * Math.cos(angle),
      labelY: cy + (maxR + 22) * Math.sin(angle),
      label: b.label,
    };
  });

  const polygon = points.map((p) => `${p.x},${p.y}`).join(" ");

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {Array.from({ length: levels }).map((_, li) => {
        const r = ((li + 1) / levels) * maxR;
        const ring = bloom.map((_, i) => {
          const angle = (Math.PI * 2 * i) / bloom.length - Math.PI / 2;
          return `${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`;
        });
        return (
          <polygon
            key={li}
            points={ring.join(" ")}
            fill="none"
            stroke="#e5e7eb"
            strokeWidth={li === levels - 1 ? 1.2 : 0.6}
            opacity={0.6}
          />
        );
      })}
      {bloom.map((_, i) => {
        const angle = (Math.PI * 2 * i) / bloom.length - Math.PI / 2;
        return (
          <line
            key={i}
            x1={cx}
            y1={cy}
            x2={cx + maxR * Math.cos(angle)}
            y2={cy + maxR * Math.sin(angle)}
            stroke="#e5e7eb"
            strokeWidth={0.6}
          />
        );
      })}
      <polygon
        points={polygon}
        fill="rgba(232,119,58,0.15)"
        stroke="#e8773a"
        strokeWidth={2}
        strokeLinejoin="round"
      />
      {points.map((p, i) => (
        <circle
          key={i}
          cx={p.x}
          cy={p.y}
          r={4}
          fill={TIER_COLORS[bloom[i].level]}
          stroke="#fff"
          strokeWidth={1.5}
        />
      ))}
      {points.map((p, i) => (
        <text
          key={`label-${i}`}
          x={p.labelX}
          y={p.labelY}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={9}
          fontWeight={600}
          fill="#6b6b6b"
          fontFamily="DM Sans, sans-serif"
        >
          {p.label}
        </text>
      ))}
    </svg>
  );
}

export default function BloomRadar({ bloom, totalPoints }: Props) {
  const maxWeightedTotal = useMemo(
    () => bloom.reduce((sum, b) => sum + b.maxPoints * b.weight, 0),
    [bloom]
  );

  const foundationalPts = bloom
    .filter((b) => b.weight <= 1.5)
    .reduce((s, b) => s + b.points * b.weight, 0);
  const higherOrderPts = bloom
    .filter((b) => b.weight > 1.5)
    .reduce((s, b) => s + b.points * b.weight, 0);

  return (
    <Card className="border-2">
      <CardContent className="p-6">
        <div className="mb-1 flex items-center justify-between">
          <h3 className="text-base font-bold">Learning Depth</h3>
          <span className="text-xs font-bold text-foreground">
            {Math.round(totalPoints)} / {Math.round(maxWeightedTotal)} pts
          </span>
        </div>
        <p className="mb-4 block text-xs text-muted-foreground">
          Higher-order tasks (Synthesis, Evaluation) yield up to 3× progress weight
        </p>

        <div className="flex flex-wrap items-center gap-4">
          <div className="flex-shrink-0">
            <RadarChart bloom={bloom} />
          </div>

          <div className="min-w-[200px] flex-1">
            <div className="mb-4 flex gap-3">
              <div className="flex-1 rounded-xl bg-muted p-3 text-center">
                <p className="text-base font-extrabold">{Math.round(foundationalPts)}</p>
                <p className="text-xs font-semibold">Foundational</p>
                <p className="text-[10px] text-muted-foreground">
                  Knowledge · Comprehension · Application
                </p>
              </div>
              <div className="flex-1 rounded-xl bg-purple-50 p-3 text-center">
                <p className="text-base font-extrabold text-purple-800">
                  {Math.round(higherOrderPts)}
                </p>
                <p className="text-xs font-semibold text-purple-800">Higher-Order</p>
                <p className="text-[10px] text-purple-600">
                  Analysis · Synthesis · Evaluation
                </p>
              </div>
            </div>

            <TooltipProvider>
              {bloom.map((b) => {
                const pct = Math.round((b.points / b.maxPoints) * 100);
                const weighted = Math.round(b.points * b.weight);
                return (
                  <div key={b.level} className="mb-3">
                    <div className="mb-1 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: TIER_COLORS[b.level] }}
                        />
                        <span className="text-xs font-semibold">{b.label}</span>
                        {b.weight > 1 && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Badge
                                variant="outline"
                                className="h-4 cursor-default px-1 text-[10px] font-bold"
                                style={{
                                  backgroundColor: TIER_BG[b.level],
                                  color: TIER_COLORS[b.level],
                                  borderColor: TIER_COLORS[b.level],
                                }}
                              >
                                {b.weight}×
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>This tier earns {b.weight}× progress weight</p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                      <span className="text-[11px] font-semibold text-muted-foreground">
                        {weighted} pts ({pct}%)
                      </span>
                    </div>
                    <Progress
                      value={pct}
                      className="h-1.5"
                      style={
                        {
                          "--progress-foreground": TIER_COLORS[b.level],
                        } as React.CSSProperties
                      }
                    />
                  </div>
                );
              })}
            </TooltipProvider>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
