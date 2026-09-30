describe('Cronos wrapper configuration', () => {
  it('uses stable job names for critical workers', () => {
    const jobNames = [
      'document_ocr',
      'vehicle_fleet_recovery',
      'document_text_extract',
      'compliance_events',
      'prt_inspect',
      'prt_profile',
      'prt_import',
      'prt_import_stream',
      'prt_discovery',
      'compliance_intelligence',
      'expiration_alerts',
      'review_backlog_sentinel',
      'sii_transportistas',
    ]

    expect(new Set(jobNames).size).toBe(jobNames.length)
    expect(jobNames).toContain('sii_transportistas')
    expect(jobNames).toContain('expiration_alerts')
    expect(jobNames).toContain('review_backlog_sentinel')
  })
})
