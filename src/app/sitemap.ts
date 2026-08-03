import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXTAUTH_URL ?? "https://la-mordida.vercel.app";

  let products: { slug: string; updatedAt: Date }[] = [];
  try {
    products = await prisma.product.findMany({
      where: { available: true },
      select: { slug: true, updatedAt: true },
    });
  } catch (e) {
    // If DB is unavailable at build time (CI/pr-preview/local), fall back to a minimal sitemap.
    // This prevents build failures when database credentials are not present.
    // The error is intentionally non-fatal for the build; in production with DB available, full sitemap will be generated.
    // eslint-disable-next-line no-console
    console.error("sitemap: could not fetch products for sitemap", e);
  }

  const staticEntries: MetadataRoute.Sitemap = [
    { url: baseUrl, lastModified: new Date(), changeFrequency: "daily", priority: 1 },
    { url: `${baseUrl}/menu`, lastModified: new Date(), changeFrequency: "daily", priority: 0.9 },
    { url: `${baseUrl}/login`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.3 },
    { url: `${baseUrl}/registro`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.3 },
  ];

  const productEntries = products.map((p) => ({
    url: `${baseUrl}/menu?producto=${p.slug}`,
    lastModified: p.updatedAt,
    changeFrequency: "weekly" as const,
    priority: 0.6,
  }));

  return [...staticEntries, ...productEntries];
}

