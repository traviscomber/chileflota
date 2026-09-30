# ChileFlota — Site Documentation

> Current product surface documented from the repository and production structure as of 2026-09-09.

## Canonical product identity

**N3uralia** provides the technology.  
**ChileFlota** is the Transport Compliance OS product.  
**Transportes Labbé** is the current client implementation.

Canonical product loop:

```text
Evidence -> Canonical state -> Operational decision -> Action -> Outcome -> Telemetry
```

ChileFlota is not treated as a generic document repository. The application is organized around operational compliance evidence, review, status, exceptions and traceability.

---

## Primary application shell

The authenticated company workspace uses a persistent left navigation, compact top search and responsive content area.

Primary navigation currently exposes:

1. Dashboard
2. Gestión de Equipo
3. Subcontratistas
4. Conductores
5. Documentos
6. Analytics
7. Reportes
8. Compliance Matrix
9. Impacto Operacional
10. Mi Perfil

The top search is a cross-cutting operational entry point and is intentionally kept inside the existing shell rather than introducing a parallel AI dashboard.

---

## Dashboard

Purpose: operational overview and entry point into the company workspace.

Expected responsibilities:

- surface current operational state;
- prioritize exceptions and items requiring review;
- connect summary information to the same canonical destination used by the underlying workflow;
- avoid duplicating conflicting status vocabularies.

---

## Gestión de Equipo

Purpose: manage the internal users participating in the Transportes Labbé implementation.

The application supports role-scoped access and server-side authorization boundaries for protected operational APIs.

Typical roles represented by the current application include administrative, executive and prevention/compliance functions, plus operational identities used elsewhere in the product.

---

## Subcontratistas

Purpose: organize transport-company/subcontractor identity, documentation and compliance context.

Key product behavior:

- canonical company identity;
- RUT-based resolution;
- company/document relationships;
- current vs historical evidence separation;
- document-state review;
- compliance context;
- direct integration with the global search and Intelligence Core.

---

## Conductores

Purpose: manage driver identity and documentary evidence.

Current capabilities include:

- driver resolution by name or RUT;
- current driver-document relationships;
- license class and expiration evidence when available;
- active/inactive driver state;
- approved, pending, rejected and expired-document observations;
- direct navigation from search suggestions;
- Intelligence Core questions about driver documents, missing evidence and observed blockers.

The Intelligence Core remains conservative: it does not declare a driver `APTO` unless a future Operational Clearance contract certifies complete coverage.

---

## Documentos

Purpose: documentary operations, review and evidence history.

The product supports:

- upload and ingestion;
- current-document semantics;
- approved / pending / rejected review states;
- historical versions;
- document type and company/driver association;
- expiration evidence;
- rejection reasons where present;
- manual review and exception handling;
- search by document, company, RUT, conductor and filename;
- OCR/document-intelligence processing;
- provenance and traceability.

### Search behavior

The global header search currently supports deterministic typeahead for:

- company names;
- company RUT;
- driver names;
- driver RUT;
- approved document filenames.

Search ranking prioritizes strong deterministic matches before generic document fallback.

Natural-language operational questions are routed separately to the Intelligence Core.

---

## Intelligent search / ChileFlota Intelligence Core

Canonical architecture:

```text
Query
  -> deterministic intent/router
  -> fast path OR operational agent path
  -> narrow authorized read-only tools
  -> evidence set
  -> concise answer
  -> existing action/destination
```

Current integrated domains:

- company search;
- company documents;
- company observed compliance state;
- driver search;
- driver documents and license evidence.

Current answer contract distinguishes:

1. observed facts;
2. interpretation;
3. unknown or missing evidence;
4. recommended next action;
5. supporting source/evidence when available.

Guardrails:

- read-only;
- authorization-aware;
- no unrestricted SQL access;
- no automatic approval/rejection;
- no automatic state mutation;
- no claim of full Operational Clearance unless coverage is explicitly certified.

The search field is visually marked as a new feature while preserving the same compact header interaction.

---

## Compliance Matrix

Purpose: organize evidence-backed compliance state.

Principles:

- evidence before inference;
- current evidence separated from stale/history rows;
- missing evidence remains unknown rather than silently becoming failure;
- compliance state should expose reasons/evidence, not only badges;
- operational clearance must remain conservative until the full evidence contract is implemented.

---

## Analytics

Purpose: analyze operational and documentary behavior without replacing canonical workflow state.

Analytics is a secondary decision-support layer. Operational queues and compliance decisions must remain grounded in canonical evidence rather than analytical summaries.

---

## Reportes

Purpose: present reviewable operational/compliance reporting derived from the application state.

Reporting should not create a second definition of compliance or document status; it should reflect the same canonical source used by operational screens.

---

## Impacto Operacional

Purpose: present measurable operational impact and workflow signals.

Product direction:

- measure lifecycle events and real outcomes;
- distinguish elapsed time from human active time;
- avoid unsupported productivity or saved-hours claims;
- keep operational telemetry separate from security audit logs.

---

## AI Insights / document intelligence

The repository includes AI/document-intelligence surfaces and processing workflows.

Current principles:

- AI confidence is not presented as accuracy;
- document extraction should be evaluated against reviewed truth;
- human overrides should remain traceable;
- AI answers must stay grounded in canonical operational evidence;
- the operational copilot has higher priority than a generic chatbot.

