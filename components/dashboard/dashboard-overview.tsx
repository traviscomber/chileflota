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

  useEffect(() => {
    const fetchData = async () => {
      try {
        const timestamp = Date.now()
        const alertsRes = await fetch(`/api/alerts?limit=50&_t=${timestamp}`, {
          cache: "no-store",
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0',
          }
        })

        const statsRes = await fetch(`/api/company/documents/stats?_t=${timestamp}`, {
          cache: "no-store",
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0',
          }
        })

        if (alertsRes.ok) {
          const alertsData = await alertsRes.json()
          const alertsList = Array.isArray(alertsData) ? alertsData : (alertsData.alerts || [])
          setAlerts(alertsList)
        }

        if (statsRes.ok) {
          const statsData = await statsRes.json()
          const stats = statsData.stats || {}

          const conductorStats = stats.conductores || {}
          const subStats = stats.subcontratistas || {}
          const lifetime = stats.lifetime || {}

          const totalDocs = (conductorStats.total || 0) + (subStats.total || 0)
          const pendingDocs = (conductorStats.pendientes || 0) + (subStats.pendientes || 0)
          const approvedDocs = (conductorStats.aprobados || 0) + (subStats.aprobados || 0)
          const rejectedDocs = (conductorStats.rechazados || 0) + (subStats.rechazados || 0)

          setLifetimeStats({
            registered: lifetime.registered || 0,
            processed: lifetime.processed || 0,
            awaitingProcessing: lifetime.awaitingProcessing || 0,
          })

          console.log('[v0] Dashboard Stats from /api/company/documents/stats:', {
            lifetimeRegistered: lifetime.registered || 0,
            lifetimeProcessed: lifetime.processed || 0,
            awaitingProcessing: lifetime.awaitingProcessing || 0,
            current: totalDocs,
            pending: pendingDocs,
            approved: approvedDocs,
            rejected: rejectedDocs
          })

          setStats([
            {
              title: "Total de Documentos",
              value: totalDocs.toString(),
              description: "En el sistema",
              icon: FileText,
              status: "active",
              href: "/dashboard/company/documentos",
              color: "blue",
            },
            {
              title: "Documentos Aprobados",
              value: approvedDocs.toString(),
              description: "Validados",
              icon: CheckCircle,
              status: "active",
              href: "/dashboard/company/documentos/aprobados",
              color: "green",
            },
            {
              title: "Documentos Pendientes",
              value: pendingDocs.toString(),
              description: "En revisión",
              icon: Clock,
              status: "active",
              href: "/dashboard/company/documentos/pendientes",
              color: "orange",
            },
            {
              title: "Documentos Rechazados",
              value: rejectedDocs.toString(),
              description: "No validados",
              icon: AlertTriangle,
              status: "warning",
              href: "/dashboard/company/documentos/rechazados",
              color: "red",
            },
          ])
        }
      } catch (error) {
        console.error('[v0] Error loading dashboard data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()

    const interval = setInterval(fetchData, 10000)

    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const unsubscribe = onSync((event) => {
      if (event.type === 'document_uploaded' || event.type === 'document_status_changed') {
        const fetchUpdatedStats = async () => {
          try {
            const statsRes = await fetch(`/api/company/documents/stats?_t=${Date.now()}`, {
              cache: "no-store",
              headers: {
                'Cache-Control': 'no-cache, no-store, must-revalidate',
              }
            })

            if (statsRes.ok) {
              const statsData = await statsRes.json()
              const stats = statsData.stats || {}

              const conductorStats = stats.conductores || {}
              const subStats = stats.subcontratistas || {}
              const lifetime = stats.lifetime || {}

              const totalDocs = (conductorStats.total || 0) + (subStats.total || 0)
              const pendingDocs = (conductorStats.pendientes || 0) + (subStats.pendientes || 0)
              const approvedDocs = (conductorStats.aprobados || 0) + (subStats.aprobados || 0)
              const rejectedDocs = (conductorStats.rechazados || 0) + (subStats.rechazados || 0)

              setLifetimeStats({
                registered: lifetime.registered || 0,
                processed: lifetime.processed || 0,
                awaitingProcessing: lifetime.awaitingProcessing || 0,
              })

              setStats([
                {
                  title: "Total de Documentos",
                  value: totalDocs.toString(),
                  description: "En el sistema",
                  icon: FileText,
                  status: "active",
                  href: "/dashboard/company/documentos",
                  color: "blue",
                },
                {
                  title: "Documentos Aprobados",
                  value: approvedDocs.toString(),
                  description: "Validados",
                  icon: CheckCircle,
                  status: "active",
                  href: "/dashboard/company/documentos/aprobados",
                  color: "green",
                },
                {
                  title: "Documentos Pendientes",
                  value: pendingDocs.toString(),
                  description: "En revisión",
                  icon: Clock,
                  status: "active",
                  href: "/dashboard/company/documentos/pendientes",
                  color: "orange",
                },
                {
                  title: "Documentos Rechazados",
                  value: rejectedDocs.toString(),
                  description: "No validados",
                  icon: AlertTriangle,
                  status: "warning",
                  href: "/dashboard/company/documentos/rechazados",
                  color: "red",
                },
              ])
            }
          } catch (error) {
            console.error('[v0] Error refetching stats:', error)
          }
        }

        fetchUpdatedStats()
      }
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
            <Link
              href="/dashboard/company/documentos"
              className="group rounded-[6px] border border-[var(--cf-border)] bg-[var(--cf-canvas)] p-4 text-left transition-colors hover:bg-[var(--cf-surface-raised)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cf-focus-ring)]"
            >
              <FileText className="mb-4 h-4 w-4 text-[var(--cf-text-muted)] transition-colors group-hover:text-[var(--cf-text-secondary)]" />
              <p className="text-xs font-medium text-[var(--cf-text-muted)]">Procesados</p>
              <p className="mt-1 text-3xl font-semibold tracking-[-0.04em] text-[var(--cf-text)]">{lifetimeStats.processed.toLocaleString('es-CL')}</p>
              <p className="mt-2 text-xs leading-5 text-[var(--cf-text-muted)]">Histórico procesado por ChileFlota</p>
            </Link>

            <Link
              href="/dashboard/company/documentos/aprobados"
              className="group rounded-[6px] border border-[var(--cf-border)] bg-[var(--cf-canvas)] p-4 text-left transition-colors hover:bg-[var(--cf-surface-raised)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cf-focus-ring)]"
            >
              <CheckCircle className="mb-4 h-4 w-4 text-[var(--cf-success)]" />
              <p className="text-xs font-medium text-[var(--cf-text-muted)]">Aprobados</p>
              <p className="mt-1 text-3xl font-semibold tracking-[-0.04em] text-[var(--cf-text)]">{approvedDocuments.toLocaleString('es-CL')}</p>
              <p className="mt-2 text-xs leading-5 text-[var(--cf-text-muted)]">Validados en el período actual</p>
            </Link>

            <Link
              href="/dashboard/company/documentos/pendientes"
              className="group rounded-[6px] border border-[var(--cf-border)] bg-[var(--cf-canvas)] p-4 text-left transition-colors hover:bg-[var(--cf-surface-raised)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cf-focus-ring)]"
            >
              <Clock className="mb-4 h-4 w-4 text-[var(--cf-warning)]" />
              <p className="text-xs font-medium text-[var(--cf-text-muted)]">Pendientes</p>
              <p className="mt-1 text-3xl font-semibold tracking-[-0.04em] text-[var(--cf-text)]">{pendingDocuments.toLocaleString('es-CL')}</p>
              <p className="mt-2 text-xs leading-5 text-[var(--cf-text-muted)]">Esperan revisión humana</p>
            </Link>

            <Link
              href="/dashboard/company/documentos/rechazados"
              className="group rounded-[6px] border border-[var(--cf-border)] bg-[var(--cf-canvas)] p-4 text-left transition-colors hover:bg-[var(--cf-surface-raised)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cf-focus-ring)]"
            >
              <AlertTriangle className="mb-4 h-4 w-4 text-[var(--cf-danger)]" />
              <p className="text-xs font-medium text-[var(--cf-text-muted)]">Rechazados</p>
              <p className="mt-1 text-3xl font-semibold tracking-[-0.04em] text-[var(--cf-text)]">{rejectedDocuments.toLocaleString('es-CL')}</p>
              <p className="mt-2 text-xs leading-5 text-[var(--cf-text-muted)]">Requieren corrección o nueva evidencia</p>
            </Link>
          </div>

          <div className="mt-4 flex flex-col gap-4 border-t border-[var(--cf-border)] pt-4 lg:flex-row lg:items-center lg:justify-between">
            <p className="text-sm text-[var(--cf-text-secondary)]">
              {openRiskItems > 0 ? (
                <>
                  <span className="font-medium text-[var(--cf-warning)]">{openRiskItems.toLocaleString('es-CL')} documentos requieren atención</span>
                  <span className="text-[var(--cf-text-muted)]"> · {rejectedDocuments} rechazados · {pendingDocuments} pendientes</span>
                </>
              ) : (
                <span className="font-medium text-[var(--cf-success)]">Sin revisiones críticas abiertas en el período actual.</span>
              )}
            </p>

            <nav className="flex flex-wrap gap-2" aria-label="Acciones de control documental">
              <Link
                href="/dashboard/company/documentos/vencidos"
                className="inline-flex min-h-11 items-center justify-center rounded-[5px] border border-[var(--cf-border)] px-3 text-xs font-medium text-[var(--cf-text-secondary)] transition-colors hover:bg-[var(--cf-surface-raised)] hover:text-[var(--cf-text)] sm:min-h-9"
              >
                Ver vencidos <ArrowRight className="ml-1.5 h-3 w-3" aria-hidden="true" />
              </Link>
              <Link
                href="/dashboard/company/documentos/renovar"
                className="inline-flex min-h-11 items-center justify-center rounded-[5px] border border-[var(--cf-border)] px-3 text-xs font-medium text-[var(--cf-text-secondary)] transition-colors hover:bg-[var(--cf-surface-raised)] hover:text-[var(--cf-text)] sm:min-h-9"
              >
                Renovaciones <ArrowRight className="ml-1.5 h-3 w-3" aria-hidden="true" />
              </Link>
              <Link
                href="/dashboard/company/reportes"
                className="inline-flex min-h-11 items-center justify-center rounded-[5px] border border-[var(--cf-border)] px-3 text-xs font-medium text-[var(--cf-text-secondary)] transition-colors hover:bg-[var(--cf-surface-raised)] hover:text-[var(--cf-text)] sm:min-h-9"
              >
                Reportes <ArrowRight className="ml-1.5 h-3 w-3" aria-hidden="true" />
              </Link>
              <Link
                href="/dashboard/company/compliance"
                className="inline-flex min-h-11 items-center justify-center rounded-[5px] bg-[var(--cf-accent)] px-3 text-xs font-medium text-[var(--cf-text)] transition-colors hover:bg-[var(--cf-accent-hover)] sm:min-h-9"
              >
                <Shield className="mr-1.5 h-3 w-3" aria-hidden="true" />
                Matriz
              </Link>
            </nav>
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
                  Evidencia que requiere lectura o seguimiento · {alerts.length} alertas
                </CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {(() => {
                  const approved = alerts.filter(a => a.type?.toUpperCase().includes('APPROVED')).length
                  const rejected = alerts.filter(a => a.type?.toUpperCase().includes('REJECTED')).length
                  const pending = alerts.filter(a => a.type?.toUpperCase().includes('PENDING') || a.type?.toUpperCase().includes('UPLOAD')).length
                  const expiring = alerts.filter(a => a.type?.toUpperCase().includes('EXPIR') || a.type?.toUpperCase().includes('VENC')).length
                  return (
                    <>
                      {approved > 0 && (
                        <span className="rounded-[4px] border border-[var(--cf-success)] bg-[var(--cf-surface-2)] px-2 py-1 text-xs font-medium text-[var(--cf-success)]">
                          {approved} aprobados
                        </span>
                      )}
                      {rejected > 0 && (
                        <span className="rounded-[4px] border border-[var(--cf-danger)] bg-[var(--cf-surface-2)] px-2 py-1 text-xs font-medium text-[var(--cf-danger)]">
                          {rejected} rechazados
                        </span>
                      )}
                      {pending > 0 && (
                        <span className="rounded-[4px] border border-[var(--cf-warning)] bg-[var(--cf-surface-2)] px-2 py-1 text-xs font-medium text-[var(--cf-warning)]">
                          {pending} en revisión
                        </span>
                      )}
                      {expiring > 0 && (
                        <span className="rounded-[4px] border border-[var(--cf-warning)] bg-[var(--cf-surface-2)] px-2 py-1 text-xs font-medium text-[var(--cf-warning)]">
                          {expiring} por vencer
                        </span>
                      )}
                    </>
                  )
                })()}
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 border-[var(--cf-border)] bg-transparent text-xs text-[var(--cf-text-secondary)] hover:bg-[var(--cf-surface-raised)] hover:text-[var(--cf-text)]"
                  onClick={() => router.push('/dashboard/company/alertas')}
                >
                  Ver todas
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="max-h-[500px] space-y-2 overflow-y-auto pr-1">
              {alerts.slice(0, 20).map((alert) => (
                <AlertItem
                  key={alert.id}
                  id={alert.id}
                  type={alert.type}
                  title={alert.title}
                  message={alert.message}
                  created_at={alert.created_at}
                  source={alert.source}
                  metadata={alert.metadata}
                  onNavigate={() => router.push('/dashboard/company/alertas')}
                />
              ))}
            </div>
            {alerts.length > 20 && (
              <p className="mt-4 border-t border-[var(--cf-border)] py-3 text-center text-xs text-[var(--cf-text-muted)]">
                + {alerts.length - 20} alertas más · <button onClick={() => router.push('/dashboard/company/alertas')} className="font-medium text-[var(--cf-accent-hover)] hover:underline">Abrir panel completo</button>
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {loading && alerts.length === 0 && (
        <p className="text-xs text-[var(--cf-text-muted)]">Actualizando estado operacional…</p>
      )}
    </div>
  )
}
