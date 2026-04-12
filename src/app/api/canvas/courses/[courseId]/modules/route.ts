import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { fetchCourseModules } from "@/lib/canvas";
import { getDemoModules } from "@/lib/demo";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  try {
    const { courseId } = await params;
    const session = await getSession();

    if (!session.sessionId || session.isDemo) {
      return NextResponse.json(getDemoModules(courseId));
    }

    const modules = await fetchCourseModules(session.sessionId, courseId);
    return NextResponse.json(modules);
  } catch (error) {
    console.error("Modules fetch error:", error);
    const { courseId } = await params;
    return NextResponse.json(getDemoModules(courseId));
  }
}
