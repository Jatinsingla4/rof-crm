# Captured from the client CRM, part 7: how letters are built (Letter Setup Master, project ROF AMBLISS)

## Model
- A letter is stored **per project (and optionally per tower), per letter type, in two parts: Top and Bottom**. The system generates the middle itself (a table, switch "Grid" Yes / No). Output = Top text + generated grid + Bottom text. Each part has Active / Deactive and can be edited or deleted.
- Letter types offered here (14): Welcome, Receipt, Demand, Reminder, Cancellation Letter, Final Opportunity Letter, Allotment, Name Address Changes, Interest, Area Increase, Offer Of Possession, No Dues, Possession, Handover. (The same screen for another project showed only 11: Cancellation, Final Opportunity and Reminder are extra.)
- AMBLISS had 15 saved parts, e.g. Allotment (top + bottom with signature block "For @Company@ ... Manager (Accounts and Finance)"), Demand (top + bottom), Interest (top), Receipt (top "Received with thanks from @CustomerWithCoApp@ ..." + bottom "For @Company@ ... Authorized Signatory").
- Text uses variables between @ signs (list in part 1) plus these seen in real letters: @CarpetArea@, @BalconyArea@, @CustomerWithCoApp@.

## Demand letter shape (wording kept short, paraphrased)
TOP: bold subject "Demand of installment in respect of your allotment of Unit No. @UnitAddress@ in our project @Project@ located at @ProjAddress@"; "Dear Sir/Madam"; says the unit was allotted with its carpet and balcony area, "your next installment has become due as per the payment plan agreed and accepted by you", and asks for payment as per the details below.
MIDDLE (generated): the installment table.
BOTTOM: asks to clear the dues of Rs @balancedueamount@ (in words) by demand draft / cheque / RTGS in favour of "@Company@" payable at @PayableAt@ on or before the due date @DueDate@; states that interest is charged at applicable rates on delayed payment; adds a note that the demand does not include other charges (text continues).

## What this means for ours
Checked in our code: Top / Bottom parts, the Grid switch, the types Reminder, Cancellation Letter and Final Opportunity Letter, and the carpet and balcony area variables **already exist** in `custom-letters` and `documents`. The only variable not found is **@CustomerWithCoApp@** (customer name together with the co-applicant), used on receipts. A real side-by-side of every letter type's wording is still to do.
