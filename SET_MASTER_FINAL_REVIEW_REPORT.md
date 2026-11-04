# Set Master final review report (five follow-up items)

Date: 2026-11-04. Only the five items below were worked on. Nothing was committed, pushed or deployed, and no existing database was touched. Labels: **RUNTIME-VERIFIED** (run on a live API and a disposable database or in a browser), **SOURCE-VERIFIED** (read in code only).

## Summary

| Item | Result |
|---|---|
| 1 SM-004 other modules masked | Fixed. 2 more endpoints masked (Payments, Reports). Custom Letters and Documents reviewed: they print the number on purpose and are limited to roles that create documents, left unmasked. |
| 2 SM-001 area types under project scope | Fixed. The same cause also affected the applicant lists and was fixed the same way. |
| 3 SM-002 migration 144 preflight | Done. Never deletes or edits a reminder. |
| 4 SM-009 tax slab uniqueness | Done. New migration 145 (unique index on `lower(name)` with preflight). |
| 5 SM-008 renamed active company | Fixed. The active company is now remembered by id. |

Tests: new script `docs/set-master-fixes/api-test-set-master-final-review.mjs` passes 77 of 77 on the new code and fails 38 of 77 on the previous round's code (reproduction). All 44 repo API scripts pass (0 failures). Playwright 29 of 29. `tsc --noEmit` clean. `git diff --check` clean. Lint cannot run (no ESLint config in the repo, unchanged).

## 1. SM-004 company bank account data outside the Companies screen

**Inventory** (searched the whole API for `account_number`, `bank_account_no`, `company_bank_accounts`, `companyBankCols`):

| Endpoint | Returns a number? | Decision |
|---|---|---|
| `GET /api/companies`, `/:id`, `/:id/bank-accounts` | yes | masked (first round) |
| `GET /api/payments/clearing-banks/:projectId` (company accounts and the older project `bank_accounts` fallback) | yes | **now masked** |
| `GET /api/reports/cash-bank-summary` (`routes/reports-cash.ts`) | yes (`account_number`) | **now masked** |
| `GET /api/reports/bank-ledger-company-banks`, `ledger-monthly-summary` | no (id, account name, bank name only) | nothing to mask |
| `POST /api/custom-letters/:id/generate`, `POST /api/documents/generate` (demand, allotment, agreement letters through `merge-demand.ts` and `merge-letters.ts`) | yes, inside the letter text | not masked: the number is printed so customers can pay into it. Needs `documents` create, so view-only roles (`support_agent`, `read_only_viewer`) get 403. |
| Receipt, booking, allotment, outgoing payment routes | only accept an account id | nothing returned |

**Who sees full numbers (evidence, still your confirmation):** `super_admin` and `accounts_finance`. The code already has the finance-only convention (`financeOnly` in `utils/input.ts`: "Only accounts and finance"), and `accounts_finance` is the role with payments edit, broker setup and SMTP rights in `middleware/rbac.ts`. Every other role gets `XXXX` plus the last four digits. The screens that use these lists only need the account id; the label shows bank, name and the last four digits, which is enough to choose. Confirm that this role list is what the business wants.

**Change:** one shared helper in `packages/api/src/utils/company-bank.ts` (`SEES_FULL_ACCOUNT`, `maskAccount`, `forRole`); `companies.ts` now uses it; `payments.ts` (2 returns) and `reports-cash.ts` (1 field) apply it.

