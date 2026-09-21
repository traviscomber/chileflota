import { isMultiInstanceDocumentCode } from '@/lib/subcontractor-document-versioning'

describe('subcontractor document versioning', () => {
  it('treats mutual certificate family as multi-instance evidence', () => {
    expect(isMultiInstanceDocumentCode('CERT_TASAS_MUTUAL')).toBe(true)
  })

  it('keeps true singleton requirements as singleton', () => {
    expect(isMultiInstanceDocumentCode('F29')).toBe(false)
    expect(isMultiInstanceDocumentCode('F30')).toBe(false)
    expect(isMultiInstanceDocumentCode('CERT_AFIL_MUTUAL')).toBe(false)
    expect(isMultiInstanceDocumentCode('F30-1_DOÑA_ISIDORA')).toBe(false)
  })
})
