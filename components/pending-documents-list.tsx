'use client'

import { useState, useEffect, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Clock, ArrowLeft, FileText, Check, X, Loader2, Download, Sparkles, ChevronUp, ChevronDown } from "lucide-react"
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
  document_source?: 'conductor' | 'subcontractor'
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
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null)
  const [inboxSource, setInboxSource] = useState<'all' | 'conductor' | 'subcontractor'>('all')
  const [sessionReviewed, setSessionReviewed] = useState(0)
  const [statusMessage, setStatusMessage] = useState('')

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

  const getWaitDays = (doc: PendingDocument) => {
    const rawDate = doc.uploaded_at || doc.created_at
    if (!rawDate) return null
    const time = new Date(rawDate).getTime()
    if (!Number.isFinite(time)) return null
    return Math.max(0, Math.floor((Date.now() - time) / 86400000))
  }

  const getWaitLabel = (doc: PendingDocument) => {
    const days = getWaitDays(doc)
    if (days === null) return 'Sin fecha'
    if (days === 0) return 'Hoy'
    if (days === 1) return '1 día'
    return `${days} días`
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


  const getDocumentSource = (doc: PendingDocument): 'conductor' | 'subcontractor' => {
    if (doc.document_source === 'conductor' || doc.document_source === 'subcontractor') return doc.document_source
    return propConductorDocs.some((item) => item.id === doc.id) ? 'conductor' : 'subcontractor'
  }

  const inboxDocs = useMemo(() => {
    const sourceFiltered = inboxSource === 'all'
      ? filteredDocs
      : filteredDocs.filter((doc) => getDocumentSource(doc) === inboxSource)

    return [...sourceFiltered].sort((a, b) => {
      const aTime = new Date(a.uploaded_at || a.created_at || 0).getTime()
      const bTime = new Date(b.uploaded_at || b.created_at || 0).getTime()
      return aTime - bTime
    })
  }, [filteredDocs, inboxSource, propConductorDocs])

  const selectedDoc = inboxDocs.find((doc) => doc.id === selectedDocId) || inboxDocs[0] || null

  useEffect(() => {
    if (!selectedDocId || !inboxDocs.some((doc) => doc.id === selectedDocId)) {
      setSelectedDocId(inboxDocs[0]?.id || null)
    }
  }, [inboxDocs, selectedDocId])

  const selectedCompany = selectedDoc?.transportistas
    ? (Array.isArray(selectedDoc.transportistas) ? selectedDoc.transportistas[0] : selectedDoc.transportistas)
    : null
  const selectedConductor = selectedDoc?.conductores
    ? (Array.isArray(selectedDoc.conductores) ? selectedDoc.conductores[0] : selectedDoc.conductores)
    : null
  const selectedSource = selectedDoc ? getDocumentSource(selectedDoc) : 'subcontractor'
  const selectedIndex = selectedDoc ? inboxDocs.findIndex((doc) => doc.id === selectedDoc.id) : -1

  const selectRelative = (offset: number) => {
    if (!inboxDocs.length) return
    const current = selectedIndex >= 0 ? selectedIndex : 0
    const next = Math.min(inboxDocs.length - 1, Math.max(0, current + offset))
    setSelectedDocId(inboxDocs[next]?.id || null)
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target?.closest('input, textarea, [role="combobox"], [contenteditable="true"]')) return

      if (event.key === 'ArrowDown') {
        event.preventDefault()
        selectRelative(1)
      } else if (event.key === 'ArrowUp') {
        event.preventDefault()
        selectRelative(-1)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [inboxDocs, selectedIndex])

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
      setSessionReviewed((count) => count + 1)
      setStatusMessage(`Documento ${newStatus === 'aprobado' ? 'aprobado' : 'rechazado'}. Continuando con el siguiente.`)

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

      setTimeout(() => setStatusMessage(''), 3000)

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
    <div className="space-y-4">
      <div aria-live="polite" className="sr-only">{statusMessage}</div>
      <div className="flex flex-col gap-4 border-b border-[var(--cf-border)] pb-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex items-start gap-3">
          <Link href="/dashboard/company">
            <Button variant="ghost" size="sm" className="mt-0.5 gap-2">
              <ArrowLeft className="h-4 w-4" />
              Inicio
            </Button>
          </Link>
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-[var(--cf-text-muted)]">Bandeja de trabajo</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-[var(--cf-text)]">
              Documentos pendientes
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
              <span className="text-[var(--cf-text-secondary)]">
                {totalPendientes.toLocaleString('es-CL')} por revisar
              </span>
              <span className="text-[var(--cf-text-muted)]">·</span>
              <span className="text-[var(--cf-success)]">
                {sessionReviewed.toLocaleString('es-CL')} resueltos en esta sesión
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {([
            ['all', 'Todos', totalPendientes],
            ['subcontractor', 'Empresas', subDocs.length],
            ['conductor', 'Conductores', conductorDocs.length],
          ] as const).map(([value, label, count]) => (
            <Button
              key={value}
              type="button"
              variant={inboxSource === value ? 'default' : 'outline'}
              size="sm"
              onClick={() => setInboxSource(value)}
              className="gap-2"
            >
              {label}
              <span className="text-xs opacity-70">{count.toLocaleString('es-CL')}</span>
            </Button>
          ))}
        </div>
      </div>

      <DocumentFilter
        onFilterChange={setFilters}
        executives={executives}
        companies={companies}
        documentTypes={documentTypes}
        compact
        hideExecutive
      />

      <div className="grid min-h-[70vh] overflow-hidden rounded-[6px] border border-[var(--cf-border)] bg-[var(--cf-surface)] lg:grid-cols-[360px_minmax(0,1fr)] xl:grid-cols-[400px_minmax(0,1fr)]">
        <aside className="border-b border-[var(--cf-border)] lg:border-b-0 lg:border-r">
          <div className="flex items-center justify-between border-b border-[var(--cf-border)] px-4 py-3">
            <div>
              <p className="text-sm font-medium text-[var(--cf-text)]">Pendientes</p>
              <div className="mt-0.5 flex items-center gap-2 text-xs text-[var(--cf-text-muted)]">
                <span>{inboxDocs.length.toLocaleString('es-CL')} visibles</span>
                <span aria-hidden="true">·</span>
                <span>más antiguos primero</span>
              </div>
            </div>
            <Clock className="h-4 w-4 text-[#D9B65C]" />
          </div>

          <div className="max-h-[38vh] overflow-y-auto lg:max-h-[70vh]">
            {inboxDocs.length === 0 ? (
              <div className="px-5 py-12 text-center">
                <Check className="mx-auto h-5 w-5 text-[#67C18D]" />
                <p className="mt-3 text-sm font-medium text-[var(--cf-text)]">Bandeja al día</p>
                <p className="mt-1 text-xs leading-5 text-[var(--cf-text-muted)]">
                  No hay documentos pendientes con estos filtros.
                </p>
              </div>
            ) : (
              inboxDocs.map((doc) => {
                const source = getDocumentSource(doc)
                const company = doc.transportistas
                  ? (Array.isArray(doc.transportistas) ? doc.transportistas[0] : doc.transportistas)
                  : null
                const conductor = doc.conductores
                  ? (Array.isArray(doc.conductores) ? doc.conductores[0] : doc.conductores)
                  : null
                const isSelected = selectedDoc?.id === doc.id

                return (
                  <button
                    key={doc.id}
                    type="button"
                    onClick={() => setSelectedDocId(doc.id)}
                    aria-pressed={isSelected}
                    className={`w-full border-b border-[var(--cf-border)] px-4 py-3 text-left transition-colors ${
                      isSelected ? 'bg-[var(--cf-surface-2)] shadow-[inset_2px_0_0_var(--cf-burgundy)]' : 'hover:bg-[var(--cf-bg)]'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="truncate text-sm font-medium text-[var(--cf-text)]">
                            {company?.razon_social || doc.empresa_nombre || (conductor ? `${conductor.nombres} ${conductor.apellido_paterno}` : 'Sin empresa')}
                          </p>
                          <span className={`flex-none text-[10px] font-medium ${
                            (getWaitDays(doc) || 0) >= 7 ? 'text-[var(--cf-warning)]' : 'text-[var(--cf-text-muted)]'
                          }`}>{getWaitLabel(doc)}</span>
                        </div>
                        <div className="mt-1 flex min-w-0 items-center gap-2">
                          <span className="flex-none text-[9px] font-semibold uppercase tracking-[0.12em] text-[var(--cf-text-muted)]">
                            {source === 'conductor' ? 'Conductor' : 'Empresa'}
                          </span>
                          <span className="truncate text-xs text-[var(--cf-text-secondary)]">
                            {getDocumentTypeLabel(doc)}
                          </span>
                        </div>
                        <div className="mt-1 flex min-w-0 items-center gap-2 text-[11px] text-[var(--cf-text-muted)]">
                          <span className="truncate">{doc.original_filename || doc.file_name || 'Documento sin nombre'}</span>
                          <span className="flex-none">· {getDocumentPeriod(doc)}</span>
                        </div>
                      </div>
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </aside>

        <section className="min-w-0">
          {!selectedDoc ? (
            <div className="flex h-full min-h-[520px] items-center justify-center px-6 text-center">
              <div>
                <FileText className="mx-auto h-6 w-6 text-[var(--cf-text-muted)]" />
                <p className="mt-3 text-sm font-medium text-[var(--cf-text)]">Selecciona un documento</p>
                <p className="mt-1 text-xs text-[var(--cf-text-muted)]">La revisión aparecerá aquí.</p>
              </div>
            </div>
          ) : (
            <div className="flex h-full min-h-[620px] flex-col">
              <div className="sticky top-0 z-10 border-b border-[var(--cf-border)] bg-[var(--cf-surface)] px-5 py-4">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {selectedSource === 'conductor' ? 'Conductor' : 'Empresa'}
                      </Badge>
                      <Badge variant="outline" className={getDocumentTypeChipClass(selectedDoc)}>
                        {getDocumentTypeLabel(selectedDoc)}
                      </Badge>
                      <span className="text-xs text-[var(--cf-text-muted)]">Período {getDocumentPeriod(selectedDoc)}</span>
                    </div>
                    <h2 className="mt-3 truncate text-lg font-semibold text-[var(--cf-text)]">
                      {selectedDoc.original_filename || selectedDoc.file_name || 'Documento'}
                    </h2>
                    <p className="mt-1 text-sm text-[var(--cf-text-secondary)]">
                      {selectedCompany?.razon_social || selectedDoc.empresa_nombre || 'Sin empresa'}
                      {selectedCompany?.rut ? ` · ${selectedCompany.rut}` : ''}
                    </p>
                    {selectedConductor && (
                      <p className="mt-1 text-xs text-[var(--cf-text-muted)]">
                        {selectedConductor.nombres} {selectedConductor.apellido_paterno} · {selectedConductor.rut}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <div className="mr-1 flex items-center rounded-[5px] border border-[var(--cf-border)]">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => selectRelative(-1)}
                        disabled={selectedIndex <= 0}
                        className="h-8 rounded-r-none px-2 text-[var(--cf-text-muted)]"
                        aria-label="Documento anterior"
                        title="Documento anterior · Flecha arriba"
                      >
                        <ChevronUp className="h-3.5 w-3.5" />
                      </Button>
                      <span className="min-w-[58px] border-x border-[var(--cf-border)] px-2 text-center text-[10px] text-[var(--cf-text-muted)]">
                        {selectedIndex + 1} / {inboxDocs.length}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => selectRelative(1)}
                        disabled={selectedIndex < 0 || selectedIndex >= inboxDocs.length - 1}
                        className="h-8 rounded-l-none px-2 text-[var(--cf-text-muted)]"
                        aria-label="Documento siguiente"
                        title="Documento siguiente · Flecha abajo"
                      >
                        <ChevronDown className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleAnalyzeDocument(selectedDoc.id, selectedSource)}
                      disabled={analyzing === selectedDoc.id || loading === selectedDoc.id}
                      className="gap-1"
                    >
                      {analyzing === selectedDoc.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                      Analizar IA
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRejectClick(selectedDoc.id, selectedSource)}
                      disabled={loading === selectedDoc.id}
                      className="gap-1 border-red-500/40 text-red-300 hover:bg-red-500/10"
                    >
                      <X className="h-3.5 w-3.5" />
                      Rechazar
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleApprove(selectedDoc.id, selectedSource)}
                      disabled={loading === selectedDoc.id}
                      className="gap-1 bg-green-700 hover:bg-green-600"
                    >
                      {loading === selectedDoc.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                      Aprobar
                    </Button>
                  </div>
                </div>
              </div>

              <div className="grid flex-1 lg:grid-cols-[minmax(0,1fr)_240px]">
                <div className="min-h-[460px] border-b border-[var(--cf-border)] bg-[var(--cf-bg)] p-4 lg:border-b-0 lg:border-r">
                  {selectedDoc.file_url ? (
                    selectedDoc.file_url.toLowerCase().includes('.pdf') ? (
                      <PDFViewer
                        url={selectedDoc.file_url}
                        filename={selectedDoc.original_filename || selectedDoc.file_name || 'document.pdf'}
                      />
                    ) : (
                      <div className="flex h-full min-h-[440px] items-center justify-center overflow-auto rounded-[6px] bg-black/20 p-3">
                        <img
                          src={selectedDoc.file_url}
                          alt={selectedDoc.original_filename || selectedDoc.file_name || 'Documento'}
                          className="max-h-[64vh] max-w-full object-contain"
                        />
                      </div>
                    )
                  ) : (
                    <div className="flex min-h-[440px] items-center justify-center text-sm text-[var(--cf-text-muted)]">
                      Este documento no tiene archivo disponible.
                    </div>
                  )}
                </div>

                <div className="space-y-5 p-4">
                  <div>
                    <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--cf-text-muted)]">Contexto</p>
                    <dl className="mt-3 space-y-3 text-xs">
                      <div>
                        <dt className="text-[var(--cf-text-muted)]">Empresa</dt>
                        <dd className="mt-0.5 text-[var(--cf-text)]">{selectedCompany?.razon_social || selectedDoc.empresa_nombre || 'Sin empresa'}</dd>
                      </div>
                      <div>
                        <dt className="text-[var(--cf-text-muted)]">RUT</dt>
                        <dd className="mt-0.5 text-[var(--cf-text)]">{selectedCompany?.rut || selectedDoc.subcontractor_rut || selectedConductor?.rut || '—'}</dd>
                      </div>
                      <div>
                        <dt className="text-[var(--cf-text-muted)]">Tipo</dt>
                        <dd className="mt-0.5 text-[var(--cf-text)]">{getDocumentTypeLabel(selectedDoc)}</dd>
                      </div>
                      <div>
                        <dt className="text-[var(--cf-text-muted)]">Período</dt>
                        <dd className="mt-0.5 text-[var(--cf-text)]">{getDocumentPeriod(selectedDoc)}</dd>
                      </div>
                      <div>
                        <dt className="text-[var(--cf-text-muted)]">Subido</dt>
                        <dd className="mt-0.5 text-[var(--cf-text)]">{getDocumentDate(selectedDoc)}</dd>
                      </div>
                      <div>
                        <dt className="text-[var(--cf-text-muted)]">En espera</dt>
                        <dd className={`mt-0.5 font-medium ${
                          (getWaitDays(selectedDoc) || 0) >= 7 ? 'text-[var(--cf-warning)]' : 'text-[var(--cf-text)]'
                        }`}>
                          {getWaitLabel(selectedDoc)}
                        </dd>
                      </div>
                    </dl>
                  </div>

                  {selectedDoc.file_url && (
                    <a
                      href={buildDocumentAccessUrl(selectedDoc.file_url, 'download')}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block"
                    >
                      <Button variant="outline" size="sm" className="w-full gap-2">
                        <Download className="h-3.5 w-3.5" />
                        Descargar
                      </Button>
                    </a>
                  )}

                  <div className="border-t border-[var(--cf-border)] pt-4 text-[11px] leading-5 text-[var(--cf-text-muted)]">
                    <p>Al resolver un documento, la bandeja avanza automáticamente.</p>
                    <p className="mt-1">Usa ↑ y ↓ para recorrer la cola sin soltar el teclado.</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>

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
