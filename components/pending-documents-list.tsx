'use client'

import { useState, useEffect, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Clock, Users, Truck, ArrowLeft, FileText, Check, X, Loader2, Eye, Download, Sparkles, User, Building2 } from "lucide-react"
import Link from "next/link"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { useDocumentSync } from '@/contexts/document-sync-context'
import { PDFViewer } from '@/components/pdf-viewer'
import { formatToChileTime } from '@/lib/timezone-utils'
import { getDocTypeIcon } from '@/lib/document-type-icons'
import { DocumentFilter, type DocumentFilters } from '@/components/document-filter'
import { ALL_VALUE, filterByMonthYear } from '@/lib/date-filters'
import { buildDocumentAccessUrl } from '@/lib/document-file-access'
import { getDocumentPeriodDate, getDocumentPeriodLabel } from '@/lib/document-period'

interface PendingDocument {
  id: string
  original_filename?: string
  file_name?: string
  document_type_id?: string
  file_url?: string
  created_at?: string
  uploaded_at?: string
  document_period_month?: number | string | null
  document_period_year?: number | string | null
  document_period_start?: string | null
  ejecutiva?: string
  reviewed_by_ejecutiva?: string
  uploaded_by_ejecutiva?: string
  subcontractor_rut?: string
  empresa_nombre?: string
  docType?: { code: string; nombre: string }
  conductores?: {
    id: string
    nombres: string
    apellido_paterno: string
    rut: string
  } | {
    id: string
    nombres: string
    apellido_paterno: string
    rut: string
  }[]
  transportistas?: {
    id: string
    razon_social: string
    nombre_fantasia?: string | null
    rut: string
  } | {
    id: string
    razon_social: string
    nombre_fantasia?: string | null
    rut: string
  }[]
}

interface Props {
  conductorDocs: PendingDocument[]
  subDocs: PendingDocument[]
}

const normalizeSearchText = (value: unknown) =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()

const normalizeRut = (value: unknown) =>
  normalizeSearchText(value).replace(/[^0-9k]/g, '')

