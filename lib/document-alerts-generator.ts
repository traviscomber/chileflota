import { createAdminClient } from '@/lib/supabase/admin'

// Production-ready alert generation system using alerts_log table
// Auto-assigns alerts to the correct ejecutiva based on transportista/subcontratista relationships
// Alerts are fetched via /api/alerts and filtered by ejecutiva_nombre

/**
 * Lookup ejecutiva from various entity IDs
 */
async function lookupEjecutiva(params: {
  transportistaId?: string
  subcontratistaId?: string
  driverId?: string
  conductorId?: string
}): Promise<string | null> {
  try {
    const supabase = createAdminClient()

    // Lookup by transportista_id
    if (params.transportistaId) {
      const { data } = await supabase
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
      const { data } = await supabase
        .from('subcontractors')
        .select('ejecutiva')
        .eq('id', params.subcontratistaId)
        .maybeSingle()
      if (data) {
        return data.ejecutiva || null
      }
    }

    // Lookup by driver_id or conductor_id - find associated transportista
    const driverId = params.driverId || params.conductorId
    if (driverId) {
      // Try drivers table first
      let transportistaId: string | null = options?.transportistaId || null
      const { data: driver } = await supabase
        .from('drivers')
        .select('transportista_id')
        .eq('id', driverId)
        .maybeSingle()
      
      transportistaId = driver?.transportista_id || null

      // Try conductores table if not found
      if (!transportistaId) {
        const { data: conductor } = await supabase
          .from('conductores')
          .select('transportista_id')
          .eq('id', driverId)
          .maybeSingle()
        transportistaId = conductor?.transportista_id || null
      }

      if (transportistaId) {
        return await lookupEjecutiva({ transportistaId })
      }
    }

    return null
  } catch (error) {
    console.error('[v0] Error looking up ejecutiva:', error)
    return null
  }
}

/**
 * Generate alerts when a document is uploaded by conductor or client
 * Uses alerts_log table with ejecutiva auto-assignment
 */
export async function generateDocumentUploadAlerts(
  uploadedDocumentId: string,
  documentType: string,
  uploaderName: string,
  uploaderType: 'conductor' | 'client',
  uploaderId: string
) {
  try {
    const supabase = createAdminClient()

    console.log('[v0] generateDocumentUploadAlerts:', { uploadedDocumentId, documentType, uploaderName, uploaderType, uploaderId })

    let transportistaId: string | null = null
    if (uploaderType === 'conductor' && isUuid(uploaderId)) {
      const { data: conductor } = await supabase
        .from('conductores')
        .select('transportista_id')
        .eq('id', uploaderId)
        .maybeSingle()

      transportistaId = conductor?.transportista_id || null
    }

    const ejecutivaNombre = await lookupEjecutiva({
      transportistaId: transportistaId || undefined,
      conductorId: uploaderType === 'conductor' ? uploaderId : undefined,
    })

    const message = `${uploaderName} ha subido ${documentType}. Accion requerida: revisar y validar.`

    const { error: insertError } = await supabase
      .from('alerts_log')
      .insert({
        alert_type: 'info',
        title: `Nuevo Documento - ${uploaderName}`,
        description: message,
        message: message,
        priority: 'medium',
        entity_type: 'document',
        entity_id: uploadedDocumentId,
        entity_name: uploaderName,
        is_read: false,
        is_resolved: false,
        status: 'pendiente',
        ejecutiva_nombre: ejecutivaNombre,
        transportista_id: transportistaId,
        driver_id: uploaderType === 'conductor' ? uploaderId : null,
        document_id: uploadedDocumentId,
        document_type: documentType,
        action_url: `/dashboard/company/documentos/pendientes`,
        created_at: new Date().toISOString(),
        metadata: {
          source: 'document_upload',
          document_id: uploadedDocumentId,
          transportista_id: transportistaId,
          uploader_type: uploaderType,
          uploader_name: uploaderName,
          document_type: documentType,
        },
      })

    if (insertError) {
      console.error('[v0] Error inserting document upload alert:', insertError)
    } else {
      console.log(`[v0] Created document upload alert for ejecutiva: ${ejecutivaNombre}`)
    }
  } catch (error) {
    console.error('[v0] Error in generateDocumentUploadAlerts:', error)
  }
}

