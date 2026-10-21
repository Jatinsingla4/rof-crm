# Whole flow (chaos test)

`api-test-whole-flow.mjs` walks many applicants through the whole life of a unit in a **random order**:
booking → confirm → demands (generate / raise / un-raise / send) → receipts (record, approve, deposit, clear, hold, bounce, cancel, edit)
→ transfer → surrender / cancellation → restore → allocation cancel → allot → shift → applicant edits → list/report screens.
It builds its own company, two projects, towers, units, payment plans and GST set-up and does not use the module tests.

## How the data is made (on purpose hostile)
Every request body is built from a field list of the screen. For each request a random style is used:
- **full**: every field filled with a valid-looking random value,
- **sparse**: most fields left out,
- **mixed**: some fields left out, the rest filled,
- **hostile**: one field set to junk (wrong type, empty, negative, huge, SQL, script, unicode, `0000-00-00`, another person's id, a list, `null` ...).

Also: ids of the wrong kind (another applicant's unit, a unit that does not exist), actions in the wrong order (surrender then transfer,
clear a cancelled receipt, restore twice ...), and **bursts** of 2–5 random actions fired at the same time.

## What it checks
After every 10 steps and at the end, the database must have no contradiction (16 checks): two live allocations on a unit, two applicants on
one unit, an applicant pointing at a unit they do not hold, a sold unit shown *available* (or *booked* with nobody holding it), a cancelled
applicant who still holds a unit or has live demands, duplicate receipt numbers, receipts with no money, a *paid* demand with no cleared money,
a surrender that pays back more than was received, negative demand money, duplicate unit numbers ...
And: **no request may answer 5xx.** (A 4xx for bad input is the right answer and is not counted as a failure.)

Run: `SEED=123 STEPS=250 PEOPLE=16 TALLY=1 BASE=http://localhost:3010/api node api-test-whole-flow.mjs`
(the seed is printed; the same seed repeats the same random choices; `TALLY=1` prints every endpoint with its status and the reason for each refusal).

## What it found (all fixed)
| # | Found | Fix |
|---|-------|-----|
| 1 | A receipt dated a day with no GST slab gave a **500** | the GST lookup error now has status 422 and its message |
| 2 | Cheque bounce with a penalty with paise (`8949.34`) gave a **500** (column is whole rupees) | the penalty must be a whole number, otherwise 400 |
| 3 | Filling **POA details** for the main applicant (booking form, applicant edit) gave a **500**: the column existed only for co-applicants | migration `115_consumer_poa_details.sql` |
| 4 | Sending `relationship` (a co-applicant-only field) for a main applicant gave a **500** | ignored for the main applicant |
| 5 | An applicant could be booked into a **second unit** while holding the first; the link to the first unit was overwritten, and cancelling the second marked the applicant *cancelled* while the first unit (and its demands) was still live | booking (start and confirm) refuses an applicant who already holds another unit (409), the same rule Allotting and Transfers already had |
