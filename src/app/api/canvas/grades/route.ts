import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { canvasApiFetchMultiParam } from "@/lib/canvas";

export async function GET() {
  try {
    const session = await getSession();

    if (!session.sessionId || session.isDemo) {
      return NextResponse.json([]);
    }

    const params = new URLSearchParams();
    params.append("enrollment_state", "active");
    params.append("enrollment_type", "student");
    params.append("include[]", "total_scores");
    params.append("include[]", "current_grading_period_scores");
    params.append("include[]", "term");
    params.append("per_page", "50");

    const res = await canvasApiFetchMultiParam(session.sessionId, "/courses", params);

    if (!res.ok) {
      return NextResponse.json([]);
    }

    const courses = (await res.json()) as {
      id: number;
      name: string;
      course_code: string;
      enrollments?: {
        type: string;
        computed_current_score: number | null;
        computed_final_score: number | null;
        computed_current_grade: string | null;
        computed_final_grade: string | null;
      }[];
      term?: { name: string };
      hide_final_grades?: boolean;
    }[];

    const gradesData = courses.map((c) => {
      const studentEnrollment = c.enrollments?.find((e) => e.type === "student");
      return {
        id: c.id,
        name: c.name,
        course_code: c.course_code,
        term: c.term?.name || null,
        current_score: studentEnrollment?.computed_current_score ?? null,
        final_score: studentEnrollment?.computed_final_score ?? null,
        current_grade: studentEnrollment?.computed_current_grade ?? null,
        final_grade: studentEnrollment?.computed_final_grade ?? null,
        hide_final_grades: c.hide_final_grades || false,
      };
    });

    return NextResponse.json(gradesData);
  } catch (error) {
    console.error("Grades fetch error:", error);
    return NextResponse.json([]);
  }
}
