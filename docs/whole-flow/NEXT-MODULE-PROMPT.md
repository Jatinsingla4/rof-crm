# Prompt: ek module ko in-depth check karna (har naye module ke liye yahi use karo)

Neeche `<MODULE>` ki jagah module ka naam likho (list neeche hai) aur poora paste karo.

---

Main Jatin Singla hoon, ROF CRM (Grapes Worldwide) ka owner. Hinglish me, chhote jawab. Faisle tum khud lo ("tum owner ho").
Repo: /Users/ketansingla/Desktop/Grapes/Rof CRM/rof-crm. Pehle memory padho (MEMORY.md) aur docs/whole-flow/NEXT-SESSION-PROMPT.md me "Local setup" wala hissa padho.

Aaj ka module: **<MODULE>**. Isko aise hi in-depth check karo jaise Applicants, Booking, Demands, Receipts, Transfers, Surrender, Allocations ke saath kiya tha. Docs/README par bharosa nahi, code padho aur chala ke dekho.

## Steps (is order me)
1. **Code padho:** is module ke saare routes (`packages/api/src/routes/...`), unhe jo screens/JS call karti hain (`packages/web/public/js/pages/...`), aur jo tables/migrations chhoote hain. Route list banao: kaunsa mounted hai `rbac(...)` ke saath, kaunsa bina; kaunsi `requireProcess` / `requirePermission` laga hai; kaha input check nahi hai.
2. **Roles:** har route ko har role (super_admin, project_manager, sales_executive, accounts_finance, read_only_viewer, aur bina login) se chalao. Kaun dekh/bana/badal/hata sakta hai, aur kya hona chahiye. Project scope (RLS) bhi: ek project ka user doosre project ka data na dekhe.
3. **Validation:** har field ke liye: khali, null, galat type, list/object, bahut bada, negative, 0, paise (decimals), "1e3", SQL, `<script>`, unicode/zero-width, galat/doosre ka uuid, future/past dates, `2026-02-30`. Kuch fields bharo, kuch chhodo. 4xx saaf message ke saath, kabhi 500 nahi.
4. **Worst aur random cases, sirf best case nahi:** galat order ke steps, same cheez 2 baar, saath-saath (parallel 4-6 requests, race), beech me cancel/restore, doosre module ka data (cancelled booking, transferred unit, bounced receipt) aur wapas. Money wale kaam me: rounding, total match, double count. DB constraints aur transactions dekho (locks, `FOR UPDATE`, advisory lock, unique).
5. **Apna test data banao:** naya project/tower/units/plan/GST/applicants, purane test cases reuse nahi. Random seed print ho (`SEED=...`) taaki repeat ho sake.
6. **Fix karo:** root cause me (shared helper me), `utils/input.ts` ke helpers (`bad`, `failWith`, `uuid`, `has`, `num`, `text`, `day`, `inTx`), `pgErrorHandler`, `auditChange`, `likeOf` jo bante hain wahi use karo. Naya migration chahiye to `packages/api/src/db/migrations/<next number>_...sql` (abhi last 115) aur local dono DB me lagao.
7. **Test likho:** `docs/<module>/api-test-<module>.mjs` (CI `ls docs/*/api-test-*.mjs` se uthata hai, last line `RESULT: N passed, M failed`) + `docs/<module>/README.md` (kya mila, kya fix hua, kya jaan-boojh ke chhoda) + `docs/demo-seed-<module>.mjs` (demo DB http://localhost:3020 ke liye data). Isme random/hostile cases ho, sirf seedhe nahi.
8. **Asli browser:** is module ki har screen par har tab, har filter (har option), har button click karo. Playwright spec `e2e/` me, 5xx / JS error / console error / screen par `undefined`, `NaN` fail maane jaye. Ek asli flow ke saath (data banao, screen se karo, API/DB se check karo).
9. **Purane module na tootein:** poori regression: `bash .github/scripts/run-api-tests.sh $(ls docs/*/api-test-*.mjs | sort)` + `cd e2e && BASE_URL=http://localhost:3010 npx playwright test`. Chaos test bhi: `docs/whole-flow/api-test-whole-flow.mjs`.
10. **Build, commit, push:** `cd packages/api && npx tsc -p . && node copy-files.js` (dist commit hoti hai, CI check karti hai), `git fetch` + merge (Pappu seedha main par push karta hai), push, CI dekho. Commit message me kya fix hua aur kitne tests.
11. **Report:** Hinglish me: kya mila (asli bugs, severity), kya fix kiya, kya nahi kiya aur kyun, local link, aur agla module kaunsa.

Tokens bachao: bade files poore mat padho (grep/offset), rerun tabhi jab kuch badla ho, lambe sleep chains nahi (until-loop ya background). Download se pehle poochho.

## Modules jo baaki hain (is order me suggest)
1. **Receipts ka TDS hissa + receipt process:** `routes/receipt-process.ts` (TDS challans, assign, bina rbac/validation), Receipts screen ke Assign TDS (button ka function hi nahi), TDS report, Journal Entry, Edit/Cancel tabs, receipt print/html, `/receipts/:id/reject` (UI bulata hai, route nahi).
2. **Payments ke baaki routes** (`routes/payments.ts`): payment-plans create, interest scheduler / master / waiver / customer-wise interest / grace period, GST invoices (create, cancel, pdf, report, user rights), draw refunds, clearing banks, receipt-form / receipt-detail.
3. **Bina `rbac` ke mount hue routers** (`index.ts`): faq, dashboard (demand block har demand ginta hai), loans, registry, financial-ops, outgoing-payments, milestones, reconciliation.
4. **Broker / Investor / Hold:** brokers, broker_setup, inventory_hold (commission transfer par seller ke saath jata hai).
5. **Reports (bahut screens):** har report me filter, totals, export, role/project scope.
6. **CRM:** leads, tasks, campaigns, automation, email templates, communications/inbox, calling.
7. **Parking, Import/Customer folders/Unit docs, Analytics, Help.**

Pehle ye batao: kaun sa module lena hai, aur uske routes/screens ki list (kaunsa kaun se role ke liye khula hai), phir shuru karo.
