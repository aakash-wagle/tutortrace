import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { explainAssignment } from "@/lib/ai";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session.sessionId && !session.isDemo) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = await req.json();
    const { assignmentTitle, description, rubricCriteria, pointsPossible } = body;

    if (!assignmentTitle) {
      return NextResponse.json({ error: "assignmentTitle is required" }, { status: 400 });
    }

    const result = await explainAssignment({
      assignmentTitle,
      description: description || "",
      rubricCriteria: rubricCriteria || [],
      pointsPossible: pointsPossible || 0,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("AI explain error:", error);
    return NextResponse.json({ error: "Failed to explain assignment" }, { status: 500 });
  }
}
