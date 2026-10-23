# Documents core (letters, list, search, send, vault, field edits)

Code: `packages/api/src/routes/documents.ts` (now only joins the parts) and `routes/documents/`:
`templates.ts` (letter templates), `generate.ts` (+ `merge-demand.ts` demand letter and interest, `merge-letters.ts` check list, allotment, agreement for sale, conveyance deed, `shells.ts` letter shells and number/date formatters), `vault.ts` (send, search, list, scanned vault, delete), `edit.ts` (field edits, recalculation, versions, HTML page).
Helpers: `utils/penal-rate.ts`, `utils/doc-crypto.ts`, `likeOf` and `escHtml` in `utils/input.ts`. Migration `124_documents_core.sql`.
Tests: `api-test-documents-core.mjs` (153 checks), `e2e/documents-core.spec.ts` (5 tests), `golden.mjs` (before/after proof of the split).

## The split changed nothing
`golden.mjs` generates a demand letter (two ways), check list, allotment letter, agreement for sale and conveyance deed for 8 real applicants (48 documents) and saves the HTML. Before and after the split the files are identical, except the two intended changes (penal rate default, no login token inside the page).

## Real bugs found and fixed
1. **Demand letters and check lists could not be generated on a clean database** (500: `documents.template_id` was NOT NULL, those letters have no template row). Migration 124 lets it be empty.
2. **Every field edit failed with a 500**: the column `documents.original_html_content` did not exist (migration 124 adds it, plus defaults for version, edit count, edited flag).
3. **SQL text from the address**: `?pageSize=` and `?page=` were pasted into the SQL of the document list and the vault list. Now whole numbers only.
4. **Stored markup in legal letters**: a value sent in `mergeData` or in a field edit went into the HTML as it was (script included, and `$&` was read as a replace pattern). Now escaped, and the replace uses a function.
5. **The login token was written into every generated page** (the edit toolbar), and after the link-token change the toolbar sent a link token to the edit route, so Save Changes could not work. The page now reads the login from the browser's own storage.
6. **Deleted documents stayed everywhere** (list, per-applicant list, search, html, versions, edit, send) and could be deleted again (200). Now hidden and 404; delete is audited.
7. **Send said "sent"** though no sender exists. It now says queued (status `queued`, `sent_at` empty) and never touches a delivered document (409).
8. **No input checks anywhere**: ids, document type, delivery method, dates, `mergeData` names (a name was put inside a regular expression), unknown or foreign allocation (FK 500), search with `%`, 100+ fields in one edit, repeated field keys, control characters. All checked, answers are 400/404 instead of 500.
9. **Parallel field edits** could write the same version number twice (no transaction). Now one transaction with the document row locked; write-back to source tables runs inside it, each field in its own savepoint. 5 edits at once give versions 2 to 7.
10. **The vault saved only a link, but the screens upload files** (applicant Documents tab, Unit Documents): every upload was a 400. The vault now keeps the file itself (png, jpg, gif, pdf read from the first bytes, 10 MB, name cleaned) or a link; unit-only documents are allowed; a file is served from `GET /documents/vault/file/:id` (nosniff, locked-down CSP). Links must be http(s) or a path on this site (`javascript:` refused). Unit rows follow the unit's project scope.
11. **Screens**: Documents History "PDF", Templates "Preview", Vault "Download" and the "Download PDF" links pointed at addresses that do not exist (404); they now open the document page, a script-less preview, the stored file or the scan link. `generateAndOpen` put the login token in the web address (the server refuses that); Demand Status opened the page with no token. Names printed into HTML are escaped.

## Penal interest rate: one place
`utils/penal-rate.ts` reads `global_settings.penal_interest_rate_percent`; missing, not a number, below 0 or above 100 gives the default **15**. 0 is a real rate (the old `|| 15` turned it into 15). Used by the demand letter, check list, applicant consumers route, payments, reports ledger, and the edit script in the letter page. Before: 15 in consumers and reports, 11.10 in documents and payments. 15 was chosen because it is what the seed and the reports (already verified) use; migration 124 writes the setting row so the value is visible and editable. If HRERA 11.10 is wanted, change that one setting.

## ENCRYPTION_KEY
The built-in key `1234...` is gone. The vault link is sealed with `ENCRYPTION_KEY` (exactly 32 bytes). Without it in production nothing can be saved or opened (503, with the reason); development uses a fixed local key. A value that cannot be opened (wrong key) now comes back empty, never as cipher text.
**Owner chore:** set `ENCRYPTION_KEY` on Vercel. Links saved before were sealed with the old public key: if any exist, set `ENCRYPTION_KEY` to that old 32 character value once to read them, then re-save.

## Roles (unchanged, now tested)
Generate, send, vault upload: sales, accounts, project manager, admin (documents create). Edit a field: project manager, admin. Delete: admin only. Read: every role that has documents view (support and viewer included). No login: 401.

## Not done / decisions needed
- "Bulk (by Project)" on the Generate tab sends no applicant, so it was never able to generate; it stays a product decision.
- No real PDF is produced (there is no PDF engine); the page is opened for printing.
- Writing back an edited field into the source tables is tested only for the field that exists on every letter (penal rate); the other write-back fields (about 60) are not covered one by one.
- `middleware/responseFormatter.ts` is switched off in `index.ts`; its hard-coded rate now uses the default constant.
- Email, WhatsApp and SMS sender is still not connected: queued only.
