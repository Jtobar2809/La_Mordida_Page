"use client";

import { motion } from "framer-motion";
import { slideUp } from "@/lib/motion";

interface RevealProps {
  children: React.ReactNode;
  className?: string;
}

export function Reveal({
  children,
  className,
}: RevealProps) {
  return (
    <motion.div
      variants={slideUp}
      initial="hidden"
      whileInView="visible"
      viewport={{
        once: false,
        amount: 0.15,
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}