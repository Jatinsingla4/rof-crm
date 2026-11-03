# Reconciliation: legacy customer 2191 (Sunita Sundriyal, ROF ALANTE A-101) vs our CRM

Re-run: `node docs/applicant-file-reconciliation/reconcile-2191.mjs` (Node 20; local API `BASE=http://localhost:3010/api`, Postgres localhost:5433 `rof_sec`; idempotent, builds the `RECON2191` data once and re-uses it). It writes the full 158-line comparison to `results.md` and the raw Applicant File to `applicant-file-2191.html`. Ground truth: `legacy-2191-sunita-sundriyal.json`. `TAG=x` builds a separate copy named `RECON2191 x` (used for experiments; `RECON2191 dev1/dev2/dev3` are leftovers, harmless).

Result: **158 figures compared: 71 exact, 60 within Rs 1 (rounding), 27 differ.** Most of the 27 come from 4 root causes (below).

## What was built (all through the API)
Company, project (balcony cap 50,000), Tower A, unit A-101 (carpet 645.743, balcony 121.536, base 2,582,972), GST slabs + BASIC / OTHER CHARGE / PLC mapped 0.5%+0.5%, interest master 15%, 8-row plan (5/20/12.5x6) with due dates by day offsets from booking 18-Dec-2019, 4 mandatory add-on masters at 9%+9%, applicant (PII read from the JSON), booking (rate 4000, `POST /booking` then `PATCH /booking/:id` with receipt 1), receipts 2-9 via `POST /payments/receipts` with the legacy dates, all cleared via `PATCH /payments/receipts/:id/clear`.

## Could not be reproduced exactly (and what was used instead)
1. **Paise on receipts**: `POST /payments/receipts` takes whole rupees only (`receipts.ts:82`, decimals = 0). Receipts 2 and 3 were entered as 533,185 and 332,414 (legacy 533,185.43 and 332,413.57). Booking amount accepts paise (not needed here).
2. **Receipt 9 / add-on (extra) and interest components**: no way to give the "extra" part its own 18% GST (see Defect 3). Entered as one receipt of 151,211 with interest 271 and other-charge part 150,940.
3. **Add-on billing**: legacy bills add-ons separately with no due date. Ours can only bill an add-on on a plan row, so a 0% `possession` row 9 ("Add-on charges") due 05-Oct-2024 carries them. On instalment 8 instead, our system charged 30,530 interest (582 days late), which legacy does not.
4. **Balcony Charge 50,000**: modelled as our Balcony Charge (project cap 50,000, area x rate 1300 would give 157,997). It shows on its own line, not under "Other Charges" (see item 7).
5. **Row 1 due date (18-Dec-2019)**: a plan row with offset 0 gets no due date (`booking.ts:989`, `offsetDays > 0`). Shown as a dash.
6. **Dates**: allotment 2020-08-28, agreement 2020-12-23, registry 2025-04-21, completion 2024-09-20 and the numeric Customer ID 2191 were not set (not part of the money flow; ours shows registration no. `RECO-2026-0001`). Receipt numbers are system generated (legacy `ROF-ALANTE/REC/0129` etc.).
7. Historical receipt dates and booking date in the past **do work** through the API; GST slabs are global and must cover 2019 (a slab 2019-01-01 .. 2026-10-30 was added; the existing 2026-10-31 slab got our rate rows).

## Headline comparison (full line-by-line in `results.md`)
| Item | Legacy | Ours | Diff | Right side |
|---|---:|---:|---:|---|
| Net basic price | 25,82,972 | 25,82,972 | 0 | both (645.743 x 4000 = 2,582,972) |
| Other charges (Balcony) | 50,000 | 50,000 | 0 | both |
| **Agreement value** | 26,32,972 | 27,83,911.54 | +1,50,939.54 | legacy: 2,582,972 + 50,000 = 2,632,972 |
| Add-on charges | 1,27,915 | 1,27,914.86 | -0.14 | ours (20 x 645.743 = 12,914.86; legacy rounds to 12,915) |
| **Total consideration** | 27,60,887 | 27,83,911.54 | +23,024.54 | legacy: 2,632,972 + 127,915 |
| **CGST / SGST each** | 24,677 | 13,162 | -11,515 | legacy (see below) |
| **Total with tax** | 28,10,241 | 28,10,235.54 | -5.46 | legacy: 2,632,972 x 1.01 + 127,914.86 x 1.18 = 2,810,241.25 |
| Interest | 271 | 271 (270.54) | 0 | both (329,121.33 x 15% x 2/365 = 270.51) |
| Total receivables | 28,10,512 | 28,10,506.54 | -5.46 | legacy (2,810,241.25 + 270.51 = 2,810,511.76) |
| Paid | 28,11,055 | 28,10,787 | -268 | ours: the legacy receipt table sums to 2,810,787 (legacy summary is inconsistent) |
| Balance | -543 (and "excess 269") | -280.46 | | correct excess = 2,810,787 - 2,810,511.76 = **275.24**; ours is off by the 5.2 GST rounding, legacy by its own three different figures (543, 269, 275) |

