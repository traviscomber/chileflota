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

  test('pending tray follows only submission status and no legacy canonicalizers', () => {
    const source = read('app/api/dashboard/pending-documents/route.ts')
    expect(source).toContain('const subDocs = rawSubDocs')
    expect(source).toContain('every subcontractor upload whose own status is pending requires review')
    expect(source).not.toContain('selectCanonicalPendingF301')
    expect(source).not.toContain('selectCanonicalPendingMutualRates')
    expect(source).not.toContain('approvedCoveragePromise')
    expect(source).toContain("reviewSemantics: 'submission_status'")
  })

  test('approved subcontractor tray follows approved status without hidden classification filters', () => {
    const source = read('app/api/company/documents/aprobados/route.ts')
    expect(source).toContain("if (table === 'uploaded_documents') query = query.eq('is_current', true)")
    expect(source).toContain("const canonicalSubDocs = subDocs")
    expect(source).not.toContain('isClearlyMisclassifiedSubcontractorDocument')
    expect(source).toContain("reviewed_submissions")
  })

  test('rejected subcontractor tray follows rejected status without hidden classification filters', () => {
    const source = read('app/api/company/documents/rechazados/route.ts')
    const rejectedHelper = source.slice(
      source.indexOf('async function fetchAllRejectedSubcontractorDocuments'),
      source.indexOf('async function fetchAllApprovedConductorDocuments'),
    )
    expect(rejectedHelper).not.toContain(".eq('is_current', true)")
    expect(source).toContain("const canonicalSubDocs = subDocs")
    expect(source).not.toContain('isClearlyMisclassifiedSubcontractorDocument')
    expect(source).toContain("reviewed_submissions")
  })

  test('document manager no longer presents versioning as the operator workflow', () => {
    const source = read('components/document-manager-hub.tsx')
    expect(source).not.toContain('Versiones anteriores')
    expect(source).not.toContain('Una versión activa por requisito')
    expect(source).toContain('Estados de revisión de la cartera documental')
    expect(source).toContain('En subcontratistas, cada carga conserva su propio estado de revisión')
    expect(source).toContain('La vigencia operacional se calcula por separado en Compliance')
  })

  test('subcontractor counters no longer depend on is_current', () => {
    const page = read('app/dashboard/company/documentos/page.tsx')
    const stats = read('app/api/company/documents/stats/route.ts')

    expect(page).not.toContain('countActionableSubcontractorPending')
    expect(page).toContain("countByStatus('subcontractor_documents', 'status', 'approved', false)")
    expect(page).toContain("countByStatus('subcontractor_documents', 'status', 'pending', false)")
    expect(stats).toContain("kind === 'conductor'")
  })
})
