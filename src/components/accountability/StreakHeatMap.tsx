"use client";

import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface Cell {
  date: string;
  count: number;
}

interface Props {
  heatMap: Cell[];
}

const DAY_LABELS = ["", "Mon", "", "Wed", "", "Fri", ""];
const CELL_SIZE = 13;
const CELL_GAP = 3;

function intensityColor(count: number): string {
  if (count === 0) return "#e5e7eb";
  if (count === 1) return "#d4c8c0";
  if (count === 2) return "#b89e8e";
  if (count === 3) return "#a68b7b";
  return "#8B6F5E";
}

export default function StreakHeatMap({ heatMap }: Props) {
  const { weeks, months } = useMemo(() => {
    const sorted = [...heatMap].sort((a, b) => a.date.localeCompare(b.date));

    const firstDate = new Date(sorted[0]?.date || Date.now());
    const startDow = firstDate.getDay();
    const padded: (Cell | null)[] = Array(startDow).fill(null).concat(sorted);

    const wk: (Cell | null)[][] = [];
    for (let i = 0; i < padded.length; i += 7) {
      wk.push(padded.slice(i, i + 7));
    }

    const mo: { label: string; col: number }[] = [];
    let lastMonth = -1;
    wk.forEach((week, wi) => {
      for (const cell of week) {
        if (cell) {
          const m = new Date(cell.date).getMonth();
          if (m !== lastMonth) {
            mo.push({
              label: new Date(cell.date).toLocaleString("en-US", { month: "short" }),
              col: wi,
            });
            lastMonth = m;
          }
          break;
        }
      }
    });

    return { weeks: wk, months: mo };
  }, [heatMap]);

  const totalActiveDays = heatMap.filter((c) => c.count > 0).length;

  return (
    <Card className="border-2">
      <CardContent className="p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-bold">Consistency Map</h3>
          <span className="text-xs font-semibold text-muted-foreground">
            {totalActiveDays} active days
          </span>
        </div>

        <div className="overflow-x-auto">
          {/* Month labels */}
          <div
            className="relative mb-1 flex h-4"
            style={{ paddingLeft: 24 + CELL_GAP }}
          >
            {months.map((m, i) => (
              <span
                key={i}
                className="absolute text-[10px] text-muted-foreground"
                style={{ left: m.col * (CELL_SIZE + CELL_GAP) }}
              >
                {m.label}
              </span>
            ))}
          </div>

          <div className="flex">
            {/* Day-of-week labels */}
            <div className="flex flex-col" style={{ marginRight: CELL_GAP }}>
              {DAY_LABELS.map((label, i) => (
                <div
                  key={i}
                  className="flex w-[22px] items-center"
                  style={{
                    height: CELL_SIZE,
                    marginBottom: CELL_GAP,
                  }}
                >
                  <span className="text-[10px] leading-none text-muted-foreground">
                    {label}
                  </span>
                </div>
              ))}
            </div>

            {/* Grid */}
            <TooltipProvider>
              <div className="flex" style={{ gap: CELL_GAP }}>
                {weeks.map((week, wi) => (
                  <div
                    key={wi}
                    className="flex flex-col"
                    style={{ gap: CELL_GAP }}
                  >
                    {week.map((cell, di) => (
                      <Tooltip key={di}>
                        <TooltipTrigger asChild>
                          <div
                            className="rounded-sm transition-transform hover:scale-125"
                            style={{
                              width: CELL_SIZE,
                              height: CELL_SIZE,
                              backgroundColor: cell
                                ? intensityColor(cell.count)
                                : "transparent",
                              cursor: cell ? "pointer" : "default",
                            }}
                          />
                        </TooltipTrigger>
                        {cell && (
                          <TooltipContent side="top">
                            <p>
                              {cell.date}: {cell.count}{" "}
                              {cell.count === 1 ? "activity" : "activities"}
                            </p>
                          </TooltipContent>
                        )}
                      </Tooltip>
                    ))}
                    {Array.from({ length: 7 - week.length }).map((_, pi) => (
                      <div
                        key={`pad-${pi}`}
                        style={{ width: CELL_SIZE, height: CELL_SIZE }}
                      />
                    ))}
                  </div>
                ))}
              </div>
            </TooltipProvider>
          </div>
        </div>

        {/* Legend */}
        <div className="mt-4 flex items-center justify-end gap-1">
          <span className="mr-1 text-[10px] text-muted-foreground">Less</span>
          {[0, 1, 2, 3, 4].map((v) => (
            <div
              key={v}
              className="rounded-sm"
              style={{
                width: 10,
                height: 10,
                backgroundColor: intensityColor(v),
              }}
            />
          ))}
          <span className="ml-1 text-[10px] text-muted-foreground">More</span>
        </div>
      </CardContent>
    </Card>
  );
}
