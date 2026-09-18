'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import {
  AlertTriangle,
  ArrowRight,
  Clock3,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  XCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

type ActionKind = 'expired' | 'rejected' | 'pending' | 'expiring'

type ActionItem = {
  id: string
  entityType: 'subcontractor' | 'driver'
  entityId: string | null
  entityName: string
  entityRut: string | null
  documentType: string
  fileName: string | null
  state: ActionKind
  status: string | null
  expiresAt: string | null
  daysUntilExpiry: number | null
  rejectionReason: string | null
  confidence: number | null
  nextAction: string
  href: string
}

type ActionCenterResponse = {
  summary: {
    totalActionable: number
    expired: number
    rejected: number
    pending: number
    expiring: number
    selectedState: ActionKind | null
    generatedAt: string
  }
  items: ActionItem[]
}

const actionKinds: ActionKind[] = ['expired', 'rejected', 'pending', 'expiring']

const stateMeta: Record<ActionKind, {
  label: string
  pluralLabel: string
  icon: typeof AlertTriangle
  classes: string
  dot: string
}> = {
  expired: {
    label: 'Vencido',
    pluralLabel: 'vencidos',
    icon: XCircle,
    classes: 'border-red-500/25 bg-red-500/10 text-red-200',
    dot: 'bg-red-400',
  },
  rejected: {
    label: 'Rechazado',
    pluralLabel: 'rechazados',
    icon: AlertTriangle,
    classes: 'border-rose-500/25 bg-rose-500/10 text-rose-200',
    dot: 'bg-rose-400',
  },
  pending: {
    label: 'Pendiente',
    pluralLabel: 'pendientes',
    icon: Clock3,
    classes: 'border-amber-500/25 bg-amber-500/10 text-amber-100',
    dot: 'bg-amber-400',
  },
  expiring: {
    label: 'Por vencer',
    pluralLabel: 'por vencer',
    icon: RotateCcw,
    classes: 'border-yellow-500/25 bg-yellow-500/10 text-yellow-100',
    dot: 'bg-yellow-300',
  },
}

function formatExpiry(item: ActionItem) {
  if (item.daysUntilExpiry === null) return null
  if (item.daysUntilExpiry < 0) return `Venció hace ${Math.abs(item.daysUntilExpiry)} días`
  if (item.daysUntilExpiry === 0) return 'Vence hoy'
  if (item.daysUntilExpiry === 1) return 'Vence mañana'
  return `Vence en ${item.daysUntilExpiry} días`
}

