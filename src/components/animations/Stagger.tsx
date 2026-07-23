"use client";

import { motion } from "framer-motion";
import { staggerContainer } from "@/lib/motion";

interface StaggerProps {
  children: React.ReactNode;
  className?: string;
  amount?: number;
}

export function Stagger({
  children,
  className,
  amount = 0.15,
}: StaggerProps) {
  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      whileInView="visible"
      viewport={{
        once: true,
        amount,
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
