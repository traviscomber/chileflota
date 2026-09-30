const fs = require('node:fs')
const path = require('node:path')

const source = fs.readFileSync(
  path.join(process.cwd(), 'scripts/029_reassign_carolina_fierro_benjamin.sql'),
  'utf8',
)

describe('targeted Carolina portfolio correction', () => {
  test('targets only the two confirmed subcontractors and Carolina canonical identity', () => {
    expect(source).toContain('carolina.sepulveda@labbe.cl')
    expect(source).toContain('c24d195d-58fa-463e-aaad-96753050116f')
    expect(source).toContain('d3fd017f-552c-4da2-bba3-5c0fb2d22ac0')
    expect(source).toContain('78115605-1')
    expect(source).toContain('78467983-7')
    expect(source).toContain('assigned_executive_id = carolina_id')
  })

  test('keeps compatibility mirrors aligned and fails closed on identity mismatch', () => {
    expect(source).toContain("ejecutivo_nombre = split_part")
    expect(source).toContain('ejecutivo_asignado = null')
    expect(source).toContain("raise exception 'Target transportista identity check failed'")
    expect(source).toContain("raise exception 'Carolina assignment verification failed'")
  })
})
