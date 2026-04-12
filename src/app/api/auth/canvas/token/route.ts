import { NextRequest, NextResponse } from "next/server";
import { CANVAS_BASE_URL } from "@/lib/canvas";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const token = body.token?.trim();

    if (!token) {
      return NextResponse.json(
        { error: "Token is required." },
        { status: 400 }
      );
    }

    // Validate the token by making a test request to Canvas
    const testRes = await fetch(`${CANVAS_BASE_URL}/api/v1/users/self/profile`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    });

    if (!testRes.ok) {
      return NextResponse.json(
        { error: "Invalid token. Please check that you copied it correctly." },
        { status: 401 }
      );
    }

    const profile = (await testRes.json()) as {
      id: number;
      name?: string;
      short_name?: string;
      avatar_url?: string;
    };

    const userSession = await prisma.userSession.create({
      data: {
        accessToken: token,
        refreshToken: null,
        expiresAt: null,
        canvasUserId: String(profile.id),
        canvasUrl: CANVAS_BASE_URL,
        displayName: profile.short_name || profile.name || null,
        avatarUrl: profile.avatar_url || null,
        isDemo: false,
      },
    });

    const session = await getSession();
    session.sessionId = userSession.id;
    session.isDemo = false;
    await session.save();

    return NextResponse.json({
      success: true,
      name: profile.name,
      canvasUserId: String(profile.id),
      displayName: profile.short_name || profile.name || null,
      avatarUrl: profile.avatar_url || null,
    });
  } catch (error) {
    console.error("Token auth error:", error);
    return NextResponse.json(
      { error: "Failed to connect. Please try again." },
      { status: 500 }
    );
  }
}
