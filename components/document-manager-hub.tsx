'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  AlertTriangle,
  ArrowRight,
  Award,
  BarChart3,
  CheckCircle,
  Clock,
  FileStack,
  FileText,
  FolderOpen,
  RotateCw,
  Truck,
  Users,
  XCircle,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useDocumentSync } from '@/contexts/document-sync-context'

interface DocumentStats {
  total: number
  processed: number
  pendientes: number
  aprobados: number
  rechazados: number
  vencidos: number
}

interface ModuleStats {
  conductores: DocumentStats
  subcontratistas: DocumentStats
  lifetime?: {
    registered?: number
    processed?: number
    awaitingProcessing?: number
    globalProcessed?: number
  }
  certificaciones: {
    total: number
    vigentes: number
    porVencer: number
    vencidas: number
  }
}

interface DocumentManagerHubProps {
  stats: ModuleStats
}

export function DocumentManagerHub({ stats: initialStats }: DocumentManagerHubProps) {
  const [stats, setStats] = useState(initialStats)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const { onSync } = useDocumentSync()

  const refreshStats = async () => {
    const timestamp = Date.now()
    const options = { cache: 'no-store' as RequestCache }

    const [statsRes, pendingRes, approvedRes, rejectedRes] = await Promise.all([
      fetch(`/api/company/documents/stats?_t=${timestamp}`, options),
      fetch(`/api/dashboard/pending-documents?_t=${timestamp}`, options),
      fetch(`/api/company/documents/aprobados?_t=${timestamp}`, options),
      fetch(`/api/company/documents/rechazados?_t=${timestamp}`, options),
    ])

    if (!statsRes.ok || !pendingRes.ok || !approvedRes.ok || !rejectedRes.ok) return

    const [statsData, pendingData, approvedData, rejectedData] = await Promise.all([
      statsRes.json(),
      pendingRes.json(),
      approvedRes.json(),
      rejectedRes.json(),
    ])

    const raw = statsData.stats || {}
    const pendingConductor = pendingData.conductorDocs?.length || 0
    const pendingSubcontractor = pendingData.subDocs?.length || 0
    const approvedConductor = approvedData.conductorDocs?.length || 0
    const approvedSubcontractor = approvedData.subDocs?.length || 0
    const rejectedConductor = rejectedData.conductorDocs?.length || 0
    const rejectedSubcontractor = rejectedData.subDocs?.length || 0

    setStats({
      ...raw,
      conductores: {
        ...(raw.conductores || {}),
        pendientes: pendingConductor,
        aprobados: approvedConductor,
        rechazados: rejectedConductor,
        total: pendingConductor + approvedConductor + rejectedConductor,
      },
      subcontratistas: {
        ...(raw.subcontratistas || {}),
        pendientes: pendingSubcontractor,
        aprobados: approvedSubcontractor,
        rechazados: rejectedSubcontractor,
        total: pendingSubcontractor + approvedSubcontractor + rejectedSubcontractor,
      },
    })
  }

  const handleManualRefresh = async () => {
    setIsRefreshing(true)
    try {
      await refreshStats()
    } catch (error) {
      console.error('[v0] DocumentManagerHub: Error refreshing stats:', error)
    } finally {
      setIsRefreshing(false)
    }
  }

  useEffect(() => {
    refreshStats().catch((error) => {
      console.error('[v0] DocumentManagerHub: Error verifying stats:', error)
    })

    const pollInterval = setInterval(() => {
      refreshStats().catch((error) => {
        console.error('[v0] DocumentManagerHub: Polling error:', error)
      })
    }, 10000)

    const unsubscribe = onSync((event) => {
      if (event.type === 'document_status_changed') {
        refreshStats().catch((error) => {
          console.error('[v0] DocumentManagerHub: Sync error:', error)
        })
      }
    })

    return () => {
      clearInterval(pollInterval)
      unsubscribe()
    }
  }, [onSync])

  const totalPendientes = stats.conductores.pendientes + stats.subcontratistas.pendientes
  const totalAprobados = stats.conductores.aprobados + stats.subcontratistas.aprobados
  const totalRechazados = stats.conductores.rechazados + stats.subcontratistas.rechazados
  const totalActuales = stats.conductores.total + stats.subcontratistas.total
  const totalGestionados = stats.lifetime?.processed ?? (stats.conductores.processed + stats.subcontratistas.processed)
  const totalChileFlota = stats.lifetime?.globalProcessed ?? totalGestionados

  const modules = [
    {
      id: 'conductores',
      title: 'Documentos de Conductores',
      description: 'Licencias, antecedentes y documentos personales',
      icon: Users,
      href: '/dashboard/company/documentos/aprobados',
      current: stats.conductores.total,
      processed: stats.conductores.processed,
      statItems: [
        { label: 'Pendientes', value: stats.conductores.pendientes, icon: Clock, color: 'text-[#C79B5B]' },
        { label: 'Aprobados', value: stats.conductores.aprobados, icon: CheckCircle, color: 'text-[#6FA48A]' },
        { label: 'Rechazados', value: stats.conductores.rechazados, icon: XCircle, color: 'text-[#D07A88]' },
        { label: 'Revisados', value: stats.conductores.aprobados + stats.conductores.rechazados, icon: FileStack, color: 'text-[#A9ADB3]' },
      ],
    },
    {
      id: 'subcontratistas',
      title: 'Documentos de Subcontratistas',
      description: 'F30, F30-1, contratos y documentos legales',
      icon: Truck,
      href: '/dashboard/company/documentos/aprobados',
      current: stats.subcontratistas.total,
      processed: stats.subcontratistas.processed,
      statItems: [
        { label: 'Pendientes', value: stats.subcontratistas.pendientes, icon: Clock, color: 'text-[#C79B5B]' },
        { label: 'Aprobados', value: stats.subcontratistas.aprobados, icon: CheckCircle, color: 'text-[#6FA48A]' },
        { label: 'Rechazados', value: stats.subcontratistas.rechazados, icon: XCircle, color: 'text-[#D07A88]' },
        { label: 'Revisados', value: stats.subcontratistas.aprobados + stats.subcontratistas.rechazados, icon: FileStack, color: 'text-[#A9ADB3]' },
      ],
    },
    {
      id: 'certificaciones',
      title: 'Certificaciones',
      description: 'Ariztia, LTS, Rendic e Interpolar',
      icon: Award,
      href: '/dashboard/company/documentos',
      current: stats.certificaciones.total,
      processed: null,
      statItems: [
        { label: 'Asignadas', value: stats.certificaciones.vigentes, icon: CheckCircle, color: 'text-[#6FA48A]' },
        { label: 'Por vencer', value: stats.certificaciones.porVencer, icon: AlertTriangle, color: 'text-[#C79B5B]' },
        { label: 'Vencidas', value: stats.certificaciones.vencidas, icon: XCircle, color: 'text-[#D07A88]' },
      ],
    },
  ]

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <header className="flex flex-col gap-4 border-b border-[#303238] pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 max-w-3xl">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-[#A9ADB3]">
            <FolderOpen className="h-4 w-4" />
            Documentos
          </div>
          <h1 className="mt-2 text-2xl font-medium tracking-tight text-[#F2F0EB] sm:text-3xl">
            Gestor de Documentos
          </h1>
          <p className="mt-2 text-sm leading-6 text-[#A9ADB3]">
            {totalGestionados.toLocaleString('es-CL')} documentos procesados en tu cartera. {totalActuales.toLocaleString('es-CL')} registros están clasificados por estado de revisión.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="h-8 rounded-[5px] border-[#303238] px-2.5 text-xs font-normal text-[#C6C8CC]">
            <BarChart3 className="mr-1.5 h-3.5 w-3.5" />
            {totalChileFlota.toLocaleString('es-CL')} procesados ChileFlota
          </Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            className="h-8 rounded-[5px] border-[#303238] bg-transparent px-2.5 text-xs font-normal text-[#C6C8CC] hover:bg-[#202226] hover:text-[#F2F0EB]"
          >
            <RotateCw className={`mr-1.5 h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            {isRefreshing ? 'Actualizando...' : 'Actualizar'}
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-[5px] bg-[#303238] md:grid-cols-5">
        <MetricCard label="Procesados cartera" value={totalGestionados} detail={`ChileFlota total: ${totalChileFlota.toLocaleString('es-CL')}`} icon={FileStack} tone="neutral" />
        <MetricCard label="Registros" value={totalActuales} detail="Estados de revisión de la cartera documental" icon={FileText} tone="neutral" />
        <Link href="/dashboard/company/documentos/pendientes" className="contents">
          <MetricCard label="Pendientes" value={totalPendientes} icon={Clock} tone="warning" />
        </Link>
        <Link href="/dashboard/company/documentos/aprobados" className="contents">
          <MetricCard label="Aprobados" value={totalAprobados} icon={CheckCircle} tone="success" />
        </Link>
        <Link href="/dashboard/company/documentos/rechazados" className="contents">
          <MetricCard label="Rechazados" value={totalRechazados} icon={XCircle} tone="danger" />
        </Link>
      </div>

      <p className="text-xs leading-5 text-[#777C84]">
        En subcontratistas, cada carga conserva su propio estado de revisión. La vigencia operacional se calcula por separado en Compliance.
      </p>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        {modules.map((module) => {
          const Icon = module.icon
          return (
            <Card key={module.id} className="flex flex-col rounded-[5px] border-0 bg-[#181A1D] shadow-none">
              <CardHeader className="p-4 pb-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-[5px] bg-[#202226]">
                    <Icon className="h-4 w-4 text-[#A9ADB3]" />
                  </div>
                  <div className="flex flex-col items-end gap-1 text-right">
                    {module.processed !== null ? (
                      <>
                        <span className="text-xs tabular-nums text-[#C6C8CC]">{module.processed.toLocaleString('es-CL')} gestionados</span>
                        <span className="text-[11px] tabular-nums text-[#777C84]">{module.current.toLocaleString('es-CL')} registros</span>
                      </>
                    ) : (
                      <span className="text-xs tabular-nums text-[#C6C8CC]">{module.current.toLocaleString('es-CL')} asignadas</span>
                    )}
                  </div>
                </div>
                <CardTitle className="mt-3 text-base font-medium text-[#F2F0EB]">{module.title}</CardTitle>
                <CardDescription className="text-xs leading-5 text-[#A9ADB3]">{module.description}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col p-4 pt-2">
                <div className="flex-1 space-y-2">
                  {module.statItems.map((stat) => {
                    const StatIcon = stat.icon
                    return (
                      <div key={stat.label} className="flex min-h-8 items-center justify-between gap-3 text-xs">
                        <div className="flex min-w-0 items-center gap-2">
                          <StatIcon className={`h-3.5 w-3.5 flex-shrink-0 ${stat.color}`} />
                          <span className="truncate text-[#A9ADB3]">{stat.label}</span>
                        </div>
                        <span className={`font-medium tabular-nums ${stat.color}`}>{stat.value.toLocaleString('es-CL')}</span>
                      </div>
                    )
                  })}
                </div>

                <Link href={module.href} className="mt-4 w-full">
                  <Button
                    variant="ghost"
                    className="h-9 w-full justify-between rounded-[5px] px-3 text-xs font-normal text-[#C6C8CC] hover:bg-[#202226] hover:text-[#F2F0EB]"
                  >
                    Ver detalles
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}

type MetricTone = 'neutral' | 'warning' | 'success' | 'danger'

const metricToneClasses: Record<MetricTone, { label: string; value: string; icon: string }> = {
  neutral: { label: 'text-[#A9ADB3]', value: 'text-[#F2F0EB]', icon: 'text-[#777C84]' },
  warning: { label: 'text-[#BFA16E]', value: 'text-[#D6B678]', icon: 'text-[#A06E32]' },
  success: { label: 'text-[#86B09A]', value: 'text-[#9CC5B1]', icon: 'text-[#39765B]' },
  danger: { label: 'text-[#C98B96]', value: 'text-[#D8A0AA]', icon: 'text-[#994550]' },
}

function MetricCard({ label, value, detail, icon: Icon, tone }: { label: string; value: number; detail?: string; icon: typeof FileText; tone: MetricTone }) {
  const classes = metricToneClasses[tone]
  return (
    <div className="min-h-[118px] bg-[#181A1D] p-4 transition-colors hover:bg-[#202226]">
      <div className="flex h-full flex-col gap-1">
        <div className="flex items-center justify-between gap-2">
          <p className={`text-xs ${classes.label}`}>{label}</p>
          <Icon className={`h-4 w-4 ${classes.icon}`} />
        </div>
        <p className={`mt-2 text-2xl font-medium tabular-nums ${classes.value}`}>{value.toLocaleString('es-CL')}</p>
        {detail && <p className="mt-auto pt-2 text-[11px] leading-4 text-[#777C84]">{detail}</p>}
      </div>
    </div>
  )
}
