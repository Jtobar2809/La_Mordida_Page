"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { toast } from "sonner";
import { AuthCard } from "@/components/auth/auth-card";
import { GoogleButton } from "@/components/auth/google-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { registerUser } from "@/actions/auth";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = React.useState({ name: "", email: "", phone: "", password: "" });
  const [loading, setLoading] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const result = await registerUser(form);

    if (!result.success) {
      setLoading(false);
      toast.error(result.error);
      return;
    }

    const signInResult = await signIn("credentials", {
      email: form.email,
      password: form.password,
      redirect: false,
    });
    setLoading(false);

    if (signInResult?.error) {
      toast.success("Cuenta creada. Ahora inicia sesión.");
      router.push("/login");
      return;
    }

    toast.success("¡Cuenta creada! Ya tienes tu bono de bienvenida.");
    router.push("/cuenta");
    router.refresh();
  };

  return (
    <AuthCard
      title="CREA TU CUENTA"
      subtitle="Únete y empieza a acumular puntos desde tu primer pedido"
      footer={
        <>
          ¿Ya tienes cuenta?{" "}
          <Link href="/login" className="font-semibold text-ember-600">
            Ingresa aquí
          </Link>
        </>
      }
    >
      <div className="space-y-4">
        <GoogleButton />
        <div className="flex items-center gap-3 text-xs text-charcoal-300">
          <div className="h-px flex-1 bg-charcoal-100 dark:bg-charcoal-700" />
          O CON TU CORREO
          <div className="h-px flex-1 bg-charcoal-100 dark:bg-charcoal-700" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Nombre completo</Label>
            <Input id="name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="email">Correo</Label>
            <Input id="email" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="phone">Teléfono / WhatsApp</Label>
            <Input id="phone" required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="password">Contraseña</Label>
            <Input
              id="password"
              type="password"
              required
              minLength={6}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </div>
          <Button type="submit" disabled={loading} className="w-full" size="lg">
            {loading ? "Creando cuenta..." : "Crear cuenta"}
          </Button>
        </form>
      </div>
    </AuthCard>
  );
}
