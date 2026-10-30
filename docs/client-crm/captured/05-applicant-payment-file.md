# Applicant Payment File (PaymentPlanDetailReport.aspx): the one-page view of a customer
Opened from Customer Register by clicking a customer name. Layout and **worked numbers** were read from one real file; the customer's name, contact and ID numbers are deliberately not kept here (screenshot is local only, not in git).

## Layout (top to bottom)
1. Header: "APPLICANT FILE (project)", "Last Update: date, time, By: user", Customer ID (registration no), print date; icons: PDF, Excel, print, back, close.
2. First applicant (and further applicants): name with S/o line, present address, mailing address choice, contact no, landline, email, PAN, Aadhaar, date of birth.
3. Unit block (left): Project, Tower, Floor, Unit No, Unit Type, Location, Loan information (Self / Loan). Plan block (right): Payment Plan, Broker Code, Main Broker, Customer Classification, Employee, **Booking Created By**, Preferred communication mode, **Document Status** (a coloured box).
4. Areas and rate: Super Area, Carpet Area, Rate per sq ft.
5. Cost box:
   - Net Basic Price (with "Rs. per Sq. Ft." and per Sq. Mt.), Add: PLC, Other Charges, (further lines),
   - Total Consideration, CGST, SGST, **Total Consideration With Tax** (and amount in words),
   - Interest, Interest Waive off, **Total Receivables**,
   - Less Receipt (with "Paid Amount %"), Less Interest paid, Payment Refund,
   - **Balance (To be Paid)**.
6. Timeline strip: BOOKING date, ALLOTMENT date, AGREEMENT date.
7. TAX DETAILS table: CGST, SGST: Total, Paid, Balance.
8. Payment Contribution: Own Contribution / Loan (bank) split: Amount, CGST, SGST, Total.
9. INTEREST summary: Total interest, Waive off, Paid, Paid GST, Balance, GST on interest, Total.
10. PAYMENTS SCHEDULE (one row per installment): Installment Name, Due Date, %, Net BSP, Due (installment amount demanded), CGST, SGST, Net Due, Received, Outstanding; total row.
11. RECEIPT INFORMATION (legend: Bounce cheque / Pending cheque / Loan receipt): Receipt No, Receipt Date, Mode, Instrument No, Instrument Date, Drawn On (customer's bank), **Clearing Bank (the company's bank account)**, Clear/Bounce Date, Amount, CGST, SGST, Net Amount, Payment Status, Remark, On Account Of; totals Received / Pending / Cleared.
12. INTEREST detail (one block per installment): Installment Name, Installment Date, Due Amount, Amount Received, Date of Received, Delay Amount, Delay Days, Grace Period, Interest Period, ROI, Interest Amount.
13. Footer: Registration Remarks, Allotment Remarks.

## The arithmetic, checked against the numbers on the page
- **Net Basic = Rate x Area** (11,500 x 510 = 58,65,000). Discounts come off before this.
- **GST on the basic = 5%** split CGST 2.5% + SGST 2.5% (2,93,250 on 58,65,000). Total with tax = 61,58,250.
- Installment amount = plan % x Net Basic (9% / 10% / 81% in this plan: 5,27,850 / 5,86,500 / 47,50,650). Each installment carries its own CGST and SGST; Net Due = installment + CGST + SGST. The last installment (81%, "On Intimation for Offer of Possession") has no due date and shows **Due 0 until it is raised**, even though the % is part of the plan.
- **A receipt is tax-inclusive.** Net Amount 6,75,750 = base 6,43,571.42 + CGST 16,089.29 + SGST 16,089.29 (base = net / 1.05). So the system splits the money received into basic + CGST + SGST; "Payment Contribution" and "Tax details Paid" add these up.
- Money received first clears the oldest raised installment, then the next; an amount larger than the raised dues is kept against the next installment (shown as Received on a not-yet-raised row, with Outstanding 0).
- **Interest** (simple, per installment, per payment): Delay Amount x Delay Days x ROI% / 365, where ROI is 15 here and there is a Grace Period and a separate "Interest Period" (= delay days minus grace). Worked check: 1,32,824 x 57 x 15% / 365 = 3,111. Negative delay days mean paid early: no interest. **GST 5% is charged on the interest** (156 on 3,111 = 3,267 total). Interest can be waived off (shown separately).
- Total Receivables = Total with tax + Interest - Interest waived. Balance = Total Receivables - Receipts - Interest already paid + Payment Refund. "Paid Amount %" = Receipts / Total with tax.
- Cleared vs pending: the three receipt totals are Received (all), Pending (under clearing), Cleared. Only **cleared** money counts as paid on the schedule.
- Receipt numbers look like `PROJECTPREFIX` + 4-digit counter (ROF-GALLER0001); the clearing bank is a company bank account named for the companies it serves.

## What ours should show / do the same
Our penal interest default is 15% in `consumers.ts`, which matches their ROI; the split of receipt into basic + CGST + SGST and the FIFO matching of money to dues must give the same numbers on the same inputs. A test with this worked example (rate 11,500, area 510, plan 9 / 10 / 81, three receipts of 6,75,750, 3,54,853 and 4,94,317.50) should reproduce: total 61,58,250, received 15,24,921, interest 3,111 + GST 156, balance 46,36,441. (The three receipt dates and the 15% rate are in the page; the installment dates are 23/01/2023 and 22/02/2023.)
