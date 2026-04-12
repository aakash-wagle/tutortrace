"use client";

import { motion } from "framer-motion";

export type OwlMood =
  | "default"
  | "celebrating"
  | "thinking"
  | "encouraging"
  | "sleeping";

export type OwlSize = "sm" | "md" | "lg";

const SIZE_MAP: Record<OwlSize, number> = {
  sm: 56,
  md: 96,
  lg: 128,
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const moodAnimations: Record<OwlMood, any> = {
  default: {
    y: [0, -6, 0],
    transition: { duration: 2.5, repeat: Infinity, ease: "easeInOut" },
  },
  celebrating: {
    y: [0, -12, 0],
    scale: [1, 1.08, 1],
    transition: { duration: 0.5, repeat: 4, ease: "easeOut" },
  },
  thinking: {
    x: [0, 4, -4, 0],
    transition: { duration: 1.6, repeat: Infinity, ease: "easeInOut" },
  },
  encouraging: {
    rotate: [0, 10, -6, 8, 0],
    transition: { duration: 0.7, repeat: 2 },
  },
  sleeping: {
    rotate: [0, 2, 0, -2, 0],
    transition: { duration: 3.5, repeat: Infinity, ease: "easeInOut" },
  },
};

// ── SVG Owl ───────────────────────────────────────────────────────────────────

function OwlSVG({ size, mood }: { size: number; mood: OwlMood }) {
  const sleepy = mood === "sleeping";
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 80 80"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Body */}
      <ellipse cx="40" cy="50" rx="22" ry="26" fill="#C49A6C" />
      {/* Belly */}
      <ellipse cx="40" cy="54" rx="13" ry="17" fill="#F5DEB3" />
      {/* Head */}
      <ellipse cx="40" cy="28" rx="20" ry="18" fill="#C49A6C" />
      {/* Ear tufts */}
      <polygon points="24,14 20,4 28,12" fill="#8B6F5E" />
      <polygon points="56,14 60,4 52,12" fill="#8B6F5E" />
      {/* Wing left */}
      <ellipse
        cx="20"
        cy="52"
        rx="8"
        ry="14"
        fill="#A0785A"
        transform="rotate(-15 20 52)"
      />
      {/* Wing right */}
      <ellipse
        cx="60"
        cy="52"
        rx="8"
        ry="14"
        fill="#A0785A"
        transform="rotate(15 60 52)"
      />
      {/* Eyes */}
      {sleepy ? (
        <>
          {/* Closed/sleepy eyes */}
          <ellipse cx="31" cy="27" rx="7" ry="4" fill="#F5DEB3" />
          <ellipse cx="49" cy="27" rx="7" ry="4" fill="#F5DEB3" />
          <line x1="24" y1="27" x2="38" y2="27" stroke="#5C3D11" strokeWidth="2" strokeLinecap="round" />
          <line x1="42" y1="27" x2="56" y2="27" stroke="#5C3D11" strokeWidth="2" strokeLinecap="round" />
        </>
      ) : (
        <>
          <ellipse cx="31" cy="27" rx="7" ry="7.5" fill="#F5DEB3" />
          <ellipse cx="49" cy="27" rx="7" ry="7.5" fill="#F5DEB3" />
          <circle cx="31" cy="27" r="4.5" fill="#5C3D11" />
          <circle cx="49" cy="27" r="4.5" fill="#5C3D11" />
          {/* Eye shine */}
          <circle cx="33" cy="25" r="1.5" fill="white" />
          <circle cx="51" cy="25" r="1.5" fill="white" />
        </>
      )}
      {/* Beak */}
      <polygon points="40,32 35,38 45,38" fill="#E8973A" />
      {/* Graduation cap */}
      <rect x="22" y="11" width="36" height="5" rx="1" fill="#8B6F5E" />
      <polygon points="40,6 26,11 54,11" fill="#8B6F5E" />
      <line x1="54" y1="11" x2="58" y2="18" stroke="#8B6F5E" strokeWidth="2" />
      <circle cx="58" cy="19" r="2" fill="#D4A59A" />
      {/* Feet */}
      <ellipse cx="32" cy="74" rx="6" ry="3" fill="#E8973A" />
      <ellipse cx="48" cy="74" rx="6" ry="3" fill="#E8973A" />
    </svg>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

interface StudyOwlProps {
  mood?: OwlMood;
  size?: OwlSize;
  animate?: boolean;
}

export function StudyOwl({
  mood = "default",
  size = "md",
  animate = true,
}: StudyOwlProps) {
  const px = SIZE_MAP[size];
  return (
    <motion.div
      animate={animate ? moodAnimations[mood] : {}}
      style={{ display: "inline-block", userSelect: "none" }}
    >
      <OwlSVG size={px} mood={mood} />
    </motion.div>
  );
}