/**
 * Generate alerts when document status changes (approved/rejected/pending)
 */
export async function generateDocumentStatusChangeAlert(
  uploadedDocumentId: string,
  documentType: string,
  entityName: string,
  conductorId: string,
  newStatus: 'approved' | 'rejected' | 'pending',
  reason?: string,
  options?: {
    transportistaId?: string | null
    documentTable?: 'uploaded_documents' | 'subcontractor_documents'
  },
) {
  try {
    const supabase = createAdminClient()

    console.log('[v0] generateDocumentStatusChangeAlert:', { uploadedDocumentId, documentType, entityName, newStatus })

    // Generate unique correlation code (format: ALERT-YYYYMMDD-XXXXXX)
    const now = new Date()
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '')
    const randomCode = Math.random().toString(36).substring(2, 8).toUpperCase()
    const correlationCode = `ALERT-${dateStr}-${randomCode}`

    // Fetch conductor's transportista to find ejecutiva
    let transportistaName = 'Transportista Desconocido'
    let transportistaId: string | null = null
    let ejecutivaAsignada: string | null = null
    
    const normalizedConductorId = isUuid(conductorId) ? conductorId : null
    const { data: conductor } = normalizedConductorId && !transportistaId
      ? await supabase
          .from('conductores')
          .select('id, transportista_id')
          .eq('id', normalizedConductorId)
          .maybeSingle()
      : { data: null }

    if (conductor?.transportista_id) {
      transportistaId = conductor.transportista_id
      const { data: transportista } = await supabase
        .from('transportistas')
        .select('razon_social, nombre_fantasia, ejecutivo_nombre, ejecutiva')
        .eq('id', conductor.transportista_id)
        .maybeSingle()
      
      if (transportista) {
        transportistaName = transportista.nombre_fantasia || transportista.razon_social || 'Transportista Desconocido'
        ejecutivaAsignada = transportista.ejecutivo_nombre || transportista.ejecutiva || null
      }
    }

    // Build message and severity based on status
    let title = ''
    let message = ''
    let alertType: string = 'info'
    let priority = 'medium'

    if (newStatus === 'approved') {
      title = `Documento Aprobado - ${documentType}`
      message = `El documento ${documentType} de ${entityName} (${transportistaName}) fue aprobado. [${correlationCode}]`
      alertType = 'success'
      priority = 'low'
    } else if (newStatus === 'rejected') {
      title = `Documento Rechazado - ${documentType}`
      message = `El documento ${documentType} de ${entityName} (${transportistaName}) fue rechazado. Razon: ${reason || 'Sin especificar'}. [${correlationCode}]`
      alertType = 'error'
      priority = 'high'
    } else if (newStatus === 'pending') {
      title = `Documento en Revision - ${documentType}`
      message = `El documento ${documentType} de ${entityName} (${transportistaName}) ha sido retornado a revision. [${correlationCode}]`
      alertType = 'warning'
      priority = 'medium'
    }

    const { error: alertError } = await supabase
      .from('alerts_log')
      .insert({
        alert_type: alertType,
        title,
        description: message,
        message,
        priority,
        entity_type: 'document',
        entity_id: uploadedDocumentId,
        entity_name: entityName,
        is_read: false,
        is_resolved: newStatus === 'approved',
        status: newStatus === 'approved' ? 'resuelto' : 'pendiente',
        ejecutiva_nombre: ejecutivaAsignada,
        transportista_id: transportistaId,
        driver_id: normalizedConductorId,
        document_id: uploadedDocumentId,
        document_type: documentType,
        action_url: newStatus === 'rejected'
          ? '/dashboard/company/documentos/rechazados'
          : newStatus === 'pending'
            ? '/dashboard/company/documentos/pendientes'
            : '/dashboard/company/documentos/aprobados',
        created_at: new Date().toISOString(),
        metadata: {
          document_id: uploadedDocumentId,
          conductor_id: normalizedConductorId,
          entity_name: entityName,
          document_type: documentType,
          transportista_name: transportistaName,
          ejecutiva_asignada: ejecutivaAsignada,
          reason: reason || null,
          status: newStatus,
          source: 'document_status_change',
          document_table: options?.documentTable || 'uploaded_documents',
          correlation_code: correlationCode,
        },
      })

    if (alertError) {
      console.error('[v0] Error creating status change alert:', alertError)
    } else {
      console.log(`[v0] Created status change alert for ejecutiva: ${ejecutivaAsignada}, code: ${correlationCode}`)
    }
  } catch (error) {
    console.error('[v0] Error in generateDocumentStatusChangeAlert:', error)
  }
}

