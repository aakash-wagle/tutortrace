import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { canvasApiFetch } from "@/lib/canvas";
import { getDemoAssignments } from "@/lib/demo";

export async function GET() {
  try {
    const session = await getSession();

    if (!session.sessionId || session.isDemo) {
      return NextResponse.json(getDemoAssignments());
    }

    // Fetch all active courses first
    const coursesRes = await canvasApiFetch(session.sessionId, "/courses", {
      enrollment_state: "active",
      per_page: "50",
    });

    if (!coursesRes.ok) {
      return NextResponse.json(getDemoAssignments());
    }

    const courses = (await coursesRes.json()) as {
      id: number;
      name: string;
      course_code: string;
    }[];

    // Fetch assignments from each course in parallel
    const assignmentPromises = courses.map(async (course) => {
      try {
        const res = await canvasApiFetch(
          session.sessionId!,
          `/courses/${course.id}/assignments`,
          { order_by: "due_at", per_page: "10" }
        );
        if (!res.ok) return [];
        const assignments = (await res.json()) as {
          id: number;
          name: string;
          due_at: string | null;
          points_possible: number;
          course_id: number;
          html_url: string;
          workflow_state: string;
          submission_types: string[];
          has_submitted_submissions: boolean;
        }[];
        return assignments
          .filter((a) => a.workflow_state === "published")
          .map((a) => ({
            ...a,
            course_name: course.name,
            course_code: course.course_code,
          }));
      } catch {
        return [];
      }
    });

    const allAssignments = (await Promise.all(assignmentPromises)).flat();

    // Sort by due date, put undated at end
    allAssignments.sort((a, b) => {
      if (!a.due_at && !b.due_at) return 0;
      if (!a.due_at) return 1;
      if (!b.due_at) return -1;
      return new Date(a.due_at).getTime() - new Date(b.due_at).getTime();
    });

    return NextResponse.json(allAssignments);
  } catch (error) {
    console.error("Dashboard assignments error:", error);
    return NextResponse.json(getDemoAssignments());
  }
}
