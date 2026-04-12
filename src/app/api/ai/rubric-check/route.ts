import { NextRequest, NextResponse } from "next/server";
import { runRubricCheck, RubricCheckRequest, RubricCheckResponse } from "@/lib/ai";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as RubricCheckRequest;

    if (!body.assignmentTitle || !body.rubricCriteria?.length) {
      return NextResponse.json(
        { error: "assignmentTitle and rubricCriteria are required" },
        { status: 400 }
      );
    }

    let result: RubricCheckResponse;

    try {
      result = await runRubricCheck(body);
    } catch (error) {
      console.error("AI rubric check failed, returning error:", error);
      return NextResponse.json(
        {
          error: "AI analysis failed. Please check your Gemini API key in .env.local",
          details: error instanceof Error ? error.message : "Unknown error",
        },
        { status: 502 }
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Rubric check route error:", error);
    return NextResponse.json(
      { error: "Failed to run rubric check" },
      { status: 500 }
    );
  }
}
