# Module NN: <name>

Status: Not started | Mapping | Testing | Fixing | Done | Blocked
Owner: <name>   Opened: <date>   Closed: <date>
Depends on: <modules>   Used by: <modules>

## 1. Purpose
What the business does with this module, in plain words.

## 2. Screens
| Menu path | Frontend file (`packages/web/public/js/pages/...`) | What the user does |
|---|---|---|

## 3. API
| Method and path | Route file and line | Role check (resource, action) | Reads | Writes |
|---|---|---|---|---|

## 4. Data
| Table | Key columns used | Created or changed by | Notes (enums, constraints, triggers) |
|---|---|---|---|

## 5. Business rules
Numbered list. Each rule names where it is enforced (screen, API, or database) and its source (client requirement, HRERA rule, code comment).

## 6. Flow
Step by step, from the first screen to the last row written. Use a diagram when more than three systems are involved.

## 7. Test cases
| ID | Case | Role | Steps | Expected | Result | Evidence |
|---|---|---|---|---|---|---|
Cover: happy path, each validation, each allowed role, each forbidden role, empty state, duplicates, cancelled or transferred records, dates at boundaries.

## 8. Breakages
| ID | Severity | What happens | Steps to reproduce | Root cause | Status (Fixed, Deferred, Open) | Reference |
|---|---|---|---|---|---|---|
IDs look like `M07-B003`.

## 9. Deferred items
Each row points to an ID in `DEFERRED_TASKS.md`. Nothing is listed here without an ID there.

## 10. Regression list
Smoke checks to re-run in this module after a change in any module it depends on.

## 11. Sign off
What was changed, which files, which migration, and the commit reference once it exists.
