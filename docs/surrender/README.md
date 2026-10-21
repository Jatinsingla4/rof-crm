# Surrender and builder cancellation

A **surrender** is the applicant giving the unit back; a **cancellation** is the builder cancelling. Both stop the booking and free the unit; a **restore** undoes them.
Routes: `packages/api/src/routes/surrender.ts` under `/api/surrender`. Migration `114_surrender_restore_state.sql` stores what a surrender changed, so a restore puts back exactly that.

## Who can do what
| Action | Who |
|---|---|
| Find an applicant, open the account, list surrenders / cancellations | every signed-in role |
| Surrender, cancel, restore | super_admin, project_manager (allocations create); sales_executive, accounts_finance, support_agent and read_only_viewer get 403 |

## What a surrender / cancellation does (one transaction, allocation + unit + applicant locked)
- Allocation → `cancelled`; applicant → stage `cancelled` and **no longer linked to the unit**; booking → `cancelled`; unit → `temp_surrender` (surrender) or `available` (builder cancellation).
- Every demand of this unit's plan that is still to be paid (pending / overdue / demanded, whatever its type) → `cancelled`; paid demands stay as history. Pending broker commissions of the booking → `cancelled`.
- A record is written (`surrender_applications` or `cancellations`, refund status `initiated`) with the amounts, mode, reason, NOCs, and the old state; one audit row.
- Money received is **not** moved; the refund is handled by the refund screens (Cancellation refund initiate / complete).

## Rules
- Allocation must belong to the applicant and not be cancelled or transferred; unit, project and booking, if sent, must match the allocation (the ids are checked against each other, not trusted).
- Forfeiture cannot exceed the cleared money received, and forfeiture + refund cannot exceed it (₹1 tolerance), as the account screen counts it.
- Type: `surrender` or `cancellation`. Surrender type: voluntary, refund_case, non_refund, partial_refund, builder_cancellation. Refund mode: cash, draft, cheque, online, neft, rtgs, upi, bank_transfer, demand_draft. Date not in the future. Amounts 0 to 1,000 crore with 2 decimals; the total may be negative (refund due) and is rounded to paise. The yes/no switches must be true/false.
- Restore: the record must still be `pending` / `approved` (surrender) or refund `initiated` (cancellation); the allocation must still be cancelled; the **unit must still be where the surrender left it** (nobody booked, held or allotted it meanwhile), and the applicant must not own another unit. Then the allocation, applicant stage and unit link, booking, unit status, demands and commissions go back to what was stored. Old records without stored state fall back to the earlier behaviour (booking `complete`, allocation `allotted`).

## What was wrong before (read from the code, then fixed)
- **The "transaction" was not one**: it called `BEGIN` / `COMMIT` on the connection pool, where every statement can run on a different connection, so a failure half way left a half surrender, and two requests could interleave. Now a real transaction with locks.
- **No role check**: a read-only viewer could surrender or cancel anyone, and restore. Now allocations access is required.
- **The ids were trusted**: any applicant id could be sent with someone else's allocation, booking and unit; the wrong unit could be freed. Now they are checked against each other.
- The same allocation could be surrendered twice (two records, two sets of changes), also at the same moment. Now 409, one record in total (also between a surrender and a cancellation).
- Forfeiture and refund were unchecked (negative, bigger than the money received); the screen's cancellation refund was stored in a whole-rupee column. Amounts, dates, types and modes are checked now; the cancellation columns keep paise.
- The applicant stayed linked to the unit after a surrender (the unit link was never cleared), so a surrendered applicant could still be "the owner" in transfers. Now cleared, and put back on restore.
- Only demands of type "installment" were cancelled, other demand types (booking amount and the like) stayed live; a builder cancellation cancelled demands but kept no list of them, so they could never come back. Now all unpaid demands of the unit are cancelled and remembered, for both kinds.
- **Restore trusted the page**: it could restore a booking as `complete` that was only a draft, restore a cancellation whose refund was already paid, restore a second time, or restore after the unit had been sold to someone else (two owners of one unit). Now state is checked and the unit must be free.
- Names showed blank for applicants saved with a single name field. The lists fall back to that name.

## Tests
`node docs/surrender/api-test-surrender.mjs` (183 checks, own project / units / plans / applicants, cleaned afterwards): roles, bad input for every route, ids that do not match, what changes, paid demands stay paid, restore with the unit taken meanwhile, 5-way and 6-way races, a surrender and a cancellation at the same moment, cancellation with the refund paid, lists, random junk (70 rounds), the earlier screens after a surrender and a restore, and a transfer after a restore.
Demo data for http://localhost:3020: `node docs/demo-seed-surrender.mjs`.

## Not changed
- Surrender "approval" (the `approved_by` / `approved_at` columns) is not used by any screen; a surrender is effective at once, as before.
- The second cancel route, `POST /api/allocations/:id/cancel` (flat ₹29,500 forfeiture, waitlist promotion), belongs to the Allocations pass.
- The account screen counts cleared receipts only; money received by a cheque still pending is not in "received".
- The refund itself (`/api/payments/cancellations/:id/refund/...`) is untouched.
