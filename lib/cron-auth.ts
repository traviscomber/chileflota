export function isAuthorizedCronRequest(
  headers: Pick<Headers, 'get'>,
  secret: string | undefined = process.env.CRON_SECRET,
): boolean {
  const configuredSecret = secret?.trim()
  if (!configuredSecret) return false
  return headers.get('authorization') === `Bearer ${configuredSecret}`
}
