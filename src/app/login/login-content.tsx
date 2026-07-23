"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { toast } from "sonner";
import { AuthCard } from "@/components/auth/auth-card";
import { GoogleButton } from "@/components/auth/google-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export default function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/cuenta";

  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [remember, setRemember] = React.useState(true);
  const [loading, setLoading] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
    setLoading(false);

    if (result?.error) {
      toast.error("Correo o contraseña incorrectos");
      return;
    }

    if (!remember) {
      // La sesión JWT expira por defecto en 30 días; si el usuario no quiere
      // "recordarme" se podría acortar maxAge en la config de Auth.js según el caso de uso.
    }

    toast.success("¡Bienvenido de nuevo!");
    router.push(callbackUrl);
    router.refresh();
  };

  return (
    <AuthCard
      title="INGRESA"
      subtitle="Accede a tus puntos, pedidos y recompensas"
      footer={
        <>
          ¿No tienes cuenta?{" "}
          <Link href="/registro" className="font-semibold text-ember-600">
            Regístrate gratis
          </Link>
        </>
      }
    >
      <div className="space-y-4">
        <GoogleButton callbackUrl={callbackUrl} />
        <div className="flex items-center gap-3 text-xs text-charcoal-300">
          <div className="h-px flex-1 bg-charcoal-100 dark:bg-charcoal-700" />
          O CON TU CORREO
          <div className="h-px flex-1 bg-charcoal-100 dark:bg-charcoal-700" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="email">Correo</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="password">Contraseña</Label>
            <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <div className="flex items-center justify-between text-sm">
            <label className="flex items-center gap-2 text-charcoal-500 dark:text-charcoal-300">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="h-4 w-4 accent-ember-600"
              />
              Recordarme
            </label>
            <Link href="/recuperar-password" className="font-semibold text-ember-600">
              ¿Olvidaste tu contraseña?
            </Link>
          </div>
          <Button type="submit" disabled={loading} className="w-full" size="lg">
            {loading ? "Ingresando..." : "Ingresar"}
          </Button>
        </form>
      </div>
    </AuthCard>
  );
}
