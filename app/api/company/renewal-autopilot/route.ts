export const dynamic = 'force-dynamic'
export const revalidate = 0

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyAuth } from '@/lib/auth-middleware'

type Stage = 'expired' | 'd3' | 'd7' | 'd15' | 'd30'
type Channel = 'email+whatsapp' | 'email' | 'whatsapp' | 'manual'

type DocumentRow = {
  id: string
  subcontractor_id: string | null
  document_type_id: string | null
  file_name: string | null
  expires_at: string
}

type TransportistaRow = {
  id: string
  razon_social: string | null
  nombre_fantasia: string | null
  rut: string | null
  email: string | null
  correo: string | null
  telefono: string | null
  assigned_executive_id: string | null
}

type DocumentTypeRow = {
  id: string
  nombre: string | null
  code: string | null
}

const PAGE_SIZE = 1000
const MAX_ITEMS = 100
const STAGE_ORDER: Stage[] = ['expired', 'd3', 'd7', 'd15', 'd30']

function dateOnly(date: Date) {
  return date.toISOString().slice(0, 10)
}

function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setUTCDate(next.getUTCDate() + days)
  return next
}

function normalizeContact(value: string | null | undefined) {
  const normalized = value?.trim()
  return normalized || null
}

function daysUntil(value: string, today: Date) {
  const target = new Date(`${value.slice(0, 10)}T00:00:00.000Z`)
  const start = new Date(`${dateOnly(today)}T00:00:00.000Z`)
  return Math.round((target.getTime() - start.getTime()) / 86400000)
}

function stageFor(days: number): Stage {
  if (days < 0) return 'expired'
  if (days <= 3) return 'd3'
  if (days <= 7) return 'd7'
  if (days <= 15) return 'd15'
  return 'd30'
}

function stageLabel(stage: Stage) {
  switch (stage) {
    case 'expired': return 'Vencido'
    case 'd3': return '0–3 días'
    case 'd7': return '4–7 días'
    case 'd15': return '8–15 días'
    case 'd30': return '16–30 días'
  }
}

function suggestedChannel(email: string | null, phone: string | null): Channel {
  if (email && phone) return 'email+whatsapp'
  if (email) return 'email'
  if (phone) return 'whatsapp'
  return 'manual'
}

function suggestedAction(stage: Stage) {
  switch (stage) {
    case 'expired': return 'Escalar renovación vencida'
    case 'd3': return 'Recordatorio crítico'
    case 'd7': return 'Recordatorio 7 días'
    case 'd15': return 'Recordatorio 15 días'
    case 'd30': return 'Aviso preventivo 30 días'
  }
}

async function fetchAllCandidates(
  supabase: ReturnType<typeof createAdminClient>,
  throughDate: string,
): Promise<DocumentRow[]> {
  const rows: DocumentRow[] = []

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from('subcontractor_documents')
      .select('id,subcontractor_id,document_type_id,file_name,expires_at')
      .eq('is_current', true)
      .eq('status', 'approved')
      .not('expires_at', 'is', null)
      .lte('expires_at', `${throughDate}T23:59:59.999Z`)
      .order('expires_at', { ascending: true })
      .range(from, from + PAGE_SIZE - 1)

    if (error) throw error

    const page = (data || []) as DocumentRow[]
    rows.push(...page)
    if (page.length < PAGE_SIZE) break
  }

  return rows
}

