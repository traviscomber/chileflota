export type DataAuthority =
  | "canonical"
  | "official"
  | "verified_external"
  | "external"
  | "derived"
  | "ai_generated"
  | "memory"

export type VerificationStatus =
  | "unverified"
  | "verified"
  | "rejected"
  | "superseded"
  | "pending_review"

export type MissingReason =
  | "unknown"
  | "not_collected"
  | "unavailable"
  | "not_applicable"
  | "pending_review"
  | "redacted"

export type DataEvidenceRef = {
  id?: string
  source: string
  sourceType?: string | null
  sourceRef?: string | null
  subjectType?: string | null
  subjectId?: string | null
  field: string
  authority: DataAuthority
  observedAt?: string | null
  effectiveAt?: string | null
  ingestedAt?: string | null
  sourceVersion?: string | null
  transformationVersion?: string | null
  confidence?: number | null
  qualityFlags?: string[]
  verificationStatus?: VerificationStatus
  fingerprint?: string | null
  supersedes?: string | null
  valuePresent?: boolean
  missingReason?: MissingReason | null
  valueKey?: string | null
}

export type DataReadinessPolicy = {
  version: string
  maxAgeMs?: number
  requiredFields?: string[]
  minEvidence?: number
  requireCanonicalIdentity?: boolean
  requireAuthorization?: boolean
  requireCanonicalSelection?: boolean
  requireProvenance?: boolean
  requireVerifiedEvidence?: boolean
  blockOnStale?: boolean
  blockOnMissingRequired?: boolean
  blockOnContradiction?: boolean
}

export type DataReadinessCheckName =
  | "identity_resolution"
  | "schema_validation"
  | "freshness"
  | "completeness"
  | "temporal_consistency"
  | "provenance"
  | "contradictions"
  | "authorization"
  | "canonical_selection"

export type DataReadinessCheck = {
  name: DataReadinessCheckName
  status: "pass" | "warn" | "fail" | "skipped"
  issues: string[]
}

export type DataReadinessResult = {
  status: "ready" | "limited" | "blocked"
  score: number
  checks: DataReadinessCheck[]
  warnings: string[]
  blockers: string[]
  evaluatedAt: string
  policyVersion: string
}

export type DataReadinessInput = {
  canonicalEntityId?: string | null
  canonicalSelectionChecked?: boolean
  authorizationChecked?: boolean
  evidence: DataEvidenceRef[]
  decisionTime?: string | null
  evaluatedAt?: string
}

export const DEFAULT_DATA_READINESS_POLICY: DataReadinessPolicy = {
  version: "n3uralia-data-readiness-v1",
  minEvidence: 1,
  requiredFields: [],
  requireCanonicalIdentity: true,
  requireAuthorization: true,
  requireCanonicalSelection: true,
  requireProvenance: true,
  requireVerifiedEvidence: false,
  blockOnStale: false,
  blockOnMissingRequired: true,
  blockOnContradiction: true,
}

function parseTime(value?: string | null) {
  if (!value) return null
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : null
}

function makeCheck(
  name: DataReadinessCheckName,
  status: DataReadinessCheck["status"],
  issues: string[] = [],
): DataReadinessCheck {
  return { name, status, issues }
}

function checkIdentity(input: DataReadinessInput, policy: DataReadinessPolicy) {
  if (!policy.requireCanonicalIdentity) return makeCheck("identity_resolution", "skipped")
  if (input.canonicalEntityId?.trim()) return makeCheck("identity_resolution", "pass")
  return makeCheck("identity_resolution", "fail", ["canonical_entity_id_missing"])
}

function checkSchema(input: DataReadinessInput) {
  const issues: string[] = []

  input.evidence.forEach((item, index) => {
    const prefix = `evidence[${index}]`
    if (!item.source?.trim()) issues.push(`${prefix}:source_missing`)
    if (!item.field?.trim()) issues.push(`${prefix}:field_missing`)
    if (item.valuePresent === false && !item.missingReason) {
      issues.push(`${prefix}:missing_reason_required`)
    }
    if (
      item.confidence != null &&
      (!Number.isFinite(item.confidence) || item.confidence < 0 || item.confidence > 1)
    ) {
      issues.push(`${prefix}:confidence_out_of_range`)
    }
  })

  return issues.length
    ? makeCheck("schema_validation", "fail", issues)
    : makeCheck("schema_validation", "pass")
}

