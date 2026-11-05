# Staging deployment architecture and release-gate checklist (design only)

**Nothing here provisions infrastructure or changes configuration.** It is a design and a checklist to read, decide on and, later, verify. Sources: plan sections 12, 12.1, 12.2, 12.3 and the
"Implementation Readiness and Release Gates" table (v6 copy, see `00-plan-integrity.md`), plus `.github/workflows/ci.yml` and `migrate.yml` as they are in the repository (read only). No GitHub, Vercel or
Neon setting was inspected: every "unverified" below means exactly that.

## 1. Today (verified from the repository files)
- One production deployment. A push to `main` runs the `verify` job (build, dist check, fresh database, migrations 096 and later twice, API suite, Playwright), then the `deploy` job, which **first applies every pending migration file to the production database** (`DATABASE_URL` from secrets, no `environment:` key, no human gate) and **then** deploys to Vercel.
- `migrate.yml` is a manual dispatch (input `confirm` must be `yes`), declares `environment: production`, can re-apply from a given number (`FORCE_FROM`), and has no branch restriction in the file.
- There is **no staging**: no second deployment, no second database, no scrubbed copy.
- **Not on `main`.** The `APP_ENV` and `SCOPE_MODE` start-up check (`UR-013`, Q-D1 option A) exists only in the **feature branch** `integration/rof-crm-stabilization`; the code that production runs (`origin/main`, last commit `8000ec2`) does **not** contain it, so **nothing is enforced in production today**. See section 6.

## 2. Proposed target (design for the owner to accept or change)
```
 developer branch ──► pull request ──► verify (CI database, throwaway)
                                          │ merge to main (needs the review rules of item 3 below)
                                          ▼
                    ┌─────────────── staging ────────────────┐
                    │ staging database  ◄── scrub (D10) ◄── restore of production data (never copied raw)
                    │ migrations of the batch applied automatically, result attached to the review
                    │ staging app: APP_ENV=staging, NODE_ENV=production, SCOPE_MODE=log then strict
                    │ browser suite + checklist run here
                    └────────────────────┬────────────────────┘
                                         ▼  human approval (protected "production" environment, reviewers, no self-review)
                    ┌────────────── production ──────────────┐
                    │ approval shows: commit SHA + exact list of pending migration files
                    │ pending-set check aborts if the set differs from the reviewed one
                    │ ONE release batch applied once ─► deploy of the SAME SHA ─► read-only live checks
                    │ production app: APP_ENV=production, NODE_ENV=production, SCOPE_MODE=strict (or unset)
                    └─────────────────────────────────────────┘
   data operations (D1 to D11) are NEVER part of this path: separate audited scripts run by a named, approved person.
```
### Configuration that must differ between the environments (nothing is set by this document)
| Setting | Local / CI (today) | Staging (proposed) | Production |
|---|---|---|---|
| Database | disposable local or CI Postgres | own database restored from a **scrubbed** copy | the live database |
| Database secret | none or a throwaway | its own secret, **different name and scope**, readable only by staging jobs | environment-scoped to `production`, not readable by pull-request or `verify` jobs |
| `APP_ENV` | unset (development) | `staging` | `production` |
| `NODE_ENV` | development or test | `production` | `production` |
| `SCOPE_MODE` | strict by default | `log` first, then `strict` | `strict` or unset (never `log`; the app refuses it) |
| `JWT_SECRET`, mail and WhatsApp keys | throwaway | its own; mail and WhatsApp disabled or sandboxed | production values |
| Hosting | local | a separate Vercel project, own project id and domain | the existing project |
| Live checks after deploy | none | the read-only "live" job repeated for staging | the existing "live" job |

### Hosting options for the owner (Q-D5; none is chosen, cost is unknown to me)
| Option | What it is | The rule it must still meet |
|---|---|---|
| A | Separate Vercel project plus a **separate** Neon project, created from a scrubbed restore | no production credential anywhere in its configuration |
| B | Separate Vercel project plus a Neon **branch** of a project that holds only scrubbed data | a branch of the **production** project would carry raw production data; the plan forbids raw copies, so the parent must be a scrubbed project |
| C | A self-hosted Postgres for staging | same scrub rule; someone owns the server |
Whoever owns the scrub (a script that anonymises personal data, run on every refresh) must be named, together with the refresh procedure.

