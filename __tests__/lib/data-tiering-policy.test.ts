import { readFileSync } from 'node:fs'

describe('non-destructive data tiering migration', () => {
  const source = readFileSync('scripts/20260922_non_destructive_data_tiering.sql', 'utf8').toLowerCase()

  it('creates hot/history/archive query layers', () => {
    expect(source).toContain('prt_vehicle_current')
    expect(source).toContain('prt_vehicle_history_catalog')
    expect(source).toContain('data_archive_manifests')
    expect(source).toContain('system_job_runs_recent')
  })

  it('does not delete or truncate canonical data', () => {
    expect(source).not.toMatch(/\bdelete\s+from\b/)
    expect(source).not.toMatch(/\btruncate\b/)
    expect(source).not.toMatch(/\bdrop\s+table\b/)
  })
})
