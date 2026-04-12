import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForToken, CANVAS_BASE_URL } from "@/lib/canvas";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");

    if (error) {
      return NextResponse.redirect(
        new URL(`/connect?error=${encodeURIComponent(error)}`, req.url)
      );
    }

    if (!code) {
      return NextResponse.redirect(new URL("/connect?error=no_code", req.url));
    }

    const session = await getSession();
    const savedState = ((session as unknown) as Record<string, unknown>)["oauth_state"] as string | undefined;

    if (!savedState || savedState !== state) {
      return NextResponse.redirect(new URL("/connect?error=state_mismatch", req.url));
    }

    const tokenData = await exchangeCodeForToken(code);

    // Fetch Canvas profile to get displayName + avatarUrl
    let displayName: string | null = tokenData.user?.name ?? null;
    let avatarUrl: string | null = null;
    try {
      const profileRes = await fetch(`${CANVAS_BASE_URL}/api/v1/users/self/profile`, {
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
          Accept: "application/json",
        },
      });
      if (profileRes.ok) {
        const profile = (await profileRes.json()) as {
          name?: string;
          short_name?: string;
          avatar_url?: string;
        };
        displayName = profile.short_name || profile.name || displayName;
        avatarUrl = profile.avatar_url ?? null;
      }
    } catch {
      // Non-fatal — continue with token user name
    }

    const canvasUserId = String(tokenData.user?.id || "");

    // Check if this is a new user
    const existingSession = await prisma.userSession.findFirst({
      where: { canvasUserId },
    });
    const isFirstLogin = !existingSession;

    const userSession = await prisma.userSession.create({
      data: {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token || null,
        expiresAt: tokenData.expires_in
          ? new Date(Date.now() + tokenData.expires_in * 1000)
          : null,
        canvasUserId,
        canvasUrl: CANVAS_BASE_URL,
        displayName,
        avatarUrl,
      },
    });

    session.sessionId = userSession.id;
    session.isDemo = false;
    delete ((session as unknown) as Record<string, unknown>)["oauth_state"];
    await session.save();

    // Redirect with firstLogin flag so client can trigger badge + Dexie init
    const redirectUrl = isFirstLogin ? "/today?firstLogin=true" : "/today";
    return NextResponse.redirect(new URL(redirectUrl, req.url));
  } catch (error) {
    console.error("OAuth callback error:", error);
    return NextResponse.redirect(new URL("/connect?error=callback_failed", req.url));
  }
}
