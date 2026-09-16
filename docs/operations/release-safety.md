# Release safety and rollback

This runbook implements GitHub Issue #28. It is the decision procedure for release candidates; a
merge to `main` alone is not release evidence.

## Pre-release gate

A candidate is releasable only when all of the following refer to the exact candidate SHA:

1. The **Pull Request Quality Gate** is green, including the checks **Frontend quality**,
   **Backend unit and build**, and **PostgreSQL migrations and integration**.
2. The PostgreSQL job proves checked-in migration deployment, status, schema-drift validation, and
   integration behavior against disposable PostgreSQL 16.
3. Frontend and backend production builds are green in that gate.
4. Required Tester / Failure Analyst and Architecture / Security reviews are complete, with no
   unresolved blocker.
5. Remaining risks are recorded in the pull request or release evidence.
6. After deployment, the required smoke run is green for the intended environment. A failed or
   missing smoke run blocks the release tag.

The release owner records these facts using [`../releases/EVIDENCE_TEMPLATE.md`](../releases/EVIDENCE_TEMPLATE.md).
The tag must name the exact verified SHA. Creating or pushing `v0.2.0` requires explicit human
approval after this gate is green.

## Post-deploy smoke

Run **Actions -> Post-deploy Smoke -> Run workflow** from the candidate ref and provide:

- the deployed frontend base URL;
- the deployed backend base URL;
- a clear environment name such as `preview` or `production`;
- the full expected Git SHA for the deployments. It must match both deployment identities.

Dispatch the workflow from `main`; it checks out the smoke implementation from `main` so rollback
validation can safely target an older deployment SHA. The production GitHub Environment must define
non-secret variables `SMOKE_FRONTEND_URL` and `SMOKE_BACKEND_URL`. Production inputs must match
those protected values and use HTTPS. Preview inputs remain explicit diagnostic targets and do not
qualify as production release/tag evidence.

The same check is available locally:

```bash
npm run smoke -- \
  --frontend-url https://frontend.example \
  --backend-url https://backend.example \
  --environment production \
  --expected-sha 0123456789abcdef0123456789abcdef01234567
```

The command exits non-zero unless all required assertions pass:

- frontend returns successful HTML with the build-time `team-scrapbook-frontend` fingerprint;
- the frontend's same-origin JavaScript module entry is reachable and served as JavaScript;
- the frontend-published `VITE_API_URL` equals the supplied backend URL;
- `GET /health` returns the expected process-health state and valid timestamp;
- backend CORS allows the deployed frontend origin;
- `GET /health/ready` returns the expected database-ready state after executing `SELECT 1`;
- when `--expected-sha` is supplied, both deployment identities equal it.

`/health` remains process health. `/health/ready` is PostgreSQL readiness only. Neither endpoint
claims Steam, Gemini, R2, Giphy, product-data correctness, or full user-journey health. The readiness
query reads no product row, returns no database detail on failure, and is coalesced/cached for five
seconds per process to bound database-pool load. Fetching the entry module does not prove browser
execution or detect every client-side runtime error; browser E2E remains outside Issue #28.

Use `npm run smoke:test` for controlled healthy and failure-path proof. Never cause a production
outage to test failure behavior.

### Legacy rollback target

The production deployment immediately preceding the first Issue #28 rollout does not contain the
frontend fingerprint/release metadata, backend release metadata, or `/health/ready`. A full smoke
run will correctly fail against that legacy target. During an approved incident rollback to such a
deployment, record a reduced-assurance restoration check instead:

1. Record provider-confirmed Vercel and Railway deployment IDs and Git SHAs and prove they are the
   intended previously known-good pair.
2. Confirm the frontend returns successful HTML for the established FortKut application and that
   its same-origin module entry is reachable.
3. Confirm legacy `GET /health` returns HTTP 200 with `status: ok` and
   `service: team-scrapbook-api`, and confirm CORS permits the production frontend origin.
4. Record Railway PostgreSQL service health and the last known green migration/integration job.
   This is not a live database query from the rolled-back application and must be labeled as such.
5. Record the missing full-smoke capabilities and prioritize restoration to a deployment containing
   the Issue #28 probes.

This path is incident evidence only. It cannot qualify a new release or tag; all deployments created
after Issue #28 must pass the full repository smoke workflow.

## Release identity and evidence

Vercel builds publish the configured API base, `VERCEL_GIT_COMMIT_SHA`, and
`VERCEL_DEPLOYMENT_ID` as HTML metadata. Railway health responses publish
`RAILWAY_GIT_COMMIT_SHA` and `RAILWAY_DEPLOYMENT_ID`. `unknown` or `null` means the provider did
not expose an identifier; it is not evidence of a match. The release record links provider
deployment pages, the CI run, the smoke run, and the migration result rather than duplicating them
in a release database.

## Frontend rollback: Vercel

Human approval is required before changing live traffic.

