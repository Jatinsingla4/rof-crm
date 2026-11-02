Main Jatin Singla hoon, ROF CRM (Grapes Worldwide) ka owner. Hinglish, chhote jawab, faisle tum lo, no em dashes, no UI emojis.
Repo: /Users/ketansingla/Desktop/Grapes/Rof CRM/rof-crm. Pehle docs/whole-flow/PROMPT-TDS-MODULE.md (9 steps), docs/tds/README.md, docs/payments-rest/README.md, docs/whole-flow/NEXT-SESSION-PROMPT.md ("Local setup") padho. Docs par bharosa nahi, code padho aur chala ke dekho. Apni worktree (branch reports-mod) me kaam karo.

Module: REPORTS (menu: Inventory, Unit Status, Applicant Detail, Collection, Dues, Stage Wise Dues, Percentage Wise, Due Ageing Report, Charge Detail, aur reports.ts ke baaki routes). Code: packages/api/src/routes/reports.ts (235 KB), packages/web/public/js/pages/*report*, packages/web/public/index.html menu.

Har report route par:
1. Guard list (rbac / none), 6 roles (super_admin, project_manager, sales_executive, accounts_finance, read_only_viewer, bina login) aur project scope (PATCH /users/employee-login/:id assignedProjectIds; doosre project ki rows aur totals nahi dikhne chahiye).
2. Hostile filters: uuid, dates, from>to, page/pageSize, search me % _ ' script, arrays, enums, bade values. 5xx nahi, input se SQL text nahi.
3. NUMBERS (sabse zaroori): apna data banao (applicants, bookings, demands, receipts paise ke saath, cancelled/bounced receipts, surrendered/transferred units, GST) aur har total, row count, percentage, ageing bucket, balance ko alag SQL (base tables se) se match karo. Cancelled/bounced receipts bahar, due = demand + GST - paid, ek applicant ke kai units/plans me double count nahi, rounding, khali result, zero se divide, NaN/undefined/null kabhi nahi. Exports (CSV/Excel/print) screen ke barabar aur escaped (= + - @ se shuru cells).
4. Few thousand rows par performance (N+1 nahi, pageSize cap).
5. Fix root cause me; migration 119+ sirf zarurat par (dusra session bhi 119 le sakta hai, clash batao).
6. Tests: docs/reports/api-test-reports.mjs (apna data, random + SEED print, last line "RESULT: N passed, M failed", cleanup), docs/reports/README.md, docs/demo-seed-reports.mjs.
7. Asli browser: e2e/reports.spec.ts (harness e2e/lifecycle.spec.ts se: JS error, console error, 5xx, undefined, NaN = fail; DB ko PG* env se plain `psql` se padho, fixed db name nahi). Screen ke numbers API/SQL se match.

Apna DB/port: rof_rep (pg_dump rof_sec se, cluster /tmp/rofpg port 5433), API port 3014 (API_RATE_MAX=500000). rof_sec/3010 aur rof_broker/3015 ko mat chhuo. Apna hi PID kill karo.
CI rules: khali DB me chalna chahiye (apna data), migrations do baar chalengi (idempotent), CI `npx playwright test` se saari specs chalata hai (spec tez rakho).
Done = apne tests green, phir sab docs/*/api-test-*.mjs (PGDATABASE=rof_rep BASE=http://localhost:3014/api, background) green, flows + lifecycle + payments-rest + apni spec green, `cd packages/api && npx tsc -p . && node copy-files.js`. Push mat karo; sab green par worktree branch par commit. Report Hinglish me: asli bugs (galat totals pehle), fixed, not fixed, files, not covered.
