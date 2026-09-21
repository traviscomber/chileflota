'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AlertCircle, Loader, Eye, EyeOff } from 'lucide-react'

export default function SubcontratistasLoginPage() {
  const router = useRouter()
  const [rut, setRut] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await fetch('/api/auth/subcontractors/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rut, password }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Error al iniciar sesion')
        setLoading(false)
        return
      }

      window.location.href = '/subcontractors/onboarding'
    } catch (err) {
      setError('Error de conexion. Intenta nuevamente.')
      console.error('[v0] Login error:', err)
      setLoading(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--cf-canvas)] px-4 py-10">
      <section className="w-full max-w-[420px]">
        <div className="mb-8">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-[var(--cf-text-muted)]">ChileFlota</p>
          <h1 className="mt-3 text-[26px] font-semibold tracking-[-0.03em] text-[var(--cf-text)]">Portal Subcontratistas</h1>
          <p className="mt-2 text-sm text-[var(--cf-text-secondary)]">Transportes Labbé</p>
        </div>
        <Card className="w-full rounded-[8px] border-[var(--cf-border)] bg-[var(--cf-surface)] shadow-none">
          <CardHeader className="space-y-1">
            <CardTitle className="text-lg font-semibold text-[var(--cf-text)]">Iniciar sesión</CardTitle>
            <CardDescription className="text-[var(--cf-text-secondary)]">Gestiona documentos y estados de cumplimiento.</CardDescription>
          </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="flex gap-3 rounded-[6px] border border-[var(--cf-danger)]/40 bg-[var(--cf-danger-soft)] p-3">
                <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-[var(--cf-danger)]" />
                <p className="text-sm text-[var(--cf-danger)]">{error}</p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="rut" className="text-sm font-medium text-[var(--cf-text-secondary)]">
                RUT de la Empresa
              </Label>
              <Input
                id="rut"
                placeholder="12345678-9"
                value={rut}
                onChange={(e) => setRut(e.target.value)}
                disabled={loading}
                className="border-[var(--cf-border)] bg-[var(--cf-surface-raised)] text-[var(--cf-text)] placeholder:text-[var(--cf-text-muted)] focus-visible:border-[var(--cf-focus-ring)] focus-visible:ring-[var(--cf-focus-ring)]"
              />
              <p className="text-xs text-[var(--cf-text-muted)]">Ingresa el RUT sin puntos, solo con guion.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium text-[var(--cf-text-secondary)]">
                Contrasena
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  className="border-[var(--cf-border)] bg-[var(--cf-surface-raised)] pr-10 text-[var(--cf-text)] placeholder:text-[var(--cf-text-muted)] focus-visible:border-[var(--cf-focus-ring)] focus-visible:ring-[var(--cf-focus-ring)]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--cf-text-muted)] transition-colors hover:text-[var(--cf-text-secondary)]"
                  title={showPassword ? 'Ocultar contrasena' : 'Mostrar contrasena'}
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              <p className="text-xs text-[var(--cf-text-muted)]">La contrasena se genera segun la regla entregada por la plataforma.</p>
            </div>

            <Button
              type="submit"
              disabled={loading || !rut || !password}
              className="w-full bg-[var(--cf-accent)] text-[var(--cf-text)] hover:bg-[var(--cf-accent-hover)]"
            >
              {loading ? (
                <>
                  <Loader className="mr-2 h-4 w-4 animate-spin" />
                  Iniciando sesion...
                </>
              ) : (
                'Iniciar Sesion'
              )}
            </Button>
          </form>
        </CardContent>
        </Card>
        <p className="mt-5 text-center text-xs text-[var(--cf-text-muted)]">Tecnología provista por N3uralia</p>
      </section>
    </main>
  )
}
