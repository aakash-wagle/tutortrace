"use client";

import { useRouter } from "next/navigation";
import useSWR from "swr";
import { User, Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import ProgressRing from "@/components/ProgressRing";
import { AnimatedCardList, AnimatedCard } from "@/components/AnimatedCardList";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const courseColors = ["#7B1FA2","#00838F","#1565C0","#2E7D32","#E65100","#AD1457","#4527A0","#00695C"];
const bannerGradients = [
  "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
  "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
  "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
  "linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)",
  "linear-gradient(135deg, #fa709a 0%, #fee140 100%)",
  "linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)",
  "linear-gradient(135deg, #5ee7df 0%, #b490ca 100%)",
  "linear-gradient(135deg, #c3cfe2 0%, #f5f7fa 100%)",
];

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
  workflow_state: string;
}

export default function CoursesPage() {
  const router = useRouter();
  const { data: courses, isLoading } = useSWR<Course[]>("/api/canvas/courses", fetcher);

  const activeCourses = courses || [];

  return (
    <div>
      <h1 className="mb-0.5 text-2xl font-bold tracking-tight">My Courses</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        {isLoading ? "Loading..." : `${activeCourses.length} Active Course${activeCourses.length !== 1 ? "s" : ""}`}
      </p>

      {isLoading && (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="overflow-hidden border-2">
              <Skeleton className="h-24 w-full rounded-none" />
              <CardContent className="p-5">
                <Skeleton className="mb-1 h-5 w-2/5" />
                <Skeleton className="mb-1 h-6 w-4/5" />
                <Skeleton className="mb-4 h-4 w-1/2" />
                <Skeleton className="h-10 rounded-xl" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AnimatedCardList>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          {activeCourses.map((course, i) => {
            const enrollment = course.enrollments?.[0];
            const score = enrollment?.computed_current_score;
            const grade = enrollment?.computed_current_grade;
            const role = enrollment?.type || "student";
            const isTeacher = role === "teacher" || role === "ta";
            const termName = typeof course.term === "object" && course.term?.name ? course.term.name : null;
            const teacher = course.teachers?.[0]?.display_name;

            return (
              <AnimatedCard key={course.id}>
                <Card className="overflow-hidden border-2 shadow-neo-sm transition-transform hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-neo">
                  {/* Banner */}
                  <div
                    className="relative flex h-20 items-end p-3"
                    style={{ background: bannerGradients[i % bannerGradients.length] }}
                  >
                    {isTeacher && (
                      <Badge className="bg-white/90 text-foreground font-semibold text-xs border-0">
                        {role === "teacher" ? "Instructor" : "TA"}
                      </Badge>
                    )}
                  </div>

                  <CardContent className="p-5">
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <Badge
                          className="mb-2 max-w-full truncate border-0 text-white text-[11px] font-semibold"
                          style={{ backgroundColor: courseColors[i % courseColors.length] }}
                        >
                          {course.course_code}
                        </Badge>
                        <h3 className="text-base font-bold leading-tight">{course.name}</h3>
                      </div>
                      {score != null && !isTeacher && <ProgressRing value={score} />}
                    </div>

                    {teacher && (
                      <div className="mb-1 flex items-center gap-1">
                        <User className="h-3.5 w-3.5 text-muted-foreground" />
                        <p className="text-xs text-muted-foreground">{teacher}</p>
                      </div>
                    )}

                    <div className="mb-4 flex flex-wrap items-center gap-2">
                      {termName && (
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">{termName}</span>
                        </div>
                      )}
                      {grade && (
                        <Badge variant="outline" className="border-green-300 bg-green-50 text-green-800 text-xs font-semibold">
                          {grade}
                        </Badge>
                      )}
                    </div>

                    <Button className="w-full" onClick={() => router.push(`/courses/${course.id}`)}>
                      Open Course
                    </Button>
                  </CardContent>
                </Card>
              </AnimatedCard>
            );
          })}
        </div>
      </AnimatedCardList>

      {!isLoading && activeCourses.length === 0 && (
        <Card className="border-2 text-center">
          <CardContent className="p-10">
            <h3 className="mb-1 text-base font-bold">No courses found</h3>
            <p className="text-sm text-muted-foreground">
              Connect your Canvas account to see your courses here.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