1. In Vercel, open the `team-scrapbook` project. The Production Deployment tile identifies the
   deployment currently receiving the production domains. Record its deployment ID/URL, Git SHA,
   domains, and current smoke run.
2. Open **Deployments**, filter to the production branch (`main`), and select the most recent
   previously production-aliased deployment whose SHA has green CI and recorded smoke evidence.
   Do not select a merely successful preview build as the known-good production deployment.
3. Check database compatibility using the policy below. Obtain the production rollback human gate.
4. In the dashboard choose **Instant Rollback** for the eligible deployment and confirm the listed
   domains. On eligible plans, the equivalent authenticated CLI action is
   `vercel rollback <deployment-id-or-url>`; use `vercel rollback status <project>` to inspect it.
   Hobby plans may only offer the immediately previous deployment. A build that never served
   production may instead require **Promote to Production** or
   `vercel promote <deployment-id-or-url>` and is not an Instant Rollback target.
5. Rerun **Post-deploy Smoke** against the production frontend and backend. Record the Vercel
   deployment identity and run link. If the target predates Issue #28, use the explicitly reduced-
   assurance legacy path above; otherwise failed smoke means restoration is not verified.

Instant Rollback reassigns production domains to an existing build; it does not rebuild with newer
environment settings. Vercel disables automatic production-domain assignment while rolled back.
After a fixed deployment is verified, use **Undo Rollback** or `vercel promote <deployment>` to
restore normal automatic assignment. Provider reference:
<https://vercel.com/docs/instant-rollback>.

## Backend rollback: Railway

Human approval is required before changing live traffic or service state.

1. In Railway, open the backend service and its **Deployments** tab. Record the active deployment
   ID, Git SHA, image status, variables/config identity, migration applied by pre-deploy, and smoke
   run.
2. Identify the most recent successful previous deployment with green CI/smoke evidence and verify
   that its application code remains compatible with the current database.
3. Obtain the production rollback human gate. Use the previous deployment's overflow menu and
   choose **Rollback**, then confirm. Railway restores that deployment's Docker image and custom
   variables. If rollback is unavailable because the deployment is outside plan retention, stop;
   do not improvise. **Redeploy** rebuilds/restarts a selected deployment and is not equivalent to
   selecting a different known-good release.
4. Wait for Railway to report the deployment healthy, then rerun **Post-deploy Smoke**. Record the
   Railway deployment ID, SHA, process health, database readiness, and run link. If the target
   predates Issue #28, use the explicitly reduced-assurance legacy path above.

The current repository records Railway build, pre-deploy migration, and start commands in
[`../../backend/RAILWAY.md`](../../backend/RAILWAY.md); it contains no repository-owned Railway
rollback automation. Provider reference:
<https://docs.railway.com/deployments/deployment-actions>.

## Database rollback policy

An application rollback is allowed only after confirming that the older application is compatible
with the database state currently in production. Prefer expand/contract and other backward/forward-
compatible migrations. Do not generate down-migrations for an incident. If schema or data needs
correction, use a reviewed compensating forward migration. Any destructive recovery or data repair
requires a separate explicit human gate and a written recovery plan. Backup/restore is not supplied
by this repository and is a separate future capability.

If compatibility is unknown, leave the application at the current version or disable the affected
behavior with an already-approved safe configuration control while a compatible fix is prepared.

## Configuration flags

Use an existing environment/configuration value as a rollout flag only when a concrete risky or
incomplete behavior needs independent activation. Every flag must:

- be disabled/default-safe when absent;
- name an owner and owning GitHub Issue;
- have activation verification and a documented deactivation path;
- state the conditions and target date/Issue for removal.

Changing a production flag follows the same secret/configuration and production blast-radius human
gates as other production settings. Issue #28 creates policy only; it has no concrete feature that
justifies adding a flag or a flag platform.

## Required `main` protection

Apply these settings in **GitHub -> Settings -> Branches (or Rules -> Rulesets)** for `main`:

1. Require a pull request before merging and at least one approval.
2. Dismiss stale approvals when new commits are pushed.
3. Require conversation resolution.
4. Require these exact status checks: **Frontend quality**, **Backend unit and build**, and
   **PostgreSQL migrations and integration**.
5. Require the branch to be up to date before merging.
6. Do not permit routine agent or maintainer bypass; restrict force pushes and deletion.

Administrative branch-protection changes are human-gated and are not performed by this Issue's
workflow. The manual **Deployed system smoke** job is a release/tag gate after deployment, not a PR
check, because pull-request code receives no production URL or secret. Record the observed ruleset
or branch-protection status in the release evidence before approving a tag.

Branch protection does not prevent a direct tag push. Until a human administrator creates a tag
ruleset for `v*`, the `v0.2.0` gate is procedural and relies on explicit approval plus the recorded
evidence. Creating that ruleset is a separate administrative human gate; routine agents must not
bypass or apply it implicitly.
