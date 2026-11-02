Main Jatin Singla hoon, ROF CRM (Grapes Worldwide) ka owner. Hinglish me, chhote jawab. Faisle tum khud lo ("tum owner ho").
Repo: /Users/ketansingla/Desktop/Grapes/Rof CRM/rof-crm. Pehle memory padho (MEMORY.md) aur docs/whole-flow/NEXT-MODULE-PROMPT.md padho (steps) aur docs/whole-flow/NEXT-SESSION-PROMPT.md ka "Local setup" hissa (servers, DB, test chalane ke commands).

Aaj ka module: **Receipts ka TDS hissa + receipt process**. Isko in-depth check karo, jaise Applicants se Allocations tak kiya tha. Docs par bharosa nahi, code padho aur chala ke dekho.

Ab tak kahan tak ho chuka hai:
- In-depth hardened (code + roles + validation + race + apne test data + README + demo seed): Applicants (348 checks), Booking (264), Demands (186), Receipts (281), Transfers (280), Surrender (183), Allocations (199). Dusre purane modules bhi (addon, charge-master, documents, employees, gst, plans, plc, project-setup, units-rates, security, scope, setup, fixes, deep, end-to-end) ke API tests hain. Sab `docs/<module>/` me.
- Poore CRM ka API chaos test `docs/whole-flow/api-test-whole-flow.mjs` (random order, har field bhara/khali/junk, parallel, 16 DB checks, koi 5xx nahi): push hua (commit 0bcdb8d, CI green). Isse 5 bugs mile aur fix hue (GST slab na hone par 500, bounce penalty paise par 500, POA details 500 + migration 115, `relationship` 500, ek applicant ko do units).
- Last full regression green: 22 API scripts + Playwright 25/25. Local migrations 110 se 115 lagi hain; live Neon par 109 se 115 check karni baaki (owner kaam).
- Asli browser: `e2e/lifecycle.spec.ts` (Booking form → payment → Demand Raise, 4 tests pass) aur crawler `e2e/zz-every-control.spec.ts` (~62 / 163 screens ho chuki) abhi **uncommitted** hain. Crawler ne ab tak ek asli bug dikhaya: Assign TDS button. Baaki crawl, aur lifecycle me Receipts/Transfers/Surrender/Allotment ke tabs baaki hain (detail `docs/whole-flow/NEXT-SESSION-PROMPT.md` me).
- Is module ke baad: Payments ke baaki routes, bina rbac ke routers, Broker/Hold, Reports, CRM, Parking.

Jo pehle se pata hai is module ke baare me (verify karo, maan mat lo):
- `packages/api/src/routes/receipt-process.ts` (TDS challans list/create, `POST /tds/assign`) bina input-check aur bina `rbac` ke mount hai (`index.ts`: `app.use('/api/payments', authenticateToken, receiptProcessRoutes)`). Koi bhi logged-in user challan bana ya assign kar sakta hai. `/tds/assign` me koi check nahi: challan ki balance, receipt cancelled/bounced, doosre project ki receipt, same challan do baar, amount.
- Receipts screen (`packages/web/public/js/pages/receipts.js`), tab "Assign Receipt Challan": "ASSIGN TDS" button `ReceiptsPage.assignTDS()` bulata hai jo bana hi nahi (JS error). `loadAssignTDS`, `uploadTDS`, `loadTDSReport` bane hain. Upload me file (`tds-file`) UI me hai par bheji nahi jati (`fileUrl` kabhi nahi).
- UI `/receipts/:id/reject` bulata hai par route nahi hai.
- Tables `tds_challans`, `tds_assignments`: schema aur constraints dekho. Bounce/cancel par assignment ka kya hota hai, ye abhi tay nahi.
- Receipts screen ke baaki tabs jo abhi tak browser me click nahi hue: Journal Entry, Edit Receipt, Cancel Receipt, TDS Challan Report, Receipt Print, Receipt List.

Flow:
1. **Code padho:** receipt-process.ts ke saare routes, receipts.js ke TDS/Journal/Edit/Cancel/Print functions, tables, migrations. Route list banao: kaunsa rbac ke saath, kaunsa bina.
2. **Roles:** har route 6 roles (super_admin, project_manager, sales_executive, accounts_finance, read_only_viewer, bina login) se. Hona chahiye: dekhna `payments:view`, challan banana/assign karna accounts_finance + super_admin (process maker), baaki 403. Project scope (RLS): doosre project ki receipt par assign na ho.
3. **Validation (hostile):** challan number khali/duplicate/bahut lamba/script, amount negative/0/paise/1e3/bahut bada, date galat/future, file galat type/bahut badi. Assign me galat challan/receipt id, doosre project ki receipt, cancelled/bounced receipt, challan se zyada amount (2 receipts milake bhi), same challan do baar ek hi receipt par, 5 parallel assigns (race). Kuch fields bharo kuch khali.
4. **Paisa:** challan balance = amount − assigned, kabhi negative nahi. Receipt cancel/bounce ho to assignment wapas (challan balance wapas) ya block, tum faisla lo aur likho. TDS report ke totals assignments se match.
5. **Fix (root cause me):** `rbac('payments')` + `requireProcess` ya `requirePermission`, `utils/input.ts` helpers (`bad`, `failWith`, `uuid`, `has`, `num`, `text`, `day`, `inTx`), `pgErrorHandler`, `auditChange`, transaction + lock (`pg_advisory_xact_lock`, `FOR UPDATE`). `assignTDS` function aur uska UI banao (challan select, receipt search, amount). Challan file upload ya to sach me chalao (disk nahi, DB me, jaise photos) ya UI se hatao. `/receipts/:id/reject` ya to route banao ya UI se hatao. Migration 116 agar chahiye (constraints/balance).
6. **Test likho:** `docs/tds/api-test-tds.mjs` (apna naya data, random values, seed print, last line `RESULT: N passed, M failed`), `docs/tds/README.md`, `docs/demo-seed-tds.mjs` (demo DB http://localhost:3020).
7. **Asli browser:** Receipts screen ke saare tabs (Receipt Generation, Print, List, Journal Entry, Edit, Cancel, TDS Challan Report, Assign Challan, Upload Challan): har filter option, har button, Playwright me, 5xx/JS error/console error/`undefined`/`NaN` fail. Ek asli flow: challan upload → receipt par assign → report me dikhna → receipt cancel karke dekhna ki assignment ka kya hua. Is flow ko `e2e/lifecycle.spec.ts` ka Receipts hissa bana do (deposit, clear, hold, bounce ke saath).
8. **Regression + push:** 22 API scripts, Playwright (purane 25 + naye), chaos test (`docs/whole-flow/api-test-whole-flow.mjs`); `cd packages/api && npx tsc -p . && node copy-files.js`; `git fetch` + merge; push; CI dekho.
9. **Report:** Hinglish me: kya mila (asli bugs, severity), kya fix kiya, kya nahi kiya aur kyun, local link, agla module (Payments ke baaki routes).

Tokens bachao: bade files grep/offset se padho, rerun tabhi jab kuch badla ho, lambe sleep chains nahi (until-loop ya background). Download se pehle poochho.

Pehle batao ki tumne kya samjha aur routes/screens ki list, phir shuru karo.
