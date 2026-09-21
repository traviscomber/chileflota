const fs = require('node:fs')
const path = require('node:path')

const approved = fs.readFileSync(path.join(process.cwd(), 'app/api/company/documents/aprobados/route.ts'), 'utf8')
const rejected = fs.readFileSync(path.join(process.cwd(), 'app/api/company/documents/rechazados/route.ts'), 'utf8')
const approvedPage = fs.readFileSync(path.join(process.cwd(), 'app/dashboard/company/documentos/aprobados/page.tsx'), 'utf8')
const rejectedPage = fs.readFileSync(path.join(process.cwd(), 'app/dashboard/company/documentos/rechazados/page.tsx'), 'utf8')

describe('executive document coverage', () => {
  for (const [name, source] of [['approved', approved], ['rejected', rejected]]) {
    test(`${name} supports mine, all and selected executive scope`, () => {
      expect(source).toContain('getExecutiveScope(request)')
      expect(source).toContain("requestedExecutiveScope.mode === 'executive'")
      expect(source).toContain("requestedExecutiveScope.mode === 'all'")
      expect(source).toContain('reviewScope:')
      expect(source).toContain('availableExecutives:')
    })

    test(`${name} uses direct conductor company relation before RUT fallback`, () => {
      expect(source).toContain('transportista_id')
      expect(source).toContain('companyByDirectId')
      expect(source).toMatch(/companyByDirectId\.get\([^)]*transportista_id[^)]*\) \|\| companyByRut\.get/)
    })
  }

  test('approved and rejected pages preserve scope query and expose coverage selector', () => {
    for (const source of [approvedPage, rejectedPage]) {
      expect(source).toContain('searchParams.toString()')
      expect(source).toContain('ExecutiveCoverageControl')
      expect(source).toContain('reviewScope={allData?.reviewScope}')
    }
  })
})
