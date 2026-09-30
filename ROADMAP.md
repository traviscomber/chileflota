# ChileFlota / TransportesLabbe — Product & Engineering Roadmap

Last updated: 2026-08-09 13:31 CLT
Canonical repository: `traviscomber/v0-transport-certificates-automation`
Current production baseline before Stage 10 merge: `3b4b7bac4fe6480d2b3bc7e2f7fe9b0305a24746`

## Operating rule

This roadmap is the scope-control document for the platform. A stage closes when its explicit exit criteria are met. New discoveries that are not P0 data-loss/security incidents do **not** extend the active stage automatically; they are assigned to the next appropriate stage.

Release flow for every code stage:

`implementation -> preview/CI -> Qalito PASS -> merge to main -> production READY -> runtime/data verification -> stage closure`

Cronos owns operational supervision, synchronization health, queue recovery and production verification. Qalito is the mandatory release gate for code/release changes.

**Documentation rule:** update this file whenever a material production fix, closure milestone, security gate, public-discovery change or stage transition occurs. Live Supabase/Cronos state remains authoritative for operational counters.

---

## Cross-cutting discovery layer — SEO / GEO / LLM discoverability

**Status: IN REVIEW — PR #84**

- Public product entity: **ChileFlota**.
- Canonical public domain target: `https://chileflota.app`.
- LABBE remains the current operational implementation.
- N3uralia is identified as creator/software factory at `https://n3uralia.com`.
- Chile-focused metadata, JSON-LD, robots, sitemap and supplemental `llms.txt` implemented in review branch.
- Preview build is READY; runtime verification remains gated by preview SSO/domain connection.

---

## Stage 9 — Operational hardening and synchronization closure

**Status: CLOSED — QALITO PRT PASS**

### Closure evidence

- May 2026 RA1, RA2 and RB: `imported`.
- June 2026 RA1, RA2 and RB: `imported`.
- July 2026 RA1, RA2 and RB: `imported`.
- July RB EOF: 598,130 rows read / 594,805 worker-valid / 3,325 duplicate/rejected-accounted.
- Canonical reconciliation: seven of nine batches match worker-valid counts exactly.
- May RB has one explained inter-block upsert identity collision: 526,158 worker-valid versus 526,157 canonical physical identities.
- July RB has one equivalent explained inter-block upsert identity collision: 594,805 worker-valid versus 594,804 canonical physical identities.
- No evidence of missing bulk canonical data.
- Active PRT batches: `0`.
- Stale PRT batches: `0`.
- Failed PRT batches: `0`.
- Latest Cronos reconciliation: `failed_count = 0`, `issues = []`, `staleCount = 0`, `activeCount = 0`.

Known accounting debt: future PRT worker accounting should distinguish source-valid rows from newly created canonical identities when an upsert collides with an identity from an earlier block.

---

## Stage 10 — Authentication, authorization and API security boundary

