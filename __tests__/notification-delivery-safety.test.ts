import {
  buildNotificationIdempotencyKey,
  getNotificationDeliveryCapability,
} from '@/lib/notification-delivery-safety'

describe('notification delivery safety', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv }
    delete process.env.NOTIFICATION_DELIVERY_ENABLED
    delete process.env.NOTIFICATION_DELIVERY_PROVIDER
    delete process.env.NOTIFICATION_DELIVERY_LEDGER_READY
  })

  afterAll(() => {
    process.env = originalEnv
  })

  it('fails closed by default', () => {
    const capability = getNotificationDeliveryCapability()

    expect(capability.ready).toBe(false)
    expect(capability.requested).toBe(false)
    expect(capability.reasons).toContain('delivery_disabled')
    expect(capability.reasons).toContain('delivery_ledger_not_ready')
    expect(capability.reasons).toContain('delivery_provider_not_implemented')
  })

  it('stays disabled even if env flags are set until a provider adapter is implemented', () => {
    process.env.NOTIFICATION_DELIVERY_ENABLED = 'true'
    process.env.NOTIFICATION_DELIVERY_LEDGER_READY = 'true'
    process.env.NOTIFICATION_DELIVERY_PROVIDER = 'resend'

    const capability = getNotificationDeliveryCapability()

    expect(capability.requested).toBe(true)
    expect(capability.ledgerReady).toBe(true)
    expect(capability.provider).toBe('resend')
    expect(capability.providerImplemented).toBe(false)
    expect(capability.ready).toBe(false)
  })

  it('builds a stable idempotency key regardless of variable ordering and contact formatting', () => {
    const first = buildNotificationIdempotencyKey({
      userId: 'user-1',
      type: 'email',
      templateId: 'licencia_vencida',
      variables: { b: '2', a: '1' },
      contact: { email: ' USER@EXAMPLE.COM ', phone: '+56 9 1234 5678' },
    })

    const second = buildNotificationIdempotencyKey({
      userId: 'user-1',
      type: 'email',
      templateId: 'licencia_vencida',
      variables: { a: '1', b: '2' },
      contact: { email: 'user@example.com', phone: '+56912345678' },
    })

    expect(first).toBe(second)
    expect(first).toMatch(/^[a-f0-9]{64}$/)
  })

  it('changes the idempotency key when the delivery intent changes', () => {
    const base = {
      userId: 'user-1',
      type: 'email' as const,
      variables: { documento: 'F30' },
      contact: { email: 'user@example.com' },
    }

    const first = buildNotificationIdempotencyKey({
      ...base,
      templateId: 'licencia_vencida',
    })
    const second = buildNotificationIdempotencyKey({
      ...base,
      templateId: 'alerta_7_dias',
    })

    expect(first).not.toBe(second)
  })
})
