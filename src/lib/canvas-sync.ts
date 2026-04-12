import { db } from "./dexie";

// ── Hydrate Dexie from Canvas API ─────────────────────────────────────────────
// Called after login; runs in background (fire-and-forget from caller)

export async function syncCanvasDataToDexie(userId: string): Promise<void> {
  try {
    // 1. Fetch courses
    const coursesRes = await fetch("/api/canvas/courses");
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

    // 2. Fetch assignments for each course (limit to first 10 courses for speed)
    const activeCourses = courses.slice(0, 10);
    await Promise.allSettled(
      activeCourses.map(async (course) => {
        try {
          const res = await fetch(
            `/api/canvas/courses/${course.id}/assignments`
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
          // Skip individual course failures
        }
      })
    );

    // 3. Update user record
    await db.users.put({
      id: userId,
      displayName: "",
      updatedAt: Date.now(),
    });
  } catch {
    // Background sync — swallow errors silently
  }
}

// ── Minimal Canvas type shapes (only fields we use) ───────────────────────────

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