function checkFreshness(
  input: DataReadinessInput,
  policy: DataReadinessPolicy,
  evaluatedAtMs: number,
) {
  if (policy.maxAgeMs == null) return makeCheck("freshness", "skipped")

  const stale: string[] = []
  const missing: string[] = []

  input.evidence.forEach((item, index) => {
    const observedAt = parseTime(item.observedAt)
    if (observedAt == null) {
      missing.push(`evidence[${index}]:observed_at_missing`)
      return
    }
    if (evaluatedAtMs - observedAt > policy.maxAgeMs!) {
      stale.push(`evidence[${index}]:stale`)
    }
  })

  const issues = [...stale, ...missing]
  if (!issues.length) return makeCheck("freshness", "pass")
  if (policy.blockOnStale && stale.length) return makeCheck("freshness", "fail", issues)
  return makeCheck("freshness", "warn", issues)
}

function checkCompleteness(input: DataReadinessInput, policy: DataReadinessPolicy) {
  const issues: string[] = []
  const minimum = policy.minEvidence ?? 0

  if (input.evidence.length < minimum) {
    issues.push(`evidence_count_below_minimum:${input.evidence.length}<${minimum}`)
  }

  const presentFields = new Set(
    input.evidence
      .filter((item) => item.valuePresent !== false)
      .map((item) => item.field),
  )

  for (const field of policy.requiredFields ?? []) {
    if (!presentFields.has(field)) issues.push(`required_field_missing:${field}`)
  }

  if (!issues.length) return makeCheck("completeness", "pass")
  return makeCheck(
    "completeness",
    policy.blockOnMissingRequired ? "fail" : "warn",
    issues,
  )
}

function checkTemporalConsistency(input: DataReadinessInput, evaluatedAtMs: number) {
  const issues: string[] = []
  const decisionAt = parseTime(input.decisionTime) ?? evaluatedAtMs

  input.evidence.forEach((item, index) => {
    const observedAt = parseTime(item.observedAt)
    const effectiveAt = parseTime(item.effectiveAt)
    const ingestedAt = parseTime(item.ingestedAt)

    if (item.observedAt && observedAt == null) issues.push(`evidence[${index}]:invalid_observed_at`)
    if (item.effectiveAt && effectiveAt == null) issues.push(`evidence[${index}]:invalid_effective_at`)
    if (item.ingestedAt && ingestedAt == null) issues.push(`evidence[${index}]:invalid_ingested_at`)

    if (observedAt != null && ingestedAt != null && observedAt > ingestedAt) {
      issues.push(`evidence[${index}]:observed_after_ingested`)
    }

    if (effectiveAt != null && effectiveAt > decisionAt) {
      issues.push(`evidence[${index}]:future_effective_data_leakage`)
    }

    if (ingestedAt != null && ingestedAt > decisionAt) {
      issues.push(`evidence[${index}]:future_ingested_data_leakage`)
    }
  })

  return issues.length
    ? makeCheck("temporal_consistency", "fail", issues)
    : makeCheck("temporal_consistency", "pass")
}

function checkProvenance(input: DataReadinessInput, policy: DataReadinessPolicy) {
  if (!policy.requireProvenance) return makeCheck("provenance", "skipped")

  const issues: string[] = []

  input.evidence.forEach((item, index) => {
    const prefix = `evidence[${index}]`

    if (!item.sourceRef && !item.fingerprint && !item.sourceVersion) {
      issues.push(`${prefix}:weak_source_reference`)
    }

    if (
      (item.authority === "derived" || item.authority === "ai_generated") &&
      !item.transformationVersion
    ) {
      issues.push(`${prefix}:transformation_version_missing`)
    }

    if (
      policy.requireVerifiedEvidence &&
      item.authority !== "canonical" &&
      item.verificationStatus !== "verified"
    ) {
      issues.push(`${prefix}:verification_required`)
    }
  })

  return issues.length
    ? makeCheck("provenance", "warn", issues)
    : makeCheck("provenance", "pass")
}

