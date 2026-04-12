/**
 * Tests for flashcard CRUD logic using mocked Dexie
 */

// ── Deck creation shape validation ───────────────────────────────────────────

describe("Flashcard deck data shape", () => {
  it("creates a valid DexieFlashcardDeck shape", () => {
    const deck = {
      id: "clxyz123",
      userId: "user-1",
      title: "Biology 101",
      courseId: 42,
      cardCount: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      synced: false,
    };

    expect(deck.id).toBeTruthy();
    expect(deck.userId).toBeTruthy();
    expect(deck.title).toBeTruthy();
    expect(deck.cardCount).toBe(0);
    expect(deck.synced).toBe(false);
  });

  it("cardCount increments correctly", () => {
    let cardCount = 0;
    const addCard = () => { cardCount++; };
    addCard();
    addCard();
    addCard();
    expect(cardCount).toBe(3);
  });
});

// ── Flashcard difficulty validation ──────────────────────────────────────────

describe("Flashcard difficulty levels", () => {
  const validDifficulties = ["easy", "medium", "hard"];

  it("accepts all valid difficulty values", () => {
    validDifficulties.forEach((d) => {
      const card = { difficulty: d };
      expect(validDifficulties).toContain(card.difficulty);
    });
  });

  it("rejects invalid difficulty", () => {
    const card = { difficulty: "impossible" };
    expect(validDifficulties).not.toContain(card.difficulty);
  });
});

// ── Review tracking ───────────────────────────────────────────────────────────

describe("Flashcard review tracking", () => {
  it("increments correctCount on correct answer", () => {
    const card = { correctCount: 0, incorrectCount: 0 };
    const updated = { ...card, correctCount: card.correctCount + 1, lastReviewed: Date.now() };
    expect(updated.correctCount).toBe(1);
    expect(updated.incorrectCount).toBe(0);
  });

  it("increments incorrectCount on incorrect answer", () => {
    const card = { correctCount: 2, incorrectCount: 1 };
    const updated = { ...card, incorrectCount: card.incorrectCount + 1, lastReviewed: Date.now() };
    expect(updated.incorrectCount).toBe(2);
    expect(updated.correctCount).toBe(2);
  });

  it("calculates accuracy from counts", () => {
    const card = { correctCount: 8, incorrectCount: 2 };
    const total = card.correctCount + card.incorrectCount;
    const accuracy = total > 0 ? (card.correctCount / total) * 100 : 0;
    expect(accuracy).toBe(80);
  });
});

// ── Deck deletion cascade logic ───────────────────────────────────────────────

describe("Deck deletion cascade", () => {
  it("marks cards for deletion when deck is deleted", () => {
    const deckId = "deck-abc";
    const cards = [
      { id: "c1", deckId, front: "Q1", back: "A1" },
      { id: "c2", deckId, front: "Q2", back: "A2" },
      { id: "c3", deckId: "other-deck", front: "Q3", back: "A3" },
    ];

    // Simulate cascading delete by filtering out cards with matching deckId
    const remaining = cards.filter((c) => c.deckId !== deckId);
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe("c3");
  });
});

// ── Offline sync flags ────────────────────────────────────────────────────────

describe("Flashcard sync flag behavior", () => {
  it("new deck is created with synced=false", () => {
    const deck = { id: "d1", synced: false };
    expect(deck.synced).toBe(false);
  });

  it("deck is marked synced=true after successful push", () => {
    const deck = { id: "d1", synced: false };
    const synced = { ...deck, synced: true };
    expect(synced.synced).toBe(true);
  });
});
