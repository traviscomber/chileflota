import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { authorizeInternalDocumentRequest, DOCUMENT_READ_ROLES } from '@/lib/document-route-auth'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const session = await authorizeInternalDocumentRequest(request, DOCUMENT_READ_ROLES)
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const searchParams = request.nextUrl.searchParams
    const driverRut = searchParams.get('driver_rut')
    const daysThreshold = parseInt(searchParams.get('days') || '30') // Por defecto alertar con anticipación estándar

    console.log('[v0] Checking document expiration alerts:', { driverRut, daysThreshold })

    const adminClient = createAdminClient()

    // Calcular fecha límite
    const today = new Date()
    const alertDate = new Date(today.getTime() + daysThreshold * 24 * 60 * 60 * 1000)

    let query = adminClient
      .from('documents')
      .select('*')
      .is('expiration_date', null)
      .neq('expiration_date', null)

    if (driverRut) {
      query = query.ilike('file_name', `${driverRut}_%`)
    }

    const { data: allDocs, error } = await query

    if (error) {
      console.error('[v0] Error fetching documents:', error)
      return NextResponse.json({ error: 'Failed to fetch documents' }, { status: 500 })
    }

    // Filtrar documentos por estado de vencimiento
    const alerts = (allDocs || []).map(doc => {
      if (!doc.expiration_date) return null

      const expDate = new Date(doc.expiration_date)
      const daysRemaining = Math.ceil(
        (expDate.getTime() - today.getTime()) / (24 * 60 * 60 * 1000)
      )

      const status = daysRemaining < 0 ? 'expired' : 'expiring_soon'
      const severity = daysRemaining < 0 ? 'critical' : daysRemaining < 7 ? 'high' : 'medium'

      return {
        document_id: doc.id,
        file_name: doc.file_name,
        document_type: doc.document_type,
        custom_code: doc.custom_code,
        expiration_date: doc.expiration_date,
        days_remaining: daysRemaining,
        status: status,
        severity: severity,
        alert_type: daysRemaining < 0 ? 'EXPIRED' : daysRemaining < 7 ? 'URGENT' : 'WARNING'
      }
    }).filter((a): a is NonNullable<typeof a> => a !== null)

    // Agrupar por severidad
    const critical = alerts.filter(a => a.severity === 'critical')
    const urgent = alerts.filter(a => a.severity === 'high')
    const warnings = alerts.filter(a => a.severity === 'medium')

    console.log('[v0] Document alerts:', {
      critical: critical.length,
      urgent: urgent.length,
      warnings: warnings.length
    })

    return NextResponse.json({
      success: true,
      threshold_days: daysThreshold,
      total_alerts: alerts.length,
      critical: critical,
      urgent: urgent,
      warnings: warnings,
      all_alerts: alerts
    })
  } catch (error) {
    console.error('[v0] Error in GET /api/company/documents/alerts:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Server error' },
      { status: 500 }
    )
  }
}