## 3. Release-gate checklist (every gate is NO-GO today; a gate becomes GO only when the evidence is recorded)
**Global gates, all required for every release:**
| Gate | GO when | Evidence available now | Who signs | Status |
|---|---|---|---|---|
| **G1** staging safety | a separate staging deployment and database exist, built from a scrubbed copy, `APP_ENV=staging`, a named owner and refresh procedure, no production credential in its configuration (reviewed and recorded) | none (no staging) | owner, then an administrator | NO-GO |
| **G2** migration inventory and batching | the register lists every schema change; every data change is outside a migration; each release is one batch; no file reaches `main` before its batch is approved; numbers rechecked; dependency order kept | drafts M1 to M3, M9, M10a, T1, T2 (not in the migrations folder on purpose); M4 to M8, M11, M12 not drafted; the remote was clean when last read (one branch, no pull requests) but must be rechecked | owner | NO-GO |
| **G9** protected production approval and serialization | an administrator has inspected and recorded every item of the list in section 4 below | none: settings not inspected, workflow not changed | administrator, owner | NO-GO |
| **G10** written owner approval | written approval of the design items of the release, of the batch's migration list, and of the open questions it depends on (Q-D1 to Q-D5, Q-U1 to Q-U3, Q-A1) | none | owner | NO-GO |
| **G13** no production `SCOPE_MODE=log` | production runs `APP_ENV=production` with strict scope; the refusal of `log` outside staging is tested; the configuration review is recorded | the start-up refusal exists **in the feature branch only, not on `main` or in production**, and is tested there (`UR-013`, inside `api-test-phase1`); it runs only when `NODE_ENV=production`; Q-D1 written confirmation missing | owner, administrator | NO-GO |
| **G14** safe rollback and auditability | the forward-safe rollbacks are rehearsed on staging; audit rows are complete; no rollback restores unsafe behaviour | design written; rollbacks are plain drop statements in the drafts; no rehearsal | owner | NO-GO |

**Phase gates (each applies to the phase or batch it names):**
| Gate | Needed for | GO when | Evidence now | Status |
|---|---|---|---|---|
| G3 | every batch | the preflight queries named for the batch passed on a freshly restored **scrubbed** copy, outputs signed by the owner, blocking rows cleared, the migrations applied twice on the copy | reports and dry-runs exist; nothing run on real data | NO-GO |
| G4 | strict scope, capability grants | approved per-login (project, company) mapping or explicit "no access"; NULL-project rows mapped or left super-admin-only; the global-catalogue allow-list signed line by line; staging passed log and strict | D5 and D6 reports and the template exist; nothing filled | NO-GO |
| G5 | financial workflows | owner and Finance chose the architecture and approved the route classification (Q-F4) | the part B route table (`02-...`) | NO-GO |
| G6 | receipt returns | Finance answered F1 to F17 in writing and approved the formula | none | NO-GO |
| G7 | receipt returns | every collected-money query of the plan's register has its own passing test | register drafted, no test | NO-GO |
| G8 | unit and inventory authorization | Q-U1, Q-U2 answered, typed-id tests for all allocation routes, booking and parking authorization tests pass | `api-test-unit-status` (34 checks) covers hold and allotment by typed id; booking and shift are covered by the helper test only; Q-U answers missing | NO-GO |
| G11 | every phase | all acceptance criteria of the touched sections pass **on staging in strict mode** (and the scope suite also in log mode); the browser flow runs on staging | green locally: Playwright 245, API 56 scripts on a disposable database | NO-GO until staging exists |
| G12 | data operations | a named independent reviewer, D4 backfill reviewed, D1, D2, D11 done where needed, legacy rows quarantined | scripts exist; reviewer unnamed (Q-D4) | NO-GO |

