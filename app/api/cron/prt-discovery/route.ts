import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const maxDuration = 60

const MONTHS = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre',
] as const

const MONTH_SLUGS = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'] as const

type RecordType = 'RA1' | 'RA2' | 'RB'

type DiscoveredFile = {
  period: string
  recordType: RecordType
  sourceUrl: string
}

type DiscoveryFailure = {
  year: number
  monthIndex: number
  month: string
  error: string
}

function normalizePeriod(year: number, monthIndex: number): string {
  return `${year}-${String(monthIndex + 1).padStart(2, '0')}-01`
}

function pageUrl(year: number, monthIndex: number): string {
  const folder = `${monthIndex + 1}.${MONTHS[monthIndex]}`
  return `https://www.prt.cl/Descargas/sites/${year}/${folder}/${MONTHS[monthIndex].toLowerCase()}.html`
}

function parseRecordType(url: string): RecordType | null {
  if (/SGPRT_RA1_/i.test(url)) return 'RA1'
  if (/SGPRT_RA2_/i.test(url)) return 'RA2'
  if (/SGPRT_RB_/i.test(url)) return 'RB'
  return null
}

async function discoverMonth(year: number, monthIndex: number): Promise<DiscoveredFile[]> {
  const url = pageUrl(year, monthIndex)
  const response = await fetch(url, {
    cache: 'no-store',
    redirect: 'follow',
    headers: {
      Accept: 'text/html,application/xhtml+xml',
      'Accept-Language': 'es-CL,es;q=0.9',
      'User-Agent': 'Mozilla/5.0 (compatible; LABBE-PRT-Discovery/2.0)',
    },
  })

  if (!response.ok) return []

  const html = await response.text()
  const base = new URL(response.url || url)
  const period = normalizePeriod(year, monthIndex)
  const expectedSlug = MONTH_SLUGS[monthIndex]

  return [...html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>/gi)]
    .map((match) => new URL(match[1], base).toString())
    .filter((href) => new RegExp(`SGPRT_(RA1|RA2|RB)_${expectedSlug}-${year}\\.zip`, 'i').test(href))
    .map((sourceUrl) => ({
      period,
      recordType: parseRecordType(sourceUrl),
      sourceUrl,
    }))
    .filter((item): item is DiscoveredFile => item.recordType !== null)
}

function monthCandidates(now: Date): Array<{ year: number; monthIndex: number }> {
  const candidates: Array<{ year: number; monthIndex: number }> = []
  for (let offset = 0; offset < 4; offset += 1) {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - offset, 1))
    candidates.push({ year: date.getUTCFullYear(), monthIndex: date.getUTCMonth() })
  }
  return candidates
}

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return true
  return request.headers.get('authorization') === `Bearer ${secret}`
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const candidates = monthCandidates(new Date())
  const settled = await Promise.allSettled(
    candidates.map(({ year, monthIndex }) => discoverMonth(year, monthIndex)),
  )

  const discovered: DiscoveredFile[] = []
  const failures: DiscoveryFailure[] = []

  settled.forEach((result, index) => {
    const candidate = candidates[index]
    if (result.status === 'fulfilled') {
      discovered.push(...result.value)
      return
    }

    failures.push({
      year: candidate.year,
      monthIndex: candidate.monthIndex,
      month: MONTHS[candidate.monthIndex],
      error: result.reason instanceof Error ? result.reason.message : String(result.reason),
    })
  })

  if (discovered.length === 0) {
    return NextResponse.json({
      discovered: 0,
      inserted: 0,
      files: [],
      failedSources: failures.length,
      failures,
      partial: failures.length > 0,
    })
  }

  const rows = discovered.map((file) => ({
    period: file.period,
    record_type: file.recordType,
    source_url: file.sourceUrl,
    status: 'discovered',
  }))

  const { data, error } = await supabase
    .from('prt_import_batches')
    .upsert(rows, {
      onConflict: 'period,record_type,source_url',
      ignoreDuplicates: true,
    })
    .select('id, period, record_type, source_url, status')

  if (error) {
    return NextResponse.json({ error: error.message, discovered: discovered.length, failures }, { status: 500 })
  }

  return NextResponse.json({
    discovered: discovered.length,
    inserted: data?.length ?? 0,
    files: discovered,
    failedSources: failures.length,
    failures,
    partial: failures.length > 0,
  })
}
