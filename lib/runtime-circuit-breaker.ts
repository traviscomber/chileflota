import { createAdminClient } from '@/lib/supabase/admin'

export type BackgroundProcessingState = {
  paused: boolean
  reason: string | null
  updatedAt: string | null
}

export async function getBackgroundProcessingState(): Promise<BackgroundProcessingState> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('system_runtime_flags')
    .select('enabled,reason,updated_at')
    .eq('key', 'background_processing_paused')
    .maybeSingle()

  if (error) {
    // Fail closed for background work when the safety state cannot be read.
    return {
      paused: true,
      reason: `Health safety state unavailable: ${error.message}`,
      updatedAt: null,
    }
  }

  return {
    paused: Boolean(data?.enabled),
    reason: data?.reason ?? null,
    updatedAt: data?.updated_at ?? null,
  }
}

export async function shouldRunBackgroundWork(): Promise<{ allowed: boolean; reason: string | null }> {
  const state = await getBackgroundProcessingState()
  return { allowed: !state.paused, reason: state.reason }
}
