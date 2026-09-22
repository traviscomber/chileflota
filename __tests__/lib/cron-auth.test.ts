import { isAuthorizedCronRequest } from '@/lib/cron-auth'

function headers(authorization?: string) {
  return {
    get(name: string) {
      return name.toLowerCase() === 'authorization' ? authorization ?? null : null
    },
  }
}

describe('cron authorization policy', () => {
  it('fails closed when CRON_SECRET is missing', () => {
    expect(isAuthorizedCronRequest(headers('Bearer anything'), undefined)).toBe(false)
  })

  it('rejects a missing or incorrect bearer token', () => {
    expect(isAuthorizedCronRequest(headers(), 'secret')).toBe(false)
    expect(isAuthorizedCronRequest(headers('Bearer wrong'), 'secret')).toBe(false)
  })

  it('accepts only the configured bearer token', () => {
    expect(isAuthorizedCronRequest(headers('Bearer secret'), 'secret')).toBe(true)
  })
})

// Exact preview redeploy marker: CRON_SECRET is required in all environments.
