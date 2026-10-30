# Master handoff: make ROF CRM work exactly like the client's CRM (data flow first)

Written 2026-10-29 for the owner (Jatin Singla, Grapes Worldwide) and for any engineer or AI that continues the work. Everything here comes from reading the client's live system (4QT "Real Estate Manager") and our code; nothing is guessed unless it says so.

## 0. The goal, in the owner's words, and how to read it
"Our CRM must work exactly like theirs, pixel perfect on the data flow, no mistake anywhere; do the root work, not patches."
Reading used here: **same fields, same flow, same numbers for the same inputs** (money, dates, statuses, who-can-do-what). The *look* of their old ASP.NET screens is not copied unless the owner asks; the look of the **data** (columns, labels, order, totals) is. Ask the owner before copying any visual style.
Working rules the owner set: read code, not docs; roles and validation on every route; test the worst and random cases with your own data; one `.md` per module; keep earlier modules working; fix the root cause with a shared helper or guard, not a patch per screen; save tokens; owner-style decisions are delegated; Hinglish with the owner.

## 1. What is in `docs/client-crm/`
| File | What it holds |
|---|---|
| `MENU-MAP.md` | the client's whole menu (212 links) |
| `GAP-LIST.md` | screen-by-screen comparison, each row HAVE / PARTIAL / GAP (from code search; verify in the app) |
| `DATA-FLOW.md` | how data moves from project to surrender, formulas, status lists |
| `PROJECT-IMPORT-RESULT.md` | their project ROF GALLERIA@78 entered into ours; what fits and what does not; booking form field-by-field |
| `captured/01..11` | raw captures: setup forms, sale-flow screens, report columns, applicant payment file, masters in use, letters model, roles, parking, broker, journal / debit-credit / shift |
| `import-galleria78.mjs` | enters their project into our local API and prints what our CRM cannot hold |
| `e2e-payment-file-parity.mjs` | books a customer on that project, raises demands, enters receipts, compares our Applicant File with their file |
| `check-interest-parity.mts` | the interest helper alone against their numbers |
| `screens/` | ~100 screenshots of their screens. **Not in git** (real customer names). Give them to the next engineer separately. |

## 2. Golden numbers (their real file, used as the acceptance test)
Unit 510 sq ft, rate 11,500 on **super** area = **net basic 58,65,000**; GST 5% (2.5 CGST + 2.5 SGST) = 2,93,250; **total with tax 61,58,250**; plan 9 / 10 / 81 gives demands **5,27,850 / 5,86,500 / 47,50,650**; installments due 23 Jan and 22 Feb 2023; receipts (tax inclusive) 6,75,750 (23 Jan), 3,54,853 (17 Feb), 4,94,317.50 (20 Apr) = **15,24,921 received**; interest 15% simple on the **basic** amount, delay days -30 / -5 / 57 => **3,111**, GST 5% on interest = 156; total receivables 61,61,361; **balance 46,36,441**.
Run: start the local API (port 3020), then `BASE=http://localhost:3020/api node docs/client-crm/e2e-payment-file-parity.mjs` (needs `import-galleria78.mjs` run first on a fresh database). State at the end of this session: **10 of 10 rows pass** (interest 3,111.34; balance 46,36,440, one rupee of rounding).

