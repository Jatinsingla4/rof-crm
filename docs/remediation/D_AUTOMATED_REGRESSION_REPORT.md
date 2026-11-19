# D. Automated regression report

One command, from the repo root: `bash docs/remediation/run-regression.sh`. It builds a fresh throwaway database `rof_remed_regress` (baseline, migrations 096 to 152, fixture), starts the API on port 3098, runs everything, stops. It refuses any database name that does not start with `rof_remed_`.

Last run (clean database): **REGRESSION SUITE: ALL PASSED**.
| Layer | What ran | Result |
|---|---|---|
| Type check | `tsc --noEmit` | no errors |
| Unit | agreement-reconcile, money-rules, quote-schedule, a101-simulation | 29 tests, 29 pass |
| Database | db-cancelled-booking | 4 of 4 |
| HTTP | cancelled booking (9), GST invoices (10), reports batch 5 (10), security (18) | 47 of 47 |

Scenario map to the 14 areas asked for: 1 pricing and snapshots (quote-schedule, agreement-reconcile); 2 GST breakup and schedule (agreement-reconcile, quote-schedule); 3 effective-dated tax (only the booking-date rate lookup, not a full slab test); 4 receipts clearance and allocation (money-rules, a101 allocation); 5 partial payments and bounced instruments (**not covered**); 6 cancellation and pending approvals (http-cancelled-booking); 7 invoices, reversal, credit notes (http-gst-invoices); 8 maker-checker (http-security); 9 commission (list flag only); 10 unit booking and inventory locking (booking-exceptions only); 11 dashboard and report reconciliation (http-reports-batch5); 12 document tokens (http-security); 13 A-101 (a101-simulation); 14 every passing QA case (**not re-run**).

## CI-equivalent run: all API scripts and the browser suite
Same order as `.github/workflows/ci.yml`, on a throwaway database (`rof_remed_e2e`, India time zone, migrations 096 to 152), API from `src` with tsx (the committed `dist` is not rebuilt), port 3099. Static guards (no tax rate typed in a page script, no hidden code) passed.

First run: 80 of 88 API scripts OK, Playwright 271 passed, 1 failed. The 8 failed scripts and the failed browser test, and what they were:
| Failed | Cause | Kind | Handled |
|---|---|---|---|
| money-guard | 4 files gained a receipt query (brokers, payments, receipts, reports-dues); the guard asks for a review. Two read cleared money by the central rule, two read only status | review required | list counts updated after reading each query |
| payments-rest, gst-invoices, timely-discount, Playwright payments-rest | QA-003: an invoice needs project GSTIN and a financial year; the old tests did not set them. Later also: no rate is preselected any more, and a request without a rate is 400 before the scope check | intended behaviour change | tests set a test GSTIN, a financial year around today, and pick the rate (CI database only) |
| login-db-error, login-prod-mode, throttle | the harness only accepts databases named `rof_ci` or `rof_b1*`; throttle also needs a running API | environment | rerun on `rof_b1_remed` with an API |
| unit-status-flows | `ECONNRESET` during the first run | transient | passes on rerun, 25 of 25 |

After the fixes: money-guard 83/0, payments-rest 1006/0, gst-invoices 21/0, timely-discount 42/0, unit-status-flows 25/0, login-db-error 10/0, login-prod-mode 27/0, throttle exit 0 (it prints no RESULT line), Playwright `payments-rest.spec.ts` 12 passed.
Single full run after the test fixes (fresh DB `rof_b1_remed`, API from src on port 3099): all 88 API scripts OK. Playwright: 274 passed, 3 failed. The 3 failures (broker-hold Expiry, crm Leads filters, lifecycle E-Draw Import) were all `ENOSPC: no space left on device` (the machine disk was full during that run, not a code error). Rerun of the three whole spec files (broker-hold, crm, lifecycle) after freeing disk: 83 passed, 0 failed. Single-test reruns by line number are not valid for these files, they depend on earlier tests in the same file. Not one uninterrupted 277-test pass in a single process; the result is 274 plus 83 on the same code and DB.

## Not run
Migration rollback test; any run against the shared Neon database or the live site; bounced-instrument scenarios; R-01 to R-36 mapping (the Master Remediation Blueprint was not provided). `quote-parity.test.mjs` fails before and after (`source drifted: preview basicCost start not found`).
