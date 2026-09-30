export type PendingReviewRecord = {
  id: string
  subcontractorId: string | null
  pendingSince: string
}

export type TransportistaRecord = {
  id: string
  razonSocial: string | null
  rut: string | null
  assignedExecutiveId: string | null
  isActive: boolean | null
}

export type ExecutiveRecord = {
  id: string
  fullName: string | null
  email: string | null
  isActive: boolean | null
}

type OwnershipAnomaly = {
  type: 'missing_company' | 'missing_assignment' | 'missing_executive' | 'inactive_executive'
  companyId: string | null
  companyName: string | null
  executiveId: string | null
  maxAgeDays: number
  pendingCount: number
}

type BacklogAnomaly = {
  type: 'stale_review' | 'backlog_concentration'
  companyId: string
  companyName: string | null
  executiveId: string | null
  executiveName: string | null
  maxAgeDays: number
  pendingCount: number
}

function ageDays(iso: string, nowMs: number): number {
  const timestamp = Date.parse(iso)
  if (!Number.isFinite(timestamp)) return 0
  return Math.max(0, Math.floor((nowMs - timestamp) / 86_400_000))
}

export function buildReviewBacklogSnapshot(
  documents: PendingReviewRecord[],
  companies: TransportistaRecord[],
  executives: ExecutiveRecord[],
  now = new Date(),
) {
  const nowMs = now.getTime()
  const companyMap = new Map(companies.map((company) => [company.id, company]))
  const executiveMap = new Map(executives.map((executive) => [executive.id, executive]))

  const byCompany = new Map<string, { pendingCount: number; maxAgeDays: number }>()
  let orphanPending = 0
  let maxAgeDays = 0
  const ages: number[] = []

  for (const document of documents) {
    const age = ageDays(document.pendingSince, nowMs)
    ages.push(age)
    maxAgeDays = Math.max(maxAgeDays, age)

    if (!document.subcontractorId) {
      orphanPending += 1
      continue
    }

    const current = byCompany.get(document.subcontractorId) ?? { pendingCount: 0, maxAgeDays: 0 }
    current.pendingCount += 1
    current.maxAgeDays = Math.max(current.maxAgeDays, age)
    byCompany.set(document.subcontractorId, current)
  }

  const ownershipAnomalies: OwnershipAnomaly[] = []
  const backlogAnomalies: BacklogAnomaly[] = []
  const executiveSummary = new Map<string, {
    executiveId: string | null
    executiveName: string
    executiveEmail: string | null
    companies: Set<string>
    pendingDocs: number
    maxAgeDays: number
    docsOver7Days: number
    docsOver30Days: number
  }>()

  if (orphanPending > 0) {
    ownershipAnomalies.push({
      type: 'missing_company',
      companyId: null,
      companyName: null,
      executiveId: null,
      maxAgeDays,
      pendingCount: orphanPending,
    })
  }

  for (const [companyId, aggregate] of byCompany) {
    const company = companyMap.get(companyId)

    if (!company) {
      ownershipAnomalies.push({
        type: 'missing_company',
        companyId,
        companyName: null,
        executiveId: null,
        ...aggregate,
      })
      continue
    }

    const executiveId = company.assignedExecutiveId
    const executive = executiveId ? executiveMap.get(executiveId) : undefined

    if (!executiveId) {
      ownershipAnomalies.push({
        type: 'missing_assignment',
        companyId,
        companyName: company.razonSocial,
        executiveId: null,
        ...aggregate,
      })
    } else if (!executive) {
      ownershipAnomalies.push({
        type: 'missing_executive',
        companyId,
        companyName: company.razonSocial,
        executiveId,
        ...aggregate,
      })
    } else if (executive.isActive !== true) {
      ownershipAnomalies.push({
        type: 'inactive_executive',
        companyId,
        companyName: company.razonSocial,
        executiveId,
        ...aggregate,
      })
    }

    if (aggregate.maxAgeDays >= 30) {
      backlogAnomalies.push({
        type: 'stale_review',
        companyId,
        companyName: company.razonSocial,
        executiveId,
        executiveName: executive?.fullName ?? null,
        ...aggregate,
      })
    }

    if (aggregate.maxAgeDays >= 14 && aggregate.pendingCount >= 10) {
      backlogAnomalies.push({
        type: 'backlog_concentration',
        companyId,
        companyName: company.razonSocial,
        executiveId,
        executiveName: executive?.fullName ?? null,
        ...aggregate,
      })
    }

    const summaryKey = executiveId ?? 'unassigned'
    const summary = executiveSummary.get(summaryKey) ?? {
      executiveId,
      executiveName: executive?.fullName ?? 'Sin ejecutiva válida',
      executiveEmail: executive?.email ?? null,
      companies: new Set<string>(),
      pendingDocs: 0,
      maxAgeDays: 0,
      docsOver7Days: 0,
      docsOver30Days: 0,
    }

    summary.companies.add(companyId)
    summary.pendingDocs += aggregate.pendingCount
    summary.maxAgeDays = Math.max(summary.maxAgeDays, aggregate.maxAgeDays)
    executiveSummary.set(summaryKey, summary)
  }

  for (const document of documents) {
    if (!document.subcontractorId) continue
    const company = companyMap.get(document.subcontractorId)
    const summaryKey = company?.assignedExecutiveId ?? 'unassigned'
    const summary = executiveSummary.get(summaryKey)
    if (!summary) continue
    const age = ageDays(document.pendingSince, nowMs)
    if (age >= 7) summary.docsOver7Days += 1
    if (age >= 30) summary.docsOver30Days += 1
  }

  const slaBuckets = {
    within3Days: ages.filter((age) => age <= 3).length,
    days4to7: ages.filter((age) => age >= 4 && age <= 7).length,
    days8to30: ages.filter((age) => age >= 8 && age <= 30).length,
    over30Days: ages.filter((age) => age > 30).length,
  }

  return {
    totalPending: documents.length,
    maxAgeDays,
    slaBuckets,
    executiveSummary: Array.from(executiveSummary.values())
      .map((item) => ({ ...item, companies: item.companies.size }))
      .sort((a, b) => b.pendingDocs - a.pendingDocs),
    ownershipAnomalies: ownershipAnomalies.sort((a, b) => b.maxAgeDays - a.maxAgeDays),
    backlogAnomalies: backlogAnomalies.sort((a, b) => b.maxAgeDays - a.maxAgeDays),
  }
}
