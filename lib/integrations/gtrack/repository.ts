import "server-only"

import { createGTrackStore } from "./store"

export type LinkVehicleInput = {
  connectionId: string
  vehiculoId: string
  externalVehicleId: string
  externalDeviceId?: string | null
  metadata?: Record<string, unknown>
}

export type SavePositionInput = {
  connectionId: string
  vehiculoId: string
  externalPositionId?: string | null
  recordedAt: string
  latitude: number
  longitude: number
  speed?: number | null
  heading?: number | null
  rawPayload?: unknown
}

export type SaveEventInput = {
  connectionId: string
  vehiculoId?: string | null
  externalEventId?: string | null
  eventType: string
  occurredAt: string
  payload: unknown
}

export async function linkExternalVehicle(input: LinkVehicleInput) {
  const supabase = createGTrackStore()
  const { data, error } = await supabase
    .from("external_vehicle_links")
    .upsert(
      {
        connection_id: input.connectionId,
        vehiculo_id: input.vehiculoId,
        external_vehicle_id: input.externalVehicleId,
        external_device_id: input.externalDeviceId ?? null,
        metadata: input.metadata ?? {},
        updated_at: new Date().toISOString(),
      },
      { onConflict: "connection_id,external_vehicle_id" },
    )
    .select("id, connection_id, vehiculo_id, external_vehicle_id, external_device_id")
    .single()

  if (error) throw new Error(`Failed to link GTrack vehicle: ${error.code}`)
  return data
}

export async function saveVehiclePosition(input: SavePositionInput) {
  const supabase = createGTrackStore()
  const row = {
    connection_id: input.connectionId,
    vehiculo_id: input.vehiculoId,
    external_position_id: input.externalPositionId ?? null,
    recorded_at: input.recordedAt,
    latitude: input.latitude,
    longitude: input.longitude,
    speed: input.speed ?? null,
    heading: input.heading ?? null,
    raw_payload: input.rawPayload ?? null,
  }

  const query = input.externalPositionId
    ? supabase
        .from("vehicle_positions")
        .upsert(row, { onConflict: "connection_id,external_position_id", ignoreDuplicates: true })
    : supabase.from("vehicle_positions").insert(row)

  const { error } = await query
  if (error) throw new Error(`Failed to save GTrack position: ${error.code}`)
}

export async function saveIntegrationEvent(input: SaveEventInput) {
  const supabase = createGTrackStore()
  const row = {
    connection_id: input.connectionId,
    vehiculo_id: input.vehiculoId ?? null,
    external_event_id: input.externalEventId ?? null,
    event_type: input.eventType,
    occurred_at: input.occurredAt,
    payload: input.payload,
  }

  const query = input.externalEventId
    ? supabase
        .from("integration_events")
        .upsert(row, { onConflict: "connection_id,external_event_id", ignoreDuplicates: true })
    : supabase.from("integration_events").insert(row)

  const { error } = await query
  if (error) throw new Error(`Failed to save GTrack event: ${error.code}`)
}
