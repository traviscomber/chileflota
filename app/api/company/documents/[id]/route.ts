import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  authorizeInternalDocumentRequest,
  DOCUMENT_READ_ROLES,
  DOCUMENT_WRITE_ROLES,
} from '@/lib/document-route-auth'

interface RouteParams {
  params: {
    id: string
  }
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await authorizeInternalDocumentRequest(request, DOCUMENT_READ_ROLES)
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const adminClient = createAdminClient()

    const { data: document, error } = await adminClient
      .from('documents')
      .select('*')
      .eq('id', params.id)
      .single()

    if (error || !document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    return NextResponse.json(document)
  } catch (error) {
    console.error('[v0] Error getting document:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error fetching document' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await authorizeInternalDocumentRequest(request, DOCUMENT_WRITE_ROLES)
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const adminClient = createAdminClient()

    // Get document info first
    const { data: document, error: fetchError } = await adminClient
      .from('documents')
      .select('storage_path')
      .eq('id', params.id)
      .single()

    if (fetchError || !document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    // Delete from storage if path exists
    if (document.storage_path) {
      await adminClient.storage
        .from('documents')
        .remove([document.storage_path])
    }

    // Delete from database
    const { error: deleteError } = await adminClient
      .from('documents')
      .delete()
      .eq('id', params.id)

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: 'Document deleted' })
  } catch (error) {
    console.error('[v0] Error deleting document:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error deleting document' },
      { status: 500 }
    )
  }
}
