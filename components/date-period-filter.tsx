'use client'

import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { getMonthOptions, getYearOptions, ALL_VALUE, type DateFilterValue } from '@/lib/date-filters'
import { Filter } from 'lucide-react'

interface DatePeriodFilterProps {
  value: DateFilterValue
  onChange: (value: DateFilterValue) => void
  onClear?: () => void
  className?: string
  compact?: boolean
}

export function DatePeriodFilter({
  value,
  onChange,
  onClear,
  className,
  compact = false,
}: DatePeriodFilterProps) {
  const hasFilters = value.month !== ALL_VALUE || value.year !== ALL_VALUE

  const monthSelect = (
    <Select value={value.month} onValueChange={(month) => onChange({ ...value, month })}>
      <SelectTrigger
        id={compact ? undefined : 'date-filter-month'}
        aria-label="Filtrar por mes"
        className="h-11 border-[var(--cf-border)] bg-[var(--cf-surface)] text-[var(--cf-text)] sm:h-10"
      >
        <SelectValue placeholder="Todos los meses" />
      </SelectTrigger>
      <SelectContent className="border-[var(--cf-border)] bg-[var(--cf-surface)]">
        {getMonthOptions().map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )

  const yearSelect = (
    <Select value={value.year} onValueChange={(year) => onChange({ ...value, year })}>
      <SelectTrigger
        id={compact ? undefined : 'date-filter-year'}
        aria-label="Filtrar por año"
        className="h-11 border-[var(--cf-border)] bg-[var(--cf-surface)] text-[var(--cf-text)] sm:h-10"
      >
        <SelectValue placeholder="Todos los años" />
      </SelectTrigger>
      <SelectContent className="border-[var(--cf-border)] bg-[var(--cf-surface)]">
        {getYearOptions().map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )

  if (compact) {
    return (
      <div className={`grid min-w-0 flex-1 grid-cols-2 gap-2 ${className || ''}`}>
        {monthSelect}
        {yearSelect}
      </div>
    )
  }

  return (
    <div className={`flex flex-col gap-4 rounded-[5px] border border-[var(--cf-border)] bg-[var(--cf-bg)] p-4 ${className || ''}`}>
      <div className="flex items-center gap-2">
        <Filter className="h-4 w-4 text-[var(--cf-text-muted)]" aria-hidden="true" />
        <span className="text-sm font-medium text-[var(--cf-text)]">Período documental</span>
      </div>

      <div className="grid gap-3 md:grid-cols-[1fr_220px_auto]">
        <div>
          <label
            htmlFor="date-filter-month"
            className="mb-2 block text-xs font-medium uppercase tracking-[0.12em] text-[var(--cf-text-muted)]"
          >
            Mes
          </label>
          {monthSelect}
        </div>

        <div>
          <label
            htmlFor="date-filter-year"
            className="mb-2 block text-xs font-medium uppercase tracking-[0.12em] text-[var(--cf-text-muted)]"
          >
            Año
          </label>
          {yearSelect}
        </div>

        <div className="flex items-end">
          <Button
            type="button"
            variant="outline"
            className="min-h-11 w-full border-[var(--cf-border)] text-[var(--cf-text-secondary)] hover:bg-[var(--cf-surface-2)] hover:text-[var(--cf-text)] sm:min-h-10"
            onClick={() => {
              const reset = { month: ALL_VALUE, year: ALL_VALUE }
              if (onClear) {
                onClear()
              } else {
                onChange(reset)
              }
            }}
            disabled={!hasFilters}
          >
            Limpiar período
          </Button>
        </div>
      </div>
    </div>
  )
}
