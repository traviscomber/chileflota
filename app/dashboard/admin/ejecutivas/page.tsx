'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Plus, Trash2, Edit2, Loader, RefreshCw } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

interface Executive {
  id: string
  email: string
  nombre: string
  apellido?: string
  is_active?: boolean
}

interface CreateEditModal {
  open: boolean
  mode: 'create' | 'edit'
  executive?: Executive | null
}

export default function ExecutivesAdminPage() {
  const [executives, setExecutives] = useState<Executive[]>([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [modal, setModal] = useState<CreateEditModal>({ open: false, mode: 'create' })
  const [formLoading, setFormLoading] = useState(false)
  const [syncingCanonical, setSyncingCanonical] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Form state
  const [formData, setFormData] = useState({
    email: '',
    nombre: '',
    apellido: '',
  })

  useEffect(() => {
    fetchExecutives()
  }, [])

  const fetchExecutives = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/admin/executive-staff')
      if (!response.ok) throw new Error('Failed to fetch executives')
      const data = await response.json()
      setExecutives(data.executives || [])
      console.log('[v0] Loaded executives:', data.executives?.length)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error loading executives'
      console.error('[v0] Error:', msg)
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  const handleOpenCreate = () => {
    setFormData({ email: '', nombre: '', apellido: '' })
    setModal({ open: true, mode: 'create' })
    setError(null)
  }

  const handleOpenEdit = (exec: Executive) => {
    setFormData({
      email: exec.email,
      nombre: exec.nombre,
      apellido: exec.apellido || '',
    })
    setModal({ open: true, mode: 'edit', executive: exec })
    setError(null)
  }

  const handleCloseModal = () => {
    setModal({ open: false, mode: 'create' })
    setFormData({ email: '', nombre: '', apellido: '' })
  }

  const handleSave = async () => {
    if (!formData.email || !formData.nombre) {
      setError('Email y nombre son requeridos')
      return
    }

    // Validate email format
    if (!formData.email.includes('@labbe.cl')) {
      setError('El email debe ser del dominio @labbe.cl')
      return
    }

    setFormLoading(true)
    setError(null)

    try {
      const endpoint = modal.mode === 'create' 
        ? '/api/admin/executive-staff'
        : `/api/admin/executive-staff/${modal.executive?.id}`
      
      const method = modal.mode === 'create' ? 'POST' : 'PUT'

      const response = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.email,
          nombre: formData.nombre,
          apellido: formData.apellido,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || 'Error saving executive')
      }

      setSuccess(modal.mode === 'create' ? 'Ejecutiva creada' : 'Ejecutiva actualizada')
      handleCloseModal()
      await fetchExecutives()
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error unknown'
      console.error('[v0] Error saving:', msg)
      setError(msg)
    } finally {
      setFormLoading(false)
    }
  }

  const handleCanonicalSync = async () => {
    setSyncingCanonical(true)
    setError(null)
    setSuccess(null)

    try {
      const response = await fetch('/api/admin/sync-canonical-executives', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Error sincronizando asignaciones canónicas')
      }

      const missing = Array.isArray(data.missingRuts) ? data.missingRuts.length : 0
      setSuccess(
        `Asignaciones canónicas sincronizadas: ${data.updatedTotal} actualizadas, ${data.unchanged} ya correctas${missing ? `, ${missing} RUT no encontrados` : ''}.`
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error sincronizando asignaciones canónicas')
    } finally {
      setSyncingCanonical(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('¿Estás seguro de que deseas eliminar esta ejecutiva?')) return

    setDeleting(id)
    try {
      const response = await fetch(`/api/admin/executive-staff/${id}`, {
        method: 'DELETE',
      })

      if (!response.ok) throw new Error('Failed to delete executive')

      setSuccess('Ejecutiva eliminada')
      await fetchExecutives()
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error deleting'
      console.error('[v0] Error:', msg)
      setError(msg)
    } finally {
      setDeleting(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex items-center gap-2">
          <Loader className="w-5 h-5 animate-spin text-primary" />
          <span>Cargando ejecutivas...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Gestión de Ejecutivas</h1>
          <p className="text-slate-400 mt-1">Administra los usuarios ejecutivas de Transportes Labbé</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handleCanonicalSync}
            disabled={syncingCanonical}
            className="gap-2"
          >
            {syncingCanonical ? <Loader className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Sincronizar canónico
          </Button>
          <Button
            onClick={handleOpenCreate}
            className="bg-primary hover:bg-primary/90 gap-2"
          >
            <Plus className="w-4 h-4" />
            Nueva Ejecutiva
          </Button>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="p-4 bg-red-900/20 border border-red-700/50 rounded-lg">
          <p className="text-red-300">{error}</p>
        </div>
      )}

      {success && (
        <div className="p-4 bg-green-900/20 border border-green-700/50 rounded-lg">
          <p className="text-green-300">{success}</p>
        </div>
      )}

      {/* Executives List */}
      <div className="grid gap-4">
        {executives.length === 0 ? (
          <Card className="border-slate-700 bg-slate-900/50">
            <CardContent className="p-8 text-center">
              <p className="text-slate-400">No hay ejecutivas registradas</p>
            </CardContent>
          </Card>
        ) : (
          executives.map((exec) => (
            <Card key={exec.id} className="border-slate-700 bg-slate-900/50 hover:border-slate-600 transition-colors">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-white">
                      {exec.nombre} {exec.apellido || ''}
                    </h3>
                    <p className="text-slate-400">{exec.email}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleOpenEdit(exec)}
                      className="text-slate-400 hover:text-white hover:bg-slate-800"
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(exec.id)}
                      disabled={deleting === exec.id}
                      className="text-red-400 hover:text-red-300 hover:bg-red-900/20"
                    >
                      {deleting === exec.id ? (
                        <Loader className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Create/Edit Modal */}
      <Dialog open={modal.open} onOpenChange={(open) => {
        if (!open) handleCloseModal()
      }}>
        <DialogContent className="bg-slate-900 border-slate-700">
          <DialogHeader>
            <DialogTitle>
              {modal.mode === 'create' ? 'Nueva Ejecutiva' : 'Editar Ejecutiva'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Email (@labbe.cl)</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                disabled={modal.mode === 'edit'}
                placeholder="ejecutiva@labbe.cl"
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 disabled:opacity-50"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Nombre</label>
              <input
                type="text"
                value={formData.nombre}
                onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                placeholder="Nombre"
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Apellido (Opcional)</label>
              <input
                type="text"
                value={formData.apellido}
                onChange={(e) => setFormData({ ...formData, apellido: e.target.value })}
                placeholder="Apellido"
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500"
              />
            </div>

            {error && (
              <div className="p-3 bg-red-900/20 border border-red-700/50 rounded-lg">
                <p className="text-red-300 text-sm">{error}</p>
              </div>
            )}

            <div className="flex gap-3 pt-4">
              <Button
                variant="outline"
                onClick={handleCloseModal}
                disabled={formLoading}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleSave}
                disabled={formLoading || !formData.email || !formData.nombre}
                className="flex-1 bg-primary hover:bg-primary/90"
              >
                {formLoading ? (
                  <>
                    <Loader className="w-4 h-4 mr-2 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  modal.mode === 'create' ? 'Crear' : 'Actualizar'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
