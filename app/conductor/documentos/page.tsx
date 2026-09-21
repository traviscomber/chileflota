'use client'

import { useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Upload, CheckCircle2, AlertCircle, Loader, Download, Clock, Trash2 } from 'lucide-react'
import { useDocumentSync } from '@/contexts/document-sync-context'
import { DatePeriodFilter } from '@/components/date-period-filter'
import { ALL_VALUE, filterByMonthYear, type DateFilterValue } from '@/lib/date-filters'
import { buildDocumentAccessUrl } from '@/lib/document-file-access'
import { getDocumentPeriodDate, getDocumentPeriodLabel } from '@/lib/document-period'

interface UploadedDocument {
  id: string
  document_type: string
  document_type_id?: string
  document_type_code?: string
  document_type_name?: string
  extracted_document_type: string | null
  file_name: string
  file_url: string
  validation_status: 'pending' | 'approved' | 'validated' | 'rejected' | 'expired'
  extraction_confidence: number | null
  created_at: string
  expiration_date?: string
  rejection_reason?: string
  document_period_month?: number | string | null
  document_period_year?: number | string | null
  document_period_start?: string | null
}

interface RequiredDocument {
  type: string
  label: string
  description: string
  uploaded?: UploadedDocument
}

const DOCUMENT_TYPES = [
  { id: 'LIC_CONDUCIR', label: 'Licencia de Conducir', code: 'LIC_CONDUCIR' },
  { id: 'HOJA_VIDA', label: 'Hoja de Vida', code: 'HOJA_VIDA' },
  { id: 'CERT_ANTECEDENTES', label: 'Certificado de Antecedentes', code: 'CERT_ANTECEDENTES' },
  { id: 'CEDULA_IDENTIDAD', label: 'Cédula de Identidad', code: 'CEDULA_IDENTIDAD' },
  { id: 'INHABILIDADES_MENORES', label: 'Inhabilidades Menores', code: 'INHABILIDADES_MENORES' },
  { id: 'CONTRATO_TRABAJO', label: 'Contrato de Trabajo', code: 'CONTRATO_TRABAJO' },
  { id: 'CERT_AFP', label: 'Certificado AFP', code: 'CERT_AFP' },
  { id: 'REVISION_TECNICA', label: 'Revisión Técnica', code: 'REVISION_TECNICA' },
  { id: 'SOAP', label: 'Seguro Obligatorio (SOAP)', code: 'SOAP' },
]

const REQUIRED_DOCUMENTS: RequiredDocument[] = [
  {
    type: 'LIC_CONDUCIR',
    label: 'Licencia de Conducir',
    description: 'Vigente, categoría mínima B'
  },
  {
    type: 'CERT_ANTECEDENTES',
    label: 'Certificado de Antecedentes',
    description: 'Emitido por Carabineros (no más de 6 meses)'
  },
  {
    type: 'HOJA_VIDA',
    label: 'Hoja de Vida',
    description: 'Hoja de vida del conductor'
  },
  {
    type: 'CEDULA_IDENTIDAD',
    label: 'Cédula de Identidad',
    description: 'Vigente y legible'
  },
  {
    type: 'INHABILIDADES_MENORES',
    label: 'Inhabilidades Menores',
    description: 'Registro de inhabilidades para trabajar con menores'
  },
  {
    type: 'CONTRATO_TRABAJO',
    label: 'Contrato de Trabajo',
    description: 'Contrato vigente'
  },
  {
    type: 'CERT_AFP',
    label: 'Certificado AFP',
    description: 'Cotizaciones previsionales al día'
  },
  {
    type: 'REVISION_TECNICA',
    label: 'Revisión Técnica',
    description: 'VTV vigente del vehículo'
  },
  {
    type: 'SOAP',
    label: 'Seguro Obligatorio (SOAP)',
    description: 'Seguro obligatorio del vehículo vigente'
  }
]

