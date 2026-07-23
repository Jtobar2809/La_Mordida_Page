"use client";

import * as React from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Ticket, Copy } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { generateCodes } from "@/actions/admin/codes";

export function GenerateCodesForm() {
  const router = useRouter();
  const [form, setForm] = React.useState({ pointsValue: 10, description: "", maxUses: 1, expiresAt: "", quantity: 1 });
  const [loading, setLoading] = React.useState(false);
  const [generated, setGenerated] = React.useState<string[] | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const result = await generateCodes(form);
    setLoading(false);

    if (!result.success) return toast.error(result.error);
    setGenerated(result.data!.codes);
    toast.success(`${result.data!.codes.length} código(s) generado(s)`);
    router.refresh();
  };

  const copyAll = () => {
    if (!generated) return;
    navigator.clipboard.writeText(generated.join("\n"));
    toast.success("Códigos copiados al portapapeles");
  };

  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center gap-2">
        <Ticket className="h-5 w-5 text-ember-600" />
        <h2 className="font-display text-xl tracking-wide text-charcoal-900 dark:text-cream">GENERAR CÓDIGOS</h2>
      </div>
      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="pointsValue">Puntos que otorga cada código</Label>
          <Input id="pointsValue" type="number" min={1} required value={form.pointsValue} onChange={(e) => setForm({ ...form, pointsValue: Number(e.target.value) })} />
        </div>
        <div>
          <Label htmlFor="quantity">Cantidad de códigos a generar</Label>
          <Input id="quantity" type="number" min={1} max={50} required value={form.quantity} onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })} />
        </div>
        <div>
          <Label htmlFor="maxUses">Usos máximos por código</Label>
          <Input id="maxUses" type="number" min={1} value={form.maxUses} onChange={(e) => setForm({ ...form, maxUses: Number(e.target.value) })} />
        </div>
        <div>
          <Label htmlFor="expiresAt">Expira el (opcional)</Label>
          <Input id="expiresAt" type="date" value={form.expiresAt} onChange={(e) => setForm({ ...form, expiresAt: e.target.value })} />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="description">Descripción / referencia interna</Label>
          <Input id="description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Ej: Compra mostrador $45.000" />
        </div>
        <div className="sm:col-span-2">
          <Button type="submit" disabled={loading} className="w-full sm:w-auto">
            {loading ? "Generando..." : "Generar"}
          </Button>
        </div>
      </form>

      {generated && (
        <div className="mt-5 rounded-xl border border-olive-200 bg-olive-50 p-4 dark:border-olive-700 dark:bg-olive-900/20">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-semibold text-olive-700 dark:text-olive-300">Códigos generados</p>
            <Button type="button" size="sm" variant="ghost" onClick={copyAll}>
              <Copy className="h-3.5 w-3.5" /> Copiar todos
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {generated.map((code) => (
              <span key={code} className="rounded-lg bg-white px-3 py-1.5 font-mono text-sm font-bold text-charcoal-800 dark:bg-charcoal-800 dark:text-cream">
                {code}
              </span>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
