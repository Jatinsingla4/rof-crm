# Core Logic Reference

Verified against actual source on **2026-08-18**, by reading every file cited below fresh in this
session (not from memory). This document is a snapshot of business logic that is **currently
correct and working** in `rof-crm`, written before starting a 20-item client fix list, so nothing
already-correct gets accidentally broken.

Where the code disagrees with the pre-written brief this document was commissioned from, that
drift is flagged explicitly and loudly — search for **"DRIFT"** to find all of them. Four were
found.

---

## SECTION 1 — GST ON DEMANDS (the invoice/installment side)

**File:** `packages/api/src/utils/gst-resolver.ts`

### `resolveRate(db, projectId, projectName, chargeType, bookingDate)` — lines 11–70

Looks up `{cgstPct, sgstPct}` (returned as **fractions**, e.g. `0.005` for 0.5%) by joining:

```
gst_tax_charge_mapping (project_id + charge_type)
  → gst_slabs (from_date <= bookingDate <= to_date)
  → gst_tax_setup (cgst_pct, sgst_pct)
```

- If no row is found and `chargeType !== 'BASIC'`, it **falls back to the BASIC rate** for the
  same project+date (lines 34–58), logging a `console.warn`.
- If no row is found for `BASIC` itself (or the BASIC fallback also fails), it **throws** — a
  deliberate safe-failure, not a bug. This was independently confirmed this session (Tasks C/D/E
  in this conversation window) against live production data gaps on the "ROF Demo" project.

### `resolveGstForComponents(db, projectId, projectName, bookingDate, isNri, components[])` — lines 72–94

- If `isNri` is `true` → returns `{cgstAmount: 0, sgstAmount: 0}` immediately, no DB call.
- Otherwise loops the given components, calls `resolveRate()` **per component** (so each
  component type can carry a different rate), and sums `Math.round(amount * pct)` across all of
  them into single `cgstAmount`/`sgstAmount` totals.

### The exclusive/additive model

`demands.amount_due_inr` is **GST-exclusive**. `cgst_amount`/`sgst_amount` are **separate additive
columns** computed on top of it — never backward-derived from a GST-inclusive gross figure. This
is the opposite model from the receipt side (Section 2).

### BASIC / PLC / OTHER CHARGE / BALCONY as four distinct components

Confirmed identically at **two** demand-generation call sites, both calling
`resolveGstForComponents()` with the same four `chargeType` strings:

- `packages/api/src/routes/booking.ts` lines 1008–1019 (booking-time demand generation, Step F)
- `packages/api/src/routes/payments.ts` lines 495–507 (`POST /demands/generate`, lines 400–523)

Both pass:
```js
[
  { chargeType: 'BASIC',         amount: basicPortion },
  { chargeType: 'PLC',           amount: plcPortion },
  { chargeType: 'OTHER CHARGE',  amount: otherPortion },
  { chargeType: 'BALCONY',       amount: balconyPortion },
]
```
Each `*Portion` is that installment's percentage-share of the corresponding total (BASIC, PLC,
Other Charge, Balcony Charge amounts), rounded independently — so each of the four components can
resolve to a **different GST rate** (BALCONY/PLC/OTHER CHARGE fall back to BASIC's rate only if
they have no mapping of their own).

### Balcony Charge — GST-exclusive/additive (`balcony-charge.ts`, `computeBalconyCharge()`, lines 14–50)

```
base   = MIN(area × rate, cap)      // cap applied only if configured (cap != null)
cgst   = round(base × cgstPct)
sgst   = round(base × sgstPct)      // equal split when cgstPct === sgstPct, else independent rounding
total  = base + cgst + sgst
```

The base is computed **directly forward** from area × rate (capped) — it is **not** backward-derived
from a GST-inclusive figure. This mirrors the demand-side exclusive model, not the receipt-side
inclusive model.

