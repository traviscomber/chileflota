import { readFileSync } from 'node:fs'

describe('Cronos reconciliation recovery', () => {
  it('recovers stale system job runs before reconciliation', () => {
    const source = readFileSync('app/api/cron/cronos-reconcile/route.ts', 'utf8')
    expect(source).toContain('recoverStaleSystemJobRuns')
    expect(source).toContain('recoverStaleEmptyOcrBatches')
    expect(source).toContain("recoveredSystemJobRuns")
    expect(source).toContain("recoveredEmptyOcrBatches")
  })

  it('only auto-recovers empty stale OCR batches', () => {
    const source = readFileSync('app/api/cron/cronos-reconcile/route.ts', 'utf8')
    expect(source).toContain(".eq('status', 'processing')")
    expect(source).toContain(".eq('total_documents', 0)")
    expect(source).toContain(".lt('updated_at', cutoff)")
  })

  it('only recovers stale running system job rows', () => {
    const source = readFileSync('lib/system-job-runs.ts', 'utf8')
    expect(source).toContain(".eq('status', 'running')")
    expect(source).toContain(".lt('started_at', cutoff)")
    expect(source).toContain("recovery_reason: 'stale_running_timeout'")
  })
})
