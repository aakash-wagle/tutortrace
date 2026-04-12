import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const session = await getSession();

    if (!session.sessionId) {
      return NextResponse.json({
        isDemo: true,
        displayName: null,
        avatarUrl: null,
        connected: false,
      });
    }

    const userSession = await prisma.userSession.findUnique({
      where: { id: session.sessionId },
    });

    return NextResponse.json({
      isDemo: session.isDemo ?? (!userSession?.accessToken || userSession?.isDemo),
      displayName: userSession?.displayName || null,
      avatarUrl: userSession?.avatarUrl || null,
      connected: !!userSession && !userSession.isDemo,
      canvasUserId: userSession?.canvasUserId || null,
    });
  } catch {
    return NextResponse.json({
      isDemo: true,
      displayName: null,
      avatarUrl: null,
      connected: false,
    });
  }
}
