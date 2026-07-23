"use client";

import { useEffect, useRef, useState } from "react";

interface LazyMountProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  rootMargin?: string;
  className?: string;
}

/**
 * Difiere el montaje de contenido pesado (mapas, embeds, galerías grandes)
 * hasta que esté por entrar al viewport, usando IntersectionObserver.
 * Distinto de Reveal/Stagger (que animan algo ya montado): esto evita
 * montar el contenido en absoluto hasta que haga falta, para aligerar
 * el trabajo inicial de la página.
 */
export function LazyMount({
  children,
  fallback = null,
  rootMargin = "200px",
  className,
}: LazyMountProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!ref.current || visible) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry?.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin }
    );

    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [rootMargin, visible]);

  return (
    <div ref={ref} className={className}>
      {visible ? children : fallback}
    </div>
  );
}
