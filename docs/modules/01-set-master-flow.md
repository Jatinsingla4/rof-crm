# Module 01 Set Master: data flow and cross-module breakage

Reviewer: FLOW (read only, from code, 2026-10-16). Nothing run against a database. Paths are under `packages/`.
Next free DT number is DT-057 (highest now DT-056). Proposed items below are NOT added to `DEFERRED_TASKS.md`.

## 1. Flow per list

| List | Read outside Set Master | Stored in other tables as |
|---|---|---|
| countries, states, cities | none. No screen or route calls `/master/countries|states|cities` | consumers (`present_/perm_/office_/comm_` city, state, country), companies `city/state/country`: free text, no id |
| banks | `booking.js:1469` (booking bank), `booking-payment.js:29`, `brokers.js:234`, `pending-cheques.js:72`; `payments.ts:1247` joins `receipts.clearing_bank_id` | text `receipts.bank_name`, `booking_records.bank_name`, `consumers.finance_bank`. Only `clearing_bank_id` is an id |
| salutations, professions | `booking.js:10-11` | text `consumers.salutation/profession` |
| nationalities | `booking.js:12` | text `consumers.nationality`. Also drives GST (see R1) |
| sources_of_enquiry | `booking.js:1463` | text `consumers.source_of_enquiry` |
| document_types | none. No route or page reads it | nothing (see section 3) |
| document_dispatch | `consumers.ts:1283` (consumer file), `surrender.ts:165` (surrender letter) | `document_type` free text typed in the form (`set-master.js:332`), not picked from `document_types` |
| companies | `projects.ts:18`, `set-projects.js:573`, `reports.js:80`, `users.ts:306`, `payments.ts:1249`, `transfers.ts:571`, `reports.ts:4936,5034`, `custom-letters.ts:137`, `documents.ts:747,1469,1946,2024,2198` | `projects.company_id` (id, `ON DELETE SET NULL`), `user_company_access.company_id` (no FK) |
| company_bank_accounts | `payments.ts:3701` (clearing-bank dropdown), `reports.ts:4659,4893,4910` | `receipts.company_bank_account_id`, `outgoing_payments`, `draw_refunds` (ids). Delete is soft (`is_active=false`) |

## 2. What company fields each print reads

| Output | Source | Evidence |
|---|---|---|
| Booking receipt, payment receipt | `global_settings` only (name, CIN, GSTIN, address, bank) | `booking.ts:3162-3170`, `payments.ts:2107-2115` |
| Demand letter, cover letter | `global_settings`, then `companies` via project overrides non-blank fields | `documents.ts:1390-1422`, `1438-1453` |
| Allotment letter | `global_settings`, override only name, address, phone, email, bank. Not CIN, GSTIN, reg address, logo | `documents.ts:1952-1966` |
| ATS, conveyance deed | `companies` via project (name, CIN, address, PAN). No GSTIN | `documents.ts:2024, 2198` |
| Custom letters | `companies` only, no fallback, blank if no company | `custom-letters.ts:126-203` |
| Reports header | `global_settings.company_name` | `reports.ts:1596` |

The two copies can disagree. `global_settings` is written only when `write_to_global_settings` is sent (the "Set as active company" button, `set-master.js:1268-1280`) and on logo upload (`companies.ts:286`). Plain company edits do not update it. Receipts print no logo at all.
Bank details have three sources: `companies.bank_*` (letters), `global_settings.bank_*` (receipts, copied from the same legacy columns, `companies.ts:154-158`), and `company_bank_accounts` (clearing dropdown, bank ledger). The primary flag is read only for dropdown order, so changing the primary account changes nothing printed.

## 3. document_types flow

Booking never reads `document_types`. The booking page uses a hard-coded list with slug types: `physical_application_form`, `invitation_letter`, `reminder_letter`, `pan_card`, `aadhaar_card` (`booking.js:1818-1839`), stored in `booking_documents.document_type` (`booking_documents.ts:72`). So `required_at`, `is_mandatory`, `document_from` and project scope are never enforced anywhere; they are labels only.
Rename cascade (`master.ts:309`) and delete guard (`master.ts:327`) compare the display name ("Aadhaar Card") with those slugs, so for `booking_documents` they never match. For `document_dispatch` they match only if someone typed the identical text.
`name` is globally unique (`master.ts:267,291`, baseline `document_types_name_key`), so the same paper cannot exist in two projects (DT-049). If made per project, `document_dispatch` (name only, no project) could not tell them apart.

## 4. Ranked breakage risks

