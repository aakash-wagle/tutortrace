import coursesData from "@/data/mocks/courses.json";
import assignmentsData from "@/data/mocks/assignments.json";
import activityData from "@/data/mocks/activity.json";
import announcementsData from "@/data/mocks/announcements.json";
import modulesData from "@/data/mocks/modules.json";

export function getDemoCourses() {
  return coursesData;
}

export function getDemoAssignments(courseId?: number) {
  if (courseId) {
    return assignmentsData.filter((a) => a.course_id === courseId);
  }
  return assignmentsData;
}

export function getDemoAssignment(assignmentId: number) {
  return assignmentsData.find((a) => a.id === assignmentId) || null;
}

export function getDemoActivity() {
  return activityData;
}

export function getDemoAnnouncements() {
  return announcementsData;
}

export function getDemoDueSoon() {
  return [
    {
      id: 5001,
      name: "Lab Report: Chemical Reactions",
      course_code: "Chemistry 201",
      due_at: "2024-02-28T23:59:00Z",
      status: "in_progress",
      course_id: 1001,
      assignment_id: 5001,
    },
    {
      id: 5002,
      name: "Essay: Renaissance Art Analysis",
      course_code: "Art History 105",
      due_at: "2024-03-02T23:59:00Z",
      status: "not_started",
      course_id: 1002,
      assignment_id: 5002,
    },
    {
      id: 5003,
      name: "Problem Set 8",
      course_code: "Calculus II",
      due_at: "2024-02-27T23:59:00Z",
      status: "missing",
      course_id: 1003,
      assignment_id: 5003,
    },
  ];
}

export function getDemoModules(courseId: string) {
  const modules = (modulesData as Record<string, unknown[]>)[courseId];
  return modules || [];
}

export function getDemoRecommendedStudy() {
  return [
    {
      title: "Review Cell Biology Basics",
      duration: "20 min",
      course: "Biology 101",
      image: null,
    },
    {
      title: "Practice Calculus Problems",
      duration: "35 min",
      course: "Calculus II",
      image: null,
    },
  ];
}
