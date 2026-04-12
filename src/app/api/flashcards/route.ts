import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const session = await getSession();
    const sessionId = session.sessionId;

    if (!sessionId) {
      return NextResponse.json([]);
    }

    const decks = await prisma.flashcardDeck.findMany({
      where: { sessionId },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { cards: true } } },
    });

    return NextResponse.json(
      decks.map((d) => ({
        ...d,
        cardCount: d._count.cards,
      }))
    );
  } catch (error) {
    console.error("Flashcards list error:", error);
    return NextResponse.json([]);
  }
}