## 4. What an administrator must inspect for G9 (plan 12.2; none of it was looked at)
1. Staging and production database secrets are different values with different names and scopes.
2. The production database URL is scoped to the `production` environment, not a repository secret readable by unprotected jobs; pull-request and `verify` runs cannot read it.
3. The `production` environment has required reviewers and "prevent self-review" is on (the person who pushed or dispatched cannot approve).
4. The environment accepts deployments only from `main`; `migrate.yml` dispatched from another ref is refused (the plan also proposes an `if: github.ref == 'refs/heads/main'` in the file).
5. The manual `migrate.yml` is behind the same gate and its `FORCE_FROM` re-apply path is reviewed like any migration run.
6. A rejected review or a failed migration stops the chain before any production change (the deploy job needs the migrate job).
7. An approval applies exactly one reviewed batch once, then deploys the same SHA; the review shows the SHA and the list of pending files; a pending-set check aborts on any difference; one shared production concurrency group with `cancel-in-progress: false`.
8. Staging is migrated first and its result is attached to the review.
9. No data operation runs through this path.
Acceptance (to be tried on a throwaway repository or branch, never on production): a pushed migration stops at the approval step; a rejection deploys and applies nothing; the author cannot approve; a dispatch from another ref is refused; approval applies the listed files once and then deploys the same SHA; a failing migration leaves production code unchanged.

## 5. How to review this document
Read section 2 first: if the picture is not what you want, say so before anything else. Then decide the three things only you can: who owns staging and where it is hosted (options A to C), whether you accept the target flow, and who is the administrator who will inspect the settings of section 4. Section 3 is the checklist to tick later; a gate turns GO only when its evidence is written down, never by reading this file. Section 6 lists what must be true about `APP_ENV` and `NODE_ENV` before the merge.

## 6. Q-D1 option A: what is and is not enforced, and what must happen before the merge
**What exists.** `loadAppConfig` in `packages/api/src/utils/app-config.ts` (the check is at lines 12 and 13, the `SCOPE_MODE=log` check at line 18) is called when the application module loads, at `packages/api/src/db/pool.ts:47` and `packages/api/src/index.ts:77`; the Vercel entry `api/index.js` imports the compiled `packages/api/dist/index.js`, which contains it. Calling the compiled function directly gave:
| Environment seen by the process | Result |
|---|---|
| `NODE_ENV=production`, `APP_ENV` unset, `Production` (capital P) or `prod` | **throws** "Refusing to start" |
| `NODE_ENV=production`, `APP_ENV=production` | starts, scope strict |
| `NODE_ENV=production`, `APP_ENV=production`, `SCOPE_MODE=log` | throws (log is allowed with `APP_ENV=staging` only) |
| `NODE_ENV=production`, `APP_ENV=staging`, `SCOPE_MODE=log` | starts, scope log |
| `NODE_ENV` unset or any value other than exactly `production` (for example `staging`) | **the check does not run**: starts with `appEnv` null |
**What does not exist.** The check is **on the feature branch only**. It is **not on `origin/main`** and therefore **not in production**. This must not be described as "already enforced in production". Nothing has been merged, pushed to `main` or deployed.
**It runs only when `NODE_ENV=production`.** A deployment whose runtime `NODE_ENV` is anything else passes without any `APP_ENV` (fail open for that case). Whether Vercel sets `NODE_ENV=production` at runtime for the production deployment (and for any preview or staging deployment) was **not verified from here** and is an assumption until checked.
**Production release prerequisites (do these before the merge and the deployment, in this order):**
1. **Verify `NODE_ENV=production` on the deployed Vercel runtime.** The admin-only diagnostics route `GET /api/health/templates` returns `environment.nodeEnv` (it is in the source; confirm it exists on the deployed version), or read the Vercel project's environment variables and a deployment's runtime configuration.
2. **Set `APP_ENV=production` in the Vercel production environment** (exact lowercase value; `Production` and `prod` are refused). If a staging or preview deployment uses `NODE_ENV=production`, it needs `APP_ENV=staging`.
3. **Do not set `SCOPE_MODE=log` on production** (it would stop the application from starting); unset means strict.
4. Only then merge and deploy. **If `APP_ENV` is missing at deployment, the application throws while loading and every request fails** (an outage, by design: fail closed). The release checklist must include "APP_ENV present" as a go/no-go item before the deploy job runs.
5. Record the written owner confirmation of option A (Q-D1) in the release approval (gate G10 and G13).
