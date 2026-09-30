import fs from 'node:fs'
import path from 'node:path'
import {
  analyzeCanonicalRequirementProfile,
  type CatalogRequirementRow,
} from '@/lib/canonical-requirement-profile'

const cleanConductorCatalog: CatalogRequirementRow[] = [
  { code: 'CEDULA-IDENTIDAD', mandatory: true, active: true, cadence: 3650 },
  { code: 'CERTIFICADO-ANTECEDENTES', mandatory: true, active: true, cadence: 90 },
  { code: 'CERTIFICADO-AFP', mandatory: true, active: true, cadence: 30 },
  { code: 'CERTIFICADO-SALUD', mandatory: true, active: true, cadence: 365 },
  { code: 'CONTRATO-TRABAJO', mandatory: true, active: true, cadence: null },
  { code: 'EXAMEN-PREOCUPACIONAL', mandatory: true, active: true, cadence: 365 },
  { code: 'HOJA-VIDA-CONDUCTOR', mandatory: true, active: true, cadence: 180 },
  { code: 'INHABILIDADES-MENORES', mandatory: true, active: true, cadence: 90 },
  { code: 'LICENCIA-CONDUCIR', mandatory: true, active: true, cadence: 730 },
  { code: 'CERT_CAPACITACION', mandatory: false, active: true, cadence: 365 },
]

const transportistaCatalog: CatalogRequirementRow[] = [
  'CERT_AFIL_MUTUAL',
  'CERT_ANTECEDENTES',
  'CERT_COTIZACIONES',
  'CERT_TASAS_MUTUAL',
  'COMPROBANTE_PAGO',
  'F29',
  'F30',
  'F30-1_CLIENTE',
  'F30-1_DOÑA_ISIDORA',
  'FOTO_PATENTES',
  'HOJA_VIDA',
  'LIQUIDACION_SUELDO',
  'PENSION',
  'PLANILLAS_IMPOSICIONES',
].map((code) => ({ code, mandatory: true, active: true, cadence: 'Anual' }))

describe('canonical requirement profile', () => {
  it('collapses known conductor aliases into one canonical requirement', () => {
    const analysis = analyzeCanonicalRequirementProfile('conductor', [
      ...cleanConductorCatalog,
      { code: 'CERT_ANTECEDENTES', mandatory: true, active: true, cadence: 90 },
      { code: 'CONTRATO_TRABAJO', mandatory: true, active: true, cadence: null },
    ])

    const background = analysis.requirements.find((item) => item.id === 'conductor_background')
    const contract = analysis.requirements.find((item) => item.id === 'conductor_work_contract')

    expect(background?.presentAliases).toEqual(['CERTIFICADO-ANTECEDENTES', 'CERT_ANTECEDENTES'])
    expect(background?.cadenceConflict).toBe(false)
    expect(contract?.presentAliases).toEqual(['CONTRATO-TRABAJO', 'CONTRATO_TRABAJO'])
    expect(contract?.cadenceConflict).toBe(false)
    expect(analysis.unknownMandatoryCodes).toEqual([])
  })

  it('keeps requirement coverage usable while failing closed on conflicting expiry derivation', () => {
    const analysis = analyzeCanonicalRequirementProfile('conductor', [
      ...cleanConductorCatalog,
      { code: 'LIC_CONDUCIR', mandatory: true, active: true, cadence: 365 },
      { code: 'HOJA_VIDA', mandatory: true, active: true, cadence: null },
    ])

    expect(analysis.cadenceConflictRequirements).toEqual(
      expect.arrayContaining(['conductor_license', 'conductor_driving_record']),
    )
    expect(analysis.canCertifyRequirementSet).toBe(true)
    expect(analysis.canCertifyCoverage).toBe(true)
    expect(analysis.canDeriveAllExpiryPolicies).toBe(false)
    expect(analysis.expiryPolicyBlockers).toEqual(
      expect.arrayContaining([
        'cadence_conflict:conductor_license',
        'cadence_conflict:conductor_driving_record',
      ]),
    )
  })

  it('can certify a clean conductor catalog without inventing optional requirements', () => {
    const analysis = analyzeCanonicalRequirementProfile('conductor', cleanConductorCatalog)

    expect(analysis.missingCanonicalRequirements).toEqual([])
    expect(analysis.unknownMandatoryCodes).toEqual([])
    expect(analysis.cadenceConflictRequirements).toEqual([])
    expect(analysis.unresolvedCoverageRequirements).toEqual([])
    expect(analysis.canCertifyRequirementSet).toBe(true)
    expect(analysis.canCertifyCoverage).toBe(true)
    expect(analysis.canDeriveAllExpiryPolicies).toBe(true)
  })

  it('keeps transportista multi-instance and conditional requirements unresolved', () => {
    const analysis = analyzeCanonicalRequirementProfile('transportista', transportistaCatalog)

    expect(analysis.missingCanonicalRequirements).toEqual([])
    expect(analysis.unknownMandatoryCodes).toEqual([])
    expect(analysis.canCertifyRequirementSet).toBe(true)
    expect(analysis.unresolvedCoverageRequirements).toEqual(
      expect.arrayContaining([
        'transportista_cert_antecedentes',
        'transportista_comprobante_pago',
        'transportista_f30_1_cliente',
        'transportista_f30_1_do_a_isidora',
        'transportista_foto_patentes',
        'transportista_hoja_vida',
        'transportista_liquidacion_sueldo',
        'transportista_pension',
        'transportista_planillas_imposiciones',
      ]),
    )
    expect(analysis.canCertifyCoverage).toBe(false)
  })

  it('treats an unknown active mandatory code as a coverage blocker', () => {
    const analysis = analyzeCanonicalRequirementProfile('conductor', [
      ...cleanConductorCatalog,
      { code: 'NEW-MANDATORY-RULE', mandatory: true, active: true, cadence: 30 },
    ])

    expect(analysis.unknownMandatoryCodes).toEqual(['NEW-MANDATORY-RULE'])
    expect(analysis.canCertifyRequirementSet).toBe(false)
    expect(analysis.canCertifyCoverage).toBe(false)
    expect(analysis.coverageBlockers).toContain('unknown_mandatory_code:NEW-MANDATORY-RULE')
  })

  it('authenticates before privileged catalog reads and contains no writes', () => {
    const routePath = path.join(
      process.cwd(),
      'app/api/company/canonical-requirement-profile/route.ts',
    )
    const source = fs.readFileSync(routePath, 'utf8')

    const verifyAuthIndex = source.indexOf('await verifyAuth(request)')
    const adminIndex = source.indexOf('const supabase = createAdminClient()')

    expect(verifyAuthIndex).toBeGreaterThanOrEqual(0)
    expect(adminIndex).toBeGreaterThan(verifyAuthIndex)
    expect(source).not.toContain('.insert(')
    expect(source).not.toContain('.update(')
    expect(source).not.toContain('.delete(')
    expect(source).not.toContain('.upsert(')
  })
})
