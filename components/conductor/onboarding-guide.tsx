'use client'

import { useState } from 'react'
import { ArrowLeft, CheckCircle2, ChevronRight, FileText, HelpCircle, MessageCircle, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const ONBOARDING_STEPS = [
  {
    id: 1,
    title: 'Documentos requeridos',
    description: 'Qué necesitas mantener vigente para operar.',
    icon: FileText,
    content: [
      'Licencia de conducir vigente.',
      'Certificado de antecedentes vigente.',
      'Hoja de vida del conductor.',
      'Cédula de identidad vigente.',
      'Documentos adicionales solicitados por Transportes Labbé.',
    ],
  },
  {
    id: 2,
    title: 'Estados documentales',
    description: 'Cómo leer cada estado sin duplicar cargas.',
    icon: ShieldCheck,
    content: [
      'Aprobado: validado y sin acción requerida.',
      'En revisión: recibido correctamente; no vuelvas a subirlo.',
      'Por vencer: conviene renovarlo antes de que afecte tu habilitación.',
      'Rechazado o vencido: revisa el motivo y reemplázalo.',
    ],
  },
  {
    id: 3,
    title: 'Carga de documentos',
    description: 'Cómo asociar correctamente cada archivo.',
    icon: CheckCircle2,
    content: [
      'Selecciona el tipo documental correcto.',
      'Usa la fecha real del documento.',
      'Puedes cargar documentos de períodos anteriores.',
      'Si eliges un período histórico, ChileFlota te pedirá confirmación antes de guardar.',
    ],
  },
  {
    id: 4,
    title: 'Ayuda',
    description: 'Qué hacer si algo no coincide.',
    icon: HelpCircle,
    content: [
      'Si un documento fue rechazado, revisa el motivo antes de reemplazarlo.',
      'Si ves información incorrecta en tu perfil, contacta a tu ejecutiva.',
      'No necesitas volver a cargar un documento que está en revisión.',
      'Soporte: soporte@labbe.cl.',
    ],
  },
  {
    id: 5,
    title: 'WhatsApp',
    description: 'Activa avisos operacionales si quieres recibirlos.',
    icon: MessageCircle,
    content: [],
  },
]

interface OnboardingGuideProps {
  onComplete?: () => void
  onSkip?: () => void
}

export function OnboardingGuide({ onComplete }: OnboardingGuideProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const [whatsappPhone, setWhatsappPhone] = useState('')
  const [whatsappSaved, setWhatsappSaved] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const step = ONBOARDING_STEPS[currentStep]
  const Icon = step.icon

  const handleWhatsappSave = async () => {
    if (!whatsappPhone || whatsappPhone.length < 12) {
      alert('Ingresa un número de WhatsApp válido (+56XXXXXXXXX)')
      return
    }
    setIsLoading(true)
    try {
      const response = await fetch('/api/conductor/whatsapp-preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ whatsapp_phone: whatsappPhone }),
      })
      if (!response.ok) throw new Error('Error saving WhatsApp')
      setWhatsappSaved(true)
    } catch (error) {
      console.error('[v0] Error saving WhatsApp:', error)
      alert('No fue posible guardar el número. Intenta nuevamente.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <section className="border-b border-[var(--cf-border)] pb-5">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-[var(--cf-text-muted)]">Guía de inicio</p>
        <h2 className="mt-2 text-[26px] font-semibold tracking-[-0.03em] text-[var(--cf-text)]">Cómo usar ChileFlota</h2>
        <p className="mt-1 text-sm text-[var(--cf-text-secondary)]">Cinco pasos breves para revisar, cargar y mantener tus documentos.</p>
      </section>

      <div className="rounded-[8px] border border-[var(--cf-border)] bg-[var(--cf-surface)]">
        <div className="border-b border-[var(--cf-border)] px-5 py-4">
          <div className="flex items-center justify-between gap-4">
            <p className="text-xs font-medium text-[var(--cf-text-muted)]">Paso {currentStep + 1} de {ONBOARDING_STEPS.length}</p>
            <p className="text-xs text-[var(--cf-text-muted)]">{Math.round(((currentStep + 1) / ONBOARDING_STEPS.length) * 100)}%</p>
          </div>
          <div className="mt-3 h-1 overflow-hidden rounded-[2px] bg-[var(--cf-surface-raised)]">
            <div className="h-full bg-[var(--cf-accent)] transition-[width]" style={{ width: `${((currentStep + 1) / ONBOARDING_STEPS.length) * 100}%` }} />
          </div>
        </div>

        <div className="p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[6px] bg-[var(--cf-accent-soft)] text-[var(--cf-text-secondary)]">
              <Icon className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-[var(--cf-text)]">{step.title}</h3>
              <p className="mt-1 text-sm text-[var(--cf-text-muted)]">{step.description}</p>
            </div>
          </div>

          {currentStep === ONBOARDING_STEPS.length - 1 ? (
            <div className="mt-6 space-y-4">
              {whatsappSaved ? (
                <div className="rounded-[6px] border border-[var(--cf-success)]/35 bg-[var(--cf-success-soft)] px-4 py-3">
                  <p className="text-sm font-medium text-[var(--cf-success)]">WhatsApp guardado</p>
                  <p className="mt-1 text-xs text-[var(--cf-text-secondary)]">{whatsappPhone}</p>
                </div>
              ) : (
                <>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-[var(--cf-text-secondary)]">Número de WhatsApp</label>
                    <Input
                      type="tel"
                      placeholder="+56912345678"
                      value={whatsappPhone}
                      onChange={(e) => setWhatsappPhone(e.target.value)}
                    />
                    <p className="mt-1.5 text-xs text-[var(--cf-text-muted)]">Opcional. Puedes configurarlo después desde Mi perfil.</p>
                  </div>
                  <Button onClick={handleWhatsappSave} disabled={isLoading} className="w-full sm:w-auto">
                    {isLoading ? 'Guardando…' : 'Guardar WhatsApp'}
                  </Button>
                </>
              )}
            </div>
          ) : (
            <ul className="mt-6 divide-y divide-[var(--cf-border)] border-y border-[var(--cf-border)]">
              {step.content.map((item) => (
                <li key={item} className="flex gap-3 py-3 text-sm text-[var(--cf-text-secondary)]">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--cf-text-muted)]" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Button variant="outline" onClick={() => setCurrentStep((step) => Math.max(0, step - 1))} disabled={currentStep === 0}>
          <ArrowLeft className="h-4 w-4" /> Atrás
        </Button>

        {currentStep < ONBOARDING_STEPS.length - 1 ? (
          <Button onClick={() => setCurrentStep((step) => Math.min(ONBOARDING_STEPS.length - 1, step + 1))}>
            Siguiente <ChevronRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button onClick={() => onComplete?.()}>
            Ir a documentos <ChevronRight className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  )
}
