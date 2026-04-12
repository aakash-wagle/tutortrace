import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { canvasApiFetch } from "@/lib/canvas";

export async function GET() {
  try {
    const session = await getSession();

    if (!session.sessionId || session.isDemo) {
      return NextResponse.json([]);
    }

    const res = await canvasApiFetch(session.sessionId, "/conversations", {
      per_page: "20",
    });

    if (!res.ok) {
      return NextResponse.json([]);
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Conversations fetch error:", error);
    return NextResponse.json([]);
  }
}
