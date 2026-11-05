# Unit-status questions Q-U1, Q-U2, Q-U3 and Q-A1: exact wording, explicit A/B choices, and what each choice does at runtime

**Source of the wording:** plan section 14 (decision status table) and section 8.2, from the **v6 copy** (`/Users/ketansingla/Desktop/ROF_USERS_ROLES_AUDIT/USERS_ROLES_OWNER_POLICY_FINAL_PLAN.md`).
v7 is missing (see `00-plan-integrity.md`); if v7 worded a question differently, v7 wins. Text in quotation marks is copied from the v6 file and was re-checked against it character for character
(the earlier version of this document had three small misquotes, corrected below: an added "an", and two omitted line references). The "runtime consequence" and "deployment and test risk" lines are
derived from the code at HEAD, the test suites and the database catalogue; they say so where they depend on something that was not verified.

**How these are asked.** Q-U1 and Q-A1 are phrased by the plan as yes/no questions. The plan rows for **Q-U2 and Q-U3 are not yes/no questions**: the last cell says only "Requires OWNER confirmation: yes", next to a
"recommended design". An answer "yes" to those can be read in two opposite ways, so all four are presented below as **A or B**. Please answer with the letter.

**Background that applies to all four.** Today (`utils/unit-grant.ts`, `middleware/unitStatusAccess.ts`): NULL, missing or unknown unit status means `none`; a login with `none` gets an **empty** unit list and a refusal (403) on
the other inventory views; booking, a new allotment, shift and hold check the unit's current status against the grant; `GET /api/units/lookup` serves the non-inventory screens and ignores the grant.
Unit statuses that exist in the test data: available, booked, locked, allotted, temp_surrender, held. The partial grants cover: `available` = available; `available_hold` = available, held, locked; `unit_hold` = held, locked;
`all` = every status; `none` = nothing. **No partial grant covers booked, allotted or temp_surrender.**