**Tests (RUNTIME-VERIFIED):** for each of the 6 roles on `clearing-banks` (company accounts), `clearing-banks` (legacy table) and `cash-bank-summary` (support agent correctly gets 403 there): full for super admin and accounts finance, masked for the others, and the full number appears nowhere in the masked responses. Letters: `support_agent` and `read_only_viewer` get 403 on both generate endpoints; `sales_executive`, `project_manager`, `accounts_finance`, `super_admin` pass the role check.
**Before (reproduced on the previous round's code):** 18 of these checks failed (all masked cases on Payments and Reports).

## 2. SM-001 area type usage under project scope

**Root cause (confirmed by test):** `db.query` runs as a limited database role for a limited login, so the usage count could not see Project B's unit types, projects or unit areas. The count was 0, so a manager limited to Project A could rename an area type that Project B uses. The same applied to the applicant lists (salutation, profession, nationality, source), the bank delete check, and the document type name check, because `consumers`, `receipts`, `booking_documents` and `document_types` also sit behind project scope.

**Fix (`routes/master.ts`):** one helper `cnt()` runs the "is it in use" count outside the caller's project scope (`scopeStore.exit`). Only counts are read this way, never rows; the change itself still runs with the caller's scope. Used by `areaTypeUse`, `/usage`, `textUsage`, `usageByName`, the bank usage count, `countOf`, and `documentNameInUse`.

**Tests (RUNTIME-VERIFIED), Project B uses an area type, a manager limited to Project A:** cannot see the Project B unit type; `/usage` still counts the use; rename is 409; delete by a limited super admin is 409; delete by the manager is 403 (no delete right); an unlimited super admin is refused too; data unchanged; after the Project B use is removed the rename works. Same set for a salutation carried by a Project B applicant. Before: 10 checks failed.
**Boundary note:** the 409 message says how many records use it but names no project, so nothing about Project B is disclosed beyond a count.

## 3. SM-002 migration 144 preflight

`packages/api/src/db/migrations/144_reminder_unique_per_project.sql` now begins with a check for reminders that share (lower name, days, project) or are both global. Why it matters: migration 107 skipped its index on a database that already had duplicates, so such a database can hold duplicates in one project, and the new index could not be built over them.
- If any exist, the migration stops with an error **before changing anything** (the old index is not dropped, the new one is not created) and prints every conflicting group with project, name, days, row count and row ids, plus a manual remediation hint. It never deletes, merges or edits a reminder.
- Same name and days in two different projects, or one global and one in a project, are not conflicts and are not reported.
- It is repeatable: after the owner resolves the conflicts by hand it succeeds, and a second run also succeeds.
- A first version of this preflight failed on a GROUP BY error when I ran it; that was caught by running the migration and fixed before any test relied on it.
- Assumption: migration 144 has not been applied to any real database (it only existed uncommitted); if it was, applying the changed file does nothing harmful because it is idempotent, but the preflight would then no longer run there.

**Tests (RUNTIME-VERIFIED):** the new test drops the new index in the test database, inserts duplicates in one project and globally (plus a valid cross-project pair), runs the migration file and checks: it fails with the report (both groups, ids, remediation), the cross-project pair is not listed, no row is deleted and no index created; after deleting the duplicates by hand it builds the index and runs twice; the kept rows are exactly the expected ones. The index is restored at the end.

## 4. SM-009 tax slab case-insensitive uniqueness

- Finding: `tax_slabs` had only `UNIQUE (name)` (case sensitive) and the route's check could be raced.
- New migration `packages/api/src/db/migrations/145_tax_slabs_name_unique_ci.sql`: `CREATE UNIQUE INDEX IF NOT EXISTS uq_tax_slabs_name_ci ON tax_slabs (lower(name))`, preceded by a preflight that stops with a per-group report (name, row ids, percentages) if names differing only by case exist. It never deletes, renames or merges. Idempotent.
- Route: a raced unique violation (SQLSTATE 23505) now returns the same clear 409 ("A record with this name already exists") instead of a generic message (`sendTaxErr` in `master.ts`).
- Tests (RUNTIME-VERIFIED): the index exists; the database itself refuses a case variant; 12 parallel requests with 3 case variants create exactly one row and the others are clean 409s (no 500); renaming onto another slab's name in another case is 409; preflight stops with a report (and does not list a unique name), changes nothing, then builds after a manual fix and reruns.
- Before: the two index/race checks failed on the previous code. Nothing else in the code reads this table.

## 5. SM-008 renaming the active company, then uploading a logo

**Reproduced (previous code):** the active company was matched by name, so after renaming it the logo upload no longer updated the printed logo (6 checks failed), and any new company reusing the old name could be mistaken for the active one.
**Fix (`routes/companies.ts`):**
- "Set as active company" now also stores `global_settings.active_company_id`.
- The logo upload compares ids. If the id does not exist (a database set up before this change) it falls back to the printed-name match as before.
- Any company update first upgrades such an older database: if the stored printed name equals the company being edited and no id is stored, the id is saved before the name can change. So renaming the active company without switching active-company settings does not lose it.
- A rename does not change the printed company name; that still changes only with "Set as active company" (unchanged behaviour, no business rule added).
**Tests (RUNTIME-VERIFIED, real PNG uploads):** make a company active; rename it (id kept, printed name untouched); upload its logo (active logo updated); create another company with the old name and upload its logo (active logo unchanged, not mistaken for the active one); simulate an older database by deleting the id row, rename again (id restored first), logo still updates; an inactive company leaves the logo alone; switching the active company explicitly still works. Global settings and the test logo files were restored/removed.

## Files changed in this round
- `packages/api/src/utils/company-bank.ts` (shared masking helper), `routes/companies.ts` (use helper, active company id), `routes/payments.ts`, `routes/reports-cash.ts` (masking), `routes/master.ts` (scope-independent usage counts, tax slab duplicate handling).
- New `packages/api/src/db/migrations/145_tax_slabs_name_unique_ci.sql`; changed (unreleased) `144_reminder_unique_per_project.sql` (preflight).
- New `docs/set-master-fixes/api-test-set-master-final-review.mjs` (77 checks; CI picks it up by name).
- The first-round files are unchanged by this work. Full state: 10 modified and 5 new paths in `git status --short`; `git diff --stat HEAD`: 10 files, 298 insertions, 73 deletions (plus the new files).

## Test results (final code, disposable database `rof_final_sm`, dropped afterwards)
- New script: 77 passed, 0 failed (on the previous round's code: 39 passed, 38 failed).
- First-round regression script: 171 passed. Existing Set Master scripts: parity 92, setup 138, deep 19; documents 132.
- All 44 repo API scripts: 44 OK, 0 failed (includes payments-rest 1000, receipts 281, security 156, set-projects-parity 267). The few date-boundary failures seen earlier (broker-hold, demands, reports, security) no longer occur: they were a clock effect of running just after midnight on an Indian-time machine and appear fixed by the time of day, not by any code change.
- Playwright (`flows.spec.ts` + `set-master-fixes.spec.ts`): 29 passed, 0 failed.
- `tsc --noEmit`: no errors. `git diff --check HEAD`: clean. Lint: UNVERIFIED (no ESLint config).
- Migrations 96 to 145 applied twice on a fresh database: no failures.
- Inspected the full diff of this round (payments, reports, company-bank, companies, master).

## Disclosure
While checking, I found one 1x1 test PNG (`packages/api/uploads/company-logos/590c8523-...png`, gitignored) written at 01:06 on 2026-11-04 by a Playwright run in the earlier audit phase, when that test server's working directory was the API folder. It was my own test file and I removed it; no other upload file was created or changed today. My earlier report said no repo uploads were written; that was not fully accurate for the audit phase.

## Remaining risks
- Masking roles: the "full number" list is `super_admin` and `accounts_finance` by analogy with the existing finance-only rule; a business owner must confirm it. Letters and generated documents still print the number in full for every role that can create or view documents (by design).
- Users who can view generated documents (documents view) can read the number inside an already generated letter. Restricting that is a business and product decision.
- `cnt()` reads counts across all projects for a limited user. If a limited login must not even learn that another project uses an item, the message would need to be generic; today it only reveals a record count.
- Migration 144 and 145 stop with an error if conflicting rows exist. That is intentional but means the pipeline step fails until the owner fixes the rows by hand. The real database should be checked first with the read-only queries inside the migrations (the `SELECT` in each DO block), before the pipeline runs.
- The active company is still identified by id only after the next "Set as active company" or the next company update; a database that never has either keeps the name-match fallback.
- Other modules (users, employees, brokers) were not reviewed for the earlier text-control and masking items.

## Items that need a business decision
1. Which roles may read full company bank account numbers (current assumption above).
2. Whether view-only roles may read generated letters that contain the number.
3. Whether a limited manager may edit global lists that have no project column (from the first round, unchanged).
4. Whether a rename of the active company should also update the printed company name (today it does not; only "Set as active company" does).
