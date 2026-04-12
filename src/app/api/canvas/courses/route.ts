import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { canvasApiFetchMultiParam } from "@/lib/canvas";
import { getDemoCourses } from "@/lib/demo";

export async function GET() {
  try {
    const session = await getSession();

    if (!session.sessionId || session.isDemo) {
      return NextResponse.json(getDemoCourses());
    }

    const params = new URLSearchParams();
    params.append("enrollment_state", "active");
    params.append("include[]", "total_scores");
    params.append("include[]", "teachers");
    params.append("include[]", "term");
    params.append("include[]", "current_grading_period_scores");
    params.append("per_page", "50");

    const res = await canvasApiFetchMultiParam(session.sessionId, "/courses", params);

    if (!res.ok) {
      console.error("Canvas API error:", res.status);
      return NextResponse.json(getDemoCourses());
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Courses fetch error:", error);
    return NextResponse.json(getDemoCourses());
  }
}
