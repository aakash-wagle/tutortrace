import { useState, useEffect } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { canvasApiFetch } from "@/lib/canvas";

// ── Dexie-backed Hooks ──────────────────────────────────────────────────────

export function useCourses() {
  const data = useLiveQuery(() => db.courses.toArray());
  return { data, error: null, isLoading: data === undefined };
}

export function useAssignments(courseId?: string | number | null) {
  const data = useLiveQuery(
    () => (courseId ? db.assignments.where({ courseId: Number(courseId) }).toArray() : []),
    [courseId]
  );
  return { data, error: null, isLoading: data === undefined && courseId != null };
}

export function useAssignment(courseId: string | number, assignmentId: string | number) {
  const data = useLiveQuery(
    () => (assignmentId ? db.assignments.get(Number(assignmentId)) : undefined),
    [assignmentId]
  );
  return { data, error: null, isLoading: data === undefined && assignmentId != null };
}

export function useDashboardAssignments() {
  const data = useLiveQuery(() => db.assignments.toArray());
  return { data, error: null, isLoading: data === undefined };
}

// ── Live Canvas Hooks (for data not synced to Dexie) ────────────────────────

function useCanvasEndpoint(path: string | null) {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<any>(null);
  const user = useLiveQuery(() => db.users.toCollection().first());

  useEffect(() => {
    if (!path || !user) return;
    setData(null);
    setError(null);
    canvasApiFetch(user.id, path)
      .then((res) => {
        if (!res.ok) throw new Error("Canvas API Error");
        return res.json();
      })
      .then(setData)
      .catch(setError);
  }, [path, user?.id]);

  return { data, error, isLoading: !data && !error && path != null };
}

export function useActivity(courseId: string | number) {
  return useCanvasEndpoint(courseId ? `/courses/${courseId}/activity_stream` : null);
}

export function useAnnouncements(courseId: string | number) {
  return useCanvasEndpoint(
    courseId ? `/courses/${courseId}/discussion_topics?only_announcements=true` : null
  );
}

export function useTodo() {
  return useCanvasEndpoint("/users/self/todo");
}

export function useUpcomingEvents() {
  return useCanvasEndpoint("/users/self/upcoming_events");
}

export function useCalendarEvents(startDate?: string, endDate?: string) {
  const query = startDate && endDate ? `?start_date=${startDate}&end_date=${endDate}` : "";
  return useCanvasEndpoint(query ? `/calendar_events${query}` : null);
}

export function useGrades() {
  return useCanvasEndpoint("/users/self/enrollments");
}

export function useConversations() {
  return useCanvasEndpoint("/conversations");
}

export function useConversation(id: string | number | null) {
  return useCanvasEndpoint(id ? `/conversations/${id}` : null);
}

export function useGlobalActivity() {
  return useCanvasEndpoint("/users/self/activity_stream");
}
