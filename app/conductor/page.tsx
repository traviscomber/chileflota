"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { AlertCircle, CheckCircle2, Clock, FileText, ArrowRight } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

export default function ConductorDashboard() {
  const [documents, setDocuments] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchDocuments = async () => {
      try {
        const response = await fetch("/api/conductor/documents")
        if (!response.ok) return
        const json = await response.json()
        setDocuments(json.documents || json || [])
      } catch (error) {
        console.error("[v0] Error fetching documents:", error)
      } finally {
        setIsLoading(false)
      }
    }
    fetchDocuments()
  }, [])

  const stats = useMemo(() => {
    const approved = documents.filter((d: any) => ["approved", "validated"].includes(d.validation_status)).length
    const pending = documents.filter((d: any) => d.validation_status === "pending" || !d.validation_status).length
    const actionRequired = documents.filter((d: any) => ["rejected", "expired"].includes(d.validation_status)).length
    const rate = documents.length ? Math.round((approved / documents.length) * 100) : 0
    return { approved, pending, actionRequired, rate }
  }, [documents])

  const recent = useMemo(
    () => [...documents].sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 5),
    [documents],
  )

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <section className="border-b border-[var(--cf-border)] pb-5">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-[var(--cf-text-muted)]">Resumen</p>
        <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-[26px] font-semibold tracking-[-0.03em] text-[var(--cf-text)]">Estado documental</h2>
            <p className="mt-1 text-sm text-[var(--cf-text-secondary)]">Revisa lo que está al día y lo que requiere acción.</p>
          </div>
          <Link href="/conductor/documentos">
            <Button className="h-10">
              Ver documentos <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      <section className="overflow-hidden rounded-[8px] border border-[var(--cf-border)] bg-[var(--cf-surface)]">
        <div className="grid grid-cols-2 lg:grid-cols-4">
          <Metric label="Cumplimiento" value={`${stats.rate}%`} note="Sobre documentos cargados" />
          <Metric label="Al día" value={stats.approved.toString()} note="Validados" tone="success" divided />
          <Metric label="En revisión" value={stats.pending.toString()} note="Sin acción por ahora" tone="warning" divided />
          <Metric label="Requiere acción" value={stats.actionRequired.toString()} note="Rechazados o vencidos" tone="danger" divided />
        </div>
      </section>

      {stats.actionRequired > 0 && (
        <section className="flex flex-col gap-3 rounded-[8px] border border-[var(--cf-danger)]/35 bg-[var(--cf-danger-soft)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--cf-danger)]" />
            <div>
              <p className="text-sm font-medium text-[var(--cf-text)]">{stats.actionRequired} documento(s) requieren acción</p>
              <p className="mt-0.5 text-xs text-[var(--cf-text-secondary)]">Revisa el motivo y reemplaza sólo los documentos observados.</p>
            </div>
          </div>
          <Link href="/conductor/documentos">
            <Button size="sm">Resolver</Button>
          </Link>
        </section>
      )}

      <section className="space-y-3">
        <div className="flex items-end justify-between border-b border-[var(--cf-border)] pb-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-[var(--cf-text-muted)]">Actividad</p>
            <h3 className="mt-1 text-base font-semibold text-[var(--cf-text)]">Documentos recientes</h3>
          </div>
          <Link href="/conductor/onboarding" className="text-xs font-medium text-[var(--cf-text-secondary)] hover:text-[var(--cf-text)]">
            Guía de inicio
          </Link>
        </div>

        <div className="overflow-hidden rounded-[8px] border border-[var(--cf-border)] bg-[var(--cf-surface)]">
          {isLoading ? (
            <div className="px-4 py-8 text-center text-sm text-[var(--cf-text-muted)]">Cargando documentos…</div>
          ) : recent.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <FileText className="mx-auto h-5 w-5 text-[var(--cf-text-muted)]" />
              <p className="mt-2 text-sm text-[var(--cf-text-secondary)]">Aún no hay documentos cargados.</p>
            </div>
          ) : (
            <div className="divide-y divide-[var(--cf-border)]">
              {recent.map((doc: any) => (
                <div key={doc.id} className="flex min-h-14 items-center justify-between gap-4 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-[var(--cf-text)]">{doc.document_type_name || doc.document_type || "Documento"}</p>
                    <p className="mt-0.5 text-xs text-[var(--cf-text-muted)]">{new Date(doc.created_at).toLocaleDateString("es-CL")}</p>
                  </div>
                  <StatusBadge status={doc.validation_status} />
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

function Metric({ label, value, note, tone, divided }: { label: string; value: string; note: string; tone?: "success" | "warning" | "danger"; divided?: boolean }) {
  const dot = tone === "success" ? "bg-[var(--cf-success)]" : tone === "warning" ? "bg-[var(--cf-warning)]" : tone === "danger" ? "bg-[var(--cf-danger)]" : "bg-[var(--cf-text-muted)]"
  return (
    <div className={`p-4 ${divided ? "border-l border-[var(--cf-border)]" : ""}`}>
      <div className="flex items-center gap-2">
        <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
        <p className="text-xs font-medium text-[var(--cf-text-muted)]">{label}</p>
      </div>
      <p className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-[var(--cf-text)]">{value}</p>
      <p className="mt-1 text-xs text-[var(--cf-text-muted)]">{note}</p>
    </div>
  )
}

function StatusBadge({ status }: { status?: string }) {
  if (["approved", "validated"].includes(status || "")) {
    return <Badge className="border-0 bg-[var(--cf-success-soft)] text-[var(--cf-success)]"><CheckCircle2 className="mr-1 h-3 w-3" />Aprobado</Badge>
  }
  if (status === "rejected" || status === "expired") {
    return <Badge className="border-0 bg-[var(--cf-danger-soft)] text-[var(--cf-danger)]"><AlertCircle className="mr-1 h-3 w-3" />{status === "expired" ? "Vencido" : "Rechazado"}</Badge>
  }
  return <Badge className="border-0 bg-[var(--cf-warning-soft)] text-[var(--cf-warning)]"><Clock className="mr-1 h-3 w-3" />En revisión</Badge>
}
