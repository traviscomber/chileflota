import OpenAI from 'openai'
import { z } from 'zod'
import { classifyAIAvailabilityError } from '@/lib/ai-dependency-availability'

const DocumentExtractionSchema = z.object({
  documentType: z.string(),
  expirationDate: z.string().nullable(),
  issuanceDate: z.string().nullable(),
  documentNumber: z.string().nullable(),
  extractedText: z.string(),
  confidence: z.number().min(0).max(1),
  warnings: z.array(z.string()),
})

export type DocumentExtraction = z.infer<typeof DocumentExtractionSchema>

const JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['documentType', 'expirationDate', 'issuanceDate', 'documentNumber', 'extractedText', 'confidence', 'warnings'],
  properties: {
    documentType: { type: 'string' },
    expirationDate: { anyOf: [{ type: 'string' }, { type: 'null' }] },
    issuanceDate: { anyOf: [{ type: 'string' }, { type: 'null' }] },
    documentNumber: { anyOf: [{ type: 'string' }, { type: 'null' }] },
    extractedText: { type: 'string' },
    confidence: { type: 'number', minimum: 0, maximum: 1 },
    warnings: { type: 'array', items: { type: 'string' } },
  },
} as const

function getOpenAI(): OpenAI {
  if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY environment variable is not set')
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
}

function parseExtraction(content: string): DocumentExtraction {
  const normalized = content
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()

  try {
    return DocumentExtractionSchema.parse(JSON.parse(normalized))
  } catch {
    const start = normalized.indexOf('{')
    const end = normalized.lastIndexOf('}')
    if (start < 0 || end <= start) throw new Error('Could not extract JSON from response')
    return DocumentExtractionSchema.parse(JSON.parse(normalized.slice(start, end + 1)))
  }
}

async function extractFromTextChat(text: string, expectedType: string): Promise<DocumentExtraction> {
  const openai = getOpenAI()
  const truncatedText = text.length > 12000 ? `${text.substring(0, 12000)}...` : text
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: `Eres un experto en documentos chilenos. Extrae datos verificables. Tipo esperado: ${expectedType}. No inventes datos ausentes.`,
      },
      {
        role: 'user',
        content: `Analiza este documento y devuelve la extracción estructurada.\n\n${truncatedText}`,
      },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: { name: 'document_extraction', strict: true, schema: JSON_SCHEMA },
    },
    max_tokens: 1200,
    temperature: 0,
  })
  const content = response.choices[0]?.message?.content
  if (!content) throw new Error('No response from OpenAI')
  return parseExtraction(content)
}

async function extractFromTextResponses(text: string, expectedType: string): Promise<DocumentExtraction> {
  const openai = getOpenAI()
  const truncatedText = text.length > 16000 ? `${text.substring(0, 16000)}...` : text
  const response = await (openai.responses as any).create({
    model: 'gpt-4o-mini',
    input: [{
      role: 'user',
      content: [{
        type: 'input_text',
        text: `Extrae datos verificables de este documento chileno. Tipo esperado: ${expectedType}. No inventes datos ausentes.\n\n${truncatedText}`,
      }],
    }],
    text: {
      format: { type: 'json_schema', name: 'document_extraction', strict: true, schema: JSON_SCHEMA },
    },
    max_output_tokens: 1200,
  })
  const content = response.output_text
  if (!content) throw new Error('No structured response from OpenAI Responses API')
  return parseExtraction(content)
}

export async function extractDocumentFromText(text: string, expectedType = 'documento'): Promise<DocumentExtraction> {
  let lastError: unknown
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      return await extractFromTextChat(text, expectedType)
    } catch (error) {
      lastError = error
      const availability = classifyAIAvailabilityError(error)
      if (availability.unavailable && availability.retryable === false) throw error
      console.warn(`[v0] Structured chat extraction attempt ${attempt} failed`, error)
    }
  }

  try {
    return await extractFromTextResponses(text, expectedType)
  } catch (error) {
    lastError = error
    console.warn('[v0] Structured Responses API fallback failed', error)
  }

  throw lastError instanceof Error ? lastError : new Error('Text extraction failed')
}

export async function extractDocumentFromPdfBuffer(
  pdfBuffer: ArrayBuffer | Uint8Array,
  expectedType = 'documento',
): Promise<DocumentExtraction> {
  const bytes = pdfBuffer instanceof Uint8Array ? pdfBuffer : new Uint8Array(pdfBuffer)
  if (bytes.byteLength === 0) throw new Error('Document PDF is empty')

  const openai = getOpenAI()
  const fileData = `data:application/pdf;base64,${Buffer.from(bytes).toString('base64')}`

  let lastError: unknown
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await (openai.responses as any).create({
        model: 'gpt-4o-mini',
        input: [{
          role: 'user',
          content: [
            { type: 'input_file', filename: 'document.pdf', file_data: fileData },
            {
              type: 'input_text',
              text: `Lee visualmente este PDF escaneado. Extrae datos verificables del documento chileno. Tipo esperado: ${expectedType}. No inventes datos ausentes.`,
            },
          ],
        }],
        text: {
          format: { type: 'json_schema', name: 'document_extraction', strict: true, schema: JSON_SCHEMA },
        },
        max_output_tokens: 1200,
      })
      const content = response.output_text
      if (!content) throw new Error('No OCR response from OpenAI')
      const extraction = parseExtraction(content)
      return {
        ...extraction,
        warnings: Array.from(new Set([...extraction.warnings, 'ocr_fallback_used'])),
      }
    } catch (error) {
      lastError = error
      const availability = classifyAIAvailabilityError(error)
      if (availability.unavailable && availability.retryable === false) throw error
      console.warn(`[v0] PDF OCR attempt ${attempt} failed`, error)
    }
  }
  throw lastError instanceof Error ? lastError : new Error('PDF OCR failed')
}

export async function extractDocumentMetadata(
  imageBase64: string,
  mimeType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' = 'image/jpeg',
): Promise<DocumentExtraction> {
  const normalizedBase64 = imageBase64.trim()
  if (!normalizedBase64) throw new Error('Document image is empty')

  const openai = getOpenAI()
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{
      role: 'user',
      content: [
        { type: 'image_url', image_url: { url: `data:${mimeType};base64,${normalizedBase64}`, detail: 'high' } },
        { type: 'text', text: 'Analiza el documento y devuelve únicamente los datos estructurados verificables.' },
      ],
    }],
    response_format: {
      type: 'json_schema',
      json_schema: { name: 'document_extraction', strict: true, schema: JSON_SCHEMA },
    },
    max_tokens: 1200,
    temperature: 0,
  })
  const content = response.choices[0]?.message?.content
  if (!content) throw new Error('No response from OpenAI')
  return parseExtraction(content)
}

export function getDocumentStatus(
  expirationDate: string | null,
  daysWarningThreshold = 30,
): 'vigente' | 'por-vencer' | 'vencido' | 'pendiente' {
  if (!expirationDate) return 'pendiente'
  const expDate = new Date(expirationDate)
  const today = new Date()
  const daysUntilExpiration = Math.floor((expDate.getTime() - today.getTime()) / 86_400_000)
  if (daysUntilExpiration < 0) return 'vencido'
  if (daysUntilExpiration <= daysWarningThreshold) return 'por-vencer'
  return 'vigente'
}
