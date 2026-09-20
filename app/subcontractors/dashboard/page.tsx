'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AlertCircle, CheckCircle, Clock, LogOut, Upload, FileText, HelpCircle, Calendar, ShieldCheck } from 'lucide-react'
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
  const [documentDate, setDocumentDate] = useState(new Date().toISOString().split('T')[0])

  const syncDocumentDateToPeriod = (month: string, year: string) => {
    setDocumentDate(`${year}-${month.padStart(2, '0')}-01`)
  }

  const handleSelectedMonthChange = (month: string) => {
    setSelectedMonth(month)
    syncDocumentDateToPeriod(month, selectedYear)
  }

  const handleSelectedYearChange = (year: string) => {
    setSelectedYear(year)
    syncDocumentDateToPeriod(selectedMonth, year)
  }

  const handleDocumentDateChange = (value: string) => {
    setDocumentDate(value)
    const match = /^(\d{4})-(\d{2})-\d{2}$/.exec(value)
    if (match) {
      setSelectedYear(match[1])
      setSelectedMonth(match[2])
    }
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

    setUploading(true)
    setUploadError('')
    setUploadSuccess('')

    try {
      const formData = new FormData()
      formData.append('file', selectedFile)
      formData.append('documentTypeId', selectedDocType)
      formData.append('subcontractorRut', transportista.rut)
      formData.append('documentDate', documentDate)
      formData.append('documentPeriodMonth', selectedMonth)
      formData.append('documentPeriodYear', selectedYear)

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
        return <div className="flex items-center gap-1 text-orange-300"><Clock className="w-4 h-4" /> Por vencer</div>
      }
    }

    switch (status) {
      case 'approved':
        return <div className="flex items-center gap-1 text-green-400"><CheckCircle className="w-4 h-4" /> Aprobado</div>
      case 'uploaded':
      case 'pending':
        return <div className="flex items-center gap-1 text-amber-300"><Clock className="w-4 h-4" /> En revisión</div>
      case 'expired':
        return <div className="flex items-center gap-1 text-red-400"><AlertCircle className="w-4 h-4" /> Vencido</div>
      case 'rejected':
        return <div className="flex items-center gap-1 text-red-500"><AlertCircle className="w-4 h-4" /> Rechazado</div>
      default:
        return <span className="text-slate-400">{status}</span>
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
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <p className="text-slate-400">Cargando...</p>
      </div>
    )
  }

  if (!transportista) return null

  return (
    <div className="min-h-screen bg-slate-900 p-4 md:p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">{transportista.nombre}</h1>
            <p className="text-slate-400">RUT: {transportista.rut}</p>
          </div>
          <Button variant="outline" onClick={handleLogout} className="gap-2 border-slate-600 text-slate-300 hover:bg-slate-800">
            <LogOut className="w-4 h-4" />
            Cerrar sesión
          </Button>
        </div>

        <Card className="border-slate-700 bg-slate-800/30">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <Calendar className="w-5 h-5 text-slate-400" />
              <label className="text-sm font-medium text-slate-300">Selecciona Período:</label>
              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <label className="text-xs font-semibold text-slate-400 mb-1 block">Mes</label>
                  <select value={selectedMonth} onChange={(e) => handleSelectedMonthChange(e.target.value)} className="w-full rounded-md border border-slate-600 bg-slate-700/50 px-3 py-2 text-sm text-white">
                    <option value="01">Enero</option><option value="02">Febrero</option><option value="03">Marzo</option>
                    <option value="04">Abril</option><option value="05">Mayo</option><option value="06">Junio</option>
                    <option value="07">Julio</option><option value="08">Agosto</option><option value="09">Septiembre</option>
                    <option value="10">Octubre</option><option value="11">Noviembre</option><option value="12">Diciembre</option>
                  </select>
                </div>
                <div className="flex-1">
                  <label className="text-xs font-semibold text-slate-400 mb-1 block">Año</label>
                  <select value={selectedYear} onChange={(e) => handleSelectedYearChange(e.target.value)} className="w-full rounded-md border border-slate-600 bg-slate-700/50 px-3 py-2 text-sm text-white">
                    <option value="2024">2024</option><option value="2025">2025</option><option value="2026">2026</option>
                  </select>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        

        {(statusSummary.actionRequired > 0 || statusSummary.expiringSoon > 0) && (
          <div className="rounded-lg border border-orange-900/50 bg-orange-950/30 p-4 text-sm text-orange-100">
            <div className="flex items-start gap-2">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-orange-300" />
              <p>
                <span className="font-medium">Necesita atención.</span>{' '}
                {statusSummary.actionRequired} documento(s) requieren acción
                {statusSummary.expiringSoon > 0 ? ` y ${statusSummary.expiringSoon} están próximos a vencer` : ''}.
                Se muestran primero.
              </p>
            </div>
          </div>
        )}

        <Card className="border-slate-700 bg-slate-800/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><FileText className="w-5 h-5" /> Estado de documentos</CardTitle>
            <CardDescription className="flex flex-wrap gap-x-4 gap-y-1 pt-2 text-sm">
              <span className="font-medium text-green-300">{statusSummary.approved} aprobados</span>
              <span className="text-amber-300">{statusSummary.inReview} en revisión</span>
              <span className={statusSummary.expiringSoon > 0 ? 'font-medium text-orange-300' : 'text-slate-400'}>{statusSummary.expiringSoon} por vencer</span>
              <span className={statusSummary.actionRequired > 0 ? 'font-medium text-red-300' : 'text-slate-400'}>{statusSummary.actionRequired} requieren acción</span>
            </CardDescription>
          </CardHeader>
          <CardContent>
            {filteredDocuments.length === 0 ? (
              <p className="text-slate-400 text-center py-8">{documents.length === 0 ? 'Aún no has subido documentos' : 'No hay documentos en este período'}</p>
            ) : (
              <div className="space-y-2">
                {sortedFilteredDocuments.map((doc) => (
                  <div key={doc.id} className="flex flex-col gap-3 rounded-lg border border-slate-600 bg-slate-700/30 p-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex-1">
                      <p className="text-white font-medium">{getDocumentTypeLabel(doc.document_type_id)}</p>
                      {getDisplayFileName(doc.file_name) && (
                        <p className="mt-0.5 text-xs text-slate-500">{getDisplayFileName(doc.file_name)}</p>
                      )}
                      {getAdvancedBadge(doc)}
                      <p className="text-xs text-slate-400 mt-1">Periodo: {getDocumentPeriodLabel(doc)}</p>
                      <p className="text-xs text-slate-500">Subido: {new Date(doc.uploaded_at).toLocaleDateString('es-CL')}</p>
                      {doc.status === 'approved' && !isExpiringSoon(doc) && <p className="mt-1 text-xs text-green-300">Documento validado. No requiere acción.</p>}
                      {isExpiringSoon(doc) && <p className="mt-1 text-xs font-medium text-orange-300">Próximo a vencer. Conviene renovarlo antes de que afecte tu cumplimiento.</p>}
                      {['uploaded', 'pending'].includes(doc.status) && <p className="mt-1 text-xs text-amber-200">Recibido correctamente. No necesitas volver a subirlo.</p>}
                      {doc.status === 'rejected' && doc.rejection_reason && <div className="mt-2 rounded-md border border-red-900/50 bg-red-950/30 px-3 py-2"><p className="text-xs font-medium text-red-300">Requiere acción</p><p className="mt-1 text-xs text-red-200">Motivo: {doc.rejection_reason}</p><p className="mt-1 text-xs text-red-300">Corrige el documento y vuelve a subirlo.</p></div>}
                      {doc.status === 'expired' && <p className="mt-1 text-xs font-medium text-red-300">Documento vencido. Debes renovarlo.</p>}
                    </div>
                    <div className="ml-4 flex shrink-0 flex-col items-end gap-2 text-right">
                      {(['rejected', 'expired'].includes(doc.status) || isExpiringSoon(doc)) && (
                        <Button
                          type="button"
                          size="sm"
                          className="bg-orange-500 text-slate-950 hover:bg-orange-400"
                          onClick={() => focusUploadFor(doc.document_type_id)}
                        >
                          Reemplazar
                        </Button>
                      )}
                      {getStatusBadge(doc.status, doc.expires_at)}
                      {doc.expires_at && <p className="text-xs text-slate-400">Vence: {new Date(doc.expires_at).toLocaleDateString('es-CL')}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card id="upload-document" className="scroll-mt-6 border-slate-700 bg-slate-800/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Upload className="w-5 h-5" /> Subir Documento</CardTitle>
            <CardDescription>Úsalo cuando falte un documento o necesites reemplazar uno rechazado, vencido o próximo a vencer.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleUpload} className="space-y-4">
              {uploadError && <div className="flex gap-3 rounded-lg bg-red-500/10 border border-red-500/30 p-3"><AlertCircle className="h-5 w-5 text-red-400" /><p className="text-sm text-red-300">{uploadError}</p></div>}
              {uploadSuccess && <div className="flex gap-3 rounded-lg bg-green-500/10 border border-green-500/30 p-3"><CheckCircle className="h-5 w-5 text-green-400" /><p className="text-sm text-green-300">{uploadSuccess}</p></div>}
              {documents.some((d) => d.rejection_reason === 'test') && <div className="flex gap-3 rounded-lg bg-blue-500/10 border border-blue-500/30 p-3"><HelpCircle className="h-5 w-5 text-blue-400" /><p className="text-sm text-blue-300"><strong>Nota:</strong> Algunos documentos con motivo de rechazo "test" son documentos de prueba del sistema y pueden ser ignorados.</p></div>}

              <div className="grid md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="doctype" className="text-slate-200">Tipo de Documento</Label>
                  <Select value={selectedDocType} onValueChange={setSelectedDocType}>
                    <SelectTrigger className="bg-slate-700/50 border-slate-600 text-white"><SelectValue placeholder="Selecciona un documento" /></SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700">
                      {documentTypes.map((dt) => <SelectItem key={dt.id} value={dt.id} className="text-white">{dt.nombre}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="docdate" className="text-slate-200">Fecha del Documento</Label>
                  <Input id="docdate" type="date" value={documentDate} onChange={(e) => handleDocumentDateChange(e.target.value)} min={minDateString} max={new Date().toISOString().split('T')[0]} className="bg-slate-700/50 border-slate-600 text-slate-300" />
                  <p className="text-xs text-slate-400">Esta fecha define el periodo mensual de cumplimiento</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="file" className="text-slate-200">Archivo</Label>
                  <Input id="file" type="file" onChange={handleFileSelect} disabled={uploading} className="bg-slate-700/50 border-slate-600 text-slate-300 cursor-pointer" accept=".pdf,.jpg,.jpeg,.png" />
                  <p className="text-xs text-slate-400">{selectedFile ? `✓ ${selectedFile.name} (${(selectedFile.size / 1024 / 1024).toFixed(2)}MB)` : 'PDF, JPG, PNG máximo 50MB'}</p>
                </div>
              </div>

              <Button type="submit" disabled={uploading || !selectedFile || !selectedDocType} className="w-full bg-orange-500 hover:bg-orange-600">
                {uploading ? 'Subiendo...' : 'Subir Documento'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
