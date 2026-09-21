'use client'

import { useState, useCallback, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Upload, CheckCircle, AlertCircle, Loader2, FileText,
  ScanLine, Sparkles, ChevronRight, RefreshCw, Eye, X,
  FileImage, FilePlus, AlertTriangle, BarChart3, BookOpen
} from 'lucide-react'
import Link from 'next/link'
import { DocumentReferenceGallery } from '@/components/documents/document-reference-gallery'
import { DocumentRequirements } from '@/components/documents/document-requirements'

const DOCUMENT_TYPES = [
  { code: 'LICENCIA_CONDUCIR', label: 'Licencia de Conducir', icon: '🪪', category: 'conductor' },
  { code: 'REVISION_TECNICA', label: 'Revisión Técnica', icon: '🔧', category: 'vehiculo' },
  { code: 'SEGURO_OBLIGATORIO', label: 'SOAP', icon: '🛡️', category: 'vehiculo' },
  { code: 'PERMISO_CIRCULACION', label: 'Permiso Circulación', icon: '📋', category: 'vehiculo' },
  { code: 'HOJA_VIDA_CONDUCTOR', label: 'Hoja de Vida', icon: '📄', category: 'conductor' },
  { code: 'CONTRATO_TRABAJO', label: 'Contrato Trabajo', icon: '✍️', category: 'conductor' },
  { code: 'CERTIFICADO_SALUD', label: 'Cert. Médico', icon: '🏥', category: 'conductor' },
  { code: 'CERTIFICADO_ANTECEDENTES', label: 'Antecedentes', icon: '📝', category: 'conductor' },
  { code: 'PATENTE_COMERCIAL', label: 'Patente Comercial', icon: '🏢', category: 'empresa' },
  { code: 'GUIA_DESPACHO', label: 'Guía de Despacho', icon: '📦', category: 'operacion' },
]

type Step = 'select' | 'upload' | 'processing' | 'results'

interface ExtractedResult {
  success: boolean
  documentType?: string
  confidence?: number
  extractedData?: Record<string, string>
  validationStatus?: string
  error?: string
}

