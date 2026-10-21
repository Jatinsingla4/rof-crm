# Charge Master (Other Charge)

Set Projects → Charge Master → Other Charge. Holds the **Balcony Charge** rate (₹ per sq ft, max 10,00,000, up to 2 decimals). The cap (₹1,00,000) is fixed.

**Where it is used.** Booking reads the rate and cap once, prices `MIN(balcony area × rate, cap)` plus CGST/SGST from GST Configuration, and stores the rate on the booking (`balcony_rate_applied_inr_sqft`). Changing the rate later does not change old bookings. The booking form preview uses the same calculation.

**Rules (checked in code, `routes/charge-master.ts`)**
- Everyone signed in can read and preview. Changing a rate needs the Set Master "edit" permission (super admin, project manager).
- Rate must be a plain number 0 – 10,00,000 with up to 2 decimals. Text, `1e2`, `0x10`, negatives, blanks, true/null/arrays are refused with a message; the stored rate never changes on a refused save.
- Saves lock the row, so two admins saving together cannot corrupt it; every save is written to the audit log (old and new values).
- Preview refuses a bad project id, a bad area (text, negative, over 1,00,000) or a bad date; unknown project is 404; a project with no GST mapping gets a clear message (422), not a server error.
- Migration 104 puts the balcony row back if it is ever missing (Booking would otherwise price the balcony at 0).

**Check it:** `docs/charge-master/api-test-charge-master.mjs` (63 checks: roles, 18 bad rates, bad bodies, cap, unknown/injection keys, 12 parallel saves + audit, preview cases).
