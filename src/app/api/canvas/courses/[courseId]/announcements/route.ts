import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { canvasApiFetch } from "@/lib/canvas";
import { getDemoAnnouncements } from "@/lib/demo";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  try {
    const { courseId } = await params;
    const session = await getSession();

    if (!session.sessionId || session.isDemo) {
      return NextResponse.json(getDemoAnnouncements());
    }

    const res = await canvasApiFetch(
      session.sessionId,
      `/courses/${courseId}/discussion_topics`,
      { only_announcements: "true", per_page: "5" }
    );

    if (!res.ok) {
      return NextResponse.json(getDemoAnnouncements());
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Announcements fetch error:", error);
    return NextResponse.json(getDemoAnnouncements());
  }
}
