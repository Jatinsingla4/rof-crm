# Demands

A demand is one instalment of a customer's payment plan. It is made when a booking is completed (or by "generate"), stays **pending**
until somebody **raises** it with a due date, can be marked **sent**, and becomes **paid** when receipts cover it.
Status values: `pending` → `demanded` → `paid`; `cancelled` is set by a surrender. (Old seed data also holds `raised`; every route treats it as `demanded`.)

All routes are under `/api/payments` and live in `packages/api/src/routes/demands.ts` (moved out of `payments.ts`).

## Who can do what
| Role | Read lists | Raise / unraise / send / generate |
|---|---|---|
| super_admin, project_manager, accounts_finance | yes | yes |
| sales_executive, support_agent, read_only_viewer | yes | no (403) |

## Routes
| Route | What it does |
|---|---|
| `POST /demands/generate` | Creates the missing pending instalments of a plan from its template (`consumerId` or `projectId`, optional `planName`). Skips plans whose booking is cancelled; reports plans it could not use in `skipped`. Safe when run twice or at the same moment (locked per plan). |
| `GET /demands` | Filtered list (customer, project id/name, tower, floor, unit, instalment, status, due and raised dates). `page` 1–100000, `pageSize` 1–1000. Each row has `total_paid` (that instalment's share of the receipts) and `balance`. |
| `GET /demands/by-stage` | Stage × tower counts for the Stage Wise grid (`projectId`). Cancelled demands are not counted. |
| `PATCH /demands/activate` | Raises `demandIds` with `installmentDate` (the due date, not before yesterday). Each demand is raised only when it is pending and no earlier instalment of the same plan is still pending; the others come back in `skippedIds` with a reason. Oldest instalment first, whatever the order of ids. |
| `PATCH /demands/bulk-cancel`, `PATCH /demands/:id/cancel` | Unraise: back to pending, due date, sent time and raiser cleared. Only raised demands; others are reported as failed. Optional `reason`. |
| `PATCH /demands/:id/send` | Notes that the letter was sent (`sentVia` or `channel`, ≤50 characters). Only a raised demand. |
| `GET /demand-status` | One row per customer and booking with demand counts and totals (cancelled demands left out). |
| `GET /:paymentPlanId/demands` | The demands of one plan. |

## What was wrong before (read from the code, then fixed)
- `pageSize`, `page` and `limit` were written straight into the SQL text (`pageSize=1;drop…`); now whole numbers inside a range, everything else 400.
- Raising worked on **any** status: a paid demand was raised again and a cancelled (surrendered) demand came back to life. Now only pending demands are raised.
- Raising was order-dependent: stage 2 sent before stage 1 in one call was skipped. Now sorted oldest first.
- The "earlier instalment pending" check looked across all the customer's units; now only the same plan.
- Two people raising or unraising the same demand at once could both succeed; rows are now locked.
- Bad ids and dates gave 500 or "Invalid Date"; the tower-name filter used a column that does not exist (500). `%` and `_` in search boxes matched everything; now escaped.
- `raisedTo` ignored the whole of that day; now inclusive.
- `POST /demands/bulk` (inserted a zero-amount instalment 0 for every plan of a project, used by no screen) is removed.
- Generate could create duplicates when run twice at once, used the wrong booking when a customer had several, and silently did nothing for plans without a template.
- Send worked on pending demands and cancel/send/raise left no audit trail; unraise now also clears the sent time. Every change is in `audit_logs`.
- Demand Status counted a customer's demands once per booking row and counted cancelled demands as due.
- The Stage view could list the same demand id twice.

## Tests
`node docs/demands/api-test-demands.mjs` (186 checks, sets up its own project, units, plans, GST slab and customers, and removes them):
roles, bad input for every route, stages and states, 8-way races for raise and unraise, generate twice, filters, status page totals, random junk input (70 rounds), and the earlier money screens.

Demo data for http://localhost:3020: `node docs/demo-seed-demands.mjs` (after `demo-seed-bookings.mjs`).

## Not changed
- "Send" only records that a letter was sent; it does not email anything.
- The dashboard demand block (`/api/dashboard/demand-status`) still counts every demand; it belongs to the Dashboard pass.
- Unraising a demand that has receipts on it is allowed (receipts stay; the money is not lost).
