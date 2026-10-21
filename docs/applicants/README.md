# Applicants (Consumers)

Applicants are created from **Booking** (and the Applicants page) and feed Booking, Demands, Receipts, Documents and Letters. This pass read the code first, then tested the bad and random cases. Test: `api-test-applicants.mjs` (311 checks, runs in CI).

## Rules now enforced (create, update, co-applicant, additional applicants)
| Field | Rule |
|---|---|
| Mobile | 10-digit Indian number starting 6-9. `+91`, `91`, spaces and dashes are dropped, so `+91 98765-43210` is stored as `9876543210`. International numbers need `+`. |
| Email | Proper address, stored lower-case. |
| PAN | `ABCDE1234F`, stored upper-case. |
| Aadhaar | 12 digits, not starting 0 or 1, spaces dropped. |
| Date of birth | Real date from 1900, not in the future, applicant at least 18 (nominee date has no age limit). Shown back as a plain date. |
| Name | Required (no more "Unknown"), must contain a letter, no `<>`, control or right-to-left characters. Individuals are tidied to Title Case; companies keep what was typed. |
| Money, children, share | Strict numbers (`1e5`, `12,00,000`, negatives refused); children 0-20; nominee share 0-100. |
| PIN | 6 digits for India, free for other countries. |
| Lead stage / income category / gender | Only the known values. A new applicant can only start as enquiry or interested. |

## Duplicates
- Same mobile in the same project returns the **existing** applicant (HTTP 200, `reused: true`). New details are filled in; nothing is blanked and the stored name is not overwritten. Works for applicants with no project too (it did not before).
- Same mobile with a different PAN, or the same PAN on another mobile in the project: **409** naming the existing applicant.
- Creating or editing at the same moment (12 parallel creates, two people taking one mobile) ends with exactly one winner.

## Updating
- Only fields sent change; a blank clears an optional field (before, a blank was ignored so wrong data could not be removed). Name, mobile and lead stage cannot be blanked.
- PAN/Aadhaar hashes follow the edited value (they used to stay stale).
- Stage rules: `allotted`/`onboarded` need an allotted unit; `cancelled`/`transferred` are refused while a booking is live (use Surrender / Transfer).
- Corrections to contact details of a booked applicant stay allowed. Every change is audited with PAN/Aadhaar masked (last 4 only).

## List and search
- `sortBy` and `pageSize` were written straight into the SQL (injection). Now `sortBy` is a fixed list, `page`/`pageSize` are numbers (`pageSize` 1-1000), ids and dates are checked, repeated parameters refused.
- The total now follows every filter (before, dob, city, e-mail and others were ignored in the count). `%` and `_` in a search are plain text. `hasLoan=true` now works.

## Other fixes
- **Photo upload**: the id is checked first (a crafted id could write outside the folder); file extension comes from the checked image type (a file named `.html` sent as PNG was served as HTML); re-uploading the same type no longer deletes the new file; the second-applicant photo no longer overwrites every additional applicant's photo; unknown applicant gives 404 and writes nothing.
- **KYC document**: type from the known list, link must be an uploaded path or `https` (no `javascript:`), 404 for unknown applicant.
- **Remarks**: notes required, tags saved as a real list (a remark with tags used to fail).
- **Base rate (Pricing Matrix)**: needs the master-data permission, strict number, refused once the unit has a booking (it used to change the price of a sold unit).
- **Additional applicants**: at most 10, each checked, "Applicant 4: …" errors, no duplicate PAN/mobile/Aadhaar inside the list or against the main applicant, nothing is lost when one entry is bad, delete renumbers safely and cannot touch another applicant's person.
- A bad co-applicant now leaves no applicant behind (all saved in one transaction).
- Applicant detail no longer returns the Aadhaar hash; an update with nothing to change no longer returns the whole row (PAN, Aadhaar) to the client and the audit log.

## Roles
`read_only_viewer`, `accounts_finance`, `support_agent` can read only. Creating needs the consumers create right **and** the "new applicant" maker right (Set Master → Security → process rights); editing needs "edit applicant". Additional applicants, KYC and remarks follow the consumers create right. Pricing Matrix base rate needs master data edit (super admin, project manager).

## Not changed
- Photos are stored on the server disk, which a serverless host does not keep — move to object storage before relying on them live.
- The printable applicant file link still takes the login token in the web address (known audit item).
