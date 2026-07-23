import Link from "next/link";
import { Flame } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-char-gradient p-6 text-center text-cream">
      <Flame className="h-14 w-14 text-ember-500" />
      <h1 className="mt-4 font-display text-6xl tracking-wide">404</h1>
      <p className="mt-2 max-w-sm text-charcoal-200">
        Esta página se la comió alguien. Pero tranquilo, el menú sigue intacto.
      </p>
      <Link href="/" className="mt-6">
        <Button size="lg">Volver al inicio</Button>
      </Link>
    </div>
  );
}
