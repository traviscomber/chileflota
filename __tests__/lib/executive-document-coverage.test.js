const fs = require('node:fs')
const path = require('node:path')

const approved = fs.readFileSync(path.join(process.cwd(), 'app/api/company/documents/aprobados/route.ts'), 'utf8')
const rejected = fs.readFileSync(path.join(process.cwd(), 'app/api/company/documents/rechazados/route.ts'), 'utf8')
const pending = fs.readFileSync(path.join(process.cwd(), 'app/api/dashboard/pending-documents/route.ts'), 'utf8')
const approvedPage = fs.readFileSync(path.join(process.cwd(), 'app/dashboard/company/documentos/aprobados/page.tsx'), 'utf8')
const rejectedPage = fs.readFileSync(path.join(process.cwd(), 'app/dashboard/company/documentos/rechazados/page.tsx'), 'utf8')
const executiveScope = fs.readFileSync(path.join(process.cwd(), 'lib/executive-scope.ts'), 'utf8')
const dashboardData = fs.readFileSync(path.join(process.cwd(), 'app/api/dashboard/data/route.ts'), 'utf8')
const subcontractorTabs = fs.readFileSync(path.join(process.cwd(), 'components/subcontractor-detail-tabs.tsx'), 'utf8')
const assignSimple = fs.readFileSync(path.join(process.cwd(), 'app/api/transportistas/assign-ejecutiva-simple/route.ts'), 'utf8')
const assignExecutive = fs.readFileSync(path.join(process.cwd(), 'app/api/transportistas/assign-executive/route.ts'), 'utf8')
const transportistaRoute = fs.readFileSync(path.join(process.cwd(), 'app/api/transportistas/[id]/route.ts'), 'utf8')
const autoAssign = fs.readFileSync(path.join(process.cwd(), 'app/api/admin/auto-assign-transportistas/route.ts'), 'utf8')
const reconcileScript = fs.readFileSync(path.join(process.cwd(), 'scripts/028_reconcile_transportista_executive_mirror.sql'), 'utf8')

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

  test('pending resolves driver portfolio by canonical company id with RUT fallback', () => {
    expect(pending).toContain("in('transportista_id', assignedCompanyIds)")
    expect(pending).toContain('companyByDirectId')
    expect(pending).toMatch(/companyByDirectId\.get\([^)]*transportista_id[^)]*\) \|\| companyByRut\.get/)
  })

  test('approved and rejected pages preserve scope query and expose coverage selector', () => {
    for (const source of [approvedPage, rejectedPage]) {
      expect(source).toContain('searchParams.toString()')
      expect(source).toContain('ExecutiveCoverageControl')
      expect(source).toContain('reviewScope={allData?.reviewScope}')
    }
  })

  test('stats scope uses canonical conductor company id with RUT fallback', () => {
    expect(executiveScope).toContain("in('transportista_id', companyIds)")
    expect(executiveScope).toContain("in('rut_proveedor', companyRuts)")
    expect(executiveScope).toContain('new Set([')
  })
  test('dashboard never revives legacy executive ownership from subcontratistas', () => {
    expect(dashboardData).not.toContain('sub?.ejecutiva')
    expect(dashboardData).not.toContain('subcontractor?.ejecutiva')
    expect(dashboardData).toContain('assigned_executive_id')
  })

  test('subcontractor document failures are visible instead of silently rendering an empty folder', () => {
    expect(subcontractorTabs).toContain('documentLoadError')
    expect(subcontractorTabs).toContain('No fue posible cargar la carpeta documental')
    expect(subcontractorTabs).toContain('role="alert"')
  })
  test('assignment writes keep legacy mirrors aligned with canonical ownership', () => {
    for (const source of [assignSimple, assignExecutive, transportistaRoute, autoAssign]) {
      expect(source).toContain('assigned_executive_id')
      expect(source).toContain('ejecutivo_nombre')
      expect(source).toContain('ejecutivo_asignado')
    }
  })

  test('reconciliation script never derives ownership from legacy fields', () => {
    expect(reconcileScript).toContain('assigned_executive_id = es.id')
    expect(reconcileScript).toContain('ejecutivo_asignado = null')
    expect(reconcileScript).not.toContain('set assigned_executive_id')
  })
})
