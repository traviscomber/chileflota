'use client'

import { useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { AlertCircle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PendingDocumentsList } from '@/components/pending-documents-list'

function normalizeText(value: unknown) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeRut(value: unknown) {
  return normalizeText(value).replace(/[^0-9k]/g, '')
}

function matchesSearch(doc: any, rawQuery: string) {
  if (!rawQuery) return true

  const query = normalizeText(rawQuery)
  const queryRut = normalizeRut(rawQuery)
  const transportista = Array.isArray(doc?.transportistas) ? doc.transportistas[0] : doc?.transportistas
  const conductor = Array.isArray(doc?.conductores) ? doc.conductores[0] : doc?.conductores

  const text = normalizeText([
    doc?.original_filename,
    doc?.file_name,
    doc?.empresa_nombre,
    doc?.subcontractor_rut,
    transportista?.razon_social,
    transportista?.nombre_fantasia,
    transportista?.rut,
    conductor?.nombres,
    conductor?.apellido_paterno,
    conductor?.rut,
    doc?.docType?.nombre,
    doc?.docType?.code,
  ].filter(Boolean).join(' '))

  if (query && text.includes(query)) return true
  if (!queryRut) return false

  return [doc?.subcontractor_rut, transportista?.rut, conductor?.rut]
    .map(normalizeRut)
    .filter(Boolean)
    .some((rut) => rut.includes(queryRut))
}

export default function PendientesPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const [allData, setAllData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const search = searchParams.get('search')?.trim() || ''

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      setError(null)
      try {
        const focusMode = searchParams.get('focus_mode')
        const focusId = searchParams.get('focus_id')
        const query = new URLSearchParams()
        if (focusMode) query.set('focus_mode', focusMode)
        if (focusId) query.set('focus_id', focusId)
        const scope = searchParams.get('scope')
        const executiveId = searchParams.get('executive_id')
        if (scope) query.set('scope', scope)
        if (executiveId) query.set('executive_id', executiveId)

        const response = await fetch(`/api/dashboard/pending-documents${query.size ? `?${query.toString()}` : ''}`, {
          cache: 'no-store',
        })
        if (!response.ok) throw new Error(`Pending documents ${response.status}`)
        const data = await response.json()
        setAllData(data)
      } catch (error) {
        console.error('[v0] Error fetching pending documents:', error)
        setError('No pudimos cargar la bandeja. Tus documentos no fueron modificados.')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [searchParams, reloadKey])

  const filteredData = useMemo(() => {
    const conductorDocs = allData?.conductorDocs || []
    const subDocs = allData?.subDocs || []
    if (!search) return { conductorDocs, subDocs }

    return {
      conductorDocs: conductorDocs.filter((doc: any) => matchesSearch(doc, search)),
      subDocs: subDocs.filter((doc: any) => matchesSearch(doc, search)),
    }
  }, [allData, search])

  if (loading) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Cargando bandeja de documentos">
        <div className="border-b border-[var(--cf-border)] pb-4">
          <div className="h-3 w-32 animate-pulse rounded bg-[var(--cf-surface-2)]" />
          <div className="mt-3 h-7 w-64 animate-pulse rounded bg-[var(--cf-surface-2)]" />
          <div className="mt-3 h-4 w-48 animate-pulse rounded bg-[var(--cf-surface-2)]" />
        </div>
        <div className="h-12 animate-pulse rounded-[6px] border border-[var(--cf-border)] bg-[var(--cf-surface)]" />
        <div className="grid min-h-[66vh] overflow-hidden rounded-[6px] border border-[var(--cf-border)] bg-[var(--cf-surface)] lg:grid-cols-[360px_minmax(0,1fr)]">
          <div className="border-b border-[var(--cf-border)] p-4 lg:border-b-0 lg:border-r">
            <div className="space-y-3">
              {[0, 1, 2, 3, 4, 5].map((item) => (
                <div key={item} className="space-y-2 border-b border-[var(--cf-border)] pb-3">
                  <div className="h-4 w-3/4 animate-pulse rounded bg-[var(--cf-surface-2)]" />
                  <div className="h-3 w-1/2 animate-pulse rounded bg-[var(--cf-surface-2)]" />
                </div>
              ))}
            </div>
          </div>
          <div className="min-h-[520px] animate-pulse bg-[var(--cf-bg)]" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex min-h-[65vh] items-center justify-center px-4">
        <div className="max-w-md text-center">
          <AlertCircle className="mx-auto h-6 w-6 text-[var(--cf-warning)]" />
          <h1 className="mt-4 text-lg font-semibold text-[var(--cf-text)]">No se pudo abrir la bandeja</h1>
          <p className="mt-2 text-sm leading-6 text-[var(--cf-text-secondary)]">{error}</p>
          <Button
            type="button"
            variant="outline"
            className="mt-5 gap-2"
            onClick={() => setReloadKey((value) => value + 1)}
          >
            <RefreshCw className="h-4 w-4" />
            Reintentar
          </Button>
        </div>
      </div>
    )
  }

  const reviewScope = allData?.reviewScope
  const scopeValue = reviewScope?.mode === 'executive' && reviewScope?.selectedExecutiveId
    ? `executive:${reviewScope.selectedExecutiveId}`
    : reviewScope?.mode || 'mine'

  const changeScope = (value: string) => {
    const params = new URLSearchParams(searchParams.toString())

    if (value === 'mine') {
      params.delete('scope')
      params.delete('executive_id')
    } else if (value === 'all') {
      params.set('scope', 'all')
      params.delete('executive_id')
    } else if (value.startsWith('executive:')) {
      params.set('scope', 'executive')
      params.set('executive_id', value.slice('executive:'.length))
    }

    const query = params.toString()
    router.replace(query ? `${pathname}?${query}` : pathname)
  }

  const selectedExecutive = reviewScope?.availableExecutives?.find(
    (item: any) => item.id === reviewScope?.selectedExecutiveId,
  )

  return (
    <div className="space-y-3">
      {reviewScope?.canCover && (
        <div className="flex flex-col gap-2 rounded-[6px] border border-[var(--cf-border)] bg-[var(--cf-surface)] px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-[var(--cf-text)]">Cartera visible</span>
              {reviewScope.mode !== 'mine' && (
                <Badge variant="outline" className="text-[10px] uppercase tracking-[0.12em]">
                  Cobertura
                </Badge>
              )}
            </div>
            <p className="mt-1 text-xs text-[var(--cf-text-muted)]">
              {reviewScope.mode === 'mine'
                ? 'Tu cartera es el filtro predeterminado.'
                : reviewScope.mode === 'all'
                  ? 'Viendo pendientes de todas las ejecutivas. Las asignaciones no cambian.'
                  : `Cubriendo la cartera de ${selectedExecutive?.nombre || 'otra ejecutiva'}. Las asignaciones no cambian.`}
            </p>
          </div>

          <Select value={scopeValue} onValueChange={changeScope}>
            <SelectTrigger className="h-9 w-full border-[var(--cf-border)] bg-[var(--cf-bg)] sm:w-[280px]">
              <SelectValue placeholder="Seleccionar cartera" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="mine">Mi cartera</SelectItem>
              <SelectItem value="all">Todas las ejecutivas</SelectItem>
              {(reviewScope.availableExecutives || []).map((exec: any) => (
                <SelectItem key={exec.id} value={`executive:${exec.id}`}>
                  {exec.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <PendingDocumentsList
        conductorDocs={filteredData.conductorDocs}
        subDocs={filteredData.subDocs}
      />
    </div>
  )
}
