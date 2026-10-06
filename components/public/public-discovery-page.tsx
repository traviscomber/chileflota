import Link from "next/link"
import { ArrowRight, CheckCircle2, ShieldCheck } from "lucide-react"

type PublicDiscoveryPageProps = {
  eyebrow: string
  title: string
  description: string
  sections: Array<{ title: string; text: string }>
  related?: Array<{ href: string; label: string }>
}

export function PublicDiscoveryPage({ eyebrow, title, description, sections, related = [] }: PublicDiscoveryPageProps) {
  return (
    <main className="min-h-screen bg-[#111214] text-[#F2F0EB]">
      <header className="border-b border-[#303238] bg-[#111214]">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-3" aria-label="ChileFlota inicio">
            <div className="flex h-8 w-8 items-center justify-center border border-[#454850] bg-[#181A1D]">
              <ShieldCheck className="h-4 w-4 text-[#B36A79]" aria-hidden="true" />
            </div>
            <div className="leading-none">
              <span className="block text-sm font-semibold">ChileFlota</span>
              <span className="mt-1 block text-[10px] uppercase tracking-[0.18em] text-[#777C84]">Compliance operacional</span>
            </div>
          </Link>
          <Link href="/login" className="inline-flex h-9 items-center gap-2 rounded-[5px] bg-[#742D3D] px-4 text-sm font-medium hover:bg-[#87364A]">
            Acceso clientes <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </header>

      <section className="border-b border-[#303238] px-5 py-20 sm:px-6 lg:px-8 lg:py-24">
        <div className="mx-auto max-w-6xl">
          <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-[#B36A79]">{eyebrow}</p>
          <h1 className="mt-5 max-w-4xl text-4xl font-medium leading-tight tracking-[-0.045em] sm:text-5xl lg:text-6xl">{title}</h1>
          <p className="mt-6 max-w-3xl text-base leading-7 text-[#A9ADB3] sm:text-lg">{description}</p>
        </div>
      </section>

      <section className="px-5 py-16 sm:px-6 lg:px-8 lg:py-20">
        <div className="mx-auto grid max-w-6xl gap-px bg-[#303238] md:grid-cols-2">
          {sections.map((section) => (
            <article key={section.title} className="bg-[#181A1D] p-6 sm:p-8">
              <CheckCircle2 className="h-5 w-5 text-[#B36A79]" aria-hidden="true" />
              <h2 className="mt-6 text-xl font-medium tracking-[-0.02em]">{section.title}</h2>
              <p className="mt-3 text-sm leading-6 text-[#A9ADB3]">{section.text}</p>
            </article>
          ))}
        </div>
      </section>

      {related.length > 0 && (
        <section className="border-t border-[#303238] px-5 py-12 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-6xl">
            <p className="text-xs uppercase tracking-[0.18em] text-[#777C84]">Contenido relacionado</p>
            <div className="mt-4 flex flex-wrap gap-3">
              {related.map((item) => (
                <Link key={item.href} href={item.href} className="rounded-[5px] border border-[#303238] px-4 py-2 text-sm text-[#C6C8CC] hover:border-[#742D3D] hover:text-[#F2F0EB]">
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      <footer className="border-t border-[#303238] px-5 py-8 text-center text-xs text-[#777C84]">
        ChileFlota es una plataforma de N3uralia. Implementación activa: Transportes Labbé.
      </footer>
    </main>
  )
}
