# GST and quote calculation: architecture and verification plan

Status: DRAFT for owner and CA sign-off. No financial code has been changed for this document.
Origin: QA Cycle 3 (C3-02, C3-03, C3-04, C3-16, C3-24; open questions OBQ-1, OBQ-4).

## 1. Owner direction (binding)

1. Provisional GST base = BSP + Balcony Charges + applicable PLC, treated as components of the same apartment supply.
2. This is NOT a final tax rule. It must not be hardcoded.
3. The GST base is configurable and lives in ONE server-side quote calculation.
4. Existing financial calculations stay untouched until the tax treatment is verified.
5. The final formula and its legal basis are documented BEFORE implementation (this file, section 8 sign-off).

## 2. What the code does today (read-only findings)

| Area | Today | Problem |
|---|---|---|
| Rate lookup | `resolveRate()` in `utils/gst-resolver.ts`: per project + charge type (BASIC, PLC, OTHER CHARGE, BALCONY...) + booking date, via `gst_tax_charge_mapping` -> `gst_slabs` -> `gst_tax_setup`. No mapping: throws 422. | Already per-charge configurable. Good base to keep. |
| Tax amount | `resolveGstForComponents()`: `Math.round(amount * pct)` per component, summed. | Rounding is per component and per instalment (C3-16: +Rs 12 on Beta). |
| Where it runs | Booking save (`booking.ts` ~1008, per instalment), demands (`demands.ts:92`), payments (`payments.ts`). | Three call sites each assemble their own components. |
| Preview | `booking.js` ~2540: browser computes subtotal, one flat CGST/SGST %, balcony added only as a lump. | A second formula that does not match the server (C3-02). |
| Applicant file | `booking.ts` ~1737 builds totals again for display. | Third formula (C3-03, C3-04). |
| Discount | Handled in each place differently. | Dropped in the Beta file; pre- vs post-discount BSP differ by row (C3-04). |
| Land deduction, project GST category, completion status | Not modelled anywhere. | Needed before any rule is final. |
| Seed data | Migration 077 seeds only slabs that ended 2024-03-31. | New projects with later booking dates always hit the 422 until mapped by hand. |

## 3. Facts to map per project BEFORE implementation

For each project, record (with source document and who verified):

1. GST category: affordable housing / other residential / commercial / mixed.
2. Project status at booking date: under construction, or completed with completion/occupancy certificate (changes whether GST applies at all).
3. Applicable rate and effective date, and whether the old or new rate regime applies to that project (project start date and any option exercised by the developer).
4. Land-value treatment: deducted, embedded in the rate, or not applicable.
5. Treatment of each charge: BSP, balcony, PLC, parking, club, other charges, interest, add-ons. Same supply (same rate) or separate (own rate).
6. Treatment of discounts and rebates: reduce the taxable value or not.
7. Booking date vs instalment date vs receipt date: which date fixes the rate.
8. Place-of-supply and NRI treatment (code currently zero-rates NRI; this must be justified or removed).
9. Rounding rule: per invoice, per instalment, or on the total.

## 4. Proposed design (to be built only after section 8 sign-off)

### 4.1 One server-side quote function
`quoteBooking(input) -> Quote`, a pure function in `packages/api/src/utils/quote.ts`, the only place that computes price and tax. Booking preview, booking save, demand generation, applicant file, receipts allocation, surrender and reports all read the returned `Quote` and never recompute.

Input: project, unit, booking date, area basis, rates, discounts, charges, NRI flag.
Output (all in paise-safe integers): base lines, discount lines, taxable value per line, CGST/SGST per line, rounding line, total consideration, instalment schedule with the same lines per row.

### 4.2 Preview becomes a thin client
`POST /api/booking/quote` returns the `Quote`. The browser renders it. The client formula in `booking.js` is deleted. Preview and saved booking cannot disagree because they run the same function.

### 4.3 Configurable GST base
Extend the existing mapping instead of adding a new system. Per project and charge type, add a flag `in_apartment_supply_base` (default false, so nothing changes until turned on). The quote function builds the taxable base as the sum of components flagged true and applies the mapped rate to that base; unflagged components keep today's per-component rate.

Add a per-project GST profile (new table `project_gst_profile`): category, status, regime, land-deduction mode and percentage, rounding mode, NRI treatment, plus `verified_by`, `verified_on`, `source_ref`. A project without a verified profile cannot be booked with the new base; it keeps the current behaviour.

### 4.4 Rounding
Single configured rule (default: round once per instalment row on the taxable value, with the difference shown as an explicit "Rounding" line). Instalment rows must sum exactly to the total consideration.

### 4.5 Missing mapping (C3-01 follow-up)
Keep the 422, but the error now names the correct menu path (done). Add a "GST ready" check on project save screen listing missing mappings, so it is found before the first booking.

## 5. Open points that stop implementation

| # | Question | Needed from |
|---|---|---|
| G1 | Project GST category and rate for each live project | CA / owner |
| G2 | Is land deducted, embedded in the rate, or absent for each project | CA |
| G3 | Does discount reduce the taxable value? (OBQ-4) | Owner + CA |
| G4 | Are balcony and PLC the same supply as BSP for every project? | CA |
| G5 | Rounding rule and the instalment rounding (C3-16) | Owner |
| G6 | Rate date: booking date or instalment date | CA |
| G7 | NRI zero-rating: legal basis, or remove | CA |
| G8 | Area basis for rate: super or carpet (OBQ-7) | Owner |

## 6. Legal basis (to be filled and verified)

Do not rely on this section until a CA fills it. Required entries: the CGST rate notification and its amendments that apply to residential apartments in the project's regime, the land-value treatment provision, the completion-certificate exemption, and the time-of-supply rule. For each, record notification number, date, clause, and the CA's name and date of confirmation. Nothing here is asserted by engineering.

## 7. Test plan (written before code)

1. Golden cases from QA Cycle 3 (Alpha and Beta files) with the owner-approved expected totals once G1 to G8 are answered. Note the QA report used balcony Rs 60,000 in files and Rs 60,600 in the preview; one value must be confirmed first.
2. Property check: sum of instalment rows equals total consideration, for random discounts, areas and plans.
3. Preview equals saved booking equals applicant file equals demand schedule, for the same booking.
4. Discount larger than the base is rejected by the server (the preview currently allows a negative total, C3-12).
5. Date-boundary cases: booking on the day a slab ends or starts.

## 8. Sign-off (implementation is blocked until all are filled)

| Item | Name | Date |
|---|---|---|
| Owner approval of formula (G3, G5, G8) | | |
| CA confirmation of G1, G2, G4, G6, G7 and legal basis (section 6) | | |
| Engineering: golden tests written and failing for the right reasons | | |

## 9. Rollout

1. Build `quoteBooking` and `/booking/quote` behind a flag, off by default, with the current behaviour reproduced exactly (parity tests against today's outputs).
2. Switch the preview to the quote endpoint (removes the client formula).
3. Switch applicant file, demands and receipts to read the Quote.
4. Only then turn on the verified GST profile per project, one project at a time, with before/after comparison on existing bookings.
