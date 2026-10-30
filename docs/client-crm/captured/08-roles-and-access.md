# Captured from the client CRM, part 8: roles, access and small system rules

## Roles (Role Category Wise Page Hierarchy)
15 roles: Account, Admin, ATS, Atulyas_View, Audit, Collection, CRM, CRM_View, Dispatch, Finance, Loan, MIS, MIS_Atulyas, MIS_ICITY, Receipt.
Menu categories a role can be given pages in: Set Master, Set Projects, Application, Reports, Broker, Email, SMS, Collection, Parking. The screen is Role + Category -> Fetch -> tick pages.
Reading: roles are **by job** (Receipt, Loan, Dispatch, ATS = agreement to sale, Collection, Audit) and some are **by project** (Atulyas_View, MIS_Atulyas, MIS_ICITY). Access is by page, not by create / edit / delete.
- GST has its own table "GST Process User Rights": Employee -> for every GST process the four rights View, Add, Edit, Delete (+ Reset, Track).
- Users are 60+ employees each with a login name; a user sees only the projects given to him (a screen that lists 13 projects for an admin lists 2 or 3 for a restricted user).
- Header on every page: "Welcome, <user>", "You are currently logged in from the IP address <ip>" (they show the IP; whether it is restricted was not visible), Home, Logout, and a header link for Task Assignment and Reminder.
- Edit Installment is protected by a separate **security code** prompt ("Login Security Code").
- A customer file can be **locked / unlocked** from Customer Register (counts shown: total, locked, unlocked file).
- Many screens have **Track** (change history) and **Chart Report (Alt+H)** (keyboard shortcut) buttons.
- Header "Help" links open PDF manuals for GST, Demand Raise and GST Invoicing (3 PDFs, not read).

## Compared with ours
Ours has 6 roles (super_admin, project_manager, sales_executive, accounts_finance, support_agent, read_only_viewer), create / view / edit / delete per resource, project scope in the database, audit log, IP restriction table (`user_ip_restrictions`) and process permissions (`user_process_permissions`, `gst_process_rights`). The client's job roles (Receipt, Loan, Dispatch, ATS, Collection, Audit) can be built on our permission matrix without new code, as presets. Customer-file lock and the Track button per master are not in ours (our audit log covers the history but a "Track" button on each master screen is missing).

## Example of a role's pages (role "Receipt", category Application; Role Category Wise Page Hierarchy)
The screen shows the menu tree of the role: Booking (Booking Form, Edit Booking Form, Head Wise Cost, Edit Customer Address, Unit Shifting Process [Shift Units, Unit Shift Report], Customer Register, Approval Status [Booking Status, Editing Status], Applicant Addition/Deletion Process) and Receipt Process (Receipt Generation, Receipt Print, Journal Entry [Journal Entry] ...). So a "Receipt" role is a **set of pages** and it also holds many booking pages; permission is "can open this page", with no separate create / edit / delete flags (those exist only for GST processes).
