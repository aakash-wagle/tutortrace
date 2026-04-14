import { db } from "./db";

// ── Config ───────────────────────────────────────────────────────────────────

export const CANVAS_PROXY_BASE =
  (import.meta as unknown as { env: Record<string, string> }).env?.VITE_CANVAS_PROXY_BASE ??
  "http://localhost:3001";

// ── Token refresh ─────────────────────────────────────────────────────────────

async function refreshIfExpired(userId: string): Promise<string> {
  const user = await db.users.get(userId);
  if (!user) throw new Error("User not found in Dexie");

  const isExpired =
    user.tokenExpiresAt && user.tokenExpiresAt < Date.now() + 60_000; // 1 min buffer

  if (isExpired && user.refreshToken) {
    const res = await fetch(`${CANVAS_PROXY_BASE}/auth/canvas/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: user.refreshToken }),
    });

    if (res.ok) {
      const data = (await res.json()) as {
        access_token: string;
        expires_in?: number;
      };
      await db.users.update(userId, {
        accessToken: data.access_token,
        tokenExpiresAt: data.expires_in
          ? Date.now() + data.expires_in * 1000
          : undefined,
        updatedAt: Date.now(),
      });
      return data.access_token;
    }
  }

  return user.accessToken;
}

// ── Core fetch wrapper ────────────────────────────────────────────────────────

/**
 * Makes an authenticated Canvas API request via the proxy.
 * Replaces the old server-side canvasApiFetch().
 */
export async function canvasApiFetch(
  userId: string,
  path: string,
  params?: Record<string, string>
): Promise<Response> {
  const accessToken = await refreshIfExpired(userId);

  const url = new URL(`${CANVAS_PROXY_BASE}/canvas-proxy/v1${path}`);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }

  return fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });
}

/**
 * Multi-param version for Canvas endpoints that need array params like include[].
 */
export async function canvasApiFetchMultiParam(
  userId: string,
  path: string,
  params?: URLSearchParams
): Promise<Response> {
  const accessToken = await refreshIfExpired(userId);

  const url = new URL(`${CANVAS_PROXY_BASE}/canvas-proxy/v1${path}`);
  if (params) {
    url.search = params.toString();
  }

  return fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });
}

// ── Paginated Canvas fetch (follows Link rel="next") ─────────────────────────

/**
 * Fetches all pages from a Canvas API endpoint that uses Link header pagination.
 * Equivalent to CanvasClient.get_all_pages() in the Python backend.
 */
export async function canvasGetAllPages(
  userId: string,
  path: string,
  params?: URLSearchParams
): Promise<unknown[]> {
  const results: unknown[] = [];
  let nextUrl: string | null = null;

  // Build initial URL via proxy
  const accessToken = await (async () => {
    const user = await db.users.get(userId);
    if (!user) throw new Error("User not found in Dexie");
    return user.accessToken;
  })();

  const buildProxyUrl = (p: string, ps?: URLSearchParams) => {
    const url = new URL(`${CANVAS_PROXY_BASE}/canvas-proxy/v1${p}`);
    if (ps) url.search = ps.toString();
    return url.toString();
  };

  let currentUrl = buildProxyUrl(path, params);

  while (currentUrl) {
    const res = await fetch(currentUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    });

    if (!res.ok) {
      throw new Error(`Canvas API error ${res.status} for ${currentUrl}`);
    }

    const data: unknown = await res.json();
    if (Array.isArray(data)) {
      results.push(...data);
    } else {
      results.push(data);
    }

    // Parse Link header for next page
    nextUrl = null;
    const linkHeader = res.headers.get("Link");
    if (linkHeader) {
      for (const part of linkHeader.split(",")) {
        const m = part.match(/<([^>]+)>;\s*rel="next"/);
        if (m) {
          // Rewrite the canvas URL through our proxy
          const canvasNext = m[1];
          try {
            const parsedNext = new URL(canvasNext);
            // Replace the canvas base with our proxy base; keep path after /api/v1
            const apiPath = parsedNext.pathname.replace(/^\/api\/v1/, "");
            const proxyNext = new URL(
              `${CANVAS_PROXY_BASE}/canvas-proxy/v1${apiPath}`
            );
            proxyNext.search = parsedNext.search;
            nextUrl = proxyNext.toString();
          } catch {
            nextUrl = null;
          }
          break;
        }
      }
    }
    currentUrl = nextUrl ?? "";
  }

  return results;
}

// ── Course content helpers ────────────────────────────────────────────────────

export async function fetchCourseModules(
  userId: string,
  courseId: string
): Promise<{ id: number; name: string; items?: { id: number; title: string; type: string }[] }[]> {
  const res = await canvasApiFetch(userId, `/courses/${courseId}/modules`, {
    "include[]": "items",
    per_page: "20",
  });
  if (!res.ok) return [];
  return res.json();
}

export async function fetchCoursePages(
  userId: string,
  courseId: string
): Promise<{ url: string; title: string }[]> {
  const res = await canvasApiFetch(userId, `/courses/${courseId}/pages`, {
    per_page: "20",
  });
  if (!res.ok) return [];
  return res.json();
}

export async function fetchPageContent(
  userId: string,
  courseId: string,
  pageUrl: string
): Promise<string> {
  const res = await canvasApiFetch(
    userId,
    `/courses/${courseId}/pages/${pageUrl}`
  );
  if (!res.ok) return "";
  const data = (await res.json()) as { body?: string };
  return data.body || "";
}
