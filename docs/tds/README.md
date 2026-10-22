# TDS challans (Receipts screen)

A TDS challan is the tax payment slip the company deposits. Its amount is handed out to receipts ("assigned"); what is left is the challan **balance**.
Routes: `packages/api/src/routes/receipt-process.ts` under `/api/payments`, helper `packages/api/src/utils/tds.ts`, migration `116_tds_challan_balance.sql`.
Screen: Receipts, tabs *Upload Tds Challan*, *Assign Receipt Challan*, *TDS Challan Report* (`packages/web/public/js/pages/receipts.js`).

## Who can do what
| Action | Who |
|---|---|
| Read challans, one challan with its assignments, the scanned file, receipt search, journals | every signed-in role (payments:view) |
| Add a challan, assign it to a receipt, release an assignment | super_admin and accounts_finance only (everyone else 403, also project_manager) |
| Journal entry add / approve / reject | process access *JV / Refund / Dr-Cr* maker / checker (super_admin exempt), as before |

A user limited to some projects cannot assign to a receipt of another project (the receipt does not exist for them, 404). Challans themselves belong to the company, not a project.

## Routes
| Route | What it does |
|---|---|
| `GET /tds/challans` | `status` (available, partially_assigned, fully_assigned, all), `search` (number or bank), `page`, `pageSize` (1 to 500). Returns rows with `assigned_amount`, `balance`, `has_file`, and `totals`. |
| `GET /tds/challans/:id` | One challan with every assignment, released ones too (receipt number, applicant, why released). |
| `GET /tds/challans/:id/file` | The scanned copy (served with its real type, `nosniff`). |
| `GET /tds/receipts?search=` | Live (not cancelled or bounced) receipts by number or applicant, with TDS already assigned. At least 2 letters. |
| `POST /tds/challans` | JSON or multipart (`file` part). Number 50 chars (letters, digits, space, `/ _ . -`, unique ignoring case), date not in the future, amount more than 0 up to 1,000,000,000 with up to 2 decimals, bank 255, BSR 7 digits, file PDF/PNG/JPEG up to 5 MB (type read from the bytes). The file is kept in the database. |
| `POST /tds/assign` | `{ challanId, receiptId, amount }`. One transaction; the receipt row is locked, then the challan row. |
| `POST /tds/assignments/:id/release` | Takes an assignment back; the amount returns to the challan. The row stays as history. |

## Money rules (decided)
- Challan balance = amount minus assigned. `tds_challans.assigned_amount` is moved by a delta only while the challan is locked, with a database check `0 <= assigned <= amount`, so it can never go negative or over.
- An assign is refused (409) when: the challan has less left, the receipt is cancelled or bounced, the same challan is already live on that receipt, or the TDS on the receipt would be more than the receipt amount (counting other challans).
- **Cancelling or bouncing a receipt releases its assignments**: the challan balance comes back, the history row says "Receipt cancelled" or "Receipt bounced".
- A unit transfer moves the assignments with their receipts to the buyer.
- Challan status is derived: `available`, `partially_assigned`, `fully_assigned`.

## Found and fixed here
Router had no role check at all (any login could add and assign); `/tds/assign` had no check on balance, receipt state or project (a challan could be assigned beyond its amount); `ASSIGN TDS` button called a function that did not exist; the scanned file field was never sent; `/receipts/:id/reject` did not exist (Reject now cancels the receipt through the cancel route); journal entries always failed with a 500 (`journal_entry_seq` was never created) and their list put `pageSize` into the SQL text; the report rounded challan amounts to whole rupees.

## Tests
`node docs/tds/api-test-tds.mjs` against a local test API (`BASE=http://localhost:3010/api`, psql env set, `SEED=n` repeats a random run). Own data, cleaned up at the end, last line `RESULT: N passed, M failed`.
Browser: `e2e/lifecycle.spec.ts` (Receipts part: generation, list filters, print, journal tabs, challan upload / report / assign / release / edit / cancel / bounce).
Demo data: `BASE=http://localhost:3020/api node docs/demo-seed-tds.mjs` after `demo-seed-receipts.mjs`.
