import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { canvasApiFetch } from "@/lib/canvas";
import { getDemoActivity } from "@/lib/demo";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  try {
    const { courseId } = await params;
    const session = await getSession();

    if (!session.sessionId || session.isDemo) {
      return NextResponse.json(getDemoActivity());
    }

    const res = await canvasApiFetch(
      session.sessionId,
      `/courses/${courseId}/activity_stream`,
      { per_page: "10" }
    );

    if (!res.ok) {
      return NextResponse.json(getDemoActivity());
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Activity fetch error:", error);
    return NextResponse.json(getDemoActivity());
  }
}
