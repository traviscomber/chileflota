import {
  collapseConfirmedStorageDuplicates,
  getPendingStorageDedupCandidateFolders,
} from '@/lib/pending-storage-dedup'

const base = {
  subcontractor_id: 'company-1',
  document_type_id: 'type-1',
  document_period_year: 2026,
  document_period_month: 8,
  file_name: 'F30-1 DI.pdf',
}

describe('pending storage dedup', () => {
  test('suppresses only byte-identical uploads within the same requirement slot', () => {
    const rows = [
      {
        ...base,
        id: 'new',
        file_url: 'https://example.test/subcontractor-documents/company-1/new.pdf',
        created_at: '2026-09-04T18:14:00Z',
      },
      {
        ...base,
        id: 'old',
        file_url: 'https://example.test/subcontractor-documents/company-1/old.pdf',
        created_at: '2026-09-04T18:10:00Z',
      },
    ]

    const metadata = new Map([
      ['company-1/new.pdf', { eTag: '"same"', size: 100 }],
      ['company-1/old.pdf', { eTag: '"same"', size: 100 }],
    ])

    const result = collapseConfirmedStorageDuplicates(rows, metadata)
    expect(result.rows.map((row) => row.id)).toEqual(['new'])
    expect(result.suppressedCount).toBe(1)
    expect(result.duplicateGroups).toBe(1)
  })

  test('fails open when storage identity is missing or different', () => {
    const rows = [
      {
        ...base,
        id: 'a',
        file_url: 'https://example.test/subcontractor-documents/company-1/a.pdf',
        created_at: '2026-09-04T18:14:00Z',
      },
      {
        ...base,
        id: 'b',
        file_url: 'https://example.test/subcontractor-documents/company-1/b.pdf',
        created_at: '2026-09-04T18:10:00Z',
      },
    ]

    const metadata = new Map([
      ['company-1/a.pdf', { eTag: '"one"', size: 100 }],
      ['company-1/b.pdf', { eTag: '"two"', size: 100 }],
    ])

    expect(collapseConfirmedStorageDuplicates(rows, metadata).rows).toHaveLength(2)
    expect(collapseConfirmedStorageDuplicates(rows, new Map()).rows).toHaveLength(2)
  })

  test('does not collapse identical bytes across different periods', () => {
    const rows = [
      {
        ...base,
        id: 'aug',
        file_url: 'https://example.test/subcontractor-documents/company-1/aug.pdf',
      },
      {
        ...base,
        id: 'sep',
        document_period_month: 9,
        file_url: 'https://example.test/subcontractor-documents/company-1/sep.pdf',
      },
    ]
    const metadata = new Map([
      ['company-1/aug.pdf', { eTag: '"same"', size: 100 }],
      ['company-1/sep.pdf', { eTag: '"same"', size: 100 }],
    ])

    expect(collapseConfirmedStorageDuplicates(rows, metadata).rows).toHaveLength(2)
  })

  test('only requests storage folders that contain duplicate candidates', () => {
    const rows = [
      {
        ...base,
        id: 'a',
        file_url: 'https://example.test/subcontractor-documents/company-1/a.pdf',
      },
      {
        ...base,
        id: 'b',
        file_url: 'https://example.test/subcontractor-documents/company-1/b.pdf',
      },
      {
        ...base,
        id: 'single',
        subcontractor_id: 'company-2',
        file_url: 'https://example.test/subcontractor-documents/company-2/single.pdf',
      },
    ]

    expect(getPendingStorageDedupCandidateFolders(rows)).toEqual(['company-1'])
  })
})
