import { readFileSync } from 'node:fs'

describe('Executive UI protection during infrastructure optimization', () => {
  it('keeps the health circuit breaker out of interactive executive routes', () => {
    const interactiveRoutes = [
      'app/api/dashboard/pending-documents/route.ts',
      'app/api/company/documents/aprobados/route.ts',
      'app/api/company/documents/rechazados/route.ts',
      'app/api/company/documents/stats/route.ts',
      'app/api/company/search-suggestions/route.ts',
      'app/api/dashboard/data/route.ts',
    ]

    for (const path of interactiveRoutes) {
      const source = readFileSync(path, 'utf8')
      expect(source).not.toContain('shouldRunBackgroundWork')
      expect(source).not.toContain('health_circuit_breaker')
    }
  })

  it('does not write system-health events into executive business alerts', () => {
    const source = readFileSync('app/api/cron/cronos-health-sentinel/route.ts', 'utf8')
    expect(source).not.toContain(".from('alerts_log').insert")
    expect(source).toContain('system_health_incidents')
  })
})
