"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { AuthCard } from "@/components/auth/auth-card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { requestPasswordReset } from "@/actions/auth";

export default function ForgotPasswordPage() {
  const [email, setEmail] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [sent, setSent] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await requestPasswordReset({ email });
    setLoading(false);
    setSent(true);
    toast.success("Si el correo existe, te enviamos instrucciones.");
  };

  return (
    <AuthCard
      title="RECUPERA TU CONTRASEÑA"
      subtitle="Te enviaremos un enlace para crear una nueva"
      footer={
        <Link href="/login" className="font-semibold text-ember-600">
          Volver a ingresar
        </Link>
      }
    >
      {sent ? (
        <div className="rounded-xl border border-olive-200 bg-olive-50 p-4 text-sm text-olive-700 dark:border-olive-700 dark:bg-olive-900/20 dark:text-olive-300">
          Si <strong>{email}</strong> está registrado, recibirás un correo con el enlace para restablecer tu
          contraseña en los próximos minutos.
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="email">Correo registrado</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <Button type="submit" disabled={loading} className="w-full" size="lg">
            {loading ? "Enviando..." : "Enviar enlace"}
          </Button>
        </form>
      )}
    </AuthCard>
  );
}