/**
 * Generate alerts based on AI analysis results
 * Creates expiration warnings if fecha de vencimiento is detected
 */
export async function generateAIAnalysisAlerts(params: {
  documentId: string
  documentTable: 'subcontractor_documents' | 'uploaded_documents'
  transportistaId?: string
  conductorId?: string
  documentType: string
  aiExpirationDate: string | null
  aiConfidence: number
  fileName: string
}) {
  try {
    const supabase = createAdminClient()
    const { documentId, documentTable, transportistaId, conductorId, documentType, aiExpirationDate, aiConfidence, fileName } = params

    console.log('[v0] generateAIAnalysisAlerts:', params)

    // Lookup ejecutiva
    const ejecutivaNombre = await lookupEjecutiva({
      transportistaId,
      conductorId,
    })

    // AI-extracted expiration dates are evidence candidates, not canonical deadlines.
    // Do not create operational alerts or overwrite expires_at from this signal.
    // Operational expiration alerts must come from validated canonical fields
    // (for example uploaded_documents.expiration_date via generateExpirationAlerts)
    // or from the requirement periodicity engine.
    if (aiExpirationDate) {
      console.log('[v0] AI expiration candidate kept non-operational:', {
        documentId,
        documentTable,
        aiExpirationDate,
        aiConfidence,
      })
    }

    // Also create a general "analysis complete" info alert
    const { error: analysisAlertError } = await supabase
      .from('alerts_log')
      .insert({
        alert_type: 'success',
        title: `Analisis IA Completado - ${documentType}`,
        description: `El documento "${fileName}" fue analizado con ${Math.round(aiConfidence * 100)}% de confianza. ${aiExpirationDate ? `Fecha de vencimiento detectada: ${new Date(aiExpirationDate).toLocaleDateString('es-CL')}` : 'No se detecto fecha de vencimiento.'}`,
        message: `Analisis IA completado para ${fileName}`,
        priority: 'low',
        entity_type: 'document',
        entity_id: documentId,
        entity_name: fileName,
        is_read: false,
        is_resolved: true,
        status: 'completado',
        ejecutiva_nombre: ejecutivaNombre,
        transportista_id: transportistaId || null,
        driver_id: conductorId || null,
        document_id: documentId,
        document_type: documentType,
        action_url: `/dashboard/company/documentos/pendientes`,
        created_at: new Date().toISOString(),
        metadata: {
          document_id: documentId,
          document_table: documentTable,
          ai_confidence: aiConfidence,
          ai_expiration_date: aiExpirationDate,
          source: 'ai_analysis',
        },
      })

    if (analysisAlertError) {
      console.error('[v0] Error creating analysis complete alert:', analysisAlertError)
    }

  } catch (error) {
    console.error('[v0] Error in generateAIAnalysisAlerts:', error)
  }
}

/**
 * Generate expiration alerts for documents close to expiration date
 */
