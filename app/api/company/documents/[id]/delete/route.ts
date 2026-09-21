import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { authorizeInternalDocumentRequest, DOCUMENT_WRITE_ROLES } from '@/lib/document-route-auth'

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await authorizeInternalDocumentRequest(request, DOCUMENT_WRITE_ROLES)
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const documentId = params.id
    const adminClient = createAdminClient()

    // 1. First fetch the document to get the storage path before deleting
    const { data: docData } = await adminClient
      .from('driver_documents')
      .select('file_url')
      .eq('id', documentId)
      .single()

    // 2. Delete from database
    const { error: dbError } = await adminClient
      .from('driver_documents')
      .delete()
      .eq('id', documentId)

    if (dbError) {
      console.error('[v0] DB delete error:', dbError)
    }

    // 3. Delete from storage using the file_url we fetched before deletion
    if (docData?.file_url) {
      const storagePathMatch = docData.file_url.match(/\/storage\/v1\/object\/public\/documents\/(.+)/)
      if (storagePathMatch) {
        const storagePath = storagePathMatch[1]
        await adminClient.storage.from('documents').remove([storagePath])
      }
    }

    return NextResponse.json({
      success: true,
      document_id: documentId,
      message: 'Document deleted successfully'
    })
  } catch (error) {
    console.error('[v0] Error in DELETE /api/company/documents/[id]/delete:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Server error' },
      { status: 500 }
    )
  }
}
