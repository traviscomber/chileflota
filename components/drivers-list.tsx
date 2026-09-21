/**
 * GESTIÓN DE CONDUCTORES
 * 
 * Panel para visualizar y gestionar todos los conductores de tu flota.
 * Aquí puedes:
 * - Buscar conductores por RUT, nombre, proveedor o patente
 * - Ver estado de cumplimiento (activo/inactivo)
 * - Monitorear clase de licencia vigente
 * - Acceder a información de contacto
 * - Identificar conductores en riesgo o bloqueados
 * 
 * ¿Qué es un Conductor? Es la persona responsable de operar vehículos.
 * Cada conductor tiene documentos (licencia, antecedentes) que monitorear.
 */

'use client'

import { useState, useMemo, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Search, X, Filter } from 'lucide-react'
import { DriverCard } from './driver-card'

interface Driver {
  id: string
  rut: string
  nombre: string
  nombres?: string
  apellido_paterno?: string
  apellido_materno?: string
  proveedor?: string
  rut_proveedor?: string
  patente_tracto?: string
  clase_licencia?: string
  is_active?: boolean
  ejecutivo_nombre?: string
  nombre_subcontratista?: string
  documentos?: Array<{
    id: string
    tipo: string
    nombre: string
    fecha_subida: string
    estado: 'pendiente' | 'aprobado' | 'rechazado'
  }>
}

interface DriversListProps {
  drivers: Driver[]
  highlightedRut?: string | null
}

