# Receipts

A receipt is money received from an applicant. It is recorded, matched to the demand of its instalment, can be authorised by a checker,
printed, moved through a cheque's life (deposit → hold → clear), and ends cleared, bounced or cancelled.
Routes are under `/api/payments`: `packages/api/src/routes/receipts.ts` (record, list, open, edit, authorise, print, deposit / hold / clear)
and, still in `payments.ts`, bounce, cancel and the printable receipt page. Running receipt numbers: `utils/receipt-number.ts`, migration `112_receipt_number_sequence.sql`.

## Who can do what
| Action | Roles | Also needs |
|---|---|---|
| Read lists, open a receipt, pending cheques | every signed-in role | |
| Record (POST) | super_admin, project_manager, accounts_finance | process access *Receipt – maker* (super_admin is exempt) |
| Authorise (approve) | same roles | process access *Receipt – checker* |
| Edit, print, deposit, hold, release, clear, bounce, cancel | super_admin, project_manager, accounts_finance | |
| sales_executive, support_agent, read_only_viewer | read only | |

## Status life
`pending` → (`authorized`) → `deposited` → `cleared`; `on_hold` can come from any live status and returns to `pending`; `bounced` and `cancelled` are final.
Deposit: pending or authorized. Clear: pending, authorized, deposited or on hold. Bounce / cancel: not already bounced or cancelled.
Every change writes `audit_logs`.

## Rules for a new receipt
- Amount: whole rupees, 1 to 100 crore (the column holds whole rupees). The PLC, EDC, IDC, interest and other-charge parts (paise allowed) must not add up to more than the amount.
- Date: a real date, not in the future. Payment mode: one of cheque, cash, card, upi, neft, rtgs, bank_transfer, demand_draft, tds_challan; the form's own names *neft_rtgs*, *draft* and *online* are accepted too.
- The same cheque number or bank reference cannot be on two live receipts (bounced and cancelled ones free it). Checked under a lock, so two people saving at once cannot both win.
- The payment plan, if given, must belong to the applicant. Everything is saved in one transaction: receipt, demand match (partial / paid / excess passed on), GST part, the first-receipt raise of instalment 1, audit. If any step fails nothing is saved.
- Receipt number: `REC-<year>-00001`, running (a database sequence). Old random numbers that exist are skipped. Gaps can appear when a save is rolled back. The receipt a booking makes and the advance receipts (`-ADV`) use the same numbers.

## What was wrong before (read from the code, then fixed)
- Receipt numbers were a random 5-digit number: two receipts could get the same one and the save failed (unique column), and the number meant nothing as a count.
- Nothing was checked: a text amount, a decimal amount, an unknown payment mode or an unknown id gave a 500. The form's own *NEFT/RTGS* and *Draft* buttons sent names the database does not know, so those receipts could not be saved at all.
- The receipt was saved first and the demand match came after in separate transactions; if the match failed it was only logged and the receipt stayed unlinked. Now one transaction.
- Two receipts recorded at the same moment for one customer could take the same instalment number or both match the same demand. Now serialised per customer.
- A payment plan of another applicant could be passed in. Same bank reference twice was only checked when editing. The cheque duplicate check could be beaten by two requests at once.
- `pageSize` and `page` went straight into the SQL text; `%` and `_` in search boxes matched everything; the `status` filter of the list was silently ignored (so "pending receipts" showed everything).
- Receipts with no payment plan did not show in the list at all; the pending-cheque list repeated a receipt once per allocation of the customer.
- Bounce could be done twice (two penalty records); a bounced receipt could be cancelled; bounce and cancel left no audit trail; penalty and reason were unchecked.
- NEFT, RTGS and UPI receipts could never be deposited or cleared (and did not show in the pending list), so they stayed *pending* for ever and never counted as paid in the instalment totals. Every payment mode is now an instrument that can be deposited, held and cleared.
- An authorised receipt could not be deposited or cleared (the deposit and clear steps only accepted *pending*), so it was stuck.
- Deposit / clear / hold / release read the status and wrote it in two steps, so two clicks could both succeed; dates were not checked (future dates, nonsense).

## Tests
`node docs/receipts/api-test-receipts.mjs` (281 checks, own project / units / plans / customers, cleaned afterwards): roles and process access, bad input for every route, running numbers (14 at the same moment), duplicate cheque / reference including races, demand matching (partial, full, excess, no demand yet, no plan), list filters, edit, authorise, print, the cheque life with races, bounce and cancel with races, random junk (70 rounds), and the earlier screens.
Demo data for http://localhost:3020: `node docs/demo-seed-receipts.mjs`.

## Not changed
- The amount of a receipt cannot be edited (the edit form sends it, it is checked and ignored): cancel and record again.
- A maker may still authorise their own receipt; separate maker and checker people is the open "maker-checker" item.
- The receipt screen calls `/receipts/:id/reject`, which does not exist on the server; the printable receipt page (`/receipts/:id/html`) and the receipt form data routes are untouched except the id check in bounce / cancel.
- Cancelling a cleared receipt is still allowed (it reopens the demand); a stricter "reversal" workflow is a decision for the owner.
