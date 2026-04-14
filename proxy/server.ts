/**
 * TutorTrace Thin Proxy Server
 *
 * Handles exactly three concerns that cannot be done from the browser:
 *   1. Canvas CORS bypass — forwards Canvas API requests from the SPA
 *   2. OAuth2 callback — holds CANVAS_CLIENT_SECRET and exchanges auth codes
 *   3. Token validation — validates personal access tokens against Canvas profile
 *
 * The CANVAS_CLIENT_SECRET never leaves this process.
 */

import express, { type Request, type Response } from "express";
import cors from "cors";
import * as dotenv from "dotenv";
import * as crypto from "crypto";
import * as path from "path";
import { fileURLToPath } from "url";

const _filename = fileURLToPath(import.meta.url);
const _dirname = path.dirname(_filename);

dotenv.config({ path: path.join(_dirname, "../.env") });

const app = express();
app.use(express.json());
app.use(
  cors({
    origin: process.env.SPA_ORIGIN ?? "http://localhost:5173",
    credentials: true,
  })
);

const CANVAS_BASE_URL = process.env.CANVAS_BASE_URL ?? "https://psu.instructure.com";
const CANVAS_CLIENT_ID = process.env.CANVAS_CLIENT_ID ?? "";
const CANVAS_CLIENT_SECRET = process.env.CANVAS_CLIENT_SECRET ?? "";
const CANVAS_REDIRECT_URI = process.env.CANVAS_REDIRECT_URI ?? "";
const SPA_ORIGIN = process.env.SPA_ORIGIN ?? "http://localhost:5173";
const PORT = parseInt(process.env.PORT ?? "3001", 10);

// ── In-memory OAuth state store (expires after 10 min) ────────────────────────

const stateStore = new Map<string, number>();

function cleanExpiredStates() {
  const now = Date.now();
  for (const [key, ts] of stateStore) {
    if (now - ts > 10 * 60 * 1000) stateStore.delete(key);
  }
}

// ── Canvas API Proxy ──────────────────────────────────────────────────────────