export function PendingDocumentsList({ conductorDocs: propConductorDocs, subDocs: propSubDocs }: Props) {
  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState<string | null>(null)
  const [analyzing, setAnalyzing] = useState<string | null>(null)
  const [previewDoc, setPreviewDoc] = useState<PendingDocument | null>(null)
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [showAnalysisModal, setShowAnalysisModal] = useState(false)
  const [analysisResult, setAnalysisResult] = useState<any>(null)
  const [analysisDocId, setAnalysisDocId] = useState<string | null>(null)
  const [analysisDocType, setAnalysisDocType] = useState<'conductor' | 'subcontractor'>('conductor')
  const [filters, setFilters] = useState<DocumentFilters>({
    searchQuery: '',
    month: ALL_VALUE,
    year: ALL_VALUE,
  })
  const { onSync, broadcastSync } = useDocumentSync()
  const [rejectDocId, setRejectDocId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [docType, setDocType] = useState<'conductor' | 'subcontractor'>('conductor')

  useEffect(() => {
    setRemovedIds(new Set())
  }, [propConductorDocs, propSubDocs])

  const conductorDocs = propConductorDocs.filter(doc => !removedIds.has(doc.id))
  const subDocs = propSubDocs.filter(doc => !removedIds.has(doc.id))

  const totalPendientes = conductorDocs.length + subDocs.length

  const getExecutive = (doc: PendingDocument) => {
    return doc.ejecutiva || doc.reviewed_by_ejecutiva || doc.uploaded_by_ejecutiva || 'No especificado'
  }

  const getDocumentTypeValue = (doc: PendingDocument) =>
    doc.docType?.code || doc.document_type_id || doc.docType?.nombre || 'Sin tipo'

  const getDocumentTypeLabel = (doc: PendingDocument) =>
    doc.docType?.nombre || doc.docType?.code || 'Sin tipo'

  const getDocumentPeriod = (doc: PendingDocument) => {
    return getDocumentPeriodLabel(doc)
  }

  const getDocumentDate = (doc: PendingDocument) => {
    const rawDate = doc.uploaded_at || doc.created_at
    if (!rawDate) return 'Sin fecha'
    return formatToChileTime(rawDate, "d 'de' MMMM 'de' yyyy")
  }

  const getDocumentTypeChipClass = (doc: PendingDocument) => {
    const iconConfig = getDocTypeIcon(doc.docType)
    return `${iconConfig.bg} ${iconConfig.border} ${iconConfig.color} border shadow-sm backdrop-blur-sm`
  }
  const metaChipClass = 'whitespace-nowrap flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold tracking-[0.14em] border border-slate-600/50 bg-slate-950/40 text-slate-100 shadow-sm backdrop-blur-sm'

  const allDocs = [...conductorDocs, ...subDocs].sort((a, b) => {
    try {
      const dateB = new Date(getDocumentPeriodDate(b) || b.uploaded_at || b.created_at || 0).getTime()
      const dateA = new Date(getDocumentPeriodDate(a) || a.uploaded_at || a.created_at || 0).getTime()
      return dateB - dateA
    } catch (e) {
      console.error('[v0] Error sorting pending docs:', e)
      return 0
    }
  })

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
      } catch (e) {
        console.log('[v0] Error extracting company:', e)
      }
    })
    return Array.from(comps).map(([id, data]) => ({ id, ...data }))
  }, [allDocs])

  const filteredDocs = useMemo(() => {
    const result = allDocs.filter((doc) => {
      if (filters.searchQuery) {
        const query = normalizeSearchText(filters.searchQuery)
        const queryRut = normalizeRut(filters.searchQuery)
        const filename = normalizeSearchText(doc.original_filename || doc.file_name || '')
        const transportista = doc.transportistas ? (Array.isArray(doc.transportistas) ? doc.transportistas[0] : doc.transportistas) : null
        const conductorData = doc.conductores ? (Array.isArray(doc.conductores) ? doc.conductores[0] : doc.conductores) : null
        const companyText = normalizeSearchText([
          transportista?.razon_social,
          transportista?.nombre_fantasia,
          doc.empresa_nombre,
          transportista?.rut,
          doc.subcontractor_rut,
        ].filter(Boolean).join(' '))
        const conductorText = normalizeSearchText([
          conductorData?.nombres,
          conductorData?.apellido_paterno,
          conductorData?.rut,
        ].filter(Boolean).join(' '))
        const companyRuts = [transportista?.rut, doc.subcontractor_rut].map(normalizeRut).filter(Boolean)
        const conductorRut = normalizeRut(conductorData?.rut)
        const rutMatches = Boolean(queryRut) && (
          companyRuts.some((rut) => rut.includes(queryRut)) ||
          conductorRut.includes(queryRut)
        )

        if (!filename.includes(query) && !companyText.includes(query) && !conductorText.includes(query) && !rutMatches) {
          return false
        }
      }

      if (filters.executiveId) {
        if (getExecutive(doc) !== filters.executiveId) {
          return false
        }
      }

      if (filters.companyId) {
        try {
          const docCompany = doc.transportistas ? (Array.isArray(doc.transportistas) ? doc.transportistas[0]?.id : doc.transportistas?.id) : doc.subcontractor_rut
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

  const handleAnalyzeDocument = async (docId: string, type: 'conductor' | 'subcontractor') => {
    setAnalyzing(docId)
    try {
      const response = await fetch(`/api/company/documents/${docId}/reprocess`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId: docId })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Error al analizar documento')
      }

      const result = await response.json()

      setAnalysisResult(result)
      setAnalysisDocId(docId)
      setAnalysisDocType(type)
      setShowAnalysisModal(true)
    } catch (error) {
      const msg = document.createElement('div')
      msg.className = 'fixed bottom-4 right-4 bg-red-600 text-white px-6 py-3 rounded-lg shadow-lg z-[100]'
      msg.textContent = 'Error al analizar: ' + (error as Error).message
      document.body.appendChild(msg)
      setTimeout(() => msg.remove(), 5000)
    } finally {
      setAnalyzing(null)
    }
  }

  const handleProvideFeedback = async (correctedType?: string, correctedDate?: string) => {
    if (!analysisResult) return

    fetch('/api/company/ai-training/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        documentId: analysisResult.documentId,
        documentTable: analysisResult.documentTable,
        aiDetectedType: analysisResult.analysis.documentType,
        actualDocumentType: correctedType || analysisResult.analysis.documentType,
        aiExpirationDate: analysisResult.analysis.expirationDate,
        actualExpirationDate: correctedDate || analysisResult.analysis.expirationDate,
        isAccurate: !correctedType && !correctedDate,
        confidenceScore: analysisResult.analysis.confidence,
      })
    }).catch(() => {})

    setShowAnalysisModal(false)
    if (analysisDocId) {
      handleStatusChange(analysisDocId, 'aprobado', analysisDocType)
    }
  }

  const handleStatusChange = async (docId: string, newStatus: 'aprobado' | 'rechazado', type: 'conductor' | 'subcontractor', reason?: string) => {
    setLoading(docId)
    try {
      console.log('[v0] Pending docs: Changing status', { docId, status: newStatus, reason, type })

      const response = await fetch(`/api/company/documents/${docId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: newStatus,
          reason: reason,
          documentType: type
        })
      })

      console.log('[v0] Pending docs: Response status:', response.status)

      if (!response.ok) {
        const error = await response.json()
        console.error('[v0] Pending docs: Server error:', error)
        throw new Error(error.error || error.details?.[0]?.message || 'Error al cambiar estado')
      }

      const result = await response.json()
      console.log('[v0] Pending docs: Status change successful', result)

      setRemovedIds(prev => new Set([...prev, docId]))

      console.log('[v0] Pending docs: Broadcasting status change event after 200ms delay')
      setTimeout(() => {
        broadcastSync({
          type: 'document_status_changed',
          documentId: docId,
          timestamp: Date.now(),
          data: {
            oldStatus: 'pending',
            newStatus: newStatus === 'aprobado' ? 'approved' : 'rejected'
          }
        })
      }, 200)

      const msg = document.createElement('div')
      msg.className = 'fixed bottom-4 right-4 bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg z-[100]'
      msg.textContent = `Documento ${newStatus === 'aprobado' ? 'aprobado' : 'rechazado'}`
      document.body.appendChild(msg)
      setTimeout(() => msg.remove(), 3000)

    } catch (error) {
      console.error('[v0] Pending docs: Error:', error)
      alert(`Error: ${error instanceof Error ? error.message : 'Desconocido'}`)
    } finally {
      setLoading(null)
      setShowRejectModal(false)
      setRejectDocId(null)
      setRejectReason('')
    }
  }

  const handleApprove = (docId: string, type: 'conductor' | 'subcontractor') => {
    handleStatusChange(docId, 'aprobado', type)
  }

  const handleRejectClick = (docId: string, type: 'conductor' | 'subcontractor') => {
    setRejectDocId(docId)
    setDocType(type)
    setShowRejectModal(true)
  }

  const confirmReject = () => {
    if (rejectDocId) {
      handleStatusChange(rejectDocId, 'rechazado', docType, rejectReason)
    }
  }

  useEffect(() => {
    const unsubscribe = onSync((event) => {
      console.log('[v0] PendingDocumentsList: Received sync event', event.type)

      if (event.type === 'document_status_changed' && event.documentId) {
        const docId = event.documentId
        console.log('[v0] PendingDocumentsList: Removing document from pending list:', docId)
        setRemovedIds(prev => new Set([...prev, docId]))
      }
    })

    return unsubscribe
  }, [onSync])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/company/documentos">
            <Button variant="ghost" size="sm" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Volver
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Clock className="h-6 w-6 text-amber-500" />
              Documentos Pendientes
            </h1>
            <p className="text-muted-foreground">
              {totalPendientes} documentos esperando revision
            </p>
          </div>
        </div>
      </div>

      <DocumentFilter
        onFilterChange={setFilters}
        executives={executives}
        companies={companies}
        documentTypes={documentTypes}
      />

      <Card className="border-blue-500/30 bg-blue-500/5">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-blue-500" />
              <CardTitle>Documentos de Conductores</CardTitle>
            </div>
            <Badge variant="secondary">
              {filteredDocs.filter(doc => propConductorDocs.some(d => d.id === doc.id)).length} pendientes
            </Badge>
          </div>
          <CardDescription>Licencias, antecedentes y documentos personales</CardDescription>
        </CardHeader>
        <CardContent>
          {filteredDocs.filter(doc => propConductorDocs.some(d => d.id === doc.id)).length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No hay documentos de conductores pendientes
            </p>
          ) : (
            <div className="space-y-2">
              {filteredDocs.filter(doc => propConductorDocs.some(d => d.id === doc.id)).map((doc) => {
                const c = Array.isArray(doc.conductores) ? doc.conductores[0] : doc.conductores
                return (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-slate-800/50 border border-slate-700"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <FileText className="h-4 w-4 text-blue-400 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{doc.original_filename}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <Badge variant="outline" className={metaChipClass}>
                            <User className="h-4 w-4 flex-shrink-0 text-slate-300" />
                            <span className="truncate">
                              {c ? `${c.nombres} ${c.apellido_paterno}` : ''}
                            </span>
                            <span className="text-slate-400">
                              {c ? `(${c.rut})` : ''}
                            </span>
                          </Badge>
                          <Badge
                            variant="outline"
                            className={`whitespace-nowrap flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${getDocumentTypeChipClass(doc)}`}
                          >
                            {getDocumentTypeLabel(doc)}
                          </Badge>
                          <Badge variant="outline" className="text-[10px] bg-amber-500/10 border-amber-500/30 text-amber-300">
                            Periodo: {getDocumentPeriod(doc)}
                          </Badge>
                          <Badge variant="outline" className="text-[10px] bg-slate-500/10 border-slate-500/30 text-slate-200">
                            Fecha: {getDocumentDate(doc)}
                          </Badge>
                          {getExecutive(doc) !== 'No especificado' && (
                            <Badge variant="outline" className={metaChipClass}>
                              <Sparkles className="h-4 w-4 flex-shrink-0 text-purple-300" />
                              <span className="truncate text-purple-100">Ejecutiva:</span>
                              <span className="truncate text-purple-200">{getExecutive(doc)}</span>
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                      {doc.file_url && (
                        <Button variant="ghost" size="sm" onClick={() => setPreviewDoc(doc)} className="text-slate-400 hover:text-white">
                          <Eye className="h-4 w-4" />
                        </Button>
                      )}
                      <Button variant="outline" size="sm" onClick={() => handleAnalyzeDocument(doc.id, 'conductor')} disabled={analyzing === doc.id} className="text-xs gap-1 border-blue-400 text-blue-300 bg-blue-500/10 hover:bg-blue-500/30 ring-1 ring-blue-400/30" title="Recomendado: Analizar con IA antes de aprobar">
                        {analyzing === doc.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3 text-blue-400" />}
                        Analizar con IA
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleApprove(doc.id, 'conductor')} disabled={loading === doc.id} className="text-xs gap-1 border-green-500/50 text-green-400 hover:bg-green-500/20">
                        {loading === doc.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                        Aprobar
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleRejectClick(doc.id, 'conductor')} disabled={loading === doc.id} className="text-xs gap-1 border-red-500/50 text-red-400 hover:bg-red-500/20">
                        <X className="h-3 w-3" />
                        Rechazar
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-orange-500/30 bg-orange-500/5">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Truck className="h-5 w-5 text-orange-500" />
              <CardTitle>Documentos de Subcontratistas</CardTitle>
            </div>
            <Badge variant="secondary">
              {filteredDocs.filter(doc => propSubDocs.some(d => d.id === doc.id)).length} pendientes
            </Badge>
          </div>
          <CardDescription>F30, F30-1, contratos y documentos legales</CardDescription>
        </CardHeader>
        <CardContent>
          {filteredDocs.filter(doc => propSubDocs.some(d => d.id === doc.id)).length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No hay documentos de subcontratistas pendientes
            </p>
          ) : (
            <div className="space-y-2">
              {filteredDocs.filter(doc => propSubDocs.some(d => d.id === doc.id)).map((doc) => {
                const t = Array.isArray(doc.transportistas) ? doc.transportistas[0] : doc.transportistas
                return (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-slate-800/50 border border-slate-700"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <FileText className="h-4 w-4 text-orange-400 flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm truncate">{doc.file_name}</p>
                        <div className="flex gap-3 mt-1 flex-wrap">
                          <Badge variant="outline" className={metaChipClass}>
                            <Building2 className="h-4 w-4 flex-shrink-0 text-slate-300" />
                            <span className="truncate">
                              {t ? t.razon_social : ''}
                            </span>
                            <span className="text-slate-400">
                              {t ? `(${t.rut})` : ''}
                            </span>
                          </Badge>
                          {doc.docType && (
                            <Badge
                              variant="outline"
                              className={`whitespace-nowrap flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${getDocumentTypeChipClass(doc)}`}
                            >
                              {getDocumentTypeLabel(doc)}
                            </Badge>
                          )}
                          <Badge variant="outline" className="text-xs bg-amber-500/10 border-amber-500/30 text-amber-300">
                            Periodo: {getDocumentPeriod(doc)}
                          </Badge>
                          <Badge variant="outline" className="text-xs bg-slate-500/10 border-slate-500/30 text-slate-200">
                            Fecha: {getDocumentDate(doc)}
                          </Badge>
                          {doc.ejecutiva && doc.ejecutiva !== 'Sin asignar' && (
                            <Badge variant="outline" className={metaChipClass}>
                              <Sparkles className="h-4 w-4 flex-shrink-0 text-purple-300" />
                              <span className="truncate text-purple-100">Ejecutiva:</span>
                              <span className="truncate text-purple-200">{doc.ejecutiva}</span>
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                      {doc.file_url && (
                        <Button variant="ghost" size="sm" onClick={() => setPreviewDoc(doc)} className="text-slate-400 hover:text-white">
                          <Eye className="h-4 w-4" />
                        </Button>
                      )}
                      <Button variant="outline" size="sm" onClick={() => handleAnalyzeDocument(doc.id, 'subcontractor')} disabled={analyzing === doc.id} className="text-xs gap-1 border-blue-400 text-blue-300 bg-blue-500/10 hover:bg-blue-500/30 ring-1 ring-blue-400/30" title="Recomendado: Analizar con IA antes de aprobar">
                        {analyzing === doc.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3 text-blue-400" />}
                        Analizar con IA
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleApprove(doc.id, 'subcontractor')} disabled={loading === doc.id} className="text-xs gap-1 border-green-500/50 text-green-400 hover:bg-green-500/20">
                        {loading === doc.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                        Aprobar
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleRejectClick(doc.id, 'subcontractor')} disabled={loading === doc.id} className="text-xs gap-1 border-red-500/50 text-red-400 hover:bg-red-500/20">
                        <X className="h-3 w-3" />
                        Rechazar
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!previewDoc} onOpenChange={(open) => { if (!open) setPreviewDoc(null) }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" aria-label={`Preview de ${previewDoc?.file_name || 'documento'}`}>
          <DialogHeader className="flex flex-row items-center justify-between">
            <DialogTitle className="flex-1">{previewDoc?.original_filename || previewDoc?.file_name}</DialogTitle>
            {previewDoc?.file_url && (
              <a
                href={buildDocumentAccessUrl(previewDoc.file_url, 'download')}
                download={previewDoc.original_filename || previewDoc?.file_name}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-2"
              >
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1 border-blue-500/50 text-blue-400 hover:bg-blue-500/20"
                >
                  <Download className="h-4 w-4" />
                  Descargar
                </Button>
              </a>
            )}
          </DialogHeader>

          {previewDoc?.file_url && (
            <div className="w-full">
              {previewDoc.file_url.toLowerCase().endsWith('.pdf') ? (
                <PDFViewer
                  url={previewDoc.file_url}
                  filename={previewDoc.original_filename || previewDoc?.file_name || 'document.pdf'}
                />
              ) : (
                <div className="flex justify-center items-center bg-slate-900 rounded-lg p-4 max-h-[60vh] overflow-auto">
                  <img
                    src={previewDoc.file_url}
                    alt="Preview"
                    className="max-w-full max-h-[50vh] object-contain"
                  />
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2 mt-4">
            <Button
              variant="outline"
              onClick={() => {
                if (previewDoc) {
                  const hasConductor = previewDoc.conductores && (Array.isArray(previewDoc.conductores) ? previewDoc.conductores.length > 0 : true)
                  handleApprove(previewDoc.id, hasConductor ? 'conductor' : 'subcontractor')
                }
                setPreviewDoc(null)
              }}
              className="gap-1 border-green-500/50 text-green-400 hover:bg-green-500/20"
            >
              <Check className="h-4 w-4" />
              Aprobar
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                if (previewDoc) {
                  const hasConductor = previewDoc.conductores && (Array.isArray(previewDoc.conductores) ? previewDoc.conductores.length > 0 : true)
                  handleRejectClick(previewDoc.id, hasConductor ? 'conductor' : 'subcontractor')
                  setPreviewDoc(null)
                }
              }}
              className="gap-1 border-red-500/50 text-red-400 hover:bg-red-500/20"
            >
              <X className="h-4 w-4" />
              Rechazar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showRejectModal} onOpenChange={setShowRejectModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Motivo del Rechazo</DialogTitle>
          </DialogHeader>
          <Textarea
            placeholder="Ingrese el motivo del rechazo (opcional)"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            className="min-h-[100px]"
          />
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="ghost" onClick={() => setShowRejectModal(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={confirmReject}
              disabled={loading !== null}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Confirmar Rechazo
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showAnalysisModal} onOpenChange={setShowAnalysisModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-blue-400" />
              Resultados del Analisis IA
            </DialogTitle>
          </DialogHeader>

          {analysisResult && (
            <div className="space-y-4">
              <div className="bg-slate-800/50 rounded-lg p-3">
                <p className="text-sm text-slate-400">Archivo</p>
                <p className="text-white font-medium">{analysisResult.originalDocument?.file_name || 'Sin nombre'}</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-800/50 rounded-lg p-3">
                  <p className="text-sm text-slate-400">Tipo Detectado</p>
                  <p className="text-white font-medium">{analysisResult.analysis?.documentType || 'No detectado'}</p>
                </div>

                <div className="bg-slate-800/50 rounded-lg p-3">
                  <p className="text-sm text-slate-400">Confianza</p>
                  <p className="text-white font-medium">
                    {analysisResult.analysis?.confidence
                      ? `${Math.round(analysisResult.analysis.confidence * 100)}%`
                      : 'N/A'}
                  </p>
                </div>

                {analysisResult.analysis?.expirationDate && (
                  <div className="bg-slate-800/50 rounded-lg p-3">
                    <p className="text-sm text-slate-400">Fecha Vencimiento</p>
                    <p className="text-white font-medium">{analysisResult.analysis.expirationDate}</p>
                  </div>
                )}

                {analysisResult.analysis?.documentNumber && (
                  <div className="bg-slate-800/50 rounded-lg p-3">
                    <p className="text-sm text-slate-400">Numero Documento</p>
                    <p className="text-white font-medium">{analysisResult.analysis.documentNumber}</p>
                  </div>
                )}
              </div>

              {analysisResult.analysis?.extractedText && (
                <div className="bg-slate-800/50 rounded-lg p-3">
                  <p className="text-sm text-slate-400 mb-1">Informacion Extraida</p>
                  <p className="text-white text-sm">{analysisResult.analysis.extractedText}</p>
                </div>
              )}

              {analysisResult.analysis?.warnings?.length > 0 && (
                <div className="bg-yellow-900/30 border border-yellow-600/50 rounded-lg p-3">
                  <p className="text-sm text-yellow-400 font-medium mb-1">Advertencias</p>
                  <ul className="text-yellow-200 text-sm list-disc list-inside">
                    {analysisResult.analysis.warnings.map((w: string, i: number) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="border-t border-slate-700 pt-3">
                <p className="text-xs text-slate-400 mb-2">
                  Feedback opcional — ayuda a entrenar el modelo
                </p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 border-slate-600 text-slate-400 hover:bg-slate-700/40 text-xs"
                    onClick={() => {
                      const correctedType = window.prompt(
                        'Ingrese el tipo de documento correcto:',
                        analysisResult?.analysis?.documentType || ''
                      )
                      if (correctedType) {
                        const correctedDate = window.prompt(
                          'Ingrese la fecha de vencimiento correcta (DD/MM/YYYY) o deje vacío:',
                          analysisResult?.analysis?.expirationDate || ''
                        )
                        handleProvideFeedback(correctedType, correctedDate || undefined)
                      }
                    }}
                  >
                    Corregir tipo / fecha
                  </Button>
                </div>
              </div>

              <div className="flex justify-end pt-2 gap-2">
                <Button
                  variant="ghost"
                  onClick={() => setShowAnalysisModal(false)}
                  className="text-slate-400"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={() => handleProvideFeedback()}
                  className="bg-green-600 hover:bg-green-700 gap-1"
                >
                  <Check className="h-4 w-4" />
                  Aprobar Documento
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
