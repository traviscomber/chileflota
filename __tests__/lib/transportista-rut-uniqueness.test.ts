import fs from 'node:fs'
import path from 'node:path'

describe('transportista normalized RUT creation guard', () => {
  const route = fs.readFileSync(path.join(process.cwd(), 'app/api/transportistas/route.ts'), 'utf8')

  it('normalizes RUT before duplicate detection and persistence', () => {
    expect(route).toContain("function normalizeRut(value: string)")
    expect(route).toContain("const normalizedRut = normalizeRut(rut)")
    expect(route).toContain("normalizeRut(String(row.rut ?? '')) === normalizedRut")
    expect(route).toContain("rut: normalizedRut")
    expect(route).toContain("generateDefaultPassword(normalizedRut)")
  })

  it('does not use exact raw-RUT equality for duplicate detection', () => {
    expect(route).not.toContain(".eq('rut', rut)")
  })
})
