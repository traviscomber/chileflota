export type RequirementEntity = 'conductor' | 'transportista'

export type CoverageRule =
  | 'singleton'
  | 'multi_instance_unlinked'
  | 'conditional_unmapped'

export interface CatalogRequirementRow {
  code: string
  mandatory: boolean
  active: boolean
  cadence?: string | number | null
}

export interface CanonicalRequirementDefinition {
  id: string
  label: string
  entity: RequirementEntity
  aliases: readonly string[]
  coverageRule: CoverageRule
}

export interface CanonicalRequirementState {
  id: string
  label: string
  aliases: readonly string[]
  presentAliases: string[]
  coverageRule: CoverageRule
  cadenceValues: string[]
  cadenceConflict: boolean
  canDeriveExpiryFromCatalog: boolean
}

export interface CanonicalRequirementProfileAnalysis {
  entity: RequirementEntity
  requirements: CanonicalRequirementState[]
  unknownMandatoryCodes: string[]
  missingCanonicalRequirements: string[]
  cadenceConflictRequirements: string[]
  unresolvedCoverageRequirements: string[]
  canCertifyRequirementSet: boolean
  canCertifyCoverage: boolean
  canDeriveAllExpiryPolicies: boolean
  coverageBlockers: string[]
  expiryPolicyBlockers: string[]
}

const CONDUCTOR_REQUIREMENTS: readonly CanonicalRequirementDefinition[] = [
  {
    id: 'conductor_identity',
    label: 'Cedula de Identidad',
    entity: 'conductor',
    aliases: ['CEDULA-IDENTIDAD'],
    coverageRule: 'singleton',
  },
  {
    id: 'conductor_background',
    label: 'Certificado de Antecedentes',
    entity: 'conductor',
    aliases: ['CERTIFICADO-ANTECEDENTES', 'CERT_ANTECEDENTES'],
    coverageRule: 'singleton',
  },
  {
    id: 'conductor_afp',
    label: 'Certificado AFP',
    entity: 'conductor',
    aliases: ['CERTIFICADO-AFP'],
    coverageRule: 'singleton',
  },
  {
    id: 'conductor_health',
    label: 'Certificado de Salud',
    entity: 'conductor',
    aliases: ['CERTIFICADO-SALUD'],
    coverageRule: 'singleton',
  },
  {
    id: 'conductor_work_contract',
    label: 'Contrato de Trabajo',
    entity: 'conductor',
    aliases: ['CONTRATO-TRABAJO', 'CONTRATO_TRABAJO'],
    coverageRule: 'singleton',
  },
  {
    id: 'conductor_preemployment_exam',
    label: 'Examen Preocupacional',
    entity: 'conductor',
    aliases: ['EXAMEN-PREOCUPACIONAL'],
    coverageRule: 'singleton',
  },
  {
    id: 'conductor_driving_record',
    label: 'Hoja de Vida del Conductor',
    entity: 'conductor',
    aliases: ['HOJA-VIDA-CONDUCTOR', 'HOJA_VIDA'],
    coverageRule: 'singleton',
  },
  {
    id: 'conductor_minor_disqualifications',
    label: 'Certificado Inhabilidades Menores',
    entity: 'conductor',
    aliases: ['INHABILIDADES-MENORES'],
    coverageRule: 'singleton',
  },
  {
    id: 'conductor_license',
    label: 'Licencia de Conducir',
    entity: 'conductor',
    aliases: ['LICENCIA-CONDUCIR', 'LIC_CONDUCIR'],
    coverageRule: 'singleton',
  },
] as const

// These six types are already treated by the current pending-document flow as
// legitimate multi-instance evidence. A company-level "one document exists"
// check cannot prove coverage for all workers/vehicles represented by them.
const TRANSPORTISTA_MULTI_INSTANCE_CODES = new Set([
  'CERT_ANTECEDENTES',
  'COMPROBANTE_PAGO',
  'FOTO_PATENTES',
  'HOJA_VIDA',
  'LIQUIDACION_SUELDO',
  'PLANILLAS_IMPOSICIONES',
])

const TRANSPORTISTA_REQUIREMENT_CODES = [
  ['CERT_AFIL_MUTUAL', 'Cert. Afil Mutual'],
  ['CERT_ANTECEDENTES', 'Cert. Antecedentes'],
  ['CERT_COTIZACIONES', 'Certificado de Cotizaciones'],
  ['CERT_TASAS_MUTUAL', 'Cert. Tasas Mutual'],
  ['COMPROBANTE_PAGO', 'Comprobante de Pago'],
  ['F29', 'Formulario F29'],
  ['F30', 'F30'],
  ['F30-1_CLIENTE', 'F30-I Emitido a Cliente'],
  ['F30-1_DOÑA_ISIDORA', 'F30-I Doña Isidora'],
  ['FOTO_PATENTES', 'Foto Estado Patentes'],
  ['HOJA_VIDA', 'Hoja de Vida'],
  ['LIQUIDACION_SUELDO', 'Liquidacion de Sueldo'],
  ['PENSION', 'Pension'],
  ['PLANILLAS_IMPOSICIONES', 'Planillas de Imposiciones'],
] as const

