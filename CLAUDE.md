# CLAUDE.md (ROF CRM Project)

Project-specific rules for Claude Code working on ROF CRM.

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

## Other Project Rules

(Add additional project-specific guidance here as needed)

---

**Last Updated:** 2026-06-01  
**Added By:** Sync audit following demand letter fix
