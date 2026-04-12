"use client";

import { ReactNode } from "react";
import { motion } from "framer-motion";

// ── Container — staggers children entrance ────────────────────────────────────

const containerVariants = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.06,
    },
  },
};

export function AnimatedCardList({ children }: { children: ReactNode }) {
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
    >
      {children}
    </motion.div>
  );
}

// ── Item — spring entrance ────────────────────────────────────────────────────

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      type: "spring" as const,
      stiffness: 280,
      damping: 22,
    },
  },
};

export function AnimatedCard({
  children,
  style,
}: {
  children: ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <motion.div variants={itemVariants} style={style}>
      {children}
    </motion.div>
  );
}
