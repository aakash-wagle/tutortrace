import { useParams, useNavigate } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { ArrowLeft, Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useGamification } from "@/contexts/GamificationContext";
import { db } from "@/lib/db";
import type { DexieAssignment } from "@/lib/db";

export default function CourseDetailPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const { userId, isLoaded } = useGamification();

  const course = useLiveQuery(
    () => courseId ? db.courses.get(parseInt(courseId, 10)) : undefined,
    [courseId]
  );

  const assignments = useLiveQuery(
    () => courseId
      ? db.assignments.where("courseId").equals(parseInt(courseId, 10)).toArray()
      : undefined,
    [courseId]
  );

  const isLoading = !isLoaded || assignments === undefined;
  const now = new Date().toISOString();

  const upcoming = (assignments ?? [])
    .filter((a) => a.dueAt && a.dueAt >= now && a.workflowState === "published")
    .sort((a, b) => (a.dueAt ?? "").localeCompare(b.dueAt ?? ""));

  const past = (assignments ?? [])
    .filter((a) => a.dueAt && a.dueAt < now && a.workflowState === "published")
    .sort((a, b) => (b.dueAt ?? "").localeCompare(a.dueAt ?? ""));

  const undated = (assignments ?? [])
    .filter((a) => !a.dueAt && a.workflowState === "published");

  const renderAssignment = (a: DexieAssignment) => {
    const isPast = a.dueAt ? a.dueAt < now : false;
    return (
      <Card key={a.id} className="mb-3 border-2">
        <CardContent className="flex items-center gap-3 p-4">
          <div className="min-w-0 flex-1">
            <p className="mb-1 text-sm font-semibold leading-tight">{a.name}</p>
            <div className="flex flex-wrap items-center gap-1.5">
              {a.dueAt && (
                <div className="flex items-center gap-1">
                  <Clock className={`h-3.5 w-3.5 ${isPast ? "text-destructive" : "text-muted-foreground"}`} />
                  <span className={`text-xs ${isPast ? "font-semibold text-destructive" : "text-muted-foreground"}`}>
                    {new Date(a.dueAt).toLocaleDateString("en-US", {
                      month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
                    })}
                  </span>
                </div>
              )}
              {a.pointsPossible > 0 && (
                <Badge className="h-5 border-0 bg-blue-100 text-[11px] text-blue-800">
                  {a.pointsPossible} pts
                </Badge>
              )}
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="flex-shrink-0 border-2"
            onClick={() => navigate(`/courses/${courseId}/assignments/${a.id}/coach`)}
          >
            Open Coach
          </Button>
        </CardContent>
      </Card>
    );
  };

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <button
          onClick={() => navigate("/courses")}
          className="rounded-lg p-1.5 transition-colors hover:bg-muted"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold leading-tight">{course?.name || "Course"}</h1>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            {course?.courseCode && <span>{course.courseCode}</span>}
          </div>
        </div>
      </div>

      {isLoading && [1, 2, 3].map((i) => (
        <Card key={i} className="mb-3 border-2">
          <CardContent className="p-4">
            <Skeleton className="mb-1 h-5 w-3/5" />
            <Skeleton className="h-4 w-1/3" />
          </CardContent>
        </Card>
      ))}

      {!isLoading && (
        <>
          {upcoming.length > 0 && (
            <div className="mb-5">
              <h2 className="mb-3 text-sm font-bold">Upcoming ({upcoming.length})</h2>
              {upcoming.map(renderAssignment)}
            </div>
          )}
          {past.length > 0 && (
            <div className="mb-5">
              <h2 className="mb-3 text-sm font-bold text-muted-foreground">Past ({past.length})</h2>
              {past.map(renderAssignment)}
            </div>
          )}
          {undated.length > 0 && (
            <div className="mb-5">
              <h2 className="mb-3 text-sm font-bold text-muted-foreground">No Due Date ({undated.length})</h2>
              {undated.map(renderAssignment)}
            </div>
          )}
          {assignments && assignments.length === 0 && (
            <Card className="border-2 text-center">
              <CardContent className="p-6">
                <p className="text-sm text-muted-foreground">No assignments found for this course.</p>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
