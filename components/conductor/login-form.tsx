'use client'
// Pure client component — never SSRed, so no hydration mismatch possible

import { useState } from 'react'

export default function ConductorLoginForm() {
  const [rut, setRut] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    try {
      const response = await fetch('/api/auth/login-conductor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include', // ✅ CRITICAL: Send cookies with request
        body: JSON.stringify({ rut: rut.trim(), password }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `Error HTTP ${response.status}`)
      }

      const data = await response.json()
      
      // Store conductor data in localStorage for client-side access
      const conductorData = {
        conductor_id: data.conductor_id,
        rut: data.rut,
        nombre_completo: data.nombre_completo,
        email: data.email,
        transportista_id: data.transportista_id
      }
      
      localStorage.setItem('conductor_data', JSON.stringify(conductorData))

      // Redirect to onboarding - cookies are now set by the API response
      window.location.href = '/conductor/onboarding'
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al iniciar sesión'
      setError(message)
      setIsLoading(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--cf-canvas)] px-4 py-10">
      <section className="w-full max-w-[420px]">
        <div className="mb-8">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-[var(--cf-text-muted)]">ChileFlota</p>
          <h1 className="mt-3 text-[26px] font-semibold tracking-[-0.03em] text-[var(--cf-text)]">Portal Conductores</h1>
          <p className="mt-2 text-sm text-[var(--cf-text-secondary)]">Transportes Labbé</p>
        </div>

        <div className="rounded-[8px] border border-[var(--cf-border)] bg-[var(--cf-surface)] p-6 sm:p-7">
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-[var(--cf-text)]">Iniciar sesión</h2>
            <p className="mt-1 text-sm leading-6 text-[var(--cf-text-secondary)]">Ingresa tu RUT y contraseña para acceder.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="rounded-[6px] border border-[var(--cf-danger)]/40 bg-[var(--cf-danger-soft)] px-3 py-2.5 text-sm text-[var(--cf-danger)]">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="conductor-rut" className="mb-2 block text-sm font-medium text-[var(--cf-text-secondary)]">RUT</label>
              <input
                id="conductor-rut"
                suppressHydrationWarning
                type="text"
                placeholder="12345678-9"
                value={rut}
                onChange={(e) => setRut(e.target.value)}
                required
                autoComplete="username"
                className="h-11 w-full rounded-[6px] border border-[var(--cf-border)] bg-[var(--cf-surface-raised)] px-3.5 text-sm text-[var(--cf-text)] outline-none placeholder:text-[var(--cf-text-muted)] focus:border-[var(--cf-focus-ring)] focus:ring-1 focus:ring-[var(--cf-focus-ring)] disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isLoading}
              />
              <p className="mt-1.5 text-xs text-[var(--cf-text-muted)]">Sin puntos, con guion.</p>
            </div>

            <div>
              <label htmlFor="conductor-password" className="mb-2 block text-sm font-medium text-[var(--cf-text-secondary)]">Contraseña</label>
              <input
                id="conductor-password"
                suppressHydrationWarning
                type="password"
                placeholder="Ingresa tu contraseña"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="h-11 w-full rounded-[6px] border border-[var(--cf-border)] bg-[var(--cf-surface-raised)] px-3.5 text-sm text-[var(--cf-text)] outline-none placeholder:text-[var(--cf-text-muted)] focus:border-[var(--cf-focus-ring)] focus:ring-1 focus:ring-[var(--cf-focus-ring)] disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isLoading}
              />
              <p className="mt-1.5 text-xs text-[var(--cf-text-muted)]">Usa la clave entregada por tu ejecutiva.</p>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="flex h-11 w-full items-center justify-center rounded-[6px] bg-[var(--cf-accent)] px-4 text-sm font-medium text-[var(--cf-text)] transition-colors hover:bg-[var(--cf-accent-hover)] focus:outline-none focus:ring-2 focus:ring-[var(--cf-focus-ring)] focus:ring-offset-2 focus:ring-offset-[var(--cf-surface)] disabled:cursor-not-allowed disabled:bg-[var(--cf-accent-soft)] disabled:text-[var(--cf-text-muted)]"
            >
              {isLoading ? 'Ingresando…' : 'Ingresar'}
            </button>
          </form>
        </div>

        <div className="mt-5 flex items-center justify-between gap-4 text-xs text-[var(--cf-text-muted)]">
          <span>¿Nuevo conductor? Contacta a tu ejecutiva.</span>
          <a href="/login" className="font-medium text-[var(--cf-text-secondary)] hover:text-[var(--cf-text)]">Acceso empresa</a>
        </div>
      </section>
    </main>
  )
}
