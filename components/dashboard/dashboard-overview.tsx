"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { FileText, AlertTriangle, CheckCircle, Clock, LucideIcon, ArrowRight, Shield } from "lucide-react"
import { useDocumentSync } from "@/contexts/document-sync-context"
import { AlertItem } from "./alert-item"

interface Alert {
  id: string
  type: string
  title: string
  message: string
  priority: string
  is_read: boolean
  is_dismissed: boolean
  created_at: string
  metadata?: Record<string, unknown>
  source?: string
  document_type?: string
}

interface Stat {
  title: string
  value: string
  description: string
  icon: LucideIcon
  status: "active" | "warning"
  href: string
  color?: "blue" | "green" | "orange" | "red"
}

interface LifetimeStats {
  registered: number
  processed: number
  awaitingProcessing: number
  globalProcessed: number
}


async function fetchDashboardSnapshot() {
  const timestamp = Date.now()
  const requestOptions = {
    cache: "no-store" as RequestCache,
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
    },
  }

  const [statsRes, pendingRes, approvedRes, rejectedRes] = await Promise.all([
    fetch(`/api/company/documents/stats?_t=${timestamp}`, requestOptions),
    fetch(`/api/dashboard/pending-documents?_t=${timestamp}`, requestOptions),
    fetch(`/api/company/documents/aprobados?_t=${timestamp}`, requestOptions),
    fetch(`/api/company/documents/rechazados?_t=${timestamp}`, requestOptions),
  ])

  if (!statsRes.ok || !pendingRes.ok || !approvedRes.ok || !rejectedRes.ok) {
    throw new Error(
      `Dashboard sources failed: stats=${statsRes.status} pending=${pendingRes.status} approved=${approvedRes.status} rejected=${rejectedRes.status}`,
    )
  }

  const statsData = await statsRes.json()
  const pendingData = await pendingRes.json()
  const approvedData = await approvedRes.json()
  const rejectedData = await rejectedRes.json()

  const pendingConductor = pendingData.conductorDocs?.length || 0
  const pendingSubcontractor = pendingData.subDocs?.length || 0
  const approvedConductor = approvedData.conductorDocs?.length || 0
  const approvedSubcontractor = approvedData.subDocs?.length || 0
  const rejectedConductor = rejectedData.conductorDocs?.length || 0
  const rejectedSubcontractor = rejectedData.subDocs?.length || 0

  const reviewQueue = [
    ...(pendingData.conductorDocs || []).map((doc: any) => ({
      id: `review_conductor_${doc.id}`,
      type: 'review_required',
      title: 'Documento nuevo para revisión',
      message: `${doc.docType?.nombre || 'Documento'} · ${doc.empresa_nombre || 'Empresa sin nombre'}`,
      priority: 'high',
      is_read: false,
      is_dismissed: false,
      created_at: doc.uploaded_at || doc.created_at,
      source: 'review_queue',
      document_type: doc.docType?.nombre || undefined,
      metadata: {
        document_id: doc.id,
        company_id: doc.company_id,
        transportista_nombre: doc.empresa_nombre,
        conductor_nombre: [doc.conductores?.nombres, doc.conductores?.apellido_paterno].filter(Boolean).join(' '),
        document_source: 'conductor',
      },
    })),
    ...(pendingData.subDocs || []).map((doc: any) => ({
      id: `review_subcontractor_${doc.id}`,
      type: 'review_required',
      title: 'Documento nuevo para revisión',
      message: `${doc.docType?.nombre || 'Documento'} · ${doc.empresa_nombre || 'Empresa sin nombre'}`,
      priority: 'high',
      is_read: false,
      is_dismissed: false,
      created_at: doc.uploaded_at || doc.created_at,
      source: 'review_queue',
      document_type: doc.docType?.nombre || undefined,
      metadata: {
        document_id: doc.id,
        company_id: doc.company_id,
        transportista_nombre: doc.empresa_nombre,
        transportista_rut: doc.subcontractor_rut,
        document_source: 'subcontractor',
      },
    })),
  ]
    .filter((alert) => Boolean(alert.created_at))
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 10)

  return {
    alerts: reviewQueue,
    lifetime: statsData.stats?.lifetime || {},
    canonical: {
      conductor: {
        pending: pendingConductor,
        approved: approvedConductor,
        rejected: rejectedConductor,
      },
      subcontractor: {
        pending: pendingSubcontractor,
        approved: approvedSubcontractor,
        rejected: rejectedSubcontractor,
      },
      total: {
        pending: pendingConductor + pendingSubcontractor,
        approved: approvedConductor + approvedSubcontractor,
        rejected: rejectedConductor + rejectedSubcontractor,
      },
    },
  }
}