app.use("/canvas-proxy", async (req: Request, res: Response) => {
  const canvasToken = req.headers.authorization;
  if (!canvasToken) {
    res.status(401).json({ error: "Missing Authorization header" });
    return;
  }

  // Strip /canvas-proxy prefix to get the raw Canvas path.
  // Use req.url (path + raw query string relative to mount point) to preserve
  // repeated params like include[]=submission&include[]=score_statistics exactly
  // as sent — Express's req.query parses them as arrays, and rebuilding via
  // new URLSearchParams(req.query) would join them as "submission,score_statistics"
  // which Canvas does not understand.
  const canvasPath = req.path; // e.g. /v1/courses
  const rawQueryIdx = req.url.indexOf("?");
  const query = rawQueryIdx !== -1 ? req.url.slice(rawQueryIdx) : "";
  const canvasUrl = `${CANVAS_BASE_URL}/api${canvasPath}${query}`;

  try {
    const upstream = await fetch(canvasUrl, {
      method: req.method,
      headers: {
        Authorization: canvasToken,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: req.method !== "GET" && req.method !== "HEAD" ? JSON.stringify(req.body) : undefined,
    });

    const contentType = upstream.headers.get("content-type") ?? "";
    const body = contentType.includes("application/json")
      ? await upstream.json()
      : await upstream.text();

    res.status(upstream.status).json(body);
  } catch (err) {
    console.error("Canvas proxy error:", err);
    res.status(502).json({ error: "Canvas API unreachable" });
  }
});

// ── OAuth2: Start ──────────────────────────────────────────────────────────────

app.get("/auth/canvas/start", (_req: Request, res: Response) => {
  cleanExpiredStates();
  const state = crypto.randomBytes(16).toString("hex");
  stateStore.set(state, Date.now());

  const params = new URLSearchParams({
    client_id: CANVAS_CLIENT_ID,
    response_type: "code",
    redirect_uri: CANVAS_REDIRECT_URI,
    state,
    scope: [
      "url:GET|/api/v1/courses",
      "url:GET|/api/v1/users/:user_id/courses",
      "url:GET|/api/v1/courses/:course_id/assignments",
      "url:GET|/api/v1/courses/:course_id/discussion_topics",
      "url:GET|/api/v1/courses/:course_id/activity_stream",
    ].join(" "),
  });

  res.redirect(`${CANVAS_BASE_URL}/login/oauth2/auth?${params.toString()}`);
});

// ── OAuth2: Callback ───────────────────────────────────────────────────────────

app.get("/auth/canvas/callback", async (req: Request, res: Response) => {
  const { code, state, error } = req.query as Record<string, string>;

  if (error) {
    res.redirect(`${SPA_ORIGIN}/callback?error=${encodeURIComponent(error)}`);
    return;
  }

  if (!state || !stateStore.has(state)) {
    res.redirect(`${SPA_ORIGIN}/callback?error=invalid_state`);
    return;
  }
  stateStore.delete(state);

  try {
    const tokenRes = await fetch(`${CANVAS_BASE_URL}/login/oauth2/token`, {
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

    if (!tokenRes.ok) {
      res.redirect(`${SPA_ORIGIN}/callback?error=token_exchange_failed`);
      return;
    }

    const tokenData = (await tokenRes.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
      user?: { id: number; name: string };
    };

    // Fetch user profile to get avatar
    const profileRes = await fetch(
      `${CANVAS_BASE_URL}/api/v1/users/self/profile`,
      { headers: { Authorization: `Bearer ${tokenData.access_token}` } }
    );
    const profile = profileRes.ok
      ? ((await profileRes.json()) as { id: number; name: string; avatar_url?: string })
      : { id: tokenData.user?.id ?? 0, name: tokenData.user?.name ?? "Student", avatar_url: undefined };

    // Pass token to SPA via URL fragment (never visible in server logs)
    const fragment = new URLSearchParams({
      access_token: tokenData.access_token,
      ...(tokenData.refresh_token ? { refresh_token: tokenData.refresh_token } : {}),
      ...(tokenData.expires_in ? { expires_in: String(tokenData.expires_in) } : {}),
      user_id: String(profile.id),
      name: profile.name,
      ...(profile.avatar_url ? { avatar_url: profile.avatar_url } : {}),
    });

    res.redirect(`${SPA_ORIGIN}/callback#${fragment.toString()}`);
  } catch (err) {
    console.error("OAuth callback error:", err);
    res.redirect(`${SPA_ORIGIN}/callback?error=server_error`);
  }
});

// ── Personal Access Token Validation ──────────────────────────────────────────

app.post("/auth/canvas/token", async (req: Request, res: Response) => {
  const { token } = req.body as { token?: string };
  if (!token) {
    res.status(400).json({ error: "token required" });
    return;
  }

  try {
    const profileRes = await fetch(`${CANVAS_BASE_URL}/api/v1/users/self/profile`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!profileRes.ok) {
      res.status(401).json({ error: "Invalid Canvas token" });
      return;
    }

    const profile = (await profileRes.json()) as {
      id: number;
      name: string;
      avatar_url?: string;
    };

    res.json({
      canvasUserId: String(profile.id),
      displayName: profile.name,
      avatarUrl: profile.avatar_url ?? null,
    });
  } catch (err) {
    console.error("Token validation error:", err);
    res.status(502).json({ error: "Canvas unreachable" });
  }
});

// ── Token Refresh ──────────────────────────────────────────────────────────────

app.post("/auth/canvas/refresh", async (req: Request, res: Response) => {
  const { refresh_token } = req.body as { refresh_token?: string };
  if (!refresh_token) {
    res.status(400).json({ error: "refresh_token required" });
    return;
  }

  try {
    const tokenRes = await fetch(`${CANVAS_BASE_URL}/login/oauth2/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "refresh_token",
        client_id: CANVAS_CLIENT_ID,
        client_secret: CANVAS_CLIENT_SECRET,
        refresh_token,
      }),
    });

    if (!tokenRes.ok) {
      res.status(401).json({ error: "Refresh failed" });
      return;
    }

    const data = (await tokenRes.json()) as {
      access_token: string;
      expires_in?: number;
    };
    res.json(data);
  } catch (err) {
    console.error("Token refresh error:", err);
    res.status(502).json({ error: "Canvas unreachable" });
  }
});

// ── Health check ──────────────────────────────────────────────────────────────

app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", canvas: CANVAS_BASE_URL });
});

app.listen(PORT, () => {
  console.log(`TutorTrace proxy listening on http://localhost:${PORT}`);
  console.log(`  Canvas base: ${CANVAS_BASE_URL}`);
  console.log(`  SPA origin:  ${SPA_ORIGIN}`);
});
