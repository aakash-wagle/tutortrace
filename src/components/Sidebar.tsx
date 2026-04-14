"use client";

import { useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useGamification } from "@/contexts/GamificationContext";
import {
  LayoutDashboard,
  GraduationCap,
  BookOpen,
  Layers,
  CalendarDays,
  BarChart2,
  MessageSquare,
  Target,
  Trophy,
  Settings,
  HelpCircle,
  ChevronLeft,
  ChevronRight,
  Flame,
  BookMarked,
  ListTodo,
  TrendingUp,
} from "lucide-react";

export const SIDEBAR_EXPANDED_WIDTH = 240;
export const SIDEBAR_COLLAPSED_WIDTH = 72;

const mainNav = [
  { label: "Today", icon: LayoutDashboard, href: "/today" },
  { label: "Courses", icon: GraduationCap, href: "/courses" },
  { label: "My Courses", icon: BookMarked, href: "/my-courses" },
  { label: "Coach", icon: BookOpen, href: "/coach" },
  { label: "Flashcards", icon: Layers, href: "/flashcards" },
  { label: "Weekly Planner", icon: ListTodo, href: "/weekly-planner" },
  { label: "Calendar", icon: CalendarDays, href: "/calendar" },
  { label: "Grades", icon: BarChart2, href: "/grades" },
  { label: "Analytics", icon: TrendingUp, href: "/analytics" },
  { label: "Messages", icon: MessageSquare, href: "/messages" },
  { label: "Accountability", icon: Target, href: "/accountability" },
  { label: "Achievements", icon: Trophy, href: "/achievements" },
];

const bottomNav = [
  { label: "Settings", icon: Settings, href: "/settings" },
  { label: "Help", icon: HelpCircle, href: "#" },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export default function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { xp, level, xpProgress, xpToNext, streak, isLoaded } = useGamification();

  const isActive = (href: string) => {
    if (href === "#") return false;
    if (href === "/today") return pathname === "/today";
    return pathname.startsWith(href);
  };

  function NavItem({
    icon: Icon,
    label,
    href,
  }: {
    icon: React.ElementType;
    label: string;
    href: string;
  }) {
    const active = isActive(href);
    return (
      <motion.button
        onClick={() => href !== "#" && navigate(href)}
        className={cn(
          "flex w-full items-center rounded-xl px-3 py-2.5 text-left transition-colors",
          collapsed ? "justify-center gap-0" : "gap-3",
          active
            ? "bg-accent text-accent-foreground font-semibold"
            : "text-sidebar-foreground/70 hover:bg-muted hover:text-sidebar-foreground"
        )}
        whileHover={{ x: collapsed ? 0 : 2 }}
        whileTap={{ scale: 0.97 }}
      >
        <Icon className="h-5 w-5 flex-shrink-0" />
        {!collapsed && <span className="text-sm font-medium">{label}</span>}
      </motion.button>
    );
  }

  return (
    <motion.aside
      className="fixed left-0 top-0 z-[1200] flex h-screen flex-col border-r-2 border-sidebar-border bg-sidebar overflow-hidden"
      initial={false}
      animate={{ width: collapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_EXPANDED_WIDTH }}
      transition={{ duration: 0.2, ease: "easeInOut" }}
    >
      {/* Logo */}
      <div
        className={cn(
          "flex items-center py-4 flex-shrink-0",
          collapsed ? "justify-center px-0" : "gap-3 px-4"
        )}
      >
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground font-bold text-sm">
          S
        </div>
        {!collapsed && (
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="font-bold text-lg text-sidebar-foreground tracking-tight whitespace-nowrap"
          >
            StudyHub
          </motion.span>
        )}
      </div>

      {/* Main nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-0.5">
        {!collapsed && (
          <p className="px-3 pb-2 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/50">
            Study
          </p>
        )}
        {mainNav.map((item) => (
          <NavItem key={item.label} icon={item.icon} label={item.label} href={item.href} />
        ))}
      </nav>

      {/* XP + Streak Panel */}
      {isLoaded && !collapsed && (
        <div className="mx-3 mb-3 rounded-xl border-2 border-border bg-muted p-3 shadow-neo-brown flex-shrink-0">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-bold text-foreground">Level {level}</span>
            <span className="text-xs text-muted-foreground">{xp} XP</span>
          </div>
          <div className="mb-1 h-1.5 overflow-hidden rounded-full bg-border/30">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-accent to-secondary"
              initial={{ width: 0 }}
              animate={{ width: `${xpProgress}%` }}
              transition={{ duration: 0.9, ease: [0.34, 1.56, 0.64, 1] }}
            />
          </div>
          <p className="text-[10px] text-muted-foreground">
            {xpToNext} XP to Level {level + 1}
          </p>
          <div className="mt-3 flex items-center gap-2 border-t border-border/30 pt-2">
            <motion.span
              animate={{ scale: [1, 1.25, 1] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              className="text-base leading-none"
            >
              🔥
            </motion.span>
            <span className="text-xs font-semibold text-foreground">{streak} day streak</span>
          </div>
        </div>
      )}

      {/* Collapsed XP indicator */}
      {isLoaded && collapsed && (
        <div className="mb-3 flex flex-col items-center gap-2 px-2 flex-shrink-0">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted border-2 border-border">
            <span className="text-xs font-bold text-foreground">{level}</span>
          </div>
          <div className="flex items-center gap-1">
            <Flame className="h-4 w-4 text-accent" />
            <span className="text-xs font-semibold text-foreground">{streak}</span>
          </div>
        </div>
      )}

      {/* Bottom nav */}
      <div className="flex-shrink-0 border-t-2 border-sidebar-border px-3 pb-4 pt-2 space-y-0.5">
        {bottomNav.map((item) => (
          <NavItem key={item.label} icon={item.icon} label={item.label} href={item.href} />
        ))}
      </div>

      {/* Collapse toggle */}
      <button
        onClick={onToggle}
        className="absolute -right-3.5 top-20 flex h-7 w-7 items-center justify-center rounded-full border-2 border-sidebar-border bg-sidebar text-sidebar-foreground hover:bg-accent hover:text-accent-foreground transition-colors z-10"
      >
        {collapsed ? (
          <ChevronRight className="h-4 w-4" />
        ) : (
          <ChevronLeft className="h-4 w-4" />
        )}
      </button>
    </motion.aside>
  );
}

// Backwards-compatible alias used by Topbar
export { SIDEBAR_EXPANDED_WIDTH as SIDEBAR_WIDTH };
