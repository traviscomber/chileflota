const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { resolve } = require('node:path')
const test = require('node:test')

const source = readFileSync(resolve(__dirname, '../../app/page.tsx'), 'utf8')

test('public landing returns synchronously rather than waiting for operational data', () => {
  assert.match(source, /export default function LandingPage\(\)/)
  assert.doesNotMatch(source, /\bawait\b|\basync\b/)
})

test('public landing imports only its presentation dependencies', () => {
  const imports = [...source.matchAll(/\bfrom\s+["']([^"']+)["']/g)].map((match) => match[1])
  assert.deepEqual([...new Set(imports)].sort(), ['lucide-react', 'next/link'])
  assert.doesNotMatch(source, /\brequire\s*\(|\bimport\s*\(/)
})

test('public landing cannot query or initialize the operational database', () => {
  assert.doesNotMatch(source, /createAdminClient|supabase|subcontractor_documents|uploaded_documents|process\.env/)
  assert.doesNotMatch(source, /\bfetch\s*\(|\bXMLHttpRequest\b|\bPromise\b/)
})

test('client access remains present without waiting for a count', () => {
  assert.equal((source.match(/href="\/login"/g) || []).length, 3)
  assert.match(source, /El subcontratista carga\. La ejecutiva valida\./)
})

test('missing metrics cannot masquerade as operational health', () => {
  assert.doesNotMatch(source, /processedDocumentCount|formatNumber|Operaci\u00f3n activa/)
  assert.match(source, /Evidencia trazable/)
  assert.match(source, /Trazabilidad/)
})
