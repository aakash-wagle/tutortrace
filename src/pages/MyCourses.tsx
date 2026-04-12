import { useNavigate } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { Plus, BookMarked } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import CourseCard from "@/components/my-courses/CourseCard";
import { db } from "@/lib/db";
import { customCourseRepo } from "@/lib/customCourseRepository";

export default function MyCourses() {
  const navigate = useNavigate();
  const courses = useLiveQuery(() => db.customCourses.orderBy("createdAt").reverse().toArray(), []);

  const handleDelete = async (courseId: string) => {
    await customCourseRepo.delete(courseId);
  };

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">My Courses</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            AI-generated courses tailored to your learning goals
          </p>
        </div>
        <Button
          onClick={() => navigate("/my-courses/create")}
          className="bg-accent text-accent-foreground hover:bg-accent/90 shadow-neo-sm"
        >
          <Plus className="h-4 w-4 mr-1.5" />
          Create Course
        </Button>
      </div>

      {/* Course grid */}
      {courses === undefined ? (
        // Loading state
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-72 rounded-xl border-2 border-border bg-muted animate-pulse" />
          ))}
        </div>
      ) : courses.length === 0 ? (
        // Empty state
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-card py-20 text-center shadow-neo-sm"
        >
          <BookMarked className="h-14 w-14 text-muted-foreground/40 mb-4" />
          <h3 className="text-lg font-bold text-foreground">No courses yet</h3>
          <p className="text-sm text-muted-foreground mt-1 mb-6 max-w-xs">
            Create your first AI-generated course on any topic you want to learn.
          </p>
          <Button
            onClick={() => navigate("/my-courses/create")}
            className="bg-accent text-accent-foreground hover:bg-accent/90"
          >
            <Plus className="h-4 w-4 mr-1.5" />
            Create Your First Course
          </Button>
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {courses.map((course) => (
            <CourseCard key={course.courseId} course={course} onDelete={handleDelete} />
          ))}
        </div>
      )}
    </div>
  );
}
