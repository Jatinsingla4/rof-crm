# Addon Charges (Set Projects → Charge Master → Addon Charges)

Five screens, one API (`/api/addon-charges`): Extra Add On Charge Master, Set Extra Add On Charge, Set on Bulk Customer, Cancel, Waiveoff.

**How it fits together.** A *master* is a charge a project can bill (flat amount, or ₹ per carpet sq ft, plus CGST/SGST). *Payment Plan Setup → Add-on %* says which instalments carry how much of it. A customer's charge is a copy of the master at their price. Every add, edit, cancel, waive or master change recalculates that customer's demand rows (`addon_charge_amount`, CGST, SGST). Booking also adds plan add-ons on its own and uses the same recalculation.

**Rules (checked in code, `routes/addon-charges.ts`)**
- Everyone signed in can read. Master changes need Set Master permission (create/edit; delete = super admin). Giving, editing, cancelling or waiving a customer charge needs payments "edit" (super admin, project manager, accounts finance).
- Names plain text ≤200 and unique per project (any letter case); amounts 0 – 100 crore with ≤2 decimals; GST 0–50% each; text, `1e3`, negatives, arrays, true are refused with a message.
- A customer needs an active booking in the project; the master must belong to the project and be switched on; the same charge cannot be active twice for one customer (edit it instead). A waived or cancelled charge can be added again.
- Only an **active** charge can be edited, cancelled or waived (so no double cancel, no waiving a cancelled charge). Waive needs a remark. Edit keeps the old amount / increase / remark when you do not send them (before, a missing amount became 0).
- Master edit updates all active customer charges (keeping each customer's increase) and their demands; per-sq-ft masters price from each customer's own unit. Deactivate cancels the active customer charges. Switching a master off through Edit is refused (use Deactivate).
- One customer's changes run one at a time (advisory lock) and two admins editing the same master lock customers in a fixed order, so double clicks and parallel saves cannot double-count or deadlock. Everything is audited (master and customer charge, old and new values).
- Demand recalculation now only reads the plan of the same project (case-insensitive name).
- Migration 105 adds unique indexes for the two duplicate rules (skipped with a NOTICE if live data already has duplicates).

**Money already received (frozen demands).** A demand is frozen when it is marked paid or has a receipt that is not bounced/cancelled (a pending cheque counts; a receipt with no instalment does not; cancelled demands are skipped). Its add-on figures never change.
- Add or raise a charge: the share that belongs on a frozen instalment is billed on the next unpaid one, and the screen says so (`note`). If every instalment is paid the change is refused ("raise a separate demand").
- Cancel, waive, lower, or lower/deactivate the master when a frozen instalment already carries that add-on: refused with the instalment number; accounts issue a credit note or refund. For master edits it is all-or-nothing and the message names the customers.
- A bounced or cancelled receipt unfreezes the demand. Saving the same value again changes nothing and shows no note.
- Known small gap: a receipt saved in the same instant a change is being saved is not seen by that change (the check and the update are one transaction, receipts are not locked by it).

**Check it:** `docs/addon-charges/api-test-addon-charges.mjs` (152 checks incl. 20 on frozen demands (paid, pending/bounced/cancelled receipts, all paid, master cut and deactivate, parallel raises) and 8 parallel adds → 1, 6 parallel master creates → 1, cancel/cancel/waive race, demand totals, cascade, audit). Demo data: `docs/demo-seed-addons.mjs`.
