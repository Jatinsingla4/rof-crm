# F. Historical data repair plan

Nothing was repaired. Every item is read only until finance approves. Take a backup (Neon branch or `pg_dump`) before any change, and run each change in one transaction that can be rolled back.

| Exception | How to list it (read only) | Proposed change | Approval | Rollback |
|---|---|---|---|---|
| Live invoice on a cancelled or bounced receipt (INV/2026/00003) | `GET /payments/gst-invoices/exceptions` | cancel through the checker route, which issues the credit note | finance and the accounting treatment | the credit note is reversed by a debit note |
| Schedule short of price (Sh Tester) | `GET /reports/customer-due-summary` rows with `schedule_exception` | regenerate or complete the plan rows through the plan screens | finance, per customer | restore the demands from the backup |
| Zero rate or zero GST live bookings, Available unit with a live booking, duplicate or orphan registrations | `GET /reports/booking-exceptions` | correct the booking or unit by hand with an audit note | sales head and finance | restore the rows from the backup |
| Commission Paid with no cleared money | `GET /brokers/commission` (`cleared_basis_ok = false`) | none by default, review each payout | finance | none (no change is made) |
| Overpayment shown beside dues | Demand Status "customer credit, not yet allocated" | checker allocation through the credit allocation screen | finance, BR-09 | reverse the allocation (approved reversal exists) |
| Pending receipts and pending cheques of a cancelled booking | dashboard approval queue (`booking_cancelled`) | refund or reject | finance | none |

Do not overwrite signed agreements or issued demands. Do not turn any financial flag on before the shadow report (`allocationShadow`) is read and signed off.
