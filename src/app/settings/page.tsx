"use client";

import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import useSWR from "swr";
import { Settings } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import AppShell from "@/components/AppShell";
import { db } from "@/lib/dexie";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface SessionInfo {
  isDemo: boolean;
  displayName: string | null;
  avatarUrl: string | null;
  connected: boolean;
  canvasUserId?: string;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="mb-5 border-2">
      <CardContent className="p-5">
        <p className="mb-4 text-sm font-bold text-accent">{title}</p>
        {children}
      </CardContent>
    </Card>
  );
}

export default function SettingsPage() {
  const { data: session } = useSWR<SessionInfo>("/api/auth/session", fetcher);
  const { theme, setTheme } = useTheme();
  const [streakReminders, setStreakReminders] = useState(false);

  useEffect(() => {
    setStreakReminders(localStorage.getItem("streakReminders") === "true");
  }, []);

  const handleStreakToggle = (checked: boolean) => {
    setStreakReminders(checked);
    localStorage.setItem("streakReminders", String(checked));
    toast.success("Preference saved");
  };

  const handleDarkToggle = (checked: boolean) => {
    setTheme(checked ? "dark" : "light");
    toast.success("Theme updated");
  };

  const handleExportData = async () => {
    try {
      const [gamification, badges, activityLog, xpEvents, courses, assignments] =
        await Promise.all([
          db.gamification.toArray(),
          db.badges.toArray(),
          db.activityLog.toArray(),
          db.xpEvents.toArray(),
          db.courses.toArray(),
          db.assignments.toArray(),
        ]);

      const blob = new Blob(
        [JSON.stringify({ gamification, badges, activityLog, xpEvents, courses, assignments }, null, 2)],
        { type: "application/json" }
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `studyhub-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Data exported");
    } catch {
      toast.error("Export failed");
    }
  };

  const handleClearData = async () => {
    if (!confirm("This will clear all local progress, streaks, and achievements. Are you sure?")) return;
    await db.delete();
    window.location.reload();
  };

  const initials = session?.displayName
    ? session.displayName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : "?";

  return (
    <AppShell>
      <div className="mb-0.5 flex items-center gap-2">
        <Settings className="h-7 w-7 text-foreground" />
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
      </div>
      <p className="mb-6 text-sm text-muted-foreground">Manage your account and preferences</p>

      {/* Account */}
      <Section title="Account">
        <div className="mb-4 flex items-center gap-3">
          <Avatar className="h-14 w-14 border-2">
            <AvatarImage src={session?.avatarUrl ?? undefined} />
            <AvatarFallback className="bg-accent text-white text-lg font-bold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="font-semibold">{session?.displayName ?? "—"}</p>
            <p className="text-xs text-muted-foreground">
              {session?.isDemo ? "Demo Mode" : session?.connected ? "Connected to Canvas" : "Not connected"}
            </p>
          </div>
        </div>
        <Separator className="mb-4" />
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            className="border-2"
            onClick={() => (window.location.href = "/api/auth/canvas/start")}
          >
            Reconnect Canvas
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="border-2 text-destructive hover:bg-destructive/10"
            onClick={async () => {
              await fetch("/api/auth/logout", { method: "POST" });
              window.location.href = "/connect";
            }}
          >
            Sign Out
          </Button>
        </div>
      </Section>

      {/* Notifications */}
      <Section title="Notifications">
        <div className="flex items-center justify-between">
          <div>
            <Label htmlFor="streak-reminders" className="text-sm font-medium">
              Streak Reminders
            </Label>
            <p className="text-xs text-muted-foreground">
              Remind me to study before my streak resets
            </p>
          </div>
          <Switch
            id="streak-reminders"
            checked={streakReminders}
            onCheckedChange={handleStreakToggle}
          />
        </div>
      </Section>

      {/* Appearance */}
      <Section title="Appearance">
        <div className="flex items-center justify-between">
          <div>
            <Label htmlFor="dark-mode" className="text-sm font-medium">
              Dark Mode
            </Label>
            <p className="text-xs text-muted-foreground">
              Switch to a dark color scheme
            </p>
          </div>
          <Switch
            id="dark-mode"
            checked={theme === "dark"}
            onCheckedChange={handleDarkToggle}
          />
        </div>
      </Section>

      {/* Data */}
      <Section title="Your Data">
        <p className="mb-4 text-sm text-muted-foreground">
          All progress is stored locally in your browser. Export a backup or clear all local data below.
        </p>
        <div className="mb-4 flex flex-wrap gap-2">
          <Button variant="outline" size="sm" className="border-2" onClick={handleExportData}>
            Export my data
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="border-2 text-destructive hover:bg-destructive/10"
            onClick={handleClearData}
          >
            Clear local data
          </Button>
        </div>
        <div className="rounded-xl border-2 border-blue-200 bg-blue-50 p-3 text-xs text-blue-800">
          StudyHub works offline. Your progress is saved in your browser and synced to the cloud when you&apos;re online.
        </div>
      </Section>
    </AppShell>
  );
}