---
## Q-U1: the unit editor and the unit grant
**Plan row (section 14):** "Q-U1 unit editor and the unit grant | POLICY-APPROVED: unit status limits inventory views only | RECOMMENDED DESIGN: filter `GET /units/:id/charges` with the unit detail family | Requires OWNER confirmation: yes: must Set Projects administration obey the grant?"
**Plan section 8.2 (facts):** the handler reads no consumer, receipt, demand, ledger or booking data (it returns the add-on charges attached to a unit in advance and the charges every booking adds by itself); the only caller is the edit-unit dialog of Set Projects; "A Set Projects user with `none` would otherwise lose the unit editor".
**Where it stands at HEAD:** `GET /api/units/:id/charges` is deliberately **not** covered by the inventory gate (`routes/units.ts`, the `router.use` that skips `/charges`).
- **A: yes, Set Projects administration obeys the grant** (the plan's recommended design).
  *Runtime consequence:* that route would answer **403** to a login whose unit status is `none`, NULL or unknown, so the edit-unit dialog could not load charges for it. A partial grant (for example `available`) would **still pass** the gate and read the charges of a unit in any status, unless a status filter is built in addition. `PUT /api/units/:id/charges` (the writer, allowed to super_admin and project_manager through the `units` module) is **not** grant-checked today and would not be by this choice, so a project manager with `none` could still write charges they can no longer read: A is a read-side limit only.
  *Deployment and test risk:* anyone who edits units in Set Projects must hold `all` (decided login by login in D7) or the dialog breaks for them; no test covers this route with a limited grant today, one would have to be added; the Playwright Set Projects tests run as super_admin and are unaffected.
- **B: no, the editor does not obey the grant.**
  *Runtime consequence:* unchanged from today: a login that passes the `units` module permission and its project scope can read the add-on charge setup of a unit it names, whatever its grant. Nothing about customers or money is in that response (per the plan facts above).
  *Deployment and test risk:* none.

## Q-U2: transfers and promoting a booked allocation
**Plan row (section 14):** "Q-U2 transfers and booked-unit promotion | POLICY-APPROVED: manual UUID cannot bypass restrictions for **new** allocation | RECOMMENDED DESIGN: no grant check on transfer and on the `booked` branch of `POST /allocations` | Requires OWNER confirmation: yes"
**Plan section 8.2 (facts, from the route table):** for `POST /api/transfers`: "**no inventory check proposed**: ownership transfer of an already allocated unit, not a new inventory selection (**Q-U2**)"; for `POST /api/allocations`: "the `booked` branch promotes an existing booking (62-67), a historic lifecycle step: no inventory check proposed (**Q-U2**)".
**Where it stands at HEAD:** the recommended design is what is built: `routes/transfers.ts` has no grant check, and in `routes/allocations.ts` the grant is checked only on the `available` branch; shift and hold are checked.
- **A: no grant check on transfers and on promoting a booked unit** (the plan's recommended design; HEAD behaviour).
  *Runtime consequence:* a login with **any** grant, including `none`, can transfer an allotted unit to a new owner or promote an existing booking to an allotment by typing the unit id, as today. The grant keeps limiting only the choosing of new inventory (list, new allotment, shift, hold).
  *Deployment and test risk:* none.
- **B: apply the grant to transfers and to the booked-promotion branch as well.**
  *Runtime consequence:* each step would require the unit's **current status** to be covered by the login's grant. Transferred and promoted units are `allotted` or `booked`, which **no partial grant covers**, so only `all` or super_admin could complete these steps; a login with `none`, `available`, `available_hold` or `unit_hold` could not.
  *Deployment and test risk:* a code change in `transfers.ts` and in the booked branch of `allocations.ts`; staff who process transfers and promotions must hold `all` (D7) before release or those daily tasks fail; new tests are needed (the current transfer and allocation tests run as super_admin and would not notice).

## Q-U3: the trigger that forces `none` on a new login
**Plan row (section 14):** "Q-U3 new-login unit status trigger | POLICY-APPROVED: new non-admin logins default to `none`; `all` is an explicit grant | RECOMMENDED DESIGN: optional `BEFORE INSERT` trigger forcing `none` so even old code cannot create `all` (6A.6) | Requires OWNER confirmation: yes (changes how `all` is granted: only by a later edit)"
**Where it stands at HEAD:** no trigger (the database catalogue shows no user-defined trigger on `users`); the application creates new logins with `none`; the draft column default (M9) is not applied. Old code (before this work) created new logins with `all`, and the pipeline migrates before it deploys the code, so for a short window old code can still create `all` logins.
- **A: add the `BEFORE INSERT` trigger** (a database change, in a release batch).
  *Runtime consequence:* every insert into `users`, from any code or from SQL, ends up with `none`, even if the insert says `all`. To give a login `all` it is created and then **edited** (two steps). In the Users screen a super admin who picks `all` on the **create** form would get a login with `none`, silently. It closes the window in which old code creates `all` logins.
  *Deployment and test risk:* (1) `packages/api/scripts/make-test-db.sh` inserts the six seeded logins with `all`; they would become `none` and the tests that rely on them (a large part of the API and browser suites; not counted) would break until the seed inserts and then updates; (2) test scripts that create a login with `unitStatusAccess: 'all'` (scope, company-access and others) would need a follow-up edit; (3) a restore of a scrubbed copy that loads data with COPY **may fire the trigger** and reset every `all` to `none`, depending on how the restore is done (not verified; restore tools can disable triggers); (4) the trigger is a migration: it goes through the batch and approval gates.
- **B: no trigger; rely on the application default and on M9.**
  *Runtime consequence:* a login created without a value gets `none`; an insert that names `all` explicitly (old code during the deploy window, or SQL by hand) creates an `all` login. `all` can still be granted in one step at creation.
  *Deployment and test risk:* none now; the deploy window remains; M9 (column defaults, a separate migration) still has to ship and is not sufficient alone.

## Q-A1: booking read endpoints
**Plan row (section 14):** "Q-A1 booking read endpoints | POLICY-APPROVED: none frozen | RECOMMENDED DESIGN: add a module permission for `GET` booking routes if the owner wants reads restricted | Requires OWNER confirmation: yes: are open reads of bookings intended?"
**Plan section 8.2 (fact):** "**Reads are not guarded:** `GET /api/booking`, `/:id`, `/:id/receipt-html`, `/check-cheque`, `/check-form-no` (`booking.ts:188, 254, 529, 3378, 3480`) pass for any authenticated role because the mount has no `rbac` and the router guard returns early for GET; whether that is intended is **not decided** (owner confirmation Q-A1); project/company scope (RLS) still applies to what they return."
**Where it stands at HEAD:** those five `GET` routes are open to every signed-in role within its project and company scope (`routes/booking.ts`, mount in `index.ts` without `rbac`); the printable `receipt-html` page also needs the print grant.
**Fact that decides what restricting would do:** all **six system roles currently hold `consumers: view`** (`middleware/rbac.ts`: super_admin, project_manager, sales_executive, accounts_finance, support_agent, read_only_viewer), and a custom role resolves to its base role. They also all hold `payments: view`.
- **A: yes, open reads of bookings are intended.**
  *Runtime consequence:* no change; every signed-in role reads bookings in its scope.
  *Deployment and test risk:* none.
- **B: no, reads must be restricted.**
  *Runtime consequence:* restricting means choosing a **permission** to require on those five routes. Requiring **`consumers: view` changes nothing**, because every system role already has it, so it would only look like a restriction. A restriction only takes effect with a stricter permission; for example requiring a `consumers` create or edit right would keep super_admin, project_manager and sales_executive and remove booking reads from accounts_finance, support_agent and read_only_viewer (derived from the matrix above, not tested). Which permission is itself an owner choice the plan leaves open.
  *Deployment and test risk:* a code change on the router; screens that call those routes for the removed roles would show errors; tests for those roles would need to expect the refusal.

---
## How to review this document
For each question: (1) check that the quoted plan row is the one you meant (if you have v7, compare); (2) check that "where it stands at HEAD" matches what you see; (3) read **both** letters' runtime consequence and risk, not only the one you expect to choose; (4) answer with the letter. Where a sentence says "not verified" or "derived", it is a reasoned consequence, not a measured one. Until you answer, HEAD keeps the behaviour in each "where it stands" line.
Recommendations (clearly not approved policy) are separate: `05-recommendations-not-policy.md`.
