'use client'

import { useEffect, useRef, useState } from 'react'
import { Search, LogOut, User, ChevronDown, Settings, Menu, FileText, Building2, Sparkles, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useUserProfile } from '@/hooks/use-user-profile'

interface CompanyHeaderProps {
  onMenuClick?: () => void
}

type SearchSuggestion = {
  id: string
  type: 'company' | 'driver' | 'document'
  label: string
  secondary: string | null
  value: string
  href: string
}

type IntelligenceAnswer = {
  status: string
  summary: string
  facts?: Record<string, unknown>
  interpretation?: string
  unknowns?: string[]
  nextActions?: Array<{ label: string; href: string }>
}

type IntelligenceResponse = {
  mode?: 'fast_path' | 'operational_agent'
  intent?: string
  answer?: IntelligenceAnswer
  evidence?: unknown[]
  candidates?: Array<{ id: string; rut: string | null; razon_social: string | null; nombre_fantasia: string | null }>
}

const OPERATIONAL_PREFIXES = [
  'que ', 'qué ', 'cual ', 'cuál ', 'como ', 'cómo ', 'por que ', 'por qué ', 'quien ', 'quién ', 'dime ', 'muestrame ', 'muéstrame ',
]

const OPERATIONAL_TERMS = [
  'cumplimiento', 'compliance', 'riesgo', 'puede operar', 'puede trabajar', 'documentos de ', 'documentos del ', 'documentos para ',
  'pendientes de ', 'rechazados de ', 'aprobados de ',
]

function isOperationalQuestion(raw: string) {
  const query = raw.trim().toLowerCase()
  if (query.length < 2) return false
  return OPERATIONAL_PREFIXES.some((prefix) => query.startsWith(prefix)) || OPERATIONAL_TERMS.some((term) => query.includes(term))
}

