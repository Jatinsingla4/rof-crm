# CLAUDE.md (ROF CRM Project)

Project-specific rules for Claude Code working on ROF CRM.

---

## RULE 0: WORKING DIRECTORY BOUNDARY — ABSOLUTE RESTRICTION

### The Rule

**ONLY work inside:** `D:\Desktop\Grapes\ROF Project\`

**NEVER touch:**
- `D:\Desktop\Grapes\Pay10\`
- `D:\Desktop\Grapes\Pay10 Bahrain\`
- Any other folder outside `D:\Desktop\Grapes\ROF Project\`

### Context

The parent directory `D:\Desktop\Grapes\` contains 3 sibling projects:

```
D:\Desktop\Grapes\
├── Pay10\              ← FORBIDDEN. Never read, write, or reference.
├── Pay10 Bahrain\      ← FORBIDDEN. Never read, write, or reference.
└── ROF Project\        ← ONLY allowed working directory.
```

### What This Means in Practice

- ❌ DO NOT read files from `Pay10\` or `Pay10 Bahrain\`
- ❌ DO NOT write or edit files from those folders
- ❌ DO NOT run git commands from those folders
- ❌ DO NOT reference, copy from, or compare against those folders
- ❌ DO NOT accidentally glob or grep into those folders
- ✅ All work stays inside `D:\Desktop\Grapes\ROF Project\`

### Why This Rule Exists

The parent directory is a shared workspace. `Pay10` and `Pay10 Bahrain` are separate, unrelated client projects. Any accidental read or write to those folders could expose confidential data or corrupt a separate project.

### Before Every Tool Call That Touches the Filesystem

Verify the target path starts with `D:\Desktop\Grapes\ROF Project\`.
If it does not → **STOP. Do not proceed.**

---

## CRITICAL: Build dist/ Before Every Commit

**MANDATORY RULE:** Before every git commit in this project, ALWAYS rebuild the TypeScript distribution.

### Why This Matters

- **dist/ is committed to GitHub** (not gitignored)
- **Per render.yaml, Render's build phase runs `npm install && npm run build && npm run db:migrate` on every deploy**, from a fresh checkout of the git repo. `npm run build` is `tsc && node copy-files.js` — so Render DOES compile TypeScript on every deploy; it does not simply run whatever `dist/` was committed. The state of `dist/` in git has no effect on what code actually runs in production — Render regenerates it fresh from `src/` every time.
- **Despite that, `dist/` must still be kept correct and committed — for local development/testing, not production.** Local runs (e.g. `localhost:3001`) use the committed `dist/` directly via `node dist/index.js`, with no rebuild step. If `dist/` is stale, local testing runs old code even though production would rebuild correctly.
- **src/ without dist/ rebuild = silent failure of local testing to reflect src/ changes** (production is unaffected, since Render rebuilds independently — but this repo does not rely on that safety net for local work, so the rule stays mandatory).
- **Migrations run once, during this same Render build phase** (`npm run db:migrate`), **not at server startup.** Runtime migration execution was deliberately disabled in `index.ts` (see the Neon cold-start hang workaround) — the server logs `[STARTUP] Skipping runtime migrations (already applied during build)` and never calls `runMigrations()` itself.

### Workflow for Every Change (MANDATORY)

Every commit must follow this sequence:

1. Make changes in `packages/api/src/`
2. **`cd packages/api && npx tsc`** ← MANDATORY BUILD STEP
3. Verify zero TypeScript errors (command returns clean)
4. `cd ../.. && git add <specific files by name>` — stage specific files by name, then check `git status` before committing
5. `git commit -m "message"`
6. `git push origin main`

### Red Flags to Catch

- ❌ Committing without running `npx tsc`
- ❌ Seeing TypeScript errors and ignoring them
- ❌ Assuming dist/ was built automatically (it's not)
- ❌ Pushing without verifying the build succeeded

### Deployment Chain

```
src/ changes → npx tsc → dist/ rebuilt → git add → commit → git push
                    ↑
            CANNOT SKIP THIS