---

## Alerts, anomalies and exceptions

The product contains alert/anomaly surfaces and exception-oriented workflows.

Operational rule:

- routine deterministic cases should flow automatically where safe;
- exceptions should be escalated for human review;
- alerts must link to the same canonical state they represent;
- automation success must reflect the business outcome, not only an HTTP response.

---

## Vehicles and PRT evidence

The wider product model includes vehicles and PRT/external evidence workflows.

Capabilities represented in the repository include:

- vehicle identity/evidence;
- PRT history/import processing;
- resumable high-volume ingestion;
- reconciliation of external evidence with canonical operational records;
- provenance preservation.

External source evidence must not overwrite source truth without reconciliation.

---

## Automation and background processing

The repository includes scheduled/background workflows for evidence processing and automation.

Design rules:

- bounded and auditable jobs;
- resumable high-volume work where required;
- idempotent behavior for side effects;
- fail-closed behavior for compliance-critical automation;
- explicit exception handling;
- reconciliation after processing;
- no assumption that request success equals completed business outcome.

---

## Security model

Key principles used by the current system:

- authenticated company workspace;
- server-side authorization on protected operational APIs;
- centralized auth helpers where implemented;
- privileged database/service-role access remains server-side;
- request validation before sensitive operations;
- no client-side privilege assumption;
- no automatic external sends without provider, consent, idempotency and audit gates.

---

## Visual system

Current ChileFlota UI uses a restrained dark operational system:

- graphite/dark canvas;
- burgundy as the main interactive accent;
- semantic state colors only where operationally meaningful;
- compact 5–6 px corner radius;
- low visual noise;
- persistent 192 px desktop navigation;
- responsive mobile drawer;
- compact sticky header;
- clear separation between summary, context/filtering and operational content.

The current design direction intentionally avoids gradients, glass effects, neon treatments, oversized cards and unnecessary dashboard fragmentation.

---

## Technical stack

Current repository stack includes:

- Next.js 14;
- React 18;
- TypeScript;
- Tailwind CSS;
- Supabase/PostgreSQL;
- Vercel;
- Jest;
- Zod;
- Sentry;
- OpenAI / AI SDK and supporting document-intelligence libraries;
- PDF, Excel and ingestion tooling;
- scheduled/background workflows through repository and hosting infrastructure.

---

## Current maturity

### Integrated and in active product surface

- authenticated company workspace;
- dashboard/navigation shell;
- team management;
- subcontractors;
- drivers;
- document operations;
- analytics;
- reporting;
- Compliance Matrix;
- operational-impact surface;
- deterministic global typeahead;
- company Intelligence Core;
- driver Intelligence Core;
- OCR/document-intelligence workflows;
- external evidence/PRT infrastructure;
- alert/exception infrastructure;
- auditability and historical evidence principles.

### Next highest-value capabilities

1. Operational Clearance — `Can this company/driver/vehicle work today?`
2. Action Center — `What requires attention now?`
3. SII/external-status evidence in the Intelligence Core.
4. Document-level evidence inspection and explainability.
5. Short-lived task/entity continuity for follow-up questions.
6. Controlled actions only after read-only quality is proven.

---

## Product quality score — 2026-09-09

| Area | Score | Assessment |
|---|---:|---|
| Product positioning / category clarity | 9.5/10 | Clear Transport Compliance OS identity with strong evidence-first direction. |
| Information architecture | 9.2/10 | Main operational areas are coherent; avoids adding unnecessary parallel AI surfaces. |
| Visual system / consistency | 9.3/10 | Strong, restrained and professional dark/burgundy language across the authenticated workspace. |
| Document operations | 9.4/10 | Mature workflow coverage with history, review states, filters and evidence semantics. |
| Search / discoverability inside the app | 9.4/10 | Deterministic company/driver/document typeahead plus operational-question routing. |
| Driver operations | 9.1/10 | Strong identity/document evidence; full certified clearance remains intentionally pending. |
| Compliance model | 9.0/10 | Evidence-first and conservative, but Operational Clearance is not yet complete. |
| Intelligence Core | 8.9/10 | Useful company + driver read-only brain; Action Center, SII and deeper evidence tools remain next. |
| Security / authorization design | 9.1/10 | Strong server-side direction and privileged-access boundaries; legacy paths still merit ongoing review. |
| Automation / traceability | 9.2/10 | Good reconciliation/audit principles and background-processing foundations. |
| Observability / measurable operations | 8.6/10 | Infrastructure exists, but a fully unified operational telemetry loop is still a major opportunity. |
| Documentation / maintainability | 9.4/10 | README plus this site-level documentation now describe current product architecture and surfaces. |

**Final current score: 9.2 / 10**

The main reason ChileFlota is not yet at 9.5+ is not visual polish. The remaining gap is operational depth: certified Operational Clearance, unified Action Center, stronger evidence inspection and a complete telemetry/feedback loop.

---

## Canonical product statement

> **ChileFlota is an evidence-driven Transport Compliance OS that connects companies, drivers, vehicles and documentary evidence to operational compliance decisions, exceptions and traceable actions. N3uralia provides the technology; Transportes Labbé is the current implementation.**
