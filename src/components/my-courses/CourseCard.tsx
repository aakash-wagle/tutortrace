import { useNavigate } from "react-router-dom";
import { Trash2, BookOpen, Edit2 } from "lucide-react";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import type { DexieCustomCourse } from "@/lib/db";

const CATEGORY_COLORS: Record<string, string> = {
  "Programming": "bg-blue-500",
  "Business": "bg-purple-500",
  "Finance & Accounting": "bg-green-500",
  "Science": "bg-cyan-500",
  "History": "bg-amber-500",
  "Language": "bg-pink-500",
  "Art & Design": "bg-rose-500",
  "Music": "bg-indigo-500",
};

interface CourseCardProps {
  course: DexieCustomCourse;
  onDelete: (courseId: string) => void;
}

export default function CourseCard({ course, onDelete }: CourseCardProps) {
  const navigate = useNavigate();
  const bannerColor = CATEGORY_COLORS[course.category] ?? "bg-accent";
  const chapterCount = course.courseOutput?.chapters?.length ?? 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="group rounded-xl border-2 border-border bg-card shadow-neo hover:shadow-neo-lg transition-shadow duration-200 overflow-hidden flex flex-col"
    >
      {/* Banner */}
      <div
        className={`h-28 flex items-center justify-center ${bannerColor} relative`}
        style={course.courseBanner ? { backgroundImage: `url(${course.courseBanner})`, backgroundSize: "cover", backgroundPosition: "center" } : {}}
      >
        {!course.courseBanner && (
          <span className="text-4xl">
            {course.category === "Programming" ? "💻" :
             course.category === "Business" ? "📊" :
             course.category === "Finance & Accounting" ? "💰" :
             course.category === "Science" ? "🔬" :
             course.category === "History" ? "🏛️" :
             course.category === "Language" ? "🌐" :
             course.category === "Art & Design" ? "🎨" :
             course.category === "Music" ? "🎵" : "📚"}
          </span>
        )}
        {course.isPublished && (
          <span className="absolute top-2 right-2 rounded-full bg-green-500 border-2 border-white px-2 py-0.5 text-[10px] font-bold text-white uppercase tracking-wide">
            Ready
          </span>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 p-4 space-y-3">
        <h3 className="font-bold text-foreground leading-snug line-clamp-2">{course.courseName}</h3>
        <div className="flex flex-wrap gap-1.5">
          <Badge variant="outline" className="text-xs border-accent/40 text-accent bg-accent/5">
            {course.category}
          </Badge>
          <Badge variant="outline" className="text-xs">
            {course.level}
          </Badge>
          <Badge variant="outline" className="text-xs">
            {chapterCount} chapters
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground line-clamp-2">
          {course.courseOutput?.description ?? ""}
        </p>
      </div>

      {/* Actions */}
      <div className="px-4 pb-4 flex gap-2">
        {course.isPublished ? (
          <Button
            size="sm"
            className="flex-1 bg-accent text-accent-foreground hover:bg-accent/90"
            onClick={() => navigate(`/my-courses/${course.courseId}/learn`)}
          >
            <BookOpen className="h-3.5 w-3.5 mr-1.5" />
            Learn
          </Button>
        ) : (
          <Button
            size="sm"
            variant="outline"
            className="flex-1"
            onClick={() => navigate(`/my-courses/${course.courseId}`)}
          >
            <Edit2 className="h-3.5 w-3.5 mr-1.5" />
            Continue
          </Button>
        )}

        <Button
          size="sm"
          variant="ghost"
          onClick={() => navigate(`/my-courses/${course.courseId}`)}
          className="px-2"
          title="Edit"
        >
          <Edit2 className="h-3.5 w-3.5" />
        </Button>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button size="sm" variant="ghost" className="px-2 text-destructive hover:text-destructive" title="Delete">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Course?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete <strong>{course.courseName}</strong> and all its generated content. This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => onDelete(course.courseId)}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </motion.div>
  );
}
