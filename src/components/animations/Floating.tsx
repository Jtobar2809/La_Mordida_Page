"use client";

import { motion } from "framer-motion";

interface FloatingProps {
  children: React.ReactNode;
  distance?: number;
  duration?: number;
  className?: string;
}

export function Floating({
  children,
  distance = 10,
  duration = 4,
  className,
}: FloatingProps) {
  return (
    <motion.div
      animate={{
        y: [0, -distance, 0],
      }}
      transition={{
        duration,
        repeat: Infinity,
        ease: "easeInOut",
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
