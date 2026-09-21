'use client'

import { useState, useEffect, useMemo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { XCircle, FileText, User, Building2, AlertTriangle, Eye, Download } from 'lucide-react'
import { useDocumentSync } from '@/contexts/document-sync-context'
import { getChileDate, getChileTime } from '@/lib/timezone-utils'
import { getDocTypeIcon } from '@/lib/document-type-icons'
import { PDFViewer } from '@/components/pdf-viewer'
import { DocumentFilter, type DocumentFilters } from '@/components/document-filter'
import { ALL_VALUE, filterByMonthYear } from '@/lib/date-filters'
import { buildDocumentAccessUrl } from '@/lib/document-file-access'
import { getDocumentPeriodDate, getDocumentPeriodLabel, getDocumentWorkflowDate } from '@/lib/document-period'

interface RejectedDocument {
  id: string
  original_filename?: string
  document_name?: string
  validation_status?: string
  status?: string
  file_url?: string
  rejection_reason?: string
  document_type_id?: string
  created_at: string
  updated_at?: string
  reviewed_at?: string
  validated_at?: string
  uploaded_at?: string
  document_period_month?: number | string | null
  document_period_year?: number | string | null
  document_period_start?: string | null
  ejecutiva?: string
  approved_at?: string
  reviewed_by_ejecutiva?: string
  docType?: { code: string; nombre: string }
  conductores?: { id: string; nombres: string; apellido_paterno: string; rut: string }
  transportistas?: { id: string; razon_social: string; rut: string }
}

interface Props {
  conductorDocs: RejectedDocument[]
  subDocs: RejectedDocument[]
}

export function RejectedDocumentsList({ conductorDocs: initialConductorDocs, subDocs: initialSubDocs }: Props) {
  const [conductorDocs, setConductorDocs] = useState(initialConductorDocs)
  const [subDocs, setSubDocs] = useState(initialSubDocs)
  const [previewDoc, setPreviewDoc] = useState<RejectedDocument | null>(null)
  const [filters, setFilters] = useState<DocumentFilters>({
    searchQuery: '',
    month: ALL_VALUE,
    year: ALL_VALUE,
  })
  const { onSync } = useDocumentSync()

  useEffect(() => {
    const unsubscribe = onSync((event) => {
      if (event.type === 'document_status_changed') {
        const refetch = async () => {
          try {
            const response = await fetch('/api/company/documents/rechazados')
            if (response.ok) {
              const data = await response.json()
              setConductorDocs(data.conductorDocs || [])
              setSubDocs(data.subDocs || [])
            }
          } catch (error) {
            console.error('[v0] Error refetching rejected docs:', error)
          }
        }
        refetch()
      }
    })
    return unsubscribe
  }, [onSync])

  const allDocs = [...conductorDocs, ...subDocs].sort((a, b) => {
    try {
      const dateB = new Date(getDocumentWorkflowDate(b) || 0).getTime()
      const dateA = new Date(getDocumentWorkflowDate(a) || 0).getTime()
      return dateB - dateA
    } catch (e) {
      console.error('[v0] Error sorting docs:', e, 'docA:', (a as any).document_name || a.original_filename, 'docB:', (b as any).document_name || b.original_filename)
      return 0
    }
  })

  const getExecutive = (doc: RejectedDocument) => {
    return doc.ejecutiva || doc.reviewed_by_ejecutiva || 'No especificado'
  }

  const getDocumentTypeValue = (doc: RejectedDocument) =>
    doc.docType?.code || doc.document_type_id || doc.docType?.nombre || 'Sin tipo'

  const getDocumentTypeLabel = (doc: RejectedDocument) =>
    doc.docType?.nombre || doc.docType?.code || 'Sin tipo'

  const getDocumentTypeChipClass = (doc: RejectedDocument) => {
    const iconConfig = getDocTypeIcon(doc.docType)
    return `${iconConfig.bg} ${iconConfig.border} ${iconConfig.color} border shadow-none `
  }
  const metaChipClass = 'whitespace-nowrap flex items-center gap-1.5 rounded-[4px] px-3 py-1 text-[11px] font-semibold tracking-[0.14em] border border-[var(--cf-border)] bg-[var(--cf-canvas)] text-[var(--cf-text)] shadow-none '

  const getDocumentPeriod = (doc: RejectedDocument) => {
    return getDocumentPeriodLabel(doc)
  }

  const getRejectionDate = (doc: RejectedDocument) => {
    const dateStr = doc.updated_at || doc.reviewed_at || doc.created_at
    return getChileDate(dateStr)
  }

  const getRejectionTime = (doc: RejectedDocument) => {
    const dateStr = doc.validated_at || doc.approved_at || doc.updated_at || doc.reviewed_at || doc.created_at
    return getChileTime(dateStr)
  }

  // Get unique executives and companies for filter options
  const executives = useMemo(() => {
    const execs = new Map<string, string>()
    allDocs.forEach((doc) => {
      const exec = getExecutive(doc)
      if (exec && exec !== 'No especificado') {
        execs.set(exec, exec)
      }
    })
    return Array.from(execs).map(([id, nombre]) => ({ id, nombre }))
  }, [allDocs])

  const documentTypes = useMemo(() => {
    const types = new Map<string, string>()
    allDocs.forEach((doc) => {
      const value = getDocumentTypeValue(doc)
      const label = getDocumentTypeLabel(doc)
      if (value && value !== 'Sin tipo' && !types.has(value)) {
        types.set(value, label)
      }
    })
    return Array.from(types.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label))
  }, [allDocs])

  const companies = useMemo(() => {
    const comps = new Map<string, { nombre: string; rut: string }>()
    allDocs.forEach((doc) => {
      try {
        if (doc.transportistas) {
          const comp = Array.isArray(doc.transportistas) ? doc.transportistas[0] : doc.transportistas
          if (comp && comp.razon_social) {
            comps.set(comp.id || comp.rut, { nombre: comp.razon_social, rut: comp.rut || '' })
          }
        }
        // For subcontractor docs, try to get company from subcontractor_rut
        if ((doc as any).subcontractor_rut && !doc.transportistas) {
          comps.set((doc as any).subcontractor_rut, { nombre: 'Empresa', rut: (doc as any).subcontractor_rut })
        }
      } catch (e) {
        console.log('[v0] Error extracting company:', e)
      }
    })
    return Array.from(comps).map(([id, data]) => ({ id, ...data }))
  }, [allDocs])

  // Filter documents based on filter criteria
  const filteredDocs = useMemo(() => {
    const result = allDocs.filter((doc) => {
      // Search query
      if (filters.searchQuery) {
        const query = filters.searchQuery.toLowerCase()
        const filename = (doc.original_filename || doc.document_name || '').toLowerCase()
        const company = doc.transportistas ? [doc.transportistas.razon_social, doc.transportistas.rut].filter(Boolean).join(' ').toLowerCase() : ''
        const conductor = doc.conductores ? [doc.conductores.nombres, doc.conductores.apellido_paterno, doc.conductores.rut].filter(Boolean).join(' ').toLowerCase() : ''
        
        if (!filename.includes(query) && !company.includes(query) && !conductor.includes(query)) {
          return false
        }
      }

      // Executive filter
      if (filters.executiveId) {
        if (getExecutive(doc) !== filters.executiveId) {
          return false
        }
      }

      // Company filter
      if (filters.companyId) {
        try {
          const docCompany = doc.transportistas ? (Array.isArray(doc.transportistas) ? doc.transportistas[0]?.id : doc.transportistas?.id) : (doc as any).subcontractor_rut
          if (docCompany !== filters.companyId) {
            return false
          }
        } catch (e) {
          return false
        }
      }

      if (filters.documentType) {
        const value = getDocumentTypeValue(doc)
        if (value !== filters.documentType) {
          return false
        }
      }

      return true
    })

    return filterByMonthYear(
      result,
      (doc) => getDocumentPeriodDate(doc),
      filters.month,
      filters.year
    )
  }, [allDocs, filters])

  if (allDocs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4">
        <div className="rounded-[4px] bg-[var(--cf-danger-soft)] p-3 mb-4">
          <XCircle className="h-12 w-12 text-[var(--cf-danger)]" />
        </div>
        <p className="text-lg font-medium text-[var(--cf-text-secondary)]">No hay documentos rechazados</p>
        <p className="text-sm text-[var(--cf-text-muted)] mt-2">Los documentos rechazados aparecerán aquí</p>
      </div>
    )
  }

  // Use filtered documents whenever any filter is active, including month/year
  const hasActiveFilters =
    filters.searchQuery ||
    filters.executiveId ||
    filters.companyId ||
    filters.documentType ||
    filters.month !== ALL_VALUE ||
    filters.year !== ALL_VALUE

  const docsToDisplay = hasActiveFilters ? filteredDocs : allDocs

  return (
    <>
      <DocumentFilter 
        onFilterChange={setFilters}
        executives={executives}
        companies={companies}
        documentTypes={documentTypes}
      />
      
      {docsToDisplay.length === 0 && hasActiveFilters ? (
        <div className="flex flex-col items-center justify-center py-12 px-4">
          <p className="text-[var(--cf-text-muted)]">No hay documentos que coincidan con los filtros seleccionados</p>
        </div>
      ) : (
        <div className="space-y-4">
          {docsToDisplay.map((doc) => (
          <Card key={doc.id} className="bg-none from-transparent80 to-transparent80 border-[var(--cf-border)] hover:border-[var(--cf-danger)]/35 transition-all  hover:shadow-red-500/10">
            <CardContent className="p-6">
              <div className="flex items-start justify-between gap-6">
                {/* Left section with icon and details */}
                <div className="flex items-start gap-4 flex-1 min-w-0">
                  <div className="flex-shrink-0">
                    <div className="flex h-12 w-12 items-center justify-center rounded-[6px] bg-[var(--cf-danger-soft)] border border-red-500/20">
                      <FileText className="h-6 w-6 text-[var(--cf-danger)]" />
                    </div>
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-[var(--cf-text)] truncate text-lg">
                      {doc.original_filename || doc.document_name}
                    </h3>
                    
                    <div className="mt-3 space-y-2">
                      {doc.conductores && (
                        <Badge variant="outline" className={metaChipClass}>
                          <User className="h-4 w-4 flex-shrink-0 text-[var(--cf-text-secondary)]" />
                          <span className="truncate">
                            {doc.conductores.nombres} {doc.conductores.apellido_paterno}
                          </span>
                          <span className="text-[var(--cf-text-muted)]">({doc.conductores.rut})</span>
                        </Badge>
                      )}
                      
                      {doc.transportistas && (
                        <Badge variant="outline" className={metaChipClass}>
                          <Building2 className="h-4 w-4 flex-shrink-0 text-[var(--cf-text-secondary)]" />
                          <span className="truncate">{(Array.isArray(doc.transportistas) ? doc.transportistas[0]?.razon_social : doc.transportistas?.razon_social) || 'N/A'}</span>
                          <span className="text-[var(--cf-text-muted)]">
                            ({(Array.isArray(doc.transportistas) ? doc.transportistas[0]?.rut : doc.transportistas?.rut) || 'N/A'})
                          </span>
                        </Badge>
                      )}
                      
                      <Badge variant="outline" className={metaChipClass}>
                        <User className="h-4 w-4 flex-shrink-0 text-purple-300" />
                        <span className="truncate text-purple-100">Rechazado por:</span>
                        <span className="truncate text-purple-200">{getExecutive(doc)}</span>
                      </Badge>

                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <Badge variant="outline" className="bg-[var(--cf-warning-soft)] border-amber-500/30 text-[var(--cf-warning)]">
                          Periodo: {getDocumentPeriod(doc)}
                        </Badge>
                        <Badge variant="outline" className="bg-[var(--cf-surface-raised)] border-[var(--cf-border)] text-[var(--cf-text-secondary)]">
                          Fecha: {getRejectionDate(doc)} {getRejectionTime(doc)}
                        </Badge>
                        {doc.docType && (
                          <Badge
                            variant="outline"
                            className={`whitespace-nowrap flex items-center gap-1.5 rounded-[4px] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${getDocumentTypeChipClass(doc)}`}
                          >
                            {getDocumentTypeLabel(doc)}
                          </Badge>
                        )}
                      </div>

                      {doc.rejection_reason && (
                        <div className="mt-3 flex items-start gap-2 bg-[var(--cf-danger-soft)]/5 p-3 rounded-md border border-red-500/10">
                          <AlertTriangle className="h-4 w-4 text-[var(--cf-danger)] mt-0.5 flex-shrink-0" />
                          <div className="flex-1">
                            <p className="text-xs font-semibold text-[var(--cf-danger)]">Motivo del rechazo:</p>
                            <p className="text-xs text-[var(--cf-danger)]/70 mt-1">{doc.rejection_reason}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right section with status and buttons */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Badge className="bg-[var(--cf-danger-soft)] text-[var(--cf-danger)] border-[var(--cf-danger)]/35 whitespace-nowrap">
                    ✗ Rechazado
                  </Badge>
                  {doc.docType && (
                    <Badge
                      variant="outline"
                      className={`whitespace-nowrap flex items-center gap-1.5 rounded-[4px] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${getDocumentTypeChipClass(doc)}`}
                    >
                      {getDocumentTypeLabel(doc)}
                    </Badge>
                  )}
                  {doc.file_url && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPreviewDoc(doc)}
                      className="text-xs gap-1 border-blue-400/50 text-[var(--cf-info)] hover:bg-[var(--cf-info-soft)]"
                      title="Ver documento"
                    >
                      <Eye className="h-4 w-4" />
                      Ver
                    </Button>
                  )}
                  {doc.file_url && (
                    <a href={buildDocumentAccessUrl(doc.file_url, 'download')} target="_blank" rel="noopener noreferrer">
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs gap-1 border-[var(--cf-border)] text-[var(--cf-text-secondary)] hover:bg-[var(--cf-surface-raised)]"
                        title="Descargar documento"
                      >
                        <Download className="h-4 w-4" />
                        Descar
                      </Button>
                    </a>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
          ))}
        </div>
      )}

      {/* Preview Modal - No se cierra por click fuera, solo por X o Escape */}
      <Dialog open={!!previewDoc} onOpenChange={(open) => { if (!open) setPreviewDoc(null) }}>
        <DialogContent 
          className="max-w-4xl bg-[var(--cf-surface)] border-[var(--cf-border)]"
          onPointerDownOutside={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>{previewDoc?.original_filename || previewDoc?.document_name}</DialogTitle>
          </DialogHeader>
          
          {previewDoc?.file_url && (
            <div className="w-full">
              {previewDoc.file_url.toLowerCase().endsWith('.pdf') ? (
                <PDFViewer
                  url={previewDoc.file_url}
                  filename={previewDoc.original_filename || previewDoc?.document_name || 'document.pdf'}
                />
              ) : (
                // Fallback for non-PDF files (images, etc)
                <div className="flex justify-center items-center bg-[var(--cf-surface)] rounded-[6px] p-4 max-h-[60vh] overflow-auto">
                  <img
                    src={previewDoc.file_url}
                    alt="Preview"
                    className="max-w-full max-h-[50vh] object-contain"
                  />
                </div>
              )}
            </div>
          )}

          {!previewDoc?.file_url && (
            <div className="w-full h-96 bg-[var(--cf-surface)] rounded-[6px] flex items-center justify-center">
              <p className="text-muted-foreground">No hay documento disponible para previsualizar</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
