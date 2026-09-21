export type ExecutiveScopeMode = 'mine' | 'all' | 'executive'

export function getExecutiveScope(request: Request): { mode: ExecutiveScopeMode; executiveId: string | null } {
  const url = new URL(request.url)
  const rawMode = url.searchParams.get('scope')
  const executiveId = url.searchParams.get('executive_id')

  if (rawMode === 'all') return { mode: 'all', executiveId: null }
  if (rawMode === 'executive' && executiveId) return { mode: 'executive', executiveId }
  return { mode: 'mine', executiveId: null }
}
