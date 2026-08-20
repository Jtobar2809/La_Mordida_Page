import {
  LayoutDashboard,
  Beef,
  Tag,
  ClipboardList,
  Users,
  Settings,
  Image as ImageIcon,
  Percent,
  Stamp,
  Warehouse,
  Calculator,
  BookOpenCheck,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

export type AdminNavLink = {
  href: string;
  label: string;
  icon: LucideIcon;
};

// Única fuente de verdad para el menú del panel admin. La usan tanto
// AdminSidebar (pantallas grandes) como AdminTopbar (menú hamburguesa en
// móvil) — antes cada uno tenía su propia copia de esta lista, hardcodeada
// por separado, y se desincronizaban cada vez que se editaba solo una de
// las dos (labels distintos, orden distinto). Si necesitas agregar, quitar
// o reordenar una sección del admin, hazlo aquí y se refleja en ambas.
export const adminNavLinks: AdminNavLink[] = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/productos", label: "Productos", icon: Beef },
  { href: "/admin/categorias", label: "Categorías", icon: Tag },
  { href: "/admin/caja", label: "Caja", icon: Calculator },
  { href: "/admin/pedidos", label: "Pedidos", icon: ClipboardList },
  { href: "/admin/inventario", label: "Inventario", icon: Warehouse },
  { href: "/admin/contabilidad", label: "Contabilidad", icon: BookOpenCheck },
  { href: "/admin/promociones", label: "Promociones", icon: Sparkles },
  { href: "/admin/clientes", label: "Clientes", icon: Users },
  { href: "/admin/sellos", label: "Tarjeta de sellos", icon: Stamp },
  { href: "/admin/galeria", label: "Galería", icon: ImageIcon },
  { href: "/admin/banners", label: "Carrusel (Hero) / Banners", icon: ImageIcon },
  { href: "/admin/cupones", label: "Cupones", icon: Percent },
  { href: "/admin/configuracion", label: "Configuración", icon: Settings },
];
