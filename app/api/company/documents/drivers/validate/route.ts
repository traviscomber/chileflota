import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { authorizeInternalDocumentRequest, DOCUMENT_WRITE_ROLES } from '@/lib/document-route-auth'

export async function POST(request: NextRequest) {
  try {
    const session = await authorizeInternalDocumentRequest(request, DOCUMENT_WRITE_ROLES)
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { file_url, document_type, driver_rut } = await request.json()

    if (!file_url) {
      return NextResponse.json({ error: 'File URL required' }, { status: 400 })
    }

    console.log('[v0] Starting document validation:', { file_url, document_type })

    const openaiApiKey = process.env.OPENAI_API_KEY
    if (!openaiApiKey) {
      return NextResponse.json({ error: 'OPENAI_API_KEY not configured' }, { status: 500 })
    }

    // Call OpenAI GPT-4 Vision directly
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4-vision-preview',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Analyze this ${document_type} document image and extract the data. Respond with JSON format with these fields:
{
  "is_valid": boolean,
  "document_type": "license|id|passport|other",
  "extracted_data": {
    "full_name": string or null,
    "id_number": string or null,
    "expiration_date": string or null,
    "issue_date": string or null
  },
  "confidence": number between 0-1,
  "issues": string array
}

Check for:
1. Is the document clear and readable?
2. What type of document is it?
3. Extract: full name, ID number, expiration date, issue date
4. Rate confidence 0-1
5. List any issues (blurry, expired, damaged, etc)`,
              },
              {
                type: 'image_url',
                image_url: {
                  url: file_url,
                },
              },
            ],
          },
        ],
        max_tokens: 1024,
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      console.error('[v0] OpenAI API error:', error)
      return NextResponse.json(
        { error: 'OpenAI API error', details: error.error?.message },
        { status: 500 }
      )
    }

    const result = await response.json()
    console.log('[v0] OpenAI response:', result)

    // Parse the response
    let validationResult
    try {
      const content = result.choices[0]?.message?.content
      // Extract JSON from the response
      const jsonMatch = content?.match(/\{[\s\S]*\}/)
      validationResult = jsonMatch ? JSON.parse(jsonMatch[0]) : null
    } catch (parseError) {
      console.error('[v0] Error parsing OpenAI response:', parseError)
      return NextResponse.json(
        { error: 'Failed to parse validation response' },
        { status: 500 }
      )
    }

    if (!validationResult) {
      return NextResponse.json(
        { error: 'Invalid validation response format' },
        { status: 500 }
      )
    }

    console.log('[v0] Document validation result:', validationResult)

    // Save validation result
    const adminClient = createAdminClient()
    const validationData = {
      validated_at: new Date().toISOString(),
      validation_result: validationResult,
      driver_rut,
    }

    console.log('[v0] Validation complete for driver:', driver_rut)

    return NextResponse.json({
      success: true,
      validation: validationResult,
      extracted_data: validationResult.extracted_data,
    })
  } catch (error) {
    console.error('[v0] Validation error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Validation failed' },
      { status: 500 }
    )
  }
}
