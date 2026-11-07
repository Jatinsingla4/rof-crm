# QA Cycle 3: status of every finding (8 Nov 2026, against origin/main 3b8ae64 plus uncommitted work)

Legend: FIXED = changed in this folder, uncommitted. UPSTREAM = already fixed in origin/main (the live build). BY DESIGN = the rule is already decided in the repo docs and the code follows it. DECISION = needs an owner or CA decision. WITHDRAWN = not a defect. BROWSER = needs a person in a real browser.

## What was run (all on a throwaway local database `rof_cycle3`, never the live database)
| Check | Result |
|---|---|
| `tsc --noEmit` (packages/api) | clean |
| Parity tests (`packages/api/test`, 46 checks) | 46 of 46 pass |
| Full API suite, 60 scripts (`docs/*/api-test-*.mjs`, same runner as CI) on the new code | 58 passed at first; 2 failed and were then fixed or explained (below); the 3 scripts that were re-run (numbering 28/0, gst-configuration 271/0, booking 276/0) all pass |
| Receipts suite with 5 new advance-cancel checks | 288 passed, 0 failed |
| Migrations 147 and 148 applied twice | clean both times |
| Browser (local app, Super Admin test login) | unknown-route toast works; unsaved-form guard works (Cancel keeps the form, OK leaves); status chips read "Authorized", "Pending"; projects API returns `other_units`; link token carries only userId, tv, purpose and p |

The two failures in the first full run: `api-test-numbering` was caused by MY change (the placeholder RERA check refused real numbers starting `NA-`; the check is now tight and has 3 permanent tests); `api-test-gst-configuration` failed once on a randomly generated HSN code that happened to start with 99, unrelated to this work, and passes on re-run.
Not run: the browser tests (`e2e/`, Playwright), the booking preview discount guard and the GST/balcony failure toasts end to end (they need the full booking form filled), and anything against the live site or database.

