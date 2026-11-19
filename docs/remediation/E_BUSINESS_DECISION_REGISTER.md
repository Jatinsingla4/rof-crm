# E. Business decision register

Code defects are not listed here. Each item below needs an ROF answer; the code holds a safe boundary and does not guess.

| # | Decision | Blocks | Boundary in the code |
|---|---|---|---|
| BR-01 | Which allotment date governs due dates (03/03/2020 or 28/08/2020) | A-101 | none |
| BR-02 | Affordable housing 1% eligibility (metro, 60 sq m, 45 lakh, scheme) | A-101, QA-001 | rate comes from GST mapping only |
| BR-03 | Rounding basis: billed (269) or contract (272) | A-101 | both computed, neither chosen |
| BR-04 | GST rounding level | QA-001 | per head, rounded to the rupee |
| BR-05 | Saturday or holiday due date rolls to next business day | A-101 interest | switch in the simulation only |
| BR-06 | Interest basis, receipt date or clearing date, interest before cancellation | QA-007, QA-026 | none changed |
| BR-07 | GST rate per charge head (PLC, EEC, meter, BOCW, admin) and whether PLC is taxed with the apartment | QA-001, A-101 | configuration |
| BR-08 | GST on interest at the main supply rate | A-101 | none |
| BR-09 | Excess treatment (refund or adjust) and allocation order | QA-008, A-101 | unnamed money stays credit, `receipt_allocation_v1` off |
| BR-11 | Cash receipt limit | QA-018 | none |
| - | Commission base (A-103 excludes 1,00,000) and payable trigger | QA-009 | flag off, list shows cleared backing |
| - | Default GST rates in invoicing setup | QA-003 | no default assumed |
| - | Discount basis: agreement 54,60,000 or 55,60,000 | QA-005 | agreement kept net of discount |
| - | Super Admin bypass of process rights | QA-010 | unchanged |
| - | Maximum direct invoice (now: booking value less already invoiced) | QA-004 | enforced as stated, confirm |
| - | Who may see PAN, Aadhaar, mobile | QA-027 | unchanged |
| - | Link token: single use, bound to address, or authenticated fetch | QA-011 | 60 s, one path |
| - | Historical financial years from 2019-20, GST slabs, project GSTIN | QA-003, A-101 | invoicing blocked until configured |
| - | RERA source, name formatting rule | QA-029, QA-022 | none |
| - | Pending receipts of the cancelled booking (Rs 8,24,220): refund or reject, and whether the Rs 3,24,220 advance copy is the same cash as the Rs 5,00,000 | QA-012, QA-014 | no approval possible |
