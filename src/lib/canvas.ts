import { prisma } from "./db";

export const CANVAS_BASE_URL = process.env.CANVAS_BASE_URL || "https://psu.instructure.com";
const CANVAS_CLIENT_ID = process.env.CANVAS_CLIENT_ID || "";
const CANVAS_CLIENT_SECRET = process.env.CANVAS_CLIENT_SECRET || "";
const CANVAS_REDIRECT_URI = process.env.CANVAS_REDIRECT_URI || "";

export function getAuthorizeUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: CANVAS_CLIENT_ID,
    response_type: "code",
    redirect_uri: CANVAS_REDIRECT_URI,
    state,
    scope: "url:GET|/api/v1/courses url:GET|/api/v1/users/:user_id/courses url:GET|/api/v1/courses/:course_id/assignments url:GET|/api/v1/courses/:course_id/discussion_topics url:GET|/api/v1/courses/:course_id/activity_stream",
  });
  return `${CANVAS_BASE_URL}/login/oauth2/auth?${params.toString()}`;
}

export async function exchangeCodeForToken(code: string) {
  const res = await fetch(`${CANVAS_BASE_URL}/login/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "authorization_code",
      client_id: CANVAS_CLIENT_ID,
      client_secret: CANVAS_CLIENT_SECRET,
      redirect_uri: CANVAS_REDIRECT_URI,
      code,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token exchange failed: ${res.status} ${text}`);
  }

  return res.json() as Promise<{
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
    token_type: string;
    user: { id: number; name: string };
  }>;
}

export async function refreshAccessToken(refreshToken: string) {
  const res = await fetch(`${CANVAS_BASE_URL}/login/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "refresh_token",
      client_id: CANVAS_CLIENT_ID,
      client_secret: CANVAS_CLIENT_SECRET,
      refresh_token: refreshToken,
    }),
  });

  if (!res.ok) {
    throw new Error(`Token refresh failed: ${res.status}`);
  }

  return res.json() as Promise<{
    access_token: string;
    expires_in?: number;
    token_type: string;
  }>;
}

export async function canvasApiFetch(
  sessionId: string,
  path: string,
  params?: Record<string, string>
): Promise<Response> {
  const session = await prisma.userSession.findUnique({
    where: { id: sessionId },
  });

  if (!session) throw new Error("No session found");

  if (session.expiresAt && session.expiresAt < new Date() && session.refreshToken) {
    const refreshed = await refreshAccessToken(session.refreshToken);
    await prisma.userSession.update({
      where: { id: sessionId },
      data: {
        accessToken: refreshed.access_token,
        expiresAt: refreshed.expires_in
          ? new Date(Date.now() + refreshed.expires_in * 1000)
          : null,
      },
    });
    session.accessToken = refreshed.access_token;
  }

  const url = new URL(`/api/v1${path}`, session.canvasUrl || CANVAS_BASE_URL);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }

  return fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${session.accessToken}`,
      Accept: "application/json",
    },
  });
}

// Multi-param version for Canvas endpoints that need array params like include[]
export async function canvasApiFetchMultiParam(
  sessionId: string,
  path: string,
  params?: URLSearchParams
): Promise<Response> {
  const session = await prisma.userSession.findUnique({
    where: { id: sessionId },
  });

  if (!session) throw new Error("No session found");

  if (session.expiresAt && session.expiresAt < new Date() && session.refreshToken) {
    const refreshed = await refreshAccessToken(session.refreshToken);
    await prisma.userSession.update({
      where: { id: sessionId },
      data: {
        accessToken: refreshed.access_token,
        expiresAt: refreshed.expires_in
          ? new Date(Date.now() + refreshed.expires_in * 1000)
          : null,
      },
    });
    session.accessToken = refreshed.access_token;
  }

  const url = new URL(`/api/v1${path}`, session.canvasUrl || CANVAS_BASE_URL);
  if (params) {
    url.search = params.toString();
  }

  return fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${session.accessToken}`,
      Accept: "application/json",
    },
  });
}

export async function fetchCourseModules(
  sessionId: string,
  courseId: string
): Promise<{ id: number; name: string; items?: { id: number; title: string; type: string }[] }[]> {
  const res = await canvasApiFetch(sessionId, `/courses/${courseId}/modules`, {
    "include[]": "items",
    per_page: "20",
  });
  if (!res.ok) return [];
  return res.json();
}

export async function fetchCoursePages(
  sessionId: string,
  courseId: string
): Promise<{ url: string; title: string }[]> {
  const res = await canvasApiFetch(sessionId, `/courses/${courseId}/pages`, {
    per_page: "20",
  });
  if (!res.ok) return [];
  return res.json();
}

export async function fetchPageContent(
  sessionId: string,
  courseId: string,
  pageUrl: string
): Promise<string> {
  const res = await canvasApiFetch(
    sessionId,
    `/courses/${courseId}/pages/${pageUrl}`
  );
  if (!res.ok) return "";
  const data = await res.json();
  return data.body || "";
}
