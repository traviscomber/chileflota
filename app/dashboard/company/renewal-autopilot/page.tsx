'use client'

import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2, Clock3, Mail, MessageCircle, RefreshCw, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'

type Stage = 'expired' | 'd3' | 'd7' | 'd15' | 'd30'

type RenewalPlan = {
  dryRun: boolean
  sendEnabled: boolean
  generatedAt: string
  summary: {
    documentsInRenewalWindow: number
    companiesAffected: number
    contactableCompanies: number
    companiesMissingContact: number
    stages: Record<Stage, { documents: number; companies: number }>
  }
  items: Array<{
    documentId: string
    companyName: string
    rut: string | null
    documentType: string
    expiresAt: string
    daysUntilExpiry: number
    stage: Stage
    stageLabel: string
    suggestedAction: string
    suggestedChannel: 'email+whatsapp' | 'email' | 'whatsapp' | 'manual'
    contact: { email: string | null; phone: string | null; ready: boolean }
  }>
}

const stageNames: Record<Stage, string> = {
  expired: 'Vencidos',
  d3: '0–3 días',
  d7: '4–7 días',
  d15: '8–15 días',
  d30: '16–30 días',
}

function Channel({ channel }: { channel: RenewalPlan['items'][number]['suggestedChannel'] }) {
  if (channel === 'manual') {
    return <span className="text-xs text-amber-300">Contacto faltante</span>
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-[#A9ADB3]">
      {channel.includes('email') && <Mail className="h-3.5 w-3.5" />}
      {channel.includes('whatsapp') && <MessageCircle className="h-3.5 w-3.5" />}
      {channel === 'email+whatsapp' ? 'Email + WhatsApp' : channel === 'email' ? 'Email' : 'WhatsApp'}
    </span>
  )
}

export default function RenewalAutopilotPage() {
  const [data, setData] = useState<RenewalPlan | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/company/renewal-autopilot?limit=75&_t=${Date.now()}`, {
        cache: 'no-store',
        credentials: 'same-origin',
      })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      setData(await response.json())
    } catch (cause) {
      console.error('[renewal-autopilot] load failed:', cause)
      setError('No fue posible calcular el plan de renovaciones.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <header className="flex flex-col gap-4 border-b border-[#303238] pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-[#A9ADB3]">Automatización segura</p>
          <h1 className="mt-2 text-2xl font-medium tracking-tight text-[#F2F0EB] sm:text-3xl">Autopiloto de Renovaciones</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[#A9ADB3]">
            Simula la cadencia de renovación sobre documentos canónicos vigentes. Este modo no envía mensajes ni modifica datos.
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          <span className="inline-flex w-full items-center justify-center gap-2 rounded-[4px] border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-center text-xs text-emerald-200 sm:w-auto">
            <ShieldCheck className="h-4 w-4 shrink-0" /> DRY-RUN · ENVÍO DESACTIVADO
          </span>
          <Button className="w-full sm:w-auto" variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={`mr-2 h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Actualizar
          </Button>
        </div>
      </header>

      {error && (
        <div className="rounded-[5px] border border-red-500/20 bg-red-500/[0.05] p-4 text-sm text-red-200">
          {error}
        </div>
      )}

      {loading && !data ? (
        <div className="h-40 animate-pulse rounded-[5px] border border-[#303238] bg-[#181A1D]" />
      ) : data ? (
        <>
          <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-[5px] border border-[#303238] bg-[#181A1D] p-4">
              <p className="text-[10px] uppercase tracking-[0.16em] text-[#8F949C]">Documentos en ventana</p>
              <p className="mt-2 text-3xl font-medium text-[#F2F0EB]">{data.summary.documentsInRenewalWindow.toLocaleString('es-CL')}</p>
              <p className="mt-1 text-xs text-[#777C84]">Vencidos + próximos 30 días</p>
            </div>
            <div className="rounded-[5px] border border-[#303238] bg-[#181A1D] p-4">
              <p className="text-[10px] uppercase tracking-[0.16em] text-[#8F949C]">Empresas afectadas</p>
              <p className="mt-2 text-3xl font-medium text-[#F2F0EB]">{data.summary.companiesAffected.toLocaleString('es-CL')}</p>
            </div>
            <div className="rounded-[5px] border border-emerald-500/20 bg-emerald-500/[0.06] p-4">
              <p className="text-[10px] uppercase tracking-[0.16em] text-emerald-300/70">Contactables</p>
              <p className="mt-2 text-3xl font-medium text-emerald-200">{data.summary.contactableCompanies.toLocaleString('es-CL')}</p>
              <p className="mt-1 text-xs text-emerald-300/50">Email y/o teléfono disponible</p>
            </div>
            <div className="rounded-[5px] border border-amber-500/20 bg-amber-500/[0.06] p-4">
              <p className="text-[10px] uppercase tracking-[0.16em] text-amber-300/70">Sin contacto</p>
              <p className="mt-2 text-3xl font-medium text-amber-200">{data.summary.companiesMissingContact.toLocaleString('es-CL')}</p>
              <p className="mt-1 text-xs text-amber-300/50">Requieren resolución manual</p>
            </div>
          </section>

          <section className="rounded-[5px] border border-[#303238] bg-[#15171A]">
            <div className="border-b border-[#303238] p-4 sm:p-5">
              <h2 className="text-lg font-medium text-[#F2F0EB]">Cadencia propuesta</h2>
              <p className="mt-1 text-sm text-[#8F949C]">Agrupa cada documento por el siguiente nivel de urgencia. No representa mensajes ya enviados.</p>
            </div>
            <div className="grid grid-cols-1 gap-px bg-[#303238] sm:grid-cols-2 lg:grid-cols-5">
              {(['expired', 'd3', 'd7', 'd15', 'd30'] as Stage[]).map((stage) => (
                <div key={stage} className="bg-[#181A1D] p-4">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-[#8F949C]">{stageNames[stage]}</p>
                  <p className="mt-2 text-2xl font-medium text-[#F2F0EB]">{data.summary.stages[stage].documents.toLocaleString('es-CL')}</p>
                  <p className="mt-1 text-xs text-[#777C84]">{data.summary.stages[stage].companies} empresas</p>
                </div>
              ))}
            </div>
          </section>

          <section className="overflow-hidden rounded-[5px] border border-[#303238] bg-[#15171A]">
            <div className="flex flex-col gap-2 border-b border-[#303238] p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
              <div className="min-w-0">
                <h2 className="text-lg font-medium text-[#F2F0EB]">Próximas acciones simuladas</h2>
                <p className="mt-1 text-sm text-[#8F949C]">Muestra hasta 75 casos priorizados. Ningún botón de envío está habilitado.</p>
              </div>
              <span className="shrink-0 text-xs text-[#777C84]">{new Date(data.generatedAt).toLocaleString('es-CL')}</span>
            </div>

            <div className="divide-y divide-[#303238]">
              {data.items.map((item) => (
                <div key={item.documentId} className="grid gap-3 px-4 py-4 sm:px-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,0.9fr)_minmax(0,0.8fr)_auto] lg:items-center">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-[#F2F0EB]">{item.companyName}</p>
                    <p className="mt-1 truncate text-xs text-[#8F949C]">{item.rut || 'Sin RUT'} · {item.documentType}</p>
                  </div>
                  <div>
                    <p className={`text-xs font-medium ${item.stage === 'expired' ? 'text-red-300' : item.stage === 'd3' ? 'text-amber-200' : 'text-[#D8D6D1]'}`}>
                      {item.stageLabel}
                    </p>
                    <p className="mt-1 text-xs text-[#777C84]">
                      {item.daysUntilExpiry < 0 ? `Vencido hace ${Math.abs(item.daysUntilExpiry)} días` : item.daysUntilExpiry === 0 ? 'Vence hoy' : `Vence en ${item.daysUntilExpiry} días`}
                    </p>
                  </div>
                  <Channel channel={item.suggestedChannel} />
                  <div className="flex items-center gap-2 text-xs text-[#A9ADB3]">
                    {item.stage === 'expired' ? <AlertTriangle className="h-4 w-4 shrink-0 text-red-300" /> : item.contact.ready ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-300" /> : <Clock3 className="h-4 w-4 shrink-0 text-amber-300" />}
                    {item.suggestedAction}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </>
      ) : null}
    </div>
  )
}