```

Render's auto-deploy will:
1. Pull commit from GitHub
2. Run `npm install && npm run build && npm run db:migrate` (rebuilds dist/ fresh from src/, then applies migrations)
3. Start with `node packages/api/dist/index.js` (run from repo root), serve production traffic

Because Render rebuilds dist/ itself, a stale committed dist/ does NOT cause stale production code. It DOES cause incorrect behavior when running the app locally from the committed dist/ (no local rebuild step) — which is why the rebuild-before-commit rule above remains mandatory.

---

## RULE 2: SURGICAL CHANGES ONLY

### The Core Rule

Fix **ONLY** what is explicitly asked. Do **NOT** touch anything else.

### What This Means

- If asked to fix demand letter → fix **ONLY** demand letter
- If asked to fix a DB column → fix **ONLY** that column
- If asked to fix a frontend bug → fix **ONLY** that frontend file
- Do NOT improve nearby code
- Do NOT refactor related functions
- Do NOT fix things you notice while working on something else
- Do NOT add features not asked for
- Do NOT change other files that might be affected

### Before Making ANY Change, Ask Yourself

1. Was I explicitly asked to change this file? **YES/NO**
2. Was I explicitly asked to change this function? **YES/NO**
3. Was I explicitly asked to change this line? **YES/NO**

If the answer is **NO** → **DO NOT TOUCH IT**.

### The Cascade Problem (Real Example)

This project experienced this exact pattern:

1. Asked to fix demand_letter 404
2. Claude also changed allotment_letter and payment_receipt template lookup
3. This caused a 500 error
4. Which caused missing column errors
5. Which required 4 more fix sessions
6. All from **ONE unnecessary change**

**One unasked change = hours of debugging.**

### Allowed Exceptions

You **MAY** touch additional files **ONLY IF**:

1. You tell the user **FIRST**:
   ```
   "To fix X, I also need to change Y
    because [specific reason].
    Shall I proceed?"
   ```
2. The user confirms **YES**
3. Never assume permission

### Required Before Every Task

State out loud at the start:

```
I will change ONLY:
- File: [specific file]
- Function: [specific function]  
- Reason: [exactly what was asked]

