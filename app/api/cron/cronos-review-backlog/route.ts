import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { finishSystemJobRun, startSystemJobRun } from '@/lib/system-job-runs'
import { buildReviewBacklogSnapshot } from '@/lib/review-backlog-sentinel'
import { buildDataQualityReport, type DataQualityDocument } from '@/lib/data-quality-sentinel'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const maxDuration = 120
export const runtime = 'nodejs'

const JOB_NAME = 'review_backlog_sentinel'
const PAGE_SIZE = 1000

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  return request.headers.get('authorization') === `Bearer ${secret}`
}

async function loadAllDocuments(): Promise<DataQualityDocument[]> {
  const supabase = createAdminClient()
  const rows: DataQualityDocument[] = []

  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await supabase
      .from('subcontractor_documents')
      .select('id,subcontractor_id,subcontractor_rut,document_type_id,file_name,status,reviewed_at,rejection_reason,document_period_start,is_current')
      .order('id', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1)

    if (error) throw new Error(`Could not load documents: ${error.message}`)

    const batch = (data ?? []).map((row) => ({
      id: String(row.id),
      subcontractorId: row.subcontractor_id ? String(row.subcontractor_id) : null,
      subcontractorRut: row.subcontractor_rut ? String(row.subcontractor_rut) : null,
      documentTypeId: row.document_type_id ? String(row.document_type_id) : null,
      fileName: row.file_name ? String(row.file_name) : null,
      status: row.status ? String(row.status) : null,
      reviewedAt: row.reviewed_at ? String(row.reviewed_at) : null,
      rejectionReason: row.rejection_reason ? String(row.rejection_reason) : null,
      documentPeriodStart: row.document_period_start ? String(row.document_period_start) : null,
      isCurrent: row.is_current,
    }))

    rows.push(...batch)
    if (batch.length < PAGE_SIZE) break
  }

  return rows
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const jobRun = await startSystemJobRun(JOB_NAME)
  const supabase = createAdminClient()

  try {
    const [documents, companiesResult, executivesResult] = await Promise.all([
      loadAllDocuments(),
      supabase
        .from('transportistas')
        .select('id,razon_social,rut,assigned_executive_id,is_active')
        .limit(5000),
      supabase
        .from('executive_staff')
        .select('id,full_name,email,is_active')
        .limit(500),
    ])

    const errors = [companiesResult.error, executivesResult.error].filter(Boolean)
    if (errors.length > 0) {
      throw new Error(errors.map((error) => error?.message).join('; '))
    }

    const companies = (companiesResult.data ?? []).map((row) => ({
      id: String(row.id),
      razonSocial: row.razon_social ? String(row.razon_social) : null,
      rut: row.rut ? String(row.rut) : null,
      assignedExecutiveId: row.assigned_executive_id ? String(row.assigned_executive_id) : null,
      isActive: row.is_active,
    }))

    const pendingDocuments = documents
      .filter((document) => document.status === 'pending')
      .map((document) => {
        const source = (document as DataQualityDocument & { uploadedAt?: string; createdAt?: string })
        return {
          id: document.id,
          subcontractorId: document.subcontractorId,
          pendingSince: source.uploadedAt ?? source.createdAt ?? new Date().toISOString(),
        }
      })

    // Load pending timestamps separately to keep the quality scan bounded to canonical fields.
    const pendingTimestampMap = new Map<string, string>()
    for (let offset = 0; ; offset += PAGE_SIZE) {
      const { data, error } = await supabase
        .from('subcontractor_documents')
        .select('id,uploaded_at,created_at')
        .eq('status', 'pending')
        .order('id', { ascending: true })
        .range(offset, offset + PAGE_SIZE - 1)

      if (error) throw new Error(`Could not load pending timestamps: ${error.message}`)
      for (const row of data ?? []) {
        pendingTimestampMap.set(String(row.id), String(row.uploaded_at ?? row.created_at))
      }
      if ((data ?? []).length < PAGE_SIZE) break
    }

    const backlog = buildReviewBacklogSnapshot(
      pendingDocuments.map((document) => ({
        ...document,
        pendingSince: pendingTimestampMap.get(document.id) ?? document.pendingSince,
      })),
      companies,
      (executivesResult.data ?? []).map((row) => ({
        id: String(row.id),
        fullName: row.full_name ? String(row.full_name) : null,
        email: row.email ? String(row.email) : null,
        isActive: row.is_active,
      })),
    )

    const dataQuality = buildDataQualityReport(documents, companies)
    const snapshotDate = new Date().toISOString().slice(0, 10)
    const status = dataQuality.hardIntegrityIssueCount > 0 ? 'partial' : 'completed'

    await finishSystemJobRun(jobRun, {
      status,
      processedCount: documents.length,
      succeededCount: documents.length - dataQuality.hardIntegrityIssueCount,
      failedCount: dataQuality.hardIntegrityIssueCount,
      result: {
        snapshotDate,
        backlog: {
          totalPending: backlog.totalPending,
          maxAgeDays: backlog.maxAgeDays,
          slaBuckets: backlog.slaBuckets,
          ownershipAnomalyCount: backlog.ownershipAnomalies.length,
          backlogAnomalyCount: backlog.backlogAnomalies.length,
          executiveSummary: backlog.executiveSummary,
          attentionSummary: backlog.attentionSummary,
          attentionQueue: backlog.attentionQueue,
        },
        dataQuality: {
          companiesScanned: dataQuality.companiesScanned,
          documentsScanned: dataQuality.documentsScanned,
          duplicateCompanyGroups: dataQuality.duplicateCompanyGroups,
          duplicateCompanyRows: dataQuality.duplicateCompanyRows,
          conflictingDuplicateOwnershipGroups: dataQuality.conflictingDuplicateOwnershipGroups,
          duplicateCurrentDocumentGroups: dataQuality.duplicateCurrentDocumentGroups,
          duplicateCurrentDocumentRows: dataQuality.duplicateCurrentDocumentRows,
          hardIntegrityIssueCount: dataQuality.hardIntegrityIssueCount,
          issueCounts: dataQuality.issueCounts,
          duplicateCompanies: dataQuality.duplicateCompanies,
          duplicateCurrentDocuments: dataQuality.duplicateCurrentDocuments,
          integrityIssueSamples: dataQuality.integrityIssueSamples,
        },
      },
      errorMessage: null,
    })

    return NextResponse.json({
      status,
      snapshotDate,
      backlog,
      dataQuality,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown review/data quality sentinel error'

    await finishSystemJobRun(jobRun, {
      status: 'failed',
      failedCount: 1,
      errorMessage: message,
      result: { stage: 'review_data_quality_sentinel' },
    })

    return NextResponse.json({ status: 'failed', error: message }, { status: 500 })
  }
}
