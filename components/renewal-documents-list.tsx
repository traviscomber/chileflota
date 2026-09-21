'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Clock, Mail, FileText, Eye, AlertTriangle } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useDocumentSync } from '@/contexts/document-sync-context'
import { buildDocumentAccessUrl } from '@/lib/document-file-access'

interface RenewalDocument {
  id: string
  original_filename?: string
  document_type?: string
  file_url?: string
  expiration_date: string
  days_until_expiration: number
  conductores?: {
    id: string
    nombres: string
    apellido_paterno: string
    rut: string
  }
  created_at: string
}

interface Props {
  initialDocuments: RenewalDocument[]
}

export function RenewalDocumentsList({ initialDocuments }: Props) {
  const [documents, setDocuments] = useState(initialDocuments)
  const [previewDoc, setPreviewDoc] = useState<RenewalDocument | null>(null)
  const [loading, setLoading] = useState<string | null>(null)
  const { onSync } = useDocumentSync()

  // Listen for document sync events
  useEffect(() => {
    const unsubscribe = onSync((event) => {
      console.log('[v0] RenewalDocumentsList: Received sync event', event.type)
      
      // When status changes, remove from renewal list if no longer needs renewal
      if (event.type === 'document_status_changed' && event.documentId) {
        setDocuments(prev => prev.filter(d => d.id !== event.documentId))
      }
    })

    return unsubscribe
  }, [onSync])

  const handleSendRenewalRequest = async (conductorId: string, conductorEmail: string) => {
    setLoading(conductorId)
    try {
      // In a real scenario, this would send an email to the conductor
      // For now, we'll just simulate the action
      console.log('[v0] Sending renewal request to conductor:', conductorEmail)
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      // Show success message
      const msg = document.createElement('div')
      msg.className = 'fixed bottom-4 right-4 bg-[var(--cf-info-soft)] text-[var(--cf-text)] px-6 py-3 rounded-[6px] shadow-none z-[100]'
      msg.textContent = `Solicitud de renovación enviada a ${conductorEmail}`
      document.body.appendChild(msg)
      setTimeout(() => msg.remove(), 3000)
      
    } catch (error) {
      console.error('[v0] Error sending renewal request:', error)
      alert('Error al enviar la solicitud')
    } finally {
      setLoading(null)
    }
  }

  const getDaysColor = (days: number) => {
    if (days <= 7) return 'text-[var(--cf-danger)] bg-red-900/30'
    if (days <= 14) return 'text-[var(--cf-expiring)] bg-[var(--cf-expiring-soft)]'
    return 'text-yellow-400 bg-yellow-900/30'
  }

  const getDaysBadgeVariant = (days: number) => {
    if (days <= 7) return 'destructive'
    if (days <= 14) return 'outline'
    return 'secondary'
  }

  return (
    <div className="space-y-4">
      {documents.length === 0 ? (
        <Card className="bg-[var(--cf-surface)] border-[var(--cf-border)] text-center py-12">
          <CardContent>
            <p className="text-[var(--cf-text-muted)]">No hay documentos próximos a vencer</p>
          </CardContent>
        </Card>
      ) : (
        documents.map((doc) => {
          const conductor = Array.isArray(doc.conductores) ? doc.conductores[0] : doc.conductores
          const expirationDate = new Date(doc.expiration_date)
          const formattedDate = expirationDate.toLocaleDateString('es-ES', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          })

          return (
            <Card key={doc.id} className="bg-[var(--cf-surface)] border-[var(--cf-border)] hover:border-[var(--cf-border)] transition-colors">
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

                    {/* Expiration info */}
                    <div className="flex items-center gap-4 pt-2">
                      <div className={`flex items-center gap-2 px-3 py-1 rounded-md ${getDaysColor(doc.days_until_expiration)}`}>
                        <Clock className="h-4 w-4" />
                        <span className="text-sm font-semibold">
                          {doc.days_until_expiration} días
                        </span>
                      </div>
                      <p className="text-sm text-[var(--cf-text-secondary)]">
                        Vence el: <span className="font-medium">{formattedDate}</span>
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
                      variant="outline"
                      size="sm"
                      className="gap-1 border-[var(--cf-info)]/35 text-[var(--cf-info)] hover:bg-[var(--cf-info-soft)]"
                      onClick={() => handleSendRenewalRequest(conductor?.id || '', conductor?.rut || '')}
                      disabled={loading === conductor?.id}
                    >
                      <Mail className="h-4 w-4" />
                      {loading === conductor?.id ? 'Enviando...' : 'Solicitar'}
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
              <DialogTitle className="text-[var(--cf-text)]">
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