export default function ConductorDocumentosPage() {
  const [documents, setDocuments] = useState<UploadedDocument[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isUploading, setIsUploading] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [conductorId, setConductorId] = useState<string>('')
  const { broadcastSync } = useDocumentSync()
  const [compliancePercentage, setCompliancePercentage] = useState(0)
  const [selectedDocumentType, setSelectedDocumentType] = useState('LIC_CONDUCIR')
  const [documentDate, setDocumentDate] = useState(() => { const d = new Date(); const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000); return local.toISOString().split('T')[0] })
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const [archiveFilters, setArchiveFilters] = useState<DateFilterValue>({
    month: searchParams.get('month') || ALL_VALUE,
    year: searchParams.get('year') || ALL_VALUE,
  })

  useEffect(() => {
    fetchDocuments()
  }, [])

  useEffect(() => {
    const approvedCount = REQUIRED_DOCUMENTS.filter((reqDoc) => {
      const latest = documents
        .filter((doc) =>
          [doc.document_type_id, doc.document_type, doc.document_type_code]
            .some((value) => normalizeDocumentCode(value) === normalizeDocumentCode(reqDoc.type))
        )
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]

      return latest && ['approved', 'validated'].includes(latest.validation_status)
    }).length

    setCompliancePercentage(Math.round((approvedCount / REQUIRED_DOCUMENTS.length) * 100))
  }, [documents])

  useEffect(() => {
    const month = searchParams.get('month') || ALL_VALUE
    const year = searchParams.get('year') || ALL_VALUE
    setArchiveFilters({ month, year })
  }, [searchParams])

  const updateArchiveFilters = (next: DateFilterValue) => {
    setArchiveFilters(next)
    const params = new URLSearchParams(searchParams.toString())

    if (next.month === ALL_VALUE) params.delete('month')
    else params.set('month', next.month)

    if (next.year === ALL_VALUE) params.delete('year')
    else params.set('year', next.year)

    const query = params.toString()
    router.replace(query ? `${pathname}?${query}` : pathname)
  }

  const fetchDocuments = async () => {
    try {
      setIsLoading(true)
      setError('')
      const response = await fetch('/api/conductor/documents')
      
      if (!response.ok) {
        if (response.status === 401) {
          setError('Sesión expirada. Por favor, inicia sesión nuevamente.')
          return
        }
        throw new Error(`HTTP ${response.status}`)
      }
      
      const data = await response.json()
      if (data.success && Array.isArray(data.documents)) {
        setDocuments(data.documents)
      } else {
        setDocuments([])
      }
    } catch (err) {
      console.error('Error fetching documents:', err)
      setError('No se pudieron cargar los documentos. Intenta nuevamente.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleFileUpload = async (file: File) => {
    if (!file) return

    const match = /^(\d{4})-(\d{2})-\d{2}$/.exec(documentDate)
    const uploadYear = match?.[1] || String(new Date().getFullYear())
    const uploadMonth = match?.[2] || String(new Date().getMonth() + 1).padStart(2, '0')
    const now = new Date()
    const currentMonth = String(now.getMonth() + 1).padStart(2, '0')
    const currentYear = String(now.getFullYear())

    if (uploadMonth !== currentMonth || uploadYear !== currentYear) {
      const periodLabel = new Date(Number(uploadYear), Number(uploadMonth) - 1, 1).toLocaleDateString('es-CL', {
        month: 'long',
        year: 'numeric',
      })
      const confirmed = window.confirm(
        `Estás subiendo este documento para ${periodLabel}. Quedará asociado a ese período histórico. ¿Confirmas?`
      )
      if (!confirmed) return
    }

    setIsUploading(true)
    setError('')
    setSuccess('')

    try {
      const formData = new FormData()
      formData.append('file', file)
      // Use selected document type
      formData.append('documentType', selectedDocumentType)
      formData.append('documentDate', documentDate)
      formData.append('documentPeriodMonth', uploadMonth)
      formData.append('documentPeriodYear', uploadYear)

      // Fetch uses Supabase cookies automatically (set during login)
      const response = await fetch('/api/conductor/upload-document', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.message || data.error || 'Error al subir documento')
      }

      const result = await response.json()
      setSuccess('Documento recibido correctamente. Quedó en revisión; no necesitas volver a subirlo.')
      
      // Broadcast sync event so dashboard and other components update
      if (result.syncEvent) {
        console.log('[v0] Conductor page: Broadcasting upload sync event')
        broadcastSync({
          type: 'document_uploaded',
          conductorId: result.syncEvent.conductorId || conductorId,
          documentId: result.syncEvent.documentId || result.documentId,
          timestamp: result.syncEvent.timestamp || Date.now(),
          data: { file: file.name, validationStatus: result.validationStatus }
        })
      }
      
      await fetchDocuments()
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Error al subir documento'
      setError(errorMsg)
    } finally {
      setIsUploading(false)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const files = e.dataTransfer.files
    if (files.length > 0) {
      handleFileUpload(files[0])
    }
  }

  const handleDeleteDocument = async (documentId: string, fileName: string) => {
    if (!confirm(`¿Seguro que quieres eliminar "${fileName}"? Esta acción no se puede deshacer.`)) {
      return
    }

    try {
      setIsUploading(true)
      const response = await fetch(`/api/conductor/documents/${documentId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.message || 'Error al eliminar documento')
      }

      setSuccess('Documento eliminado exitosamente.')
      await fetchDocuments()
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Error al eliminar documento'
      setError(errorMsg)
    } finally {
      setIsUploading(false)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      handleFileUpload(file)
    }
  }

  const getStatusBadge = (status: string, expirationDate?: string) => {
    if (expirationDate) {
      const expDate = new Date(expirationDate)
      const daysUntilExpiry = Math.ceil((expDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      
      if (daysUntilExpiry < 0) {
        return <Badge className="bg-[var(--cf-danger-soft)] text-[var(--cf-danger)] border border-[var(--cf-danger)]/40">Vencido</Badge>
      } else if (daysUntilExpiry < 7) {
        return <Badge className="bg-[var(--cf-expiring-soft)] text-[var(--cf-expiring)] border border-[var(--cf-expiring)]/40">Vence en {daysUntilExpiry} días</Badge>
      }
    }

    switch (status) {
      case 'approved':
      case 'validated':
        return <Badge className="bg-green-900/30 text-[var(--cf-success)] border border-[var(--cf-success)]/40">Aprobado</Badge>
      case 'rejected':
        return <Badge className="bg-[var(--cf-danger-soft)] text-[var(--cf-danger)] border border-[var(--cf-danger)]/40">Rechazado</Badge>
      case 'expired':
        return <Badge className="bg-[var(--cf-danger-soft)] text-[var(--cf-danger)] border border-[var(--cf-danger)]/40">Vencido</Badge>
      default:
        return <Badge className="bg-[var(--cf-surface-raised)] text-[var(--cf-text-secondary)] border border-[var(--cf-border)]">En revisión</Badge>
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
      case 'validated':
        return <CheckCircle2 className="h-5 w-5 text-[var(--cf-success)]" />
      case 'rejected':
      case 'expired':
        return <AlertCircle className="h-5 w-5 text-[var(--cf-danger)]" />
      default:
        return <Clock className="h-5 w-5 text-[var(--cf-warning)]" />
    }
  }

  const getDisplayFileName = (fileName?: string) => {
    if (!fileName) return null
    if (/^inbound\d+\.[a-z0-9]+$/i.test(fileName.trim())) return null
    return fileName.trim()
  }

  const normalizeDocumentCode = (value?: string | null) => {
    if (!value) return ''
    const normalized = value.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '')
    const aliases: Record<string, string> = {
      LICENCIA_CONDUCIR: 'LIC_CONDUCIR',
      HOJA_VIDA_CONDUCTOR: 'HOJA_VIDA',
      CERTIFICADO_ANTECEDENTES: 'CERT_ANTECEDENTES',
      CEDULA_IDENTIDAD: 'CEDULA_IDENTIDAD',
      REVISION_TECNICA: 'REVISION_TECNICA',
      SEGURO_OBLIGATORIO_SOAP: 'SOAP',
    }
    return aliases[normalized] || normalized
  }

  const getDocumentLabel = (doc: UploadedDocument) =>
    doc.document_type_name ||
    DOCUMENT_TYPES.find((type) =>
      normalizeDocumentCode(type.code) === normalizeDocumentCode(doc.document_type_id) ||
      normalizeDocumentCode(type.code) === normalizeDocumentCode(doc.document_type) ||
      normalizeDocumentCode(type.code) === normalizeDocumentCode(doc.document_type_code)
    )?.label ||
    doc.document_type ||
    'Documento'

  const getDocumentByType = (type: string) => {
    const target = normalizeDocumentCode(type)
    return documents
      .filter((d) =>
        [d.document_type_id, d.document_type, d.document_type_code]
          .some((value) => normalizeDocumentCode(value) === target)
      )
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]
  }

  const isExpiringSoon = (doc?: UploadedDocument) => {
    if (!doc?.expiration_date || !['approved', 'validated'].includes(doc.validation_status)) return false
    const days = Math.ceil((new Date(doc.expiration_date).getTime() - Date.now()) / 86400000)
    return days >= 0 && days <= 30
  }

  const needsAction = (doc?: UploadedDocument) => {
    if (!doc) return true
    if (['rejected', 'expired'].includes(doc.validation_status)) return true
    if (doc.expiration_date && new Date(doc.expiration_date).getTime() < Date.now()) return true
    return false
  }

  const focusUploadFor = (documentType: string) => {
    setSelectedDocumentType(documentType)
    document.getElementById('upload-document')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const requiredDocumentsByPriority = [...REQUIRED_DOCUMENTS].sort((a, b) => {
    const aDoc = getDocumentByType(a.type)
    const bDoc = getDocumentByType(b.type)
    const rank = (doc?: UploadedDocument) => {
      if (needsAction(doc)) return 0
      if (isExpiringSoon(doc)) return 1
      if (doc?.validation_status === 'pending') return 2
      return 3
    }
    return rank(aDoc) - rank(bDoc)
  })

  const historicalDocuments = useMemo(() => {
    return filterByMonthYear(
      documents,
      (doc) => getDocumentPeriodDate(doc) || doc.created_at,
      archiveFilters.month,
      archiveFilters.year
    ).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  }, [documents, archiveFilters.month, archiveFilters.year])

  const documentSummary = useMemo(() => {
    const current = REQUIRED_DOCUMENTS.map((required) =>
      documents
        .filter((doc) =>
          [doc.document_type_id, doc.document_type, doc.document_type_code]
            .some((value) => normalizeDocumentCode(value) === normalizeDocumentCode(required.type))
        )
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]
    )

    const approved = current.filter((doc) => doc && ['approved', 'validated'].includes(doc.validation_status) && !isExpiringSoon(doc)).length
    const inReview = current.filter((doc) => doc?.validation_status === 'pending').length
    const expiringSoon = current.filter((doc) => isExpiringSoon(doc)).length
    const actionRequired = current.filter((doc) => needsAction(doc)).length

    return { approved, inReview, expiringSoon, actionRequired }
  }, [documents])

  return (
      <div className="space-y-8">
        <div className="rounded-lg border border-[var(--cf-border)] bg-[var(--cf-surface)] px-4 py-3">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
            <span className="font-medium text-[var(--cf-success)]">{documentSummary.approved} al día</span>
            <span className="text-[var(--cf-text-secondary)]">{documentSummary.inReview} en revisión</span>
            {documentSummary.expiringSoon > 0 && (
              <span className="font-medium text-[var(--cf-expiring)]">{documentSummary.expiringSoon} por vencer</span>
            )}
            {documentSummary.actionRequired > 0 && (
              <span className="font-medium text-[var(--cf-danger)]">{documentSummary.actionRequired} requiere acción</span>
            )}
            <span className="ml-auto text-xs text-[var(--cf-text-muted)]">{compliancePercentage}% aprobado</span>
          </div>
        </div>

      {/* Alerts */}
      {error && (
        <Alert className="bg-[var(--cf-danger-soft)] border-[var(--cf-danger)]/40">
          <AlertCircle className="h-4 w-4 text-[var(--cf-danger)]" />
          <AlertDescription className="text-[var(--cf-danger)]">{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="bg-[var(--cf-success-soft)] border-[var(--cf-success)]/40">
          <CheckCircle2 className="h-4 w-4 text-[var(--cf-success)]" />
          <AlertDescription className="text-[var(--cf-success)]">{success}</AlertDescription>
        </Alert>
      )}

      {(documentSummary.actionRequired > 0 || documentSummary.expiringSoon > 0) && (
        <Alert className="border-[var(--cf-expiring)]/40 bg-[var(--cf-expiring-soft)]">
          <AlertCircle className="h-4 w-4 text-[var(--cf-expiring)]" />
          <AlertDescription className="text-[var(--cf-expiring)]">
            {documentSummary.actionRequired > 0 ? `${documentSummary.actionRequired} documento(s) requieren acción` : ''}
            {documentSummary.actionRequired > 0 && documentSummary.expiringSoon > 0 ? ' · ' : ''}
            {documentSummary.expiringSoon > 0 ? `${documentSummary.expiringSoon} por vencer` : ''}
          </AlertDescription>
        </Alert>
      )}

      {/* Documents Required */}
      <Card className="border-[var(--cf-border)] bg-[var(--cf-surface)] shadow-lg">
        <CardHeader>
          <CardTitle className="text-[var(--cf-text)]">Documentos requeridos</CardTitle>
          <CardDescription className="text-[var(--cf-text-muted)]">Lo que está pendiente aparece primero.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader className="h-6 w-6 animate-spin text-orange-500" />
            </div>
          ) : (
            <div className="space-y-3">
              {requiredDocumentsByPriority.map((reqDoc) => {
                const uploadedDoc = getDocumentByType(reqDoc.type)
                return (
                  <div
                    key={reqDoc.type}
                    className="flex flex-col gap-3 rounded-lg border border-[var(--cf-border)] bg-[var(--cf-surface)] p-4 transition-all hover:bg-[var(--cf-surface)] sm:flex-row sm:items-center sm:justify-between"
                  >
                  <div className="flex items-center gap-4 flex-1">
                    <div className="flex-shrink-0">
                      {uploadedDoc ? (
                        getStatusIcon(uploadedDoc.validation_status)
                      ) : (
                        <div className="h-5 w-5 rounded-full border-2 border-[var(--cf-border)]" />
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-[var(--cf-text)]">{reqDoc.label}</p>
                      <p className="text-sm text-[var(--cf-text-secondary)]">{reqDoc.description}</p>
                      {getDisplayFileName(uploadedDoc?.file_name) && (
                        <p className="mt-1 text-xs text-[var(--cf-text-muted)]">{getDisplayFileName(uploadedDoc?.file_name)}</p>
                      )}
                      {uploadedDoc?.validation_status === 'pending' && (
                        <p className="mt-1 text-xs text-[var(--cf-warning)]">Recibido correctamente. No necesitas volver a subirlo.</p>
                      )}
                      {isExpiringSoon(uploadedDoc) && (
                        <p className="mt-1 text-xs font-medium text-[var(--cf-expiring)]">Próximo a vencer. Conviene renovarlo antes de que afecte tu habilitación.</p>
                      )}
                        {uploadedDoc?.rejection_reason && (
                          <div className="mt-2 rounded-md border border-[var(--cf-danger)]/40 bg-[var(--cf-danger-soft)] px-3 py-2">
                            <p className="text-xs font-medium uppercase tracking-wide text-[var(--cf-danger)]">Requiere acción</p>
                            <p className="mt-1 text-sm text-[var(--cf-danger)]">Motivo: {uploadedDoc.rejection_reason}</p>
                            <p className="mt-1 text-xs text-[var(--cf-danger)]">Sube una nueva versión de este documento.</p>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex w-full items-center justify-between gap-2 sm:w-auto sm:justify-end">
                      {(needsAction(uploadedDoc) || isExpiringSoon(uploadedDoc)) && (
                        <Button
                          type="button"
                          size="sm"
                          className="bg-[var(--cf-accent)] text-[var(--cf-text)] hover:bg-[var(--cf-accent-hover)]"
                          onClick={() => focusUploadFor(reqDoc.type)}
                        >
                          {uploadedDoc ? 'Reemplazar' : 'Subir'}
                        </Button>
                      )}
                      {uploadedDoc ? (
                        <>
                          {getStatusBadge(uploadedDoc.validation_status, uploadedDoc.expiration_date)}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-[var(--cf-text-muted)] hover:text-[var(--cf-text)]"
                            asChild
                          >
                            <a href={buildDocumentAccessUrl(uploadedDoc.file_url, 'download')} target="_blank" rel="noopener noreferrer">
                              <Download className="h-4 w-4" />
                            </a>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-[var(--cf-text-muted)] hover:text-[var(--cf-danger)]"
                            onClick={() => handleDeleteDocument(uploadedDoc.id, uploadedDoc.file_name || 'Documento')}
                            disabled={isUploading}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      ) : (
                        <Badge variant="outline" className="border-[var(--cf-border)] text-[var(--cf-text-muted)]">No subido</Badge>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upload Section */}
      <Card id="upload-document" className="scroll-mt-6 border-[var(--cf-border)] bg-[var(--cf-surface)] shadow-lg">
        <CardHeader>
          <CardTitle className="text-[var(--cf-text)]">Subir documento</CardTitle>
          <CardDescription className="text-[var(--cf-text-muted)]">
            Sube un documento nuevo o reemplaza uno observado. Puedes usar una fecha anterior; el sistema confirmará el período antes de guardar.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-[var(--cf-text-secondary)]">
                Tipo de documento
              </label>
            <select
              value={selectedDocumentType}
              onChange={(e) => setSelectedDocumentType(e.target.value)}
              className="w-full rounded-lg border border-[var(--cf-border)] bg-[var(--cf-surface)] px-4 py-2 text-[var(--cf-text)] transition-colors focus:border-orange-500 focus:outline-none"
            >
              {DOCUMENT_TYPES.map((doc) => (
                <option key={doc.id} value={doc.code}>
                  {doc.label}
                </option>
              ))}
              </select>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-[var(--cf-text-secondary)]">
                Fecha del documento
              </label>
              <input
                type="date"
                value={documentDate}
                onChange={(e) => setDocumentDate(e.target.value)}
                max={(() => { const d = new Date(); const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000); return local.toISOString().split('T')[0] })()}
                className="w-full rounded-lg border border-[var(--cf-border)] bg-[var(--cf-surface)] px-4 py-2 text-[var(--cf-text)] transition-colors focus:border-orange-500 focus:outline-none"
              />
              <p className="mt-1 text-xs text-[var(--cf-text-muted)]">Esta fecha define el período histórico del documento.</p>
            </div>
          </div>

          <label
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`flex h-32 w-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed transition-all ${
              isDragging
                ? 'border-orange-500/50 bg-[var(--cf-accent)]/10'
                : 'border-[var(--cf-border)] bg-[var(--cf-surface)] hover:bg-[var(--cf-surface)]'
            }`}
          >
            <Upload className={`mb-2 h-8 w-8 ${isDragging ? 'text-[var(--cf-expiring)]' : 'text-[var(--cf-text-muted)]'}`} />
            <p className="text-sm font-semibold text-[var(--cf-text-secondary)]">
              {isDragging ? 'Suelta el archivo aquí' : 'Arrastra un archivo o haz clic'}
            </p>
            <p className="mt-1 text-xs text-[var(--cf-text-muted)]">PDF, JPG o PNG · máximo 10 MB</p>
            <input
              type="file"
              className="hidden"
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={handleInputChange}
              disabled={isUploading}
            />
          </label>

          {isUploading && (
            <div className="flex items-center justify-center gap-2">
              <Loader className="h-4 w-4 animate-spin text-orange-500" />
              <span className="text-sm text-[var(--cf-text-secondary)]">Subiendo documento...</span>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-[var(--cf-border)] bg-[var(--cf-surface)] shadow-lg">
        <CardHeader>
          <CardTitle className="text-[var(--cf-text)]">Historial documental</CardTitle>
          <CardDescription className="text-[var(--cf-text-muted)]">
            Consulta documentos por período
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <DatePeriodFilter
            value={archiveFilters}
            onChange={updateArchiveFilters}
            onClear={() => updateArchiveFilters({ month: ALL_VALUE, year: ALL_VALUE })}
          />

          {historicalDocuments.length === 0 ? (
            <div className="rounded-lg border border-[var(--cf-border)] bg-[var(--cf-canvas)]/60 p-6 text-center text-[var(--cf-text-muted)]">
              No hay documentos en el período seleccionado.
            </div>
          ) : (
            <div className="grid gap-3">
              {historicalDocuments.map((doc) => (
                <div key={doc.id} className="flex items-center justify-between gap-4 rounded-lg border border-[var(--cf-border)] bg-[var(--cf-canvas)]/50 p-4">
                  <div className="min-w-0">
                    <p className="font-medium text-[var(--cf-text)] truncate">
                      {getDocumentLabel(doc)}
                    </p>
                    {getDisplayFileName(doc.file_name) && (
                      <p className="mt-0.5 truncate text-xs text-[var(--cf-text-muted)]">{getDisplayFileName(doc.file_name)}</p>
                    )}
                    <p className="text-sm text-[var(--cf-text-muted)]">
                      Período: {getDocumentPeriodLabel(doc)} · Subido: {new Date(doc.created_at).toLocaleDateString('es-CL')}
                      {doc.expiration_date ? ` • Vence: ${new Date(doc.expiration_date).toLocaleDateString('es-CL')}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {getStatusBadge(doc.validation_status, doc.expiration_date)}
                    <Button variant="ghost" size="sm" className="text-[var(--cf-text-muted)] hover:text-[var(--cf-text)]" asChild>
                      <a href={buildDocumentAccessUrl(doc.file_url, 'download')} target="_blank" rel="noopener noreferrer">
                        <Download className="h-4 w-4" />
                      </a>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