export async function generateExpirationAlerts() {
  try {
    const supabase = createAdminClient()
    const today = new Date()
    const in7days = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)

    // Only canonical, approved, current documents can create operational expiry alerts.
    const { data: expiringDocs } = await supabase
      .from('uploaded_documents')
      .select('id, conductor_id, transportista_id, document_type_id, expiration_date, document_types(name)')
      .eq('is_current', true)
      .eq('validation_status', 'approved')
      .lt('expiration_date', in7days.toISOString())
      .gt('expiration_date', today.toISOString())
      .is('last_expiration_alert_sent', null)

    if (!expiringDocs || expiringDocs.length === 0) {
      console.log('[v0] No canonical expiring documents found')
      return
    }

    const conductorIds = Array.from(new Set(expiringDocs.map((doc: any) => doc.conductor_id).filter(Boolean)))
    const conductorCompanyMap = new Map<string, string>()
    if (conductorIds.length > 0) {
      const { data: conductores = [] } = await supabase
        .from('conductores')
        .select('id, transportista_id')
        .in('id', conductorIds)

      for (const conductor of conductores || []) {
        if (conductor.id && conductor.transportista_id) {
          conductorCompanyMap.set(conductor.id, conductor.transportista_id)
        }
      }
    }

    const candidateCompanyIds = Array.from(new Set(
      expiringDocs
        .map((doc: any) => doc.transportista_id || conductorCompanyMap.get(doc.conductor_id))
        .filter(Boolean),
    ))

    const activeCompanyIds = new Set<string>()
    if (candidateCompanyIds.length > 0) {
      const { data: activeCompanies = [] } = await supabase
        .from('transportistas')
        .select('id')
        .in('id', candidateCompanyIds)
        .eq('is_active', true)

      for (const company of activeCompanies || []) {
        if (company.id) activeCompanyIds.add(company.id)
      }
    }

    const relevantDocs = expiringDocs.filter((doc: any) => {
      const transportistaId = doc.transportista_id || conductorCompanyMap.get(doc.conductor_id)
      return Boolean(transportistaId && activeCompanyIds.has(transportistaId))
    })

    const alertsToCreate = (await Promise.all(
      relevantDocs.map(async (doc: any) => {
        const transportistaId = doc.transportista_id || conductorCompanyMap.get(doc.conductor_id)
        if (!transportistaId) return null

        const ejecutivaNombre = await lookupEjecutiva({ transportistaId })
        const docName = doc.document_types?.name || 'Documento'
        const expDate = new Date(doc.expiration_date).toLocaleDateString('es-CL')
        const message = `El documento ${docName} vence el ${expDate}`

        return {
          alert_type: 'warning',
          title: `Documento por Vencer - ${docName}`,
          description: message,
          message,
          priority: 'high',
          entity_type: 'document',
          entity_id: doc.id,
          is_read: false,
          is_resolved: false,
          status: 'pendiente',
          ejecutiva_nombre: ejecutivaNombre,
          transportista_id: transportistaId,
          driver_id: doc.conductor_id,
          document_id: doc.id,
          document_type: docName,
          action_url: '/dashboard/company/documentos/renovar',
          created_at: new Date().toISOString(),
          metadata: {
            source: 'expiration_cron',
            canonical_source: 'uploaded_documents.expiration_date',
            document_id: doc.id,
            conductor_id: doc.conductor_id,
            transportista_id: transportistaId,
            expiration_date: doc.expiration_date,
          },
        }
      })
    )).filter(Boolean)

    if (alertsToCreate.length > 0) {
      const { error: insertError } = await supabase
        .from('alerts_log')
        .insert(alertsToCreate)

      if (!insertError) {
        // Update last alert sent timestamp
        await supabase
          .from('uploaded_documents')
          .update({ last_expiration_alert_sent: new Date().toISOString() })
          .in('id', relevantDocs.map((d: any) => d.id))

        console.log(`[v0] Created ${alertsToCreate.length} expiration alerts`)
      } else {
        console.error('[v0] Error inserting expiration alerts:', insertError)
      }
    }
  } catch (error) {
    console.error('[v0] Error in generateExpirationAlerts:', error)
  }
}
function isUuid(value?: string | null): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
}
