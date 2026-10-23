# Small routers: photos, booking documents, charge master, broker tax setup, FAQ

Checked after the earlier work (charge-master, broker-hold, addon-charges, payments-rest docs). Only gaps were filled. Check: `docs/small-routers/api-test-small-routers.mjs` (296 checks, own data, random hostile run) and `e2e/small-routers.spec.ts` (6 browser tests).

## Guards (read from the code)
| Route | Login | Roles |
|---|---|---|
| `/api/photos/:kind/:id` | none, by design (an `<img>` tag cannot send a token); the address holds a random id | read only, nothing is listed |
| photo upload (`/consumers/:id/photo`, co and additional applicant) | yes | consumers create/edit (super admin, project manager, sales) |
| `/api/booking-documents` | yes | read: every role; upload / edit / delete: consumers rights (super admin, PM, sales); accounts, support, viewer get 403 |
| `/api/charge-master` | yes | read and preview: all; change a rate: master_data edit (super admin, PM) |
| `/api/broker-setup` | yes | super admin and accounts only (read and write) |
| `/api/faq` | yes | communications: view for read and vote, create for new article, edit for edit and drafts |

Project scope: the database policy `rof_project_scope` applies to documents (through the booking), charge preview (project lookup). Brokers, FAQ and charge rates are not project data.

## Real bugs found and fixed
1. **Photos**: an address like `/api/photos/consumer/aaaaaaaa...` (36 hex or dashes, not a uuid) gave a 500 to anyone without login. Now 404 (exact uuid pattern).
2. **Charge master**: a rate-change address with a NUL byte (`/config/a%00b`) gave 500. Key must be `[a-z0-9_]`, else 404. The preview date check let `2024-02-31` through (then 404 "project" text); it now uses the shared `day` rule. Errors go through `failWith`.
3. **Booking documents**
   - Scope followed only the applicant's own project: a document of a booking in another project was visible and editable if the applicant had no project set. Now every read, file, edit and delete also needs the booking to be visible (booking scope).
   - PATCH could not clear a field (null or empty was ignored) and an empty body or a body with only unknown fields answered 200 "saved". Now a sent field changes (empty clears), nothing editable sent is 400.
   - `?document_type=` had no length or single-value check (now `qtext`, max 100).
4. **FAQ**
   - Voting: the counters rose on every click, one person could push them as high as they liked, and 10 parallel clicks counted 10. Now one vote per person per article (new table, migration 125, article row locked while counting); voting the other way moves the vote.
   - Create and edit were not in the audit log; now both are (`faq_article`).
   - Tags were case sensitive and could repeat (`Pay`, `pay`, `PAY`); stored lower case and de-duplicated, the tag filter lower-cases too.
   - Articles of an inactive category were still listed (and counted); not any more.
5. **Broker setup**: two first saves at the same moment were both logged as "create". The broker is now locked for the save, so the second is logged as update.
6. **Web**: Charge Master screen pasted the server error text into the page unescaped and its escape function ignored quotes (fixed). The booking screens swallowed a failed document upload (console only): the user now gets a warning with the server's message (two places in `booking.js`).

## Decisions
- Photo GET stays open without login (needed for `<img>`); content type comes from the bytes, `nosniff`, CSP `default-src 'none'`.
- Same FAQ title twice is allowed (the payments-rest test creates a draft and a published copy with one title). No unique rule, so no race to handle; 6 parallel creates give 6 rows.
- A booking document without a file (paper only: barcode, storage number) stays allowed.
- Booking document file name is only a label: it is cleaned in the download header, never used as a path.
- Tests that already passed were not changed: charge-master 63, addon-charges 152, broker-hold 551, payments-rest 991 all pass on this build.

## Already fine (verified, no change)
Photo upload: bad or unknown applicant id (400/404), additional applicant of another applicant (404, nothing stored), type sniffing, 5 MB limit. Booking documents: type sniffing (jpeg, png, gif, pdf), 10 MB, cancelled booking 409, applicant of another booking refused, sandbox CSP on file download. Charge master: rate rules, cap fixed, 10 parallel saves, GST and cap on the preview (50 sqft x 100 = 5000 + 125 + 125). Broker setup: no default rates, first save needs both rates, list search escapes `%` and `_`.

## Not done / not covered
- No upload screen for booking documents outside the booking form; no browser test of the document upload itself (API test only).
- Deleting a photo, and removing the stored photo when an applicant is deleted, do not exist (orphan photo rows stay; they are only reachable by their random id).
- The charge-master screen still reads the token from localStorage directly (like the other charge pages); not moved to the shared Api helper.
- `faq_categories` has no create/edit route, so category rules were not tested beyond reading.
- Voting history before migration 125 is kept as counters only (no per-person rows).
- Project scope for the FAQ and brokers does not exist (not project data).
