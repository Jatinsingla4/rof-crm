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
- **Render production uses pre-built dist/ files directly** (no TypeScript compilation on deploy)
- **If dist/ is stale, production runs old code** (src/ changes never reach users)
- **src/ without dist/ rebuild = silent failure to deploy code changes**

### Workflow for Every Change (MANDATORY)

Every commit must follow this sequence:

1. Make changes in `packages/api/src/`
2. **`cd packages/api && npx tsc`** ← MANDATORY BUILD STEP
3. Verify zero TypeScript errors (command returns clean)
4. `cd ../.. && git add -A`
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
2. Use pre-built dist/ files (runs `node dist/index.js`)
3. Serve production traffic

If dist/ wasn't rebuilt before commit, Render runs stale bytecode.

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

**Last Updated:** 2026-06-16  
**Rule 0 Added:** 2026-06-05 (Working directory boundary — never touch Pay10 or Pay10 Bahrain)  
**Rule 1 Added:** 2026-06-01 (Build dist/ before every commit)  
**Rule 2 Added:** 2026-06-02 (Surgical changes only)

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
Latest commit: `e7c1a58`  
Working tree: CLEAN  
Local = GitHub = Render ✅
