'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export function ExecutiveCoverageControl({ reviewScope }: { reviewScope: any }) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  if (!reviewScope?.canCover) return null

  const scopeValue = reviewScope.mode === 'executive' && reviewScope.selectedExecutiveId
    ? `executive:${reviewScope.selectedExecutiveId}`
    : reviewScope.mode || 'mine'

  const selectedExecutive = reviewScope.availableExecutives?.find(
    (item: any) => item.id === reviewScope.selectedExecutiveId,
  )

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

  return (
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
              ? 'Viendo documentos de todas las ejecutivas. Las asignaciones no cambian.'
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
          {(reviewScope.availableExecutives || []).map((executive: any) => (
            <SelectItem key={executive.id} value={`executive:${executive.id}`}>
              {executive.nombre}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
