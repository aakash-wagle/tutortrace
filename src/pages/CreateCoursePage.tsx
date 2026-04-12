import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { WandSparkles, ChevronLeft, ChevronRight, LayoutGrid, FileText, Settings } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import SelectCategory from "@/components/my-courses/SelectCategory";
import TopicDesc from "@/components/my-courses/TopicDesc";
import SelectOption from "@/components/my-courses/SelectOption";
import { CustomCourseProvider, useCustomCourseInput } from "@/contexts/CustomCourseContext";
import { generateCourseLayout } from "@/lib/aiService";
import { customCourseRepo } from "@/lib/customCourseRepository";
import { cn } from "@/lib/utils";

const STEPS = [
  { label: "Category", icon: LayoutGrid },
  { label: "Topic", icon: FileText },
  { label: "Options", icon: Settings },
];

function CreateCourseWizard() {
  const navigate = useNavigate();
  const { userInput } = useCustomCourseInput();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const allowNext = () => {
    if (step === 0) return !!userInput.category?.trim();
    if (step === 1) return !!userInput.topic?.trim() && !!userInput.description?.trim();
    if (step === 2) {
      const n = Number(userInput.totalChapters);
      return !!userInput.difficulty && !!userInput.duration && !!userInput.video && Number.isFinite(n) && n > 0;
    }
    return false;
  };

  const handleGenerate = async () => {
    setError(null);
    setLoading(true);
    try {
      const courseOutput = await generateCourseLayout(userInput);
      const courseId = crypto.randomUUID();
      const now = Date.now();
      await customCourseRepo.insert({
        courseId,
        courseName: courseOutput.topic ?? userInput.topic ?? "Untitled Course",
        category: userInput.category ?? courseOutput.category ?? "",
        level: userInput.difficulty ?? courseOutput.level ?? "",
        courseOutput,
        isVideo: (userInput.video?.toLowerCase() === "yes" ? "Yes" : "No"),
        isPublished: false,
        createdAt: now,
        updatedAt: now,
      });
      navigate(`/my-courses/${courseId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate course. Check your AI configuration.");
      setLoading(false);
    }
  };

  const isLast = step === STEPS.length - 1;

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <button
          type="button"
          onClick={() => navigate("/my-courses")}
          className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mb-4 transition-colors"
        >
          <ChevronLeft className="h-4 w-4" /> My Courses
        </button>
        <h1 className="text-2xl font-bold text-foreground">Create a Course</h1>
        <p className="text-sm text-muted-foreground mt-1">AI will generate a full course structure based on your inputs.</p>
      </div>

      {/* Stepper */}
      <div className="flex items-center">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          const done = step > i;
          const active = step === i;
          return (
            <div key={i} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center gap-1">
                <div
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-full border-2 text-sm font-bold transition-colors",
                    done
                      ? "border-accent bg-accent text-accent-foreground"
                      : active
                      ? "border-accent bg-accent/10 text-accent"
                      : "border-border bg-muted text-muted-foreground"
                  )}
                >
                  {done ? "✓" : <Icon className="h-4 w-4" />}
                </div>
                <span className={cn("hidden sm:block text-xs font-medium", active ? "text-accent" : "text-muted-foreground")}>
                  {s.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={cn("flex-1 mx-2 h-0.5 rounded-full transition-colors", done ? "bg-accent" : "bg-border")} />
              )}
            </div>
          );
        })}
      </div>

      {/* Step content */}
      <div className="rounded-xl border-2 border-border bg-card p-6 shadow-neo-sm min-h-[280px]">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.18 }}
          >
            {step === 0 && <SelectCategory />}
            {step === 1 && <TopicDesc />}
            {step === 2 && <SelectOption />}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg border-2 border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={() => { setError(null); setStep((s) => s - 1); }}
          disabled={step === 0}
        >
          <ChevronLeft className="h-4 w-4 mr-1" /> Previous
        </Button>

        {isLast ? (
          <Button
            disabled={!allowNext() || loading}
            onClick={handleGenerate}
            className="bg-accent text-accent-foreground hover:bg-accent/90 gap-2"
          >
            <WandSparkles className="h-4 w-4" />
            Generate Course
          </Button>
        ) : (
          <Button
            disabled={!allowNext()}
            onClick={() => { setError(null); setStep((s) => s + 1); }}
          >
            Next <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        )}
      </div>

      {/* Loading dialog */}
      <Dialog open={loading} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-sm text-center border-2 border-border shadow-neo" onInteractOutside={(e) => e.preventDefault()}>
          <div className="flex flex-col items-center gap-4 py-4">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
              className="h-12 w-12 rounded-full border-4 border-accent border-t-transparent"
            />
            <div>
              <p className="text-lg font-bold text-foreground">Building your course…</p>
              <p className="text-sm text-muted-foreground mt-1">AI is generating the course structure. This may take a moment.</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function CreateCoursePage() {
  return (
    <CustomCourseProvider>
      <CreateCourseWizard />
    </CustomCourseProvider>
  );
}