**Worked example** (illustrative, using the formula — not captured from a specific live row this
session): balcony area 123.247 sqft, rate ₹500/sqft, no cap, CGST=SGST=0.5%.
```
base = 123.247 × 500        = 61,623.50 → rounds to 61,624 (paise-rounded in computeBalconyCharge, ₹)
cgst = round(61,624 × 0.005) = 308
sgst = round(61,624 × 0.005) = 308
total = 61,624 + 308 + 308  = 62,240
```
This exact preview formula is what `charge-master.ts`'s `/balcony-preview` route (lines 61–99)
calls live, and what `booking.ts`'s booking-write-point calls at creation — the same shared
function guarantees the preview can never drift from what's actually stored.

---

## SECTION 2 — GST ON RECEIPTS (the payment side) — recently changed

**File:** `packages/api/src/utils/gst-receipt-split.ts`

### `computeReceiptGstSplit(db, receiptAmount, projectId, receivedDate)` — lines 26–37

Confirmed exactly as briefed. The current model, per the function's own doc-comment (lines 9–25):

> "Every receipt — pending, cleared, bounced, or cancelled — gets its GST computed purely from its
> own amount, project, and received_date. Demand status/linkage plays no part in this
> calculation."

Implementation: resolves `rate = resolveRate(db, projectId, projectName, 'BASIC', receivedDate)`
(always BASIC — receipts don't carry a charge-type breakdown), then calls
`computeInclusiveGstSplit(receiptAmount, rate.cgstPct * 100, rate.sgstPct * 100)` — note the `* 100`:
`resolveRate()` returns a **fraction** (0.005), `computeInclusiveGstSplit()` expects **percentage
points** (0.5).

### The exact formula (`gst-backward-derive.ts`'s `computeInclusiveGstSplit()`, lines 15–48)

Paisa-exact, GST-**inclusive** backward derivation:
```
grossPaise    = round(grossAmount × 100)
combinedRate  = cgstPct + sgstPct
basePaise     = floor(grossPaise / (1 + combinedRate/100))
totalTaxPaise = grossPaise - basePaise
if cgstPct === sgstPct:
    cgstPaise = floor(totalTaxPaise / 2); sgstPaise = totalTaxPaise - cgstPaise
else:
    cgstPaise = round(totalTaxPaise × cgstPct/combinedRate); sgstPaise = totalTaxPaise - cgstPaise
```
`base + cgst + sgst` always sums exactly to the inclusive gross amount, to the paisa.

### Confirmed: deliberately different from the demand-side model

Section 1's demand model is exclusive/additive (base is the real amount, GST is added on top).
Section 2's receipt model is inclusive/backward-derived (the received amount already contains the
GST, and it's peeled back out). **Per prior explicit user decision** (recorded in this function's
own doc-comment, "REPLACES the demand-derived model from commit b361e4d"), a receipt and its
linked demand are allowed to show different CGST/SGST for the same money — this is by design, not
a bug to reconcile.

**Real worked example** — re-verified live against the database on 2026-08-18 (project "ROF Demo",
current BASIC rate CGST=0.5%/SGST=0.5%, combined 1%):

| Receipt | amount_received_inr | cgst_amount | sgst_amount |
|---|---|---|---|
| REC-2026-64299 (Cheque) | 131,610 | 651.53 | 651.54 |
| REC-2026-90187 (Online/bank_transfer) | 25,000 | 123.76 | 123.77 |

Check for REC-2026-64299: `basePaise = floor(13,161,000 / 1.01) = 13,030,693`,
`totalTaxPaise = 130,307`, split evenly `65,153 / 65,154` → `₹651.53 / ₹651.54`. Matches the DB
exactly.

### The client-side mirror (`payments.ts`, receipt-form route)

`inclusiveGstSplit()` (payments.ts lines 3021–3039, client-side JS embedded in the receipt-form
HTML) is a byte-for-byte JS port of `computeInclusiveGstSplit()`. `calcTotals()` (lines 3041–3054)
calls it using `GST_CGST_PCT`/`GST_SGST_PCT` — module-level JS constants baked into the served HTML
from the server-resolved rate at render time — so the live on-screen CGST/SGST preview in the
popup matches what the server will independently compute on save, without the browser ever
resolving its own rate.

---

## SECTION 3 — INTEREST CALCULATION

