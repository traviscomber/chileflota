# ChileFlota data tiering

## Principle

No canonical evidence is deleted, deduplicated by convenience, or silently rewritten.

The storage model is split into query layers:

- **Hot:** current operational state used by dashboards and workers.
- **History:** complete structured evidence retained in canonical tables.
- **Archive catalog:** verified partitions prepared for eventual cold-storage export.

## PRT

- `prt_vehicle_records` remains the complete canonical history.
- `prt_vehicle_current` exposes one latest record per normalized plate for operational lookup.
- `prt_vehicle_history_catalog` groups the complete history by source batch and period.
- `data_archive_manifests` records archive partitions, row counts, source ranges, checksums and storage verification state.

A partition may only advance to `verified` after exported row counts and checksum/provenance are validated. This foundation does **not** retire or delete source rows.

## Telemetry

- `system_job_runs` remains the complete telemetry source.
- `system_job_runs_recent` is the 30-day hot query surface.
- A later retention step may archive old raw telemetry after verification, but must preserve summary/audit access.

## Future cold-storage rule

The safe sequence is:

1. export a partition;
2. record source row count/range/checksum;
3. verify archive bytes/checksum;
4. mark manifest `verified`;
5. keep query access through archive metadata;
6. only then consider retiring hot copies under an explicitly approved retention policy.

No step may remove canonical evidence before verification.
