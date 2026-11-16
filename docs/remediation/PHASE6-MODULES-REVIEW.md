# Phase 6: remaining financial modules, what was checked, what changed, what waits

Scope of the brief: broker commission and payout eligibility, interest, unit reservation, transfers, surrender and refund, parking and add-ons, payment validations, error handling, pagination. BR-12 and BR-13 only where approved rules exist (none give rates).

## Broker commission and payout

Checked by running flows (`docs/remediation/api-test-commission-payout.mjs`, 16 checks):
- The amount is base price x rate (2% of 30,00,000 = 60,000) or a flat sum kept to the paisa.
- Payout maths is right to the paisa: GST and TDS from the broker's tax setup (60,000 + 10,800 - 3,000 = 67,800; GST-exempt broker; no PAN means at least 20% TDS; 12,345.67 gives GST 2,222.22, TDS 617.28, net 13,950.61). A broker with no tax setup is refused with the reason. A second payment is refused. A cancelled booking's commission is cancelled and cannot be paid.

**Defect found:** a commission was paid (net 67,800) on a booking with **no cleared money at all**. The booking only had to be active/complete, and the booking amount is a pending receipt until a checker clears it.

**Change, behind a flag that is OFF:** `commission_requires_cleared_v1` (a row in `global_settings`; absent means off). With it ON the booking amount must have cleared, counted the BR-03 way (cleared, not an advance, less approved returns), else 409 with the reason. With it OFF nothing changes, and `GET /booking/reconciliation` already lists paid commissions with no cleared receipt behind them (`commissions_paid_with_no_cleared_receipt`).
Why a flag: "paid once the booking amount has arrived" was the rule the existing suites encode (569 broker checks pass unchanged with the flag off). Whether "arrived" means cleared is for the owner and finance to confirm. Production activation is not done.

## Pagination

**Defect found:** `GET /booking`, `/payments/receipts`, `/units`, `/users` and `/users/audit-logs` page their rows but never said how many there are, so a screen cannot tell it is showing part of a list (the same class as the demands list fixed earlier). They now return `pagination: { page, pageSize, total }`, the shape `/consumers` and `/payments/demands` already use. `docs/remediation/api-test-pagination.mjs` (34 checks over seven lists): total present, the same for every page and size, equal to the whole list, no repeated row between pages, empty page past the end.

Not changed: some screens ask for a fixed page and would now be able to show a warning, but do not yet (`booking.js` units pageSize 500, `allotment.js` 300, `gst-invoicing.js` receipts 50, users 50). A project with more units than the page would still show only the first rows in those pickers. Several report endpoints return every row whatever pageSize says (receipt-wise collection, bank ledger, booking record, all applicants, customer due summary); that is by design of those reports, not a defect found here.

## Reviewed, no change needed

- **Surrender / cancellation:** forfeiture and refund together cannot exceed the cleared money received less approved returns (the code reads it that way and the suite checks it). Money is not moved by the surrender itself; the refund screens do that.
- **Interest:** the preview endpoint and the simple 365-day basis were added and tested in earlier phases (BR-11).

## Not done in this phase

- **Unit reservation (BR-09):** blocked, the number of days N was never given.
- **BR-12 / BR-13:** blocked on the tax advisor; `tax_rate` stays empty; no statutory rate is set.
- **Transfers, parking and add-on charges:** not re-examined in this phase beyond the existing suites passing (transfers, parking-import, addon-charges run in the regression chain). No new defect was looked for there.
- **Error handling:** no new sweep was run; the existing hostile-input checks in the suites pass.

## Decisions needed

| # | Question | Today |
|---|---|---|
| D9 | May a broker commission be paid before the booking amount has CLEARED (BR-03 counts only cleared money as collected)? | Allowed (flag off). Turn on `commission_requires_cleared_v1` once finance agrees, after reading the reconciliation list of commissions already paid without cleared money. |
| D10 | For paid commissions on bookings later cancelled, recovery from the broker is only a note (existing behaviour). Is a receivable / recovery entry wanted? | Note only. |
