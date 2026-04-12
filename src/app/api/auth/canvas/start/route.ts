import { NextResponse } from "next/server";
import { getAuthorizeUrl } from "@/lib/canvas";
import { getSession } from "@/lib/session";
import crypto from "crypto";

export async function GET() {
  try {
    const state = crypto.randomBytes(16).toString("hex");
    const session = await getSession();
    ((session as unknown) as Record<string, unknown>)["oauth_state"] = state;
    await session.save();

    const url = getAuthorizeUrl(state);
    return NextResponse.redirect(url);
  } catch (error) {
    console.error("OAuth start error:", error);
    return NextResponse.json({ error: "Failed to start OAuth" }, { status: 500 });
  }
}
