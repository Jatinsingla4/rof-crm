# Module 1 scope: Set Master (reference data)

## In scope
- Screens (rail): Locations, Applicant lists, Banks, Companies, Document checklist, Dispatch log.
  Files: `packages/web/public/js/pages/set-master.js`, `set-master-docs.js`, `set-master-company.js`, `css/set-master.css`, the Set Master entries in `index.html` and the route line in `js/app.js`.
- API: the Set Master routes in `packages/api/src/routes/master.ts` (countries, states, cities, banks, salutations, professions, nationalities, sources-of-enquiry, document-types, document-dispatch, usage), `routes/companies.ts`.
- Shared helpers added for it: `middleware/pg-errors.ts`, `middleware/auditLogger.ts` (`auditChange`), `master_data` in `middleware/rbac.ts`, the `autoAudit` skip line in `index.ts`.
- Database: tables countries, states, cities, banks, salutations, professions, nationalities, sources_of_enquiry, document_types, document_dispatch, companies, company_bank_accounts, the `global_settings` company keys, `audit_logs` rows written by these routes. Migration 096. Baseline files for these tables.
- Read only study (flow chat): every place outside the module that reads these lists, the company details or the document types.

## Out of scope (other modules; log findings as "other module" with a DT number)
- Module 2: Employee Login Creation, Employee screens, Security, Roles, Role and Menu, Customized Letters (all still sit in the Set Master menu).
- Module 3: reminder master, unit types, floors, tax slabs (they share `master.ts`), projects, charges.
- Booking, receipts, demand letters, GST invoices, brokers: only as readers of Set Master data.

## Known state at the start of the next round
- The revamp and the fixes of 2026-10-16 are in the main folder, uncommitted. See `01-set-master.md` for what was changed and tested.
- Earlier reports: `01-set-master-flow.md`, `01-set-master-verification.md`, `docs/FEATURE_AND_UI_PROPOSALS.md`. They were written against older code (the UI was rewritten after the verifier's first pass); re-check anything that mentions `SMPage.edit`, the 11 tabs or `set-master.js` line numbers.
- Owner decisions still open: DT-049 (document name unique per project?), DT-050 (role matrix), DT-056 (rename or deactivate for text lists), DT-060 (GST flag on nationality), DT-065 (logo only for the active company?), DT-067 (phone, PIN, GSTIN rules).
