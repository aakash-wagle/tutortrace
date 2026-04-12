import { NextResponse } from "next/server";

export async function GET() {
  const hasKey = !!process.env.GOOGLE_GEMINI_API_KEY;
  return NextResponse.json({
    configured: hasKey,
    model: hasKey ? "gemini-2.5-flash" : null,
  });
}
