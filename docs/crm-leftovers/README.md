# Email Templates, Analytics, Help (and the date helper they shared)

Checked in depth: code read first, then roles, hostile input, races, a random run, and every filter, tab and button in a real browser.

## What belongs to this module

| Screen | API | Permission |
|---|---|---|
| Email Templates | `/api/email-templates` (new) | `communications`: everyone reads, sales and support create, project manager and admin edit, only the admin deletes |
| Analytics | the six `/api/reports/*` calls it makes (already checked by the Reports module) | `reports` |
| Help | none (static text) | any login |
| (legal letter templates) | `/api/documents/templates` (POST, PATCH, GET) | create and edit now need `master_data` (project manager, admin) |

## Email Templates: what was wrong

1. **It wrote into the table of legal letters.** The screen saved into `document_templates` with a type such as `allotment_letter` or `payment_receipt`. The letter generator picks the **newest** template of a type, so saving a "Welcome email" typed as allotment letter would have replaced the real allotment letter of every customer. Email wording now has its own table (`email_templates`, migration 123) and routes; a test checks the letter table is not touched.
2. **Opening a saved template showed an empty box** (the list did not carry the wording and "could load from API" was a comment), and pressing Save then **overwrote the stored wording with nothing**. Opening now reads the template from the server.
3. The four "system templates" were drawn on the screen only when the list was empty and could not be saved. They are now four real rows (edit them or switch them off; the delete is refused).
4. Delete called a route that did not exist, and Preview wrote the body and name into a new window as HTML (a `<script>` or `<img onerror>` typed in a template ran inside the CRM's own origin). Preview now shows text only; list names are escaped.
5. No input rules at all. Now: name 150 characters, unique (any letter case, also under a race), subject 200, body 20,000, a fixed list of types, and a `{{field}}` that is not one of the six merge fields (`consumer_name`, `unit_number`, `amount`, `due_date`, `project_name`, `allotment_date`) or a stray `{{` is refused with the list. Search, type and active filters, paging.

**The legal letter template routes** had the same open door: any role that may create documents (sales) could create or change a letter template, the project was silently set to the first project when none was sent, the type was free text, the id in the URL was not checked (`/templates/user-guide` was a 500). Now project manager and admin only, a real letter type, no project means "all projects", ids and sizes checked, every change in the audit log.

## Analytics

- **The first of the month was the last day of the month before** and "today" was yesterday between midnight and 5:30 in India: the screen built dates with `toISOString()`, which is UTC. This was the same in **19 other places** (booking date, receipt date, demand screens, reports, surrender, transfers, interest master...). Fixed at the root: `Utils.isoDate()`; `Utils.today()` and `Utils.monthStart()` use it; every `new Date().toISOString().slice(0,10)` now calls `Utils.today()`, and a guard test fails if one comes back.
- The date range only changed the lead numbers while the page said "This period" on money. Each card and chart now says what it follows (dates for leads; money, units and ageing as of today; collection trend the last 12 months; lead sources all dates), and the range needs both dates and a first date not after the last.
- **A slow answer could paint over a newer one** (Apply twice quickly showed the old numbers). Each load has a number and stale answers are dropped.
- New **project filter** (all six calls take it, the project list is the shared one, so a project with no customer is there).

## Help

- The six quick links all said "coming soon". Each now opens its section.
- Removed what was not true or not there: a placeholder phone number (`+91 124-XXXXXXX`), a "Download User Guide PDF" button that called a route that does not exist, "auto-deliver via email/WhatsApp" (nothing sends), the fixed "11.10% HRERA" interest (the rate is a setting, per company and per project; the defaults in the code even differ, see below) and a hard-coded payment plan table (plans differ per project and live in Set Projects).
- External buttons point at checked addresses (Haryana RERA, TCP Haryana, E-Draw portal) and open with `noopener`.

## Found, not fixed (owner or next module)

- **Default penal interest differs in code**: `consumers.ts` falls back to 15 %, `documents.ts` to 11.10 % when the setting is missing. Check that the setting `penal_interest_rate_percent` exists on live, then make both read one place.
- `documents.ts` has a built-in fallback encryption key when `ENCRYPTION_KEY` is not set. Make sure it is set on Vercel and remove the fallback.
- `documents.ts` is 3,300 lines with no input checks on most routes beyond the Documents module's own; the generate route logs customer ids to the console.
- The project list (`ProjectCache`) is read once per login: a project made in another browser appears after a reload.

## Tests

- `docs/crm-leftovers/api-test-email-templates.mjs` (86 checks): the four starting templates, all roles, hostile input on every field, merge fields, duplicates (also 6 at once), 4 parallel deletes, filters and paging, the letter table left alone, the letter template routes (roles, types, scope, audit), a random run of 140 hostile requests (`SEED=n`).
- `docs/web-guards/api-test-web-guards.mjs` (+2): no screen builds today's date from `toISOString()`; the email screen does not use the letter templates.
- `e2e/crm-leftovers.spec.ts` (10 tests): Email Templates (list, open, create with each refusal, edit, preview as text, every type option, search, delete), Analytics (project list, each quick range, hand-typed date, wrong range, zeros for an empty project, numbers equal to the database), Help (all six links, the three site buttons, no placeholder).
- Demo data: the four templates come with migration 123. http://localhost:3020 (`super_admin@demo.local` / `Demo#Pass1234`), menus Email Templates, Analytics, Help.

Run: `BASE=http://localhost:3010/api node docs/crm-leftovers/api-test-email-templates.mjs` and `cd e2e && BASE_URL=http://localhost:3010 npx playwright test crm-leftovers.spec.ts` (psql must reach the same database).
