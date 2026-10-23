# Dashboard, Bank Reconciliation, Construction Milestones

Checked in depth: code read first, then roles, hostile input, project scope, races, a random run. Dashboard also in a real browser (every card, button and fold). **Reconciliation and Milestones have no screen** (nothing in the web app calls them), so they are checked through the API only; a screen is a product decision, see the end.

The routers in the first list of the module were already hardened by earlier modules and have tests (loans, registry, faq, financial-ops / refunds / waivers / notes, outgoing payments: `docs/payments-rest`, `docs/outgoing`). They are not repeated here.

## What belongs to this module

| Screen | API | Permission |
|---|---|---|
| Dashboard (home) | `/api/dashboard/*` | `payments` view (all roles); a user sees only the projects given to them |
| (no screen) Bank reconciliation | `/api/reconciliation/*` | `payments` **create** (super admin, project manager, accounts); sales, support and viewer get 403 on every route |
| (no screen) Construction milestones | `/api/milestones/*` | list and progress: `payments` view; complete: `payments` edit (not sales, support, viewer) |

## Dashboard: wrong numbers found by reading the queries, and fixed

1. **Sales and collection were multiplied** (`daily-status`): bookings and receipts were joined together, so a project with 2 bookings and 3 receipts showed 6 sales and double the collection. Now two separate sums. A sale is a live booking (complete, pending payment, active, as in the Reports), a draft or cancelled booking is not. Collection is cleared receipts; a cancelled booking's receipts are left out.
2. **"Open Tickets" was always 0.** It counted tasks with the status `open`, but a task is `pending` or `completed`. The panel now says Tasks (Pending, Completed, Overdue) and the In Progress / Resolved columns, which never had data, are gone.
3. **Demand letters counted every demand**, also the ones not yet raised, cancelled and paid. Now raised demands only; "O/S" is the full amount (with GST and add-ons) of raised, unpaid demands past their due date. Instalment 4+ is one bucket (the single route said `= 4`, the summary `>= 4`).
4. **Forthcoming dues** counted cancelled and not yet raised demands. Now raised and unpaid only.
5. **Pending cheques**: cancelled and bounced receipts were counted and cleared ones too. Now only cheques and drafts not yet in the bank. Receipts of a plan without a project no longer vanish into a join.
6. **Pending approval**: the unit came from `LEFT JOIN units u ON r.consumer_id = u.id` (a customer id against a unit id, so it was always empty); the date column read a field that did not exist; the KPI counted the first 20 rows, not the receipts. Now the unit of the plan, `received_date`, and a real count (`pendingApprovalCount`, `count`).
7. **"Today" was the date of the server** (UTC), so before 5:30 in the morning the dashboard showed yesterday. Now the date in India.
8. **Every number was written twice** (once for the panel route, once for `/summary`) and the copies had drifted. Each panel is now one query in one place; the routes and the summary call it, a test checks they agree.
9. Project, customer, employee and parking names were put into the page without escaping; they are escaped now. Parking panel: the duplicate columns (Total Issued = Total, Remaining = Free) are gone, Allotted / Available.

## Bank reconciliation

Read: no input check anywhere, a bank file with one bad row was half imported with the bad rows skipped silently, `new Date('05/03/2026')` read an Indian date month first (5 May, not 5 March), `1,23,456` was read as `1`, the auto match looked at receipts and demands **of every project** and also at cancelled ones, a bank line of project A could be read and changed by a login of project B (the lines table had no project), and a receipt could be matched to two bank lines.

- **Import** (`POST /import`): `Date, Description, Amount` (and `Reference`, `Account`). Dates `YYYY-MM-DD`, `DD/MM/YYYY`, `DD-MM-YYYY` only (day first, a real date). Amounts like `1,23,456.50` and `-250.5` (a debit); 0, text, 3 decimals refused. **One bad row refuses the whole file** (422, the rows named, nothing saved). 2 MB, 5000 rows. The same statement twice is 409 (a hash per project), also when renamed, also five at once.
- **Automatic match**: a credit is matched only to a live receipt of the same project with the same reference **and** amount, when exactly one receipt fits the line and exactly one line fits the receipt. Everything unsure stays unmatched for a person (the old "amount and date" guess could never reach its own threshold, it is removed).
- **By hand** (`PATCH /transactions/:id/match`): a receipt, a demand or both; same project, not cancelled or bounced, a receipt only on one line (database index, a race gives 409), a debit cannot be matched. Matching again replaces what the line pointed at. **Ignore** and **Unmatch** (new: there was no way back from an ignore). The counts on the import are read back from its lines after every change. Matching never changes the receipt or the demand.
- Every import and change is in the audit log. Lists have strict `page` / `pageSize` and a total.

## Construction milestones

- Completing a milestone made it 0% (`completionPercentage || 0`), so a finished milestone pulled the project progress down. A completed milestone is 100% now (anything else is 400).
- Completing again sent the messages again; now once (409), the row is locked, so six clicks give one completion.
- The messages were written as `sent` although nothing is connected that sends. They are `queued`, and the answer says "nothing is sent until an email or WhatsApp sender is connected". Customers who still hold a unit (not cancelled, not transferred) get one per channel they have; a blank phone or e-mail gets none.
- `notifyAllottees` is true or false (the text "true" is refused); left out, the milestone's own setting decides. Photo links must be web links or paths of this site (no `javascript:`), description checked, a future actual date refused, list and progress validate the project (unknown = 404, a project outside the user's scope = 404). The progress is a number, not text.
- Database: a milestone's status is `pending`, `in_progress` or `completed`, and a completed one has a date.

Migration `122_reconciliation_milestones.sql` (safe to run twice, checked): `bank_transactions.project_id` (filled from the import, so the project-scope policy covers it), `bank_statement_imports.file_hash`, unique indexes for the duplicate file and for one receipt per bank line, and checks on the status words.

## On purpose not done

- No screen for reconciliation or milestones, and no way to create or edit a milestone (the table is filled once per project by migration 012, so a project made later has none). That needs a product decision first: who enters them, and a sender for the customer messages.
- Bank statements with separate Debit and Credit columns, other date styles, and XLS files: not read; the file is refused with the reason.
- The dashboard still shows tasks under the name "tickets" in the API path (`/employee-tickets`) so nothing else breaks.

## Tests

- `docs/dashboard-recon/api-test-dashboard-recon.mjs` (197 checks): builds its own projects, customers, plans, demands, receipts, bookings, parking, tasks, bank file and milestones and checks each dashboard number for them; all roles; scope with logins of project A and B on every panel, every reconciliation route and the milestones; every refusal; races (5 imports, 2 lines for one receipt, 6 matches, 6 completions); a random run of 160 hostile requests with no 5xx (`SEED=n` repeats it).
- `e2e/dashboard.spec.ts` (4 tests): the numbers on the screen against the database, KPI cards, the Approve button (a viewer is not offered it and the server refuses it), every action button, card, attention row and fold, the escaped `&` in a project name.
- Demo data: `BASE=http://localhost:3020/api PGDATABASE=rof_demo node docs/demo-seed-dashboard.mjs`; link http://localhost:3020 (`super_admin@demo.local` / `Demo#Pass1234`), the Dashboard is the home screen; the API results of the other two are in the demo database.

Run: `BASE=http://localhost:3010/api node docs/dashboard-recon/api-test-dashboard-recon.mjs` and `cd e2e && BASE_URL=http://localhost:3010 npx playwright test dashboard.spec.ts` (psql must reach the same database).
