import "server-only"

import type { GTrackConfig } from "./types"

function getConfig(): GTrackConfig {
  const baseUrl = process.env.GTRACK_API_BASE_URL
  const authHeader = process.env.GTRACK_API_AUTH_HEADER
  const authValue = process.env.GTRACK_API_AUTH_VALUE

  if (!baseUrl || !authHeader || !authValue) {
    throw new Error("GTrack integration is not configured")
  }

  return {
    baseUrl: baseUrl.replace(/\/$/, ""),
    authHeader,
    authValue,
  }
}

export async function gtrackRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { baseUrl, authHeader, authValue } = getConfig()
  const headers = new Headers(init.headers)
  headers.set("Accept", "application/json")
  headers.set(authHeader, authValue)

  const response = await fetch(`${baseUrl}${path.startsWith("/") ? path : `/${path}`}`, {
    ...init,
    headers,
    cache: "no-store",
  })

  if (!response.ok) {
    throw new Error(`GTrack API request failed (${response.status})`)
  }

  return (await response.json()) as T
}

export function isGTrackConfigured(): boolean {
  return Boolean(
    process.env.GTRACK_API_BASE_URL &&
      process.env.GTRACK_API_AUTH_HEADER &&
      process.env.GTRACK_API_AUTH_VALUE,
  )
}
