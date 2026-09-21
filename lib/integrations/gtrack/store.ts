import "server-only"

import { createAdminClient } from "@/lib/supabase/admin"

/**
 * Privileged persistence boundary for GTrack ingestion.
 * Never import this module from client code or generic user-scoped data access.
 */
export function createGTrackStore() {
  return createAdminClient()
}
