import type { Category, Product, ProductExtra } from "@prisma/client";

export type ProductWithExtras = Product & { extras: ProductExtra[] };
export type CategoryWithProducts = Category & { products: ProductWithExtras[] };
