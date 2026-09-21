const fs = require('node:fs')
const path = require('node:path')

function read(relativePath) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8')
}

describe('F30-1 review route policy', () => {
  test('approved tray reconstructs F30-1 from full client history', () => {
    const source = read('app/api/company/documents/aprobados/route.ts')
    expect(source).toContain("fetchAllF301SubcontractorDocuments")
    expect(source).toContain(".eq('document_type.code', 'F30-1_CLIENTE')")
    expect(source).toContain("selectCanonicalF301ByStatus(f301History, 'approved')")
  })

  test('rejected tray reconstructs F30-1 from full client history', () => {
    const source = read('app/api/company/documents/rechazados/route.ts')
    expect(source).toContain("fetchAllF301SubcontractorDocuments")
    expect(source).toContain(".eq('document_type.code', 'F30-1_CLIENTE')")
    expect(source).toContain("selectCanonicalF301ByStatus(f301History, 'rejected')")
  })

  test('future F30-1 client uploads remain multi-instance and are not auto-superseded', () => {
    const versioning = read('lib/subcontractor-document-versioning.ts')
    const upload = read('app/api/subcontractors/[id]/documents/route.ts')

    expect(versioning).toContain("'F30-1_CLIENTE'")
    expect(upload).toContain("!isMultiInstanceDocumentCode(docType.code)")
  })
})
