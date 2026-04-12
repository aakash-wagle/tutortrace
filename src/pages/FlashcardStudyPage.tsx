import { useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { ArrowLeft, ArrowRight, Shuffle, Lightbulb, ChevronLeft } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { db } from "@/lib/db";

export default function FlashcardStudyPage() {
  const { deckId } = useParams<{ deckId: string }>();
  const navigate = useNavigate();
  
  const deck = useLiveQuery(() => db.flashcardDecks.get(deckId || ""), [deckId]);
  const cards = useLiveQuery(() => db.flashcards.where("deckId").equals(deckId || "").sortBy("sortOrder"), [deckId]);

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
      difficulty: difficulty as any, 
      lastReviewed: Date.now(),
      correctCount: currentCard.correctCount + incCorrect,
      incorrectCount: currentCard.incorrectCount + incIncorrect,
      synced: false
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

  if (!deck || !activeCards.length) {
    return (
      <div className="py-16 text-center">
        <p className="mb-4 text-base font-semibold">Deck not found or empty</p>
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

      {/* Progress */}
      <div className="mb-5">
        <div className="mb-1 flex justify-between text-xs text-muted-foreground">
          <span>Card {currentIndex + 1} of {total}</span>
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
                  <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm italic text-amber-700">
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
            onClick={(e) => { e.stopPropagation(); setShowHint(!showHint); }}
            className={`rounded-xl border-2 p-2 transition-colors ${
              showHint ? "border-amber-400 bg-amber-50 text-amber-600" : "border-border hover:bg-muted"
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
    </div>
  );
}