export function DriversList({ drivers, highlightedRut }: DriversListProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null)
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)
  const [selectedProviders, setSelectedProviders] = useState<string[]>([])
  const [selectedStatus, setSelectedStatus] = useState<'all' | 'active' | 'inactive'>('all')
  const [expandedDocuments, setExpandedDocuments] = useState<Set<string>>(new Set())

  // Auto-search and expand when RUT is provided from query param
  useEffect(() => {
    if (highlightedRut) {
      setSearchTerm(highlightedRut)
      // Find and expand the matching driver
      const matchingDriver = drivers.find(d => d.rut?.replace(/\./g, '') === highlightedRut)
      if (matchingDriver) {
        setSelectedDriver(matchingDriver)
        setExpandedDocuments(new Set([matchingDriver.id]))
      }
    }
  }, [highlightedRut, drivers])

  const filteredDrivers = useMemo(() => {
    const filtered = drivers.filter(driver => {
      const searchLower = searchTerm.toLowerCase()
      
      // Filtro de búsqueda - buscar en todos los campos sin null check inicial
      const matchesSearch = !searchTerm || 
        (driver.rut && driver.rut.toLowerCase().includes(searchLower)) ||
        (driver.nombre && driver.nombre.toLowerCase().includes(searchLower)) ||
        (driver.proveedor && driver.proveedor.toLowerCase().includes(searchLower)) ||
        (driver.rut_proveedor && driver.rut_proveedor.toLowerCase().includes(searchLower)) ||
        (driver.patente_tracto && driver.patente_tracto.toLowerCase().includes(searchLower))
      
      // Filtro por proveedor/subcontratista
      const matchesProvider = 
        selectedProviders.length === 0 || 
        (driver.proveedor && selectedProviders.includes(driver.proveedor))
      
      // Filtro por estado
      const matchesStatus = 
        selectedStatus === 'all' ||
        (selectedStatus === 'active' && driver.is_active) ||
        (selectedStatus === 'inactive' && !driver.is_active)
      
      return matchesSearch && matchesProvider && matchesStatus
    })

    // Sort alphabetically by nombre
    return filtered.sort((a, b) => {
      const nameA = (a.nombre || '').toLowerCase()
      const nameB = (b.nombre || '').toLowerCase()
      return nameA.localeCompare(nameB)
    })
  }, [drivers, searchTerm, selectedProviders, selectedStatus])

  // Obtener lista única de proveedores
  const providers = useMemo(() => {
    const uniqueProviders = new Set(drivers.map(d => d.proveedor).filter(Boolean))
    return Array.from(uniqueProviders).sort()
  }, [drivers])

  // Funciones para manejar filtros
  const toggleProvider = (provider: string) => {
    setSelectedProviders(prev =>
      prev.includes(provider)
        ? prev.filter(p => p !== provider)
        : [...prev, provider]
    )
  }

  const resetFilters = () => {
    setSearchTerm('')
    setSelectedProviders([])
    setSelectedStatus('all')
    setShowAdvancedFilters(false)
  }

  // Funciones para manejar documentos expandibles
  const toggleDocuments = (driverId: string) => {
    const newExpanded = new Set(expandedDocuments)
    if (newExpanded.has(driverId)) {
      newExpanded.delete(driverId)
    } else {
      newExpanded.add(driverId)
    }
    setExpandedDocuments(newExpanded)
  }

  const getDocumentStatusColor = (estado: string) => {
    switch (estado) {
      case 'aprobado':
        return 'bg-green-600 text-[var(--cf-text)]'
      case 'rechazado':
        return 'bg-[var(--cf-danger-soft)] text-[var(--cf-text)]'
      case 'pendiente':
        return 'bg-yellow-600 text-[var(--cf-text)]'
      case 'vencido':
        return 'bg-[var(--cf-accent)] text-[var(--cf-text)]'
      default:
        return 'bg-slate-600 text-[var(--cf-text)]'
    }
  }

  const getDocumentStatusLabel = (estado: string) => {
    switch (estado) {
      case 'aprobado':
        return 'Aprobado'
      case 'rechazado':
        return 'Rechazado'
      case 'pendiente':
        return 'Pendiente'
      case 'vencido':
        return 'Vencido'
      default:
        return estado
    }
  }

  return (
    <div className="w-full space-y-4">
      {/* Header Educativo */}
      <div className="space-y-3 mb-6">
        <h2 className="text-2xl font-bold text-[var(--cf-text)]">Gestión de Conductores</h2>
        <p className="text-sm text-[var(--cf-text-muted)] max-w-2xl leading-relaxed">
          Monitorea licencias vigentes, estado de cumplimiento y actualización de documentos. Identifica conductores listos para operar o que necesitan atención inmediata.
        </p>
      </div>

      {/* Estadísticas Rápidas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="bg-[var(--cf-surface)]/50 border-slate-800">
          <CardContent className="p-3">
            <div className="text-2xl font-bold text-[var(--cf-text)]">{drivers.length}</div>
            <p className="text-xs text-[var(--cf-text-muted)]">Total de Conductores</p>
          </CardContent>
        </Card>
        <Card className="bg-[var(--cf-success-soft)] border-green-800">
          <CardContent className="p-3">
            <div className="text-2xl font-bold text-[var(--cf-success)]">{drivers.filter(d => d.is_active).length}</div>
            <p className="text-xs text-[var(--cf-success)]">Activos</p>
          </CardContent>
        </Card>
        <Card className="bg-[var(--cf-danger-soft)] border-red-800">
          <CardContent className="p-3">
            <div className="text-2xl font-bold text-[var(--cf-danger)]">{drivers.filter(d => !d.is_active).length}</div>
            <p className="text-xs text-[var(--cf-danger)]">Inactivos</p>
          </CardContent>
        </Card>
        <Card className="bg-[var(--cf-surface)]/50 border-slate-800">
          <CardContent className="p-3">
            <div className="text-2xl font-bold text-[var(--cf-text)]">{filteredDrivers.length}</div>
            <p className="text-xs text-[var(--cf-text-muted)]">Resultados de búsqueda</p>
          </CardContent>
        </Card>
      </div>

      {/* Header with search and filters button */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <h3 className="text-lg font-semibold text-[var(--cf-text)]">Buscar Conductores</h3>
          <div className="flex gap-2">
            <div className="relative flex-1 md:max-w-xs">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--cf-text-muted)]" />
              <Input
                placeholder="Buscar por RUT, nombre, proveedor o patente..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--cf-text-muted)] hover:text-[var(--cf-text-muted)]"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <Button
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              variant={showAdvancedFilters ? 'default' : 'outline'}
              className="gap-2"
            >
              <Filter className="h-4 w-4" />
              Filtros
              {(selectedProviders.length > 0 || selectedStatus !== 'all') && (
                <Badge className="ml-1 bg-[var(--cf-accent)] text-[var(--cf-text)]">{selectedProviders.length + (selectedStatus !== 'all' ? 1 : 0)}</Badge>
              )}
            </Button>
          </div>
        </div>

        {/* Advanced Filters con Tooltips */}
        {showAdvancedFilters && (
          <div className="space-y-3 p-4 bg-[var(--cf-surface)] rounded-[6px] border border-slate-800">
            {/* Status Filter */}
            <div>
              <label className="text-sm font-semibold text-[var(--cf-text-secondary)]">Estado</label>
              <div className="flex flex-wrap gap-2 mt-2">
                {[
                  { value: 'all', label: 'Todos' },
                  { value: 'active', label: 'Activos' },
                  { value: 'inactive', label: 'Inactivos' }
                ].map(status => (
                  <button
                    key={status.value}
                    onClick={() => setSelectedStatus(status.value as 'all' | 'active' | 'inactive')}
                    className={`px-3 py-1 rounded text-sm transition-colors ${
                      selectedStatus === status.value
                        ? 'bg-[var(--cf-accent)] text-[var(--cf-text)]'
                        : 'bg-[var(--cf-surface)] text-[var(--cf-text-muted)] hover:text-[var(--cf-text-secondary)]'
                    }`}
                  >
                    {status.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Providers Filter */}
            {providers.length > 0 && (
              <div>
                <label className="text-sm font-semibold text-[var(--cf-text-secondary)]">Proveedor/Subcontratista ({selectedProviders.length})</label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {providers.filter((p): p is string => Boolean(p)).map((provider) => (
                    <button
                      key={provider}
                      onClick={() => toggleProvider(provider)}
                      className={`px-3 py-1 rounded text-sm transition-colors ${
                        selectedProviders.includes(provider)
                          ? 'bg-[var(--cf-accent)] text-[var(--cf-text)]'
                          : 'bg-[var(--cf-surface)] text-[var(--cf-text-muted)] hover:text-[var(--cf-text-secondary)]'
                      }`}
                    >
                      {provider}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Reset Filters Button */}
            {(selectedProviders.length > 0 || selectedStatus !== 'all' || searchTerm) && (
              <Button
                onClick={resetFilters}
                variant="outline"
                size="sm"
                className="w-full"
              >
                Limpiar Filtros
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Drivers Grid with scrollable container */}
      {filteredDrivers.length > 0 ? (
        <div className="max-h-[calc(100vh-400px)] overflow-y-auto pr-2">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredDrivers.map((driver, driverIdx) => (
              <DriverCard
                key={driver.id}
                driver={driver}
                driverNumber={driverIdx + 1}
                expandedDocuments={expandedDocuments}
                toggleDocuments={toggleDocuments}
                getDocumentStatusColor={getDocumentStatusColor}
                getDocumentStatusLabel={getDocumentStatusLabel}
              />
            ))}
          </div>
        </div>
      ) : (
        <Card className="border-[var(--cf-border)]">
          <CardContent className="p-8 text-center">
            <p className="text-[var(--cf-text-muted)]">No se encontraron conductores</p>
          </CardContent>
        </Card>
      )}

      {/* Driver Detail Modal */}
      {selectedDriver && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="relative max-h-[90vh] w-full max-w-md overflow-y-auto rounded-[6px] border border-[var(--cf-border)] bg-[var(--cf-surface)] p-6 shadow-none">
            <button
              onClick={() => setSelectedDriver(null)}
              className="absolute right-4 top-4 text-[var(--cf-text-muted)] hover:text-[var(--cf-text)]"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="space-y-4">
              <div>
                <h3 className="text-2xl font-bold text-[var(--cf-text)]">{selectedDriver.nombre}</h3>
                <p className="font-mono text-sm text-[var(--cf-warning)]">{selectedDriver.rut}</p>
              </div>

              <div className="space-y-3 border-t border-[var(--cf-border)] pt-4">
                {selectedDriver.nombres && (
                  <div>
                    <p className="text-xs font-semibold uppercase text-[var(--cf-text-muted)]">Nombres</p>
                    <p className="text-[var(--cf-text)]">{selectedDriver.nombres}</p>
                  </div>
                )}

                {selectedDriver.apellido_paterno && (
                  <div>
                    <p className="text-xs font-semibold uppercase text-[var(--cf-text-muted)]">Apellido Paterno</p>
                    <p className="text-[var(--cf-text)]">{selectedDriver.apellido_paterno}</p>
                  </div>
                )}

                {selectedDriver.apellido_materno && (
                  <div>
                    <p className="text-xs font-semibold uppercase text-[var(--cf-text-muted)]">Apellido Materno</p>
                    <p className="text-[var(--cf-text)]">{selectedDriver.apellido_materno}</p>
                  </div>
                )}

                {selectedDriver.proveedor && (
                  <div>
                    <p className="text-xs font-semibold uppercase text-[var(--cf-text-muted)]">Proveedor</p>
                    <p className="text-[var(--cf-text)]">{selectedDriver.proveedor}</p>
                  </div>
                )}

                {selectedDriver.rut_proveedor && (
                  <div>
                    <p className="text-xs font-semibold uppercase text-[var(--cf-text-muted)]">RUT Proveedor</p>
                    <p className="font-mono text-[var(--cf-text-secondary)]">{selectedDriver.rut_proveedor}</p>
                  </div>
                )}

                {selectedDriver.patente_tracto && (
                  <div>
                    <p className="text-xs font-semibold uppercase text-[var(--cf-text-muted)]">Patente Tracto</p>
                    <p className="font-mono text-lg font-bold text-[var(--cf-info)]">
                      {selectedDriver.patente_tracto}
                    </p>
                  </div>
                )}

                {selectedDriver.clase_licencia && (
                  <div>
                    <p className="text-xs font-semibold uppercase text-[var(--cf-text-muted)]">Clase Licencia</p>
                    <p className="text-[var(--cf-text)]">{selectedDriver.clase_licencia}</p>
                  </div>
                )}

                <div className="flex items-center gap-2 border-t border-[var(--cf-border)] pt-4">
                  {selectedDriver.is_active ? (
                    <Badge className="bg-emerald-500/20 text-emerald-300">Activo</Badge>
                  ) : (
                    <Badge className="bg-[var(--cf-danger-soft)] text-[var(--cf-danger)]">Inactivo</Badge>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
