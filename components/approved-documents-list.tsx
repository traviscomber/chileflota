'use client'

import { useState, useEffect, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ChevronDown, Filter, X } from 'lucide-react'
import { PDFViewer } from '@/components/pdf-viewer'
import { useDocumentSync } from '@/contexts/document-sync-context'
import { getChileDate, getChileTime } from '@/lib/timezone-utils'
import { DocumentsByMonth } from '@/components/documents-by-month'
import { groupDocumentsByMonth } from '@/lib/document-grouping'
import { ApprovedDocumentCard } from '@/components/approved-document-card'
import { getDocumentPeriodDate, getDocumentWorkflowDate } from '@/lib/document-period'

// Safely parse a date string from Supabase.
// Supabase timestamps come WITHOUT a 'Z' suffix (e.g. "2026-06-11T20:30:07.631").
// Without 'Z', new Date() treats the string as LOCAL time instead of UTC,
// which shifts the timestamp by the local UTC offset (Chile = UTC-4 → +4 hrs).
// Appending 'Z' forces correct UTC interpretation in all browsers.
function parseSupabaseDate(raw: string | null | undefined): number {
  if (!raw) return 0
  const normalized = raw.endsWith('Z') ? raw : raw + 'Z'
  return new Date(normalized).getTime()
}
const ALL_EXEC = '__all_exec__'
const ALL_TYPE = '__all_type__'
const ALL_EMPRESA = '__all_empresa__'

interface ApprovedDocument {
  id: string
  original_filename?: string
  document_name?: string
  validation_status?: string
  status?: string
  file_url?: string
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
  approved_by?: string
  approved_by_email?: string
  reviewed_by_ejecutiva?: string
  docType?: { code: string; nombre: string }
  empresa_nombre?: string | null
  conductores?: { id: string; nombres: string; apellido_paterno: string; rut: string }
  transportistas?: { id: string; razon_social: string; rut: string }
}

interface Props {
  conductorDocs: ApprovedDocument[]
  subDocs: ApprovedDocument[]
}

