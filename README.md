# 🔥 La Mordida — Plataforma web

Plataforma completa para La Mordida: menú digital, pedidos por WhatsApp, cuentas de
cliente, programa de fidelización (puntos, niveles, desafíos, recompensas, códigos de
canje) y panel de administración.

Construido con **Next.js 15 · React 19 · TypeScript · Tailwind CSS · Prisma · PostgreSQL
· Auth.js (NextAuth v5)**.

---

## 1. Qué incluye este proyecto (y qué no, todavía)

**Completo y funcional:**
- Sitio público: inicio (con hero, historia, destacados, promociones, por qué
  elegirnos, programa de fidelización, reseñas y galería), menú dinámico con
  búsqueda/filtros, carrito, checkout que arma el mensaje y abre WhatsApp.
- Autenticación: registro/login con correo o Google, recuperar contraseña **con
  envío de correo real vía Resend**, roles cliente/admin.
- Panel de cliente: puntos, nivel, código QR personal, canje de código de compra,
  historial de pedidos, catálogo de recompensas, desafíos, edición de perfil.
- Panel de administración completo: dashboard con KPIs y gráficos, CRUD de
  productos y categorías (con extras, ingredientes y **subida real de imágenes a
  Cloudinary**), CRUD de desafíos, generación y gestión de códigos de puntos, CRUD
  de recompensas, **CRUD de banners/promociones** (se muestran en la sección
  "Promociones" del inicio), **CRUD de cupones de descuento**, gestión de pedidos
  (cambio de estado), listado de clientes, configuración general (tasa de puntos,
  domicilio, WhatsApp, horario, dirección).
- Motor de puntos y niveles (con multiplicador por nivel), motor de desafíos
  (evaluación automática al confirmar un pedido).
- Subida de imágenes con vista previa, validación de tamaño/formato y fallback
  manual (pegar una URL) si Cloudinary no está configurado todavía.
- Correos transaccionales con plantilla de marca (recuperar contraseña, bienvenida)
  vía Resend; si no hay `RESEND_API_KEY`, el sistema sigue funcionando y deja el
  enlace en el log del servidor para no bloquear el desarrollo local.
- SEO técnico: metadata, Open Graph (imagen generada dinámicamente), ícono de marca,
  sitemap.xml y robots.txt dinámicos.
- **Caja (POS) con turnos y arqueo** e **inventario con descuento automático** —
  ver el detalle en la sección 1.1.

### 1.1. Caja e inventario

**Caja — `/admin/caja`**

Terminal de venta de mostrador con control de turnos:

- **Apertura**: se declara la base en efectivo del cajón. Solo puede haber un
  turno abierto a la vez, y eso lo garantiza un índice único en la base de datos
  (`CajaSesion.abiertaLock`), no una comprobación en el servidor que dos clics
  simultáneos puedan esquivar.
- **Venta**: grilla de productos con búsqueda (Enter agrega el primer resultado),
  extras y notas por línea, descuento manual y cobro en **efectivo, Nequi o pago
  mixto**, con cálculo de cambio y ticket imprimible en formato térmico.
- **Ingresos y egresos**: la plata que entra o sale sin ser una venta (pagar al
  proveedor, un domicilio, un retiro). Sin esto todo turno con un gasto en
  efectivo cerraría con un faltante inexplicable.
- **Anulación**: devuelve los insumos al inventario y registra la salida del
  dinero. El movimiento original no se borra — se corrige con el asiento
  inverso, para que la anulación quede auditable.
- **Cierre con arqueo**: se cuenta el efectivo físico y el sistema muestra la
  diferencia contra lo esperado. A propósito no revela el esperado antes de que
  se escriba lo contado: si lo hiciera, la diferencia siempre sería cero y el
  arqueo no serviría de nada. Al cerrar, los totales quedan congelados en la
  sesión, así que un arqueo viejo no cambia si mañana se corrige un pedido.
- **Historial**: `/admin/caja/sesiones` lista todos los turnos con su diferencia,
  y el detalle muestra el arqueo completo y todos los movimientos.

Cada venta de caja **descuenta el inventario según receta dentro de la misma
transacción** que registra el cobro: no puede quedar una venta cobrada sin
descontar insumos, ni insumos descontados sin venta.

**Inventario**

Sobre la base existente (insumos, recetas, proveedores, compras con costo
promedio ponderado, mermas) se cerraron dos huecos por los que el stock teórico
se separaba del real:

