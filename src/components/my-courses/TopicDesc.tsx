import { useCustomCourseInput } from "@/contexts/CustomCourseContext";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

export default function TopicDesc() {
  const { userInput, setUserInput } = useCustomCourseInput();

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-foreground mb-1">Course Topic & Description</h3>
        <p className="text-sm text-muted-foreground mb-6">Tell us what this course is about.</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="topic" className="text-sm font-semibold text-foreground">
          Topic <span className="text-destructive">*</span>
        </Label>
        <Input
          id="topic"
          placeholder="e.g. Introduction to Python Programming"
          value={userInput.topic ?? ""}
          onChange={(e) => setUserInput((prev) => ({ ...prev, topic: e.target.value }))}
          className="border-2 border-border focus:border-accent transition-colors"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description" className="text-sm font-semibold text-foreground">
          Description <span className="text-destructive">*</span>
        </Label>
        <Textarea
          id="description"
          placeholder="Briefly describe what students will learn, who it's for, and any prerequisites..."
          value={userInput.description ?? ""}
          onChange={(e) => setUserInput((prev) => ({ ...prev, description: e.target.value }))}
          rows={5}
          className="border-2 border-border focus:border-accent transition-colors resize-none"
        />
      </div>
    </div>
  );
}
