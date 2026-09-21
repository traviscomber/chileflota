import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Mail, Phone, MapPin, FileText, Download, ChevronDown, Plus, X, Upload, AlertCircle, Loader, Eye, RefreshCw, ArrowRight, Edit } from 'lucide-react'
import { useDriverDocuments, type DriverDocument } from '@/hooks/use-driver-documents'
import { DocumentActionModal } from './document-action-modal'
import { EditConductorModal } from './edit-conductor-modal'

interface Driver {
  id: string
  conductor_id?: string  // UUID from conductores table
  rut: string
  nombre: string
  proveedor?: string
  patente_tracto?: string
  clase_licencia?: string
  is_active?: boolean
  rut_proveedor?: string
  ejecutivo_nombre?: string
  nombre_subcontratista?: string
}

interface DriverCardProps {
  driver: Driver
  driverNumber?: number
  expandedDocuments: Set<string>
  toggleDocuments: (id: string) => void
  getDocumentStatusColor: (estado: string) => string
  getDocumentStatusLabel: (estado: string) => string
}

export function DriverCard({
  driver,
  driverNumber,
  expandedDocuments,
  toggleDocuments,
  getDocumentStatusColor,
  getDocumentStatusLabel,
}: DriverCardProps) {
  const isExpanded = expandedDocuments.has(driver.id)
  // Log driver object to verify rut exists
  useEffect(() => {
    console.log('[v0] DriverCard mounted with driver:', { id: driver.id, rut: driver.rut, nombre: driver.nombre })
  }, [driver.id, driver.rut, driver.nombre])
  
  // Only fetch documents when card is expanded to avoid 500+ simultaneous API calls
  const { documents, loading, uploadDocument, refetch, updateDocumentStatus } = useDriverDocuments(driver.id, isExpanded, driver.rut)
  console.log('[v0] DriverCard hook returned - documents:', documents.length, 'loading:', loading, 'driver.id:', driver.id)

  const [showUploadModal, setShowUploadModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [transportistas, setTransportistas] = useState<Array<{ rut: string; nombre: string; ejecutivo_nombre?: string }>>([])
  const [loadingTransportistas, setLoadingTransportistas] = useState(false)
  const [uploadDocTypeId, setUploadDocTypeId] = useState<string>('')
  const [uploadFileName, setUploadFileName] = useState('')
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string>('')
  const [uploadingEjecutiva, setUploadingEjecutiva] = useState<string>('')
  const [ejecutivas, setEjecutivas] = useState<Array<{ id: string; full_name: string }>>([])
  const [loadingEjecutivas, setLoadingEjecutivas] = useState(false)
  const [documentTypes, setDocumentTypes] = useState<Array<{ id: string; code: string; name: string; category: string }>>([])
  const [loadingDocTypes, setLoadingDocTypes] = useState(false)
  const [selectedDocument, setSelectedDocument] = useState<string | null>(null) // Store only the ID
  const [showDocumentModal, setShowDocumentModal] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [rejectionReason, setRejectionReason] = useState<string>('')

  // Always get the fresh document from the documents array when modal opens
  const currentSelectedDocument = selectedDocument ? documents.find(d => d.id === selectedDocument) : null
  
  // Debug logging
  useEffect(() => {
    if (selectedDocument && !currentSelectedDocument) {
      console.warn('[v0] WARNING: selectedDocument ID not found in documents array!', {
        selectedDocument,
        documentsCount: documents.length,
        documentIds: documents.map(d => d.id)
      })
    }
  }, [selectedDocument, currentSelectedDocument, documents])

  useEffect(() => {
    if (showEditModal) {
      setLoadingTransportistas(true)
      fetch('/api/company/data')
        .then(res => res.json())
        .then(data => {
          setTransportistas(data.subcontractors?.map((s: any) => ({ 
            rut: s.rut, 
            nombre: s.nombre,
            ejecutivo_nombre: s.ejecutivo_nombre || s.ejecutiva || 'Sin asignar'
          })) || [])
        })
        .catch(err => console.error('[v0] Error loading transportistas:', err))
        .finally(() => setLoadingTransportistas(false))
    }
  }, [showEditModal])

  useEffect(() => {
    if (showUploadModal) {
      setLoadingEjecutivas(true)
      setLoadingDocTypes(true)
      fetch('/api/company/data')
        .then(res => res.json())
        .then(data => {
          setEjecutivas(data.executives || [])
          setDocumentTypes(data.documentTypes || [])
          // Auto-select driver's ejecutivo if available
          if (driver.ejecutivo_nombre && !uploadingEjecutiva) {
            setUploadingEjecutiva(driver.ejecutivo_nombre)
          }
          // Auto-select Licencia de Conducir Profesional by default
          if (!uploadDocTypeId && data.documentTypes && data.documentTypes.length > 0) {
            const conductorTypes = data.documentTypes.filter((dt: any) => !dt.category || dt.category === 'conductor')
            const licencia = conductorTypes.find((dt: any) => dt.code === 'LICENCIA-CONDUCIR')
            setUploadDocTypeId(licencia?.id || conductorTypes[0]?.id || data.documentTypes[0].id)
          }
        })
        .catch(err => {
          console.error('[v0] Error fetching data:', err)
        })
        .finally(() => {
          setLoadingEjecutivas(false)
          setLoadingDocTypes(false)
        })
    }
  }, [showUploadModal, uploadingEjecutiva, uploadDocTypeId, driver.ejecutivo_nombre])

  const handleUpload = async () => {
    if (!uploadFileName.trim() || !uploadFile) {
      setUploadError('Por favor selecciona un archivo')
      return
    }

    if (!uploadDocTypeId) {
      setUploadError('Por favor selecciona un tipo de documento')
      return
    }

    if (!uploadingEjecutiva) {
      setUploadError('Por favor selecciona la ejecutiva que sube el documento')
      return
    }

    setUploading(true)
    setUploadError('')
    try {
      await uploadDocument(uploadDocTypeId, uploadFileName, uploadFile, undefined, uploadingEjecutiva)
      
      // Wait a moment for React state to update
      await new Promise(resolve => setTimeout(resolve, 200))
      
      setShowUploadModal(false)
      setUploadFileName('')
      setUploadFile(null)
      setUploadDocTypeId('')
      setUploadingEjecutiva('')
      
      // Force refetch from DB to update count
      refetch()
      
      // Show success message
      if (typeof window !== 'undefined') {
        const successMsg = document.createElement('div')
        successMsg.className = 'fixed bottom-4 right-4 bg-green-600 text-[var(--cf-text)] px-6 py-3 rounded-[6px] shadow-none z-[100] animate-in'
        successMsg.textContent = `✅ Documento "${uploadFileName}" subido exitosamente`
        document.body.appendChild(successMsg)
        setTimeout(() => {
          successMsg.remove()
        }, 3000)
      }
      
      // Dispatch event to notify other components about the new document
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('documentStatusChanged'))
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Error desconocido al subir documento'
      console.error('[v0] handleUpload error:', errorMsg, error)
      setUploadError(errorMsg)
    } finally {
      setUploading(false)
    }
  }

  const statusBg = driver.is_active
    ? 'bg-green-950/40 border-green-900/50'
    : 'bg-red-950/40 border-red-900/50'
  const statusText = driver.is_active ? 'text-[var(--cf-success)]' : 'text-[var(--cf-danger)]'

  return (
    <>
      <Card className={`bg-[var(--cf-surface)]  border-[var(--cf-border)]/60 hover:border-orange-500/50  hover:shadow-orange-500/20 transition-all ${statusBg}`} key={`card-${driver.id}`}>
        <CardContent className="p-6">
          <div className="space-y-4">
            {/* Header with RUT and status */}
            <div className="mb-3 flex items-start justify-between pb-3 border-b border-[var(--cf-border)]">
          <div>
            <p className="text-xs font-semibold uppercase text-[var(--cf-text-muted)]">RUT</p>
            <p className="font-mono text-lg font-bold text-[var(--cf-expiring)]">{driver.rut}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowEditModal(true)}
              className="p-2 rounded hover:bg-[var(--cf-surface-raised)]/60 transition-colors text-[var(--cf-text-muted)] hover:text-[var(--cf-text-secondary)]"
              title="Editar conductor"
            >
              <Edit className="h-4 w-4" />
            </button>
            <Badge className={`${statusText} bg-transparent border border-current`}>
              {driver.is_active ? 'Activo' : 'Inactivo'}
            </Badge>
          </div>
            </div>

            {/* Nombre with number */}
            <div className="flex items-baseline gap-3">
              {driverNumber && (
                <span className="inline-flex items-center justify-center w-6 h-6 rounded-[4px] bg-[var(--cf-accent)] text-[var(--cf-text)] text-sm font-bold flex-shrink-0">
                  {driverNumber}
                </span>
              )}
              <p className="font-semibold text-[var(--cf-text)]">{driver.nombre}</p>
            </div>

            {/* Proveedor - Razón Social */}
            {(driver.nombre_subcontratista || driver.proveedor) && (
              <div className="text-sm">
                <p className="text-xs font-medium text-[var(--cf-text-muted)] uppercase">Subcontratista</p>
                <p className="text-[var(--cf-text-secondary)]">{driver.nombre_subcontratista || driver.proveedor}</p>
              </div>
            )}

            {/* Patente Tracto */}
            {driver.patente_tracto && (
              <div className="text-sm">
                <p className="text-xs font-medium text-[var(--cf-text-muted)] uppercase">PATENTE TRACTO</p>
                <p className="font-mono text-cyan-400">{driver.patente_tracto}</p>
              </div>
            )}

            {/* Clase de Licencia */}
            {driver.clase_licencia && (
              <div className="text-sm">
                <p className="text-xs font-medium text-[var(--cf-text-muted)] uppercase">LICENCIA</p>
                <Badge className="bg-[var(--cf-surface)] text-[var(--cf-text-secondary)] border border-[var(--cf-border)]">{driver.clase_licencia}</Badge>
              </div>
            )}

            {/* RUT Proveedor */}
            {driver.rut_proveedor && (
              <div className="border-t border-[var(--cf-border)] pt-3">
                <p className="text-xs font-semibold uppercase text-[var(--cf-text-muted)]">RUT Proveedor</p>
                <p className="font-mono text-sm text-[var(--cf-text-muted)]">{driver.rut_proveedor}</p>
              </div>
            )}

            {/* Ejecutiva Asociada */}
            {driver.ejecutivo_nombre && (
              <div className="border-t border-[var(--cf-border)] pt-3">
                <p className="text-xs font-semibold uppercase text-[var(--cf-text-muted)]">Ejecutiva Asignada</p>
                <Badge className="bg-purple-600/40 text-purple-200 border border-purple-500/50">{driver.ejecutivo_nombre}</Badge>
              </div>
            )}

            {/* Documentos Subidos - Sección Expandible SIEMPRE VISIBLE */}
            <div className="border-t border-[var(--cf-border)] pt-3 mt-3">
              <div className="flex items-center justify-between mb-3">
                <div
                  onClick={() => toggleDocuments(driver.id)}
                  className="flex flex-1 items-center justify-between hover:opacity-90 transition-opacity cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-cyan-400" />
                    <span className="text-sm font-semibold text-[var(--cf-text)]">
                      Documentos ({documents.length})
                    </span>
                    <button
                      onClick={async (e) => {
                        e.stopPropagation()
                        console.log('[v0] Refresh button clicked')
                        setIsRefreshing(true)
                        try {
                          console.log('[v0] Calling refetch()...')
                          await refetch()
                          console.log('[v0] Documents refreshed successfully')
                        } catch (error) {
                          console.error('[v0] Error refreshing documents:', error)
                        } finally {
                          setIsRefreshing(false)
                        }
                      }}
                      disabled={isRefreshing}
                      className="ml-1 p-1 rounded hover:bg-[var(--cf-surface-raised)]/60 transition-colors disabled:opacity-50"
                      title="Refrescar documentos"
                    >
                      <RefreshCw className={`h-3 w-3 text-[var(--cf-text-muted)] hover:text-[var(--cf-text-secondary)] ${isRefreshing ? 'animate-spin' : ''}`} />
                    </button>
                    <Link
                      href={`/dashboard/company/documentos/${driver.conductor_id || driver.id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="ml-2 p-1 rounded hover:bg-[var(--cf-surface-raised)]/60 transition-colors inline-flex items-center gap-1"
                      title="Ver todos los documentos"
                    >
                      <ArrowRight className="h-3 w-3 text-[var(--cf-text-muted)] hover:text-[var(--cf-text-secondary)]" />
                    </Link>
                  </div>
                  <ChevronDown 
                    className={`h-4 w-4 text-[var(--cf-text-muted)] transition-transform ${
                      isExpanded ? 'rotate-180' : ''
                    }`}
                  />
                </div>
                
                {/* Botón de upload para LABBE */}
                <button
                  onClick={() => setShowUploadModal(true)}
                  className="ml-2 p-2 rounded bg-blue-600 hover:bg-blue-700 transition-colors flex items-center gap-1 text-xs text-[var(--cf-text)]"
                  title="Subir documento"
                >
                  <Plus className="h-3 w-3" />
                  <span>Subir</span>
                </button>
              </div>

              {/* Documentos expandibles */}
              {isExpanded && (
                <div className="space-y-2">
                  {loading ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader className="h-4 w-4 animate-spin text-[var(--cf-text-muted)]" />
                      <span className="ml-2 text-xs text-[var(--cf-text-muted)]">
                        Cargando...
                      </span>
                    </div>
                  ) : documents.length > 0 ? (
                    <>
                      {/* Banner for rejected documents */}
                      {documents.some(d => d.estado === 'rechazado') && (
                        <div className="rounded bg-[var(--cf-danger-soft)] border border-[var(--cf-danger)]/35 p-3 text-xs text-[var(--cf-danger)]">
                          <p className="font-semibold flex items-center gap-2">
                            <AlertCircle className="h-4 w-4" />
                            Documentos Rechazados
                          </p>
                          <p className="text-xs text-[var(--cf-danger)]/80 mt-1">
                            Por favor, vuelve a subir los documentos marcados como rechazados
                          </p>
                        </div>
                      )}
                      {documents.map((doc) => (
                        <div
                          key={doc.id}
                          className={`flex items-center justify-between rounded bg-[var(--cf-surface)] p-2 text-xs hover:bg-[var(--cf-surface)] transition-colors cursor-pointer ${
                            doc.estado === 'rechazado' ? 'opacity-60' : ''
                          }`}
                          onClick={() => {
                            // Refetch documents to get any newly uploaded files
                            refetch()
                            setSelectedDocument(doc.id)
                            setShowDocumentModal(true)
                          }}
                        >
                          <div className="flex flex-1 items-center gap-2 min-w-0">
                          <FileText className="h-3 w-3 text-[var(--cf-text-muted)] flex-shrink-0" />
                          <div className="min-w-0 flex-1">
                            <p className={`font-medium truncate ${
                              doc.estado === 'rechazado' 
                                ? 'text-[var(--cf-danger)] line-through' 
                                : 'text-[var(--cf-text-secondary)]'
                            }`}>
                              {doc.tipo}
                            </p>
                            <p className={`truncate text-xs ${
                              doc.estado === 'rechazado' 
                                ? 'text-[var(--cf-danger)]/70 line-through' 
                                : 'text-[var(--cf-text-muted)]'
                            }`}>
                              {doc.nombre}
                            </p>
                            <p className={`text-xs ${
                              doc.estado === 'rechazado' 
                                ? 'text-[var(--cf-danger)]' 
                                : 'text-[var(--cf-text-muted)]'
                            }`}>
                              {new Date(doc.fecha_subida).toLocaleDateString('es-ES')}
                              {doc.uploaded_by && ` por ${doc.uploaded_by}`}
                              {doc.estado === 'rechazado' && ' - RECHAZADO'}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                          <Badge 
                            className={`text-xs cursor-pointer hover:opacity-90 transition-opacity ${getDocumentStatusColor(doc.estado)}`}
                            onClick={(e) => {
                              e.stopPropagation()
                              // Refetch documents to get any newly uploaded files
                              refetch()
                              setSelectedDocument(doc.id)
                              setShowDocumentModal(true)
                            }}
                          >
                            {getDocumentStatusLabel(doc.estado)}
                          </Badge>
                          <button 
                            className="p-1 hover:bg-[var(--cf-surface-raised)]/60 rounded transition-colors"
                            onClick={(e) => {
                              e.stopPropagation()
                              // Refetch documents to get any newly uploaded files
                              refetch()
                              setSelectedDocument(doc.id)
                              setShowDocumentModal(true)
                            }}
                          >
                            <Eye className="h-3 w-3 text-[var(--cf-text-muted)] hover:text-[var(--cf-text-secondary)]" />
                          </button>
                        </div>
                        </div>
                      ))}
                    </>
                  ) : (
                    <div className="text-center py-4 text-[var(--cf-text-muted)]">
                      <p className="text-xs">No hay documentos subidos</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Upload Document Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="relative w-full max-w-md rounded-[6px] border border-[var(--cf-border)] bg-[var(--cf-surface)]/95  p-6 shadow-none">
            <button
              onClick={() => setShowUploadModal(false)}
              className="absolute right-4 top-4 text-[var(--cf-text-muted)] hover:text-[var(--cf-text-secondary)] transition-colors"
            >
              <X className="h-5 w-5" />
            </button>

            <h2 className="mb-4 text-lg font-semibold text-[var(--cf-text)]">Subir Documento</h2>

            {/* Conductor Info */}
            <div className="mb-4 rounded bg-[var(--cf-surface)]/60 border border-[var(--cf-border)] p-3 text-sm">
              <p className="text-[var(--cf-text-muted)] text-xs uppercase font-medium">Conductor:</p>
              <p className="font-semibold text-[var(--cf-text)]">{driver.nombre}</p>
              <p className="text-xs text-[var(--cf-text-muted)]">{driver.rut}</p>
            </div>

            <div className="space-y-4">
              {/* Ejecutiva que sube el documento */}
              <div>
                <label className="text-sm font-semibold text-[var(--cf-text-secondary)]">Ejecutiva que sube el documento</label>
                <div className="space-y-2 mt-2">
                  {/* Auto-selected option using driver's ejecutivo */}
                  {driver.ejecutivo_nombre && (
                    <button
                      type="button"
                      onClick={() => setUploadingEjecutiva(driver.ejecutivo_nombre!)}
                      className={`w-full rounded border px-3 py-2 text-sm text-left transition-colors ${
                        uploadingEjecutiva === driver.ejecutivo_nombre
                          ? 'border-orange-500 bg-[var(--cf-accent)]/20 text-[var(--cf-expiring)]'
                          : 'border-[var(--cf-border)] bg-[var(--cf-surface-raised)] text-[var(--cf-text-secondary)] hover:bg-[var(--cf-surface-raised)]'
                      }`}
                    >
                      ✓ {driver.ejecutivo_nombre} <span className="text-xs text-[var(--cf-text-muted)]">(Asignada)</span>
                    </button>
                  )}
                  
                  {/* Full ejecutivas list selector */}
                  <select
                    value={uploadingEjecutiva}
                    onChange={(e) => setUploadingEjecutiva(e.target.value)}
                    disabled={loadingEjecutivas}
                    className="w-full rounded border border-[var(--cf-border)] bg-[var(--cf-surface)] px-3 py-2 text-sm text-[var(--cf-text)] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <option value="">
                      {loadingEjecutivas ? 'Cargando ejecutivas...' : 'O selecciona otra ejecutiva'}
                    </option>
                    {ejecutivas.map((exec) => (
                      <option key={exec.id} value={exec.full_name}>
                        {exec.full_name}
                      </option>
                    ))}
                  </select>
                </div>
                {ejecutivas.length === 0 && !loadingEjecutivas && !driver.ejecutivo_nombre && (
                  <p className="text-xs text-[var(--cf-danger)] mt-1">⚠️ No hay ejecutivas disponibles</p>
                )}
              </div>

              {/* Tipo de Documento */}
              <div>
                <label className="text-sm font-semibold text-[var(--cf-text-secondary)]">Tipo de Documento</label>
                <select
                  value={uploadDocTypeId}
                  onChange={(e) => setUploadDocTypeId(e.target.value)}
                  disabled={loadingDocTypes || documentTypes.length === 0}
                  className="mt-2 w-full rounded border border-[var(--cf-border)] bg-[var(--cf-surface)] px-3 py-2 text-sm text-[var(--cf-text)] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <option value="">
                    {loadingDocTypes ? 'Cargando tipos de documento...' : 'Selecciona un tipo de documento'}
                  </option>
                  {documentTypes
                    .filter((dt) => !dt.category || dt.category === 'conductor')
                    .map((docType) => (
                      <option key={docType.id} value={docType.id}>
                        {docType.name}
                      </option>
                    ))}
                </select>
                {documentTypes.length === 0 && !loadingDocTypes && (
                  <p className="text-xs text-[var(--cf-danger)] mt-1">⚠️ No hay tipos de documento disponibles</p>
                )}
              </div>

              {/* Nombre del archivo */}
              <div>
                <label className="text-sm font-semibold text-[var(--cf-text-secondary)]">Nombre del Archivo</label>
                <input
                  type="text"
                  value={uploadFileName}
                  onChange={(e) => setUploadFileName(e.target.value)}
                  placeholder="ej: Licencia_2024.pdf"
                  className="mt-2 w-full rounded border border-[var(--cf-border)] bg-[var(--cf-surface)] px-3 py-2 text-sm text-[var(--cf-text)] placeholder-slate-500 focus:border-orange-500 focus:outline-none transition-colors"
                />
              </div>

              {/* File Upload Area */}
              <div 
                className="rounded border-2 border-dashed border-[var(--cf-border)] p-4 text-center cursor-pointer hover:border-orange-500/50 hover:bg-[var(--cf-surface)] transition-all"
                onDragOver={(e) => {
                  e.preventDefault()
                  e.currentTarget.classList.add('border-orange-500', 'bg-[var(--cf-accent)]/10')
                }}
                onDragLeave={(e) => {
                  e.currentTarget.classList.remove('border-orange-500', 'bg-[var(--cf-accent)]/10')
                }}
                onDrop={(e) => {
                  e.preventDefault()
                  e.currentTarget.classList.remove('border-orange-500', 'bg-[var(--cf-accent)]/10')
                  if (e.dataTransfer.files?.[0]) {
                    const file = e.dataTransfer.files[0]
                    setUploadFileName(file.name)
                    setUploadFile(file)
                  }
                }}
                onClick={() => {
                  const input = document.getElementById(`file-input-${driver.rut}`) as HTMLInputElement
                  input?.click()
                }}
              >
                <Upload className="mx-auto h-8 w-8 text-[var(--cf-text-muted)] mb-2" />
                <p className="text-sm text-[var(--cf-text-muted)]">Arrastra aquí o haz click para seleccionar archivo</p>
                <input
                  id={`file-input-${driver.rut}`}
                  type="file"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files?.[0]) {
                      const file = e.target.files[0]
                      setUploadFileName(file.name)
                      setUploadFile(file)
                    }
                  }}
                />
              </div>

              {/* Error Alert */}
              {uploadError && (
                <div className="rounded bg-red-950/40 border border-red-900/50 p-3 text-sm text-[var(--cf-danger)] flex gap-2 items-start">
                  <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">Error:</p>
                    <p>{uploadError}</p>
                  </div>
                </div>
              )}

              {/* Botones */}
              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setShowUploadModal(false)}
                  disabled={uploading}
                  className="flex-1 rounded border border-[var(--cf-border)] bg-[var(--cf-surface)] py-2 text-sm font-semibold text-[var(--cf-text-secondary)] hover:bg-[var(--cf-surface)] hover:border-[var(--cf-border)] transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleUpload}
                  disabled={!uploadFileName.trim() || uploading}
                  className="flex-1 rounded bg-[var(--cf-accent)] py-2 text-sm font-semibold text-[var(--cf-text)] hover:bg-[var(--cf-accent-hover)] transition-colors disabled:bg-[var(--cf-surface-raised)] disabled:text-[var(--cf-text-muted)] disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-none hover:shadow-orange-500/20"
                >
                  {uploading && <Loader className="h-4 w-4 animate-spin" />}
                  {uploading ? 'Subiendo...' : 'Subir Documento'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Document Action Modal */}
      <DocumentActionModal
        document={currentSelectedDocument ?? null}
        isOpen={showDocumentModal}
        isAdmin={true}
        onClose={() => {
          setShowDocumentModal(false)
          setSelectedDocument(null)
          setRejectionReason('')
        }}
        onSetRejectionReason={(reason) => setRejectionReason(reason)}
        onStatusChange={async (docId, newStatus, reason) => {
          try {
            // Update document status in database
            await updateDocumentStatus(docId, newStatus, reason || (newStatus === 'rechazado' ? rejectionReason : undefined))
            setRejectionReason('')
            
            // Show success message immediately
            if (typeof window !== 'undefined') {
              const msg = document.createElement('div')
              msg.className = 'fixed bottom-4 right-4 bg-green-600 text-[var(--cf-text)] px-6 py-3 rounded-[6px] shadow-none z-[100]'
              msg.textContent = `✅ Documento actualizado a ${newStatus}`
              document.body.appendChild(msg)
              setTimeout(() => msg.remove(), 3000)
            }
            
            // Wait for database to persist before refetching
            await new Promise(resolve => setTimeout(resolve, 500))
            
            // Refetch to get fresh data from database
            await refetch()
            
            // Close modal AFTER refetch completes
            setShowDocumentModal(false)
            setSelectedDocument(null)
          } catch (error) {
            console.error('[v0] Error updating status:', error)
            alert(`Error: ${error instanceof Error ? error.message : 'Desconocido'}`)
          }
        }}
        onDelete={async (docId) => {
          await refetch()
          setShowDocumentModal(false)
          setSelectedDocument(null)
        }}
      />

      <EditConductorModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        onSuccess={() => {
          refetch()
          window.dispatchEvent(new Event('conductorUpdated'))
        }}
        driver={{
          id: driver.conductor_id || driver.id,
          rut: driver.rut,
          nombres: driver.nombre,
          apellido_paterno: driver.nombre?.split(' ')[1],
          apellido_materno: '',
          rut_proveedor: driver.rut_proveedor,
          clase_licencia: driver.clase_licencia,
          is_active: driver.is_active,
          nombre_subcontratista: driver.nombre_subcontratista
        }}
        transportistas={transportistas}
      />
    </>
  )
}
