# Documents: Document Checklist, Dispatch Log, Customized Letters

Our own check of the Documents group (Set Master menu). Written from the code and from running it.
Checked on 2026-10-19 with `api-test-documents.mjs` (132 API checks) and 4 browser flows in `e2e/flows.spec.ts` (section 9).

## 1. The three screens

| Screen | Opens | What it is for | Who may change |
|---|---|---|---|
| Document Checklist | `#/set-master?screen=checklist` | The papers a buyer gives, by project and stage (PAN card, Aadhaar, ...) | super_admin; project_manager can add and edit, not delete |
| Dispatch Log | `#/set-master?screen=dispatch` | Proof that a notice or letter was sent: document, mode, tracking number, applicant, date | same |
| Customized Letters | `#/custom-letters` | Letter templates per project, a letter made for one applicant, and the register of every letter made | Templates: super_admin and project_manager (not delete: super_admin only). Making a letter: anyone who may add documents (not support_agent or read_only_viewer). The register: anyone who may read documents |

Customized Letters used to be a separate page outside the CRM (own header, own style, no role check). It is now a screen inside the CRM, listed in Role Menu Access, and the old page is removed.

## 2. Rules

**Document Checklist** (unchanged by this check, now covered by tests)
- Name and stage are required; stage is one of On Booking, On Allotment, On Agreement, On Possession, On Demand, Other; "From" is Individual or Firm or Company. Names are unique across all projects, ignoring letter case. Description 500 characters at most. No `<` or `>` in text.
- A document with a project shows only for that project; a document with no project is global. Renaming a document renames its dispatch entries. A document used in the Dispatch Log or in booking documents cannot be deleted.
- It is a reference list. The Booking screen keeps its own fixed document list and does not use stage, mandatory or project from here (the screen says so). Wiring them is part of the Booking check.

**Dispatch Log**
- Document and mode are required; mode is one of Courier, Speed Post, Registered Post, Hand Delivery, Email, Other. Date must be a real date and not in the future. Tracking number 100 characters at most. The applicant, if given, must exist.
- Search by document, tracking number or applicant; filter by applicant and dates (the end date is included); 50 per page with "Load more" (before, only the latest 100 could be seen and searching only looked inside those).
- An entry can be corrected (mode, tracking number, date, document) instead of deleted and typed again. Every change is audited.

**Customized Letters**
- A letter belongs to one project; its name is unique inside the project, ignoring letter case. Subject 255 characters, name 150. Settings: Letter for (All, Loan, Self), Letter type (Other, PTM, TPA), header (own letterhead with blank space at the top, or a computer made company header), reference number with a prefix, reprint as duplicate.
- Making a letter: pick the letter and the applicant. The server checks that the letter is the applicant's project's, and that a Loan letter is only made for a loan booking and a Self letter only for a self-funded one (the applicant's latest booking that is not cancelled). Every value from the applicant is escaped before it goes into the letter, so a name or address can never add markup or script. A variable that does not exist is left as written and reported.
- The letter is shown in a frame that cannot run scripts and is printed from there.
- Reference number: PREFIX/financial year/running number (ROF/WEL/2026-27/0001). The series is the prefix plus the financial year (April to March), shared by every template with that prefix, so a number is never issued twice, even with many letters made at the same moment. If "Reprint as duplicate" is on, a second letter of the same template for the same applicant keeps the first number and is marked DUPLICATE COPY.
- Register: every letter made is entered (number, letter name, applicant, project, who, when). Deleting a template keeps its register rows. Search by number, applicant or letter; filter by dates.
- The variable list on the screen and the merge come from one list on the server, so they cannot drift apart (a test fills every variable).
- Project scope applies: a login limited to a project sees only that project's letters, applicants and register rows.

## 3. Problems found and fixed

| # | Found | Fix |
|---|---|---|
| 1 | Customized Letters was a separate page: no role check on the page or the API, not on the page list, own look | Screen inside the CRM, `documents` rights on the API, `master_data` rights for templates, page on the list (migration 101) |
| 2 | Applicant data was put into the letter as raw HTML (stored XSS) and the letter was written into a new window | Every value escaped; preview and print in a script-blocked frame |
| 3 | Merge used a pattern replace: a value such as `$&` corrupted the letter | Function replace |
| 4 | The letter took an arbitrary booking (no order) and joined payment plans for nothing | Latest booking that is not cancelled |
| 5 | Making a letter was not reachable from any screen (the function sat in the standalone page and nothing called it) | "Make a Letter" screen with applicant search, preview, print, log dispatch |
| 6 | Header, reference number, duplicate, "Letter for" were saved but did nothing | All four work and are tested |
| 7 | No record of letters made | Register with numbers that cannot repeat |
| 8 | Edit replaced the saved settings with whatever was sent (missing fields became empty); delete said "success" for a missing letter; no checks on any value | Only sent fields change, 404, every value checked, 409 for a duplicate name |
| 9 | Dispatch log: any text as mode, any date text (500), no search beyond the latest 100, no edit | Mode list, date check, server search and paging, edit |
| 10 | The merge variables had no test | One test fills all of them |

## 4. Known gaps

| Gap | Note |
|---|---|
| The rich editor comes from a public CDN (cdn.ckeditor.com, pinned to 41.4.2). If it cannot load, the screen falls back to a plain box where HTML can be typed. | Hosting the editor files ourselves would remove the dependency. |
| Document Checklist is not used by Booking yet. | Booking check. |
| Letters are printed from the browser; there is no PDF file or e-mail send. | Add when a client asks. |
| `booking_documents` uploads (Booking) accept a file by its declared type only. | Booking check. |

## 5. Tests

- `api-test-documents.mjs`: 132 checks. Checklist (validation, duplicates, roles, project lists, rename, delete in use), dispatch (validation, search, paging, edit, roles), letter templates (every validation, roles, partial edit, delete), making letters (variables, escaping, project, Loan and Self, cancelled booking), reference numbers (series, 8 at once, duplicate copy, shared prefix, no number twice), headers, register, project scope.
- `e2e/flows.spec.ts` section 9: checklist add, duplicate, edit; dispatch log, search, edit, bad date, delete; Customized Letters from template to numbered letter to register to delete; what support_agent and sales_executive see.

## Update: editor served from our own server

The letter editor (CKEditor 5, classic build 41.4.2) is now `packages/web/public/vendor/ckeditor5/ckeditor.js`, not the internet CDN. Letters no longer depend on cdn.ckeditor.com being reachable. If the file ever fails to load, the plain text box still works. To upgrade, replace that one file and change nothing else.