function ConfidenceBar({ score }: { score: number }) {
  const pct = Math.round(score * 100)
  const color = pct >= 85 ? 'bg-[var(--cf-success)]' : pct >= 65 ? 'bg-yellow-500' : 'bg-red-500'
  const label = pct >= 85 ? 'Alta confianza' : pct >= 65 ? 'Confianza media' : 'Confianza baja'
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-sm">
        <span className="text-[var(--cf-text-muted)]">{label}</span>
        <span className={`font-semibold ${pct >= 85 ? 'text-[var(--cf-success)]' : pct >= 65 ? 'text-[var(--cf-warning)]' : 'text-red-400'}`}>{pct}%</span>
      </div>
      <div className="w-full bg-[var(--cf-surface-raised)] rounded-[4px] h-2">
        <div className={`h-2 rounded-[4px] transition-colors duration-700 ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

export default function OCRPage() {
  const [step, setStep] = useState<Step>('select')
  const [selectedDocType, setSelectedDocType] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [result, setResult] = useState<ExtractedResult | null>(null)
  const [processingStage, setProcessingStage] = useState(0)
  const [activeTab, setActiveTab] = useState<'upload' | 'gallery' | 'requirements'>('upload')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const STAGES = [
    'Analizando imagen...',
    'Ejecutando OCR...',
    'Extrayendo campos...',
    'Validando datos...',
    'Generando reporte...',
  ]

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const dropped = e.dataTransfer.files[0]
    if (dropped) {
      setFile(dropped)
      if (step === 'select') setStep('upload')
    }
  }, [step])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0]
    if (selected) {
      setFile(selected)
      if (step === 'select') setStep('upload')
    }
  }

  const handleProcess = async () => {
    if (!file) return
    setStep('processing')
    setProcessingStage(0)

    // Animate through stages
    for (let i = 1; i < STAGES.length; i++) {
      await new Promise(r => setTimeout(r, 900))
      setProcessingStage(i)
    }

    try {
      const formData = new FormData()
      formData.append('file', file)
      if (selectedDocType) formData.append('documentType', selectedDocType)

      const response = await fetch('/api/analyze-document', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()
      setResult({ success: true, ...data })
    } catch {
      setResult({ success: false, error: 'Error procesando el documento. Intenta de nuevo.' })
    }

    setStep('results')
  }

  const handleReset = () => {
    setStep('select')
    setFile(null)
    setResult(null)
    setSelectedDocType(null)
    setProcessingStage(0)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-6xl">

        {/* Header */}
        <div className="mb-10 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-[4px] badge-accent mb-4 text-sm">
            <Sparkles className="w-3.5 h-3.5" />
            Motor OCR con Inteligencia Artificial
          </div>
          <h1 className="text-[26px] sm:text-[28px] font-black text-balance mb-3">
            Procesar <span className="text-gradient">Documentos</span>
          </h1>
          <p className="text-[var(--cf-text-muted)] text-lg max-w-xl mx-auto">
            Sube cualquier documento de transporte y extrae los datos automáticamente con IA.
          </p>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-center gap-2 mb-10">
          {(['select', 'upload', 'processing', 'results'] as Step[]).map((s, i) => {
            const labels = ['Tipo', 'Archivo', 'Procesando', 'Resultado']
            const stepIndex = ['select', 'upload', 'processing', 'results'].indexOf(step)
            const isDone = i < stepIndex
            const isCurrent = s === step
            return (
              <div key={s} className="flex items-center gap-2">
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-[4px] text-xs font-semibold transition-colors ${
                  isCurrent ? 'bg-[var(--cf-accent)] text-[var(--cf-text)]-foreground' :
                  isDone ? 'bg-[var(--cf-success)]/20 text-[var(--cf-success)] border border-[var(--cf-success)]/35' :
                  'bg-[var(--cf-surface-raised)] text-[var(--cf-text-muted)]'
                }`}>
                  {isDone ? <CheckCircle className="w-3.5 h-3.5" /> : <span>{i + 1}</span>}
                  {labels[i]}
                </div>
                {i < 3 && <ChevronRight className="w-4 h-4 text-[var(--cf-text-muted)]/40" />}
              </div>
            )
          })}
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Main panel */}
          <div className="lg:col-span-2 space-y-6">

            {/* Step 1: Select document type */}
            <Card className={`border transition-colors ${step === 'select' ? 'border-[var(--cf-accent)]/50 shadow-none shadow-none' : 'border-[var(--cf-border)]'}`}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <span className={`w-6 h-6 rounded-[4px] flex items-center justify-center text-xs font-semibold ${
                      step !== 'select' ? 'bg-[var(--cf-success)] text-white' : 'bg-[var(--cf-accent)] text-white'
                    }`}>
                      {step !== 'select' ? <CheckCircle className="w-3.5 h-3.5" /> : '1'}
                    </span>
                    Tipo de documento
                    {selectedDocType && (
                      <Badge className="bg-[var(--cf-accent-soft)] text-[var(--cf-text)] text-xs">
                        {DOCUMENT_TYPES.find(d => d.code === selectedDocType)?.label}
                      </Badge>
                    )}
                  </CardTitle>
                  {selectedDocType && step !== 'select' && (
                    <Button variant="ghost" size="sm" className="text-xs text-[var(--cf-text-muted)]" onClick={() => setStep('select')}>
                      Cambiar
                    </Button>
                  )}
                </div>
              </CardHeader>
              {step === 'select' && (
                <CardContent>
                  <p className="text-sm text-[var(--cf-text-muted)] mb-4">
                    Selecciona el tipo de documento para mejorar la precisión del OCR. Puedes omitir este paso.
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {DOCUMENT_TYPES.map(doc => (
                      <button
                        key={doc.code}
                        onClick={() => { setSelectedDocType(doc.code); setStep('upload') }}
                        className={`flex flex-col items-start gap-1 p-3 rounded-[6px] border text-left transition-colors hover:border-[var(--cf-accent)]/50 hover:bg-[var(--cf-accent-soft)] ${
                          selectedDocType === doc.code ? 'border-primary bg-[var(--cf-accent-soft)]' : 'border-[var(--cf-border)]'
                        }`}
                      >
                        <FileText className="h-4 w-4 text-[var(--cf-text-muted)]" />
                        <span className="text-xs font-medium text-[var(--cf-text)] leading-tight">{doc.label}</span>
                        <span className="text-xs text-[var(--cf-text-muted)] capitalize">{doc.category}</span>
                      </button>
                    ))}
                  </div>
                  <div className="mt-4 pt-4 border-t border-[var(--cf-border)]">
                    <Button variant="outline" size="sm" onClick={() => setStep('upload')} className="w-full text-[var(--cf-text-muted)]">
                      Omitir — detectar tipo automáticamente
                    </Button>
                  </div>
                </CardContent>
              )}
            </Card>

            {/* Step 2: Upload */}
            {(step === 'upload' || step === 'processing' || step === 'results') && (
              <Card className={`border transition-colors ${step === 'upload' ? 'border-[var(--cf-accent)]/50 shadow-none shadow-none' : 'border-[var(--cf-border)]'}`}>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <span className={`w-6 h-6 rounded-[4px] flex items-center justify-center text-xs font-semibold ${
                      step !== 'upload' ? 'bg-[var(--cf-success)] text-white' : 'bg-[var(--cf-accent)] text-white'
                    }`}>
                      {step !== 'upload' ? <CheckCircle className="w-3.5 h-3.5" /> : '2'}
                    </span>
                    Subir archivo
                  </CardTitle>
                </CardHeader>
                {step === 'upload' && (
                  <CardContent className="space-y-4">
                    {/* Drop zone */}
                    <div
                      className={`relative flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-[8px] cursor-pointer transition-colors ${
                        dragOver ? 'border-primary bg-[var(--cf-accent-soft)] scale-[1.01]' :
                        file ? 'border-[var(--cf-success)]/35 bg-[var(--cf-success)]/5' : 'border-[var(--cf-border)] hover:border-[var(--cf-accent)]/50 hover:bg-[var(--cf-accent-soft)]'
                      }`}
                      onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                      onDragLeave={() => setDragOver(false)}
                      onDrop={handleDrop}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      {file ? (
                        <div className="flex flex-col items-center gap-2 p-4 text-center">
                          <div className="w-12 h-12 rounded-[6px] bg-[var(--cf-success)]/20 flex items-center justify-center">
                            <FileImage className="w-6 h-6 text-[var(--cf-success)]" />
                          </div>
                          <p className="font-medium text-[var(--cf-text)]">{file.name}</p>
                          <p className="text-sm text-[var(--cf-text-muted)]">{(file.size / 1024).toFixed(1)} KB</p>
                          <Badge className="bg-[var(--cf-success-soft)] text-[var(--cf-success)]">Listo para procesar</Badge>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-3 text-center px-6">
                          <div className="w-14 h-14 rounded-[8px] bg-[var(--cf-surface-raised)] flex items-center justify-center">
                            <Upload className="w-7 h-7 text-[var(--cf-text-muted)]" />
                          </div>
                          <div>
                            <p className="font-semibold text-[var(--cf-text)]">Arrastra tu documento aquí</p>
                            <p className="text-sm text-[var(--cf-text-muted)] mt-1">o haz clic para buscar</p>
                          </div>
                          <p className="text-xs text-[var(--cf-text-muted)]">PDF, JPG, PNG — máx. 10MB</p>
                        </div>
                      )}
                      <input
                        ref={fileInputRef}
                        type="file"
                        className="hidden"
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={handleFileSelect}
                      />
                    </div>

                    {file && (
                      <div className="flex gap-2">
                        <Button onClick={handleProcess} className=" flex-1 h-11">
                          <ScanLine className="w-4 h-4 mr-2" />
                          Procesar con IA
                        </Button>
                        <Button variant="outline" size="icon" className="h-11 w-11" onClick={() => { setFile(null); if (fileInputRef.current) fileInputRef.current.value = '' }}>
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                  </CardContent>
                )}
              </Card>
            )}

            {/* Step 3: Processing */}
            {step === 'processing' && (
              <Card className="border-[var(--cf-accent)]/50 shadow-none shadow-none ">
                <CardContent className="py-10">
                  <div className="flex flex-col items-center gap-6 text-center">
                    <div className="relative">
                      <div className="w-20 h-20 rounded-[8px] bg-[var(--cf-accent)] flex items-center justify-center  ">
                        <ScanLine className="w-10 h-10 text-white" />
                      </div>
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold mb-1">Procesando documento</h3>
                      <p className="text-accent font-medium ">{STAGES[processingStage]}</p>
                    </div>
                    <div className="w-full max-w-xs space-y-2">
                      <div className="w-full bg-[var(--cf-surface-raised)] rounded-[4px] h-2 overflow-hidden">
                        <div
                          className="h-2 bg-[var(--cf-accent)] rounded-[4px] transition-colors duration-700"
                          style={{ width: `${((processingStage + 1) / STAGES.length) * 100}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-xs text-[var(--cf-text-muted)]">
                        {STAGES.map((_, i) => (
                          <div key={i} className={`w-1.5 h-1.5 rounded-[4px] ${i <= processingStage ? 'bg-[var(--cf-accent)]' : 'bg-[var(--cf-surface-raised)]'}`} />
                        ))}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 justify-center">
                      {STAGES.map((label, i) => (
                        <span key={i} className={`text-xs px-2.5 py-1 rounded-[4px] border transition-colors ${
                          i < processingStage ? 'bg-[var(--cf-success-soft)] text-[var(--cf-success)] border-[var(--cf-success)]/35' :
                          i === processingStage ? 'bg-[var(--cf-accent-soft)] text-[var(--cf-text)] border-[var(--cf-accent)]/35 ' :
                          'bg-[var(--cf-surface-raised)] text-[var(--cf-text-muted)] border-[var(--cf-border)]'
                        }`}>
                          {i < processingStage && '✓ '}{label}
                        </span>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Step 4: Results */}
            {step === 'results' && result && (
              <Card className={`border  ${result.success ? 'border-[var(--cf-success)]/35' : 'border-destructive/30'}`}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      {result.success ? (
                        <CheckCircle className="w-5 h-5 text-[var(--cf-success)]" />
                      ) : (
                        <AlertCircle className="w-5 h-5 text-destructive" />
                      )}
                      {result.success ? 'Extracción completada' : 'Error en procesamiento'}
                    </CardTitle>
                    <Button variant="outline" size="sm" onClick={handleReset}>
                      <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                      Nuevo
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  {result.success ? (
                    <>
                      {/* Confidence */}
                      {result.confidence !== undefined && (
                        <div className="p-4 rounded-[6px] bg-[var(--cf-surface-raised)]/50 border border-[var(--cf-border)]">
                          <ConfidenceBar score={result.confidence} />
                        </div>
                      )}

                      {/* Extracted fields */}
                      {result.extractedData && Object.keys(result.extractedData).length > 0 && (
                        <div className="space-y-3">
                          <h4 className="text-sm font-semibold text-[var(--cf-text-muted)] uppercase tracking-wider">Datos Extraídos</h4>
                          <div className="divide-y divide-border rounded-[6px] border border-[var(--cf-border)] overflow-hidden">
                            {Object.entries(result.extractedData).map(([key, value]) => (
                              <div key={key} className="flex items-start justify-between px-4 py-3 hover:bg-[var(--cf-surface-raised)]/30 transition-colors">
                                <span className="text-sm text-[var(--cf-text-muted)] capitalize flex-shrink-0 mr-4">
                                  {key.replace(/_/g, ' ')}
                                </span>
                                <span className="text-sm font-semibold text-[var(--cf-text)] text-right">{value}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Validation status */}
                      {result.validationStatus && (
                        <div className={`flex items-center gap-3 p-4 rounded-[6px] border ${
                          result.validationStatus === 'validated'
                            ? 'bg-[var(--cf-success)]/10 border-[var(--cf-success)]/35'
                            : 'bg-[var(--cf-warning-soft)] border-[var(--cf-warning)]/35'
                        }`}>
                          {result.validationStatus === 'validated'
                            ? <CheckCircle className="w-5 h-5 text-[var(--cf-success)] flex-shrink-0" />
                            : <AlertTriangle className="w-5 h-5 text-[var(--cf-warning)] flex-shrink-0" />}
                          <p className="text-sm font-medium">
                            {result.validationStatus === 'validated' ? 'Documento validado correctamente' : 'Pendiente de revisión manual'}
                          </p>
                        </div>
                      )}

                      <div className="flex gap-2 pt-2">
                        <Link href="/ocr/review" className="flex-1">
                          <Button variant="outline" className="w-full ">
                            <Eye className="w-4 h-4 mr-2" />
                            Ver en cola de revisión
                          </Button>
                        </Link>
                        <Button className="flex-1 " onClick={handleReset}>
                          <FilePlus className="w-4 h-4 mr-2" />
                          Otro documento
                        </Button>
                      </div>
                    </>
                  ) : (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>{result.error}</AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Tabs for gallery/requirements */}
            <Card>
              <div className="flex border-b border-[var(--cf-border)]">
                {[
                  { id: 'upload' as const, label: 'Guía', icon: FileText },
                  { id: 'gallery' as const, label: 'Galería', icon: BookOpen },
                  { id: 'requirements' as const, label: 'Requisitos', icon: BarChart3 },
                ].map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    onClick={() => setActiveTab(id)}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-medium border-b-2 transition-colors ${
                      activeTab === id
                        ? 'border-primary text-[var(--cf-text)]'
                        : 'border-transparent text-[var(--cf-text-muted)] hover:text-[var(--cf-text)]'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {label}
                  </button>
                ))}
              </div>
              <CardContent className="p-4">
                {activeTab === 'upload' && (
                  <div className="space-y-3">
                    <h4 className="font-semibold text-sm">Cómo funciona</h4>
                    {[
                      { n: 1, t: 'Selecciona el tipo', d: 'Elige el tipo de documento para mayor precisión.' },
                      { n: 2, t: 'Sube el archivo', d: 'Arrastra o selecciona PDF, JPG o PNG (máx. 10MB).' },
                      { n: 3, t: 'IA procesa', d: 'El motor OCR extrae todos los campos automáticamente.' },
                      { n: 4, t: 'Revisa los datos', d: 'Verifica y corrige si es necesario desde la cola.' },
                    ].map(({ n, t, d }) => (
                      <div key={n} className="flex gap-3">
                        <div className="w-6 h-6 rounded-[4px] bg-[var(--cf-accent)]/20 text-[var(--cf-text)] flex items-center justify-center text-xs font-semibold flex-shrink-0 mt-0.5">{n}</div>
                        <div>
                          <p className="text-sm font-medium text-[var(--cf-text)]">{t}</p>
                          <p className="text-xs text-[var(--cf-text-muted)]">{d}</p>
                        </div>
                      </div>
                    ))}

                    <div className="pt-3 border-t border-[var(--cf-border)] space-y-2">
                      <p className="text-xs font-semibold text-[var(--cf-text-muted)] uppercase tracking-wider">Consejos</p>
                      {[
                        'Buena iluminación, sin sombras',
                        'Documento completo, sin recortes',
                        'Mayor resolución = mayor precisión',
                      ].map((tip, i) => (
                        <div key={i} className="flex items-start gap-2 text-xs text-[var(--cf-text-muted)]">
                          <CheckCircle className="w-3.5 h-3.5 text-[var(--cf-success)] flex-shrink-0 mt-0.5" />
                          {tip}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {activeTab === 'gallery' && <DocumentReferenceGallery />}
                {activeTab === 'requirements' && <DocumentRequirements />}
              </CardContent>
            </Card>

            {/* Quick links */}
            <Card>
              <CardContent className="p-4 space-y-2">
                <p className="text-xs font-semibold text-[var(--cf-text-muted)] uppercase tracking-wider mb-3">Accesos Rápidos</p>
                <Link href="/ocr/compliance">
                  <Button variant="outline" className="w-full justify-start text-sm" size="sm">
                    <BarChart3 className="w-4 h-4 mr-2 text-[var(--cf-text)]" />
                    Dashboard de Compliance
                  </Button>
                </Link>
                <Link href="/ocr/review">
                  <Button variant="outline" className="w-full justify-start text-sm" size="sm">
                    <Eye className="w-4 h-4 mr-2 text-accent" />
                    Cola de Revisión
                  </Button>
                </Link>
                <Link href="/upload">
                  <Button variant="outline" className="w-full justify-start text-sm" size="sm">
                    <Upload className="w-4 h-4 mr-2 text-[var(--cf-text-muted)]" />
                    Subida de documentos
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
