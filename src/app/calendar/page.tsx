"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { CalendarDays, ChevronLeft, ChevronRight, Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const courseColors = ["#7B1FA2", "#00838F", "#1565C0", "#2E7D32", "#E65100", "#AD1457", "#4527A0", "#00695C"];

function getCourseColor(contextCode: string): string {
  const num = parseInt(contextCode.replace(/\D/g, ""), 10) || 0;
  return courseColors[Math.abs(num) % courseColors.length];
}

interface CalendarEvent {
  id: string | number;
  title: string;
  start_at?: string;
  end_at?: string;
  all_day?: boolean;
  all_day_date?: string;
  type: string;
  context_name?: string;
  context_code?: string;
  html_url?: string;
  assignment?: {
    id: number;
    name: string;
    due_at: string | null;
    points_possible: number;
    course_id: number;
  };
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

export default function CalendarPage() {
  const router = useRouter();
  const now = new Date();
  const [currentMonth, setCurrentMonth] = useState(now.getMonth());
  const [currentYear, setCurrentYear] = useState(now.getFullYear());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const startDate = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-01`;
  const endDate = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-${getDaysInMonth(currentYear, currentMonth)}`;

  const { data: events, isLoading } = useSWR<CalendarEvent[]>(
    `/api/canvas/calendar?start_date=${startDate}&end_date=${endDate}`,
    fetcher
  );

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    events?.forEach((ev) => {
      let dateStr: string | null = null;
      if (ev.type === "assignment" && ev.assignment?.due_at) {
        dateStr = ev.assignment.due_at.split("T")[0];
      } else if (ev.start_at) {
        dateStr = ev.start_at.split("T")[0];
      } else if (ev.all_day_date) {
        dateStr = ev.all_day_date;
      }
      if (dateStr) {
        const existing = map.get(dateStr) || [];
        existing.push(ev);
        map.set(dateStr, existing);
      }
    });
    return map;
  }, [events]);

  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  const firstDay = getFirstDayOfMonth(currentYear, currentMonth);
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  const prevMonth = () => {
    if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear(currentYear - 1); }
    else setCurrentMonth(currentMonth - 1);
    setSelectedDate(null);
  };

  const nextMonth = () => {
    if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear(currentYear + 1); }
    else setCurrentMonth(currentMonth + 1);
    setSelectedDate(null);
  };

  const selectedEvents = selectedDate ? (eventsByDate.get(selectedDate) || []) : [];

  return (
    <div>
      <div className="mb-0.5 flex items-center gap-2">
        <CalendarDays className="h-7 w-7 text-foreground" />
        <h1 className="text-2xl font-bold tracking-tight">Calendar</h1>
      </div>
      <p className="mb-6 text-sm text-muted-foreground">Your assignments and events from Canvas</p>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[2fr_1fr]">
        {/* Calendar grid */}
        <Card className="border-2">
          <CardContent className="p-5">
            <div className="mb-4 flex items-center justify-between">
              <button
                onClick={prevMonth}
                className="rounded-lg p-1.5 transition-colors hover:bg-muted"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <h2 className="text-base font-bold">{MONTHS[currentMonth]} {currentYear}</h2>
              <button
                onClick={nextMonth}
                className="rounded-lg p-1.5 transition-colors hover:bg-muted"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>

            {isLoading ? (
              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: 35 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 rounded-lg" />
                ))}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-7">
                  {WEEKDAYS.map((d) => (
                    <div key={d} className="py-1 text-center">
                      <span className="text-[11px] font-semibold text-muted-foreground">{d}</span>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-7">
                  {Array.from({ length: firstDay }).map((_, i) => (
                    <div key={`empty-${i}`} className="p-1" />
                  ))}
                  {Array.from({ length: daysInMonth }).map((_, i) => {
                    const day = i + 1;
                    const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                    const dayEvents = eventsByDate.get(dateStr) || [];
                    const isToday = dateStr === todayStr;
                    const isSelected = dateStr === selectedDate;

                    return (
                      <div
                        key={day}
                        onClick={() => setSelectedDate(dateStr)}
                        className={`min-h-[64px] cursor-pointer rounded-lg p-1 transition-all ${
                          isSelected
                            ? "border-2 border-foreground bg-muted"
                            : isToday
                            ? "border-2 border-accent bg-accent/10"
                            : "border border-transparent hover:bg-muted/50"
                        }`}
                      >
                        <p className={`mb-0.5 text-[13px] ${isToday ? "font-bold text-accent" : "font-normal"}`}>
                          {day}
                        </p>
                        {dayEvents.slice(0, 2).map((ev, idx) => (
                          <div
                            key={idx}
                            className="mb-0.5 truncate rounded px-1 py-0.5"
                            style={{ backgroundColor: getCourseColor(ev.context_code || "") }}
                          >
                            <span className="truncate text-[10px] leading-tight text-white">{ev.title}</span>
                          </div>
                        ))}
                        {dayEvents.length > 2 && (
                          <span className="text-[10px] text-muted-foreground">+{dayEvents.length - 2} more</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Event details panel */}
        <Card className="border-2">
          <CardContent className="p-5">
            <h2 className="mb-4 text-base font-bold">
              {selectedDate
                ? new Date(selectedDate + "T12:00:00").toLocaleDateString("en-US", {
                    weekday: "long", month: "long", day: "numeric",
                  })
                : "Select a date"}
            </h2>

            {!selectedDate && (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Click on a date to see its events and assignments.
              </p>
            )}

            {selectedDate && selectedEvents.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No events on this date.
              </p>
            )}

            {selectedEvents.map((ev) => {
              const isAssignment = ev.type === "assignment" && ev.assignment;
              const dueTime = isAssignment && ev.assignment?.due_at
                ? new Date(ev.assignment.due_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
                : ev.start_at
                  ? new Date(ev.start_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
                  : null;

              return (
                <div
                  key={ev.id}
                  onClick={() => {
                    if (isAssignment && ev.assignment) {
                      router.push(`/courses/${ev.assignment.course_id}/assignments/${ev.assignment.id}/coach`);
                    }
                  }}
                  className={`mb-3 rounded-xl bg-muted p-3 ${isAssignment ? "cursor-pointer hover:bg-muted/80" : ""}`}
                >
                  <div className="mb-1.5 flex items-center gap-2">
                    <Badge
                      className={`h-5 border-0 text-[11px] ${
                        isAssignment ? "bg-blue-100 text-blue-800" : "bg-purple-100 text-purple-800"
                      }`}
                    >
                      {isAssignment ? "Assignment" : "Event"}
                    </Badge>
                    {ev.assignment?.points_possible != null && ev.assignment.points_possible > 0 && (
                      <span className="text-xs text-muted-foreground">{ev.assignment.points_possible} pts</span>
                    )}
                  </div>
                  <p className="text-sm font-semibold leading-tight">{ev.title}</p>
                  {ev.context_name && (
                    <p className="mt-0.5 text-xs text-muted-foreground">{ev.context_name}</p>
                  )}
                  {dueTime && (
                    <div className="mt-1 flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">{dueTime}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
