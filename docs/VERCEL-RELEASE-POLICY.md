# N3uralia Vercel release policy

For Vercel-backed projects, production changes follow a batched release flow.

1. Start from the latest READY production-backed `main`.
2. Create one branch for one coherent release block.
3. Accumulate related commits on that branch.
4. Allow previews for branch commits, but do not deploy production from intermediate commits.
5. Validate the exact final branch SHA: build, tests, runtime, authenticated QA and required data checks.
6. Keep one pull request for the release block.
7. Merge once to `main` after explicit release approval.
8. Verify the exact merged SHA is READY in production.
9. Run production smoke and data/runtime checks.
10. Close the release only after production verification.

Do not use repeated commit -> merge -> production cycles while a coherent work block is still in progress.

Exceptions:
- Critical hotfixes may use a short dedicated branch and PR, but still require a single merge and exact-SHA production verification.
- Unrelated work belongs in a separate branch/PR.

Database changes that the code depends on must be coordinated with the same release. Prefer additive/reversible migrations and preserve canonical data.
