type ExecutiveStaffRecord = {
  id?: string | null
  email?: string | null
  full_name?: string | null
  transportista_id?: string | null
  is_active?: boolean | null
}

function normalizeText(value?: string | null): string {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
}

export function resolveExecutiveAssignment(
  email: string,
  fullName: string,
  staff: ExecutiveStaffRecord[],
): ExecutiveStaffRecord | null {
  const active = staff.filter((item) => item.is_active !== false)
  const normalizedEmail = normalizeText(email)
  const exactEmail = active.find((item) => normalizeText(item.email) === normalizedEmail)
  if (exactEmail) return exactEmail

  const normalizedName = normalizeText(fullName)
  if (!normalizedName) return null

  const nameMatches = active.filter((item) => normalizeText(item.full_name) === normalizedName)
  if (nameMatches.length !== 1) return null

  return nameMatches[0]
}
