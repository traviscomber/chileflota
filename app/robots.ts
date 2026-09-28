import type { MetadataRoute } from "next"

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/auth/",
        "/login",
        "/admin/",
        "/dashboard",
        "/dispatcher/",
        "/diagnostic/",
        "/diagnostic-final/",
        "/ai-scanner/",
        "/conductor/",
        "/conductor-credentials/",
      ],
    },
    sitemap: "https://www.chileflota.app/sitemap.xml",
    host: "https://www.chileflota.app",
  }
}
