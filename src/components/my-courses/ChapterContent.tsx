import ReactMarkdown from "react-markdown";
import type { DexieCustomChapter } from "@/lib/db";
import type { ChapterSection } from "@/types/customCourse";

interface ChapterContentProps {
  chapter: DexieCustomChapter;
  chapterName: string;
  chapterDescription: string;
}

export default function ChapterContent({ chapter, chapterName, chapterDescription }: ChapterContentProps) {
  const sections = (chapter.content as ChapterSection[]) ?? [];

  return (
    <div className="space-y-8">
      {/* Chapter header */}
      <div className="rounded-xl border-2 border-border bg-card p-6 shadow-neo-sm">
        <h1 className="text-2xl font-bold text-foreground">{chapterName}</h1>
        <p className="mt-2 text-muted-foreground">{chapterDescription}</p>
      </div>

      {/* YouTube embed */}
      {chapter.videoId && (
        <div className="rounded-xl border-2 border-border overflow-hidden shadow-neo-sm">
          <div className="bg-muted px-4 py-2 border-b-2 border-border">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Video</span>
          </div>
          <div className="relative aspect-video">
            <iframe
              src={`https://www.youtube.com/embed/${chapter.videoId}`}
              title={chapterName}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="absolute inset-0 h-full w-full"
            />
          </div>
        </div>
      )}

      {/* Chapter sections */}
      {sections.map((section, i) => {
        const codeExamples =
          section.code_examples?.filter((ex) => typeof ex.code === "string" && ex.code.trim().length > 0) ?? [];
        return (
        <div key={i} className="rounded-xl border-2 border-border bg-card shadow-neo-sm overflow-hidden">
          <div className="bg-muted px-6 py-3 border-b-2 border-border">
            <h2 className="text-base font-bold text-foreground">{section.title}</h2>
          </div>
          <div className="p-6">
            <div className="prose prose-sm max-w-none text-foreground
              prose-headings:font-bold prose-headings:text-foreground
              prose-h2:text-lg prose-h3:text-base
              prose-p:text-muted-foreground prose-p:leading-relaxed
              prose-li:text-muted-foreground
              prose-strong:text-foreground prose-strong:font-semibold
              prose-code:bg-muted prose-code:rounded prose-code:px-1 prose-code:py-0.5 prose-code:text-xs prose-code:font-mono prose-code:text-foreground
              prose-a:text-accent prose-a:no-underline hover:prose-a:underline">
              <ReactMarkdown>{section.explanation}</ReactMarkdown>
            </div>

            {codeExamples.length > 0 && (
              <div className="mt-6 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Code Examples</h4>
                {codeExamples.map((ex, j) => (
                  <pre
                    key={j}
                    className="rounded-lg border-2 border-border bg-muted p-4 overflow-x-auto text-xs font-mono text-foreground leading-relaxed"
                  >
                    <code>{ex.code.replace(/<\/?precode>/g, "")}</code>
                  </pre>
                ))}
              </div>
            )}
          </div>
        </div>
        );
      })}
    </div>
  );
}
