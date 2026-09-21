'use client'

import { useState } from 'react'
import { AlertCircle, BookOpen, CheckCircle, FileText, Loader2, Upload } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DocumentReferenceGallery } from '@/components/documents/document-reference-gallery'
import { DocumentRequirements } from '@/components/documents/document-requirements'

export default function DocumentValidatorPage() {
  const [activeTab, setActiveTab] = useState('upload')
  const [loading, setLoading] = useState(false)
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadedFile(file)
    setError(null)
    setResult(null)
  }

  const handleUpload = async () => {
    if (!uploadedFile) {
      setError('Selecciona un archivo antes de procesar.')
      return
    }

    setLoading(true)
    try {
      const formData = new FormData()
      formData.append('file', uploadedFile)
      const response = await fetch('/api/ocr/process', { method: 'POST', body: formData })
      if (!response.ok) throw new Error('Error procesando documento')
      setResult(await response.json())
      setActiveTab('results')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6">
      <section className="border-b border-[var(--cf-border)] pb-5">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-[var(--cf-text-muted)]">OCR documental</p>
        <h1 className="mt-2 text-[28px] font-semibold tracking-[-0.03em] text-[var(--cf-text)]">Validación documental</h1>
        <p className="mt-1 text-sm text-[var(--cf-text-secondary)]">Carga evidencia, procesa el archivo y revisa los datos extraídos.</p>
      </section>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4 rounded-[6px] bg-[var(--cf-surface)] p-1">
          <TabsTrigger value="upload">Cargar</TabsTrigger>
          <TabsTrigger value="guia"><BookOpen className="mr-1 h-4 w-4" />Galería</TabsTrigger>
          <TabsTrigger value="requisitos"><FileText className="mr-1 h-4 w-4" />Requisitos</TabsTrigger>
          <TabsTrigger value="results">Resultados</TabsTrigger>
        </TabsList>

        <TabsContent value="upload" className="mt-5">
          <Card>
            <CardHeader>
              <CardTitle>Subir documento</CardTitle>
              <CardDescription>PDF, JPG o PNG. Tamaño máximo: 10 MB.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <label className="flex min-h-44 cursor-pointer flex-col items-center justify-center rounded-[6px] border border-dashed border-[var(--cf-border)] bg-[var(--cf-canvas)] px-6 text-center hover:bg-[var(--cf-surface-raised)]">
                <Upload className="h-6 w-6 text-[var(--cf-text-muted)]" />
                <p className="mt-3 text-sm font-medium text-[var(--cf-text)]">Selecciona o arrastra un archivo</p>
                <p className="mt-1 text-xs text-[var(--cf-text-muted)]">PDF, JPG o PNG · máximo 10 MB</p>
                <input type="file" className="hidden" onChange={handleFileChange} accept=".pdf,.jpg,.jpeg,.png" />
              </label>

              {uploadedFile && (
                <div className="flex items-center gap-3 rounded-[6px] border border-[var(--cf-success)]/35 bg-[var(--cf-success-soft)] px-3 py-2.5">
                  <CheckCircle className="h-4 w-4 text-[var(--cf-success)]" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-[var(--cf-text)]">{uploadedFile.name}</p>
                    <p className="text-xs text-[var(--cf-text-muted)]">{(uploadedFile.size / 1024).toFixed(1)} KB</p>
                  </div>
                </div>
              )}

              {error && (
                <Alert className="border-[var(--cf-danger)]/40 bg-[var(--cf-danger-soft)]">
                  <AlertCircle className="h-4 w-4 text-[var(--cf-danger)]" />
                  <AlertDescription className="text-[var(--cf-danger)]">{error}</AlertDescription>
                </Alert>
              )}

              <Button onClick={handleUpload} disabled={!uploadedFile || loading} className="w-full sm:w-auto">
                {loading ? <><Loader2 className="h-4 w-4 animate-spin" />Procesando…</> : <><Upload className="h-4 w-4" />Procesar documento</>}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="guia" className="mt-5">
          <Card>
            <CardHeader>
              <CardTitle>Galería de referencia</CardTitle>
              <CardDescription>Ejemplos visuales de documentos de transporte.</CardDescription>
            </CardHeader>
            <CardContent><DocumentReferenceGallery /></CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="requisitos" className="mt-5">
          <Card>
            <CardHeader>
              <CardTitle>Requisitos documentales</CardTitle>
              <CardDescription>Información requerida para cada tipo de documento.</CardDescription>
            </CardHeader>
            <CardContent><DocumentRequirements /></CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="results" className="mt-5">
          {result ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-[var(--cf-success)]" />
                  Resultado de extracción
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="divide-y divide-[var(--cf-border)] border-y border-[var(--cf-border)]">
                  {result.extractedData && Object.entries(result.extractedData).map(([key, value]) => (
                    <div key={key} className="flex items-start justify-between gap-6 py-3">
                      <span className="text-sm text-[var(--cf-text-muted)]">{key.replace(/_/g, ' ')}</span>
                      <span className="text-right text-sm font-medium text-[var(--cf-text)]">{String(value)}</span>
                    </div>
                  ))}
                </div>

                {result.validationStatus && (
                  <div className="rounded-[6px] border border-[var(--cf-success)]/35 bg-[var(--cf-success-soft)] px-3 py-2.5 text-sm text-[var(--cf-success)]">
                    Estado: {result.validationStatus}
                  </div>
                )}

                <Button variant="outline" onClick={() => { setUploadedFile(null); setResult(null); setActiveTab('upload') }}>
                  Procesar otro documento
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-10 text-center">
                <FileText className="mx-auto h-5 w-5 text-[var(--cf-text-muted)]" />
                <p className="mt-2 text-sm text-[var(--cf-text-secondary)]">Aún no hay resultados.</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
