export type AlertLike = { type?: string; alert_type?: string; title?: string; message?: string; status?: string; is_dismissed?: boolean; is_resolved?: boolean; metadata?: Record<string, unknown> }

export function isUnvalidatedAiExpirationAlert(alert: AlertLike): boolean {
  const source = String(alert.metadata?.source || '').toLowerCase()
  const aiExpiration = alert.metadata?.ai_expiration_date
  if (source !== 'ai_analysis' || !aiExpiration) return false
  const text = [alert.type, alert.alert_type, alert.title, alert.message].filter(Boolean).join(' ').toLowerCase()
  return /venc|expir/.test(text)
}

export function isDisplayRelevantAlert(alert: AlertLike): boolean {
  const status = String(alert.status || '').toLowerCase()
  if (status === 'resuelto' || status === 'actioned' || status === 'completado') return false
  if (alert.is_dismissed || alert.is_resolved) return false
  if (isUnvalidatedAiExpirationAlert(alert)) return false
  return true
}


export function isDocumentUploadAlert(alert: AlertLike): boolean {
  return Boolean(alert.metadata?.uploader_type && alert.metadata?.document_id)
}
