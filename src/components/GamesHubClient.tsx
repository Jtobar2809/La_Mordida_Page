"use client";

import dynamic from "next/dynamic";
import React from "react";

const Loader = () => <div className="py-12 text-center text-sm text-charcoal-400">Cargando juegos…</div>;
const GamesHub = dynamic(() => import("@/components/games/GamesHub").then((m) => m.GamesHub), {
  ssr: false,
  loading: Loader,
});

export default function GamesHubClient() {
  return <GamesHub />;
}