I will NOT touch anything else.
```

### The Verification Test

After making changes, run:

```bash
git diff --name-only HEAD
```

If **more files changed** than explicitly discussed → **STOP and explain why** before committing.

---

## RULE 3: COMMIT GATE — NEVER AUTO-COMMIT AFTER VERIFICATION

### The Rule

**Always stop after verification. Wait for the user's explicit "commit it" before running `git commit`.**

### What This Means

- ❌ DO NOT commit automatically once verification passes
- ❌ DO NOT interpret "verification confirmed" as permission to commit
- ✅ Show verification results, then STOP
- ✅ Wait for the user to explicitly say "commit it" (or equivalent) in chat

### Why This Rule Exists

The user needs to review verification results before deciding to commit. Auto-committing removes that review window and creates commits the user did not intentionally authorize.

---

## Repo facts (post-cleanup, 2026-10)

- **Migrations** run ONLY via `npm run db:migrate` (`dist/db/migrations.js`). The old `run-migrations*.mjs` scripts were removed. 91 files in `src/db/migrations/`, all tracked. Numbering has gaps (037-039, 043-045, 060) and duplicates (015, 016, 061, plus 068b). Do not renumber.
- **Legal templates** live in `packages/api/src/templates/legal/*.html`. NEVER delete them. Migrations 053-055 insert `FILE:ats_rof_alante.html`-style placeholders into `document_templates`; `src/db/migrations.ts` replaces them with the file contents at migrate time.
- **Removed in bb850f9 and 614009c** (still in git history, do not recreate): root and `packages/api` `run-migrations*.mjs`, `seed_ats_template.sql`, `seed_conveyance_template.sql`, `build_legal_templates.py`, `ats_complete_template.html`, `dl_*` and `demand_*` dumps, `test_*.sh`, `gen_hash.mjs`, `backup_before_client_demo_20260503.sql`, 7 test uploads.
- **Upload folders** `booking-documents`, `consumer-photos`, `co-applicant-photos`, `multi-applicant-photos`, `company-logos` exist only through tracked `.gitkeep` files under `packages/api/uploads/`. Multer does not create them (only `companies.ts` creates `company-logos`). Never delete a `.gitkeep`. Upload contents are gitignored.
- **Dependencies** are unpinned; npm is the API's package manager. `pnpm-lock.yaml` and `packages/api/package-lock.json` are gitignored and invalid (generated under pnpm links). Do not copy or commit them. Installs are not reproducible.

---

## Known hazards and open decisions

### Consumers
Neon has 4 consumers, by registration_no: `DEMO-2026-0001`, `ALAN-2026-0139`, `ALAN-2026-0140` (created 2026-09-23), `TULA-2026-0003` (created 2026-09-23). Older guidance said only 2 real consumers exist and must never be altered. The status of the two September consumers (real vs test) is UNCONFIRMED. Confirm with the owner before altering or deleting ANY consumer.

### Destructive script
`packages/api/reset-to-clean-slate.mjs` is destructive and runs against whatever `DATABASE_URL` is set. Never run it without checking `DATABASE_URL` and getting explicit approval.

### Auth (`packages/api/src/index.ts`, `authenticateToken`)
- Accepts `'mock-jwt-token'` as super_admin when `NODE_ENV` is not production (~line 179).
- Falls back to a hardcoded `JWT_SECRET` literal when the env var is unset (~lines 201 and 327).
- Accepts the token in the URL as `?token=` (needed by letter/print routes).
- Never checks that the user exists or is active (no DB lookup, no `is_active` check).
- `render.yaml` sets `NODE_ENV=production`; `JWT_SECRET` and `DATABASE_URL` are `sync:false`, so they live only in the Render dashboard. `JWT_EXPIRES_IN=7d` in `render.yaml` (lines 19-20) is unused by the code, which hardcodes `expiresIn: '8h'` (`index.ts:331`).
- Open: rotate the live super_admin password, remove the fallback secret and the mock token, add an `is_active` check.

### Render build
`render.yaml` sets `NODE_ENV=production` while `typescript` is a devDependency; how `tsc` is resolved during the Render build is unverified. Check a Render build log before changing the build command.

### Known data gaps (deliberate, not bugs)
- `company_bank_accounts` holds only a placeholder account.
- `units.base_price_inr` and `total_price_inr` are NULL everywhere.
- Unsold Stock Value is deliberately unavailable in Stock Report and Summary Report.
- Current O/S is deliberately identical to Balance Recoverable.

---

**Last Updated:** 2026-10-11  
**Rule 0 Added:** 2026-06-05 (Working directory boundary — never touch Pay10 or Pay10 Bahrain)  
**Rule 1 Added:** 2026-06-01 (Build dist/ before every commit)  
**Rule 2 Added:** 2026-06-02 (Surgical changes only)  
**Rule 3 Added:** 2026-06-30 (Commit gate — never auto-commit after verification)

---

## WHAT HAS BEEN BUILT

### TRANSFER MODULE (fully live on Render + Neon)

✅ Migration 070 — ownership_transfers extended (28 cols) + transfer_fee_master table  
✅ Migration 071 — 'transferred' added to lead_stage + allocation_status enums  
✅ Migration 072 — dropped allocations_unit_id_status_key constraint (allows multiple transfers per unit)  
✅ Setup → Transfer Fee page (`/transfer-fee-setup`) — per-project fee + tax config, SAVE with upsert  
✅ Application → Transfer page (`/transfers`) — search allottees, transfer form, buyer form, auto-generates T1/T2 reg no for buyer, creates new consumer + ownership_transfers record  
✅ Transfer Report page (`/transfer-report`) — shows all transferred units, T1/T2 suffix, no-of-transfers count, payment plan, broker, print + CSV download  
✅ Transfer Detail page (`/transfer-detail`) — full financial breakdown per transfer, Transfer Letter link per row  
✅ Transfer Letter (`/api/transfers/:id/letter`) — A4 print-preview HTML document, TRANSFER/SALE ENTRY REGISTER format, transferor/transferee details + dues table, token passed via `?token=` query param  
✅ Transfer Date Edit page (`/transfer-date-edit`) — inline edit of transfer_date + application_date, grace-period inline save pattern  

**SKIPPED (pending client clarification):**  
⏳ Setup → Tax Master — client never demonstrated, likely overlaps with Transfer Fee Setup  
⏳ Transfer After Registry — client confirmed post-registry transfers don't happen  
⏳ Transfer After Registry Payment — same as above  

**LATEST COMMITS (Transfer Module):**

| Hash | Description |
|------|-------------|
| `d35fa8b` | Phase 1 |
| `0caa8c1` | Phase 2a |
| `67090ae` | Phase 2b |
| `e497852` | Phase 3 |
| `ec57882` | Phase 4 |
| `e7c1a58` | Phase 5 |

**CURRENT GIT STATE:**  
Do not trust a hardcoded hash here. Check with `git status`, `git log -1` and `git log origin/main..HEAD`. Last verified at `614009c`, tree clean, local main = origin/main (2026-10-11). Render deploy state is not verifiable from the repo.
