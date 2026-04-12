import { cn } from "@/lib/utils";
import type { CustomChapterType } from "@/types/customCourse";

interface ChapterListProps {
  chapters: CustomChapterType[];
  activeIndex?: number;
  onSelect?: (index: number) => void;
  generatedChapterIds?: number[]; // which chapters have content
}

export default function ChapterList({
  chapters,
  activeIndex,
  onSelect,
  generatedChapterIds = [],
}: ChapterListProps) {
  return (
    <ol className="space-y-2">
      {chapters.map((chapter, i) => {
        const isActive = activeIndex === i;
        const isDone = generatedChapterIds.includes(i);
        const isClickable = !!onSelect;

        return (
          <li key={i}>
            <button
              type="button"
              disabled={!isClickable}
              onClick={() => onSelect?.(i)}
              className={cn(
                "w-full text-left rounded-xl border-2 p-3 transition-all duration-150",
                isClickable ? "cursor-pointer" : "cursor-default",
                isActive
                  ? "border-accent bg-accent/10 shadow-neo-sm"
                  : "border-border bg-card hover:border-accent/40 shadow-neo-sm"
              )}
            >
              <div className="flex items-start gap-3">
                <span
                  className={cn(
                    "flex-shrink-0 flex h-6 w-6 items-center justify-center rounded-full border-2 text-xs font-bold",
                    isDone
                      ? "border-green-500 bg-green-500 text-white"
                      : isActive
                      ? "border-accent bg-accent text-accent-foreground"
                      : "border-border bg-muted text-muted-foreground"
                  )}
                >
                  {isDone ? "✓" : i + 1}
                </span>
                <div className="min-w-0">
                  <p className={cn("text-sm font-semibold leading-tight", isActive ? "text-accent" : "text-foreground")}>
                    {chapter.chapter_name}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{chapter.description}</p>
                  <p className="text-[10px] text-muted-foreground/70 mt-1">{chapter.duration}</p>
                </div>
              </div>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
