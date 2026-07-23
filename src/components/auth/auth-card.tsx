import Link from "next/link";

export function AuthCard({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      <div className="relative hidden w-1/2 bg-char-gradient lg:block">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-32 top-1/4 h-96 w-96 rounded-full bg-ember-600/30 blur-[110px]"
        />
        <div className="relative flex h-full flex-col justify-between p-14 text-cream">
          <Link href="/" className="font-display text-3xl tracking-wide">
            LA <span className="text-ember-500">MORDIDA</span>
          </Link>
          <div>
            <p className="font-display text-5xl leading-[0.95] tracking-wide">
              CADA MORDIDA
              <br />
              <span className="text-ember-500">SUMA PUNTOS.</span>
            </p>
            <p className="mt-4 max-w-sm text-charcoal-200">
              Regístrate y empieza a acumular puntos, subir de nivel y canjear recompensas reales.
            </p>
          </div>
          <p className="text-xs text-charcoal-400">© {new Date().getFullYear()} La Mordida</p>
        </div>
      </div>

      <div className="flex w-full items-center justify-center bg-cream p-6 dark:bg-charcoal-900 lg:w-1/2">
        <div className="w-full max-w-sm">
          <Link href="/" className="mb-8 block font-display text-2xl tracking-wide lg:hidden">
            LA <span className="text-ember-600">MORDIDA</span>
          </Link>
          <h1 className="font-display text-3xl tracking-wide text-charcoal-900 dark:text-cream">{title}</h1>
          <p className="mt-1 text-sm text-charcoal-400">{subtitle}</p>
          <div className="mt-8">{children}</div>
          {footer && <div className="mt-6 text-center text-sm text-charcoal-400">{footer}</div>}
        </div>
      </div>
    </div>
  );
}