> **Changed 2026-10-29 (owner decision, matches the client's own Applicant File).** `buildInterestRows()` now (1) charges interest on the **basic** amount only: the installment amount plus the base of an add-on, without CGST / SGST, and a receipt counts without its own CGST / SGST; (2) matches money to installments **oldest first by date received** as one pool, whatever installment a receipt was filed under; (3) a payment made before the due date does not start the delay clock (the delay of a later payment is counted from the due date). The "anchor-date model", "Option B" (interest on the GST-inclusive installment) and the per-credit pre-allocation described below are the **old** behaviour and are kept only as history. The Applicant File page 1 shows the total of the interest table, the real approved waiver, and Balance = total with tax + interest - waiver - receipts. Golden check: `docs/client-crm/check-interest-parity.mts` and `docs/client-crm/e2e-payment-file-parity.mjs`.

**File:** `packages/api/src/utils/payment-waterfall.ts`, `buildInterestRows()` — lines 60–261.

### The anchor-date model

Each row's `delayDays` is computed inside `applyCredit()` (lines 150–182) as
`rcvdDate − lastEventDate`, where `lastEventDate` starts as the demand's `due_date` and is
reassigned to each receipt's `received_date` after it's applied (line 181). So delay for the
**second** receipt against an installment is measured from the **first** receipt's date, not from
the original due date — confirmed exactly as briefed.

### The trailing-row mechanism

If a demand has at least one applied credit (`anyApplied`) but still has `balance > 0` after all
known receipts, a synthetic trailing row is pushed (lines 199–231) using `options.asOfDate`
(caller-supplied "today") to compute ongoing accrued delay/interest with no `amount_received`.

### The early-payment clamp — trailing-row branch only

`Math.max(lastEventDate.getTime(), dueDate.getTime())` clamping (lines 205–207) exists in the
trailing-row branch. Whether the equivalent clamp is needed (and missing) in `applyCredit()`'s
per-credit loop is tracked as a gap — see **Section 6, item 3** — rather than described here as
settled behavior, since real-data verification found it is not yet proven safe in all cases.

### The null-due-date guard

Confirmed in all three branches:
- `applyCredit()` (lines 154, 160–163): `delayDays` only computed `if (dueDate && lastEventDate && rcvdDate)`, else stays `0`; `intPeriod = max(0, delayDays − graceDays)` is then `0`; `intAmt` requires `intPeriod > 0`, so it's forced to `0` too.
- Trailing row (lines 204–215): the whole delay/interest block is inside `if (dueDate) {...}` — all three stay at their initialized `0` otherwise.
- No-credit-applied row (lines 234–241): `delayDays = asOf && dueDate ? ... : 0`.

No exceptions found — matches the brief exactly.

### The grace period mechanism

`graceDays = options?.gracePeriodDays ?? 0`, subtracted from `delayDays` before `intPeriod` in
every branch. A consumer-level `grace_period_days` of e.g. `36500` (100 years) durably zeroes
`intPeriod` (and thus `interest_amount`) on every row for that consumer, confirmed via the same
`Math.max(0, delayDays − graceDays)` clamp everywhere.

### The Delay Amount display rule (`booking.ts`, `buildApplicantPage2`'s interest-table row-push, lines 2407–2413)

```js
const delayAmt = (ir.amount_received === 0 && ir.is_first_receipt === true)
  ? '--'
  : ir.delay_amount > 0
    ? fmtIndianNumber(ir.delay_amount)
    : ir.delay_amount < 0
      ? fmtIndianNumber(Math.abs(ir.delay_amount)) + '(Adv)'
      : '0.00';
```
And in `payment-waterfall.ts`'s `applyCredit()` itself (line 171):
```js
delay_amount: intAmt > 0 ? Math.max(0, delayAmt) : Math.max(0, balance),
```
Confirmed: when a row actually accrued interest (`interest_amount > 0`), `delay_amount` is the
pre-payment balance that interest was calculated on; when it didn't (`interest_amount === 0`),
`delay_amount` is instead the post-payment outstanding balance. Deliberately conditional per row,
not a single fixed rule — matches the brief.

### Single shared function — confirmed

`buildInterestRows()` is imported and called identically from:
- `packages/api/src/routes/consumers.ts` line 1385 (Applicant File / Check List path — with `gracePeriodDays`/`interestStartDate` passed, lines 1386–1387)
- `packages/api/src/routes/reports.ts` line 1036 (inside `GET /applicant-payment-file` — the brief's
  "collection report doesn't pass `gracePeriodDays`/`interestStartDate`" gap does not apply here;
  both are already passed)
- `packages/api/src/utils/payment-waterfall.ts` itself has no other internal caller

Grep confirms exactly one `buildInterestRows(` call site in each of `consumers.ts` and
`reports.ts`, both passing `gracePeriodDays`/`interestStartDate`/`asOfDate`. Fixing/verifying the
shared function once does cover all these call sites, as briefed — but see **Section 6, item 3**
for the one known gap in the shared function itself (the early-payment clamp).

---

## SECTION 4 — APPLICANT FILE STRUCTURE

**File:** `packages/api/src/routes/booking.ts`

`buildApplicantFileHtml()` (line 2762, `async`) assembles exactly 3 pages:
```js
const page1 = buildApplicantPage1(...)              // line 1425
const page2 = buildApplicantPage2(...)               // line 2026
const page3 = await buildApplicantPage3(...)          // line 2512, async
```

### Page 1 (`buildApplicantPage1`, lines 1425–2025)

Header, First Applicant, Co-Applicants, Unit/Booking Details, Pricing Summary, Milestone Timeline,
Other Charges table, Tax Details, Payment Contribution, and its own **Interest Summary** section
(line 1972, "Section 11" per its internal comment numbering) — a distinct, separate interest
summary from Page 2's per-installment Interest table (Section 3 above).

**Pricing Summary CGST/SGST safety-guard fallback — confirmed exactly as briefed** (lines
1486–1491):
```js
const demandCgstSum = activeDemands.reduce((s,d) => s + Number(d.cgst_amount||0), 0);
const holisticCgst  = ...; // computed independently from basicPlusPLC×cgstPct + otherCharge×otherChargeCgstPct + balconyCgstAmount
const cgst = (activeDemands.length > 0 && Math.abs(demandCgstSum - holisticCgst) <= 1000)
  ? demandCgstSum : holisticCgst;
```
Real per-installment ACTIVE-demand sum is preferred; falls back to the holistic estimate only when
they diverge by more than ₹1000 (guards against corrupted demand data). Same pattern for SGST.

### Page 2 (`buildApplicantPage2`, lines 2026–2511)

- **Payment Schedule** (Section 1 internally, lines ~2126–2248): Balcony Charge column present.
  Its per-row amount is **remainder-derived** from `INST. AMT. DUE` for exact reconciliation
  (`instAmt − netBsp − otherInst − addonInst`), with the exact ±₹1000 sanity-check fallback to
  the independent `pct-of-balconyChargeAmount` estimate described in the brief — confirmed
  verbatim at lines 2152–2168 (comment explicitly cites "stale legacy demand rows... off by
  Rs. 20,000+").
- **Receipt Information table** (Section 3, lines 2250–2367ish): confirmed `box-sizing:border-box`
  and `overflow-wrap:break-word` on every receipt-table cell style (`rthS`/`rtdC`/`rtdL`/`rtdR`/
  `rtdRN`, lines 2259–2263), `overflow-x:visible` wrapper (not `auto` — no scrollbar by design,
  line 2335), and real per-receipt `cgst_amount`/`sgst_amount` pulled straight from the `receipts`
  row (lines 2268–2269), not recomputed.
- **Section 4 — Interest table** and **Section 5 — Remarks** are *also* on Page 2 (lines
  2392–2482), not Page 3.

### Page 3 (`buildApplicantPage3`, lines 2512–2762) — **DRIFT: does not contain the Interest table or Remarks**

The brief states "Page 3: Interest table (as per Section 3), Remarks." The actual Page 3 contains:
Document Dispatch, Communications Log (placeholder), KYC Documents Status, Booking Documents
(placeholder), and Nominee Details. The Interest table and Remarks section are both on **Page 2**
(confirmed above, lines 2392–2482), immediately after the Receipt Information table. This appears
to be a straightforward mislabeling in the brief rather than a code problem — flagging so no one
goes looking for "the Page 3 interest table" during the 20-item fix pass and can't find it.

---

## SECTION 5 — PAYMENT MODE / RECEIPT SAVING

**File:** `packages/api/src/routes/payments.ts`

### The 8 tabs and their `payment_method` mapping

Confirmed via the client-side `modeMap` object embedded in the receipt-form HTML (lines
3095–3099):

| Tab | `payment_method` | `is_adjustment` |
|---|---|---|
| Cheque | `cheque` | — |
| Draft | `demand_draft` | — |
| Online | `bank_transfer` | — |
| Cash | `cash` | — |
| Card | `card` | — |
| Adjust | `cheque` | `true` |
| Dealer Adjustment | `cheque` | `true` |
| TDS Challan | `tds_challan` | — |

Field IDs: Online's tab is fully independent (`rf-*-online` suffixed ids); Draft's tab is built by
string-replacing the Cheque tab's HTML (`chequeInstrRow`), so Draft and Cheque share the same
field-id *pattern* but with a `-draft` suffix, not literally shared DOM elements. `getFieldVal(id)`
(lines 3072–3075) is `document.getElementById(id)?.value || ''` — never throws on a missing
element, which is exactly why the earlier removal of `rf-branch-online` (this session's Task A)
was safe: `saveReceipt()`'s branch lookup (line 3103) falls through `rf-branch → rf-branch-online →
rf-branch-draft`, and a missing `rf-branch-online` element simply yields `''` from `getFieldVal`
without erroring.

### Confirmed: backend never trusts frontend-submitted cgst/sgst

The `saveReceipt()` payload (lines 3107–3120) does **not include `cgstAmount`/`sgstAmount` at
all** — only `amountReceivedInr`, `baseAmount`, `interestAmount`, `paymentMode`, bank/cheque
fields, `remarks`. `inclusiveGstSplit()`/`calcTotals()` populate on-screen preview fields
(`rf-cgst-*`, `rf-sgst-*`) purely for display; those field values are never read into the payload.

Server-side, `POST /receipts` (lines 149–360) destructures the request body (lines 151–160) — no
`cgstAmount`/`sgstAmount` field is even in that destructure list. GST is independently computed
server-side at lines 310–324 via `computeReceiptGstSplit(matchClient, parseFloat(amount),
gstProjectId, receiptDate)` and written with a dedicated `UPDATE receipts SET cgst_amount = $1,
sgst_amount = $2`, entirely decoupled from whatever the browser sent (which, as established, is
nothing).

### Step-G auto-created booking-confirmation receipt

`booking.ts` lines 1049–1116. Confirmed it calls `computeReceiptGstSplit(client, bookingAmt,
booking.project_id, bookingDateStr)` at line 1084, then `UPDATE receipts SET cgst_amount = $1,
sgst_amount = $2` — same function, same pattern as a manual receipt.

---

## SECTION 6 — KNOWN, DELIBERATE, NOT-YET-FIXED GAPS

1. **Draft lifecycle** — `demand_draft` is still not in the 4 deposit/clear/hold/release-hold gate
   checks (`payments.ts` ~3725/3764/3801/3840) or the Cheque Management list query (line 1249) or
   the dashboard pending-cheques panel (`dashboard.ts`). **Partially superseded this session**:
   as of commit `717c103` (this session's Task H), `bank_transfer` (Online) *was* added alongside
   `cheque` at all 5 of those locations. `demand_draft`/`cash`/`card`/`tds_challan` remain
   excluded — pending business decision, per the brief.
2. **NRI/OCI/PIO nationality check missing in `computeReceiptGstSplit()`'s demand-less branch** —
   confirmed: the function's signature (`gst-receipt-split.ts` lines 26–31) takes no
   nationality/`isNri` parameter at all, unlike `resolveGstForComponents()` (Section 1), which
   does. An NRI consumer's receipt will still get GST computed today. Confirmed still true.
3. **Early-payment clamp missing in `applyCredit()`'s per-credit loop** — the clamp
   `anchorDate = Math.max(lastEventDate, dueDate)` exists only in `buildInterestRows()`'s
   trailing-row branch (lines 205–207). `applyCredit()` (the main per-credit loop, lines 150–182)
   has no equivalent: `lastEventDate` is reassigned unconditionally to each receipt's `rcvdDate`
   (line 181), even when that date is before `dueDate`. A demand with **2 or more receipts that
   both arrive before the real due date** would have its second (or later) early receipt's
   `delayDays` measured from the first early receipt's date instead of re-anchoring to `dueDate`,
   inflating its apparent delay. **Confirmed dormant, not active** — checked live against all real
   consumer records this session (Devbrat Jha, both DB records; Tanmay Agarwal; Avi Gupta): no
   demand today has 2+ non-cancelled receipts both arriving before its own `due_date`, so this bug
   is not currently producing any wrong `delay_days`/`interest_amount` for any real consumer.
   Needs the same clamp added to `applyCredit()`.
   **Fixed 2026-10-29**: `applyCredit()` now sets `lastEventDate` to the due date when the receipt came before it. The client CRM's own file (rate 15%, plan 9/10/81, receipts on 23 Jan, 17 Feb and 20 Apr 2023) charges 3,111 with delay days -30, -5, 57; before the fix ours gave 8,221 (25 and 62 days). Check: `docs/client-crm/check-interest-parity.mts`.
4. **Mayank Kumar / Sangeeta Bansal stale legacy installment-1 `amount_due_inr`** — not
   independently re-verified this session (would require a live DB lookup against those specific
   consumer records); carried forward as-stated from the brief, unchanged.
5. **`surrender.ts` restore's legacy fallback** — confirmed accurate. Lines 531 and 542
   (`console.warn`) explicitly handle "legacy row" cases with no `cancelled_demand_snapshot` or no
   `pre_surrender_unit_status` snapshot, falling back to `'locked'` and skipping demand reversal —
   exactly as briefed.
6. **Document History staleness detection** — not independently re-verified this session (no
   specific file was pointed to investigate); carried forward as-stated.
7. **`payment_method` enum values not yet reflected in the cheque-lifecycle queue** — the queue
   (dashboard `/pending-cheques`, dashboard `/summary`'s cheques sub-query, `payments.ts` Cheque
   Management list, and all 4 deposit/clear/hold/release-hold gates) covers `cheque` and, as of
   this session's Task H (commit `717c103`), `bank_transfer` too. `demand_draft`, `cash`, `card`,
   and `tds_challan` remain excluded — pending business decision, same underlying fact as gap #1
   above.

---

## Summary of drift found vs. the brief this document was commissioned from

| # | Section | What the brief assumed | What the code actually does |
|---|---|---|---|
| 1 | §6 gap #3 | Early-payment clamp applies to every row's anchor date | Clamp exists **only** in the trailing-row branch; `applyCredit()` has no equivalent — real-data check across all 3 named consumers found the pattern that would trigger it does not currently exist, so it's a confirmed-dormant gap, tracked in Section 6, not settled behavior |
| 2 | §4 Applicant File | Page 3 has the Interest table + Remarks | Interest table + Remarks are on **Page 2**; Page 3 is Document Dispatch/Communications/KYC/Booking Documents/Nominee |
| 3 | §6 gap #3 (old) | Collection report doesn't pass `gracePeriodDays`/`interestStartDate` | It does (and it's not a "collection report" — it's `/applicant-payment-file`) — gap already fixed, removed from the gap list |
| 4 | §6 gap #7 | Cheque-lifecycle queue excludes everything but `cheque` | Since this session's Task H (commit `717c103`), `bank_transfer` is included too — wording updated |

All other claims in the brief (Sections 1, 2, 5, and gaps #2/#4/#5/#6) were verified against the
current source exactly as described, with no drift found.
