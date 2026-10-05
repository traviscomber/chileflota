import { classifyAIAvailabilityError } from '@/lib/ai-dependency-availability'

describe('AI dependency availability classification', () => {
  test('classifies exhausted credits as non-retryable quota unavailability', () => {
    expect(classifyAIAvailabilityError({
      status: 429,
      code: 'credit_balance_exhausted',
      message: 'You have no credits remaining.',
    })).toEqual({
      unavailable: true,
      reason: 'ai_quota_unavailable',
      retryable: false,
    })
  })

  test('classifies generic HTTP 429 as a retryable rate limit', () => {
    expect(classifyAIAvailabilityError({
      status: 429,
      code: 'rate_limit_exceeded',
      message: 'Too many requests',
    })).toEqual({
      unavailable: true,
      reason: 'ai_rate_limited',
      retryable: true,
    })
  })

  test('classifies upstream service failures as retryable', () => {
    expect(classifyAIAvailabilityError({
      status: 503,
      message: 'Service unavailable',
    })).toEqual({
      unavailable: true,
      reason: 'ai_service_unavailable',
      retryable: true,
    })
  })

  test('does not classify normal application errors as dependency outages', () => {
    expect(classifyAIAvailabilityError(new Error('Document is empty'))).toEqual({
      unavailable: false,
    })
  })
})
