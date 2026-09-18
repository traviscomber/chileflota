'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, Calendar, CheckCircle, Clock, FileText, LogOut, RotateCcw, ShieldCheck, Upload } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
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

type DocumentState = 'approved' | 'review' | 'rejected' | 'expiring' | 'expired' | 'other'

const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

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

  useEffect(() => {
    void fetchTransportistaData()
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
        await Promise.all([fetchDocumentTypes(), fetchDocuments(data.transportista.id)])
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

  const handleLogout = () => {
    void fetch('/api/auth/subcontractors/logout', { method: 'POST' })
    router.push('/subcontractors/login')
  }

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    const maxSize = 50 * 1024 * 1024
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg']
    if (!allowedTypes.includes(file.type)) {
      setUploadError('Solo se permiten archivos PDF, JPG o PNG.')
      return
    }
    if (file.size > maxSize) {
      setUploadError('El archivo supera el máximo de 50 MB.')
      return
    }
    if (file.size === 0) {
      setUploadError('El archivo está vacío.')
      return
    }
    setSelectedFile(file)
    setUploadError('')
  }

  const handleUpload = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!selectedFile || !selectedDocType || !transportista) {
      setUploadError('Completa el tipo de documento y selecciona un archivo.')
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

      const response = await fetch(`/api/subcontractors/${transportista.id}/documents`, { method: 'POST', body: formData })
      const data = await response.json()
      if (!response.ok) {
        setUploadError(data.error || 'No fue posible subir el documento.')
        return
      }

      setUploadSuccess('Documento recibido. Quedó pendiente de revisión por una ejecutiva.')
      setSelectedFile(null)
      setSelectedDocType('')
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement | null
      if (fileInput) fileInput.value = ''
      await fetchDocuments(transportista.id)
    } catch (error) {
      console.error('[v0] Upload error:', error)
      setUploadError('No fue posible subir el documento. Intenta nuevamente.')
    } finally {
      setUploading(false)
    }
  }

  const documentTypeName = (id: string) => documentTypes.find((type) => type.id === id)?.nombre || 'Documento'

  const getState = (doc: Document): DocumentState => {
    if (doc.status === 'rejected') return 'rejected'
    if (doc.status === 'expired') return 'expired'
    if (doc.status === 'pending' || doc.status === 'uploaded') return 'review'
    if (doc.status === 'approved') {
      if (doc.expires_at) {
        const expiry = new Date(doc.expires_at).getTime()
        const now = Date.now()
        if (expiry < now) return 'expired'
        if (expiry - now <= 30 * 24 * 60 * 60 * 1000) return 'expiring'
      }
      return 'approved'
    }
    return 'other'
  }

  const periodDocuments = useMemo(() => {
    const start = new Date(Number(selectedYear), Number(selectedMonth) - 1, 1)
    const end = new Date(Number(selectedYear), Number(selectedMonth), 0, 23, 59, 59, 999)
    return documents
      .filter((doc) => {
        const date = new Date(getDocumentPeriodDate(doc) || doc.uploaded_at)
        return date >= start && date <= end
      })
      .sort((a, b) => new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime())
  }, [documents, selectedMonth, selectedYear])

  const counts = useMemo(() => {
    const result = { approved: 0, review: 0, action: 0 }
    periodDocuments.forEach((doc) => {
      const state = getState(doc)
      if (state === 'approved') result.approved += 1
      if (state === 'review') result.review += 1
      if (state === 'rejected' || state === 'expired' || state === 'expiring') result.action += 1
    })
    return result
  }, [periodDocuments])

  const minDate = new Date()
  minDate.setMonth(minDate.getMonth() - 4)
  const minDateString = minDate.toISOString().split('T')[0]

  const statusPill = (doc: Document) => {
    const state = getState(doc)
    const common = 'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium'
    if (state === 'approved') return <span className={`${common} bg-emerald-500/10 text-emerald-300`}><CheckCircle className="h-3.5 w-3.5" />Aprobado</span>
    if (state === 'review') return <span className={`${common} bg-sky-500/10 text-sky-300`}><Clock className="h-3.5 w-3.5" />Pendiente de revisión</span>
    if (state === 'rejected') return <span className={`${common} bg-rose-500/10 text-rose-300`}><AlertCircle className="h-3.5 w-3.5" />Rechazado</span>
    if (state === 'expiring') return <span className={`${common} bg-amber-500/10 text-amber-300`}><Clock className="h-3.5 w-3.5" />Próximo a vencer</span>
    if (state === 'expired') return <span className={`${common} bg-rose-500/10 text-rose-300`}><AlertCircle className="h-3.5 w-3.5" />Vencido</span>
    return <span className={`${common} bg-slate-500/10 text-slate-300`}>En proceso</span>
  }

  const focusUpload = (documentTypeId: string) => {
    setSelectedDocType(documentTypeId)
    document.getElementById('upload-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  if (loading) {
    return <div className="min-h-screen bg-[#0b0d0f] flex items-center justify-center text-slate-400">Cargando portal...</div>
  }

  if (!transportista) return null

  return (
    <div className="min-h-screen bg-[#0b0d0f] text-white">
      <main className="mx-auto max-w-6xl px-4 py-5 md:px-8 md:py-8">
        <header className="mb-8 flex flex-col gap-4 border-b border-white/10 pb-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-[0.18em] text-slate-500">ChileFlota · Portal subcontratista</p>
            <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{transportista.nombre}</h1>
            <p className="mt-1 text-sm text-slate-400">RUT {transportista.rut}</p>
          </div>
          <Button variant="outline" onClick={handleLogout} className="w-fit border-white/15 bg-transparent text-slate-300 hover:bg-white/5 hover:text-white">
            <LogOut className="mr-2 h-4 w-4" /> Cerrar sesión
          </Button>
        </header>

        <section className="mb-8">
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm text-slate-400">Estado documental</p>
              <h2 className="mt-1 text-xl font-medium">{monthNames[Number(selectedMonth) - 1]} {selectedYear}</h2>
            </div>
            <div className="flex gap-2">
              <select value={selectedMonth} onChange={(e) => { setSelectedMonth(e.target.value); setDocumentDate(`${selectedYear}-${e.target.value}-01`) }} className="h-10 rounded-md border border-white/10 bg-white/5 px-3 text-sm text-white">
                {monthNames.map((name, index) => <option key={name} value={String(index + 1).padStart(2, '0')} className="bg-slate-900">{name}</option>)}
              </select>
              <select value={selectedYear} onChange={(e) => { setSelectedYear(e.target.value); setDocumentDate(`${e.target.value}-${selectedMonth}-01`) }} className="h-10 rounded-md border border-white/10 bg-white/5 px-3 text-sm text-white">
                <option value="2024" className="bg-slate-900">2024</option>
                <option value="2025" className="bg-slate-900">2025</option>
                <option value="2026" className="bg-slate-900">2026</option>
              </select>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-emerald-400/15 bg-emerald-400/[0.04] p-4">
              <div className="flex items-center justify-between"><span className="text-sm text-slate-400">Aprobados</span><CheckCircle className="h-4 w-4 text-emerald-300" /></div>
              <p className="mt-3 text-3xl font-semibold">{counts.approved}</p>
              <p className="mt-1 text-xs text-slate-500">Validados y vigentes</p>
            </div>
            <div className="rounded-xl border border-sky-400/15 bg-sky-400/[0.04] p-4">
              <div className="flex items-center justify-between"><span className="text-sm text-slate-400">En revisión</span><Clock className="h-4 w-4 text-sky-300" /></div>
              <p className="mt-3 text-3xl font-semibold">{counts.review}</p>
              <p className="mt-1 text-xs text-slate-500">Recibidos por ChileFlota</p>
            </div>
            <div className="rounded-xl border border-amber-400/15 bg-amber-400/[0.04] p-4">
              <div className="flex items-center justify-between"><span className="text-sm text-slate-400">Requieren acción</span><AlertCircle className="h-4 w-4 text-amber-300" /></div>
              <p className="mt-3 text-3xl font-semibold">{counts.action}</p>
              <p className="mt-1 text-xs text-slate-500">Rechazados, vencidos o por vencer</p>
            </div>
          </div>
        </section>

        <section className="mb-8 rounded-xl border border-white/10 bg-white/[0.025]">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-4 md:px-5">
            <div>
              <h2 className="font-medium">Mis documentos</h2>
              <p className="mt-1 text-sm text-slate-500">Estado visible para el período seleccionado</p>
            </div>
            <Badge variant="outline" className="border-white/10 text-slate-400">{periodDocuments.length} documentos</Badge>
          </div>

          {periodDocuments.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <FileText className="mx-auto h-6 w-6 text-slate-600" />
              <p className="mt-3 text-sm text-slate-300">No hay documentos cargados en este período.</p>
              <p className="mt-1 text-xs text-slate-500">Puedes subir uno desde el panel inferior.</p>
            </div>
          ) : (
            <div className="divide-y divide-white/10">
              {periodDocuments.map((doc) => {
                const state = getState(doc)
                return (
                  <div key={doc.id} className="grid gap-4 px-4 py-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center md:px-5">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate font-medium">{documentTypeName(doc.document_type_id)}</p>
                        {doc.verification?.advanced && <span title="Validación avanzada por evidencia coincidente"><ShieldCheck className="h-4 w-4 text-emerald-300" /></span>}
                      </div>
                      <p className="mt-1 truncate text-sm text-slate-500">{doc.file_name}</p>
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                        <span>Período: {getDocumentPeriodLabel(doc)}</span>
                        <span>Subido: {new Date(doc.uploaded_at).toLocaleDateString('es-CL')}</span>
                        {doc.expires_at && <span>Vence: {new Date(doc.expires_at).toLocaleDateString('es-CL')}</span>}
                      </div>
                      {state === 'rejected' && doc.rejection_reason && (
                        <div className="mt-3 rounded-md border border-rose-400/15 bg-rose-400/[0.04] px-3 py-2 text-sm text-rose-200">
                          <strong className="font-medium">Motivo:</strong> {doc.rejection_reason}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-3 md:flex-col md:items-end">
                      {statusPill(doc)}
                      {(state === 'rejected' || state === 'expired' || state === 'expiring') && (
                        <Button size="sm" variant="outline" onClick={() => focusUpload(doc.document_type_id)} className="border-white/10 bg-transparent text-slate-300 hover:bg-white/5 hover:text-white">
                          <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Reemplazar
                        </Button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        <section id="upload-panel" className="scroll-mt-6">
          <Card className="border-white/10 bg-white/[0.025] text-white shadow-none">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><Upload className="h-4 w-4" /> Subir documento</CardTitle>
              <CardDescription className="text-slate-500">Al subirlo quedará pendiente de revisión hasta que una ejecutiva lo apruebe o rechace.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleUpload} className="space-y-5">
                {uploadError && <div className="rounded-md border border-rose-400/20 bg-rose-400/[0.05] px-3 py-2 text-sm text-rose-200">{uploadError}</div>}
                {uploadSuccess && <div className="rounded-md border border-emerald-400/20 bg-emerald-400/[0.05] px-3 py-2 text-sm text-emerald-200">{uploadSuccess}</div>}

                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="doctype">Tipo de documento</Label>
                    <Select value={selectedDocType} onValueChange={setSelectedDocType}>
                      <SelectTrigger id="doctype" className="border-white/10 bg-white/5 text-white"><SelectValue placeholder="Selecciona un tipo" /></SelectTrigger>
                      <SelectContent className="border-white/10 bg-slate-900 text-white">
                        {documentTypes.map((type) => <SelectItem key={type.id} value={type.id}>{type.nombre}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="docdate">Fecha del documento</Label>
                    <Input id="docdate" type="date" value={documentDate} min={minDateString} max={new Date().toISOString().split('T')[0]} onChange={(e) => {
                      setDocumentDate(e.target.value)
                      const match = /^(\d{4})-(\d{2})/.exec(e.target.value)
                      if (match) { setSelectedYear(match[1]); setSelectedMonth(match[2]) }
                    }} className="border-white/10 bg-white/5 text-white" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="file">Archivo</Label>
                    <Input id="file" type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={handleFileSelect} disabled={uploading} className="border-white/10 bg-white/5 text-slate-300" />
                  </div>
                </div>

                <div className="flex flex-col gap-3 border-t border-white/10 pt-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-xs text-slate-500">
                    {selectedFile ? `${selectedFile.name} · ${(selectedFile.size / 1024 / 1024).toFixed(2)} MB` : 'PDF, JPG o PNG · máximo 50 MB'}
                  </div>
                  <Button type="submit" disabled={uploading || !selectedFile || !selectedDocType} className="bg-white text-black hover:bg-slate-200">
                    {uploading ? 'Subiendo...' : 'Subir y enviar a revisión'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </section>

        <div className="mt-6 flex items-start gap-3 rounded-lg border border-white/10 px-4 py-3 text-sm text-slate-400">
          <Calendar className="mt-0.5 h-4 w-4 shrink-0" />
          <p>Los estados cambian cuando el equipo de Transportes Labbe revisa la documentación. Si un documento es rechazado, verás el motivo y podrás reemplazarlo desde este mismo panel.</p>
        </div>
      </main>
    </div>
  )
}
