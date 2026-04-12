import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { generateStudyPlan } from "@/lib/ai";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session.sessionId && !session.isDemo) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = await req.json();
    const { assignmentTitle, dueAt, pointsPossible, rubricCriteria } = body;

    if (!assignmentTitle) {
      return NextResponse.json({ error: "assignmentTitle is required" }, { status: 400 });
    }

    const result = await generateStudyPlan({
      assignmentTitle,
      dueAt: dueAt || null,
      pointsPossible: pointsPossible || 0,
      rubricCriteria: rubricCriteria || [],
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("AI study plan error:", error);
    return NextResponse.json({ error: "Failed to generate study plan" }, { status: 500 });
  }
}
