# Chat playbook (read this first in every chat)

How the ROF CRM modules are worked on. One module at a time, five chats, one hub.

## Roles

| Chat | Job | May change code? | Output |
|---|---|---|---|
| Main (hub) | Creates the other chats, passes file paths between them, keeps the owner decision list, holds the approval gates, asks for "commit it". Does not do module work | No | Summaries to the owner |
| 1 Flow | Reads the whole module end to end: screens, routes, tables, and every place outside the module that uses its data. Finds where a change can break something | No | `docs/modules/NN-<name>-flow.md`, items into the backlog |
| 2 UI and features | Reviews screens (UX, accessibility, speed of data entry, consistency, dark mode, phone width) and proposes features a real estate team needs. Every idea has file evidence, effort and risk | No | `docs/FEATURE_AND_UI_PROPOSALS.md` (section for the module), items into the backlog |
| 3 Fix and build | Implements only the items the owner approved, writes tests, updates the module doc and the two sheets | Yes, in the main folder only | Code, `docs/modules/NN-<name>.md`, `COMPLETED_TASKS.md`, `DEFERRED_TASKS.md` |
| 4 Verify | Independent check of code, UI, features, fixes and documentation. Tries to break things. Never edits code | No | `docs/modules/NN-<name>-verification.md`, backlog status |

Order: chats 1 and 2 together, owner approves the pick list, chat 3, chat 4, fixes loop back to chat 3, then the owner says "commit it".

## Rules for every chat

- Reply in short Hinglish. No em dashes anywhere (code comments, docs, UI text, replies). UI must not look vibe coded: no emoji, no decorative gradients, plain professional copy.
- Work only inside `/Users/ketansingla/Desktop/Grapes/Rof CRM/rof-crm`. Never touch other folders (CLAUDE.md Rule 0).
- Stay inside the module scope file `docs/modules/NN-<name>-scope.md`. Anything outside goes into the backlog as "other module".
- Surgical changes (CLAUDE.md Rule 2). Nothing is fixed silently. Anything found and not done gets a DT number in `docs/DEFERRED_TASKS.md` (next free number).
- Never commit, push or deploy. Only the owner says "commit it". Before a commit the main chat has `npx tsc` run in `packages/api` (dist is committed, CLAUDE.md).
- Never use or type a credential that appears in chat. Secrets are entered by the owner with `read -s` in the terminal.
- Evidence beats opinion: every finding has file and line, or the request and the result.
- Save tokens: link to files instead of pasting them, no long dumps, no repeating earlier text.
- A new chat may start in a fresh git worktree. The work under review is uncommitted in the MAIN folder, so read it by absolute path: `/Users/ketansingla/Desktop/Grapes/Rof CRM/rof-crm/...`.

## Test environment (one database and one port per chat)

- Build a database: `cd packages/api && bash scripts/make-test-db.sh <dbname>` (baseline schema, 6 role users, sample data). Users are `<role>@test.local`, password `Test#Pass1234`, local test databases only.
- Run the API: `DB_NAME=<dbname> PORT=<port> JWT_SECRET=<any> NODE_ENV=development npx tsx src/index.ts`. Restart it after code changes (`tsx` without watch).
- Assignment: chat 2 uses `rof_m1_ui` on 3004, chat 3 `rof_m1_fix` on 3005, chat 4 `rof_m1_verify` on 3006 (change `m1` to the module number). Chat 1 is read only. Never use another chat's database or port, never the live site or Neon.
- PostgreSQL 18 is at `/Library/PostgreSQL/18/bin/psql` (user `postgres`, password `postgres`).
- Tests go into the repo (`packages/api/tests/`), not `/tmp`.

## Shared files per module

- `docs/modules/NN-<name>-scope.md`: which screens, routes, tables and files belong to the module, and what is out of scope.
- `docs/modules/NN-<name>-backlog.md`: the single list of work (see its header for the columns and statuses). Chats 1 and 2 add rows, chat 3 moves them to `fixed`, chat 4 moves them to `verified` or back to `open`.
- `docs/modules/NN-<name>-status.md`: one line per chat (state, last update, blocked on). Update it when you start, when you are blocked, and when you finish.

## Module document standard (the final reference, like `LOGIN_SYSTEM.md`)

Every module ends with one document, `docs/modules/NN-<name>.md`, written by chat 3 and checked claim by claim by chat 4. A new person must be able to understand the module from it alone. Sections, in this order:

1. Purpose and who uses it (roles and what each may do).
2. Screens and how a user moves through them (one short step list per task, with a diagram where it helps).
3. Business rules, numbered, each with where it is enforced (screen, API or database) and its source.
4. API table: method and path, file and line, permission, tables read and written.
5. Data: tables, key columns, constraints, what other modules read from them.
6. Security and audit: permission matrix, what is logged, input checks.
7. Tests: what was tested, how to run it (command, database, port), the last result with date. Test scripts are in the repo.
8. Breakages found and how each was fixed (IDs `NNN-Bnnn`), with the root cause.
9. **Done**: what is finished and verified.
10. **Pending**: every open item with its DT number, priority and who must decide. Nothing pending may be missing from `DEFERRED_TASKS.md`.
11. Known limits and things not tested.
12. Change history: date, what changed, files, commit once it exists.

`COMPLETED_TASKS.md` gets one row per finished piece and `DEFERRED_TASKS.md` one row per pending piece. The three must agree; chat 4 checks that.

## Backlog statuses

`open` (found), `approved` (owner picked it), `needs decision` (owner must decide, do not build), `fixed` (chat 3, awaiting verify), `verified` (chat 4), `deferred` (has a DT number), `other module` (belongs elsewhere, has a DT number).

## Done checklist for a module

1. Flow report written and read by the owner.
2. UI review written; the owner approved the pick list.
3. Every approved item is `fixed` and then `verified`; nothing High or Medium is `open`.
4. Everything not done has a DT number; the owner's decisions are listed and answered or consciously left.
5. Tests are in the repo and pass; the verifier's last run is recorded in the verification file.
6. The module document follows the standard above, and it, `COMPLETED_TASKS.md` and `DEFERRED_TASKS.md` match the code and each other (the verifier checked each claim and listed none as wrong).
7. `npx tsc` is clean; the owner said "commit it".
