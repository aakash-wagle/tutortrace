import { useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import {
  ArrowLeft,
  ArrowRight,
  Shuffle,
  Lightbulb,
  ChevronLeft,
  Sparkles,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  AlertCircle,
  FileText,
  Plus,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { db } from "@/lib/db";
import { SKILL_FLASHCARDS } from "@/ai/skills";
import { callSkill, parseSkillJson, isSkillAiConfigured } from "@/ai/router";

// ── Flashcard AI types ────────────────────────────────────────────────────────

interface AiCard {
  id: string;
  type: "definition" | "concept" | "math" | "true_false";
  question: string;
  answer: string;
  hint: string;
  difficulty: "easy" | "medium" | "hard";
}

interface AiFlashcardResult {
  subject: string;
  card_count: number;
  cards: AiCard[];
}

// ── Generate Cards Panel ──────────────────────────────────────────────────────

function GenerateCardsPanel({
  deckId,
  existingCardCount,
}: {
  deckId: string;
  existingCardCount: number;
}) {
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<{ count: number; subject: string } | null>(null);

  const generate = useCallback(async () => {
    if (!content.trim()) return;
    setIsGenerating(true);
    setError(null);
    setLastResult(null);

    try {
      const raw = await callSkill(SKILL_FLASHCARDS, content.trim(), { maxTokens: 1200 });
      const parsed = parseSkillJson<AiFlashcardResult>(raw);

      if (!parsed.cards || parsed.cards.length === 0) {
        throw new Error("No cards were generated. Try providing more detailed content.");
      }

      const newCards = parsed.cards.map((c, idx) => ({
        id: `${Date.now()}-${idx}`,
        deckId,
        front: c.question,
        back: c.answer,
        hint: c.hint || undefined,
        difficulty: c.difficulty,
        sortOrder: existingCardCount + idx + 1,
        lastReviewed: undefined,
        correctCount: 0,
        incorrectCount: 0,
        synced: false as const,
      }));

      await db.flashcards.bulkAdd(newCards);
      await db.flashcardDecks.update(deckId, {
        cardCount: existingCardCount + newCards.length,
        updatedAt: Date.now(),
      });

      setLastResult({ count: newCards.length, subject: parsed.subject });
      setContent("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate flashcards");
    } finally {
      setIsGenerating(false);
    }
  }, [content, deckId, existingCardCount]);

  if (!isSkillAiConfigured) return null;

  return (
    <Card className="relative mb-5 overflow-hidden border-2 border-primary/20 shadow-neo-sm">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5" />
      <CardContent className="relative p-4">
        {/* Header toggle */}
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center justify-between gap-2"
        >
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-primary/20 bg-primary/10">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
            </div>
            <p className="text-sm font-bold">Generate Cards from Content</p>
          </div>
          {open ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </button>

        {open && (
          <div className="mt-4 space-y-3">
            <div>
              <div className="mb-1.5 flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                <label className="text-xs font-semibold text-muted-foreground">
                  Paste your notes, textbook excerpt, or any study material
                </label>
              </div>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Paste your notes here… The AI will extract 3–10 clear, 9th-grade-level flashcards from this content."
                rows={6}
                className="w-full resize-none rounded-xl border-2 border-border bg-background p-3 text-sm font-medium placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none transition-colors"
              />
              <p className="mt-1 text-[11px] text-muted-foreground">
                {content.length} characters ·{" "}
                {content.trim() ? "Ready to generate" : "Waiting for content"}
              </p>
            </div>

            {error && (
              <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-3">
                <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-destructive" />
                <p className="text-xs text-destructive">{error}</p>
              </div>
            )}

            {lastResult && (
              <div className="flex items-center gap-2 rounded-xl border border-green-300 bg-green-50 p-3 dark:border-green-800 dark:bg-green-950/30">
                <Plus className="h-4 w-4 text-green-700 dark:text-green-400" />
                <p className="text-xs font-semibold text-green-700 dark:text-green-400">
                  Added {lastResult.count} new cards about &ldquo;{lastResult.subject}&rdquo; to this deck!
                </p>
              </div>
            )}

            <Button
              onClick={generate}
              disabled={isGenerating || !content.trim()}
              className="w-full border-2"
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="mr-2 h-3.5 w-3.5 animate-spin" />
                  Generating cards…
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-3.5 w-3.5" />
                  Generate Flashcards
                </>
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function FlashcardStudyPage() {
  const { deckId } = useParams<{ deckId: string }>();
  const navigate = useNavigate();

  const deck = useLiveQuery(() => db.flashcardDecks.get(deckId || ""), [deckId]);
  const cards = useLiveQuery(
    () => db.flashcards.where("deckId").equals(deckId || "").sortBy("sortOrder"),
    [deckId]
  );

  const isLoading = deck === undefined || cards === undefined;

  const [currentIndex, setCurrentIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [cardOrder, setCardOrder] = useState<number[] | null>(null);

  const activeCards = cards || [];
  const orderedCards = cardOrder
    ? cardOrder.map((i) => activeCards[i]).filter(Boolean)
    : activeCards;
  const currentCard = orderedCards[currentIndex];
  const total = orderedCards.length;
  const progressVal = total > 0 ? ((currentIndex + 1) / total) * 100 : 0;

  const goNext = useCallback(() => {
    if (currentIndex < total - 1) {
      setCurrentIndex((i) => i + 1);
      setFlipped(false);
      setShowHint(false);
    }
  }, [currentIndex, total]);

  const goPrev = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex((i) => i - 1);
      setFlipped(false);
      setShowHint(false);
    }
  }, [currentIndex]);

  const shuffle = () => {
    const indices = Array.from({ length: activeCards.length }, (_, i) => i);
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    setCardOrder(indices);
    setCurrentIndex(0);
    setFlipped(false);
    setShowHint(false);
  };

  const markDifficulty = async (difficulty: string) => {
    if (!currentCard) return;

    let incCorrect = 0;
    let incIncorrect = 0;

    if (difficulty === "easy") incCorrect = 1;
    else if (difficulty === "hard") incIncorrect = 1;

    await db.flashcards.update(currentCard.id, {
      difficulty: difficulty as "easy" | "medium" | "hard",
      lastReviewed: Date.now(),
      correctCount: currentCard.correctCount + incCorrect,
      incorrectCount: currentCard.incorrectCount + incIncorrect,
      synced: false,
    });

    goNext();
  };

  if (isLoading) {
    return (
      <div className="mx-auto max-w-2xl">
        <Skeleton className="mb-4 h-8 w-2/5" />
        <Skeleton className="h-[350px] rounded-2xl" />
      </div>
    );
  }

  if (!deck) {
    return (
      <div className="py-16 text-center">
        <p className="mb-4 text-base font-semibold">Deck not found</p>
        <Button onClick={() => navigate("/flashcards")}>Back to Decks</Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      {/* Header */}
      <div className="mb-3 flex items-center gap-2">
        <button
          onClick={() => navigate("/flashcards")}
          className="rounded-lg p-1.5 transition-colors hover:bg-muted"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-bold leading-tight">{deck.title}</h1>
          {deck.courseName && (
            <p className="text-xs text-muted-foreground">{deck.courseName}</p>
          )}
        </div>
        <Button variant="outline" size="sm" className="border-2" onClick={shuffle}>
          <Shuffle className="mr-1.5 h-3.5 w-3.5" /> Shuffle
        </Button>
      </div>

      {/* ── AI Generate Cards Panel ────────────────────────────────────────── */}
      <GenerateCardsPanel deckId={deckId!} existingCardCount={activeCards.length} />

      {/* Empty state — after generate panel so user can add cards */}
      {activeCards.length === 0 && (
        <div className="py-16 text-center">
          <p className="mb-2 text-base font-semibold">This deck is empty</p>
          <p className="mb-4 text-sm text-muted-foreground">
            Paste some notes above to generate your first flashcards with AI.
          </p>
          <Button variant="outline" onClick={() => navigate("/flashcards")}>
            Back to Decks
          </Button>
        </div>
      )}

      {activeCards.length > 0 && (
        <>
          {/* Progress */}
          <div className="mb-5">
            <div className="mb-1 flex justify-between text-xs text-muted-foreground">
              <span>
                Card {currentIndex + 1} of {total}
              </span>
              <span className="font-semibold">{Math.round(progressVal)}%</span>
            </div>
            <Progress value={progressVal} className="h-1.5" />
          </div>

          {/* Flashcard (3D flip) */}
          {currentCard && (
            <div
              onClick={() => setFlipped(!flipped)}
              className="mb-5 cursor-pointer"
              style={{ perspective: "1000px", minHeight: 300 }}
            >
              <div
                style={{
                  position: "relative",
                  width: "100%",
                  minHeight: 300,
                  transformStyle: "preserve-3d",
                  transition: "transform 0.5s ease",
                  transform: flipped ? "rotateY(180deg)" : "rotateY(0)",
                }}
              >
                {/* Front */}
                <Card
                  className="border-2 shadow-neo"
                  style={{
                    position: "absolute",
                    width: "100%",
                    minHeight: 300,
                    backfaceVisibility: "hidden",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <CardContent className="w-full p-8 text-center">
                    <Badge className="mb-4 border-0 bg-blue-100 text-blue-800">Question</Badge>
                    <p className="text-lg font-semibold leading-relaxed">{currentCard.front}</p>
                    {showHint && currentCard.hint && (
                      <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm italic text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
                        Hint: {currentCard.hint}
                      </p>
                    )}
                    <p className="mt-6 text-xs text-muted-foreground">Click to flip</p>
                  </CardContent>
                </Card>

                {/* Back */}
                <Card
                  className="border-2 bg-muted shadow-neo"
                  style={{
                    position: "absolute",
                    width: "100%",
                    minHeight: 300,
                    backfaceVisibility: "hidden",
                    transform: "rotateY(180deg)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <CardContent className="w-full p-8 text-center">
                    <Badge className="mb-4 border-0 bg-green-100 text-green-800">Answer</Badge>
                    <p className="whitespace-pre-line text-base leading-relaxed">{currentCard.back}</p>
                    <p className="mt-6 text-xs text-muted-foreground">Click to flip back</p>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {/* Nav controls */}
          <div className="mb-4 flex items-center justify-center gap-3">
            <button
              onClick={goPrev}
              disabled={currentIndex === 0}
              className="rounded-xl border-2 border-border p-2 transition-colors hover:bg-muted disabled:opacity-40"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>

            {!flipped && currentCard?.hint && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowHint(!showHint);
                }}
                className={`rounded-xl border-2 p-2 transition-colors ${
                  showHint
                    ? "border-amber-400 bg-amber-50 text-amber-600"
                    : "border-border hover:bg-muted"
                }`}
              >
                <Lightbulb className="h-5 w-5" />
              </button>
            )}

            <button
              onClick={goNext}
              disabled={currentIndex >= total - 1}
              className="rounded-xl border-2 border-border p-2 transition-colors hover:bg-muted disabled:opacity-40"
            >
              <ArrowRight className="h-5 w-5" />
            </button>
          </div>

          {/* Difficulty rating */}
          {flipped && (
            <div className="text-center">
              <p className="mb-2 text-xs text-muted-foreground">How well did you know this?</p>
              <div className="flex justify-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="border-2 border-green-200 text-green-700 hover:bg-green-50"
                  onClick={() => markDifficulty("easy")}
                >
                  Easy
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-2 border-amber-200 text-amber-700 hover:bg-amber-50"
                  onClick={() => markDifficulty("medium")}
                >
                  Medium
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-2 border-red-200 text-red-700 hover:bg-red-50"
                  onClick={() => markDifficulty("hard")}
                >
                  Hard
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
