import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { generateFlashcards } from "@/lib/ai";
import { canvasApiFetch } from "@/lib/canvas";

interface Source {
  type: string;
  id: string;
  name: string;
}

async function fetchCanvasContent(
  sessionId: string,
  courseId: string,
  sources: Source[]
): Promise<string> {
  const parts: string[] = [];

  // Fetch assignment descriptions from this course
  try {
    const assignmentsRes = await canvasApiFetch(
      sessionId,
      `/courses/${courseId}/assignments`,
      { per_page: "15", order_by: "due_at" }
    );
    if (assignmentsRes.ok) {
      const assignments = (await assignmentsRes.json()) as {
        name: string;
        description?: string;
        points_possible?: number;
      }[];
      for (const a of assignments.slice(0, 10)) {
        if (a.description) {
          const text = a.description.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
          if (text.length > 30) {
            parts.push(`[Assignment: ${a.name}]\n${text.slice(0, 1500)}`);
          }
        }
      }
    }
  } catch {
    // continue
  }

  // Fetch module items and any linked page content
  for (const src of sources.filter((s) => s.type === "module")) {
    try {
      const modRes = await canvasApiFetch(
        sessionId,
        `/courses/${courseId}/modules/${src.id}/items`,
        { per_page: "20" }
      );
      if (modRes.ok) {
        const items = (await modRes.json()) as {
          title: string;
          type: string;
          page_url?: string;
          content_id?: number;
        }[];
        for (const item of items) {
          parts.push(`[${item.type}: ${item.title}]`);

          // Fetch actual page content if it's a Page type
          if (item.type === "Page" && item.page_url) {
            try {
              const pageRes = await canvasApiFetch(
                sessionId,
                `/courses/${courseId}/pages/${item.page_url}`
              );
              if (pageRes.ok) {
                const page = (await pageRes.json()) as { body?: string; title?: string };
                if (page.body) {
                  const text = page.body.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
                  if (text.length > 30) {
                    parts.push(text.slice(0, 2000));
                  }
                }
              }
            } catch {
              // skip individual page errors
            }
          }
        }
      }
    } catch {
      // continue with other sources
    }
  }

  // Fetch course pages if no module sources or content is thin
  if (parts.join("").length < 500) {
    try {
      const pagesRes = await canvasApiFetch(
        sessionId,
        `/courses/${courseId}/pages`,
        { per_page: "10", sort: "updated_at", order: "desc" }
      );
      if (pagesRes.ok) {
        const pages = (await pagesRes.json()) as { url: string; title: string }[];
        for (const pg of pages.slice(0, 5)) {
          try {
            const pageRes = await canvasApiFetch(
              sessionId,
              `/courses/${courseId}/pages/${pg.url}`
            );
            if (pageRes.ok) {
              const data = (await pageRes.json()) as { body?: string; title?: string };
              if (data.body) {
                const text = data.body.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
                if (text.length > 30) {
                  parts.push(`[Page: ${pg.title}]\n${text.slice(0, 2000)}`);
                }
              }
            }
          } catch {
            // skip
          }
        }
      }
    } catch {
      // continue
    }
  }

  return parts.join("\n\n");
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    let sessionId = session.sessionId;

    if (!sessionId) {
      const newSession = await prisma.userSession.create({
        data: {
          accessToken: "demo",
          isDemo: true,
        },
      });
      session.sessionId = newSession.id;
      session.isDemo = true;
      await session.save();
      sessionId = newSession.id;
    }

    const body = await req.json();
    const {
      courseId,
      courseName,
      title,
      sources,
      content: clientContent,
    }: {
      courseId?: string;
      courseName?: string;
      title: string;
      sources: Source[];
      content?: string;
    } = body;

    if (!title || (!sources?.length && !clientContent)) {
      return NextResponse.json(
        { error: "title and sources (or content) are required" },
        { status: 400 }
      );
    }

    // Build rich content: fetch real Canvas content server-side when connected
    let richContent = clientContent || "";

    if (!session.isDemo && sessionId && courseId) {
      try {
        const canvasContent = await fetchCanvasContent(sessionId, courseId, sources || []);
        if (canvasContent.length > 100) {
          richContent = `Course: ${courseName || title}\n\n${canvasContent}`;
        }
      } catch (err) {
        console.error("Canvas content fetch for flashcards failed:", err);
      }
    }

    // Fallback: use client-provided content if Canvas fetch didn't yield much
    if (richContent.length < 100) {
      richContent =
        `Course: ${courseName || title}\n\nTopics:\n` +
        (sources?.map((s) => `- ${s.name}`).join("\n") || "General course material");
    }

    let cards;
    let isMock = false;

    try {
      const result = await generateFlashcards({
        title,
        content: richContent,
        maxCards: 15,
      });
      cards = result.cards;
      isMock = result.isMock;
    } catch {
      // If Gemini fails, fall back to mock
      console.warn("AI generation failed, using mock flashcards");
      const { generateFlashcards: genFallback } = await import("@/lib/ai");
      const fallback = await genFallback({
        title,
        content: richContent,
        maxCards: 15,
      });
      cards = fallback.cards;
      isMock = true;
    }

    const deck = await prisma.flashcardDeck.create({
      data: {
        sessionId: sessionId!,
        title,
        courseId: courseId || null,
        courseName: courseName || null,
        sourceType: sources?.[0]?.type || "manual",
        sourceIds: JSON.stringify(sources?.map((s) => s.id) || []),
        sourceNames: JSON.stringify(sources?.map((s) => s.name) || []),
        cardCount: cards.length,
        cards: {
          create: cards.map((c, i) => ({
            front: c.front,
            back: c.back,
            hint: c.hint || null,
            difficulty: c.difficulty || "medium",
            sortOrder: i,
          })),
        },
      },
      include: { cards: { orderBy: { sortOrder: "asc" } } },
    });

    return NextResponse.json({ ...deck, isMock });
  } catch (error) {
    console.error("Flashcard generation error:", error);
    return NextResponse.json(
      { error: "Failed to generate flashcards" },
      { status: 500 }
    );
  }
}
