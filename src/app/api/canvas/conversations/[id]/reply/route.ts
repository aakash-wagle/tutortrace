import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { canvasApiFetch } from "@/lib/canvas";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getSession();

    if (!session.sessionId) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = await req.json();
    const messageBody = body.body?.trim();

    if (!messageBody) {
      return NextResponse.json({ error: "Message body is required" }, { status: 400 });
    }

    // canvasApiFetch is GET-only; do a direct POST here
    const { prisma } = await import("@/lib/db");
    const { CANVAS_BASE_URL } = await import("@/lib/canvas");
    const userSession = await prisma.userSession.findUnique({
      where: { id: session.sessionId },
    });
    if (!userSession) {
      return NextResponse.json({ error: "Session not found" }, { status: 401 });
    }

    const canvasUrl = userSession.canvasUrl || CANVAS_BASE_URL;
    const res = await fetch(
      `${canvasUrl}/api/v1/conversations/${id}/add_message`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${userSession.accessToken}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ body: messageBody }),
      }
    );

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        { error: `Canvas API error: ${res.status}`, details: text },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Reply error:", error);
    return NextResponse.json({ error: "Failed to send reply" }, { status: 500 });
  }
}
