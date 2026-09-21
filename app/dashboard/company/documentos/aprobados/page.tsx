'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Loader2, RefreshCw } from 'lucide-react'
import Link from 'next/link'
import { ApprovedDocumentsList } from '@/components/approved-documents-list'
import { DatePeriodFilter } from '@/components/date-period-filter'
import { ALL_VALUE, filterByMonthYear, getMonthLabel, type DateFilterValue } from '@/lib/date-filters'
import { getDocumentPeriodDate } from '@/lib/document-period'
import { ExecutiveCoverageControl } from '@/components/executive-coverage-control'

function matchesSearch(doc: any, rawQuery: string) {
  const query = rawQuery.trim().toLowerCase()
  if (!query) return true

  const searchable = [
    doc.original_filename,
    doc.document_name,
    doc.empresa_nombre,
    doc.transportistas?.razon_social,
    doc.transportistas?.rut,
    doc.subcontractor_rut,
    doc.conductores?.nombres,
    doc.conductores?.apellido_paterno,
    doc.conductores?.rut,
    doc.docType?.nombre,
    doc.docType?.code,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  return searchable.includes(query)
}

export default function AprobadosPage() {
  const searchParams = useSearchParams()
  const globalSearch = searchParams.get('search')?.trim() || ''
  const requestQuery = searchParams.toString()
  const requestUrl = `/api/company/documents/aprobados${requestQuery ? `?${requestQuery}` : ''}`
  const [allData, setAllData] = useState<any>(null)
  const [period, setPeriod] = useState<DateFilterValue>({
    month: ALL_VALUE,
    year: ALL_VALUE,
  })
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch(requestUrl, {
          cache: 'no-store',
        })
        const data = await response.json()
        setAllData(data)
      } catch (error) {
        console.error('[v0] Error fetching approved documents:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [requestUrl])

  const filteredData = useMemo(() => {
    if (!allData) return null

    const conductorDocs = filterByMonthYear<any>(
      allData.conductorDocs || [],
      (doc) => getDocumentPeriodDate(doc),
      period.month,
      period.year
    ).filter((doc) => matchesSearch(doc, globalSearch))

    const subDocs = filterByMonthYear<any>(
      allData.subDocs || [],
      (doc) => getDocumentPeriodDate(doc),
      period.month,
      period.year
    ).filter((doc) => matchesSearch(doc, globalSearch))

    return { conductorDocs, subDocs }
  }, [allData, period.month, period.year, globalSearch])

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      const response = await fetch(requestUrl, {
        cache: 'no-store',
      })
      const data = await response.json()
      setAllData(data)
    } catch (error) {
      console.error('[v0] Error refreshing documents:', error)
    } finally {
      setRefreshing(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-8 w-8 animate-spin text-[var(--cf-accent)]" />
          <p className="text-[var(--cf-text-muted)]">Cargando documentos...</p>
        </div>
      </div>
    )
  }

  const totalApproved = (allData?.conductorDocs?.length || 0) + (allData?.subDocs?.length || 0)
  const filteredCount = (filteredData?.conductorDocs?.length || 0) + (filteredData?.subDocs?.length || 0)
  const periodLabel = getMonthLabel(period.month, period.year)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/company/documentos">
            <Button variant="ghost" size="sm" className="text-[var(--cf-text-muted)] hover:text-[var(--cf-text)]">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Volver
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-semibold text-[var(--cf-text)]">Documentos Aprobados</h1>
            <p className="text-sm text-[var(--cf-text-muted)]">
              {globalSearch
                ? `${filteredCount} resultados para “${globalSearch}”`
                : `${filteredCount} de ${totalApproved} documentos`}
            </p>
          </div>
        </div>

        <Button
          onClick={handleRefresh}
          disabled={refreshing}
          className="bg-[var(--cf-accent)] text-[var(--cf-text)] hover:bg-[var(--cf-accent-hover)]"
          size="sm"
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          Actualizar
        </Button>
      </div>

      <ExecutiveCoverageControl reviewScope={allData?.reviewScope} />

      {globalSearch && (
        <div className="rounded-[6px] border border-[var(--cf-border)] bg-[var(--cf-surface)] px-4 py-3 text-sm text-[var(--cf-text-secondary)]">
          Búsqueda activa por documento, empresa, RUT, conductor o tipo documental.
        </div>
      )}

      <div className="space-y-3 rounded-[6px] border border-[var(--cf-border)] bg-[var(--cf-surface)] p-4">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-[var(--cf-accent)]" />
          <span className="text-sm font-semibold text-[var(--cf-text)]">Período histórico</span>
        </div>
        <DatePeriodFilter
          value={period}
          onChange={setPeriod}
          onClear={() => setPeriod({ month: ALL_VALUE, year: ALL_VALUE })}
        />
        <p className="text-sm text-[var(--cf-text-secondary)]">
          Mostrando {periodLabel.toLowerCase()} para revisión de ejecutivas.
        </p>
      </div>

      <ApprovedDocumentsList
        key={`approved-${period.month}-${period.year}-${globalSearch}-${filteredData?.subDocs?.length || 0}`}
        conductorDocs={filteredData?.conductorDocs || []}
        subDocs={filteredData?.subDocs || []}
      />
    </div>
  )
}
