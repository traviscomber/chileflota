'use client'

import { useEffect, useMemo, useState } from 'react'
import { Search, Phone, Mail, CheckCircle, AlertCircle, X, Filter, Users, Edit, UserPlus, ShieldCheck, ShieldAlert, ShieldX, Clock3 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { SubcontractorDetailTabs } from './subcontractor-detail-tabs'
import { EditSubcontractorModal } from './edit-subcontractor-modal'
import { AssignExecutiveModal } from './assign-executive-modal'

interface Document {
  id: string
  nombre: string
  tipo: string
  estado: 'pendiente' | 'aprobado' | 'rechazado' | 'vencido'
  fecha_subida: string
  fecha_vencimiento?: string
  subcontratista_id: string
}

interface DocumentRequirement {
  id: string
  code: string
  nombre: string
  descripcion?: string
  is_active: boolean
  applicable_to_transportista?: boolean
}

interface Subcontractor {
  id: string
  nombre?: string
  nombre_fantasia?: string
  razon_social?: string
  rut: string
  comuna: string
  direccion?: string
  representante_legal?: string
  telefono: string
  email?: string
  correo?: string
  ejecutivo_nombre?: string
  ariztia?: boolean
  lts?: boolean
  rendic?: boolean
  interpolar?: boolean
  is_active: boolean
  conductores_count?: number
  region?: string
  documentos?: Document[]
  documentos_requeridos?: DocumentRequirement[]
  certificaciones_count?: {
    ariztia: number
    lts: number
    rendic: number
    interpolar: number
  }
}

interface Driver {
  id: string
  rut: string
  nombre: string
  rut_proveedor: string
  proveedor: string
  is_active: boolean
}

interface SiiStatus {
  status: string
  errorCode: string | null
  errorMessage: string | null
  checkedAt: string | null
  razonSocial: string | null
  warningReasons: string[]
}

interface SubcontractorsListProps {
  subcontractors?: Subcontractor[]
  drivers?: Driver[]
}

function getCompletion(sub: Subcontractor) {
  const checks = [
    Boolean(sub.id),
    Boolean(sub.rut),
    Boolean(sub.nombre || sub.razon_social),
    Boolean(sub.representante_legal),
    Boolean(sub.telefono || sub.email || sub.correo),
    Boolean(sub.direccion || sub.comuna || sub.region),
    Boolean(sub.ejecutivo_nombre),
    Boolean(sub.ariztia || sub.lts || sub.rendic || sub.interpolar),
  ]
  const completed = checks.filter(Boolean).length
  const total = checks.length
  const percent = Math.round((completed / total) * 100)
  return {
    completed,
    total,
    percent,
    label: percent >= 90 ? 'Completo' : percent >= 60 ? 'Parcial' : 'Pendiente',
  }
}

function formatCheckedAt(value: string | null) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return new Intl.DateTimeFormat('es-CL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function SiiBadge({ value }: { value?: SiiStatus }) {
  if (!value) {
    return (
      <Badge variant="outline" className="gap-1 border-[var(--cf-border)] bg-[var(--cf-surface)]/60 text-[var(--cf-text-secondary)]" title="Aún no existe una consulta SII registrada">
        <Clock3 className="h-3.5 w-3.5" /> Pendiente SII
      </Badge>
    )
  }

  const checkedAt = formatCheckedAt(value.checkedAt)
  const title = [
    value.razonSocial ? `Razón social SII: ${value.razonSocial}` : null,
    checkedAt ? `Última consulta: ${checkedAt}` : null,
    value.errorMessage,
  ].filter(Boolean).join('\n')

  if (value.status === 'success') {
    return (
      <Badge variant="outline" className="gap-1 border-emerald-400/40 bg-emerald-500/10 text-emerald-200" title={title}>
        <ShieldCheck className="h-3.5 w-3.5" /> SII validado
      </Badge>
    )
  }

  if (value.status === 'warning') {
    return (
      <Badge variant="outline" className="gap-1 border-amber-400/40 bg-[var(--cf-warning-soft)] text-[var(--cf-warning)]" title={title}>
        <ShieldAlert className="h-3.5 w-3.5" /> SII con alertas
      </Badge>
    )
  }

  if (value.status === 'not_found') {
    return (
      <Badge variant="outline" className="gap-1 border-rose-400/40 bg-rose-500/10 text-rose-200" title={title}>
        <ShieldX className="h-3.5 w-3.5" /> No encontrado SII
      </Badge>
    )
  }

  const invalidRut = value.errorCode === 'SII_INVALID_RUT'
  return (
    <Badge variant="outline" className="gap-1 border-rose-400/40 bg-rose-500/10 text-rose-200" title={title}>
      <ShieldX className="h-3.5 w-3.5" /> {invalidRut ? 'RUT inválido' : 'Error SII'}
    </Badge>
  )
}

export function SubcontractorsList({ subcontractors: initialSubcontractors, drivers: initialDrivers }: SubcontractorsListProps) {
  const [subcontractors, setSubcontractors] = useState<Subcontractor[]>(initialSubcontractors || [])
  const [drivers, setDrivers] = useState<Driver[]>(initialDrivers || [])
  const [siiStatuses, setSiiStatuses] = useState<Record<string, SiiStatus>>({})
  const [isLoading, setIsLoading] = useState(!initialSubcontractors)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedEjecutivas, setSelectedEjecutivas] = useState<string[]>([])
  const [selectedCertifications, setSelectedCertifications] = useState<string[]>([])
  const [showActiveOnly, setShowActiveOnly] = useState(false)
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)
  const [expandedSubcontractor] = useState<string | null>(null)
  const [selectedDetailSubcontractor, setSelectedDetailSubcontractor] = useState<any>(null)
  const [detailTabToOpen, setDetailTabToOpen] = useState<'resumen' | 'documentos' | 'conductores' | 'certificaciones' | 'onboarding'>('resumen')
  const [documentsData, setDocumentsData] = useState<{ documents: any[], requirements: any[], summary: any } | null>(null)
  const [editingSubcontractor, setEditingSubcontractor] = useState<Subcontractor | null>(null)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [assigningSubcontractor, setAssigningSubcontractor] = useState<Subcontractor | null>(null)
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false)

  useEffect(() => {
    if (initialSubcontractors) return
    const fetchData = async () => {
      try {
        const response = await fetch('/api/dashboard/data', {
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate', Pragma: 'no-cache' },
        })
        if (!response.ok) throw new Error(`Dashboard API ${response.status}`)
        const data = await response.json()
        if (Array.isArray(data.dashboard?.transportistas)) {
          setSubcontractors(data.dashboard.transportistas)
          setDrivers(data.dashboard.conductores || [])
        }
      } catch (error) {
        console.error('[v0] Error fetching subcontractors:', error)
        setSubcontractors([])
        setDrivers([])
      } finally {
        setIsLoading(false)
      }
    }
    fetchData()
  }, [initialSubcontractors])

  useEffect(() => {
    let cancelled = false
    const loadSiiStatuses = async () => {
      try {
        const response = await fetch('/api/external-verification/sii-statuses', {
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' },
        })
        if (!response.ok) throw new Error(`SII statuses API ${response.status}`)
        const data = await response.json()
        if (!cancelled) setSiiStatuses(data.statuses || {})
      } catch (error) {
        console.error('[v0] Error fetching SII statuses:', error)
      }
    }

    loadSiiStatuses()
    const interval = window.setInterval(loadSiiStatuses, 60_000)
    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  }, [])

  useEffect(() => {
    const fetchDocuments = async () => {
      if (!selectedDetailSubcontractor?.id) return
      try {
        const response = await fetch(`/api/subcontractors/${selectedDetailSubcontractor.id}/documents`)
        if (response.ok) setDocumentsData(await response.json())
      } catch (error) {
        console.error('[v0] Error fetching documents for subcontractor:', error)
      }
    }
    fetchDocuments()
  }, [selectedDetailSubcontractor?.id])

  const refreshSubcontractor = async (subcontractorId: string) => {
    try {
      const response = await fetch(`/api/transportistas/${subcontractorId}`)
      if (!response.ok) return
      const data = await response.json()
      setSubcontractors(prev => prev.map(s => s.id === subcontractorId ? { ...s, ...data.transportista } : s))
    } catch (error) {
      console.error('[v0] Error refreshing subcontractor:', error)
      window.location.reload()
    }
  }

  const ejecutivas = useMemo(() => Array.from(new Set(subcontractors.map(s => s.ejecutivo_nombre || 'Sin asignar'))).filter(Boolean).sort(), [subcontractors])
  const certifications = { ariztia: 'Ariztia', lts: 'LTS', rendic: 'Rendic', interpolar: 'Interpolar' }

  const filtered = useMemo(() => {
    const results = subcontractors.filter(sub => {
      if (searchTerm) {
        const query = searchTerm.toLowerCase()
        const matchesSearch =
          (sub.razon_social || sub.nombre || '').toLowerCase().includes(query) ||
          (sub.nombre_fantasia || '').toLowerCase().includes(query) ||
          (sub.rut || '').includes(query) ||
          (sub.representante_legal || '').toLowerCase().includes(query) ||
          (sub.ejecutivo_nombre || '').toLowerCase().includes(query) ||
          (sub.comuna || '').toLowerCase().includes(query) ||
          (sub.telefono || '').includes(query) ||
          (sub.email || '').toLowerCase().includes(query)
        if (!matchesSearch) return false
      }
      const subEjecutiva = sub.ejecutivo_nombre || 'Sin asignar'
      if (selectedEjecutivas.length > 0 && !selectedEjecutivas.includes(subEjecutiva)) return false
      if (selectedCertifications.length > 0) {
        const hasCertification = selectedCertifications.some(cert => {
          if (cert === 'ariztia') return sub.ariztia
          if (cert === 'lts') return sub.lts
          if (cert === 'rendic') return sub.rendic
          if (cert === 'interpolar') return sub.interpolar
          return false
        })
        if (!hasCertification) return false
      }
      if (showActiveOnly && !sub.is_active) return false
      return true
    })
    return results.sort((a, b) => (a.nombre || a.razon_social || '').localeCompare(b.nombre || b.razon_social || '', 'es'))
  }, [searchTerm, selectedEjecutivas, selectedCertifications, showActiveOnly, subcontractors])

  const toggleEjecutiva = (ejecutiva: string) => setSelectedEjecutivas(prev => prev.includes(ejecutiva) ? prev.filter(e => e !== ejecutiva) : [...prev, ejecutiva])
  const toggleCertification = (cert: string) => setSelectedCertifications(prev => prev.includes(cert) ? prev.filter(c => c !== cert) : [...prev, cert])
  const clearAllFilters = () => {
    setSearchTerm('')
    setSelectedEjecutivas([])
    setSelectedCertifications([])
    setShowActiveOnly(false)
    setShowAdvancedFilters(false)
  }
  const hasActiveFilters = searchTerm.length > 0 || selectedEjecutivas.length > 0 || selectedCertifications.length > 0 || showActiveOnly

  const conductoresData = useMemo(() => {
    if (!selectedDetailSubcontractor?.id) return []
    const normalizeRut = (rut: string) => rut?.replace(/[.\-]/g, '').toUpperCase() || ''
    const normalizedSubRut = normalizeRut(selectedDetailSubcontractor.rut)
    return drivers.filter(d => normalizeRut(d.rut_proveedor) === normalizedSubRut && d.is_active)
  }, [selectedDetailSubcontractor?.id, selectedDetailSubcontractor?.rut, drivers])

  if (isLoading) return <div className="py-8 text-center text-[var(--cf-text-muted)]">Cargando subcontratistas...</div>

  return (
    <div className="space-y-4">
      <div className="mb-6 space-y-2">
        <h2 className="text-2xl font-semibold text-foreground">Gestión de Subcontratistas</h2>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">Visualiza, busca y filtra proveedores de transporte, cumplimiento normativo y estado tributario SII.</p>
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--cf-text-muted)]" />
          <Input placeholder="Buscar por nombre, RUT, región, ejecutiva..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="border-[var(--cf-border)] bg-[var(--cf-surface)] pl-10 text-[var(--cf-text)] placeholder:text-[var(--cf-text-muted)]" />
          {searchTerm && <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--cf-text-muted)] hover:text-[var(--cf-text-muted)]"><X className="h-4 w-4" /></button>}
        </div>
        <button onClick={() => setShowAdvancedFilters(!showAdvancedFilters)} className={`flex items-center gap-2 rounded border px-4 py-2 transition-colors ${showAdvancedFilters ? 'border-[var(--cf-accent)] bg-[var(--cf-accent)] text-[var(--cf-text)]' : 'border-[var(--cf-border)] bg-[var(--cf-surface)] text-[var(--cf-text-muted)] hover:text-[var(--cf-text-secondary)]'}`}>
          <Filter className="h-4 w-4" /> Filtros
          {hasActiveFilters && <Badge className="ml-1 bg-[var(--cf-danger-soft)] text-[var(--cf-text)]">{selectedCertifications.length + (showActiveOnly ? 1 : 0)}</Badge>}
        </button>
        {hasActiveFilters && <button onClick={clearAllFilters} className="rounded border border-[var(--cf-border)] bg-[var(--cf-surface)] px-3 py-2 text-[var(--cf-text-muted)] hover:text-[var(--cf-text-secondary)]" title="Limpiar filtros"><X className="h-4 w-4" /></button>}
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-semibold text-[var(--cf-text-secondary)]">Ejecutivas</label>
        <div className="flex flex-wrap gap-2">
          {ejecutivas.map(ejecutiva => <button key={ejecutiva} onClick={() => toggleEjecutiva(ejecutiva)} className={`rounded px-3 py-1 text-sm transition-colors ${selectedEjecutivas.includes(ejecutiva) ? 'bg-[var(--cf-accent)] text-[var(--cf-text)]' : 'bg-[var(--cf-surface)] text-[var(--cf-text-muted)] hover:text-[var(--cf-text-secondary)]'}`}>{ejecutiva}</button>)}
        </div>
      </div>

      {showAdvancedFilters && (
        <div className="space-y-4 rounded-[6px] border border-[var(--cf-border)] bg-[var(--cf-surface)] p-4">
          <div>
            <label className="mb-2 block text-sm font-semibold text-[var(--cf-text-secondary)]">Certificaciones ({selectedCertifications.length})</label>
            <div className="flex flex-wrap gap-2">
              {Object.entries(certifications).map(([key, label]) => <button key={key} onClick={() => toggleCertification(key)} className={`rounded px-3 py-1 text-sm ${selectedCertifications.includes(key) ? 'bg-[var(--cf-accent)] text-[var(--cf-text)]' : 'bg-[var(--cf-surface)] text-[var(--cf-text-muted)] hover:text-[var(--cf-text-secondary)]'}`}>{label}</button>)}
            </div>
          </div>
          <label className="flex cursor-pointer items-center gap-2"><input type="checkbox" checked={showActiveOnly} onChange={e => setShowActiveOnly(e.target.checked)} className="h-4 w-4 rounded border-[var(--cf-border)] bg-[var(--cf-surface)]" /><span className="text-sm text-[var(--cf-text-secondary)]">Solo activos</span></label>
        </div>
      )}

      <div className="text-sm text-[var(--cf-text-muted)]">Mostrando {filtered.length} de {subcontractors.length} subcontratistas</div>

      <div className="max-h-[calc(100vh-400px)] overflow-y-auto pr-2">
        <div className="grid gap-4">
          {filtered.length === 0 ? (
            <Card><CardContent className="p-8 text-center"><p className="text-[var(--cf-text-muted)]">No hay subcontratistas que coincidan con los filtros.</p></CardContent></Card>
          ) : filtered.map((sub, subIdx) => {
            const normalizeRut = (rut?: string) => rut?.trim().replace(/[.\-]/g, '').toUpperCase() || ''
            const normalizedSubRut = normalizeRut(sub.rut)
            let driverCount = sub.conductores_count ?? 0
            const subDrivers = drivers.filter(d => normalizeRut(d.rut_proveedor) === normalizedSubRut && d.is_active)
            if (driverCount === 0 && drivers.length > 0) driverCount = subDrivers.length
            const isExpanded = expandedSubcontractor === sub.id
            const completion = getCompletion(sub)
            const siiStatus = siiStatuses[sub.id]

            return (
              <Card key={sub.id} className="transition-colors hover:border-[var(--cf-text-muted)]">
                <CardContent className="p-6">
                  <div className="space-y-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="mb-1 flex items-baseline gap-3">
                          <span className="inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-[4px] bg-[var(--cf-accent)] text-sm font-semibold text-[var(--cf-text)]">{subIdx + 1}</span>
                          <h3 className="text-lg font-semibold text-[var(--cf-text)]">{sub.nombre || sub.razon_social}</h3>
                        </div>
                        {sub.nombre_fantasia && <p className="ml-9 text-sm italic text-[var(--cf-text-muted)]">{sub.nombre_fantasia}</p>}
                      </div>
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <SiiBadge value={siiStatus} />
                        {sub.is_active ? <><CheckCircle className="h-5 w-5 text-[var(--cf-success)]" /><Badge className="bg-[var(--cf-success-soft)] text-[var(--cf-success)]">Activo</Badge></> : <><AlertCircle className="h-5 w-5 text-[var(--cf-danger)]" /><Badge className="bg-[var(--cf-danger-soft)] text-[var(--cf-danger)]">Inactivo</Badge></>}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      <div className="flex items-center gap-2"><Users className="h-4 w-4 text-[var(--cf-text-muted)]" /><span className="text-sm text-[var(--cf-text-secondary)]"><span className="font-semibold text-[var(--cf-warning)]">{driverCount}</span> conductores</span></div>
                      <Badge variant="outline" className={completion.label === 'Completo' ? 'border-emerald-200/40 bg-emerald-500/10 text-emerald-200' : completion.label === 'Parcial' ? 'border-amber-200/40 bg-[var(--cf-warning-soft)] text-[var(--cf-warning)]' : 'border-rose-200/40 bg-rose-500/10 text-rose-200'}>Perfil {completion.percent}%</Badge>
                      <Badge variant="outline" className={completion.label === 'Completo' ? 'border-emerald-200/40 bg-emerald-500/10 text-emerald-200' : completion.label === 'Parcial' ? 'border-amber-200/40 bg-[var(--cf-warning-soft)] text-[var(--cf-warning)]' : 'border-rose-200/40 bg-rose-500/10 text-rose-200'}>{completion.label}</Badge>
                      <button onClick={() => { setEditingSubcontractor(sub); setIsEditModalOpen(true) }} className="ml-auto rounded p-2 text-[var(--cf-text-muted)] hover:bg-[var(--cf-surface-raised)]/60 hover:text-[var(--cf-text-secondary)]" title="Editar subcontratista"><Edit className="h-4 w-4" /></button>
                      <button onClick={() => { setAssigningSubcontractor(sub); setIsAssignModalOpen(true) }} className="rounded p-2 text-[var(--cf-text-muted)] hover:bg-[var(--cf-surface-raised)]/60 hover:text-[var(--cf-text-secondary)]" title="Asignar ejecutiva"><UserPlus className="h-4 w-4" /></button>
                      <button onClick={() => { setDetailTabToOpen('documentos'); setSelectedDetailSubcontractor(sub) }} className="rounded border border-[var(--cf-info)]/35 bg-[var(--cf-info-soft)] px-3 py-1 text-xs text-[var(--cf-info)] hover:bg-[var(--cf-info-soft)]">Documentos</button>
                      <button onClick={() => { setDetailTabToOpen('conductores'); setSelectedDetailSubcontractor(sub) }} className="rounded border border-[var(--cf-accent)]/30 bg-[var(--cf-accent)]/20 px-3 py-1 text-xs text-[var(--cf-expiring)] hover:bg-[var(--cf-accent)]/30">Ver Conductores</button>
                    </div>

                    {siiStatus?.checkedAt && (
                      <div className="rounded-[6px] border border-[var(--cf-border)]/70 bg-[var(--cf-surface)]/50 px-3 py-2 text-xs text-[var(--cf-text-muted)]">
                        Última consulta SII: <span className="text-[var(--cf-text-secondary)]">{formatCheckedAt(siiStatus.checkedAt)}</span>
                        {siiStatus.razonSocial && siiStatus.razonSocial !== (sub.razon_social || sub.nombre) && <span className="ml-3">Razón social SII: <span className="text-[var(--cf-text-secondary)]">{siiStatus.razonSocial}</span></span>}
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-3">
                      <div><p className="text-xs font-semibold text-[var(--cf-text-muted)]">RUT</p><p className="font-mono text-sm text-[var(--cf-warning)]">{sub.rut}</p></div>
                      <div><p className="text-xs font-semibold text-[var(--cf-text-muted)]">COMUNA</p><p className="text-sm text-[var(--cf-text)]">{sub.comuna || 'N/A'}</p></div>
                      <div><p className="text-xs font-semibold text-[var(--cf-text-muted)]">DIRECCIÓN</p><p className="text-sm text-[var(--cf-text)]">{sub.direccion || 'N/A'}</p></div>
                      <div><p className="text-xs font-semibold text-[var(--cf-text-muted)]">REPRESENTANTE</p><p className="text-sm text-[var(--cf-text)]">{sub.representante_legal || 'N/A'}</p></div>
                      <div><p className="text-xs font-semibold text-[var(--cf-text-muted)]">EJECUTIVA ASIGNADA</p><p className="text-sm text-[var(--cf-text)]">{sub.ejecutivo_nombre || 'Sin asignar'}</p></div>
                    </div>

                    <div className="flex flex-wrap gap-2 text-sm">
                      {sub.telefono && <a href={`tel:${sub.telefono}`} className="flex items-center gap-1 text-[var(--cf-info)] hover:text-[var(--cf-info)]"><Phone className="h-4 w-4" />{sub.telefono}</a>}
                      {(sub.correo || sub.email) && <a href={`mailto:${sub.correo || sub.email}`} className="flex items-center gap-1 text-[var(--cf-info)] hover:text-[var(--cf-info)]"><Mail className="h-4 w-4" />{sub.correo || sub.email}</a>}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {sub.ariztia && <Badge className="bg-[var(--cf-info-soft)] text-[var(--cf-info)]">Ariztia</Badge>}
                      {sub.lts && <Badge className="bg-[var(--cf-success-soft)] text-[var(--cf-success)]">LTS</Badge>}
                      {sub.rendic && <Badge className="bg-purple-500/20 text-purple-300">Rendic</Badge>}
                      {sub.interpolar && <Badge className="bg-[var(--cf-accent)]/20 text-[var(--cf-expiring)]">Interpolar</Badge>}
                    </div>

                    {isExpanded && driverCount > 0 && (
                      <div className="mt-6 space-y-2 border-t border-[var(--cf-border)] pt-4">
                        <p className="text-sm font-semibold text-[var(--cf-text-secondary)]">Conductores asociados ({driverCount}):</p>
                        <div className="grid max-h-96 gap-2 overflow-y-auto">
                          {subDrivers.map(driver => <div key={driver.id} className="rounded border border-[var(--cf-border)] bg-[var(--cf-surface)] p-3 text-sm"><div className="flex items-start justify-between gap-2"><div className="flex-1"><p className="font-semibold text-[var(--cf-text)]">{driver.nombre}</p><p className="text-xs text-[var(--cf-text-muted)]">RUT: <span className="font-mono text-[var(--cf-warning)]">{driver.rut}</span></p></div>{driver.is_active && <CheckCircle className="h-4 w-4 flex-shrink-0 text-[var(--cf-success)]" />}</div></div>)}
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>

      {selectedDetailSubcontractor && <SubcontractorDetailTabs subcontractor={selectedDetailSubcontractor} initialTab={detailTabToOpen} conductoresData={conductoresData} documentsData={documentsData || undefined} onClose={() => { setSelectedDetailSubcontractor(null); setDetailTabToOpen('resumen'); setDocumentsData(null) }} />}

      <EditSubcontractorModal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} onSuccess={() => { setIsEditModalOpen(false); if (editingSubcontractor?.id) refreshSubcontractor(editingSubcontractor.id); setEditingSubcontractor(null) }} subcontractor={editingSubcontractor || undefined} />

      <AssignExecutiveModal open={isAssignModalOpen} onOpenChange={setIsAssignModalOpen} transportistaId={assigningSubcontractor?.id || ''} transportistaNombre={assigningSubcontractor?.nombre || assigningSubcontractor?.razon_social || ''} onAssignmentSuccess={async () => { if (assigningSubcontractor?.id) await refreshSubcontractor(assigningSubcontractor.id); setAssigningSubcontractor(null) }} />
    </div>
  )
}
