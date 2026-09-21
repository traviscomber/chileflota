/**
 * AI training feedback boundary.
 *
 * Feedback is a privileged document mutation because inaccurate feedback may
 * rewrite AI metadata. Authentication and assignment-aware authorization must
 * therefore complete before any service-role client is created or used.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyAuth } from '@/lib/auth-middleware'
import { canChangeDocumentStatus } from '@/lib/document-authorization'
import {
  buildFeedbackEvidence,
  feedbackDocumentType,
  parseAiFeedbackRequest,
} from '@/lib/ai-feedback-safety'

export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await verifyAuth(request)
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    let input
    try {
      input = parseAiFeedbackRequest(body)
    } catch {
      return NextResponse.json({ error: 'Invalid feedback request' }, { status: 400 })
    }

    const authorization = await canChangeDocumentStatus(
      user.id,
      input.documentId,
      user.role,
      user.organization_id,
      user.email,
      feedbackDocumentType(input.documentTable),
    )

    if (!authorization.allowed) {
      return NextResponse.json(
        { error: authorization.reason || 'No tienes permisos para registrar feedback de este documento' },
        { status: 403 },
      )
    }

    // Service-role access begins only after authentication, validation and
    // assignment-aware authorization have all passed.
    const supabase = createAdminClient()

    const { data: document, error: documentError } = await supabase
      .from(input.documentTable)
      .select('id, ai_document_type, ai_expiration_date, ai_confidence, ai_analyzed_at')
      .eq('id', input.documentId)
      .single()

    if (documentError || !document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    // Never trust client-supplied claims about what the AI predicted. Rebuild
    // the before-state from the authorized document row.
    const evidence = buildFeedbackEvidence(input, {
      ai_document_type: document.ai_document_type || null,
      ai_expiration_date: document.ai_expiration_date || null,
      ai_confidence: document.ai_confidence === null || document.ai_confidence === undefined
        ? null
        : Number(document.ai_confidence),
      ai_analyzed_at: document.ai_analyzed_at || null,
    })

    const { data: feedbackRecord, error: feedbackError } = await supabase
      .from('ai_model_feedback')
      .insert({
        document_id: input.documentId,
        document_table: input.documentTable,
        ai_detected_type: evidence.aiDetectedType,
        actual_document_type: evidence.actualDocumentType,
        ai_expiration_date: evidence.aiExpirationDate,
        actual_expiration_date: evidence.actualExpirationDate,
        confidence_score: evidence.confidenceScore,
        is_accurate: evidence.isAccurate,
        feedback_text: input.feedback || null,
        ejecutiva_email: user.email || user.id,
        created_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (feedbackError) {
      console.error('[v0] Feedback insert error:', feedbackError)
      if (feedbackError.code === 'PGRST204') {
        return NextResponse.json(
          { error: 'Feedback table not initialized yet. Contact admin.' },
          { status: 503 },
        )
      }
      throw feedbackError
    }

    // Preserve current product behaviour: a human correction updates the AI
    // metadata fields, but only on the already-authorized allowlisted table.
    if (!input.isAccurate) {
      const updatePayload: Record<string, string | null> = {}
      if (input.actualDocumentType !== undefined) {
        updatePayload.ai_document_type = evidence.actualDocumentType
      }
      if (input.actualExpirationDate !== undefined) {
        updatePayload.ai_expiration_date = evidence.actualExpirationDate
      }

      if (Object.keys(updatePayload).length > 0) {
        const { error: updateError } = await supabase
          .from(input.documentTable)
          .update(updatePayload)
          .eq('id', input.documentId)

        if (updateError) {
          console.error('[v0] Document feedback update error:', updateError)
          return NextResponse.json(
            { error: 'Feedback was recorded but corrected AI metadata could not be updated' },
            { status: 500 },
          )
        }
      }
    }

    return NextResponse.json({
      status: 'success',
      message: 'Feedback recorded successfully',
      feedbackId: feedbackRecord?.id,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[v0] Feedback error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error recording feedback' },
      { status: 500 },
    )
  }
}

/**
 * GET /api/company/ai-training/feedback
 * Retrieve feedback statistics for model improvement tracking.
 */
export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await verifyAuth(request)
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createAdminClient()
    const { data: feedbackData, error: feedbackError } = await supabase
      .from('ai_model_feedback')
      .select('is_accurate, ai_detected_type, actual_document_type, confidence_score')

    if (feedbackError) {
      console.error('[v0] Feedback query error:', feedbackError)
      return NextResponse.json({
        status: 'success',
        feedbackCount: 0,
        accuracyRate: 0,
        statistics: {},
        message: 'Feedback system ready. Start collecting data.',
      })
    }

    const totalFeedback = feedbackData?.length || 0
    const accurateFeedback = feedbackData?.filter((f: any) => f.is_accurate).length || 0
    const byType: Record<string, { total: number; accurate: number; accuracy: number }> = {}

    feedbackData?.forEach((f: any) => {
      const type = f.ai_detected_type || 'Unknown'
      if (!byType[type]) byType[type] = { total: 0, accurate: 0, accuracy: 0 }
      byType[type].total++
      if (f.is_accurate) byType[type].accurate++
    })

    Object.keys(byType).forEach((type) => {
      byType[type].accuracy = byType[type].total > 0
        ? byType[type].accurate / byType[type].total
        : 0
    })

    return NextResponse.json({
      status: 'success',
      feedbackCount: totalFeedback,
      accuracyRate: totalFeedback > 0 ? accurateFeedback / totalFeedback : 0,
      statistics: {
        byDocumentType: byType,
        totalFeedback,
        accurateFeedback,
        inaccurateFeedback: totalFeedback - accurateFeedback,
      },
    })
  } catch (error) {
    console.error('[v0] Feedback stats error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error fetching feedback' },
      { status: 500 },
    )
  }
}
