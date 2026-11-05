# Unit-status questions Q-U1, Q-U2, Q-U3 and Q-A1: the exact wording and what YES and NO each change

**Source of the wording:** plan section 14 (decision status table) and section 8.2, from the **v6 copy** (`/Users/ketansingla/Desktop/ROF_USERS_ROLES_AUDIT/USERS_ROLES_OWNER_POLICY_FINAL_PLAN.md`);
v7 is missing (see `00-plan-integrity.md`), so if v7 worded a question differently, v7 wins. The text in quotation marks is copied; the paragraphs "Effect of YES" and "Effect of NO" are
the direct consequence of the quoted option plus what the code at HEAD does today, and say so where they rely on code. Nothing is interpreted beyond that.

**Background that applies to all four.** Today (`utils/unit-grant.ts`, `middleware/unitStatusAccess.ts`): NULL, missing or unknown unit status means `none`; the unit list and the other inventory views
refuse `none`; booking, new allotment, shift and hold check the unit's current status against the grant. A login with `none` gets an **empty** unit list and a refusal on the other inventory views.
`GET /api/units/lookup` serves the non-inventory screens and ignores the grant.

---
## Q-U1: the unit editor and the unit grant
**Plan row (section 14):** "Q-U1 unit editor and the unit grant | POLICY-APPROVED: unit status limits inventory views only | RECOMMENDED DESIGN: filter `GET /units/:id/charges` with the unit detail family | Requires OWNER confirmation: yes: must Set Projects administration obey the grant?"
**Plan section 8.2 (facts):** the handler returns `{attached, mandatory}` (the add-on charges attached to a unit in advance and the charges every booking adds by itself); it reads no consumer, receipt, demand, ledger or booking data; the only caller is the edit-unit dialog of Set Projects (`set-projects.js`); "A Set Projects user with `none` would otherwise lose the unit editor."
**Where it stands at HEAD:** this route is deliberately **not** filtered by the grant (it is skipped by the inventory gate).
- **Effect of YES** (Set Projects administration must obey the unit grant): a login whose unit status is `none` (or NULL or unknown) gets a refusal on that route, so **the edit-unit dialog cannot load for such a login** (the plan's own words: it "would otherwise lose the unit editor"). A login with `all`, or super_admin, is unaffected. Practical rule that follows: anyone who edits units in Set Projects needs `all` (or the plan's partial grants, whichever the filter is built to accept).
- **Effect of NO** (the unit editor does not obey the grant): the route stays open to every login that passes the `units` module permission and the project scope, whatever its unit grant. What that login can read through it is the add-on charge setup of a unit it names, nothing about customers or money (per the facts above). Nothing else changes.

## Q-U2: transfers and promoting a booked allocation
**Plan row (section 14):** "Q-U2 transfers and booked-unit promotion | POLICY-APPROVED: manual UUID cannot bypass restrictions for **new** allocation | RECOMMENDED DESIGN: no grant check on transfer and on the `booked` branch of `POST /allocations` | Requires OWNER confirmation: yes"
**Plan section 8.2 (facts):** a transfer is "an ownership transfer of an already allocated unit, not a new inventory selection"; the `booked` branch "promotes an existing booking, a historic lifecycle step".
**Where it stands at HEAD:** the recommended design is what is built: there is **no** grant check on transfers and on the `booked` branch; the new-allocation (`available`) branch, shift and hold are checked.
- **Effect of YES** (confirm the recommended design, no grant check there): staff who handle **existing customers** (transfer an unit to a new owner, promote an existing booking to an allotment) can do so with any unit grant, including `none`, by the unit's id, exactly as today. The grant keeps limiting only the choosing of new inventory.
- **Effect of NO** (apply the grant to those two steps as well): a transfer or a promotion would require the unit's **current status** to be covered by the login's grant. A transferred or booked unit is not `available`, so a login with `none` or `available` could not complete those steps; only a login with `all` (or the partial grants that cover that status) or super_admin could. Practical rule that follows: staff who process transfers and promotions need `all`.

## Q-U3: the trigger that forces `none` on a new login
**Plan row (section 14):** "Q-U3 new-login unit status trigger | POLICY-APPROVED: new non-admin logins default to `none`; `all` is an explicit grant | RECOMMENDED DESIGN: optional `BEFORE INSERT` trigger forcing `none` so even old code cannot create `all` (6A.6) | Requires OWNER confirmation: yes (changes how `all` is granted: only by a later edit)"
**Where it stands at HEAD:** no trigger. The application creates new logins with `none`; the draft column default (M9) is not applied. Old code (before this work) created new logins with `all`, and CI runs migrations before it deploys the code, so for a short window old code can still create `all` logins.
- **Effect of YES** (add the trigger, a database change in a release batch): every insert of a login, from any code or from SQL by hand, ends up with `none`, even if the insert says `all`. To give a login `all` you create it and then **edit** it (two steps). It also closes the window in which old code creates `all` logins.
- **Effect of NO** (rely on the application default and on M9): `none` is the default only when the insert does not name a value; an insert that names `all` (old code during the deploy window, or manual SQL) creates an `all` login. Granting `all` stays possible in one step at creation.

## Q-A1: booking read endpoints
**Plan row (section 14):** "Q-A1 booking read endpoints | POLICY-APPROVED: none frozen | RECOMMENDED DESIGN: add a module permission for `GET` booking routes if the owner wants reads restricted | Requires OWNER confirmation: yes: are open reads of bookings intended?"
**Plan section 8.2 (fact):** "Reads are not guarded: `GET /api/booking`, `/:id`, `/:id/receipt-html`, `/check-cheque`, `/check-form-no` pass for any authenticated role because the mount has no `rbac` and the router guard returns early for GET"; project and company scope (row security) still applies to what they return. At HEAD the printable `receipt-html` page additionally needs the print grant.
- **Effect of YES** (open reads are intended): no change. Any signed-in login, whatever its role, can read the bookings that its project and company scope allows (the plan's own list of five read routes).
- **Effect of NO** (reads must be restricted): a module permission is added to those `GET` routes, and a login whose role lacks it can no longer read bookings there. **Which** permission to require (for example the consumers view right) is a further choice the plan leaves open; it would also change which roles still see bookings on their screens.

---
## How to review this document
For each question there are two options and a short effect for each. Check three things: (1) the quoted plan row is the question you meant (if you have v7, compare); (2) the "Where it stands at HEAD" line matches what you see in the application; (3) the effect of YES and of NO is the consequence you would accept. Then answer each of the four with **YES** or **NO** as the question is phrased in its row. If the effect of an option surprises you, that is a reason not to answer yet, not a reason to guess. Until you answer, HEAD keeps the "where it stands" behaviour above.
