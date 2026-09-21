import type { NextRequest } from 'next/server'
import {
  authenticateReprocessRequest,
  authorizeReprocessDocument,
} from '@/lib/reprocess-authorization'

function requestWithAuthorization(value?: string): NextRequest {
  return {
    headers: {
      get: (name: string) => (name.toLowerCase() === 'authorization' ? value ?? null : null),
    },
  } as unknown as NextRequest
}

describe('reprocess authorization boundary', () => {
  const originalCronSecret = process.env.CRON_SECRET

  beforeEach(() => {
    process.env.CRON_SECRET = 'test-cron-secret'
  })

  afterEach(() => {
    if (originalCronSecret === undefined) delete process.env.CRON_SECRET
    else process.env.CRON_SECRET = originalCronSecret
  })

  it('accepts the F30 cron actor only with the configured bearer secret', async () => {
    const request = requestWithAuthorization('Bearer test-cron-secret')

    await expect(authenticateReprocessRequest(request, 'f30_backfill')).resolves.toEqual({
      ok: true,
      actor: { kind: 'cron' },
    })
  })

  it('rejects a forged F30 source without the configured bearer secret', async () => {
    const request = requestWithAuthorization('Bearer wrong-secret')

    await expect(authenticateReprocessRequest(request, 'f30_backfill')).resolves.toEqual({
      ok: false,
      status: 401,
      error: 'Unauthorized',
    })
  })

  it('restricts the cron actor to subcontractor documents', async () => {
    await expect(
      authorizeReprocessDocument({ kind: 'cron' }, 'doc-1', 'subcontractor_documents'),
    ).resolves.toEqual({ allowed: true })

    await expect(
      authorizeReprocessDocument({ kind: 'cron' }, 'doc-1', 'uploaded_documents'),
    ).resolves.toEqual({
      allowed: false,
      reason: 'F30 backfill cannot reprocess uploaded documents',
    })
  })
})
