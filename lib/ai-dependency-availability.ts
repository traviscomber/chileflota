export type AIAvailabilityReason =
  | 'ai_quota_unavailable'
  | 'ai_rate_limited'
  | 'ai_service_unavailable'

export type AIAvailability = {
  unavailable: boolean
  reason?: AIAvailabilityReason
  retryable?: boolean
}

export function classifyAIAvailabilityError(error: unknown): AIAvailability {
  const candidate = error as any
  const message = error instanceof Error ? error.message : String(error ?? '')
  const code = String(candidate?.code ?? candidate?.error?.code ?? '')
  const status = Number(candidate?.status ?? candidate?.statusCode ?? 0)

  if (
    code === 'credit_balance_exhausted' ||
    code === 'insufficient_quota' ||
    /no credits remaining|insufficient quota|credit balance exhausted/i.test(message)
  ) {
    return { unavailable: true, reason: 'ai_quota_unavailable', retryable: false }
  }

  if (
    status === 429 ||
    code === 'rate_limit_exceeded' ||
    /rate limit|too many requests/i.test(message)
  ) {
    return { unavailable: true, reason: 'ai_rate_limited', retryable: true }
  }

  if (
    status === 503 ||
    status === 502 ||
    status === 504 ||
    /service unavailable|temporarily unavailable|gateway timeout/i.test(message)
  ) {
    return { unavailable: true, reason: 'ai_service_unavailable', retryable: true }
  }

  return { unavailable: false }
}
