# CRM module (tasks, automation, communications, calling, campaigns, inbox, leads)

Checked in depth: code read first, then roles, hostile input, project scope, races, a random run, and every control of the screens in a real browser.

## What belongs to this module

| Screen | API | Permission (resource) |
|---|---|---|
| Tasks | `/api/tasks` | `consumers` (sales and pm create and edit, only super_admin deletes) |
| Automation | `/api/automation` | `communications` (was `reports`, see below) |
| Communications, WhatsApp / Facebook / Instagram inbox | `/api/communications` (`/messages`, `/:id/send`, `/emails`, `/whatsapp`, `/sms`, `/ai-suggestions`, `/:id/ai-draft`) | `communications` |
| Calling list, dialer | `/api/communications/calling-list`, `/status-codes`, `/log-call`, `/remarks/:id` | `communications` **or** `calling` |
| Campaigns | `/api/communications/campaigns` (+ `/launch`), `/broadcast` | `communications` |
| Support tickets | `/api/communications/tickets` | `communications` |
| Leads | `/api/consumers` (the Applicants module) | `consumers` |

Project scope is in the database (row level security on `consumers`, `communications`, `remarks`, `tasks`, `call_logs`, `support_tickets`, `broadcast_campaigns`), so a login of project A sees nothing of project B on any of these.

## What was wrong, and what was done

Real bugs (all fixed, each has a check in `api-test-crm.mjs` or `e2e/crm.spec.ts`):

1. **SQL injection in every list.** `LIMIT ${pageSize} OFFSET ...` put the query string straight into the SQL (tasks, automation, remarks, tickets, thread). Now `paging()` (whole numbers, a maximum) and bound values.
2. **No validation anywhere.** A bad id was a 500, `status`, `priority`, `channel`, `trigger`, `action` were free text (the allowed words were only SQL comments), dates, lengths and lists were not checked. Now every field goes through `utils/input.ts`; unknown or wrong values give a clear 400/404, never a 500.
3. **Messages were recorded as "sent" but nothing is sent.** There is no email, WhatsApp or SMS sender anywhere in the code (the email worker is never started by a route). A message is now recorded as **queued** and the answer and the screen say that nothing has left the system. A customer with no email (or no mobile) is refused (409) instead of a "sent" row with an empty address. The same text to the same customer on the same channel within 15 seconds is refused (a double click, also five parallel sends make one row).
4. **Automation rules run nothing.** "Run Now" only counted and answered "queued for execution"; the screen said "Rule executed successfully". It still only counts, but the answer says "marked as run, nothing was sent", and a switched-off rule cannot be run (409).
5. **Wrong permission resource.** Automation sat under `reports` (accounts_finance could create rules, a project manager could not change one). Now `communications`. The calling list and "log call" needed `communications` create, but finance (the collection team, who have `calling`) only had `communications` view: finance could not log a call. They can now (`calling` OR `communications`).
6. **Inbox screens and the Communications overview asked for tickets.** WhatsApp / Facebook / Instagram inbox and the Communications tabs called `GET /tickets?channel=...` (support tickets, no channel, no message), so no conversation could ever show and "Total Messages" counted tickets. New `GET /communications/messages?channel=` (with the customer name), the four screens use it.
7. **Campaigns:** the project was optional and the API quietly used the first project in the database (a campaign for the wrong project). Now the project is required (the screen asks for it). The "Launch" button called a route that did not exist; `POST /campaigns/:id/launch` now exists (draft to queued, the recipients counted from the project, segment and contact, five parallel launches make one, a draft that reaches nobody is refused). The create button said "Launch Campaign" but only saved a draft, and a "Schedule Later" choice was ignored by the server: the button is now "Save Campaign (draft)" and the schedule choice is removed. The segment was thrown away; it is now stored (migration 120). A queued or completed campaign cannot be deleted (409), a draft can. `broadcast` with no channel or no message used to be saved empty.
8. **Project pickers built from units.** Campaigns and Leads built their project list from the first 300 units, so a project with no unit yet (or beyond 300 units) could not be chosen or filtered. They now read `/projects`.
9. **Task priority was never sent.** The Normal / High / Urgent buttons on the task form were ignored, every task was Normal.
10. **Calling:** the "Customer status" filter sent a label ("Allottee") that was compared with the stage word (`allotted`), so it found nobody; now mapped (Lead, Applicant, Allottee, Registry Done, Cancelled; raw stages also work). An unknown value gave a 500 (enum). `%` and `_` in a name search matched everything (now escaped). The Employee filter was ignored (now: customers this employee has called). The list had no limit (now 2000). A logged call went to `call_logs` but the dialer history reads remarks, so a logged call never showed in the history: a call is now also written as a remark. The call time was the start of the transaction (after a lock wait the order of the log and the customer record could differ): `clock_timestamp()` after the lock.
11. **Markup in texts:** inbox, tasks, rules, campaigns, calling and communications screens put customer names, messages, task titles and remarks into the page unescaped. All now go through `Utils.esc`, and the API refuses `<` and `>` in new texts (the same rule as Applicants).
12. A promise-to-pay date or a next-call date in the past is refused (a typo, not a promise). A status that is not in the status-code list is refused (it was an FK error, 500).

