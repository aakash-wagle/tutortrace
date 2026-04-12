"use client";

import { useState } from "react";
import Sidebar, { SIDEBAR_COLLAPSED_WIDTH, SIDEBAR_EXPANDED_WIDTH } from "./Sidebar";
import Topbar from "./Topbar";
import useSWR from "swr";
import { motion, AnimatePresence } from "framer-motion";
import { usePathname } from "next/navigation";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface SessionInfo {
  isDemo: boolean;
  displayName: string | null;
  avatarUrl: string | null;
  connected: boolean;
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { data: session } = useSWR<SessionInfo>("/api/auth/session", fetcher);
  const pathname = usePathname();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const sidebarWidth = sidebarCollapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_EXPANDED_WIDTH;

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed((p) => !p)}
      />
      <div
        className="flex flex-1 flex-col transition-all duration-200"
        style={{ marginLeft: sidebarWidth }}
      >
        <Topbar
          isDemo={session?.isDemo ?? true}
          displayName={session?.displayName ?? null}
          sidebarWidth={sidebarWidth}
        />
        <main className="mt-[60px] flex-1 p-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={pathname}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
