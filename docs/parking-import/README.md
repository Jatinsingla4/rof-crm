# Parking, Import, Customer Folders, Unit Documents

Checked in depth: code read first, then roles, hostile input, project scope, races, a random run, every control of the screens in a real browser. Where the same mistake showed in more than one screen, it was fixed at the root (a shared helper and a guard), not screen by screen.

## What belongs to this module

| Screen | API | Permission (resource) |
|---|---|---|
| Parking (type prices, slots, assign, report) | `/api/parking` (`/`, `/bulk`, `/types`, `/:id`, `/:id/release`) | `units` (view: all; create/edit: project manager, admin; delete: admin) |
| Import | `/api/import` (`/preview`, `/`, `/history`), `/api/import/template/units` (public file) | `units` |
| Customer Folders | `/api/consumers` (list) | `consumers` |
| Unit Documents | `/api/units`, `/api/documents/vault` | `units`, `documents` |
| (leftover) | `/api/test-data/*` | now super_admin only |

## What was wrong, and what was done

**Root causes (fixed once, for every screen):**

1. **Project pick lists built from the units** (Customer Folders, Unit Documents, Import, and later copied into Leads and Campaigns): a project with no unit, or past the first 300 units, was missing. One shared `Utils.projectOptions()` (from `ProjectCache`, the list of projects) now feeds them, and a guard fails if a screen builds the list from units again.
2. **A screen that calls a server route nobody wrote** (Campaign Launch, Receipt Reject, inbox "tickets by channel"): new guard `docs/web-guards/api-test-web-guards.mjs` reads the route table from the server code and every `Api.get/post/...` path of every screen, and fails when one has no route. It runs in CI with the other `api-test-*.mjs`. It also fails when a screen keeps data in `localStorage`, and when a project pick list shows a name without escaping (20 places in 10 screens were fixed: allotment, booking, collection-setup, demand-raise, demands, documents, gst-invoicing, receipts, set-projects, surrender).

**Import (it did not work at all):**

3. The screen sent a file upload (`FormData`), the server wanted JSON text, so every preview and import ended in "csvText is required". Now the screen reads the CSV and sends the text.
4. "Consumers", "Payment records" and "E-Draw" were offered but did nothing (the server skipped every row and said so as a success, and the E-Draw path would have marked customers allotted with no allocation). Only **Units** is imported now; applicants are made on Booking and E-Draw results come in on Allotment, the other types are refused (400). Excel files were accepted by the screen and could not be read: only `.csv` (2 MB, 5000 rows).
5. Rows were not checked (price text, floor `abc`, negative price, a tower made before the row was checked, no limit). Each row now goes through the same rules as the Unit screen (`unitFields`, `floorNo`), a unit twice in the file is a problem, and **one bad row stops the whole file** (422, the screen names the rows; no unit, no tower is saved; the refused file is still in the history as failed). Units that already exist in the tower (also in another letter case) are skipped. Five parallel imports of one file make each unit once.
6. "Duplicate handling: update / error" did nothing: removed (duplicates are skipped, said on the screen). The history screen read other column names, so it showed `unknown` and `0`; fixed. The template file had a customer-specific sample tower name; it is now generic, and there is one template (the server file), the guard test checks its columns against what the import needs.

**Parking:**

7. **"Parking Type Master" lived only in the browser (`localStorage`)**: each person and browser had its own price list, and a slot with no price silently got a made-up default (covered 1,00,000 ...). Now a table (`parking_prices`, migration 121, project scope) with `GET/PUT/DELETE /parking/types`; a slot with no amount takes the price of its type, else 0, and the screen asks for a price when there is none. (An old empty `parking_types` table with other columns exists from migration 018; it is not used.)
8. `POST /parking` was an upsert that **silently gave an already allotted slot to another customer**. Now: an allotted slot is refused (409, the holder stays), the customer must be in the same project and must hold a unit, the unit must be the customer's own, six parallel allots of one slot make one winner. The screen sends the unit too (it never did).
9. There was no way to free a slot, change one, or delete one. Added `PATCH /:id/release`, `PATCH /:id` (only a slot nobody holds), `DELETE /:id` (only a slot nobody holds, admin); buttons on the slot list.
10. **A cancelled or surrendered unit kept its parking** (the slot stayed allotted to a customer who no longer holds anything). Cancel and surrender now release the slots of that customer and unit; a transfer moves them to the buyer with the unit. (A restore does not take them back: someone else may hold them by then.)
11. "Bulk Add" made one call per slot from the browser and swallowed every error (a closed tab left half a range). `POST /parking/bulk` makes the range in one transaction, skips numbers that exist and says how many were new. The 4 filter lists and the allottee list were not escaped; the customer list was the first 500 allotted customers of everything: now the customers of the chosen project. Export did not escape quotes (and a name starting with `=` is a spreadsheet formula): it uses the shared `Utils.csvCell`.
12. No validation anywhere (`LIMIT ${pageSize}` pasted into the SQL, bad ids were 500). Now `utils/input.ts` for every field and a CHECK per column in the database (`NOT VALID`: old rows are left alone, new and changed rows are checked): type, amount, floor (-10 to 200), and "allotted means a customer is set".

**Customer Folders / Unit Documents:**

13. **Customer Folders: the project filter and the stage filter did nothing** (`filter()` only searched the first 300 customers on the screen by name or mobile), and a customer past the 300th could not be found. All three (project, stage, search) now go to the server.
14. **Unit Documents** held the first 500 units of everything and filtered them on the screen; it now asks the server for the units of the chosen project (the first line is "Select Project").
15. **`/api/test-data/*`** (a leftover of the first test data import, it listed customers and projects) was open to every login: now super_admin only.

## On purpose not done

- Customers who hold only an `onboarded` stage are not offered on the Assign screen (the screen offers `allotted`); the API accepts both.
- Excel (`.xlsx`) import and update-existing: not built; the screen says CSV only.
- Parking is not re-given after a restore of a surrender (see 10).

## Tests

- `docs/parking-import/api-test-parking-import.mjs`: roles (all 5 and no login), hostile input per field, price list, allot rules, 6-way races (create, allot, bulk, import), release / edit / delete, project scope, the cancel that frees parking, CSV import (every bad row type, BOM and Windows line ends, quoted commas, one bad row stops the file and leaves no tower, five parallel imports, history), `/test-data` access, and a random run of about 300 requests with junk in every field that must never give a 5xx (`SEED=n` repeats it). `docs/transfers/api-test-transfers.mjs` got one check (the slot goes with the unit).
- `docs/web-guards/api-test-web-guards.mjs`: the code guards above (no server needed).
- `e2e/parking-import.spec.ts`: 14 tests in a real browser: every tab, every filter option and every button of Parking (type master, inventory master, assign, report, export), Import (type list, wrong file, preview, refused file, good file, repeat, history, template), Customer Folders (each filter changes the list) and Unit Documents. A JavaScript error, console error, 5xx or `undefined` / `NaN` fails a test.
- Demo data: `BASE=http://localhost:3020/api PGDATABASE=rof_demo node docs/demo-seed-parking.mjs`; link http://localhost:3020 (`super_admin@demo.local` / `Demo#Pass1234`), menus Parking, Import, Folders, Unit Docs.

Run: `BASE=http://localhost:3010/api node docs/parking-import/api-test-parking-import.mjs` and `cd e2e && BASE_URL=http://localhost:3010 npx playwright test parking-import.spec.ts` (psql must reach the same database).
