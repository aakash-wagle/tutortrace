import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ deckId: string }> }
) {
  try {
    const { deckId } = await params;
    const deck = await prisma.flashcardDeck.findUnique({
      where: { id: deckId },
      include: { cards: { orderBy: { sortOrder: "asc" } } },
    });

    if (!deck) {
      return NextResponse.json({ error: "Deck not found" }, { status: 404 });
    }

    return NextResponse.json(deck);
  } catch (error) {
    console.error("Deck fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch deck" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ deckId: string }> }
) {
  try {
    const { deckId } = await params;
    await prisma.flashcardDeck.delete({ where: { id: deckId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Deck delete error:", error);
    return NextResponse.json({ error: "Failed to delete deck" }, { status: 500 });
  }
}
