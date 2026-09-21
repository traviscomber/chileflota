/**
 * Document Status Service - Single Source of Truth
 * Centralizes all document status change logic
 * 
 * This service replaces duplicated logic across:
 * - /api/company/documents/[id]/status
 * - /api/documents/[id]/status
 * - use-document-management hook
 * - document-status-updater component
 */

import { createClient as createServerClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateDocumentStatusChangeAlert } from '@/lib/document-alerts-generator'

export type DocumentStatus = 'approved' | 'rejected' | 'pending'

export interface DocumentStatusChangeRequest {
  documentId: string
  newStatus: DocumentStatus
  reason?: string
  userId?: string
  userEmail?: string
  documentType?: 'conductor' | 'subcontractor'
  reviewContext?: {
    reviewerRole?: string
    coverageReview?: boolean
    assignedExecutiveId?: string | null
    assignedExecutiveName?: string | null
  }
}

export interface DocumentStatusChangeResult {
  success: boolean
  documentId: string
  previousStatus: string
  newStatus: string
  message: string
  error?: string
}

export interface DocumentStatusAuditLog {
  id: string
  document_id: string
  previous_status: string
  new_status: string
  changed_by: string
  reason?: string
  changed_at: string
  details?: Record<string, any>
}

/**
 * Validates if a status transition is allowed
 */
function isValidStatusTransition(from: string, to: DocumentStatus): boolean {
  // All transitions are allowed
  const validStatuses: DocumentStatus[] = ['approved', 'rejected', 'pending']
  return validStatuses.includes(to)
}

/**
 * Validates a status value and normalizes it
 * Returns the valid status or null if invalid
 */
export function validateStatus(status: any): DocumentStatus | null {
  const normalized = normalizeStatus(status)
  if (!normalized) return null
  return normalized
}

/**
 * Normalizes status input to standard format
 */
function normalizeStatus(input: string): DocumentStatus | null {
  const mapping: Record<string, DocumentStatus> = {
    'aprobado': 'approved',
    'rechazado': 'rejected',
    'pendiente': 'pending',
    'approved': 'approved',
    'rejected': 'rejected',
    'pending': 'pending',
  }
  
  const normalized = mapping[input?.toLowerCase()?.trim()]
  return normalized || null
}

/**
 * Main method: Change document status with full audit trail and notifications
 */
