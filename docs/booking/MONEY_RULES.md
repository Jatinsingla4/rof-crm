# Money rules (owner decisions from the local tear-apart review)

| # | Rule | Where it is enforced |
|---|---|---|
| TA-06 | Money is held in **whole rupees**: price, plan total, demands and receipts. Reports round the price to the rupee exactly as Booking does when it makes the plan, so every screen shows the figure the customer is billed. A receipt with paise is refused. | `booking.ts` (plan), `utils/report-ledger.ts` `baseCostSql` |
| TA-07 | GST of the plan is worked out **per charge component and rounded to the rupee**; the last instalment absorbs the remainder so the demands add up to the plan total exactly. Billed GST can therefore differ from the exact percentage by under 50 paise per component. This is intended. A receipt's own GST (the part inside the money received) is kept **to the paisa** and is what the receipt, print, ledger and invoice show. | `utils/gst-resolver.ts`, `utils/gst-receipt-split.ts` |
| TA-09 | A booking is **not cancelled while the applicant has live money** (a receipt that is not cancelled or bounced). Cancel or bounce the receipts first, or settle through Surrender. | `POST /booking/:id/cancel` |
| TA-10 | One applicant has **one unfinished booking** at a time. Confirm or cancel it before booking another unit. | `POST /booking` |
| TA-12 | Automations, email templates and FAQ articles are configuration: changing them needs the **edit** right on Communications. A support agent (view, create) can read and send, not configure. | `index.ts` `configEdit`, `routes/faq.ts` |
| Q16 | Deposit, clear, hold and bounce need the **receipt checker** process right (super admin has it). The person who recorded a receipt **cannot clear or bounce it**. | `routes/receipts.ts` `move`, `routes/payments.ts` bounce |
| TA-03/04 | A receipt with no instalment goes to the **first open instalment**. Bouncing or cancelling a receipt allocates the plan again from the receipts still valid, so every demand it paid (the overpayment cascade included) reopens and its helper rows are cancelled. | `routes/receipts.ts`, `utils/payment-waterfall.ts` `reallocatePlan` |
| TA-14 | A GST invoice made for a receipt is that receipt's own tax; the screen and the caller cannot choose another rate. | `routes/payments.ts` `POST /gst-invoices` |
