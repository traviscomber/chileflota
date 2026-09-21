'use server'

import { createAdminClient } from '@/lib/supabase/admin'

export interface AlertEvent {
  type: 'warning' | 'error' | 'success' | 'info'
  title: string
  description: string
  entityType?: 'driver' | 'subcontractor' | 'document' | 'system' | 'transportista'
  entityId?: string
  entityName?: string
  actionUrl?: string
  // Production-ready: ejecutiva assignment
  ejecutivaNombre?: string
  transportistaId?: string
  subcontratistaId?: string
  driverId?: string
  documentId?: string
  documentType?: string
  source?: string
}

/**
 * Lookup ejecutiva from transportista_id, subcontratista_id, or driver_id
 * Returns the assigned ejecutiva's name for proper alert routing
 */
async function resolveTransportistaId(params: { transportistaId?: string; subcontratistaId?: string; driverId?: string }): Promise<string | null> {
  try {
    const adminClient = await createAdminClient()
    if (params.transportistaId) return params.transportistaId

    if (params.subcontratistaId) {
      const { data: transportista } = await adminClient
        .from('transportistas')
        .select('id')
        .eq('id', params.subcontratistaId)
        .maybeSingle()
      if (transportista?.id) return transportista.id
    }

    if (params.driverId) {
      const { data: conductor } = await adminClient
        .from('conductores')
        .select('transportista_id')
        .eq('id', params.driverId)
        .maybeSingle()
      if (conductor?.transportista_id) return conductor.transportista_id

      const { data: driver } = await adminClient
        .from('drivers')
        .select('transportista_id')
        .eq('id', params.driverId)
        .maybeSingle()
      if (driver?.transportista_id) return driver.transportista_id
    }

    return null
  } catch (error) {
    console.error('[v0] Error resolving transportista for alert:', error)
    return null
  }
}

async function lookupEjecutiva(params: {
  transportistaId?: string
  subcontratistaId?: string
  driverId?: string
}): Promise<string | null> {
  try {
    const adminClient = await createAdminClient()

    // Lookup by transportista_id
    if (params.transportistaId) {
      const { data } = await adminClient
        .from('transportistas')
        .select('ejecutivo_nombre, ejecutiva')
        .eq('id', params.transportistaId)
        .maybeSingle()
      
      if (data) {
        return data.ejecutivo_nombre || data.ejecutiva || null
      }
    }

    // Lookup by subcontratista_id
    if (params.subcontratistaId) {
      const { data } = await adminClient
        .from('subcontractors')
        .select('ejecutiva')
        .eq('id', params.subcontratistaId)
        .maybeSingle()
      
      if (data) {
        return data.ejecutiva || null
      }
    }

    // Lookup by driver_id - find associated transportista
    if (params.driverId) {
      const { data } = await adminClient
        .from('drivers')
        .select('transportista_id')
        .eq('id', params.driverId)
        .maybeSingle()
      
      if (data?.transportista_id) {
        return await lookupEjecutiva({ transportistaId: data.transportista_id })
      }
    }

    return null
  } catch (error) {
    console.error('[v0] Error looking up ejecutiva:', error)
    return null
  }
}

/**
 * Registra un evento de alerta en el sistema con asignación automática a ejecutiva
 */
