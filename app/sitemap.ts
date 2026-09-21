import type { MetadataRoute } from "next"

const siteUrl = "https://chileflota.app"

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = [
    "",
    "/chile",
    "/flotas",
    "/compliance-transporte",
    "/gestion-documental-flotas",
    "/transportistas",
    "/conductores",
    "/vehiculos",
    "/inteligencia-operacional",
  ]

  return routes.map((route, index) => ({
    url: `${siteUrl}${route}`,
    changeFrequency: index === 0 ? "weekly" : "monthly",
    priority: index === 0 ? 1 : 0.8,
  }))
}
