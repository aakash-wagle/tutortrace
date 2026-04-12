import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { db } from "@/lib/db";
import { syncCanvasDataToDexie } from "@/lib/canvas-sync";
import { useGamification } from "@/contexts/GamificationContext";

export default function CanvasCallbackPage() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const { unlockBadge, logActivity } = useGamification();

  useEffect(() => {
    // Check for query-string error first (e.g. ?error=access_denied)
    const queryError = new URLSearchParams(window.location.search).get("error");
    if (queryError) {
      navigate(`/connect?error=${encodeURIComponent(queryError)}`);
      return;
    }

    // Token data arrives in the URL fragment to avoid server logs
    const hash = window.location.hash.slice(1);
    const params = new URLSearchParams(hash);

    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token") ?? undefined;
    const expiresIn = params.get("expires_in");
    const userId = params.get("user_id");
    const name = params.get("name") ?? "Student";
    const avatarUrl = params.get("avatar_url") ?? undefined;

    if (!accessToken || !userId) {
      navigate("/connect?error=callback_failed");
      return;
    }

    // Clear fragment from URL
    window.history.replaceState({}, "", window.location.pathname);

    const init = async () => {
      try {
        await db.users.put({
          id: userId,
          displayName: name,
          avatarUrl,
          accessToken,
          refreshToken,
          tokenExpiresAt: expiresIn ? Date.now() + parseInt(expiresIn) * 1000 : undefined,
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

        syncCanvasDataToDexie(userId).catch(() => {});
        await unlockBadge("first_login");
        await logActivity("login");
        navigate("/today?firstLogin=true");
      } catch {
        setError("Failed to save session. Please try again.");
      }
    };

    init();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <p className="mb-4 text-base font-semibold text-destructive">{error}</p>
          <button
            onClick={() => navigate("/connect")}
            className="text-sm underline text-muted-foreground hover:text-foreground"
          >
            Back to Connect
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
        <p className="text-sm text-muted-foreground">Connecting to Canvas…</p>
      </div>
    </div>
  );
}
