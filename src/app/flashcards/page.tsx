"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import useSWR, { mutate } from "swr";
import { Layers, Plus, Trash2, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { AnimatedCardList, AnimatedCard } from "@/components/AnimatedCardList";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface Course { id: number; name: string; course_code: string }
interface Module { id: number; name: string; items?: { id: number; title: string; type: string }[] }
interface Deck { id: string; title: string; courseName: string | null; cardCount: number; sourceNames: string; createdAt: string }

export default function FlashcardsPage() {
  const router = useRouter();
  const { data: decks, isLoading: decksLoading } = useSWR<Deck[]>("/api/flashcards", fetcher);
  const { data: courses } = useSWR<Course[]>("/api/canvas/courses", fetcher);
  const { data: aiStatus } = useSWR<{ configured: boolean }>("/api/ai/status", fetcher);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState<string>("");
  const [deckTitle, setDeckTitle] = useState("");
  const [selectedModules, setSelectedModules] = useState<string[]>([]);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);

  const { data: modules } = useSWR<Module[]>(
    selectedCourse ? `/api/canvas/courses/${selectedCourse}/modules` : null,
    fetcher
  );

  const handleCourseChange = (courseId: string) => {
    setSelectedCourse(courseId);
    setSelectedModules([]);
    const course = courses?.find((c) => String(c.id) === courseId);
    if (course) setDeckTitle(`${course.course_code} Flashcards`);
  };

  const toggleModule = (id: string) => {
    setSelectedModules((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
    );
  };

  const handleGenerate = async () => {
    if (!deckTitle.trim()) return;
    setGenerating(true);
    const course = courses?.find((c) => String(c.id) === selectedCourse);
    const allItems = modules?.flatMap((m) => m.items || []) || [];
    const selectedItems = selectedModules.length > 0
      ? allItems.filter((it) =>
          selectedModules.some((sm) => {
            const mod = modules?.find((m) => String(m.id) === sm);
            return mod?.items?.some((mi) => mi.id === it.id);
          })
        )
      : allItems;
    const sources = selectedModules.length > 0
      ? modules?.filter((m) => selectedModules.includes(String(m.id))).map((m) => ({ type: "module", id: String(m.id), name: m.name })) || []
      : modules?.map((m) => ({ type: "module", id: String(m.id), name: m.name })) || [];
    const contentParts = selectedItems.map((it) => it.title);
    setGenError(null);
    try {
      const res = await fetch("/api/flashcards/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseId: selectedCourse || undefined,
          courseName: course?.name || undefined,
          title: deckTitle,
          sources,
          content: `Course: ${course?.name || deckTitle}\n\nTopics covered:\n${contentParts.join("\n")}`,
        }),
      });
      const deck = await res.json();
      if (!res.ok) { setGenError(deck.error || "Generation failed."); setGenerating(false); return; }
      if (deck.id) { mutate("/api/flashcards"); setDialogOpen(false); router.push(`/flashcards/${deck.id}`); }
    } catch { setGenError("Network error. Please check your connection."); }
    setGenerating(false);
  };

  const handleDelete = async (deckId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await fetch(`/api/flashcards/${deckId}`, { method: "DELETE" });
    mutate("/api/flashcards");
  };

  const resetDialog = () => {
    setSelectedCourse(""); setDeckTitle(""); setSelectedModules([]); setDialogOpen(true);
  };

  return (
    <div>
      <div className="mb-0.5 flex items-center gap-2">
        <Layers className="h-7 w-7 text-foreground" />
        <h1 className="text-2xl font-bold tracking-tight">Flashcards</h1>
      </div>
      <p className="mb-6 text-sm text-muted-foreground">Generate AI-powered flashcards from your course content</p>

      <Button className="mb-6 border-2 shadow-neo-sm" onClick={resetDialog}>
        <Plus className="mr-2 h-4 w-4" /> New Deck
      </Button>

      {decksLoading && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="border-2">
              <CardContent className="p-5">
                <Skeleton className="mb-2 h-6 w-4/5" />
                <Skeleton className="mb-1 h-4 w-2/5" />
                <Skeleton className="h-4 w-3/5" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {!decksLoading && decks && decks.length > 0 && (
        <AnimatedCardList>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {decks.map((deck) => {
              let sourceList: string[] = [];
              try { sourceList = JSON.parse(deck.sourceNames); } catch { /* empty */ }
              return (
                <AnimatedCard key={deck.id}>
                  <Card
                    className="cursor-pointer border-2 transition-all hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-neo-sm"
                    onClick={() => router.push(`/flashcards/${deck.id}`)}
                  >
                    <CardContent className="p-5">
                      <div className="mb-2 flex items-start justify-between gap-2">
                        <h3 className="text-sm font-bold leading-tight">{deck.title}</h3>
                        <button
                          onClick={(e) => handleDelete(deck.id, e)}
                          className="flex-shrink-0 rounded-lg p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      {deck.courseName && (
                        <Badge className="mb-2 border-0 bg-purple-700 text-white text-[11px]">
                          {deck.courseName}
                        </Badge>
                      )}
                      <p className="text-xs text-muted-foreground">{deck.cardCount} cards</p>
                      {sourceList.length > 0 && (
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          Sources: {sourceList.slice(0, 2).join(", ")}
                          {sourceList.length > 2 && ` +${sourceList.length - 2} more`}
                        </p>
                      )}
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {new Date(deck.createdAt).toLocaleDateString()}
                      </p>
                    </CardContent>
                  </Card>
                </AnimatedCard>
              );
            })}
          </div>
        </AnimatedCardList>
      )}

      {!decksLoading && (!decks || decks.length === 0) && (
        <Card className="border-2 text-center">
          <CardContent className="p-10">
            <Layers className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
            <h3 className="mb-1 text-base font-bold">No flashcard decks yet</h3>
            <p className="mb-4 text-sm text-muted-foreground">Select a course and its modules to generate flashcards with AI</p>
            <Button onClick={resetDialog}><Plus className="mr-2 h-4 w-4" /> Create Your First Deck</Button>
          </CardContent>
        </Card>
      )}

      {/* New Deck Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md border-2">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">Generate Flashcard Deck</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {aiStatus && !aiStatus.configured && (
              <div className="rounded-xl border-2 border-amber-300 bg-amber-50 p-3 text-xs text-amber-800">
                Gemini API key not configured. Flashcards will use sample data.
                Add <code>GOOGLE_GEMINI_API_KEY</code> to <code>.env.local</code> for AI-generated cards.
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Select Course</Label>
              <select
                className="w-full rounded-xl border-2 border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                value={selectedCourse}
                onChange={(e) => handleCourseChange(e.target.value)}
              >
                <option value="">Choose a course...</option>
                {courses?.map((c) => (
                  <option key={c.id} value={String(c.id)}>{c.course_code} – {c.name}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label>Deck Title</Label>
              <Input value={deckTitle} onChange={(e) => setDeckTitle(e.target.value)} placeholder="My Flashcard Deck" />
            </div>

            {selectedCourse && modules && modules.length > 0 && (
              <div className="space-y-1.5">
                <Label>Select Modules (optional)</Label>
                <div className="max-h-48 space-y-1 overflow-y-auto rounded-xl border-2 border-border p-2">
                  {modules.map((m) => (
                    <label
                      key={m.id}
                      className="flex cursor-pointer items-center gap-2 rounded-lg p-2 hover:bg-muted"
                    >
                      <input
                        type="checkbox"
                        checked={selectedModules.includes(String(m.id))}
                        onChange={() => toggleModule(String(m.id))}
                        className="h-4 w-4 accent-accent"
                      />
                      <div>
                        <p className="text-xs font-medium">{m.name}</p>
                        <p className="text-[11px] text-muted-foreground">{m.items?.length || 0} items</p>
                      </div>
                    </label>
                  ))}
                </div>
                {selectedModules.length === 0 && (
                  <p className="text-xs text-muted-foreground">Leave empty to use all modules</p>
                )}
              </div>
            )}

            {genError && (
              <div className="rounded-xl border-2 border-red-300 bg-red-50 p-3 text-xs text-red-800">{genError}</div>
            )}

            {generating && (
              <div>
                <p className="mb-2 text-xs text-muted-foreground">Fetching course content and generating flashcards with AI...</p>
                <Progress value={undefined} className="h-1.5 animate-pulse" />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={generating}>Cancel</Button>
            <Button onClick={handleGenerate} disabled={!deckTitle.trim() || generating}>
              {generating ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Generating...</> : "Generate Flashcards"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
