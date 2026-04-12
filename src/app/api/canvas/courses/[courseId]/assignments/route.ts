import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { canvasApiFetch } from "@/lib/canvas";
import { getDemoAssignments } from "@/lib/demo";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  try {
    const { courseId } = await params;
    const session = await getSession();

    if (!session.sessionId || session.isDemo) {
      return NextResponse.json(getDemoAssignments(Number(courseId)));
    }

    const res = await canvasApiFetch(
      session.sessionId,
      `/courses/${courseId}/assignments`,
      { order_by: "due_at", per_page: "20" }
    );

    if (!res.ok) {
      return NextResponse.json(getDemoAssignments(Number(courseId)));
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Assignments fetch error:", error);
    return NextResponse.json(getDemoAssignments(Number((await params).courseId)));
  }
}
