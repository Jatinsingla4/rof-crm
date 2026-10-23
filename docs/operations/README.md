# Operations (`/api/operations`): removed

`routes/operations.ts` had two endpoints, `POST /unit-shift` and `POST /application-transfer`. Nothing in the screens or tests called them, and each one did a weaker version of a module that is already hardened and tested:

| Removed | Use instead | Why the old one was unsafe |
|---|---|---|
| `/operations/unit-shift` | `POST /allocations/shift` (docs/allocations, 199 checks) | Moved only the allocation row: booking, payment plan, price and history were left on the old unit; no project or lock checks; the log insert missed the required shift date (500); every error was a 500. |
| `/operations/application-transfer` | `POST /transfers` (docs/transfers) | Changed only `allocations.consumer_id`: receipts, demands, plan, TDS assignments, penal interest and the booking stayed with the old applicant, so the money no longer matched the owner. Unknown ids were a 500, the applicant's existence was not checked. |

Both needed the maker process permission, so only users with `unit_shifting` / `applicant_transfer` could reach them, but those users could silently corrupt a booking. The process permissions themselves stay (the real routes use them).

Test: `api-test-operations.mjs` (8 checks): both paths and the base are 404, and the two real routes still need a login and check their input.