function normalizeSearchValue(value: string | null | undefined) {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

function normalizeRut(value: string | null | undefined) {
  return (value || '').toLowerCase().replace(/[^0-9k]/g, '')
}

function findExactEntitySuggestion(query: string, items: SearchSuggestion[]) {
  const normalizedQuery = normalizeSearchValue(query)
  const normalizedQueryRut = normalizeRut(query)

  return items.find((suggestion) => {
    if (suggestion.type === 'document') return false

    if (normalizedQueryRut.length >= 7 && normalizeRut(suggestion.secondary) === normalizedQueryRut) {
      return true
    }

    return (
      normalizeSearchValue(suggestion.label) === normalizedQuery ||
      normalizeSearchValue(suggestion.value) === normalizedQuery
    )
  })
}

function formatFacts(facts?: Record<string, unknown>) {
  if (!facts) return []
  return Object.entries(facts)
    .filter(([, value]) => typeof value === 'number' || typeof value === 'string')
    .slice(0, 4)
    .map(([key, value]) => ({ key, value: String(value) }))
}

function getDocumentSearchContext(pathname: string) {
  if (pathname.startsWith('/dashboard/company/documentos/pendientes')) return 'pending'
  if (pathname.startsWith('/dashboard/company/documentos/rechazados')) return 'rejected'
  if (pathname.startsWith('/dashboard/company/documentos/aprobados')) return 'approved'
  return 'approved'
}

function getDocumentSearchPath(pathname: string) {
  const context = getDocumentSearchContext(pathname)
  if (context === 'pending') return '/dashboard/company/documentos/pendientes'
  if (context === 'rejected') return '/dashboard/company/documentos/rechazados'
  return '/dashboard/company/documentos/aprobados'
}

export function CompanyHeader({ onMenuClick }: CompanyHeaderProps) {
  const router = useRouter()
  const pathname = usePathname()
  const { profile } = useUserProfile()
  const searchRef = useRef<HTMLDivElement>(null)
  const [userEmail, setUserEmail] = useState<string>('')
  const [searchValue, setSearchValue] = useState('')
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([])
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchLoading, setSearchLoading] = useState(false)
  const [activeSuggestion, setActiveSuggestion] = useState(-1)
  const [intelligenceLoading, setIntelligenceLoading] = useState(false)
  const [intelligenceResult, setIntelligenceResult] = useState<IntelligenceResponse | null>(null)
  const [profileOpen, setProfileOpen] = useState(false)
  const searchContext = getDocumentSearchContext(pathname)
  const documentSearchPath = getDocumentSearchPath(pathname)

  useEffect(() => {
    const email = document.cookie
      .split('; ')
      .find(row => row.startsWith('user_email='))
      ?.split('=')[1]

    if (email) {
      setUserEmail(decodeURIComponent(email))
    }
  }, [])

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setSearchOpen(false)
        setActiveSuggestion(-1)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [])

  useEffect(() => {
    const query = searchValue.trim()
    setIntelligenceResult(null)

    if (query.length < 2 || isOperationalQuestion(query)) {
      setSuggestions([])
      setSearchLoading(false)
      setActiveSuggestion(-1)
      if (query.length >= 2 && isOperationalQuestion(query)) setSearchOpen(true)
      return
    }

    const controller = new AbortController()
    const timeout = window.setTimeout(async () => {
      setSearchLoading(true)
      try {
        const params = new URLSearchParams({ q: query, context: searchContext })
        const response = await fetch(`/api/company/search-suggestions?${params.toString()}`, {
          signal: controller.signal,
          cache: 'no-store',
        })
        if (!response.ok) throw new Error(`Search suggestions ${response.status}`)
        const data = await response.json()
        setSuggestions(Array.isArray(data.suggestions) ? data.suggestions : [])
        setSearchOpen(true)
        setActiveSuggestion(-1)
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          console.error('Search suggestions error:', error)
          setSuggestions([])
        }
      } finally {
        if (!controller.signal.aborted) setSearchLoading(false)
      }
    }, 160)

    return () => {
      window.clearTimeout(timeout)
      controller.abort()
    }
  }, [searchValue, searchContext])

  const handleLogout = async () => {
    try {
      await fetch('/api/logout', { method: 'POST' })
      router.push('/login')
    } catch (error) {
      console.error('Logout error:', error)
    }
  }

  const navigateToSuggestion = (suggestion: SearchSuggestion) => {
    setSearchValue(suggestion.value)
    setSearchOpen(false)
    setActiveSuggestion(-1)
    setIntelligenceResult(null)

    if (suggestion.type === 'driver') {
      router.push(suggestion.href)
      return
    }

    router.push(`${documentSearchPath}?search=${encodeURIComponent(suggestion.value)}`)
  }

  const runIntelligenceQuery = async (query: string) => {
    setIntelligenceLoading(true)
    setSuggestions([])
    setActiveSuggestion(-1)
    setSearchOpen(true)
    try {
      const response = await fetch('/api/company/intelligence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
        cache: 'no-store',
      })
      if (!response.ok) throw new Error(`Intelligence Core ${response.status}`)
      const data = await response.json()
      setIntelligenceResult(data)
    } catch (error) {
      console.error('Intelligence Core search error:', error)
      setIntelligenceResult({
        answer: {
          status: 'error',
          summary: 'No se pudo resolver esta consulta operacional en este momento.',
          unknowns: ['La búsqueda exacta sigue disponible escribiendo RUT, empresa, conductor o documento.'],
          nextActions: [],
        },
      })
    } finally {
      setIntelligenceLoading(false)
    }
  }

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (activeSuggestion >= 0 && suggestions[activeSuggestion]) {
      navigateToSuggestion(suggestions[activeSuggestion])
      return
    }

    const query = searchValue.trim()
    if (!query) return

    if (isOperationalQuestion(query)) {
      await runIntelligenceQuery(query)
      return
    }

    let exactEntitySuggestion = findExactEntitySuggestion(query, suggestions)

    if (!exactEntitySuggestion && query.length >= 2) {
      try {
        const response = await fetch(`/api/company/search-suggestions?q=${encodeURIComponent(query)}`, {
          cache: 'no-store',
        })
        if (response.ok) {
          const data = await response.json()
          const freshSuggestions = Array.isArray(data.suggestions) ? data.suggestions : []
          exactEntitySuggestion = findExactEntitySuggestion(query, freshSuggestions)
        }
      } catch (error) {
        console.error('Exact entity resolution error:', error)
      }
    }

    if (exactEntitySuggestion) {
      navigateToSuggestion(exactEntitySuggestion)
      return
    }

    setSearchOpen(false)
    setIntelligenceResult(null)
    router.push(`${documentSearchPath}?search=${encodeURIComponent(query)}`)
  }

  const handleSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!searchOpen || suggestions.length === 0) {
      if (event.key === 'Escape') {
        setSearchOpen(false)
        setIntelligenceResult(null)
      }
      return
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveSuggestion((current) => (current + 1) % suggestions.length)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveSuggestion((current) => (current <= 0 ? suggestions.length - 1 : current - 1))
    } else if (event.key === 'Escape') {
      setSearchOpen(false)
      setActiveSuggestion(-1)
      setIntelligenceResult(null)
    }
  }

  const operationalQuestion = isOperationalQuestion(searchValue)
  const answer = intelligenceResult?.answer
  const facts = formatFacts(answer?.facts)

  return (
    <header className="sticky top-0 z-40 h-14 border-b border-[var(--cf-line)] bg-[var(--cf-sidebar)] text-[var(--cf-text)] sm:h-16">
      <div className="flex h-full items-center gap-3 px-3 sm:px-5 lg:px-7">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Abrir navegación"
          className="h-10 w-10 flex-shrink-0 rounded-[5px] text-[var(--cf-text)] hover:bg-[var(--cf-surface-2)] md:hidden"
          onClick={onMenuClick}
        >
          <Menu className="h-5 w-5" />
        </Button>

        <div className="hidden min-w-0 flex-shrink-0 sm:block md:hidden">
          <p className="truncate text-sm font-medium text-[var(--cf-text)]">ChileFlota</p>
          <p className="text-xs text-[var(--cf-text-muted)]">Transportes Labbé</p>
        </div>

        <form onSubmit={handleSearch} className="mx-auto flex-1 sm:max-w-lg">
          <div ref={searchRef} className="relative w-full">
            <Search className="absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-[var(--cf-text-muted)]" />
            <Input
              type="search"
              aria-label="Buscar o consultar ChileFlota"
              aria-autocomplete="list"
              aria-expanded={searchOpen}
              placeholder="Buscar documentos, RUT, empresa, conductor o preguntar..."
              value={searchValue}
              onFocus={() => searchValue.trim().length >= 2 && setSearchOpen(true)}
              onChange={(e) => setSearchValue(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              className="h-9 rounded-[5px] border-[var(--cf-line)] bg-[var(--cf-surface-2)] pl-9 pr-16 text-sm text-[var(--cf-text)] placeholder:text-[var(--cf-text-muted)] focus-visible:border-[var(--cf-burgundy)] focus-visible:ring-[var(--cf-focus-ring)]/30"
            />
            <span
              aria-label="Nueva funcionalidad"
              className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded-[4px] border border-[var(--cf-burgundy)] bg-[var(--cf-sidebar)] px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-[0.08em] text-[var(--cf-burgundy-hover)]"
            >
              Nuevo
            </span>

            {searchOpen && searchValue.trim().length >= 2 && (
              <div
                role="listbox"
                className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 overflow-hidden rounded-[6px] border border-[var(--cf-line)] bg-[var(--cf-sidebar)] shadow-xl shadow-black/25"
              >
                {operationalQuestion ? (
                  <div className="p-2">
                    {intelligenceLoading ? (
                      <div className="flex items-center gap-2 px-2 py-3 text-xs text-[var(--cf-text-muted)]">
                        <Sparkles className="h-4 w-4" />
                        Consultando evidencia operacional…
                      </div>
                    ) : answer ? (
                      <div className="px-2 py-2">
                        <div className="flex items-start gap-2">
                          <Sparkles className="mt-0.5 h-4 w-4 flex-shrink-0 text-[var(--cf-burgundy-hover)]" />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm leading-5 text-[var(--cf-text)]">{answer.summary}</p>
                            {answer.interpretation && (
                              <p className="mt-1 text-xs leading-4 text-[var(--cf-text-secondary)]">{answer.interpretation}</p>
                            )}
                          </div>
                        </div>

                        {facts.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 border-t border-[var(--cf-line)] pt-2">
                            {facts.map((fact) => (
                              <span key={fact.key} className="text-xs text-[var(--cf-text-muted)]">
                                {fact.key}: <span className="text-[var(--cf-text-secondary)]">{fact.value}</span>
                              </span>
                            ))}
                          </div>
                        )}

                        {answer.unknowns?.[0] && (
                          <p className="mt-2 text-xs leading-4 text-[var(--cf-text-muted)]">{answer.unknowns[0]}</p>
                        )}

                        {answer.nextActions?.[0] && (
                          <button
                            type="button"
                            onClick={() => router.push(answer.nextActions![0].href)}
                            className="mt-2 flex w-full items-center justify-between rounded-[5px] border border-[var(--cf-line)] px-2.5 py-2 text-left text-xs text-[var(--cf-text-secondary)] hover:bg-[var(--cf-surface-2)] hover:text-[var(--cf-text)]"
                          >
                            <span>{answer.nextActions[0].label}</span>
                            <ArrowRight className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 px-2 py-3 text-xs text-[var(--cf-text-muted)]">
                        <Sparkles className="h-4 w-4" />
                        Presiona Enter para consultar la evidencia operacional.
                      </div>
                    )}
                  </div>
                ) : searchLoading && suggestions.length === 0 ? (
                  <div className="px-3 py-3 text-xs text-[var(--cf-text-muted)]">Buscando coincidencias…</div>
                ) : suggestions.length > 0 ? (
                  <div className="py-1.5">
                    {suggestions.map((suggestion, index) => {
                      const Icon = suggestion.type === 'company' ? Building2 : suggestion.type === 'driver' ? User : FileText
                      return (
                        <button
                          key={suggestion.id}
                          type="button"
                          role="option"
                          aria-selected={activeSuggestion === index}
                          onMouseEnter={() => setActiveSuggestion(index)}
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => navigateToSuggestion(suggestion)}
                          className={`flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                            activeSuggestion === index
                              ? 'bg-[var(--cf-surface-2)]'
                              : 'hover:bg-[var(--cf-surface-2)]'
                          }`}
                        >
                          <Icon className="h-4 w-4 flex-shrink-0 text-[var(--cf-text-muted)]" />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm text-[var(--cf-text)]">{suggestion.label}</span>
                            {suggestion.secondary && (
                              <span className="mt-0.5 block truncate text-xs text-[var(--cf-text-muted)]">
                                {suggestion.secondary}
                              </span>
                            )}
                          </span>
                          <span className="text-[10px] uppercase tracking-wide text-[var(--cf-text-muted)]">
                            {suggestion.type === 'company' ? 'Empresa' : suggestion.type === 'driver' ? 'Conductor' : 'Documento'}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                ) : (
                  <div className="px-3 py-3 text-xs text-[var(--cf-text-muted)]">
                    Sin coincidencias inmediatas. Presiona Enter para buscar en documentos.
                  </div>
                )}
              </div>
            )}
          </div>
        </form>

        <div className="relative flex-shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setProfileOpen(!profileOpen)}
            className="h-9 rounded-[5px] px-2 text-[var(--cf-text-secondary)] hover:bg-[var(--cf-surface-2)] hover:text-[var(--cf-text)] sm:px-3"
          >
            <User className="h-4 w-4 flex-shrink-0" />
            <span className="hidden max-w-[220px] truncate text-xs font-normal sm:inline">
              {profile?.full_name || userEmail?.split('@')[0] || 'Perfil'}
            </span>
            <ChevronDown className="h-4 w-4 flex-shrink-0" />
          </Button>

          {profileOpen && (
            <div className="absolute right-0 mt-2 w-64 overflow-hidden rounded-[5px] border border-[var(--cf-line)] bg-[var(--cf-sidebar)] shadow-xl shadow-black/20">
              <div className="border-b border-[var(--cf-line)] px-4 py-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[5px] bg-[var(--cf-burgundy)] text-[var(--cf-text)]">
                    {profile?.avatar_url ? (
                      <img
                        src={profile.avatar_url}
                        alt={profile.full_name || 'Avatar'}
                        className="h-10 w-10 rounded-[5px] object-cover"
                      />
                    ) : (
                      <User className="h-5 w-5" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-[var(--cf-text)]">
                      {profile?.full_name || 'Usuario'}
                    </p>
                    <p className="truncate text-xs text-[var(--cf-text-muted)]">
                      {profile?.email || userEmail}
                    </p>
                  </div>
                </div>
              </div>

              {profile?.phone && (
                <div className="border-b border-[var(--cf-line)] px-4 py-3">
                  <p className="text-xs text-[var(--cf-text-muted)]">Teléfono</p>
                  <p className="mt-1 text-sm text-[var(--cf-text-secondary)]">{profile.phone}</p>
                </div>
              )}

              <div className="p-1.5">
                <Link href="/dashboard/company/perfil" className="block">
                  <button
                    onClick={() => setProfileOpen(false)}
                    className="flex min-h-10 w-full items-center gap-3 rounded-[5px] px-3 py-2 text-left text-sm text-[var(--cf-text-secondary)] transition-colors hover:bg-[var(--cf-surface-2)] hover:text-[var(--cf-text)]"
                  >
                    <Settings className="h-4 w-4 text-[var(--cf-text-muted)]" />
                    <span>Mi Perfil</span>
                  </button>
                </Link>

                <button
                  onClick={handleLogout}
                  className="flex min-h-10 w-full items-center gap-3 rounded-[5px] px-3 py-2 text-left text-sm text-[var(--cf-text-secondary)] transition-colors hover:bg-[var(--cf-surface-2)] hover:text-[var(--cf-text)]"
                >
                  <LogOut className="h-4 w-4 text-[var(--cf-danger)]" />
                  <span>Cerrar Sesión</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
