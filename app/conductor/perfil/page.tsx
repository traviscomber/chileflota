'use client'

import { useEffect, useState } from 'react'
import { AlertCircle, CheckCircle2, Loader, MessageCircle } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

export default function ConductorPerfilPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [formData, setFormData] = useState({
    name: '',
    rut: '',
    email: '',
    phone: '+56977764753',
    whatsapp_phone: '',
    whatsapp_enabled: false,
  })

  useEffect(() => {
    loadConductorData()
    loadPreferences()
  }, [])

  const loadConductorData = () => {
    try {
      const conductorDataStr = localStorage.getItem('conductor_data')
      if (!conductorDataStr) return
      const parsed = JSON.parse(conductorDataStr)
      setFormData((prev) => ({
        ...prev,
        name: parsed.nombre_completo || '',
        rut: parsed.rut || '',
        email: parsed.email || '',
      }))
    } catch (err) {
      console.error('[v0] Error loading conductor data:', err)
    }
  }

  const loadPreferences = async () => {
    try {
      setIsLoading(true)
      const response = await fetch('/api/conductor/whatsapp-preferences')
      if (!response.ok) return
      const data = await response.json()
      setFormData((prev) => ({
        ...prev,
        whatsapp_phone: data.whatsapp_phone || '',
        whatsapp_enabled: data.notifications_enabled || false,
      }))
    } catch (err) {
      console.error('[v0] Error loading preferences:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target
    setFormData((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }))
  }

  const handleSave = async () => {
    setError('')
    setSuccess('')
    setIsSaving(true)
    try {
      if (formData.whatsapp_phone) {
        const response = await fetch('/api/conductor/whatsapp-preferences', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            whatsapp_phone: formData.whatsapp_phone,
            whatsapp_enabled: formData.whatsapp_enabled,
          }),
        })
        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.error || 'Error al guardar')
        }
      }
      setSuccess('Preferencias actualizadas.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar cambios')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <section className="border-b border-[var(--cf-border)] pb-5">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-[var(--cf-text-muted)]">Cuenta</p>
        <h2 className="mt-2 text-[26px] font-semibold tracking-[-0.03em] text-[var(--cf-text)]">Mi perfil</h2>
        <p className="mt-1 text-sm text-[var(--cf-text-secondary)]">Datos de identificación y preferencias de notificación.</p>
      </section>

      {error && (
        <Alert className="border-[var(--cf-danger)]/40 bg-[var(--cf-danger-soft)]">
          <AlertCircle className="h-4 w-4 text-[var(--cf-danger)]" />
          <AlertDescription className="text-[var(--cf-danger)]">{error}</AlertDescription>
        </Alert>
      )}
      {success && (
        <Alert className="border-[var(--cf-success)]/40 bg-[var(--cf-success-soft)]">
          <CheckCircle2 className="h-4 w-4 text-[var(--cf-success)]" />
          <AlertDescription className="text-[var(--cf-success)]">{success}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Información personal</CardTitle>
          <CardDescription>Estos datos provienen del registro de Transportes Labbé.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Nombre completo" value={formData.name} />
          <Field label="RUT" value={formData.rut} />
          <Field label="Email" value={formData.email} />
          <Field label="Teléfono" value={formData.phone} />
          <div className="sm:col-span-2 rounded-[6px] border border-[var(--cf-border)] bg-[var(--cf-canvas)] px-3 py-2.5 text-xs text-[var(--cf-text-muted)]">
            Para modificar estos datos, contacta a <span className="font-medium text-[var(--cf-text-secondary)]">soporte@labbe.cl</span>.
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><MessageCircle className="h-4 w-4 text-[var(--cf-text-secondary)]" />Notificaciones por WhatsApp</CardTitle>
          <CardDescription>Recibe avisos sobre estados documentales y vencimientos.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div>
            <label className="mb-2 block text-sm font-medium text-[var(--cf-text-secondary)]">Número de WhatsApp</label>
            <Input
              type="tel"
              name="whatsapp_phone"
              placeholder="+56912345678"
              value={formData.whatsapp_phone}
              onChange={handleInputChange}
              disabled={isLoading}
            />
            <p className="mt-1.5 text-xs text-[var(--cf-text-muted)]">Formato: +56 seguido de tu número.</p>
          </div>

          <label className="flex min-h-11 items-start gap-3 rounded-[6px] border border-[var(--cf-border)] bg-[var(--cf-canvas)] px-3 py-3">
            <input
              type="checkbox"
              name="whatsapp_enabled"
              checked={formData.whatsapp_enabled}
              onChange={handleInputChange}
              className="mt-0.5 h-4 w-4 accent-[var(--cf-accent)]"
            />
            <span>
              <span className="block text-sm font-medium text-[var(--cf-text)]">Activar notificaciones</span>
              <span className="mt-0.5 block text-xs text-[var(--cf-text-muted)]">Estados de documentos, vencimientos y avisos de soporte.</span>
            </span>
          </label>

          <div className="flex justify-end border-t border-[var(--cf-border)] pt-4">
            <Button onClick={handleSave} disabled={isSaving || isLoading} className="min-w-36">
              {isSaving ? <><Loader className="h-4 w-4 animate-spin" />Guardando…</> : 'Guardar cambios'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-[var(--cf-text-secondary)]">{label}</label>
      <Input value={value} disabled className="disabled:opacity-75" />
    </div>
  )
}
