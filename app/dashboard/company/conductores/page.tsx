'use client'

import { useState, useEffect, useMemo } from 'react'
import { useSearchParams, usePathname, useRouter } from 'next/navigation'
import useSWR from 'swr'
import { DriversList } from '@/components/drivers-list'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { AddConductorModal } from '@/components/add-conductor-modal'
import { DatePeriodFilter } from '@/components/date-period-filter'
import { ALL_VALUE, filterByMonthYear, getMonthLabel, type DateFilterValue } from '@/lib/date-filters'

const fetcher = (url: string) =>
  fetch(url, {
    headers: {
      'Cache-Control': 'no-cache',
    },
  })
    .then(async (response) => {
      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`API error ${response.status}: ${errorText}`)
      }
      const text = await response.text()
      if (!text) throw new Error('Empty response from API')
      try {
        return JSON.parse(text)
      } catch {
        throw new Error(`Invalid JSON response: ${text.substring(0, 100)}`)
      }
    })
    .catch((error) => {
      console.error('[v0] Fetch error:', error)
      throw error
    })

export default function ConductoresPage() {
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const router = useRouter()
  const rutParam = searchParams.get('rut')
  const [selectedEjecutiva, setSelectedEjecutiva] = useState<string | null>(null)
  const [highlightedRut] = useState<string | null>(rutParam)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [dateFilters, setDateFilters] = useState<DateFilterValue>({
    month: searchParams.get('month') || ALL_VALUE,
    year: searchParams.get('year') || ALL_VALUE,
  })

  const { data, error, isLoading, mutate } = useSWR('/api/dashboard/data', fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: true,
    dedupingInterval: 30_000,
    focusThrottleInterval: 30_000,
    refreshInterval: 0,
    keepPreviousData: true,
  })

  const drivers = data?.dashboard?.conductores || []

  useEffect(() => {
    setDateFilters({
      month: searchParams.get('month') || ALL_VALUE,
      year: searchParams.get('year') || ALL_VALUE,
    })
  }, [searchParams])

  const updateDateFilters = (next: DateFilterValue) => {
    setDateFilters(next)
    const params = new URLSearchParams(searchParams.toString())
    if (next.month === ALL_VALUE) params.delete('month')
    else params.set('month', next.month)
    if (next.year === ALL_VALUE) params.delete('year')
    else params.set('year', next.year)
    const query = params.toString()
    router.replace(query ? `${pathname}?${query}` : pathname)
  }

  const ejecutivas = useMemo(
    () => Array.from(new Set(drivers.map((driver: any) => driver.ejecutivo_nombre).filter(Boolean))).sort() as string[],
    [drivers],
  )

  const driversByDate = useMemo(() => {
    return filterByMonthYear(
      drivers,
      (driver: any) => driver.updated_at || driver.created_at,
      dateFilters.month,
      dateFilters.year,
    )
  }, [drivers, dateFilters.month, dateFilters.year])

  const ejecutivaCounts = useMemo(() => {
    const counts = new Map<string, number>()
    driversByDate.forEach((driver: any) => {
      if (!driver.ejecutivo_nombre) return
      counts.set(driver.ejecutivo_nombre, (counts.get(driver.ejecutivo_nombre) || 0) + 1)
    })
    return counts
  }, [driversByDate])

  const filteredDrivers = useMemo(
    () => selectedEjecutiva
      ? driversByDate.filter((driver: any) => driver.ejecutivo_nombre === selectedEjecutiva)
      : driversByDate,
    [driversByDate, selectedEjecutiva],
  )

  const periodLabel = getMonthLabel(dateFilters.month, dateFilters.year)
  const activeDrivers = useMemo(
    () => filteredDrivers.filter((driver: any) => driver.is_active !== false).length,
    [filteredDrivers],
  )
  const inactiveDrivers = filteredDrivers.length - activeDrivers

  return (
    <div className="space-y-7">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          <p className="mb-2 text-xs font-medium uppercase tracking-[0.14em] text-[var(--cf-text-muted)]">
            Gestión operacional
          </p>
          <h1 className="text-2xl font-semibold tracking-[-0.03em] text-[var(--cf-text)] md:text-[28px]">
            Conductores
          </h1>
          <p className="mt-2 text-sm leading-6 text-[var(--cf-text-secondary)]">
            Revisa conductores activos, asignaciones y documentación dentro del mismo flujo operacional de Transportes Labbé.
          </p>
        </div>

        <Button
          onClick={() => setIsAddModalOpen(true)}
          className="min-h-11 gap-2 bg-[var(--cf-accent)] px-4 text-sm text-[var(--cf-text)] hover:bg-[var(--cf-accent-hover)] sm:min-h-10"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Agregar conductor
        </Button>
      </div>

      <section className="space-y-3" aria-labelledby="driver-summary-title">
        <SectionHeading
          eyebrow="Lectura rápida"
          title="Resumen del período"
          description="Volumen y estado general antes de revisar conductores individuales."
          id="driver-summary-title"
        />
        <div className="overflow-hidden rounded-[6px] border border-[var(--cf-border)] bg-[var(--cf-surface)]">
          <div className="grid grid-cols-2 lg:grid-cols-4">
            <Metric label="Período" value={periodLabel} description="Filtro activo" />
            <Metric label="Conductores" value={filteredDrivers.length.toLocaleString('es-CL')} description="En la vista actual" divided />
            <Metric label="Activos" value={activeDrivers.toLocaleString('es-CL')} description="Disponibles en el filtro" tone="success" divided />
            <Metric label="Inactivos" value={inactiveDrivers.toLocaleString('es-CL')} description="Requieren revisión de estado" tone="warning" divided />
          </div>
        </div>
      </section>

      <section className="space-y-3" aria-labelledby="driver-filters-title">
        <SectionHeading
          eyebrow="Vista"
          title="Filtros"
          description="Ajusta período y ejecutiva sin cambiar las acciones ni el flujo actual."
          id="driver-filters-title"
        />

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <DatePeriodFilter
            value={dateFilters}
            onChange={updateDateFilters}
            onClear={() => updateDateFilters({ month: ALL_VALUE, year: ALL_VALUE })}
          />

          <div className="text-sm text-[var(--cf-text-muted)] lg:text-right">
            Ejecutiva: <span className="font-medium text-[var(--cf-text-secondary)]">{selectedEjecutiva || 'Todas'}</span>
          </div>
        </div>

        {ejecutivas.length > 0 && (
          <div className="space-y-3 border-t border-[var(--cf-border)] pt-4">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-[var(--cf-text-muted)]">Filtrar por ejecutiva</p>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar conductores por ejecutiva">
              <button
                type="button"
                aria-pressed={selectedEjecutiva === null}
                className={`min-h-11 rounded-[5px] border border-[var(--cf-border)] px-3 py-2 text-xs font-medium transition-colors sm:min-h-9 ${
                  selectedEjecutiva === null
                    ? 'bg-[var(--cf-accent)] text-[var(--cf-text)]'
                    : 'bg-transparent text-[var(--cf-text-secondary)] hover:bg-[var(--cf-surface-raised)] hover:text-[var(--cf-text)]'
                }`}
                onClick={() => setSelectedEjecutiva(null)}
              >
                Todos ({driversByDate.length})
              </button>
              {ejecutivas.map((ejecutiva) => {
                const count = ejecutivaCounts.get(ejecutiva) || 0
                const selected = selectedEjecutiva === ejecutiva
                return (
                  <button
                    key={ejecutiva}
                    type="button"
                    aria-pressed={selected}
                    className={`min-h-11 rounded-[5px] border border-[var(--cf-border)] px-3 py-2 text-xs font-medium transition-colors sm:min-h-9 ${
                      selected
                        ? 'bg-[var(--cf-accent)] text-[var(--cf-text)]'
                        : 'bg-transparent text-[var(--cf-text-secondary)] hover:bg-[var(--cf-surface-raised)] hover:text-[var(--cf-text)]'
                    }`}
                    onClick={() => setSelectedEjecutiva(ejecutiva)}
                  >
                    {ejecutiva} ({count})
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </section>

      <section className="space-y-3" aria-labelledby="driver-directory-title">
        <div className="flex flex-col gap-2 border-b border-[var(--cf-border)] pb-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-[var(--cf-text-muted)]">Directorio operacional</p>
            <h2 id="driver-directory-title" className="mt-1 text-base font-semibold text-[var(--cf-text)]">
              {filteredDrivers.length.toLocaleString('es-CL')} conductores
            </h2>
          </div>
          <p className="text-xs text-[var(--cf-text-muted)]">
            {selectedEjecutiva ? `Vista filtrada por ${selectedEjecutiva}.` : 'Vista consolidada de todas las ejecutivas.'}
          </p>
        </div>

        {isLoading ? (
          <StatePanel>Cargando conductores…</StatePanel>
        ) : error ? (
          <div className="rounded-[6px] border border-[var(--cf-danger)] bg-[var(--cf-surface)] px-5 py-6 text-sm text-[var(--cf-text-secondary)]">
            <p className="font-medium text-[var(--cf-danger)]">No fue posible cargar los conductores.</p>
            <p className="mt-2 text-xs text-[var(--cf-text-muted)]">{error?.message || 'Error desconocido'}</p>
            <Button
              variant="outline"
              onClick={() => mutate()}
              className="mt-4 min-h-11 border-[var(--cf-border)] bg-transparent text-xs text-[var(--cf-text-secondary)] hover:bg-[var(--cf-surface-raised)] sm:min-h-9"
            >
              Reintentar
            </Button>
          </div>
        ) : filteredDrivers.length === 0 ? (
          <StatePanel>
            {selectedEjecutiva ? `No hay conductores para ${selectedEjecutiva}.` : 'No hay conductores disponibles para este filtro.'}
          </StatePanel>
        ) : (
          <DriversList drivers={filteredDrivers} highlightedRut={highlightedRut} />
        )}
      </section>

      <AddConductorModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={() => mutate()}
        currentEjecutiva={selectedEjecutiva || undefined}
      />
    </div>
  )
}

function SectionHeading({ eyebrow, title, description, id }: { eyebrow: string; title: string; description: string; id: string }) {
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-[var(--cf-text-muted)]">{eyebrow}</p>
        <h2 id={id} className="mt-1 text-base font-semibold text-[var(--cf-text)]">{title}</h2>
      </div>
      <p className="max-w-xl text-xs leading-5 text-[var(--cf-text-muted)] sm:text-right">{description}</p>
    </div>
  )
}

function Metric({
  label,
  value,
  description,
  tone,
  divided,
}: {
  label: string
  value: string
  description: string
  tone?: 'success' | 'warning'
  divided?: boolean
}) {
  const indicator = tone === 'success' ? 'bg-[var(--cf-success)]' : tone === 'warning' ? 'bg-[var(--cf-warning)]' : 'bg-[var(--cf-text-muted)]'

  return (
    <div className={`min-w-0 p-4 ${divided ? 'border-l border-[var(--cf-border)]' : ''}`}>
      <div className="flex items-center gap-2">
        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${indicator}`} />
        <p className="truncate text-xs font-medium text-[var(--cf-text-muted)]">{label}</p>
      </div>
      <p className="mt-2 truncate text-xl font-semibold tracking-[-0.03em] text-[var(--cf-text)] sm:text-2xl">{value}</p>
      <p className="mt-1 text-xs text-[var(--cf-text-muted)]">{description}</p>
    </div>
  )
}

function StatePanel({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-[6px] border border-[var(--cf-border)] bg-[var(--cf-surface)] px-6 py-10 text-center text-sm text-[var(--cf-text-muted)]">
      {children}
    </div>
  )
}
