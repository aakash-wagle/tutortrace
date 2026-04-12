import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { canvasApiFetch, canvasApiFetchMultiParam } from "@/lib/canvas";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();

    if (!session.sessionId || session.isDemo) {
      return NextResponse.json([]);
    }

    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get("start_date") || new Date().toISOString().split("T")[0];
    const endDate = searchParams.get("end_date") ||
      new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    // Get active courses for context_codes
    const coursesRes = await canvasApiFetch(session.sessionId, "/courses", {
      enrollment_state: "active",
      per_page: "50",
    });

    const contextCodes: string[] = [];
    if (coursesRes.ok) {
      const courses = (await coursesRes.json()) as { id: number }[];
      courses.forEach((c) => contextCodes.push(`course_${c.id}`));
    }

    if (contextCodes.length === 0) {
      return NextResponse.json([]);
    }

    // Fetch assignments from calendar (these are the most useful)
    const params = new URLSearchParams();
    params.append("type", "assignment");
    params.append("start_date", startDate);
    params.append("end_date", endDate);
    params.append("per_page", "50");
    contextCodes.forEach((cc) => params.append("context_codes[]", cc));

    const res = await canvasApiFetchMultiParam(session.sessionId, "/calendar_events", params);

    if (!res.ok) {
      console.error("Calendar API error:", res.status, await res.text());
      return NextResponse.json([]);
    }

    const assignments = await res.json();

    // Also try calendar events
    const eventParams = new URLSearchParams();
    eventParams.append("type", "event");
    eventParams.append("start_date", startDate);
    eventParams.append("end_date", endDate);
    eventParams.append("per_page", "50");
    contextCodes.forEach((cc) => eventParams.append("context_codes[]", cc));

    const eventsRes = await canvasApiFetchMultiParam(session.sessionId, "/calendar_events", eventParams);
    const events = eventsRes.ok ? await eventsRes.json() : [];

    const allEvents = [...(assignments as unknown[]), ...(events as unknown[])];
    return NextResponse.json(allEvents);
  } catch (error) {
    console.error("Calendar fetch error:", error);
    return NextResponse.json([]);
  }
}
