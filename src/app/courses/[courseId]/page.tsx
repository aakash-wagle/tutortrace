"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { ArrowLeft, Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import ProgressRing from "@/components/ProgressRing";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface Assignment {
  id: number;
  name: string;
  due_at: string | null;
  points_possible: number;
  workflow_state?: string;
  has_submitted_submissions?: boolean;
  html_url?: string;
}

interface Enrollment {
  type: string;
  computed_current_score?: number | null;
  computed_current_grade?: string | null;
}

interface Course {
  id: number;
  name: string;
  course_code: string;
  term?: { name: string } | null;
  teachers?: { display_name: string }[];
  enrollments?: Enrollment[];
}

export default function CourseDetailPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = use(params);
  const router = useRouter();
  const { data: courses } = useSWR<Course[]>("/api/canvas/courses", fetcher);
  const { data: assignments, isLoading } = useSWR<Assignment[]>(
    `/api/canvas/courses/${courseId}/assignments`,
    fetcher
  );

  const course = courses?.find((c) => String(c.id) === courseId);
  const enrollment = course?.enrollments?.[0];
  const score = enrollment?.computed_current_score;
  const grade = enrollment?.computed_current_grade;
  const teacher = course?.teachers?.[0]?.display_name;
  const termName = typeof course?.term === "object" ? course?.term?.name : null;

  const now = new Date();
  const upcoming = assignments
    ?.filter((a) => a.due_at && new Date(a.due_at) >= now && a.workflow_state === "published")
    .sort((a, b) => new Date(a.due_at!).getTime() - new Date(b.due_at!).getTime()) || [];
  const past = assignments
    ?.filter((a) => a.due_at && new Date(a.due_at) < now && a.workflow_state === "published")
    .sort((a, b) => new Date(b.due_at!).getTime() - new Date(a.due_at!).getTime()) || [];
  const undated = assignments
    ?.filter((a) => !a.due_at && a.workflow_state === "published") || [];

  const renderAssignment = (a: Assignment) => {
    const isPast = a.due_at ? new Date(a.due_at) < now : false;
    return (
      <Card key={a.id} className="mb-3 border-2">
        <CardContent className="flex items-center gap-3 p-4">
          <div className="min-w-0 flex-1">
            <p className="mb-1 text-sm font-semibold leading-tight">{a.name}</p>
            <div className="flex flex-wrap items-center gap-1.5">
              {a.due_at && (
                <div className="flex items-center gap-1">
                  <Clock className={`h-3.5 w-3.5 ${isPast ? "text-destructive" : "text-muted-foreground"}`} />
                  <span className={`text-xs ${isPast ? "font-semibold text-destructive" : "text-muted-foreground"}`}>
                    {new Date(a.due_at).toLocaleDateString("en-US", {
                      month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
                    })}
                  </span>
                </div>
              )}
              {a.points_possible > 0 && (
                <Badge className="h-5 border-0 bg-blue-100 text-[11px] text-blue-800">
                  {a.points_possible} pts
                </Badge>
              )}
              {a.has_submitted_submissions && (
                <Badge className="h-5 border-0 bg-green-100 text-[11px] text-green-800">
                  Submitted
                </Badge>
              )}
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="flex-shrink-0 border-2"
            onClick={() => router.push(`/courses/${courseId}/assignments/${a.id}/coach`)}
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
          onClick={() => router.push("/courses")}
          className="rounded-lg p-1.5 transition-colors hover:bg-muted"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold leading-tight">{course?.name || "Course"}</h1>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            {course?.course_code && <span>{course.course_code}</span>}
            {teacher && <span>· {teacher}</span>}
            {termName && <span>· {termName}</span>}
          </div>
        </div>
        {score != null && (
          <div className="flex-shrink-0 text-center">
            <ProgressRing value={score} size={64} />
            {grade && <p className="mt-0.5 text-xs font-semibold">{grade}</p>}
          </div>
        )}
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
