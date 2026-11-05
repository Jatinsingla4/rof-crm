# Finance part B: every pending financial handler, what protects it today, and the decision Finance has to make

**Status: PROPOSAL for Finance. Nothing in the "proposed behaviour" column is approved or implemented.** Source: the code at HEAD (routes, mounts and the `rbac.ts`
matrix read directly) and plan section 5.4 B and C (v6 copy, see `00-plan-integrity.md`). No data was read; no application code was changed.

## What is already done (part A) and what this table is about
Part A (every route that already had a request step and a checker step) is strict: nobody, including super_admin, approves, rejects, processes, completes
or cancels what they created (commit `5bbcab9`, tests receipts 283, tds 246, broker-hold 569, payments-rest 1,006). This table covers the handlers
that have **no request-and-approval stage at all**: one person can do the whole financial action alone.

## Who can call a route today (from the code)
| Mount or guard | Roles that pass |
|---|---|
| `payments` POST (create) and PATCH or PUT (edit) | super_admin, project_manager, accounts_finance |
| `payments` DELETE | super_admin only |
| `allocations` create or edit (also surrender, transfers, registry) | super_admin, project_manager |
| `consumers` create or edit (also loans; the booking router guard) | super_admin, project_manager, sales_executive |
| `financeOnly` (inside the handler) | super_admin, accounts_finance |
| GST configuration, every non-GET | super_admin, accounts_finance |
| `requireProcess('x','maker' or 'checker')` | a login holding that process right (super_admin passes) |
"A second person" below means a different login who approves before the action takes effect. **None of the rows in group B has one today.**

