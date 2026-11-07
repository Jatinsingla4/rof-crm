# Quote parity stage: what was built, what was found

Stage objective: architectural preparation and verified parity. NO change to any amount payable by any customer.
Companion: `GST_QUOTE_ARCHITECTURE.md` (design, sign-off table). Nothing here is committed, pushed, deployed or run against any real database.

## 1. Files

| File | Purpose |
|---|---|
| `packages/api/src/utils/quote.ts` | `quoteLegacy()`: the three existing calculations reproduced line for line, returned side by side. Not imported by any route or screen. |
| `packages/api/test/quote-parity.test.mjs` | Cuts the REAL source lines out of `booking.js` and `booking.ts`, runs them, and compares with the golden file and with `quoteLegacy()`. |
| `packages/api/test/fixtures/quote-golden.json` | 13 golden scenarios (inputs and the outputs of the existing code). Synthetic numbers modelled on the QA Cycle 3 report. |

Run: `cd packages/api && npx tsx --test test/quote-parity.test.mjs` (28 checks, pass). Regenerate only for a signed-off change: `UPDATE_GOLDEN=1 ...`.

How parity is kept honest: the test does not hold its own copy of the formulas. It extracts the live lines by their text. If anyone edits them, the extraction fails with "source drifted", so the golden file cannot go stale unnoticed. This was checked by changing a preview line (test failed), then restoring it.

No schema change, no migration, no change to GST policy, rounding, rebate or pricing formula.

## 2. Balcony: Rs 60,000 vs Rs 60,600 (traced in code)

