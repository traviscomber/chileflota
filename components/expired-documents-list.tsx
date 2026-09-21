'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { AlertTriangle, Mail, FileText, Eye, Flame } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useDocumentSync } from '@/contexts/document-sync-context'
import { buildDocumentAccessUrl } from '@/lib/document-file-access'

interface ExpiredDocument {
  id: string
  original_filename?: string
  document_type?: string
  file_url?: string
  expiration_date: string
  days_overdue: number
  conductores?: {
    id: string
    nombres: string
    apellido_paterno: string
    rut: string
  }
  created_at: string
}

interface Props {
  initialDocuments: ExpiredDocument[]
}

export function ExpiredDocumentsList({ initialDocuments }: Props) {
  const [documents, setDocuments] = useState(initialDocuments)
  const [previewDoc, setPreviewDoc] = useState<ExpiredDocument | null>(null)
  const [loading, setLoading] = useState<string | null>(null)
  const { onSync } = useDocumentSync()

  // Listen for document sync events
  useEffect(() => {
    const unsubscribe = onSync((event) => {
      console.log('[v0] ExpiredDocumentsList: Received sync event', event.type)
      
      // When status changes, remove from expired list
      if (event.type === 'document_status_changed' && event.documentId) {
        setDocuments(prev => prev.filter(d => d.id !== event.documentId))
      }
    })

    return unsubscribe
  }, [onSync])

  const handleForceRenewalRequest = async (conductorId: string, conductorEmail: string) => {
    setLoading(conductorId)
    try {
      console.log('[v0] Forcing renewal request to conductor:', conductorEmail)
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      // Show success message
      const msg = document.createElement('div')
      msg.className = 'fixed bottom-4 right-4 bg-[var(--cf-danger-soft)] text-[var(--cf-text)] px-6 py-3 rounded-[6px] shadow-none z-[100] flex items-center gap-2'
      msg.innerHTML = `<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg> Notificación urgente enviada a ${conductorEmail}`
      document.body.appendChild(msg)
      setTimeout(() => msg.remove(), 4000)
      
    } catch (error) {
      console.error('[v0] Error sending force renewal:', error)
      alert('Error al enviar la notificación')
    } finally {
      setLoading(null)
    }
  }

  // Sort by days overdue (most overdue first)
  const sortedDocs = [...documents].sort((a, b) => b.days_overdue - a.days_overdue)

  return (
    <div className="space-y-4">
      {sortedDocs.length === 0 ? (
        <Card className="bg-[var(--cf-surface)] border-[var(--cf-border)] text-center py-12">
          <CardContent>
            <p className="text-[var(--cf-text-muted)]">No hay documentos vencidos</p>
          </CardContent>
        </Card>
      ) : (
        sortedDocs.map((doc) => {
          const conductor = Array.isArray(doc.conductores) ? doc.conductores[0] : doc.conductores
          const expirationDate = new Date(doc.expiration_date)
          const formattedDate = expirationDate.toLocaleDateString('es-ES', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          })

          // Color intensity based on how overdue
          const isVeryCritical = doc.days_overdue > 90
          const isCritical = doc.days_overdue > 30
          const borderColor = isVeryCritical ? 'border-[var(--cf-danger)]/40' : isCritical ? 'border-[var(--cf-expiring)]/40' : 'border-[var(--cf-danger)]/40/50'
          const bgColor = isVeryCritical ? 'bg-[var(--cf-danger-soft)]' : isCritical ? 'bg-[var(--cf-expiring-soft)]' : 'bg-[var(--cf-danger-soft)]'

          return (
            <Card key={doc.id} className={`${bgColor} border-l-4 ${borderColor} hover:border-red-500 transition-colors`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-3">
                    {/* Document info */}
                    <div>
                      <p className="font-medium text-[var(--cf-text)] flex items-center gap-2">
                        <FileText className="h-4 w-4 text-[var(--cf-text-muted)]" />
                        {doc.original_filename || doc.document_type || 'Sin nombre'}
                      </p>
                      <p className="text-sm text-[var(--cf-text-muted)] mt-1">
                        Tipo: {doc.document_type || 'Desconocido'}
                      </p>
                    </div>

                    {/* Conductor info */}
                    {conductor && (
                      <div className="text-sm">
                        <p className="text-[var(--cf-text-muted)]">
                          Conductor: <span className="text-[var(--cf-text-secondary)] font-medium">
                            {conductor.nombres} {conductor.apellido_paterno}
                          </span>
                        </p>
                        <p className="text-[var(--cf-text-muted)]">
                          RUT: <span className="text-[var(--cf-text-secondary)] font-medium">{conductor.rut}</span>
                        </p>
                      </div>
                    )}

                    {/* Expiration info with overdue status */}
                    <div className="flex items-center gap-4 pt-2 flex-wrap">
                      <div className={`flex items-center gap-2 px-3 py-1 rounded-md ${
                        isVeryCritical 
                          ? 'bg-[var(--cf-danger-soft)] text-[var(--cf-text)]' 
                          : isCritical 
                            ? 'bg-[var(--cf-accent)] text-[var(--cf-text)]' 
                            : 'bg-[var(--cf-danger-soft)] text-[var(--cf-danger)]'
                      }`}>
                        <Flame className="h-4 w-4" />
                        <span className="text-sm font-bold">
                          {doc.days_overdue} días atrasado
                        </span>
                      </div>
                      <p className="text-sm text-[var(--cf-danger)]">
                        Vencido desde: <span className="font-medium">{formattedDate}</span>
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-2 justify-start">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1"
                      onClick={() => setPreviewDoc(doc)}
                    >
                      <Eye className="h-4 w-4" />
                      Ver
                    </Button>
                    <Button
                      size="sm"
                      className="gap-1 bg-[var(--cf-danger-soft)] hover:bg-red-700 text-[var(--cf-text)]"
                      onClick={() => handleForceRenewalRequest(conductor?.id || '', conductor?.rut || '')}
                      disabled={loading === conductor?.id}
                    >
                      <Flame className="h-4 w-4" />
                      {loading === conductor?.id ? 'Enviando...' : 'Urgente'}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })
      )}

      {/* Preview Modal - No se cierra por click fuera, solo por X o Escape */}
      {previewDoc && (
        <Dialog open={!!previewDoc} onOpenChange={(open) => { if (!open) setPreviewDoc(null) }}>
          <DialogContent 
            className="bg-[var(--cf-surface)] border-[var(--cf-border)] max-w-2xl"
            onPointerDownOutside={(e) => e.preventDefault()}
          >
            <DialogHeader>
              <DialogTitle className="text-[var(--cf-text)] flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-[var(--cf-danger)]" />
                Vista previa: {previewDoc.original_filename || previewDoc.document_type}
              </DialogTitle>
            </DialogHeader>
            
            {previewDoc.file_url ? (
              <div className="space-y-4">
                {previewDoc.file_url.toLowerCase().endsWith('.pdf') ? (
                  <iframe
                    src={previewDoc.file_url}
                    className="w-full h-96 border border-[var(--cf-border)] rounded"
                    title="Preview"
                  />
                ) : previewDoc.file_url.toLowerCase().match(/\.(jpg|jpeg|png|gif)$/i) ? (
                  <img
                    src={previewDoc.file_url}
                    alt="Preview"
                    className="w-full rounded border border-[var(--cf-border)]"
                  />
                ) : (
                  <div className="bg-[var(--cf-surface)] p-6 rounded border border-[var(--cf-border)] text-center">
                    <p className="text-[var(--cf-text-muted)]">
                      Tipo de archivo no soportado para vista previa
                    </p>
                      <a
                        href={buildDocumentAccessUrl(previewDoc.file_url, 'preview')}
                        target="_blank"
                        rel="noopener noreferrer"
                      className="text-[var(--cf-info)] hover:underline mt-2 block"
                    >
                      Descargar archivo
                    </a>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-[var(--cf-surface)] p-6 rounded border border-[var(--cf-border)] text-center">
                <p className="text-[var(--cf-text-muted)]">No hay archivo disponible</p>
              </div>
            )}
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
