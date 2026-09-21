'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, CheckCircle2, Clock, FileText, LogOut } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { DocumentAlertsWidget } from '@/components/admin/document-alerts-widget'

interface ExecutiveSession {
  id: string
  email: string
  full_name: string
  rut: string
  role: string
  created_at: string
}

interface Document {
  id: string
  conductor_name: string
  document_type: string
  status: 'pending' | 'validated' | 'rejected' | 'expired'
  created_at: string
  file_url?: string
}

export default function ExecutiveDashboard() {
  const [session, setSession] = useState<ExecutiveSession | null>(null)
  const [documents, setDocuments] = useState<Document[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [stats, setStats] = useState({ pending: 0, validated: 0, rejected: 0 })
  const router = useRouter()

  useEffect(() => {
    const checkSession = async () => {
      const sessionData = localStorage.getItem('executive_session')
      if (!sessionData) {
        router.push('/executive/login')
        return
      }

      try {
        const parsedSession = JSON.parse(sessionData)
        setSession(parsedSession)
        const response = await fetch('/api/executive/documents/pending')
        if (response.ok) {
          const data = await response.json()
          setDocuments(data)
          setStats({
            pending: data.filter((d: Document) => d.status === 'pending').length,
            validated: data.filter((d: Document) => d.status === 'validated').length,
            rejected: data.filter((d: Document) => d.status === 'rejected').length,
          })
        }
      } catch (error) {
        console.error('Session error:', error)
        router.push('/executive/login')
      } finally {
        setIsLoading(false)
      }
    }

    checkSession()
  }, [router])

  const handleLogout = () => {
    localStorage.removeItem('executive_session')
    router.push('/executive/login')
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--cf-canvas)]">
        <p className="text-sm text-[var(--cf-text-muted)]">Cargando…</p>
      </div>
    )
  }

  if (!session) return null

  return (
    <main className="min-h-screen bg-[var(--cf-canvas)] px-4 py-6 text-[var(--cf-text)] sm:px-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="flex flex-col gap-4 border-b border-[var(--cf-border)] pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-[var(--cf-text-muted)]">Ejecutiva</p>
            <h1 className="mt-2 text-[28px] font-semibold tracking-[-0.03em]">Revisión documental</h1>
            <p className="mt-1 text-sm text-[var(--cf-text-secondary)]">Prioriza documentos pendientes y alertas de vencimiento.</p>
          </div>
          <Button onClick={handleLogout} variant="outline">
            <LogOut className="h-4 w-4" />
            Cerrar sesión
          </Button>
        </section>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="Pendientes" value={stats.pending} note="Requieren revisión" tone="warning" />
          <Metric label="Validados" value={stats.validated} note="Aprobados" tone="success" />
          <Metric label="Rechazados" value={stats.rejected} note="Requieren corrección" tone="danger" />
          <Metric label="Ejecutiva" value={session.full_name} note={session.rut} />
        </section>

        <section className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
          <Card>
            <CardHeader>
              <CardTitle>Documentos pendientes</CardTitle>
              <CardDescription>Revisar sólo lo que requiere decisión.</CardDescription>
            </CardHeader>
            <CardContent>
              {documents.length === 0 ? (
                <div className="py-10 text-center">
                  <CheckCircle2 className="mx-auto h-5 w-5 text-[var(--cf-success)]" />
                  <p className="mt-2 text-sm text-[var(--cf-text-secondary)]">No hay documentos pendientes.</p>
                </div>
              ) : (
                <div className="divide-y divide-[var(--cf-border)]">
                  {documents.map((doc) => (
                    <div key={doc.id} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex min-w-0 items-center gap-3">
                        <FileText className="h-4 w-4 shrink-0 text-[var(--cf-text-muted)]" />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{doc.conductor_name}</p>
                          <p className="truncate text-xs text-[var(--cf-text-muted)]">{doc.document_type}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusBadge status={doc.status} />
                        <Button size="sm" variant="outline">Ver</Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Alertas</CardTitle>
              <CardDescription>Próximos vencimientos.</CardDescription>
            </CardHeader>
            <CardContent>
              <DocumentAlertsWidget daysThreshold={30} />
            </CardContent>
          </Card>
        </section>

        <section className="rounded-[6px] border border-[var(--cf-border)] bg-[var(--cf-surface)] px-4 py-3 text-xs text-[var(--cf-text-muted)]">
          {session.email} · Ejecutivo
        </section>
      </div>
    </main>
  )
}

function Metric({ label, value, note, tone }: { label: string; value: string | number; note: string; tone?: 'success' | 'warning' | 'danger' }) {
  const valueClass = tone === 'success'
    ? 'text-[var(--cf-success)]'
    : tone === 'warning'
      ? 'text-[var(--cf-warning)]'
      : tone === 'danger'
        ? 'text-[var(--cf-danger)]'
        : 'text-[var(--cf-text)]'

  return (
    <div className="rounded-[6px] border border-[var(--cf-border)] bg-[var(--cf-surface)] p-4">
      <p className="text-xs text-[var(--cf-text-muted)]">{label}</p>
      <p className={`mt-2 truncate text-2xl font-semibold tabular-nums ${valueClass}`}>{value}</p>
      <p className="mt-1 text-xs text-[var(--cf-text-muted)]">{note}</p>
    </div>
  )
}

function StatusBadge({ status }: { status: Document['status'] }) {
  if (status === 'validated') return <Badge className="border-0 bg-[var(--cf-success-soft)] text-[var(--cf-success)]"><CheckCircle2 className="mr-1 h-3 w-3" />Validado</Badge>
  if (status === 'rejected' || status === 'expired') return <Badge className="border-0 bg-[var(--cf-danger-soft)] text-[var(--cf-danger)]"><AlertCircle className="mr-1 h-3 w-3" />{status === 'expired' ? 'Vencido' : 'Rechazado'}</Badge>
  return <Badge className="border-0 bg-[var(--cf-warning-soft)] text-[var(--cf-warning)]"><Clock className="mr-1 h-3 w-3" />Pendiente</Badge>
}