const TRANSPORTISTA_REQUIREMENTS: readonly CanonicalRequirementDefinition[] =
  TRANSPORTISTA_REQUIREMENT_CODES.map(([code, label]) => {
    let coverageRule: CoverageRule = 'singleton'

    if (TRANSPORTISTA_MULTI_INSTANCE_CODES.has(code)) {
      coverageRule = 'multi_instance_unlinked'
    }

    // Current production data does not expose a reliable applicability key for
    // these requirement families. They remain explicit blockers instead of being
    // silently treated as universally required or optional.
    if (code === 'PENSION' || code === 'F30-1_CLIENTE' || code === 'F30-1_DOÑA_ISIDORA') {
      coverageRule = 'conditional_unmapped'
    }

    return {
      id: `transportista_${code.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')}`,
      label,
      entity: 'transportista' as const,
      aliases: [code],
      coverageRule,
    }
  })

export const CANONICAL_REQUIREMENTS: Readonly<Record<RequirementEntity, readonly CanonicalRequirementDefinition[]>> = {
  conductor: CONDUCTOR_REQUIREMENTS,
  transportista: TRANSPORTISTA_REQUIREMENTS,
}

function normalizeCode(code: string): string {
  return code.trim().toUpperCase()
}

function normalizeCadence(value: string | number | null | undefined): string {
  if (value === null || value === undefined || String(value).trim() === '') return '<none>'
  return String(value).trim().toLowerCase()
}

export function analyzeCanonicalRequirementProfile(
  entity: RequirementEntity,
  rows: readonly CatalogRequirementRow[],
): CanonicalRequirementProfileAnalysis {
  const definitions = CANONICAL_REQUIREMENTS[entity]
  const activeMandatoryRows = rows
    .filter((row) => row.active && row.mandatory)
    .map((row) => ({ ...row, code: normalizeCode(row.code) }))

  const aliasToDefinition = new Map<string, CanonicalRequirementDefinition>()
  for (const definition of definitions) {
    for (const alias of definition.aliases) {
      aliasToDefinition.set(normalizeCode(alias), definition)
    }
  }

  const unknownMandatoryCodes = [...new Set(
    activeMandatoryRows
      .map((row) => row.code)
      .filter((code) => !aliasToDefinition.has(code)),
  )].sort()

  const requirements = definitions.map((definition): CanonicalRequirementState => {
    const aliases = new Set(definition.aliases.map(normalizeCode))
    const matched = activeMandatoryRows.filter((row) => aliases.has(row.code))
    const cadenceValues = [...new Set(matched.map((row) => normalizeCadence(row.cadence)))].sort()
    const cadenceConflict = matched.length > 1 && cadenceValues.length > 1

    return {
      id: definition.id,
      label: definition.label,
      aliases: definition.aliases,
      presentAliases: [...new Set(matched.map((row) => row.code))].sort(),
      coverageRule: definition.coverageRule,
      cadenceValues,
      cadenceConflict,
      // A conflicting catalog cadence does not make the requirement identity
      // ambiguous. It only forbids deriving expiry from catalog metadata. A
      // document-provided canonical expiry can still be evaluated downstream.
      canDeriveExpiryFromCatalog: !cadenceConflict,
    }
  })

  const missingCanonicalRequirements = requirements
    .filter((requirement) => requirement.presentAliases.length === 0)
    .map((requirement) => requirement.id)

  const cadenceConflictRequirements = requirements
    .filter((requirement) => requirement.cadenceConflict)
    .map((requirement) => requirement.id)

  const unresolvedCoverageRequirements = requirements
    .filter((requirement) => requirement.coverageRule !== 'singleton')
    .map((requirement) => requirement.id)

  const requirementSetBlockers = [
    ...unknownMandatoryCodes.map((code) => `unknown_mandatory_code:${code}`),
    ...missingCanonicalRequirements.map((id) => `missing_requirement:${id}`),
  ]

  const coverageBlockers = [
    ...requirementSetBlockers,
    ...unresolvedCoverageRequirements.map((id) => `coverage_rule_unresolved:${id}`),
  ]

  const expiryPolicyBlockers = cadenceConflictRequirements
    .map((id) => `cadence_conflict:${id}`)

  return {
    entity,
    requirements,
    unknownMandatoryCodes,
    missingCanonicalRequirements,
    cadenceConflictRequirements,
    unresolvedCoverageRequirements,
    canCertifyRequirementSet: requirementSetBlockers.length === 0,
    canCertifyCoverage: coverageBlockers.length === 0,
    canDeriveAllExpiryPolicies: expiryPolicyBlockers.length === 0,
    coverageBlockers,
    expiryPolicyBlockers,
  }
}
