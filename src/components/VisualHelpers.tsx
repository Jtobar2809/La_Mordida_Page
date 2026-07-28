"use client";

import dynamic from "next/dynamic";
import React from "react";

const PageReveal = dynamic(() => import("./animations/PageReveal").then((m) => m.PageReveal));
const ScrollProgress = dynamic(() => import("./animations/ScrollProgress").then((m) => m.ScrollProgress));
const CustomCursor = dynamic(() => import("./animations/CustomCursor").then((m) => m.CustomCursor));
const PageTransition = dynamic(() => import("./animations/PageTransition").then((m) => m.PageTransition));

export function VisualHelpers({ children }: { children: React.ReactNode }) {
  return (
    <>
      <PageReveal />
      <ScrollProgress />
      <CustomCursor />
      <PageTransition>{children}</PageTransition>
    </>
  );
}
