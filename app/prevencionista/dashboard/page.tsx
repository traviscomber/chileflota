'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { CheckCircle, Download, Eye, FileText, Users } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface ApprovedDocument {
  id: string
  file_name: string
  document_type_id: string
  created_at: string
  file_url: string
  subcontractor_id: string
  type_code: string
}

interface DocumentStats {
  totalApproved: number
  totalSubcontractors: number
  documentTypes: number
}

export default function PrevencionistaDashboard() {
  const [stats, setStats] = useState<DocumentStats | null>(null)
  const [documents, setDocuments] = useState<ApprovedDocument[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function loadData() {
      try {
        const { data: types } = await supabase
          .from('subcontractor_document_types')
          .select('id, code')
          .eq('is_active', true)
          .order('code')

        const allDocs: ApprovedDocument[] = []
        let offset = 0
        const batchSize = 1000
        let hasMore = true

        while (hasMore) {
          const { data: batch } = await supabase
            .from('subcontractor_documents')
            .select('id, file_name, document_type_id, created_at, file_url, subcontractor_id')
            .eq('status', 'approved')
            .order('created_at', { ascending: false })
            .range(offset, offset + batchSize - 1)

          if (!batch || batch.length === 0) hasMore = false
          else {
            allDocs.push(...batch)
            offset += batchSize
          }
        }

        const typesMap = new Map((types as any[])?.map((t: any) => [t.id, t.code]) || [])
        const mappedDocs = allDocs.map((d: any) => ({ ...d, type_code: typesMap.get(d.document_type_id) || 'UNKNOWN' }))

        const { data: subcontractors } = await supabase
          .from('subcontractor_documents')
          .select('subcontractor_id')
          .eq('status', 'approved')

        const uniqueSubcontractors = new Set((subcontractors as any[])?.map((d: any) => d.subcontractor_id)).size

        setDocuments(mappedDocs.slice(0, 10))
        setStats({
          totalApproved: allDocs.length,
          totalSubcontractors: uniqueSubcontractors,
          documentTypes: types?.length || 0,
        })
      } catch (error) {
        console.error('Error loading data:', error)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [supabase])

  const handleDownload = async (doc: ApprovedDocument) => {
    try {
      const response = await fetch(doc.file_url)
      if (!response.ok) throw new Error('Error downloading file')
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = doc.file_name
      document.body.appendChild(a)
      a.click()
      URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      console.error('Error downloading document:', error)
      alert('Error al descargar el documento')
    }
  }

  const handlePreview = (doc: ApprovedDocument) => {
    const link = document.createElement('a')
    link.href = doc.file_url
    link.target = '_blank'
    link.rel = 'noopener noreferrer'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <main className="min-h-screen bg-[var(--cf-canvas)] px-4 py-6 text-[var(--cf-text)] sm:px-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="border-b border-[var(--cf-border)] pb-5">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-[var(--cf-text-muted)]">Prevención</p>
          <h1 className="mt-2 text-[28px] font-semibold tracking-[-0.03em]">Documentos aprobados</h1>
          <p className="mt-1 text-sm text-[var(--cf-text-secondary)]">Acceso de solo lectura a evidencia documental validada.</p>
        </section>

        <section className="grid gap-3 sm:grid-cols-3">
          <Metric icon={CheckCircle} label="Aprobados" value={loading ? '—' : stats?.totalApproved ?? 0} note="Disponibles para revisar" tone="success" />
          <Metric icon={Users} label="Subcontratistas" value={loading ? '—' : stats?.totalSubcontractors ?? 0} note="Con documentación aprobada" />
          <Metric icon={FileText} label="Tipos documentales" value={loading ? '—' : stats?.documentTypes ?? 0} note="Activos en el sistema" />
        </section>

        <Card>
          <CardHeader className="flex-row items-end justify-between gap-4">
            <div>
              <CardTitle>Documentos recientes</CardTitle>
              <CardDescription>Últimos 10 documentos aprobados.</CardDescription>
            </div>
            <Link href="/prevencionista/documentos">
              <Button variant="outline" size="sm">Ver todos</Button>
            </Link>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="py-8 text-center text-sm text-[var(--cf-text-muted)]">Cargando documentos…</div>
            ) : documents.length === 0 ? (
              <div className="py-8 text-center text-sm text-[var(--cf-text-muted)]">No hay documentos aprobados.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[680px] text-sm">
                  <thead>
                    <tr className="border-b border-[var(--cf-border)]">
                      <th className="px-3 py-2 text-left text-xs font-medium text-[var(--cf-text-muted)]">Nombre</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-[var(--cf-text-muted)]">Tipo</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-[var(--cf-text-muted)]">Fecha</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-[var(--cf-text-muted)]">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--cf-border)]">
                    {documents.map((doc) => (
                      <tr key={doc.id} className="hover:bg-[var(--cf-surface-raised)]">
                        <td className="px-3 py-3 text-[var(--cf-text)]">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-[var(--cf-text-muted)]" />
                            <span className="max-w-[320px] truncate">{doc.file_name}</span>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-xs text-[var(--cf-text-secondary)]">{doc.type_code}</td>
                        <td className="px-3 py-3 text-xs tabular-nums text-[var(--cf-text-muted)]">{new Date(doc.created_at).toLocaleDateString('es-CL')}</td>
                        <td className="px-3 py-3">
                          <div className="flex justify-end gap-1">
                            <Button size="sm" variant="ghost" onClick={() => handlePreview(doc)} title="Ver documento"><Eye className="h-4 w-4" /></Button>
                            <Button size="sm" variant="ghost" onClick={() => handleDownload(doc)} title="Descargar documento"><Download className="h-4 w-4" /></Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  )
}

function Metric({ icon: Icon, label, value, note, tone }: { icon: any; label: string; value: string | number; note: string; tone?: 'success' }) {
  return (
    <div className="rounded-[6px] border border-[var(--cf-border)] bg-[var(--cf-surface)] p-4">
      <div className="flex items-center gap-2">
        <Icon className={`h-4 w-4 ${tone === 'success' ? 'text-[var(--cf-success)]' : 'text-[var(--cf-text-muted)]'}`} />
        <p className="text-xs font-medium text-[var(--cf-text-muted)]">{label}</p>
      </div>
      <p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p>
      <p className="mt-1 text-xs text-[var(--cf-text-muted)]">{note}</p>
    </div>
  )
}
