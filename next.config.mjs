/**
 * Cabeceras de seguridad para TODO el sitio.
 *
 * Antes vivían dentro de `middleware.ts`, pero su `matcher` solo cubre
 * /admin y /cuenta — así que la home, el menú, el carrito y, sobre todo,
 * /login y /registro se servían sin ninguna: el formulario de credenciales
 * era enmarcable en un iframe (clickjacking). Aplicadas aquí cubren cada
 * respuesta, sin depender de qué rutas atraviesen el middleware.
 *
 * Notas del CSP:
 *  - 'unsafe-inline' / 'unsafe-eval' en script-src son necesarios hoy para el
 *    runtime de Next.js y el JSON-LD embebido. Endurecerlo con nonces es una
 *    mejora futura, no un bloqueante.
 *  - frame-src permite google.com/maps por el mapa embebido del footer.
 *  - frame-ancestors 'none' es el equivalente moderno de X-Frame-Options y sí
 *    lo respetan los navegadores actuales dentro del CSP.
 */
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "img-src 'self' data: blob: https:",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  "connect-src 'self' https:",
  "frame-src https://www.google.com https://maps.google.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const SECURITY_HEADERS = [
  { key: "Content-Security-Policy", value: CONTENT_SECURITY_POLICY },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-XSS-Protection", value: "0" },
  { key: "Permissions-Policy", value: "geolocation=(), microphone=(), interest-cohort=()" },
  // HSTS: en Vercel el sitio ya se sirve solo por HTTPS; esto se lo comunica
  // también al navegador para que ni intente la primera petición en claro.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "res.cloudinary.com" },
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
    ],
    // AVIF/WebP reducen el peso de las imágenes ~30-50%, lo que mejora el
    // LCP (Largest Contentful Paint) y por tanto el Core Web Vitals de Google.
    formats: ["image/avif", "image/webp"],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "5mb",
    },
  },
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
};

export default nextConfig;
