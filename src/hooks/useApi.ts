"use client";

import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function useCourses() {
  return useSWR("/api/canvas/courses", fetcher);
}

export function useAssignments(courseId: string | number) {
  return useSWR(
    courseId ? `/api/canvas/courses/${courseId}/assignments` : null,
    fetcher
  );
}

export function useAssignment(courseId: string | number, assignmentId: string | number) {
  return useSWR(
    courseId && assignmentId
      ? `/api/canvas/courses/${courseId}/assignments/${assignmentId}`
      : null,
    fetcher
  );
}

export function useActivity(courseId: string | number) {
  return useSWR(
    courseId ? `/api/canvas/courses/${courseId}/activity` : null,
    fetcher
  );
}

export function useAnnouncements(courseId: string | number) {
  return useSWR(
    courseId ? `/api/canvas/courses/${courseId}/announcements` : null,
    fetcher
  );
}

export function useTodo() {
  return useSWR("/api/canvas/todo", fetcher);
}

export function useUpcomingEvents() {
  return useSWR("/api/canvas/upcoming", fetcher);
}

export function useCalendarEvents(startDate?: string, endDate?: string) {
  const params = new URLSearchParams();
  if (startDate) params.set("start_date", startDate);
  if (endDate) params.set("end_date", endDate);
  const qs = params.toString();
  return useSWR(`/api/canvas/calendar${qs ? `?${qs}` : ""}`, fetcher);
}

export function useGrades() {
  return useSWR("/api/canvas/grades", fetcher);
}

export function useConversations() {
  return useSWR("/api/canvas/conversations", fetcher);
}

export function useConversation(id: string | number | null) {
  return useSWR(
    id ? `/api/canvas/conversations/${id}` : null,
    fetcher
  );
}

export function useGlobalActivity() {
  return useSWR("/api/canvas/activity", fetcher);
}

export function useDashboardAssignments() {
  return useSWR("/api/dashboard/assignments", fetcher);
}
