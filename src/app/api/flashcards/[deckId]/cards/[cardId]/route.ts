import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ deckId: string; cardId: string }> }
) {
  try {
    const { cardId } = await params;
    const body = await req.json();
    const { difficulty } = body as { difficulty: string };

    if (!["easy", "medium", "hard"].includes(difficulty)) {
      return NextResponse.json(
        { error: "difficulty must be easy, medium, or hard" },
        { status: 400 }
      );
    }

    const card = await prisma.flashcard.update({
      where: { id: cardId },
      data: { difficulty },
    });

    return NextResponse.json(card);
  } catch (error) {
    console.error("Card update error:", error);
    return NextResponse.json({ error: "Failed to update card" }, { status: 500 });
  }
}
