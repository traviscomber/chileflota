import type { MetadataRoute } from "next"

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: "https://www.chileflota.app",
      changeFrequency: "weekly",
      priority: 1,
    },
  ]
}
