"use client";

import React, { memo } from "react";
import { motion } from "framer-motion";

type StatusPulseProps = {
  tone: "success" | "warning" | "danger" | "muted";
};

const toneClass: Record<StatusPulseProps["tone"], string> = {
  success: "bg-emerald-500/80",
  warning: "bg-amber-500/80",
  danger: "bg-rose-500/80",
  muted: "bg-zinc-500/70",
};

function StatusPulseBase({ tone }: StatusPulseProps) {
  return (
    <span className="relative inline-flex h-2.5 w-2.5 items-center justify-center">
      <motion.span
        aria-hidden="true"
        className={`absolute h-full w-full rounded-full ${toneClass[tone]}`}
        animate={{ scale: [1, 1.9], opacity: [0.55, 0] }}
        transition={{ duration: 1.45, repeat: Infinity, ease: "easeOut" }}
      />
      <span
        aria-hidden="true"
        className={`relative h-2 w-2 rounded-full ${toneClass[tone]}`}
      />
    </span>
  );
}

export const StatusPulse = memo(StatusPulseBase);
