# Set Master parity with the client CRM

Checked 2026-10-29 against the client's Set Master, tab by tab (captured in `docs/client-crm/captured/12-set-master.md` and part 1). Migration `126_set_master_parity.sql` (idempotent, run twice), routes in `packages/api/src/routes/master.ts`, screens in `packages/web/public/js/pages/set-master.js`, test `docs/set-master-parity/api-test-set-master-parity.mjs` (92 checks, own data, roles, hostile input, random run).

| Client tab | Before | Now |
|---|---|---|
| Area Type Creation | no master | `area_types` (Sq. Ft., Acres, Sq. Yrd., Sq. Mt. seeded); `/master/area-types`; Set Master > Applicant lists > Area types |
| Currency Configuration | no master | `currencies` ("Rs." seeded); `/master/currencies`; Applicant lists > Currencies |
| Customer Profession | had | unchanged |
| Company Bank Creation | had (more fields than theirs) | unchanged |
| Customer Bank / Loan Bank | one list | one list with **Used as: Customer / Loan / Both** (`banks.is_customer_bank`, `is_loan_bank`), `GET /master/banks?type=loan|customer`, **projects a loan bank is approved for** (`loan_bank_projects`, `GET / PUT /master/banks/:id/projects`, empty = all projects) |
| Country Master | name and one code | **abbreviation, ISO code, ISD code, number of mobile digits** (4 to 15), validated; the six client countries are filled in by the migration |
| Document Type Creation | name unique across everything | unique per **name + project + document-from** (same name for Individual and Firm or Company, and in every project); stage "On Transfer" added; a rename no longer moves other documents that keep the old name |
| Document Dispatch Master | only a dispatch log | new master `document_dispatch_master` (name, Single / Multiple, description, project): `/master/document-dispatch-master` |
| Department, Team Master, Set Team Head, Employee Tree, Set Manager | had | unchanged |
| Letter Head Format, Password / Code, Role Page Hierarchy | | not changed here (see below) |

## Not done in this pass (say so plainly)
- No screen yet for the **dispatch master** and for **approving a loan bank for projects** (the API and tests are in; the Banks screen only shows "all projects" or the count).
- **Letter Head Format** (Computer generated or own header, header height per project): not built.
- **Mobile digits** are stored but not yet used to check mobile numbers on bookings and brokers: do that next, with one shared helper.
- The existing demo and live countries without codes need them filled in (the migration fills the six the client has).
- Browser (Playwright) specs for Set Master were not rerun.