- **Extras que no descontaban nada.** Ahora cada `ProductExtra` puede declarar
  qué insumo consume y cuánto (se configura al editar el producto), y la venta
  lo descuenta igual que la receta base.
- **Insumos elaborados que nunca consumían sus componentes.** La composición ya
  existía en la base de datos pero nada la ejecutaba: el aderezo bajaba al
  vender y la mayonesa que lo compone no bajaba nunca. La nueva pestaña
  **`/admin/inventario/produccion`** registra cada tanda preparada en cocina:
  suma stock al elaborado, descuenta sus componentes y calcula el costo real del
  lote, promediándolo contra el stock previo.

**Queda como base para la siguiente iteración (no bloquea el uso del sistema):**
- **Pagos en línea**: el checkout está preparado para agregarlo (el prompt original
  lo pedía para una fase futura).
- Los tipos de desafío `REFERIDO`, `PRODUCTO_NUEVO` y `COMBO` están definidos pero su
  cálculo automático requiere reglas de negocio adicionales específicas de cada
  promoción (se pueden completar o marcar manualmente como cumplidos desde Prisma
  Studio mientras tanto).
- Notificaciones push/in-app dentro de la aplicación (hoy la comunicación con el
  cliente es por correo y WhatsApp).

---

## 2. Requisitos previos

