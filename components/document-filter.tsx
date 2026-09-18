'use client'

import { useState } from 'react'
import { Search, Filter, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { DatePeriodFilter } from '@/components/date-period-filter'
import { ALL_VALUE, type DateFilterValue } from '@/lib/date-filters'

interface DocumentFilterProps {
  onFilterChange: (filters: DocumentFilters) => void
  executives?: Array<{ id: string; nombre: string }>
  companies?: Array<{ id: string; nombre: string; rut: string }>
  documentTypes?: Array<{ value: string; label: string }>
  compact?: boolean
  hideExecutive?: boolean
}

export interface DocumentFilters {
  searchQuery: string
  executiveId?: string
  companyId?: string
  documentType?: string
  month: string
  year: string
}

export function DocumentFilter({
  onFilterChange,
  executives = [],
  companies = [],
  documentTypes = [],
  compact = false,
  hideExecutive = false,
}: DocumentFilterProps) {
  const [filters, setFilters] = useState<DocumentFilters>({
    searchQuery: '',
    month: ALL_VALUE,
    year: ALL_VALUE,
  })

  const handleFilterChange = (newFilters: Partial<DocumentFilters>) => {
    const updated = { ...filters, ...newFilters }
    setFilters(updated)
    onFilterChange(updated)
  }

  const handleReset = () => {
    const resetFilters: DocumentFilters = {
      searchQuery: '',
      month: ALL_VALUE,
      year: ALL_VALUE,
    }
    setFilters(resetFilters)
    onFilterChange(resetFilters)
  }

  const temporalFilters: DateFilterValue = {
    month: filters.month,
    year: filters.year,
  }

  const hasActiveFilters =
    filters.searchQuery ||
    (!hideExecutive && filters.executiveId) ||
    filters.companyId ||
    filters.documentType ||
    filters.month !== ALL_VALUE ||
    filters.year !== ALL_VALUE

  return (
    <div className={compact
      ? "border-y border-[var(--cf-border)] bg-[var(--cf-canvas)] px-3 py-3"
      : "mb-6 rounded-[6px] border border-[var(--cf-border)] bg-[var(--cf-surface)] p-4"
    }>
      {!compact && (
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-[var(--cf-text-muted)]" />
            <h3 className="text-sm font-medium text-[var(--cf-text)]">Filtrar documentos</h3>
          </div>
          {hasActiveFilters && (
            <button
              onClick={handleReset}
              className="flex items-center gap-1 text-xs text-[var(--cf-text-muted)] hover:text-[var(--cf-text)]"
            >
              <X className="h-3 w-3" />
              Limpiar
            </button>
          )}
        </div>
      )}

      <div className={compact
        ? "grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-[minmax(220px,1.3fr)_minmax(180px,1fr)_minmax(180px,1fr)_auto]"
        : "grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4"
      }>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--cf-text-muted)]" />
          <Input
            placeholder="Buscar empresa, RUT, conductor o archivo"
            value={filters.searchQuery}
            onChange={(e) => handleFilterChange({ searchQuery: e.target.value })}
            className="h-10 border-[var(--cf-border)] bg-[var(--cf-surface)] pl-9 text-[var(--cf-text)] placeholder:text-[var(--cf-text-muted)]"
          />
        </div>

        {companies.length > 0 && (
          <Select
            value={filters.companyId || 'all'}
            onValueChange={(value) => handleFilterChange({ companyId: value === 'all' ? undefined : value })}
          >
            <SelectTrigger className="h-10 border-[var(--cf-border)] bg-[var(--cf-surface)] text-[var(--cf-text)]">
              <SelectValue placeholder="Empresa" />
            </SelectTrigger>
            <SelectContent className="border-[var(--cf-border)] bg-[var(--cf-surface)]">
              <SelectItem value="all">Todas las empresas</SelectItem>
              {companies.map((company) => (
                <SelectItem key={company.id} value={company.id}>
                  {company.nombre} ({company.rut})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {!hideExecutive && executives.length > 0 && (
          <Select
            value={filters.executiveId || 'all'}
            onValueChange={(value) => handleFilterChange({ executiveId: value === 'all' ? undefined : value })}
          >
            <SelectTrigger className="h-10 border-[var(--cf-border)] bg-[var(--cf-surface)] text-[var(--cf-text)]">
              <SelectValue placeholder="Ejecutiva" />
            </SelectTrigger>
            <SelectContent className="border-[var(--cf-border)] bg-[var(--cf-surface)]">
              <SelectItem value="all">Todas las ejecutivas</SelectItem>
              {executives.map((exec) => (
                <SelectItem key={exec.id} value={exec.id}>
                  {exec.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <Select
          value={filters.documentType || 'all'}
          onValueChange={(value) => handleFilterChange({ documentType: value === 'all' ? undefined : value })}
        >
          <SelectTrigger className="h-10 border-[var(--cf-border)] bg-[var(--cf-surface)] text-[var(--cf-text)]">
            <SelectValue placeholder="Tipo de documento" />
          </SelectTrigger>
          <SelectContent className="border-[var(--cf-border)] bg-[var(--cf-surface)]">
            <SelectItem value="all">Todos los tipos</SelectItem>
            {documentTypes.map((docType) => (
              <SelectItem key={docType.value} value={docType.value}>
                {docType.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {compact ? (
          <div className="flex items-center gap-2">
            <DatePeriodFilter
              value={temporalFilters}
              onChange={(value) => handleFilterChange(value)}
              onClear={() => handleFilterChange({ month: ALL_VALUE, year: ALL_VALUE })}
            />
            {hasActiveFilters && (
              <Button
                type="button"
                onClick={handleReset}
                variant="ghost"
                size="sm"
                className="h-10 flex-none px-3 text-[var(--cf-text-muted)] hover:text-[var(--cf-text)]"
                aria-label="Limpiar filtros"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        ) : (
          <div className="md:col-span-2 lg:col-span-4">
            <DatePeriodFilter
              value={temporalFilters}
              onChange={(value) => handleFilterChange(value)}
              onClear={() => handleFilterChange({ month: ALL_VALUE, year: ALL_VALUE })}
            />
          </div>
        )}
      </div>
    </div>
  )

