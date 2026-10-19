# Payment Plans (Set Projects)

Checked by running it: `api-test-plans.mjs` (176 checks) and 3 browser flows in `e2e/flows.spec.ts` (section 11).

## What it is
A plan = rows sharing (project, plan name). Booking turns each row into a demand: price x percentage. So a plan must add up to exactly 100% to be booked.
Page: `#/payment-plans` (menu: Set Projects, Payment Plan Setup: Plans, New Plan). Old `#/set-projects?tab=plan-*` links open it.
The 10 old menu entries were one editor under different names. "Edit Personal Installment" and "Personalise Installment" did nothing, so they are gone (a per-customer schedule change is a Demand feature, not built).

## Rules (server)
- Row: name (100, plain text), type (booking, installment, plc, possession, other_charge), percentage 0 to 100 with up to 3 decimals, due days 0 to 3650, order number 1 to 999. Other charge needs a fixed amount and has no percentage.
- Numbers must be real numbers or plain digits ("1e2", "0x10", " 5 ", [5], true are refused). Names refuse line breaks, control characters and text-direction tricks.
- Rows of one plan: no repeated name (any letter case) or order number; the total cannot pass 100%, also when editing. Plan names that differ only in letter case are one plan.
- All writes of a plan run under one lock, so two requests at once cannot pass 100% or repeat a name/number. Migration 103 adds unique indexes too (skipped with a notice if old data already repeats).
- A plan that a live booking uses is frozen (percentage, amount, type, due days, order, adding or deleting rows, add-on %). Names and notes can still change. Make a copy instead.
- Booking: the form lists only plans of exactly 100%; completing a booking on any other plan is refused with the reason.
- Roles: super_admin everything; project_manager add, edit, copy; only super_admin deletes; sales_executive and viewer get Access Denied (and 403 from the API). Add-on % rows must belong to the same project's add-on charges.
- Every add, change, copy and delete is in the audit log.

## Also fixed
Edit could push a plan past 100%; due days 0 was ignored on edit; add-on rows were not tied to the project; the standard 9-row plan was loaded by 9 separate calls (a failure left half a plan), now one transaction.

## Not done
Charge Master, Add-on Charges screens, GST, Rate Report (next). A plan used by an old booking whose status is not cancelled stays frozen until that booking is cancelled.
