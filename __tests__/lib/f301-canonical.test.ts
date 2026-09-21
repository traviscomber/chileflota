import {
  getF301InstanceKey,
  selectCanonicalF301,
  selectCanonicalF301ByStatus,
  selectCanonicalPendingF301,
} from '@/lib/f301-canonical'

const base = {
  subcontractor_id: 'bryan-company',
  document_period_year: 2026,
  document_period_month: 9,
  ai_document_type: 'Certificado de Cumplimiento de Obligaciones Laborales y Previsionales',
}

describe('F30-1 client canonicalization', () => {
  test('keeps distinct clients in the same company and period even when legacy is_current is false', () => {
    const docs = [
      {
        ...base,
        id: 'rendic',
        file_name: 'Certificado_F30-1 RENDIC HERMANOS S A.pdf',
        status: 'approved',
        is_current: true,
        uploaded_at: '2026-09-11T13:21:22Z',
      },
      {
        ...base,
        id: 'logistica',
        file_name: 'Certificado_F30-1 LOGISTICA TRANSPORTE Y SERVICIOS.pdf',
        status: 'approved',
        is_current: false,
        uploaded_at: '2026-09-11T13:21:14Z',
      },
    ]

    const result = selectCanonicalF301ByStatus(docs, 'approved')
    expect(result.documents.map((doc) => doc.id).sort()).toEqual(['logistica', 'rendic'])
  })

  test('selects the newest revision only within the same client instance', () => {
    const docs = [
      {
        ...base,
        id: 'logistica-old',
        file_name: 'Certificado_F30-1 LOGISTICA TRANSPORTE Y SERVICIOS.pdf',
        status: 'approved',
        is_current: true,
        version_number: 1,
        uploaded_at: '2026-09-11T13:20:00Z',
      },
      {
        ...base,
        id: 'logistica-new',
        file_name: 'Certificado_F30-1 LOGISTICA TRANSPORTE Y SERVICIOS.pdf',
        status: 'approved',
        is_current: false,
        version_number: 3,
        uploaded_at: '2026-09-11T13:30:00Z',
      },
    ]

    const result = selectCanonicalF301(docs)
    expect(result.current.map((doc) => doc.id)).toEqual(['logistica-new'])
    expect(result.historical.map((doc) => doc.id)).toEqual(['logistica-old'])
  })

  test('uses the latest document status for each client instance', () => {
    const docs = [
      {
        ...base,
        id: 'old-approved',
        file_name: 'Certificado_F30-1 RENDIC HERMANOS S A.pdf',
        status: 'approved',
        is_current: true,
        uploaded_at: '2026-09-11T13:20:00Z',
      },
      {
        ...base,
        id: 'new-rejected',
        file_name: 'Certificado_F30-1 RENDIC HERMANOS S A.pdf',
        status: 'rejected',
        is_current: false,
        uploaded_at: '2026-09-11T13:30:00Z',
      },
    ]

    expect(selectCanonicalF301ByStatus(docs, 'approved').documents).toHaveLength(0)
    expect(selectCanonicalF301ByStatus(docs, 'rejected').documents.map((doc) => doc.id)).toEqual(['new-rejected'])
  })

  test('pending selector shares the same client identity semantics', () => {
    const docs = [
      {
        ...base,
        id: 'pending-logistica',
        file_name: 'Certificado_F30-1 LOGISTICA TRANSPORTE Y SERVICIOS.pdf',
        status: 'pending',
        is_current: false,
        uploaded_at: '2026-09-11T13:30:00Z',
      },
      {
        ...base,
        id: 'approved-rendic',
        file_name: 'Certificado_F30-1 RENDIC HERMANOS S A.pdf',
        status: 'approved',
        is_current: true,
        uploaded_at: '2026-09-11T13:31:00Z',
      },
    ]

    expect(selectCanonicalPendingF301(docs).pending.map((doc) => doc.id)).toEqual(['pending-logistica'])
  })

  test('prefers principal RUT from OCR over filename wording', () => {
    const first = {
      ...base,
      id: 'first',
      file_name: 'cliente uno.pdf',
      ai_extracted_text: '1.2 - Empresa Principal\nRUT 76.123.456-7\n1.3 - Empresa Contratista',
    }
    const second = {
      ...base,
      id: 'second',
      file_name: 'nombre totalmente distinto.pdf',
      ai_extracted_text: '1.2 - Empresa Principal\nRUT 76.123.456-7\n1.3 - Empresa Contratista',
    }

    expect(getF301InstanceKey(first)).toBe(getF301InstanceKey(second))
  })
})
