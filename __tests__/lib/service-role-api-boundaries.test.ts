import { readFileSync } from 'node:fs'

describe('service-role transportista API boundaries', () => {
  it('requires verifyAuth on transportista collection and detail APIs', () => {
    for (const path of [
      'app/api/transportistas/route.ts',
      'app/api/transportistas/[id]/route.ts',
      'app/api/admin/labbe-executives/route.ts',
    ]) {
      const source = readFileSync(path, 'utf8')
      expect(source).toContain('verifyAuth')
    }
  })

  it('does not expose select-all executive records', () => {
    const source = readFileSync('app/api/admin/labbe-executives/route.ts', 'utf8')
    expect(source).not.toContain("select('*')")
  })
})