- Node.js 20 o superior
- Una base de datos PostgreSQL (recomendado: [Neon](https://neon.tech) o
  [Supabase](https://supabase.com), ambos tienen plan gratuito)
- Una cuenta de [Cloudinary](https://cloudinary.com) (opcional pero recomendado, para
  imágenes)
- Credenciales de OAuth de Google (opcional, si quieres login con Google)

---

## 3. Instalación local

```bash
# 1. Instala las dependencias
npm install

# 2. Copia el archivo de variables de entorno
cp .env.example .env

# 3. Completa .env con tus datos (ver sección 4)

# 4. Crea las tablas en tu base de datos
npm run db:push

# 5. Carga datos de ejemplo (categorías, productos, niveles, desafíos, etc.)
npm run db:seed

# 6. Levanta el servidor de desarrollo
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000).

### Usuarios de prueba (creados por el seed)

| Rol      | Correo                  | Contraseña    |
|----------|--------------------------|---------------|
| Admin    | admin@lamordida.com     | Admin123!     |
| Cliente  | cliente@lamordida.com   | Cliente123!   |

Panel admin: [http://localhost:3000/admin](http://localhost:3000/admin)

**Cambia estas contraseñas antes de pasar a producción.**

---

## 4. Variables de entorno

Copia `.env.example` a `.env` y completa:

| Variable | Dónde conseguirla |
|---|---|
| `DATABASE_URL` / `DIRECT_URL` | Panel de Neon o Supabase → cadena de conexión Postgres (Neon te da ambas: "pooled" y "direct"; en Supabase usa la misma URL en las dos si no tienes pooler) |
| `AUTH_SECRET` | Genera uno con `openssl rand -base64 32` |
| `NEXTAUTH_URL` | `http://localhost:3000` en local, tu dominio en producción |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | [Google Cloud Console → Credenciales OAuth](https://console.cloud.google.com/apis/credentials). Tipo "Aplicación web". Redirect URI: `https://TU-DOMINIO/api/auth/callback/google` (y `http://localhost:3000/api/auth/callback/google` para desarrollo) |
| `RESEND_API_KEY` / `EMAIL_FROM` | [resend.com](https://resend.com) → API Keys. Sin esta variable, los correos (recuperar contraseña, bienvenida) se registran en el log del servidor en vez de enviarse, así que el desarrollo local no se bloquea |
| `CLOUDINARY_*` | Panel de Cloudinary → Dashboard (Cloud name, API key, API secret). Sin estas variables, el botón de "Subir imagen" del panel avisa que falta configurarlas y puedes pegar una URL manualmente mientras tanto |
| `NEXT_PUBLIC_WHATSAPP_NUMBER` | Número de WhatsApp del negocio, formato internacional sin "+" (ej: `573001234567`). También editable desde `/admin/configuracion` una vez el sistema está corriendo |

---

## 5. Cómo probar los flujos principales

1. **Cliente nuevo**: entra a `/registro`, crea una cuenta → recibe el bono de
   bienvenida configurado (por defecto 20 puntos).
2. **Hacer un pedido**: ve a `/menu`, agrega productos con extras/notas, ve a
   `/carrito`, confirma → se abre WhatsApp con el mensaje armado y el pedido queda
   registrado (ganas puntos automáticamente según el monto).
3. **Canjear un código de compra en tienda**: como admin, entra a
   `/admin/codigos` y genera un código con un valor en puntos. Como cliente,
   entra a `/cuenta` e ingrésalo en "¿Compraste en tienda?".
4. **Canjear una recompensa**: en `/cuenta/recompensas`, canjea puntos por un
   premio del catálogo → se genera un código que el cliente muestra en caja.
5. **Ver progreso de desafíos**: `/cuenta/desafios`. Se actualizan automáticamente
   al confirmar pedidos.
6. **Administrar el negocio**: `/admin` (dashboard), `/admin/productos`,
   `/admin/categorias`, `/admin/pedidos`, `/admin/desafios`, `/admin/recompensas`,
   `/admin/banners`, `/admin/cupones`, `/admin/configuracion`.
7. **Subir una imagen**: en cualquier formulario de producto, recompensa o banner,
   usa el botón "Subir imagen" (requiere `CLOUDINARY_*` configuradas) o el enlace
   "Pegar URL en su lugar" si aún no las tienes.
8. **Probar la recuperación de contraseña**: en `/recuperar-password`, ingresa un
   correo registrado. Si configuraste `RESEND_API_KEY` te llega el correo real; si
   no, el enlace queda impreso en la terminal donde corre `npm run dev`.
9. **Crear una promoción**: en `/admin/banners`, crea un banner con imagen → aparece
   automáticamente en la sección "Promociones" del inicio.
10. **Crear un cupón**: en `/admin/cupones`, crea un código de descuento → los
    clientes pueden aplicarlo en `/carrito`.

---

## 6. Subir el proyecto a GitHub

```bash
git init
git add .
git commit -m "Primer commit: plataforma La Mordida"

# Crea un repositorio vacío en https://github.com/new (sin README/gitignore)
git remote add origin https://github.com/TU-USUARIO/la-mordida.git
git branch -M main
git push -u origin main
```

> El `.gitignore` ya excluye `node_modules`, `.env` y los archivos generados de
> Next.js/Prisma, así que no subirás secretos ni archivos pesados por accidente.

---

## 7. Desplegar en Vercel

1. Entra a [vercel.com/new](https://vercel.com/new) e importa el repositorio de
   GitHub que acabas de crear.
2. Vercel detecta Next.js automáticamente. No cambies el "Build Command"
   (`prisma generate && next build`, ya configurado en `package.json`).
3. En **Environment Variables**, agrega las mismas variables de tu `.env`
   (con `NEXTAUTH_URL` apuntando a tu dominio de Vercel, ej.
   `https://la-mordida.vercel.app`).
4. Dale a **Deploy**.
5. Una vez desplegado, corre las migraciones contra tu base de producción (puedes
   hacerlo desde tu máquina local apuntando el `.env` a la base de datos de
   producción):
   ```bash
   npm run db:push
   npm run db:seed   # opcional, solo si quieres los datos de ejemplo también en producción
   ```
6. Actualiza el Redirect URI de Google OAuth para incluir tu dominio de producción.

### Dominio propio

En Vercel → Settings → Domains, agrega tu dominio y sigue las instrucciones de DNS.
Recuerda actualizar `NEXTAUTH_URL` y el Redirect URI de Google cuando cambies de
dominio.

---

## 8. Estructura del proyecto

```
src/
  actions/          Server Actions (mutaciones): auth, pedidos, fidelización, perfil
  actions/admin/     Server Actions exclusivas del panel admin
  app/               Rutas (App Router de Next.js)
  components/        Componentes de UI, por dominio (home, menu, cart, dashboard, admin)
  hooks/             Hooks de cliente (carrito)
  lib/               Lógica de negocio: prisma, puntos, desafíos, whatsapp, settings
  types/             Tipos compartidos
prisma/
  schema.prisma      Modelo de datos completo
  seed.ts            Datos de ejemplo
```

## 9. Comandos útiles

```bash
npm run dev          # servidor de desarrollo
npm run build         # build de producción
npm run db:studio     # explorador visual de la base de datos (Prisma Studio)
npm run db:migrate    # generar y aplicar una migración con nombre (desarrollo)
npm run db:push       # sincronizar el esquema sin generar archivos de migración
```

---

Hecho con 🔥 para La Mordida.
