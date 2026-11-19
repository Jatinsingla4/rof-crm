# H. Independent QA handover

For a separate session to retest on the deployed build. Read only unless a step says otherwise. Do not trust the claims here, check each against the screen.

1. **ZZREG-2026-000014 (QA-032, QA-005):** Customer Register, First Name "Qa", the ZZREG row, View Applicant File, Pricing Summary and Tax Breakup. Expect header GST, breakup GST and schedule GST to agree (within Rs 1 per row), and Total Consideration With Tax equal to agreement value plus that GST. The Rs 1,00,000 between area x rate and net basic price is the inaugural discount.
2. **QAAU-2026-0002 (QA-001):** Unit 102, View Applicant File. Expect no "DIFFERENCE, NOT ROUNDING" line when BASIC and PLC rates match their mapping. If it still shows, the GST mapping (PLC) needs ROF's decision, it is not a code fault.
3. **Cancelled booking (QA-012, QA-015):** ZZREG customer page: New Receipt, Raise Demand, Unit Shift are disabled. Dashboard Pending Approval shows "Booking cancelled" instead of Approve for its receipts. Dashboard Pending Cheques excludes bank transfers and cancelled-booking cheques.
4. **Reports (QA-013, QA-025, QA-034, QA-030):** Customer Wise Balance shows three separate "cleared, not in these rows" cards; Demand Status header reads CONTRACT BALANCE; dashboard header reads DUE O/S; Project Wise Collection has a CASH column; Customer Due Summary BALANCE (F) reads "(without GST)" on ex-GST tabs; Sh Tester shows "Schedule gap".
5. **Invoicing (QA-003, QA-004, QA-031):** GST Invoicing, no rate preselected; Setup shows "live" invoices; with no project GSTIN or financial year, generating an invoice returns the message (needs a write attempt on a test project only, with approved test logins).
6. **Security (QA-010, QA-011):** a login without checker right sees "No checker access" on Pending Approval; the Applicant File address holds a token that stops working after 60 seconds.
7. **Exception lists (read only):** `/api/payments/gst-invoices/exceptions`, `/api/reports/booking-exceptions`.
8. **Still needs ROF before it can pass:** QA-008, QA-009 (flag), QA-018, QA-026, QA-027, QA-022, QA-029, the A-101 basis. Write tests (server 409s, self-approval with two logins, A-101 simulation on a simulation project) need an approved test project and logins.
