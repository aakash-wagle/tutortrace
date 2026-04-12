import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { ClipboardList, CalendarDays, Bell, Clock, GraduationCap } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AnimatedCardList, AnimatedCard } from "@/components/AnimatedCardList";
import { StudyOwl } from "@/components/StudyOwl";
import { useGamification } from "@/contexts/GamificationContext";
import { syncCanvasDataToDexie } from "@/lib/canvas-sync";
import { db } from "@/lib/db";
import { cn } from "@/lib/utils";

const courseColors = [
  "#7B1FA2","#00838F","#1565C0","#2E7D32",
  "#E65100","#AD1457","#4527A0","#00695C",
];

function getCourseColor(courseId: number | string): string {
  const idx = typeof courseId === "number" ? courseId : parseInt(String(courseId), 10);
  return courseColors[Math.abs(idx) % courseColors.length];
}

function formatDue(dateStr: string | null): string {
  if (!dateStr) return "No due date";
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = d.getTime() - now.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  if (diffMs < 0) return "Past due";
  if (diffHours < 24) {
    const h = Math.floor(diffHours);
    return h <= 1 ? "Due in less than an hour" : `Due in ${h} hours`;
  }
  if (diffDays < 7) {
    return `Due ${d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}`;
  }
  return `Due ${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
}

function timeAgo(ts: number): string {
  const now = Date.now();
  const diffMs = now - ts;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 60) return `${Math.max(0, mins)}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function TodayPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { unlockBadge, logActivity, userId, isLoaded } = useGamification();

  useEffect(() => {
    if (searchParams.get("firstLogin") === "true" && userId) {
      unlockBadge("first_login");
      logActivity("login");
      syncCanvasDataToDexie(userId);
      const next = new URLSearchParams(searchParams);
      next.delete("firstLogin");
      setSearchParams(next, { replace: true });
    }
  }, [userId, searchParams, unlockBadge, logActivity, setSearchParams]);

  const now = new Date().toISOString();

  const assignments = useLiveQuery(
    () => userId
      ? db.assignments
          .where("userId").equals(userId)
          .toArray()
      : [],
    [userId]
  );

  const courses = useLiveQuery(
    () => userId
      ? db.courses.where("userId").equals(userId).toArray()
      : [],
    [userId]
  );

  const recentActivity = useLiveQuery(
    () => userId
      ? db.activityLog.where("userId").equals(userId).reverse().limit(8).toArray()
      : [],
    [userId]
  );

  const courseMap = new Map((courses ?? []).map((c) => [c.id, c]));

  const upcomingAssignments = (assignments ?? [])
    .filter((a) => a.dueAt && a.dueAt > now && a.workflowState === "published")
    .sort((a, b) => (a.dueAt ?? "").localeCompare(b.dueAt ?? ""))
    .slice(0, 6);

  const isLoading = !isLoaded || assignments === undefined;

  const activityBg: Record<string, string> = {
    login: "bg-green-100",
    assignment_view: "bg-blue-100",
    flashcard_study: "bg-purple-100",
    achievements_view: "bg-yellow-100",
  };

  return (
    <div>
      {/* Top 3-column grid */}
      <div className="mb-5 grid grid-cols-1 gap-5 lg:grid-cols-[1fr_1fr_340px]">

        {/* Due Soon */}
        <Card className="border-2 shadow-neo-sm">
          <CardContent className="p-5">
            <div className="mb-4 flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-foreground" />
              <h2 className="text-base font-bold">Due Soon</h2>
              {upcomingAssignments.length > 0 && (
                <Badge className="ml-auto bg-blue-100 text-blue-800 font-semibold text-xs border-0">
                  {upcomingAssignments.length}
                </Badge>
              )}
            </div>

            {isLoading && [1, 2, 3].map((i) => (
              <div key={i} className="mb-4 space-y-1">
                <Skeleton className="h-5 w-4/5" />
                <Skeleton className="h-4 w-2/5" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            ))}

            {!isLoading && upcomingAssignments.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No upcoming assignments. You&apos;re all caught up!
              </p>
            )}

            <AnimatedCardList>
              {upcomingAssignments.map((a, i) => {
                const course = courseMap.get(a.courseId);
                const dueText = formatDue(a.dueAt);
                const isPastDue = dueText === "Past due";

                return (
                  <AnimatedCard key={a.id}>
                    <div
                      onClick={() => navigate(`/courses/${a.courseId}/assignments/${a.id}/coach`)}
                      className={cn(
                        "-mx-1 cursor-pointer rounded-xl p-3 transition-colors hover:bg-muted",
                        i < upcomingAssignments.length - 1 && "mb-3 border-b border-border/30 pb-3"
                      )}
                    >
                      <p className="mb-1.5 text-sm font-semibold leading-tight">{a.name}</p>
                      <div className="mb-1 flex flex-wrap items-center gap-1.5">
                        <Badge
                          className="h-5 border-0 text-[11px] font-medium text-white"
                          style={{ backgroundColor: getCourseColor(a.courseId) }}
                        >
                          {course?.courseCode || `Course ${a.courseId}`}
                        </Badge>
                        {a.pointsPossible > 0 && (
                          <Badge className="h-5 border-0 bg-blue-100 text-blue-800 text-[11px]">
                            {a.pointsPossible} pts
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className={cn("h-3 w-3", isPastDue ? "text-destructive" : "text-muted-foreground")} />
                        <span className={cn("text-xs", isPastDue ? "font-semibold text-destructive" : "text-muted-foreground")}>
                          {dueText}
                        </span>
                      </div>
                    </div>
                  </AnimatedCard>
                );
              })}
            </AnimatedCardList>

            {upcomingAssignments.length > 0 && (
              <Button className="mt-4 w-full" onClick={() => navigate("/coach")}>
                Open Assignment Coach
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="border-2 shadow-neo-sm">
          <CardContent className="p-5">
            <div className="mb-4 flex items-center gap-2">
              <Bell className="h-5 w-5 text-foreground" />
              <h2 className="text-base font-bold">Recent Activity</h2>
            </div>

            {isLoading && [1, 2, 3, 4].map((i) => (
              <div key={i} className="mb-4 flex gap-3">
                <Skeleton className="h-9 w-9 flex-shrink-0 rounded-lg" />
                <div className="flex-1 space-y-1">
                  <Skeleton className="h-4 w-4/5" />
                  <Skeleton className="h-3 w-2/5" />
                </div>
              </div>
            ))}

            {!isLoading && (recentActivity ?? []).length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No recent activity to show.
              </p>
            )}

            <AnimatedCardList>
              {(recentActivity ?? []).map((item) => {
                const bg = activityBg[item.activityType] || "bg-purple-100";
                return (
                  <AnimatedCard key={item.id}>
                    <div className="mb-4 flex gap-3">
                      <div className={cn("flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg", bg)}>
                        <ClipboardList className="h-4 w-4 text-foreground/70" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold leading-tight capitalize">
                          {item.activityType.replace(/_/g, " ")}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {item.bloomLevel || item.activityType} · {timeAgo(item.xpEarned)}
                        </p>
                        <p className="text-[11px] text-muted-foreground">{item.date}</p>
                      </div>
                    </div>
                  </AnimatedCard>
                );
              })}
            </AnimatedCardList>
          </CardContent>
        </Card>

        {/* Upcoming Events (from assignments) */}
        <Card className="border-2 shadow-neo-sm">
          <CardContent className="p-5">
            <div className="mb-4 flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-foreground" />
              <h2 className="text-base font-bold">This Week</h2>
            </div>

            {isLoading && [1, 2, 3].map((i) => (
              <div key={i} className="mb-3 space-y-1">
                <Skeleton className="h-4 w-4/5" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            ))}

            {!isLoading && upcomingAssignments.length === 0 && (
              <p className="py-4 text-center text-sm text-muted-foreground">
                No upcoming events this week.
              </p>
            )}

            {upcomingAssignments.slice(0, 5).map((a, i) => {
              const dateStr = a.dueAt
                ? new Date(a.dueAt).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
                : "TBD";
              return (
                <div
                  key={a.id}
                  className={cn("rounded-xl bg-muted p-3", i < upcomingAssignments.length - 1 && "mb-3")}
                >
                  <p className="text-sm font-semibold leading-tight">{a.name}</p>
                  <p className="text-[11px] text-muted-foreground">{dateStr}</p>
                  {courseMap.get(a.courseId) && (
                    <p className="text-[11px] text-muted-foreground/70">
                      {courseMap.get(a.courseId)?.courseCode}
                    </p>
                  )}
                </div>
              );
            })}

            <Button variant="outline" className="mt-4 w-full border-2" onClick={() => navigate("/calendar")}>
              View Full Calendar
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {/* Quick Actions */}
        <Card className="border-2 shadow-neo-sm">
          <CardContent className="p-5">
            <h2 className="mb-4 text-base font-bold">Quick Actions</h2>
            <div className="grid grid-cols-2 gap-3">
              <Button variant="outline" className="border-2 py-5" onClick={() => navigate("/courses")}>
                My Courses
              </Button>
              <Button variant="outline" className="border-2 py-5" onClick={() => navigate("/grades")}>
                View Grades
              </Button>
              <Button variant="outline" className="border-2 py-5" onClick={() => navigate("/flashcards")}>
                Flashcards
              </Button>
              <Button variant="outline" className="border-2 py-5" onClick={() => navigate("/messages")}>
                Messages
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* My Courses */}
        <Card className="border-2 shadow-neo-sm">
          <CardContent className="p-5">
            <h2 className="mb-4 text-base font-bold">My Courses</h2>
            {!courses && [1, 2, 3].map((i) => (
              <Skeleton key={i} className="mb-2 h-5 w-4/5" />
            ))}
            {(courses ?? []).slice(0, 5).map((c) => (
              <div
                key={c.id}
                onClick={() => navigate(`/courses/${c.id}`)}
                className="mb-1 flex cursor-pointer items-center gap-3 rounded-lg p-2 transition-colors hover:bg-muted"
              >
                <GraduationCap className="h-4 w-4 flex-shrink-0" style={{ color: getCourseColor(c.id) }} />
                <p className="min-w-0 flex-1 truncate text-sm font-semibold">
                  {c.courseCode || c.name}
                </p>
              </div>
            ))}
            {courses && courses.length > 5 && (
              <Button variant="ghost" size="sm" className="mt-1 text-xs" onClick={() => navigate("/courses")}>
                View all {courses.length} courses
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      {/* StudyOwl mascot */}
      <div className="pointer-events-none fixed bottom-6 right-6 z-[1200]">
        <StudyOwl mood="default" size="sm" />
      </div>
    </div>
  );
}
