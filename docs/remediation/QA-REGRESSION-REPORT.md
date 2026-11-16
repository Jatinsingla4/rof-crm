# Phase 8: automated QA of the release candidate

Run on 2026-11-16 on a local disposable database. **Nothing here was run in CI or on production.** The release candidate is the branch :  (3dea4fd) plus the phase branches for Phases 2 to 7 merged in order
(, , , , , ).
Merging them found three conflicts, all mechanical: an import line in , the generated  files (rebuilt), and the money-guard list (union of the entries). A first merge committed conflict markers in the guard list by mistake; it was caught by a scan before anything ran and fixed in the next commit.

## Result

| Level | What ran | Result |
|---|---|---|
| CI static checks, run by hand | hidden-code scan, tax literals in page scripts, syntax of every frontend script, dist rebuilt with no diff | 0 hits, 0 hits, 0 errors, 0 changed files |
| Migrations | fresh database from the baseline, every migration from 096 on run twice | all ok |
| API tests | all 85 files , one after another against one API | **9,751 checks passed, 0 failed** |
| Playwright | all 22 specs  | **274 passed, 0 failed** (11.4 min) |

Scan of the API outputs and the server log for crashes: none. The server log holds only refusals that the hostile-input checks provoke on purpose (for example "consumerId or allocationId is required").

## API tests by area

| Area (docs folder) | Files | Checks passed | Failed |
|---|---|---|---|
| addon-charges | 1 | 152 | 0 |
| allocations | 1 | 201 | 0 |
| applicants | 1 | 348 | 0 |
| auth-fixes | 1 | 68 | 0 |
| booking | 1 | 319 | 0 |
| booking-rebate | 1 | 130 | 0 |
| broker-hold | 1 | 569 | 0 |
| charge-master | 1 | 63 | 0 |
| concurrency | 1 | 5 | 0 |
| crm | 1 | 285 | 0 |
| crm-leftovers | 1 | 87 | 0 |
| dashboard-lists | 1 | 86 | 0 |
| dashboard-recon | 1 | 198 | 0 |
| demands | 1 | 191 | 0 |
| documents-core | 1 | 153 | 0 |
| documents-setup | 1 | 132 | 0 |
| employees-setup | 1 | 116 | 0 |
| end-to-end | 1 | 60 | 0 |
| gst-configuration | 1 | 271 | 0 |
| money-decisions | 7 | 72 | 0 |
| money-integrity | 3 | 178 | 0 |
| operations | 1 | 8 | 0 |
| outgoing | 1 | 39 | 0 |
| parking-import | 1 | 194 | 0 |
| payment-plans | 1 | 180 | 0 |
| payments-rest | 1 | 1006 | 0 |
| receipt-allocation | 1 | 19 | 0 |
| receipts | 1 | 292 | 0 |
| remediation | 8 | 168 | 0 |
| reports | 2 | 980 | 0 |
| security-setup | 2 | 191 | 0 |
| set-master-fixes | 2 | 248 | 0 |
| set-master-parity | 1 | 92 | 0 |
| set-master-setup | 2 | 157 | 0 |
| set-projects-parity | 4 | 399 | 0 |
| set-projects-setup | 4 | 469 | 0 |
| small-routers | 1 | 296 | 0 |
| smtp | 1 | 82 | 0 |
| surrender | 1 | 183 | 0 |
| tds | 1 | 246 | 0 |
| timezone | 1 | 49 | 0 |
| transfers | 1 | 286 | 0 |
| users-roles | 15 | 425 | 0 |
| web-guards | 1 | 12 | 0 |
| whole-flow | 2 | 46 | 0 |
| **Total** | **85** | **9751** | **0** |

Ten files print no final RESULT line (older scripts); their checks are counted from their PASS and FAIL lines, which is how the table counts every file.

## What the earlier phases added, and where it is tested

| Phase | Area | Suites |
|---|---|---|
| 1 | server quote, receipts quote, interest preview, snapshot flag, shadow, reconciliation | booking (310), dashboard-recon (198), remediation/api-test-wave0 |
| 2 | payment-entry GST from the server | booking (9 payment-quote checks) |
| 3 | receipt allocation with the flag ON, shadow report, invariants | remediation/api-test-allocation-flows (23), api-test-allocation (8), receipt-allocation, receipts, allocations |
| 4 | GST invoices tied to receipts, notes, reconciliation of invoices | remediation/api-test-gst-invoices (21) |
| 5 | one meaning per financial measure across 14 reports | remediation/api-test-financial-measures (28), reports (956 + 24) |
| 6 | commission payout gate (flag), list totals | remediation/api-test-commission-payout (16), api-test-pagination (34), broker-hold (569) |
| 7 | historical repair kit | remediation/api-test-historical (32) |

## What this does not show

- **The R-01 to R-36 regression set was not run as such.** Its text (blueprint pages 17 to 19) is no longer on this machine and was not kept in the session notes, only its grouping (R-01 to 08 pricing, R-09 to 12 and 21 to 25 reports, R-13 to 20 allocation, status and invoice, R-26 and 27 booking, unit and demands, R-31 to 34 tax and interest). I did not invent a mapping to the IDs. If the blueprint PDF is supplied, each R-ID can be mapped to a check above or to a new one in a short pass.
- **CI has not run** on any of these branches. A local pass is not a CI pass: CI also builds from a clean checkout and runs the same suites on its own runner.
- **Local conditions**: one machine, one database, tests run one after another, Node 20. Two earlier local failures were data-size effects on a database that had accumulated thousands of rows (perf timing checks and an "under 1000 rows" check); they pass on a fresh database as here. A single failure of  in an earlier run did not repeat.
- **Not covered by a browser test**: the GST figures shown on the payment-entry screen, the commission payout screen, the Analytics KPI figures beyond the label and the contract balance, the bulk-bounce warning text. The API tests cover the numbers they come from.
- **Flags**:  and  were OFF in this run except inside the tests that switch them on and put them back, and  is absent (off). The behaviour with those flags ON in production is not shown by this run.
- **Blocked by decisions, so no test**: unit reservation (BR-09, N days not given), BR-12 and BR-13 (tax advisor), the open decisions D1 to D10 in the finance notes.
- **Not examined for new defects**: transfers, parking, add-on charges, interest and general error handling (only their existing suites ran, and passed).