function Metric({
  label,
  value,
  kind,
  href,
}: {
  label: string
  value: number
  kind: ActionKind
  href: string
}) {
  const meta = stateMeta[kind]
  const Icon = meta.icon

  return (
    <Link href={href} className="block">
      <div className="rounded-[5px] border border-[#303238] bg-[#181A1D] px-4 py-3 transition-colors hover:border-[#464950] hover:bg-[#1D1F23]">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[10px] uppercase tracking-[0.18em] text-[#8F949C]">{label}</p>
          <Icon className="h-4 w-4 text-[#8F949C]" />
        </div>
        <p className="mt-2 text-2xl font-medium text-[#F2F0EB]">{value.toLocaleString('es-CL')}</p>
      </div>
    </Link>
  )
}

export function OperationalActionCenter({ compact = false }: { compact?: boolean }) {
  const searchParams = useSearchParams()
  const requestedState = compact ? null : searchParams.get('state')
  const selectedState = actionKinds.includes(requestedState as ActionKind)
    ? (requestedState as ActionKind)
    : null
  const [data, setData] = useState<ActionCenterResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true)
    setError(null)

    try {
      const params = new URLSearchParams({
        limit: String(compact ? 8 : 30),
        _t: String(Date.now()),
      })
      if (selectedState) params.set('state', selectedState)

      const response = await fetch(`/api/company/action-center?${params.toString()}`, {
        cache: 'no-store',
        credentials: 'same-origin',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          Pragma: 'no-cache',
        },
      })

      if (!response.ok) throw new Error(`Action center API ${response.status}`)
      setData(await response.json())
    } catch (cause) {
      console.error('[action-center] load failed:', cause)
      setError('No fue posible cargar la cola operacional.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [compact, selectedState])

  useEffect(() => {
    setLoading(true)
    void load()
    const interval = window.setInterval(() => void load(), 60000)
    return () => window.clearInterval(interval)
  }, [load])

  if (loading) {
    return (
      <section className="rounded-[5px] border border-[#303238] bg-[#181A1D] p-5" aria-busy="true">
        <div className="h-5 w-56 animate-pulse rounded bg-[#25282D]" />
        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-20 animate-pulse rounded-[5px] bg-[#202226]" />
          ))}
        </div>
      </section>
    )
  }

  if (error || !data) {
    return (
      <section className="rounded-[5px] border border-red-500/20 bg-red-500/[0.05] p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 text-red-300" />
            <div>
              <h2 className="text-sm font-medium text-red-100">Centro de Acción no disponible</h2>
              <p className="mt-1 text-sm text-red-200/70">{error}</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => void load(true)}>
            Reintentar
          </Button>
        </div>
      </section>
    )
  }

  const { summary, items } = data
  const activeState = summary.selectedState
  const activeCount = activeState ? summary[activeState] : summary.totalActionable

  return (
    <section className="rounded-[5px] border border-[#303238] bg-[#15171A] text-[#F2F0EB]">
      <div className="flex flex-col gap-4 border-b border-[#303238] p-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-[#A9ADB3]">
            <ShieldAlert className="h-4 w-4" />
            Centro de Acción
          </div>
          <h2 className="mt-2 text-xl font-medium tracking-tight">Qué requiere atención hoy</h2>
          <p className="mt-1 text-sm text-[#A9ADB3]">
            {activeState
              ? `${activeCount.toLocaleString('es-CL')} documentos ${stateMeta[activeState].pluralLabel}. Mostrando los ${items.length} más prioritarios.`
              : `${summary.totalActionable.toLocaleString('es-CL')} documentos requieren una acción operacional.`}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {activeState && !compact && (
            <Link href="/dashboard/company/action-center">
              <Button
                variant="outline"
                size="sm"
                className="border-[#303238] bg-transparent text-[#C6C8CC] hover:bg-[#202226] hover:text-[#F2F0EB]"
              >
                Ver todas
              </Button>
            </Link>
          )}
          <Button
            variant="outline"
            size="sm"
            className="border-[#303238] bg-transparent text-[#C6C8CC] hover:bg-[#202226] hover:text-[#F2F0EB]"
            onClick={() => void load(true)}
            disabled={refreshing}
          >
            <RefreshCw className={`mr-2 h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
          {compact && (
            <Link href="/dashboard/company/action-center">
              <Button size="sm" className="bg-[#742D3D] text-[#F2F0EB] hover:bg-[#873448]">
                Abrir cola <ArrowRight className="ml-2 h-3.5 w-3.5" />
              </Button>
            </Link>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 p-5 lg:grid-cols-4">
        <Metric label="Vencidos" value={summary.expired} kind="expired" href="/dashboard/company/action-center?state=expired" />
        <Metric label="Rechazados" value={summary.rejected} kind="rejected" href="/dashboard/company/documentos/rechazados" />
        <Metric label="Pendientes" value={summary.pending} kind="pending" href="/dashboard/company/documentos/pendientes" />
        <Metric label="Vencen ≤30 días" value={summary.expiring} kind="expiring" href="/dashboard/company/action-center?state=expiring" />
      </div>

      <div className="border-t border-[#303238]">
        {items.length === 0 ? (
          <div className="p-6 text-sm text-[#A9ADB3]">No hay acciones pendientes.</div>
        ) : (
          <div className="divide-y divide-[#303238]">
            {items.map((item) => {
              const meta = stateMeta[item.state]
              const expiry = formatExpiry(item)

              return (
                <div key={item.id} className="grid gap-3 px-5 py-4 transition-colors hover:bg-[#181A1D] lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_auto] lg:items-center">
                  <div className="min-w-0">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className={`h-2 w-2 shrink-0 rounded-full ${meta.dot}`} />
                      <p className="truncate text-sm font-medium text-[#F2F0EB]">{item.entityName}</p>
                      {item.entityRut && <span className="hidden text-xs text-[#777C84] sm:inline">{item.entityRut}</span>}
                    </div>
                    <p className="mt-1 truncate text-xs text-[#A9ADB3]">{item.documentType}</p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`inline-flex items-center rounded-[4px] border px-2 py-1 text-[11px] font-medium ${meta.classes}`}>
                      {meta.label}
                    </span>
                    {expiry && <span className="text-xs text-[#A9ADB3]">{expiry}</span>}
                    {item.rejectionReason && (
                      <span className="max-w-[320px] truncate text-xs text-[#D999A5]" title={item.rejectionReason}>
                        {item.rejectionReason}
                      </span>
                    )}
                  </div>

                  <Link href={item.href} className="w-fit">
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-[#303238] bg-transparent text-xs text-[#D8D6D1] hover:bg-[#202226] hover:text-[#F2F0EB]"
                    >
                      {item.nextAction}
                      <ArrowRight className="ml-2 h-3.5 w-3.5" />
                    </Button>
                  </Link>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {!compact && (
        <div className="border-t border-[#303238] px-5 py-3 text-[11px] text-[#777C84]">
          Priorización derivada de estado vigente, vencimiento y necesidad de revisión. No modifica documentos ni decisiones.
        </div>
      )}
    </section>
  )
}