| # | Risk | Evidence | Where | Safe fix |
|---|---|---|---|---|
| R1 | **Nationality text drives GST.** Receipts, demands, letters zero CGST/SGST when nationality is `nri/oci/pio`. Rename or delete "NRI" in Set Master and new bookings stop matching, so GST is charged. Booking form also has a hard-coded toggle with `resident/pio/nri/oci` (`booking.js:314-320`) next to the list | `payments.ts:487,2134,2593,3323`, `booking.ts:338,820,989,1482`, `documents.ts:869`, `payment-waterfall.ts:434`, `consumers.ts:1354` | Other module (Booking, Payments). Trigger is in Set Master | Block rename and delete of nationalities in use or reserved (NRI, OCI, PIO) in `master.ts`. Longer term a flag column `is_gst_exempt` read by one helper. Money impact, high |
| R2 | **Receipts print the wrong company.** Receipts read the single global copy, not the project's company. With two companies, the receipt shows whichever was last set active, or the stale copy if the company was only edited | `booking.ts:3162`, `payments.ts:2107`, `set-master.js:1268` | Other module (Receipts) | Resolve company via `projects.company_id` in receipt routes (same query as `documents.ts:747`). Until then, say so in the Company screen |
| R3 | **Demand letter can pick the wrong company.** `payment_plans` and `booking_records` are joined on consumer only, not on the unit, and the `OR` makes every unit row match; `LIMIT 1` has no `ORDER BY`. Latent while one company exists | `documents.ts:747-761`, same in `1469-1481` | Other module (Documents) | Join through the consumer's own unit or allocation only, add `ORDER BY` |
| R4 | **Blank company field falls back to the old global value.** Overrides use `if (x)`, so a field the owner clears (new in M01-B007) reappears from `global_settings` on letters. Allotment letter mixes new company name with old GSTIN | `documents.ts:1438-1453, 1957-1966` | Other module, caused by Set Master change | Decide per field: a blank company value should print blank or fall back on purpose |
| R5 | **Stored HTML in dropdowns.** M01-B005 fixed escaping only in `set-master.js`. Bank, salutation, profession, nationality, source names go raw into `<option>` | `booking.js:1465,1471`, `brokers.js:236`, `booking.js:23`, `edit-booking.js:237` | Other module (booking, brokers). Data is entered in Set Master | Escape in those pages with `Utils.esc`. Optionally reject `<` and `>` in `master.ts` `cleanBody` |
| R6 | **Document type rename and delete guard are blind to booking documents** (section 3) | `master.ts:309,327` | Inside Set Master | Document that booking slugs are separate, or move booking to read `document_types` (module 6 decision). Do not claim the guard protects bookings |
| R7 | **Legacy company bank columns versus bank accounts table.** Letters and receipts print `companies.bank_*`; the bank accounts screen edits another table. Deleting or changing the primary account changes nothing printed. `PATCH` cannot clear a field, no atomic primary switch, no primary left after delete (DT-053) | `companies.ts:213,239,268`, `documents.ts:1449-1453` | Inside Set Master and Documents | Pick one source (primary active account) and copy from it |
| R8 | **Company delete is not possible by API but possible in SQL.** Then `projects.company_id` becomes NULL, bank accounts cascade, `receipts.company_bank_account_id` becomes NULL. Custom letters print blank company. `projects.ts:400` cannot unlink a company either | baseline FKs lines 5905, 6841, 6881; `custom-letters.ts:137` | Inside Set Master (no delete or deactivate route, `is_active` never set false; `users.ts:306` lists inactive too) | Add deactivate, block when projects use it |
| R9 | Salutation, profession, nationality, source delete or rename leaves old text on consumers; reports group by the old text | `master.ts:200-216` (no `inUse`, no PUT for three of them) | Inside Set Master (DT-056) | Block delete when in use, or accept and document |
| R10 | Bank rename leaves old text on `receipts.bank_name`, `booking_records.bank_name`. Bank delete guard checks only `clearing_bank_id` | `master.ts:190-195` | Inside Set Master | Same as R9 |
| R11 | Countries, states, cities are an island: edits and guards matter to nobody, but cities and states in consumers are free text so spelling differs from the list | no consumer found | Inside Set Master | Low priority; note in module doc |

## 5. Could not determine from code

- Which nationality the booking form really sends (the `<select>` from the list, or the `resident/pio/nri/oci` toggle). Both exist in `booking.js`. Read the saved value on the 4 real consumers in the database.
- Actual rows in `global_settings`, `companies`, `company_bank_accounts` on Neon (CLAUDE.md says the bank accounts hold only a placeholder). Whether the two company copies match today.
- Whether any report or export groups by salutation, profession or source text (not grepped beyond `.source`).
- Letter templates stored in `document_templates` (database rows) may use other merge keys not visible in code.
- Live FK state on Neon (only the baseline file was read).

## 6. Proposed DT items (not added)

- DT-057 R1 guard nationality rename and delete, then a GST-exempt flag (High)
- DT-058 R2 receipts to read the project's company (High, Receipts module)
- DT-059 R3 and R4 company resolution in Documents (Medium)
- DT-060 R5 escape master names in booking, brokers, edit-booking (Medium)
- DT-061 R7 and R8 one bank source, company deactivate (Medium)
