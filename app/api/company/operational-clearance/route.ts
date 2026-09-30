import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { verifyAuth } from '@/lib/auth-middleware'
import { createAdminClient } from '@/lib/supabase/admin'
import { canViewOperationalClearance } from '@/lib/operational-clearance-authorization'
import { evaluateOperationalClearance, type ClearanceDocumentEvidence } from '@/lib/operational-clearance'

export const dynamic = 'force-dynamic'

const querySchema = z.object({
  entityType: z.enum(['transportista', 'conductor']),
  entityId: z.string().uuid(),
})

const LEGACY_MULTI_INSTANCE_SUBCONTRACTOR_CODES = new Set([
  'LIQUIDACION_SUELDO',
  'HOJA_VIDA',
  'CERT_ANTECEDENTES',
  'COMPROBANTE_PAGO',
  'PLANILLAS_IMPOSICIONES',
  'FOTO_PATENTES',
])

export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await verifyAuth(request)
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const url = new URL(request.url)
    const parsed = querySchema.safeParse({
      entityType: url.searchParams.get('entityType'),
      entityId: url.searchParams.get('entityId'),
    })

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid clearance query' }, { status: 400 })
    }

    const { entityType, entityId } = parsed.data
    const authorization = await canViewOperationalClearance(
      { id: user.id, email: user.email },
      entityType,
      entityId,
    )

    if (!authorization.allowed) {
      return NextResponse.json(
        { error: authorization.reason || 'Forbidden' },
        { status: 403 },
      )
    }

    // Privileged read begins only after explicit authentication and
    // assignment-aware authorization. This endpoint performs no writes.
    const admin = createAdminClient()
    const evidence: ClearanceDocumentEvidence[] = []
    let entityActive = true
    let licenseExpiresAt: string | null = null

    if (entityType === 'transportista') {
      const [entityResult, documentsResult, typesResult] = await Promise.all([
        admin.from('transportistas').select('id,is_active').eq('id', entityId).maybeSingle(),
        admin
          .from('subcontractor_documents')
          .select('id,document_type_id,status,expires_at,ai_expiration_date,is_current')
          .eq('subcontractor_id', entityId)
          .or('is_current.eq.true,status.eq.pending'),
        admin.from('subcontractor_document_types').select('id,code,nombre,is_active'),
      ])

      if (entityResult.error || !entityResult.data) {
        return NextResponse.json({ error: 'Transportista not found' }, { status: 404 })
      }
      if (documentsResult.error) throw documentsResult.error
      if (typesResult.error) throw typesResult.error

      entityActive = entityResult.data.is_active !== false
      const typeMap = new Map(
        (typesResult.data || [])
          .filter((type: any) => type.is_active !== false)
          .map((type: any) => [type.id, { code: type.code, label: type.nombre || type.code }]),
      )

      for (const document of documentsResult.data || []) {
        const type = typeMap.get(document.document_type_id) as { code: string; label: string } | undefined
        if (document.is_current !== true) {
          if (document.status !== 'pending' || !type || !LEGACY_MULTI_INSTANCE_SUBCONTRACTOR_CODES.has(type.code)) {
            continue
          }
        }

        evidence.push({
          id: document.id,
          label: type?.label || 'Documento de empresa',
          status: document.status,
          expiresAt: document.expires_at || document.ai_expiration_date || null,
          source: 'subcontractor_documents',
        })
      }
    } else {
      const [entityResult, documentsResult, typesResult] = await Promise.all([
        admin
          .from('conductores')
          .select('id,is_active,vencimiento_licencia')
          .eq('id', entityId)
          .maybeSingle(),
        admin
          .from('uploaded_documents')
          .select('id,document_type_id,validation_status,expiration_date,ai_expiration_date,is_current')
          .eq('conductor_id', entityId)
          .eq('is_current', true),
        admin.from('document_types').select('id,code,name,is_active'),
      ])

      if (entityResult.error || !entityResult.data) {
        return NextResponse.json({ error: 'Conductor not found' }, { status: 404 })
      }
      if (documentsResult.error) throw documentsResult.error
      if (typesResult.error) throw typesResult.error

      entityActive = entityResult.data.is_active !== false
      licenseExpiresAt = entityResult.data.vencimiento_licencia || null
      const typeMap = new Map(
        (typesResult.data || [])
          .filter((type: any) => type.is_active !== false)
          .map((type: any) => [type.id, type.name || type.code]),
      )

      for (const document of documentsResult.data || []) {
        evidence.push({
          id: document.id,
          label: typeMap.get(document.document_type_id) || 'Documento de conductor',
          status: document.validation_status,
          expiresAt: document.expiration_date || document.ai_expiration_date || null,
          source: 'uploaded_documents',
        })
      }
    }

    // Requirement catalog normalization is a separate canonical-data gate.
    // Until it is certified, absence of observed blockers can never become APTO.
    const decision = evaluateOperationalClearance({
      entityType,
      entityId,
      entityActive,
      evidenceComplete: false,
      documents: evidence,
      licenseExpiresAt,
      warningDays: 30,
    })

    return NextResponse.json({
      entityType,
      entityId,
      decision,
      evidenceBasis: 'current_canonical_documents_observed',
      coverageCertified: false,
      readOnly: true,
    })
  } catch (error) {
    console.error('[clearance] Failed to evaluate operational clearance', error)
    return NextResponse.json({ error: 'Failed to evaluate operational clearance' }, { status: 500 })
  }
}
