import { getExecutiveScope } from '@/lib/executive-coverage-scope'

describe('executive coverage scope', () => {
  it('defaults to the reviewer own portfolio', () => {
    const request = new Request('https://chileflota.app/api/dashboard/pending-documents')
    expect(getExecutiveScope(request)).toEqual({ mode: 'mine', executiveId: null })
  })

  it('supports all active executive portfolios', () => {
    const request = new Request('https://chileflota.app/api/dashboard/pending-documents?scope=all')
    expect(getExecutiveScope(request)).toEqual({ mode: 'all', executiveId: null })
  })

  it('supports a specific executive portfolio', () => {
    const request = new Request('https://chileflota.app/api/dashboard/pending-documents?scope=executive&executive_id=exec-123')
    expect(getExecutiveScope(request)).toEqual({ mode: 'executive', executiveId: 'exec-123' })
  })

  it('fails closed to own portfolio when executive id is missing', () => {
    const request = new Request('https://chileflota.app/api/dashboard/pending-documents?scope=executive')
    expect(getExecutiveScope(request)).toEqual({ mode: 'mine', executiveId: null })
  })
})
