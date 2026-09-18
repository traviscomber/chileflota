const insertMock = jest.fn()
const fromMock = jest.fn(() => ({ insert: insertMock }))
const createAdminClientMock = jest.fn(() => ({ from: fromMock }))

jest.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => createAdminClientMock(),
}))

import {
  emitOperationalEvent,
  sanitizeOperationalMetadata,
} from '@/lib/operational-telemetry'

describe('operational telemetry safety contract', () => {
  const originalEnabled = process.env.OPERATIONAL_TELEMETRY_ENABLED

  beforeEach(() => {
    jest.clearAllMocks()
    delete process.env.OPERATIONAL_TELEMETRY_ENABLED
    insertMock.mockResolvedValue({ error: null })
  })

  afterAll(() => {
    if (originalEnabled === undefined) {
      delete process.env.OPERATIONAL_TELEMETRY_ENABLED
    } else {
      process.env.OPERATIONAL_TELEMETRY_ENABLED = originalEnabled
    }
  })

  it('does not initialize Supabase or write when disabled', async () => {
    const result = await emitOperationalEvent({
      eventName: 'document_approved',
      entityType: 'document',
      entityId: 'doc-1',
      source: 'company.document_status',
    })

    expect(result).toEqual({ emitted: false, reason: 'disabled' })
    expect(createAdminClientMock).not.toHaveBeenCalled()
    expect(insertMock).not.toHaveBeenCalled()
  })

  it('keeps only allowlisted non-PII metadata', () => {
    expect(
      sanitizeOperationalMetadata({
        document_type: 'subcontractor',
        previous_status: 'pending',
        new_status: 'approved',
        email: 'person@example.com',
        rut: '11.111.111-1',
        rejection_reason: 'private content',
        filename: 'contract.pdf',
        arbitrary: 'drop-me',
      })
    ).toEqual({
      document_type: 'subcontractor',
      previous_status: 'pending',
      new_status: 'approved',
    })
  })

  it('persists the normalized event when explicitly enabled', async () => {
    process.env.OPERATIONAL_TELEMETRY_ENABLED = 'true'

    const result = await emitOperationalEvent({
      eventName: 'document_rejected',
      actorProfileId: 'profile-1',
      actorRole: 'ejecutiva',
      entityType: 'document',
      entityId: 'doc-2',
      source: 'company.document_status',
      metadata: {
        document_type: 'subcontractor',
        previous_status: 'pending',
        new_status: 'rejected',
      },
    })

    expect(result).toEqual({ emitted: true })
    expect(fromMock).toHaveBeenCalledWith('operational_events')
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        event_name: 'document_rejected',
        actor_profile_id: 'profile-1',
        entity_id: 'doc-2',
        schema_version: 1,
      })
    )
  })

  it('fails open when persistence fails', async () => {
    process.env.OPERATIONAL_TELEMETRY_ENABLED = 'true'
    insertMock.mockResolvedValue({ error: { code: '42P01' } })

    const result = await emitOperationalEvent({
      eventName: 'document_approved',
      entityType: 'document',
      entityId: 'doc-3',
      source: 'company.document_status',
    })

    expect(result).toEqual({ emitted: false, reason: 'persistence_failed' })
  })
})
