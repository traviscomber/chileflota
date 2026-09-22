import { readFileSync } from 'node:fs'

describe('Cronos Health Sentinel', () => {
  it('runs every five minutes', () => {
    const vercel = JSON.parse(readFileSync('vercel.json','utf8'))
    expect(vercel.crons).toContainEqual({
      path: '/api/cron/cronos-health-sentinel',
      schedule: '*/5 * * * *',
    })
  })

  it('fails closed when CRON_SECRET is absent', () => {
    const source = readFileSync('app/api/cron/cronos-health-sentinel/route.ts','utf8')
    expect(source).toContain('if (!secret) return false')
    expect(source).toContain("database.connection_pressure.critical")
    expect(source).toContain("background_processing_paused")
  })

  it('protects heavy workers with the circuit breaker', () => {
    const paths = [
      'app/api/cron/cronos-document-text-extract/route.ts',
      'app/api/cron/cronos-document-ocr/route.ts',
      'app/api/cron/cronos-compliance-intelligence/route.ts',
      'app/api/cron/cronos-prt-import/route.ts',
      'app/api/cron/cronos-prt-import-stream/route.ts',
      'app/api/cron/pdf-ocr-backfill/route.ts',
      'app/api/cron/f30-backfill/route.ts',
    ]
    for (const path of paths) {
      const source = readFileSync(path,'utf8')
      expect(source).toContain('shouldRunBackgroundWork')
      expect(source).toContain('health_circuit_breaker')
    }
  })
})
