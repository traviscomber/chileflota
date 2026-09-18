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
    <main className="flex min-h-screen items-center justify-center bg-[#171719] px-4 py-10 text-[#E7E7E9]">
      <section className="w-full max-w-[420px]">
        <div className="mb-8">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-[#7D7D84]">
            Plataforma de compliance operacional
          </p>
          <h1 className="mt-3 text-[28px] font-semibold tracking-[-0.035em] text-[#E7E7E9]">
            ChileFlota
          </h1>
          <p className="mt-2 text-sm text-[#B1B1B6]">Transportes Labbé</p>
        </div>

        <div className="rounded-[8px] border border-[#36363B] bg-[#232326] p-6 sm:p-7">
          <div className="mb-6">
            <h2 className="text-lg font-semibold tracking-[-0.02em] text-[#E7E7E9]">Iniciar sesión</h2>
            <p className="mt-1 text-sm leading-6 text-[#B1B1B6]">
              Acceso al workspace operacional de ChileFlota.
            </p>
          </div>

          {error && (
            <div className="mb-4 rounded-[6px] border border-[#6D3341] bg-[#3B2029] px-3 py-2.5">
              <p className="text-sm font-medium text-[#E9A4B4]">{error}</p>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label htmlFor="email" className="mb-2 block text-sm font-medium text-[#D2D2D5]">
                Correo electrónico
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nombre@empresa.cl"
                className="h-11 w-full rounded-[6px] border border-[#36363B] bg-[#1D1D1F] px-3.5 text-sm text-[#E7E7E9] outline-none transition-colors placeholder:text-[#7D7D84] focus:border-[#C86A82] focus:ring-1 focus:ring-[#C86A82] disabled:cursor-not-allowed disabled:opacity-60"
                disabled={loading}
                autoComplete="email"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex h-11 w-full items-center justify-center rounded-[6px] bg-[#873146] px-4 text-sm font-medium text-[#E7E7E9] transition-colors hover:bg-[#9B3A52] focus:outline-none focus:ring-2 focus:ring-[#C86A82] focus:ring-offset-2 focus:ring-offset-[#232326] disabled:cursor-not-allowed disabled:bg-[#3B2029] disabled:text-[#7D7D84]"
            >
              {loading ? 'Ingresando…' : 'Ingresar'}
            </button>
          </form>
        </div>

        <p className="mt-5 text-center text-xs text-[#7D7D84]">
          Tecnología provista por N3uralia
        </p>
      </section>
    </main>
  )
}
