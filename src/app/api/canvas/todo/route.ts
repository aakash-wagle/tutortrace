import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { canvasApiFetch } from "@/lib/canvas";

export async function GET() {
  try {
    const session = await getSession();

    if (!session.sessionId || session.isDemo) {
      return NextResponse.json([]);
    }

    const res = await canvasApiFetch(session.sessionId, "/users/self/todo", {
      per_page: "30",
    });

    if (!res.ok) {
      return NextResponse.json([]);
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Todo fetch error:", error);
    return NextResponse.json([]);
  }
}