export function DashboardOverview() {
  const [stats, setStats] = useState<Stat[]>([
    {
      title: "Total de Documentos",
      value: "0",
      description: "En el sistema",
      icon: FileText,
      status: "active",
      href: "/dashboard/company/documentos",
      color: "blue",
    },
    {
      title: "Documentos Aprobados",
      value: "0",
      description: "Validados",
      icon: CheckCircle,
      status: "active",
      href: "/dashboard/company/documentos/aprobados",
      color: "green",
    },
    {
      title: "Documentos Pendientes",
      value: "0",
      description: "En revisión",
      icon: Clock,
      status: "active",
      href: "/dashboard/company/documentos/pendientes",
      color: "orange",
    },
    {
      title: "Documentos Rechazados",
      value: "0",
      description: "No validados",
      icon: AlertTriangle,
      status: "warning",
      href: "/dashboard/company/documentos/rechazados",
      color: "red",
    },
  ])
  const [lifetimeStats, setLifetimeStats] = useState<LifetimeStats>({
    registered: 0,
    processed: 0,
    awaitingProcessing: 0,
    globalProcessed: 0,
  })
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [loading, setLoading] = useState(true)
  const { onSync } = useDocumentSync()
  const router = useRouter()
  const totalDocuments = Number(stats[0]?.value || 0)
  const approvedDocuments = Number(stats[1]?.value || 0)
  const pendingDocuments = Number(stats[2]?.value || 0)
  const rejectedDocuments = Number(stats[3]?.value || 0)
  const openRiskItems = pendingDocuments + rejectedDocuments
  const completionRate = totalDocuments > 0 ? Math.round((approvedDocuments / totalDocuments) * 100) : 0

  const applySnapshot = (snapshot: Awaited<ReturnType<typeof fetchDashboardSnapshot>>) => {
    const lifetime = snapshot.lifetime || {}
    const canonical = snapshot.canonical
    const totalDocs = canonical.total.pending + canonical.total.approved + canonical.total.rejected

    setAlerts(snapshot.alerts)
    setLifetimeStats({
      registered: lifetime.registered || 0,
      processed: lifetime.processed || 0,
      awaitingProcessing: lifetime.awaitingProcessing || 0,
      globalProcessed: lifetime.globalProcessed || lifetime.processed || 0,
    })

    setStats([
      {
        title: "Documentos operacionales",
        value: totalDocs.toString(),
        description: "Estado canónico actual",
        icon: FileText,
        status: "active",
        href: "/dashboard/company/documentos",
        color: "blue",
      },
      {
        title: "Documentos Aprobados",
        value: canonical.total.approved.toString(),
        description: "Validados",
        icon: CheckCircle,
        status: "active",
        href: "/dashboard/company/documentos/aprobados",
        color: "green",
      },
      {
        title: "Documentos Pendientes",
        value: canonical.total.pending.toString(),
        description: "En revisión",
        icon: Clock,
        status: "active",
        href: "/dashboard/company/documentos/pendientes",
        color: "orange",
      },
      {
        title: "Documentos Rechazados",
        value: canonical.total.rejected.toString(),
        description: "No validados",
        icon: AlertTriangle,
        status: "warning",
        href: "/dashboard/company/documentos/rechazados",
        color: "red",
      },
    ])

    console.log('[v0] Canonical dashboard snapshot:', {
      lifetimeProcessed: lifetime.processed || 0,
      awaitingProcessing: lifetime.awaitingProcessing || 0,
      currentOperational: totalDocs,
      pending: canonical.total.pending,
      approved: canonical.total.approved,
      rejected: canonical.total.rejected,
    })
  }

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      try {
        const snapshot = await fetchDashboardSnapshot()
        if (!cancelled) applySnapshot(snapshot)
      } catch (error) {
        console.error('[v0] Error loading canonical dashboard data:', error)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    const interval = setInterval(load, 60000)

    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [])

  useEffect(() => {
    const unsubscribe = onSync((event) => {
      if (event.type !== 'document_uploaded' && event.type !== 'document_status_changed') return

      fetchDashboardSnapshot()
        .then(applySnapshot)
        .catch((error) => console.error('[v0] Error refetching canonical dashboard data:', error))
    })

    return () => unsubscribe()
  }, [onSync])

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border-[var(--cf-border)] bg-[var(--cf-surface)] shadow-none">
        <CardContent className="p-5 md:p-6">
          <div className="mb-6 flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="max-w-2xl">
              <p className="mb-2 text-xs font-medium uppercase tracking-[0.14em] text-[var(--cf-text-muted)]">
                Control operacional
              </p>
              <h1 className="text-2xl font-semibold tracking-[-0.03em] text-[var(--cf-text)] md:text-[28px]">
                Estado documental
              </h1>
              <p className="mt-2 text-sm leading-6 text-[var(--cf-text-secondary)]">
                Prioriza revisiones, incumplimientos y evidencia pendiente sin salir del flujo operativo de Transportes Labbé.
              </p>
            </div>

            <div className="min-w-[180px] border-l-2 border-[var(--cf-accent)] pl-4 sm:text-right">
              <div className="text-3xl font-semibold tracking-[-0.04em] text-[var(--cf-text)]">{completionRate}%</div>
              <div className="mt-1 text-xs font-medium uppercase tracking-[0.12em] text-[var(--cf-text-muted)]">aprobación actual</div>
              <div className="mt-3 h-1.5 w-full overflow-hidden rounded-[3px] bg-[var(--cf-surface-raised)] sm:ml-auto sm:w-36">
                <div
                  className="h-full bg-[var(--cf-accent)] transition-[width] duration-500"
                  style={{ width: `${completionRate}%` }}
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div
              className="rounded-[6px] border border-[var(--cf-border)] bg-[var(--cf-canvas)] p-4 text-left"
            >
              <FileText className="mb-4 h-4 w-4 text-[var(--cf-text-muted)] transition-colors group-hover:text-[var(--cf-text-secondary)]" />
              <p className="text-xs font-medium text-[var(--cf-text-muted)]">Procesados</p>
              <p className="mt-1 text-3xl font-semibold tracking-[-0.04em] text-[var(--cf-text)]">{lifetimeStats.processed.toLocaleString('es-CL')}</p>
              <p className="mt-2 text-xs leading-5 text-[var(--cf-text-muted)]">
                Tu cartera · {lifetimeStats.awaitingProcessing.toLocaleString('es-CL')} aún sin procesar
              </p>
              <p className="mt-1 text-xs font-medium text-[var(--cf-text-secondary)]">
                ChileFlota total: {lifetimeStats.globalProcessed.toLocaleString('es-CL')} procesados
              </p>
            </div>

            <button
              onClick={() => router.push("/dashboard/company/documentos/aprobados")}
              className="group rounded-[6px] border border-[var(--cf-border)] bg-[var(--cf-canvas)] p-4 text-left transition-colors hover:bg-[var(--cf-surface-raised)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cf-focus-ring)]"
            >
              <CheckCircle className="mb-4 h-4 w-4 text-[#67C18D]" />
              <p className="text-xs font-medium text-[var(--cf-text-muted)]">Aprobados</p>
              <p className="mt-1 text-3xl font-semibold tracking-[-0.04em] text-[var(--cf-text)]">{approvedDocuments.toLocaleString('es-CL')}</p>
              <p className="mt-2 text-xs leading-5 text-[var(--cf-text-muted)]">Validados en el período actual</p>
            </button>

            <button
              onClick={() => router.push("/dashboard/company/documentos/pendientes")}
              className="group rounded-[6px] border border-[var(--cf-border)] bg-[var(--cf-canvas)] p-4 text-left transition-colors hover:bg-[var(--cf-surface-raised)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cf-focus-ring)]"
            >
              <Clock className="mb-4 h-4 w-4 text-[#D9B65C]" />
              <p className="text-xs font-medium text-[var(--cf-text-muted)]">Pendientes</p>
              <p className="mt-1 text-3xl font-semibold tracking-[-0.04em] text-[var(--cf-text)]">{pendingDocuments.toLocaleString('es-CL')}</p>
              <p className="mt-2 text-xs leading-5 text-[var(--cf-text-muted)]">Esperan revisión humana</p>
            </button>

            <button
              onClick={() => router.push("/dashboard/company/documentos/rechazados")}
              className="group rounded-[6px] border border-[var(--cf-border)] bg-[var(--cf-canvas)] p-4 text-left transition-colors hover:bg-[var(--cf-surface-raised)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cf-focus-ring)]"
            >
              <AlertTriangle className="mb-4 h-4 w-4 text-[#E17B8C]" />
              <p className="text-xs font-medium text-[var(--cf-text-muted)]">Rechazados</p>
              <p className="mt-1 text-3xl font-semibold tracking-[-0.04em] text-[var(--cf-text)]">{rejectedDocuments.toLocaleString('es-CL')}</p>
              <p className="mt-2 text-xs leading-5 text-[var(--cf-text-muted)]">Requieren corrección o nueva evidencia</p>
            </button>
          </div>

          <div className="mt-4 flex flex-col gap-4 border-t border-[var(--cf-border)] pt-4 lg:flex-row lg:items-center lg:justify-between">
            <p className="text-sm text-[var(--cf-text-secondary)]">
              {openRiskItems > 0 ? (
                <>
                  <span className="font-medium text-[#E6A35A]">{openRiskItems.toLocaleString('es-CL')} documentos requieren atención</span>
                  <span className="text-[var(--cf-text-muted)]"> · {rejectedDocuments} rechazados · {pendingDocuments} pendientes</span>
                </>
              ) : (
                <span className="font-medium text-[#67C18D]">Sin revisiones críticas abiertas en el período actual.</span>
              )}
            </p>

            <div className="flex flex-wrap gap-2">
              <Link href="/dashboard/company/documentos/vencidos">
                <Button variant="outline" size="sm" className="h-9 border-[var(--cf-border)] bg-transparent text-xs text-[var(--cf-text-secondary)] hover:bg-[var(--cf-surface-raised)] hover:text-[var(--cf-text)]">
                  Ver vencidos <ArrowRight className="ml-1.5 h-3 w-3" />
                </Button>
              </Link>
              <Link href="/dashboard/company/documentos/renovar">
                <Button variant="outline" size="sm" className="h-9 border-[var(--cf-border)] bg-transparent text-xs text-[var(--cf-text-secondary)] hover:bg-[var(--cf-surface-raised)] hover:text-[var(--cf-text)]">
                  Renovaciones <ArrowRight className="ml-1.5 h-3 w-3" />
                </Button>
              </Link>
              <Link href="/dashboard/company/reportes">
                <Button variant="outline" size="sm" className="h-9 border-[var(--cf-border)] bg-transparent text-xs text-[var(--cf-text-secondary)] hover:bg-[var(--cf-surface-raised)] hover:text-[var(--cf-text)]">
                  Reportes <ArrowRight className="ml-1.5 h-3 w-3" />
                </Button>
              </Link>
              <Link href="/dashboard/company/compliance">
                <Button size="sm" className="h-9 bg-[var(--cf-accent)] text-xs text-[var(--cf-text)] hover:bg-[var(--cf-accent-hover)]">
                  <Shield className="mr-1.5 h-3 w-3" />
                  Matriz
                </Button>
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>

      {alerts.length > 0 && (
        <Card className="col-span-full border-[var(--cf-border)] bg-[var(--cf-surface)] shadow-none">
          <CardHeader className="pb-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle className="text-lg font-semibold text-[var(--cf-text)]">Alertas prioritarias</CardTitle>
                <CardDescription className="mt-1 text-[var(--cf-text-muted)]">
                  Documentos recién ingresados que puedes revisar ahora · {alerts.length} por atender
                </CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-[4px] bg-[#40341B] px-2 py-1 text-xs font-medium text-[#D9B65C]">
                  {alerts.length} para revisión
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 border-[var(--cf-border)] bg-transparent text-xs text-[var(--cf-text-secondary)] hover:bg-[var(--cf-surface-raised)] hover:text-[var(--cf-text)]"
                  onClick={() => router.push('/dashboard/company/documentos/pendientes')}
                >
                  Ver todas
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {alerts.map((alert) => (
                <AlertItem
                  key={alert.id}
                  id={alert.id}
                  type={alert.type}
                  title={alert.title}
                  message={alert.message}
                  created_at={alert.created_at}
                  source={alert.source}
                  metadata={alert.metadata}
                  onNavigate={() => router.push('/dashboard/company/documentos/pendientes')}
                />
              ))}
            </div>

          </CardContent>
        </Card>
      )}

      {loading && alerts.length === 0 && (
        <p className="text-xs text-[var(--cf-text-muted)]">Actualizando estado operacional…</p>
      )}
    </div>
  )
}
