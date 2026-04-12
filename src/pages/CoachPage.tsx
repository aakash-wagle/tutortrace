import { useNavigate } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { BookOpen, Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useGamification } from "@/contexts/GamificationContext";
import { db } from "@/lib/db";
import { cn } from "@/lib/utils";

export default function CoachPage() {
  const navigate = useNavigate();
  const { userId, isLoaded } = useGamification();

  const assignments = useLiveQuery(
    () => userId
      ? db.assignments.where("userId").equals(userId).toArray()
      : undefined,
    [userId]
  );

  const courses = useLiveQuery(
    () => userId ? db.courses.where("userId").equals(userId).toArray() : undefined,
    [userId]
  );

  const courseMap = new Map((courses ?? []).map((c) => [c.id, c]));

  const now = new Date().toISOString();
  const upcomingAssignments = (assignments ?? [])
    .filter((a) => a.dueAt && a.dueAt >= now && a.workflowState === "published")
    .sort((a, b) => (a.dueAt ?? "").localeCompare(b.dueAt ?? ""));

  const isLoading = !isLoaded || assignments === undefined;

  return (
    <div>
      <div className="mb-0.5 flex items-center gap-2">
        <BookOpen className="h-7 w-7 text-foreground" />
        <h1 className="text-2xl font-bold tracking-tight">Assignment Coach</h1>
      </div>
      <p className="mb-6 text-sm text-muted-foreground">Select an assignment to get AI-powered guidance</p>

      {isLoading && [1, 2, 3, 4].map((i) => (
        <Card key={i} className="mb-3 border-2">
          <CardContent className="p-5">
            <Skeleton className="mb-1 h-5 w-1/2" />
            <Skeleton className="h-4 w-1/3" />
          </CardContent>
        </Card>
      ))}

      {upcomingAssignments.map((a) => {
        const course = courseMap.get(a.courseId);
        return (
          <Card
            key={a.id}
            className="mb-3 cursor-pointer border-2 transition-all hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-neo-sm"
            onClick={() => navigate(`/courses/${a.courseId}/assignments/${a.id}/coach`)}
          >
            <CardContent className="flex items-center gap-4 p-5">
              <div className="min-w-0 flex-1">
                <p className="mb-1.5 text-sm font-semibold leading-tight">{a.name}</p>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="border-0 bg-purple-700 text-white text-[11px]">
                    {course?.courseCode || "Course"}
                  </Badge>
                  {a.dueAt && (
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">
                        {new Date(a.dueAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </span>
                    </div>
                  )}
                  {a.pointsPossible > 0 && (
                    <span className="text-xs text-muted-foreground">{a.pointsPossible} pts</span>
                  )}
                </div>
              </div>
              <Button variant="outline" size="sm" className="flex-shrink-0 border-2">
                Open Coach
              </Button>
            </CardContent>
          </Card>
        );
      })}

      {!isLoading && upcomingAssignments.length === 0 && (
        <Card className="border-2 text-center">
          <CardContent className="p-8">
            <p className="text-sm text-muted-foreground">No upcoming assignments found. Check back later!</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
