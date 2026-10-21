# Allocations

An allocation ties an applicant to a unit (allotment). This module covers allotting, cancelling an allocation (with the waitlist), unit shifting, the lists, allotment letters and the e-draw import.
Routes: `packages/api/src/routes/allocations.ts` under `/api/allocations`. No migration. The core of "stop this booking and free the unit" is shared with Surrender (`performSurrender` in `routes/surrender.ts`).

## Who can do what
| Action | Who |
|---|---|
| List, waitlist, shift history | every signed-in role |
| Allot, cancel an allocation, generate letters, import e-draw | super_admin, project_manager (allocations create) |
| Shift a unit | the same, plus process access *Unit shifting – maker* (super_admin exempt) |

## Routes and rules
| Route | What it does |
|---|---|
| `POST /` | Allots a unit. The unit must be `available` (new allocation) or `booked` (the booking's allocation is promoted); it must belong to the given project, the applicant must belong to that project and hold no other unit. One unit per applicant, one applicant per unit, also at the same moment (lock per unit and applicant). Status history and audit rows. |
| `GET /` | List (`page`, `pageSize` 1–1000, `projectId`, `consumerId`, `status` one of allotted / agreement_signed / booked / cancelled / transferred / all, name / mobile / registration / unit search, allotment dates). By default only allotted ones, unless an applicant is asked for. |
| `POST /:id/cancel` | The applicant forfeits up to ₹29,500 (₹25,000 + 18% GST) of the cleared money and gets the rest back as refund. Leaves the same state as a builder cancellation (booking, demands and commissions stop, applicant unlinked, a `cancellations` record) so the Surrender screens can restore it while the unit is free. The unit goes to the first applicant on the waitlist who holds no unit, otherwise it becomes available. |
| `POST /shift` | Moves an applicant to another **available** unit of the **same project**. Allocation, booking, payment plan, pending commission and the applicant's unit link move with them; the new unit takes the old unit's status and the old unit becomes available. Prices are not recalculated. One shift per unit and applicant at a time. |
| `GET /shifts` | Shift history (`projectId`, `from`, `to`, `pageSize`). |
| `GET /waitlist` | Waitlist, optionally by project. |
| `POST /generate-letters` | One allotment-letter record for every allotted allocation without one; safe when two people click at once. |
| `POST /import-edraw` | E-draw results, as JSON (`results: [{applicantId, result}]`) **or the CSV file the screen uploads** (a header row with an applicant column — applicantId, aadhaar, registration_no or mobile — and a result column). An applicant is found by Aadhaar (number or stored hash), registration number or mobile within the project. An unsuccessful result with money paid creates a refund record due in 30 days and marks the applicant cancelled; an applicant who already holds a unit gets none; importing the same file twice does not repeat a refund. At most 5000 rows and 2 MB. |

## What was wrong before (read from the code, then fixed)
- **The e-draw import screen never worked**: it uploads a CSV file, the server expected a JSON list and failed with a server error on every file. Now the file is read.
- Allotting checked nothing but the unit status: an applicant of another project, an applicant who already held a unit (it was overwritten and the first unit was left allotted to nobody) or a unit of another project than the one given were accepted; the transaction was SERIALIZABLE with no retry, so two people at the same moment got a 500.
- **Cancelling an allocation left the booking alive**: the booking, the demands and the broker commission stayed live while the unit was freed or handed to the waitlist; the applicant stayed linked to the unit; the refund was worked out on text values (a string minus a number) and could be negative; the waitlist could promote an applicant who already held a unit; there was no check that it was not already cancelled. All fixed through the shared surrender core.
- **Unit shifting moved only half**: the booking and the payment plan (and so the demands in every list) stayed on the old unit, only `allotted` allocations were moved (a `booked` one stayed behind), the old unit was set `available` and the new one `allotted` whatever the real status was, the new unit could be in another project or hold a booking, and nothing was checked. Now everything follows in one transaction.
- `pageSize` and `page` went into the SQL text; `status`, ids, dates and searches were not checked (a wrong status gave a 500; `%` matched everything); the list ignored `consumerId`, so the registry screen's "find the allocation of this applicant" got everybody's.
- The shift history swallowed every error and returned an empty list; its project filter was ignored.
- Allotment letters could be generated twice by two clicks at the same moment; the e-draw import created a second refund record when the same file was imported again and was not one transaction.

## Tests
`node docs/allocations/api-test-allocations.mjs` (199 checks, own project / units / plans / applicants, cleaned afterwards): roles and the unit-shifting process, bad input for every route, allotting (available and booked units, one unit per applicant), 4-way and 3-way races, cancelling with the waitlist (promotion, skipping a holder, less paid than ₹29,500, restore afterwards, 5 at once), shifting (everything follows, status, history, races, the freed unit sells again), lists, letters (4 clicks at once), e-draw (JSON and CSV, twice, holder, other project, 2 MB limit), random junk (70 rounds), and the earlier screens.
Demo data for http://localhost:3020: `node docs/demo-seed-allocations.mjs`.

## Not changed
- The ₹29,500 forfeiture is fixed in code, not read from a setting; a per-project rule is an owner decision.
- Shifting does not reprice the booking (rate, area, GST) or the demands; a shift to a different-priced unit needs a manual price edit.
- The allotment letter is a record only (no PDF); `agreement_signed` has no screen here.
- The waitlist has no screen to add an applicant to it in this module.