**Status: ACTIVE — BLOCK 1 IN REVIEW (PR #85)**

### Objective

Make privileged APIs and credential-bearing data server-authorized by design without breaking admin, executive, subcontractor, transportista or conductor workflows.

### Block 1 — company authentication boundary

Implemented / verified:

- Confirmed `/auth/login-company` was an active insecure flow using the RUT as both identifier and password.
- Replaced the UI flow so a real password is required.
- Replaced `/api/auth/login-simple` with server-only credential lookup using `SUPABASE_SERVICE_ROLE_KEY` and bcrypt verification against `transportista_auth.password_hash`.
- Preserved existing portal session cookies required by the current dashboard routing contract.
- Vercel preview for PR #85 is `READY`; build completed without errors.
- Removed RLS policy `Allow auth queries` that allowed `SELECT` on `transportista_auth` to role `public`.
- Verified as Postgres role `anon`: `transportista_auth` visible rows = `0`.
- Verified as Postgres role `authenticated`: `transportista_auth` visible rows = `0`.
- Verified `anon` and `authenticated` also see `0` rows in `conductor_auth`, `companies` and `executive_staff`.
- Credential tables contain bcrypt-sized password hashes; no hash values were exposed during the audit.

Qalito gate status: **HOLD** for PR #85 until one controlled positive company-login test is available. Negative/security structure and build are verified; a successful real credential flow has not yet been directly reproduced in preview because no test credential is available and the preview is SSO-protected.

### Remaining Stage 10 scope

- Complete positive/negative regression for transportista/company login.
- Inventory all `/api/*` routes by actor and privilege level.
- Replace blanket API trust with explicit server-side authorization contracts.
- Protect all routes using `SUPABASE_SERVICE_ROLE_KEY` from unauthenticated invocation.
- Audit conductor, executive, subcontractor and admin login/session flows.
- Remove or disable legacy/test auth endpoints such as RUT-as-password flows once references are cleared.
- Normalize tenant/role authorization and RLS for exposed business tables.
- Add negative authorization tests: anonymous, wrong role, wrong tenant, expired/invalid session.
- Add positive tests for each real portal role.

### Exit criteria

- No credential hash readable by `anon` or normal `authenticated` clients.
- No privileged service-role API callable without an authorized server session/contract.
- Company, executive, subcontractor and conductor login/primary flows pass regression.
- Qalito authorization matrix = PASS.
- Production has no new auth-related 5xx or lockout regression after release.

---

## Stage 11 — Canonical document workflow unification

**Status: PLANNED**

### Objective

Unify counts, pending lists, RUT search, detail views and validation actions around one canonical document lifecycle.

### Exit criteria

- Pending counts reconcile exactly to pending lists for the same scope.
- RUT search cannot lose valid records due to pagination or client-side post-filtering.
- Legacy document sources are removed or explicitly adapted.
- Qalito workflow regression = PASS.

---

## Stage 12 — ChileFlota Vehicle & Compliance Intelligence

**Status: PLANNED — PRODUCT VALUE STAGE AFTER CANONICAL FOUNDATIONS**

### Objective

Turn the national-scale PRT corpus and canonical operational evidence into traceable vehicle and fleet intelligence.

### Delivery A — Latest PRT by plate

- Build a rebuildable canonical projection for latest PRT evidence per normalized plate.
- Preserve source provenance and historical records.
- Define deterministic tie-breaking and explicit no-evidence states.

### Delivery B — Vehicle Intelligence Profile

For every operational vehicle expose one evidence-backed profile:

`plate -> latest PRT -> PRT history -> documents -> transportista -> driver -> alerts -> provenance`

Do not create fake operational vehicles from the national corpus.

### Delivery C — Compliance Snapshot

Produce explainable states such as:

`OK / Attention / Blocking / Insufficient evidence`

Every state must link back to canonical evidence; no opaque AI decision.

### Delivery D — Instant Fleet Enrichment

- Accept an operational list of plates.
- Match against the existing PRT corpus immediately.
- Return coverage, matches, no-match and uncertainty states.
- Measure enrichment rate and time saved before requesting manual documents.

### Delivery E — Action-oriented fleet dashboard

Prioritize decisions rather than vanity metrics:

- what expires soon;
- what blocks operation;
- what needs human review;
- which transportista concentrates exceptions;
- what changed recently.

### Delivery F — Explainable intelligence

Natural-language operational queries may summarize canonical evidence, but consequential status must remain deterministic and traceable.

### Future data sequence

After the canonical ChileFlota intelligence foundation is stable, evaluate one external dataset at a time:

1. SII vehicle valuation;
2. MTT registries;
3. municipal circulation permits;
4. CONASET contextual risk;
5. MOP routing/toll context.

Each source must have provenance, legal/reuse validation, freshness policy and a direct product decision it improves.

### Exit criteria

- Operational vehicles enrich automatically when canonical PRT evidence exists.
- Vehicle profile and compliance snapshot are traceable to source evidence.
- Instant Fleet Enrichment handles match, no-match and uncertainty explicitly.
- No simulated facts.
- Qalito end-to-end compliance gate = PASS.

---

## Stage 13 — Product stabilization and client release package

**Status: PLANNED**

- Full role-based regression suite.
- Responsive/accessibility checks.
- Performance and observability baseline.
- Public SEO/GEO regression on `chileflota.app`.
- Search Console/sitemap verification after final domain connection.
- Diagnostic/test-route cleanup.
- Operator runbook, rollback notes and release notes.

### Exit criteria

- No P0/P1 open defects in primary client workflows.
- Public discovery endpoints validate on the production domain.
- Qalito release gate = PASS.
- Cronos health = healthy.
- Production SHA and schema baseline recorded.

---

## Scope discipline

- **P0** security/data corruption: interrupt and repair immediately.
- **P1** primary-flow regression: repair in the active stage only when it blocks that stage's exit or was caused by it; otherwise place it at the top of the next stage.
- **P2/P3** improvements: backlog; do not delay closure.

The purpose is to finish stages, preserve production baselines and prevent development from becoming an undefined permanent phase.