Formula (`balcony-charge.ts`, `project-settings.ts balconyTerms`): `balcony = MIN( MIN(balcony area, project max area) x rate , cap )`, GST added on top.
- rate: `charge_master_config.rate_value` where `charge_key = 'balcony_charge'` (seeded default 1,300 per sqft, migration 083/104).
- cap: `project_settings.balcony_max_charge_inr` for the project; if blank, `charge_master_config.cap_value` (seeded 1,00,000).
- area: `units.balcony_area_sqft` (the booking row's own area column is not used).

Findings:
1. Rs 60,600 is the CAP the tester typed in Set Projects for QA Cycle 3, not a booking figure. With 100 sqft x 1,300 = 1,30,000 the cap applies, so the Cycle 3 booking balcony would be exactly Rs 60,600 (fixture 1).
2. Rs 60,000 appeared in the ZZ TEST applicant files (Alpha, Beta), a DIFFERENT project with its own cap and unit balcony area. The two numbers never belonged to the same booking. Reproduced by fixture 3 (cap 60,000 gives a file total of 56,15,600.00, which is the Beta file's 56,15,612 less the Rs 12 instalment rounding).
3. The preview showed NO balcony line in Cycle 3 because the browser fetches `/charge-master/balcony-preview` and swallows any failure with a console warning (`booking.js` ~2527-2532), leaving balcony at 0. A project with no GST mapping makes that endpoint answer 422, so the preview silently drops the balcony. Fixture 2 shows the effect: preview 55,55,000.12 against save 54,60,600.00 and file 56,16,206.00.

NOT verified: the actual ZZ TEST cap, rate and balcony area (needs a database read, which was out of bounds). Both values are explained by the code path; the stored ZZ TEST field values still need one read-only look to close this fully.

## 3. The three paths (exact behaviour, preserved)

| | Preview (browser) | Save (server, `PATCH /:id`) | Applicant file (server) |
|---|---|---|---|
| Source | `booking.js` 2506-2542 | `booking.ts` 897-931 | `booking.ts` 1486-1530 |
| Basic price | form rate x form carpet area, unrounded | `Math.round(rate x true carpet)`, else `parseInt(unit base price)` | `Math.round(rate x true carpet)`, else unit base price with paise |
| Discount and rebate | not read at all | subtracted | not subtracted |
| PLC, other | added | added | added |
| Add-on charges | not included | not included | added to consideration |
| Balcony | server preview value, GST included, 0 if fetch failed | amount without GST (GST stored separately) | amount without GST in agreement value; stored GST in the tax lines |
| GST | one form percent (blank defaults to 0.5) on basic + PLC + other, unrounded | not part of `totalAmount`; per instalment later in demands | `Math.round` on (basic + PLC) and on other at its own percent, plus stored balcony GST; replaced by the sum of active demands when within Rs 1,000 of that figure |
| NRI / OCI / PIO | taxed | GST zeroed for balcony | zeroed |

## 4. Output comparison (all 13 golden scenarios, Rs)

| Scenario | Preview total | Save total (no GST) | File total with tax |
|---|---|---|---|
| Cycle 3 like, cap 60,600, discount 1,00,000 | 56,16,206.12 | 54,60,600.00 | 56,16,206.00 |
| same, preview balcony fetch failed | 55,55,000.12 | 54,60,600.00 | 56,16,206.00 |
| cap 60,000 variant | 56,15,600.12 | 54,60,000.00 | 56,15,600.00 |
| no balcony area | 55,55,000.12 | 55,00,000.00 | 55,55,000.00 |
| PLC 2,50,000 + other 1,20,000 | 59,89,906.12 | 59,30,600.00 | 60,10,306.00 |
| discount and rebate together | 56,16,206.12 | 54,35,600.00 | 56,16,206.00 |
| discount larger than basic price | 56,16,206.12 | -4,39,400.00 | 56,16,206.00 |
| rate 0, fractional unit price | 61,206.00 | 55,60,600.00 | 56,16,206.75 |
| NRI exempt | 56,16,206.12 | 55,60,600.00 | 55,60,600.00 |
| demand sums within 1,000 | 56,16,206.12 | 55,60,600.00 | 56,16,200.00 |
| demand sums more than 1,000 away | 56,16,206.12 | 55,60,600.00 | 56,16,206.00 |
| add-on 15,000 + other 50,000 | 56,66,706.12 | 56,10,600.00 | 56,90,206.00 |
| balcony limited to 40 sqft | 56,07,520.12 | 55,52,000.00 | 56,07,520.00 |

Save total is before GST by design, so it is never expected to equal the other two; the columns answer different questions today.

## 5. Differences found (preserved, not resolved)

| # | Difference | Effect |
|---|---|---|
| D1 | Preview ignores discount and rebate; the file ignores them; only save subtracts them | Customer-facing file and preview overstate by the discount (C3-03). Pinned by a test. |
| D2 | Preview basic price unrounded, others rounded | 1 to 2 paise differences (C3-02, C3-15). |
| D3 | GST: flat unrounded (preview) vs rounded per part (file) vs demand sums (file override within Rs 1,000) | Up to Rs 1,000 of tax silently taken from demands instead of the computed figure; Rs 12 per-instalment rounding (C3-16). |
| D4 | Balcony: preview includes GST in total, save and file keep it separate; preview drops it silently if the fetch fails | Preview short by the whole balcony when the fetch fails. |
| D5 | NRI: preview taxes, save and file do not | Preview wrong for NRI. |
| D6 | `parseInt` on the unit price in save, `parseFloat` in the file | Up to Rs 0.99 difference when the fallback is used. |
| D7 | Add-on charges only in the file | File total differs from the others by the add-on amount. |
| D8 | Blank form GST percent becomes 0.5 in the preview | Preview can tax when no rate is set. |

## 6. Unexplained differences (need data or the live build, not guessed)

1. Report C3-04 shows Alpha's file total Rs 55,15,600, which has the discount applied. The code at HEAD never subtracts the discount in the file (D1). So either the live build differs from HEAD, or Alpha's stored rate or booking row was changed by another path (a document edit write-back or a rebate approval). Needs a read-only look at Alpha's booking row.
2. The live preview showed a "Discount" line; the preview at HEAD has no discount code. Confirms the live build lags or differs from HEAD (the caveat the inventory already raised).
3. ZZ TEST balcony cap and area values (section 2).

### 6a. Read-only findings (owner ran block 1 of readonly-alpha-zztest.sql, 7 Nov 2026)
- ZZ TEST balcony: unit area 100 sqft, applied rate 1,300 (so 1,30,000 before the cap), stored charge 60,000, GST 300 + 300 (0.5% each). The charge is the cap, as in section 2. The cap value itself (block 2) was not shown yet.
- Beta (ZZREG-2026-000015) has `company_inaugural_disc = 0`, rebate 0. So the Beta file showing no discount is CORRECT for the stored data. QA finding C3-03 ("discount dropped on Beta") is withdrawn unless the tester entered a discount that was never saved. Remaining Beta difference: Rs 12 instalment rounding (C3-16).
- Alpha (ZZREG-2026-000014) has `company_inaugural_disc = 1,00,000`, stored rate unchanged (7,857.1429), so the discount is not folded into the rate. HEAD's file code ignores the discount (D1), yet the live Alpha file showed Rs 55,15,600 (discount applied). So the live build differs from HEAD here. Still open: which build, and the audit trail (block 4).
- Block 2: Charge Master balcony rate 1,300, cap 1,00,000. Project caps: ZZ TEST 60,000, QA Cycle3 60,600. Section 2 is now fully confirmed from data: both figures are per-project caps on the same rate and area.
- Block 3 (demands): Beta rows add to 55,60,000 (278,000 + 1,112,000 + 6 x 695,000), the pre-discount total. Alpha row amounts follow 54,60,000 (273,000 = 5%, 1,092,000 = 20%, 682,500 = 12.5%), the post-discount total, so save and demands apply the discount. But Alpha's GST per row (1,390 / 5,560 / 3,476) is identical to Beta's, so GST was worked out on the UNDISCOUNTED basic price. This matches the owner's expected 55,15,600 (1% of 55,00,000, discount subtracted from the total only). Alpha is surrendered: rows 2 to 9 cancelled, row 1 paid.
- Block 4 (audit) failed: the column is `timestamp`, not `created_at`. Query fixed, not yet re-run.
- Both applicant-file builders at HEAD (page 1 at ~1462, page 2 at ~2068) contain no discount or rebate term. The live Alpha file showed Agreement Value 54,60,000, which HEAD cannot produce from these stored values. Conclusion with data: the live build differs from HEAD in the file builder (or a layer outside booking.ts rewrites the figure). The audit rerun can only show whether the price was edited; it cannot explain a code difference.

## 7. Paths NOT covered yet (found while reading; also compute money)

- A second applicant-file builder at `booking.ts` ~2086-2204 (separate arithmetic, e.g. `pct / 100` rounding on the balcony).
- `demands.ts` 83-100: basic = total - PLC - other - balcony, rate per instalment with `Math.round` per component; the instalment schedule rows themselves (the cause of C3-04's schedule totals).
- `utils/rebate.ts planTotal`, `utils/report-ledger.ts` basic price, `routes/surrender.ts` ~207, `routes/reports.ts` 643 and 1326.
These need their own fixtures before any of them can be switched to a shared function.

## 8. Checks run

| Check | Result |
|---|---|
| `npx tsc --noEmit` in packages/api | pass (no errors) |
| `npx tsx --test test/quote-parity.test.mjs` | 28 of 28 pass |
| Mutation check on a preview line | test failed as intended; file restored, no diff |
| `docs/booking/api-test-booking.mjs` (264 checks) | NOT RUN: needs a live API and database; the only local Postgres asked for a password and production access is out of bounds |

## 9. Not done on purpose
Not switched: no screen or API uses `quoteLegacy`. No schema or migration. No GST, rounding, rebate or pricing change. Nothing committed or pushed.

## 10. Stale checkout found: the live build is origin/main, this folder is not (7 Nov 2026)

Matching the live build first turned up the cause of the "unexplained" items in section 6.
- This folder's HEAD (`8327bfa`, plus uncommitted work) is on an old base (merge-base `8000ec22`). `origin/main` (`3b8ae64`) is 10 commits ahead, among them "QA second round: instalments add up to the whole price and GST" and "Field inventory fixes".
- The static `booking.js` served by https://rof-crm-ten.vercel.app is byte-identical to `origin/main`'s, not to this folder's. So the live build is origin/main.
- origin/main's money code differs from this folder (read from a throwaway checkout in the scratchpad, since removed; nothing in this folder was merged):
  1. Applicant file: `netBasicPrice = basePrice - inauguralDisc` (GST stays on the full price). This is why the live Alpha file showed Agreement Value 54,60,000.
  2. Browser preview: subtracts the discount and shows an "Inaugural Discount" row.
  3. Booking confirmation splits instalments on running shares (`splitGstAcrossInstalments`) so rows add up to the whole price and GST. Beta's demand rows were made before this, which is why they still show the old per-row rounding.
  4. Reminder 1, Reminder 2 and Termination rows say "Not set up" (matches the live QA finding).
- Rebuilt on origin/main in the throwaway checkout: the same 13 golden scenarios now give: Alpha-like (cap 60,000, discount 1,00,000) file total 55,15,600.00, exactly the figure live showed. Differences D1 (discount) is gone upstream; D2 to D8 remain. tsc clean, 28 of 28 pass there.
- UPDATE: this folder is now synced to origin/main (3b8ae64) and the rebased `quote.ts`, `quote-parity.test.mjs` and `fixtures/quote-golden.json` are in place under `packages/api/`. Sections 1 to 5 above describe the OLD base; the numbers in sections 4 and 5 for D1 and the table are superseded by this section and the golden file. tsc clean, 28 of 28 pass on the synced tree. Backups: branch `backup-pre-sync-8327bfa` and git stash `pre-sync 2026-11-07 ...`.
- Upstream already refuses a Demand Letter with a placeholder RERA (409, `merge-demand.ts` ~118). My `realRera` guard on the other print paths and the placeholder check on project save were re-applied on top.
- QA findings C3-03 (withdrawn, section 6a) and the preview and file parts of C3-02 and C3-04 were already fixed upstream.
- Safety sweep of the 10 incoming commits: no `atob(` loader; matches for `eval(`/`new Function` are Playwright test code, and one 1,535-character line is test SQL.

## 11. Instalment schedules (second parity pass, on the synced origin/main tree)

Added to `quote.ts`: `saveSchedule()`, `manualSchedule()`, `fileSchedule()`. Test: `packages/api/test/quote-schedule.test.mjs`, golden file `test/fixtures/quote-schedule-golden.json` (8 scenarios, 18 checks, all pass). As before, the legacy outputs come from the REAL lines cut out of `booking.ts` (confirmation, ~1001-1035; applicant file page 2 row block) and `demands.ts` (manual generator ~83-100), run with a stub rate lookup (no database). Mutation checks: a +1,000,000 change to the manual `basic` line and a +7 change to the confirmation amount line each made the tests fail; both files restored with no diff. Still no screen, API, schema, GST, rounding or pricing change.

Totals per path (Rs), Alpha-like booking (discount 1,00,000, balcony cap 60,000, 9-row plan):

| Path | Rows add up to | GST total |
|---|---|---|
| Confirmation (`booking.ts`) | 54,60,000 | 55,600 |
| Manual generator (`demands.ts`) | 54,60,000 | 54,606 |
| File page 2 with stored demands | INST AMT 54,60,000, NET BSP 55,00,000 | from the stored demands |
| File page 2 without stored demands | INST AMT 55,00,000, NET DUE 55,55,000 | own arithmetic |

Beta-like (no discount, total 55,60,000): confirmation GST 55,600, manual generator 55,612 (the Rs 12 per-row rounding of C3-16 is still produced by the manual generator; the confirmation path already fixed it).

Differences found (preserved, not resolved):
| # | Difference |
|---|---|
| S1 | GST base: confirmation taxes the PRE-discount basic price (55,000 + balcony 600); the manual generator taxes basic = total minus the rest, i.e. POST-discount (54,606 here). Same booking, Rs 994 apart. |
| S2 | Rounding: confirmation splits on running shares so rows add to the whole; manual generator rounds each row (Rs 12 drift on Beta-like). |
| S3 | NRI rule: confirmation and file treat nri, oci and pio as exempt; the manual generator exempts only `nri` (an OCI or PIO consumer is taxed). |
| S4 | Flat-amount instalments: confirmation honours them; the manual generator ignores them and bills the percentage (here Rs 1,00,000 less in total, 51,87,000 against 52,87,000). |
| S5 | File page 2 NET BSP column is always the PRE-discount price x percentage, while INST AMT comes from the stored demand (POST-discount), so the columns do not reconcile after a discount (this is the visible part of C3-04). The balcony column is rebuilt as the remainder, then replaced by the independent figure when the two differ by more than Rs 1,000. |
| S6 | Without stored demands the file page 2 omits balcony and discount in INST AMT (55,00,000) and lands on NET DUE 55,55,000, against 55,15,600 on the pricing summary. |
| S7 | Plans not adding to 100% fall back to per-row rounding in the confirmation path too. |

New unexplained difference: none. Old live rows (Alpha INST AMT 54,98,000, NET DUE 55,53,030) came from before the instalment-split fix and are not reproducible from today's code; they need no further trace.

Not covered still: `rebate.ts planTotal`, `report-ledger.ts`, `surrender.ts`, `reports.ts` money arithmetic, page 1 vs page 2 totals reconciliation, receipts and interest.
