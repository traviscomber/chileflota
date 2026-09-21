const fs = require('node:fs')
const path = require('node:path')

function read(relativePath) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8')
}

describe('simple subcontractor review submissions', () => {
  test('new subcontractor uploads do not create version chains', () => {
    const source = read('app/api/subcontractors/[id]/documents/route.ts')
    expect(source).not.toContain('isMultiInstanceDocumentCode')
    expect(source).not.toContain("supersedes_document_id: supersedesDocumentId")
    expect(source).toContain('Every upload is an independent review submission')
  })

  test('pending tray follows the submission status instead of legacy current flags', () => {
    const source = read('app/api/dashboard/pending-documents/route.ts')
    expect(source).toContain('const subDocs = rawSubDocs')
    expect(source).toContain('every subcontractor upload whose own status is pending requires review')
  })

  test('approved subcontractor tray does not require is_current', () => {
    const source = read('app/api/company/documents/aprobados/route.ts')
    expect(source).toContain("if (table === 'uploaded_documents') query = query.eq('is_current', true)")
    expect(source).toContain("subcontractor_documents")
    expect(source).toContain("reviewed_submissions")
  })

  test('rejected subcontractor tray does not require is_current', () => {
    const source = read('app/api/company/documents/rechazados/route.ts')
    const rejectedHelper = source.slice(
      source.indexOf('async function fetchAllRejectedSubcontractorDocuments'),
      source.indexOf('async function fetchAllApprovedConductorDocuments'),
    )
    expect(rejectedHelper).not.toContain(".eq('is_current', true)")
    expect(source).toContain("reviewed_submissions")
  })

  test('document manager no longer presents versioning as the operator workflow', () => {
    const source = read('components/document-manager-hub.tsx')
    expect(source).not.toContain('Versiones anteriores')
    expect(source).not.toContain('Una versión activa por requisito')
    expect(source).toContain('Cada carga se revisa como evidencia independiente')
    expect(source).toContain('La vigencia operacional se calcula por separado en Compliance')
  })
})
