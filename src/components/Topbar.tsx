"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { db } from "@/lib/dexie";
import { Search, Bell, School, GraduationCap, BookOpen } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface TopbarProps {
  isDemo?: boolean;
  displayName?: string | null;
  sidebarWidth: number;
}

interface SearchResult {
  type: "course" | "assignment";
  id: number;
  name: string;
  courseId?: number;
}

export default function Topbar({ isDemo = true, displayName, sidebarWidth }: TopbarProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const initial = displayName ? displayName.charAt(0).toUpperCase() : "S";

  const handleSearch = async (q: string) => {
    setQuery(q);
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (q.trim().length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      try {
        const lower = q.toLowerCase();
        const [courseRows, assignmentRows] = await Promise.all([
          db.courses.filter((c) => c.name.toLowerCase().includes(lower)).limit(4).toArray(),
          db.assignments.filter((a) => a.name.toLowerCase().includes(lower)).limit(6).toArray(),
        ]);

        const merged: SearchResult[] = [
          ...courseRows.map((c) => ({ type: "course" as const, id: c.id, name: c.name })),
          ...assignmentRows.map((a) => ({
            type: "assignment" as const,
            id: a.id,
            name: a.name,
            courseId: a.courseId,
          })),
        ];
        setResults(merged);
        setOpen(merged.length > 0);
      } catch {
        setResults([]);
      }
    }, 200);
  };

  const handleSelect = (result: SearchResult) => {
    setQuery("");
    setResults([]);
    setOpen(false);
    if (result.type === "course") {
      router.push(`/courses/${result.id}`);
    } else if (result.courseId) {
      router.push(`/courses/${result.courseId}/assignments/${result.id}/coach`);
    }
  };

  // Click-away handler
  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, []);

  // Cleanup debounce on unmount
  useEffect(
    () => () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    },
    []
  );

  return (
    <div
      className="fixed right-0 top-0 z-[1100] flex h-[60px] items-center gap-4 border-b-2 border-border bg-background px-6"
      style={{ left: sidebarWidth, transition: "left 0.2s ease-in-out" }}
    >
      {/* Search box */}
      <div className="relative flex-1 max-w-[440px]" ref={containerRef}>
        <div className="flex items-center gap-2 rounded-xl bg-muted px-3 py-2 border-2 border-border/40 focus-within:border-border transition-colors">
          <Search className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <input
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground text-foreground"
            placeholder="Search courses, assignments..."
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
            onFocus={() => results.length > 0 && setOpen(true)}
          />
        </div>

        {/* Results dropdown */}
        {open && results.length > 0 && (
          <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-[1300] max-h-80 overflow-y-auto rounded-xl border-2 border-border bg-background shadow-neo">
            {results.map((r, i) => (
              <div
                key={`${r.type}-${r.id}`}
                onClick={() => handleSelect(r)}
                className={cn(
                  "flex cursor-pointer items-center gap-3 px-4 py-3 hover:bg-muted transition-colors",
                  i < results.length - 1 && "border-b border-border/30"
                )}
              >
                {r.type === "course" ? (
                  <GraduationCap className="h-4 w-4 text-accent flex-shrink-0" />
                ) : (
                  <BookOpen className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{r.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {r.type === "course" ? "Course" : "Assignment"}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex-1" />

      {/* Demo / Connected badge */}
      {isDemo ? (
        <Badge
          variant="outline"
          className="border-orange-300 bg-orange-50 text-orange-700 font-semibold text-[10px] dark:bg-orange-950 dark:text-orange-300"
        >
          Demo
        </Badge>
      ) : (
        <Badge
          variant="outline"
          className="border-green-300 bg-green-50 text-green-700 font-semibold text-[10px] dark:bg-green-950 dark:text-green-300"
        >
          Connected
        </Badge>
      )}

      <button className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted transition-colors">
        <Bell className="h-4 w-4" />
      </button>
      <button
        onClick={() => router.push("/settings")}
        className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted transition-colors"
      >
        <School className="h-4 w-4" />
      </button>
      <Avatar
        className="h-8 w-8 cursor-pointer border-2 border-border"
        onClick={() => router.push("/settings")}
      >
        <AvatarFallback className="bg-accent text-accent-foreground text-xs font-bold">
          {initial}
        </AvatarFallback>
      </Avatar>
    </div>
  );
}
