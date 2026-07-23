import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXTAUTH_URL ?? "https://lamordida.com";
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: ["/admin", "/cuenta", "/api"] },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
