'use client'

import { useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, ArrowRight, AlertTriangle, CalendarDays, ShieldAlert } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ExpiredDocumentsList } from '@/components/expired-documents-list'
import { DatePeriodFilter } from '@/components/date-period-filter'
import { ALL_VALUE, filterByMonthYear, getMonthLabel, type DateFilterValue } from '@/lib/date-filters'

type DocumentRow = {
  id: string
  original_filename?: string
  document_type?: string
  file_url?: string
  expiration_date?: string
  created_at?: string
  validation_status?: string
  conductores?: {
    id: string
    nombres: string
    apellido_paterno: string
    rut: string
  }
}

function useUrlFilters() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const value: DateFilterValue = {
    month: searchParams.get('month') || ALL_VALUE,
    year: searchParams.get('year') || ALL_VALUE,
  }

  const update = (next: DateFilterValue) => {
    const params = new URLSearchParams(searchParams.toString())

    if (next.month === ALL_VALUE) params.delete('month')
    else params.set('month', next.month)

    if (next.year === ALL_VALUE) params.delete('year')
    else params.set('year', next.year)

    const query = params.toString()
    router.replace(query ? `${pathname}?${query}` : pathname)
  }

  return { value, update }
}

export default function VencidosPage() {
  const [documents, setDocuments] = useState<DocumentRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { value: filters, update } = useUrlFilters()

  useEffect(() => {
    const loadDocuments = async () => {
      try {
        setIsLoading(true)
        setError(null)

        const response = await fetch('/api/company/documents/all', {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
          },
        })

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`)
        }

        const data = await response.json()
        setDocuments(Array.isArray(data.documents) ? data.documents : [])
      } catch (loadError) {
        console.error('[v0] Error loading expired documents:', loadError)
        setError('No se pudieron cargar los documentos vencidos.')
      } finally {
        setIsLoading(false)
      }
    }

    loadDocuments()
  }, [])

  const todayStart = useMemo(() => {
    const now = new Date()
    now.setHours(0, 0, 0, 0)
    return now
  }, [])

  const expiredDocuments = useMemo(() => {
    const expired = documents
      .filter((doc) => {
        if (!doc.expiration_date) return false
        const expirationDate = new Date(doc.expiration_date)
        return expirationDate < todayStart
      })
      .map((doc) => {
        const expirationDate = new Date(doc.expiration_date as string)
        const daysOverdue = Math.ceil((todayStart.getTime() - expirationDate.getTime()) / (1000 * 60 * 60 * 24))

        return {
          ...doc,
          days_overdue: daysOverdue,
        }
      })

    return filterByMonthYear(expired, (doc) => doc.expiration_date, filters.month, filters.year)
      .sort((a, b) => (b.days_overdue || 0) - (a.days_overdue || 0))
  }, [documents, filters.month, filters.year, todayStart])

  const filterLabel = getMonthLabel(filters.month, filters.year)
  const oldestOverdue = expiredDocuments[0]

  return (
    <div className="min-h-screen bg-[var(--cf-surface)]">
      <div className="max-w-6xl mx-auto">
        <div className="border-b border-[var(--cf-border)] bg-[var(--cf-canvas)] sticky top-0 z-40">
          <div className="px-6 py-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Link href="/dashboard/company/documentos">
                <Button variant="ghost" size="sm" className="gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  Volver
                </Button>
              </Link>
              <div>
                <h1 className="text-2xl font-semibold text-[var(--cf-text)] flex items-center gap-2">
                  <AlertTriangle className="h-6 w-6 text-[var(--cf-danger)]" />
                  Documentos Vencidos
                </h1>
                <p className="text-sm text-[var(--cf-text-muted)] mt-1">
                  Análisis histórico de vencimientos por mes y año
                </p>
              </div>
            </div>
            <Badge className="bg-red-600 text-[var(--cf-text)] text-lg px-3 py-2">
              {expiredDocuments.length} documentos
            </Badge>
          </div>
        </div>

        <div className="p-6 space-y-6">
          <Card className="overflow-hidden border-[var(--cf-border)]/60 bg-none from-slate-950 via-slate-900 to-slate-800">
            <CardContent className="p-5 md:p-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
              <div className="space-y-3 max-w-2xl">
                <div className="inline-flex items-center gap-2 rounded-full border border-red-500/30 bg-[var(--cf-danger-soft)] px-3 py-1 text-xs font-medium text-[var(--cf-danger)]">
                  Historial de vencimientos
                </div>
                <div>
                  <h2 className="text-2xl md:text-3xl font-semibold text-[var(--cf-text)]">Detecta lo vencido y prioriza la recuperación</h2>
                  <p className="text-sm md:text-base text-[var(--cf-text-secondary)] mt-2">
                    Revisa el período seleccionado para ver qué caducó, cuánto atraso acumula y qué requiere acción inmediata.
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full lg:w-auto lg:min-w-[34rem]">
                <div className="rounded-[8px] border border-red-500/20 bg-[var(--cf-danger-soft)] px-4 py-4">
                  <p className="text-[10px] uppercase tracking-[0.25em] text-[var(--cf-danger)]/80">Vencidos</p>
                  <p className="mt-2 text-3xl font-semibold text-[var(--cf-danger)]">{expiredDocuments.length}</p>
                  <p className="mt-1 text-xs text-[var(--cf-danger)]/70">Requieren intervención</p>
                </div>
                <div className="rounded-[8px] border border-[var(--cf-border)] bg-[var(--cf-surface)]/70 px-4 py-4">
                  <p className="text-[10px] uppercase tracking-[0.25em] text-[var(--cf-text-muted)]">Más crítico</p>
                  <p className="mt-2 text-3xl font-semibold text-[var(--cf-text)]">
                    {oldestOverdue?.days_overdue ? `${oldestOverdue.days_overdue} días` : 'Sin datos'}
                  </p>
                  <p className="mt-1 text-xs text-[var(--cf-text-muted)]">Mayor atraso acumulado</p>
                </div>
                <div className="rounded-[8px] border border-amber-500/20 bg-[var(--cf-warning-soft)] px-4 py-4">
                  <p className="text-[10px] uppercase tracking-[0.25em] text-[var(--cf-warning)]/80">Acción</p>
                  <p className="mt-2 text-3xl font-semibold text-[var(--cf-warning)]">Revisar y escalar</p>
                  <p className="mt-1 text-xs text-[var(--cf-warning)]/70">Prioridad inmediata</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex flex-wrap gap-2">
            <Link href="/dashboard/company/documentos/renovar">
              <Button variant="outline" size="sm" className="gap-2 border-yellow-500/30 text-yellow-300 hover:bg-yellow-500/10">
                Ir a renovar
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/dashboard/company/reportes">
              <Button variant="outline" size="sm" className="gap-2 border-[var(--cf-border)] text-[var(--cf-text-secondary)] hover:bg-[var(--cf-surface)]">
                Ver reportes
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/dashboard/company/documentos">
              <Button variant="outline" size="sm" className="gap-2 border-[var(--cf-border)] text-[var(--cf-text-secondary)] hover:bg-[var(--cf-surface)]">
                Volver a documentos
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>

          <DatePeriodFilter
            value={filters}
            onChange={update}
            onClear={() => update({ month: ALL_VALUE, year: ALL_VALUE })}
          />

          <Card className="bg-[var(--cf-surface)] border-[var(--cf-border)]">
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <div>
                <CardTitle className="text-[var(--cf-text)] flex items-center gap-2">
                  <CalendarDays className="h-5 w-5 text-[var(--cf-expiring)]" />
                  Historial filtrado
                </CardTitle>
                <CardDescription className="text-[var(--cf-text-muted)]">
                  Mostrando documentos vencidos para {filterLabel}
                </CardDescription>
              </div>
              <div className="text-right">
                <p className="text-xs uppercase tracking-wide text-[var(--cf-text-muted)]">Vencidos</p>
                <p className="text-2xl font-semibold text-[var(--cf-danger)]">{expiredDocuments.length}</p>
              </div>
            </CardHeader>
          </Card>

          {isLoading ? (
            <Card className="bg-[var(--cf-surface)] border-[var(--cf-border)] text-center py-12">
              <CardContent>
                <p className="text-[var(--cf-text-muted)]">Cargando documentos vencidos...</p>
              </CardContent>
            </Card>
          ) : error ? (
            <Card className="bg-[var(--cf-surface)] border-[var(--cf-border)] text-center py-12">
              <CardContent>
                <p className="text-[var(--cf-danger)]">{error}</p>
              </CardContent>
            </Card>
          ) : expiredDocuments.length === 0 ? (
            <Card className="bg-[var(--cf-surface)] border-[var(--cf-border)] text-center py-12">
              <CardContent>
                <div className="flex flex-col items-center gap-4">
                  <ShieldAlert className="h-12 w-12 text-[var(--cf-success)]" />
                  <div>
                    <h3 className="text-lg font-semibold text-[var(--cf-text)]">Sin documentos vencidos</h3>
                    <p className="text-[var(--cf-text-muted)] mt-2">
                      No hay vencimientos para el período seleccionado.
                    </p>
                  </div>
                  <div className="flex flex-wrap justify-center gap-2 pt-2">
                    <Link href="/dashboard/company/documentos/renovar">
                      <Button variant="outline" size="sm" className="gap-2 border-yellow-500/30 text-yellow-300 hover:bg-yellow-500/10">
                        Ir a renovar
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </Link>
                    <Link href="/dashboard/company/reportes">
                      <Button variant="outline" size="sm" className="gap-2 border-[var(--cf-border)] text-[var(--cf-text-secondary)] hover:bg-[var(--cf-surface)]">
                        Ver reportes
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              <Card className="bg-red-900/30 border-red-700/50">
                <CardContent className="pt-4 flex gap-3">
                  <AlertTriangle className="h-5 w-5 text-[var(--cf-danger)] flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[var(--cf-danger)] text-sm font-semibold">ACCIÓN CRÍTICA REQUERIDA</p>
                    <p className="text-[var(--cf-danger)]/70 text-xs mt-1">
                      {expiredDocuments.length} documento{expiredDocuments.length > 1 ? 's' : ''} vencido{expiredDocuments.length > 1 ? 's' : ''} para {filterLabel}.
                    </p>
                  </div>
                </CardContent>
              </Card>

              <ExpiredDocumentsList initialDocuments={expiredDocuments as any} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
