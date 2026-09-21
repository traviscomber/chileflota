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

  test('subcontractor counters do not render global data before authenticated portfolio resolution', () => {
    const page = read('app/dashboard/company/documentos/page.tsx')
    const stats = read('app/api/company/documents/stats/route.ts')
    const hub = read('components/document-manager-hub.tsx')

    expect(page).toContain('EMPTY_STATS')
    expect(page).not.toContain("from('subcontractor_documents')")
    expect(stats).toContain("kind === 'conductor'")
    expect(hub).toContain('isPortfolioReady')
    expect(hub).toContain('Los estados se muestran sólo después de resolver la cartera autenticada.')
    expect(hub).toContain('value={isPortfolioReady ? totalPendientes : null}')
  })

  test('subcontractor document endpoint authorizes owner or internal role before service-role access', () => {
    const source = read('app/api/subcontractors/[id]/documents/route.ts')
    expect(source).toContain('authorizeSubcontractorAccess')
    expect(source).toContain("request.cookies.get('transportista_token')")
    expect(source).toContain("decoded.transportista_id === subcontractorId")
    expect(source).toContain("await verifyAuth(request)")
    expect(source).toContain("mode: 'read' | 'write'")
    expect(source).toContain("canonicalSubcontractor.rut")
  })

  test('subcontractor upload validates file and active document type server-side', () => {
    const source = read('app/api/subcontractors/[id]/documents/route.ts')
    expect(source).toContain("50 * 1024 * 1024")
    expect(source).toContain("'application/pdf'")
    expect(source).toContain("'image/jpeg'")
    expect(source).toContain("'image/png'")
    expect(source).toContain(".eq('is_active', true)")
  })


  test('subcontractor detail shows every submission and separates requirement coverage', () => {
    const route = read('app/api/subcontractors/[id]/documents/route.ts')
    const detail = read('components/subcontractor-detail-tabs.tsx')

    expect(route).toContain('requirementsCovered: coveredRequirementIds.size')
    expect(route).toContain('requirementsMissing: Math.max')
    expect(route).toContain('approvedRequirements: approvedRequirementIds.size')
    expect(detail).toContain("const docType = requirement || doc.document_type")
    expect(detail).not.toContain('if (!req) return null')
    expect(detail).toContain('summary.requirementsMissing')
    expect(detail).toContain('summary.requirementsCovered / summary.totalRequirements')
    expect(detail).not.toContain('summary.approvedDocuments / summary.totalRequirements')
  })


  test('conductor counters exclude rows that are not valid document records', () => {
    const stats = read('app/api/company/documents/stats/route.ts')
    expect(stats).toContain("query.not('document_type_id', 'is', null).not('original_filename', 'is', null)")
    expect(stats).toContain(".not('document_type_id', 'is', null)")
    expect(stats).toContain(".not('original_filename', 'is', null)")
  })

  test('document manager exposes a single reconciled accounting identity', () => {
    const hub = read('components/document-manager-hub.tsx')
    expect(hub).toContain('const totalRevisados = totalAprobados + totalRechazados')
    expect(hub).toContain('revisados y ${totalPendientes.toLocaleString')
    expect(hub).toContain('label="Revisados"')
    expect(hub).toContain('Aprobados + rechazados')
    expect(hub).not.toContain('Procesados cartera')
    expect(hub).not.toContain('totalChileFlota')
  })

})