## 3. Decisions already taken (owner, 2026-10-29)
1. **Interest is charged on the basic amount, without GST** (the client's way). GST on the interest is a separate 5% line. (The old "Option B", interest on the GST-inclusive installment, is gone.)
2. Money received is matched to the **oldest installment first by date received**, not by the installment a receipt happened to be filed under.
3. A payment made before the due date does not start the delay clock.

## 4. Done in this session (all uncommitted in the working tree; API suite green, Playwright not run, see section 7)
- `packages/api/src/utils/payment-waterfall.ts` `buildInterestRows`: basis = basic only (installment amount + add-on base, receipts minus their CGST / SGST), oldest-first pool by date, early payments anchored to the due date.
- `packages/api/src/routes/consumers.ts`: the receipts query for the interest rows now also selects `cgst_amount, sgst_amount`.
- `packages/api/src/routes/booking.ts` (`buildApplicantFileHtml`, `buildApplicantPage1`): the "Interest" box on page 1 is the total of the interest table; "Interest Waive off" shows the real approved waiver; Total Receivables = total with tax + interest - waiver (so Balance now includes interest, as theirs does).
- `docs/CORE_LOGIC_REFERENCE.md` section 3 now carries a note describing the new rule (section 6 item 3 is closed there).
- `docs/reports/api-test-reports.mjs`: the interest expectation now uses the basic amount.
- `packages/api/dist` rebuilt (CI checks it is in sync: `cd packages/api && npx tsc -p . && node copy-files.js`).

- **Set Master** (second module done, see `docs/set-master-parity/README.md`): migration 126, `master.ts`, `set-master.js`, test with 92 checks. Area type, currency, bank used-as + loan-bank projects, country codes and mobile digits, document master scope, dispatch master. Still open there: screens for dispatch master and loan-bank projects, Letter Head Format, using mobile digits to validate numbers.

## 5. Root-cause work plan (do in this order; each item: problem, evidence, root fix, test)
**P0 money and dates (a wrong number reaches a customer)**
1. *GST on interest*: theirs adds 5% GST on the interest (156 on 3,111) in a separate summary; check ours does the same wherever interest is shown or collected. Test: golden numbers.
2. *Receipts in paise*: ours takes whole rupees only ("up to 0 decimals"); theirs has 4,94,317.50. Root: one money type with 2 decimals in the receipt route and tax split. Test: receipt of 494317.50 is stored and the split sums to it.
3. *Back-dated demands*: ours refuses "due date cannot be in the past"; their data has 2023 demands. Root: allow a past date for an admin / import path with an audit line. Test: raise a demand dated 2023-01-23.
4. *Pricing basis*: ours prices a unit as rate x carpet area, the form shows the super area under the label "Carpet Area", and a 5,000-per-super-sq-ft project shows 10,000. Root: add "rate effective on" (Super / Carpet / Built-up / Plot) to the unit type and use it in the form, the server estimate and every report. Test: golden unit books at 11,500 per sq ft and shows 510 under the right label.
5. *Hidden duplicates*: two payment files can show different interest (old stored `interest_amount`): search for other readers of the stored value and switch them to the one helper.

**P1 masters (data cannot be stored today)**: details in `PROJECT-IMPORT-RESULT.md` section "What did NOT fit".
6. Unit type: super, built-up, UDSL, plot (+unit), group, Per Area / In Fix, salable, rate-effective-on, areas shown on payment file, construction and UDSL cost, unit of measure, rate date, unit map; areas to 3 to 4 decimals everywhere (unit type accepts 2, unit accepts 4).
7. Reminder master per project with rank (route ignores `project_id` and `rank` although the table has them).
8. Document master unique per project and document-from (their "Physical Application Form" exists for Individual and Company).
9. Project card: project type, area with its unit, RERA and TCP not compulsory; tower extras (new name, prefix, sort order, completion date).
10. Interest master: Simple / Compound, frequency, "calculated on receipt date".
11. Per-project switches: receipt number prefix and mode per receipt type, registration number mode and size, booking / journal / unit-shifting authentication, transfer authentication.
12. Payment plan: plan type (Construction / Down payment / Flexi / Time), % or fixed, timely discount, "100%" vs "100 - discount", description.

**P2 booking form** (see `PROJECT-IMPORT-RESULT.md`): unit type from the project's own unit types (not a fixed BHK list); classification per project; the 13 titles; relation S/o W/o D/o C/o A/s; full 37-state list; profession master; finance (branch, contact person, contact no, file no, file date, employee, sanctioned amount, remarks); extra cost heads (Alteration/Scheme, IFMS, Additional, Extra); Rate List; Preview step; 3-step approval trail (entered, checked, approved, with who and when) and an approval for edits; registration number rules.

**P3 missing screens and small features**: everything marked GAP in `GAP-LIST.md` plus section 10 there (customer file lock/unlock, Track per master, adjustment type, TDS certificate and documents, parking allotment letter, broker discontinue and parent broker, Applicant Payment File grouped columns, Customer Register bulk Print Welcome / SMS / E-mail, Demand Status colours and D / R1 / R2 buttons, reports with project-specific charge columns, 12-field Unit Wise Area).

**P4 look**: only if the owner asks. Their screens are in `screens/`.

## 6. How to do each item (conventions of this repo)
Express + TypeScript API in `packages/api` (compiled `dist` is committed and CI checks it); vanilla JS SPA in `packages/web/public`; Postgres (Neon live). Every new migration must be **idempotent** (CI runs each twice) and numbered after 123. RBAC via `rbac(resource)`; project scope is database row-level security. Shared helpers in `utils/input.ts` (bad, failWith, uuid, has, num, text, day, flag, body, r2, inTx, paging, qtext, oneOf, lock, financeOnly, pos). Dates: never `toISOString().slice(0,10)` for "today" (use `Utils.today()` in the web, `(NOW() AT TIME ZONE 'Asia/Kolkata')::date` in SQL). Tests: each module has `docs/<module>/api-test-*.mjs` printing `RESULT: N passed, M failed`; browser specs in `e2e/*.spec.ts`. Local run: Postgres 18 binaries are in `/Library/PostgreSQL/18/bin`; build a database with `packages/api/scripts/make-test-db.sh <db>` and migrations from 096 upward; run the API with `DB_HOST DB_PORT DB_NAME PORT JWT_SECRET NODE_ENV=development npx tsx src/index.ts`.
For every item: change the shared helper or the route once, add a test that uses the golden numbers or their field list, add the module `.md`, run the whole suite, then check the screen in a real browser.

## 7. Honest status: what is NOT checked
- **API tests: all 38 scripts pass** after the interest change (one reports test, `api-test-reports.mjs`, asserted the old GST-inclusive interest and was changed to the new rule: 956 passed). The **browser (Playwright) specs were not run**; run them before merging. Nothing is committed or pushed yet.
- Not opened in the client system: GST invoicing screens (this login has no project in their dropdown), Edit Installment (asks a security code), the 3 help PDFs, reports that were empty for the two visible projects, projects other than GALLERIA@78 and AMBLISS (13 exist), what other roles see, real printed layouts of the demand, reminder, receipt, allotment, ATS and TPA letters, the wording of every letter type, and any behaviour that needs saving data.
- "HAVE" in `GAP-LIST.md` came from code search, not from running our screen next to theirs. Only the booking form, the project masters and the golden payment file were compared against a running copy of ours.
- Their database was never seen; relations in `DATA-FLOW.md` are read from screens.
- Their access ends today 16:00 IST; anything not captured by then must be asked of the owner.

## 8. Acceptance checklist for "exactly like theirs"
1. Golden payment file: 10 of 10 rows pass, including paise receipts and a back-dated demand through the normal screens.
2. `import-galleria78.mjs` reports no GAP rows (all 26 closed).
3. Booking form lists every field in `captured/01` and `README.md`, with the same pick lists.
4. Every report in `captured/03` and `captured/04` has the same columns in the same order.
5. Every screen row in `GAP-LIST.md` is HAVE after being opened in our app.
6. Whole test suite green, CI green, migrations run twice.
