# Prompt for the next session (copy everything below the line)

---

Main Jatin Singla hoon, ROF CRM (Grapes Worldwide) ka owner. Hinglish me baat karo, chhote jawab do, aur "tum owner ho" wale faisle khud lo.
Repo: /Users/ketansingla/Desktop/Grapes/Rof CRM/rof-crm (https://github.com/Jatinsingla4/rof-crm). Pehle memory padho (MEMORY.md, khaaskar `project_whole_flow_browser_test`). Docs par bharosa mat karo, code padho aur chala ke dekho.

## Kaam: "pura flow check" ko asli browser me khatam karna
Mera rule: har tab, har filter, har CTA (button) click hona chahiye, random/ulte-seedhe values ke saath, apna test data banao, purane test cases reuse mat karo, kuch fields bharo aur kuch khali chhodo. Har module ka .md likho, purane modules na tootein, aur main ko local link do.

### Ab tak kya ho chuka hai
1. Modules (Applicants, Booking, Demands, Receipts, Transfers, Surrender, Allocations) API level par hardened hain, har ek ka README + api test `docs/<module>/` me hai.
2. `docs/whole-flow/api-test-whole-flow.mjs` (commit 0bcdb8d, CI green): random chaos test, 16 DB checks, koi 5xx nahi. Isne 5 bugs pakde aur fix hue (GST slab na hone par 500, bounce penalty paise par 500, POA details 500 / migration 115, `relationship` 500, ek applicant ko do units book hona). README `docs/whole-flow/README.md`.
3. Regression last baar green: 22 API scripts + Playwright 25/25.
4. **Uncommitted (sirf local):**
   - `e2e/lifecycle.spec.ts`: asli browser flow, 4 tests pass (Booking form → step 2 cash payment → Demand Raise customer-wise: doosri instalment pehli se pehle refuse hoti hai, phir 1st aur 2nd raise).
   - `e2e/zz-every-control.spec.ts`: crawler jo menu ki saari screens kholta hai (163 links) aur har filter option, text box aur button click karta hai, JS error / console error / 5xx / screen par `undefined`, `NaN`, `[object Object]` dhoondhta hai. Findings `/tmp/ap/crawl-found.txt` me likhta hai (copy `/tmp/ap/keep/`, agar /tmp bacha ho), report `e2e/test-results/crawl-report.json`.
   - `packages/api/src/index.ts`: ek line, `API_RATE_MAX` env se local rate limit badhta hai (production par 300/min hi rehta hai). `packages/api/dist` dobara build karni hogi (`cd packages/api && npx tsc -p . && node copy-files.js`) commit se pehle.
5. Crawler ka pehla poora pass **adhoora** hai: ~62 screens ho chuki hain (Set Master, Set Projects, Application/Booking ke kuch, Demand Raise tabs). Baaki ~100 screens (Receipts ke baad se Reports, Parking, CRM tak) nahi hui.

### Ab tak mile findings (crawler se)
- **Asli bug:** Receipts → "Assign Receipt Challan" tab → ASSIGN TDS button: `ReceiptsPage.assignTDS is not a function` (function bana hi nahi, `receipts.js` line ~748). Iska backend `packages/api/src/routes/receipt-process.ts` (TDS challans, `/tds/assign`) bina input-check aur bina `rbac` ke mount hai (`index.ts`: `app.use('/api/payments', authenticateToken, receiptProcessRoutes)`). Isko ek alag module pass chahiye.
- **Dekhna baaki:** set-projects screens par `undefined` (ek row jisme `F <id> undefined x E2E Co ...`, shayad project/GST row ka koi field null) aur `NaN` (Reminder Master me ek row jiska naam `{{7*7}}` hai aur days column `NaN`). Pehle pata karo ki ye purane hostile test data ki wajah se dikhte hain ya asli display bug (null/non-number par `undefined`/`NaN` dikhana).
- Towers ke naam `NaN`/`Infinity` purane test data hain (false alarm): crawler me data se aaye words ko ignore karne ka tareeka sochna (naam ke sath nahi, label/number me dhoondho).

### Agla kaam (is order me)
1. Local setup chalu karo (neeche "Local setup").
2. Crawler dobara chalao: `cd e2e && SKIP=62 MAX_BUTTONS=12 MAX_OPTIONS=6 BASE_URL=http://localhost:3010 npx playwright test zz-every-control.spec.ts` (~35 sec per screen, ~50 min). Findings `/tmp/ap/crawl-found.txt` me dekho. SKIP se resume hota hai; poore pass ke liye SKIP hata do. Agar kisi screen par atak jaye to us screen ko alag se kholke dekho (ek baar actionTimeout 4s se theek hua tha).
3. Mile hue asli bugs fix karo (pehle Assign TDS, TDS module hardening), false alarms ke liye crawler ko theek karo.
4. `lifecycle.spec.ts` me baaki screens jodo, har step ke baad DB/API se check: Demand unraise + stage/tower/installment/unit-stage tabs + demand-status; Receipts (entry, print, list, journal, edit, cancel, TDS tabs; deposit, clear, hold, bounce); pending cheques; Transfers (search, transfer, date edit, report, fee setup, letter); Surrender (surrender, detailed report, restore); Allotment (form, letter, search, shifting, cancel, waitlist, e-draw import). Galat input aur galat order ke cases bhi.
5. Sab kuch milakar full regression: 22 API scripts + Playwright (purane 25 + naye). Crawler ko CI me default se **mat** daalo (bahut lamba, Delete/Cancel click karta hai), env switch ke peeche rakho.
6. Fetch/merge karke push (Pappu bhi seedha main par push karta hai), CI dekho, last me `docs/whole-flow/README.md` me asli browser test ka hissa aur findings likho.
7. Uske baad bache hue (mujhe batao pehle): Payments ke baaki routes (payment-plans create, interest scheduler/master/waiver, GST invoices, draw refunds, customer-wise interest, clearing banks, receipt-form/detail/html), bina `rbac` ke mount hue routers (faq, dashboard, loans, registry, financial-ops, receipt-process, outgoing-payments), Dashboard ka demand block.

### Local setup (har naye session me)
- Postgres cluster socket `/tmp/rofpg`, port 5433, user postgres (agar band ho to dobara banao: `packages/api/scripts/make-test-db.sh`). psql: `/Library/PostgreSQL/18/bin` ko PATH me jodo.
- Test DB `rof_sec` (API port 3010, users `<role>@test.local` / `Test#Pass1234`), demo DB `rof_demo` (port 3020, `@demo.local` / `Demo#Pass1234`; link http://localhost:3020). Local migrations 110 se 115 dono me lagi hain; naya migration: `psql -q -h /tmp/rofpg -p 5433 -U postgres -d <db> -f packages/api/src/db/migrations/<file>.sql`.
- Servers (explicit env, `set --` wala loop PORT set nahi karta). `cd packages/api`, phir:
  `(API_RATE_MAX=500000 DB_HOST=/tmp/rofpg DB_PORT=5433 DB_NAME=rof_sec PORT=3010 JWT_SECRET=test-secret NODE_ENV=development nohup npx tsx src/index.ts > /tmp/ap/3010.log 2>&1 &)` aur wahi `DB_NAME=rof_demo PORT=3020` (bina API_RATE_MAX) ke saath. Band karne ke liye `pkill -f "[s]rc/index.ts"` (bracket zaroori, nahi to apna shell mar jata hai). Backend badalne par restart karo, auto-reload nahi hota.
- API tests: `PATH+=:/Library/PostgreSQL/18/bin PGHOST=/tmp/rofpg PGPORT=5433 PGUSER=postgres PGDATABASE=rof_sec BASE=http://localhost:3010/api bash .github/scripts/run-api-tests.sh $(ls docs/*/api-test-*.mjs | sort)` (~5 min, background me chalao, `BASE` zaroor set karo). Chaos test: `SEED=123 STEPS=250 TALLY=1 node docs/whole-flow/api-test-whole-flow.mjs` (same env).
- Browser tests: `cd e2e && BASE_URL=http://localhost:3010 npx playwright test <file>`; `API` 5xx aur JS errors har test me fail maane jate hain.
- Shell quirks: `grep` rtk-wrapped hai, regex ke liye `command grep` ya python use karo; macOS `sed -i ''`; `sleep N && ...` chains block hote hain, `until`/`for` loop ya background use karo; zsh me `=` se shuru hone wale words expand ho jate hain.

### Mere baaki (owner) kaam, yaad dilana
Neon password rotate, Render service delete, GitHub me `verify` check required karna, Pappu ko batana ki uske push CI green hone par hi deploy honge, live Neon par `docs/applicants/legacy-data-check.sql` (read-only) chalana, check karna ki live migrations 109 se 115 lag gayi (112 `receipt_number_seq`, 113 transfer amounts, 114 surrender pre_state, 115 `consumers.poa_details`), purani photos dobara upload.
