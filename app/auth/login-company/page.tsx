'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import Link from 'next/link'

export default function CompanyLoginPage() {
  const [rut, setRut] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [rutError, setRutError] = useState('')
  const router = useRouter()

  const formatRUT = (value: string) => {
    const cleaned = value.replace(/[^0-9kK]/g, '').toUpperCase()
    if (cleaned.length < 2) return cleaned
    return `${cleaned.slice(0, -1)}-${cleaned.slice(-1)}`
  }

  const validateRUT = (value: string) => {
    if (!value) {
      setRutError('El RUT es requerido')
      return false
    }
    const rutRegex = /^\d{1,8}-[0-9K]$/
    if (!rutRegex.test(value)) {
      setRutError('RUT inválido (formato: 12345678-9)')
      return false
    }
    setRutError('')
    return true
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateRUT(rut) || !password) return

    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/auth/login-simple', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rut, password }),
      })

      const data = await response.json().catch(() => null)
      if (!response.ok) throw new Error(data?.error || 'No fue posible iniciar sesión')

      router.push('/dashboard/company')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido al iniciar sesión')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-dark flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-foreground mb-2">ChileFlota</h1>
          <p className="text-muted-foreground">Portal de Empresas Transportistas</p>
        </div>

        <Card className="border-border bg-card/50 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-foreground">Inicia Sesión</CardTitle>
            <CardDescription>Ingresa el RUT y contraseña de tu empresa</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {error && (
              <div className="p-3 bg-destructive/10 border border-destructive/50 rounded-lg text-destructive text-sm font-medium">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="rut">RUT empresa</Label>
                <Input
                  id="rut"
                  type="text"
                  autoComplete="username"
                  placeholder="12345678-9"
                  value={rut}
                  onChange={(e) => {
                    const formatted = formatRUT(e.target.value)
                    setRut(formatted)
                    if (formatted) validateRUT(formatted)
                  }}
                  onBlur={() => validateRUT(rut)}
                  className={rutError ? 'border-destructive' : ''}
                />
                {rutError && <p className="text-xs text-destructive font-medium">{rutError}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Contraseña</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Ingresa tu contraseña"
                />
              </div>

              <Button
                type="submit"
                disabled={isLoading || !rut || !password || !!rutError}
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold h-10 mt-6"
              >
                {isLoading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
              </Button>
            </form>

            <div className="space-y-2 text-center text-sm pt-2">
              <p className="text-muted-foreground">
                ¿Eres usuario individual?{' '}
                <Link href="/auth/login" className="text-primary hover:text-primary/80 font-semibold transition-colors">
                  Login aquí
                </Link>
              </p>
              <p className="text-xs text-muted-foreground">Si olvidaste tu contraseña, contacta a soporte.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
