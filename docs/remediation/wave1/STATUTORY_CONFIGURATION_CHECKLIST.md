# Statutory configuration checklist (ROF Finance and the implementation team)

Purpose: say exactly what the CRM needs from ROF before tax invoices, GST on bookings and receipts, demand letters and the A-101 historical simulation can run. The software never supplies a GST rate, a GSTIN, a RERA number, an HSN/SAC code or a financial year by itself. Where a value is missing the action is refused or the screen says so.

How to check progress at any time (read only, nothing is changed):

```
GET /api/gst-configuration/readiness?from=2019-04-01&to=<today>[&projectId=<project>]
```

Each item comes back as `ok`, `missing`, `conflict`, `decision` or `note`, with `owner`: **client configuration** (ROF Finance enters it), **software** (a code path reads another source, the developers fix it) or **decision** (ROF decides, then it is configured or built). The same list is in the Set Master, GST Configuration screens.

## A. What ROF Finance must enter (client configuration)

Set Master, GST Configuration unless said otherwise. Do the steps in this order; each one is needed by the next.

| # | Item | Where | Needed for | Notes |
|---|---|---|---|---|
| 1 | Financial years, every year the data touches (for A-101: from 2019-20), April to March, no gaps | Financial Years tab | tax invoices (an invoice dated in a year that is not configured is refused) | Only one year can be Active at a time and an invoice needs its year to be active: see decision D1. 2026-27 is not set up (today is in it). |
| 2 | GST slabs: date ranges that cover every booking, demand and receipt date, no gaps, no overlap | GST Slabs tab | every price, demand and receipt split (no rate is assumed when a date is not covered) | The ranges and rates are ROF's and their tax adviser's; the software has none built in. |
| 3 | Tax rates (CGST and SGST) per slab | GST Tax Setup | rates | INTRA rows are the ones booking uses. Inter-state and UT rows are stored but booking does not read them. |
| 4 | Mapping of a rate to each charge type, per project and slab: BASIC (required), PLC, OTHER CHARGE (if missing they are taxed at the BASIC rate) | Charge Mapping tab | booking, demands, receipts | Balcony charge has no mapping of its own and always takes the BASIC rate. IFMS, EXTRA ADD ON and OTHERS can be mapped but no code uses them yet (add-on charges carry their own rate on the add-on master). |
| 5 | Seller GSTIN per project (valid check character) | Project GSTIN tab | tax invoices (refused without it) | The invoice uses this one. Letters and receipts print the company GSTIN, see item 6 and decision D2. |
| 6 | Company GSTIN, PAN, CIN, registered address, place of supply, bank details | Set Master, Companies | demand letters, allotment documents, receipts | Company GSTIN is saved with a format check only; the readiness list reports a wrong check character. For a project the company GSTIN and the project GSTIN should be in the same state. |
| 7 | RERA number per project | Set Master, Projects (the project's own RERA number) | demand letters refuse to generate without a real number; receipts, applicant file, reports | Enter it on the PROJECT. The RERA tab in GST Configuration is not read by any output (software item S1). |
| 8 | HSN/SAC codes and their assignment per project and charge type (at least BASIC) | HSN/SAC tabs | tax invoices (without it an invoice carries the old default 9972) | Receipts print the company-level HSN setting `hsn_sac_code`, which nothing sets (software item S3). |
| 9 | Whether NRI, OCI and PIO applicants are GST-exempt on the unit price | decision D4 | all bookings and demands | The code applies zero GST to all three, in one rule, everywhere. |
| 10 | Setting `gst_invoice_requires_cleared`: may a tax invoice be raised on a receipt that is not cleared yet | global setting | tax invoices on receipts | Default: only on cleared money. |
| 11 | TDS rates (the `tax_rate` table is empty on purpose) | not used by any screen yet | | A tax adviser must confirm; nothing reads it today. |

For the A-101 simulation also enter, before any client data: the historical financial years and GST slabs for the dates in the client statement, the project GSTIN and RERA, the HSN/SAC, and the rate mapping for BASIC, PLC and OTHER CHARGE for every slab those dates fall into. Then run the readiness check for `from` = the first booking date and confirm nothing is `missing` or `conflict`.

## B. What the developers fix (software items)

| # | Defect | Status |
|---|---|---|
| S1 | The RERA tab (`project_rera_numbers`) is written but no output reads it; everything uses the project's own RERA number. The readiness check reports a mismatch as a software conflict. | open: wire the tab in or retire it (needs ROF's choice of where RERA is entered, decision D3) |
| S2 | One project can show three seller GSTINs: tax invoice (project GSTIN), receipt print (company setting `company_gstin`), letters (the project's company). Nothing cross-checks them. | open: needs decision D2; the readiness check lists a state mismatch |
| S3 | Receipt print takes HSN and place of supply from company-level settings, not from the project's HSN assignment. | open |
| S4 | The receipt print and the applicant file resolve the GST rate at TODAY's date, not the receipt date, and one of them falls back to 1 percent when no mapping exists. | open |
| S5 | Add-on charges carry their own rate columns and ignore the EXTRA ADD ON mapping and effective dates; the screen offers fixed 18, 12, 5 and 0. | open |
| S6 | GST on interest is a fixed 1 percent in one client script, not a date-effective rate. | open |
| S7 | NRI detection was copied into a dozen places (one of them recognised only NRI, so an OCI or PIO applicant got GST on a manual demand but not on the booking). | FIXED here: one helper `isGstExempt` |
| S8 | `documents/generate.ts` typed a RERA number into the code as a fallback. | FIXED here: it prints a dash instead |
| S9 | Company GSTIN has no check-character test (project GSTIN has). Turning it on would break fixtures that use made-up GSTINs. | open: reported by the readiness check, not enforced |
| S10 | GST slabs cannot be edited or backdated-guarded; overlap is checked by the application only, not by the database. | open |
| S11 | Financial years can be hard-deleted even when invoices exist in them. | open |

## C. Decisions ROF must take

| # | Decision | Affects |
|---|---|---|
| D1 | Which financial years may take a new tax invoice: only the Active one (today), or any configured year? Does a closed period need a lock (no new invoice or credit note dated in it)? | tax invoices, A-101 historical dates |
| D2 | Which GSTIN is the seller's on each document: the project GSTIN everywhere, or the company GSTIN where the two exist? | invoices, receipts, letters |
| D3 | Where RERA is entered: the project (today) or the RERA tab (per tower)? | letters, receipts, reports |
| D4 | NRI, OCI and PIO exemption: confirm the rule, or give the correct one. | every booking and demand |
| D5 | Invoice number series: calendar year today (INV/2026/00001); financial-year based and restarting each year? | tax invoices, GSTR |
| D6 | Place of supply for a buyer without a GSTIN | tax invoices |
| D7 | Rate for PLC, OTHER CHARGE, balcony, interest and add-on charges: are they separate mappings? | pricing, demands, receipts |

## D. Sign-off

ROF Finance confirms items 1 to 8 and 10 are entered; the implementation team runs the readiness check for the first date of the A-101 statement and attaches the result; ROF answers D1 to D7. Until then tax invoices for the affected project and dates stay blocked and the A-101 simulation does not start.
