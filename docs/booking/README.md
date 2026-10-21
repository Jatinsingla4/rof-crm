# Booking

Booking is where an applicant, a unit and a payment plan become a sale. The flow is: **start** (`POST /api/booking`, pending or active) → **confirm the payment** (`PATCH /api/booking/:id`, makes the allocation, payment plan, demands, GST split and the first receipt) → edit while allowed. This pass read the code first, then tested the bad and random cases. Test: `api-test-booking.mjs` (264 checks, runs in CI).

## Who may do what
Before, **any signed-in user, even a read-only one, could start, edit and confirm bookings** (the route had no role check). Now:
| Action | Roles |
|---|---|
| Start, edit, cancel a draft, upload / rename / delete documents | `consumers` create/edit right: super admin, project manager, sales executive |
| Confirm the payment step | the same, and also Accounts (`payments` edit) |
| Look (list, open, receipt page, documents) | every signed-in role |

## Starting a booking
- Applicant, unit and plan are checked: applicant exists (404), unit exists, **the unit belongs to the project** (before, a unit of another project could be booked), the applicant is not from another project (409), the plan exists and adds up to 100%.
- Numbers are strict (`abc`, `1e5`, negatives, `NaN`, 100 crore+ refused; `NaN` used to reach the database). Dates are real and **not in the future**. Payment mode must be a known one; an amount needs a mode and a mode needs an amount. Discount cannot exceed the basic price; an amount many times the price (a slipped zero) is refused. Broker type / commission (a percentage cannot exceed 100) are checked.
- The unit row is locked first, so **8 people booking one unit at once give exactly one booking** (the rest get 409). Form number and cheque/reference cannot be reused by a live booking (also in a race); cash needs no unique reference.
- A project with **no GST rate set up** now answers 422 "set it up in GST Configuration" (it was a server error).
- A percentage broker commission is worked out on the basic price (it was stored as the raw percentage number).

## Confirming the payment
- Locks the booking first: **a second or parallel confirmation is refused (409)** and cannot add a second receipt or change the amount after the receipt exists. A cancelled booking cannot be confirmed.
- The receipt keeps the true mode: cash → cash, draft → demand draft, card, UPI, NEFT, RTGS; online / adjustment / dealer adjustment → bank transfer. (Everything but cheque, NEFT, RTGS and UPI used to be saved as "bank transfer".)
- Amounts the page works out (interest, TDS, GST amounts) are rounded to paise instead of refused.
- **Booking the same unit again after a surrender now works fully**: the cancelled earlier allocation made the system skip creating the new plan and demands.

## Cancelling a draft (new)
`POST /api/booking/:id/cancel` with a reason. A booking that was started but never confirmed (pending or active, no demands) is cancelled, its held unit is released, a pending broker commission is cancelled, the reason goes in the remarks. Before, a forgotten draft blocked its unit and froze its payment plan forever. A complete booking is refused (409): cancel it through **Surrender**, which settles the money.

## Editing
- Same rules as the Applicants page for the applicant part (PAN, mobile, e-mail, date of birth, PIN…), duplicate mobile/PAN refused, old bad values sent back unchanged still pass. Blank boxes from the form leave the applicant's values alone.
- **Once a booking is complete its price basis is fixed**: rate, area, inaugural discount and booking date cannot change (409), because demands, GST and the receipt were made from them. Notes, form number, broker and sales person can.
- Broker commission: a pending commission follows the new broker / amount; a processed one cannot be moved (409). Form number must stay unique.
- Every change is audited, PAN/Aadhaar masked.

## Documents
Files are now kept in the database (migration 111), not on the server disk. The file type is read from the file itself (an HTML page sent as "image/png" is refused), the document must belong to that booking's applicant, a cancelled booking takes no new documents, and the file opens at `/api/booking-documents/:id/file` with a login or a 2-minute link token, `nosniff` and a locked-down content policy. Deleting removes the stored bytes.

## Other
Ids, page, pageSize and status in the list are checked (400, not 500). `check-cheque` / `check-form-no` check their inputs.

## Not changed (next modules)
- Receipt numbers are still `REC-year-random5` (a collision would fail a confirmation; retry works). The Receipts pass will give them a safe running number.
- The big printable pages (applicant file, receipt page) are untouched apart from the id check.
