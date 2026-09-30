export type GTrackVehicle = {
  id: string
  plate?: string | null
  name?: string | null
  deviceId?: string | null
  raw: unknown
}

export type GTrackPosition = {
  vehicleId: string
  recordedAt: string
  latitude: number
  longitude: number
  speed?: number | null
  heading?: number | null
  raw: unknown
}

export type GTrackEvent = {
  id: string
  type: string
  vehicleId?: string | null
  occurredAt: string
  raw: unknown
}

export type GTrackConfig = {
  baseUrl: string
  authHeader: string
  authValue: string
}
