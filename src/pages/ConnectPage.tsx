import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Loader2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { useGamification } from "@/contexts/GamificationContext";
import { db } from "@/lib/db";
import { syncCanvasDataToDexie } from "@/lib/canvas-sync";
import { CANVAS_PROXY_BASE } from "@/lib/canvas";

const ERROR_MESSAGES: Record<string, string> = {
  state_mismatch: "Authentication failed: invalid state. Please try again.",
  callback_failed: "OAuth login failed. Please try again or use a token.",
  no_code: "Authorization was cancelled. Please try again.",
  access_denied: "Canvas access was denied. Please authorize TutorTrace.",
  invalid_state: "Authentication failed: invalid state. Please try again.",
};

export default function ConnectPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const { unlockBadge, logActivity } = useGamification();

  useEffect(() => {
    const errParam = searchParams.get("error");
    if (errParam) {
      setError(ERROR_MESSAGES[errParam] ?? `Error: ${errParam}`);
    }
  }, [searchParams]);

  const handleConnect = async () => {
    const trimmed = token.trim();
    if (!trimmed) {
      setError("Please enter your Canvas API token.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${CANVAS_PROXY_BASE}/auth/canvas/token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: trimmed }),
      });
      let data: { error?: string; canvasUserId?: string; userId?: string; displayName?: string; avatarUrl?: string };
      try {
        data = await res.json();
      } catch {
        setError(
          `Unexpected response from ${CANVAS_PROXY_BASE}. Is the proxy running? Try: npm run proxy:dev`
        );
        setLoading(false);
        return;
      }
      if (!res.ok) {
        setError(data.error || "Failed to connect. Please check your token.");
        setLoading(false);
        return;
      }
      const userId = data.canvasUserId ?? data.userId ?? "token-user";
      await initUserDexie(userId, data.displayName ?? "Student", trimmed, data.avatarUrl);
      syncCanvasDataToDexie(userId).catch(() => {});
      await unlockBadge("first_login");
      await logActivity("login");
      navigate("/today");
    } catch (e) {
      const network =
        e instanceof TypeError ||
        (e instanceof Error && /failed to fetch|networkerror|load failed/i.test(e.message));
      setError(
        network
          ? `Cannot reach Canvas proxy at ${CANVAS_PROXY_BASE}. In a separate terminal run: npm run proxy:dev`
          : "Connection failed. Please try again."
      );
      setLoading(false);
    }
  };

  const handleOAuth = () => {
    window.location.href = `${CANVAS_PROXY_BASE}/auth/canvas/start`;
  };

  const handleDemo = async () => {
    await db.users.put({
      id: "demo",
      displayName: "Demo Student",
      accessToken: "demo",
      isDemo: true,
      updatedAt: Date.now(),
    });
    const gamRow = await db.gamification.get("demo");
    if (!gamRow) {
      await db.gamification.put({
        userId: "demo", xp: 120, level: 2, coins: 200, streak: 3,
        longestStreak: 5, lastActivityDate: null, updatedAt: Date.now(),
      });
    }
    navigate("/today");
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background">
      {/* Decorative blobs */}
      <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-accent/20" />
      <div className="absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-accent/10" />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.34, 1.56, 0.64, 1] }}
        className="relative z-10 w-[90%] max-w-[700px]"
      >
        <div className="flex flex-col items-center gap-8 rounded-2xl border-2 border-border bg-card p-8 shadow-neo md:flex-row md:p-12">
          {/* Illustration */}
          <div className="relative flex h-40 w-40 flex-shrink-0 items-center justify-center md:h-48 md:w-48">
            <div className="absolute left-4 top-1 h-32 w-32 rounded-full bg-yellow-100 opacity-60" />
            <div className="absolute bottom-4 left-0 h-16 w-16 rounded-full bg-accent/20" />
            <div className="relative z-10 flex h-16 w-16 flex-col items-center justify-center gap-1 rounded-xl bg-accent/60 p-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-1 w-3/4 rounded-full bg-white/70" />
              ))}
            </div>
            <div className="absolute bottom-1 right-6 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-accent/60 text-xl">
              😊
            </div>
          </div>

          {/* Content */}
          <div className="w-full flex-1 text-center md:text-left">
            <h1 className="mb-1 text-2xl font-bold tracking-tight md:text-3xl">
              Connect to Canvas
            </h1>
            <p className="mb-6 text-sm text-muted-foreground leading-relaxed">
              Sign in with your PSU account or paste a Canvas API token
            </p>

            {error && (
              <div className="mb-4 rounded-xl border-2 border-destructive/40 bg-red-50 px-4 py-3 text-sm font-medium text-destructive">
                {error}
              </div>
            )}

            <Button
              className="mb-3 w-full border-2 py-6 text-base font-bold shadow-neo transition-all hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-neo-lg"
              onClick={handleOAuth}
              disabled={loading}
            >
              🎓 Sign in with PSU Canvas
            </Button>

            <div className="relative my-5 flex items-center gap-3">
              <Separator className="flex-1" />
              <span className="text-xs text-muted-foreground">or use a token</span>
              <Separator className="flex-1" />
            </div>

            <Input
              placeholder="Paste your Canvas API token..."
              value={token}
              onChange={(e) => { setToken(e.target.value); setError(null); }}
              onKeyDown={(e) => e.key === "Enter" && handleConnect()}
              type="password"
              disabled={loading}
              className="mb-3"
            />

            <Button
              variant="outline"
              className="mb-3 w-full border-2 py-5"
              onClick={handleConnect}
              disabled={loading || !token.trim()}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Connect with Token"
              )}
            </Button>

            <Button
              variant="ghost"
              className="w-full py-4 text-muted-foreground"
              onClick={handleDemo}
              disabled={loading}
            >
              Explore Demo Mode
            </Button>

            <div className="mt-5 text-center">
              <button
                className="text-xs text-muted-foreground underline-offset-2 hover:underline"
                onClick={() => setShowHelp(!showHelp)}
              >
                {showHelp ? "Hide instructions" : "How do I get a token?"}
              </button>
            </div>

            {showHelp && (
              <div className="mt-3 rounded-xl bg-muted p-4 text-left">
                <p className="mb-2 text-sm font-semibold">Generate a Canvas API Token:</p>
                <ol className="space-y-1 text-xs leading-relaxed text-muted-foreground">
                  <li>1. Log in to psu.instructure.com <ExternalLink className="inline h-3 w-3" /></li>
                  <li>2. Go to <strong>Account</strong> → <strong>Settings</strong></li>
                  <li>3. Scroll to <strong>Approved Integrations</strong></li>
                  <li>4. Click <strong>+ New Access Token</strong></li>
                  <li>5. Enter &quot;TutorTrace&quot; and click <strong>Generate Token</strong></li>
                  <li>6. Copy the token and paste it above</li>
                </ol>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

async function initUserDexie(
  userId: string,
  displayName: string,
  accessToken: string,
  avatarUrl?: string
) {
  await db.users.put({
    id: userId,
    displayName,
    avatarUrl,
    accessToken,
    isDemo: false,
    updatedAt: Date.now(),
  });
  const gamRow = await db.gamification.get(userId);
  if (!gamRow) {
    await db.gamification.put({
      userId, xp: 0, level: 1, coins: 100, streak: 0,
      longestStreak: 0, lastActivityDate: null, updatedAt: Date.now(),
    });
  }
}
