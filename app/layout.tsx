import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import { Suspense } from "react"
import "./globals.css"
import { RoleProvider } from "./providers"
import { ToastProvider } from "@/lib/toast-context"
import { ToastContainer } from "@/components/toast-container"
import { DocumentSyncProvider } from "@/contexts/document-sync-context"

// ChileFlota is an authenticated operational application. Many routes depend on
// request-time auth, live data, redirects, or client hydration. Prevent Next.js
// from attempting static generation for the route tree during production builds.
export const dynamic = "force-dynamic"
export const revalidate = 0

const siteUrl = "https://chileflota.app"
const canonicalDescription =
  "ChileFlota es una plataforma de compliance operacional para flotas, transportistas y contratistas que conecta documentación, vigencias, evidencia y alertas para priorizar decisiones operativas."

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-inter",
})

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  applicationName: "ChileFlota",
  title: {
    default: "ChileFlota | Compliance operacional para flotas",
    template: "%s | ChileFlota",
  },
  description: canonicalDescription,
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "es_CL",
    url: siteUrl,
    siteName: "ChileFlota",
    title: "ChileFlota | Compliance operacional para flotas",
    description: canonicalDescription,
  },
  twitter: {
    card: "summary",
    title: "ChileFlota | Compliance operacional para flotas",
    description: canonicalDescription,
  },
  creator: "N3uralia",
  publisher: "N3uralia",
  generator: "ChileFlota",
  category: "Compliance operacional de transporte",
}

const structuredData = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "@id": `${siteUrl}/#software`,
  name: "ChileFlota",
  url: siteUrl,
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  description: canonicalDescription,
  provider: {
    "@type": "Organization",
    "@id": "https://n3uralia.com/#organization",
    name: "N3uralia",
    url: "https://n3uralia.com",
  },
  featureList: [
    "Gestión documental de transportistas, conductores y vehículos",
    "Control de vigencias y evidencia de cumplimiento",
    "Alertas y priorización de excepciones operativas",
    "Trazabilidad de revisión y estados documentales",
  ],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es" className="dark bg-background">
      <body data-cf-product className={`font-sans ${inter.variable} antialiased text-foreground`}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
        <DocumentSyncProvider>
          <RoleProvider>
            <ToastProvider>
              <Suspense fallback={null}>{children}</Suspense>
              <ToastContainer />
            </ToastProvider>
          </RoleProvider>
        </DocumentSyncProvider>
      </body>
    </html>
  )
}