Schedule rows 1-8 (net BSP, other charges, inst amount, cgst, sgst, net due): all inst amounts and due dates 2-8 match; net BSP / other charges are within 0.5 (ours un-rounded 129,148.60 vs 129,149); **CGST/SGST per row are 1 lower from row 3 on (1,645 vs 1,646) and 1 higher on row 1 (659 vs 658)**; totals 13,162 vs 13,165 each. Net BSP total 25,82,972 (ours) vs 25,82,975 (legacy): ours right (5% + 20% + 75% of 2,582,972); legacy rounded every row. Both sum inst amounts to 26,32,975 (3 above the agreement value) because both round per row.
Add-on rows: all 4 match (BOCW 12,914.86 / 1,162.34 vs 12,915 / 1,162; within Rs 1).
Receipts: gross, base, CGST, SGST match within Rs 0.45 for receipts 1-7; **receipt 8 and 9 differ** (Defect 3).

## Verdicts on the legacy file's own inconsistencies
1. Tax Details 24,677 vs Payment Contribution 24,679 vs receipts 24,678.57: schedule GST 13,165 + add-on 11,512 = 24,677 is the arithmetically right billed figure (2,632,972 x 0.5% = 13,164.86; 127,914.86 x 9% = 11,512.34 -> 24,677.2). 24,679 / 24,678.57 are what was collected.
2. Balance -543 vs excess 269: neither is right; receipts 2,810,787 - receivables 2,810,512 = 275 (the 543 uses a lessReceipt of 2,811,055 that is 268 above the receipt table total; 268 is the add-on part paid inside receipt 8).
3. Schedule total 25,82,975 vs 25,82,972: 3 is per-row rounding (0.4 + -0.4 + 6 x 0.5). Net basic price 2,582,972 is right.

## Defects found in our system (with minimal fix)
1. **Agreement Value includes add-on charges with GST** (`booking.ts:1484`: `agreementValue = netBasic + plc + other + addonTotal + balcony`, and `addonTotal` at `:1483` sums `total_amount`, which already has GST). Legacy: AV excludes add-ons; Total Consideration = AV + add-ons (ex-GST). Fix: AV = netBasic + plc + other + balcony; `addonNet` = sum of `amount + increase_amount`; totalConsideration = AV + addonNet; add the add-on CGST/SGST to the tax totals.
2. **GST totals round each component separately, so every row loses about Rs 0.6** (`gst-resolver.ts:90`, `Math.round(comp.amount * cgstPct)` per component, used by `booking.ts:~970` when demands are created). Row 3: 1,614.36 -> 1,614 plus 31.25 -> 31 = 1,645 instead of 1,645.61 -> 1,646. Over the file: 26,324 vs 26,329.72. Fix: sum the component taxes unrounded, round once per demand.
3. **Receipt GST is always the BASIC rate on the whole receipt** (`receipts.ts:162` -> `gst-receipt-split.ts` BASIC only). A receipt carrying add-on (18%) or interest cannot be split right: receipt 9 shows CGST/SGST 748.57 each; legacy 11,493 each (receipt 8: 1,646.71 vs 1,666.06). Tax Details then shows CGST paid 13,914.78 vs 13,162 billed, "balance -752.78". Fix: split `other_charge_amount` (and interest) by their own rate, rest at BASIC.
4. **Applicant File hard-codes receipt EXTRA 0.00** (`booking.ts:2296` and totals row) and interest summary PAID GST / BALANCE GST 0.00 (`booking.ts:1989-1990`); `consumers.ts:731` never selects `other_charge_amount`. Legacy shows extra 128,183.34 and paid GST 3.
5. **Summary GST contradicts its own breakup**: breakup lines (12,915 + 250 = 13,165) but CGST total prints 13,162, because `booking.ts:1493` takes the demand sum whenever it is within Rs 1000 of the holistic figure. Tax Details TOTAL (`booking.ts:1916-1940`) leaves out the add-on GST entirely (legacy 24,677 each).
6. **Overpayment creates phantom "-ADV" receipts dated today** (`payment-waterfall.ts:662`, `CURRENT_DATE`). The 1,325 excess of receipt 2 (and each later row) became 7 pending receipts totalling 9,626 dated 03-Nov-2026 that sit in the receipt list and in the receipt-form "Paid". The excess only moves forward, so row 1 stays 1,327 outstanding (schedule total outstanding 1,327; legacy 0) although the customer is overpaid (`payment-waterfall.ts:288` caps each row at its due).
7. **Receipt Form figures are wrong for a real file** (`payments.ts:1896-1920`): "Total Cost" = unit base price + GST on the booking amount only = 25,84,275.37 (should be 28,10,241); "Paid" 28,20,413 counts pending ADV receipts; "Balance" -2,36,137.63 (legacy -543 / correct +275 excess).
8. **Receipt API rejects paise** (`receipts.ts:82`) although legacy receipts carry paise; `interest` rows therefore show residuals such as 0.43 / 0.34 on instalments.
9. Plan row with offset 0 has no due date (`booking.ts:989`), so the first row shows a dash and cannot take late interest.
10. Cosmetic raw values: payment mode `Bank_transfer`, gender `female`, marital status `not_specified`, Nationality N/A.

No `NaN`, `undefined` or `null` strings appear anywhere in the generated Applicant File.

## Shown by legacy but not by our Applicant File
Agreement value per sq.ft. (4,077.43; 2,632,972 / 645.743 = 4077.43, correct), Excess Received Amount line, Registry date, numeric Customer ID, Payment Mode "Self"/Comm mode shown but as raw text, Scooter Parking free-qty row, paid GST on interest, EXTRA column values, a separate "Other Charges" total that includes Balcony (ours splits Balcony onto another line and the schedule has a separate Balcony column), add-ons shown without due date.

## Fix order of value
Defect 1 and 2 (headline totals), 3 (GST split and Tax Details), 6 (phantom receipts and wrong outstanding), 7 (receipt form).
