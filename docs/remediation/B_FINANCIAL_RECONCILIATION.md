# B. Financial reconciliation report

Important: the real bookings (ZZREG-2026-000014, QAAU-2026-0002, Sh Tester, Zf Tester) live in the shared Neon database. They were not read or changed here. "After" below is what the changed code does with the same shape of data in tests, not a figure read from those bookings. Re-run the retest on them to confirm.

| Case | Before (report, build 976afd9) | What changed | After (tested shape) | Open |
|---|---|---|---|---|
| ZZREG-2026-000014 header GST | header 2,780 / breakup 55,600 / schedule 55,030, payable 54,62,780 vs 55,53,030 | cancelled booking and cancelled demands feed nothing; fallback schedule principal = price less discount plus balcony | header, breakup and schedule come from the agreement basis; fallback principal within Rs 1 per row of 54,60,000 (test) | discount basis: the 1,00,000 is `company_inaugural_disc`; report expected 55,60,000 |
| QAAU-2026-0002 GST | breakup 900 vs schedule 2,500 | breakup uses BASIC and PLC rates at the booking date | with BASIC 2.5% each side and PLC 0%, breakup equals schedule (1,250 per side, test) | whether PLC is taxed and at what rate (BR-02, BR-07) is configuration, not code |
| Sh Tester | contract balance 25,85,600 vs cost 32,25,600, nothing paid | gap detected | schedule short of price is flagged "Schedule gap" and counted | the plan itself is historical data, not repaired |
| Zf Tester | paid 25,95,836 + beyond 1,38,218 = 27,34,054 vs cleared 27,33,277 | credit now excludes advance copies | paid + credit equals eligible cleared receipts (test) | the 777 is not shown to be the advance copy |
| Customer Due Summary | ex-GST cost less GST-inclusive cleared | ex-GST tabs subtract cleared less GST | same basis on every tab | not run with data |
| Pending cheques | 6 / 10,60,680 | cheque only, live bookings only | 10,60,680 less 1,29,680 transfer less 1,00,000 cancelled cheque = 8,31,000, the figure the report expected; fixture check gives the same rule | none |
| Cleared collections 89,92,536 | not split | split | cancelled-booking, no-plan and other are separate and add up to the old combined figure (fixture) | none |

## A-101 simulation (`packages/api/test/a101-simulation.test.mjs`)
Data: the nine receipts and the eight schedule rows as the legacy statement prints them (recorded in `docs/applicant-file-reconciliation/results.md` of the e08e11 worktree). Receipts add up to 28,10,787.
1. Mathematical output (contract basis, interest as the dates fall): excess 271.58, interest 271, GST on interest 3.
2. Client statement: billed-basis excess 269, contract-basis excess 272 (from the audit, not computed).
3. Approved ROF rule: none approved. BR-01, BR-03, BR-05, BR-07, BR-08, BR-09 are open.
4. Remaining variance: this run gives 270 on the billed basis against the audit's 269. The one rupee comes from the whole-rupee printed rows, the audit holds unrounded rows.
With the weekend rule on (BR-05) the Saturday due date of instalment 7 is met on Monday, interest is 0, contract excess 545.58. Neither 269 nor 272 is hardcoded.
Allocation of the nine receipts to the schedule leaves 1,866.43 unallocated credit (carry-forwards the plan rows cannot take, among them the add-on share of receipt 8). That needs the approved allocation order (BR-09).
