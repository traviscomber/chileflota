# ChileFlota — N3uralia Data Intelligence Adoption v1

ChileFlota adopts the N3uralia Data Intelligence Contract v1 as an evidence-first compliance layer.

## Canonical ownership

Canonical business state remains in the current company, driver, vehicle and document model. AI extraction, OCR, alerts and derived compliance values are not canonical by themselves.

## First enforcement targets

1. Document analysis / OCR evidence.
2. Company and driver compliance answers.
3. Operational Clearance.
4. Action Center recommendations.
5. Renewal/notification automation before external side effects.

## ChileFlota readiness policy

Before consequential AI or compliance output:
- resolve exact company/driver/document identity;
- exclude stale/legacy document versions when a current canonical version exists;
- preserve source document and extraction/model version;
- distinguish observed extraction from verified human truth;
- verify authorization scope;
- expose missing evidence;
- prevent unsupported APTO/cleared claims;
- keep model confidence separate from factual certainty.

## Observe-mode rollout

Add READY / LIMITED / BLOCKED telemetry to read-only intelligence paths first. No production writes or notification behavior changes in v1 foundation.

Enforcement begins only after representative reviewed cases confirm the gate is not blocking valid work or allowing unsupported clearance.