export function ApprovedDocumentsList({ conductorDocs: initialConductorDocs, subDocs: initialSubDocs }: Props) {
  const [conductorDocs, setConductorDocs] = useState(initialConductorDocs)
  const [subDocs, setSubDocs] = useState(initialSubDocs)
  const [previewDoc, setPreviewDoc] = useState<ApprovedDocument | null>(null)
  const [displayCount, setDisplayCount] = useState(350)

  // Filter state — all local, no callbacks to parent, no render loops
  const [searchText, setSearchText] = useState('')
  const [selectedExecutive, setSelectedExecutive] = useState(ALL_EXEC)
  const [selectedDocType, setSelectedDocType] = useState(ALL_TYPE)
  const [selectedEmpresa, setSelectedEmpresa] = useState(ALL_EMPRESA)
  const [showFilters, setShowFilters] = useState(true)

  const LOAD_MORE_INCREMENT = 300

  const { onSync } = useDocumentSync()

  useEffect(() => {
    const unsubscribe = onSync((event) => {
      if (event.type === 'document_status_changed') {
        const timer = setTimeout(async () => {
          try {
            const response = await fetch('/api/company/documents/aprobados?compact=1')
            if (response.ok) {
              const data = await response.json()
              setConductorDocs(data.conductorDocs || [])
              setSubDocs(data.subDocs || [])
            }
          } catch (error) {
            console.error('[v0] Error refetching approved docs:', error)
          }
        }, 500)
        return () => clearTimeout(timer)
      }
    })
    return unsubscribe
  }, [onSync])

  // Merge and sort all docs once
  const allDocs = useMemo(() => {
    return [...conductorDocs, ...subDocs].sort((a, b) => {
      const dateB = parseSupabaseDate(getDocumentWorkflowDate(b))
      const dateA = parseSupabaseDate(getDocumentWorkflowDate(a))
      return dateB - dateA
    })
  }, [conductorDocs, subDocs])

  // Derive unique executives from the canonical 'ejecutiva' field
  // The API always normalizes this to executive_staff.full_name
  const executives = useMemo(() => {
    const set = new Set<string>()
    allDocs.forEach(doc => {
      // 'ejecutiva' is always the canonical full_name set by the API
      const exec = doc.ejecutiva || doc.reviewed_by_ejecutiva
      if (exec && exec !== 'No especificado') set.add(exec)
    })
    return Array.from(set).sort()
  }, [allDocs])

  const docTypes = useMemo(() => {
    // Key by code to deduplicate entries that have the same code but different nombre
    // (e.g. "Licencia de Conducir" vs "Licencia de Conducir Profesional" both map to LIC*)
    const map = new Map<string, string>() // code -> nombre (display label)
    allDocs.forEach(doc => {
      if (doc.docType?.code && doc.docType?.nombre && !map.has(doc.docType.code)) {
        map.set(doc.docType.code, doc.docType.nombre)
      }
    })
    return Array.from(map.entries())
      .map(([code, nombre]) => ({ code, nombre }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre))
  }, [allDocs])

  const empresas = useMemo(() => {
    const set = new Set<string>()
    allDocs.forEach(doc => {
      if (doc.empresa_nombre) set.add(doc.empresa_nombre)
    })
    return Array.from(set).sort()
  }, [allDocs])

  // Apply all filters in a single useMemo — pure computation, no side effects
  const filteredDocs = useMemo(() => {
    let result = allDocs

    if (searchText.trim()) {
      const q = searchText.toLowerCase()
      result = result.filter(doc => {
        const company = [
          doc.empresa_nombre,
          doc.transportistas?.razon_social,
          doc.transportistas?.rut,
          (doc as any).subcontractor_rut,
        ].filter(Boolean).join(' ').toLowerCase()
        const conductor = [
          doc.conductores?.nombres,
          doc.conductores?.apellido_paterno,
          doc.conductores?.rut,
        ].filter(Boolean).join(' ').toLowerCase()
        const filename = (doc.original_filename || doc.document_name || '').toLowerCase()
        const docType = [doc.docType?.nombre, doc.docType?.code].filter(Boolean).join(' ').toLowerCase()
        return filename.includes(q) || company.includes(q) || conductor.includes(q) || docType.includes(q)
      })
    }

    if (selectedExecutive !== ALL_EXEC) {
      result = result.filter(doc => {
        // Match against the same canonical field used to build the dropdown
        const exec = doc.ejecutiva || doc.reviewed_by_ejecutiva
        return exec === selectedExecutive
      })
    }

    if (selectedDocType !== ALL_TYPE) {
      result = result.filter(doc => doc.docType?.code === selectedDocType)
    }

    if (selectedEmpresa !== ALL_EMPRESA) {
      result = result.filter(doc => doc.empresa_nombre === selectedEmpresa)
    }

    return result
  }, [allDocs, searchText, selectedExecutive, selectedDocType, selectedEmpresa])

  const hasActiveFilters =
    searchText.trim() !== '' ||
    selectedExecutive !== ALL_EXEC ||
    selectedDocType !== ALL_TYPE ||
    selectedEmpresa !== ALL_EMPRESA

  const handleClearFilters = () => {
    setSearchText('')
    setSelectedExecutive(ALL_EXEC)
    setSelectedDocType(ALL_TYPE)
    setSelectedEmpresa(ALL_EMPRESA)
  }

  const getExecutive = (doc: ApprovedDocument) =>
    doc.ejecutiva || doc.reviewed_by_ejecutiva || 'No especificado'

  // Pagination applied after filtering
  const paginatedDocs = filteredDocs.slice(0, displayCount)
  const hasMore = filteredDocs.length > displayCount
  const remainingCount = filteredDocs.length - displayCount

  return (
    <>
      {/* ── Filter Panel ─────────────────────────────── */}
      <div className="space-y-3 mb-4">
        <div className="flex items-center justify-between">
          <Button
            onClick={() => setShowFilters(!showFilters)}
            variant="outline"
            size="sm"
            className="gap-2 border-[var(--cf-border)] text-[var(--cf-text-secondary)] hover:bg-[var(--cf-surface)]"
          >
            <Filter className="w-4 h-4" />
            {showFilters ? 'Ocultar' : 'Mostrar'} Filtros
          </Button>
          {hasActiveFilters && (
            <Badge variant="secondary" className="bg-[var(--cf-accent)]/20 text-[var(--cf-expiring)]">
              {filteredDocs.length} / {allDocs.length} documentos
            </Badge>
          )}
        </div>

        {showFilters && (
          <div className="bg-[var(--cf-surface)] border border-[var(--cf-border)] rounded-[6px] p-4 space-y-3">
            {/* Search */}
            <div>
              <label className="text-xs font-medium text-[var(--cf-text-muted)] block mb-2">
                Buscar por documento, empresa, RUT o conductor
              </label>
              <Input
                placeholder="Ej: Rodmac, 76..., certificado, Juan..."
                value={searchText}
                onChange={e => setSearchText(e.target.value)}
                className="bg-[var(--cf-surface)] border-[var(--cf-border)] text-[var(--cf-text)] placeholder:text-[var(--cf-text-muted)]"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {/* Empresa */}
              <div>
                <label className="text-xs font-medium text-[var(--cf-text-muted)] block mb-2">Empresa</label>
                <Select value={selectedEmpresa} onValueChange={setSelectedEmpresa}>
                  <SelectTrigger className="bg-[var(--cf-surface)] border-[var(--cf-border)] text-[var(--cf-text)]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[var(--cf-surface)] border-[var(--cf-border)]">
                    <SelectItem value={ALL_EMPRESA}>Todas las empresas</SelectItem>
                    {empresas.map(emp => (
                      <SelectItem key={emp} value={emp}>{emp}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Executive */}
              <div>
                <label className="text-xs font-medium text-[var(--cf-text-muted)] block mb-2">Ejecutiva</label>
                <Select value={selectedExecutive} onValueChange={setSelectedExecutive}>
                  <SelectTrigger className="bg-[var(--cf-surface)] border-[var(--cf-border)] text-[var(--cf-text)]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[var(--cf-surface)] border-[var(--cf-border)]">
                    <SelectItem value={ALL_EXEC}>Todas las ejecutivas</SelectItem>
                    {executives.map(exec => (
                      <SelectItem key={exec} value={exec}>{exec}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Doc Type */}
              <div>
                <label className="text-xs font-medium text-[var(--cf-text-muted)] block mb-2">Tipo de documento</label>
                <Select value={selectedDocType} onValueChange={setSelectedDocType}>
                  <SelectTrigger className="bg-[var(--cf-surface)] border-[var(--cf-border)] text-[var(--cf-text)]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[var(--cf-surface)] border-[var(--cf-border)]">
                    <SelectItem value={ALL_TYPE}>Todos los tipos</SelectItem>
                    {docTypes.map(({ code, nombre }) => (
                      <SelectItem key={code} value={code}>{nombre}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {hasActiveFilters && (
              <Button
                onClick={handleClearFilters}
                variant="ghost"
                size="sm"
                className="gap-2 text-[var(--cf-text-muted)] hover:text-[var(--cf-text-secondary)] hover:bg-[var(--cf-surface-raised)] w-full"
              >
                <X className="w-4 h-4" />
                Limpiar todos los filtros
              </Button>
            )}
          </div>
        )}
      </div>

      {/* ── Document List ─────────────────────────────── */}
      {filteredDocs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 px-4">
          <p className="text-[var(--cf-text-muted)]">
            {hasActiveFilters ? 'No hay documentos que coincidan con los filtros' : 'No hay documentos aprobados'}
          </p>
          {hasActiveFilters && (
            <Button onClick={handleClearFilters} variant="ghost" size="sm" className="mt-2 text-[var(--cf-text-muted)]">
              Limpiar filtros
            </Button>
          )}
        </div>
      ) : (
        <>
          <DocumentsByMonth
            monthsData={groupDocumentsByMonth(paginatedDocs, 'document_period_start', 'es')}
            renderDocument={(doc) => (
              <ApprovedDocumentCard
                key={doc.id}
                doc={doc}
                onPreview={setPreviewDoc}
                getExecutive={getExecutive}
              />
            )}
            emptyMessage="No hay documentos aprobados"
          />

          {hasMore && (
            <div className="flex flex-col items-center gap-3 py-6 px-4">
              <p className="text-sm text-[var(--cf-text-muted)]">
                Mostrando {paginatedDocs.length} de {filteredDocs.length} documentos
                {remainingCount > 0 && ` (+${remainingCount} mas)`}
              </p>
              <Button
                onClick={() => setDisplayCount(prev => prev + LOAD_MORE_INCREMENT)}
                variant="outline"
                className="gap-2 border-[var(--cf-border)] text-[var(--cf-text-secondary)] hover:bg-[var(--cf-surface)]"
              >
                <ChevronDown className="w-4 h-4" />
                Cargar {Math.min(LOAD_MORE_INCREMENT, remainingCount)} mas documentos
              </Button>
            </div>
          )}
        </>
      )}

      {/* ── Preview Modal ─────────────────────────────── */}
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