export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await verifyAuth(request)
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const requestedLimit = Number(request.nextUrl.searchParams.get('limit') || 50)
    const limit = Math.min(Math.max(Number.isFinite(requestedLimit) ? requestedLimit : 50, 10), MAX_ITEMS)
    const supabase = createAdminClient()
    const today = new Date()
    const throughDate = dateOnly(addDays(today, 30))

    const documents = await fetchAllCandidates(supabase, throughDate)
    const companyIds = Array.from(new Set(documents.map((row) => row.subcontractor_id).filter(Boolean))) as string[]
    const documentTypeIds = Array.from(new Set(documents.map((row) => row.document_type_id).filter(Boolean))) as string[]

    const [companiesResult, documentTypesResult] = await Promise.all([
      companyIds.length
        ? supabase
            .from('transportistas')
            .select('id,razon_social,nombre_fantasia,rut,email,correo,telefono,assigned_executive_id')
            .in('id', companyIds)
        : Promise.resolve({ data: [], error: null }),
      documentTypeIds.length
        ? supabase
            .from('subcontractor_document_types')
            .select('id,nombre,code')
            .in('id', documentTypeIds)
        : Promise.resolve({ data: [], error: null }),
    ])

    if (companiesResult.error) throw companiesResult.error
    if (documentTypesResult.error) throw documentTypesResult.error

    const companies = new Map(
      ((companiesResult.data || []) as TransportistaRow[]).map((row) => [row.id, row]),
    )
    const documentTypes = new Map(
      ((documentTypesResult.data || []) as DocumentTypeRow[]).map((row) => [row.id, row]),
    )

    const stageCounts: Record<Stage, number> = { expired: 0, d3: 0, d7: 0, d15: 0, d30: 0 }
    const stageCompanies: Record<Stage, Set<string>> = {
      expired: new Set(),
      d3: new Set(),
      d7: new Set(),
      d15: new Set(),
      d30: new Set(),
    }
    const affectedCompanies = new Set<string>()
    const contactableCompanies = new Set<string>()
    const missingContactCompanies = new Set<string>()

    const items = documents.map((doc) => {
      const company = doc.subcontractor_id ? companies.get(doc.subcontractor_id) : undefined
      const type = doc.document_type_id ? documentTypes.get(doc.document_type_id) : undefined
      const daysUntilExpiry = daysUntil(doc.expires_at, today)
      const stage = stageFor(daysUntilExpiry)
      const email = normalizeContact(company?.email) || normalizeContact(company?.correo)
      const phone = normalizeContact(company?.telefono)
      const channel = suggestedChannel(email, phone)
      const companyKey = company?.id || doc.subcontractor_id || 'unknown'

      stageCounts[stage] += 1
      stageCompanies[stage].add(companyKey)
      affectedCompanies.add(companyKey)
      if (channel === 'manual') missingContactCompanies.add(companyKey)
      else contactableCompanies.add(companyKey)

      return {
        documentId: doc.id,
        companyId: doc.subcontractor_id,
        companyName: company?.razon_social || company?.nombre_fantasia || 'Subcontratista sin nombre',
        rut: company?.rut || null,
        documentType: type?.nombre || type?.code || 'Documento',
        fileName: doc.file_name,
        expiresAt: doc.expires_at,
        daysUntilExpiry,
        stage,
        stageLabel: stageLabel(stage),
        suggestedAction: suggestedAction(stage),
        suggestedChannel: channel,
        contact: {
          email,
          phone,
          ready: channel !== 'manual',
        },
        assignedExecutiveId: company?.assigned_executive_id || null,
      }
    })

    items.sort((a, b) => {
      const stageDelta = STAGE_ORDER.indexOf(a.stage) - STAGE_ORDER.indexOf(b.stage)
      if (stageDelta !== 0) return stageDelta
      return a.daysUntilExpiry - b.daysUntilExpiry
    })

    const response = NextResponse.json({
      dryRun: true,
      sendEnabled: false,
      generatedAt: new Date().toISOString(),
      policy: {
        horizonDays: 30,
        stages: [
          { key: 'd30', window: '16–30 días', intent: 'aviso preventivo' },
          { key: 'd15', window: '8–15 días', intent: 'seguimiento' },
          { key: 'd7', window: '4–7 días', intent: 'urgente' },
          { key: 'd3', window: '0–3 días', intent: 'crítico' },
          { key: 'expired', window: 'vencido', intent: 'escalamiento' },
        ],
      },
      summary: {
        documentsInRenewalWindow: documents.length,
        companiesAffected: affectedCompanies.size,
        contactableCompanies: contactableCompanies.size,
        companiesMissingContact: missingContactCompanies.size,
        stages: {
          expired: { documents: stageCounts.expired, companies: stageCompanies.expired.size },
          d3: { documents: stageCounts.d3, companies: stageCompanies.d3.size },
          d7: { documents: stageCounts.d7, companies: stageCompanies.d7.size },
          d15: { documents: stageCounts.d15, companies: stageCompanies.d15.size },
          d30: { documents: stageCounts.d30, companies: stageCompanies.d30.size },
        },
      },
      items: items.slice(0, limit),
    })

    response.headers.set('Cache-Control', 'no-store, must-revalidate')
    return response
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('[renewal-autopilot] dry-run failed:', message)
    return NextResponse.json(
      { error: 'No fue posible calcular el plan de renovaciones.', dryRun: true, sendEnabled: false },
      { status: 500 },
    )
  }
}
