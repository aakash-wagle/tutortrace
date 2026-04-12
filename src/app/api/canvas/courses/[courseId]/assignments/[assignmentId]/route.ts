import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { canvasApiFetchMultiParam } from "@/lib/canvas";
import { getDemoAssignment } from "@/lib/demo";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ courseId: string; assignmentId: string }> }
) {
  try {
    const { courseId, assignmentId } = await params;
    const session = await getSession();

    if (!session.sessionId || session.isDemo) {
      return NextResponse.json(getDemoAssignment(Number(assignmentId)));
    }

    const searchParams = new URLSearchParams();
    searchParams.append("include[]", "rubric_assessment");
    searchParams.append("include[]", "submission");

    const res = await canvasApiFetchMultiParam(
      session.sessionId,
      `/courses/${courseId}/assignments/${assignmentId}`,
      searchParams
    );

    if (!res.ok) {
      return NextResponse.json(getDemoAssignment(Number(assignmentId)));
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Assignment fetch error:", error);
    return NextResponse.json(getDemoAssignment(Number((await params).assignmentId)));
  }
}
