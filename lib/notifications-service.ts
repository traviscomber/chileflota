import { createAdminClient } from '@/lib/supabase/admin'

export interface NotificationTemplate {
  id: string
  type: 'email' | 'sms'
  title: string
  body: string
  subject?: string
  variables: string[]
}

export interface NotificationJob {
  id: string
  user_id: string
  email?: string
  phone?: string
  template_id: string
  variables: Record<string, string>
  status: 'pending' | 'sent' | 'failed'
  created_at: string
  sent_at?: string
}

export class NotificationProviderNotConfiguredError extends Error {
  constructor(channel: 'email' | 'sms') {
    super(`Notification ${channel} provider is not configured`)
    this.name = 'NotificationProviderNotConfiguredError'
  }
}

// Plantillas de notificación
export const NOTIFICATION_TEMPLATES: Record<string, NotificationTemplate> = {
  licencia_vencida: {
    id: 'licencia_vencida',
    type: 'email',
    title: 'Licencia de conducir vencida',
    subject: 'Acción requerida: Licencia de conducir vencida',
    body: 'Estimado {conductor_nombre},\n\nTu licencia de conducir {licencia_tipo} venció el {fecha_vencimiento}.\n\nPor favor, renuévala lo antes posible.\n\nSaludos,\nDocuFleet',
    variables: ['conductor_nombre', 'licencia_tipo', 'fecha_vencimiento'],
  },
  alerta_30_dias: {
    id: 'alerta_30_dias',
    type: 'sms',
    title: 'Alerta 30 días',
    body: '{conductor_nombre}: Tu {documento_tipo} vence en 30 días ({fecha_vencimiento}). Renuévalo ahora.',
    variables: ['conductor_nombre', 'documento_tipo', 'fecha_vencimiento'],
  },
  alerta_15_dias: {
    id: 'alerta_15_dias',
    type: 'sms',
    title: 'Alerta 15 días',
    body: '{conductor_nombre}: Tu {documento_tipo} vence en 15 días. ACCIÓN INMEDIATA REQUERIDA.',
    variables: ['conductor_nombre', 'documento_tipo', 'fecha_vencimiento'],
  },
  alerta_7_dias: {
    id: 'alerta_7_dias',
    type: 'email',
    title: 'Alerta crítica 7 días',
    subject: 'URGENTE: Documento vence en 7 días',
    body: 'Estimado {conductor_nombre},\n\nTu {documento_tipo} vence en SOLO 7 DÍAS ({fecha_vencimiento}).\n\nEsta es una alerta CRÍTICA. Renuévalo inmediatamente.\n\nDocuFleet',
    variables: ['conductor_nombre', 'documento_tipo', 'fecha_vencimiento'],
  },
  pre_calificacion_aprobada: {
    id: 'pre_calificacion_aprobada',
    type: 'email',
    title: 'Pre-calificación aprobada',
    subject: 'Bienvenido a DocuFleet - Pre-calificación completada',
    body: 'Estimado {transportista_nombre},\n\nTu empresa ha sido pre-calificada exitosamente.\n\nTu score de cumplimiento: {score}/100\n\nPuedes comenzar a operar inmediatamente.\n\nSaludos,\nDocuFleet',
    variables: ['transportista_nombre', 'score'],
  },
  pre_calificacion_rechazada: {
    id: 'pre_calificacion_rechazada',
    type: 'email',
    title: 'Pre-calificación requiere revisión',
    subject: 'Revisión requerida - Pre-calificación',
    body: 'Estimado {transportista_nombre},\n\nTu pre-calificación requiere revisión adicional.\n\nProblemas identificados:\n{problemas}\n\nContacta a soporte para resolver.\n\nDocuFleet',
    variables: ['transportista_nombre', 'problemas'],
  },
}

/**
 * Provider adapter placeholder. Until a real adapter is implemented this must
 * fail explicitly instead of logging PII and pretending that delivery occurred.
 */
export async function sendEmailNotification(
  _email: string,
  template_id: string,
  _variables: Record<string, string>
): Promise<void> {
  const template = NOTIFICATION_TEMPLATES[template_id]
  if (!template || template.type !== 'email') {
    throw new Error(`Template ${template_id} not found or not an email template`)
  }

  throw new NotificationProviderNotConfiguredError('email')
}

export async function sendSmsNotification(
  _phone: string,
  template_id: string,
  _variables: Record<string, string>
): Promise<void> {
  const template = NOTIFICATION_TEMPLATES[template_id]
  if (!template || template.type !== 'sms') {
    throw new Error(`Template ${template_id} not found or not an SMS template`)
  }

  throw new NotificationProviderNotConfiguredError('sms')
}

/**
 * Reemplaza variables en una plantilla
 */
export function interpolateTemplate(
  template: string,
  variables: Record<string, string>
): string {
  let result = template
  Object.entries(variables).forEach(([key, value]) => {
    result = result.replace(new RegExp(`{${key}}`, 'g'), value)
  })
  return result
}

/**
 * Legacy persistence adapter. Production currently has no notification_jobs
 * table, so callers must gate this behind getNotificationDeliveryCapability().
 */
export async function createNotificationJob(
  user_id: string,
  template_id: string,
  variables: Record<string, string>,
  contact: { email?: string; phone?: string }
): Promise<NotificationJob> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('notification_jobs')
    .insert({
      user_id,
      email: contact.email,
      phone: contact.phone,
      template_id,
      variables,
      status: 'pending',
    })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function getPendingNotifications(): Promise<NotificationJob[]> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('notification_jobs')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(100)

  if (error) throw error
  return data || []
}

export async function markNotificationAsSent(job_id: string): Promise<void> {
  const supabase = createAdminClient()

  const { error } = await supabase
    .from('notification_jobs')
    .update({ status: 'sent', sent_at: new Date().toISOString() })
    .eq('id', job_id)

  if (error) throw error
}

export async function markNotificationAsFailed(job_id: string, error_message: string): Promise<void> {
  const supabase = createAdminClient()

  const { error } = await supabase
    .from('notification_jobs')
    .update({ status: 'failed', error: error_message })
    .eq('id', job_id)

  if (error) throw error
}
