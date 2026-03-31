"use client";

import React, { memo } from "react";
import {
  motion,
  useMotionValue,
  useSpring,
  type HTMLMotionProps,
} from "framer-motion";

type MagneticButtonProps = HTMLMotionProps<"button"> & {
  intensity?: number;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function MagneticButtonBase({
  intensity = 0.18,
  children,
  className,
  onPointerLeave,
  onPointerMove,
  ...rest
}: MagneticButtonProps) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const smoothX = useSpring(x, {
    stiffness: 100,
    damping: 20,
    mass: 0.4,
  });
  const smoothY = useSpring(y, {
    stiffness: 100,
    damping: 20,
    mass: 0.4,
  });

  return (
    <motion.button
      {...rest}
      style={{ x: smoothX, y: smoothY }}
      onPointerMove={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        const offsetX = event.clientX - (rect.left + rect.width / 2);
        const offsetY = event.clientY - (rect.top + rect.height / 2);
        x.set(clamp(offsetX * intensity, -8, 8));
        y.set(clamp(offsetY * intensity, -6, 6));
        onPointerMove?.(event);
      }}
      onPointerLeave={(event) => {
        x.set(0);
        y.set(0);
        onPointerLeave?.(event);
      }}
      whileTap={{ scale: 0.98, y: 1 }}
      transition={{ type: "spring", stiffness: 100, damping: 20 }}
      className={className}
    >
      {children}
    </motion.button>
  );
}

export const MagneticButton = memo(MagneticButtonBase);
