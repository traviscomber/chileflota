"use client"

import React from "react"
import { Badge } from "@/components/ui/badge"
import { AlertTriangle, CheckCircle, Clock, Info, XCircle, FileUp, Brain, Building2 } from "lucide-react"
import { useRouter } from "next/navigation"

interface AlertItemProps {
  id: string
  type: string
  title: string
  message: string
  created_at: string
  source?: string
  metadata?: Record<string, any>
  onNavigate?: () => void
}

const AlertItem = React.memo<AlertItemProps>(({
  id,
  type,
  title,
  message,
  created_at,
  source,
  metadata,
  onNavigate
}) => {
  const router = useRouter()
  const transportistaNombre = metadata?.transportista_nombre || metadata?.transportista_razon_social
  const transportistaRut = metadata?.transportista_rut

  const getStatusIcon = (alertType: string) => {
    const t = alertType?.toUpperCase() || ''

    if (t.includes('APPROVED') || t.includes('APROBADO')) {
      return <CheckCircle className="h-5 w-5 text-[var(--cf-success)]" aria-hidden="true" />
    }
    if (t.includes('REJECTED') || t.includes('RECHAZADO')) {
      return <XCircle className="h-5 w-5 text-[var(--cf-danger)]" aria-hidden="true" />
    }
    if (t.includes('UPLOAD') || t.includes('SUBIDO')) {
      return <FileUp className="h-5 w-5 text-[var(--cf-text-secondary)]" aria-hidden="true" />
    }
    if (t.includes('EXPIR') || t.includes('VENC')) {
      return <Clock className="h-5 w-5 text-[var(--cf-warning)]" aria-hidden="true" />
    }
    if (t.includes('PENDING') || t.includes('PENDIENTE')) {
      return <Clock className="h-5 w-5 text-[var(--cf-warning)]" aria-hidden="true" />
    }
    if (t.includes('ANOMAL') || t.includes('WARNING')) {
      return <AlertTriangle className="h-5 w-5 text-[var(--cf-warning)]" aria-hidden="true" />
    }
    if (t.includes('AI') || t.includes('ANALISIS') || t.includes('IA')) {
      return <Brain className="h-5 w-5 text-[var(--cf-accent)]" aria-hidden="true" />
    }
    return <Info className="h-5 w-5 text-[var(--cf-text-secondary)]" aria-hidden="true" />
  }

  const getStatusBadge = (alertType: string) => {
    const t = alertType?.toUpperCase() || ''

    if (t.includes('APPROVED') || t.includes('APROBADO')) {
      return <Badge className="border-[var(--cf-success)] bg-[var(--cf-surface-2)] text-[var(--cf-success)]">Aprobado</Badge>
    }
    if (t.includes('REJECTED') || t.includes('RECHAZADO')) {
      return <Badge className="border-[var(--cf-danger)] bg-[var(--cf-surface-2)] text-[var(--cf-danger)]">Rechazado</Badge>
    }
    if (t.includes('UPLOAD') || t.includes('SUBIDO')) {
      return <Badge className="border-[var(--cf-border)] bg-[var(--cf-surface-2)] text-[var(--cf-text-secondary)]">Subido</Badge>
    }
    if (t.includes('EXPIR') || t.includes('VENC')) {
      return <Badge className="border-[var(--cf-warning)] bg-[var(--cf-surface-2)] text-[var(--cf-warning)]">Vencimiento</Badge>
    }
    if (t.includes('PENDING') || t.includes('PENDIENTE')) {
      return <Badge className="border-[var(--cf-warning)] bg-[var(--cf-surface-2)] text-[var(--cf-warning)]">Pendiente</Badge>
    }
    if (t.includes('ANOMAL') || t.includes('WARNING')) {
      return <Badge className="border-[var(--cf-warning)] bg-[var(--cf-surface-2)] text-[var(--cf-warning)]">Anomalía</Badge>
    }
    if (t.includes('AI') || t.includes('ANALISIS') || t.includes('IA')) {
      return <Badge className="border-[var(--cf-accent)] bg-[var(--cf-surface-2)] text-[var(--cf-text-secondary)]">IA</Badge>
    }
    if (t.includes('INFO') || t.includes('SUCCESS')) {
      return <Badge className="border-[var(--cf-border)] bg-[var(--cf-surface-2)] text-[var(--cf-text-secondary)]">Info</Badge>
    }
    return <Badge variant="secondary" className="border-[var(--cf-border)] bg-[var(--cf-surface-2)] text-[var(--cf-text-muted)]">Sistema</Badge>
  }

  const handleClick = () => {
    if (onNavigate) {
      onNavigate()
    } else {
      router.push('/dashboard/company/alertas')
    }
  }

  return (
    <button
      type="button"
      className="flex w-full flex-col gap-3 rounded-[5px] border border-[var(--cf-border)] bg-[var(--cf-surface)] p-4 text-left transition-colors hover:bg-[var(--cf-surface-2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cf-focus-ring)] sm:flex-row sm:items-start sm:justify-between"
      onClick={handleClick}
      aria-label={`${title}. Abrir alertas`}
    >
      <div className="flex items-start space-x-3 flex-1 min-w-0">
        <div className="mt-0.5 flex-shrink-0">{getStatusIcon(type)}</div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm text-foreground">{title}</p>
          {transportistaNombre && (
            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-[var(--cf-text-secondary)]">
              <span className="inline-flex items-center gap-1.5 font-medium">
                <Building2 className="h-3.5 w-3.5 text-[var(--cf-text-muted)]" aria-hidden="true" />
                Subcontratista: {transportistaNombre}
              </span>
              {transportistaRut && <span className="text-[var(--cf-text-muted)]">RUT {transportistaRut}</span>}
            </div>
          )}
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{message}</p>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <p className="text-xs text-muted-foreground">
              {new Date(created_at).toLocaleDateString("es-CL", {
                year: "numeric",
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
            {metadata?.document_type && (
              <Badge variant="secondary" className="text-xs">
                {metadata.document_type}
              </Badge>
            )}
          </div>
        </div>
      </div>
      <div className="flex-shrink-0">{getStatusBadge(type)}</div>
    </button>
  )
})

AlertItem.displayName = "AlertItem"

export { AlertItem }
