'use client'

import { useState } from 'react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await fetch('/api/login-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.toLowerCase() }),
        credentials: 'include',
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        setError(data.error || 'Error al iniciar sesión')
        setLoading(false)
        return
      }

      const expiryDate = new Date()
      expiryDate.setTime(expiryDate.getTime() + 7 * 24 * 60 * 60 * 1000)

      document.cookie = `user_email=${encodeURIComponent(email.toLowerCase())}; path=/; expires=${expiryDate.toUTCString()}`
      document.cookie = `user_name=${encodeURIComponent(data.user.full_name)}; path=/; expires=${expiryDate.toUTCString()}`
      document.cookie = `user_role=${encodeURIComponent(data.user.role)}; path=/; expires=${expiryDate.toUTCString()}`
      document.cookie = `user_organization_id=${encodeURIComponent(data.user.organization_id || '')}; path=/; expires=${expiryDate.toUTCString()}`

      setTimeout(() => {
        window.location.href = data.user.role === 'ejecutiva'
          ? '/dashboard/company/documentos/pendientes'
          : '/dashboard/company'
      }, 300)
    } catch (err) {
      setError('Error al conectar con el servidor')
      setLoading(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--cf-canvas)] px-4 py-10 text-[var(--cf-text)]">
      <section className="w-full max-w-[420px]">
        <div className="mb-8">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-[var(--cf-text-muted)]">
            Plataforma de compliance operacional
          </p>
          <h1 className="mt-3 text-[28px] font-semibold tracking-[-0.035em] text-[var(--cf-text)]">
            ChileFlota
          </h1>
          <p className="mt-2 text-sm text-[var(--cf-text-secondary)]">Transportes Labbé</p>
        </div>

        <div className="rounded-[8px] border border-[var(--cf-border)] bg-[var(--cf-surface)] p-6 sm:p-7">
          <div className="mb-6">
            <h2 className="text-lg font-semibold tracking-[-0.02em] text-[var(--cf-text)]">Iniciar sesión</h2>
            <p className="mt-1 text-sm leading-6 text-[var(--cf-text-secondary)]">
              Acceso al workspace operacional de ChileFlota.
            </p>
          </div>

          {error && (
            <div className="mb-4 rounded-[6px] border border-[var(--cf-danger)]/40 bg-[var(--cf-danger-soft)] px-3 py-2.5">
              <p className="text-sm font-medium text-[var(--cf-danger)]">{error}</p>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label htmlFor="email" className="mb-2 block text-sm font-medium text-[var(--cf-text-secondary)]">
                Correo electrónico
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nombre@empresa.cl"
                className="h-11 w-full rounded-[6px] border border-[var(--cf-border)] bg-[var(--cf-surface-raised)] px-3.5 text-sm text-[var(--cf-text)] outline-none transition-colors placeholder:text-[var(--cf-text-muted)] focus:border-[var(--cf-focus-ring)] focus:ring-1 focus:ring-[var(--cf-focus-ring)] disabled:cursor-not-allowed disabled:opacity-60"
                disabled={loading}
                autoComplete="email"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex h-11 w-full items-center justify-center rounded-[6px] bg-[var(--cf-accent)] px-4 text-sm font-medium text-[var(--cf-text)] transition-colors hover:bg-[var(--cf-accent-hover)] focus:outline-none focus:ring-2 focus:ring-[var(--cf-focus-ring)] focus:ring-offset-2 focus:ring-offset-[var(--cf-surface)] disabled:cursor-not-allowed disabled:bg-[var(--cf-danger-soft)] disabled:text-[var(--cf-text-muted)]"
            >
              {loading ? 'Ingresando…' : 'Ingresar'}
            </button>
          </form>
        </div>

        <p className="mt-5 text-center text-xs text-[var(--cf-text-muted)]">
          Tecnología provista por N3uralia
        </p>
      </section>
    </main>
  )
}
