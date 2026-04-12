import { useCustomCourseInput } from "@/contexts/CustomCourseContext";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function SelectOption() {
  const { userInput, setUserInput } = useCustomCourseInput();

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-foreground mb-1">Course Options</h3>
        <p className="text-sm text-muted-foreground mb-6">Configure the structure and difficulty of your course.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label className="text-sm font-semibold text-foreground">
            Difficulty Level <span className="text-destructive">*</span>
          </Label>
          <Select
            value={userInput.difficulty ?? ""}
            onValueChange={(val) => setUserInput((prev) => ({ ...prev, difficulty: val }))}
          >
            <SelectTrigger className="border-2 border-border focus:border-accent w-full">
              <SelectValue placeholder="Select difficulty" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Beginner">Beginner</SelectItem>
              <SelectItem value="Intermediate">Intermediate</SelectItem>
              <SelectItem value="Advanced">Advanced</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-semibold text-foreground">
            Duration <span className="text-destructive">*</span>
          </Label>
          <Select
            value={userInput.duration ?? ""}
            onValueChange={(val) => setUserInput((prev) => ({ ...prev, duration: val }))}
          >
            <SelectTrigger className="border-2 border-border focus:border-accent w-full">
              <SelectValue placeholder="Select duration" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1 Hour">1 Hour</SelectItem>
              <SelectItem value="2 Hours">2 Hours</SelectItem>
              <SelectItem value="3 Hours">3 Hours</SelectItem>
              <SelectItem value="More than 3 Hours">More than 3 Hours</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-semibold text-foreground">
            Include Videos? <span className="text-destructive">*</span>
          </Label>
          <Select
            value={userInput.video ?? ""}
            onValueChange={(val) => setUserInput((prev) => ({ ...prev, video: val }))}
          >
            <SelectTrigger className="border-2 border-border focus:border-accent w-full">
              <SelectValue placeholder="Include videos?" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Yes">Yes — embed YouTube videos</SelectItem>
              <SelectItem value="No">No — text-only course</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="chapters" className="text-sm font-semibold text-foreground">
            Number of Chapters <span className="text-destructive">*</span>
          </Label>
          <Input
            id="chapters"
            type="number"
            min={1}
            max={25}
            placeholder="e.g. 5"
            value={userInput.totalChapters ?? ""}
            onChange={(e) => {
              const n = parseInt(e.target.value, 10);
              setUserInput((prev) => ({ ...prev, totalChapters: isNaN(n) ? undefined : n }));
            }}
            className="border-2 border-border focus:border-accent transition-colors"
          />
        </div>
      </div>
    </div>
  );
}