export async function logAlert(event: AlertEvent) {
  try {
    console.log('[v0] Alert triggered:', {
      type: event.type,
      title: event.title,
      entity: event.entityType,
      timestamp: new Date().toISOString(),
    })

    const adminClient = await createAdminClient()
    
    const resolvedTransportistaId = await resolveTransportistaId({
      transportistaId: event.transportistaId,
      subcontratistaId: event.subcontratistaId,
      driverId: event.driverId,
    })

    // Auto-lookup ejecutiva if not provided
    let ejecutivaNombre = event.ejecutivaNombre
    if (!ejecutivaNombre) {
      const lookedUp = await lookupEjecutiva({
        transportistaId: resolvedTransportistaId || undefined,
        subcontratistaId: event.subcontratistaId,
        driverId: event.driverId,
      })
      ejecutivaNombre = lookedUp || undefined
      console.log('[v0] Ejecutiva looked up:', ejecutivaNombre)
    }
    
    // Map alert type to priority
    const priorityMap: Record<string, string> = {
      'error': 'high',
      'warning': 'medium',
      'success': 'low',
      'info': 'low'
    }

    const message = event.description || event.title

    const alertData: any = {
      alert_type: event.type,
      title: event.title,
      description: message,
      message: message,
      entity_type: event.entityType || 'general',
      entity_id: event.entityId || null,
      entity_name: event.entityName || null,
      priority: priorityMap[event.type] || 'medium',
      action_url: event.actionUrl || null,
      is_read: false,
      is_resolved: false,
      status: 'pendiente',
      ejecutiva_nombre: ejecutivaNombre || null,
      transportista_id: resolvedTransportistaId || null,
      driver_id: event.driverId || null,
      document_id: event.documentId || null,
      document_type: event.documentType || null,
      metadata: {
        entityType: event.entityType,
        entityId: event.entityId,
        source: event.source || null,
        entityName: event.entityName,
      },
    }

    console.log('[v0] Saving alert with ejecutiva:', ejecutivaNombre)

    const { data, error } = await adminClient
      .from('alerts_log')
      .insert([alertData])
      .select()

    if (error) {
      console.error('[v0] Error saving alert to database:', error)
      return {
        success: false,
        error: error.message,
      }
    }

    console.log('[v0] Alert saved successfully for ejecutiva:', ejecutivaNombre)

    return {
      success: true,
      event,
      timestamp: new Date(),
      savedAlert: data?.[0],
      ejecutivaNombre,
    }
  } catch (error) {
    console.error('[v0] Exception in logAlert:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Dispara una alerta cuando un documento es subido por un conductor
 */
export async function triggerDocumentUploadedAlert(
  driverId: string, 
  fileName: string, 
  driverName?: string,
  documentType?: string,
  documentId?: string
) {
  return logAlert({
    type: 'info',
    title: 'Nuevo documento subido',
    description: `${driverName || 'Un conductor'} ha subido un nuevo documento: ${fileName}`,
    entityType: 'document',
    entityId: driverId,
    entityName: driverName,
    actionUrl: `/dashboard/company/conductores?search=${encodeURIComponent(driverName || '')}`,
    driverId,
    documentId,
    documentType,
    source: 'document_upload',
  })
}

/**
 * Dispara una alerta cuando un documento es aprobado
 */
export async function triggerDocumentApprovedAlert(
  driverId: string, 
  documentType: string, 
  driverName?: string,
  documentId?: string
) {
  return logAlert({
    type: 'success',
    title: 'Documento aprobado',
    description: `El documento "${documentType}" de ${driverName || 'un conductor'} ha sido aprobado correctamente`,
    entityType: 'document',
    entityId: driverId,
    entityName: driverName,
    actionUrl: `/dashboard/company/conductores?search=${encodeURIComponent(driverName || '')}`,
    driverId,
    documentId,
    documentType,
  })
}

/**
 * Dispara una alerta cuando un documento es rechazado
 */
export async function triggerDocumentRejectedAlert(
  driverId: string, 
  documentType: string, 
  reason: string, 
  driverName?: string,
  documentId?: string
) {
  return logAlert({
    type: 'error',
    title: 'Documento rechazado',
    description: `El documento "${documentType}" de ${driverName || 'un conductor'} fue rechazado. Razon: ${reason}`,
    entityType: 'document',
    entityId: driverId,
    entityName: driverName,
    actionUrl: `/dashboard/company/conductores?search=${encodeURIComponent(driverName || '')}`,
    driverId,
    documentId,
    documentType,
  })
}

/**
 * Dispara una alerta cuando esta proximo a vencer un documento
 */
export async function triggerDocumentExpiringAlert(
  documentType: string, 
  daysUntilExpiry: number,
  options?: {
    driverId?: string
    transportistaId?: string
    subcontratistaId?: string
    documentId?: string
    entityName?: string
  }
) {
  return logAlert({
    type: daysUntilExpiry <= 7 ? 'error' : 'warning',
    title: `${documentType} proximo a vencer (${daysUntilExpiry} dias)`,
    description: `Hay documentos de tipo "${documentType}" que vencen en ${daysUntilExpiry} dias. Requiere atencion urgente.`,
    entityType: 'document',
    entityName: options?.entityName,
    actionUrl: `/dashboard/company/reportes`,
    driverId: options?.driverId,
    transportistaId: options?.transportistaId,
    subcontratistaId: options?.subcontratistaId,
    documentId: options?.documentId,
    documentType,
  })
}

/**
 * Dispara una alerta cuando un conductor es agregado al sistema
 */
export async function triggerDriverAddedAlert(
  driverName: string, 
  driverId: string,
  transportistaId?: string
) {
  return logAlert({
    type: 'info',
    title: 'Nuevo conductor agregado',
    description: `${driverName} ha sido agregado al sistema como nuevo conductor`,
    entityType: 'driver',
    entityId: driverId,
    entityName: driverName,
    actionUrl: `/dashboard/company/conductores?search=${encodeURIComponent(driverName)}`,
    driverId,
    transportistaId,
  })
}

/**
 * Dispara una alerta cuando un documento de subcontratista es subido
 */
export async function triggerSubcontractorDocumentUploadedAlert(
  subcontractorId: string, 
  fileName: string, 
  subcontractorName?: string,
  documentType?: string,
  documentId?: string
) {
  return logAlert({
    type: 'info',
    title: 'Documento de subcontratista subido',
    description: `${subcontractorName || 'Un subcontratista'} ha subido un nuevo documento: ${fileName}`,
    entityType: 'document',
    entityId: subcontractorId,
    entityName: subcontractorName,
    actionUrl: `/dashboard/company/subcontratistas?search=${encodeURIComponent(subcontractorName || '')}`,
    transportistaId: subcontractorId,
    documentId,
    documentType,
    source: 'document_upload',
  })
}

/**
 * Dispara una alerta de error del sistema
 */
export async function triggerSystemAlert(title: string, description: string) {
  return logAlert({
    type: 'error',
    title,
    description,
    entityType: 'system',
  })
}

/**
 * Dispara una alerta cuando el estado de un documento cambia
 */
export async function triggerDocumentStatusAlert(
  documentId: string,
  status: 'approved' | 'rejected' | 'expired',
  documentName: string,
  reason?: string
) {
  if (status === 'approved') {
    return triggerDocumentApprovedAlert(documentId, documentName)
  } else if (status === 'rejected') {
    return triggerDocumentRejectedAlert(documentId, documentName, reason || 'Sin especificar')
  } else if (status === 'expired') {
    return logAlert({
      type: 'warning',
      title: 'Documento vencido',
      description: `El documento "${documentName}" ha vencido y requiere renovacion`,
      entityType: 'document',
      entityId: documentId,
      actionUrl: `/dashboard/company/documentos`,
      documentId,
    })
  }
}
