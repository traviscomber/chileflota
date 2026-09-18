export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { changeDocumentStatus } from '@/lib/document-status-service'
import { verifyAuth } from '@/lib/auth-middleware'
import { validateChangeStatusRequest } from '@/lib/validation/schemas'
import { canChangeDocumentStatus } from '@/lib/document-authorization'
import { emitOperationalEvent } from '@/lib/operational-telemetry'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Verify authentication
    console.log('[v0] STATUS ENDPOINT - Start PATCH request for document:', params.id)
    const { user, error: authError } = await verifyAuth(request)
    
    console.log('[v0] STATUS ENDPOINT - Auth result:', { 
      authError, 
      userId: user?.id,
      email: user?.email,
      role: user?.role,
      org_id: user?.organization_id 
    })

    if (authError || !user) {
      console.log('[v0] STATUS ENDPOINT - Auth failed:', authError)
      return NextResponse.json({ error: 'Unauthorized', details: authError }, { status: 401 })
    }

    const body = await request.json()
    const documentId = params.id

    console.log('[v0] STATUS ENDPOINT - Request body:', { documentId, newStatus: body.status, hasReason: !!body.reason })

    // Validate request body (accepts both Spanish and English status values)
    const validation = validateChangeStatusRequest(body)
    if (!validation.valid) {
      console.log('[v0] STATUS ENDPOINT - Validation failed:', validation.errors)
      return NextResponse.json({ 
        error: 'Invalid request', 
        details: validation.errors 
      }, { status: 400 })
    }
    
    // Use the normalized status (English) for processing
    const normalizedStatus = validation.normalizedStatus!
    console.log('[v0] STATUS ENDPOINT - Normalized status:', { original: body.status, normalized: normalizedStatus })

    // Check authorization - verify user can change this document's status
    console.log('[v0] STATUS ENDPOINT - Calling canChangeDocumentStatus...')
    const authResult = await canChangeDocumentStatus(
      user.id,
      documentId,
      user.role,
      user.organization_id,
      user.email,
      body.documentType || 'conductor'
    )

    console.log('[v0] STATUS ENDPOINT - Authorization result:', { 
      allowed: authResult.allowed, 
      reason: authResult.reason 
    })

    if (!authResult.allowed) {
      console.log('[v0] STATUS ENDPOINT - AUTHORIZATION DENIED:', authResult.reason)
      return NextResponse.json(
        { 
          error: authResult.reason || 'No tienes permisos para cambiar este documento',
          code: 'AUTHORIZATION_DENIED'
        },
        { status: 403 }
      )
    }

    console.log('[v0] STATUS ENDPOINT - Calling changeDocumentStatus...')

    // Use the centralized status change service with normalized English status
    const result = await changeDocumentStatus({
      documentId,
      newStatus: normalizedStatus as 'approved' | 'rejected' | 'pending',
      reason: body.reason,
      userId: user.id,
      userEmail: user.email,
      documentType: body.documentType || 'conductor'
    })

    if (!result.success) {
      console.log('[v0] STATUS ENDPOINT - Status change failed:', result.message)
      return NextResponse.json({ error: result.message }, { status: 400 })
    }

    // Product telemetry is independent from the audit trail and fail-open.
    // The emitter is a no-op unless OPERATIONAL_TELEMETRY_ENABLED=true.
    if (result.newStatus === 'approved' || result.newStatus === 'rejected') {
      await emitOperationalEvent({
        eventName: result.newStatus === 'approved' ? 'document_approved' : 'document_rejected',
        actorProfileId: user.id,
        actorRole: user.role,
        entityType: 'document',
        entityId: documentId,
        source: 'company.document_status',
        metadata: {
          document_type: body.documentType || 'conductor',
          previous_status: result.previousStatus,
          new_status: result.newStatus,
        },
      })
    }

    console.log('[v0] STATUS ENDPOINT - Status change successful:', { documentId, newStatus: result.newStatus })
    return NextResponse.json({
      success: true,
      document_id: documentId,
      status: result.newStatus,
      previous_status: result.previousStatus,
      message: result.message,
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('[v0] PATCH /status error:', msg, 'Stack:', error instanceof Error ? error.stack : '')
    return NextResponse.json({ error: msg, code: 'INTERNAL_ERROR' }, { status: 500 })
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, error: authError } = await verifyAuth(request)
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Return document ID and placeholder - actual status is fetched client-side
    return NextResponse.json({ 
      document_id: params.id, 
      status_endpoint: `available`
    })
  } catch (error) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