## Findings
| ID | Finding | Status | What was done or what is needed |
|---|---|---|---|
| C3-01 | GST mapping unreachable | FIXED | Menu entry Set Master > Set Up > GST Configuration (it was four levels deep); error text names the real path; the booking form now shows a toast when the project's GST rate cannot be found instead of silently keeping a placeholder. Default rates for a new project are a tax policy, not seeded (DECISION G1). |
| C3-02 | Preview total wrong | UPSTREAM + FIXED + DECISION | Preview subtracts the discount (upstream). The balcony fetch failure is now announced instead of silently dropping the balcony. The remaining gap (unrounded basic price, GST base) is DECISION G2 to G5 in GST_QUOTE_ARCHITECTURE.md. |
| C3-03 | Beta discount dropped | WITHDRAWN | Beta has no discount stored (read-only query, QUOTE_PARITY.md 6a). |
| C3-04 | Alpha file contradicts itself | UPSTREAM + DECISION | File total subtracts the discount (upstream). Page 2 NET BSP stays pre-discount against post-discount INST AMT (parity difference S5): needs the owner's call on whether the column shows the discounted price. |
| C3-05 | Receipts not deducted in the file | BY DESIGN + FIXED | Only cleared receipts count as received, the standing rule. The file now shows a line "Receipts awaiting clearance (not deducted)" so the listed receipts reconcile with the table; advance parts are left out of that line so money is not shown twice. |
| C3-06 | ADV receipt orphaned | FIXED | Migration 148: an advance part records its source receipt; cancelling the source receipt cancels its parts and lowers the plan's advance amount; parts already approved or cleared block the cancel with a 409. Advance rows stay out of the default Receipt List and the cash reports on purpose (counted once, via the paying receipt). Tested (5 checks). Rows made before migration 148 have no recorded source and are not guessed. |
| C3-07 | Receipt List vs Project Wise Collection differ | BY DESIGN (partly) | Collection reports count cleared, non-advance receipts only; the list shows every status. Different questions, so different totals; labelling both screens is a UI follow-up. |
| C3-08 | Customer Balance wrong or empty | BY DESIGN | Documented rule (docs/reports/README.md): balance = raised demands minus cleared receipts; a surrendered booking is not a customer. Beta showing 0 means nothing was demanded yet. |
| C3-09 | Same unit allotted twice, status contradictions | FIXED (part) | Allotment Search now has Project and Tower columns (the "double" was the same unit number in two projects). Migration 147 adds a partial unique index: one live allocation (booked, allotted, agreement signed) per unit, created only when no duplicate exists (otherwise skipped with a notice). The full suite, including transfers and surrenders, passes with it in place. Status of surrendered consumers across screens is the documented model (surrendered = not a customer). |
| C3-10 | Demand letter Print "does nothing" | WITHDRAWN (probable) | The page answers with a browser alert, which an automated tester cannot see; upstream also refuses a placeholder RERA with a 409. A person should confirm. |
| C3-11 | RERA-X-NONE printed | FIXED | `realRera()` on the applicant file and letters; placeholder refused on project create and edit (tight pattern, tested); Project Details shows "Missing (placeholder)". The stored test value still needs real data. |
| C3-12 | Discount above price, negative total | FIXED | Preview refuses with a message; the server already refused on save. Not exercised end to end in the browser. |
| C3-13 | Balcony field mangling | BROWSER | Not reproduced or changed. |
| C3-14 | Child dropdowns empty at first render | BROWSER | Not reproduced or changed. |
| C3-15 | Rate basis unlabelled | UPSTREAM + DECISION | The rate field is already limited to 4 decimals; whether the rate is per carpet or super area is DECISION OBQ-7. |
| C3-16 | Per-instalment rounding | UPSTREAM | Confirmation path splits on running shares; the manual demand generator still rounds per row (parity difference S2). |
| C3-17 | Interest 90.00 vs 89.75 | UPSTREAM | The file now uses one interest figure, the total of the interest table. |
| C3-18 | Applicant file data quality | FIXED (part) | Gender and marital status read as words; the address no longer repeats city, state and PIN. Nationality left raw on purpose (the document editor writes the shown text back to the database and GST exemption tests compare exact spellings). PAN "N/A", form number and name casing are data rules. |
| C3-19 | Status vocabulary | FIXED | `Utils.chip` ignores case and shows unknown statuses as words with a capital. Screens that print status themselves are not covered. |
| C3-20 | Project counts do not add up | FIXED | New "Other" column; available + allotted + other = units. |
| C3-21 | Unknown routes redirect silently | FIXED | Toast "That page does not exist, so the dashboard is shown." (checked in the browser). The "Cannot read properties of null" error was not reproduced. |
| C3-22 | No unsaved-data warning | FIXED | Forms marked `data-warn-unsaved` (the booking form) ask before leaving with edits, by menu, link or back button, and on closing the tab (checked in the browser). |
| C3-23 | Link tokens carry identity and role | FIXED | Link token carries only userId and session version; the name is read from the database for the audit log. Checked from the browser; the print and download suites pass. |
| C3-24 | Four GST rates in four places | DECISION | G1 to G8. The form already takes the project's resolved rate; the visible placeholder is now announced when it cannot. |
| C3-25 | Slow saves invite double submit | BROWSER | Needs a performance and browser test. |

## Left, and only the owner or a person can close it
1. GST policy (G1 to G8 in GST_QUOTE_ARCHITECTURE.md): category, rate, land value, discount, balcony and PLC treatment, rounding, rate date, NRI zero-rating, area basis. Needs the CA; nothing was guessed.
2. Owner call on the page 2 NET BSP column (C3-04) and the preview rounding.
3. A person in a browser: C3-13, C3-14, C3-25, the demand letter alert (C3-10), the discount-guard and GST toasts, and the Playwright suite in `e2e/`.
4. Real data: replace the placeholder RERA on the test project, and review any duplicate live allocations on the real database before migration 147 can create its index there (it skips itself with a notice if any exist).
5. Rows from before migration 148 keep no source link; their advance parts are not cancelled automatically.
