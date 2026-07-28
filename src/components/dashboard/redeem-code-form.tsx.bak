"use client";

import * as React from "react";
import { toast } from "sonner";
import { Ticket } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { redeemCodeAction } from "@/actions/loyalty";
import { useRouter } from "next/navigation";

export function RedeemCodeForm() {
  const [code, setCode] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    setLoading(true);
    const result = await redeemCodeAction({ code });
    setLoading(false);

    if (!result.success) {
      toast.error(result.error);
      return;
    }

    toast.success(`¡Ganaste ${result.data?.points} puntos!`);
    setCode("");
    router.refresh();
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row">
      <div className="relative flex-1">
        <Ticket className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-charcoal-300" />
        <Input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="Código de tu compra en tienda (ej: LM-7F3K9Q)"
          className="pl-10 font-mono uppercase"
        />
      </div>
      <Button type="submit" disabled={loading}>
        {loading ? "Canjeando..." : "Canjear puntos"}
      </Button>
    </form>
  );
}
