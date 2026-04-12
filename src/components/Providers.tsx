"use client";

import { ReactNode } from "react";
import ThemeRegistry from "@/theme/ThemeRegistry";
import { GamificationProvider } from "@/contexts/GamificationContext";
import { Toaster } from "@/components/ui/sonner";

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeRegistry>
      <GamificationProvider>{children}</GamificationProvider>
      <Toaster position="bottom-right" />
    </ThemeRegistry>
  );
}