## Group B: policy-approved scope, each needs a request, an independent approval, then the effect
| # | Route (file) | What it does today (from the code comment) | Who can call it today | Proposed behaviour (proposal) | The exact decision Finance must make |
|---|---|---|---|---|---|
| B1 | `POST /api/payments/interest-waivers/direct` (`financial-ops.ts`) | Waives interest in one step; the caller acts as checker | payments:create, plus the `interest_waiver` checker right | Retire it: the existing pair request (`/interest-waivers`) and approve is already maker then checker | Is a one-step waiver by a checker ever needed? If yes, which second approval or limit replaces the second person? |
| B2 | `POST /api/payments/receipts/:id/cancel` (`payments.ts`) | Cancels a receipt and reverses the demand payment state | payments:create | Maker requests the cancel, a checker approves, then it applies | Who may request and who may approve; which receipt statuses (pending, authorized, cleared) may be cancelled here and which must go through a return (plan 5.7, F1 to F17); an amount limit? |
| B3 | `PATCH /api/payments/demands/:id/cancel` and `.../demands/bulk-cancel` (`demands.ts`) | Cancels one demand, or many at once | payments:edit | Request then approval, at least for bulk | One demand or only bulk? an amount or count threshold above which a checker is required? |
| B4 | `POST /api/payments/demands/generate`, `PATCH .../demands/activate`, `PATCH .../demands/:id/send` (`demands.ts`) | Generates demands, activates them, sends them (taken from the route names; the effect on receivables is for Finance to confirm) | payments:create or edit | Classify; proposed: generate and activate need a checker if they create a receivable, send stays an audited action | Does raising or activating a demand create a receivable that needs a second person, or is it operational? |
| B5 | `PATCH /api/addon-charges/consumer/:id` (edit), `.../cancel`, `.../waive` (`addon-charges.ts`) | Changes, cancels or waives a customer's add-on charge | payments:edit | Edit, cancel and waive change what the customer owes: request then approval; the charge masters stay administrative edits | Same for all three, or only cancel and waive? is a master-rate change administrative? |
| B6 | `POST /api/payments/outgoing-payments` (`outgoing-payments.ts`) | Records a payment out of a company bank account | payments:create | The record needs a checker's approval before it counts | An amount threshold, or every payment? who is the checker? |
| B7 | `POST /api/surrender` and `POST /api/surrender/restore` (`surrender.ts`) | Surrenders a booking (settles the money) and restores it (puts the applicant, booking, allocation, unit, demands and commissions back) | allocations create or edit | Surrender is requested, a checker approves; restore needs a checker too | Who approves (Finance or the project manager's superior)? same rule for restore? |
| B8 | `POST /api/allocations/:id/cancel` (`allocations.ts`) | Cancels an allocation; the applicant forfeits up to 29,500 (25,000 plus 18% GST) and is refunded the rest; stops booking, demands and commissions | allocations create | Request then approval | Who approves; is the forfeit amount fixed or Finance's to confirm per case? |
| B9 | `POST /api/booking/:id/cancel` (`booking.ts`) | Withdraws a booking that was started but never completed (no payment step, no demands); a completed booking is cancelled through surrender | the booking router guard (consumers create or edit) | Stays an ordinary audited action: by the code comment it has no financial effect | Please confirm it has no financial effect (then no second person is needed) |
| B10 | `PATCH /api/reconciliation/transactions/:id/match`, `.../unmatch`, `.../ignore` (`reconciliation.ts`) | Links a bank line to a receipt or demand by hand, undoes it, or marks it "not a customer payment" | payments:edit | Proposed: a checker for match and unmatch of a cleared receipt; ignore audited | Is a reconciliation link a "ledger position" that needs a second person? |
| B11 | `PATCH /api/payments/consumer-interest-date/:id`, `POST .../manual-interest`, `PATCH .../consumer-grace-period/:id` (`payments.ts`) | Sets the interest start date (removes stale calculated interest), inserts a manual interest record, sets grace days | `financeOnly` (super_admin, accounts_finance) | Request then approval: each changes the interest the customer owes | All three, or only manual interest? |
| B12 | `DELETE /api/payments/consumer-interest/:id`, `DELETE .../interest-scheduler` (`payments.ts`) | Deletes all stored interest of an applicant (manual entries too), or of a project (manual entries stay) | super_admin (payments:delete) | Request then approval | Deleting stored interest: a second person always? |
| B13 | `POST .../consumer-interest-detail/:id`, `POST .../calculate-interest`, `POST .../interest-scheduler` with `persist` | Recalculates interest from the stored rules and saves it | payments:create (the interest-scheduler persist path is accounts and finance only, per its route comment) | Stays an audited action: the result follows from stored rules, not from a typed amount | Please confirm recalculation needs no second person |
| B14 | `POST /api/projects/:id/timely-discount/run` (`projects.ts`) | Raises the credit notes for installments paid on time. A checker's note step still follows unless the project's journal authentication is "Automatic" | the `jv_refund_drcr` maker right | Keep the maker step; decide whether "Automatic" may remove the second person | May a project setting switch off the second person for money-reducing notes? |

## Group C: borderline, plan 5.4 C ("administrative edits stay ordinary audited edits")
| # | Route (file) | What it does | Who can call it today | Proposed behaviour | Decision Finance needs |
|---|---|---|---|---|---|
| C1 | `POST /api/payments/payment-plans` (`payments.ts`) | Creates the standard 8-step payment schedule for an allocation | `financeOnly` | Audited edit, or checker if the schedule fixes amounts due | Does the schedule fix what the customer owes? |
| C2 | `POST /api/payments/gst-invoices` (`payments.ts`) | Creates a GST invoice (tax worked out by the server) | `financeOnly` | Creation is the maker step: cancel and reverse already need a different person (part A) | Anything more needed on creation? |
| C3 | `POST /api/payments/interest-master`, `PUT .../installment-interest/:project/:plan` (`payments.ts`) | Sets the interest rates (project, per installment) | `financeOnly` | A rate change affects interest going forward: checker proposed | Are rate changes policy edits (audited) or money edits (checker)? |
| C4 | `PATCH /api/milestones/:id/complete` (`milestones.ts`) | Marks a construction milestone 100% complete, once only | payments:edit | Audited edit | Does completing a milestone trigger demands or notices that carry money? |
| C5 | `PATCH /api/transfers/:id`, `POST /api/registry/schedule`, `POST /api/loans` | Edit a transfer record, schedule a registry date, record a loan sanction | allocations edit or create; consumers create | Audited edits | Do they change amounts or only status and dates? |
| C6 | GST configuration (19 non-GET handlers, `gst-configuration.ts`) | Tax slabs and rates | super_admin, accounts_finance | Audited edit, or checker for rate changes | Is a tax-rate change a policy edit or a money edit? |

## Also open, not a handler: the receipt return and bounce workflow
Plan 5.7 proposes a linked reversal with an independent checker; it needs Finance's written answers to **F1 to F17** (partial returns and the amount basis, the cap, simultaneous
requests, component allocation, GST treatment, bank charges, demand reopening, TDS release, reconciliation, as-of dates, the collected-money formula, pending requests in totals,
reuse of a returned receipt's reference, bounced receipts in the four `!= 'cancelled'` queries, interest recomputation, editing authorized receipts, legacy bounced-after-cleared rows) and
the architecture choice of 5.9 (a shared request envelope, optional M12, against separate tables). These are not repeated here; plan lines 286 to 321 of the v6 copy.

## Three global questions that make the rows above quick to answer
1. **Threshold or always?** For each "request then approval" row: every time, or only above an amount or count Finance names?
2. **Who is a checker?** The holder of which process right (for example `jv_refund_drcr` checker), or a named role? super_admin may act on **another** user's request but never on their own (policy).
3. **Break-glass.** The policy says there is none (no single-person override). Confirm it also applies to month-end or to a sole Finance person.

## How to review this table
Take one row at a time. In your own copy write next to each row **A** (needs a request and a second person), **E** (ordinary audited edit, no second person) or **R** (retire the route), and
for A rows a threshold and the checker role. Rows B9 and B13 are expected to be **E**; B1 is expected to be **R**. Check the "Who can call it today" column against what you know: if a role is listed that
should not be able to do it, that is a separate finding. The table is generated by reading the routes, so a row where the description looks wrong should be reported rather than assumed.
