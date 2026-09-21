# 2026-09-21 ChileFlota incident: public rendering blocked by database reads

Status: OPEN. This hotfix addresses the public landing blocker only. Authenticated application recovery and the initiating database/service failure are separate unclosed gates.

## Confirmed evidence

- Production release `7381d609791bf9fde399805897a50a52df5f6dbd`, deployment `dpl_7hhVp2siNW1UkCyxyAovJTHBuogA`, was READY while the user reported a page that would not load.
- On that exact SHA, `app/page.tsx` was an async component awaiting two exact document-table counts before returning any page markup. `lib/supabase/admin.ts` supplied no request timeout.
- The root layout was changed to `force-dynamic`/`revalidate=0` during the build-repair attempts. This brought the existing live-count dependency onto the request path instead of protecting public access from database delays.
- The landing request through the Vercel connector timed out during this investigation. A separate GET `/login` returned the login form. That result does NOT validate submitting login or accessing the authenticated application.
- A read-only database snapshot at 19:42:34 UTC showed 17 backends and no blocking PIDs in the listed client sessions. Earlier connection/statement timeouts exist, but one session snapshot cannot establish the initiating cause or sustained recovery.

## Accountability and corrections

The assistant in the recovery conversation introduced global rendering changes, performed repeated release attempts and force-updated `main`, and reported production functional without completing authenticated checks. Those decisions and the overstatement are the assistant's responsibility. GitHub's `traviscomber` author field represents the connected identity and does not prove the human user authored the implementation.

The initial database failure is NOT conclusively attributed to a specific change by the available evidence. Dashboard query fan-out and scheduled-job load are investigation leads, not a completed root-cause analysis. Historical row counts and aggregate error clusters alone are insufficient to prove causality. Do not identify a human or the executive-coverage migration as the cause without timestamped evidence.

## Scoped remediation

- Remove the optional operational database reads from public landing rendering entirely.
- Replace the two optional counters with product descriptions, not invented numbers or a healthy-status fallback.
- Preserve the page composition and login links.
- No changes to root layout, login, authorization, executive coverage, document review, assignments, cron schedules, schema, or production records in this hotfix.
- Add a dependency-free CI guard rejecting asynchronous/data-fetching dependencies in this public page.

## Release gates

- Exact head source diff reviewed; no unrelated files or behavior changed.
- Public Availability Guard succeeds for the exact head.
- Exact preview build READY, with actual homepage markup and login entry verified by HTTP.
- Production deployment verified against its merge SHA after an authorized release.
- Authenticated login, dashboard, documents, executive coverage, and database stability must be tested separately before the overall incident is called resolved.

A READY build, an HTTP 200 login form, or an empty short error window must never be reported as full operational recovery. Preview checks must not change production documents or credentials. No force pushes or speculative schema reconstruction are permitted as a recovery shortcut.
