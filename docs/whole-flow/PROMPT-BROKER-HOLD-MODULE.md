Main Jatin Singla hoon, ROF CRM (Grapes Worldwide) ka owner. Hinglish, chhote jawab, faisle tum lo, no em dashes, no UI emojis.
Repo: /Users/ketansingla/Desktop/Grapes/Rof CRM/rof-crm. Pehle docs/whole-flow/PROMPT-TDS-MODULE.md (9 steps), docs/tds/README.md, docs/payments-rest/README.md, docs/whole-flow/NEXT-SESSION-PROMPT.md ("Local setup") padho. Docs par bharosa nahi, code padho aur chala ke dekho. Apni worktree (branch broker-hold-mod) me kaam karo.

Module: BROKER (Broker Reports) aur INVESTOR / HOLD. Code: packages/api/src/routes/brokers.ts, broker_setup.ts, inventory_hold.ts (mount aur rbac index.ts me), broker commission / payment ke hisse (booking.ts, payments.ts, financial-ops.ts me broker_commissions, broker_range, broker_payment dhoondo), process permissions broker_range_entry aur broker_payment_entry (middleware/processPermission.ts), screens packages/web/public/js/pages (broker, broker reports, hold) aur index.html menu.

Har route par:
1. Guard list (rbac / process / none), 6 roles (super_admin, project_manager, sales_executive, accounts_finance, read_only_viewer, bina login), project scope (assignedProjectIds).
2. Hostile validation: ids, percent 0 se 100, TDS/GST rate, amount negative/0/paise/1e3/bahut bada, dates, length, script, arrays, galat state, duplicate.
3. Paisa aur state: commission = base x rate, TDS aur GST jaisa code claim karta hai, paise rounding, cancelled/surrendered/transferred booking par commission, kamai se zyada payment, double payment, jahan process hai wahan maker-checker; ek unit do logon ko hold, hold do baar release, hold expiry, sold/blocked unit hold, doosre ke hold wali unit book; inventory count vs unit status. Faisle likho.
4. Race: 5 parallel hold ek unit par, 5 parallel broker payment.
5. Fix root cause; migration 119+ sirf zarurat par (dusra session bhi 119 le sakta hai, clash batao).
6. Tests: docs/broker-hold/api-test-broker-hold.mjs (apna data, random + SEED print, last line "RESULT: N passed, M failed", cleanup), docs/broker-hold/README.md, docs/demo-seed-broker-hold.mjs.
7. Asli browser: e2e/broker-hold.spec.ts (harness e2e/lifecycle.spec.ts se; DB ko PG* env se plain `psql`). Ek asli flow: broker banao, uske through unit book karo, commission screen aur DB me dekho, pay karo, booking cancel karke commission ka kya hua dekho; unit hold karo, kisi aur se book karne ki koshish, release.

Apna DB/port: rof_broker (pg_dump rof_sec se, cluster /tmp/rofpg port 5433), API port 3015 (API_RATE_MAX=500000). rof_sec/3010 aur rof_rep/3014 ko mat chhuo. Apna hi PID kill karo.
CI rules: khali DB me chalna chahiye (apna data), migrations do baar chalengi (idempotent), CI `npx playwright test` se saari specs chalata hai (spec tez rakho).
Done = apne tests green, phir sab docs/*/api-test-*.mjs (PGDATABASE=rof_broker BASE=http://localhost:3015/api, background) green, flows + lifecycle + payments-rest + apni spec green, `cd packages/api && npx tsc -p . && node copy-files.js`. Push mat karo; sab green par worktree branch par commit. Report Hinglish me: asli bugs, fixed, not fixed, files, not covered.