Database: migration `120_crm_checks.sql` adds `CHECK` constraints for tasks (status, priority), rules (delay 0 to 525,600 minutes), communications (channel, status), tickets (status, priority) and campaigns (channel, status), all `NOT VALID` (old rows are left alone, every new or changed row is checked), and `broadcast_campaigns.segment`.

## On purpose not done

- **No real sender.** Connecting an email, WhatsApp or SMS provider, and an automation engine that runs the rules, is a product decision (provider, cost, templates) and not a fix. Until then messages are "queued" and rules only count. `milestones.ts` (milestone notifications) still writes `communications` rows with status `sent`; that belongs to the Milestones module.
- The Payment Plan filter on the Calling screen is not sent by the screen (there is no `paymentPlan` filter on the API either); left as is.
- The Tasks screen shows the delete button to everyone; only super_admin can delete (the others get a clear 403 message).
- `email-templates` (documents), `analytics` and `help` screens are not part of this pass.

## Tests

- `docs/crm/api-test-crm.mjs`: 285 checks. Own data (two projects, customers with and without email and mobile, project-scoped logins), every route by every role and with no login, hostile input per field (empty, blank, wrong type, list, object, too long, `<script>`, SQL, zero-width, bad and unknown ids, `2026-02-30`, `1e3`, fractions, negatives), double click and parallel races (completes, runs, sends, log-call, status changes, launches), project scope, the honest status of a message, the database check afterwards, and a random run of about 400 requests with junk in every field that must never give a 5xx. `SEED=n` repeats a random run.
- `e2e/crm.spec.ts`: 18 tests in a real browser, every control of Tasks (form, priority, tabs, checkbox, delete), Automation (modal, Run Now, Run All, switch, delete), Campaigns (modal, no project, save draft, Launch), Communications (every channel tab, send, no customer, no email, AI Draft), the three inboxes (threads, other channels do not leak, markup shows as text), Calling (every filter option, every text filter, the dialer, a past date refused, history), and Leads (every filter option, Kanban / Table, stage tiles, search). A JavaScript error, console error, 5xx or `undefined` / `NaN` on a screen fails the test.
- Demo data: `BASE=http://localhost:3020/api PGDATABASE=rof_demo node docs/demo-seed-crm.mjs`. Local demo link: http://localhost:3020 (`super_admin@demo.local` / `Demo#Pass1234`), menu CRM.

Run: `BASE=http://localhost:3010/api node docs/crm/api-test-crm.mjs` and `cd e2e && BASE_URL=http://localhost:3010 npx playwright test crm.spec.ts` (psql must reach the same database).
