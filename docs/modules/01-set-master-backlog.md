# Module 1 backlog (Set Master)

Columns: ID | Item | Found by | Priority (P0 money or data loss, P1 broken or unsafe, P2 should fix, P3 nice) | Effort (S, M, L) | Status | Reference.
Statuses are defined in `docs/CHAT_PLAYBOOK.md`. Add rows at the bottom, use the next free ID (`M01-Xnnn`: B bug, F feature, U UI, D decision).

| ID | Item | Found by | Pri | Effort | Status | Reference |
|---|---|---|---|---|---|---|
| M01-D001 | Is a document name unique per project instead of global? | owner | P2 | S | needs decision | DT-049 |
| M01-D002 | Role matrix for `master_data` (project_manager create and edit only) | owner | P1 | S | needs decision | DT-050 |
| M01-D003 | Rename of a used text list item: block, cascade to consumers, or deactivate | owner | P1 | M | needs decision | DT-056, SM-F3, SM-F4 |
| M01-D004 | GST flag on nationality instead of matching the text NRI, OCI, PIO | flow review | P0 | M | needs decision | DT-060 |
| M01-D005 | Logo upload changes the global logo for any company; only for the active company? | verifier | P1 | S | needs decision | DT-065 |
| M01-D006 | Phone, PIN and GSTIN rules (two numbers, foreign PIN, checksum) | verifier | P3 | S | needs decision | DT-067 |
| M01-B001 | Receipts print the global company copy, not the project's company | flow review | P0 | M | other module (Receipts) | DT-061 |
| M01-B002 | Demand and allotment letters can pick the wrong company; cleared fields fall back to old global values; letters print legacy bank columns | flow review | P1 | M | other module (Documents) | DT-062 |
| M01-B003 | Booking, Brokers, Edit Booking put master names into HTML without escaping | flow review | P1 | S | other module | DT-063 |
| M01-B004 | Booking uses a fixed document list, not `document_types` | flow review | P2 | M | other module (Booking) | DT-059 |
| M01-B005 | Companies cannot be deactivated; a manual delete cascades to bank accounts and projects | flow review | P2 | S | open | DT-064 |
| M01-B006 | Duplicate names can still race in (check then insert); no unique index on `lower(name)` | verifier | P2 | S | open | DT-066 |
| M01-B007 | `GET /master/usage` scans three tables on every page load | verifier | P3 | S | deferred | DT-069 |
| M01-B008 | Committed `dist/` is stale; rebuild before commit | verifier | P1 | S | open (at commit time) | DT-070 |
| M01-U001 | Phone width and keyboard use of the new screens not tested; no full accessibility pass | fixer | P2 | M | open | DT-055 |
| M01-F001 | Master completeness page (no primary bank, no GSTIN, project without documents) | UI review | P2 | M | open | SM-F13 |
| M01-F002 | Format checks only on changed values; add a one click "check all companies" report | fixer | P3 | S | open | |
| M01-F003 | Bulk import and export of cities, banks, professions | UI review | P3 | M | open | SM-F12 |
| M01-F004 | Copy a project's document checklist to another project | UI review | P2 | S | open | SM-F9 |
| M01-B009 | Test scripts live in `/tmp/sm` (t2 to t5) with fixed port and database names; move them to `packages/api/tests/` driven by environment variables so every chat can run them | fixer | P1 | S | open | DT-042 |
