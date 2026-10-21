# GST Configuration (Set Projects → GST → GST Configuration)

Eight tabs, one API (`/api/gst-configuration`, `routes/gst-configuration.ts`). Booking, receipts, demands and the booking-form preview all price GST from these tables, so every change is checked and audited.

**How a rate is found.** Project + charge type (BASIC, PLC, OTHER CHARGE, IFMS, EXTRA ADD ON, OTHERS) + date → the project's mapping in the slab (date range) that covers the date → that slab's INTRA rate (CGST + SGST). A charge with no mapping falls back to the project's BASIC mapping; no BASIC mapping means Booking refuses with a message. `GET /resolve` gives the same answer for the screens.

**Rules**
- Everyone signed in can read. Any change needs the Set Master permission (create/edit; delete = super admin).
- **Slabs never overlap** (a day belongs to one slab, otherwise the lookup would pick one by chance). Dates must be real, 1990–2100, from ≤ to. Two admins adding at once cannot both slip in.
- **Tax rates:** INTRA = equal CGST and SGST, no IGST/UTGST; INTER = IGST only; UT = UTGST only. 0–100, up to 3 decimals; code unique per slab and type (any letter case).
- **Mapping:** the rate must belong to the same slab and be INTRA (Booking charges CGST + SGST; an INTER rate would silently charge 0). A mapped rate cannot be switched away from INTRA or deleted.
- **Nothing silently disappears:** a slab with rates or mappings cannot be deleted (the database would otherwise delete the mappings and Booking would stop finding a rate); an HSN/SAC code that is assigned cannot be removed.
- **HSN/SAC:** goods = 4, 6 or 8 digits; service (SAC) = 6 digits starting 99. A removed code can be added again. Assigning a removed code is refused.
- **Financial years** do not overlap and only one is active (activating one switches the others off).
- **GSTIN** must have a valid state code, PAN layout, Z and the **check character** is verified, so a typo is caught. Letters are upper-cased, spaces trimmed.
- **RERA:** letters, digits and `. / ( ) -`; the tower must belong to the project; one project-level number per project (the table's own key allowed duplicates when no tower was set; migration 106 adds the missing index, skipped with a NOTICE if live data already has duplicates).
- Bad ids, bad dates, repeated query parameters and non-text values give a clear 400, never a server error. Every change is written to the audit log with old and new values.
- Screens: dates come back as plain `YYYY-MM-DD` (the edit box no longer shifts a day on a server in another timezone); the mapping screen lists INTRA rates only.

**A rate that has priced real money is locked.** If a project mapped to a rate has a live (not cancelled) booking, or a receipt that is not cancelled, dated inside the slab, then changing that rate's percentage, switching the project to another rate in that slab, or removing its mapping is refused (409, with the counts): the lookup is by date, so the change would reprice them. Renaming a rate, saving the same values, and rates nobody has used stay free. For a new period, add a new slab. A typo in a used rate can be corrected only by a **super admin** sending `confirmChangeUsedRate: true` (API only, no button); the audit log records old and new values. "GST Addon Configuration" on the mapping tab is still a "coming soon" button.

**Check it:** `docs/gst-configuration/api-test-gst-configuration.mjs` (265 checks, own years and own data, cleaned up at the end). Demo data: `docs/demo-seed-gst.mjs`.
