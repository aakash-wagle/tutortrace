import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { canvasApiFetch } from "@/lib/canvas";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getSession();

    if (!session.sessionId || session.isDemo) {
      return NextResponse.json({ error: "Not connected" }, { status: 401 });
    }

    const res = await canvasApiFetch(session.sessionId, `/conversations/${id}`);

    if (!res.ok) {
      return NextResponse.json({ error: "Failed to fetch conversation" }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Conversation fetch error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
