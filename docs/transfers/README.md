# Transfers

An ownership transfer moves a unit from one applicant (seller) to another (buyer). The unit's payment plan, demands, receipts, booking and add-on charges go with it;
the seller's paid / due / balance are written down first, for the transfer letter. Routes: `packages/api/src/routes/transfers.ts` under `/api/transfers`.
Migration `113_transfer_amounts_decimal.sql` lets fee, admin charges and transfer amount keep paise.

## Who can do what
| Action | Who |
|---|---|
| Read list, history, owner, report, detail, letter, fee master | every signed-in role |
| Make a transfer | super_admin, project_manager (allocations create) **and** process access *Applicant transfer – maker* (super_admin exempt) |
| Change the transfer / application date | super_admin, project_manager |
| Set the fee master | roles with master-data edit (super_admin, project_manager) |

## Routes
| Route | What it does |
|---|---|
| `POST /` | The transfer. One transaction, the unit and both applicants locked. |
| `GET /list` | Paged history (`page`, `pageSize` 1–200, `projectId`, `search`). |
| `GET /history/:unitId` | Ownership history of a unit. |
| `GET /unit-owner/:unitId` | Current owner (a cancelled or transferred allocation is no owner). |
| `GET /report` | Units that were transferred, with the current owner. |
| `GET /:id`, `GET /:id/letter` | Detail and the printable letter (every typed text is escaped). |
| `PATCH /:id` | Change `transfer_date` and / or `application_date`; only what is sent changes; application date may be cleared with null; application date cannot be after the transfer date. |
| `GET/POST /fee-master` | Transfer fee set-up of a project (fee, admin, tax %, free-of-charge flag, effective date). |

## Rules for a transfer
- Seller and buyer must be different applicants; the seller must own the unit; the **buyer must own no unit** and must belong to the unit's project.
- Money fields (fee, admin, transfer amount, taxes, basic price): 0 to 100 crore, up to 2 decimals. Dates: real, not in the future; application date not after transfer date; transfer date defaults to today. Transfer type: Individual, Multiple, Company or Private Firms. GSTIN is checked if given. A transfer number, if given, is unique (any case).
- The seller's snapshot counts the unit's receipts (cancelled and bounced left out) against the unit's demands including GST and add-on charges (cancelled left out).
- One transfer of a unit at a time (lock per unit), one transfer per transfer number at a time, one unit per buyer. Every transfer, fee setting and date change writes `audit_logs`.

## What was wrong before (read from the code, then fixed)
- **No role check at all**: the router was mounted without any permission, so a read-only viewer could transfer a unit or change the fee master. Now allocations access plus the *Applicant transfer* process for the transfer, master-data edit for the fee master.
- A buyer who already owned a unit lost it (their allocation was overwritten). Now refused (409). A buyer from another project was accepted. Seller = buyer was accepted.
- Nothing was checked: bad ids, amounts, dates, types and long texts went to the database (500s); `pageSize=abc` gave `LIMIT NaN`.
- The transfer ran as SERIALIZABLE with no retry, so two transfers at the same moment failed with a 500; two buyers could both get one unit in theory. Now locks.
- **The transfer date picked in the form was never sent** (the screen asked for it and dropped it); the day of saving was used. Now sent and kept.
- **The Transfer screen could not create its buyer** since the applicants pass (the form asked for an applicant that starts as "allotted"); it now creates the buyer normally and the transfer makes them "allotted".
- Editing only the transfer date wiped the application date. Now only sent fields change.
- The seller's balance compared receipts with GST against demands without GST, counted cancelled receipts and every demand of the applicant. Now per unit and consistent.
- A surrendered (cancelled) allocation still showed as the unit's owner and the unit stayed out of the report once its allocation moved on from "allotted". Now cancelled / transferred allocations are no owner and the report keeps units in any live state.
- Stored XSS: names and addresses went unescaped into the printable letter. Now escaped.
- `%` and `_` in search matched everything; fee master values were unchecked and the fee master could be changed by anyone.

## Tests
`node docs/transfers/api-test-transfers.mjs` (280 checks, own project / units / plans / applicants, cleaned afterwards): roles, bad input for every route, what moves (plan, demands, receipts, booking, allocations), seller snapshot, chains of transfers, 4-way races (one unit to four buyers, one buyer taking three units, the same transfer six times, the same number three times), lists and report, fee master, date edits, the escaped letter, random junk (70 rounds), and the earlier screens after a transfer.
Demo data for http://localhost:3020: `node docs/demo-seed-transfers.mjs`.

## Not changed
- Broker commissions keep pointing at the seller applicant (the booking row itself moves to the buyer); whether commissions should follow the unit is an owner decision.
- Documents and photos uploaded for the seller stay with the seller (KYC belongs to the person).
- There is no undo for a transfer; a wrong one is reversed by a transfer back.
- The letter is still a fixed layout ("Transfer/Sale Entry Register").