export async function changeDocumentStatus(
  request: DocumentStatusChangeRequest
): Promise<DocumentStatusChangeResult> {
  const { documentId, newStatus, reason, userId, userEmail, documentType = 'conductor', reviewContext } = request

  if (!documentId) {
    return { success: false, documentId, previousStatus: '', newStatus, message: 'Document ID is required', error: 'MISSING_DOCUMENT_ID' }
  }

  if (!newStatus) {
    return { success: false, documentId, previousStatus: '', newStatus, message: 'New status is required', error: 'MISSING_STATUS' }
  }

  try {
    const adminClient = await createAdminClient()

    // STEP 1: Fetch current document state
    // Determine which table to use based on document type
    const tableName = documentType === 'subcontractor' ? 'subcontractor_documents' : 'uploaded_documents'
    const statusColumn = documentType === 'subcontractor' ? 'status' : 'validation_status'

    console.log('[v0] changeDocumentStatus: Fetching from', tableName, 'with statusColumn:', statusColumn)

    const { data: documentBefore, error: fetchError } = await adminClient
      .from(tableName)
      .select('*')
      .eq('id', documentId)
      .single()

    if (fetchError || !documentBefore) {
      return {
        success: false,
        documentId,
        previousStatus: '',
        newStatus,
        message: 'Document not found',
        error: 'NOT_FOUND'
      }
    }

    const previousStatus = documentBefore[statusColumn] || 'pending'

    // STEP 2: Validate status transition
    if (!isValidStatusTransition(previousStatus, newStatus)) {
      return {
        success: false,
        documentId,
        previousStatus,
        newStatus,
        message: `Invalid transition from ${previousStatus} to ${newStatus}`,
        error: 'INVALID_TRANSITION'
      }
    }

    // STEP 3: Prepare update payload
    // Note: subcontractor_documents does not have updated_at column
    const updatePayload: any = {
      [statusColumn]: newStatus,
      ...(tableName === 'uploaded_documents' ? { updated_at: new Date().toISOString() } : {}),
    }

    // Store rejection reason if rejecting (both table schemas should support this)
    if (newStatus === 'rejected' && reason) {
      updatePayload.rejection_reason = reason
    }

    // Track who approved or rejected the document
    // Both tables use reviewed_by_ejecutiva and reviewed_at to track reviewer
    if ((newStatus === 'approved' || newStatus === 'rejected') && userId) {
      if (tableName === 'subcontractor_documents') {
        updatePayload.reviewed_by_ejecutiva = request.userEmail || userId
        updatePayload.reviewed_at = new Date().toISOString()
      } else {
        // uploaded_documents uses ejecutiva column to track reviewer
        updatePayload.ejecutiva = request.userEmail || userId
        updatePayload.validated_at = new Date().toISOString()
      }
      console.log('[v0] Document', newStatus, 'by user:', userId, 'Email:', request.userEmail)
    }

    // STEP 4: Update document status in database
    const { error: updateError, data: updatedDocument } = await adminClient
      .from(tableName)  // Use dynamic table name
      .update(updatePayload)
      .eq('id', documentId)
      .select()
      .single()

    if (updateError || !updatedDocument) {
      console.error('[v0] Status update failed:', updateError)
      return {
        success: false,
        documentId,
        previousStatus,
        newStatus,
        message: 'Failed to update document status',
        error: 'UPDATE_FAILED'
      }
    }

    // STEP 5: Verify update was persisted (handle DB replication lag)
    await new Promise(resolve => setTimeout(resolve, 100))
    const { data: verifyData } = await adminClient
      .from(tableName)  // Use the SAME table we updated, not always uploaded_documents
      .select(statusColumn)  // Use the correct status column based on table
      .eq('id', documentId)
      .single()

    if (verifyData && (verifyData as Record<string, any>)[statusColumn] !== newStatus) {
      console.warn('[v0] Status update verification failed, but update likely succeeded')
    }

    // STEP 6: Record ordinary status changes in the existing audit_log.
    // Coverage reviews are audited atomically by DB triggers from migration 027.
    if (!reviewContext?.coverageReview) {
      try {
        const { error: auditError } = await adminClient
          .from('audit_log')
          .insert({
            user_id: userId || null,
            action: 'document_status_change',
            table_name: tableName,
            record_id: documentId,
            old_values: {
              status: previousStatus,
            },
            new_values: {
              status: newStatus,
              reviewed_by: userEmail || userId || 'system',
              reviewer_role: reviewContext?.reviewerRole || null,
              coverage_review: false,
              assigned_executive_id: reviewContext?.assignedExecutiveId || null,
              assigned_executive_name: reviewContext?.assignedExecutiveName || null,
              reason: reason || null,
            },
            created_at: new Date().toISOString(),
          })

        if (auditError) {
          console.warn('[v0] Status audit insert failed:', auditError)
        }
      } catch (auditError) {
        console.warn('[v0] Status audit exception:', auditError)
      }
    }

    // STEP 7: Generate status change alerts (non-blocking)
    try {
      let entityName = documentType === 'subcontractor' ? 'Empresa' : 'Conductor'
      let documentTypeName = 'Documento'
      let transportistaId: string | null = documentBefore.transportista_id || null
      let conductorId = documentBefore.conductor_id || ''

      if (documentType === 'subcontractor') {
        transportistaId = documentBefore.subcontractor_id || transportistaId
        if (transportistaId) {
          const { data: transportista } = await adminClient
            .from('transportistas')
            .select('razon_social,nombre_fantasia')
            .eq('id', transportistaId)
            .maybeSingle()

          if (transportista) {
            entityName = transportista.nombre_fantasia || transportista.razon_social || entityName
          }
        }

        if (documentBefore.document_type_id) {
          const { data: docType } = await adminClient
            .from('subcontractor_document_types')
            .select('nombre,code')
            .eq('id', documentBefore.document_type_id)
            .maybeSingle()

          if (docType) documentTypeName = docType.nombre || docType.code || documentTypeName
        }
      } else {
        if (conductorId) {
          const { data: conductor } = await adminClient
            .from('conductores')
            .select('nombres,apellido_paterno,apellido_materno,transportista_id')
            .eq('id', conductorId)
            .maybeSingle()

          if (conductor) {
            entityName = [conductor.nombres, conductor.apellido_paterno, conductor.apellido_materno]
              .filter(Boolean).join(' ').trim() || entityName
            transportistaId = transportistaId || conductor.transportista_id || null
          }
        }

        if (documentBefore.document_type_id) {
          const { data: docType } = await adminClient
            .from('document_types')
            .select('name')
            .eq('id', documentBefore.document_type_id)
            .maybeSingle()

          if (docType?.name) documentTypeName = docType.name
        }
      }

      await generateDocumentStatusChangeAlert(
        documentId,
        documentTypeName,
        entityName,
        conductorId,
        newStatus,
        reason,
        {
          transportistaId,
          documentTable: tableName,
        },
      )
    } catch (alertError) {
      console.warn('[v0] Alert generation failed:', alertError)
      // Don't fail the request
    }

    // STEP 8: Emit orchestration event (non-blocking)
    try {
      const orchestratorEvent = {
        type: 'document_status_changed',
        module: 'documents',
        entity_id: documentId,
        payload: {
          document_id: documentId,
          previous_status: previousStatus,
          new_status: newStatus,
          reason: reason || '',
          timestamp: new Date().toISOString(),
          user_id: userId,
        }
      }
      console.log('[v0] Orchestrator event emitted:', orchestratorEvent)
    } catch (orchestratorError) {
      console.warn('[v0] Orchestrator emit failed:', orchestratorError)
    }

    return {
      success: true,
      documentId,
      previousStatus,
      newStatus,
      message: `Document status changed from ${previousStatus} to ${newStatus}`
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('[v0] changeDocumentStatus error:', msg)
    return {
      success: false,
      documentId,
      previousStatus: '',
      newStatus,
      message: 'Internal server error',
      error: msg
    }
  }
}

/**
 * Get current document status
 */
export async function getDocumentStatus(documentId: string): Promise<DocumentStatus | null> {
  try {
    const client = await createServerClient()
    const { data, error } = await client
      .from('uploaded_documents')
      .select('validation_status')
      .eq('id', documentId)
      .single()

    if (error || !data) return null
    return (data.validation_status as DocumentStatus) || 'pending'
  } catch (error) {
    console.error('[v0] getDocumentStatus error:', error)
    return null
  }
}

/**
 * Get audit history for a document
 */
export async function getDocumentStatusHistory(documentId: string): Promise<DocumentStatusAuditLog[]> {
  try {
    const adminClient = await createAdminClient()
    const { data, error } = await adminClient
      .from('document_status_audit_log')
      .select('*')
      .eq('document_id', documentId)
      .order('changed_at', { ascending: false })

    if (error) {
      console.warn('[v0] Audit history not available:', error.message)
      return []
    }
    return data || []
  } catch (error) {
    console.warn('[v0] getDocumentStatusHistory error:', error)
    return []
  }
}

/**
 * Batch get status for multiple documents
 */
export async function getDocumentsStatus(documentIds: string[]): Promise<Record<string, DocumentStatus>> {
  try {
    const client = await createServerClient()
    const { data, error } = await client
      .from('uploaded_documents')
      .select('id, validation_status')
      .in('id', documentIds)

    if (error || !data) return {}

    const result: Record<string, DocumentStatus> = {}
    for (const doc of data) {
      result[doc.id] = (doc.validation_status as DocumentStatus) || 'pending'
    }
    return result
  } catch (error) {
    console.error('[v0] getDocumentsStatus error:', error)
    return {}
  }
}
