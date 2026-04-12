import { lazy, Suspense } from "react";
import { Navigate, Outlet, RouteObject } from "react-router-dom";
import AppShell from "@/components/AppShell";
import { DashboardCardSkeleton as CardSkeleton } from "@/components/CardSkeleton";

// Lazy-load all pages for code splitting
const ConnectPage = lazy(() => import("@/pages/ConnectPage"));
const CanvasCallbackPage = lazy(() => import("@/pages/CanvasCallbackPage"));
const TodayPage = lazy(() => import("@/pages/TodayPage"));
const CoursesPage = lazy(() => import("@/pages/CoursesPage"));
const CourseDetailPage = lazy(() => import("@/pages/CourseDetailPage"));
const AssignmentCoachPage = lazy(() => import("@/pages/AssignmentCoachPage"));
const CoachPage = lazy(() => import("@/pages/CoachPage"));
const FlashcardsPage = lazy(() => import("@/pages/FlashcardsPage"));
const FlashcardStudyPage = lazy(() => import("@/pages/FlashcardStudyPage"));
const AccountabilityPage = lazy(() => import("@/pages/AccountabilityPage"));
const AchievementsPage = lazy(() => import("@/pages/AchievementsPage"));
const SettingsPage = lazy(() => import("@/pages/SettingsPage"));
const CalendarPage = lazy(() => import("@/pages/CalendarPage"));
const GradesPage = lazy(() => import("@/pages/GradesPage"));
const MessagesPage = lazy(() => import("@/pages/MessagesPage"));
const MyCoursesPage = lazy(() => import("@/pages/MyCourses"));
const CreateCoursePage = lazy(() => import("@/pages/CreateCoursePage"));
const CourseEditorPage = lazy(() => import("@/pages/CourseEditorPage"));
const CourseLearnPage = lazy(() => import("@/pages/CourseLearnPage"));

function PageLoader() {
  return (
    <div className="grid gap-4 p-6">
      <CardSkeleton />
      <CardSkeleton />
      <CardSkeleton />
    </div>
  );
}

function AppShellLayout() {
  return (
    <AppShell>
      <Suspense fallback={<PageLoader />}>
        <Outlet />
      </Suspense>
    </AppShell>
  );
}

export const routes: RouteObject[] = [
  { path: "/", element: <Navigate to="/connect" replace /> },
  {
    path: "/connect",
    element: (
      <Suspense fallback={<PageLoader />}>
        <ConnectPage />
      </Suspense>
    ),
  },
  {
    path: "/callback",
    element: (
      <Suspense fallback={<PageLoader />}>
        <CanvasCallbackPage />
      </Suspense>
    ),
  },
  {
    element: <AppShellLayout />,
    children: [
      { path: "/today", element: <TodayPage /> },
      { path: "/courses", element: <CoursesPage /> },
      { path: "/courses/:courseId", element: <CourseDetailPage /> },
      {
        path: "/courses/:courseId/assignments/:assignmentId/coach",
        element: <AssignmentCoachPage />,
      },
      { path: "/coach", element: <CoachPage /> },
      { path: "/flashcards", element: <FlashcardsPage /> },
      { path: "/flashcards/:deckId", element: <FlashcardStudyPage /> },
      { path: "/calendar", element: <CalendarPage /> },
      { path: "/grades", element: <GradesPage /> },
      { path: "/messages", element: <MessagesPage /> },
      { path: "/accountability", element: <AccountabilityPage /> },
      { path: "/achievements", element: <AchievementsPage /> },
      { path: "/settings", element: <SettingsPage /> },
      { path: "/my-courses", element: <MyCoursesPage /> },
      { path: "/my-courses/create", element: <CreateCoursePage /> },
      { path: "/my-courses/:courseId", element: <CourseEditorPage /> },
      { path: "/my-courses/:courseId/learn", element: <CourseLearnPage /> },
    ],
  },
];
