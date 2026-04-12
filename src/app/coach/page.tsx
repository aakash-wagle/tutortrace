"use client";

import { useRouter } from "next/navigation";
import useSWR from "swr";
import { BookOpen, Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface Course { id: number; name: string; course_code: string }
interface Assignment {
  id: number;
  course_id: number;
  name: string;
  due_at: string | null;
  points_possible: number;
  course_name?: string;
  course_code?: string;
  status?: string;
}

export default function CoachLandingPage() {
  const router = useRouter();
  const { data: courses } = useSWR<Course[]>("/api/canvas/courses", fetcher);
  const { data: allAssignments, isLoading } = useSWR<Assignment[]>("/api/dashboard/assignments", fetcher);

  const assignments = allAssignments || [];

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

      {assignments.map((a) => {
        const course = courses?.find((c) => c.id === a.course_id);
        return (
          <Card
            key={a.id}
            className="mb-3 cursor-pointer border-2 transition-all hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-neo-sm"
            onClick={() => router.push(`/courses/${a.course_id}/assignments/${a.id}/coach`)}
          >
            <CardContent className="flex items-center gap-4 p-5">
              <div className="min-w-0 flex-1">
                <p className="mb-1.5 text-sm font-semibold leading-tight">{a.name}</p>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="border-0 bg-purple-700 text-white text-[11px]">
                    {course?.course_code || a.course_code || "Course"}
                  </Badge>
                  {a.due_at && (
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">
                        {new Date(a.due_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </span>
                    </div>
                  )}
                  {a.points_possible > 0 && (
                    <span className="text-xs text-muted-foreground">{a.points_possible} pts</span>
                  )}
                  {a.status && (
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[11px] font-medium",
                        a.status === "missing"
                          ? "border-red-300 bg-red-50 text-red-800"
                          : "border-blue-300 bg-blue-50 text-blue-800"
                      )}
                    >
                      {a.status.replace("_", " ")}
                    </Badge>
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

      {!isLoading && assignments.length === 0 && (
        <Card className="border-2 text-center">
          <CardContent className="p-8">
            <p className="text-sm text-muted-foreground">No upcoming assignments found. Check back later!</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
