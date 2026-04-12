import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/db";

export async function POST() {
  try {
    const session = await getSession();
    if (session.sessionId) {
      await prisma.userSession.delete({ where: { id: session.sessionId } }).catch(() => {});
    }
    session.destroy();
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
