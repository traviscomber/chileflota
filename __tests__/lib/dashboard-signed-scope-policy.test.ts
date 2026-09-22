import { readFileSync } from 'node:fs'

describe('dashboard signed executive scope', () => {
  const source = readFileSync('app/api/dashboard/data/route.ts', 'utf8')

  it('uses the signed auth boundary instead of editable role cookies', () => {
    expect(source).toContain('verifyAuth(request)')
    expect(source).not.toContain("request.cookies.get('user_email')")
    expect(source).not.toContain("request.cookies.get('user_role')")
  })

  it('resolves executive aliases using the canonical resolver', () => {
    expect(source).toContain('resolveExecutiveAssignment')
    expect(source).toContain('user.full_name')
  })
})