function checkContradictions(input: DataReadinessInput, policy: DataReadinessPolicy) {
  const valuesByField = new Map<string, Set<string>>()

  for (const item of input.evidence) {
    if (
      item.valuePresent === false ||
      item.verificationStatus === "rejected" ||
      item.verificationStatus === "superseded" ||
      !item.valueKey
    ) {
      continue
    }

    if (
      item.authority !== "canonical" &&
      item.authority !== "official" &&
      item.authority !== "verified_external"
    ) {
      continue
    }

    const values = valuesByField.get(item.field) ?? new Set<string>()
    values.add(item.valueKey)
    valuesByField.set(item.field, values)
  }

  const issues = [...valuesByField.entries()]
    .filter(([, values]) => values.size > 1)
    .map(([field]) => `authoritative_conflict:${field}`)

  if (!issues.length) return makeCheck("contradictions", "pass")
  return makeCheck(
    "contradictions",
    policy.blockOnContradiction ? "fail" : "warn",
    issues,
  )
}

function checkAuthorization(input: DataReadinessInput, policy: DataReadinessPolicy) {
  if (!policy.requireAuthorization) return makeCheck("authorization", "skipped")
  if (input.authorizationChecked === true) return makeCheck("authorization", "pass")
  return makeCheck("authorization", "fail", ["authorization_not_confirmed"])
}

function checkCanonicalSelection(input: DataReadinessInput, policy: DataReadinessPolicy) {
  if (!policy.requireCanonicalSelection) return makeCheck("canonical_selection", "skipped")
  if (input.canonicalSelectionChecked === true) return makeCheck("canonical_selection", "pass")
  return makeCheck("canonical_selection", "fail", ["canonical_selection_not_confirmed"])
}

export function evaluateDataReadiness(
  input: DataReadinessInput,
  policy: DataReadinessPolicy = DEFAULT_DATA_READINESS_POLICY,
): DataReadinessResult {
  const evaluatedAt = input.evaluatedAt ?? new Date().toISOString()
  const evaluatedAtMs = parseTime(evaluatedAt) ?? Date.now()

  const checks: DataReadinessCheck[] = [
    checkIdentity(input, policy),
    checkSchema(input),
    checkFreshness(input, policy, evaluatedAtMs),
    checkCompleteness(input, policy),
    checkTemporalConsistency(input, evaluatedAtMs),
    checkProvenance(input, policy),
    checkContradictions(input, policy),
    checkAuthorization(input, policy),
    checkCanonicalSelection(input, policy),
  ]

  const blockers = checks
    .filter((check) => check.status === "fail")
    .flatMap((check) => check.issues.map((issue) => `${check.name}:${issue}`))

  const warnings = checks
    .filter((check) => check.status === "warn")
    .flatMap((check) => check.issues.map((issue) => `${check.name}:${issue}`))

  const penalty = checks.reduce((total, check) => {
    if (check.status === "fail") return total + 20
    if (check.status === "warn") return total + 7
    return total
  }, 0)

  return {
    status: blockers.length ? "blocked" : warnings.length ? "limited" : "ready",
    score: Math.max(0, 100 - penalty),
    checks,
    warnings,
    blockers,
    evaluatedAt,
    policyVersion: policy.version,
  }
}

export type AgentGroundingEnvelope<TCanonical, TDerived, TMemory> = {
  subject: { type: string; id: string }
  canonical: TCanonical[]
  evidence: DataEvidenceRef[]
  derived: TDerived[]
  memory: TMemory[]
  readiness: DataReadinessResult
  decisionTime: string
}

export function buildAgentGroundingEnvelope<TCanonical, TDerived, TMemory>(input: {
  subject: { type: string; id: string }
  canonical: TCanonical[]
  evidence: DataEvidenceRef[]
  derived?: TDerived[]
  memory?: TMemory[]
  authorizationChecked: boolean
  canonicalSelectionChecked: boolean
  policy?: DataReadinessPolicy
  decisionTime?: string
}): AgentGroundingEnvelope<TCanonical, TDerived, TMemory> {
  const decisionTime = input.decisionTime ?? new Date().toISOString()
  const readiness = evaluateDataReadiness(
    {
      canonicalEntityId: input.subject.id,
      canonicalSelectionChecked: input.canonicalSelectionChecked,
      authorizationChecked: input.authorizationChecked,
      evidence: input.evidence,
      decisionTime,
      evaluatedAt: decisionTime,
    },
    input.policy ?? DEFAULT_DATA_READINESS_POLICY,
  )

  return {
    subject: input.subject,
    canonical: input.canonical,
    evidence: input.evidence,
    derived: input.derived ?? [],
    memory: input.memory ?? [],
    readiness,
    decisionTime,
  }
}
