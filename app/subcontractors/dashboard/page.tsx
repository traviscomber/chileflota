'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AlertCircle, CheckCircle, Clock, LogOut, Upload, FileText, ShieldCheck } from 'lucide-react'
import { getDocumentPeriodDate, getDocumentPeriodLabel } from '@/lib/document-period'

interface DocumentType {
  id: string
  code: string
  nombre: string
  periodicidad: string
}

interface Document {
  id: string
  document_type_id: string
  file_name: string
  status: string
  uploaded_at: string
  document_period_month?: number | string | null
  document_period_year?: number | string | null
  document_period_start?: string | null
  expires_at: string
  rejection_reason?: string
  verification?: {
    advanced: boolean
    confidence: number | null
    plate: string | null
  } | null
}

interface TransportistaData {
  id: string
  rut: string
  nombre: string
}

export default function SubcontractorDashboardPage() {
  const router = useRouter()
  const [transportista, setTransportista] = useState<TransportistaData | null>(null)
  const [documentTypes, setDocumentTypes] = useState<DocumentType[]>([])
  const [documents, setDocuments] = useState<Document[]>([])
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [selectedDocType, setSelectedDocType] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [uploadSuccess, setUploadSuccess] = useState('')
  const [loading, setLoading] = useState(true)
  const today = new Date()
  const [selectedMonth, setSelectedMonth] = useState(String(today.getMonth() + 1).padStart(2, '0'))
  const [selectedYear, setSelectedYear] = useState(String(today.getFullYear()))
  const [documentDate, setDocumentDate] = useState(() => { const d = new Date(); const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000); return local.toISOString().split('T')[0] })

  const handleDocumentDateChange = (value: string) => {
    setDocumentDate(value)
  }

  useEffect(() => {
    fetchTransportistaData()
  }, [])

  const fetchTransportistaData = async () => {
    try {
      const response = await fetch('/api/auth/subcontractors/profile')
      if (!response.ok) {
        router.push('/subcontractors/login')
        return
      }
      const data = await response.json()
      setTransportista(data.transportista)

      if (data.transportista?.id) {
        await Promise.all([
          fetchDocumentTypes(),
          fetchDocuments(data.transportista.id),
        ])
      }
    } catch (error) {
      console.error('[v0] Error fetching profile:', error)
      router.push('/subcontractors/login')
    } finally {
      setLoading(false)
    }
  }

  const fetchDocumentTypes = async () => {
    try {
      const response = await fetch('/api/subcontractor-document-types')
      if (response.ok) {
        const data = await response.json()
        setDocumentTypes(data.documentTypes || [])
      }
    } catch (error) {
      console.error('[v0] Error fetching document types:', error)
    }
  }

  const fetchDocuments = async (transportistaId: string) => {
    try {
      const response = await fetch(`/api/subcontractors/${transportistaId}/documents`)
      if (response.ok) {
        const data = await response.json()
        setDocuments(data.documents || [])
      }
    } catch (error) {
      console.error('[v0] Error fetching documents:', error)
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const maxSize = 50 * 1024 * 1024
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg']

    if (!allowedTypes.includes(file.type)) {
      setUploadError('Solo se permiten: PDF, JPG, PNG')
      return
    }
    if (file.size > maxSize) {
      setUploadError(`Archivo muy grande. Máximo: 50MB. Tu archivo: ${(file.size / 1024 / 1024).toFixed(2)}MB`)
      return
    }
    if (file.size === 0) {
      setUploadError('El archivo está vacío')
      return
    }

    setSelectedFile(file)
    setUploadError('')
  }

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!selectedFile || !selectedDocType || !transportista) {
      setUploadError('Por favor completa todos los campos')
      return
    }

    const dateMatch = /^(\d{4})-(\d{2})-\d{2}$/.exec(documentDate)
    const uploadYear = dateMatch?.[1] || String(today.getFullYear())
    const uploadMonth = dateMatch?.[2] || String(today.getMonth() + 1).padStart(2, '0')
    const currentMonth = String(today.getMonth() + 1).padStart(2, '0')
    const currentYear = String(today.getFullYear())

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

    setUploading(true)
    setUploadError('')
    setUploadSuccess('')

    try {
      const formData = new FormData()
      formData.append('file', selectedFile)
      formData.append('documentTypeId', selectedDocType)
      formData.append('subcontractorRut', transportista.rut)
      formData.append('documentDate', documentDate)
      formData.append('documentPeriodMonth', uploadMonth)
      formData.append('documentPeriodYear', uploadYear)

      const response = await fetch(`/api/subcontractors/${transportista.id}/documents`, {
        method: 'POST',
        body: formData,
      })
      const data = await response.json()

      if (!response.ok) {
        setUploadError(data.error || 'Error al subir el documento')
        return
      }

      setUploadSuccess('Documento subido exitosamente')
      setSelectedFile(null)
      setSelectedDocType('')

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      if (fileInput) fileInput.value = ''

      await fetchDocuments(transportista.id)
      setTimeout(() => setUploadSuccess(''), 5000)
    } catch (error) {
      console.error('[v0] Upload error:', error)
      setUploadError('Error al subir el documento. Intenta nuevamente.')
    } finally {
      setUploading(false)
    }
  }

  const handleLogout = () => {
    fetch('/api/auth/subcontractors/logout', { method: 'POST' })
    router.push('/subcontractors/login')
  }

  const getDateRangeForPeriod = (month: string, year: string) => {
    const monthNum = parseInt(month, 10)
    const yearNum = parseInt(year, 10)
    return {
      start: new Date(yearNum, monthNum - 1, 1),
      end: new Date(yearNum, monthNum, 0),
    }
  }

  const filteredDocuments = documents.filter((doc) => {
    const docDate = new Date(getDocumentPeriodDate(doc) || doc.uploaded_at)
    const { start, end } = getDateRangeForPeriod(selectedMonth, selectedYear)
    return docDate >= start && docDate <= end
  })

  const isExpiringSoon = (doc: Document) => {
    if (!doc.expires_at || doc.status !== 'approved') return false
    const days = Math.ceil((new Date(doc.expires_at).getTime() - Date.now()) / 86400000)
    return days >= 0 && days <= 30
  }

  const statusSummary = {
    approved: filteredDocuments.filter((doc) => doc.status === 'approved' && !isExpiringSoon(doc)).length,
    inReview: filteredDocuments.filter((doc) => ['uploaded', 'pending'].includes(doc.status)).length,
    expiringSoon: filteredDocuments.filter((doc) => isExpiringSoon(doc)).length,
    actionRequired: filteredDocuments.filter((doc) => ['rejected', 'expired'].includes(doc.status)).length,
  }

  const sortedFilteredDocuments = [...filteredDocuments].sort((a, b) => {
    const rank = (doc: Document) => {
      if (['rejected', 'expired'].includes(doc.status)) return 0
      if (isExpiringSoon(doc)) return 1
      if (['uploaded', 'pending'].includes(doc.status)) return 2
      return 3
    }
    return rank(a) - rank(b) || new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime()
  })

  const minDate = new Date()
  minDate.setMonth(minDate.getMonth() - 4)
  const minDateString = minDate.toISOString().split('T')[0]

  const getStatusBadge = (status: string, expiresAt?: string) => {
    if (status === 'approved' && expiresAt) {
      const days = Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86400000)
      if (days >= 0 && days <= 30) {
        return <div className="flex items-center gap-1 text-[var(--cf-expiring)]"><Clock className="w-4 h-4" /> Por vencer</div>
      }
    }

    switch (status) {
      case 'approved':
        return <div className="flex items-center gap-1 text-[var(--cf-success)]"><CheckCircle className="w-4 h-4" /> Aprobado</div>
      case 'uploaded':
      case 'pending':
        return <div className="flex items-center gap-1 text-[var(--cf-warning)]"><Clock className="w-4 h-4" /> En revisión</div>
      case 'expired':
        return <div className="flex items-center gap-1 text-[var(--cf-danger)]"><AlertCircle className="w-4 h-4" /> Vencido</div>
      case 'rejected':
        return <div className="flex items-center gap-1 text-[var(--cf-danger)]"><AlertCircle className="w-4 h-4" /> Rechazado</div>
      default:
        return <span className="text-[var(--cf-text-muted)]">{status}</span>
    }
  }

  const getDocumentTypeLabel = (documentTypeId: string) =>
    documentTypes.find((type) => type.id === documentTypeId)?.nombre || 'Documento'

  const getDisplayFileName = (fileName?: string) => {
    if (!fileName) return null
    if (/^inbound\d+\.[a-z0-9]+$/i.test(fileName.trim())) return null
    return fileName.trim()
  }

  const focusUploadFor = (documentTypeId: string) => {
    setSelectedDocType(documentTypeId)
    document.getElementById('upload-document')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const getAdvancedBadge = (doc: Document) => {
    if (!doc.verification?.advanced) return null

    const confidence = doc.verification.confidence
    const confidenceLabel = confidence == null ? '' : ` · ${Math.round(confidence * 100)}%`
    const plateLabel = doc.verification.plate ? ` · ${doc.verification.plate}` : ''

    return (
      <Badge
        title={`Validación avanzada por evidencia vehicular coincidente${plateLabel}${confidenceLabel}`}
        className="mt-2 gap-1.5 bg-emerald-500/20 text-emerald-200 border-emerald-400/40"
      >
        <ShieldCheck className="h-3.5 w-3.5" />
        Validación avanzada
      </Badge>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--cf-canvas)] flex items-center justify-center">
        <p className="text-[var(--cf-text-muted)]">Cargando...</p>
      </div>
    )
  }

  if (!transportista) return null

  return (
    <div className="min-h-screen bg-[var(--cf-canvas)] p-4 md:p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-[var(--cf-text)]">{transportista.nombre}</h1>
            <p className="text-[var(--cf-text-muted)]">RUT: {transportista.rut}</p>
          </div>
          <Button variant="outline" onClick={handleLogout} className="gap-2 border-[var(--cf-border)] text-[var(--cf-text-secondary)] hover:bg-[var(--cf-surface)]">
            <LogOut className="w-4 h-4" />
            Cerrar sesión
          </Button>
        </div>

        <div className="rounded-lg border border-[var(--cf-border)] bg-[var(--cf-surface)] p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="text-sm font-medium text-[var(--cf-text-secondary)] sm:pb-2">Período</div>
              <div className="flex flex-1 gap-2 items-end">
                <div className="flex-1">
                  <label className="text-xs font-semibold text-[var(--cf-text-muted)] mb-1 block">Mes</label>
                  <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="w-full rounded-md border border-[var(--cf-border)] bg-[var(--cf-surface-raised)] px-3 py-2 text-sm text-[var(--cf-text)]">
                    <option value="01">Enero</option><option value="02">Febrero</option><option value="03">Marzo</option>
                    <option value="04">Abril</option><option value="05">Mayo</option><option value="06">Junio</option>
                    <option value="07">Julio</option><option value="08">Agosto</option><option value="09">Septiembre</option>
                    <option value="10">Octubre</option><option value="11">Noviembre</option><option value="12">Diciembre</option>
                  </select>
                </div>
                <div className="flex-1">
                  <label className="text-xs font-semibold text-[var(--cf-text-muted)] mb-1 block">Año</label>
                  <select value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)} className="w-full rounded-md border border-[var(--cf-border)] bg-[var(--cf-surface-raised)] px-3 py-2 text-sm text-[var(--cf-text)]">
                    <option value="2024">2024</option><option value="2025">2025</option><option value="2026">2026</option>
                  </select>
                </div>
              </div>
            </div>
        </div>

        

        {(statusSummary.actionRequired > 0 || statusSummary.expiringSoon > 0) && (
          <div className="rounded-lg border border-[var(--cf-expiring)]/40 bg-[var(--cf-expiring-soft)] p-4 text-sm text-[var(--cf-expiring)]">
            <div className="flex items-start gap-2">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--cf-expiring)]" />
              <p>
                <span className="font-medium">Necesita atención.</span>{' '}
                {statusSummary.actionRequired > 0 ? `${statusSummary.actionRequired} documento(s)` : ''}
                {statusSummary.actionRequired > 0 && statusSummary.expiringSoon > 0 ? ' · ' : ''}
                {statusSummary.expiringSoon > 0 ? `${statusSummary.expiringSoon} por vencer` : ''}
              </p>
            </div>
          </div>
        )}

        <Card className="border-[var(--cf-border)] bg-[var(--cf-surface)]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><FileText className="w-5 h-5" /> Estado de documentos</CardTitle>
            <CardDescription className="flex flex-wrap gap-x-4 gap-y-1 pt-2 text-sm">
              <span className="font-medium text-[var(--cf-success)]">{statusSummary.approved} aprobados</span>
              <span className="text-[var(--cf-warning)]">{statusSummary.inReview} en revisión</span>
              <span className={statusSummary.expiringSoon > 0 ? 'font-medium text-[var(--cf-expiring)]' : 'text-[var(--cf-text-muted)]'}>{statusSummary.expiringSoon} por vencer</span>
              <span className={statusSummary.actionRequired > 0 ? 'font-medium text-[var(--cf-danger)]' : 'text-[var(--cf-text-muted)]'}>{statusSummary.actionRequired} requieren acción</span>
            </CardDescription>
          </CardHeader>
          <CardContent>
            {filteredDocuments.length === 0 ? (
              <p className="text-[var(--cf-text-muted)] text-center py-8">{documents.length === 0 ? 'Aún no has subido documentos' : 'No hay documentos en este período'}</p>
            ) : (
              <div className="space-y-2">
                {sortedFilteredDocuments.map((doc) => (
                  <div key={doc.id} className="flex flex-col gap-3 rounded-lg border border-[var(--cf-border)] bg-[var(--cf-surface-raised)] p-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex-1">
                      <p className="text-[var(--cf-text)] font-medium">{getDocumentTypeLabel(doc.document_type_id)}</p>
                      {getDisplayFileName(doc.file_name) && (
                        <p className="mt-0.5 text-xs text-[var(--cf-text-muted)]">{getDisplayFileName(doc.file_name)}</p>
                      )}
                      {getAdvancedBadge(doc)}
                      <p className="text-xs text-[var(--cf-text-muted)] mt-1">Periodo: {getDocumentPeriodLabel(doc)}</p>
                      <p className="text-xs text-[var(--cf-text-muted)]">Subido: {new Date(doc.uploaded_at).toLocaleDateString('es-CL')}</p>
                      {isExpiringSoon(doc) && <p className="mt-1 text-xs font-medium text-[var(--cf-expiring)]">Próximo a vencer. Conviene renovarlo antes de que afecte tu cumplimiento.</p>}
                      {['uploaded', 'pending'].includes(doc.status) && <p className="mt-1 text-xs text-[var(--cf-warning)]">Recibido correctamente. No necesitas volver a subirlo.</p>}
                      {doc.status === 'rejected' && doc.rejection_reason && <div className="mt-2 rounded-md border border-[var(--cf-danger)]/40 bg-[var(--cf-danger-soft)] px-3 py-2"><p className="text-xs font-medium text-[var(--cf-danger)]">Requiere acción</p><p className="mt-1 text-xs text-[var(--cf-danger)]">Motivo: {doc.rejection_reason}</p><p className="mt-1 text-xs text-[var(--cf-danger)]">Corrige el documento y vuelve a subirlo.</p></div>}
                      {doc.status === 'expired' && <p className="mt-1 text-xs font-medium text-[var(--cf-danger)]">Documento vencido. Debes renovarlo.</p>}
                    </div>
                    <div className="ml-4 flex shrink-0 flex-col items-end gap-2 text-right">
                      {(['rejected', 'expired'].includes(doc.status) || isExpiringSoon(doc)) && (
                        <Button
                          type="button"
                          size="sm"
                          className="bg-[var(--cf-accent)] text-[var(--cf-text)] hover:bg-[var(--cf-accent-hover)]"
                          onClick={() => focusUploadFor(doc.document_type_id)}
                        >
                          Reemplazar
                        </Button>
                      )}
                      {getStatusBadge(doc.status, doc.expires_at)}
                      {doc.expires_at && <p className="text-xs text-[var(--cf-text-muted)]">Vence: {new Date(doc.expires_at).toLocaleDateString('es-CL')}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card id="upload-document" className="scroll-mt-6 border-[var(--cf-border)] bg-[var(--cf-surface)]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Upload className="w-5 h-5" /> Subir Documento</CardTitle>
            <CardDescription>Sube o reemplaza documentos. Si eliges una fecha anterior, confirmaremos el período antes de guardar.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleUpload} className="space-y-4">
              {uploadError && <div className="flex gap-3 rounded-lg bg-[var(--cf-danger-soft)] border border-[var(--cf-danger)]/40 p-3"><AlertCircle className="h-5 w-5 text-[var(--cf-danger)]" /><p className="text-sm text-[var(--cf-danger)]">{uploadError}</p></div>}
              {uploadSuccess && <div className="flex gap-3 rounded-lg bg-[var(--cf-success-soft)] border border-[var(--cf-success)]/40 p-3"><CheckCircle className="h-5 w-5 text-[var(--cf-success)]" /><p className="text-sm text-[var(--cf-success)]">{uploadSuccess}</p></div>}

              <div className="grid md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="doctype" className="text-[var(--cf-text-secondary)]">Tipo de Documento</Label>
                  <Select value={selectedDocType} onValueChange={setSelectedDocType}>
                    <SelectTrigger className="bg-[var(--cf-surface-raised)] border-[var(--cf-border)] text-[var(--cf-text)]"><SelectValue placeholder="Selecciona un documento" /></SelectTrigger>
                    <SelectContent className="bg-[var(--cf-surface)] border-[var(--cf-border)]">
                      {documentTypes.map((dt) => <SelectItem key={dt.id} value={dt.id} className="text-[var(--cf-text)]">{dt.nombre}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="docdate" className="text-[var(--cf-text-secondary)]">Fecha del Documento</Label>
                  <Input id="docdate" type="date" value={documentDate} onChange={(e) => handleDocumentDateChange(e.target.value)} min={minDateString} max={(() => { const d = new Date(); const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000); return local.toISOString().split('T')[0] })()} className="bg-[var(--cf-surface-raised)] border-[var(--cf-border)] text-[var(--cf-text-secondary)]" />
                  <p className="text-xs text-[var(--cf-text-muted)]">Esta fecha define el periodo mensual de cumplimiento</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="file" className="text-[var(--cf-text-secondary)]">Archivo</Label>
                  <Input id="file" type="file" onChange={handleFileSelect} disabled={uploading} className="bg-[var(--cf-surface-raised)] border-[var(--cf-border)] text-[var(--cf-text-secondary)] cursor-pointer" accept=".pdf,.jpg,.jpeg,.png" />
                  <p className="text-xs text-[var(--cf-text-muted)]">{selectedFile ? `✓ ${selectedFile.name} (${(selectedFile.size / 1024 / 1024).toFixed(2)}MB)` : 'PDF, JPG, PNG máximo 50MB'}</p>
                </div>
              </div>

              <Button type="submit" disabled={uploading || !selectedFile || !selectedDocType} className="w-full bg-[var(--cf-accent)] hover:bg-[var(--cf-accent-hover)]">
                {uploading ? 'Subiendo...' : 'Subir Documento'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
