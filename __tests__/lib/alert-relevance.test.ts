import { isDisplayRelevantAlert, isDocumentStatusChangeAlert, isDocumentUploadAlert, isUnvalidatedAiExpirationAlert } from '@/lib/alerts/relevance'

describe('alert relevance', () => {
  it('suppresses AI-derived expiration alerts from operational queues', () => {
    const alert = {
      alert_type: 'error',
      title: 'DOCUMENTO VENCIDO - Hoja de Vida',
      status: 'pendiente',
      metadata: {
        source: 'ai_analysis',
        ai_expiration_date: '2026-05-14',
      },
    }

    expect(isUnvalidatedAiExpirationAlert(alert)).toBe(true)
    expect(isDisplayRelevantAlert(alert)).toBe(false)
  })

  it('keeps canonical expiration alerts visible', () => {
    const alert = {
      alert_type: 'warning',
      title: 'Documento por vencer',
      status: 'pendiente',
      metadata: {
        source: 'expiration_cron',
        expiration_date: '2026-10-01',
      },
    }

    expect(isDisplayRelevantAlert(alert)).toBe(true)
  })

  it('does not surface resolved alerts', () => {
    expect(isDisplayRelevantAlert({ status: 'resuelto' })).toBe(false)
    expect(isDisplayRelevantAlert({ status: 'pendiente', is_resolved: true })).toBe(false)
  })

  it('identifies document upload alerts that need canonical pending-state validation', () => {
    expect(isDocumentUploadAlert({ metadata: { uploader_type: 'conductor', document_id: 'doc-1' } })).toBe(true)
    expect(isDocumentUploadAlert({ metadata: { source: 'expiration_cron', document_id: 'doc-1' } })).toBe(false)
  })

  it('identifies document status alerts for canonical state validation', () => {
    expect(isDocumentStatusChangeAlert({ metadata: { source: 'document_status_change', document_id: 'doc-1' } })).toBe(true)
    expect(isDocumentStatusChangeAlert({ metadata: { source: 'document_upload', document_id: 'doc-1' } })).toBe(false)
  })
})
