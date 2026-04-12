import { db } from "./db";
import { canvasApiFetch } from "./canvas";
import {
  getDemoCourses,
  getDemoAssignments,
} from "./demo";

// ── Minimal Canvas type shapes ────────────────────────────────────────────────

interface CanvasCourse {
  id: number;
  name: string;
  course_code?: string;
  enrollments?: { type: string }[];
}

interface CanvasAssignment {
  id: number;
  name: string;
  due_at?: string | null;
  points_possible?: number;
  workflow_state?: string;
  html_url?: string;
}

// ── Hydrate Dexie from Canvas API (or demo data) ──────────────────────────────
// Called after login; fire-and-forget from the caller.

export async function syncCanvasDataToDexie(userId: string): Promise<void> {
  try {
    const user = await db.users.get(userId);
    if (!user) return;

    if (user.isDemo) {
      // Load mock data for demo mode
      const demoCourses = getDemoCourses();
      await db.courses.bulkPut(
        demoCourses.map((c: CanvasCourse) => ({
          id: c.id,
          userId,
          name: c.name,
          courseCode: c.course_code ?? "",
          enrollmentType: c.enrollments?.[0]?.type,
          updatedAt: Date.now(),
        }))
      );

      const demoAssignments = getDemoAssignments();
      await db.assignments.bulkPut(
        demoAssignments.map((a: CanvasAssignment & { course_id?: number }) => ({
          id: a.id,
          courseId: a.course_id ?? demoCourses[0]?.id ?? 0,
          userId,
          name: a.name,
          dueAt: a.due_at ?? null,
          pointsPossible: a.points_possible ?? 0,
          workflowState: a.workflow_state ?? "published",
          htmlUrl: a.html_url,
          updatedAt: Date.now(),
        }))
      );
      return;
    }

    // 1. Fetch courses via proxy
    const coursesRes = await canvasApiFetch(userId, "/courses", {
      enrollment_state: "active",
      per_page: "50",
    });
    if (!coursesRes.ok) return;
    const courses: CanvasCourse[] = await coursesRes.json();

    await db.courses.bulkPut(
      courses.map((c) => ({
        id: c.id,
        userId,
        name: c.name,
        courseCode: c.course_code ?? "",
        enrollmentType: c.enrollments?.[0]?.type,
        updatedAt: Date.now(),
      }))
    );

    // 2. Fetch assignments for each course (limit to first 10 for speed)
    const activeCourses = courses.slice(0, 10);
    await Promise.allSettled(
      activeCourses.map(async (course) => {
        try {
          const res = await canvasApiFetch(
            userId,
            `/courses/${course.id}/assignments`,
            { per_page: "50" }
          );
          if (!res.ok) return;
          const assignments: CanvasAssignment[] = await res.json();
          await db.assignments.bulkPut(
            assignments.map((a) => ({
              id: a.id,
              courseId: course.id,
              userId,
              name: a.name,
              dueAt: a.due_at ?? null,
              pointsPossible: a.points_possible ?? 0,
              workflowState: a.workflow_state ?? "unpublished",
              htmlUrl: a.html_url,
              updatedAt: Date.now(),
            }))
          );
        } catch {
          // Skip individual course failures silently
        }
      })
    );
  } catch {
    // Background sync — swallow errors silently
  }
}
