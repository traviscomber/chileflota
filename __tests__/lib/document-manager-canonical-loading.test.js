const fs = require('node:fs')
const path = require('node:path')

const page = fs.readFileSync(
  path.join(process.cwd(), 'app/dashboard/company/documentos/page.tsx'),
  'utf8',
)
const hub = fs.readFileSync(
  path.join(process.cwd(), 'components/document-manager-hub.tsx'),
  'utf8',
)

describe('document manager canonical loading', () => {
  test('server render does not calculate global review counts', () => {
    expect(page).not.toContain('countActionableSubcontractorPending')
    expect(page).not.toContain("from('subcontractor_documents')")
    expect(page).toContain('EMPTY_STATS')
  })

  test('client hides review metrics until authenticated canonical APIs resolve', () => {
    expect(hub).toContain('isCanonicalReady')
    expect(hub).toContain('Sincronizando tu cartera con la fuente canónica de documentos')
    expect(hub).toContain("value={isCanonicalReady ? totalPendientes : null}")
  })
})
